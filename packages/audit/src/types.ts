/** Parameters for writing an audit log entry */
export interface AuditLogParams {
  organizationId: string;
  userId: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  details?: Record<string, unknown>;
  ipAddress?: string;
  /** Originating app code (e.g. "ducky", "meridian") */
  appCode?: string;
  /** Request correlation ID for tracing */
  correlationId?: string;
}

/** Options for creating an audit logger */
export interface AuditLoggerOptions {
  /** Default app code to stamp on every entry */
  appCode?: string;
  /** Called on write failure instead of console.error */
  onError?: (error: unknown) => void;
}

/** Query filters for audit log */
export interface AuditQueryOptions {
  organizationId: string;
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  appCode?: string;
  correlationId?: string;
  /** ISO date strings */
  from?: string;
  to?: string;
  limit?: number;
  offset?: number;
}

/** Paginated query result */
export interface AuditQueryResult<T> {
  entries: T[];
  total: number;
  limit: number;
  offset: number;
}
