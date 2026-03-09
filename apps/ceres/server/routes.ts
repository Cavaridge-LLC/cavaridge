import type { Express } from "express";
import { type Server } from "http";
import OpenAI from "openai";
import { addDays, startOfDay, nextSaturday, isSaturday, differenceInCalendarDays, format, isValid } from "date-fns";

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

function calculateWeeks(socDateStr: string) {
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

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.post("/api/scan-schedule", async (req, res) => {
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

  return httpServer;
}
