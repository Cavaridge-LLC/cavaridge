import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { loadUser, registerAuthRoutes } from "./services/auth";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(cookieParser());

// Health checks — before auth so Railway probes work without JWT
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "healthy", service: "astra", version: "1.0.0" });
});

// Temporary debug endpoint — remove after auth is working
app.get("/api/debug/auth", async (req, res) => {
  const { createSupabaseServerClient } = await import("@cavaridge/auth/server");
  try {
    const cookieHeader = req.headers.cookie || "(none)";
    const cookieNames = cookieHeader === "(none)" ? [] : cookieHeader.split(";").map((c: string) => c.trim().split("=")[0]);
    const hasSbCookies = cookieNames.some((n: string) => n.includes("sb-"));

    const supabase = createSupabaseServerClient(req, res);
    const { data, error } = await supabase.auth.getUser();

    res.json({
      envCheck: {
        hasSupabaseUrl: !!process.env.SUPABASE_URL,
        supabaseUrlPrefix: process.env.SUPABASE_URL?.substring(0, 30),
        hasAnonKey: !!process.env.SUPABASE_ANON_KEY,
        anonKeyPrefix: process.env.SUPABASE_ANON_KEY?.substring(0, 20),
      },
      cookies: { count: cookieNames.length, names: cookieNames, hasSbCookies },
      auth: {
        userEmail: data?.user?.email || null,
        error: error?.message || null,
      },
    });
  } catch (err: any) {
    res.json({ error: err.message, stack: err.stack?.substring(0, 300) });
  }
});

app.use(loadUser as any);

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

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
  registerAuthRoutes(app);

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

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
