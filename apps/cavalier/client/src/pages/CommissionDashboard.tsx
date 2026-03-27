/**
 * CVG-CAVALIER — Commission Dashboard
 *
 * Partner commission tracking with:
 * - Summary cards (Total Earned, Pending, Paid This Month, Lifetime Earnings)
 * - Commission table with filters (date, product, status)
 * - Monthly trend bar chart (last 12 months)
 * - Payout request functionality
 * - Commission structure display per partner tier
 */
import { useEffect, useState, useMemo } from 'react';
import {
  DollarSign, Clock, CheckCircle, TrendingUp,
  Filter, Download, Loader2,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────────────────

interface CommissionSummary {
  totalEarned: number;
  pending: number;
  paidThisMonth: number;
  lifetimeEarnings: number;
  pendingCount: number;
  earnedCount: number;
  paidCount: number;
}

interface CommissionRecord {
  id: string;
  earned_at: string;
  client_name: string;
  prospect_company: string;
  product_code: string;
  deal_value: string;
  commission_percent: string;
  commission_amount: string;
  status: 'pending' | 'earned' | 'paid' | 'pending_payout' | 'cancelled';
  deal_number: string;
  partner_name: string;
}

interface MonthlyTrend {
  month: string;
  label: string;
  earned: number;
  paid: number;
}

interface CommissionStructure {
  product_code: string;
  product_name: string;
  partner_tier: string;
  commission_percent: string;
  recurring_percent: string;
  recurring_months: number;
  bonus_threshold: string | null;
  bonus_percent: string | null;
}

type StatusFilter = 'all' | 'pending' | 'earned' | 'paid' | 'pending_payout';

// ─── API helpers (use existing request pattern from lib/api) ─────────────

const BASE = '/api/v1';

function getHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Tenant-Id': localStorage.getItem('cavalier-tenant-id') ?? '',
    'X-User-Id': localStorage.getItem('cavalier-user-id') ?? '',
    'X-User-Role': localStorage.getItem('cavalier-user-role') ?? 'partner_admin',
  };
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, { headers: getHeaders(), ...options });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(body.error ?? `API error: ${res.status}`);
  }
  return res.json();
}

// ─── Constants ───────────────────────────────────────────────────────────

const PRODUCT_LABELS: Record<string, string> = {
  'CVG-AEGIS': 'AEGIS Security',
  'CVG-MIDAS': 'Midas QBR',
  'CVG-CAELUM': 'Caelum SoW',
  'CVG-VESPAR': 'Vespar Migration',
  'CVG-HIPAA': 'HIPAA Toolkit',
  'CVG-MER': 'Meridian M&A',
  'CVG-ASTRA': 'Astra M365',
  'CVG-BRAIN': 'Brain Knowledge',
  'CVG-RESEARCH': 'Ducky Intelligence',
  default: 'Platform',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300',
  earned: 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300',
  paid: 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300',
  pending_payout: 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300',
  cancelled: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
};

// ─── Component ───────────────────────────────────────────────────────────

export function CommissionDashboardPage() {
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [records, setRecords] = useState<CommissionRecord[]>([]);
  const [trends, setTrends] = useState<MonthlyTrend[]>([]);
  const [structures, setStructures] = useState<CommissionStructure[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutMessage, setPayoutMessage] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [productFilter, setProductFilter] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [summaryData, recordsData, structuresData, trendsData] = await Promise.all([
        request<any>('/partners/commissions/summary'),
        request<any[]>('/partners/commissions'),
        request<any[]>('/commissions/structures').catch(() => []),
        request<any[]>('/partners/commissions/trends').catch(() => []),
      ]);

      setSummary({
        totalEarned: parseFloat(summaryData.total_earned ?? '0'),
        pending: parseFloat(summaryData.pending ?? '0'),
        paidThisMonth: parseFloat(summaryData.paid_this_month ?? '0'),
        lifetimeEarnings: parseFloat(summaryData.lifetime ?? '0'),
        pendingCount: summaryData.pending_count ?? 0,
        earnedCount: summaryData.earned_count ?? 0,
        paidCount: summaryData.paid_count ?? 0,
      });

      setRecords(Array.isArray(recordsData) ? recordsData : []);
      setStructures(Array.isArray(structuresData) ? structuresData : []);
      setTrends(Array.isArray(trendsData) ? trendsData : generateEmptyTrends());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;
      if (productFilter !== 'all' && r.product_code !== productFilter) return false;
      if (dateFrom && r.earned_at < dateFrom) return false;
      if (dateTo && r.earned_at > dateTo + 'T23:59:59') return false;
      return true;
    });
  }, [records, statusFilter, productFilter, dateFrom, dateTo]);

  const uniqueProducts = useMemo(() => {
    const codes = new Set(records.map((r) => r.product_code));
    return Array.from(codes).sort();
  }, [records]);

  const handleRequestPayout = async () => {
    setPayoutLoading(true);
    setPayoutMessage('');
    try {
      const result = await request<any>('/partners/commissions/payout', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setPayoutMessage(`Payout requested: ${result.count ?? 0} commission(s) marked for payout.`);
      await loadData();
    } catch (err) {
      setPayoutMessage(`Payout request failed: ${(err as Error).message}`);
    } finally {
      setPayoutLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-[#2E5090]" size={32} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">Failed to load commissions: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Commissions</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track your earnings across all Cavaridge products.
          </p>
        </div>
        <button
          onClick={handleRequestPayout}
          disabled={payoutLoading || (summary?.pendingCount ?? 0) + (summary?.earnedCount ?? 0) === 0}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E5090] text-white rounded-lg text-sm font-medium hover:bg-[#243f73] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {payoutLoading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Download size={16} />
          )}
          Request Payout
        </button>
      </div>

      {payoutMessage && (
        <div className={`border rounded-lg p-3 text-sm ${
          payoutMessage.includes('failed')
            ? 'bg-red-50 dark:bg-red-950 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200'
            : 'bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
        }`}>
          {payoutMessage}
        </div>
      )}

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard
          label="Total Earned"
          value={formatCurrency(summary?.totalEarned ?? 0)}
          icon={<DollarSign size={20} />}
          color="blue"
        />
        <SummaryCard
          label="Pending"
          value={formatCurrency(summary?.pending ?? 0)}
          icon={<Clock size={20} />}
          color="yellow"
          subtitle={`${summary?.pendingCount ?? 0} records`}
        />
        <SummaryCard
          label="Paid This Month"
          value={formatCurrency(summary?.paidThisMonth ?? 0)}
          icon={<CheckCircle size={20} />}
          color="green"
        />
        <SummaryCard
          label="Lifetime Earnings"
          value={formatCurrency(summary?.lifetimeEarnings ?? 0)}
          icon={<TrendingUp size={20} />}
          color="purple"
          subtitle={`${summary?.paidCount ?? 0} payouts`}
        />
      </div>

      {/* Monthly trend chart */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
        <h3 className="font-semibold mb-4">Monthly Trend (Last 12 Months)</h3>
        <BarChart data={trends} />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Filter size={16} className="text-gray-400" />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="earned">Earned</option>
          <option value="paid">Paid</option>
          <option value="pending_payout">Pending Payout</option>
        </select>

        <select
          value={productFilter}
          onChange={(e) => setProductFilter(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
        >
          <option value="all">All Products</option>
          {uniqueProducts.map((p) => (
            <option key={p} value={p}>{PRODUCT_LABELS[p] ?? p}</option>
          ))}
        </select>

        <input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
          placeholder="From"
        />
        <input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-800"
          placeholder="To"
        />

        {(statusFilter !== 'all' || productFilter !== 'all' || dateFrom || dateTo) && (
          <button
            onClick={() => { setStatusFilter('all'); setProductFilter('all'); setDateFrom(''); setDateTo(''); }}
            className="text-xs text-[#2E5090] hover:underline"
          >
            Clear filters
          </button>
        )}
      </div>

      {/* Commission table */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 dark:bg-gray-900">
            <tr className="text-left text-gray-500">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Client</th>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium text-right">Revenue</th>
              <th className="px-4 py-3 font-medium text-right">Rate</th>
              <th className="px-4 py-3 font-medium text-right">Amount</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
            {filteredRecords.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-400">
                  No commission records found.
                </td>
              </tr>
            ) : (
              filteredRecords.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                  <td className="px-4 py-3 text-xs">
                    {r.earned_at ? new Date(r.earned_at).toLocaleDateString() : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-medium">{r.prospect_company ?? r.client_name ?? '—'}</span>
                    {r.deal_number && (
                      <span className="block text-xs text-gray-400 font-mono">{r.deal_number}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {PRODUCT_LABELS[r.product_code] ?? r.product_code}
                  </td>
                  <td className="px-4 py-3 text-right font-medium">
                    {formatCurrency(parseFloat(r.deal_value ?? '0'))}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {parseFloat(r.commission_percent ?? '0').toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-bold">
                    {formatCurrency(parseFloat(r.commission_amount ?? '0'))}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${STATUS_COLORS[r.status] ?? ''}`}>
                      {r.status.replace('_', ' ')}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Referral Link */}
      <ReferralLinkSection />

      {/* Payout History */}
      <PayoutHistory />

      {/* Commission structure */}
      {structures.length > 0 && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
          <h3 className="font-semibold mb-4">Commission Structure (Your Tier)</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200 dark:border-gray-700 text-gray-500">
                  <th className="py-2 font-medium">Product</th>
                  <th className="py-2 font-medium text-right">Initial %</th>
                  <th className="py-2 font-medium text-right">Recurring %</th>
                  <th className="py-2 font-medium text-right">Recurring Months</th>
                  <th className="py-2 font-medium text-right">Bonus Threshold</th>
                  <th className="py-2 font-medium text-right">Bonus %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                {structures.map((s) => (
                  <tr key={`${s.product_code}-${s.partner_tier}`}>
                    <td className="py-2">{s.product_name}</td>
                    <td className="py-2 text-right font-medium">{parseFloat(s.commission_percent).toFixed(1)}%</td>
                    <td className="py-2 text-right">{parseFloat(s.recurring_percent).toFixed(1)}%</td>
                    <td className="py-2 text-right">{s.recurring_months}</td>
                    <td className="py-2 text-right">{s.bonus_threshold ? formatCurrency(parseFloat(s.bonus_threshold)) : '—'}</td>
                    <td className="py-2 text-right">{s.bonus_percent ? `${parseFloat(s.bonus_percent).toFixed(1)}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon,
  color,
  subtitle,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  color: 'blue' | 'yellow' | 'green' | 'purple';
  subtitle?: string;
}) {
  const colorMap = {
    blue: 'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
    yellow: 'bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300',
    green: 'bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300',
    purple: 'bg-purple-50 dark:bg-purple-950 text-purple-700 dark:text-purple-300',
  };

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-500 dark:text-gray-400">{label}</span>
        <div className={`p-1.5 rounded ${colorMap[color]}`}>{icon}</div>
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {subtitle && (
        <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">{subtitle}</p>
      )}
    </div>
  );
}

function BarChart({ data }: { data: MonthlyTrend[] }) {
  const chartData = data.length > 0 ? data : generateEmptyTrends();
  const maxValue = Math.max(...chartData.map((d) => Math.max(d.earned, d.paid)), 1);

  return (
    <div className="flex items-end gap-2 h-48">
      {chartData.map((d) => {
        const earnedHeight = (d.earned / maxValue) * 100;
        const paidHeight = (d.paid / maxValue) * 100;

        return (
          <div key={d.month} className="flex-1 flex flex-col items-center gap-1 h-full justify-end group relative">
            {/* Tooltip */}
            <div className="absolute bottom-full mb-2 hidden group-hover:block bg-gray-900 dark:bg-gray-700 text-white text-xs rounded px-2 py-1 whitespace-nowrap z-10">
              <div>Earned: {formatCurrency(d.earned)}</div>
              <div>Paid: {formatCurrency(d.paid)}</div>
            </div>
            {/* Bars */}
            <div className="w-full flex gap-0.5 items-end flex-1">
              <div
                className="flex-1 bg-blue-400 dark:bg-blue-600 rounded-t transition-all"
                style={{ height: `${earnedHeight}%`, minHeight: d.earned > 0 ? '4px' : '0' }}
              />
              <div
                className="flex-1 bg-green-400 dark:bg-green-600 rounded-t transition-all"
                style={{ height: `${paidHeight}%`, minHeight: d.paid > 0 ? '4px' : '0' }}
              />
            </div>
            <span className="text-[10px] text-gray-400">{d.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function ReferralLinkSection() {
  const [copied, setCopied] = useState(false);
  const tenantId = localStorage.getItem('cavalier-tenant-id') ?? '';
  const referralLink = `${window.location.origin}/ref/${tenantId}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = referralLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
      <h3 className="font-semibold mb-2">Referral Link</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400 mb-3">
        Share this link with prospects. Referrals that convert earn commission based on your tier structure.
      </p>
      <div className="flex items-center gap-2">
        <input
          type="text"
          readOnly
          value={referralLink}
          className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-mono"
        />
        <button
          onClick={handleCopy}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            copied
              ? 'bg-green-600 text-white'
              : 'bg-[#2E5090] text-white hover:bg-[#243f73]'
          }`}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

function PayoutHistory() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    request<any[]>('/partners/commissions/payouts')
      .then((data) => setPayouts(Array.isArray(data) ? data : []))
      .catch(() => setPayouts([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
        <h3 className="font-semibold mb-4">Payout History</h3>
        <div className="flex items-center justify-center py-8">
          <Loader2 className="animate-spin text-gray-400" size={20} />
        </div>
      </div>
    );
  }

  return (
    <div className="border border-gray-200 dark:border-gray-800 rounded-lg overflow-hidden">
      <div className="px-5 pt-5 pb-3">
        <h3 className="font-semibold">Payout History</h3>
      </div>
      <table className="w-full text-sm">
        <thead className="bg-gray-50 dark:bg-gray-900">
          <tr className="text-left text-gray-500">
            <th className="px-5 py-3 font-medium">Date</th>
            <th className="px-5 py-3 font-medium">Period</th>
            <th className="px-5 py-3 font-medium text-right">Amount</th>
            <th className="px-5 py-3 font-medium text-right">Commissions</th>
            <th className="px-5 py-3 font-medium">Method</th>
            <th className="px-5 py-3 font-medium">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-800">
          {payouts.length === 0 ? (
            <tr>
              <td colSpan={6} className="px-5 py-8 text-center text-gray-400">
                No payouts yet. Request a payout when you have earned commissions.
              </td>
            </tr>
          ) : (
            payouts.map((p: any) => (
              <tr key={p.id} className="hover:bg-gray-50 dark:hover:bg-gray-900">
                <td className="px-5 py-3 text-xs">
                  {p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '—'}
                </td>
                <td className="px-5 py-3 text-xs">
                  {p.period_start && p.period_end
                    ? `${new Date(p.period_start).toLocaleDateString()} - ${new Date(p.period_end).toLocaleDateString()}`
                    : '—'}
                </td>
                <td className="px-5 py-3 text-right font-bold">
                  {formatCurrency(parseFloat(p.amount ?? '0'))}
                </td>
                <td className="px-5 py-3 text-right">
                  {p.commission_count ?? '—'}
                </td>
                <td className="px-5 py-3 text-xs">
                  {p.method ?? 'ACH'}
                </td>
                <td className="px-5 py-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    p.status === 'completed'
                      ? 'bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300'
                      : p.status === 'processing'
                      ? 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                      : 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300'
                  }`}>
                    {p.status ?? 'pending'}
                  </span>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

function generateEmptyTrends(): MonthlyTrend[] {
  const months: MonthlyTrend[] = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      month: d.toISOString().slice(0, 7),
      label: d.toLocaleDateString('en-US', { month: 'short' }),
      earned: 0,
      paid: 0,
    });
  }
  return months;
}
