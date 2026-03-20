/**
 * Billing page — invoices (INV-YYYY-NNNNN), contracts (CTR-NNNNN),
 * time entries with timer support.
 */
import { useEffect, useState } from 'react';
import {
  Receipt, FileText, Clock, DollarSign, Play, Square,
} from 'lucide-react';
import { billing } from '../lib/api';

type Tab = 'overview' | 'invoices' | 'contracts' | 'time';

export function BillingPage() {
  const [tab, setTab] = useState<Tab>('overview');

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">Billing</h2>

      {/* Tab navigation */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-800">
        {([
          { id: 'overview', label: 'Overview', icon: DollarSign },
          { id: 'invoices', label: 'Invoices', icon: Receipt },
          { id: 'contracts', label: 'Contracts', icon: FileText },
          { id: 'time', label: 'Time Entries', icon: Clock },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === id
                ? 'border-[#2E5090] text-[#2E5090]'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <BillingOverview />}
      {tab === 'invoices' && <InvoiceList />}
      {tab === 'contracts' && <ContractList />}
      {tab === 'time' && <TimeEntryList />}
    </div>
  );
}

function BillingOverview() {
  const [summary, setSummary] = useState<any>({});

  useEffect(() => {
    billing.summary().then(setSummary).catch(() => {});
  }, []);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Total Collected" value={`$${summary.total_collected ?? '0.00'}`} />
      <StatCard label="Outstanding" value={`$${summary.outstanding ?? '0.00'}`} />
      <StatCard label="Overdue Invoices" value={summary.overdue_count ?? 0} alert={(summary.overdue_count ?? 0) > 0} />
      <StatCard label="Unbilled Hours" value={`${Math.round((summary.unbilled_minutes ?? 0) / 60)}h`} />
    </div>
  );
}

function InvoiceList() {
  const [invoices, setInvoices] = useState<any[]>([]);

  useEffect(() => {
    billing.invoices.list()
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  const statusColors: Record<string, string> = {
    draft: 'bg-gray-100 dark:bg-gray-800 text-gray-600',
    approved: 'bg-blue-100 dark:bg-blue-900 text-blue-700',
    sent: 'bg-indigo-100 dark:bg-indigo-900 text-indigo-700',
    paid: 'bg-green-100 dark:bg-green-900 text-green-700',
    overdue: 'bg-red-100 dark:bg-red-900 text-red-700',
    void: 'bg-gray-100 dark:bg-gray-800 text-gray-400',
  };

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr className="text-left text-gray-500">
            <th className="px-4 py-3 font-medium">Invoice #</th>
            <th className="px-4 py-3 font-medium">Period</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Total</th>
            <th className="px-4 py-3 font-medium">Due</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {invoices.length === 0 ? (
            <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No invoices yet.</td></tr>
          ) : (
            invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-4 py-3 font-mono">{inv.invoice_number}</td>
                <td className="px-4 py-3 text-xs">{inv.period_start} — {inv.period_end}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${statusColors[inv.status] ?? ''}`}>
                    {inv.status}
                  </span>
                </td>
                <td className="px-4 py-3 font-medium">${inv.total}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{inv.due_date}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function ContractList() {
  const [contracts, setContracts] = useState<any[]>([]);

  useEffect(() => {
    billing.contracts.list()
      .then((data) => setContracts(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr className="text-left text-gray-500">
            <th className="px-4 py-3 font-medium">Contract #</th>
            <th className="px-4 py-3 font-medium">Name</th>
            <th className="px-4 py-3 font-medium">Type</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Monthly</th>
            <th className="px-4 py-3 font-medium">End Date</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {contracts.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No contracts yet.</td></tr>
          ) : (
            contracts.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-4 py-3 font-mono">{c.contract_number}</td>
                <td className="px-4 py-3">{c.name}</td>
                <td className="px-4 py-3 capitalize">{c.type?.replace('_', ' ')}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    c.status === 'active' ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : c.status === 'expiring' ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
                  }`}>
                    {c.status}
                  </span>
                </td>
                <td className="px-4 py-3">{c.monthly_amount ? `$${c.monthly_amount}` : '—'}</td>
                <td className="px-4 py-3 text-xs text-gray-500">{c.end_date ?? 'Evergreen'}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function TimeEntryList() {
  const [entries, setEntries] = useState<any[]>([]);
  const [runningTimer, setRunningTimer] = useState<string | null>(null);

  const load = () => {
    billing.timeEntries.list()
      .then((data) => {
        const list = Array.isArray(data) ? data : [];
        setEntries(list);
        const running = list.find((e: any) => !e.end_time);
        setRunningTimer(running?.id ?? null);
      })
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const startTimer = async () => {
    await billing.timeEntries.startTimer({ workType: 'reactive' });
    load();
  };

  const stopTimer = async () => {
    if (!runningTimer) return;
    await billing.timeEntries.stopTimer(runningTimer);
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        {runningTimer ? (
          <button onClick={stopTimer}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
            <Square size={14} /> Stop Timer
          </button>
        ) : (
          <button onClick={startTimer}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
            <Play size={14} /> Start Timer
          </button>
        )}
      </div>

      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Duration</th>
              <th className="px-4 py-3 font-medium">Type</th>
              <th className="px-4 py-3 font-medium">Billable</th>
              <th className="px-4 py-3 font-medium">Approved</th>
              <th className="px-4 py-3 font-medium">Notes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {entries.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No time entries yet.</td></tr>
            ) : (
              entries.map((e) => (
                <tr key={e.id} className={`${!e.end_time ? 'bg-green-50 dark:bg-green-950' : ''}`}>
                  <td className="px-4 py-3 text-xs">{new Date(e.start_time).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    {e.duration_mins ? `${e.duration_mins}m` : <span className="text-green-600 animate-pulse">Running...</span>}
                  </td>
                  <td className="px-4 py-3 capitalize">{e.work_type?.replace('_', ' ')}</td>
                  <td className="px-4 py-3">{e.billable ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3">{e.approved ? 'Yes' : 'No'}</td>
                  <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate">{e.notes ?? '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, value, alert }: { label: string; value: string | number; alert?: boolean }) {
  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
      <span className="text-sm text-gray-500">{label}</span>
      <p className={`text-2xl font-bold mt-1 ${alert ? 'text-red-600' : ''}`}>{value}</p>
    </div>
  );
}
