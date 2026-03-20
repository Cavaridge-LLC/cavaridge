/**
 * Policy Management — CRUD for security policies pushed to extensions.
 */
import { useEffect, useState } from 'react';
import { ShieldCheck, Plus, Edit, Trash2, ToggleLeft, ToggleRight } from 'lucide-react';
import { policies } from '../lib/api';

interface Policy {
  id: string;
  name: string;
  description: string;
  type: string;
  enabled: boolean;
  priority: number;
  rules: any[];
  version: number;
  created_at: string;
  updated_at: string;
}

const TYPE_LABELS: Record<string, string> = {
  url_block: 'URL Block',
  url_allow: 'URL Allow',
  saas_block: 'SaaS Block',
  dlp: 'DLP',
  credential: 'Credential',
  browser_config: 'Browser Config',
  dns: 'DNS',
};

const TYPE_COLORS: Record<string, string> = {
  url_block: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  url_allow: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  saas_block: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
  dlp: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  credential: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  browser_config: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  dns: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-300',
};

export function PoliciesPage() {
  const [policyList, setPolicyList] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  async function loadData() {
    try {
      const res = await policies.list();
      setPolicyList(res.data ?? []);
    } catch {
      // Handle gracefully
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const rulesText = fd.get('rules') as string;

    let rules;
    try {
      rules = JSON.parse(rulesText);
    } catch {
      alert('Invalid JSON for rules');
      return;
    }

    await policies.create({
      name: fd.get('name'),
      description: fd.get('description'),
      type: fd.get('type'),
      priority: parseInt(fd.get('priority') as string) || 100,
      rules,
    });
    setShowForm(false);
    loadData();
  }

  async function handleToggle(id: string, currentEnabled: boolean) {
    await policies.update(id, { enabled: !currentEnabled });
    loadData();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this policy?')) return;
    await policies.delete(id);
    loadData();
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ShieldCheck size={24} className="text-[#2E5090]" />
            Security Policies
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Manage URL blocking, SaaS policies, DLP rules, and browser configurations
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E5090] text-white rounded-lg text-sm font-medium hover:bg-[#1e3a6e] transition-colors"
        >
          <Plus size={16} />
          Create Policy
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Policy Name</label>
              <input name="name" required className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:border-[#2E5090]" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1">Type</label>
                <select name="type" required className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:border-[#2E5090]">
                  {Object.entries(TYPE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Priority</label>
                <input name="priority" type="number" defaultValue={100} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:border-[#2E5090]" />
              </div>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <input name="description" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:border-[#2E5090]" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Rules (JSON array)</label>
            <textarea
              name="rules"
              required
              rows={4}
              defaultValue={'[{"pattern": "*.example.com", "action": "block"}]'}
              className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm font-mono focus:outline-none focus:border-[#2E5090]"
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" className="px-4 py-2 bg-[#2E5090] text-white rounded-lg text-sm font-medium hover:bg-[#1e3a6e]">
              Create Policy
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-sm hover:bg-gray-200 dark:hover:bg-gray-700">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Policy list */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[#2E5090] text-white">
              <th className="text-left px-4 py-3 font-medium">Policy</th>
              <th className="text-center px-4 py-3 font-medium">Type</th>
              <th className="text-center px-4 py-3 font-medium">Priority</th>
              <th className="text-center px-4 py-3 font-medium">Rules</th>
              <th className="text-center px-4 py-3 font-medium">Status</th>
              <th className="text-center px-4 py-3 font-medium">Version</th>
              <th className="text-center px-4 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">Loading...</td></tr>
            ) : policyList.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                No policies configured yet. Create your first policy to start enforcing security controls.
              </td></tr>
            ) : (
              policyList.map((p, i) => (
                <tr key={p.id} className={i % 2 === 1 ? 'bg-[#F2F6FA] dark:bg-gray-950' : ''}>
                  <td className="px-4 py-3">
                    <div className="font-medium">{p.name}</div>
                    {p.description && <div className="text-xs text-gray-400">{p.description}</div>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${TYPE_COLORS[p.type] ?? ''}`}>
                      {TYPE_LABELS[p.type] ?? p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono">{p.priority}</td>
                  <td className="px-4 py-3 text-center">{Array.isArray(p.rules) ? p.rules.length : 0}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleToggle(p.id, p.enabled)}>
                      {p.enabled
                        ? <ToggleRight size={20} className="text-green-600" />
                        : <ToggleLeft size={20} className="text-gray-400" />
                      }
                    </button>
                  </td>
                  <td className="px-4 py-3 text-center text-xs text-gray-400">v{p.version}</td>
                  <td className="px-4 py-3 text-center">
                    <button onClick={() => handleDelete(p.id)} title="Delete" className="p-1 text-gray-400 hover:text-red-600">
                      <Trash2 size={14} />
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
