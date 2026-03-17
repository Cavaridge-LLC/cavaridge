/**
 * @cavaridge/psa-core — Ticket Engine
 *
 * Manages ticket lifecycle: creation, assignment, resolution, closure.
 * Integrates with SLA engine for deadline calculation and connector
 * deduplication. Emits events consumed by the enrichment queue and
 * notification service.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, sql } from 'drizzle-orm';
import { tickets, ticketComments } from '../schema/tickets';
import { slaPolicies } from '../schema/sla-policies';
import { contracts } from '../schema/contracts';
import { SlaEngine } from './sla-engine';
import type {
  CreateTicketInput, UpdateTicketInput, AddCommentInput,
  TicketStatus, PsaEvent,
} from '../types';

type EventEmitter = {
  emit(event: PsaEvent): void;
};

export class TicketEngine {
  private slaEngine: SlaEngine;

  constructor(
    private db: PostgresJsDatabase<any>,
    private eventBus: EventEmitter,
  ) {
    this.slaEngine = new SlaEngine();
  }

  /**
   * Create a new ticket with auto-generated number, SLA calculation,
   * and AI enrichment trigger.
   */
  async createTicket(input: CreateTicketInput) {
    const ticketNumber = await this.generateTicketNumber(input.tenantId);

    // Resolve SLA policy: explicit > contract > tenant default
    const slaPolicyId = input.contractId
      ? await this.getContractSlaPolicy(input.contractId)
      : await this.getTenantDefaultSlaPolicy(input.tenantId);

    const [ticket] = await this.db.insert(tickets).values({
      tenantId: input.tenantId,
      clientId: input.clientId,
      siteId: input.siteId,
      ticketNumber,
      subject: input.subject,
      description: input.description,
      priority: input.priority ?? 'medium',
      category: input.category,
      subcategory: input.subcategory,
      source: input.source ?? 'manual',
      assignedTo: input.assignedTo,
      requestedBy: input.requestedBy,
      contractId: input.contractId,
      slaPolicyId: slaPolicyId ?? undefined,
      connectorSource: input.connectorSource,
      connectorExternalId: input.connectorExternalId,
      customFields: input.customFields ?? {},
    }).returning();

    // Calculate SLA deadlines if policy exists
    if (slaPolicyId) {
      await this.calculateAndSetSlaDeadlines(ticket.id, slaPolicyId, ticket.createdAt, ticket.priority);
    }

    this.eventBus.emit({
      type: 'ticket.created',
      tenantId: input.tenantId,
      timestamp: new Date(),
      payload: ticket,
    });

    return ticket;
  }

  /**
   * Update a ticket. Handles status transitions, SLA recalculation
   * on priority change, and SLA pause/resume on hold transitions.
   */
  async updateTicket(ticketId: string, tenantId: string, updates: UpdateTicketInput) {
    const [existing] = await this.db
      .select()
      .from(tickets)
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)));

    if (!existing) throw new Error(`Ticket ${ticketId} not found`);

    // Handle SLA pause/resume on hold status changes
    const statusUpdates: Record<string, unknown> = {};
    if (updates.status === 'on_hold' && existing.status !== 'on_hold') {
      // TODO: Record hold start time for SLA pause calculation
    }
    if (updates.status && updates.status !== 'on_hold' && existing.status === 'on_hold') {
      // TODO: Resume SLA clock, recalculate deadlines
    }

    // Handle first response tracking
    if (updates.status === 'open' && existing.status === 'new' && !existing.slaRespondedAt) {
      statusUpdates.slaRespondedAt = new Date();
    }

    // Handle resolution
    if (updates.status === 'resolved' && existing.status !== 'resolved') {
      statusUpdates.slaResolvedAt = new Date();
    }

    // Handle closure
    if (updates.status === 'closed') {
      statusUpdates.closedAt = new Date();
    }

    const [updated] = await this.db
      .update(tickets)
      .set({ ...updates, ...statusUpdates, updatedAt: new Date() })
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)))
      .returning();

    // Recalculate SLA if priority changed
    if (updates.priority && updates.priority !== existing.priority && existing.slaPolicyId) {
      await this.calculateAndSetSlaDeadlines(
        ticketId, existing.slaPolicyId, existing.createdAt, updates.priority,
      );
    }

    this.eventBus.emit({
      type: updates.status === 'resolved' ? 'ticket.resolved'
        : updates.assignedTo ? 'ticket.assigned'
        : 'ticket.updated',
      tenantId,
      timestamp: new Date(),
      payload: { ticket: updated, changedFields: Object.keys(updates) },
    });

    return updated;
  }

  /**
   * Add a comment to a ticket.
   */
  async addComment(input: AddCommentInput) {
    const [comment] = await this.db.insert(ticketComments).values({
      ticketId: input.ticketId,
      tenantId: input.tenantId,
      authorId: input.authorId,
      body: input.body,
      isInternal: input.isInternal ?? false,
      isResolution: input.isResolution ?? false,
      source: input.source ?? 'manual',
    }).returning();

    // Update ticket updatedAt
    await this.db
      .update(tickets)
      .set({ updatedAt: new Date() })
      .where(eq(tickets.id, input.ticketId));

    return comment;
  }

  /**
   * Create a ticket from a connector event, with deduplication.
   */
  async createFromConnector(
    connectorId: string,
    externalId: string,
    input: Omit<CreateTicketInput, 'connectorSource' | 'connectorExternalId'>,
  ) {
    // Check for existing ticket from this connector
    const [existing] = await this.db
      .select()
      .from(tickets)
      .where(and(
        eq(tickets.connectorSource, connectorId),
        eq(tickets.connectorExternalId, externalId),
        eq(tickets.tenantId, input.tenantId),
      ));

    if (existing) {
      // Update existing ticket instead of creating duplicate
      return this.updateTicket(existing.id, input.tenantId, {
        subject: input.subject,
        description: input.description,
        priority: input.priority,
        category: input.category,
      });
    }

    return this.createTicket({
      ...input,
      connectorSource: connectorId,
      connectorExternalId: externalId,
      source: 'connector',
    });
  }

  /**
   * Apply AI enrichment results to a ticket.
   */
  async applyEnrichment(
    ticketId: string,
    tenantId: string,
    enrichment: {
      category?: string;
      subcategory?: string;
      aiCategoryConfidence?: number;
      aiPriorityScore?: number;
      aiSuggestedResolution?: string;
      aiSimilarTicketIds?: string[];
    },
  ) {
    const [updated] = await this.db
      .update(tickets)
      .set({ ...enrichment, updatedAt: new Date() })
      .where(and(eq(tickets.id, ticketId), eq(tickets.tenantId, tenantId)))
      .returning();

    return updated;
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  private async generateTicketNumber(tenantId: string): Promise<string> {
    const result = await this.db.execute(sql`
      SELECT COUNT(*)::int + 1 as next_num
      FROM tickets
      WHERE tenant_id = ${tenantId}
    `);
    const nextNum = (result as any)[0]?.next_num ?? 1;
    return `TKT-${String(nextNum).padStart(5, '0')}`;
  }

  private async getContractSlaPolicy(contractId: string): Promise<string | null> {
    const [contract] = await this.db
      .select({ slaPolicyId: contracts.slaPolicyId })
      .from(contracts)
      .where(eq(contracts.id, contractId));
    return contract?.slaPolicyId ?? null;
  }

  private async getTenantDefaultSlaPolicy(tenantId: string): Promise<string | null> {
    const [policy] = await this.db
      .select({ id: slaPolicies.id })
      .from(slaPolicies)
      .where(and(eq(slaPolicies.tenantId, tenantId), eq(slaPolicies.isDefault, true)));
    return policy?.id ?? null;
  }

  private async calculateAndSetSlaDeadlines(
    ticketId: string,
    slaPolicyId: string,
    createdAt: Date,
    priority: string,
  ) {
    const [policy] = await this.db
      .select()
      .from(slaPolicies)
      .where(eq(slaPolicies.id, slaPolicyId));

    if (!policy) return;

    // TODO: Load business hours if policy.businessHoursId is set
    const deadlines = this.slaEngine.calculateDeadlines(
      createdAt,
      priority as any,
      policy as any,
      null, // 24/7 until business hours loaded
    );

    await this.db
      .update(tickets)
      .set({
        slaResponseDue: deadlines.responseDue,
        slaResolutionDue: deadlines.resolutionDue,
      })
      .where(eq(tickets.id, ticketId));
  }
}
