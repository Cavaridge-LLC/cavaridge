/**
 * TenantIntelClient — High-level convenience API for consuming apps
 *
 * Wraps the ingestion pipeline, storage, and agents into a single
 * client that consuming apps (Meridian, Midas, Astra, HIPAA, AEGIS, Ducky)
 * can import and use directly.
 */

import type { ConnectionOptions } from "bullmq";
import type {
  M365Credentials,
  IngestOptions,
  IngestResult,
  TenantSnapshot,
  SecurityPosture,
  LicenseUtilizationReport,
  LicenseSummary,
  TenantUser,
  ManagedDevice,
  DeltaReport,
  UserFilter,
  TenantIntelConfig,
} from "./shared/types.js";
import { ingestTenant, computeSnapshotDelta } from "./pipeline/ingest.js";
import {
  createIngestionQueue,
  createIngestionWorker,
  scheduleIngestion,
  triggerManualIngestion,
  type IngestionJobData,
} from "./pipeline/scheduler.js";
import type { Queue, Worker } from "bullmq";

export class TenantIntelClient {
  private queue: Queue<IngestionJobData> | null = null;
  private worker: Worker<IngestionJobData, IngestResult> | null = null;
  private connection: ConnectionOptions | null = null;

  /**
   * Initialize with Redis connection for BullMQ job scheduling.
   * Call this once at app startup.
   */
  initialize(connection: ConnectionOptions): void {
    this.connection = connection;
    this.queue = createIngestionQueue(connection);
  }

  /**
   * Start the ingestion worker (call in the service that processes jobs).
   */
  startWorker(
    connection: ConnectionOptions,
    onComplete?: (result: IngestResult) => Promise<void>,
  ): void {
    this.worker = createIngestionWorker(connection, onComplete);
  }

  /**
   * Run a full tenant ingestion immediately (synchronous — blocks until done).
   */
  async ingest(
    credentials: M365Credentials,
    options?: IngestOptions,
  ): Promise<IngestResult> {
    return ingestTenant(credentials, options);
  }

  /**
   * Schedule recurring ingestion via BullMQ.
   */
  async schedule(config: TenantIntelConfig): Promise<void> {
    if (!this.queue) {
      throw new Error("TenantIntelClient not initialized. Call initialize(redis) first.");
    }

    await scheduleIngestion(
      this.queue,
      config.tenantId,
      config.credentials,
      config.ingestionIntervalHours,
      { modules: config.enabledModules },
    );
  }

  /**
   * Trigger a one-off manual ingestion via the job queue (async).
   * Returns the job ID for tracking.
   */
  async triggerIngestion(
    credentials: M365Credentials,
    options?: IngestOptions,
  ): Promise<string> {
    if (!this.queue) {
      throw new Error("TenantIntelClient not initialized. Call initialize(redis) first.");
    }

    return triggerManualIngestion(this.queue, credentials.tenantId, credentials, options);
  }

  /**
   * Compute delta between two sets of snapshot data.
   */
  computeDelta(
    from: {
      snapshot: TenantSnapshot;
      users: TenantUser[];
      licenses: LicenseSummary[];
      security: SecurityPosture;
      devices: ManagedDevice[];
    },
    to: {
      snapshot: TenantSnapshot;
      users: TenantUser[];
      licenses: LicenseSummary[];
      security: SecurityPosture;
      devices: ManagedDevice[];
    },
  ): DeltaReport {
    return computeSnapshotDelta(from, to);
  }

  /**
   * Check if the client is initialized and ready.
   */
  isReady(): boolean {
    return this.queue !== null;
  }

  /**
   * Graceful shutdown — close queue and worker.
   */
  async shutdown(): Promise<void> {
    if (this.worker) {
      await this.worker.close();
      this.worker = null;
    }
    if (this.queue) {
      await this.queue.close();
      this.queue = null;
    }
  }
}
