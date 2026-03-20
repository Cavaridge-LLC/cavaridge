/**
 * Tenant management — list, create, edit, deactivate tenants across all 4 tiers.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Plus, Search, GitBranch, ChevronDown } from 'lucide-react';
import { tenants } from '../lib/api';

const TIER_COLORS: Record<string, string> = {
  platform: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  msp: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  client: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  site: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
  prospect: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  inactive: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
  suspended: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

export function TenantsPage() {
  const [data, setData] = useState<{ tenants: any[]; total: number }>({ tenants: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'msp', parent_id: '' });

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (typeFilter) params.type = typeFilter;
      const result = await tenants.list(params);
      setData(result);
    } catch { /* DB not connected */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, [search, typeFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await tenants.create({
        name: form.name,
        type: form.type,
        parent_id: form.parent_id || undefined,
      });
      setShowCreate(false);
      setForm({ name: '', type: 'msp', parent_id: '' });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleToggle(id: string, currentStatus: string) {
    try {
      if (currentStatus === 'active') {
        await tenants.deactivate(id);
      } else {
        await tenants.activate(id);
      }
      load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Tenant Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data.total} tenants across 4 tiers
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to="/tenants/tree"
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <GitBranch size={16} />
            Hierarchy Tree
          </Link>
          <button
            onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-[#2E5090] text-white hover:bg-[#254080] transition-colors"
          >
            <Plus size={16} />
            Create Tenant
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
          <h3 className="text-sm font-semibold">New Tenant</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <input
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              placeholder="Tenant name"
              required
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
            <select
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              <option value="platform">Platform</option>
              <option value="msp">MSP</option>
              <option value="client">Client</option>
              <option value="site">Site</option>
              <option value="prospect">Prospect</option>
            </select>
            <input
              value={form.parent_id}
              onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
              placeholder="Parent tenant ID (optional)"
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
          </div>
          <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-[#2E5090] text-white hover:bg-[#254080]">
            Create
          </button>
        </form>
      )}

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search tenants..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
        </div>
        <select
          value={typeFilter}
          onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
          <option value="">All tiers</option>
          <option value="platform">Platform</option>
          <option value="msp">MSP</option>
          <option value="client">Client</option>
          <option value="site">Site</option>
          <option value="prospect">Prospect</option>
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 text-left">
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Name</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tier</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Parent</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Children</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : data.tenants.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No tenants found. Connect to database or create a tenant.</td></tr>
            ) : (
              data.tenants.map((t: any) => (
                <tr key={t.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-gray-100">
                    <div className="flex items-center gap-2">
                      <Building2 size={14} className="text-gray-400" />
                      {t.name}
                    </div>
                    <p className="text-[11px] text-gray-400 font-mono mt-0.5">{t.id}</p>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${TIER_COLORS[t.type] ?? ''}`}>
                      {t.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {t.parent_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {t.child_count ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${STATUS_COLORS[t.status] ?? ''}`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(t.id, t.status)}
                      className="text-xs text-[#2E5090] hover:underline"
                    >
                      {t.status === 'active' ? 'Deactivate' : 'Activate'}
                    </button>
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
