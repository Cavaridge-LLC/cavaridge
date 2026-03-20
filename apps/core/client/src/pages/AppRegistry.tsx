/**
 * App registry dashboard — all 14 apps with status, health endpoint, deployment links.
 */
import { useEffect, useState } from 'react';
import { AppWindow, Circle, RefreshCw, ExternalLink } from 'lucide-react';
import { apps } from '../lib/api';

const HEALTH_COLORS: Record<string, string> = {
  healthy: 'text-green-500',
  degraded: 'text-amber-500',
  unreachable: 'text-red-500',
  not_deployed: 'text-gray-400',
};

const HEALTH_LABELS: Record<string, string> = {
  healthy: 'Healthy',
  degraded: 'Degraded',
  unreachable: 'Unreachable',
  not_deployed: 'Not Deployed',
};

const STATUS_BADGES: Record<string, string> = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  planned: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  scaffold: 'bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300',
};

export function AppRegistryPage() {
  const [appList, setAppList] = useState<any[]>([]);
  const [healthMap, setHealthMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const data = await apps.list();
        setAppList(data.apps);
      } catch { /* fallback handled in API */ }
      setLoading(false);
    }
    load();
  }, []);

  async function checkAllHealth() {
    setChecking(true);
    try {
      const data = await apps.healthAll();
      const map: Record<string, string> = {};
      for (const app of data.apps) {
        map[app.code] = app.health;
      }
      setHealthMap(map);
    } catch { /* */ }
    setChecking(false);
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">App Registry</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            14 apps — Cavaridge application portfolio
          </p>
        </div>
        <button
          onClick={checkAllHealth}
          disabled={checking}
          className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-[#2E5090] text-white hover:bg-[#254080] disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={16} className={checking ? 'animate-spin' : ''} />
          {checking ? 'Checking...' : 'Check Health'}
        </button>
      </div>

      {/* App cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {(loading ? Array(14).fill(null) : appList).map((app, i) => (
          app ? (
            <div key={app.code} className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-gray-100">{app.name}</h3>
                    <span className={`px-2 py-0.5 text-[10px] rounded-full font-medium ${STATUS_BADGES[app.status] ?? STATUS_BADGES.planned}`}>
                      {app.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-mono">{app.code}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Circle
                    size={10}
                    fill="currentColor"
                    className={HEALTH_COLORS[healthMap[app.code] ?? 'not_deployed']}
                  />
                  <span className="text-[10px] text-gray-400">
                    {HEALTH_LABELS[healthMap[app.code] ?? 'not_deployed']}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">{app.description}</p>
              <div className="flex items-center justify-between text-[11px] text-gray-400">
                <span className="font-mono">{app.directory}</span>
                {app.port && (
                  <span className="flex items-center gap-1">
                    <ExternalLink size={10} />
                    :{app.port}
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div key={i} className="p-4 rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 animate-pulse">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-800 rounded mb-2" />
              <div className="h-3 w-16 bg-gray-200 dark:bg-gray-800 rounded mb-3" />
              <div className="h-3 w-full bg-gray-200 dark:bg-gray-800 rounded" />
            </div>
          )
        ))}
      </div>
    </div>
  );
}
