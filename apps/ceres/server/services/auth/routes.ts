import type { Express } from "express";
import { registerAuthRoutes as registerSharedAuthRoutes } from "@cavaridge/auth/routes";
import { db } from "../../db";
import { profiles } from "@shared/models/auth";
import { organizations } from "@cavaridge/auth/schema";

export function registerAuthRoutes(app: Express): void {
  registerSharedAuthRoutes(app, {
    db,
    profilesTable: profiles,
    orgsTable: organizations,
    defaultRole: "user",
    defaultPlanTier: "starter",
    defaultMaxUsers: 5,
  });
}
