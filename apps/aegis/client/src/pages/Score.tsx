/**
 * Cavaridge Adjusted Score — Composite security posture metric.
 * Shows 7 signal sources with raw + weighted values.
 * Phase 1: SaaS Shadow IT (10%) and Browser Security (20%) active.
 */
import { useEffect, useState } from 'react';
import { Gauge, RefreshCw } from 'lucide-react';
import { score } from '../lib/api';

interface ScoreData {
  totalScore: number;
  signals: Record<string, {
    raw: number | null;
    weighted: number;
    status: string;
    bonus?: number;
    controls?: any[];
  }>;
  weights: Record<string, number>;
}

const SIGNAL_LABELS: Record<string, { name: string; weight: string; description: string }> = {
  microsoft_secure_score: { name: 'Microsoft Secure Score', weight: '25%', description: 'Microsoft 365 security configuration assessment' },
  browser_security: { name: 'Browser Security Compliance', weight: '20%', description: 'Extension coverage and device activity' },
  google_workspace: { name: 'Google Workspace Security', weight: '15%', description: 'Google Workspace security health assessment' },
  credential_hygiene: { name: 'Credential Hygiene', weight: '15%', description: 'Breach exposure and password reuse detection' },
  dns_filtering: { name: 'DNS Filtering Compliance', weight: '10%', description: 'Cloudflare Gateway DNS query compliance' },
  saas_shadow_it: { name: 'SaaS Shadow IT Risk', weight: '10%', description: 'Unsanctioned application usage and risk' },
  compensating_controls: { name: 'Compensating Controls', weight: '+5 max', description: 'Bonus for SentinelOne, Duo, Proofpoint, etc.' },
};

export function ScorePage() {
  const [scoreData, setScoreData] = useState<ScoreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [calculating, setCalculating] = useState(false);

  useEffect(() => {
    loadScore();
  }, []);

  async function loadScore() {
    setLoading(true);
    try {
      const res = await score.current();
      if (res.totalScore !== undefined || res.total_score !== undefined) {
        setScoreData({
          totalScore: res.totalScore ?? res.total_score,
          signals: res.signals ?? {},
          weights: res.weights ?? res.weight_config ?? {},
        });
      }
    } catch {
      // No score yet
    } finally {
      setLoading(false);
    }
  }

  async function handleCalculate() {
    setCalculating(true);
    try {
      const res = await score.calculate();
      setScoreData(res);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setCalculating(false);
    }
  }

  function getScoreColor(s: number): string {
    if (s >= 80) return 'text-green-600 dark:text-green-400';
    if (s >= 60) return 'text-amber-600 dark:text-amber-400';
    return 'text-red-600 dark:text-red-400';
  }

  function getScoreGradient(s: number): string {
    if (s >= 80) return 'from-green-500 to-green-600';
    if (s >= 60) return 'from-amber-500 to-amber-600';
    return 'from-red-500 to-red-600';
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Gauge size={24} className="text-[#2E5090]" />
            Cavaridge Adjusted Score
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Composite security posture metric — 7 weighted signal sources (0–100)
          </p>
        </div>
        <button
          onClick={handleCalculate}
          disabled={calculating}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E5090] text-white rounded-lg text-sm font-medium hover:bg-[#1e3a6e] disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={16} className={calculating ? 'animate-spin' : ''} />
          {calculating ? 'Calculating...' : 'Calculate Score'}
        </button>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-4">
          <div className="h-40 bg-gray-200 dark:bg-gray-800 rounded-xl" />
        </div>
      ) : scoreData ? (
        <div className="space-y-6">
          {/* Score hero */}
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-8 text-center">
            <div className={`text-6xl font-bold ${getScoreColor(scoreData.totalScore)}`}>
              {Math.round(scoreData.totalScore)}
            </div>
            <div className="text-sm text-gray-500 dark:text-gray-400 mt-2">out of 100</div>
            <div className="mt-4 w-full max-w-md mx-auto bg-gray-200 dark:bg-gray-800 rounded-full h-3">
              <div
                className={`h-3 rounded-full bg-gradient-to-r ${getScoreGradient(scoreData.totalScore)} transition-all duration-500`}
                style={{ width: `${Math.min(100, scoreData.totalScore)}%` }}
              />
            </div>
          </div>

          {/* Signal breakdown */}
          <div className="grid gap-4">
            {Object.entries(SIGNAL_LABELS).map(([key, info]) => {
              const signal = scoreData.signals[key];
              const isActive = signal?.status === 'active';

              return (
                <div key={key} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <h3 className="font-semibold text-sm">{info.name}</h3>
                      <p className="text-xs text-gray-400">{info.description}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-medium ${
                        isActive
                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'
                          : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
                      }`}>
                        {isActive ? 'Active' : 'Not Configured'}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <div className="text-xs text-gray-400">Weight</div>
                      <div className="font-semibold text-sm">{info.weight}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Raw Score</div>
                      <div className="font-semibold text-sm">
                        {signal?.raw != null ? Math.round(signal.raw) : '—'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-400">Weighted</div>
                      <div className="font-semibold text-sm">
                        {signal?.weighted != null ? signal.weighted.toFixed(1) : '—'}
                      </div>
                    </div>
                    {isActive && signal?.raw != null && (
                      <div className="flex-1">
                        <div className="bg-gray-200 dark:bg-gray-800 rounded-full h-2">
                          <div
                            className={`h-2 rounded-full bg-gradient-to-r ${getScoreGradient(signal.raw)} transition-all`}
                            style={{ width: `${Math.min(100, signal.raw)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Phase note */}
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-sm text-amber-800 dark:text-amber-200">
            <strong>Phase 1 Note:</strong> Only SaaS Shadow IT (10%) and Browser Security Compliance (20%) signals are active.
            Microsoft Secure Score, Google Workspace, Credential Hygiene, DNS Filtering, and Compensating Controls will be added in Phases 2–3.
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-12 text-center">
          <Gauge size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-700" />
          <h2 className="text-lg font-semibold mb-2">No Score Calculated Yet</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Click "Calculate Score" to generate your first Cavaridge Adjusted Score based on current telemetry data.
          </p>
          <button
            onClick={handleCalculate}
            disabled={calculating}
            className="px-6 py-2 bg-[#2E5090] text-white rounded-lg text-sm font-medium hover:bg-[#1e3a6e] disabled:opacity-50"
          >
            {calculating ? 'Calculating...' : 'Calculate Now'}
          </button>
        </div>
      )}
    </div>
  );
}
