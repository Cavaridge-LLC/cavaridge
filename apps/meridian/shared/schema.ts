import { sql } from "drizzle-orm";
import { pgSchema, text, varchar, uuid, integer, decimal, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Shared platform tables from @cavaridge/auth
import { tenants as _tenants, profiles as _profiles } from "@cavaridge/auth/schema";
import type { Tenant as _Tenant, NewTenant as _NewTenant, Profile as _Profile, NewProfile as _NewProfile } from "@cavaridge/auth/schema";
export const tenants = _tenants;
export const profiles = _profiles;
export const users = _profiles;
export type Tenant = _Tenant;
export type InsertTenant = _NewTenant;
/** @deprecated Use `Tenant` */
export type Organization = _Tenant;
/** @deprecated Use `InsertTenant` */
export type InsertOrganization = _NewTenant;
export type User = _Profile;
export type InsertUser = _NewProfile;

// App-specific schema
export const meridianSchema = pgSchema("meridian");

export const deals = meridianSchema.table("deals", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  dealCode: text("deal_code").notNull().unique(),
  targetName: text("target_name").notNull(),
  industry: text("industry").notNull(),
  stage: text("stage").notNull(),
  status: text("status").notNull().default("on-track"),
  facilityCount: integer("facility_count").default(0),
  userCount: integer("user_count").default(0),
  estimatedIntegrationCost: text("estimated_integration_cost"),
  compositeScore: decimal("composite_score", { precision: 5, scale: 1 }),
  overallConfidence: text("overall_confidence").default("insufficient"),
  documentsUploaded: integer("documents_uploaded").default(0),
  documentsAnalyzed: integer("documents_analyzed").default(0),
  lifecycleStage: varchar("lifecycle_stage", { length: 50 }).default("assessment"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const dealAccess = meridianSchema.table("deal_access", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  accessLevel: text("access_level").notNull().default("contributor"),
  grantedBy: varchar("granted_by", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("deal_access_deal_user_idx").on(table.dealId, table.userId),
]);

export const invitations = meridianSchema.table("invitations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  email: text("email").notNull(),
  role: text("role").notNull().default("viewer"),
  invitedBy: varchar("invited_by", { length: 36 }).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLog = meridianSchema.table("audit_log", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id", { length: 36 }).notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: varchar("resource_id", { length: 36 }),
  detailsJson: jsonb("details_json").default({}),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pillars = meridianSchema.table("pillars", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  pillarName: text("pillar_name").notNull(),
  score: decimal("score", { precision: 3, scale: 1 }),
  weight: decimal("weight", { precision: 3, scale: 2 }),
  findingCount: integer("finding_count").default(0),
  evidenceConfidence: decimal("evidence_confidence", { precision: 3, scale: 2 }).default("0.00"),
  confidenceLabel: text("confidence_label").default("insufficient"),
  documentCount: integer("document_count").default(0),
  scoreCap: decimal("score_cap", { precision: 3, scale: 1 }).default("3.0"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const findings = meridianSchema.table("findings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  pillarId: varchar("pillar_id", { length: 36 }).references(() => pillars.id),
  severity: text("severity").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  impactEstimate: text("impact_estimate"),
  remediationNotes: text("remediation_notes"),
  sourceDocuments: text("source_documents").array(),
  sourceCount: integer("source_count").default(0),
  sourceDocumentId: varchar("source_document_id", { length: 36 }),
  status: text("status").notNull().default("open"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documents = meridianSchema.table("documents", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  filename: text("filename").notNull(),
  originalFilename: text("original_filename"),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  classification: text("classification"),
  objectPath: text("object_path"),
  uploadStatus: text("upload_status").notNull().default("uploaded"),
  pageCount: integer("page_count"),
  uploadedBy: varchar("uploaded_by", { length: 36 }),
  extractedText: text("extracted_text"),
  textLength: integer("text_length"),
  folderPath: text("folder_path"),
  parentArchiveId: varchar("parent_archive_id", { length: 36 }),
  contentHash: text("content_hash"),
  extractionStatus: text("extraction_status").notNull().default("pending"),
  extractionError: text("extraction_error"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentChunks = meridianSchema.table("document_chunks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id", { length: 36 }).references(() => documents.id),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  chunkIndex: integer("chunk_index").notNull(),
  chunkText: text("chunk_text").notNull(),
  chunkTokens: integer("chunk_tokens"),
  searchTokens: text("search_tokens"),
  metadataJson: jsonb("metadata_json"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const baselineProfiles = meridianSchema.table("baseline_profiles", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  name: text("name").notNull(),
  profileData: jsonb("profile_data"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const techStackItems = meridianSchema.table("tech_stack_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  category: text("category").notNull(),
  itemName: text("item_name").notNull(),
  version: text("version"),
  status: text("status").default("unknown"),
  notes: text("notes"),
  confidence: text("confidence").default("medium"),
  sourceDocumentId: varchar("source_document_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const baselineComparisons = meridianSchema.table("baseline_comparisons", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  standardName: text("standard_name").notNull(),
  currentState: text("current_state").notNull(),
  gapSeverity: text("gap_severity").notNull(),
  priority: text("priority").default("recommended"),
  remediationNote: text("remediation_note"),
  estimatedCost: text("estimated_cost"),
  sourceDocumentId: varchar("source_document_id", { length: 36 }),
});

export const topologyNodes = meridianSchema.table("topology_nodes", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  nodeType: text("node_type").notNull(),
  label: text("label").notNull(),
  sublabel: text("sublabel"),
  status: text("status").default("unknown"),
  parentNodeId: varchar("parent_node_id", { length: 36 }),
  positionX: integer("position_x").default(0),
  positionY: integer("position_y").default(0),
  metadataJson: jsonb("metadata_json"),
  sourceDocumentId: varchar("source_document_id", { length: 36 }),
  createdAt: timestamp("created_at").defaultNow(),
});

export const topologyConnections = meridianSchema.table("topology_connections", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  fromNodeId: varchar("from_node_id", { length: 36 }),
  toNodeId: varchar("to_node_id", { length: 36 }),
  connectionType: text("connection_type").notNull(),
  label: text("label"),
  bandwidth: text("bandwidth"),
  status: text("status").default("healthy"),
});

export const playbookPhases = meridianSchema.table("playbook_phases", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  phaseName: text("phase_name").notNull(),
  timeRange: text("time_range").notNull(),
  status: text("status").notNull().default("pending"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const playbookTasks = meridianSchema.table("playbook_tasks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  phaseId: varchar("phase_id", { length: 36 }).references(() => playbookPhases.id),
  taskName: text("task_name").notNull(),
  isCriticalPath: boolean("is_critical_path").default(false),
  status: text("status").notNull().default("pending"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const scoreSnapshots = meridianSchema.table("score_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  score: decimal("score", { precision: 5, scale: 1 }).notNull(),
  recordedAt: timestamp("recorded_at").notNull(),
});

export const processingQueue = meridianSchema.table("processing_queue", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  documentId: varchar("document_id", { length: 36 }).references(() => documents.id),
  step: text("step").notNull(),
  status: text("status").notNull().default("queued"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const usageTracking = meridianSchema.table("usage_tracking", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  metric: text("metric").notNull(),
  period: text("period").notNull(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("usage_tracking_tenant_metric_period_idx").on(table.tenantId, table.metric, table.period),
]);

export const platformSettings = meridianSchema.table("platform_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: jsonb("setting_value"),
  updatedBy: varchar("updated_by", { length: 36 }),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accountRequests = meridianSchema.table("account_requests", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  companyName: text("company_name").notNull(),
  contactName: text("contact_name").notNull(),
  contactEmail: text("contact_email").notNull(),
  contactPhone: text("contact_phone"),
  industry: text("industry"),
  estimatedDealsPerYear: integer("estimated_deals_per_year"),
  estimatedUsers: integer("estimated_users"),
  message: text("message"),
  status: text("status").notNull().default("pending"),
  reviewedBy: varchar("reviewed_by", { length: 36 }),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  tenantId: uuid("tenant_id").references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentClassifications = meridianSchema.table("document_classifications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id", { length: 36 }).notNull().references(() => documents.id),
  dealId: varchar("deal_id", { length: 36 }).notNull().references(() => deals.id),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  documentType: text("document_type").notNull().default("unknown"),
  pillarInfrastructure: boolean("pillar_infrastructure").default(false),
  pillarSecurity: boolean("pillar_security").default(false),
  pillarOperations: boolean("pillar_operations").default(false),
  pillarCompliance: boolean("pillar_compliance").default(false),
  pillarScalability: boolean("pillar_scalability").default(false),
  pillarStrategy: boolean("pillar_strategy").default(false),
  confidence: decimal("confidence", { precision: 3, scale: 2 }).default("0.00"),
  classificationReasoning: text("classification_reasoning"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertDealSchema = createInsertSchema(deals).omit({ id: true, createdAt: true, updatedAt: true });
export const insertDealAccessSchema = createInsertSchema(dealAccess).omit({ id: true, createdAt: true });
export const insertInvitationSchema = createInsertSchema(invitations).omit({ id: true, createdAt: true });
export const insertAuditLogSchema = createInsertSchema(auditLog).omit({ id: true, createdAt: true });
export const insertPillarSchema = createInsertSchema(pillars).omit({ id: true, updatedAt: true });
export const insertFindingSchema = createInsertSchema(findings).omit({ id: true, createdAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });
export const insertDocumentChunkSchema = createInsertSchema(documentChunks).omit({ id: true, createdAt: true });
export const insertBaselineProfileSchema = createInsertSchema(baselineProfiles).omit({ id: true, createdAt: true });
export const insertTechStackItemSchema = createInsertSchema(techStackItems).omit({ id: true, createdAt: true, updatedAt: true });
export const insertBaselineComparisonSchema = createInsertSchema(baselineComparisons).omit({ id: true });
export const insertTopologyNodeSchema = createInsertSchema(topologyNodes).omit({ id: true, createdAt: true });
export const insertTopologyConnectionSchema = createInsertSchema(topologyConnections).omit({ id: true });
export const insertPlaybookPhaseSchema = createInsertSchema(playbookPhases).omit({ id: true });
export const insertPlaybookTaskSchema = createInsertSchema(playbookTasks).omit({ id: true });
export const insertScoreSnapshotSchema = createInsertSchema(scoreSnapshots).omit({ id: true });
export const insertProcessingQueueSchema = createInsertSchema(processingQueue).omit({ id: true, createdAt: true });
export const insertUsageTrackingSchema = createInsertSchema(usageTracking).omit({ id: true, updatedAt: true });
export const insertPlatformSettingSchema = createInsertSchema(platformSettings).omit({ id: true, updatedAt: true });
export const insertAccountRequestSchema = createInsertSchema(accountRequests).omit({ id: true, createdAt: true });
export const insertDocumentClassificationSchema = createInsertSchema(documentClassifications).omit({ id: true, createdAt: true, updatedAt: true });

export const qaConversations = meridianSchema.table("qa_conversations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).notNull().references(() => deals.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  userId: varchar("user_id", { length: 36 }).notNull(),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const qaMessages = meridianSchema.table("qa_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id", { length: 36 }).notNull().references(() => qaConversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  citations: jsonb("citations").default([]),
  similarQuestionIds: jsonb("similar_question_ids").default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const qaSavedAnswers = meridianSchema.table("qa_saved_answers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).notNull().references(() => deals.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  citations: jsonb("citations").default([]),
  savedBy: varchar("saved_by", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQaConversationSchema = createInsertSchema(qaConversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQaMessageSchema = createInsertSchema(qaMessages).omit({ id: true, createdAt: true });
export const insertQaSavedAnswerSchema = createInsertSchema(qaSavedAnswers).omit({ id: true, createdAt: true });

export const organizationBranding = meridianSchema.table("organization_branding", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().unique().references(() => tenants.id),
  companyName: varchar("company_name", { length: 255 }),
  logoUrl: text("logo_url"),
  logoWidthPx: integer("logo_width_px").default(200),
  primaryColor: varchar("primary_color", { length: 7 }).default("#1a56db"),
  secondaryColor: varchar("secondary_color", { length: 7 }).default("#6b7280"),
  accentColor: varchar("accent_color", { length: 7 }).default("#059669"),
  reportHeaderText: varchar("report_header_text", { length: 255 }),
  reportFooterText: varchar("report_footer_text", { length: 255 }),
  confidentialityNotice: text("confidentiality_notice").default("CONFIDENTIAL — For intended recipients only."),
  contactName: varchar("contact_name", { length: 255 }),
  contactEmail: varchar("contact_email", { length: 255 }),
  contactPhone: varchar("contact_phone", { length: 50 }),
  website: varchar("website", { length: 255 }),
  showMeridianBadge: boolean("show_meridian_badge").default(true),
  customCoverPage: boolean("custom_cover_page").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertOrganizationBrandingSchema = createInsertSchema(organizationBranding).omit({ id: true, createdAt: true, updatedAt: true });

export const findingCrossReferences = meridianSchema.table("finding_cross_references", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  findingId: varchar("finding_id", { length: 36 }).notNull().references(() => findings.id, { onDelete: "cascade" }),
  similarFindingId: varchar("similar_finding_id", { length: 36 }).notNull().references(() => findings.id, { onDelete: "cascade" }),
  similarityScore: decimal("similarity_score", { precision: 3, scale: 2 }).notNull(),
  dealId: varchar("deal_id", { length: 36 }).notNull(),
  similarDealId: varchar("similar_deal_id", { length: 36 }).notNull(),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFindingCrossReferenceSchema = createInsertSchema(findingCrossReferences).omit({ id: true, createdAt: true });

export type InsertDeal = z.infer<typeof insertDealSchema>;
export type InsertDealAccess = z.infer<typeof insertDealAccessSchema>;
export type InsertInvitation = z.infer<typeof insertInvitationSchema>;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
export type InsertPillar = z.infer<typeof insertPillarSchema>;
export type InsertFinding = z.infer<typeof insertFindingSchema>;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type InsertDocumentChunk = z.infer<typeof insertDocumentChunkSchema>;
export type InsertBaselineProfile = z.infer<typeof insertBaselineProfileSchema>;
export type InsertTechStackItem = z.infer<typeof insertTechStackItemSchema>;
export type InsertBaselineComparison = z.infer<typeof insertBaselineComparisonSchema>;
export type InsertTopologyNode = z.infer<typeof insertTopologyNodeSchema>;
export type InsertTopologyConnection = z.infer<typeof insertTopologyConnectionSchema>;
export type InsertPlaybookPhase = z.infer<typeof insertPlaybookPhaseSchema>;
export type InsertPlaybookTask = z.infer<typeof insertPlaybookTaskSchema>;
export type InsertScoreSnapshot = z.infer<typeof insertScoreSnapshotSchema>;
export type InsertProcessingQueueItem = z.infer<typeof insertProcessingQueueSchema>;
export type InsertUsageTracking = z.infer<typeof insertUsageTrackingSchema>;
export type InsertPlatformSetting = z.infer<typeof insertPlatformSettingSchema>;
export type InsertAccountRequest = z.infer<typeof insertAccountRequestSchema>;

export type Deal = typeof deals.$inferSelect;
export type DealAccess = typeof dealAccess.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
export type AuditLogEntry = typeof auditLog.$inferSelect;
export type Pillar = typeof pillars.$inferSelect;
export type Finding = typeof findings.$inferSelect;
export type Document = typeof documents.$inferSelect;
export type DocumentChunk = typeof documentChunks.$inferSelect;
export type BaselineProfile = typeof baselineProfiles.$inferSelect;
export type TechStackItem = typeof techStackItems.$inferSelect;
export type BaselineComparison = typeof baselineComparisons.$inferSelect;
export type TopologyNode = typeof topologyNodes.$inferSelect;
export type TopologyConnection = typeof topologyConnections.$inferSelect;
export type PlaybookPhase = typeof playbookPhases.$inferSelect;
export type PlaybookTask = typeof playbookTasks.$inferSelect;
export type ScoreSnapshot = typeof scoreSnapshots.$inferSelect;
export type ProcessingQueueItem = typeof processingQueue.$inferSelect;
export type UsageTrackingEntry = typeof usageTracking.$inferSelect;
export type PlatformSetting = typeof platformSettings.$inferSelect;
export type AccountRequest = typeof accountRequests.$inferSelect;
export type DocumentClassification = typeof documentClassifications.$inferSelect;
export type QaConversation = typeof qaConversations.$inferSelect;
export type QaMessage = typeof qaMessages.$inferSelect;
export type QaSavedAnswer = typeof qaSavedAnswers.$inferSelect;

export type InsertDocumentClassification = z.infer<typeof insertDocumentClassificationSchema>;
export type InsertQaConversation = z.infer<typeof insertQaConversationSchema>;
export type InsertQaMessage = z.infer<typeof insertQaMessageSchema>;
export type InsertQaSavedAnswer = z.infer<typeof insertQaSavedAnswerSchema>;
export type OrganizationBranding = typeof organizationBranding.$inferSelect;
export type InsertOrganizationBranding = z.infer<typeof insertOrganizationBrandingSchema>;
export type FindingCrossReference = typeof findingCrossReferences.$inferSelect;
export type InsertFindingCrossReference = z.infer<typeof insertFindingCrossReferenceSchema>;

export const pillarTemplates = meridianSchema.table("pillar_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  weight: decimal("weight", { precision: 4, scale: 3 }).notNull().default("0.167"),
  isDefault: boolean("is_default").default(true),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPillarTemplateSchema = createInsertSchema(pillarTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type PillarTemplate = typeof pillarTemplates.$inferSelect;
export type InsertPillarTemplate = z.infer<typeof insertPillarTemplateSchema>;

export const techCategories = meridianSchema.table("tech_categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  displayOrder: integer("display_order").default(0),
  isDefault: boolean("is_default").default(true),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTechCategorySchema = createInsertSchema(techCategories).omit({ id: true, createdAt: true, updatedAt: true });
export type TechCategory = typeof techCategories.$inferSelect;
export type InsertTechCategory = z.infer<typeof insertTechCategorySchema>;

export const passwordResetTokens = meridianSchema.table("password_reset_tokens", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

export type UserRole = "platform_admin" | "msp_admin" | "msp_tech" | "client_admin" | "client_viewer" | "prospect";
export type AccessLevel = "lead" | "contributor" | "reviewer" | "observer";
export type AuditAction = "login" | "deal_created" | "deal_updated" | "finding_added" | "document_uploaded" | "document_downloaded" | "document_deleted" | "user_invited" | "user_removed" | "role_changed" | "settings_changed" | "chat_query" | "report_exported" | "org_created" | "request_approved" | "request_rejected" | "platform_settings_changed";

export { isPlatformRole } from "@cavaridge/auth";

// ── IT Due Diligence Assessment Framework ─────────────────────────────
// 12-section assessment model with evidence tagging, risk classification,
// and structured evidence capture per CLAUDE.md CVG-MER spec.

export type EvidenceTag = "OBSERVED" | "REPRESENTED" | "UNVERIFIED";
export type RiskSeverity = "critical" | "high" | "medium" | "low";
export type RiskLikelihood = "almost_certain" | "likely" | "possible" | "unlikely" | "rare";
export type AssessmentStatus = "draft" | "in_progress" | "review" | "complete" | "archived";

/**
 * 12-section IT due diligence assessment order.
 * Each assessment for an M&A deal follows this standard framework.
 */
export const ASSESSMENT_SECTIONS = [
  { id: "executive_summary", order: 1, name: "Executive Summary" },
  { id: "infrastructure_architecture", order: 2, name: "Infrastructure & Architecture" },
  { id: "cybersecurity_posture", order: 3, name: "Cybersecurity Posture" },
  { id: "application_landscape", order: 4, name: "Application Landscape" },
  { id: "data_governance", order: 5, name: "Data Assets & Governance" },
  { id: "cloud_services", order: 6, name: "Cloud Services & SaaS" },
  { id: "it_operations", order: 7, name: "IT Operations & Support" },
  { id: "compliance_regulatory", order: 8, name: "Compliance & Regulatory" },
  { id: "technology_talent", order: 9, name: "Technology Organization & Talent" },
  { id: "integration_complexity", order: 10, name: "Integration Complexity" },
  { id: "capex_projections", order: 11, name: "CapEx Projections & Cost Analysis" },
  { id: "risk_summary", order: 12, name: "Risk Summary & Recommendations" },
] as const;

export type AssessmentSectionId = typeof ASSESSMENT_SECTIONS[number]["id"];

// ── Assessments table ─────────────────────────────────────────────────

export const assessments = meridianSchema.table("assessments", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: uuid("tenant_id").notNull().references(() => tenants.id),
  dealId: varchar("deal_id", { length: 36 }).notNull().references(() => deals.id),
  title: text("title").notNull(),
  status: text("status").notNull().default("draft"),
  assessmentType: text("assessment_type").notNull().default("full"),
  assignedTo: varchar("assigned_to", { length: 36 }),
  targetTenantId: uuid("target_tenant_id"),
  overallRiskRating: text("overall_risk_rating"),
  completedSections: integer("completed_sections").default(0),
  totalSections: integer("total_sections").default(12),
  notes: text("notes"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAssessmentSchema = createInsertSchema(assessments).omit({ id: true, createdAt: true, updatedAt: true });
export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;

// ── Assessment Sections table ─────────────────────────────────────────

export const assessmentSections = meridianSchema.table("assessment_sections", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id", { length: 36 }).notNull().references(() => assessments.id, { onDelete: "cascade" }),
  sectionKey: text("section_key").notNull(),
  sectionName: text("section_name").notNull(),
  sectionOrder: integer("section_order").notNull(),
  status: text("status").notNull().default("not_started"),
  narrativeContent: text("narrative_content"),
  summaryNotes: text("summary_notes"),
  evidenceTag: text("evidence_tag").default("UNVERIFIED"),
  riskLevel: text("risk_level"),
  completedBy: varchar("completed_by", { length: 36 }),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertAssessmentSectionSchema = createInsertSchema(assessmentSections).omit({ id: true, createdAt: true, updatedAt: true });
export type AssessmentSection = typeof assessmentSections.$inferSelect;
export type InsertAssessmentSection = z.infer<typeof insertAssessmentSectionSchema>;

// ── Evidence Items table ──────────────────────────────────────────────

export const evidenceItems = meridianSchema.table("evidence_items", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id", { length: 36 }).notNull().references(() => assessments.id, { onDelete: "cascade" }),
  sectionId: varchar("section_id", { length: 36 }).notNull().references(() => assessmentSections.id, { onDelete: "cascade" }),
  evidenceType: text("evidence_type").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  evidenceTag: text("evidence_tag").notNull().default("UNVERIFIED"),
  sourceType: text("source_type"),
  sourceReference: text("source_reference"),
  attachmentDocumentId: varchar("attachment_document_id", { length: 36 }),
  attachmentFilename: text("attachment_filename"),
  attachmentMimeType: text("attachment_mime_type"),
  attachmentSize: integer("attachment_size"),
  interviewSubject: text("interview_subject"),
  interviewDate: timestamp("interview_date"),
  interviewNotes: text("interview_notes"),
  screenshotUrl: text("screenshot_url"),
  metadataJson: jsonb("metadata_json"),
  collectedBy: varchar("collected_by", { length: 36 }),
  collectedAt: timestamp("collected_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertEvidenceItemSchema = createInsertSchema(evidenceItems).omit({ id: true, createdAt: true, updatedAt: true });
export type EvidenceItem = typeof evidenceItems.$inferSelect;
export type InsertEvidenceItem = z.infer<typeof insertEvidenceItemSchema>;

// ── Risk Matrix Entries table ─────────────────────────────────────────

export const riskMatrixEntries = meridianSchema.table("risk_matrix_entries", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id", { length: 36 }).notNull().references(() => assessments.id, { onDelete: "cascade" }),
  sectionId: varchar("section_id", { length: 36 }).references(() => assessmentSections.id, { onDelete: "set null" }),
  findingId: varchar("finding_id", { length: 36 }).references(() => findings.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  severity: text("severity").notNull(),
  likelihood: text("likelihood").notNull(),
  riskScore: integer("risk_score").notNull(),
  capexEstimateLow: integer("capex_estimate_low"),
  capexEstimateHigh: integer("capex_estimate_high"),
  remediationPlan: text("remediation_plan"),
  remediationTimeline: text("remediation_timeline"),
  owner: text("owner"),
  status: text("status").notNull().default("open"),
  evidenceTag: text("evidence_tag").default("UNVERIFIED"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertRiskMatrixEntrySchema = createInsertSchema(riskMatrixEntries).omit({ id: true, createdAt: true, updatedAt: true });
export type RiskMatrixEntry = typeof riskMatrixEntries.$inferSelect;
export type InsertRiskMatrixEntry = z.infer<typeof insertRiskMatrixEntrySchema>;

// ── Tenant Intel Snapshots (M&A target environment data) ──────────────

export const assessmentTenantData = meridianSchema.table("assessment_tenant_data", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  assessmentId: varchar("assessment_id", { length: 36 }).notNull().references(() => assessments.id, { onDelete: "cascade" }),
  tenantId: uuid("tenant_id").notNull(),
  sourceVendor: text("source_vendor").notNull(),
  snapshotData: jsonb("snapshot_data"),
  securityPostureData: jsonb("security_posture_data"),
  licenseData: jsonb("license_data"),
  userCount: integer("user_count"),
  licensedUserCount: integer("licensed_user_count"),
  securityScore: decimal("security_score", { precision: 5, scale: 2 }),
  securityScoreMax: decimal("security_score_max", { precision: 5, scale: 2 }),
  deviceCount: integer("device_count"),
  capturedAt: timestamp("captured_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAssessmentTenantDataSchema = createInsertSchema(assessmentTenantData).omit({ id: true, createdAt: true });
export type AssessmentTenantData = typeof assessmentTenantData.$inferSelect;
export type InsertAssessmentTenantData = z.infer<typeof insertAssessmentTenantDataSchema>;
