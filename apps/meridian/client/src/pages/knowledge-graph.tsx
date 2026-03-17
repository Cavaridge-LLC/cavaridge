import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import {
  Network, Building2, Cpu, User, FileText, AlertTriangle,
  MapPin, Plug, Store, Database, Loader2, RefreshCw, Search,
  ArrowRight,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// ── Entity styling ────────────────────────────────────────────────

const entityIcons: Record<string, typeof Building2> = {
  organization: Building2,
  technology: Cpu,
  person: User,
  contract: FileText,
  risk: AlertTriangle,
  site: MapPin,
  integration: Plug,
  vendor: Store,
  system: Database,
};

const entityColors: Record<string, { bg: string; border: string; text: string }> = {
  organization: { bg: "rgba(59,130,246,0.1)", border: "#3B82F6", text: "#3B82F6" },
  technology: { bg: "rgba(139,92,246,0.1)", border: "#8B5CF6", text: "#8B5CF6" },
  person: { bg: "rgba(16,185,129,0.1)", border: "#10B981", text: "#10B981" },
  contract: { bg: "rgba(245,158,11,0.1)", border: "#F59E0B", text: "#F59E0B" },
  risk: { bg: "rgba(239,68,68,0.1)", border: "#EF4444", text: "#EF4444" },
  site: { bg: "rgba(6,182,212,0.1)", border: "#06B6D4", text: "#06B6D4" },
  integration: { bg: "rgba(236,72,153,0.1)", border: "#EC4899", text: "#EC4899" },
  vendor: { bg: "rgba(107,114,128,0.1)", border: "#6B7280", text: "#6B7280" },
  system: { bg: "rgba(99,102,241,0.1)", border: "#6366F1", text: "#6366F1" },
};

interface KGEntity {
  id: string;
  type: string;
  name: string;
  properties: Record<string, unknown>;
  sourceDocumentIds: string[];
  confidence: number;
}

interface KGRelationship {
  id: string;
  sourceEntityId: string;
  targetEntityId: string;
  type: string;
  properties: Record<string, unknown>;
  confidence: number;
}

interface KnowledgeGraph {
  entities: KGEntity[];
  relationships: KGRelationship[];
  metadata: {
    dealId: string;
    entityCount: number;
    relationshipCount: number;
    buildTimestamp: string | null;
    message?: string;
  };
}

export default function KnowledgeGraphPage() {
  const dealId = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("dealId") || localStorage.getItem("meridian_active_deal") || ""
    : "";

  const { toast } = useToast();
  const [filterType, setFilterType] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null);

  const { data: graph, isLoading } = useQuery<KnowledgeGraph>({
    queryKey: [`/api/deals/${dealId}/knowledge-graph`],
    enabled: !!dealId,
  });

  const buildMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/deals/${dealId}/knowledge-graph/build`);
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: [`/api/deals/${dealId}/knowledge-graph`] });
      toast({
        title: "Knowledge Graph Built",
        description: `Extracted ${data.metadata?.entityCount ?? 0} entities and ${data.metadata?.relationshipCount ?? 0} relationships.`,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Build Failed", description: err.message, variant: "destructive" });
    },
  });

  const entities = graph?.entities ?? [];
  const relationships = graph?.relationships ?? [];

  // Filter entities
  const filteredEntities = entities.filter(e => {
    if (filterType !== "all" && e.type !== filterType) return false;
    if (searchQuery && !e.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  // Entity type counts
  const typeCounts: Record<string, number> = {};
  for (const e of entities) {
    typeCounts[e.type] = (typeCounts[e.type] || 0) + 1;
  }

  // Selected entity details
  const selectedEntityData = selectedEntity ? entities.find(e => e.id === selectedEntity) : null;
  const selectedRelationships = selectedEntity
    ? relationships.filter(r => r.sourceEntityId === selectedEntity || r.targetEntityId === selectedEntity)
    : [];

  if (!dealId) {
    return (
      <div className="p-6 text-center text-[var(--text-secondary)]">
        Select a deal from the pipeline to view its knowledge graph.
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ background: "rgba(139,92,246,0.1)" }}>
            <Network className="w-5 h-5" style={{ color: "#8B5CF6" }} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[var(--text-primary)]">Knowledge Graph</h1>
            <p className="text-xs text-[var(--text-tertiary)]">
              {entities.length > 0
                ? `${entities.length} entities, ${relationships.length} relationships`
                : "Build a knowledge graph from your deal documents"}
            </p>
          </div>
        </div>
        <Button
          onClick={() => buildMutation.mutate()}
          disabled={buildMutation.isPending}
          size="sm"
          className="gap-2"
        >
          {buildMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {entities.length > 0 ? "Rebuild" : "Build Graph"}
        </Button>
      </div>

      {/* Stats */}
      {entities.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => {
            const Icon = entityIcons[type] || Database;
            const colors = entityColors[type] || entityColors.system;
            return (
              <Card
                key={type}
                className="p-3 cursor-pointer transition-all hover:scale-[1.02]"
                style={{
                  background: filterType === type ? colors.bg : undefined,
                  borderColor: filterType === type ? colors.border : undefined,
                }}
                onClick={() => setFilterType(filterType === type ? "all" : type)}
              >
                <div className="flex items-center gap-2">
                  <Icon className="w-4 h-4" style={{ color: colors.text }} />
                  <span className="text-xs font-medium text-[var(--text-secondary)] capitalize">{type}</span>
                  <Badge variant="secondary" className="ml-auto text-[10px]">{count}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Search */}
      {entities.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)]" />
          <input
            type="text"
            placeholder="Search entities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm rounded-lg border border-[var(--border-primary)] bg-[var(--bg-primary)] text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)]"
          />
        </div>
      )}

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Entity list */}
        <div className="lg:col-span-2 space-y-2">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-[var(--text-tertiary)]" />
            </div>
          ) : entities.length === 0 ? (
            <Card className="p-8 text-center">
              <Network className="w-10 h-10 mx-auto mb-3 text-[var(--text-tertiary)]" />
              <p className="text-sm text-[var(--text-secondary)] mb-1">No knowledge graph yet</p>
              <p className="text-xs text-[var(--text-tertiary)]">
                Click "Build Graph" to extract entities and relationships from your deal documents.
              </p>
            </Card>
          ) : (
            filteredEntities.map(entity => {
              const Icon = entityIcons[entity.type] || Database;
              const colors = entityColors[entity.type] || entityColors.system;
              const relCount = relationships.filter(
                r => r.sourceEntityId === entity.id || r.targetEntityId === entity.id,
              ).length;

              return (
                <Card
                  key={entity.id}
                  className="p-3 cursor-pointer transition-all hover:scale-[1.005]"
                  style={{
                    borderColor: selectedEntity === entity.id ? colors.border : undefined,
                    background: selectedEntity === entity.id ? colors.bg : undefined,
                  }}
                  onClick={() => setSelectedEntity(selectedEntity === entity.id ? null : entity.id)}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-md flex items-center justify-center shrink-0"
                      style={{ background: colors.bg }}
                    >
                      <Icon className="w-4 h-4" style={{ color: colors.text }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {entity.name}
                      </div>
                      <div className="text-[11px] text-[var(--text-tertiary)] capitalize">
                        {entity.type} &middot; {relCount} connections &middot; {Math.round(entity.confidence * 100)}% confidence
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className="text-[10px] capitalize shrink-0"
                      style={{ color: colors.text, borderColor: colors.border }}
                    >
                      {entity.type}
                    </Badge>
                  </div>
                </Card>
              );
            })
          )}
        </div>

        {/* Detail panel */}
        <div>
          {selectedEntityData ? (
            <Card className="p-4 space-y-4 sticky top-4">
              <div className="flex items-center gap-2">
                {(() => {
                  const Icon = entityIcons[selectedEntityData.type] || Database;
                  const colors = entityColors[selectedEntityData.type] || entityColors.system;
                  return (
                    <>
                      <div className="w-8 h-8 rounded-md flex items-center justify-center" style={{ background: colors.bg }}>
                        <Icon className="w-4 h-4" style={{ color: colors.text }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-[var(--text-primary)]">{selectedEntityData.name}</h3>
                        <p className="text-[11px] text-[var(--text-tertiary)] capitalize">{selectedEntityData.type}</p>
                      </div>
                    </>
                  );
                })()}
              </div>

              {/* Properties */}
              {Object.keys(selectedEntityData.properties).length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">Properties</h4>
                  <div className="space-y-1">
                    {Object.entries(selectedEntityData.properties).map(([key, value]) => (
                      <div key={key} className="flex items-center justify-between text-xs">
                        <span className="text-[var(--text-tertiary)] capitalize">{key.replace(/_/g, " ")}</span>
                        <span className="text-[var(--text-primary)]">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Relationships */}
              {selectedRelationships.length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                    Relationships ({selectedRelationships.length})
                  </h4>
                  <div className="space-y-2">
                    {selectedRelationships.map(rel => {
                      const isSource = rel.sourceEntityId === selectedEntity;
                      const otherEntityId = isSource ? rel.targetEntityId : rel.sourceEntityId;
                      const otherEntity = entities.find(e => e.id === otherEntityId);
                      if (!otherEntity) return null;

                      return (
                        <div
                          key={rel.id}
                          className="flex items-center gap-2 text-xs p-2 rounded-md bg-[var(--bg-secondary)] cursor-pointer"
                          onClick={() => setSelectedEntity(otherEntityId)}
                        >
                          <span className="text-[var(--text-primary)] font-medium truncate max-w-[80px]">
                            {selectedEntityData.name}
                          </span>
                          <ArrowRight className="w-3 h-3 text-[var(--text-tertiary)] shrink-0" />
                          <Badge variant="outline" className="text-[9px] shrink-0">{rel.type}</Badge>
                          <ArrowRight className="w-3 h-3 text-[var(--text-tertiary)] shrink-0" />
                          <span className="text-[var(--text-primary)] font-medium truncate">
                            {otherEntity.name}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="text-[10px] text-[var(--text-disabled)]">
                Confidence: {Math.round(selectedEntityData.confidence * 100)}%
              </div>
            </Card>
          ) : (
            <Card className="p-6 text-center">
              <p className="text-xs text-[var(--text-tertiary)]">
                Select an entity to view details and relationships
              </p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
