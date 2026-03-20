/**
 * Device Management — Enrolled devices, enrollment tokens, status tracking.
 */
import { useEffect, useState } from 'react';
import { Monitor, Plus, Key, Copy, Trash2 } from 'lucide-react';
import { devices, enrollment } from '../lib/api';

interface Device {
  id: string;
  device_id: string;
  hostname: string;
  os: string;
  browser: string;
  browser_version: string;
  extension_version: string;
  status: string;
  last_seen_at: string;
  enrolled_at: string;
  event_count: number;
}

interface Token {
  id: string;
  token: string;
  label: string;
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  created_at: string;
  revoked_at: string | null;
}

const STATUS_COLORS: Record<string, string> = {
  enrolled: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
  active: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  inactive: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300',
  revoked: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
};

export function DevicesPage() {
  const [deviceList, setDeviceList] = useState<Device[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [tab, setTab] = useState<'devices' | 'tokens'>('devices');
  const [loading, setLoading] = useState(true);
  const [showTokenForm, setShowTokenForm] = useState(false);

  async function loadData() {
    try {
      const [d, t, s] = await Promise.all([
        devices.list(),
        enrollment.tokens(),
        devices.stats(),
      ]);
      setDeviceList(d.data ?? []);
      setTokens(t.data ?? []);
      setStats(s);
    } catch {
      // Handle gracefully
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadData(); }, []);

  async function handleCreateToken(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    await enrollment.createToken({
      label: fd.get('label') as string || undefined,
      maxUses: parseInt(fd.get('maxUses') as string) || undefined,
    });
    setShowTokenForm(false);
    loadData();
  }

  async function handleRevokeToken(id: string) {
    await enrollment.revokeToken(id);
    loadData();
  }

  async function handleCopyToken(token: string) {
    await navigator.clipboard.writeText(token);
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Monitor size={24} className="text-[#2E5090]" />
            Device Management
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Enrolled endpoints and enrollment token management
          </p>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Total', value: stats.total },
            { label: 'Enrolled', value: stats.enrolled },
            { label: 'Active', value: stats.active },
            { label: 'Inactive', value: stats.inactive },
            { label: 'Seen Today', value: stats.seen_today },
          ].map(s => (
            <div key={s.label} className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 p-4 text-center">
              <div className="text-2xl font-bold">{s.value}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setTab('devices')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'devices'
              ? 'border-[#2E5090] text-[#2E5090]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Devices ({deviceList.length})
        </button>
        <button
          onClick={() => setTab('tokens')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            tab === 'tokens'
              ? 'border-[#2E5090] text-[#2E5090]'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          <Key size={14} className="inline mr-1" />
          Enrollment Tokens ({tokens.length})
        </button>
      </div>

      {/* Devices tab */}
      {tab === 'devices' && (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#2E5090] text-white">
                <th className="text-left px-4 py-3 font-medium">Hostname</th>
                <th className="text-left px-4 py-3 font-medium">OS / Browser</th>
                <th className="text-center px-4 py-3 font-medium">Status</th>
                <th className="text-right px-4 py-3 font-medium">Events</th>
                <th className="text-left px-4 py-3 font-medium">Last Seen</th>
                <th className="text-left px-4 py-3 font-medium">Enrolled</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {loading ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">Loading...</td></tr>
              ) : deviceList.length === 0 ? (
                <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  No devices enrolled. Create an enrollment token and deploy the AEGIS extension.
                </td></tr>
              ) : (
                deviceList.map((d, i) => (
                  <tr key={d.id} className={i % 2 === 1 ? 'bg-[#F2F6FA] dark:bg-gray-950' : ''}>
                    <td className="px-4 py-3">
                      <div className="font-medium">{d.hostname ?? 'Unknown'}</div>
                      <div className="text-xs text-gray-400 font-mono">{d.device_id.substring(0, 12)}...</div>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <div>{d.os ?? '—'}</div>
                      <div className="text-gray-400">{d.browser} {d.browser_version}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[d.status] ?? ''}`}>
                        {d.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono">{d.event_count}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {d.last_seen_at ? new Date(d.last_seen_at).toLocaleString() : 'Never'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">
                      {d.enrolled_at ? new Date(d.enrolled_at).toLocaleDateString() : '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Tokens tab */}
      {tab === 'tokens' && (
        <div>
          <div className="mb-4">
            <button
              onClick={() => setShowTokenForm(!showTokenForm)}
              className="flex items-center gap-2 px-4 py-2 bg-[#2E5090] text-white rounded-lg text-sm font-medium hover:bg-[#1e3a6e] transition-colors"
            >
              <Plus size={16} />
              Create Token
            </button>
          </div>

          {showTokenForm && (
            <form onSubmit={handleCreateToken} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 mb-4 flex gap-3 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium mb-1">Label</label>
                <input name="label" placeholder="e.g., Office Deployment" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:border-[#2E5090]" />
              </div>
              <div className="w-32">
                <label className="block text-xs font-medium mb-1">Max Uses</label>
                <input name="maxUses" type="number" placeholder="0 = unlimited" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:border-[#2E5090]" />
              </div>
              <button type="submit" className="px-4 py-2 bg-[#2E5090] text-white rounded-lg text-sm font-medium hover:bg-[#1e3a6e]">
                Create
              </button>
            </form>
          )}

          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#2E5090] text-white">
                  <th className="text-left px-4 py-3 font-medium">Label</th>
                  <th className="text-left px-4 py-3 font-medium">Token</th>
                  <th className="text-center px-4 py-3 font-medium">Usage</th>
                  <th className="text-left px-4 py-3 font-medium">Created</th>
                  <th className="text-center px-4 py-3 font-medium">Status</th>
                  <th className="text-center px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {tokens.length === 0 ? (
                  <tr><td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                    No enrollment tokens yet.
                  </td></tr>
                ) : (
                  tokens.map((t, i) => (
                    <tr key={t.id} className={i % 2 === 1 ? 'bg-[#F2F6FA] dark:bg-gray-950' : ''}>
                      <td className="px-4 py-3 font-medium">{t.label ?? '—'}</td>
                      <td className="px-4 py-3">
                        <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">
                          {t.token.substring(0, 16)}...
                        </code>
                      </td>
                      <td className="px-4 py-3 text-center text-xs">
                        {t.use_count} / {t.max_uses === 0 ? '∞' : t.max_uses}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {new Date(t.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                          t.revoked_at ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                        }`}>
                          {t.revoked_at ? 'Revoked' : 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => handleCopyToken(t.token)} title="Copy token" className="p-1 text-gray-400 hover:text-[#2E5090]">
                            <Copy size={14} />
                          </button>
                          {!t.revoked_at && (
                            <button onClick={() => handleRevokeToken(t.id)} title="Revoke token" className="p-1 text-gray-400 hover:text-red-600">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
