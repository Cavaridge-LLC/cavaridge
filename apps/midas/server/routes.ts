import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertClientSchema, insertInitiativeSchema, insertMeetingSchema, insertSnapshotSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // ── Clients ──
  app.get("/api/clients", async (_req, res) => {
    const rows = await storage.getClients();
    res.json(rows);
  });

  app.get("/api/clients/:id", async (req, res) => {
    const row = await storage.getClient(req.params.id);
    if (!row) return res.status(404).json({ message: "Client not found" });
    res.json(row);
  });

  app.post("/api/clients", async (req, res) => {
    const parsed = insertClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const row = await storage.createClient(parsed.data);
    res.status(201).json(row);
  });

  // ── Initiatives ──
  app.get("/api/clients/:clientId/initiatives", async (req, res) => {
    const rows = await storage.getInitiatives(req.params.clientId);
    res.json(rows);
  });

  app.post("/api/initiatives", async (req, res) => {
    const parsed = insertInitiativeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const row = await storage.createInitiative(parsed.data);
    res.status(201).json(row);
  });

  app.patch("/api/initiatives/:id", async (req, res) => {
    const row = await storage.updateInitiative(req.params.id, req.body);
    if (!row) return res.status(404).json({ message: "Initiative not found" });
    res.json(row);
  });

  app.delete("/api/initiatives/:id", async (req, res) => {
    await storage.deleteInitiative(req.params.id);
    res.status(204).end();
  });

  app.patch("/api/initiatives/reorder/batch", async (req, res) => {
    const updates: { id: string; quarter: string; sortOrder: number }[] = req.body.updates;
    if (!Array.isArray(updates)) return res.status(400).json({ message: "updates array required" });
    for (const u of updates) {
      await storage.updateInitiative(u.id, { quarter: u.quarter, sortOrder: u.sortOrder });
    }
    res.json({ ok: true });
  });

  // ── Meetings ──
  app.get("/api/meetings", async (req, res) => {
    const clientId = req.query.clientId as string | undefined;
    const rows = await storage.getMeetings(clientId);
    res.json(rows);
  });

  app.get("/api/meetings/:id", async (req, res) => {
    const row = await storage.getMeeting(req.params.id);
    if (!row) return res.status(404).json({ message: "Meeting not found" });
    res.json(row);
  });

  app.post("/api/meetings", async (req, res) => {
    const parsed = insertMeetingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const row = await storage.createMeeting(parsed.data);
    res.status(201).json(row);
  });

  app.patch("/api/meetings/:id", async (req, res) => {
    const row = await storage.updateMeeting(req.params.id, req.body);
    if (!row) return res.status(404).json({ message: "Meeting not found" });
    res.json(row);
  });

  app.delete("/api/meetings/:id", async (req, res) => {
    await storage.deleteMeeting(req.params.id);
    res.status(204).end();
  });

  // ── Snapshots ──
  app.get("/api/clients/:clientId/snapshot", async (req, res) => {
    const row = await storage.getSnapshot(req.params.clientId);
    if (!row) return res.status(404).json({ message: "Snapshot not found" });
    res.json(row);
  });

  app.put("/api/clients/:clientId/snapshot", async (req, res) => {
    const data = { ...req.body, clientId: req.params.clientId };
    const parsed = insertSnapshotSchema.safeParse(data);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.message });
    const row = await storage.upsertSnapshot(parsed.data);
    res.json(row);
  });

  // ── Seed (convenience for dev) ──
  app.post("/api/seed", async (_req, res) => {
    const existingClients = await storage.getClients();
    if (existingClients.length > 0) {
      return res.json({ message: "Already seeded", clients: existingClients });
    }

    const acme = await storage.createClient({ name: "Acme Corp", industry: "Manufacturing", headcount: 120 });
    const globex = await storage.createClient({ name: "Globex Inc", industry: "Finance", headcount: 85 });
    const initech = await storage.createClient({ name: "Initech Solutions", industry: "Professional Services", headcount: 55 });

    // Initiatives for Acme Corp
    const acmeInitiatives = [
      { clientId: acme.id, title: "Migrate to Microsoft 365", description: "Move all email and file storage to M365 environment.", team: "Cloud", priority: "High", status: "In Progress", quarter: "Q1 2024", cost: "$5k - $10k", businessProblem: "Employees struggling with remote collaboration and file sharing across different devices.", sortOrder: 0 },
      { clientId: acme.id, title: "MFA Enforcement", description: "Enforce Multi-Factor Auth across all user accounts.", team: "Security", priority: "Critical", status: "Completed", quarter: "Q1 2024", cost: "< $1k", businessProblem: "High risk of compromised credentials leading to data breaches.", sortOrder: 1 },
      { clientId: acme.id, title: "Network Switch Upgrade", description: "Replace end-of-life core switches in main office.", team: "Infrastructure", priority: "High", status: "Planned", quarter: "Q2 2024", cost: "$15k", businessProblem: "Frequent network drops causing 10+ hours of company downtime monthly.", sortOrder: 0 },
      { clientId: acme.id, title: "Security Awareness Training", description: "Roll out Q2 phishing simulation and training modules.", team: "Security", priority: "Medium", status: "Planned", quarter: "Q2 2024", cost: "$2k/yr", sortOrder: 1 },
      { clientId: acme.id, title: "Disaster Recovery Test", description: "Annual DR testing and validation of backup systems.", team: "Strategy", priority: "High", status: "Planned", quarter: "Q2 2024", cost: "Included", businessProblem: "Uncertainty around recovery time objective (RTO) in case of ransomware attack.", sortOrder: 2 },
      { clientId: acme.id, title: "Server Virtualization", description: "Virtualize remaining on-prem legacy servers.", team: "Infrastructure", priority: "Medium", status: "Proposed", quarter: "Q3 2024", cost: "$20k", sortOrder: 0 },
      { clientId: acme.id, title: "Compliance Audit", description: "SOC2 readiness assessment and gap analysis.", team: "Strategy", priority: "High", status: "Proposed", quarter: "Q3 2024", cost: "$12k", businessProblem: "Losing enterprise deals due to lack of formalized compliance attestation.", sortOrder: 1 },
      { clientId: acme.id, title: "Workstation Refresh", description: "Replace 25 laptops reaching 4-year lifecycle.", team: "Infrastructure", priority: "Medium", status: "Proposed", quarter: "Q4 2024", cost: "$35k", businessProblem: "Slow hardware decreasing employee productivity by estimated 5%.", sortOrder: 0 },
      { clientId: acme.id, title: "Cloud Cost Optimization", description: "Review and optimize Azure spend and reservations.", team: "Cloud", priority: "Low", status: "Proposed", quarter: "Q4 2024", cost: "TBD", sortOrder: 1 },
    ];
    for (const init of acmeInitiatives) {
      await storage.createInitiative(init);
    }

    // Snapshot for Acme
    await storage.upsertSnapshot({
      clientId: acme.id,
      engagementScore: 84,
      goalsAligned: 3,
      riskLevel: "Elevated",
      budgetTotal: 62000,
      adoptionPercent: 68,
      roiStatus: "On track",
    });

    // Meetings
    await storage.createMeeting({
      clientId: acme.id,
      clientName: "Acme Corp",
      title: "Q2 Executive Business Review",
      type: "QBR",
      state: "Scheduled",
      dateLabel: "Apr 18, 2026",
      attendees: ["CEO", "COO", "IT Manager", "vCIO"],
      agenda: "1) Executive Snapshot (risk, adoption, budget)\n2) Progress vs last quarter\n3) Top risks + mitigations\n4) Roadmap approvals\n5) Next quarter priorities",
      notes: "",
    });

    await storage.createMeeting({
      clientId: globex.id,
      clientName: "Globex Inc",
      title: "Security & Compliance Review",
      type: "Security Review",
      state: "Draft",
      dateLabel: "TBD",
      attendees: ["CFO", "Operations", "Security Lead", "vCIO"],
      agenda: "Review insurance requirements, MFA coverage, backups, and Q3 remediation plan.",
      notes: "",
    });

    await storage.createMeeting({
      clientId: initech.id,
      clientName: "Initech Solutions",
      title: "FY Planning Workshop",
      type: "Strategy Review",
      state: "Closed",
      dateLabel: "Jan 12, 2026",
      attendees: ["CEO", "VP Ops", "Finance", "vCIO"],
      agenda: "Align 3-year goals to technology roadmap, budget bands, and delivery cadence.",
      notes: "Meeting went well. Priorities confirmed.\n- Approved identity modernization\n- Approved device refresh\n- Deferred ERP replatform to FY27",
      executiveSummary: "Leadership aligned on a focused FY26 plan: modernize identity & security posture, improve end-user reliability, and reduce operational risk. Budget approved for core initiatives with staged approvals by quarter.",
      nextSteps: ["Finalize Q1-Q2 delivery plan", "Send board pack", "Schedule stakeholder check-in"],
    });

    res.status(201).json({ message: "Seeded successfully", clientIds: [acme.id, globex.id, initech.id] });
  });

  return httpServer;
}
