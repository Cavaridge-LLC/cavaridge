import { type User, type InsertUser, type MigrationPlan, type InsertMigrationPlan, users, migrationPlans } from "@shared/schema";
import { db } from "./db";
import { eq, desc } from "drizzle-orm";

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createMigrationPlan(plan: InsertMigrationPlan & { timelineEstimate: string; downtimeEstimate: string; complexity: string; riskLevel: string; steps: string[] }): Promise<MigrationPlan>;
  getMigrationPlan(id: string): Promise<MigrationPlan | undefined>;
  getAllMigrationPlans(): Promise<MigrationPlan[]>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async createMigrationPlan(plan: InsertMigrationPlan & { timelineEstimate: string; downtimeEstimate: string; complexity: string; riskLevel: string; steps: string[] }): Promise<MigrationPlan> {
    const [result] = await db.insert(migrationPlans).values(plan).returning();
    return result;
  }

  async getMigrationPlan(id: string): Promise<MigrationPlan | undefined> {
    const [plan] = await db.select().from(migrationPlans).where(eq(migrationPlans.id, id));
    return plan;
  }

  async getAllMigrationPlans(): Promise<MigrationPlan[]> {
    return db.select().from(migrationPlans).orderBy(desc(migrationPlans.createdAt));
  }
}

export const storage = new DatabaseStorage();