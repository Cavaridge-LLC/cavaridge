/**
 * Scan Management — Tenant-scoped external posture scans.
 */
import { useEffect, useState } from 'react';
import { ScanLine, Play, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
import { scans } from '../lib/api';

interface ScanResult {
  id: string;
  scan_type: string;
  target: string;
  status: string;
  score: number | null;
  started_at: string;
  completed_at: string | null;
  findings?: any[];
  summary?: any;
}

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
};

export function ScanPage() {
  const [scanList, setScanList] = useState<ScanResult[]>([]);
  const [selectedScan, setSelectedScan] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [target, setTarget] = useState('');

  async function loadScans() {
    try {
      const res = await scans.list();
      setScanList(res.data ?? []);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadScans(); }, []);

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;

    setScanning(true);
    try {
      const result = await scans.run({ target });
      setSelectedScan(result);
      loadScans();
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setScanning(false);
      setTarget('');
    }
  }

  async function handleViewScan(id: string) {
    const result = await scans.get(id);
    setSelectedScan(result);
  }

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <ScanLine size={24} className="text-[#2E5090]" />
          Posture Scans
        </h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          External security posture assessment — DNS, TLS, and port analysis
        </p>
      </div>

      {/* New scan form */}
      <form onSubmit={handleScan} className="flex gap-3 mb-6">
        <input
          type="text"
          value={target}
          onChange={e => setTarget(e.target.value)}
          placeholder="Enter domain to scan (e.g., example.com)"
          className="flex-1 max-w-md px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm focus:outline-none focus:border-[#2E5090]"
        />
        <button
          type="submit"
          disabled={scanning || !target}
          className="flex items-center gap-2 px-4 py-2 bg-[#2E5090] text-white rounded-lg text-sm font-medium hover:bg-[#1e3a6e] disabled:opacity-50 transition-colors"
        >
          <Play size={16} />
          {scanning ? 'Scanning...' : 'Run Scan'}
        </button>
      </form>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Scan history */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h2 className="font-semibold">Scan History</h2>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <div className="p-8 text-center text-gray-400">Loading...</div>
            ) : scanList.length === 0 ? (
              <div className="p-8 text-center text-gray-400">No scans yet.</div>
            ) : (
              scanList.map(scan => (
                <button
                  key={scan.id}
                  onClick={() => handleViewScan(scan.id)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                    selectedScan?.id === scan.id ? 'bg-blue-50 dark:bg-blue-950' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-sm">{scan.target}</div>
                      <div className="text-xs text-gray-400">{new Date(scan.started_at).toLocaleString()}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      {scan.score !== null && (
                        <ScoreBadge score={scan.score} />
                      )}
                      <StatusIcon status={scan.status} />
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Scan details */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h2 className="font-semibold">Scan Details</h2>
          </div>
          {selectedScan ? (
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-lg font-bold">{selectedScan.target}</div>
                  <div className="text-xs text-gray-400">{selectedScan.scan_type}</div>
                </div>
                {selectedScan.score !== null && (
                  <div className="text-center">
                    <div className="text-3xl font-bold">{selectedScan.score}</div>
                    <div className="text-xs text-gray-400">/ 100</div>
                  </div>
                )}
              </div>

              {selectedScan.summary && (
                <div className="grid grid-cols-5 gap-2 text-center">
                  {(['critical', 'high', 'medium', 'low', 'info'] as const).map(sev => (
                    <div key={sev} className={`rounded-lg p-2 ${SEVERITY_COLORS[sev]}`}>
                      <div className="text-lg font-bold">{(selectedScan.summary as any)[sev] ?? 0}</div>
                      <div className="text-[10px] uppercase font-medium">{sev}</div>
                    </div>
                  ))}
                </div>
              )}

              {selectedScan.findings && selectedScan.findings.length > 0 && (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {selectedScan.findings.map((f: any, i: number) => (
                    <div key={i} className="rounded-lg border border-gray-200 dark:border-gray-800 p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase ${SEVERITY_COLORS[f.severity] ?? ''}`}>
                          {f.severity}
                        </span>
                        <span className="text-sm font-medium">{f.title}</span>
                      </div>
                      <p className="text-xs text-gray-500">{f.detail}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-8 text-center text-gray-400">
              Select a scan to view details.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  let color = 'text-green-600';
  if (score < 50) color = 'text-red-600';
  else if (score < 70) color = 'text-amber-600';
  return <span className={`font-bold text-sm ${color}`}>{score}</span>;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'completed': return <CheckCircle size={16} className="text-green-600" />;
    case 'failed': return <XCircle size={16} className="text-red-600" />;
    case 'running': return <Clock size={16} className="text-amber-600 animate-spin" />;
    default: return <Clock size={16} className="text-gray-400" />;
  }
}
