// Ducky auth routes — delegates to shared @cavaridge/auth/routes
//
// Registers: POST /api/auth/setup-profile, GET /api/auth/me,
//            GET /api/auth/callback, POST /api/auth/logout

import type { Express } from "express";
import { registerAuthRoutes as registerSharedAuthRoutes } from "@cavaridge/auth/routes";
import { db } from "../db";
import { profiles, organizations, auditLog } from "@shared/schema";

export function registerAuthRoutes(app: Express) {
  registerSharedAuthRoutes(app, {
    db,
    profilesTable: profiles,
    orgsTable: organizations,
    auditLogTable: auditLog,
    defaultRole: "tenant_admin",
    defaultPlanTier: "starter",
    defaultMaxUsers: 5,
  });
}
