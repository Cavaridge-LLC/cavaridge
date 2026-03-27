/**
 * @cavaridge/config — Cross-App Integration Event Definitions
 *
 * Shared event type definitions for cross-app messaging within the
 * Cavaridge monorepo. Each event has a fully typed payload.
 *
 * Current implementation: in-process EventBus (development/testing).
 * Production: events route through BullMQ/Redis (Railway-hosted).
 *
 * Consuming apps import types only — the bus instance is created
 * per-service at startup.
 */

// ---------------------------------------------------------------------------
// Event Names
// ---------------------------------------------------------------------------

export enum IntegrationEvent {
  /** AEGIS Cavaridge Adjusted Score was recalculated for a tenant */
  AEGIS_SCORE_UPDATED = "aegis.score.updated",

  /** A new security finding was detected by AEGIS */
  AEGIS_FINDING_CREATED = "aegis.finding.created",

  /** An Identity Access Review completed in AEGIS */
  AEGIS_IAR_COMPLETED = "aegis.iar.completed",

  /** A new unsanctioned SaaS application was discovered by AEGIS */
  AEGIS_SAAS_DISCOVERED = "aegis.saas.discovered",

  /** Midas generated a QBR report for a client */
  MIDAS_QBR_GENERATED = "midas.qbr.generated",

  /** Forge produced a content deliverable */
  FORGE_CONTENT_CREATED = "forge.content.created",

  /** A new partner completed Cavalier onboarding */
  CAVALIER_PARTNER_JOINED = "cavalier.partner.joined",

  /** Tenant intelligence data was refreshed (M365/GWS) */
  TENANT_INTEL_UPDATED = "tenant_intel.updated",
}

// ---------------------------------------------------------------------------
// Event Payloads
// ---------------------------------------------------------------------------

export interface AegisScoreUpdatedPayload {
  tenantId: string;
  clientTenantId: string | null;
  previousScore: number | null;
  newScore: number;
  grade: string;
  delta: number | null;
  signalCount: number;
  calculatedAt: string;
}

export interface AegisFindingCreatedPayload {
  tenantId: string;
  clientTenantId: string | null;
  findingId: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  category: string;
  title: string;
  affectedAsset: string;
  cisControl: string | null;
  detectedAt: string;
}

export interface AegisIarCompletedPayload {
  tenantId: string;
  reviewId: string;
  tier: "freemium" | "full";
  userCount: number;
  flagCount: number;
  highSeverityCount: number;
  mediumSeverityCount: number;
  lowSeverityCount: number;
  hasSubscriptionData: boolean;
  completedAt: string;
}

export interface AegisSaasDiscoveredPayload {
  tenantId: string;
  applicationName: string;
  domain: string;
  classification: "sanctioned" | "unsanctioned" | "unclassified";
  riskLevel: "high" | "medium" | "low" | "unknown";
  userCount: number;
  discoveredAt: string;
}

export interface MidasQbrGeneratedPayload {
  tenantId: string;
  clientTenantId: string;
  qbrId: string;
  period: string;
  includesSecuritySection: boolean;
  adjustedScore: number | null;
  generatedAt: string;
}

export interface ForgeContentCreatedPayload {
  tenantId: string;
  contentId: string;
  contentType: "document" | "presentation" | "report" | "landing_page";
  format: "docx" | "pdf" | "pptx" | "md" | "html";
  title: string;
  createdBy: string;
  createdAt: string;
}

export interface CavalierPartnerJoinedPayload {
  tenantId: string;
  partnerId: string;
  companyName: string;
  tier: "starter" | "professional" | "enterprise";
  rmmProvider: string;
  techCount: number;
  joinedAt: string;
}

export interface TenantIntelUpdatedPayload {
  tenantId: string;
  dataSource: "microsoft_graph" | "google_admin" | "csv_import";
  updatedScopes: string[];
  userCount: number | null;
  licenseCount: number | null;
  refreshedAt: string;
}

// ---------------------------------------------------------------------------
// Event Map — Maps event names to their payload types
// ---------------------------------------------------------------------------

export interface IntegrationEventMap {
  [IntegrationEvent.AEGIS_SCORE_UPDATED]: AegisScoreUpdatedPayload;
  [IntegrationEvent.AEGIS_FINDING_CREATED]: AegisFindingCreatedPayload;
  [IntegrationEvent.AEGIS_IAR_COMPLETED]: AegisIarCompletedPayload;
  [IntegrationEvent.AEGIS_SAAS_DISCOVERED]: AegisSaasDiscoveredPayload;
  [IntegrationEvent.MIDAS_QBR_GENERATED]: MidasQbrGeneratedPayload;
  [IntegrationEvent.FORGE_CONTENT_CREATED]: ForgeContentCreatedPayload;
  [IntegrationEvent.CAVALIER_PARTNER_JOINED]: CavalierPartnerJoinedPayload;
  [IntegrationEvent.TENANT_INTEL_UPDATED]: TenantIntelUpdatedPayload;
}

// ---------------------------------------------------------------------------
// EventBus Interface
// ---------------------------------------------------------------------------

export type EventHandler<T> = (payload: T) => void | Promise<void>;

export interface IEventBus {
  /**
   * Publish an event with a typed payload.
   * Returns a promise that resolves when all synchronous handlers complete.
   */
  publish<E extends IntegrationEvent>(
    event: E,
    payload: IntegrationEventMap[E],
  ): Promise<void>;

  /**
   * Subscribe to an event with a typed handler.
   * Returns an unsubscribe function.
   */
  subscribe<E extends IntegrationEvent>(
    event: E,
    handler: EventHandler<IntegrationEventMap[E]>,
  ): () => void;

  /**
   * Remove all handlers for a specific event, or all events if none specified.
   */
  clear(event?: IntegrationEvent): void;
}

// ---------------------------------------------------------------------------
// In-Process EventBus Implementation
// ---------------------------------------------------------------------------

/**
 * Simple in-process event bus for development and testing.
 *
 * In production, events should be routed through BullMQ/Redis for
 * cross-service delivery, retry, and persistence. This implementation
 * provides the same typed API for local development and unit tests.
 *
 * Usage:
 * ```ts
 * import { createEventBus, IntegrationEvent } from '@cavaridge/config/integration-events';
 *
 * const bus = createEventBus();
 *
 * // Subscribe
 * const unsub = bus.subscribe(IntegrationEvent.AEGIS_SCORE_UPDATED, (payload) => {
 *   console.log(`Score updated for ${payload.tenantId}: ${payload.newScore}`);
 * });
 *
 * // Publish
 * await bus.publish(IntegrationEvent.AEGIS_SCORE_UPDATED, {
 *   tenantId: 'tenant-123',
 *   clientTenantId: null,
 *   previousScore: 72,
 *   newScore: 78,
 *   grade: 'C',
 *   delta: 6,
 *   signalCount: 4,
 *   calculatedAt: new Date().toISOString(),
 * });
 *
 * // Cleanup
 * unsub();
 * ```
 */
export function createEventBus(): IEventBus {
  const handlers = new Map<string, Set<EventHandler<unknown>>>();

  return {
    async publish<E extends IntegrationEvent>(
      event: E,
      payload: IntegrationEventMap[E],
    ): Promise<void> {
      const eventHandlers = handlers.get(event);
      if (!eventHandlers || eventHandlers.size === 0) return;

      const promises: Array<void | Promise<void>> = [];
      for (const handler of eventHandlers) {
        try {
          promises.push(handler(payload));
        } catch (err) {
          // Log but don't throw — one handler failure should not block others
          console.error(
            `[EventBus] Handler error for ${event}:`,
            err instanceof Error ? err.message : err,
          );
        }
      }

      // Await any async handlers
      await Promise.allSettled(promises.filter((p): p is Promise<void> => p instanceof Promise));
    },

    subscribe<E extends IntegrationEvent>(
      event: E,
      handler: EventHandler<IntegrationEventMap[E]>,
    ): () => void {
      if (!handlers.has(event)) {
        handlers.set(event, new Set());
      }
      const eventHandlers = handlers.get(event)!;
      eventHandlers.add(handler as EventHandler<unknown>);

      // Return unsubscribe function
      return () => {
        eventHandlers.delete(handler as EventHandler<unknown>);
        if (eventHandlers.size === 0) {
          handlers.delete(event);
        }
      };
    },

    clear(event?: IntegrationEvent): void {
      if (event) {
        handlers.delete(event);
      } else {
        handlers.clear();
      }
    },
  };
}
