/**
 * Freemium Scan Landing Page — Public-facing external posture check.
 * No auth required. Captures email for lead gen.
 * Results stored with prospect tenant type.
 */
import { useState } from 'react';
import { Shield, Search, AlertTriangle, CheckCircle, XCircle, Sun, Moon, MonitorSmartphone } from 'lucide-react';

const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
  medium: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-300',
  low: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
  info: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
};

export function FreemiumScanPage() {
  const [target, setTarget] = useState('');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [scanning, setScanning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    return (localStorage.getItem('aegis-scan-theme') as any) ?? 'system';
  });

  // Apply theme
  const resolved = theme === 'system'
    ? window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    : theme;

  if (resolved === 'dark') {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    if (!target) return;

    setScanning(true);
    setError('');
    setResult(null);

    try {
      const res = await fetch('/api/v1/scan/public', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, email: email || undefined, name: name || undefined, company: company || undefined }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error ?? 'Scan failed');
      }

      setResult(await res.json());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setScanning(false);
    }
  }

  function getScoreColor(s: number): string {
    if (s >= 80) return 'text-green-600';
    if (s >= 60) return 'text-amber-500';
    return 'text-red-600';
  }

  const themeIcons = { light: Sun, dark: Moon, system: MonitorSmartphone };
  const nextTheme: Record<string, 'light' | 'dark' | 'system'> = { light: 'dark', dark: 'system', system: 'light' };
  const ThemeIcon = themeIcons[theme];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 text-gray-900 dark:text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Shield size={28} className="text-[#2E5090]" />
            <div>
              <h1 className="text-xl font-bold text-[#2E5090]">AEGIS</h1>
              <p className="text-[10px] text-gray-400">by Cavaridge</p>
            </div>
          </div>
          <button
            onClick={() => { const n = nextTheme[theme]; setTheme(n); localStorage.setItem('aegis-scan-theme', n); }}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg"
          >
            <ThemeIcon size={18} />
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 py-12">
        {!result ? (
          <div className="text-center">
            <h2 className="text-3xl font-bold mb-3">Free Security Posture Scan</h2>
            <p className="text-gray-500 dark:text-gray-400 mb-8 max-w-lg mx-auto">
              Get an instant external security assessment of your domain.
              We check DNS configuration, TLS certificates, and exposed services.
            </p>

            <form onSubmit={handleScan} className="max-w-lg mx-auto space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    placeholder="Enter your domain (e.g., yourcompany.com)"
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-base focus:outline-none focus:border-[#2E5090] focus:ring-2 focus:ring-[#2E5090]/20"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="Email (optional)"
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-[#2E5090]"
                />
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Name (optional)"
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-[#2E5090]"
                />
                <input
                  type="text"
                  value={company}
                  onChange={e => setCompany(e.target.value)}
                  placeholder="Company (optional)"
                  className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm focus:outline-none focus:border-[#2E5090]"
                />
              </div>

              <button
                type="submit"
                disabled={scanning || !target}
                className="w-full py-3 bg-[#2E5090] text-white rounded-xl text-base font-semibold hover:bg-[#1e3a6e] disabled:opacity-50 transition-colors"
              >
                {scanning ? 'Scanning... This may take 30–60 seconds.' : 'Scan My Domain'}
              </button>

              {error && (
                <p className="text-red-600 text-sm">{error}</p>
              )}
            </form>

            <div className="mt-12 grid grid-cols-3 gap-6 text-center">
              {[
                { icon: '🔍', title: 'DNS Analysis', desc: 'SPF, DMARC, and MX record validation' },
                { icon: '🔒', title: 'TLS Certificate', desc: 'Expiration, trust chain, and protocol checks' },
                { icon: '🚪', title: 'Port Scanning', desc: 'Common port exposure and risky service detection' },
              ].map(item => (
                <div key={item.title} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
                  <div className="text-3xl mb-3">{item.icon}</div>
                  <h3 className="font-semibold mb-1">{item.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-2">Scan Results: {result.target}</h2>
              <div className={`text-5xl font-bold ${getScoreColor(result.score)}`}>
                {result.score}/100
              </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-5 gap-3 mb-8">
              {(['critical', 'high', 'medium', 'low', 'info'] as const).map(sev => (
                <div key={sev} className={`rounded-xl p-4 text-center ${SEVERITY_COLORS[sev]}`}>
                  <div className="text-2xl font-bold">{result[sev] ?? result.summary?.[sev] ?? 0}</div>
                  <div className="text-xs uppercase font-medium">{sev}</div>
                </div>
              ))}
            </div>

            {/* Findings */}
            {result.findings && result.findings.length > 0 && (
              <div className="space-y-3 mb-8">
                <h3 className="font-semibold text-lg">Findings</h3>
                {result.findings.map((f: any, i: number) => (
                  <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4">
                    <div className="flex items-center gap-2 mb-1">
                      {f.severity === 'critical' || f.severity === 'high'
                        ? <XCircle size={16} className="text-red-600" />
                        : f.severity === 'info'
                        ? <CheckCircle size={16} className="text-blue-600" />
                        : <AlertTriangle size={16} className="text-amber-600" />
                      }
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${SEVERITY_COLORS[f.severity] ?? ''}`}>
                        {f.severity}
                      </span>
                      <span className="font-medium text-sm">{f.title}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 ml-6">{f.detail}</p>
                  </div>
                ))}
              </div>
            )}

            {/* CTA */}
            <div className="bg-[#2E5090] text-white rounded-xl p-8 text-center">
              <h3 className="text-xl font-bold mb-2">Want Continuous Protection?</h3>
              <p className="text-sm opacity-80 mb-4">
                Deploy AEGIS Managed Browser Security for real-time SaaS monitoring,
                phishing protection, and credential breach alerts.
              </p>
              <button
                onClick={() => { setResult(null); setTarget(''); }}
                className="px-6 py-2 bg-white text-[#2E5090] rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
              >
                Run Another Scan
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 mt-12">
        <div className="max-w-4xl mx-auto px-6 py-6 text-center">
          <p className="text-xs text-gray-400">
            Powered by Ducky Intelligence. &copy; {new Date().getFullYear()} Cavaridge, LLC. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
