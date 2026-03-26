import { useState, useCallback, useRef } from 'react';

// =============================================================================
// CSV Parser
// =============================================================================

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter(l => l.trim());
  if (lines.length < 2) return [];

  // Handle BOM
  let headerLine = lines[0];
  if (headerLine.charCodeAt(0) === 0xFEFF) headerLine = headerLine.slice(1);

  const headers = headerLine.split(',').map(h => h.replace(/^"|"$/g, '').trim());
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const vals: string[] = [];
    let current = '';
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        vals.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    vals.push(current.trim());

    if (vals.length >= headers.length - 1) {
      const row: Record<string, string> = {};
      headers.forEach((h, idx) => { row[h] = vals[idx] ?? ''; });
      rows.push(row);
    }
  }
  return rows;
}

// =============================================================================
// Merge CSVs into user records
// =============================================================================

interface MergedUser {
  userPrincipalName: string;
  displayName: string;
  accountEnabled: boolean;
  assignedLicenses: string[];
  lastSignInDateTime: string | null;
  createdDateTime: string;
  userType: string;
  daysSinceActivity?: number;
  [key: string]: unknown;
}

function mergeUserData(
  usersRows: Record<string, string>[],
  activityRows: Record<string, string>[]
): MergedUser[] {
  const activityMap = new Map<string, Record<string, string>>();
  for (const row of activityRows) {
    const upn = (row['User Principal Name'] ?? row['UPN'] ?? '').toLowerCase().trim();
    if (upn) activityMap.set(upn, row);
  }

  return usersRows.map(u => {
    const upn = (u['User principal name'] ?? u['UPN'] ?? u['userPrincipalName'] ?? '').trim();
    const upnLower = upn.toLowerCase();
    const activity = activityMap.get(upnLower);

    const licenses = u['Licenses'] ?? u['Assigned Products'] ?? '';
    const blocked = (u['Block credential'] ?? '').toLowerCase() === 'true';
    const isExternal = upnLower.includes('#ext#');

    // Find most recent activity date
    const activityDates = [
      activity?.['Exchange Last Activity Date'],
      activity?.['OneDrive Last Activity Date'],
      activity?.['SharePoint Last Activity Date'],
      activity?.['Teams Last Activity Date'],
      activity?.['Yammer Last Activity Date'],
    ].filter(d => d && d.trim());

    let lastActivity: string | null = null;
    let daysSinceActivity: number | undefined;

    if (activityDates.length > 0) {
      const dates = activityDates.map(d => new Date(d!)).filter(d => !isNaN(d.getTime()));
      if (dates.length > 0) {
        const latest = new Date(Math.max(...dates.map(d => d.getTime())));
        lastActivity = latest.toISOString();
        daysSinceActivity = Math.floor((Date.now() - latest.getTime()) / 86400000);
      }
    }

    return {
      userPrincipalName: upn,
      displayName: u['Display name'] ?? u['displayName'] ?? '',
      accountEnabled: !blocked,
      assignedLicenses: licenses && licenses.toLowerCase() !== 'unlicensed'
        ? licenses.split('+').map(s => s.trim()).filter(Boolean)
        : [],
      lastSignInDateTime: lastActivity ?? (activity?.['Last activity date (UTC)'] || null),
      createdDateTime: u['When created'] ?? u['createdDateTime'] ?? new Date().toISOString(),
      userType: isExternal ? 'Guest' : (u['User type'] ?? 'Member'),
      daysSinceActivity,
      "Assigned Products": activity?.['Assigned Products'] ?? licenses,
    };
  });
}

// =============================================================================
// Component
// =============================================================================

export function IarFreemiumPage() {
  const [usersFile, setUsersFile] = useState<File | null>(null);
  const [activityFile, setActivityFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [processing, setProcessing] = useState(false);
  const [userCount, setUserCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ flagged: number; high: number; total: number } | null>(null);
  const usersRef = useRef<HTMLInputElement>(null);
  const activityRef = useRef<HTMLInputElement>(null);

  const canSubmit = usersFile && activityFile && name.trim() && email.trim() && company.trim() && !processing;

  const handleSubmit = useCallback(async () => {
    if (!usersFile || !activityFile) return;
    setProcessing(true);
    setError(null);
    setResult(null);

    try {
      const usersText = await usersFile.text();
      const activityText = await activityFile.text();

      const usersRows = parseCSV(usersText);
      const activityRows = parseCSV(activityText);

      if (usersRows.length === 0) throw new Error('Users CSV appears empty or malformed.');

      const merged = mergeUserData(usersRows, activityRows);
      setUserCount(merged.length);

      const resp = await fetch('/api/v1/iar/freemium/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          users: merged,
          email,
          name,
          company,
          tenantName: company,
        }),
      });

      if (!resp.ok) {
        const err = await resp.json().catch(() => ({ error: 'Report generation failed' }));
        throw new Error(err.error ?? 'Report generation failed');
      }

      // Parse summary from custom header or estimate from data
      const blob = await resp.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = resp.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'AEGIS-Identity-Review.xlsx';
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      setResult({ total: merged.length, flagged: 0, high: 0 });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setProcessing(false);
    }
  }, [usersFile, activityFile, name, email, company]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white">
      {/* Hero */}
      <header className="border-b border-white/10 bg-gradient-to-b from-[#1a1a2e] to-[#0f172a]">
        <div className="mx-auto max-w-4xl px-6 py-16 text-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-[#2E5090]/20 px-4 py-1.5 text-sm font-medium text-[#6da1ff] mb-6">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Free Security Analysis
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-300">
            Microsoft 365 User Security Analysis
          </h1>
          <p className="mt-4 text-lg text-gray-400 max-w-2xl mx-auto">
            Upload your M365 admin exports. Get an instant, branded security report with risk flags and remediation recommendations.
          </p>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        {/* How It Works */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-12">
          {[
            { step: '1', title: 'Export Data', desc: 'Download user exports from your M365 Admin Center' },
            { step: '2', title: 'Upload CSVs', desc: 'Upload both CSV files below — we process them in real-time' },
            { step: '3', title: 'Get Report', desc: 'Download a branded XLSX with risk flags and recommendations' },
          ].map(s => (
            <div key={s.step} className="rounded-xl border border-white/10 bg-white/5 p-6 text-center">
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#2E5090] text-white font-bold text-lg mb-3">{s.step}</div>
              <h3 className="font-semibold text-white mb-1">{s.title}</h3>
              <p className="text-sm text-gray-400">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Upload Section */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 mb-8">
          <h2 className="text-xl font-bold mb-6">Upload M365 Exports</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Users CSV */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Entra ID User Export
              </label>
              <div
                onClick={() => usersRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  usersFile ? 'border-green-500/50 bg-green-500/5' : 'border-white/20 hover:border-[#2E5090]/50 hover:bg-[#2E5090]/5'
                }`}
              >
                <input ref={usersRef} type="file" accept=".csv" className="hidden" onChange={e => setUsersFile(e.target.files?.[0] ?? null)} />
                {usersFile ? (
                  <div>
                    <svg className="mx-auto h-8 w-8 text-green-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <p className="text-sm font-medium text-green-400">{usersFile.name}</p>
                    <button onClick={e => { e.stopPropagation(); setUsersFile(null); }} className="mt-2 text-xs text-gray-500 hover:text-red-400">Remove</button>
                  </div>
                ) : (
                  <div>
                    <svg className="mx-auto h-8 w-8 text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    <p className="text-sm text-gray-400">M365 Admin → Users → Export</p>
                    <p className="text-xs text-gray-600 mt-1">Click or drag CSV file</p>
                  </div>
                )}
              </div>
            </div>

            {/* Activity CSV */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                M365 Active User Detail
              </label>
              <div
                onClick={() => activityRef.current?.click()}
                className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-colors ${
                  activityFile ? 'border-green-500/50 bg-green-500/5' : 'border-white/20 hover:border-[#2E5090]/50 hover:bg-[#2E5090]/5'
                }`}
              >
                <input ref={activityRef} type="file" accept=".csv" className="hidden" onChange={e => setActivityFile(e.target.files?.[0] ?? null)} />
                {activityFile ? (
                  <div>
                    <svg className="mx-auto h-8 w-8 text-green-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    <p className="text-sm font-medium text-green-400">{activityFile.name}</p>
                    <button onClick={e => { e.stopPropagation(); setActivityFile(null); }} className="mt-2 text-xs text-gray-500 hover:text-red-400">Remove</button>
                  </div>
                ) : (
                  <div>
                    <svg className="mx-auto h-8 w-8 text-gray-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" /></svg>
                    <p className="text-sm text-gray-400">M365 Admin → Reports → Active Users</p>
                    <p className="text-xs text-gray-600 mt-1">Click or drag CSV file</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Lead Capture */}
          <h3 className="text-lg font-semibold mb-4">Your Information</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <input
              type="text"
              placeholder="Your Name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-[#2E5090] focus:outline-none focus:ring-1 focus:ring-[#2E5090]"
            />
            <input
              type="email"
              placeholder="Email Address"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-[#2E5090] focus:outline-none focus:ring-1 focus:ring-[#2E5090]"
            />
            <input
              type="text"
              placeholder="Company Name"
              value={company}
              onChange={e => setCompany(e.target.value)}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-white placeholder-gray-500 focus:border-[#2E5090] focus:outline-none focus:ring-1 focus:ring-[#2E5090]"
            />
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded-xl bg-[#2E5090] py-4 text-lg font-bold text-white transition-all hover:bg-[#3a6bc5] disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {processing ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                Analyzing {userCount} user accounts...
              </span>
            ) : (
              'Generate Security Report'
            )}
          </button>
        </div>

        {/* Result */}
        {result && (
          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-8 mb-8 text-center">
            <svg className="mx-auto h-12 w-12 text-green-400 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            <h3 className="text-xl font-bold text-green-300 mb-2">Report Generated Successfully</h3>
            <p className="text-gray-400 mb-4">Your branded XLSX security report has been downloaded.</p>
            <p className="text-sm text-gray-500">
              Analyzed {result.total} user accounts
            </p>
          </div>
        )}

        {/* What's Next */}
        <div className="rounded-2xl border border-white/10 bg-white/5 p-8 mb-8">
          <h2 className="text-xl font-bold mb-4">What&apos;s Next?</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#2E5090]/30 bg-[#2E5090]/10 p-5">
              <h3 className="font-semibold text-[#6da1ff] mb-2">AEGIS Full Platform</h3>
              <p className="text-sm text-gray-400">Continuous identity monitoring, contextual intelligence, compensating controls, historical diffing, and automated remediation workflows.</p>
            </div>
            <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-5">
              <h3 className="font-semibold text-purple-300 mb-2">Astra License Optimization</h3>
              <p className="text-sm text-gray-400">Turn these findings into cost savings. vCIO-ready reports showing license waste, optimization opportunities, and executive summaries.</p>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-center text-xs text-gray-600 mb-4">
          This analysis uses base severity levels only. Additional environmental context may adjust finding severity. Your data is processed in real-time and never stored.
        </p>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 py-8 text-center">
        <p className="text-sm text-gray-500">Powered by Ducky Intelligence.</p>
        <p className="text-xs text-gray-600 mt-1">© {new Date().getFullYear()} Cavaridge, LLC. All rights reserved.</p>
      </footer>
    </div>
  );
}
