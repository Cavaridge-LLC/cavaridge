/**
 * Knowledge Graph Types for Meridian M&A Intelligence
 */

export type KGEntityType =
  | "organization"
  | "technology"
  | "person"
  | "contract"
  | "risk"
  | "site"
  | "integration"
  | "vendor"
  | "system";

export type KGRelationshipType =
  | "uses"
  | "depends_on"
  | "manages"
  | "contains"
  | "risks"
  | "integrates_with"
  | "replaces"
  | "provides"
  | "located_at"
  | "contracts_with";

export interface KGEntity {
  id: string;
  type: KGEntityType;
  name: string;
  properties: Record<string, unknown>;
  sourceDocumentIds: string[];
  confidence: number;
}

export interface KGRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: KGRelationshipType;
  properties: Record<string, unknown>;
  confidence: number;
}

export interface KnowledgeGraph {
  entities: KGEntity[];
  relationships: KGRelationship[];
  metadata: {
    dealId: string;
    entityCount: number;
    relationshipCount: number;
    buildTimestamp: string;
  };
}
