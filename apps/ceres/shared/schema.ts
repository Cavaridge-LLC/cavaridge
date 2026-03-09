import { z } from "zod";

export const scanScheduleRequestSchema = z.object({
  image: z.string().min(1),
  socDate: z.string().min(1),
});

export const scanScheduleResponseSchema = z.object({
  visits: z.array(z.number()).length(9),
  notes: z.string(),
  confidence: z.enum(["high", "medium", "low"]),
});

export type ScanScheduleRequest = z.infer<typeof scanScheduleRequestSchema>;
export type ScanScheduleResponse = z.infer<typeof scanScheduleResponseSchema>;
