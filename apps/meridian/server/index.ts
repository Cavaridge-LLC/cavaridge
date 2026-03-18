import * as Sentry from "@sentry/node";
import { readFileSync } from "fs";
import { resolve } from "path";
import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { loadUser } from "./auth";
import { globalLimiter, authLimiter, aiLimiter, shouldApplyAiLimit } from "./middleware/rate-limit";
import { csrfProtection } from "./middleware/csrf";
import { logger, requestLogger } from "./logger";

function getSentryRelease(): string {
  try {
    const versionData = JSON.parse(readFileSync(resolve(import.meta.dirname, "..", "version.json"), "utf-8"));
    return `meridian@${versionData.major}.${versionData.minor}.${versionData.patch}`;
  } catch {
    return "meridian@unknown";
  }
}

const sentryDsn = process.env.SENTRY_DSN;
if (sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,
    release: getSentryRelease(),
    environment: process.env.NODE_ENV || "development",
  });
  logger.info("Sentry initialized for server");
}

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// Supabase Auth — JWT validated via cookies on each request
app.use(loadUser as any);

app.use(requestLogger);
app.use(csrfProtection);

app.use(globalLimiter);
app.use("/api/auth/setup-profile", authLimiter);
app.use((req, _res, next) => {
  if (shouldApplyAiLimit(req.path)) {
    return aiLimiter(req, _res, next);
  }
  next();
});

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const { runMigrations } = await import("./db");
  await runMigrations().catch((err) => logger.warn({ err }, "Migration runner skipped (using db:push)"));

  const { seedDatabase } = await import("./seed");
  await seedDatabase().catch((err) => logger.error(err, "Seed error"));

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    if (sentryDsn) {
      Sentry.captureException(err);
    }

    logger.error({ err, status }, "Internal Server Error");

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
  });
})();
