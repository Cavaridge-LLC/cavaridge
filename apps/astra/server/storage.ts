import { db } from "./db";
import { reports, executiveSummaries, loginHistory } from "@shared/schema";
import type { Report, InsertReport, ExecutiveSummary, InsertExecutiveSummary, InsertLoginHistory, LoginHistory } from "@shared/schema";
import { eq, desc, and } from "drizzle-orm";

export interface IStorage {
  getReports(tenantId: string): Promise<Report[]>;
  getReport(id: number, tenantId: string): Promise<Report | undefined>;
  createReport(report: InsertReport): Promise<Report>;
  deleteReport(id: number, tenantId: string): Promise<void>;

  getExecutiveSummary(reportId: number, tenantId: string): Promise<ExecutiveSummary | undefined>;
  createExecutiveSummary(summary: InsertExecutiveSummary): Promise<ExecutiveSummary>;

  recordLogin(entry: InsertLoginHistory): Promise<LoginHistory>;
  getLoginHistory(userEmail: string): Promise<LoginHistory[]>;
  getLoginCount(userEmail: string): Promise<number>;
}

export class DatabaseStorage implements IStorage {
  async getReports(tenantId: string): Promise<Report[]> {
    return db.select().from(reports)
      .where(eq(reports.tenantId, tenantId))
      .orderBy(desc(reports.createdAt));
  }

  async getReport(id: number, tenantId: string): Promise<Report | undefined> {
    const [report] = await db.select().from(reports)
      .where(and(eq(reports.id, id), eq(reports.tenantId, tenantId)));
    return report;
  }

  async createReport(report: InsertReport): Promise<Report> {
    const [created] = await db.insert(reports).values(report).returning();
    return created;
  }

  async deleteReport(id: number, tenantId: string): Promise<void> {
    // Verify ownership before deleting
    const [existing] = await db.select({ id: reports.id }).from(reports)
      .where(and(eq(reports.id, id), eq(reports.tenantId, tenantId)));
    if (!existing) return;

    await db.delete(executiveSummaries).where(eq(executiveSummaries.reportId, id));
    await db.delete(reports).where(and(eq(reports.id, id), eq(reports.tenantId, tenantId)));
  }

  async getExecutiveSummary(reportId: number, tenantId: string): Promise<ExecutiveSummary | undefined> {
    const [summary] = await db.select().from(executiveSummaries)
      .where(and(eq(executiveSummaries.reportId, reportId), eq(executiveSummaries.tenantId, tenantId)));
    return summary;
  }

  async createExecutiveSummary(summary: InsertExecutiveSummary): Promise<ExecutiveSummary> {
    const [created] = await db.insert(executiveSummaries).values(summary).returning();
    return created;
  }

  async recordLogin(entry: InsertLoginHistory): Promise<LoginHistory> {
    const [created] = await db.insert(loginHistory).values(entry).returning();
    return created;
  }

  async getLoginHistory(userEmail: string): Promise<LoginHistory[]> {
    return db.select().from(loginHistory).where(eq(loginHistory.userEmail, userEmail)).orderBy(desc(loginHistory.loginAt));
  }

  async getLoginCount(userEmail: string): Promise<number> {
    const rows = await db.select().from(loginHistory).where(eq(loginHistory.userEmail, userEmail));
    return rows.length;
  }
}

export const storage = new DatabaseStorage();
