import { eq, and, desc, sql, count } from "drizzle-orm";
import { db } from "./db";
import {
  tenants, profiles, migrationProjects, workloads,
  dependencies, riskFindings, costProjections, runbooks,
  migrationWaves, waveWorkloads,
  type Tenant, type InsertTenant,
  type Profile, type InsertProfile,
  type MigrationProject, type InsertMigrationProject,
  type Workload, type InsertWorkload,
  type Dependency, type InsertDependency,
  type RiskFinding, type InsertRiskFinding,
  type CostProjection, type InsertCostProjection,
  type Runbook, type InsertRunbook,
  type MigrationWave, type InsertMigrationWave,
  type WaveWorkload, type InsertWaveWorkload,
} from "@shared/schema";

export interface ProjectSummary extends MigrationProject {
  workloadCount: number;
  riskCount: number;
  openRiskCount: number;
}

export interface IStorage {
  getTenant(id: string): Promise<Tenant | undefined>;
  createTenant(data: InsertTenant): Promise<Tenant>;
  getUser(id: string): Promise<Profile | undefined>;
  getUserByEmail(email: string): Promise<Profile | undefined>;
  createUser(data: InsertProfile): Promise<Profile>;
  getProjectsByTenant(tenantId: string): Promise<ProjectSummary[]>;
  getProject(id: string, tenantId: string): Promise<MigrationProject | undefined>;
  createProject(data: InsertMigrationProject): Promise<MigrationProject>;
  updateProject(id: string, tenantId: string, data: Partial<MigrationProject>): Promise<MigrationProject | undefined>;
  deleteProject(id: string, tenantId: string): Promise<boolean>;
  getWorkloadsByProject(projectId: string, tenantId: string): Promise<Workload[]>;
  getWorkload(id: string, tenantId: string): Promise<Workload | undefined>;
  createWorkload(data: InsertWorkload): Promise<Workload>;
  bulkCreateWorkloads(data: InsertWorkload[]): Promise<Workload[]>;
  updateWorkload(id: string, tenantId: string, data: Partial<Workload>): Promise<Workload | undefined>;
  deleteWorkload(id: string, tenantId: string): Promise<boolean>;
  getDependenciesByProject(projectId: string, tenantId: string): Promise<Dependency[]>;
  createDependency(data: InsertDependency): Promise<Dependency>;
  deleteDependency(id: string, tenantId: string): Promise<boolean>;
  getRisksByProject(projectId: string, tenantId: string): Promise<RiskFinding[]>;
  createRisk(data: InsertRiskFinding): Promise<RiskFinding>;
  updateRisk(id: string, tenantId: string, data: Partial<RiskFinding>): Promise<RiskFinding | undefined>;
  bulkCreateRisks(data: InsertRiskFinding[]): Promise<RiskFinding[]>;
  getCostsByProject(projectId: string, tenantId: string): Promise<CostProjection[]>;
  createCost(data: InsertCostProjection): Promise<CostProjection>;
  updateCost(id: string, tenantId: string, data: Partial<CostProjection>): Promise<CostProjection | undefined>;
  bulkCreateCosts(data: InsertCostProjection[]): Promise<CostProjection[]>;
  getRunbooksByProject(projectId: string, tenantId: string): Promise<Runbook[]>;
  getRunbook(id: string, tenantId: string): Promise<Runbook | undefined>;
  createRunbook(data: InsertRunbook): Promise<Runbook>;
  updateRunbook(id: string, tenantId: string, data: Partial<Runbook>): Promise<Runbook | undefined>;
  // Waves
  getWavesByProject(projectId: string, tenantId: string): Promise<MigrationWave[]>;
  getWave(id: string, tenantId: string): Promise<MigrationWave | undefined>;
  createWave(data: InsertMigrationWave): Promise<MigrationWave>;
  updateWave(id: string, tenantId: string, data: Partial<MigrationWave>): Promise<MigrationWave | undefined>;
  getWaveWorkloads(waveId: string, tenantId: string): Promise<WaveWorkload[]>;
  assignWorkloadsToWave(waveId: string, tenantId: string, workloadIds: string[]): Promise<WaveWorkload[]>;
}

export class DatabaseStorage implements IStorage {
  // --- Tenants ---
  // Note: Casts below work around @types/pg version mismatch between workspace packages
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants as any).where(eq(tenants.id as any, id));
    return tenant as Tenant | undefined;
  }

  async createTenant(data: InsertTenant): Promise<Tenant> {
    const [tenant] = await db.insert(tenants as any).values(data).returning();
    return tenant as Tenant;
  }

  // --- Profiles ---
  async getUser(id: string): Promise<Profile | undefined> {
    const [user] = await db.select().from(profiles as any).where(eq(profiles.id as any, id));
    return user as Profile | undefined;
  }

  async getUserByEmail(email: string): Promise<Profile | undefined> {
    const [user] = await db.select().from(profiles as any).where(eq(profiles.email as any, email));
    return user as Profile | undefined;
  }

  async createUser(data: InsertProfile): Promise<Profile> {
    const [user] = await db.insert(profiles as any).values(data).returning();
    return user as Profile;
  }

  // --- Projects ---
  async getProjectsByTenant(tenantId: string): Promise<ProjectSummary[]> {
    const projects = await db
      .select()
      .from(migrationProjects)
      .where(eq(migrationProjects.tenantId, tenantId))
      .orderBy(desc(migrationProjects.updatedAt));

    const summaries: ProjectSummary[] = [];
    for (const project of projects) {
      const [wCount] = await db
        .select({ value: count() })
        .from(workloads)
        .where(and(eq(workloads.projectId, project.id), eq(workloads.tenantId, tenantId)));
      const [rCount] = await db
        .select({ value: count() })
        .from(riskFindings)
        .where(and(eq(riskFindings.projectId, project.id), eq(riskFindings.tenantId, tenantId)));
      const [openR] = await db
        .select({ value: count() })
        .from(riskFindings)
        .where(and(
          eq(riskFindings.projectId, project.id),
          eq(riskFindings.tenantId, tenantId),
          eq(riskFindings.status, "open"),
        ));
      summaries.push({
        ...project,
        workloadCount: Number(wCount.value),
        riskCount: Number(rCount.value),
        openRiskCount: Number(openR.value),
      });
    }
    return summaries;
  }

  async getProject(id: string, tenantId: string): Promise<MigrationProject | undefined> {
    const [project] = await db
      .select()
      .from(migrationProjects)
      .where(and(eq(migrationProjects.id, id), eq(migrationProjects.tenantId, tenantId)));
    return project;
  }

  async createProject(data: InsertMigrationProject): Promise<MigrationProject> {
    const [project] = await db.insert(migrationProjects).values(data).returning();
    return project;
  }

  async updateProject(id: string, tenantId: string, data: Partial<MigrationProject>): Promise<MigrationProject | undefined> {
    const [project] = await db
      .update(migrationProjects)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(migrationProjects.id, id), eq(migrationProjects.tenantId, tenantId)))
      .returning();
    return project;
  }

  async deleteProject(id: string, tenantId: string): Promise<boolean> {
    const [result] = await db
      .update(migrationProjects)
      .set({ status: "archived", updatedAt: new Date() })
      .where(and(eq(migrationProjects.id, id), eq(migrationProjects.tenantId, tenantId)))
      .returning();
    return !!result;
  }

  // --- Workloads ---
  async getWorkloadsByProject(projectId: string, tenantId: string): Promise<Workload[]> {
    return db
      .select()
      .from(workloads)
      .where(and(eq(workloads.projectId, projectId), eq(workloads.tenantId, tenantId)))
      .orderBy(workloads.name);
  }

  async getWorkload(id: string, tenantId: string): Promise<Workload | undefined> {
    const [w] = await db
      .select()
      .from(workloads)
      .where(and(eq(workloads.id, id), eq(workloads.tenantId, tenantId)));
    return w;
  }

  async createWorkload(data: InsertWorkload): Promise<Workload> {
    const [w] = await db.insert(workloads).values(data).returning();
    return w;
  }

  async bulkCreateWorkloads(data: InsertWorkload[]): Promise<Workload[]> {
    if (data.length === 0) return [];
    return db.insert(workloads).values(data).returning();
  }

  async updateWorkload(id: string, tenantId: string, data: Partial<Workload>): Promise<Workload | undefined> {
    const [w] = await db
      .update(workloads)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(workloads.id, id), eq(workloads.tenantId, tenantId)))
      .returning();
    return w;
  }

  async deleteWorkload(id: string, tenantId: string): Promise<boolean> {
    await db.delete(dependencies).where(
      and(
        eq(dependencies.tenantId, tenantId),
        sql`(${dependencies.sourceWorkloadId} = ${id} OR ${dependencies.targetWorkloadId} = ${id})`,
      ),
    );
    const result = await db
      .delete(workloads)
      .where(and(eq(workloads.id, id), eq(workloads.tenantId, tenantId)))
      .returning();
    return result.length > 0;
  }

  // --- Dependencies ---
  async getDependenciesByProject(projectId: string, tenantId: string): Promise<Dependency[]> {
    return db
      .select()
      .from(dependencies)
      .where(and(eq(dependencies.projectId, projectId), eq(dependencies.tenantId, tenantId)));
  }

  async createDependency(data: InsertDependency): Promise<Dependency> {
    const [dep] = await db.insert(dependencies).values(data).returning();
    return dep;
  }

  async deleteDependency(id: string, tenantId: string): Promise<boolean> {
    const result = await db
      .delete(dependencies)
      .where(and(eq(dependencies.id, id), eq(dependencies.tenantId, tenantId)))
      .returning();
    return result.length > 0;
  }

  // --- Risk Findings ---
  async getRisksByProject(projectId: string, tenantId: string): Promise<RiskFinding[]> {
    return db
      .select()
      .from(riskFindings)
      .where(and(eq(riskFindings.projectId, projectId), eq(riskFindings.tenantId, tenantId)))
      .orderBy(desc(riskFindings.riskScore));
  }

  async createRisk(data: InsertRiskFinding): Promise<RiskFinding> {
    const [risk] = await db.insert(riskFindings).values(data).returning();
    return risk;
  }

  async updateRisk(id: string, tenantId: string, data: Partial<RiskFinding>): Promise<RiskFinding | undefined> {
    const [risk] = await db
      .update(riskFindings)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(riskFindings.id, id), eq(riskFindings.tenantId, tenantId)))
      .returning();
    return risk;
  }

  async bulkCreateRisks(data: InsertRiskFinding[]): Promise<RiskFinding[]> {
    if (data.length === 0) return [];
    return db.insert(riskFindings).values(data).returning();
  }

  // --- Cost Projections ---
  async getCostsByProject(projectId: string, tenantId: string): Promise<CostProjection[]> {
    return db
      .select()
      .from(costProjections)
      .where(and(eq(costProjections.projectId, projectId), eq(costProjections.tenantId, tenantId)));
  }

  async createCost(data: InsertCostProjection): Promise<CostProjection> {
    const [cost] = await db.insert(costProjections).values(data).returning();
    return cost;
  }

  async updateCost(id: string, tenantId: string, data: Partial<CostProjection>): Promise<CostProjection | undefined> {
    const [cost] = await db
      .update(costProjections)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(costProjections.id, id), eq(costProjections.tenantId, tenantId)))
      .returning();
    return cost;
  }

  async bulkCreateCosts(data: InsertCostProjection[]): Promise<CostProjection[]> {
    if (data.length === 0) return [];
    return db.insert(costProjections).values(data).returning();
  }

  // --- Runbooks ---
  async getRunbooksByProject(projectId: string, tenantId: string): Promise<Runbook[]> {
    return db
      .select()
      .from(runbooks)
      .where(and(eq(runbooks.projectId, projectId), eq(runbooks.tenantId, tenantId)))
      .orderBy(desc(runbooks.updatedAt));
  }

  async getRunbook(id: string, tenantId: string): Promise<Runbook | undefined> {
    const [rb] = await db
      .select()
      .from(runbooks)
      .where(and(eq(runbooks.id, id), eq(runbooks.tenantId, tenantId)));
    return rb;
  }

  async createRunbook(data: InsertRunbook): Promise<Runbook> {
    const [rb] = await db.insert(runbooks).values(data).returning();
    return rb;
  }

  async updateRunbook(id: string, tenantId: string, data: Partial<Runbook>): Promise<Runbook | undefined> {
    const [rb] = await db
      .update(runbooks)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(runbooks.id, id), eq(runbooks.tenantId, tenantId)))
      .returning();
    return rb;
  }

  // --- Waves ---
  async getWavesByProject(projectId: string, tenantId: string): Promise<MigrationWave[]> {
    return db
      .select()
      .from(migrationWaves)
      .where(and(eq(migrationWaves.projectId, projectId), eq(migrationWaves.tenantId, tenantId)))
      .orderBy(migrationWaves.phase, migrationWaves.waveOrder);
  }

  async getWave(id: string, tenantId: string): Promise<MigrationWave | undefined> {
    const [wave] = await db
      .select()
      .from(migrationWaves)
      .where(and(eq(migrationWaves.id, id), eq(migrationWaves.tenantId, tenantId)));
    return wave;
  }

  async createWave(data: InsertMigrationWave): Promise<MigrationWave> {
    const [wave] = await db.insert(migrationWaves).values(data).returning();
    return wave;
  }

  async updateWave(id: string, tenantId: string, data: Partial<MigrationWave>): Promise<MigrationWave | undefined> {
    const [wave] = await db
      .update(migrationWaves)
      .set({ ...data, updatedAt: new Date() })
      .where(and(eq(migrationWaves.id, id), eq(migrationWaves.tenantId, tenantId)))
      .returning();
    return wave;
  }

  async getWaveWorkloads(waveId: string, tenantId: string): Promise<WaveWorkload[]> {
    return db
      .select()
      .from(waveWorkloads)
      .where(and(eq(waveWorkloads.waveId, waveId), eq(waveWorkloads.tenantId, tenantId)))
      .orderBy(waveWorkloads.orderInWave);
  }

  async assignWorkloadsToWave(waveId: string, tenantId: string, workloadIds: string[]): Promise<WaveWorkload[]> {
    if (workloadIds.length === 0) return [];
    const insertData = workloadIds.map((workloadId, idx) => ({
      waveId,
      workloadId,
      tenantId,
      orderInWave: idx + 1,
    }));
    return db.insert(waveWorkloads).values(insertData).returning();
  }
}

export const storage = new DatabaseStorage();
