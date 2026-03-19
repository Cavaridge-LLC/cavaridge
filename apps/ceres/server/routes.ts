import type { Express } from "express";
import { type Server } from "http";
import { requireAuth } from "./services/auth";
import { db } from "./db";
import { calculatorResults, scanResults } from "@shared/schema";
import { eq, and, desc } from "drizzle-orm";
import OpenAI from "openai";
import { addDays, startOfDay, nextSaturday, isSaturday, differenceInCalendarDays, isValid } from "date-fns";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

// ---------------------------------------------------------------------------
// Deterministic calculator helpers (NO LLM dependency)
// ---------------------------------------------------------------------------

export function calculateWeeks(socDateStr: string) {
  const soc = startOfDay(new Date(socDateStr + "T00:00:00"));
  const endDate = addDays(soc, 59);
  const weeks: { weekNumber: number; startDate: Date; endDate: Date; dayStart: number; dayEnd: number }[] = [];

  let current = soc;
  let weekNum = 1;

  while (current <= endDate) {
    let weekEnd: Date;
    if (isSaturday(current)) {
      weekEnd = current;
    } else {
      weekEnd = nextSaturday(current);
    }
    if (weekEnd > endDate) weekEnd = endDate;

    const dayStart = differenceInCalendarDays(current, soc) + 1;
    const dayEnd = differenceInCalendarDays(weekEnd, soc) + 1;

    weeks.push({ weekNumber: weekNum, startDate: current, endDate: weekEnd, dayStart, dayEnd });
    current = addDays(weekEnd, 1);
    weekNum++;
  }

  return weeks;
}

// ---------------------------------------------------------------------------
// Route registration
// ---------------------------------------------------------------------------

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  // =========================================================================
  // EMR Schedule Scanner (existing — now with tenant-scoped scan result save)
  // =========================================================================

  app.post("/api/scan-schedule", requireAuth, async (req, res) => {
    try {
      const { image, socDate: providedSocDate } = req.body;

      if (!image) {
        return res.status(400).json({ error: "Image (base64) is required" });
      }

      const imageUrl = image.startsWith("data:") ? image : `data:image/png;base64,${image}`;

      const detectResponse = await openai.chat.completions.create({
        model: "openai/gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a clinical home health scheduling expert. You analyze images of EMR (Electronic Medical Record) schedules from systems like WellSky (formerly Kinnser), HomeCare HomeBase (HCHB), Axxess, MatrixCare, Brightree, and others.

Your task is to extract TWO things from this schedule image:

1. **SOC (Start of Care) date**: The SOC date is the FIRST highlighted/colored/shaded date on the calendar grid — this is the actual first visit date.
   CRITICAL: Do NOT use the episode date range header as the SOC date. In WellSky/Kinnser, the header shows the episode range (e.g., "02/19/2026 - 04/19/2026") but the SOC is the first COLORED/SHADED cell on the calendar, which may be a different date (often 1 day later). The SOC = first colored date, NOT the episode range start.
   - If you see a label like "SOC", "Start of Care", or "Admission" on a specific date, use that date.
   - Otherwise, find the earliest highlighted/shaded/colored cell on the calendar — that is the SOC.

2. **Visit dates**: Identify every date that has a visit scheduled. Look for:
   - Highlighted, colored, or shaded calendar cells — any cell with a darker/different background color compared to empty white cells
   - Checkmarks, dots, or markers on specific dates
   - Visit type codes (SN, PT, OT, ST, MSW, HHA) on dates
   - In WellSky/Kinnser: visits appear as shaded/highlighted cells (blue, gray, or colored background) on the calendar grid. Empty/white cells = no visit.

IMPORTANT: Count ALL highlighted/shaded dates as visits. The SOC date itself is also a visit. In WellSky, the calendar shows months side by side with Sun-Sat columns. Any cell with a non-white background = scheduled visit.

Respond ONLY with valid JSON:
{
  "socDate": "YYYY-MM-DD",
  "visitDates": ["YYYY-MM-DD", "YYYY-MM-DD", ...],
  "emrSystem": "WellSky" | "HCHB" | "Axxess" | "Other" | "Unknown",
  "notes": "Brief description of what you see",
  "confidence": "high" | "medium" | "low"
}`
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Please analyze this EMR schedule image. Extract the SOC (Start of Care) date and all scheduled visit dates. Look carefully at any episode date range shown in the header."
              },
              {
                type: "image_url",
                image_url: { url: imageUrl }
              }
            ]
          }
        ],
        max_tokens: 1500,
      });

      const detectContent = detectResponse.choices[0]?.message?.content || "";
      const detectJson = detectContent.match(/\{[\s\S]*\}/);
      if (!detectJson) {
        return res.status(500).json({ error: "Could not parse AI response" });
      }

      const detected = JSON.parse(detectJson[0]);

      if (!detected.socDate) {
        return res.status(500).json({ error: "Could not detect SOC date from image" });
      }

      const socDate = detected.socDate;
      const socDateObj = new Date(socDate + "T00:00:00");
      if (!isValid(socDateObj)) {
        return res.status(500).json({ error: "AI returned invalid SOC date" });
      }

      const weeks = calculateWeeks(socDate);
      const weekCount = weeks.length;

      const visits = Array(weekCount).fill(0);

      if (Array.isArray(detected.visitDates)) {
        for (const dateStr of detected.visitDates) {
          const visitDate = startOfDay(new Date(dateStr + "T00:00:00"));
          if (!isValid(visitDate)) continue;

          const dayNum = differenceInCalendarDays(visitDate, socDateObj) + 1;
          if (dayNum < 1 || dayNum > 60) continue;

          for (let i = 0; i < weeks.length; i++) {
            if (dayNum >= weeks[i].dayStart && dayNum <= weeks[i].dayEnd) {
              visits[i]++;
              break;
            }
          }
        }
      }

      // Persist scan result (tenant-scoped) if user is authenticated with a tenant
      const user = req.user as any;
      const tenantId = (req as any).tenantId;
      if (user?.id && tenantId) {
        try {
          await db.insert(scanResults).values({
            tenantId,
            userId: user.id,
            socDate,
            visits,
            visitDates: detected.visitDates || [],
            emrSystem: detected.emrSystem || "Unknown",
            confidence: detected.confidence || "medium",
            aiNotes: detected.notes || "",
          });
        } catch (saveErr) {
          // Non-blocking — scan result save failures should not break the API response
          console.error("Failed to save scan result:", saveErr);
        }
      }

      res.json({
        socDate,
        visits,
        visitDates: detected.visitDates || [],
        notes: detected.notes || "",
        emrSystem: detected.emrSystem || "Unknown",
        confidence: detected.confidence || "medium",
      });
    } catch (error: any) {
      console.error("Error scanning schedule:", error);
      res.status(500).json({ error: error.message || "Failed to scan schedule" });
    }
  });

  // =========================================================================
  // Calculator Results — CRUD (tenant-scoped)
  // =========================================================================

  /** Save a calculator result */
  app.post("/api/calculator-results", requireAuth, async (req, res) => {
    try {
      const user = req.user as any;
      const tenantId = (req as any).tenantId;
      if (!tenantId) {
        return res.status(403).json({ error: "Tenant context required" });
      }

      const { patientRef, socDate, visits, frequencyStr, totalVisits, period1Visits, period2Visits, notes } = req.body;

      if (!socDate || !visits || totalVisits === undefined) {
        return res.status(400).json({ error: "socDate, visits, and totalVisits are required" });
      }

      const [result] = await db.insert(calculatorResults).values({
        tenantId,
        userId: user.id,
        patientRef,
        socDate,
        visits,
        frequencyStr,
        totalVisits,
        period1Visits,
        period2Visits,
        notes,
      }).returning();

      res.status(201).json(result);
    } catch (error: any) {
      console.error("Error saving calculator result:", error);
      res.status(500).json({ error: error.message || "Failed to save result" });
    }
  });

  /** List calculator results for the current tenant */
  app.get("/api/calculator-results", requireAuth, async (req, res) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) {
        return res.status(403).json({ error: "Tenant context required" });
      }

      const results = await db
        .select()
        .from(calculatorResults)
        .where(eq(calculatorResults.tenantId, tenantId))
        .orderBy(desc(calculatorResults.createdAt))
        .limit(100);

      res.json(results);
    } catch (error: any) {
      console.error("Error listing calculator results:", error);
      res.status(500).json({ error: error.message || "Failed to list results" });
    }
  });

  /** Get a single calculator result (tenant-scoped) */
  app.get("/api/calculator-results/:id", requireAuth, async (req, res) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) {
        return res.status(403).json({ error: "Tenant context required" });
      }

      const [result] = await db
        .select()
        .from(calculatorResults)
        .where(and(
          eq(calculatorResults.id, req.params.id),
          eq(calculatorResults.tenantId, tenantId),
        ));

      if (!result) {
        return res.status(404).json({ error: "Result not found" });
      }

      res.json(result);
    } catch (error: any) {
      console.error("Error getting calculator result:", error);
      res.status(500).json({ error: error.message || "Failed to get result" });
    }
  });

  /** Delete a calculator result (tenant-scoped) */
  app.delete("/api/calculator-results/:id", requireAuth, async (req, res) => {
    try {
      const tenantId = (req as any).tenantId;
      if (!tenantId) {
        return res.status(403).json({ error: "Tenant context required" });
      }

      const [deleted] = await db
        .delete(calculatorResults)
        .where(and(
          eq(calculatorResults.id, req.params.id),
          eq(calculatorResults.tenantId, tenantId),
        ))
        .returning();

      if (!deleted) {
        return res.status(404).json({ error: "Result not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Error deleting calculator result:", error);
      res.status(500).json({ error: error.message || "Failed to delete result" });
    }
  });

  // =========================================================================
  // CMS/Medicare Domain Agent Routes (Layer 1 — Ducky -> Spaniel)
  //
  // These supplementary features route through the CMS/Medicare domain agent
  // for regulation lookup, LCD/NCD reference, and compliance guidance.
  // The core calculator remains deterministic (no LLM).
  // =========================================================================

  /** Regulation lookup — queries CMS/Medicare domain knowledge */
  app.post("/api/cms/regulation-lookup", requireAuth, async (req, res) => {
    try {
      const { query, regulationType } = req.body;

      if (!query) {
        return res.status(400).json({ error: "query is required" });
      }

      // Route through OpenRouter (will be replaced by Ducky -> Spaniel pipeline)
      const systemPrompt = `You are the CMS/Medicare Domain Agent for Cavaridge's Ceres platform. You are an expert on Medicare home health regulations, including:
- 42 CFR Part 409 (Home Health Services)
- 42 CFR Part 424 (Conditions for Medicare Payment)
- PDGM (Patient-Driven Groupings Model)
- Medicare Conditions of Participation (CoPs)
- Local Coverage Determinations (LCDs) and National Coverage Determinations (NCDs)
- CMS Transmittals and Change Requests

When answering questions:
1. Always cite the specific CFR section, LCD/NCD number, or CMS guidance document
2. Distinguish between requirements (SHALL/MUST) and recommendations (SHOULD)
3. Note effective dates for any regulatory changes
4. Flag if guidance has been superseded or is pending update
${regulationType ? `Focus on ${regulationType} regulations.` : ""}

Respond in structured JSON:
{
  "answer": "Plain language answer",
  "citations": [{"source": "42 CFR §424.22", "title": "Requirements for Home Health Services", "relevance": "high"}],
  "effectiveDate": "YYYY-MM-DD or null",
  "confidence": "high" | "medium" | "low",
  "caveats": ["Any important limitations or pending changes"]
}`;

      const response = await openai.chat.completions.create({
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: query },
        ],
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        res.json(JSON.parse(jsonMatch[0]));
      } else {
        res.json({ answer: content, citations: [], confidence: "low", caveats: ["Response was not structured"] });
      }
    } catch (error: any) {
      console.error("CMS regulation lookup error:", error);
      res.status(500).json({ error: error.message || "Regulation lookup failed" });
    }
  });

  /** Compliance guidance — analyzes a visit schedule against CMS requirements */
  app.post("/api/cms/compliance-guidance", requireAuth, async (req, res) => {
    try {
      const { socDate, visits, discipline } = req.body;

      if (!socDate || !visits) {
        return res.status(400).json({ error: "socDate and visits are required" });
      }

      const totalVisits = visits.reduce((a: number, b: number) => a + b, 0);
      const weeks = calculateWeeks(socDate);

      // Calculate Period 1 and Period 2 visits
      let period1 = 0;
      let period2 = 0;
      for (let i = 0; i < weeks.length; i++) {
        if (weeks[i].dayEnd <= 30) {
          period1 += visits[i] || 0;
        } else if (weeks[i].dayStart > 30) {
          period2 += visits[i] || 0;
        } else {
          // Week spans the period boundary — split proportionally
          const daysInPeriod1 = 30 - weeks[i].dayStart + 1;
          const totalDaysInWeek = weeks[i].dayEnd - weeks[i].dayStart + 1;
          const ratio = daysInPeriod1 / totalDaysInWeek;
          const p1Visits = Math.round((visits[i] || 0) * ratio);
          period1 += p1Visits;
          period2 += (visits[i] || 0) - p1Visits;
        }
      }

      // Route through OpenRouter (will be replaced by Ducky -> Spaniel pipeline)
      const systemPrompt = `You are the CMS/Medicare Domain Agent providing compliance guidance for a home health visit schedule.

Schedule details:
- SOC Date: ${socDate}
- Discipline: ${discipline || "SN (Skilled Nursing)"}
- Total Visits: ${totalVisits}
- Period 1 Visits (Days 1-30): ${period1}
- Period 2 Visits (Days 31-60): ${period2}
- Weekly Distribution: ${visits.map((v: number, i: number) => `W${i + 1}:${v}`).join(", ")}

Evaluate this schedule against CMS requirements and best practices:
1. Front-loading compliance (visits should be heavier in Period 1 per PDGM)
2. Minimum visit frequency expectations for the discipline
3. Any red flags for audit risk
4. LUPA (Low Utilization Payment Adjustment) threshold warnings
5. Documentation requirements for this visit pattern

Respond in structured JSON:
{
  "overallCompliance": "compliant" | "warning" | "at_risk",
  "lupaRisk": "low" | "medium" | "high",
  "lupaThreshold": <number>,
  "frontLoadingScore": <0-100>,
  "findings": [{"category": "string", "severity": "info" | "warning" | "critical", "message": "string", "regulation": "string"}],
  "recommendations": ["string"],
  "period1Summary": {"visits": <number>, "assessment": "string"},
  "period2Summary": {"visits": <number>, "assessment": "string"}
}`;

      const response = await openai.chat.completions.create({
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Please evaluate this ${discipline || "SN"} visit schedule for CMS compliance.` },
        ],
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        // Attach deterministic calculations that don't need LLM
        parsed._deterministic = {
          totalVisits,
          period1Visits: period1,
          period2Visits: period2,
          weekCount: weeks.length,
          episodeEndDate: addDays(new Date(socDate + "T00:00:00"), 59).toISOString().split("T")[0],
        };
        res.json(parsed);
      } else {
        res.json({
          overallCompliance: "warning",
          findings: [{ category: "parse_error", severity: "warning", message: "Could not parse structured response", regulation: "N/A" }],
          recommendations: [content],
          _deterministic: { totalVisits, period1Visits: period1, period2Visits: period2 },
        });
      }
    } catch (error: any) {
      console.error("CMS compliance guidance error:", error);
      res.status(500).json({ error: error.message || "Compliance guidance failed" });
    }
  });

  /** LCD/NCD reference lookup */
  app.get("/api/cms/lcd-ncd", requireAuth, async (req, res) => {
    try {
      const { query, type } = req.query;

      if (!query) {
        return res.status(400).json({ error: "query parameter is required" });
      }

      // Route through OpenRouter (will be replaced by Ducky -> Spaniel pipeline)
      const systemPrompt = `You are the CMS/Medicare Domain Agent specializing in Local Coverage Determinations (LCDs) and National Coverage Determinations (NCDs) for home health services.

Given the user's query, provide relevant LCD/NCD information:
1. Document number and title
2. Contractor/jurisdiction (for LCDs)
3. Key coverage criteria
4. Effective and revision dates
5. Relevant ICD-10 codes if applicable
${type ? `Focus on ${type} documents.` : "Search both LCDs and NCDs."}

Respond in JSON:
{
  "documents": [
    {
      "type": "LCD" | "NCD",
      "number": "L12345 or 999.1",
      "title": "string",
      "contractor": "string or null",
      "summary": "string",
      "coverageCriteria": ["string"],
      "effectiveDate": "YYYY-MM-DD",
      "icd10Codes": ["string"]
    }
  ],
  "searchNotes": "string"
}`;

      const response = await openai.chat.completions.create({
        model: "openai/gpt-4o",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Find LCD/NCD documents related to: ${query}` },
        ],
        max_tokens: 2000,
      });

      const content = response.choices[0]?.message?.content || "";
      const jsonMatch = content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        res.json(JSON.parse(jsonMatch[0]));
      } else {
        res.json({ documents: [], searchNotes: content });
      }
    } catch (error: any) {
      console.error("LCD/NCD lookup error:", error);
      res.status(500).json({ error: error.message || "LCD/NCD lookup failed" });
    }
  });

  return httpServer;
}
