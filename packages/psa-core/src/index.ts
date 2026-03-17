/**
 * @cavaridge/psa-core
 *
 * Shared PSA schemas, engines, types, and queue definitions
 * for the Cavaridge Cavalier Partners platform.
 */

// Schema (Drizzle ORM tables)
export * from './schema';

// Types
export * from './types';

// Engines
export { SlaEngine } from './engine/sla-engine';
export { TicketEngine } from './engine/ticket-engine';
export { BillingEngine } from './engine/billing-engine';
export { DispatchEngine } from './engine/dispatch-engine';

// Queue definitions
export {
  PSA_QUEUES,
  DEFAULT_JOB_OPTIONS,
  REPEATABLE_SCHEDULES,
  QUEUE_CONCURRENCY,
} from './queues';
export type {
  SlaMonitorJob,
  TicketEnrichmentJob,
  InvoiceGenerationJob,
  ContractExpiryJob,
} from './queues';
