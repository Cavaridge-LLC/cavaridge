import pino from "pino";
import { randomUUID } from "crypto";
import { readFileSync } from "fs";
import type { Request, Response, NextFunction } from "express";

let versionStr = "unknown";
try {
  const versionData = JSON.parse(readFileSync("version.json", "utf-8"));
  versionStr = `${versionData.major}.${versionData.minor}.${versionData.patch}`;
} catch {}

export const logger = pino({
  level: process.env.NODE_ENV === "production" ? "info" : "debug",
  base: {
    app: "CVG-RESEARCH",
    version: versionStr,
  },
  transport: process.env.NODE_ENV !== "production"
    ? { target: "pino/file", options: { destination: 1 } }
    : undefined,
});

declare global {
  namespace Express {
    interface Request {
      log: pino.Logger;
      requestId: string;
    }
  }
}

export function requestLogger(req: Request, _res: Response, next: NextFunction) {
  const requestId = randomUUID();
  req.requestId = requestId;

  const sessionUser = (req as any).user;
  req.log = logger.child({
    requestId,
    userId: sessionUser?.id,
    orgId: sessionUser?.organizationId,
    method: req.method,
    path: req.path,
  });

  next();
}
