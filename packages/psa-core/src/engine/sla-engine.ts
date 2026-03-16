/**
 * @cavaridge/psa-core — SLA Engine
 *
 * Calculates SLA deadlines accounting for business hours, detects breaches,
 * and triggers escalation rules. Consumed by the SLA monitor queue and
 * ticket engine.
 */
import { addMinutes, differenceInMinutes, isWithinInterval, setHours, setMinutes, getDay } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';
import type {
  SlaDeadlines, SlaBreachStatus, TicketPriority, EscalationRule,
  BusinessHoursSchedule,
} from '../types';

const DAY_NAMES: (keyof BusinessHoursSchedule)[] = [
  'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
];

interface SlaPolicy {
  responseTargetCritical: number;
  responseTargetHigh: number;
  responseTargetMedium: number;
  responseTargetLow: number;
  resolutionTargetCritical: number;
  resolutionTargetHigh: number;
  resolutionTargetMedium: number;
  resolutionTargetLow: number;
  escalationRules: EscalationRule[];
}

interface BusinessHoursConfig {
  timezone: string;
  schedule: BusinessHoursSchedule;
  holidays: string[]; // ISO date strings
}

export class SlaEngine {
  /**
   * Calculate response and resolution deadlines for a ticket.
   * If businessHours is null, SLA runs 24/7.
   */
  calculateDeadlines(
    createdAt: Date,
    priority: TicketPriority,
    policy: SlaPolicy,
    businessHours: BusinessHoursConfig | null,
  ): SlaDeadlines {
    const responseMinutes = this.getTargetMinutes(priority, 'response', policy);
    const resolutionMinutes = this.getTargetMinutes(priority, 'resolution', policy);

    if (!businessHours) {
      return {
        responseDue: addMinutes(createdAt, responseMinutes),
        resolutionDue: addMinutes(createdAt, resolutionMinutes),
      };
    }

    return {
      responseDue: this.addBusinessMinutes(createdAt, responseMinutes, businessHours),
      resolutionDue: this.addBusinessMinutes(createdAt, resolutionMinutes, businessHours),
    };
  }

  /**
   * Check current SLA breach status for a ticket.
   */
  checkBreachStatus(
    now: Date,
    createdAt: Date,
    slaResponseDue: Date | null,
    slaResolutionDue: Date | null,
    slaRespondedAt: Date | null,
    slaResolvedAt: Date | null,
  ): SlaBreachStatus {
    const responseBreached = slaResponseDue
      ? (!slaRespondedAt && now > slaResponseDue) || (slaRespondedAt !== null && slaRespondedAt > slaResponseDue)
      : false;

    const resolutionBreached = slaResolutionDue
      ? (!slaResolvedAt && now > slaResolutionDue) || (slaResolvedAt !== null && slaResolvedAt > slaResolutionDue)
      : false;

    const responsePercent = slaResponseDue
      ? this.calculatePercent(createdAt, slaResponseDue, slaRespondedAt ?? now)
      : 0;

    const resolutionPercent = slaResolutionDue
      ? this.calculatePercent(createdAt, slaResolutionDue, slaResolvedAt ?? now)
      : 0;

    return { responseBreached, resolutionBreached, responsePercent, resolutionPercent };
  }

  /**
   * Get applicable escalation rules for current breach status.
   */
  getTriggeredEscalations(
    breachStatus: SlaBreachStatus,
    escalationRules: EscalationRule[],
  ): EscalationRule[] {
    return escalationRules.filter((rule) => {
      if (rule.trigger === 'response_breach_warning' || rule.trigger === 'response_breach') {
        return breachStatus.responsePercent >= rule.thresholdPercent;
      }
      if (rule.trigger === 'resolution_breach_warning' || rule.trigger === 'resolution_breach') {
        return breachStatus.resolutionPercent >= rule.thresholdPercent;
      }
      return false;
    });
  }

  /**
   * Calculate the number of business minutes between two timestamps.
   */
  getBusinessMinutesBetween(
    start: Date,
    end: Date,
    businessHours: BusinessHoursConfig,
  ): number {
    const { timezone, schedule, holidays } = businessHours;
    let totalMinutes = 0;
    let current = new Date(start);

    while (current < end) {
      const zoned = toZonedTime(current, timezone);
      const dayName = DAY_NAMES[getDay(zoned)];
      const daySchedule = schedule[dayName];
      const dateStr = zoned.toISOString().split('T')[0];

      if (!daySchedule || holidays.includes(dateStr)) {
        // Non-working day — advance to next day start
        current = this.getNextDayStart(current, timezone);
        continue;
      }

      const [startH, startM] = daySchedule.start.split(':').map(Number);
      const [endH, endM] = daySchedule.end.split(':').map(Number);

      const dayStart = fromZonedTime(
        setMinutes(setHours(zoned, startH), startM),
        timezone,
      );
      const dayEnd = fromZonedTime(
        setMinutes(setHours(zoned, endH), endM),
        timezone,
      );

      const effectiveStart = current < dayStart ? dayStart : current;
      const effectiveEnd = end < dayEnd ? end : dayEnd;

      if (effectiveStart < effectiveEnd) {
        totalMinutes += differenceInMinutes(effectiveEnd, effectiveStart);
      }

      current = this.getNextDayStart(current, timezone);
    }

    return totalMinutes;
  }

  // ─── Private Helpers ─────────────────────────────────────────────

  private getTargetMinutes(
    priority: TicketPriority,
    type: 'response' | 'resolution',
    policy: SlaPolicy,
  ): number {
    const key = `${type}Target${priority.charAt(0).toUpperCase() + priority.slice(1)}` as keyof SlaPolicy;
    return policy[key] as number;
  }

  private addBusinessMinutes(
    start: Date,
    minutes: number,
    businessHours: BusinessHoursConfig,
  ): Date {
    const { timezone, schedule, holidays } = businessHours;
    let remainingMinutes = minutes;
    let current = new Date(start);

    while (remainingMinutes > 0) {
      const zoned = toZonedTime(current, timezone);
      const dayName = DAY_NAMES[getDay(zoned)];
      const daySchedule = schedule[dayName];
      const dateStr = zoned.toISOString().split('T')[0];

      if (!daySchedule || holidays.includes(dateStr)) {
        current = this.getNextDayStart(current, timezone);
        continue;
      }

      const [startH, startM] = daySchedule.start.split(':').map(Number);
      const [endH, endM] = daySchedule.end.split(':').map(Number);

      const dayStart = fromZonedTime(
        setMinutes(setHours(zoned, startH), startM),
        timezone,
      );
      const dayEnd = fromZonedTime(
        setMinutes(setHours(zoned, endH), endM),
        timezone,
      );

      const effectiveStart = current < dayStart ? dayStart : current;

      if (effectiveStart >= dayEnd) {
        current = this.getNextDayStart(current, timezone);
        continue;
      }

      const availableMinutes = differenceInMinutes(dayEnd, effectiveStart);

      if (remainingMinutes <= availableMinutes) {
        return addMinutes(effectiveStart, remainingMinutes);
      }

      remainingMinutes -= availableMinutes;
      current = this.getNextDayStart(current, timezone);
    }

    return current;
  }

  private getNextDayStart(current: Date, timezone: string): Date {
    const zoned = toZonedTime(current, timezone);
    const nextDay = new Date(zoned);
    nextDay.setDate(nextDay.getDate() + 1);
    nextDay.setHours(0, 0, 0, 0);
    return fromZonedTime(nextDay, timezone);
  }

  private calculatePercent(start: Date, deadline: Date, current: Date): number {
    const total = differenceInMinutes(deadline, start);
    if (total <= 0) return 100;
    const elapsed = differenceInMinutes(current, start);
    return Math.round((elapsed / total) * 100);
  }
}
