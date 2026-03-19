import { storage, db, eq, inArray, dsql, and, ne, requireAuth, logAudit, verifyDealAccess, requirePerm, checkPlanLimit, incrementUsage, recalculateDealScores, type AuthenticatedRequest, documents, documentChunks, documentClassifications, findings, pillars, getAccessibleDeals, isPlatformRole, hasAccessToDeal } from "./_helpers";
import { ingestDocument, getDocumentStats, reprocessDocument, applyVisionResult } from "../ingestion";
import { analyzeImage, hasVisionCapability, checkImageSize, isImageFile } from "../vision";
import { ObjectStorageService } from "../services/object-storage";
import { embedChunksForDeal, getEmbeddingProgress, semanticSearch } from "../embeddings";
import { enqueueDocument, getQueueStatus, retryFailedItems, getEnhancedDocStats } from "../processing-pipeline";
import { generateImagePreview, generatePdfPreview, generateTextPreview, generateDocxPreview, generateXlsxPreview, generatePptxPreview, generateEmailPreview, getDocumentMetadata, getPreviewType, clearPreviewCache, getFileExtension } from "../preview";
import { type Express } from "express";

export function registerDocumentRoutes(app: Express) {
// ──────── DOCUMENTS (tenant scoped + deal access) ────────

app.get("/api/deals/:id/documents", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const docs = await storage.getDocumentsByDeal(req.params.id);
    res.json(docs);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch documents" });
  }
});

app.post("/api/deals/:id/documents", requireAuth as any, verifyDealAccess as any, requirePerm("upload_documents") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const dealId = req.params.id;
    const deal = await storage.getDeal(dealId);
    if (!deal) return res.status(404).json({ message: "Deal not found" });

    const { filename, fileType, fileSize, objectPath } = req.body;
    if (!filename || !objectPath) {
      return res.status(400).json({ message: "filename and objectPath are required" });
    }

    const [storageLimit, docLimit] = await Promise.all([
      checkPlanLimit(req.orgId!, "storage"),
      checkPlanLimit(req.orgId!, "documents", dealId),
    ]);
    if (!storageLimit.allowed) {
      return res.status(403).json({
        message: "Plan limit reached",
        limitType: "storage",
        current: storageLimit.current,
        limit: storageLimit.limit,
        planTier: storageLimit.planTier,
      });
    }
    if (!docLimit.allowed) {
      return res.status(403).json({
        message: "Plan limit reached",
        limitType: "documents",
        current: docLimit.current,
        limit: docLimit.limit,
        planTier: docLimit.planTier,
      });
    }

    const result = await ingestDocument(dealId, filename, fileType || "", fileSize || 0, objectPath);

    if (result.isDuplicate) {
      return res.status(200).json({ ...result.document, isDuplicate: true, message: "Duplicate file detected" });
    }

    if (result.document?.id) {
      enqueueDocument(dealId, result.document.id).catch((err: any) => {
        console.error("Auto-enqueue error:", err.message);
      });
    }

    await logAudit(req.orgId!, req.user!.id, "document_uploaded", "document", result.document?.id, { filename, dealName: deal.targetName }, req.ip || undefined);

    res.status(201).json(result.document);
  } catch (error: any) {
    console.error("Create document error:", error);
    res.status(500).json({ message: error.message || "Failed to create document" });
  }
});

app.get("/api/deals/:id/document-stats", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const stats = await getEnhancedDocStats(req.params.id);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch document stats" });
  }
});

app.get("/api/deals/:id/queue-status", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const status = await getQueueStatus(req.params.id);
    res.json(status);
  } catch (error) {
    res.status(500).json({ message: "Failed to fetch queue status" });
  }
});

app.post("/api/deals/:id/retry-failed", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const requeued = await retryFailedItems(req.params.id);
    res.json({ requeued, message: `${requeued} items re-queued for processing` });
  } catch (error) {
    res.status(500).json({ message: "Failed to retry failed items" });
  }
});

app.post("/api/documents/:docId/retry", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { docId } = req.params;
    const doc = await storage.getDocument(docId);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    const deal = await storage.getDeal(doc.dealId);
    if (!deal || deal.organizationId !== req.user!.organizationId) {
      return res.status(403).json({ message: "Access denied" });
    }
    const result = await reprocessDocument(docId);
    if (result.success) {
      res.json({ message: "Document reprocessed successfully" });
    } else {
      res.status(400).json({ message: result.error || "Reprocessing failed" });
    }
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to retry document" });
  }
});

// ──────── DOCUMENT CLASSIFICATIONS ────────

app.get("/api/deals/:id/classifications", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const classifications = await storage.getDocumentClassificationsByDeal(req.params.id);
    res.json(classifications);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch classifications" });
  }
});

app.get("/api/deals/:id/evidence-coverage", requireAuth as any, verifyDealAccess as any, async (req: AuthenticatedRequest, res) => {
  try {
    const classifications = await storage.getDocumentClassificationsByDeal(req.params.id);
    const coverage = {
      infrastructure: classifications.filter(c => c.pillarInfrastructure).length,
      security: classifications.filter(c => c.pillarSecurity).length,
      operations: classifications.filter(c => c.pillarOperations).length,
      compliance: classifications.filter(c => c.pillarCompliance).length,
      scalability: classifications.filter(c => c.pillarScalability).length,
      strategy: classifications.filter(c => c.pillarStrategy).length,
    };
    res.json(coverage);
  } catch (error: any) {
    res.status(500).json({ message: error.message || "Failed to fetch evidence coverage" });
  }
});

app.post("/api/deals/:dealId/documents/:docId/reclassify", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId, docId } = req.params;
    const deal = await storage.getDeal(dealId);
    if (!deal || deal.organizationId !== req.orgId) return res.status(404).json({ message: "Deal not found" });

    const doc = await storage.getDocument(docId);
    if (!doc || doc.dealId !== dealId) return res.status(404).json({ message: "Document not found" });

    const { classifyDocumentAI } = await import("../document-classifier");
    const result = await classifyDocumentAI(doc.filename, doc.fileType || "application/octet-stream", doc.extractedText || "");

    const existing = await storage.getDocumentClassification(docId);
    let classification;
    if (existing) {
      classification = await storage.updateDocumentClassification(existing.id, {
        documentType: result.documentType,
        pillarInfrastructure: result.pillars.infrastructure,
        pillarSecurity: result.pillars.security,
        pillarOperations: result.pillars.operations,
        pillarCompliance: result.pillars.compliance,
        pillarScalability: result.pillars.scalability,
        pillarStrategy: result.pillars.strategy,
        confidence: String(result.confidence),
        classificationReasoning: result.reasoning,
      });
    } else {
      classification = await storage.createDocumentClassification({
        documentId: docId,
        dealId,
        tenantId: deal.organizationId || "unknown",
        documentType: result.documentType,
        pillarInfrastructure: result.pillars.infrastructure,
        pillarSecurity: result.pillars.security,
        pillarOperations: result.pillars.operations,
        pillarCompliance: result.pillars.compliance,
        pillarScalability: result.pillars.scalability,
        pillarStrategy: result.pillars.strategy,
        confidence: String(result.confidence),
        classificationReasoning: result.reasoning,
      });
    }
    res.json(classification);
  } catch (error: any) {
    console.error("Reclassify failed:", error);
    res.status(500).json({ message: error.message || "Reclassification failed" });
  }
});

app.patch("/api/deals/:dealId/documents/:docId/classification", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId, docId } = req.params;
    const deal = await storage.getDeal(dealId);
    if (!deal || deal.organizationId !== req.orgId) return res.status(404).json({ message: "Deal not found" });

    const doc = await storage.getDocument(docId);
    if (!doc || doc.dealId !== dealId) return res.status(404).json({ message: "Document not found" });

    const { document_type, pillars, confidence } = req.body;
    if (!document_type) return res.status(400).json({ message: "document_type is required" });

    const existing = await storage.getDocumentClassification(docId);
    const data = {
      documentType: document_type,
      pillarInfrastructure: Boolean(pillars?.infrastructure),
      pillarSecurity: Boolean(pillars?.security),
      pillarOperations: Boolean(pillars?.operations),
      pillarCompliance: Boolean(pillars?.compliance),
      pillarScalability: Boolean(pillars?.scalability),
      pillarStrategy: Boolean(pillars?.strategy),
      confidence: String(confidence ?? 1.0),
      classificationReasoning: "Manual override",
    };

    let classification;
    if (existing) {
      classification = await storage.updateDocumentClassification(existing.id, data);
    } else {
      classification = await storage.createDocumentClassification({
        ...data,
        documentId: docId,
        dealId,
        tenantId: deal.organizationId || "unknown",
      });
    }
    res.json(classification);
  } catch (error: any) {
    console.error("Classification update failed:", error);
    res.status(500).json({ message: error.message || "Failed to update classification" });
  }
});

// ──────── DOCUMENT REPROCESS (tenant scoped + deal access) ────────

app.post("/api/documents/reprocess", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.body;
    if (!dealId) return res.status(400).json({ message: "dealId is required" });
    const deal = await storage.getDeal(dealId);
    if (!deal || deal.organizationId !== req.orgId) return res.status(404).json({ message: "Deal not found" });

    const docs = await storage.getDocumentsByDeal(dealId);
    const needsReprocess = docs.filter(
      (d) => d.extractionStatus === "stored" || d.extractionStatus === "pending" || d.extractionStatus === "failed"
    );

    let processed = 0;
    let failed = 0;
    let skippedImages = 0;

    for (const doc of needsReprocess) {
      const ext = (doc.fileType || doc.filename.split(".").pop() || "").toLowerCase();
      const imageExts = ["png", "jpg", "jpeg", "gif", "tiff", "bmp", "svg", "ico", "webp"];
      if (imageExts.includes(ext)) {
        if (doc.extractionStatus !== "stored") {
          await storage.updateDocument(doc.id, {
            extractionStatus: "stored",
            classification: doc.classification || "Unclassified",
          });
        }
        skippedImages++;
        continue;
      }

      const result = await reprocessDocument(doc.id);
      if (result.success) {
        processed++;
      } else {
        failed++;
      }
    }

    res.json({
      total: needsReprocess.length,
      processed,
      failed,
      skippedImages,
      message: `Reprocessed ${processed} documents, ${skippedImages} images marked as stored, ${failed} failed`,
    });
  } catch (error: any) {
    console.error("Reprocess error:", error);
    res.status(500).json({ message: error.message || "Reprocess failed" });
  }
});

// ──────── DOCUMENT DELETION (tenant scoped + deal access) ────────

app.get("/api/documents/:id/impact", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const doc = await storage.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    const deal = await storage.getDeal(doc.dealId!);
    if (!deal || deal.organizationId !== req.orgId) return res.status(403).json({ message: "Access denied" });

    const isArchiveParent = doc.filename.toLowerCase().endsWith(".zip") || doc.filename.toLowerCase().endsWith(".rar");
    const childDocs = isArchiveParent ? await storage.getChildDocuments(doc.id) : [];
    const allDocIds = [doc.id, ...childDocs.map((c) => c.id)];
    const allFilenames = [doc.filename, ...childDocs.map((c) => c.filename)];

    let totalChunks = 0;
    for (const did of allDocIds) {
      const chunks = await storage.getChunksByDocument(did);
      totalChunks += chunks.length;
    }

    const dealFindings = await storage.getFindingsByDeal(doc.dealId!);
    const autoFindings = dealFindings.filter((f) => {
      if (f.sourceDocumentId && allDocIds.includes(f.sourceDocumentId)) return true;
      if (f.sourceDocuments && f.sourceDocuments.some((s) => allFilenames.includes(s))) return true;
      if (f.description && f.description.includes("[Auto-detected from image analysis:")) {
        return allFilenames.some((fn) => f.description!.includes(fn));
      }
      return false;
    });

    const affectedPillarIds = new Set(autoFindings.map((f) => f.pillarId).filter(Boolean));
    const allPillars = await storage.getPillarsByDeal(doc.dealId!);
    const affectedPillarNames = allPillars
      .filter((p) => affectedPillarIds.has(p.id))
      .map((p) => p.pillarName);

    const chatMsgs = await storage.getChatMessagesByDeal(doc.dealId!);
    const chatCitationsAffected = chatMsgs.filter((m) =>
      allFilenames.some((fn) => m.content.includes(fn))
    ).length;

    const totalFileSize = [doc, ...childDocs].reduce((sum, d) => sum + (d.fileSize || 0), 0);

    const parentDoc = doc.parentArchiveId ? await storage.getDocument(doc.parentArchiveId) : null;

    res.json({
      document: {
        id: doc.id,
        filename: doc.filename,
        classification: doc.classification,
        text_length: doc.textLength || 0,
        extraction_status: doc.extractionStatus,
      },
      cascade: {
        chunks_to_delete: totalChunks,
        embeddings_to_delete: totalChunks,
        auto_findings_to_delete: autoFindings.length,
        auto_findings: autoFindings.map((f) => ({
          id: f.id,
          title: f.title,
          severity: f.severity,
          pillar: allPillars.find((p) => p.id === f.pillarId)?.pillarName || "Unknown",
          auto_generated: true,
        })),
        child_documents: childDocs.length,
        child_documents_list: childDocs.map((c) => ({ id: c.id, filename: c.filename })),
        chat_citations_affected: chatCitationsAffected,
        pillar_scores_affected: affectedPillarNames,
        file_size_bytes: totalFileSize,
      },
      score_impact: {
        current_composite_score: deal.compositeScore ? Number(deal.compositeScore) : null,
        estimated_new_score: null,
        note: "Score will be recalculated after deletion",
      },
      is_archive_parent: isArchiveParent && childDocs.length > 0,
      is_archive_child: !!doc.parentArchiveId,
      parent_archive: parentDoc ? { id: parentDoc.id, filename: parentDoc.filename } : null,
    });
  } catch (error: any) {
    console.error("Impact analysis error:", error);
    res.status(500).json({ message: error.message || "Failed to analyze impact" });
  }
});

app.get("/api/documents/:id/preview", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const doc = await storage.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const deal = await storage.getDeal(doc.dealId);
    if (!deal) return res.status(404).json({ message: "Deal not found" });

    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    if (!isPlatformRole(req.user.role)) {
      if (!req.orgId || deal.organizationId !== req.orgId) {
        return res.status(404).json({ message: "Deal not found" });
      }
      const canAccess = await hasAccessToDeal(req.user.id, deal.id, req.user.role as any);
      if (!canAccess) return res.status(403).json({ message: "Access denied" });
    }

    const size = (req.query.size as string) || "medium";
    const metaOnly = req.query.meta === "true";
    const previewType = getPreviewType(doc.filename, doc.fileType);

    if (previewType === "image" && !metaOnly) {
      const result = await generateImagePreview(doc, size);
      if (!result) return res.status(404).json({ message: "Image not available" });
      res.set({
        "Content-Type": result.contentType,
        "Cache-Control": "private, max-age=86400",
        "X-Preview-Type": "image",
      });
      return res.send(result.buffer);
    }

    if (previewType === "pdf" && !metaOnly) {
      const buffer = await generatePdfPreview(doc);
      if (!buffer) return res.status(404).json({ message: "PDF not available" });
      res.set({
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
      });
      return res.send(buffer);
    }

    const chunks = await storage.getChunksByDocument(doc.id);
    const allFindings = await storage.getFindingsByDeal(doc.dealId);
    const docFindings = allFindings.filter((f: any) =>
      f.sourceDocumentId === doc.id ||
      (f.sourceDocuments && (f.sourceDocuments as string).includes(doc.filename))
    );

    const metadata = getDocumentMetadata(doc, chunks.length, docFindings.length);

    if (metaOnly) {
      return res.json({ metadata, preview_type: previewType });
    }

    if (previewType === "text") {
      const result = await generateTextPreview(doc);
      if (!result) return res.json({ metadata, preview_type: previewType, content: "", language: "text" });
      return res.json({ metadata, preview_type: previewType, ...result });
    }

    if (previewType === "html") {
      const result = await generateDocxPreview(doc);
      if (!result) return res.json({ metadata, preview_type: previewType, html: "" });
      return res.json({ metadata, preview_type: previewType, ...result });
    }

    if (previewType === "spreadsheet") {
      const result = await generateXlsxPreview(doc);
      if (!result) return res.json({ metadata, preview_type: previewType, html: "", sheets: [] });
      return res.json({ metadata, preview_type: previewType, ...result });
    }

    if (previewType === "slides") {
      const result = await generatePptxPreview(doc);
      if (!result) return res.json({ metadata, preview_type: previewType, slides: [] });
      return res.json({ metadata, preview_type: previewType, ...result });
    }

    if (previewType === "email") {
      const result = await generateEmailPreview(doc);
      if (!result) return res.json({ metadata, preview_type: previewType });
      return res.json({ metadata, preview_type: previewType, ...result });
    }

    if (doc.extractedText) {
      return res.json({
        metadata,
        preview_type: "fallback",
        content: doc.extractedText,
        language: "text",
        source: "extracted_text",
        original_type: doc.fileType || getFileExtension(doc.filename),
      });
    }
    return res.json({ metadata, preview_type: "unsupported", extracted_text: null });
  } catch (error: any) {
    if (error.message === "Access denied") return res.status(403).json({ message: "Access denied" });
    console.error("[preview] Error:", error);
    res.status(500).json({ message: "Preview generation failed" });
  }
});

app.get("/api/documents/:id/metadata", requireAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const doc = await storage.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });

    const deal = await storage.getDeal(doc.dealId);
    if (!deal) return res.status(404).json({ message: "Deal not found" });

    if (!req.user) return res.status(401).json({ message: "Authentication required" });
    if (!isPlatformRole(req.user.role)) {
      if (!req.orgId || deal.organizationId !== req.orgId) {
        return res.status(404).json({ message: "Deal not found" });
      }
      const canAccess = await hasAccessToDeal(req.user.id, deal.id, req.user.role as any);
      if (!canAccess) return res.status(403).json({ message: "Access denied" });
    }

    const chunks = await storage.getChunksByDocument(doc.id);
    const allFindings = await storage.getFindingsByDeal(doc.dealId);
    const docFindings = allFindings.filter((f: any) =>
      f.sourceDocumentId === doc.id ||
      (f.sourceDocuments && (f.sourceDocuments as string).includes(doc.filename))
    );

    const metadata = getDocumentMetadata(doc, chunks.length, docFindings.length);
    const parentDoc = doc.parentArchiveId ? await storage.getDocument(doc.parentArchiveId) : null;

    res.json({
      ...metadata,
      deal_name: deal.targetName,
      parent_archive: parentDoc ? { id: parentDoc.id, filename: parentDoc.filename } : null,
      extracted_text: doc.extractedText || null,
      findings: docFindings.map((f: any) => ({
        id: f.id,
        title: f.title,
        severity: f.severity,
        description: f.description,
        status: f.status,
        pillar_id: f.pillarId,
        source_document_id: f.sourceDocumentId,
      })),
    });
  } catch (error: any) {
    if (error.message === "Access denied") return res.status(403).json({ message: "Access denied" });
    res.status(500).json({ message: "Failed to get document metadata" });
  }
});

async function cascadeDeleteDocuments(
  docIds: string[],
  opts: { deleteAutoFindings: boolean; userId: string; orgId: string }
): Promise<{
  documentsDeleted: number;
  chunksDeleted: number;
  findingsDeleted: number;
  findingsOrphaned: number;
  filesDeleted: number;
  bytesFreed: number;
  affectedPillarIds: Set<string>;
  affectedPillarNames: string[];
  dealId: string;
  oldCompositeScore: number | null;
  newCompositeScore: number | null;
  warnings: string[];
}> {
  if (docIds.length === 0) throw new Error("No documents to delete");

  const allDocs = await Promise.all(docIds.map((id) => storage.getDocument(id)));
  const validDocs = allDocs.filter(Boolean) as Exclude<typeof allDocs[number], undefined>[];
  if (validDocs.length === 0) throw new Error("No valid documents found");

  const dealId = validDocs[0]!.dealId!;
  const deal = await storage.getDeal(dealId);
  if (!deal) throw new Error("Deal not found");

  let allDocIdsToDelete = [...docIds];
  for (const doc of validDocs) {
    const isArchive = doc.filename.toLowerCase().endsWith(".zip") || doc.filename.toLowerCase().endsWith(".rar");
    if (isArchive) {
      const children = await storage.getChildDocuments(doc.id);
      for (const child of children) {
        if (!allDocIdsToDelete.includes(child.id)) {
          allDocIdsToDelete.push(child.id);
        }
      }
    }
  }

  const allDocsToDelete = await Promise.all(allDocIdsToDelete.map((id) => storage.getDocument(id)));
  const validDocsToDelete = allDocsToDelete.filter(Boolean) as Exclude<typeof allDocsToDelete[number], undefined>[];
  const allFilenames = validDocsToDelete.map((d) => d.filename);
  const oldCompositeScore = deal.compositeScore ? Number(deal.compositeScore) : null;

  let chunksDeleted = 0;
  let findingsDeleted = 0;
  let findingsOrphaned = 0;
  let filesDeleted = 0;
  let bytesFreed = 0;
  const affectedPillarIds = new Set<string>();
  const warnings: string[] = [];

  for (const did of allDocIdsToDelete) {
    const result = await db.delete(documentChunks).where(eq(documentChunks.documentId, did)).returning();
    chunksDeleted += result.length;
  }

  for (const did of allDocIdsToDelete) {
    await storage.deleteQueueItemsByDocument(did);
  }

  for (const did of allDocIdsToDelete) {
    await db.delete(documentClassifications).where(eq(documentClassifications.documentId, did));
  }

  const dealFindings = await storage.getFindingsByDeal(dealId);
  const autoFindingsForDocs = dealFindings.filter((f) => {
    if (f.sourceDocumentId && allDocIdsToDelete.includes(f.sourceDocumentId)) return true;
    if (f.sourceDocuments && f.sourceDocuments.some((s) => allFilenames.includes(s))) return true;
    if (f.description && f.description.includes("[Auto-detected from image analysis:")) {
      return allFilenames.some((fn) => f.description!.includes(fn));
    }
    return false;
  });

  for (const finding of autoFindingsForDocs) {
    if (finding.pillarId) affectedPillarIds.add(finding.pillarId);

    if (opts.deleteAutoFindings) {
      await db.delete(findings).where(eq(findings.id, finding.id));
      findingsDeleted++;
    } else {
      await db.update(findings).set({
        sourceDocumentId: null,
        sourceDocuments: [],
        description: (finding.description || "") + "\n[Source document deleted — finding retained for manual review]",
      }).where(eq(findings.id, finding.id));
      findingsOrphaned++;
    }
  }

  const objectStorage = new ObjectStorageService();
  for (const doc of validDocsToDelete) {
    if (doc.objectPath) {
      try {
        await objectStorage.deleteObjectEntity(doc.objectPath);
        filesDeleted++;
        bytesFreed += doc.fileSize || 0;
      } catch (err: any) {
        warnings.push(`Could not delete file ${doc.filename}: ${err.message}`);
        filesDeleted++;
        bytesFreed += doc.fileSize || 0;
      }
    }
  }

  await db.delete(documents).where(inArray(documents.id, allDocIdsToDelete));

  const remainingDocs = await storage.getDocumentsByDeal(dealId);
  const analyzedCount = remainingDocs.filter((d) => d.extractionStatus === "extracted").length;
  await storage.updateDeal(dealId, {
    documentsUploaded: remainingDocs.length,
    documentsAnalyzed: analyzedCount,
  });

  let newCompositeScore: number | null = null;
  if (affectedPillarIds.size > 0 && opts.deleteAutoFindings) {
    await recalculateDealScores(dealId, deal.industry || "Technology/SaaS");
    const updatedDeal = await storage.getDeal(dealId);
    newCompositeScore = updatedDeal?.compositeScore ? Number(updatedDeal.compositeScore) : null;
  }

  const allPillars = await storage.getPillarsByDeal(dealId);
  const affectedPillarNames = allPillars
    .filter((p) => affectedPillarIds.has(p.id))
    .map((p) => p.pillarName);

  try {
    await logAudit(opts.orgId, opts.userId, "document_deleted", "document", docIds[0], {
      filenames: allFilenames,
      documents_deleted: validDocsToDelete.length,
      chunks_deleted: chunksDeleted,
      findings_deleted: findingsDeleted,
      findings_orphaned: findingsOrphaned,
      files_deleted: filesDeleted,
      bytes_freed: bytesFreed,
      pillars_recalculated: affectedPillarNames,
      score_before: oldCompositeScore,
      score_after: newCompositeScore,
    });
  } catch (err: any) {
    console.error("Failed to log document deletion audit:", err.message);
  }

  return {
    documentsDeleted: validDocsToDelete.length,
    chunksDeleted,
    findingsDeleted,
    findingsOrphaned,
    filesDeleted,
    bytesFreed,
    affectedPillarIds,
    affectedPillarNames,
    dealId,
    oldCompositeScore,
    newCompositeScore,
    warnings,
  };
}

app.delete("/api/documents/batch", requireAuth as any, requirePerm("delete_documents") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { document_ids, delete_auto_findings = true, confirmation } = req.body || {};
    if (!document_ids || !Array.isArray(document_ids) || document_ids.length === 0) {
      return res.status(400).json({ message: "document_ids array is required" });
    }
    if (confirmation !== "DELETE") {
      return res.status(400).json({ message: "Confirmation 'DELETE' is required for batch deletion" });
    }

    const allDocs = await Promise.all(document_ids.map((id: string) => storage.getDocument(id)));
    const validDocs = allDocs.filter(Boolean);
    if (validDocs.length === 0) return res.status(404).json({ message: "No valid documents found" });

    const dealId = validDocs[0]!.dealId;
    const deal = await storage.getDeal(dealId!);
    if (!deal || deal.organizationId !== req.orgId) return res.status(403).json({ message: "Access denied" });

    const crossDeal = validDocs.some((d: any) => d.dealId !== dealId);
    if (crossDeal) return res.status(400).json({ message: "All documents must belong to the same deal" });

    const userRole = req.user!.role;
    if (deal.stage === "Closed" && !["platform_owner", "platform_admin", "org_owner"].includes(userRole)) {
      return res.status(403).json({ message: "This deal is closed. Only administrators can modify closed deal documents." });
    }

    if (["analyst", "integration_pm"].includes(userRole)) {
      const userAccess = await storage.getDealAccessByDeal(dealId!);
      const myAccess = userAccess.find((a) => a.userId === req.user!.id);
      const hasLeadAccess = myAccess && myAccess.accessLevel === "lead";
      const allOwnedByUser = validDocs.every((d: any) => d.uploadedBy === req.user!.id);
      if (!hasLeadAccess && !allOwnedByUser) {
        return res.status(403).json({ message: "You can only batch delete documents you uploaded or on deals where you have lead access." });
      }
    }

    const result = await cascadeDeleteDocuments(
      document_ids,
      { deleteAutoFindings: delete_auto_findings !== false, userId: req.user!.id, orgId: req.orgId! }
    );

    res.json({
      success: true,
      deleted: {
        documents: result.documentsDeleted,
        chunks: result.chunksDeleted,
        findings: result.findingsDeleted,
        files: result.filesDeleted,
        bytes_freed: result.bytesFreed,
      },
      recalculated: {
        pillars_updated: result.affectedPillarNames,
        composite_score_before: result.oldCompositeScore,
        composite_score_after: result.newCompositeScore,
      },
      warnings: [
        ...result.warnings,
      ],
    });
  } catch (error: any) {
    console.error("Batch delete error:", error);
    res.status(500).json({ message: error.message || "Failed to batch delete documents" });
  }
});

app.delete("/api/documents/:id", requireAuth as any, requirePerm("delete_documents") as any, async (req: AuthenticatedRequest, res) => {
  try {
    const doc = await storage.getDocument(req.params.id);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    const deal = await storage.getDeal(doc.dealId!);
    if (!deal || deal.organizationId !== req.orgId) return res.status(403).json({ message: "Access denied" });

    const userRole = req.user!.role;
    if (deal.stage === "Closed" && !["platform_owner", "platform_admin", "org_owner"].includes(userRole)) {
      return res.status(403).json({ message: "This deal is closed. Only administrators can modify closed deal documents." });
    }
    if (["analyst", "integration_pm"].includes(userRole)) {
      if (doc.uploadedBy !== req.user!.id) {
        const userAccess = await storage.getDealAccessByDeal(doc.dealId!);
        const myAccess = userAccess.find((a) => a.userId === req.user!.id);
        if (!myAccess || myAccess.accessLevel !== "lead") {
          return res.status(403).json({ message: "You can only delete documents you uploaded or on deals where you have lead access." });
        }
      }
    }

    const isArchiveParent = (doc.filename.toLowerCase().endsWith(".zip") || doc.filename.toLowerCase().endsWith(".rar"));
    const childDocs = isArchiveParent ? await storage.getChildDocuments(doc.id) : [];
    const { confirmation, delete_auto_findings = true, delete_children = true } = req.body || {};

    if (isArchiveParent && childDocs.length > 0 && delete_children) {
      if (confirmation !== doc.filename) {
        return res.status(400).json({
          message: `Archive deletion requires typing the filename to confirm. Expected: "${doc.filename}"`,
          requires_confirmation: true,
        });
      }
    }

    const result = await cascadeDeleteDocuments(
      [doc.id],
      { deleteAutoFindings: delete_auto_findings !== false, userId: req.user!.id, orgId: req.orgId! }
    );

    res.json({
      success: true,
      deleted: {
        documents: result.documentsDeleted,
        chunks: result.chunksDeleted,
        findings: result.findingsDeleted,
        files: result.filesDeleted,
        bytes_freed: result.bytesFreed,
      },
      recalculated: {
        pillars_updated: result.affectedPillarNames,
        composite_score_before: result.oldCompositeScore,
        composite_score_after: result.newCompositeScore,
      },
      warnings: [
        ...result.warnings,
      ],
    });
  } catch (error: any) {
    console.error("Document delete error:", error);
    res.status(500).json({ message: error.message || "Failed to delete document" });
  }
});

// ──────── IMAGE ANALYSIS (tenant scoped + deal access) ────────

const imageAnalysisProgress = new Map<string, { total: number; completed: number; current: string; status: string; findingsDetected: number }>();

app.get("/api/documents/analyze-images/status", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  const dealId = req.query.dealId as string;
  if (!dealId) return res.status(400).json({ message: "dealId required" });
  const progress = imageAnalysisProgress.get(dealId);
  res.json(progress || { total: 0, completed: 0, current: "", status: "idle", findingsDetected: 0 });
});

app.post("/api/documents/analyze-images", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.body;
    if (!dealId) return res.status(400).json({ message: "dealId is required" });
    const deal = await storage.getDeal(dealId);
    if (!deal || deal.organizationId !== req.orgId) return res.status(404).json({ message: "Deal not found" });

    if (!hasVisionCapability()) {
      return res.status(503).json({
        message: "AI capability requires OPENROUTER_API_KEY. Configure it in Doppler or .env.",
      });
    }

    const existing = imageAnalysisProgress.get(dealId);
    if (existing && existing.status === "running") {
      return res.status(409).json({ message: "Image analysis already in progress", progress: existing });
    }

    const docs = await storage.getDocumentsByDeal(dealId);
    const imageDocs = docs.filter((d) => {
      return isImageFile(d.filename) &&
        (d.extractionStatus === "stored" || d.extractionStatus === "vision_failed" ||
         d.extractionStatus === "image_pending" ||
         (d.extractedText && d.extractedText.includes("visual analysis pending")));
    });

    if (imageDocs.length === 0) {
      return res.json({ total: 0, completed: 0, message: "No images need analysis" });
    }

    imageAnalysisProgress.set(dealId, {
      total: imageDocs.length,
      completed: 0,
      current: imageDocs[0]?.filename || "",
      status: "running",
      findingsDetected: 0,
    });

    res.json({ total: imageDocs.length, message: "Image analysis started" });

    const objectStorage = new ObjectStorageService();

    (async () => {
      let completed = 0;
      let totalFindings = 0;

      for (const doc of imageDocs) {
        try {
          imageAnalysisProgress.set(dealId, {
            total: imageDocs.length,
            completed,
            current: doc.filename,
            status: "running",
            findingsDetected: totalFindings,
          });

          let buffer: Buffer;
          if (doc.objectPath) {
            const file = await objectStorage.getObjectEntityFile(doc.objectPath);
            const [content] = await file.download();
            buffer = content;
          } else if (doc.parentArchiveId) {
            const parent = await storage.getDocument(doc.parentArchiveId);
            if (!parent?.objectPath) {
              completed++;
              continue;
            }
            const archiveFile = await objectStorage.getObjectEntityFile(parent.objectPath);
            const [archiveContent] = await archiveFile.download();
            const AdmZip = (await import("adm-zip")).default;
            const zip = new AdmZip(archiveContent);
            const entry = zip.getEntries().find((e) => {
              const entryFilename = e.entryName.split("/").pop() || e.entryName;
              return e.entryName === doc.folderPath || entryFilename === doc.filename;
            });
            if (!entry) {
              await storage.updateDocument(doc.id, {
                extractionStatus: "vision_failed",
                extractionError: "Could not locate file in parent archive",
              });
              completed++;
              continue;
            }
            buffer = entry.getData();
          } else {
            completed++;
            continue;
          }

          const sizeCheck = checkImageSize(buffer.length);
          if (!sizeCheck.ok) {
            await storage.updateDocument(doc.id, {
              extractedText: `[Image file — ${sizeCheck.reason}]`,
              extractionStatus: sizeCheck.status || "stored",
              metadataJson: { fileType: "image", skipReason: sizeCheck.reason },
            });
            completed++;
            continue;
          }

          const result = await analyzeImage(buffer, doc.filename);
          if (!result) {
            completed++;
            continue;
          }

          const { findingsCreated } = await applyVisionResult(doc.id, dealId, doc.filename, result);
          totalFindings += findingsCreated;
          completed++;

          if (findingsCreated > 0) {
            await recalculateDealScores(dealId, deal.industry || "Technology/SaaS");
          }

          await new Promise((resolve) => setTimeout(resolve, 1000));
        } catch (err: any) {
          console.error(`Vision analysis failed for ${doc.filename}:`, err.message);
          await storage.updateDocument(doc.id, {
            extractionStatus: "vision_failed",
            extractionError: err.message,
          });
          completed++;
        }
      }

      const allDocs = await storage.getDocumentsByDeal(dealId);
      const analyzed = allDocs.filter((d) => ["extracted", "stored"].includes(d.extractionStatus)).length;
      await storage.updateDeal(dealId, {
        documentsUploaded: allDocs.length,
        documentsAnalyzed: analyzed,
      });

      if (totalFindings > 0) {
        try {
          const { embedAndMatchFindings } = await import("../finding-matcher");
          await embedAndMatchFindings(dealId, deal.organizationId);
        } catch (matchErr: any) {
          console.error(`Finding cross-reference matching failed for deal ${dealId}:`, matchErr.message);
        }
      }

      imageAnalysisProgress.set(dealId, {
        total: imageDocs.length,
        completed,
        current: "",
        status: "complete",
        findingsDetected: totalFindings,
      });

      setTimeout(() => imageAnalysisProgress.delete(dealId), 60000);
    })();

  } catch (error: any) {
    console.error("Analyze images error:", error);
    res.status(500).json({ message: error.message || "Failed to start image analysis" });
  }
});

app.post("/api/documents/:docId/analyze-image", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { docId } = req.params;
    const doc = await storage.getDocument(docId);
    if (!doc) return res.status(404).json({ message: "Document not found" });
    const deal = await storage.getDeal(doc.dealId);
    if (!deal || deal.organizationId !== req.orgId) return res.status(403).json({ message: "Access denied" });

    if (!hasVisionCapability()) {
      return res.status(503).json({ message: "No vision API key configured" });
    }

    const objectStorage = new ObjectStorageService();
    let buffer: Buffer;

    if (doc.objectPath) {
      const file = await objectStorage.getObjectEntityFile(doc.objectPath);
      const [content] = await file.download();
      buffer = content;
    } else if (doc.parentArchiveId) {
      const parent = await storage.getDocument(doc.parentArchiveId);
      if (!parent?.objectPath) return res.status(400).json({ message: "Cannot access file data" });
      const archiveFile = await objectStorage.getObjectEntityFile(parent.objectPath);
      const [archiveContent] = await archiveFile.download();
      const AdmZip = (await import("adm-zip")).default;
      const zip = new AdmZip(archiveContent);
      const entry = zip.getEntries().find((e) => {
        const entryFilename = e.entryName.split("/").pop() || e.entryName;
        return e.entryName === doc.folderPath || entryFilename === doc.filename;
      });
      if (!entry) return res.status(400).json({ message: "File not found in archive" });
      buffer = entry.getData();
    } else {
      return res.status(400).json({ message: "Cannot access file data" });
    }

    const result = await analyzeImage(buffer, doc.filename);
    if (!result) return res.status(503).json({ message: "Vision analysis unavailable" });

    const { findingsCreated } = await applyVisionResult(doc.id, doc.dealId!, doc.filename, result);

    if (findingsCreated > 0) {
      await recalculateDealScores(doc.dealId!, deal.industry || "Technology/SaaS");
    }

    const updated = await storage.getDocument(doc.id);
    res.json({ ...updated, findingsCreated });
  } catch (error: any) {
    console.error("Single image analysis error:", error);
    res.status(500).json({ message: error.message || "Failed to analyze image" });
  }
});

// ──────── EMBEDDINGS & SEARCH (tenant scoped + deal access) ────────

app.post("/api/documents/embed", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId } = req.body;
    if (!dealId) {
      return res.status(400).json({ message: "dealId is required" });
    }
    const deal = await storage.getDeal(dealId);
    if (!deal || deal.organizationId !== req.orgId) return res.status(404).json({ message: "Deal not found" });

    const progress = await embedChunksForDeal(dealId);
    res.json(progress);
  } catch (error: any) {
    console.error("Embedding error:", error);
    res.status(500).json({ message: error.message || "Failed to generate embeddings" });
  }
});

app.get("/api/documents/embed-progress/:dealId", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const progress = getEmbeddingProgress(req.params.dealId);
    res.json(progress);
  } catch (error) {
    res.status(500).json({ message: "Failed to get embedding progress" });
  }
});

app.post("/api/documents/search", requireAuth as any, async (req: AuthenticatedRequest, res) => {
  try {
    const { dealId, query, topK } = req.body;
    if (!dealId || !query) {
      return res.status(400).json({ message: "dealId and query are required" });
    }
    const deal = await storage.getDeal(dealId);
    if (!deal || deal.organizationId !== req.orgId) return res.status(404).json({ message: "Deal not found" });

    const results = await semanticSearch(dealId, query, topK || 10);
    res.json(results);
  } catch (error: any) {
    console.error("Search error:", error);
    res.status(500).json({ message: error.message || "Search failed" });
  }
});
}
