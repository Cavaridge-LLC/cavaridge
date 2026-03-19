import express from "express";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

app.use(express.json());

// Health checks — before auth so Railway probes work without JWT
app.get("/healthz", (_req, res) => res.json({ ok: true }));
app.get("/api/v1/health", (_req, res) => {
  res.json({ status: "healthy", service: "brain", version: "0.0.1" });
});

const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen({ port, host: "0.0.0.0" }, () => {
  console.log(`${new Date().toLocaleTimeString()} [brain] serving on port ${port}`);
});
