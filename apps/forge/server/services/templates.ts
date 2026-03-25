/**
 * Template Library Service
 *
 * Pre-built templates for common content types.
 * System templates are tenant-agnostic; tenant templates are scoped.
 */

import { db } from "../db";
import { forgeTemplates } from "@shared/schema";
import { eq, and, or, isNull, sql } from "drizzle-orm";
import type { TemplateData, ContentType, OutputFormat } from "@shared/models/pipeline";

/** Seed system templates (idempotent) */
export async function seedSystemTemplates(): Promise<void> {
  const templates = getSystemTemplates();
  for (const template of templates) {
    await db
      .insert(forgeTemplates)
      .values({
        name: template.name,
        slug: template.slug,
        description: template.description,
        contentType: template.contentType as typeof forgeTemplates.$inferInsert["contentType"],
        outputFormats: template.outputFormats,
        templateData: template.templateData,
        isSystem: true,
        isActive: true,
      })
      .onConflictDoNothing();
  }
}

/** Get all templates visible to a tenant (system + tenant-owned) */
export async function getTemplatesForTenant(tenantId: string) {
  return db
    .select()
    .from(forgeTemplates)
    .where(
      and(
        eq(forgeTemplates.isActive, true),
        or(
          eq(forgeTemplates.tenantId, tenantId),
          isNull(forgeTemplates.tenantId),
        ),
      ),
    );
}

/** Get a single template by ID */
export async function getTemplateById(templateId: string) {
  const [template] = await db
    .select()
    .from(forgeTemplates)
    .where(eq(forgeTemplates.id, templateId));
  return template ?? null;
}

/** Increment template usage count */
export async function incrementTemplateUsage(templateId: string): Promise<void> {
  await db
    .update(forgeTemplates)
    .set({
      usageCount: sql`${forgeTemplates.usageCount} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(forgeTemplates.id, templateId));
}

// ── System Template Definitions ──

interface SystemTemplate {
  name: string;
  slug: string;
  description: string;
  contentType: ContentType;
  outputFormats: OutputFormat[];
  templateData: TemplateData;
}

function getSystemTemplates(): SystemTemplate[] {
  return [
    {
      name: "Blog Post",
      slug: "blog-post",
      description: "Engaging blog post with introduction, body, and conclusion",
      contentType: "blog_post",
      outputFormats: ["docx", "pdf", "html"],
      templateData: {
        contentType: "blog_post",
        sections: [
          { id: "intro", title: "Introduction", brief: "Hook the reader and introduce the topic", order: 1 },
          { id: "body-1", title: "Key Point 1", brief: "First major argument or insight", order: 2 },
          { id: "body-2", title: "Key Point 2", brief: "Second major argument or insight", order: 3 },
          { id: "body-3", title: "Key Point 3", brief: "Third major argument or supporting evidence", order: 4 },
          { id: "conclusion", title: "Conclusion", brief: "Summary and call to action", order: 5 },
        ],
        defaultTone: "professional",
        defaultAudience: "Business professionals",
        wordCountRange: { min: 800, max: 2000 },
        outputFormats: ["docx", "pdf", "html"],
        description: "Standard blog post structure for thought leadership content",
      },
    },
    {
      name: "Case Study",
      slug: "case-study",
      description: "Client success story with challenge, solution, and results",
      contentType: "case_study",
      outputFormats: ["docx", "pdf", "html"],
      templateData: {
        contentType: "case_study",
        sections: [
          { id: "overview", title: "Client Overview", brief: "Brief introduction to the client and their industry", order: 1 },
          { id: "challenge", title: "The Challenge", brief: "Problem the client faced before engagement", order: 2 },
          { id: "solution", title: "Our Solution", brief: "Detailed description of the solution implemented", order: 3 },
          { id: "implementation", title: "Implementation", brief: "How the solution was deployed and managed", order: 4 },
          { id: "results", title: "Results & Impact", brief: "Quantifiable outcomes and business impact", order: 5 },
          { id: "testimonial", title: "Client Testimonial", brief: "Direct quote from the client", order: 6 },
        ],
        defaultTone: "professional",
        defaultAudience: "Prospective clients and decision-makers",
        wordCountRange: { min: 1500, max: 3000 },
        outputFormats: ["docx", "pdf", "html"],
        description: "Client success story for sales enablement and marketing",
      },
    },
    {
      name: "White Paper",
      slug: "white-paper",
      description: "In-depth analysis with research, methodology, and recommendations",
      contentType: "white_paper",
      outputFormats: ["docx", "pdf"],
      templateData: {
        contentType: "white_paper",
        sections: [
          { id: "exec-summary", title: "Executive Summary", brief: "High-level overview of findings and recommendations", order: 1 },
          { id: "introduction", title: "Introduction", brief: "Context, background, and scope of analysis", order: 2 },
          { id: "methodology", title: "Methodology", brief: "Research approach and data sources", order: 3 },
          { id: "findings", title: "Key Findings", brief: "Detailed analysis and evidence", order: 4 },
          { id: "analysis", title: "Analysis & Discussion", brief: "Interpretation of findings with industry context", order: 5 },
          { id: "recommendations", title: "Recommendations", brief: "Actionable recommendations based on findings", order: 6 },
          { id: "conclusion", title: "Conclusion", brief: "Summary and next steps", order: 7 },
          { id: "references", title: "References", brief: "Sources and citations", order: 8 },
        ],
        defaultTone: "technical",
        defaultAudience: "C-suite executives and technical decision-makers",
        wordCountRange: { min: 3000, max: 8000 },
        outputFormats: ["docx", "pdf"],
        description: "Authoritative research document for thought leadership",
      },
    },
    {
      name: "Email Campaign",
      slug: "email-campaign",
      description: "Multi-email sequence with subject lines and CTAs",
      contentType: "email_campaign",
      outputFormats: ["docx", "html"],
      templateData: {
        contentType: "email_campaign",
        sections: [
          { id: "email-1", title: "Email 1: Introduction", brief: "First touch — introduce the problem/topic", order: 1 },
          { id: "email-2", title: "Email 2: Value Proposition", brief: "Detail the solution and its benefits", order: 2 },
          { id: "email-3", title: "Email 3: Social Proof", brief: "Case studies, testimonials, or data points", order: 3 },
          { id: "email-4", title: "Email 4: Call to Action", brief: "Final push with urgency and clear CTA", order: 4 },
        ],
        defaultTone: "professional",
        defaultAudience: "Prospective clients",
        wordCountRange: { min: 600, max: 1200 },
        outputFormats: ["docx", "html"],
        description: "4-email nurture sequence for lead generation",
      },
    },
    {
      name: "Social Media Series",
      slug: "social-media-series",
      description: "Multi-platform social media content package",
      contentType: "social_media_series",
      outputFormats: ["docx", "html"],
      templateData: {
        contentType: "social_media_series",
        sections: [
          { id: "linkedin-post", title: "LinkedIn Post", brief: "Professional long-form post for LinkedIn (300-500 words)", order: 1 },
          { id: "twitter-thread", title: "X/Twitter Thread", brief: "5-7 tweet thread breaking down the key message", order: 2 },
          { id: "short-caption", title: "Instagram/Facebook Caption", brief: "Engaging short-form caption with hashtags", order: 3 },
          { id: "content-hooks", title: "Content Hooks", brief: "5 attention-grabbing one-liners for repurposing", order: 4 },
        ],
        defaultTone: "casual",
        defaultAudience: "Social media followers and industry peers",
        wordCountRange: { min: 500, max: 1500 },
        outputFormats: ["docx", "html"],
        description: "Multi-platform social media content for consistent messaging",
      },
    },
    {
      name: "Proposal",
      slug: "proposal",
      description: "Business proposal with scope, approach, and investment",
      contentType: "proposal",
      outputFormats: ["docx", "pdf"],
      templateData: {
        contentType: "proposal",
        sections: [
          { id: "cover", title: "Cover Letter", brief: "Personal introduction and proposal context", order: 1 },
          { id: "exec-summary", title: "Executive Summary", brief: "Overview of the proposed engagement", order: 2 },
          { id: "understanding", title: "Understanding of Need", brief: "Demonstrate understanding of the client's situation", order: 3 },
          { id: "approach", title: "Proposed Approach", brief: "Detailed methodology and delivery plan", order: 4 },
          { id: "timeline", title: "Timeline & Milestones", brief: "Project phases with dates", order: 5 },
          { id: "team", title: "Team & Qualifications", brief: "Key personnel and relevant experience", order: 6 },
          { id: "next-steps", title: "Next Steps", brief: "Clear path forward and contact information", order: 7 },
        ],
        defaultTone: "professional",
        defaultAudience: "Client decision-makers",
        wordCountRange: { min: 2000, max: 5000 },
        outputFormats: ["docx", "pdf"],
        description: "Professional proposal for business development",
      },
    },
    {
      name: "One-Pager",
      slug: "one-pager",
      description: "Concise single-page summary or overview",
      contentType: "one_pager",
      outputFormats: ["docx", "pdf", "html"],
      templateData: {
        contentType: "one_pager",
        sections: [
          { id: "headline", title: "Headline & Hook", brief: "Attention-grabbing headline and 1-2 sentence overview", order: 1 },
          { id: "problem", title: "The Problem", brief: "Concise statement of the problem being solved", order: 2 },
          { id: "solution", title: "Our Solution", brief: "Clear description of the solution and key features", order: 3 },
          { id: "benefits", title: "Key Benefits", brief: "3-5 bullet-point benefits with supporting data", order: 4 },
          { id: "cta", title: "Call to Action", brief: "Next step the reader should take", order: 5 },
        ],
        defaultTone: "professional",
        defaultAudience: "Time-constrained executives",
        wordCountRange: { min: 300, max: 600 },
        outputFormats: ["docx", "pdf", "html"],
        description: "Single-page summary for quick consumption",
      },
    },
  ];
}
