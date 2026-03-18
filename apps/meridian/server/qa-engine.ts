import {
  chatCompletion as spanielChat,
  hasAICapability,
} from "@cavaridge/spaniel";
import { storage } from "./storage";
import { semanticSearch } from "./embeddings";
import { generateSingleEmbedding } from "./embeddings";
import { db } from "./db";
import { sql } from "drizzle-orm";

interface Citation {
  document_id?: string;
  document_name?: string;
  chunk_text?: string;
  relevance_score?: number;
  page_number?: string;
  finding_id?: string;
  title?: string;
  severity?: string;
}

interface SimilarQuestion {
  question: string;
  similarity: number;
  answer?: string;
  savedAnswerId?: string;
}

interface SourceAttribution {
  filename: string;
  pages: string;
  confidence: number;
  excerpt?: string;
  cited?: boolean;
  documentId?: string;
}

interface QaResponse {
  answer: string;
  citations: Citation[];
  similar_past_questions: SimilarQuestion[];
  conversation_id: string;
  message_id: string;
  confidenceScore: number;
  sourceCount: number;
  sources: SourceAttribution[];
}

async function findSimilarSavedAnswers(
  dealId: string,
  tenantId: string,
  questionEmbedding: number[],
  threshold: number = 0.85
): Promise<Array<{ id: string; question: string; answer: string; citations: any; similarity: number }>> {
  const vecStr = `[${questionEmbedding.join(",")}]`;
  const results = await db.execute(
    sql`SELECT id, question, answer, citations,
               1 - (question_embedding <=> ${vecStr}::vector) as similarity
        FROM qa_saved_answers
        WHERE deal_id = ${dealId}
          AND tenant_id = ${tenantId}
          AND question_embedding IS NOT NULL
          AND 1 - (question_embedding <=> ${vecStr}::vector) > ${threshold}
        ORDER BY question_embedding <=> ${vecStr}::vector
        LIMIT 5`
  );
  return (results.rows || []).map((r: any) => ({
    id: r.id,
    question: r.question,
    answer: r.answer,
    citations: r.citations,
    similarity: parseFloat(r.similarity),
  }));
}

function parseCitations(
  text: string,
  ragSources: Array<{ filename: string; documentId: string; chunkText: string; similarity: number; chunkIndex: number }>,
  findingSources: Array<{ id: string; title: string; severity: string }>
): Citation[] {
  const citations: Citation[] = [];
  const seen = new Set<string>();

  const docMatches = text.match(/\[DOC:\s*([^\],]+?)(?:,\s*p\.?\s*(\d+))?\]/gi) || [];
  for (const m of docMatches) {
    const parts = m.match(/\[DOC:\s*(.+?)(?:,\s*p\.?\s*(\d+))?\]/i);
    if (!parts) continue;
    const filename = parts[1].trim();
    const page = parts[2] || undefined;
    const source = ragSources.find(s => s.filename.toLowerCase() === filename.toLowerCase() || s.filename.toLowerCase().includes(filename.toLowerCase()));
    if (!source) continue;
    const key = `doc-${source.documentId}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({
        document_id: source.documentId,
        document_name: source.filename,
        chunk_text: source.chunkText?.slice(0, 200),
        relevance_score: source.similarity,
        page_number: page || `chunk ${source.chunkIndex}`,
      });
    }
  }

  const findingMatches = text.match(/\[FINDING:\s*([^\]]+)\]/gi) || [];
  for (const m of findingMatches) {
    const parts = m.match(/\[FINDING:\s*(.+?)\]/i);
    if (!parts) continue;
    const findingRef = parts[1].trim();
    const source = findingSources.find(f => f.id === findingRef);
    if (!source) continue;
    const key = `finding-${source.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      citations.push({
        finding_id: source.id,
        title: source.title,
        severity: source.severity,
      });
    }
  }

  const numMatches = text.match(/\[(\d+)\]/g) || [];
  for (const m of numMatches) {
    const idx = parseInt(m.replace(/[\[\]]/g, "")) - 1;
    if (idx >= 0 && idx < ragSources.length) {
      const source = ragSources[idx];
      const key = `num-${source.documentId}-${source.chunkIndex}`;
      if (!seen.has(key)) {
        seen.add(key);
        citations.push({
          document_id: source.documentId,
          document_name: source.filename,
          chunk_text: source.chunkText?.slice(0, 200),
          relevance_score: source.similarity,
          page_number: `chunk ${source.chunkIndex}`,
        });
      }
    }
  }

  return citations;
}

export async function processQaQuestion(
  dealId: string,
  tenantId: string,
  userId: string,
  question: string,
  conversationId: string | null
): Promise<QaResponse> {
  if (!hasAICapability()) {
    throw new Error("OPENROUTER_API_KEY is required to enable Ask MERIDIAN. Configure it in Replit Secrets.");
  }

  const deal = await storage.getDeal(dealId);
  if (!deal) throw new Error("Deal not found");

  if (conversationId) {
    const existingConv = await storage.getQaConversation(conversationId);
    if (!existingConv || existingConv.dealId !== dealId || existingConv.tenantId !== tenantId) {
      throw new Error("Conversation not found or access denied");
    }
  }

  let similarPastQuestions: SimilarQuestion[] = [];
  let pastContext = "";

  const questionEmbedding = await generateSingleEmbedding(question);
  if (questionEmbedding) {
    const similarSaved = await findSimilarSavedAnswers(dealId, tenantId, questionEmbedding, 0.85);
    if (similarSaved.length > 0) {
      similarPastQuestions = similarSaved.map(s => ({
        question: s.question,
        similarity: s.similarity,
        answer: s.answer,
        savedAnswerId: s.id,
      }));

      const highMatch = similarSaved.find(s => s.similarity > 0.92);
      if (highMatch) {
        let conv = conversationId ? await storage.getQaConversation(conversationId) : null;
        if (!conv) {
          conv = await storage.createQaConversation({
            dealId,
            tenantId,
            userId,
            title: question.slice(0, 100),
          });
        }
        const userMsg = await storage.createQaMessage({
          conversationId: conv.id,
          role: "user",
          content: question,
        });
        const assistantMsg = await storage.createQaMessage({
          conversationId: conv.id,
          role: "assistant",
          content: `This question was previously answered:\n\n${highMatch.answer}`,
          citations: highMatch.citations || [],
          similarQuestionIds: [{ question: highMatch.question, similarity: highMatch.similarity }],
        });
        await storage.updateQaConversation(conv.id, {});

        return {
          answer: `This question was previously answered:\n\n${highMatch.answer}`,
          citations: (highMatch.citations as Citation[]) || [],
          similar_past_questions: similarPastQuestions,
          conversation_id: conv.id,
          message_id: assistantMsg.id,
          confidenceScore: highMatch.similarity,
          sourceCount: ((highMatch.citations as Citation[]) || []).filter(c => c.document_name).length,
          sources: ((highMatch.citations as Citation[]) || []).filter(c => c.document_name).map(c => ({
            filename: c.document_name!,
            pages: c.page_number || "—",
            confidence: c.relevance_score || 0.9,
            excerpt: c.chunk_text,
            cited: true,
            documentId: c.document_id,
          })),
        };
      }

      const topMatch = similarSaved[0];
      pastContext = `\nPREVIOUSLY ASKED SIMILAR QUESTION (similarity: ${(topMatch.similarity * 100).toFixed(0)}%):\nQ: ${topMatch.question}\nA: ${topMatch.answer}\n`;
    }
  }

  const [searchResults, dealFindings, dealDocs, dealPillars] = await Promise.all([
    semanticSearch(dealId, question, 15).catch(() => []),
    storage.getFindingsByDeal(dealId),
    storage.getDocumentsByDeal(dealId),
    storage.getPillarsByDeal(dealId),
  ]);

  const ragSources = searchResults.map(r => ({
    filename: r.filename,
    documentId: r.documentId,
    chunkText: r.chunkText,
    similarity: r.similarity,
    chunkIndex: r.chunkIndex,
  }));

  const questionWords = question.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const scoredFindings = dealFindings.map(f => {
    const text = `${f.title} ${f.description || ""}`.toLowerCase();
    const matchCount = questionWords.filter(w => text.includes(w)).length;
    return { finding: f, score: matchCount };
  });
  scoredFindings.sort((a, b) => b.score - a.score);
  const topFindings = scoredFindings.slice(0, 10).map(sf => sf.finding);

  const findingSources = topFindings.map(f => ({
    id: f.id,
    title: f.title,
    severity: f.severity,
  }));

  const docContext = ragSources.length > 0
    ? `\n\nRELEVANT DOCUMENTS:\n${ragSources.map((r, i) => `[DOC: ${r.filename}, p.${r.chunkIndex}] ${r.chunkText.slice(0, 500)}`).join("\n\n")}`
    : "\n\nNo relevant document excerpts found. Answer based on findings data.";

  const findingContext = topFindings.length > 0
    ? `\n\nRELEVANT FINDINGS:\n${topFindings.map(f => `[FINDING: ${f.id}] [${f.severity}] ${f.title}: ${f.description?.slice(0, 300) || "No description"}`).join("\n\n")}`
    : "";

  let conversationHistory: Array<{ role: "user" | "assistant"; content: string }> = [];
  if (conversationId) {
    const existingMessages = await storage.getQaMessagesByConversation(conversationId);
    conversationHistory = existingMessages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    }));
  }

  const pillarContext = dealPillars.length > 0
    ? `\n\nPILLAR SCORES:\n${JSON.stringify(dealPillars.map(p => ({ name: p.pillarName, score: p.score, weight: p.weight, findingCount: p.findingCount })), null, 2)}`
    : "";

  const systemPrompt = `You are MERIDIAN, an AI IT due diligence analyst. You answer questions about technology assessments for M&A transactions. You are currently analyzing "${deal.targetName}" in the ${deal.industry} industry.

RULES:
- Always cite your sources. Use [DOC: filename, p.X] for document references and [FINDING: finding_id] for finding references.
- If you don't have enough information to answer confidently, say so explicitly. Say what additional documents would help answer the question.
- Be specific and quantitative where possible. Use actual data from the documents.
- Frame answers in terms of deal risk and business impact, not just technical facts.
- Keep answers concise but complete. Aim for 2-4 paragraphs.
- If the question has been asked before in a similar form, note that and whether the answer has changed based on newly uploaded documents.
- When referencing pillar scores, use the actual data provided.

Available documents: ${dealDocs.map(d => d.filename).join(", ") || "None uploaded yet"}${pillarContext}`;

  const userMessage = `Question: ${question}${docContext}${findingContext}${pastContext}`;

  const chatMessages: Array<{ role: "user" | "assistant" | "system"; content: string }> = [
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  const spanielResponse = await spanielChat({
    tenantId,
    userId: userId,
    appCode: "CVG-MER",
    taskType: "analysis",
    system: systemPrompt,
    messages: chatMessages,
    options: { maxTokens: 2048, fallbackEnabled: true },
  });
  const answerText = spanielResponse.content;

  const citations = parseCitations(answerText, ragSources, findingSources);

  let conv = conversationId ? await storage.getQaConversation(conversationId) : null;
  if (!conv) {
    conv = await storage.createQaConversation({
      dealId,
      tenantId,
      userId,
      title: question.slice(0, 100),
    });
  }

  await storage.createQaMessage({
    conversationId: conv.id,
    role: "user",
    content: question,
  });

  const citedRefMatches = answerText.match(/\[(\d+)\]/g) || [];
  const citedIndices = new Set(citedRefMatches.map(m => parseInt(m.replace(/[\[\]]/g, "")) - 1));

  const sources: SourceAttribution[] = ragSources.map((src, i) => ({
    filename: src.filename,
    pages: `chunk ${src.chunkIndex}`,
    confidence: Math.round(src.similarity * 100) / 100,
    excerpt: src.chunkText.slice(0, 150) + (src.chunkText.length > 150 ? "..." : ""),
    cited: citedIndices.has(i) || citations.some(c => c.document_id && c.document_name === src.filename),
    documentId: src.documentId,
  }));

  const confidenceScore = ragSources.length > 0
    ? Math.round(Math.max(...ragSources.map(s => s.similarity), 0.75) * 100) / 100
    : citations.length > 0 ? 0.75 : 0.6;

  const sourceCount = sources.filter(s => s.cited).length || citations.filter(c => c.document_name).length;

  const assistantMsg = await storage.createQaMessage({
    conversationId: conv.id,
    role: "assistant",
    content: answerText,
    citations,
    similarQuestionIds: {
      similar: similarPastQuestions.map(s => ({ question: s.question, similarity: s.similarity })),
      confidenceScore,
      sourceCount,
      sources,
    },
  });

  await storage.updateQaConversation(conv.id, {});

  return {
    answer: answerText,
    citations,
    similar_past_questions: similarPastQuestions,
    conversation_id: conv.id,
    message_id: assistantMsg.id,
    confidenceScore,
    sourceCount,
    sources,
  };
}

export async function saveQaAnswer(
  dealId: string,
  tenantId: string,
  userId: string,
  messageId: string
): Promise<void> {
  const message = await storage.getQaMessage(messageId);
  if (!message || message.role !== "assistant") {
    throw new Error("Message not found or not an assistant message");
  }

  const conv = await storage.getQaConversation(message.conversationId);
  if (!conv || conv.dealId !== dealId || conv.tenantId !== tenantId) {
    throw new Error("Message not found or access denied");
  }

  const conversationMessages = await storage.getQaMessagesByConversation(message.conversationId);
  const msgIndex = conversationMessages.findIndex(m => m.id === messageId);
  const userMsg = conversationMessages.slice(0, msgIndex).reverse().find(m => m.role === "user");
  if (!userMsg) throw new Error("Could not find the user question for this answer");

  let questionEmbedding: number[] | null = null;
  try {
    questionEmbedding = await generateSingleEmbedding(userMsg.content);
  } catch (err) {
    console.error("Failed to embed question for saved answer:", err);
  }

  const saveData: any = {
    dealId,
    tenantId,
    question: userMsg.content,
    answer: message.content,
    citations: message.citations || [],
    savedBy: userId,
  };

  const saved = await storage.createQaSavedAnswer(saveData);

  if (questionEmbedding) {
    const vecStr = `[${questionEmbedding.join(",")}]`;
    await db.execute(
      sql`UPDATE qa_saved_answers SET question_embedding = ${vecStr}::vector WHERE id = ${saved.id}`
    );
  }
}
