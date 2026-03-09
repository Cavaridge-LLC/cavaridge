CREATE TABLE "account_requests" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"company_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" text NOT NULL,
	"contact_phone" text,
	"industry" text,
	"estimated_deals_per_year" integer,
	"estimated_users" integer,
	"message" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"reviewed_by" varchar(36),
	"reviewed_at" timestamp,
	"review_notes" text,
	"organization_id" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"action" text NOT NULL,
	"resource_type" text NOT NULL,
	"resource_id" varchar(36),
	"details_json" jsonb DEFAULT '{}'::jsonb,
	"ip_address" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "baseline_comparisons" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar(36),
	"standard_name" text NOT NULL,
	"current_state" text NOT NULL,
	"gap_severity" text NOT NULL,
	"priority" text DEFAULT 'recommended',
	"remediation_note" text,
	"estimated_cost" text,
	"source_document_id" varchar(36)
);
--> statement-breakpoint
CREATE TABLE "baseline_profiles" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(36),
	"name" text NOT NULL,
	"profile_data" jsonb,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar(36),
	"user_id" varchar(36),
	"role" text NOT NULL,
	"content" text NOT NULL,
	"confidence_score" numeric(3, 2),
	"source_count" integer,
	"model_used" text,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deal_access" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"access_level" text DEFAULT 'contributor' NOT NULL,
	"granted_by" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(36),
	"deal_code" text NOT NULL,
	"target_name" text NOT NULL,
	"industry" text NOT NULL,
	"stage" text NOT NULL,
	"status" text DEFAULT 'on-track' NOT NULL,
	"facility_count" integer DEFAULT 0,
	"user_count" integer DEFAULT 0,
	"estimated_integration_cost" text,
	"composite_score" numeric(5, 1),
	"overall_confidence" text DEFAULT 'insufficient',
	"documents_uploaded" integer DEFAULT 0,
	"documents_analyzed" integer DEFAULT 0,
	"lifecycle_stage" varchar(50) DEFAULT 'assessment',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "deals_deal_code_unique" UNIQUE("deal_code")
);
--> statement-breakpoint
CREATE TABLE "document_chunks" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar(36),
	"deal_id" varchar(36),
	"chunk_index" integer NOT NULL,
	"chunk_text" text NOT NULL,
	"chunk_tokens" integer,
	"search_tokens" text,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "document_classifications" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" varchar(36) NOT NULL,
	"deal_id" varchar(36) NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"document_type" text DEFAULT 'unknown' NOT NULL,
	"pillar_infrastructure" boolean DEFAULT false,
	"pillar_security" boolean DEFAULT false,
	"pillar_operations" boolean DEFAULT false,
	"pillar_compliance" boolean DEFAULT false,
	"pillar_scalability" boolean DEFAULT false,
	"pillar_strategy" boolean DEFAULT false,
	"confidence" numeric(3, 2) DEFAULT '0.00',
	"classification_reasoning" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "documents" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar(36),
	"filename" text NOT NULL,
	"original_filename" text,
	"file_type" text,
	"file_size" integer,
	"classification" text,
	"object_path" text,
	"upload_status" text DEFAULT 'uploaded' NOT NULL,
	"page_count" integer,
	"uploaded_by" varchar(36),
	"extracted_text" text,
	"text_length" integer,
	"folder_path" text,
	"parent_archive_id" varchar(36),
	"content_hash" text,
	"extraction_status" text DEFAULT 'pending' NOT NULL,
	"extraction_error" text,
	"metadata_json" jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "finding_cross_references" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"finding_id" varchar(36) NOT NULL,
	"similar_finding_id" varchar(36) NOT NULL,
	"similarity_score" numeric(3, 2) NOT NULL,
	"deal_id" varchar(36) NOT NULL,
	"similar_deal_id" varchar(36) NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "findings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar(36),
	"pillar_id" varchar(36),
	"severity" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"impact_estimate" text,
	"remediation_notes" text,
	"source_documents" text[],
	"source_count" integer DEFAULT 0,
	"source_document_id" varchar(36),
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "invitations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(36) NOT NULL,
	"email" text NOT NULL,
	"role" text DEFAULT 'viewer' NOT NULL,
	"invited_by" varchar(36) NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"accepted_at" timestamp,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "invitations_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "organization_branding" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"company_name" varchar(255),
	"logo_url" text,
	"logo_width_px" integer DEFAULT 200,
	"primary_color" varchar(7) DEFAULT '#1a56db',
	"secondary_color" varchar(7) DEFAULT '#6b7280',
	"accent_color" varchar(7) DEFAULT '#059669',
	"report_header_text" varchar(255),
	"report_footer_text" varchar(255),
	"confidentiality_notice" text DEFAULT 'CONFIDENTIAL — For intended recipients only.',
	"contact_name" varchar(255),
	"contact_email" varchar(255),
	"contact_phone" varchar(50),
	"website" varchar(255),
	"show_meridian_badge" boolean DEFAULT true,
	"custom_cover_page" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organization_branding_tenant_id_unique" UNIQUE("tenant_id")
);
--> statement-breakpoint
CREATE TABLE "organizations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text,
	"industry_default" text,
	"plan_tier" text DEFAULT 'starter' NOT NULL,
	"max_users" integer DEFAULT 5 NOT NULL,
	"max_deals" integer DEFAULT 10 NOT NULL,
	"max_storage_mb" integer DEFAULT 5000 NOT NULL,
	"logo_url" text,
	"primary_color" text,
	"settings_json" jsonb DEFAULT '{}'::jsonb,
	"owner_user_id" varchar(36),
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "organizations_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pillars" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar(36),
	"pillar_name" text NOT NULL,
	"score" numeric(3, 1),
	"weight" numeric(3, 2),
	"finding_count" integer DEFAULT 0,
	"evidence_confidence" numeric(3, 2) DEFAULT '0.00',
	"confidence_label" text DEFAULT 'insufficient',
	"document_count" integer DEFAULT 0,
	"score_cap" numeric(3, 1) DEFAULT '3.0',
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "platform_settings" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"setting_key" text NOT NULL,
	"setting_value" jsonb,
	"updated_by" varchar(36),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "platform_settings_setting_key_unique" UNIQUE("setting_key")
);
--> statement-breakpoint
CREATE TABLE "playbook_phases" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar(36),
	"phase_name" text NOT NULL,
	"time_range" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playbook_tasks" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"phase_id" varchar(36),
	"task_name" text NOT NULL,
	"is_critical_path" boolean DEFAULT false,
	"status" text DEFAULT 'pending' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "processing_queue" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar(36),
	"document_id" varchar(36),
	"step" text NOT NULL,
	"status" text DEFAULT 'queued' NOT NULL,
	"error_message" text,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "qa_conversations" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar(36) NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"user_id" varchar(36) NOT NULL,
	"title" varchar(255),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qa_messages" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" varchar(36) NOT NULL,
	"role" varchar(20) NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb,
	"similar_question_ids" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "qa_saved_answers" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar(36) NOT NULL,
	"tenant_id" varchar(36) NOT NULL,
	"question" text NOT NULL,
	"answer" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb,
	"saved_by" varchar(36) NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "score_snapshots" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar(36),
	"score" numeric(5, 1) NOT NULL,
	"recorded_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tech_stack_items" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar(36),
	"category" text NOT NULL,
	"item_name" text NOT NULL,
	"version" text,
	"status" text DEFAULT 'unknown',
	"notes" text,
	"confidence" text DEFAULT 'medium',
	"source_document_id" varchar(36),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "topology_connections" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar(36),
	"from_node_id" varchar(36),
	"to_node_id" varchar(36),
	"connection_type" text NOT NULL,
	"label" text,
	"bandwidth" text,
	"status" text DEFAULT 'healthy'
);
--> statement-breakpoint
CREATE TABLE "topology_nodes" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" varchar(36),
	"node_type" text NOT NULL,
	"label" text NOT NULL,
	"sublabel" text,
	"status" text DEFAULT 'unknown',
	"parent_node_id" varchar(36),
	"position_x" integer DEFAULT 0,
	"position_y" integer DEFAULT 0,
	"metadata_json" jsonb,
	"source_document_id" varchar(36),
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "usage_tracking" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" varchar(36) NOT NULL,
	"metric" text NOT NULL,
	"period" text NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(36) PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"password_hash" text,
	"role" text DEFAULT 'viewer' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"is_platform_user" boolean DEFAULT false NOT NULL,
	"organization_id" varchar(36),
	"invited_by" varchar(36),
	"invited_at" timestamp,
	"last_login_at" timestamp,
	"avatar_url" text,
	"job_title" text,
	"notification_prefs" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "account_requests" ADD CONSTRAINT "account_requests_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account_requests" ADD CONSTRAINT "account_requests_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseline_comparisons" ADD CONSTRAINT "baseline_comparisons_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "baseline_profiles" ADD CONSTRAINT "baseline_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_access" ADD CONSTRAINT "deal_access_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_access" ADD CONSTRAINT "deal_access_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_access" ADD CONSTRAINT "deal_access_granted_by_users_id_fk" FOREIGN KEY ("granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_chunks" ADD CONSTRAINT "document_chunks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "document_classifications" ADD CONSTRAINT "document_classifications_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_cross_references" ADD CONSTRAINT "finding_cross_references_finding_id_findings_id_fk" FOREIGN KEY ("finding_id") REFERENCES "public"."findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_cross_references" ADD CONSTRAINT "finding_cross_references_similar_finding_id_findings_id_fk" FOREIGN KEY ("similar_finding_id") REFERENCES "public"."findings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "findings" ADD CONSTRAINT "findings_pillar_id_pillars_id_fk" FOREIGN KEY ("pillar_id") REFERENCES "public"."pillars"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invitations" ADD CONSTRAINT "invitations_invited_by_users_id_fk" FOREIGN KEY ("invited_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pillars" ADD CONSTRAINT "pillars_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook_phases" ADD CONSTRAINT "playbook_phases_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook_tasks" ADD CONSTRAINT "playbook_tasks_phase_id_playbook_phases_id_fk" FOREIGN KEY ("phase_id") REFERENCES "public"."playbook_phases"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_queue" ADD CONSTRAINT "processing_queue_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "processing_queue" ADD CONSTRAINT "processing_queue_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_conversations" ADD CONSTRAINT "qa_conversations_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_messages" ADD CONSTRAINT "qa_messages_conversation_id_qa_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."qa_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_saved_answers" ADD CONSTRAINT "qa_saved_answers_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "score_snapshots" ADD CONSTRAINT "score_snapshots_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tech_stack_items" ADD CONSTRAINT "tech_stack_items_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topology_connections" ADD CONSTRAINT "topology_connections_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "topology_nodes" ADD CONSTRAINT "topology_nodes_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usage_tracking" ADD CONSTRAINT "usage_tracking_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "deal_access_deal_user_idx" ON "deal_access" USING btree ("deal_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "usage_tracking_org_metric_period_idx" ON "usage_tracking" USING btree ("organization_id","metric","period");