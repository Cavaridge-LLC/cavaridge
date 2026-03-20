/**
 * Platform governance dashboard — overview with stats cards.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2, Users, AppWindow, ScrollText, Plug, Database,
  Activity, Shield,
} from 'lucide-react';
import { tenants, users, apps, audit, connectors, database } from '../lib/api';

interface Stats {
  tenants: { total: number; active: number; byType: any[] } | null;
  users: { total: number; active: number; invited: number } | null;
  apps: { total: number; active: number; planned: number } | null;
  audit: { total: number; last24h: number; last7d: number; byApp?: any[] } | null;
  connectors: { total: number } | null;
  db: { status: string; table_count: number; db_size: string; active_connections: number } | null;
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats>({
    tenants: null, users: null, apps: null, audit: null, connectors: null, db: null,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [t, u, a, au, c, d] = await Promise.allSettled([
        tenants.stats(),
        users.stats(),
        apps.list(),
        audit.stats(),
        connectors.catalog(),
        database.health(),
      ]);

      setStats({
        tenants: t.status === 'fulfilled' ? t.value : null,
        users: u.status === 'fulfilled' ? u.value : null,
        apps: a.status === 'fulfilled' ? a.value.summary : null,
        audit: au.status === 'fulfilled' ? au.value : null,
        connectors: c.status === 'fulfilled' ? c.value.summary : null,
        db: d.status === 'fulfilled' ? d.value : null,
      });
      setLoading(false);
    }
    load();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Platform Governance</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Cavaridge operational dashboard — Platform Admin view
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <StatCard
          to="/tenants"
          icon={Building2}
          label="Tenants"
          value={stats.tenants?.total ?? '—'}
          sub={stats.tenants ? `${stats.tenants.active} active` : undefined}
          loading={loading}
          color="blue"
        />
        <StatCard
          to="/users"
          icon={Users}
          label="Users"
          value={stats.users?.total ?? '—'}
          sub={stats.users ? `${stats.users.active} active, ${stats.users.invited} invited` : undefined}
          loading={loading}
          color="green"
        />
        <StatCard
          to="/apps"
          icon={AppWindow}
          label="Apps"
          value={stats.apps?.total ?? 14}
          sub={stats.apps ? `${stats.apps.active} active, ${stats.apps.planned} planned` : undefined}
          loading={loading}
          color="purple"
        />
        <StatCard
          to="/audit"
          icon={ScrollText}
          label="Audit Events"
          value={stats.audit?.total ?? '—'}
          sub={stats.audit ? `${stats.audit.last24h} last 24h` : undefined}
          loading={loading}
          color="amber"
        />
        <StatCard
          to="/connectors"
          icon={Plug}
          label="Connectors"
          value={stats.connectors?.total ?? 25}
          sub="25 in catalog"
          loading={loading}
          color="cyan"
        />
        <StatCard
          to="/database"
          icon={Database}
          label="Database"
          value={stats.db?.table_count ?? '—'}
          sub={stats.db?.db_size ? `${stats.db.db_size} total` : stats.db?.status === 'error' ? 'Not connected' : undefined}
          loading={loading}
          color="rose"
        />
        <StatCard
          to="/database"
          icon={Activity}
          label="Connections"
          value={stats.db?.active_connections ?? '—'}
          sub={stats.db?.status === 'healthy' ? 'Pool healthy' : stats.db?.status === 'error' ? 'Not connected' : stats.db?.status}
          loading={loading}
          color="emerald"
        />
        <StatCard
          to="/settings"
          icon={Shield}
          label="Platform"
          value="CVG-CORE"
          sub="v0.1.0"
          loading={false}
          color="indigo"
        />
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <QuickSection title="Tenant Hierarchy" to="/tenants/tree">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Visual tree view of the 4-tier tenant model: Platform → MSP → Client → Site/Prospect
          </p>
        </QuickSection>
        <QuickSection title="Recent Audit Activity" to="/audit">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {stats.audit
              ? `${stats.audit.last7d} events in the last 7 days across ${stats.audit.byApp?.length ?? 0} apps`
              : 'View platform-wide audit trail with filters by tenant, user, action, and date range'}
          </p>
        </QuickSection>
      </div>
    </div>
  );
}

const COLOR_MAP: Record<string, string> = {
  blue: 'bg-blue-50 dark:bg-blue-950 text-blue-600 dark:text-blue-400',
  green: 'bg-green-50 dark:bg-green-950 text-green-600 dark:text-green-400',
  purple: 'bg-purple-50 dark:bg-purple-950 text-purple-600 dark:text-purple-400',
  amber: 'bg-amber-50 dark:bg-amber-950 text-amber-600 dark:text-amber-400',
  cyan: 'bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-400',
  rose: 'bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-400',
  emerald: 'bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400',
  indigo: 'bg-indigo-50 dark:bg-indigo-950 text-indigo-600 dark:text-indigo-400',
};

function StatCard({ to, icon: Icon, label, value, sub, loading, color }: {
  to: string;
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  loading: boolean;
  color: string;
}) {
  return (
    <Link
      to={to}
      className="block p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-[#2E5090]/40 transition-colors"
    >
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${COLOR_MAP[color]}`}>
          <Icon size={20} />
        </div>
        <div>
          <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">{label}</p>
          <p className="text-xl font-bold text-gray-900 dark:text-gray-100">
            {loading ? '...' : value}
          </p>
          {sub && <p className="text-xs text-gray-400 dark:text-gray-500">{sub}</p>}
        </div>
      </div>
    </Link>
  );
}

function QuickSection({ title, to, children }: { title: string; to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="block p-5 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-[#2E5090]/40 transition-colors"
    >
      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-2">{title}</h3>
      {children}
    </Link>
  );
}
