import type { Express } from "express";
import { registerAuthRoutes as registerSharedAuthRoutes } from "@cavaridge/auth/routes";
import { db } from "../../db";
import { profiles, tenants } from "@shared/models/auth";

export function registerAuthRoutes(app: Express): void {
  // Cast to any: drizzle-orm resolves different @types/pg versions across pnpm workspaces
  registerSharedAuthRoutes(app, {
    db: db as any,
    profilesTable: profiles as any,
    tenantsTable: tenants as any,
    defaultRole: "msp_tech",
    defaultPlanTier: "starter",
    defaultMaxUsers: 10,
  });

  // Legacy endpoint for backward compatibility during migration
  app.get("/api/auth/user", (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    res.json(req.user);
  });
}
