/**
 * /api/v1 — Vespar v1 API Router
 *
 * Mounts all v1 sub-routers under /api/v1.
 */

import { Router, type IRouter } from "express";
import { assessmentsRouter } from "./assessments";
import { workloadsRouter } from "./workloads";
import { wavesRouter } from "./waves";
import { costModelsRouter } from "./cost-models";
import { reportsRouter } from "./reports";

export const v1Router: IRouter = Router();

v1Router.use("/assessments", assessmentsRouter);
v1Router.use("/workloads", workloadsRouter);
v1Router.use("/waves", wavesRouter);
v1Router.use("/cost-models", costModelsRouter);
v1Router.use("/reports", reportsRouter);
