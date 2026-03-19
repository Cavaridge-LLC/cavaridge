import type { Express } from "express";
import { registerAuthRoutes as registerSharedAuthRoutes } from "@cavaridge/auth/routes";
import { db } from "../../db";
import { profiles } from "@shared/models/auth";
import { tenants } from "@cavaridge/auth/schema";

export function registerAuthRoutes(app: Express): void {
  registerSharedAuthRoutes(app, {
    db,
    profilesTable: profiles,
    orgsTable: tenants,
    defaultRole: "user",
    defaultPlanTier: "starter",
    defaultMaxUsers: 5,
  });
}
