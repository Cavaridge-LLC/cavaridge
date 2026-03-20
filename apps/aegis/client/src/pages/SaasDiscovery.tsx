/**
 * SaaS Discovery — Discovered SaaS applications per tenant.
 * Shows classification (sanctioned/unsanctioned/unclassified), usage frequency, risk.
 */
import { useEffect, useState } from 'react';
import { Globe, Search, Filter, ChevronDown } from 'lucide-react';
import { saas } from '../lib/api';

interface SaasApp {
  id: string;
  name: string;
  domain: string;
  category: string;
  classification: string;
  visit_count: number;
  risk_score: number;
  first_seen_at: string;
  last_seen_at: string;
  unique_devices: number;
}

interface CategoryBreakdown {
  category: string;
  count: number;
  avg_risk: number;
  total_visits: number;
}

const CLASSIFICATION_COLORS: Record<string, string> = {
  sanctioned: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  unsanctioned: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  unclassified: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  blocked: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
};

export function SaasDiscoveryPage() {
  const [apps, setApps] = useState<SaasApp[]>([]);
  const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [filter, setFilter] = useState({ classification: '', category: '', search: '' });
  const [loading, setLoading] = useState(true);

  async function loadData() {
    try {
      const params: Record<string, string> = {};
      if (filter.classification) params.classification = filter.classification;
      if (filter.category) params.category = filter.category;
      if (filter.search) params.search = filter.search;

      const [appsRes, catRes, sumRes] = await Promise.all([
        saas.list(params),
        saas.byCategory(),
        saas.summary(),
      ]);

      setApps(appsRes.data ?? []);
      setCategories(catRes.data ?? []);
      setSummary(sumRes);
    } catch {
      // Handle gracefully
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, [filter.classification, filter.category]);

  async function handleClassify(id: string, classification: string) {
    await saas.classify(id, { classification });
    loadData();
  }

  function handleSearch() {
    setLoading(true);
    loadData();
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Globe size={24} className="text-[#2E5090]" />
            SaaS Discovery
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Shadow IT detection — discovered SaaS applications across your endpoints
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total', value: summary.total, color: '' },
            { label: 'Sanctioned', value: summary.sanctioned, color: 'text-green-600' },
            { label: 'Unsanctioned', value: summary.unsanctioned, color: 'text-red-600' },
            { label: 'Unclassified', value: summary.unclassified, color: 'text-amber-600' },
            { label: 'Avg Risk', value: summary.avg_risk_score, color: '' },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-center">
              <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Category breakdown */}
      {categories.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <button
            onClick={() => setFilter(f => ({ ...f, category: '' }))}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !filter.category
                ? 'bg-[#2E5090] text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            All
          </button>
          {categories.map(cat => (
            <button
              key={cat.category}
              onClick={() => setFilter(f => ({ ...f, category: cat.category }))}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                filter.category === cat.category
                  ? 'bg-[#2E5090] text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
              }`}
            >
              {cat.category} ({cat.count})
            </button>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <div className="relative flex-1 max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search by name or domain..."
            value={filter.search}
            onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:border-[#2E5090]"
          />
        </div>
        <div className="relative">
          <Filter size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <select
            value={filter.classification}
            onChange={e => setFilter(f => ({ ...f, classification: e.target.value }))}
            className="pl-9 pr-8 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:border-[#2E5090] appearance-none"
          >
            <option value="">All Classifications</option>
            <option value="sanctioned">Sanctioned</option>
            <option value="unsanctioned">Unsanctioned</option>
            <option value="unclassified">Unclassified</option>
            <option value="blocked">Blocked</option>
          </select>
          <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#2E5090] text-white">
              <th className="text-left px-4 py-3 font-medium">Application</th>
              <th className="text-left px-4 py-3 font-medium">Category</th>
              <th className="text-center px-4 py-3 font-medium">Classification</th>
              <th className="text-right px-4 py-3 font-medium">Visits</th>
              <th className="text-right px-4 py-3 font-medium">Risk</th>
              <th className="text-left px-4 py-3 font-medium">Last Seen</th>
              <th className="text-center px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">Loading...</td>
              </tr>
            ) : apps.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                  No SaaS applications discovered yet. Deploy the AEGIS extension to start monitoring.
                </td>
              </tr>
            ) : (
              apps.map((app, i) => (
                <tr key={app.id} className={i % 2 === 1 ? 'bg-[#F2F6FA] dark:bg-gray-950' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{app.name}</div>
                    <div className="text-xs text-gray-400">{app.domain}</div>
                  </td>
                  <td className="px-4 py-3 capitalize">{app.category}</td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${CLASSIFICATION_COLORS[app.classification] ?? ''}`}>
                      {app.classification}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{app.visit_count}</td>
                  <td className="px-4 py-3 text-right">
                    <RiskBadge score={app.risk_score} />
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {new Date(app.last_seen_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <select
                      value={app.classification}
                      onChange={e => handleClassify(app.id, e.target.value)}
                      className="text-xs px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-transparent focus:outline-none"
                    >
                      <option value="sanctioned">Sanctioned</option>
                      <option value="unsanctioned">Unsanctioned</option>
                      <option value="unclassified">Unclassified</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function RiskBadge({ score }: { score: number }) {
  let color = 'text-green-600 dark:text-green-400';
  if (score >= 60) color = 'text-red-600 dark:text-red-400';
  else if (score >= 40) color = 'text-amber-600 dark:text-amber-400';

  return <span className={`font-mono font-medium ${color}`}>{score}</span>;
}
