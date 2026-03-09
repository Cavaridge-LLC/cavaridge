# PROMPT 17: Infrastructure Intelligence — Wire to Real Data

> **Paste into Replit Agent.** Replaces the hardcoded Infrastructure view with
> one that pulls from uploaded documents, vision analysis, and AI extraction.
> Network topology, tech stack, and baseline alignment are all generated from
> real evidence in the deal's document corpus.

---

```
Rebuild the Infrastructure ("Infra") view so it pulls ALL data from the 
database — no hardcoded topology, tech stack, or baseline comparisons.

The current view has mock data from Prompt 5. Replace it entirely with a 
system that extracts infrastructure intelligence from uploaded documents 
and findings.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 1 — TECHNOLOGY STACK DETECTION (from documents)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Replace the hardcoded "Detected Technology Stack" with AI-extracted data.

DATABASE: Keep the existing "tech_stack_items" table (or create if missing):
  id, deal_id, category, item_name, version, status, notes, 
  confidence, source_document_id, created_at, updated_at

Categories (fixed list):
  - "Identity & Access"
  - "Networking"
  - "Security"
  - "Backup & DR"
  - "Productivity"
  - "EHR / Clinical" (healthcare deals)
  - "Line of Business Apps"
  - "Cloud Services"
  - "Endpoints"
  - "Telephony"
  - "Monitoring"
  - "Other"

AI EXTRACTION: Create POST /api/deals/[dealId]/extract-tech-stack that:
1. Gathers ALL extracted text and vision descriptions for the deal's documents
2. Sends to Claude with this prompt:

"""
You are analyzing IT due diligence documents for a mergers & acquisitions 
assessment. Extract every technology, product, platform, and service 
mentioned in the following document text.

For each technology detected, provide:
- category: one of [Identity & Access, Networking, Security, Backup & DR, 
  Productivity, EHR / Clinical, Line of Business Apps, Cloud Services, 
  Endpoints, Telephony, Monitoring, Other]
- item_name: the product/technology name
- version: version number if mentioned (null if not)
- status: "current", "eol" (end of life), "deprecated", or "unknown"
- notes: brief context (how it's used, any concerns mentioned)
- confidence: "high", "medium", or "low" based on how clearly it was stated

Respond as a JSON array. Deduplicate — if the same technology appears in 
multiple documents, combine the information into one entry with the highest 
confidence. Flag version conflicts if different documents show different 
versions.

Document text:
{combined_extracted_text}
"""

3. Parse the response and upsert into tech_stack_items
4. Link each item to the source document via source_document_id
5. Return the updated tech stack

UI — "Detected Technology Stack" card:
- Grouped by category (collapsible sections)
- Each item shows: name, version (if known), status badge, confidence indicator
- Status badges: current=green, eol=red, deprecated=amber, unknown=gray
- Confidence: high=solid dot, medium=half dot, low=outline dot
- Click an item to see: source document link (opens preview panel), 
  full notes, extraction confidence
- "Re-extract" button to re-run AI extraction
- "Add Manually" button to add items the AI missed

EMPTY STATE: If no documents uploaded or tech stack empty:
  "Upload IT assessment documents to auto-detect the technology stack."
  [Upload Documents] button linking to the Documents view

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 2 — NETWORK TOPOLOGY (AI-generated from documents)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Replace the hardcoded topology diagram with an AI-generated one.

DATABASE: Create table "topology_nodes":
  id, deal_id, node_type, label, sublabel, status, parent_node_id,
  position_x, position_y, metadata_json, source_document_id, created_at

node_type values:
  "acquirer", "target_hq", "facility", "datacenter", "cloud", 
  "firewall", "switch", "server", "wan_link", "vpn", "internet"

status values:
  "healthy" (green), "warning" (amber), "critical" (red), "unknown" (gray)

Create table "topology_connections":
  id, deal_id, from_node_id, to_node_id, connection_type, label, 
  bandwidth, status

connection_type: "wan", "lan", "vpn", "internet", "trunk", "fiber", "wireless"

AI EXTRACTION: Create POST /api/deals/[dealId]/extract-topology that:
1. Gathers document text + image vision descriptions (especially network 
   diagrams, topology images, config files)
2. Sends to Claude:

"""
You are analyzing IT infrastructure documents for an M&A assessment. 
Reconstruct the network topology from the information provided.

Identify:
- Facilities/sites (name, location if mentioned, status)
- Network devices (firewalls, switches, routers — brand/model if mentioned)
- Servers and datacenters
- Cloud services
- WAN/Internet connections between sites
- VPN tunnels
- The acquirer's environment (if described)
- The target's environment

For each node, indicate:
- node_type: acquirer, target_hq, facility, datacenter, cloud, firewall, 
  switch, server, wan_link, vpn, internet
- label: display name
- sublabel: brief status note (e.g., "Flat network", "Segmented", "No MDF")
- status: healthy, warning, critical, unknown
- parent: what this connects up to (for hierarchy)

For each connection between nodes:
- from/to nodes
- connection type (wan, lan, vpn, etc.)
- bandwidth if mentioned
- status

Respond as JSON:
{
  "nodes": [...],
  "connections": [...],
  "summary": "Brief topology description"
}

If information is insufficient, provide what you can and mark unknowns.

Document text:
{combined_text}
"""

3. Parse and store in topology_nodes and topology_connections
4. Auto-assign positions (simple layered layout — acquirer at top, 
   target HQ below, facilities in a row at bottom)

UI — "Network Topology" card:
- Visual diagram built with styled HTML/CSS (same approach as Prompt 5 but 
  data-driven):
  - Top layer: Acquirer environment (blue border/glow)
  - Connection lines (dashed = VPN, solid = direct)
  - Middle: Target HQ / main infrastructure (amber border)
  - Bottom row: Facility boxes, color-coded by status
  - Each node is clickable — shows details + source document link
- If topology data is empty: show "Analyze documents to generate topology"
  with a "Generate Topology" button
- "Regenerate" button to re-run AI extraction
- Subtle dot-grid background pattern (same as Prompt 5)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SECTION 3 — ACQUIRER BASELINE ALIGNMENT (from baseline profiles)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Replace the hardcoded baseline comparison with one that compares the 
detected tech stack against the org's baseline profile.

AI COMPARISON: Create POST /api/deals/[dealId]/compare-baseline that:
1. Loads the org's default baseline profile (from baseline_profiles table)
2. Loads the deal's detected tech stack items
3. Sends to Claude:

"""
Compare this target company's detected IT environment against the acquirer's 
baseline standards. Identify gaps.

Acquirer Baseline Standards:
{baseline_profile_data}

Target Detected Technology:
{tech_stack_items}

Target Findings:
{findings_summary}

For each baseline requirement, assess:
- standard_name: the acquirer's requirement
- current_state: what the target currently has
- gap_severity: critical, high, medium, low, or "aligned" (meets standard)
- remediation_note: brief note on what's needed to close the gap
- estimated_cost: rough cost estimate if possible

Respond as a JSON array sorted by gap_severity (critical first).
"""

3. Store results in baseline_comparisons table (keep existing schema, 
   add: remediation_note, estimated_cost, source_document_id)

UI — "Acquirer Baseline Alignment" card:
- Table layout matching Prompt 5's design
- Standard column (green text)
- Current State column (muted text)  
- Gap severity badge (same colors as findings)
- Remediation note (expandable)
- Estimated cost (if available)
- "Recalculate" button to re-run comparison
- Summary at top: "X of Y standards aligned" with a progress bar

EMPTY STATE: If no baseline profile exists:
  "Set up your acquirer baseline profile in Settings to enable gap analysis."

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
AUTO-EXTRACTION TRIGGER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

When a user navigates to the Infra view for a deal that has:
- Documents uploaded but NO tech stack items extracted yet
Show a prominent banner:

  "Infrastructure analysis not yet generated for this deal."
  "MERIDIAN can analyze your 57 uploaded documents to detect technologies, 
   reconstruct the network topology, and compare against your baseline."
  [ Generate Infrastructure Analysis ] (blue button)

Clicking it runs all three extractions sequentially:
1. Tech stack → 2. Topology → 3. Baseline comparison

Show progress: "Step 1 of 3: Extracting technology stack..."

After all extractions complete, the view populates with real data.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TESTING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ ] Tech stack shows items extracted from real documents
[ ] Each tech stack item links to its source document
[ ] Topology diagram renders nodes and connections from AI extraction
[ ] Facility nodes are color-coded by status
[ ] Baseline comparison shows gaps against the org's profile
[ ] All three sections have empty states with actionable CTAs
[ ] "Generate Infrastructure Analysis" runs all 3 extractions
[ ] Re-extract buttons work for each section independently
[ ] Manual "Add" option works for tech stack items
[ ] No hardcoded data remains from Prompt 5
```
