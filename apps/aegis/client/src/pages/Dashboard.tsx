/**
 * AEGIS Dashboard — Overview of security posture.
 * Shows device stats, SaaS summary, recent telemetry, score.
 */
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Monitor, Globe, ShieldCheck, Gauge, AlertTriangle, Activity } from 'lucide-react';
import { devices, saas, telemetry, score } from '../lib/api';

interface Stats {
  devices: any;
  saas: any;
  telemetry: any;
  score: any;
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [d, s, t, sc] = await Promise.allSettled([
          devices.stats(),
          saas.summary(),
          telemetry.stats(),
          score.current(),
        ]);

        setStats({
          devices: d.status === 'fulfilled' ? d.value : null,
          saas: s.status === 'fulfilled' ? s.value : null,
          telemetry: t.status === 'fulfilled' ? t.value : null,
          score: sc.status === 'fulfilled' ? sc.value : null,
        });
      } catch {
        // Stats may not be available yet
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-48" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 dark:bg-gray-800 rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const cards = [
    {
      label: 'Enrolled Devices',
      value: stats?.devices?.total ?? 0,
      sub: `${stats?.devices?.active ?? 0} active`,
      icon: Monitor,
      color: 'text-blue-600 dark:text-blue-400',
      bg: 'bg-blue-50 dark:bg-blue-950',
      link: '/devices',
    },
    {
      label: 'SaaS Applications',
      value: stats?.saas?.total ?? 0,
      sub: `${stats?.saas?.unsanctioned ?? 0} unsanctioned`,
      icon: Globe,
      color: 'text-purple-600 dark:text-purple-400',
      bg: 'bg-purple-50 dark:bg-purple-950',
      link: '/saas',
    },
    {
      label: 'Active Policies',
      value: '-',
      sub: 'URL block, SaaS, DLP',
      icon: ShieldCheck,
      color: 'text-green-600 dark:text-green-400',
      bg: 'bg-green-50 dark:bg-green-950',
      link: '/policies',
    },
    {
      label: 'Adjusted Score',
      value: stats?.score?.total_score != null ? Math.round(stats.score.total_score) : '—',
      sub: stats?.score?.total_score != null ? 'out of 100' : 'Not calculated',
      icon: Gauge,
      color: 'text-amber-600 dark:text-amber-400',
      bg: 'bg-amber-50 dark:bg-amber-950',
      link: '/score',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Security Dashboard</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          AEGIS Managed Browser Security — Phase 1: Shadow IT Discovery
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <Link
            key={card.label}
            to={card.link}
            className={`${card.bg} rounded-xl p-5 border border-gray-200 dark:border-gray-800 hover:shadow-md transition-shadow`}
          >
            <div className="flex items-center gap-3 mb-3">
              <card.icon size={20} className={card.color} />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{card.label}</span>
            </div>
            <div className="text-3xl font-bold">{card.value}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">{card.sub}</div>
          </Link>
        ))}
      </div>

      {/* Telemetry summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={18} className="text-[#2E5090]" />
            <h2 className="text-lg font-semibold">Telemetry Overview</h2>
          </div>
          <div className="space-y-3">
            <StatRow label="Total Events" value={stats?.telemetry?.total_events ?? 0} />
            <StatRow label="Unique Domains" value={stats?.telemetry?.unique_domains ?? 0} />
            <StatRow label="Active Devices" value={stats?.telemetry?.active_devices ?? 0} />
            <StatRow label="Events Today" value={stats?.telemetry?.events_today ?? 0} />
            <StatRow label="Events This Week" value={stats?.telemetry?.events_this_week ?? 0} />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={18} className="text-amber-500" />
            <h2 className="text-lg font-semibold">SaaS Risk Summary</h2>
          </div>
          <div className="space-y-3">
            <StatRow label="Sanctioned" value={stats?.saas?.sanctioned ?? 0} color="text-green-600 dark:text-green-400" />
            <StatRow label="Unsanctioned" value={stats?.saas?.unsanctioned ?? 0} color="text-red-600 dark:text-red-400" />
            <StatRow label="Unclassified" value={stats?.saas?.unclassified ?? 0} color="text-amber-600 dark:text-amber-400" />
            <StatRow label="Blocked" value={stats?.saas?.blocked ?? 0} color="text-gray-600 dark:text-gray-400" />
            <StatRow label="Avg Risk Score" value={stats?.saas?.avg_risk_score ?? '—'} />
          </div>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex justify-between items-center py-1">
      <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`text-sm font-semibold ${color ?? ''}`}>{value}</span>
    </div>
  );
}
