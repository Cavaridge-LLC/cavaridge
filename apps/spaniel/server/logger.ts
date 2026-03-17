import pino from "pino";
import type { Request, Response, NextFunction } from "express";

export const logger = pino({
  name: "spaniel",
  level: process.env.LOG_LEVEL || "info",
  transport:
    process.env.NODE_ENV !== "production"
      ? { target: "pino-pretty", options: { colorize: true } }
      : undefined,
});

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (req.path.startsWith("/api")) {
      logger.info(
        { method: req.method, path: req.path, status: res.statusCode, duration },
        `${req.method} ${req.path} ${res.statusCode} ${duration}ms`
      );
    }
  });

  next();
}
