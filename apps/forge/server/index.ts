import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { AppError } from "./utils/errors";
import { loadUser } from "./auth";

const app = express();
const httpServer = createServer(app);

app.use(cookieParser());

// Health checks — before auth so Railway probes work without JWT
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "healthy", service: "forge", version: "1.0.0" });
});

// Supabase Auth — JWT validated via cookies on each request
app.use(loadUser as any);

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

export function log(message: string, source = "forge") {
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
        logLine += ` :: ${JSON.stringify(capturedJsonResponse).slice(0, 200)}`;
      }
      log(logLine);
    }
  });

  next();
});

(async () => {
  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }

    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        error: err.message,
        type: err.type,
        statusCode: err.statusCode,
      });
    }

    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    console.error("Unhandled error:", err);

    return res.status(status).json({
      error: message,
      type: "InternalError",
      statusCode: status,
    });
  });

  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  const port = parseInt(process.env.PORT || "5007", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();
