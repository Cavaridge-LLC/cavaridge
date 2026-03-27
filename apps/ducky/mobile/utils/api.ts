/**
 * Ducky Intelligence — API Client
 *
 * Centralized HTTP client for communicating with the Ducky server API.
 * Handles auth token injection, error normalization, and base URL config.
 */

import Constants from "expo-constants";
import { getSession } from "./auth";

const DEV_API_URL = "http://localhost:5000";
const PROD_API_URL = "https://ducky.up.railway.app";

export const API_BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl ??
  (__DEV__ ? DEV_API_URL : PROD_API_URL);

export const BRANDING = {
  appName: "Ducky Intelligence",
  appDescription: "AI Research & Intelligence Platform",
  duckyIntelligence: "Ducky Intelligence",
  duckyFooter: "Powered by Ducky Intelligence.",
  parentCompany: "Cavaridge, LLC",
} as const;

export interface ApiError {
  message: string;
  status: number;
  errors?: unknown[];
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  try {
    const session = await getSession();
    if (session?.access_token) {
      headers["Authorization"] = `Bearer ${session.access_token}`;
    }
  } catch {
    // No session available — proceed without auth header
  }

  return headers;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorBody: { message?: string; errors?: unknown[] } = {};
    try {
      errorBody = await response.json();
    } catch {
      // Response body is not JSON
    }

    const error: ApiError = {
      message: errorBody.message || `Request failed with status ${response.status}`,
      status: response.status,
      errors: errorBody.errors,
    };
    throw error;
  }

  return response.json() as Promise<T>;
}

export async function apiGet<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "GET",
    headers,
  });
  return handleResponse<T>(response);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify(body),
  });
  return handleResponse<T>(response);
}

export async function apiDelete<T>(path: string): Promise<T> {
  const headers = await getAuthHeaders();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "DELETE",
    headers,
  });
  return handleResponse<T>(response);
}

/** Check if the API server is reachable and operational. */
export async function checkApiHealth(): Promise<{
  reachable: boolean;
  status?: string;
  aiConfigured?: boolean;
}> {
  try {
    const data = await apiGet<{
      status: string;
      aiConfigured: boolean;
    }>("/api/system-status");
    return { reachable: true, status: data.status, aiConfigured: data.aiConfigured };
  } catch {
    return { reachable: false };
  }
}
