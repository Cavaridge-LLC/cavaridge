/**
 * Caelum SoW CRUD Storage Layer
 * Spec: SOW-MASTER-SPEC-v2_2.md (2026-03-24, LOCKED)
 * Owner: Cavaridge, LLC (CVG-CAELUM)
 *
 * Provides tenant-scoped CRUD operations for standalone SoW documents,
 * version history (revisions), and template management.
 */

import { db } from "../../db";
import {
  sows, sowRevisions, sowTemplates,
  type Sow, type SowRevision, type SowTemplate,
} from "@shared/schema";
import { eq, desc, and, sql, max } from "drizzle-orm";
import type { SowDocumentV2 } from "../../../shared/models/sow";

// ---------------------------------------------------------------------------
// SoW CRUD
// ---------------------------------------------------------------------------

export interface ISowStorage {
  createSow(params: {
    tenantId: string;
    userId: string;
    title: string;
    sowDocument: SowDocumentV2;
    templateId?: number;
    conversationId?: number;
  }): Promise<Sow>;

  getSow(id: number, tenantId: string): Promise<Sow | undefined>;

  listSows(tenantId: string, opts?: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<Sow[]>;

  updateSow(id: number, tenantId: string, userId: string, updates: {
    title?: string;
    status?: string;
    sowDocument?: SowDocumentV2;
  }): Promise<Sow | undefined>;

  deleteSow(id: number, tenantId: string): Promise<boolean>;

  // Version history
  getRevisions(sowId: number, tenantId: string): Promise<SowRevision[]>;
  getRevision(revisionId: number, tenantId: string): Promise<SowRevision | undefined>;
}

export const sowStorage: ISowStorage = {
  async createSow({ tenantId, userId, title, sowDocument, templateId, conversationId }) {
    const [sow] = await db.insert(sows).values({
      tenantId,
      userId,
      title,
      sowDocument,
      templateId: templateId ?? null,
      conversationId: conversationId ?? null,
      currentVersion: 1,
      status: "draft",
    }).returning();

    // Create initial revision
    await db.insert(sowRevisions).values({
      sowId: sow.id,
      tenantId,
      version: 1,
      sowDocument,
      label: "Initial draft",
      changedBy: userId,
    });

    return sow;
  },

  async getSow(id, tenantId) {
    const [sow] = await db.select().from(sows)
      .where(and(eq(sows.id, id), eq(sows.tenantId, tenantId)));
    return sow;
  },

  async listSows(tenantId, opts = {}) {
    const { status, limit = 50, offset = 0 } = opts;
    const conditions = [eq(sows.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(sows.status, status));
    }
    return db.select().from(sows)
      .where(and(...conditions))
      .orderBy(desc(sows.updatedAt))
      .limit(limit)
      .offset(offset);
  },

  async updateSow(id, tenantId, userId, updates) {
    // Fetch current sow to get version
    const [current] = await db.select().from(sows)
      .where(and(eq(sows.id, id), eq(sows.tenantId, tenantId)));
    if (!current) return undefined;

    const newVersion = current.currentVersion + (updates.sowDocument ? 1 : 0);

    const setValues: Record<string, unknown> = {
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };
    if (updates.title !== undefined) setValues.title = updates.title;
    if (updates.status !== undefined) setValues.status = updates.status;
    if (updates.sowDocument !== undefined) {
      setValues.sowDocument = updates.sowDocument;
      setValues.currentVersion = newVersion;
    }

    const [updated] = await db.update(sows)
      .set(setValues)
      .where(and(eq(sows.id, id), eq(sows.tenantId, tenantId)))
      .returning();

    // Create revision if document changed
    if (updates.sowDocument) {
      await db.insert(sowRevisions).values({
        sowId: id,
        tenantId,
        version: newVersion,
        sowDocument: updates.sowDocument,
        label: `Version ${newVersion}`,
        changedBy: userId,
      });
    }

    return updated;
  },

  async deleteSow(id, tenantId) {
    // Cascade deletes revisions via FK
    const result = await db.delete(sows)
      .where(and(eq(sows.id, id), eq(sows.tenantId, tenantId)));
    return true;
  },

  async getRevisions(sowId, tenantId) {
    return db.select().from(sowRevisions)
      .where(and(eq(sowRevisions.sowId, sowId), eq(sowRevisions.tenantId, tenantId)))
      .orderBy(desc(sowRevisions.version));
  },

  async getRevision(revisionId, tenantId) {
    const [revision] = await db.select().from(sowRevisions)
      .where(and(eq(sowRevisions.id, revisionId), eq(sowRevisions.tenantId, tenantId)));
    return revision;
  },
};

// ---------------------------------------------------------------------------
// Template CRUD
// ---------------------------------------------------------------------------

export interface ISowTemplateStorage {
  createTemplate(params: {
    tenantId: string;
    name: string;
    description?: string;
    projectType: string;
    sowDocument: Partial<SowDocumentV2>;
    createdBy: string;
  }): Promise<SowTemplate>;

  getTemplate(id: number, tenantId: string): Promise<SowTemplate | undefined>;

  listTemplates(tenantId: string, opts?: {
    projectType?: string;
    activeOnly?: boolean;
  }): Promise<SowTemplate[]>;

  updateTemplate(id: number, tenantId: string, updates: {
    name?: string;
    description?: string;
    projectType?: string;
    sowDocument?: Partial<SowDocumentV2>;
    isActive?: boolean;
  }): Promise<SowTemplate | undefined>;

  deleteTemplate(id: number, tenantId: string): Promise<boolean>;
}

export const sowTemplateStorage: ISowTemplateStorage = {
  async createTemplate({ tenantId, name, description, projectType, sowDocument, createdBy }) {
    const [template] = await db.insert(sowTemplates).values({
      tenantId,
      name,
      description: description ?? null,
      projectType,
      sowDocument,
      createdBy,
    }).returning();
    return template;
  },

  async getTemplate(id, tenantId) {
    const [template] = await db.select().from(sowTemplates)
      .where(and(eq(sowTemplates.id, id), eq(sowTemplates.tenantId, tenantId)));
    return template;
  },

  async listTemplates(tenantId, opts = {}) {
    const { projectType, activeOnly = true } = opts;
    const conditions = [eq(sowTemplates.tenantId, tenantId)];
    if (activeOnly) {
      conditions.push(eq(sowTemplates.isActive, true));
    }
    if (projectType) {
      conditions.push(eq(sowTemplates.projectType, projectType));
    }
    return db.select().from(sowTemplates)
      .where(and(...conditions))
      .orderBy(desc(sowTemplates.updatedAt));
  },

  async updateTemplate(id, tenantId, updates) {
    const setValues: Record<string, unknown> = {
      updatedAt: sql`CURRENT_TIMESTAMP`,
    };
    if (updates.name !== undefined) setValues.name = updates.name;
    if (updates.description !== undefined) setValues.description = updates.description;
    if (updates.projectType !== undefined) setValues.projectType = updates.projectType;
    if (updates.sowDocument !== undefined) setValues.sowDocument = updates.sowDocument;
    if (updates.isActive !== undefined) setValues.isActive = updates.isActive;

    const [updated] = await db.update(sowTemplates)
      .set(setValues)
      .where(and(eq(sowTemplates.id, id), eq(sowTemplates.tenantId, tenantId)))
      .returning();
    return updated;
  },

  async deleteTemplate(id, tenantId) {
    await db.delete(sowTemplates)
      .where(and(eq(sowTemplates.id, id), eq(sowTemplates.tenantId, tenantId)));
    return true;
  },
};
