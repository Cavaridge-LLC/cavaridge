import type { Express } from "express";
import { registerAuthRoutes as registerSharedAuthRoutes } from "@cavaridge/auth/routes";
import { db } from "../../db";
import { profiles, tenants } from "@cavaridge/auth/schema";

export function registerAuthRoutes(app: Express): void {
  registerSharedAuthRoutes(app, {
    db: db as any,
    profilesTable: profiles,
    tenantsTable: tenants,
    defaultRole: "msp_tech",
    defaultPlanTier: "starter",
    defaultMaxUsers: 5,
  });
}
