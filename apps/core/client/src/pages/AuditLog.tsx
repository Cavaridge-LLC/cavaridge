/**
 * Audit log viewer — query audit_log with filters by tenant, user, action, date range.
 */
import { useEffect, useState } from 'react';
import { ScrollText, Search, Filter, ChevronLeft, ChevronRight } from 'lucide-react';
import { audit } from '../lib/api';

export function AuditLogPage() {
  const [data, setData] = useState<{ entries: any[]; total: number }>({ entries: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [filters, setFilters] = useState({
    tenant_id: '',
    user_id: '',
    action: '',
    resource_type: '',
    app_code: '',
    from: '',
    to: '',
  });
  const [stats, setStats] = useState<any>(null);
  const [filterOptions, setFilterOptions] = useState<{ actions: string[]; resourceTypes: string[]; appCodes: string[] }>({
    actions: [], resourceTypes: [], appCodes: [],
  });

  const PAGE_SIZE = 50;

  useEffect(() => {
    Promise.allSettled([
      audit.stats(),
      audit.actions(),
      audit.resourceTypes(),
      audit.appCodes(),
    ]).then(([s, a, r, c]) => {
      if (s.status === 'fulfilled') setStats(s.value);
      if (a.status === 'fulfilled') setFilterOptions(prev => ({ ...prev, actions: a.value }));
      if (r.status === 'fulfilled') setFilterOptions(prev => ({ ...prev, resourceTypes: r.value }));
      if (c.status === 'fulfilled') setFilterOptions(prev => ({ ...prev, appCodes: c.value }));
    });
  }, []);

  useEffect(() => { load(); }, [page, filters]);

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {
        limit: String(PAGE_SIZE),
        offset: String(page * PAGE_SIZE),
      };
      for (const [k, v] of Object.entries(filters)) {
        if (v) params[k] = v;
      }
      const result = await audit.query(params);
      setData(result);
    } catch { /* DB not connected */ }
    setLoading(false);
  }

  const totalPages = Math.ceil(data.total / PAGE_SIZE);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Audit Log</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data.total} entries
            {stats ? ` — ${stats.last24h} in last 24h` : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-[10px] text-gray-500 mb-1 uppercase">Tenant ID</label>
          <input
            value={filters.tenant_id}
            onChange={e => { setFilters(f => ({ ...f, tenant_id: e.target.value })); setPage(0); }}
            placeholder="UUID"
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 w-48"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-1 uppercase">Action</label>
          <select
            value={filters.action}
            onChange={e => { setFilters(f => ({ ...f, action: e.target.value })); setPage(0); }}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            <option value="">All</option>
            {filterOptions.actions.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-1 uppercase">Resource Type</label>
          <select
            value={filters.resource_type}
            onChange={e => { setFilters(f => ({ ...f, resource_type: e.target.value })); setPage(0); }}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            <option value="">All</option>
            {filterOptions.resourceTypes.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-1 uppercase">App</label>
          <select
            value={filters.app_code}
            onChange={e => { setFilters(f => ({ ...f, app_code: e.target.value })); setPage(0); }}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          >
            <option value="">All</option>
            {filterOptions.appCodes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-1 uppercase">From</label>
          <input
            type="datetime-local"
            value={filters.from}
            onChange={e => { setFilters(f => ({ ...f, from: e.target.value })); setPage(0); }}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
        </div>
        <div>
          <label className="block text-[10px] text-gray-500 mb-1 uppercase">To</label>
          <input
            type="datetime-local"
            value={filters.to}
            onChange={e => { setFilters(f => ({ ...f, to: e.target.value })); setPage(0); }}
            className="px-3 py-1.5 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 text-left">
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Timestamp</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">User</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tenant</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Action</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Resource</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">App</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : data.entries.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No audit entries found.</td></tr>
            ) : (
              data.entries.map((e: any) => (
                <tr key={e.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                    {new Date(e.created_at).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {e.user_name || e.user_email || e.user_id?.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {e.tenant_name || e.organization_id?.slice(0, 8)}
                  </td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 dark:bg-gray-800 font-mono">
                      {e.action}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-500">
                    {e.resource_type}
                    {e.resource_id && <span className="ml-1 font-mono">#{e.resource_id.slice(0, 8)}</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400 font-mono">{e.app_code ?? '—'}</td>
                  <td className="px-4 py-3 text-xs text-gray-400 max-w-48 truncate">
                    {e.details_json ? JSON.stringify(e.details_json).slice(0, 80) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-gray-400">
            Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, data.total)} of {data.total}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-2 rounded-lg border border-gray-300 dark:border-gray-700 disabled:opacity-30 hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
