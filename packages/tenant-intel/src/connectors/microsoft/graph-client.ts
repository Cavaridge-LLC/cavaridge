/**
 * Microsoft Graph API Client
 *
 * Authenticated wrapper around @microsoft/microsoft-graph-client.
 * Handles OAuth 2.0 client credentials flow, pagination, rate limiting,
 * and exponential backoff with jitter on 429 responses.
 */

import { Client } from "@microsoft/microsoft-graph-client";
import { ClientSecretCredential } from "@azure/identity";
import { TokenCredentialAuthenticationProvider } from "@microsoft/microsoft-graph-client/authProviders/azureTokenCredentials/index.js";
import type { M365Credentials } from "../../shared/types.js";

const GRAPH_SCOPES = ["https://graph.microsoft.com/.default"];
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;
const MAX_CONCURRENT_REQUESTS = 4;

export class GraphClient {
  private client: Client;
  private activeRequests = 0;

  constructor(credentials: M365Credentials) {
    const credential = new ClientSecretCredential(
      credentials.azureTenantId,
      credentials.clientId,
      credentials.clientSecret,
    );

    const authProvider = new TokenCredentialAuthenticationProvider(credential, {
      scopes: GRAPH_SCOPES,
    });

    this.client = Client.initWithMiddleware({ authProvider });
  }

  async get<T>(path: string, queryParams?: Record<string, string>): Promise<T> {
    return this.withThrottle(() => this.requestWithRetry<T>("GET", path, queryParams));
  }

  async getAll<T>(path: string, queryParams?: Record<string, string>): Promise<T[]> {
    const results: T[] = [];
    let nextLink: string | undefined;
    let currentPath = path;
    let currentParams = queryParams;

    do {
      const response = await this.get<GraphPagedResponse<T>>(
        nextLink ? "" : currentPath,
        nextLink ? undefined : currentParams,
      );

      if (nextLink) {
        const pagedResponse = await this.withThrottle(() =>
          this.requestWithRetry<GraphPagedResponse<T>>("GET_URL", nextLink!),
        );
        results.push(...(pagedResponse.value || []));
        nextLink = pagedResponse["@odata.nextLink"];
      } else {
        results.push(...(response.value || []));
        nextLink = response["@odata.nextLink"];
      }
    } while (nextLink);

    return results;
  }

  private async requestWithRetry<T>(
    method: string,
    path: string,
    queryParams?: Record<string, string>,
    attempt = 0,
  ): Promise<T> {
    try {
      if (method === "GET_URL") {
        return await this.client.api(path).get();
      }

      let request = this.client.api(path);
      if (queryParams) {
        request = request.query(queryParams);
      }
      return await request.get();
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode;
      if (status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = getRetryAfterMs(err) || BASE_DELAY_MS * Math.pow(2, attempt);
        const jitter = Math.random() * 500;
        await sleep(retryAfter + jitter);
        return this.requestWithRetry<T>(method, path, queryParams, attempt + 1);
      }
      throw err;
    }
  }

  private async withThrottle<T>(fn: () => Promise<T>): Promise<T> {
    while (this.activeRequests >= MAX_CONCURRENT_REQUESTS) {
      await sleep(100);
    }
    this.activeRequests++;
    try {
      return await fn();
    } finally {
      this.activeRequests--;
    }
  }
}

interface GraphPagedResponse<T> {
  value: T[];
  "@odata.nextLink"?: string;
  "@odata.count"?: number;
}

function getRetryAfterMs(err: unknown): number | undefined {
  const headers = (err as { headers?: Record<string, string> }).headers;
  const retryAfter = headers?.["retry-after"];
  if (!retryAfter) return undefined;
  const seconds = parseInt(retryAfter, 10);
  return isNaN(seconds) ? undefined : seconds * 1000;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
