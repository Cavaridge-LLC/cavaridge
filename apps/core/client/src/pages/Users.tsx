/**
 * User management — create users, assign roles, assign to tenants, bulk invite.
 */
import { useEffect, useState } from 'react';
import { Users as UsersIcon, Plus, Search, Upload } from 'lucide-react';
import { users } from '../lib/api';

const ROLE_LABELS: Record<string, string> = {
  platform_owner: 'Platform Owner',
  platform_admin: 'Platform Admin',
  tenant_admin: 'Tenant Admin',
  user: 'User',
  viewer: 'Viewer',
};

const ROLE_COLORS: Record<string, string> = {
  platform_owner: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900 dark:text-indigo-300',
  platform_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300',
  tenant_admin: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  user: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  viewer: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
};

export function UsersPage() {
  const [data, setData] = useState<{ users: any[]; total: number }>({ users: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [showBulk, setShowBulk] = useState(false);
  const [form, setForm] = useState({ email: '', full_name: '', role: 'user', organization_id: '' });
  const [bulkText, setBulkText] = useState('');

  async function load() {
    setLoading(true);
    try {
      const params: Record<string, string> = {};
      if (search) params.search = search;
      if (roleFilter) params.role = roleFilter;
      const result = await users.list(params);
      setData(result);
    } catch { /* DB not connected */ }
    setLoading(false);
  }

  useEffect(() => { load(); }, [search, roleFilter]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await users.create(form);
      setShowCreate(false);
      setForm({ email: '', full_name: '', role: 'user', organization_id: '' });
      load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  async function handleBulkInvite(e: React.FormEvent) {
    e.preventDefault();
    try {
      // Parse CSV-like input: email,name,role,org_id per line
      const invites = bulkText.trim().split('\n').map(line => {
        const [email, full_name, role, organization_id] = line.split(',').map(s => s.trim());
        return { email, full_name, role: role || 'user', organization_id };
      }).filter(i => i.email && i.organization_id);

      if (invites.length === 0) {
        alert('No valid invites found. Format: email, name, role, org_id (one per line)');
        return;
      }

      const result = await users.bulkInvite(invites);
      alert(`Invited ${result.summary.created} of ${result.summary.total} users`);
      setShowBulk(false);
      setBulkText('');
      load();
    } catch (err: any) {
      alert(err.message);
    }
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">User Management</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {data.total} users — 5 RBAC roles
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setShowBulk(!showBulk); setShowCreate(false); }}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            <Upload size={16} />
            Bulk Invite
          </button>
          <button
            onClick={() => { setShowCreate(!showCreate); setShowBulk(false); }}
            className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-[#2E5090] text-white hover:bg-[#254080] transition-colors"
          >
            <Plus size={16} />
            Create User
          </button>
        </div>
      </div>

      {/* Create form */}
      {showCreate && (
        <form onSubmit={handleCreate} className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
          <h3 className="text-sm font-semibold">New User</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <input
              value={form.email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              placeholder="Email"
              type="email"
              required
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
            <input
              value={form.full_name}
              onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))}
              placeholder="Full name"
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
            <select
              value={form.role}
              onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            >
              {Object.entries(ROLE_LABELS).map(([v, l]) => (
                <option key={v} value={v}>{l}</option>
              ))}
            </select>
            <input
              value={form.organization_id}
              onChange={e => setForm(f => ({ ...f, organization_id: e.target.value }))}
              placeholder="Tenant ID"
              required
              className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
            />
          </div>
          <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-[#2E5090] text-white hover:bg-[#254080]">
            Create
          </button>
        </form>
      )}

      {/* Bulk invite */}
      {showBulk && (
        <form onSubmit={handleBulkInvite} className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 space-y-3">
          <h3 className="text-sm font-semibold">Bulk Invite</h3>
          <p className="text-xs text-gray-500">One per line: email, full_name, role, tenant_id</p>
          <textarea
            value={bulkText}
            onChange={e => setBulkText(e.target.value)}
            rows={6}
            placeholder="user@example.com, John Doe, tenant_admin, 00000000-0000-0000-0000-000000000000"
            className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 font-mono"
          />
          <button type="submit" className="px-4 py-2 text-sm rounded-lg bg-[#2E5090] text-white hover:bg-[#254080]">
            Send Invites
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
            placeholder="Search users..."
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
          />
        </div>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800"
        >
          <option value="">All roles</option>
          {Object.entries(ROLE_LABELS).map(([v, l]) => (
            <option key={v} value={v}>{l}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-900 text-left">
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">User</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Role</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Tenant</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Status</th>
              <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">Loading...</td></tr>
            ) : data.users.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No users found.</td></tr>
            ) : (
              data.users.map((u: any) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900 dark:text-gray-100">{u.full_name || u.email}</div>
                    {u.full_name && <p className="text-xs text-gray-400">{u.email}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-block px-2 py-0.5 text-xs rounded-full font-medium ${ROLE_COLORS[u.role] ?? ''}`}>
                      {ROLE_LABELS[u.role] ?? u.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400">
                    {u.tenant_name ?? '—'}
                    {u.tenant_type && <span className="text-[10px] ml-1">({u.tenant_type})</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${u.status === 'active' ? 'text-green-600' : u.status === 'invited' ? 'text-amber-600' : 'text-red-600'}`}>
                      {u.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.status === 'active' && (
                      <button
                        onClick={async () => { await users.deactivate(u.id); load(); }}
                        className="text-xs text-red-600 hover:underline"
                      >
                        Deactivate
                      </button>
                    )}
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
