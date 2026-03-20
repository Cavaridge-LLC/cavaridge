/**
 * MSP Dashboard — overview with ticket stats, SLA health,
 * connector status, billing summary, and partner tier.
 */
import { useEffect, useState } from 'react';
import {
  Ticket, AlertTriangle, Clock, CheckCircle, Plug, DollarSign,
} from 'lucide-react';
import { tickets, connectors, billing, partners } from '../lib/api';

interface Stats {
  ticketStats: any;
  connectorList: any[];
  billingSummary: any;
  usage: any;
}

export function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      tickets.stats().catch(() => ({})),
      connectors.list().catch(() => []),
      billing.summary().catch(() => ({})),
      partners.usage().catch(() => ({})),
    ])
      .then(([ticketStats, connectorList, billingSummary, usage]) => {
        setStats({ ticketStats, connectorList, billingSummary, usage });
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">
            Failed to load dashboard: {error}. Ensure the API server is running and tenant context is configured.
          </p>
        </div>
      </div>
    );
  }

  const t = stats?.ticketStats ?? {};
  const b = stats?.billingSummary ?? {};
  const u = stats?.usage ?? {};

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Dashboard</h2>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Open Tickets"
          value={t.open_count ?? '—'}
          icon={<Ticket size={20} />}
          color="blue"
        />
        <StatCard
          label="Critical"
          value={t.critical_count ?? '—'}
          icon={<AlertTriangle size={20} />}
          color="red"
        />
        <StatCard
          label="SLA Breached"
          value={t.sla_breached_count ?? '—'}
          icon={<Clock size={20} />}
          color="orange"
        />
        <StatCard
          label="Resolved (7d)"
          value={t.resolved_this_week ?? '—'}
          icon={<CheckCircle size={20} />}
          color="green"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connector Health */}
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Plug size={18} /> Connectors
          </h3>
          {(stats?.connectorList ?? []).length === 0 ? (
            <p className="text-sm text-gray-500">No connectors configured yet.</p>
          ) : (
            <div className="space-y-3">
              {(stats?.connectorList ?? []).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{c.connector_id}</span>
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    c.health_status === 'healthy'
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : c.health_status === 'degraded'
                      ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
                  }`}>
                    {c.health_status ?? c.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Billing Summary */}
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <DollarSign size={18} /> Billing Overview
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Active Contracts</span>
              <span className="font-medium">{b.active_contracts ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Outstanding</span>
              <span className="font-medium">${b.outstanding ?? '0.00'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Overdue Invoices</span>
              <span className={`font-medium ${(b.overdue_count ?? 0) > 0 ? 'text-red-600' : ''}`}>
                {b.overdue_count ?? 0}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Unbilled Time</span>
              <span className="font-medium">{Math.round((b.unbilled_minutes ?? 0) / 60)}h</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">SLA Compliance (30d)</span>
              <span className="font-medium">{u.slaComplianceRate ?? '—'}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon, color,
}: {
  label: string;
  value: string | number;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'orange' | 'green';
}) {
  const colors = {
    blue: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
    red: 'bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300',
    orange: 'bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300',
    green: 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300',
  };

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <div className={`p-1.5 rounded ${colors[color]}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
