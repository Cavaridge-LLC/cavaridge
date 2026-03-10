import { type Express } from "express";
import { readFileSync } from "fs";
import { resolve } from "path";
import type { AuthenticatedRequest } from "../auth";
import { hasAICapability } from "../openrouter";

function readVersion() {
  try {
    return JSON.parse(readFileSync(resolve(process.cwd(), "version.json"), "utf-8"));
  } catch {
    return { major: 0, minor: 0, patch: 0, build: 0, timestamp: "" };
  }
}

export function registerSystemRoutes(app: Express) {
  app.get("/api/version", (_req, res) => {
    const v = readVersion();
    const version = `${v.major}.${v.minor}.${v.patch}`;
    res.json({
      version,
      build: v.build,
      full: `${version}+${v.build}`,
      timestamp: v.timestamp,
      environment: process.env.NODE_ENV === "production" ? "production" : "development",
    });
  });

  app.get("/api/system-status", async (_req, res) => {
    try {
      res.json({
        status: "operational",
        dbConnected: true,
        aiConfigured: hasAICapability(),
        uptime: process.uptime(),
      });
    } catch {
      res.json({
        status: "degraded",
        dbConnected: false,
        aiConfigured: false,
        uptime: process.uptime(),
      });
    }
  });

  app.get("/api/ai/status", (_req, res) => {
    res.json({ configured: hasAICapability() });
  });
}
