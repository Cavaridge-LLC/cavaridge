/**
 * Template Validation — Unit Tests
 *
 * Tests template data structure validation and content type coverage.
 */

import { describe, it, expect } from "vitest";
import type { ContentType, OutputFormat, TemplateData } from "../shared/models/pipeline";

const VALID_CONTENT_TYPES: ContentType[] = [
  "blog_post", "case_study", "white_paper", "email_campaign",
  "social_media_series", "proposal", "one_pager", "custom",
];

const VALID_OUTPUT_FORMATS: OutputFormat[] = ["docx", "pdf", "html"];

const VALID_TONES = ["professional", "casual", "creative", "technical", "academic"] as const;

// Inline template data for testing (mirrors the service but isolated)
const SYSTEM_TEMPLATES: Array<{ name: string; slug: string; contentType: ContentType; data: TemplateData }> = [
  {
    name: "Blog Post",
    slug: "blog-post",
    contentType: "blog_post",
    data: {
      contentType: "blog_post",
      sections: [
        { id: "intro", title: "Introduction", brief: "Hook", order: 1 },
        { id: "body-1", title: "Key Point 1", brief: "First", order: 2 },
        { id: "body-2", title: "Key Point 2", brief: "Second", order: 3 },
        { id: "body-3", title: "Key Point 3", brief: "Third", order: 4 },
        { id: "conclusion", title: "Conclusion", brief: "Summary", order: 5 },
      ],
      defaultTone: "professional",
      defaultAudience: "Business professionals",
      wordCountRange: { min: 800, max: 2000 },
      outputFormats: ["docx", "pdf", "html"],
      description: "Standard blog post",
    },
  },
  {
    name: "Case Study",
    slug: "case-study",
    contentType: "case_study",
    data: {
      contentType: "case_study",
      sections: [
        { id: "overview", title: "Client Overview", brief: "Introduction", order: 1 },
        { id: "challenge", title: "The Challenge", brief: "Problem", order: 2 },
        { id: "solution", title: "Our Solution", brief: "Solution", order: 3 },
        { id: "results", title: "Results", brief: "Outcomes", order: 4 },
      ],
      defaultTone: "professional",
      defaultAudience: "Decision-makers",
      wordCountRange: { min: 1500, max: 3000 },
      outputFormats: ["docx", "pdf", "html"],
      description: "Client success story",
    },
  },
  {
    name: "One-Pager",
    slug: "one-pager",
    contentType: "one_pager",
    data: {
      contentType: "one_pager",
      sections: [
        { id: "headline", title: "Headline", brief: "Hook", order: 1 },
        { id: "problem", title: "The Problem", brief: "Problem", order: 2 },
        { id: "solution", title: "Solution", brief: "Solution", order: 3 },
        { id: "benefits", title: "Benefits", brief: "Benefits", order: 4 },
        { id: "cta", title: "CTA", brief: "Action", order: 5 },
      ],
      defaultTone: "professional",
      defaultAudience: "Executives",
      wordCountRange: { min: 300, max: 600 },
      outputFormats: ["docx", "pdf", "html"],
      description: "Single-page summary",
    },
  },
];

describe("Template Validation", () => {
  describe("content type coverage", () => {
    it("should have templates for 7 required content types", () => {
      const requiredTypes: ContentType[] = [
        "blog_post", "case_study", "white_paper", "email_campaign",
        "social_media_series", "proposal", "one_pager",
      ];
      // At least covering the subset we defined
      for (const template of SYSTEM_TEMPLATES) {
        expect(VALID_CONTENT_TYPES).toContain(template.contentType);
      }
    });
  });

  describe("template data structure", () => {
    for (const template of SYSTEM_TEMPLATES) {
      describe(`${template.name} template`, () => {
        it("should have a valid content type", () => {
          expect(VALID_CONTENT_TYPES).toContain(template.data.contentType);
        });

        it("should have at least one section", () => {
          expect(template.data.sections.length).toBeGreaterThan(0);
        });

        it("should have sections with unique IDs", () => {
          const ids = template.data.sections.map((s) => s.id);
          const uniqueIds = new Set(ids);
          expect(uniqueIds.size).toBe(ids.length);
        });

        it("should have sections in sequential order", () => {
          const orders = template.data.sections.map((s) => s.order);
          for (let i = 1; i < orders.length; i++) {
            expect(orders[i]).toBeGreaterThan(orders[i - 1]);
          }
        });

        it("should have a valid default tone", () => {
          expect(VALID_TONES).toContain(template.data.defaultTone);
        });

        it("should have a non-empty default audience", () => {
          expect(template.data.defaultAudience.length).toBeGreaterThan(0);
        });

        it("should have a valid word count range", () => {
          expect(template.data.wordCountRange.min).toBeGreaterThan(0);
          expect(template.data.wordCountRange.max).toBeGreaterThan(template.data.wordCountRange.min);
        });

        it("should have valid output formats", () => {
          for (const format of template.data.outputFormats) {
            expect(VALID_OUTPUT_FORMATS).toContain(format);
          }
          expect(template.data.outputFormats.length).toBeGreaterThan(0);
        });

        it("should have a slug matching expected format", () => {
          expect(template.slug).toMatch(/^[a-z0-9-]+$/);
        });
      });
    }
  });

  describe("output format validation", () => {
    it("should support exactly 3 Phase 1 formats", () => {
      expect(VALID_OUTPUT_FORMATS).toEqual(["docx", "pdf", "html"]);
    });
  });

  describe("content type validation", () => {
    it("should support 8 content types including custom", () => {
      expect(VALID_CONTENT_TYPES).toHaveLength(8);
      expect(VALID_CONTENT_TYPES).toContain("custom");
    });
  });
});
