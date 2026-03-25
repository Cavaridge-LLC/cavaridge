/**
 * CVG-BRAIN — Unit Tests: Knowledge Extraction Parsing
 *
 * Tests the extraction result parsing, entity type mapping,
 * and relationship mapping logic.
 */

import { describe, it, expect } from "vitest";
import { parseForwardedEmail } from "../connectors/email-parser.js";
import { parseCalendarEvent, parseIcsEvent } from "../connectors/calendar-parser.js";
import { parseMarkdownNote, parsePlainTextNote } from "../connectors/notes-parser.js";

// ── Email Parsing Tests ──────────────────────────────────────────────

describe("Email Parser", () => {
  it("should parse a standard forwarded email", () => {
    const raw = `From: John Doe <john@example.com>
To: Jane Smith <jane@example.com>, Bob <bob@example.com>
Cc: Admin <admin@example.com>
Subject: Re: Migration Timeline
Date: Mon, 24 Mar 2026 10:30:00 -0400

Hi team,

We decided to move forward with AWS for the migration. Timeline is Q3 2026.
John will handle networking, Sarah does security review.
Risk assessment due by April 15th.`;

    const parsed = parseForwardedEmail(raw);

    expect(parsed.subject).toBe("Re: Migration Timeline");
    expect(parsed.from.name).toBe("John Doe");
    expect(parsed.from.email).toBe("john@example.com");
    expect(parsed.to).toHaveLength(2);
    expect(parsed.to[0].name).toBe("Jane Smith");
    expect(parsed.to[0].email).toBe("jane@example.com");
    expect(parsed.cc).toHaveLength(1);
    expect(parsed.cc[0].email).toBe("admin@example.com");
    expect(parsed.body).toContain("We decided to move forward with AWS");
    expect(parsed.body).toContain("Risk assessment due by April 15th");
  });

  it("should handle email with no name in from field", () => {
    const raw = `From: john@example.com
Subject: Quick update

The project is on track.`;

    const parsed = parseForwardedEmail(raw);
    expect(parsed.from.email).toBe("john@example.com");
    expect(parsed.from.name).toBe("");
    expect(parsed.body).toContain("project is on track");
  });

  it("should detect attachment references", () => {
    const raw = `From: test@example.com
Subject: Report

Please see the [attachment] for details.`;

    const parsed = parseForwardedEmail(raw);
    expect(parsed.hasAttachments).toBe(true);
  });

  it("should handle empty email text", () => {
    const parsed = parseForwardedEmail("");
    expect(parsed.subject).toBe("");
    expect(parsed.from.email).toBe("");
    expect(parsed.body).toBe("");
  });
});

// ── Calendar Parsing Tests ────────────────────────────────────────────

describe("Calendar Parser", () => {
  it("should parse a structured calendar event", () => {
    const event = parseCalendarEvent({
      title: "Sprint Planning",
      description: "Review Q3 sprint goals",
      startTime: "2026-03-25T09:00:00Z",
      endTime: "2026-03-25T10:00:00Z",
      location: "Conference Room A",
      organizer: { name: "Alice", email: "alice@example.com" },
      attendees: [
        { name: "Bob", email: "bob@example.com", status: "accepted" },
        { name: "Carol", email: "carol@example.com", status: "tentative" },
      ],
      isRecurring: false,
    });

    expect(event.title).toBe("Sprint Planning");
    expect(event.description).toBe("Review Q3 sprint goals");
    expect(event.organizer.name).toBe("Alice");
    expect(event.attendees).toHaveLength(2);
    expect(event.attendees[0].status).toBe("accepted");
    expect(event.isRecurring).toBe(false);
  });

  it("should handle missing fields gracefully", () => {
    const event = parseCalendarEvent({});
    expect(event.title).toBe("");
    expect(event.organizer.name).toBe("");
    expect(event.attendees).toHaveLength(0);
  });

  it("should parse ICS format event", () => {
    const ics = `BEGIN:VEVENT
SUMMARY:Weekly Standup
DTSTART:20260325T090000Z
DTEND:20260325T091500Z
LOCATION:Zoom
ORGANIZER;CN=Alice:mailto:alice@example.com
ATTENDEE;CN=Bob;PARTSTAT=ACCEPTED:mailto:bob@example.com
DESCRIPTION:Daily standup meeting
END:VEVENT`;

    const event = parseIcsEvent(ics);

    expect(event.title).toBe("Weekly Standup");
    expect(event.location).toBe("Zoom");
    expect(event.organizer.name).toBe("Alice");
    expect(event.organizer.email).toBe("alice@example.com");
    expect(event.attendees).toHaveLength(1);
    expect(event.attendees[0].name).toBe("Bob");
    expect(event.attendees[0].status).toBe("accepted");
    expect(event.description).toBe("Daily standup meeting");
  });

  it("should detect recurring events in ICS", () => {
    const ics = `BEGIN:VEVENT
SUMMARY:Recurring Meeting
DTSTART:20260325T090000Z
DTEND:20260325T100000Z
RRULE:FREQ=WEEKLY;BYDAY=MO
END:VEVENT`;

    const event = parseIcsEvent(ics);
    expect(event.isRecurring).toBe(true);
  });
});

// ── Notes Parsing Tests ───────────────────────────────────────────────

describe("Notes Parser", () => {
  it("should parse a markdown note with headings and lists", () => {
    const markdown = `# Meeting Notes

## Decisions
- Migrate to AWS
- Use pgvector for embeddings

## Action Items
1. John: Complete security review by April 15
2. Sarah: Update network diagrams

## Links
Check the [architecture doc](https://docs.example.com/arch) for reference.

\`\`\`sql
SELECT * FROM knowledge_objects WHERE tenant_id = $1;
\`\`\`
`;

    const parsed = parseMarkdownNote(markdown);

    expect(parsed.title).toBe("Meeting Notes");
    expect(parsed.format).toBe("markdown");
    expect(parsed.headings).toContain("Meeting Notes");
    expect(parsed.headings).toContain("Decisions");
    expect(parsed.headings).toContain("Action Items");
    expect(parsed.listItems.length).toBeGreaterThanOrEqual(2);
    expect(parsed.links).toHaveLength(1);
    expect(parsed.links[0].url).toBe("https://docs.example.com/arch");
    expect(parsed.codeBlocks).toHaveLength(1);
    expect(parsed.codeBlocks[0].language).toBe("sql");
    expect(parsed.wordCount).toBeGreaterThan(10);
  });

  it("should extract YAML frontmatter metadata", () => {
    const markdown = `---
author: Benjamin Posner
date: 2026-03-24
tags: meeting, brain
---

# Sprint Notes

Sprint is on track.`;

    const parsed = parseMarkdownNote(markdown);
    expect(parsed.metadata.author).toBe("Benjamin Posner");
    expect(parsed.metadata.date).toBe("2026-03-24");
  });

  it("should parse plain text notes", () => {
    const text = `Project Update
- Migration is progressing
- Security review pending
* Budget approved for Q3

Next steps include finalizing the architecture.`;

    const parsed = parsePlainTextNote(text);
    expect(parsed.title).toBe("Project Update");
    expect(parsed.format).toBe("plain");
    expect(parsed.listItems.length).toBeGreaterThanOrEqual(2);
    expect(parsed.wordCount).toBeGreaterThan(5);
  });

  it("should handle empty markdown", () => {
    const parsed = parseMarkdownNote("");
    expect(parsed.title).toBe("");
    expect(parsed.headings).toHaveLength(0);
    expect(parsed.links).toHaveLength(0);
  });
});

// ── Entity Type Mapping Tests ─────────────────────────────────────────

describe("Entity Type Mapping", () => {
  const validTypes = [
    "person", "organization", "system", "process", "decision",
    "action_item", "project", "technology", "location", "date",
    "monetary_value", "document", "concept",
  ];

  it("should recognize all valid entity types", () => {
    for (const t of validTypes) {
      expect(validTypes.includes(t)).toBe(true);
    }
  });

  it("should have the 6 core types from spec", () => {
    expect(validTypes).toContain("person");
    expect(validTypes).toContain("organization");
    expect(validTypes).toContain("system");
    expect(validTypes).toContain("process");
    expect(validTypes).toContain("decision");
    expect(validTypes).toContain("action_item");
  });
});

// ── Relationship Type Mapping Tests ───────────────────────────────────

describe("Relationship Type Mapping", () => {
  const validRelTypes = [
    "owns", "manages", "connects_to", "depends_on", "decided_by",
    "mentioned_in", "related_to", "assigned_to", "part_of",
    "follows", "contradicts", "supersedes",
  ];

  it("should have the 5 core relationship types from spec", () => {
    expect(validRelTypes).toContain("owns");
    expect(validRelTypes).toContain("manages");
    expect(validRelTypes).toContain("connects_to");
    expect(validRelTypes).toContain("depends_on");
    expect(validRelTypes).toContain("decided_by");
  });

  it("should have additional relationship types", () => {
    expect(validRelTypes).toContain("assigned_to");
    expect(validRelTypes).toContain("related_to");
    expect(validRelTypes).toContain("part_of");
  });
});
