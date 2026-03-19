import type { Express } from "express";
import { registerAuthRoutes as registerSharedAuthRoutes } from "@cavaridge/auth/routes";
import { db } from "../../db";
import { profiles } from "@shared/models/auth";

export function registerAuthRoutes(app: Express): void {
  registerSharedAuthRoutes(app, {
    db,
    profilesTable: profiles,
    defaultRole: "user",
    defaultPlanTier: "starter",
    defaultMaxUsers: 5,
  });

  // Legacy endpoint for backward compatibility
  app.get("/api/auth/user", (req: any, res) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    res.json(req.user);
  });
}
