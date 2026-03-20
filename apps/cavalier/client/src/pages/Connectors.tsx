/**
 * Connector Dashboard — NinjaOne and HaloPSA connector management.
 * Shows sync status, last sync time, error logs, configuration.
 */
import { useEffect, useState } from 'react';
import {
  Plug, RefreshCw, Settings, Activity, AlertCircle, CheckCircle,
} from 'lucide-react';
import { connectors } from '../lib/api';

export function ConnectorsPage() {
  const [catalog, setCatalog] = useState<any[]>([]);
  const [configured, setConfigured] = useState<any[]>([]);
  const [selectedConnector, setSelectedConnector] = useState<string | null>(null);
  const [syncLogs, setSyncLogs] = useState<any[]>([]);
  const [showConfig, setShowConfig] = useState<string | null>(null);

  useEffect(() => {
    connectors.catalog().then(setCatalog).catch(() => {});
    loadConfigured();
  }, []);

  const loadConfigured = async () => {
    try {
      const list = await connectors.list();
      setConfigured(Array.isArray(list) ? list : []);
    } catch {
      setConfigured([]);
    }
  };

  const loadSyncLogs = async (connectorId: string) => {
    setSelectedConnector(connectorId);
    try {
      const logs = await connectors.syncLogs(connectorId);
      setSyncLogs(Array.isArray(logs) ? logs : []);
    } catch {
      setSyncLogs([]);
    }
  };

  const handleSync = async (connectorId: string) => {
    await connectors.triggerSync(connectorId, { mode: 'incremental' });
    loadSyncLogs(connectorId);
  };

  const getConfiguredEntry = (connectorId: string) =>
    configured.find((c) => c.connector_id === connectorId);

  const statusIcons: Record<string, React.ReactNode> = {
    active: <CheckCircle size={14} className="text-green-500" />,
    connected: <CheckCircle size={14} className="text-green-500" />,
    healthy: <CheckCircle size={14} className="text-green-500" />,
    error: <AlertCircle size={14} className="text-red-500" />,
    unhealthy: <AlertCircle size={14} className="text-red-500" />,
    configuring: <Settings size={14} className="text-yellow-500 animate-spin" />,
  };

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Connectors</h2>

      {/* Connector cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {catalog.map((c) => {
          const config = getConfiguredEntry(c.id);
          const isConfigured = !!config;

          return (
            <div key={c.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                    <Plug size={18} className="text-gray-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">{c.name}</h3>
                    <span className="text-xs text-gray-400">{c.type.toUpperCase()} — Phase {c.phase}</span>
                  </div>
                </div>
                {isConfigured && statusIcons[config.health_status ?? config.status]}
              </div>

              <p className="text-xs text-gray-500 mb-4">{c.description}</p>

              {isConfigured ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">Status</span>
                    <span className="font-medium">{config.status}</span>
                  </div>
                  {config.last_health_check && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Last Check</span>
                      <span>{new Date(config.last_health_check).toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => loadSyncLogs(c.id)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs border border-gray-200 dark:border-gray-700 rounded hover:bg-gray-50 dark:hover:bg-gray-800"
                    >
                      <Activity size={12} /> Logs
                    </button>
                    <button
                      onClick={() => handleSync(c.id)}
                      className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 text-xs bg-[#2E5090] text-white rounded hover:bg-[#254078]"
                    >
                      <RefreshCw size={12} /> Sync
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setShowConfig(c.id)}
                  disabled={c.phase > 1}
                  className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {c.phase > 1 ? `Coming Phase ${c.phase}` : 'Configure'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Sync logs panel */}
      {selectedConnector && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Activity size={16} /> Sync Logs — {selectedConnector}
            </h3>
            <button onClick={() => setSelectedConnector(null)} className="text-xs text-gray-400 hover:text-gray-600">
              Close
            </button>
          </div>

          {syncLogs.length === 0 ? (
            <p className="text-sm text-gray-400">No sync logs yet.</p>
          ) : (
            <table className="w-full text-xs">
              <thead className="text-gray-500">
                <tr className="text-left">
                  <th className="py-2">Type</th>
                  <th className="py-2">Entity</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Records</th>
                  <th className="py-2">Duration</th>
                  <th className="py-2">Started</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {syncLogs.map((log: any) => (
                  <tr key={log.id}>
                    <td className="py-2">{log.sync_type}</td>
                    <td className="py-2">{log.entity_type}</td>
                    <td className="py-2">
                      <span className={`px-1.5 py-0.5 rounded ${
                        log.status === 'completed' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                          : log.status === 'failed' ? 'bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300'
                          : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700'
                      }`}>
                        {log.status}
                      </span>
                    </td>
                    <td className="py-2">{log.records_processed ?? 0}</td>
                    <td className="py-2">{log.duration_ms ? `${log.duration_ms}ms` : '—'}</td>
                    <td className="py-2">{new Date(log.started_at).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Config modal */}
      {showConfig && (
        <ConnectorConfigModal
          connectorId={showConfig}
          catalog={catalog.find((c) => c.id === showConfig)}
          onClose={() => setShowConfig(null)}
          onSaved={() => { setShowConfig(null); loadConfigured(); }}
        />
      )}
    </div>
  );
}

function ConnectorConfigModal({
  connectorId, catalog, onClose, onSaved,
}: {
  connectorId: string;
  catalog: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await connectors.configure(connectorId, { credentials });
      onSaved();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg w-full max-w-md p-6">
        <h3 className="text-lg font-bold mb-4">Configure {catalog?.name ?? connectorId}</h3>
        <p className="text-sm text-gray-500 mb-4">
          Credentials are encrypted and stored securely. In production, they are managed via Doppler.
        </p>

        <div className="space-y-3">
          {(catalog?.requiredCredentials ?? []).map((key: string) => (
            <div key={key}>
              <label className="block text-sm font-medium mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
              <input
                type={key.includes('secret') || key.includes('Secret') ? 'password' : 'text'}
                value={credentials[key] ?? ''}
                onChange={(e) => setCredentials((c) => ({ ...c, [key]: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-sm"
              />
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 dark:border-gray-700 rounded-lg">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm bg-[#2E5090] text-white rounded-lg disabled:opacity-50">
            {saving ? 'Saving...' : 'Save & Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
