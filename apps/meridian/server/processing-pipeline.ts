import { storage } from "./storage";
import { ingestDocument } from "./ingestion";
import { embedChunksForDeal } from "./embeddings";
import type { ProcessingQueueItem } from "@shared/schema";

const PARALLEL_LIMIT = 3;

const activeProcessing = new Map<string, boolean>();

const TIME_ESTIMATES: Record<string, number> = {
  pdf: 2000,
  docx: 1000,
  xlsx: 5000,
  xls: 5000,
  csv: 500,
  tsv: 500,
  pptx: 1500,
  eml: 800,
  msg: 800,
  txt: 300,
  zip: 10000,
};

function getExtension(filename: string): string {
  const parts = filename.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function estimateTimeMs(filename: string): number {
  const ext = getExtension(filename);
  return TIME_ESTIMATES[ext] || 1000;
}

export async function enqueueDocument(dealId: string, documentId: string): Promise<void> {
  const steps = ["extract", "classify", "chunk", "embed"];
  for (const step of steps) {
    await storage.createQueueItem({
      dealId,
      documentId,
      step,
      status: "queued",
    });
  }

  if (!activeProcessing.get(dealId)) {
    processQueue(dealId);
  }
}

export async function retryFailedItems(dealId: string): Promise<number> {
  const failed = await storage.getFailedQueueItems(dealId);
  let requeued = 0;
  for (const item of failed) {
    await storage.updateQueueItem(item.id, {
      status: "queued",
      errorMessage: null,
      completedAt: null,
    });
    requeued++;
  }
  if (requeued > 0 && !activeProcessing.get(dealId)) {
    processQueue(dealId);
  }
  return requeued;
}

async function processQueue(dealId: string): Promise<void> {
  if (activeProcessing.get(dealId)) return;
  activeProcessing.set(dealId, true);

  try {
    while (true) {
      const queued = await storage.getNextQueuedItems(dealId, PARALLEL_LIMIT);
      if (queued.length === 0) break;

      const grouped = new Map<string, ProcessingQueueItem[]>();
      for (const item of queued) {
        const key = item.documentId || "";
        if (!grouped.has(key)) grouped.set(key, []);
        grouped.get(key)!.push(item);
      }

      const docIds = Array.from(grouped.keys()).slice(0, PARALLEL_LIMIT);
      await Promise.allSettled(
        docIds.map(async (docId) => {
          const items = grouped.get(docId) || [];
          for (const item of items) {
            await processStep(item);
          }
        })
      );
    }
  } catch (err: any) {
    console.error(`Queue processing error for deal ${dealId}:`, err.message);
  } finally {
    activeProcessing.set(dealId, false);
  }
}

async function processStep(item: ProcessingQueueItem): Promise<void> {
  try {
    await storage.updateQueueItem(item.id, { status: "processing" });

    const doc = await storage.getDocument(item.documentId || "");
    if (!doc) {
      await storage.updateQueueItem(item.id, {
        status: "failed",
        errorMessage: "Document not found",
        completedAt: new Date(),
      });
      return;
    }

    switch (item.step) {
      case "extract":
      case "classify":
      case "chunk":
        if (doc.extractionStatus === "extracted") {
          await storage.updateQueueItem(item.id, {
            status: "complete",
            completedAt: new Date(),
          });
        } else if (doc.extractionStatus === "failed") {
          await storage.updateQueueItem(item.id, {
            status: "failed",
            errorMessage: doc.extractionError || "Extraction previously failed",
            completedAt: new Date(),
          });
        } else {
          await storage.updateQueueItem(item.id, {
            status: "complete",
            completedAt: new Date(),
          });
        }
        break;

      case "embed":
        try {
          const chunks = await storage.getChunksByDocument(doc.id);
          if (chunks.length === 0) {
            await storage.updateQueueItem(item.id, {
              status: "complete",
              completedAt: new Date(),
            });
            break;
          }
          await storage.updateQueueItem(item.id, {
            status: "complete",
            completedAt: new Date(),
          });
        } catch (err: any) {
          await storage.updateQueueItem(item.id, {
            status: "failed",
            errorMessage: err.message || "Embedding failed",
            completedAt: new Date(),
          });
        }
        break;

      default:
        await storage.updateQueueItem(item.id, {
          status: "complete",
          completedAt: new Date(),
        });
    }
  } catch (err: any) {
    console.error(`Step ${item.step} failed for doc ${item.documentId}:`, err.message);
    await storage.updateQueueItem(item.id, {
      status: "failed",
      errorMessage: err.message || "Unknown error",
      completedAt: new Date(),
    });
  }
}

export interface QueueStatus {
  totalFiles: number;
  completedFiles: number;
  activeFiles: number;
  failedFiles: number;
  items: Array<{
    documentId: string;
    filename: string;
    currentStep: string;
    stepStatus: string;
    errorMessage: string | null;
    estimatedTimeMs: number;
    steps: Array<{
      step: string;
      status: string;
      errorMessage: string | null;
    }>;
  }>;
  errors: Array<{
    documentId: string;
    filename: string;
    step: string;
    error: string;
  }>;
  estimatedRemainingMs: number;
}

export async function getQueueStatus(dealId: string): Promise<QueueStatus> {
  const items = await storage.getQueueItemsByDeal(dealId);
  if (items.length === 0) {
    return {
      totalFiles: 0,
      completedFiles: 0,
      activeFiles: 0,
      failedFiles: 0,
      items: [],
      errors: [],
      estimatedRemainingMs: 0,
    };
  }

  const byDoc = new Map<string, ProcessingQueueItem[]>();
  for (const item of items) {
    const key = item.documentId || "";
    if (!byDoc.has(key)) byDoc.set(key, []);
    byDoc.get(key)!.push(item);
  }

  const docs = await Promise.all(
    Array.from(byDoc.keys()).map((id) => storage.getDocument(id))
  );
  const docMap = new Map(docs.filter(Boolean).map((d) => [d!.id, d!]));

  const fileStatuses: QueueStatus["items"] = [];
  const errors: QueueStatus["errors"] = [];
  let completedFiles = 0;
  let failedFiles = 0;
  let activeFiles = 0;
  let estimatedRemainingMs = 0;

  const docIds = Array.from(byDoc.keys());
  for (const docId of docIds) {
    const docItems = byDoc.get(docId) || [];
    const doc = docMap.get(docId);
    const filename = doc?.filename || "unknown";
    const sorted = docItems.sort((a: ProcessingQueueItem, b: ProcessingQueueItem) => {
      const order = ["extract", "classify", "chunk", "embed"];
      return order.indexOf(a.step) - order.indexOf(b.step);
    });

    const allComplete = sorted.every((i: ProcessingQueueItem) => i.status === "complete");
    const hasFailed = sorted.some((i: ProcessingQueueItem) => i.status === "failed");
    const currentItem = sorted.find((i: ProcessingQueueItem) => i.status === "processing" || i.status === "queued") || sorted[sorted.length - 1];

    if (allComplete) {
      completedFiles++;
    } else if (hasFailed) {
      failedFiles++;
    } else {
      activeFiles++;
      const remainingSteps = sorted.filter((i: ProcessingQueueItem) => i.status === "queued" || i.status === "processing");
      estimatedRemainingMs += remainingSteps.length * estimateTimeMs(filename);
    }

    for (const item of sorted) {
      if (item.status === "failed" && item.errorMessage) {
        errors.push({
          documentId: docId,
          filename,
          step: item.step,
          error: item.errorMessage,
        });
      }
    }

    fileStatuses.push({
      documentId: docId,
      filename,
      currentStep: currentItem.step,
      stepStatus: currentItem.status,
      errorMessage: currentItem.errorMessage,
      estimatedTimeMs: estimateTimeMs(filename),
      steps: sorted.map((s: ProcessingQueueItem) => ({
        step: s.step,
        status: s.status,
        errorMessage: s.errorMessage,
      })),
    });
  }

  return {
    totalFiles: byDoc.size,
    completedFiles,
    activeFiles,
    failedFiles,
    items: fileStatuses,
    errors,
    estimatedRemainingMs,
  };
}

export interface EnhancedDocStats {
  totalFiles: number;
  analyzed: number;
  failed: number;
  chunksIndexed: number;
  chunksWithEmbeddings: number;
  pending: number;
  totalTextLength: number;
  classificationBreakdown: Record<string, number>;
}

export async function getEnhancedDocStats(dealId: string): Promise<EnhancedDocStats> {
  const docs = await storage.getDocumentsByDeal(dealId);
  const chunksIndexed = await storage.getChunkCountByDeal(dealId);
  const totalTextLength = await storage.getTotalTextLength(dealId);
  let chunksWithEmbeddings = 0;
  try {
    chunksWithEmbeddings = await storage.getEmbeddedChunkCount(dealId);
  } catch {
    // embedding column might not exist yet
  }

  const classificationBreakdown: Record<string, number> = {};
  for (const doc of docs) {
    const cls = doc.classification || "Unclassified";
    classificationBreakdown[cls] = (classificationBreakdown[cls] || 0) + 1;
  }

  return {
    totalFiles: docs.length,
    analyzed: docs.filter((d) => d.extractionStatus === "extracted" || d.extractionStatus === "stored").length,
    failed: docs.filter((d) => d.extractionStatus === "failed").length,
    chunksIndexed,
    chunksWithEmbeddings,
    pending: docs.filter((d) => d.extractionStatus === "pending" || d.extractionStatus === "extracting").length,
    totalTextLength,
    classificationBreakdown,
  };
}
