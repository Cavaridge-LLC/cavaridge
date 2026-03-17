import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { requireAuth } from "./services/auth";
import { insertMigrationPlanSchema } from "@shared/schema";
import { z } from "zod";

const SOURCES: Record<string, string> = {
  onprem: "On-Premises",
  aws: "Amazon Web Services",
  azure: "Microsoft Azure",
  gcp: "Google Cloud",
};

const DESTINATIONS: Record<string, string> = {
  aws: "AWS",
  azure: "Azure",
  gcp: "GCP",
};

const RESOURCE_LABELS: Record<string, string> = {
  web: "Websites & Apps",
  db: "Databases",
  files: "Files & Storage",
  servers: "Internal Tools",
};

function generateBlueprint(source: string, destination: string, resources: string[]) {
  const resourceCount = resources.length;
  const hasDb = resources.includes("db");
  const hasServers = resources.includes("servers");
  const isCrossCloud = source !== "onprem" && source !== destination;

  let complexity: string;
  let timelineEstimate: string;
  let downtimeEstimate: string;
  let riskLevel: string;

  if (resourceCount <= 1 && !hasDb) {
    complexity = "Low";
    timelineEstimate = "1-2 Weeks";
    downtimeEstimate = "~1 Hour";
    riskLevel = "Low Risk";
  } else if (resourceCount <= 2 && !isCrossCloud) {
    complexity = "Moderate";
    timelineEstimate = "2-4 Weeks";
    downtimeEstimate = "~4 Hours";
    riskLevel = "Low Risk";
  } else if (resourceCount >= 3 || (hasDb && hasServers)) {
    complexity = "High";
    timelineEstimate = "4-8 Weeks";
    downtimeEstimate = "8-12 Hours";
    riskLevel = "Medium Risk";
  } else {
    complexity = "Moderate";
    timelineEstimate = "2-4 Weeks";
    downtimeEstimate = "~4 Hours";
    riskLevel = "Low Risk";
  }

  if (isCrossCloud) {
    riskLevel = riskLevel === "Low Risk" ? "Medium Risk" : "High Risk";
  }

  const destName = DESTINATIONS[destination] || destination;
  const srcName = SOURCES[source] || source;

  const steps: string[] = [];

  if (source === "onprem") {
    steps.push(`Audit your current on-premises infrastructure and create an asset inventory.`);
  } else {
    steps.push(`Export configuration and access credentials from ${srcName}.`);
  }

  if (hasDb) {
    steps.push(`Set up a secure connection to replicate databases to ${destName} with zero downtime.`);
  }

  if (resources.includes("web")) {
    steps.push(`Configure load balancers and DNS entries in ${destName} for your web applications.`);
  }

  if (resources.includes("files")) {
    steps.push(`Migrate file storage and backups to ${destName} object storage.`);
  }

  if (hasServers) {
    steps.push(`Rebuild internal tool environments in ${destName} using matching server configurations.`);
  }

  steps.push(`Provision matching server sizes and networking rules in ${destName}.`);
  steps.push(`Run parallel testing on both old and new environments to verify everything works.`);
  steps.push(`Schedule a weekend maintenance window for the final DNS cutover.`);

  return { timelineEstimate, downtimeEstimate, complexity, riskLevel, steps };
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  app.post("/api/migration-plans", requireAuth, async (req, res) => {
    try {
      const parsed = insertMigrationPlanSchema.parse(req.body);

      const blueprint = generateBlueprint(parsed.source, parsed.destination, parsed.resources);

      const plan = await storage.createMigrationPlan({
        ...parsed,
        ...blueprint,
      });

      res.status(201).json(plan);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input", errors: error.errors });
      }
      console.error("Error creating migration plan:", error);
      res.status(500).json({ message: "Failed to create migration plan" });
    }
  });

  app.get("/api/migration-plans", requireAuth, async (_req, res) => {
    try {
      const plans = await storage.getAllMigrationPlans();
      res.json(plans);
    } catch (error) {
      console.error("Error fetching migration plans:", error);
      res.status(500).json({ message: "Failed to fetch migration plans" });
    }
  });

  app.get("/api/migration-plans/:id", requireAuth, async (req, res) => {
    try {
      const plan = await storage.getMigrationPlan(req.params.id);
      if (!plan) {
        return res.status(404).json({ message: "Plan not found" });
      }
      res.json(plan);
    } catch (error) {
      console.error("Error fetching migration plan:", error);
      res.status(500).json({ message: "Failed to fetch migration plan" });
    }
  });

  return httpServer;
}