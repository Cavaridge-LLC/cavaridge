import type { Express, Request, Response, NextFunction } from "express";
import { db } from "../db";
import { profiles } from "@shared/schema";
import { eq } from "drizzle-orm";
import { requireAuth } from "../services/auth";

export function registerAuthRoutes(app: Express) {
  app.get("/api/auth/me", requireAuth as any, async (req: Request, res: Response) => {
    const user = req.user as any;
    res.json({ user });
  });

  app.post("/api/auth/setup-profile", requireAuth as any, async (req: Request, res: Response, next: NextFunction) => {
    try {
      const supabaseUser = (req as any).supabaseUser;
      if (!supabaseUser?.id) {
        return res.status(401).json({ error: "Not authenticated" });
      }

      const { displayName } = req.body;

      const [existing] = await db.select().from(profiles).where(eq(profiles.id, supabaseUser.id));
      if (existing) {
        return res.json({ user: existing });
      }

      const [created] = await db.insert(profiles).values({
        id: supabaseUser.id,
        email: supabaseUser.email || "",
        displayName: displayName || supabaseUser.email?.split("@")[0] || "User",
      }).returning();

      res.status(201).json({ user: created });
    } catch (err) {
      next(err);
    }
  });
}
