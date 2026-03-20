/**
 * Connector marketplace — all 25 connectors with status, tenant request/vote system.
 */
import { useEffect, useState } from 'react';
import { Plug, Search, ThumbsUp } from 'lucide-react';
import { connectors } from '../lib/api';

const VERTICAL_LABELS: Record<string, string> = {
  msp: 'MSP',
  healthcare: 'Healthcare',
  itsm: 'ITSM / Productivity',
  erp: 'ERP / Finance',
  collaboration: 'Collaboration',
};

const TIER_BADGES: Record<string, string> = {
  base: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  pro: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  enterprise: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
};

const PHASE_LABELS: Record<number, string> = {
  1: 'Q2 2026',
  2: 'Q3 2026',
  3: 'Q4 2026',
};

export function ConnectorMarketplacePage() {
  const [catalog, setCatalog] = useState<any>(null);
  const [configs, setConfigs] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [verticalFilter, setVerticalFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [cat, cfg, req] = await Promise.allSettled([
        connectors.catalog(),
        connectors.configs(),
        connectors.requests(),
      ]);
      if (cat.status === 'fulfilled') setCatalog(cat.value);
      if (cfg.status === 'fulfilled') setConfigs(cfg.value.configs);
      if (req.status === 'fulfilled') setRequests(req.value.requests);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <div className="p-6"><p className="text-gray-400">Loading connectors...</p></div>;
  }

  const allConnectors = catalog?.connectors ?? [];
  const configMap = new Map(configs.map((c: any) => [c.connector_id, c]));

  const filtered = allConnectors.filter((c: any) => {
    if (search && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.id.includes(search.toLowerCase())) return false;
    if (verticalFilter && c.vertical !== verticalFilter) return false;
    return true;
  });

  const grouped = filtered.reduce((acc: Record<string, any[]>, c: any) => {
    (acc[c.vertical] ??= []).push(c);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Connector Marketplace</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {allConnectors.length} connectors across {Object.keys(VERTICAL_LABELS).length} verticals
          {catalog?.summary && (
            <span> — {catalog.summary.byTier.base} base, {catalog.summary.byTier.pro} pro, {catalog.summary.byTier.enterprise} enterprise</span>
          )}
        </p>
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search connectors..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
        </div>
        <select
          value={verticalFilter}
          onChange={e => setVerticalFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
          <option value="">All verticals</option>
          {Object.entries(VERTICAL_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Connector groups */}
      {Object.entries(grouped).map(([vertical, vertConnectors]) => (
        <section key={vertical} className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
            {VERTICAL_LABELS[vertical] ?? vertical}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {(vertConnectors as any[]).map((c: any) => {
              const config = configMap.get(c.id);
              const status = config?.status ?? 'available';

              return (
                <div key={c.id} className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Plug size={14} className="text-gray-400" />
                        <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{c.name}</h3>
                      </div>
                      <p className="text-[11px] text-gray-400 font-mono">{c.id}</p>
                    </div>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${TIER_BADGES[c.tier]}`}>
                      {c.tier}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{c.description}</p>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400">Phase {c.phase} ({PHASE_LABELS[c.phase]})</span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      status === 'active' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                      status === 'connected' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                      'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                    }`}>
                      {status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {/* Tenant requests */}
      {requests.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
            Tenant Requests
          </h2>
          <div className="rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 text-left">
                  <th className="px-4 py-2 font-medium text-gray-500">Connector</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Tenant</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Requested By</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Votes</th>
                  <th className="px-4 py-2 font-medium text-gray-500">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {requests.map((r: any) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-mono text-xs">{r.connector_id}</td>
                    <td className="px-4 py-2 text-xs">{r.tenant_name}</td>
                    <td className="px-4 py-2 text-xs">{r.requested_by_name}</td>
                    <td className="px-4 py-2">
                      <span className="flex items-center gap-1 text-xs">
                        <ThumbsUp size={12} /> {r.vote_count}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs text-gray-400">{r.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
