import sharp from "sharp";
import { getOpenRouterClient, hasAICapability } from "./openrouter";
import { getModel } from "./llm-config";

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "tiff", "webp"]);
const MIN_IMAGE_SIZE = 5 * 1024;
const MAX_IMAGE_SIZE = 20 * 1024 * 1024;
const MAX_DIMENSION = 1024;

export const CLASSIFICATION_TO_PILLAR: Record<string, string> = {
  "Network Documentation": "Infrastructure & Architecture",
  "Security Assessment": "Cybersecurity Posture",
  "Compliance Documentation": "Regulatory Compliance",
  "Asset Inventory": "Infrastructure & Architecture",
  "Identity & Access": "Cybersecurity Posture",
  "Backup & DR": "Infrastructure & Architecture",
  "Clinical Systems": "Integration Complexity",
  "OT/ICS Systems": "Integration Complexity",
  "IT Financial": "Technology Org & Talent",
  "Organization & Staffing": "Technology Org & Talent",
  "Application Inventory": "Integration Complexity",
  "IT Policy": "Cybersecurity Posture",
  "Vendor Contract": "Integration Complexity",
};

export function isImageFile(filename: string): boolean {
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return IMAGE_EXTENSIONS.has(ext);
}

export function checkImageSize(size: number): { ok: boolean; reason?: string; status?: string } {
  if (size < MIN_IMAGE_SIZE) {
    return { ok: false, reason: "Image too small (< 5KB) — likely an icon or favicon", status: "skipped_too_small" };
  }
  if (size > MAX_IMAGE_SIZE) {
    return { ok: false, reason: "Image too large (> 20MB)", status: "skipped_too_large" };
  }
  return { ok: true };
}
const VISION_PROMPT = `Analyze this IT infrastructure image for M&A due diligence purposes.

Provide your analysis as a JSON object with:
{
  "description": "What does this image show? Be specific about any IT systems, network diagrams, hardware, software interfaces, etc.",
  "classification": "One of: network_diagram, server_rack, screenshot, dashboard, architecture_diagram, physical_infrastructure, other",
  "findings": [
    {
      "observation": "What you see that's relevant to IT due diligence",
      "risk_relevance": "Why this matters for an acquisition",
      "severity": "critical|high|medium|low"
    }
  ],
  "extracted_text": "Any visible text in the image (IP addresses, hostnames, versions, etc.)"
}

Be thorough but factual. Only report what you can actually see.`;

export interface VisionFinding {
  observation: string;
  risk_relevance: string;
  severity: string;
}

export interface VisionResult {
  description: string;
  classification: string;
  findings: VisionFinding[];
  extracted_text: string;
  provider: string;
}

function getImageMediaType(filename: string): string {
  const ext = filename.toLowerCase().split(".").pop();
  switch (ext) {
    case "png": return "image/png";
    case "gif": return "image/gif";
    case "webp": return "image/webp";
    default: return "image/jpeg";
  }
}

async function prepareImageBuffer(buffer: Buffer): Promise<Buffer> {
  try {
    const resized = await sharp(buffer)
      .resize(MAX_DIMENSION, MAX_DIMENSION, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 85 })
      .toBuffer();
    return resized;
  } catch (err: any) {
    console.error("Image resize failed, using original:", err.message);
    return buffer;
  }
}

function parseVisionResponse(text: string): Omit<VisionResult, "provider"> {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    const parsed = JSON.parse(jsonMatch[0]);
    return {
      description: parsed.description || "No description provided",
      classification: parsed.classification || "Unclassified",
      findings: Array.isArray(parsed.findings) ? parsed.findings.map((f: any) => ({
        observation: f.observation || "",
        risk_relevance: f.risk_relevance || "",
        severity: ["critical", "high", "medium", "low"].includes(f.severity) ? f.severity : "low",
      })) : [],
      extracted_text: parsed.extracted_text || "",
    };
  } catch (err: any) {
    return {
      description: text.slice(0, 500),
      classification: "Unclassified",
      findings: [],
      extracted_text: "",
    };
  }
}

async function analyzeWithVision(base64: string, mediaType: string, taskKey: "vision" | "visionFallback"): Promise<VisionResult> {
  const client = getOpenRouterClient();
  const model = getModel(taskKey);
  const providerName = model.split("/")[0] || "openrouter";

  const response = await client.chat.completions.create({
    model,
    max_tokens: 2000,
    messages: [{
      role: "user",
      content: [
        { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
        { type: "text", text: VISION_PROMPT },
      ],
    }],
  });

  const text = response.choices[0]?.message?.content || "";
  return { ...parseVisionResponse(text), provider: providerName };
}

export async function analyzeImage(buffer: Buffer, filename: string): Promise<VisionResult | null> {
  if (!hasAICapability()) return null;

  const prepared = await prepareImageBuffer(buffer);
  const base64 = prepared.toString("base64");
  const mediaType = getImageMediaType(filename);

  try {
    return await analyzeWithVision(base64, mediaType, "vision");
  } catch (err: any) {
    console.warn(`[vision] Primary model failed, trying fallback: ${err.message}`);
    try {
      return await analyzeWithVision(base64, mediaType, "visionFallback");
    } catch (fallbackErr: any) {
      console.error(`[vision] Fallback also failed: ${fallbackErr.message}`);
      return null;
    }
  }
}

export function hasVisionCapability(): boolean {
  return hasAICapability();
}
