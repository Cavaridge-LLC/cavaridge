/**
 * CVG-CAVALIER — Ticket Management Routes
 *
 * CRUD operations for tickets, comments, assignment, escalation.
 * Ticket numbers: TKT-NNNNN (tenant-scoped sequential).
 * SLA tracking with visual indicator data in responses.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb, getSql } from '../db';
import { TicketEngine } from '@cavaridge/psa-core';
import { eventBus } from '../events';

export const ticketRouter = Router();

function getTicketEngine() {
  const db = getDb();
  return new TicketEngine(db, eventBus);
}

// ─── List tickets ───────────────────────────────────────────────────
ticketRouter.get('/', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { status, priority, assignedTo, clientId, search, page = '1', pageSize = '50' } = req.query;
    const offset = (parseInt(page as string) - 1) * parseInt(pageSize as string);
    const limit = parseInt(pageSize as string);

    // Build query with tenant isolation
    let query = `
      SELECT t.*,
        CASE
          WHEN t.sla_response_breached = true THEN 'breached'
          WHEN t.sla_response_due IS NOT NULL AND t.sla_response_due < NOW() AND t.sla_responded_at IS NULL THEN 'breached'
          WHEN t.sla_response_due IS NOT NULL AND t.sla_response_due < NOW() + INTERVAL '30 minutes' AND t.sla_responded_at IS NULL THEN 'warning'
          ELSE 'ok'
        END as sla_response_status,
        CASE
          WHEN t.sla_resolution_breached = true THEN 'breached'
          WHEN t.sla_resolution_due IS NOT NULL AND t.sla_resolution_due < NOW() AND t.sla_resolved_at IS NULL THEN 'breached'
          WHEN t.sla_resolution_due IS NOT NULL AND t.sla_resolution_due < NOW() + INTERVAL '1 hour' AND t.sla_resolved_at IS NULL THEN 'warning'
          ELSE 'ok'
        END as sla_resolution_status
      FROM tickets t
      WHERE t.tenant_id = $1
    `;
    const params: unknown[] = [req.tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND t.status = $${paramIndex++}`;
      params.push(status);
    }
    if (priority) {
      query += ` AND t.priority = $${paramIndex++}`;
      params.push(priority);
    }
    if (assignedTo) {
      query += ` AND t.assigned_to = $${paramIndex++}`;
      params.push(assignedTo);
    }
    if (clientId) {
      query += ` AND t.client_id = $${paramIndex++}`;
      params.push(clientId);
    }
    if (search) {
      query += ` AND (t.subject ILIKE $${paramIndex} OR t.ticket_number ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    query += ` ORDER BY
      CASE t.priority
        WHEN 'critical' THEN 0
        WHEN 'high' THEN 1
        WHEN 'medium' THEN 2
        WHEN 'low' THEN 3
      END,
      t.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(limit, offset);

    const sql = getSql();
    const result = await sql.unsafe(query, params as any[]);

    // Count total
    let countQuery = `SELECT COUNT(*)::int as total FROM tickets WHERE tenant_id = $1`;
    const countParams: unknown[] = [req.tenantId];
    const countResult = await sql.unsafe(countQuery, countParams as any[]);

    res.json({
      data: result,
      total: (countResult as any)[0]?.total ?? 0,
      page: parseInt(page as string),
      pageSize: limit,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Get single ticket ──────────────────────────────────────────────
ticketRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const result = await sql.unsafe(
      `SELECT * FROM tickets WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    );

    const ticket = result[0];
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Get comments
    const comments = await sql.unsafe(
      `SELECT * FROM ticket_comments WHERE ticket_id = $1 AND tenant_id = $2 ORDER BY created_at ASC`,
      [req.params.id, req.tenantId]
    );

    // Get tags
    const tags = await sql.unsafe(
      `SELECT * FROM ticket_tags WHERE ticket_id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    );

    res.json({ ...ticket, comments, tags });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Create ticket ──────────────────────────────────────────────────
ticketRouter.post('/', async (req: Request, res: Response) => {
  try {
    const engine = getTicketEngine();
    const ticket = await engine.createTicket({
      tenantId: req.tenantId,
      clientId: req.body.clientId,
      siteId: req.body.siteId,
      subject: req.body.subject,
      description: req.body.description,
      priority: req.body.priority,
      category: req.body.category,
      subcategory: req.body.subcategory,
      source: req.body.source ?? 'manual',
      assignedTo: req.body.assignedTo,
      requestedBy: req.body.requestedBy ?? req.userId,
      contractId: req.body.contractId,
      customFields: req.body.customFields,
    });

    res.status(201).json(ticket);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Update ticket ──────────────────────────────────────────────────
ticketRouter.patch('/:id', async (req: Request, res: Response) => {
  try {
    const engine = getTicketEngine();
    const updated = await engine.updateTicket(req.params.id, req.tenantId, {
      subject: req.body.subject,
      description: req.body.description,
      status: req.body.status,
      priority: req.body.priority,
      category: req.body.category,
      subcategory: req.body.subcategory,
      assignedTo: req.body.assignedTo,
      customFields: req.body.customFields,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Add comment ────────────────────────────────────────────────────
ticketRouter.post('/:id/comments', async (req: Request, res: Response) => {
  try {
    const engine = getTicketEngine();
    const comment = await engine.addComment({
      ticketId: req.params.id,
      tenantId: req.tenantId,
      authorId: req.userId,
      body: req.body.body,
      isInternal: req.body.isInternal ?? false,
      isResolution: req.body.isResolution ?? false,
      source: req.body.source ?? 'manual',
    });

    res.status(201).json(comment);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Assign ticket ──────────────────────────────────────────────────
ticketRouter.post('/:id/assign', async (req: Request, res: Response) => {
  try {
    const engine = getTicketEngine();
    const updated = await engine.updateTicket(req.params.id, req.tenantId, {
      assignedTo: req.body.assignedTo,
      status: 'open',
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Resolve ticket ─────────────────────────────────────────────────
ticketRouter.post('/:id/resolve', async (req: Request, res: Response) => {
  try {
    const engine = getTicketEngine();

    // Add resolution comment if provided
    if (req.body.resolution) {
      await engine.addComment({
        ticketId: req.params.id,
        tenantId: req.tenantId,
        authorId: req.userId,
        body: req.body.resolution,
        isResolution: true,
      });
    }

    const updated = await engine.updateTicket(req.params.id, req.tenantId, {
      status: 'resolved',
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Close ticket ───────────────────────────────────────────────────
ticketRouter.post('/:id/close', async (req: Request, res: Response) => {
  try {
    const engine = getTicketEngine();
    const updated = await engine.updateTicket(req.params.id, req.tenantId, {
      status: 'closed',
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Escalate ticket ────────────────────────────────────────────────
ticketRouter.post('/:id/escalate', async (req: Request, res: Response) => {
  try {
    const engine = getTicketEngine();

    // Bump priority if not already critical
    const sql = getSql();
    const [existing] = await sql.unsafe(
      `SELECT priority FROM tickets WHERE id = $1 AND tenant_id = $2`,
      [req.params.id, req.tenantId]
    );

    const priorityEscalation: Record<string, string> = {
      low: 'medium',
      medium: 'high',
      high: 'critical',
      critical: 'critical',
    };

    const newPriority = priorityEscalation[existing?.priority ?? 'medium'];

    await engine.addComment({
      ticketId: req.params.id,
      tenantId: req.tenantId,
      authorId: req.userId,
      body: `Escalated: ${req.body.reason ?? 'No reason provided'}`,
      isInternal: true,
    });

    const updated = await engine.updateTicket(req.params.id, req.tenantId, {
      priority: newPriority as any,
      assignedTo: req.body.escalateTo,
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Ticket stats (dashboard) ───────────────────────────────────────
ticketRouter.get('/stats/summary', async (req: Request, res: Response) => {
  try {
    const sql = getSql();
    const result = await sql.unsafe(`
        SELECT
          COUNT(*) FILTER (WHERE status IN ('new', 'open', 'pending')) as open_count,
          COUNT(*) FILTER (WHERE status = 'new') as new_count,
          COUNT(*) FILTER (WHERE priority = 'critical' AND status NOT IN ('resolved', 'closed', 'cancelled')) as critical_count,
          COUNT(*) FILTER (WHERE sla_response_breached = true OR (sla_response_due < NOW() AND sla_responded_at IS NULL AND status NOT IN ('resolved', 'closed', 'cancelled'))) as sla_breached_count,
          COUNT(*) FILTER (WHERE status = 'resolved' AND created_at > NOW() - INTERVAL '7 days') as resolved_this_week,
          COUNT(*) as total_count
        FROM tickets
        WHERE tenant_id = $1
      `, [req.tenantId]);

    res.json(result[0] ?? {});
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
