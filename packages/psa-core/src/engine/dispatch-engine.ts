/**
 * @cavaridge/psa-core — Dispatch Engine
 *
 * Manages technician scheduling, workload calculation, and
 * assignment optimization. Integrates with calendar services.
 */
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import { dispatchSlots } from '../schema/time-entries';
import { tickets } from '../schema/tickets';
import type {
  CreateDispatchSlotInput, WorkloadSummary,
  AssignmentSuggestion, DispatchBoardView,
} from '../types';

export class DispatchEngine {
  constructor(private db: PostgresJsDatabase<any>) {}

  async createSlot(input: CreateDispatchSlotInput) {
    const [slot] = await this.db.insert(dispatchSlots).values({
      tenantId: input.tenantId,
      ticketId: input.ticketId,
      userId: input.userId,
      scheduledStart: input.scheduledStart,
      scheduledEnd: input.scheduledEnd,
      notes: input.notes,
      status: 'scheduled',
    }).returning();

    return slot;
  }

  async getTechnicianWorkload(
    tenantId: string,
    userId: string,
    dateRange: { start: Date; end: Date },
  ): Promise<WorkloadSummary> {
    const slots = await this.db
      .select()
      .from(dispatchSlots)
      .where(and(
        eq(dispatchSlots.tenantId, tenantId),
        eq(dispatchSlots.userId, userId),
        gte(dispatchSlots.scheduledStart, dateRange.start),
        lte(dispatchSlots.scheduledEnd, dateRange.end),
      ));

    const totalScheduledMinutes = slots.reduce((sum, slot) => {
      const start = new Date(slot.scheduledStart);
      const end = new Date(slot.scheduledEnd);
      return sum + Math.round((end.getTime() - start.getTime()) / 60000);
    }, 0);

    // Assume 8-hour workday for available calculation
    const workDays = this.countWorkDays(dateRange.start, dateRange.end);
    const totalAvailableMinutes = workDays * 8 * 60;
    const utilizationPercent = totalAvailableMinutes > 0
      ? Math.round((totalScheduledMinutes / totalAvailableMinutes) * 100)
      : 0;

    // Count open tickets assigned to this tech
    const openTicketResult = await this.db.execute(sql`
      SELECT COUNT(*)::int as count
      FROM tickets
      WHERE tenant_id = ${tenantId}
      AND assigned_to = ${userId}
      AND status IN ('new', 'open', 'pending')
    `);
    const openTicketCount = (openTicketResult as any)[0]?.count ?? 0;

    return {
      userId,
      dateRange,
      totalScheduledMinutes,
      totalAvailableMinutes,
      utilizationPercent,
      slotCount: slots.length,
      openTicketCount,
    };
  }

  /**
   * Suggest best technician for a ticket based on workload.
   * Phase 2 will add skills matching and location proximity.
   */
  async suggestAssignment(
    tenantId: string,
    ticketId: string,
    technicianIds: string[],
  ): Promise<AssignmentSuggestion[]> {
    const dateRange = {
      start: new Date(),
      end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // Next 7 days
    };

    const suggestions: AssignmentSuggestion[] = [];

    for (const userId of technicianIds) {
      const workload = await this.getTechnicianWorkload(tenantId, userId, dateRange);
      const score = Math.max(0, 1 - workload.utilizationPercent / 100);
      const reasons: string[] = [];

      if (workload.utilizationPercent < 50) reasons.push('Low utilization — has capacity');
      if (workload.openTicketCount < 5) reasons.push('Few open tickets');
      if (workload.utilizationPercent > 80) reasons.push('High utilization — may be overloaded');

      suggestions.push({
        userId,
        userName: '', // Populated by consuming app with user lookup
        score,
        reasons,
        currentWorkload: workload,
      });
    }

    return suggestions.sort((a, b) => b.score - a.score);
  }

  async getDispatchBoard(
    tenantId: string,
    dateRange: { start: Date; end: Date },
    technicianIds: string[],
  ): Promise<DispatchBoardView> {
    const technicians = await Promise.all(
      technicianIds.map(async (userId) => {
        const slots = await this.db
          .select()
          .from(dispatchSlots)
          .where(and(
            eq(dispatchSlots.tenantId, tenantId),
            eq(dispatchSlots.userId, userId),
            gte(dispatchSlots.scheduledStart, dateRange.start),
            lte(dispatchSlots.scheduledEnd, dateRange.end),
          ));

        const workload = await this.getTechnicianWorkload(tenantId, userId, dateRange);

        return {
          userId,
          userName: '', // Populated by consuming app
          slots: slots.map((s) => ({
            slotId: s.id,
            ticketId: s.ticketId,
            ticketSubject: '', // Populated by consuming app
            clientName: '', // Populated by consuming app
            scheduledStart: new Date(s.scheduledStart),
            scheduledEnd: new Date(s.scheduledEnd),
            status: s.status as any,
          })),
          workload,
        };
      }),
    );

    // Get unassigned tickets
    const unassigned = await this.db
      .select()
      .from(tickets)
      .where(and(
        eq(tickets.tenantId, tenantId),
        sql`${tickets.assignedTo} IS NULL`,
        sql`${tickets.status} IN ('new', 'open')`,
      ));

    return {
      tenantId,
      dateRange,
      technicians,
      unassignedTickets: unassigned.map((t) => ({
        ticketId: t.id,
        subject: t.subject,
        priority: t.priority as any,
        clientName: '', // Populated by consuming app
        createdAt: new Date(t.createdAt),
        slaDue: t.slaResolutionDue ? new Date(t.slaResolutionDue) : undefined,
      })),
    };
  }

  private countWorkDays(start: Date, end: Date): number {
    let count = 0;
    const current = new Date(start);
    while (current <= end) {
      const day = current.getDay();
      if (day !== 0 && day !== 6) count++;
      current.setDate(current.getDate() + 1);
    }
    return count;
  }
}
