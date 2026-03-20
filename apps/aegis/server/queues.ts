/**
 * CVG-AEGIS — BullMQ Queue Definitions
 *
 * Telemetry ingestion and scan processing queues.
 * Redis connection from REDIS_URL env (Doppler in prod).
 */
import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

let connection: IORedis | null = null;

function getConnection(): IORedis {
  if (!connection) {
    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
      console.warn('[aegis] REDIS_URL not set — queues disabled');
      // Return a stub connection for dev without Redis
      return new IORedis({ maxRetriesPerRequest: null, lazyConnect: true });
    }
    connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
  }
  return connection;
}

// ─── Queue Names ───────────────────────────────────────────────────────

export const QUEUE_NAMES = {
  TELEMETRY_INGEST: 'aegis:telemetry:ingest',
  SCAN_PROCESS: 'aegis:scan:process',
  SAAS_CLASSIFY: 'aegis:saas:classify',
  SCORE_CALCULATE: 'aegis:score:calculate',
} as const;

// ─── Queues ────────────────────────────────────────────────────────────

export function createTelemetryQueue() {
  return new Queue(QUEUE_NAMES.TELEMETRY_INGEST, { connection: getConnection() });
}

export function createScanQueue() {
  return new Queue(QUEUE_NAMES.SCAN_PROCESS, { connection: getConnection() });
}

export function createSaasClassifyQueue() {
  return new Queue(QUEUE_NAMES.SAAS_CLASSIFY, { connection: getConnection() });
}

export function createScoreQueue() {
  return new Queue(QUEUE_NAMES.SCORE_CALCULATE, { connection: getConnection() });
}

// ─── Telemetry Ingest Worker ───────────────────────────────────────────

export interface TelemetryBatch {
  tenantId: string;
  deviceId: string;
  events: Array<{
    type: string;
    domain: string;
    url?: string;
    title?: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
  }>;
}

export function startTelemetryWorker(processFunc: (batch: TelemetryBatch) => Promise<void>) {
  return new Worker(
    QUEUE_NAMES.TELEMETRY_INGEST,
    async (job: Job<TelemetryBatch>) => {
      await processFunc(job.data);
    },
    { connection: getConnection(), concurrency: 5 }
  );
}

// ─── Scan Processing Worker ────────────────────────────────────────────

export interface ScanJob {
  scanId: string;
  target: string;
  scanType: string;
  tenantId?: string;
}

export function startScanWorker(processFunc: (job: ScanJob) => Promise<void>) {
  return new Worker(
    QUEUE_NAMES.SCAN_PROCESS,
    async (job: Job<ScanJob>) => {
      await processFunc(job.data);
    },
    { connection: getConnection(), concurrency: 2 }
  );
}

// ─── SaaS Classification Worker ────────────────────────────────────────

export interface SaasClassifyJob {
  tenantId: string;
  domain: string;
  url?: string;
  title?: string;
}

export function startSaasClassifyWorker(processFunc: (job: SaasClassifyJob) => Promise<void>) {
  return new Worker(
    QUEUE_NAMES.SAAS_CLASSIFY,
    async (job: Job<SaasClassifyJob>) => {
      await processFunc(job.data);
    },
    { connection: getConnection(), concurrency: 5 }
  );
}
