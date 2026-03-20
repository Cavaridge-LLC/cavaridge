/**
 * Database health — table counts, RLS status, migration history, extensions.
 */
import { useEffect, useState } from 'react';
import {
  Database, Shield, History, Puzzle, RefreshCw,
  CheckCircle, XCircle, AlertTriangle,
} from 'lucide-react';
import { database } from '../lib/api';

export function DatabaseHealthPage() {
  const [health, setHealth] = useState<any>(null);
  const [tables, setTables] = useState<any>(null);
  const [rls, setRls] = useState<any>(null);
  const [migrations, setMigrations] = useState<any>(null);
  const [extensions, setExtensions] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'tables' | 'rls' | 'migrations' | 'extensions'>('tables');

  async function load() {
    setLoading(true);
    const [h, t, r, m, e] = await Promise.allSettled([
      database.health(),
      database.tables(),
      database.rls(),
      database.migrations(),
      database.extensions(),
    ]);
    if (h.status === 'fulfilled') setHealth(h.value);
    if (t.status === 'fulfilled') setTables(t.value);
    if (r.status === 'fulfilled') setRls(r.value);
    if (m.status === 'fulfilled') setMigrations(m.value);
    if (e.status === 'fulfilled') setExtensions(e.value);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Database Health</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            PostgreSQL 16 via Supabase — Drizzle ORM
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-[#2E5090] text-white hover:bg-[#254080] disabled:opacity-50"
        >
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Health summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <HealthCard
          icon={Database}
          label="Database Size"
          value={health?.db_size ?? '—'}
          status={health?.status === 'healthy'}
        />
        <HealthCard
          icon={Shield}
          label="RLS Coverage"
          value={rls ? `${rls.summary.rlsEnabled}/${rls.summary.total}` : '—'}
          status={rls ? rls.summary.rlsDisabled === 0 : undefined}
          sub={rls?.summary.totalPolicies ? `${rls.summary.totalPolicies} policies` : undefined}
        />
        <HealthCard
          icon={Puzzle}
          label="Extensions"
          value={extensions?.extensions?.length ?? '—'}
          status={true}
          sub={health?.pgvector !== 'not installed' ? `pgvector ${health?.pgvector}` : 'pgvector missing'}
        />
        <HealthCard
          icon={History}
          label="Migrations"
          value={migrations?.count ?? '—'}
          status={true}
        />
      </div>

      {/* Connection info */}
      {health && (
        <div className="text-xs text-gray-400 flex gap-4 flex-wrap">
          <span>Active connections: {health.active_connections}</span>
          <span>Total connections: {health.total_connections}</span>
          <span>Tables: {health.table_count}</span>
          {health.pg_version && <span className="truncate max-w-md">{health.pg_version}</span>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {(['tables', 'rls', 'migrations', 'extensions'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize transition-colors ${
              activeTab === tab
                ? 'text-[#2E5090] border-b-2 border-[#2E5090]'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'tables' && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 text-left">
                <th className="px-4 py-3 font-medium text-gray-500">Table</th>
                <th className="px-4 py-3 font-medium text-gray-500">Schema</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-right">Row Count</th>
                <th className="px-4 py-3 font-medium text-gray-500 text-right">Total Size</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {!tables?.tables?.length ? (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  {loading ? 'Loading...' : 'No tables found or database not connected.'}
                </td></tr>
              ) : (
                tables.tables.map((t: any) => (
                  <tr key={`${t.schema}.${t.table_name}`} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-4 py-2 font-mono text-xs font-medium">{t.table_name}</td>
                    <td className="px-4 py-2 text-xs text-gray-400">{t.schema}</td>
                    <td className="px-4 py-2 text-xs text-right tabular-nums">{Number(t.row_count).toLocaleString()}</td>
                    <td className="px-4 py-2 text-xs text-right text-gray-400">{t.total_size}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'rls' && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 text-left">
                <th className="px-4 py-3 font-medium text-gray-500">Table</th>
                <th className="px-4 py-3 font-medium text-gray-500">RLS</th>
                <th className="px-4 py-3 font-medium text-gray-500">Policies</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {!rls?.tables?.length ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  {loading ? 'Loading...' : 'No tables found.'}
                </td></tr>
              ) : (
                rls.tables.map((t: any) => (
                  <tr key={t.table_name} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-4 py-2 font-mono text-xs font-medium">{t.table_name}</td>
                    <td className="px-4 py-2">
                      {t.rls_enabled ? (
                        <CheckCircle size={16} className="text-green-500" />
                      ) : (
                        <XCircle size={16} className="text-red-400" />
                      )}
                    </td>
                    <td className="px-4 py-2">
                      {t.policies.length > 0 ? (
                        <div className="space-y-1">
                          {t.policies.map((p: any) => (
                            <span key={p.policy_name} className="inline-block mr-2 px-2 py-0.5 text-[10px] rounded bg-gray-100 dark:bg-gray-800 font-mono">
                              {p.policy_name} ({p.command})
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">none</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'migrations' && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          {!migrations?.migrations?.length ? (
            <p className="px-4 py-8 text-center text-gray-400 text-sm">
              {migrations?.message ?? (loading ? 'Loading...' : 'No migrations found.')}
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 text-left">
                  <th className="px-4 py-3 font-medium text-gray-500">Version / Hash</th>
                  <th className="px-4 py-3 font-medium text-gray-500">Applied At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {migrations.migrations.map((m: any, i: number) => (
                  <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-4 py-2 font-mono text-xs">{m.hash ?? m.version ?? JSON.stringify(m).slice(0, 60)}</td>
                    <td className="px-4 py-2 text-xs text-gray-400">
                      {m.created_at ? new Date(m.created_at).toLocaleString() : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'extensions' && (
        <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 dark:bg-gray-900 text-left">
                <th className="px-4 py-3 font-medium text-gray-500">Extension</th>
                <th className="px-4 py-3 font-medium text-gray-500">Version</th>
                <th className="px-4 py-3 font-medium text-gray-500">Schema</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {!extensions?.extensions?.length ? (
                <tr><td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  {loading ? 'Loading...' : 'No extensions found.'}
                </td></tr>
              ) : (
                extensions.extensions.map((e: any) => (
                  <tr key={e.name} className="hover:bg-gray-50 dark:hover:bg-gray-900/50">
                    <td className="px-4 py-2 font-mono text-xs font-medium">{e.name}</td>
                    <td className="px-4 py-2 text-xs">{e.version}</td>
                    <td className="px-4 py-2 text-xs text-gray-400">{e.schema}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function HealthCard({ icon: Icon, label, value, status, sub }: {
  icon: any;
  label: string;
  value: string | number;
  status?: boolean;
  sub?: string;
}) {
  return (
    <div className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
      <div className="flex items-center gap-2 mb-2">
        <Icon size={16} className="text-[#2E5090]" />
        <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
        {status !== undefined && (
          status ? (
            <CheckCircle size={14} className="text-green-500 ml-auto" />
          ) : (
            <AlertTriangle size={14} className="text-amber-500 ml-auto" />
          )
        )}
      </div>
      <p className="text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
      {sub && <p className="text-[10px] text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}
