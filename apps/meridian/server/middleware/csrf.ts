import type { Request, Response, NextFunction } from "express";
import { randomBytes } from "crypto";

const EXEMPT_PATHS = [
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/logout",
  "/api/account-requests",
];

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isExempt(path: string): boolean {
  return EXEMPT_PATHS.some(p => path.startsWith(p));
}

function generateToken(): string {
  return randomBytes(32).toString("hex");
}

export function csrfProtection(req: Request, res: Response, next: NextFunction) {
  const isProduction = process.env.NODE_ENV === "production";

  let token = req.cookies?.["XSRF-TOKEN"];
  if (!token) {
    token = generateToken();
  }

  res.cookie("XSRF-TOKEN", token, {
    httpOnly: false,
    sameSite: "strict",
    secure: isProduction,
    path: "/",
  });

  if (STATE_CHANGING_METHODS.has(req.method) && !isExempt(req.path)) {
    const headerToken = req.headers["x-xsrf-token"] as string;
    if (!headerToken || headerToken !== token) {
      return res.status(403).json({ error: "CSRF token invalid" });
    }
  }

  next();
}
