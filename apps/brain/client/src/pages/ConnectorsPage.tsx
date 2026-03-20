/**
 * Connectors Page — Manage Brain integrations
 *
 * Lists all 11 connectors with phase/status indicators.
 * Phase 1 connectors (M365 Calendar + Email) are configurable.
 */

import { useState, useEffect } from "react";
import { Plug, CheckCircle2, Circle, Clock, AlertCircle, RefreshCw } from "lucide-react";
import { api } from "../hooks/useApi.js";

interface ConnectorInfo {
  id: string;
  name: string;
  phase: number;
  status: string;
  isConfigured: boolean;
}

export function ConnectorsPage() {
  const [connectors, setConnectors] = useState<ConnectorInfo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.listConnectors()
      .then((data) => setConnectors(data.connectors))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const phaseLabel = (phase: number) => {
    switch (phase) {
      case 1: return "Phase 1 — Available";
      case 2: return "Phase 2 — Q3 2026";
      case 3: return "Phase 3 — Q4 2026";
      default: return `Phase ${phase}`;
    }
  };

  const StatusIcon = ({ status, isConfigured }: { status: string; isConfigured: boolean }) => {
    if (isConfigured) return <CheckCircle2 className="w-5 h-5 text-[var(--brain-success)]" />;
    if (status === "implemented") return <Circle className="w-5 h-5 text-[var(--brain-primary)]" />;
    return <Clock className="w-5 h-5 text-[var(--brain-text-muted)]" />;
  };

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[var(--brain-text)]">Connectors</h1>
        <p className="text-sm text-[var(--brain-text-muted)]">
          Connect Brain to your existing tools for automatic knowledge capture
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <RefreshCw className="w-6 h-6 animate-spin text-[var(--brain-text-muted)]" />
        </div>
      ) : (
        <div className="space-y-3">
          {[1, 2, 3].map((phase) => {
            const phaseConnectors = connectors.filter((c) => c.phase === phase);
            if (phaseConnectors.length === 0) return null;

            return (
              <div key={phase}>
                <h2 className="text-xs font-medium text-[var(--brain-text-muted)] uppercase tracking-wide mb-2 mt-4">
                  {phaseLabel(phase)}
                </h2>
                <div className="space-y-2">
                  {phaseConnectors.map((connector) => (
                    <div
                      key={connector.id}
                      className="flex items-center justify-between p-4 bg-[var(--brain-surface-alt)] rounded-lg border border-[var(--brain-border)]"
                    >
                      <div className="flex items-center gap-3">
                        <StatusIcon status={connector.status} isConfigured={connector.isConfigured} />
                        <div>
                          <p className="text-sm font-medium text-[var(--brain-text)]">{connector.name}</p>
                          <p className="text-xs text-[var(--brain-text-muted)]">
                            {connector.isConfigured ? "Connected" : connector.status === "implemented" ? "Ready to configure" : "Coming soon"}
                          </p>
                        </div>
                      </div>

                      {connector.status === "implemented" && (
                        <button
                          className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                            connector.isConfigured
                              ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                              : "bg-[var(--brain-primary)] text-white hover:bg-blue-700"
                          }`}
                        >
                          {connector.isConfigured ? "Connected" : "Configure"}
                        </button>
                      )}

                      {connector.status === "stub" && (
                        <span className="text-xs px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-[var(--brain-text-muted)]">
                          Phase {connector.phase}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
