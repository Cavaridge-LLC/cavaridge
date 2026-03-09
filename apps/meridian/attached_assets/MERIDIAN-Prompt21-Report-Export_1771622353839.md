# PROMPT 21: Report Export — PDF, Full Report & PowerPoint

> **Paste into Replit Agent.** Adds the report generation system — the core
> deliverable of MERIDIAN. Generates three formats: a 2-5 page PDF executive
> summary, a 20-40 page full diligence PDF report, and a PowerPoint IC deck.
> All content is AI-generated from real deal data.

---

```
Build the Report Export system for MERIDIAN. This is the platform's primary 
deliverable — the document that PE firms hand to their investment committee.

Three report formats:
1. Executive Summary (2-5 page PDF)
2. Full IT Due Diligence Report (20-40 page PDF)
3. IC Presentation Deck (PowerPoint)

All reports are AI-generated from real deal data with professional formatting.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 1 — REPORT GENERATION ENGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create POST /api/deals/[dealId]/generate-report that:

1. Accepts: { format: "executive_summary" | "full_report" | "ic_deck" }

2. Gathers EVERYTHING about the deal:
   - Deal metadata (name, industry, stage, facility count, user count, etc.)
   - All pillar scores with weights
   - All findings sorted by severity
   - Composite score and how it was calculated
   - Tech stack items (if extracted)
   - Baseline comparison gaps (if generated)
   - Playbook phases and tasks with costs (if generated)
   - Simulation scenario results (if generated)
   - Score history from snapshots
   - Document statistics (count, types, classification breakdown)
   - Organization name (the PE firm / acquirer)

3. Generates content via Claude, then assembles into the requested format

4. Returns the generated file for download

DATABASE: Create table "generated_reports":
  id (UUID), deal_id, organization_id, format, filename, file_path,
  file_size, page_count, generated_by (user UUID), metadata_json, 
  created_at

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 2 — EXECUTIVE SUMMARY (2-5 page PDF)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate a concise executive summary designed for busy PE partners.

STEP A — AI CONTENT GENERATION:
Send deal data to Claude with this prompt:

"""
You are a senior IT due diligence consultant writing an executive summary 
for a private equity investment committee. Write a professional, concise, 
and direct IT due diligence executive summary.

DEAL:
{full_deal_data_json}

Write the following sections:

1. EXECUTIVE OVERVIEW (1 paragraph):
   - Target name, industry, scale (facilities, users)
   - One-sentence assessment: is this a go, conditional go, or concern?
   - Overall IT risk score contextualized

2. KEY FINDINGS SUMMARY (bullet list):
   - Top 5 findings by severity with business impact
   - Format: "[SEVERITY] Finding title — $impact, timeline risk"

3. RISK ASSESSMENT (1-2 paragraphs):
   - What's strong in the target's IT environment
   - What's concerning
   - Regulatory/compliance posture
   - Quantify: "X critical, Y high, Z medium findings identified"

4. COST & TIMELINE SUMMARY:
   - Estimated integration cost range (if playbook exists)
   - Estimated timeline
   - Key cost drivers
   - Monthly burn rate

5. RECOMMENDATION:
   - Clear recommendation: Proceed / Proceed with Conditions / Caution
   - 3-5 conditions or requirements before close
   - Post-close priorities (first 30/60/90 days)

6. APPENDIX REFERENCE:
   - Note that full report with detailed findings is available
   - Document count analyzed
   - Date of assessment

Write in professional consulting tone. Be direct and quantitative. 
Avoid hedging language — state assessments clearly.

Respond as JSON with each section as a key.
"""

STEP B — PDF ASSEMBLY:
Use a PDF generation library (puppeteer with HTML→PDF, or pdfkit, or 
jsPDF — whichever is available in Replit). Generate a professional PDF:

PAGE 1 — COVER:
  - "CONFIDENTIAL" watermark (diagonal, light gray)
  - MERIDIAN logo (centered, top)
  - "IT Due Diligence"
  - "Executive Summary"
  - Target company name (large)
  - "Prepared for: {org_name}"
  - Date
  - "MERIDIAN v2.0 | Cavaridge, LLC"

PAGE 2-3 — CONTENT:
  - Header: "Executive Summary — {target_name}"
  - Footer: "Confidential | {org_name} | Page X of Y"
  - Professional typography: serif headers, clean body text
  - Score gauge visual: circular score badge (composite_score/100)
  - Severity badge colors inline with findings
  - Cost table with aligned columns

PAGE 4-5 (if needed) — RECOMMENDATION + APPENDIX:
  - Clear recommendation box (green border for proceed, amber for 
    conditional, red for caution)
  - Conditions list
  - Assessment metadata

Color scheme: minimal, professional
- Headers: dark navy (#1a1a2e)
- Accents: MERIDIAN blue (#3B82F6)
- Critical: red, High: amber
- Body: dark gray (#333)
- Background: white

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 3 — FULL IT DUE DILIGENCE REPORT (20-40 page PDF)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

A comprehensive report with everything the deal team needs.

STEP A — AI CONTENT GENERATION:
Make MULTIPLE Claude calls (one per section to stay within token limits):

Call 1 — Executive Summary (reuse from Part 2)

Call 2 — Pillar Deep Dives:
"""
For each of the 6 IT risk pillars, write a detailed assessment section:

PILLAR DATA:
{pillars_with_findings_json}

For each pillar write:
- Assessment narrative (2-3 paragraphs): what you found, current state, 
  risks, and implications for integration
- Findings detail: for each finding in this pillar, provide:
  - Title, severity, detailed description
  - Business impact (quantified in dollars and timeline)
  - Recommended remediation approach
  - Priority (immediate / pre-close / post-close)
- Pillar score justification: explain why this score was assigned

Write as a consulting professional. Reference specific technologies, 
versions, and configurations observed. Be specific and actionable.
"""

Call 3 — Technology Stack Analysis:
"""
Write a technology environment analysis based on the detected stack:
{tech_stack_json}
{baseline_gaps_json}

Sections:
- Current State Overview: describe the target's IT environment
- Technology Stack Assessment: strengths and weaknesses by category
- Baseline Alignment: gap analysis against acquirer standards
- Legacy Risk: end-of-life and deprecated technologies
- Modernization Opportunities: what could be improved
"""

Call 4 — Integration Plan Summary:
"""
Summarize the integration approach based on the playbook:
{playbook_json}
{simulator_json}

Sections:
- Recommended Integration Strategy
- Phase Summary (table: phase name, timeline, key activities, cost)
- Cost Breakdown (labor by tier, materials, contingency)
- Risk Factors and Mitigations
- Critical Path Dependencies
"""

STEP B — PDF ASSEMBLY (multi-page professional document):

TABLE OF CONTENTS:
  Auto-generated with page numbers for each section

SECTIONS (each starts on a new page):
  1. Cover Page (same as exec summary but "Full IT Due Diligence Report")
  2. Table of Contents
  3. Executive Summary (3-4 pages)
  4. Methodology & Scope (1 page — standard boilerplate describing 
     MERIDIAN's 6-pillar framework, document analysis, AI-assisted review)
  5. Target Company Overview (1 page — from deal metadata)
  6. Composite Risk Score (1 page — score gauge, breakdown chart, 
     scoring methodology explanation)
  7. Pillar 1: Infrastructure & Architecture (2-3 pages)
  8. Pillar 2: Cybersecurity Posture (2-3 pages)
  9. Pillar 3: Regulatory Compliance (2-3 pages)
  10. Pillar 4: Integration Complexity (2-3 pages)
  11. Pillar 5: Technology Org & Talent (2-3 pages)
  12. Pillar 6: Data Assets & Governance (2-3 pages)
  13. Technology Stack Analysis (2-3 pages)
  14. Acquirer Baseline Alignment (2 pages — gap table)
  15. Integration Roadmap (2-3 pages — phases, costs, timeline)
  16. Financial Projections (1-2 pages — from simulator, if available)
  17. Recommendations & Next Steps (1-2 pages)
  18. Appendix A: Complete Findings Register (table of ALL findings)
  19. Appendix B: Technology Inventory (full tech stack table)
  20. Appendix C: Document Inventory (list of all documents analyzed)

DESIGN:
  - Professional template with consistent headers/footers
  - Page numbers in footer: "Page X of Y"
  - "CONFIDENTIAL" in header
  - Section headers with MERIDIAN blue accent bar
  - Findings tables with severity color coding
  - Score gauges rendered as SVGs embedded in the PDF
  - Charts: render as SVG or PNG and embed
    - Radar chart for pillar scores
    - Bar chart for finding severity distribution
    - Gantt-style chart for integration timeline
  - Tables with alternating row colors

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 4 — IC PRESENTATION DECK (PowerPoint)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generate a PowerPoint suitable for an investment committee presentation.

Use the "pptxgenjs" npm package (install it) to create the .pptx file.

STEP A — AI CONTENT GENERATION:
"""
Create slide content for a 12-15 slide IC presentation on this deal:

{full_deal_data}

Each slide should have:
- Title (max 8 words)
- Subtitle or section label
- 3-5 bullet points (max 15 words each) — concise, impactful
- Speaker notes (2-3 sentences for the presenter)

Slides:
1. Title slide: deal name, prepared for org, date, CONFIDENTIAL
2. Executive Assessment: go/no-go, key number, one-line verdict
3. Target Overview: company profile, scale, IT landscape summary
4. Composite Risk Score: score visualization, what it means
5. Critical Findings: top 3-5 findings with cost impacts
6. Infrastructure Assessment: key strengths and weaknesses
7. Cybersecurity Posture: current state, gaps, risks
8. Compliance Status: regulatory posture, gaps, exposure
9. Integration Complexity: systems, timeline factors
10. Technology Stack: current vs. baseline alignment
11. Integration Roadmap: phased approach, timeline, milestones
12. Cost Summary: total estimate, breakdown by category, range
13. Risk Factors: what could go wrong, mitigations
14. Recommendations: clear next steps, conditions, priorities
15. Appendix: methodology, document sources, glossary

Respond as JSON array of slide objects.
"""

STEP B — PPTX ASSEMBLY:
Use pptxgenjs to create a professional deck:

SLIDE MASTER (apply to all slides):
  - Background: white (#FFFFFF)
  - Header bar: thin MERIDIAN blue (#3B82F6) line at top
  - Footer: "CONFIDENTIAL | {org_name} | {date}" in small gray text
  - Slide number: bottom right corner
  - MERIDIAN logo: small, bottom left

SLIDE DESIGN:
  - Title text: 28pt, dark navy (#1a1a2e), bold
  - Subtitle: 16pt, gray (#666)
  - Body bullets: 14pt, dark gray (#333)
  - Data callouts: large bold numbers in MERIDIAN blue
  - Severity badges: colored rectangles with white text
  - Charts: embed as images (render server-side to PNG)
    - Radar chart on score slide
    - Bar chart on findings slide
    - Timeline on roadmap slide
  - Tables: clean, alternating rows, thin borders
  - Speaker notes: included on each slide

SPECIAL SLIDES:
  - Score slide: large circular gauge graphic (rendered as image)
  - Findings slide: colored severity blocks (visual impact)
  - Cost slide: stacked bar chart
  - Roadmap slide: horizontal phase timeline graphic

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 5 — REPORT GENERATION UI
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Add a "Reports" section accessible from the deal view. Add a document 
icon (📄) to the sidebar navigation, below Simulator and above Portfolio.

Or, add it as a floating action button on any deal-scoped view:
  "Export Report" button (blue, with download icon) in the top-right header

REPORT GENERATION PAGE / MODAL:
When clicked, show a report generation interface:

"Generate Report for {deal_name}"

Three report format cards to choose from:

┌─────────────────────────────────────────────────────────────────┐
│  📋 Executive Summary          📊 Full Report        🎬 IC Deck │
│                                                                 │
│  2-5 pages                    20-40 pages           12-15 slides│
│  PDF                          PDF                   PowerPoint  │
│  Key findings + rec.          Complete assessment   Presentation│
│                                                                 │
│  [ Generate ]                 [ Generate ]          [ Generate ] │
└─────────────────────────────────────────────────────────────────┘

Optional settings (collapsible "Options" panel):
  - Include cost analysis: toggle (default: on if playbook exists)
  - Include simulation results: toggle (default: on if scenarios exist)
  - Include tech stack detail: toggle (default: on if extracted)
  - Confidentiality level: dropdown (Confidential, Internal Only, 
    Client-Ready)
  - Custom footer text: text input (defaults to org name)
  - Preparer name: text input (defaults to logged-in user name)

GENERATION FLOW:
1. User clicks "Generate"
2. Show progress:
   "Generating Executive Summary..."
   "Step 1 of 4: Compiling deal data..."
   "Step 2 of 4: Generating content..."
   "Step 3 of 4: Assembling PDF..."
   "Step 4 of 4: Finalizing..."
3. On success: show preview + download button:
   
   ┌─────────────────────────────────────┐
   │  ✅ Report Generated                │
   │                                     │
   │  📄 Northwind-Medical-Executive-    │
   │     Summary-2026-02-20.pdf          │
   │     5 pages • 234 KB                │
   │                                     │
   │  [ Preview ]  [ Download ]          │
   └─────────────────────────────────────┘

4. "Preview" opens the PDF in the DocumentPreview panel (from the 
   preview prompt) — rendered inline, not downloaded
5. "Download" triggers browser download

REPORT HISTORY:
Below the generation cards, show "Previous Reports":
  Table of all generated_reports for this deal:
  - Format icon (PDF/PPTX)
  - Filename
  - Pages/slides
  - Generated date
  - Generated by (user name)
  - File size
  - [ Preview ] [ Download ] [ Delete ] buttons

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 6 — PDF GENERATION TECHNICAL APPROACH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

For PDF generation, use this approach (most reliable in Replit):

Option A — HTML → PDF via Puppeteer:
1. Generate an HTML document with all report content
2. Style it with a print-optimized CSS stylesheet
3. Use Puppeteer to render to PDF with these settings:
   {
     format: 'Letter',
     margin: { top: '0.75in', bottom: '0.75in', left: '0.75in', right: '0.75in' },
     printBackground: true,
     displayHeaderFooter: true,
     headerTemplate: '<div style="font-size:8px;color:#999;width:100%;text-align:center;">CONFIDENTIAL</div>',
     footerTemplate: '<div style="font-size:8px;color:#999;width:100%;text-align:center;"><span class="pageNumber"></span> of <span class="totalPages"></span></div>'
   }

Option B — If Puppeteer doesn't work in Replit:
Use "pdf-lib" (lighter weight, no browser needed):
1. Create PDF document programmatically
2. Add pages with text, tables, and embedded images
3. More manual but works everywhere

Option C — HTML file as fallback:
If PDF generation proves too complex:
1. Generate a beautifully formatted .html file
2. Include print CSS so it prints perfectly
3. User can open in browser and print to PDF

For ALL options: save the generated file to the uploads/reports directory 
and record it in generated_reports table.

For charts in PDFs: render charts as SVG strings server-side using a 
minimal chart library, then embed as images.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PART 7 — POWERPOINT TECHNICAL APPROACH
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Install: npm install pptxgenjs

Use pptxgenjs API:
const pptx = new PptxGenJS();

// Set defaults
pptx.defineLayout({ name: 'LAYOUT_WIDE', width: 13.33, height: 7.5 });
pptx.layout = 'LAYOUT_WIDE';

// Add slides
const slide = pptx.addSlide();
slide.addText('Title', { x: 0.5, y: 0.5, fontSize: 28, color: '1a1a2e', bold: true });
slide.addText('Bullet point', { x: 0.5, y: 2, fontSize: 14, bullet: true });
slide.addImage({ path: chartImagePath, x: 6, y: 1, w: 6, h: 4 });
slide.addNotes('Speaker notes here');

// Save
const buffer = await pptx.write({ outputType: 'nodebuffer' });

For charts in slides: render as PNG images server-side and embed.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NAMING CONVENTION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Generated filenames:
  {target-name}-Executive-Summary-{YYYY-MM-DD}.pdf
  {target-name}-IT-Due-Diligence-Report-{YYYY-MM-DD}.pdf
  {target-name}-IC-Presentation-{YYYY-MM-DD}.pptx

Example:
  Northwind-Medical-Group-Executive-Summary-2026-02-20.pdf

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TESTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ ] Executive Summary generates a valid PDF (opens in browser/reader)
[ ] Executive Summary is 2-5 pages with all required sections
[ ] Full Report generates a valid PDF with table of contents
[ ] Full Report includes all 6 pillar deep dives
[ ] Full Report appendices list all findings, tech stack, documents
[ ] IC Deck generates a valid .pptx (opens in PowerPoint/Google Slides)
[ ] IC Deck has 12-15 slides with speaker notes
[ ] All reports pull real data (no placeholder content)
[ ] "CONFIDENTIAL" appears on every page/slide
[ ] Charts/gauges render correctly in PDFs and slides
[ ] Report history shows previously generated reports
[ ] Preview opens the report in the preview panel
[ ] Download triggers browser download with correct filename
[ ] Delete removes the report file and database record
[ ] Reports work even if playbook/simulator haven't been generated
   (those sections are omitted gracefully)
[ ] Generation shows progress and takes < 60 seconds
[ ] Audit log records report generation
```
