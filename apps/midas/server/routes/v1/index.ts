/**
 * Midas API v1 Router — mounts all v1 sub-routers.
 */

import { Router } from "express";
import { roadmapRouter } from "./roadmaps";
import { projectRouter } from "./projects";
import { budgetRouter } from "./budgets";
import { qbrReportRouter } from "./qbr-reports";
import { dashboardRouter } from "./dashboard";
import { recommendationRouter } from "./recommendations";

const v1Router = Router();

v1Router.use("/roadmaps", roadmapRouter);
v1Router.use("/projects", projectRouter);
v1Router.use("/budgets", budgetRouter);
v1Router.use("/qbr-reports", qbrReportRouter);
v1Router.use("/dashboard", dashboardRouter);
v1Router.use("/recommendations", recommendationRouter);

export { v1Router };
