import { db } from "./db";
import { findings, findingCrossReferences } from "@shared/schema";
import { eq, and, ne, sql } from "drizzle-orm";
import { generateSingleEmbedding } from "./embeddings";

export async function embedAndMatchFindings(dealId: string, tenantId: string): Promise<{ embedded: number; matched: number }> {
  const allFindings = await db.select().from(findings).where(eq(findings.dealId, dealId));

  const unembedded = allFindings.filter((f) => {
    return true;
  });

  let embedded = 0;
  let matched = 0;

  for (const finding of unembedded) {
    const hasEmbedding = await db.execute(
      sql`SELECT 1 FROM findings WHERE id = ${finding.id} AND finding_embedding IS NOT NULL LIMIT 1`
    );
    const rows = (hasEmbedding as any)?.rows || [];
    if (rows.length > 0) continue;

    const text = `${finding.title}. ${finding.description || ""}. Severity: ${finding.severity}`;
    const embedding = await generateSingleEmbedding(text);
    if (!embedding) continue;

    const vecStr = `[${embedding.join(",")}]`;
    await db.execute(
      sql`UPDATE findings SET finding_embedding = ${vecStr}::vector WHERE id = ${finding.id}`
    );
    embedded++;

    try {
      const similarResults = await db.execute(
        sql`SELECT f.id, f.deal_id, f.title, f.description, f.severity, f.status,
                   1 - (f.finding_embedding <=> ${vecStr}::vector) as similarity
            FROM findings f
            JOIN deals d ON f.deal_id = d.id
            WHERE d.organization_id = ${tenantId}
              AND f.deal_id != ${dealId}
              AND f.finding_embedding IS NOT NULL
              AND 1 - (f.finding_embedding <=> ${vecStr}::vector) > 0.75
            ORDER BY f.finding_embedding <=> ${vecStr}::vector
            LIMIT 5`
      );

      const matches = (similarResults as any)?.rows || [];

      for (const match of matches) {
        await db.execute(
          sql`INSERT INTO finding_cross_references (id, finding_id, similar_finding_id, similarity_score, deal_id, similar_deal_id, tenant_id)
              VALUES (gen_random_uuid(), ${finding.id}, ${match.id}, ${parseFloat(match.similarity).toFixed(2)}::decimal, ${dealId}, ${match.deal_id}, ${tenantId})
              ON CONFLICT (finding_id, similar_finding_id) DO UPDATE SET similarity_score = EXCLUDED.similarity_score`
        );
        matched++;
      }
    } catch (err: any) {
      console.error(`Cross-reference matching failed for finding ${finding.id}:`, err.message);
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  return { embedded, matched };
}

export async function getCrossReferencesForDeal(dealId: string, tenantId: string): Promise<Record<string, Array<{
  id: string;
  similarFindingId: string;
  similarityScore: number;
  similarDealId: string;
  dealTargetName: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  remediationNotes: string | null;
}>>> {
  const results = await db.execute(
    sql`SELECT fcr.finding_id, fcr.similar_finding_id, fcr.similarity_score, fcr.similar_deal_id,
               f.title, f.description, f.severity, f.status, f.remediation_notes,
               d.target_name as deal_target_name
        FROM finding_cross_references fcr
        JOIN findings f ON fcr.similar_finding_id = f.id
        JOIN deals d ON fcr.similar_deal_id = d.id
        WHERE fcr.deal_id = ${dealId}
          AND fcr.tenant_id = ${tenantId}
        ORDER BY fcr.similarity_score DESC`
  );

  const rows = (results as any)?.rows || [];
  const map: Record<string, Array<any>> = {};

  for (const row of rows) {
    const findingId = row.finding_id;
    if (!map[findingId]) map[findingId] = [];
    map[findingId].push({
      id: row.similar_finding_id,
      similarFindingId: row.similar_finding_id,
      similarityScore: parseFloat(row.similarity_score),
      similarDealId: row.similar_deal_id,
      dealTargetName: row.deal_target_name,
      title: row.title,
      description: row.description,
      severity: row.severity,
      status: row.status,
      remediationNotes: row.remediation_notes,
    });
  }

  return map;
}

export async function getPortfolioFindingTrends(tenantId: string): Promise<Array<{
  pattern: string;
  occurrenceCount: number;
  totalDeals: number;
  occurrenceRate: number;
  avgSeverity: string;
  findingIds: string[];
}>> {
  const allRefs = await db.execute(
    sql`SELECT fcr.finding_id, fcr.similar_finding_id, fcr.similarity_score, fcr.deal_id, fcr.similar_deal_id
        FROM finding_cross_references fcr
        WHERE fcr.tenant_id = ${tenantId}
          AND fcr.similarity_score >= 0.85
        ORDER BY fcr.similarity_score DESC`
  );

  const rows = (allRefs as any)?.rows || [];
  if (rows.length === 0) return [];

  const adj: Record<string, Set<string>> = {};
  for (const row of rows) {
    const a = row.finding_id;
    const b = row.similar_finding_id;
    if (!adj[a]) adj[a] = new Set();
    if (!adj[b]) adj[b] = new Set();
    adj[a].add(b);
    adj[b].add(a);
  }

  const visited = new Set<string>();
  const clusters: string[][] = [];

  for (const node of Object.keys(adj)) {
    if (visited.has(node)) continue;
    const cluster: string[] = [];
    const queue = [node];
    while (queue.length > 0) {
      const curr = queue.pop()!;
      if (visited.has(curr)) continue;
      visited.add(curr);
      cluster.push(curr);
      for (const neighbor of adj[curr] || []) {
        if (!visited.has(neighbor)) queue.push(neighbor);
      }
    }
    clusters.push(cluster);
  }

  const allFindingIds = clusters.flat();
  if (allFindingIds.length === 0) return [];

  const findingsData = await db.execute(
    sql`SELECT f.id, f.title, f.severity, f.deal_id
        FROM findings f
        WHERE f.id = ANY(${allFindingIds}::varchar[])`
  );
  const findingsMap = new Map<string, any>();
  for (const f of ((findingsData as any)?.rows || [])) {
    findingsMap.set(f.id, f);
  }

  const totalDealsResult = await db.execute(
    sql`SELECT COUNT(DISTINCT id) as cnt FROM deals WHERE organization_id = ${tenantId}`
  );
  const totalDeals = parseInt(((totalDealsResult as any)?.rows || [])[0]?.cnt || "0");

  const SEVERITY_ORDER: Record<string, number> = { critical: 4, high: 3, medium: 2, low: 1 };
  const SEVERITY_LABELS = ["low", "medium", "high", "critical"];

  const trends = clusters
    .filter((c) => c.length >= 2)
    .map((cluster) => {
      const clusterFindings = cluster.map((id) => findingsMap.get(id)).filter(Boolean);
      const representative = clusterFindings[0];
      const dealIds = new Set(clusterFindings.map((f: any) => f.deal_id));
      const severities = clusterFindings.map((f: any) => SEVERITY_ORDER[f.severity] || 0);
      const avgSev = severities.reduce((a: number, b: number) => a + b, 0) / severities.length;
      const avgSeverityLabel = SEVERITY_LABELS[Math.round(avgSev) - 1] || "medium";

      return {
        pattern: representative?.title || "Unknown Pattern",
        occurrenceCount: dealIds.size,
        totalDeals,
        occurrenceRate: totalDeals > 0 ? dealIds.size / totalDeals : 0,
        avgSeverity: avgSeverityLabel,
        findingIds: cluster,
      };
    })
    .sort((a, b) => b.occurrenceCount - a.occurrenceCount);

  return trends;
}
