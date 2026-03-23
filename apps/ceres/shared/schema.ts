import { z } from "zod";

export const scanScheduleRequestSchema = z.object({
  image: z.string().min(1),
  socDate: z.string().min(1),
});

export const scanScheduleResponseSchema = z.object({
  visits: z.array(z.number()),
  visitDates: z.array(z.string()).optional(),
  socDate: z.string().optional(),
  notes: z.string(),
  emrSystem: z.string().optional(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type ScanScheduleRequest = z.infer<typeof scanScheduleRequestSchema>;
export type ScanScheduleResponse = z.infer<typeof scanScheduleResponseSchema>;

/** CMS/Medicare Domain Agent request schemas */
export const regulationLookupSchema = z.object({
  query: z.string().min(1),
  regulationType: z.enum(["cfr", "lcd", "ncd", "cms_guidance"]).optional(),
});

export const complianceGuidanceSchema = z.object({
  socDate: z.string(),
  visits: z.array(z.number()),
  discipline: z.enum(["SN", "PT", "OT", "ST", "MSW", "HHA"]).optional(),
});

export type RegulationLookupRequest = z.infer<typeof regulationLookupSchema>;
export type ComplianceGuidanceRequest = z.infer<typeof complianceGuidanceSchema>;
