/**
 * @cavaridge/psa-core — Type definitions
 *
 * All PSA entity types, enums, and shared interfaces.
 * These types are consumed by CVG-CORE, CVG-MIDAS, CVG-ASTRA, and CVG-AI.
 */

// ─── Enums ───────────────────────────────────────────────────────────

export const TicketStatus = {
  NEW: 'new',
  OPEN: 'open',
  PENDING: 'pending',
  ON_HOLD: 'on_hold',
  RESOLVED: 'resolved',
  CLOSED: 'closed',
  CANCELLED: 'cancelled',
} as const;
export type TicketStatus = (typeof TicketStatus)[keyof typeof TicketStatus];

export const TicketPriority = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
} as const;
export type TicketPriority = (typeof TicketPriority)[keyof typeof TicketPriority];

export const TicketSource = {
  MANUAL: 'manual',
  EMAIL: 'email',
  PORTAL: 'portal',
  PHONE: 'phone',
  CHAT: 'chat',
  CONNECTOR: 'connector',
  ALERT: 'alert',
} as const;
export type TicketSource = (typeof TicketSource)[keyof typeof TicketSource];

export const CommentSource = {
  MANUAL: 'manual',
  EMAIL: 'email',
  PORTAL: 'portal',
  AI: 'ai',
  CONNECTOR: 'connector',
} as const;
export type CommentSource = (typeof CommentSource)[keyof typeof CommentSource];

export const ContractType = {
  MANAGED: 'managed',
  BLOCK_HOURS: 'block_hours',
  TIME_AND_MATERIALS: 'time_and_materials',
  PROJECT: 'project',
  RETAINER: 'retainer',
} as const;
export type ContractType = (typeof ContractType)[keyof typeof ContractType];

export const ContractStatus = {
  DRAFT: 'draft',
  ACTIVE: 'active',
  EXPIRING: 'expiring',
  EXPIRED: 'expired',
  CANCELLED: 'cancelled',
} as const;
export type ContractStatus = (typeof ContractStatus)[keyof typeof ContractStatus];

export const InvoiceStatus = {
  DRAFT: 'draft',
  APPROVED: 'approved',
  SENT: 'sent',
  PAID: 'paid',
  OVERDUE: 'overdue',
  VOID: 'void',
} as const;
export type InvoiceStatus = (typeof InvoiceStatus)[keyof typeof InvoiceStatus];

export const InvoiceLineSourceType = {
  CONTRACT_RECURRING: 'contract_recurring',
  TIME_ENTRY: 'time_entry',
  AD_HOC: 'ad_hoc',
  EXPENSE: 'expense',
} as const;
export type InvoiceLineSourceType = (typeof InvoiceLineSourceType)[keyof typeof InvoiceLineSourceType];

export const WorkType = {
  REACTIVE: 'reactive',
  PROACTIVE: 'proactive',
  PROJECT: 'project',
  ADMIN: 'admin',
  TRAVEL: 'travel',
} as const;
export type WorkType = (typeof WorkType)[keyof typeof WorkType];

export const DispatchSlotStatus = {
  SCHEDULED: 'scheduled',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RESCHEDULED: 'rescheduled',
} as const;
export type DispatchSlotStatus = (typeof DispatchSlotStatus)[keyof typeof DispatchSlotStatus];

// ─── SLA Types ───────────────────────────────────────────────────────

export interface SlaTargets {
  responseTargetCritical: number; // minutes
  responseTargetHigh: number;
  responseTargetMedium: number;
  responseTargetLow: number;
  resolutionTargetCritical: number;
  resolutionTargetHigh: number;
  resolutionTargetMedium: number;
  resolutionTargetLow: number;
}

export interface EscalationRule {
  trigger: 'response_breach_warning' | 'response_breach' | 'resolution_breach_warning' | 'resolution_breach';
  thresholdPercent: number; // 80, 90, 100
  action: 'notify' | 'escalate' | 'reassign';
  target: 'assigned_tech' | 'team_lead' | 'partner_admin' | 'specific_user';
  targetUserId?: string;
  channel: 'email' | 'slack' | 'email+slack' | 'in_app';
}

export interface BusinessHoursSchedule {
  monday: { start: string; end: string } | null;
  tuesday: { start: string; end: string } | null;
  wednesday: { start: string; end: string } | null;
  thursday: { start: string; end: string } | null;
  friday: { start: string; end: string } | null;
  saturday: { start: string; end: string } | null;
  sunday: { start: string; end: string } | null;
}

export interface SlaDeadlines {
  responseDue: Date;
  resolutionDue: Date;
}

export interface SlaBreachStatus {
  responseBreached: boolean;
  resolutionBreached: boolean;
  responsePercent: number; // 0-100+, >100 = breached
  resolutionPercent: number;
}

// ─── Ticket Engine Types ─────────────────────────────────────────────

export interface CreateTicketInput {
  tenantId: string;
  clientId: string;
  siteId?: string;
  subject: string;
  description?: string;
  priority?: TicketPriority;
  category?: string;
  subcategory?: string;
  source?: TicketSource;
  assignedTo?: string;
  requestedBy?: string;
  contractId?: string;
  connectorSource?: string;
  connectorExternalId?: string;
  customFields?: Record<string, unknown>;
}

export interface UpdateTicketInput {
  subject?: string;
  description?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: string;
  subcategory?: string;
  assignedTo?: string | null;
  customFields?: Record<string, unknown>;
}

export interface AddCommentInput {
  ticketId: string;
  tenantId: string;
  authorId: string;
  body: string;
  isInternal?: boolean;
  isResolution?: boolean;
  source?: CommentSource;
}

export interface TicketEnrichmentResult {
  category: string;
  subcategory: string;
  priorityScore: number; // 0-1
  categoryConfidence: number; // 0-1
  suggestedResolution: string;
  similarTicketIds: string[];
}

// ─── Billing Engine Types ────────────────────────────────────────────

export interface GenerateInvoicesInput {
  tenantId: string;
  periodStart: Date;
  periodEnd: Date;
}

export interface BlockHoursBalance {
  contractId: string;
  total: number;
  used: number;
  remaining: number;
  percentUsed: number;
}

// ─── Dispatch Engine Types ───────────────────────────────────────────

export interface CreateDispatchSlotInput {
  tenantId: string;
  ticketId: string;
  userId: string;
  scheduledStart: Date;
  scheduledEnd: Date;
  notes?: string;
}

export interface WorkloadSummary {
  userId: string;
  dateRange: { start: Date; end: Date };
  totalScheduledMinutes: number;
  totalAvailableMinutes: number;
  utilizationPercent: number;
  slotCount: number;
  openTicketCount: number;
}

export interface AssignmentSuggestion {
  userId: string;
  userName: string;
  score: number; // 0-1, higher = better fit
  reasons: string[];
  currentWorkload: WorkloadSummary;
}

export interface DispatchBoardView {
  tenantId: string;
  dateRange: { start: Date; end: Date };
  technicians: {
    userId: string;
    userName: string;
    slots: Array<{
      slotId: string;
      ticketId: string;
      ticketSubject: string;
      clientName: string;
      scheduledStart: Date;
      scheduledEnd: Date;
      status: DispatchSlotStatus;
    }>;
    workload: WorkloadSummary;
  }[];
  unassignedTickets: Array<{
    ticketId: string;
    subject: string;
    priority: TicketPriority;
    clientName: string;
    createdAt: Date;
    slaDue?: Date;
  }>;
}

// ─── Event Types ─────────────────────────────────────────────────────

export type PsaEventType =
  | 'ticket.created'
  | 'ticket.updated'
  | 'ticket.assigned'
  | 'ticket.resolved'
  | 'ticket.closed'
  | 'ticket.sla.warning'
  | 'ticket.sla.breached'
  | 'contract.expiring'
  | 'contract.renewed'
  | 'invoice.generated'
  | 'time_entry.approved';

export interface PsaEvent<T = unknown> {
  type: PsaEventType;
  tenantId: string;
  timestamp: Date;
  payload: T;
}

// ─── Service Catalog Types ───────────────────────────────────────────

export interface ServiceCatalogFormField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'select' | 'checkbox' | 'date' | 'file';
  required: boolean;
  options?: string[]; // for select type
  placeholder?: string;
  helpText?: string;
}
