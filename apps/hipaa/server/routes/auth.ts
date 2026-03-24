import type { Express } from "express";
import { registerAuthRoutes as registerSharedAuthRoutes } from "@cavaridge/auth/routes";
import { db } from "../db";
import { profiles, tenants } from "@shared/models/auth";

export function registerAuthRoutes(app: Express) {
  registerSharedAuthRoutes(app, {
    db,
    profilesTable: profiles,
    tenantsTable: tenants,
    defaultRole: "msp_tech",
    defaultPlanTier: "starter",
    defaultMaxUsers: 10,
  });
}
