/**
 * CVG-CAVALIER — AI Enrichment Routes
 *
 * Ticket enrichment via Spaniel: auto-categorization,
 * priority suggestion, knowledge base search.
 * All LLM calls route through @cavaridge/spaniel.
 */
import { Router } from 'express';
import type { Request, Response } from 'express';
import { getDb } from '../db';
import { TicketEngine } from '@cavaridge/psa-core';
import { eventBus } from '../events';

export const enrichmentRouter = Router();

/**
 * Enrich a ticket with AI-powered categorization, priority scoring,
 * and suggested resolution.
 *
 * In production, this calls @cavaridge/spaniel chatCompletion.
 * For now, returns a structured response format that the UI can consume.
 */
enrichmentRouter.post('/ticket/:ticketId', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const ticketResult = await db.execute({
      sql: `SELECT * FROM tickets WHERE id = $1 AND tenant_id = $2`,
      params: [req.params.ticketId, req.tenantId],
    } as any);

    const ticket = (ticketResult as any)[0];
    if (!ticket) {
      res.status(404).json({ error: 'Ticket not found' });
      return;
    }

    // Build enrichment prompt for Spaniel
    const enrichmentPrompt = buildEnrichmentPrompt(ticket);

    // In production:
    // const result = await chatCompletion({
    //   tenantId: req.tenantId,
    //   userId: req.userId,
    //   appCode: 'CVG-CAVALIER',
    //   taskType: 'analysis',
    //   system: 'You are a ticket triage agent...',
    //   messages: [{ role: 'user', content: enrichmentPrompt }],
    // });

    // For Phase 1 dev, return structured enrichment based on keyword analysis
    const enrichment = analyzeTicketLocally(ticket);

    // Apply enrichment to the ticket
    const engine = new TicketEngine(db, eventBus);
    await engine.applyEnrichment(req.params.ticketId, req.tenantId, {
      category: enrichment.category,
      subcategory: enrichment.subcategory,
      aiCategoryConfidence: enrichment.confidence,
      aiPriorityScore: enrichment.priorityScore,
      aiSuggestedResolution: enrichment.suggestedResolution,
    });

    res.json({
      ticketId: req.params.ticketId,
      enrichment,
      source: 'local-analysis', // Will become 'spaniel' in production
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Search knowledge base for similar tickets and resolutions.
 */
enrichmentRouter.post('/similar-tickets', async (req: Request, res: Response) => {
  try {
    const db = getDb();
    const { subject, description, limit = 5 } = req.body;

    // Simple keyword-based similarity search
    // In production, this uses pgvector semantic search
    const result = await db.execute({
      sql: `
        SELECT id, ticket_number, subject, category, status,
               ai_suggested_resolution, created_at
        FROM tickets
        WHERE tenant_id = $1
          AND status IN ('resolved', 'closed')
          AND (subject ILIKE $2 OR description ILIKE $2)
        ORDER BY created_at DESC
        LIMIT $3
      `,
      params: [req.tenantId, `%${(subject ?? '').split(' ').slice(0, 3).join('%')}%`, limit],
    } as any);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

// ─── Helpers ────────────────────────────────────────────────────────

function buildEnrichmentPrompt(ticket: any): string {
  return `Analyze this IT support ticket and provide categorization:

Subject: ${ticket.subject}
Description: ${ticket.description ?? 'No description'}
Source: ${ticket.source}
Current Priority: ${ticket.priority}

Respond with JSON:
{
  "category": "string (e.g., Network, Hardware, Software, Security, Cloud, Email, Account)",
  "subcategory": "string (more specific)",
  "priorityScore": number (0-1, where 1 = most urgent),
  "confidence": number (0-1),
  "suggestedResolution": "string (recommended next steps)"
}`;
}

function analyzeTicketLocally(ticket: any): {
  category: string;
  subcategory: string;
  confidence: number;
  priorityScore: number;
  suggestedResolution: string;
} {
  const text = `${ticket.subject} ${ticket.description ?? ''}`.toLowerCase();

  const categoryMap: Record<string, { category: string; subcategory: string; resolution: string }> = {
    'password|login|access|locked|mfa|2fa': {
      category: 'Account',
      subcategory: 'Access Management',
      resolution: 'Verify user identity, reset password/MFA, check AD account status.',
    },
    'email|outlook|exchange|mailbox|spam': {
      category: 'Email',
      subcategory: 'Email Services',
      resolution: 'Check Exchange Online status, verify mailbox configuration, review mail flow rules.',
    },
    'network|vpn|wifi|internet|dns|dhcp|firewall': {
      category: 'Network',
      subcategory: 'Connectivity',
      resolution: 'Check device connectivity, verify DNS resolution, test VPN tunnel, review firewall rules.',
    },
    'printer|scanner|print': {
      category: 'Hardware',
      subcategory: 'Peripherals',
      resolution: 'Check printer connectivity, reinstall drivers, verify print spooler service.',
    },
    'slow|performance|crash|freeze|blue screen|bsod': {
      category: 'Hardware',
      subcategory: 'Performance',
      resolution: 'Check system resources (RAM/CPU/disk), run diagnostics, review event logs.',
    },
    'backup|restore|recovery|disaster': {
      category: 'Cloud',
      subcategory: 'Backup & Recovery',
      resolution: 'Verify backup job status, check retention policies, test restore procedure.',
    },
    'virus|malware|phishing|ransomware|breach|compromised': {
      category: 'Security',
      subcategory: 'Threat Response',
      resolution: 'Isolate affected system, run full scan, check EDR alerts, review login history.',
    },
    'install|update|patch|software|application|license': {
      category: 'Software',
      subcategory: 'Application Management',
      resolution: 'Verify license availability, check system requirements, deploy via RMM.',
    },
    'onboard|new user|new hire|setup|provision': {
      category: 'Account',
      subcategory: 'User Provisioning',
      resolution: 'Follow new user provisioning checklist: AD account, M365 license, email, MFA, device setup.',
    },
    'azure|m365|microsoft 365|sharepoint|teams|onedrive': {
      category: 'Cloud',
      subcategory: 'M365 Services',
      resolution: 'Check M365 service health, verify user licensing, review admin center for errors.',
    },
  };

  for (const [keywords, match] of Object.entries(categoryMap)) {
    const regex = new RegExp(keywords, 'i');
    if (regex.test(text)) {
      // Priority scoring based on keyword severity
      let priorityScore = 0.5;
      if (/critical|emergency|down|outage|ransomware|breach/i.test(text)) priorityScore = 0.95;
      else if (/urgent|asap|cannot|unable|blocked/i.test(text)) priorityScore = 0.8;
      else if (/slow|intermittent|sometimes/i.test(text)) priorityScore = 0.4;
      else if (/question|how to|request|would like/i.test(text)) priorityScore = 0.2;

      return {
        ...match,
        confidence: 0.75,
        priorityScore,
        suggestedResolution: match.resolution,
      };
    }
  }

  return {
    category: 'General',
    subcategory: 'Uncategorized',
    confidence: 0.3,
    priorityScore: 0.5,
    suggestedResolution: 'Review ticket details and categorize manually. Assign to appropriate technician.',
  };
}
