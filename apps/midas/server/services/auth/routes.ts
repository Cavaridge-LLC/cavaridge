import type { Express } from "express";
import { registerAuthRoutes as registerSharedAuthRoutes } from "@cavaridge/auth/server";
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
}
