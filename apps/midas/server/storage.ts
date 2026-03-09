import { eq, asc } from "drizzle-orm";
import { db } from "./db";
import {
  clients, type Client, type InsertClient,
  initiatives, type Initiative, type InsertInitiative,
  meetings, type Meeting, type InsertMeeting,
  snapshots, type Snapshot, type InsertSnapshot,
} from "@shared/schema";

export interface IStorage {
  getClients(): Promise<Client[]>;
  getClient(id: string): Promise<Client | undefined>;
  createClient(data: InsertClient): Promise<Client>;

  getInitiatives(clientId: string): Promise<Initiative[]>;
  getInitiative(id: string): Promise<Initiative | undefined>;
  createInitiative(data: InsertInitiative): Promise<Initiative>;
  updateInitiative(id: string, data: Partial<InsertInitiative>): Promise<Initiative | undefined>;
  deleteInitiative(id: string): Promise<void>;

  getMeetings(clientId?: string): Promise<Meeting[]>;
  getMeeting(id: string): Promise<Meeting | undefined>;
  createMeeting(data: InsertMeeting): Promise<Meeting>;
  updateMeeting(id: string, data: Partial<InsertMeeting>): Promise<Meeting | undefined>;
  deleteMeeting(id: string): Promise<void>;

  getSnapshot(clientId: string): Promise<Snapshot | undefined>;
  upsertSnapshot(data: InsertSnapshot): Promise<Snapshot>;
}

export class DatabaseStorage implements IStorage {
  async getClients(): Promise<Client[]> {
    return db.select().from(clients).orderBy(asc(clients.name));
  }

  async getClient(id: string): Promise<Client | undefined> {
    const [row] = await db.select().from(clients).where(eq(clients.id, id));
    return row;
  }

  async createClient(data: InsertClient): Promise<Client> {
    const [row] = await db.insert(clients).values(data).returning();
    return row;
  }

  async getInitiatives(clientId: string): Promise<Initiative[]> {
    return db
      .select()
      .from(initiatives)
      .where(eq(initiatives.clientId, clientId))
      .orderBy(asc(initiatives.sortOrder));
  }

  async getInitiative(id: string): Promise<Initiative | undefined> {
    const [row] = await db.select().from(initiatives).where(eq(initiatives.id, id));
    return row;
  }

  async createInitiative(data: InsertInitiative): Promise<Initiative> {
    const [row] = await db.insert(initiatives).values(data).returning();
    return row;
  }

  async updateInitiative(id: string, data: Partial<InsertInitiative>): Promise<Initiative | undefined> {
    const [row] = await db.update(initiatives).set(data).where(eq(initiatives.id, id)).returning();
    return row;
  }

  async deleteInitiative(id: string): Promise<void> {
    await db.delete(initiatives).where(eq(initiatives.id, id));
  }

  async getMeetings(clientId?: string): Promise<Meeting[]> {
    if (clientId) {
      return db.select().from(meetings).where(eq(meetings.clientId, clientId)).orderBy(asc(meetings.createdAt));
    }
    return db.select().from(meetings).orderBy(asc(meetings.createdAt));
  }

  async getMeeting(id: string): Promise<Meeting | undefined> {
    const [row] = await db.select().from(meetings).where(eq(meetings.id, id));
    return row;
  }

  async createMeeting(data: InsertMeeting): Promise<Meeting> {
    const [row] = await db.insert(meetings).values(data).returning();
    return row;
  }

  async updateMeeting(id: string, data: Partial<InsertMeeting>): Promise<Meeting | undefined> {
    const [row] = await db.update(meetings).set(data).where(eq(meetings.id, id)).returning();
    return row;
  }

  async deleteMeeting(id: string): Promise<void> {
    await db.delete(meetings).where(eq(meetings.id, id));
  }

  async getSnapshot(clientId: string): Promise<Snapshot | undefined> {
    const [row] = await db.select().from(snapshots).where(eq(snapshots.clientId, clientId));
    return row;
  }

  async upsertSnapshot(data: InsertSnapshot): Promise<Snapshot> {
    const existing = await this.getSnapshot(data.clientId);
    if (existing) {
      const [row] = await db.update(snapshots).set(data).where(eq(snapshots.clientId, data.clientId)).returning();
      return row;
    }
    const [row] = await db.insert(snapshots).values(data).returning();
    return row;
  }
}

export const storage = new DatabaseStorage();
