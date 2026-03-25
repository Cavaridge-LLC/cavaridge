/**
 * CVG-BRAIN — Database Schema (Drizzle ORM)
 *
 * Tables: source_recordings (captures), knowledge_objects, entity_mentions,
 * relationships, connector_configs
 * All tables include tenant_id for Supabase RLS isolation.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  integer,
  boolean,
  jsonb,
  real,
  index,
  pgEnum,
  varchar,
  vector,
} from "drizzle-orm/pg-core";

// ── Enums ─────────────────────────────────────────────────────────────

export const recordingStatusEnum = pgEnum("brain_recording_status", [
  "recording",
  "transcribing",
  "processing",
  "completed",
  "failed",
]);

export const knowledgeTypeEnum = pgEnum("brain_knowledge_type", [
  "fact",
  "decision",
  "action_item",
  "question",
  "insight",
  "meeting_note",
  "reference",
]);

export const entityTypeEnum = pgEnum("brain_entity_type", [
  "person",
  "organization",
  "system",
  "process",
  "decision",
  "action_item",
  "project",
  "technology",
  "location",
  "date",
  "monetary_value",
  "document",
  "concept",
]);

export const relationshipTypeEnum = pgEnum("brain_relationship_type", [
  "owns",
  "manages",
  "connects_to",
  "depends_on",
  "decided_by",
  "mentioned_in",
  "related_to",
  "assigned_to",
  "part_of",
  "follows",
  "contradicts",
  "supersedes",
]);

export const captureSourceEnum = pgEnum("brain_capture_source", [
  "microphone",
  "upload",
  "email",
  "calendar",
  "notes",
  "connector",
  "api",
]);

export const connectorStatusEnum = pgEnum("brain_connector_status", [
  "active",
  "inactive",
  "error",
  "configuring",
]);

// ── Source Recordings (Captures) ─────────────────────────────────────

export const sourceRecordings = pgTable(
  "brain_source_recordings",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id").notNull(),
    title: text("title"),
    transcript: text("transcript"),
    rawAudioUrl: text("raw_audio_url"),
    durationSeconds: integer("duration_seconds"),
    sourceType: captureSourceEnum("source_type").notNull().default("microphone"),
    status: recordingStatusEnum("status").notNull().default("recording"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("brain_recordings_tenant_idx").on(t.tenantId),
    index("brain_recordings_user_idx").on(t.tenantId, t.userId),
    index("brain_recordings_status_idx").on(t.tenantId, t.status),
    index("brain_recordings_created_idx").on(t.tenantId, t.createdAt),
  ],
);

// ── Knowledge Objects ─────────────────────────────────────────────────

export const knowledgeObjects = pgTable(
  "brain_knowledge_objects",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    userId: uuid("user_id").notNull(),
    recordingId: uuid("recording_id").references(() => sourceRecordings.id, { onDelete: "set null" }),
    type: knowledgeTypeEnum("type").notNull(),
    content: text("content").notNull(),
    summary: text("summary"),
    confidence: real("confidence").notNull().default(0.8),
    tags: jsonb("tags").$type<string[]>().default([]),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    dueDate: timestamp("due_date", { withTimezone: true }),
    isResolved: boolean("is_resolved").default(false),
    resolvedAt: timestamp("resolved_at", { withTimezone: true }),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("brain_knowledge_tenant_idx").on(t.tenantId),
    index("brain_knowledge_type_idx").on(t.tenantId, t.type),
    index("brain_knowledge_user_idx").on(t.tenantId, t.userId),
    index("brain_knowledge_recording_idx").on(t.recordingId),
    index("brain_knowledge_created_idx").on(t.tenantId, t.createdAt),
    index("brain_knowledge_tags_idx").on(t.tenantId, t.tags),
  ],
);

// ── Entity Mentions ───────────────────────────────────────────────────

export const entityMentions = pgTable(
  "brain_entity_mentions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    name: text("name").notNull(),
    normalizedName: text("normalized_name").notNull(),
    type: entityTypeEnum("type").notNull(),
    knowledgeObjectId: uuid("knowledge_object_id")
      .references(() => knowledgeObjects.id, { onDelete: "cascade" })
      .notNull(),
    recordingId: uuid("recording_id").references(() => sourceRecordings.id, { onDelete: "set null" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    embedding: vector("embedding", { dimensions: 1536 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("brain_entities_tenant_idx").on(t.tenantId),
    index("brain_entities_name_idx").on(t.tenantId, t.normalizedName),
    index("brain_entities_type_idx").on(t.tenantId, t.type),
    index("brain_entities_knowledge_idx").on(t.knowledgeObjectId),
  ],
);

// ── Relationships ─────────────────────────────────────────────────────

export const relationships = pgTable(
  "brain_relationships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    sourceEntityId: uuid("source_entity_id")
      .references(() => entityMentions.id, { onDelete: "cascade" })
      .notNull(),
    targetEntityId: uuid("target_entity_id")
      .references(() => entityMentions.id, { onDelete: "cascade" })
      .notNull(),
    type: relationshipTypeEnum("type").notNull(),
    weight: real("weight").notNull().default(1.0),
    knowledgeObjectId: uuid("knowledge_object_id")
      .references(() => knowledgeObjects.id, { onDelete: "cascade" }),
    metadata: jsonb("metadata").$type<Record<string, unknown>>().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("brain_rel_tenant_idx").on(t.tenantId),
    index("brain_rel_source_idx").on(t.sourceEntityId),
    index("brain_rel_target_idx").on(t.targetEntityId),
    index("brain_rel_type_idx").on(t.tenantId, t.type),
  ],
);

// ── Connector Configs ─────────────────────────────────────────────────

export const connectorConfigs = pgTable(
  "brain_connector_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    tenantId: uuid("tenant_id").notNull(),
    connectorId: varchar("connector_id", { length: 100 }).notNull(),
    name: text("name").notNull(),
    status: connectorStatusEnum("status").notNull().default("configuring"),
    credentials: jsonb("credentials").$type<Record<string, string>>().default({}),
    settings: jsonb("settings").$type<Record<string, unknown>>().default({}),
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    lastError: text("last_error"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("brain_connector_tenant_idx").on(t.tenantId),
    index("brain_connector_id_idx").on(t.tenantId, t.connectorId),
  ],
);

// ── Inferred Types ────────────────────────────────────────────────────

export type SourceRecording = typeof sourceRecordings.$inferSelect;
export type NewSourceRecording = typeof sourceRecordings.$inferInsert;
export type KnowledgeObject = typeof knowledgeObjects.$inferSelect;
export type NewKnowledgeObject = typeof knowledgeObjects.$inferInsert;
export type EntityMention = typeof entityMentions.$inferSelect;
export type NewEntityMention = typeof entityMentions.$inferInsert;
export type Relationship = typeof relationships.$inferSelect;
export type NewRelationship = typeof relationships.$inferInsert;
export type ConnectorConfig = typeof connectorConfigs.$inferSelect;
export type NewConnectorConfig = typeof connectorConfigs.$inferInsert;

// ── RLS Policies (applied via migration SQL) ──────────────────────────
// These are defined here for documentation; actual RLS is in the migration.

export const RLS_POLICIES = {
  sourceRecordings: "tenant_id = auth.jwt() ->> 'tenant_id'",
  knowledgeObjects: "tenant_id = auth.jwt() ->> 'tenant_id'",
  entityMentions: "tenant_id = auth.jwt() ->> 'tenant_id'",
  relationships: "tenant_id = auth.jwt() ->> 'tenant_id'",
  connectorConfigs: "tenant_id = auth.jwt() ->> 'tenant_id'",
} as const;
