/**
 * CVG-AI / Spaniel — LLM Gateway Service
 *
 * Service-to-service REST API. Not user-facing.
 * All consuming apps call Spaniel via bearer token auth.
 */

import express from "express";
import { createServer } from "http";
import { logger, requestLogger } from "./logger.js";
import { serviceAuth } from "./middleware/auth.js";
import { serviceLimiter } from "./middleware/rate-limit.js";
import { registerRoutes } from "./routes/index.js";

const app = express();
const httpServer = createServer(app);

app.use(express.json({ limit: "1mb" }));

// Request logging
app.use(requestLogger);

// Rate limiting
app.use(serviceLimiter);

// Service-to-service bearer token auth on /api/v1/* routes
app.use("/api/v1", serviceAuth);

// Register all routes
registerRoutes(app);

// Error handler
app.use(
  (
    err: Error & { status?: number; statusCode?: number },
    _req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    logger.error({ err, status }, "Unhandled error");

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ error: message });
  }
);

const port = parseInt(process.env.PORT || "5100", 10);
httpServer.listen({ port, host: "0.0.0.0" }, () => {
  logger.info(`Spaniel LLM Gateway listening on port ${port}`);
});
