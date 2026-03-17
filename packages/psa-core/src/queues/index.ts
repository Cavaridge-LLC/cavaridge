/**
 * @cavaridge/psa-core — Queue Definitions
 *
 * BullMQ queue names, job types, and configuration for all PSA
 * async processing. Consumed by the worker processes in CVG-CORE.
 */
import type { JobsOptions } from 'bullmq';

// ─── Queue Names ─────────────────────────────────────────────────────

export const PSA_QUEUES = {
  SLA_MONITOR: 'psa:sla-monitor',
  TICKET_ENRICHMENT: 'psa:ticket-enrichment',
  INVOICE_GENERATION: 'psa:invoice-generation',
  CONTRACT_EXPIRY: 'psa:contract-expiry',
} as const;

// ─── Job Types ───────────────────────────────────────────────────────

export interface SlaMonitorJob {
  type: 'check_all_open_tickets';
  tenantId?: string; // null = all tenants
}

export interface TicketEnrichmentJob {
  type: 'enrich_ticket';
  ticketId: string;
  tenantId: string;
  subject: string;
  description: string;
  deviceContext?: Record<string, unknown>; // From RMM connector
}

export interface InvoiceGenerationJob {
  type: 'generate_monthly';
  tenantId: string;
  periodStart: string; // ISO date
  periodEnd: string;
}

export interface ContractExpiryJob {
  type: 'check_expiring_contracts';
  tenantId?: string; // null = all tenants
}

// ─── Default Job Options ─────────────────────────────────────────────

export const DEFAULT_JOB_OPTIONS: Record<string, JobsOptions> = {
  [PSA_QUEUES.SLA_MONITOR]: {
    attempts: 1,
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
  [PSA_QUEUES.TICKET_ENRICHMENT]: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
  },
  [PSA_QUEUES.INVOICE_GENERATION]: {
    attempts: 3,
    backoff: { type: 'fixed', delay: 5000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 100 },
  },
  [PSA_QUEUES.CONTRACT_EXPIRY]: {
    attempts: 1,
    removeOnComplete: { count: 50 },
    removeOnFail: { count: 100 },
  },
};

// ─── Repeatable Schedule Config ──────────────────────────────────────

export const REPEATABLE_SCHEDULES = {
  [PSA_QUEUES.SLA_MONITOR]: {
    pattern: '*/1 * * * *', // Every minute
    limit: 1, // Max 1 concurrent
  },
  [PSA_QUEUES.CONTRACT_EXPIRY]: {
    pattern: '0 6 * * *', // Daily at 06:00 UTC
    limit: 1,
  },
  [PSA_QUEUES.INVOICE_GENERATION]: {
    pattern: '0 0 1 * *', // 1st of each month at 00:00 UTC
    limit: 1,
  },
};

// ─── Concurrency Config ──────────────────────────────────────────────

export const QUEUE_CONCURRENCY = {
  [PSA_QUEUES.SLA_MONITOR]: 1,
  [PSA_QUEUES.TICKET_ENRICHMENT]: 5,
  [PSA_QUEUES.INVOICE_GENERATION]: 3,
  [PSA_QUEUES.CONTRACT_EXPIRY]: 1,
};
