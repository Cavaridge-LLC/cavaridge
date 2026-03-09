import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, decimal, boolean, timestamp, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const organizations = pgTable("organizations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  slug: text("slug").unique(),
  industryDefault: text("industry_default"),
  planTier: text("plan_tier").notNull().default("starter"),
  maxUsers: integer("max_users").notNull().default(5),
  maxDeals: integer("max_deals").notNull().default(10),
  maxStorageMb: integer("max_storage_mb").notNull().default(5000),
  logoUrl: text("logo_url"),
  primaryColor: text("primary_color"),
  settingsJson: jsonb("settings_json").default({}),
  ownerUserId: varchar("owner_user_id", { length: 36 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const users = pgTable("users", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("viewer"),
  status: text("status").notNull().default("active"),
  isPlatformUser: boolean("is_platform_user").notNull().default(false),
  organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id),
  invitedBy: varchar("invited_by", { length: 36 }),
  invitedAt: timestamp("invited_at"),
  lastLoginAt: timestamp("last_login_at"),
  avatarUrl: text("avatar_url"),
  jobTitle: text("job_title"),
  notificationPrefs: jsonb("notification_prefs").default({}),
  createdAt: timestamp("created_at").defaultNow(),
});

export const deals = pgTable("deals", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id),
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

export const dealAccess = pgTable("deal_access", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id).notNull(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  accessLevel: text("access_level").notNull().default("contributor"),
  grantedBy: varchar("granted_by", { length: 36 }).references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => [
  uniqueIndex("deal_access_deal_user_idx").on(table.dealId, table.userId),
]);

export const invitations = pgTable("invitations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id).notNull(),
  email: text("email").notNull(),
  role: text("role").notNull().default("viewer"),
  invitedBy: varchar("invited_by", { length: 36 }).references(() => users.id).notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  acceptedAt: timestamp("accepted_at"),
  status: text("status").notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const auditLog = pgTable("audit_log", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id).notNull(),
  userId: varchar("user_id", { length: 36 }).references(() => users.id).notNull(),
  action: text("action").notNull(),
  resourceType: text("resource_type").notNull(),
  resourceId: varchar("resource_id", { length: 36 }),
  detailsJson: jsonb("details_json").default({}),
  ipAddress: text("ip_address"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const pillars = pgTable("pillars", {
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

export const findings = pgTable("findings", {
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

export const documents = pgTable("documents", {
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
  uploadedBy: varchar("uploaded_by", { length: 36 }).references(() => users.id),
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

export const documentChunks = pgTable("document_chunks", {
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

export const baselineProfiles = pgTable("baseline_profiles", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id),
  name: text("name").notNull(),
  profileData: jsonb("profile_data"),
  isDefault: boolean("is_default").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const techStackItems = pgTable("tech_stack_items", {
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

export const baselineComparisons = pgTable("baseline_comparisons", {
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

export const topologyNodes = pgTable("topology_nodes", {
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

export const topologyConnections = pgTable("topology_connections", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  fromNodeId: varchar("from_node_id", { length: 36 }),
  toNodeId: varchar("to_node_id", { length: 36 }),
  connectionType: text("connection_type").notNull(),
  label: text("label"),
  bandwidth: text("bandwidth"),
  status: text("status").default("healthy"),
});

export const playbookPhases = pgTable("playbook_phases", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  phaseName: text("phase_name").notNull(),
  timeRange: text("time_range").notNull(),
  status: text("status").notNull().default("pending"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const playbookTasks = pgTable("playbook_tasks", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  phaseId: varchar("phase_id", { length: 36 }).references(() => playbookPhases.id),
  taskName: text("task_name").notNull(),
  isCriticalPath: boolean("is_critical_path").default(false),
  status: text("status").notNull().default("pending"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const scoreSnapshots = pgTable("score_snapshots", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  score: decimal("score", { precision: 5, scale: 1 }).notNull(),
  recordedAt: timestamp("recorded_at").notNull(),
});

export const processingQueue = pgTable("processing_queue", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).references(() => deals.id),
  documentId: varchar("document_id", { length: 36 }).references(() => documents.id),
  step: text("step").notNull(),
  status: text("status").notNull().default("queued"),
  errorMessage: text("error_message"),
  createdAt: timestamp("created_at").defaultNow(),
  completedAt: timestamp("completed_at"),
});

export const usageTracking = pgTable("usage_tracking", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id).notNull(),
  metric: text("metric").notNull(),
  period: text("period").notNull(),
  count: integer("count").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => [
  uniqueIndex("usage_tracking_org_metric_period_idx").on(table.organizationId, table.metric, table.period),
]);

export const platformSettings = pgTable("platform_settings", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  settingKey: text("setting_key").notNull().unique(),
  settingValue: jsonb("setting_value"),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const accountRequests = pgTable("account_requests", {
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
  reviewedBy: varchar("reviewed_by", { length: 36 }).references(() => users.id),
  reviewedAt: timestamp("reviewed_at"),
  reviewNotes: text("review_notes"),
  organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const documentClassifications = pgTable("document_classifications", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  documentId: varchar("document_id", { length: 36 }).notNull().references(() => documents.id),
  dealId: varchar("deal_id", { length: 36 }).notNull().references(() => deals.id),
  tenantId: varchar("tenant_id", { length: 36 }).notNull(),
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

export const insertOrganizationSchema = createInsertSchema(organizations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
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

export const qaConversations = pgTable("qa_conversations", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).notNull().references(() => deals.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id", { length: 36 }).notNull(),
  userId: varchar("user_id", { length: 36 }).notNull(),
  title: varchar("title", { length: 255 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const qaMessages = pgTable("qa_messages", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id", { length: 36 }).notNull().references(() => qaConversations.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull(),
  content: text("content").notNull(),
  citations: jsonb("citations").default([]),
  similarQuestionIds: jsonb("similar_question_ids").default([]),
  createdAt: timestamp("created_at").defaultNow(),
});

export const qaSavedAnswers = pgTable("qa_saved_answers", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  dealId: varchar("deal_id", { length: 36 }).notNull().references(() => deals.id, { onDelete: "cascade" }),
  tenantId: varchar("tenant_id", { length: 36 }).notNull(),
  question: text("question").notNull(),
  answer: text("answer").notNull(),
  citations: jsonb("citations").default([]),
  savedBy: varchar("saved_by", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertQaConversationSchema = createInsertSchema(qaConversations).omit({ id: true, createdAt: true, updatedAt: true });
export const insertQaMessageSchema = createInsertSchema(qaMessages).omit({ id: true, createdAt: true });
export const insertQaSavedAnswerSchema = createInsertSchema(qaSavedAnswers).omit({ id: true, createdAt: true });

export const organizationBranding = pgTable("organization_branding", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  tenantId: varchar("tenant_id", { length: 36 }).notNull().unique(),
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

export const findingCrossReferences = pgTable("finding_cross_references", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  findingId: varchar("finding_id", { length: 36 }).notNull().references(() => findings.id, { onDelete: "cascade" }),
  similarFindingId: varchar("similar_finding_id", { length: 36 }).notNull().references(() => findings.id, { onDelete: "cascade" }),
  similarityScore: decimal("similarity_score", { precision: 3, scale: 2 }).notNull(),
  dealId: varchar("deal_id", { length: 36 }).notNull(),
  similarDealId: varchar("similar_deal_id", { length: 36 }).notNull(),
  tenantId: varchar("tenant_id", { length: 36 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertFindingCrossReferenceSchema = createInsertSchema(findingCrossReferences).omit({ id: true, createdAt: true });

export type InsertOrganization = z.infer<typeof insertOrganizationSchema>;
export type InsertUser = z.infer<typeof insertUserSchema>;
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

export type Organization = typeof organizations.$inferSelect;
export type User = typeof users.$inferSelect;
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

export const pillarTemplates = pgTable("pillar_templates", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  weight: decimal("weight", { precision: 4, scale: 3 }).notNull().default("0.167"),
  isDefault: boolean("is_default").default(true),
  organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id, { onDelete: "cascade" }),
  displayOrder: integer("display_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertPillarTemplateSchema = createInsertSchema(pillarTemplates).omit({ id: true, createdAt: true, updatedAt: true });
export type PillarTemplate = typeof pillarTemplates.$inferSelect;
export type InsertPillarTemplate = z.infer<typeof insertPillarTemplateSchema>;

export const techCategories = pgTable("tech_categories", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  displayOrder: integer("display_order").default(0),
  isDefault: boolean("is_default").default(true),
  organizationId: varchar("organization_id", { length: 36 }).references(() => organizations.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTechCategorySchema = createInsertSchema(techCategories).omit({ id: true, createdAt: true, updatedAt: true });
export type TechCategory = typeof techCategories.$inferSelect;
export type InsertTechCategory = z.infer<typeof insertTechCategorySchema>;

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id", { length: 36 }).primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  token: varchar("token", { length: 64 }).notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({ id: true, createdAt: true });
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;

export type UserRole = "platform_owner" | "platform_admin" | "org_owner" | "org_admin" | "analyst" | "integration_pm" | "viewer";
export type AccessLevel = "lead" | "contributor" | "reviewer" | "observer";
export type AuditAction = "login" | "deal_created" | "deal_updated" | "finding_added" | "document_uploaded" | "document_downloaded" | "document_deleted" | "user_invited" | "user_removed" | "role_changed" | "settings_changed" | "chat_query" | "report_exported" | "org_created" | "request_approved" | "request_rejected" | "platform_settings_changed";

export function isPlatformRole(role: string): boolean {
  return role === "platform_owner" || role === "platform_admin";
}
