/**
 * Ingestion Scheduler — BullMQ Job Definitions
 *
 * Manages recurring and on-demand tenant ingestion jobs.
 * Queue name follows the standard defined in the platform.
 */

import { Queue, Worker, type Job, type ConnectionOptions } from "bullmq";
import type { M365Credentials, IngestOptions, IngestResult } from "../shared/types.js";
import { ingestTenant } from "./ingest.js";

export const TENANT_INTEL_QUEUE_NAME = "tenant-intel:ingestion";

export interface IngestionJobData {
  tenantId: string;
  credentials: M365Credentials;
  options?: IngestOptions;
}

export function createIngestionQueue(connection: ConnectionOptions): Queue<IngestionJobData> {
  return new Queue<IngestionJobData>(TENANT_INTEL_QUEUE_NAME, {
    connection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 60_000 },
      removeOnComplete: { age: 7 * 24 * 3600 },
      removeOnFail: { age: 30 * 24 * 3600 },
    },
  });
}

export function createIngestionWorker(
  connection: ConnectionOptions,
  onComplete?: (result: IngestResult) => Promise<void>,
): Worker<IngestionJobData, IngestResult> {
  const worker = new Worker<IngestionJobData, IngestResult>(
    TENANT_INTEL_QUEUE_NAME,
    async (job: Job<IngestionJobData>) => {
      const { credentials, options } = job.data;

      await job.updateProgress(10);
      const result = await ingestTenant(credentials, options);
      await job.updateProgress(100);

      if (onComplete) {
        await onComplete(result);
      }

      return result;
    },
    {
      connection,
      concurrency: 2,
      limiter: { max: 5, duration: 60_000 },
    },
  );

  return worker;
}

export async function scheduleIngestion(
  queue: Queue<IngestionJobData>,
  tenantId: string,
  credentials: M365Credentials,
  intervalHours: number,
  options?: IngestOptions,
): Promise<void> {
  const jobId = `tenant-intel:${tenantId}:recurring`;

  await queue.upsertJobScheduler(
    jobId,
    { every: intervalHours * 3600 * 1000 },
    {
      name: `ingest-${tenantId}`,
      data: {
        tenantId,
        credentials,
        options: { ...options, trigger: "scheduled" },
      },
    },
  );
}

export async function triggerManualIngestion(
  queue: Queue<IngestionJobData>,
  tenantId: string,
  credentials: M365Credentials,
  options?: IngestOptions,
): Promise<string> {
  const job = await queue.add(
    `ingest-${tenantId}-manual`,
    {
      tenantId,
      credentials,
      options: { ...options, trigger: "manual" },
    },
    { priority: 1 },
  );
  return job.id!;
}
