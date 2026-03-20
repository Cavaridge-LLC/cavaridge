/**
 * Platform settings — feature flags, branding defaults, LLM routing config.
 */
import { useEffect, useState } from 'react';
import { Settings as SettingsIcon, ToggleLeft, ToggleRight, Palette, Cpu } from 'lucide-react';
import { settings } from '../lib/api';

interface Flag {
  name: string;
  category: string;
  enabled: boolean;
  description: string;
}

export function SettingsPage() {
  const [flags, setFlags] = useState<Flag[]>([]);
  const [branding, setBranding] = useState<any>(null);
  const [llmConfig, setLlmConfig] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [f, b, l] = await Promise.allSettled([
        settings.featureFlags(),
        settings.branding(),
        settings.llmConfig(),
      ]);
      if (f.status === 'fulfilled') setFlags(f.value.flags);
      if (b.status === 'fulfilled') setBranding(b.value.branding);
      if (l.status === 'fulfilled') setLlmConfig(l.value);
      setLoading(false);
    }
    load();
  }, []);

  async function toggleFlag(name: string, current: boolean) {
    try {
      await settings.updateFlag(name, !current);
      setFlags(prev => prev.map(f => f.name === name ? { ...f, enabled: !current } : f));
    } catch {
      // Feature flags table may not exist — toggle locally
      setFlags(prev => prev.map(f => f.name === name ? { ...f, enabled: !current } : f));
    }
  }

  if (loading) {
    return <div className="p-6"><p className="text-gray-400">Loading settings...</p></div>;
  }

  const flagsByCategory = flags.reduce<Record<string, Flag[]>>((acc, f) => {
    (acc[f.category] ??= []).push(f);
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Platform Settings</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Global feature flags, branding, and LLM routing configuration
        </p>
      </div>

      {/* Feature Flags */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <ToggleRight size={20} className="text-[#2E5090]" />
          Feature Flags
        </h2>
        {Object.entries(flagsByCategory).map(([category, categoryFlags]) => (
          <div key={category} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{category}</h3>
            </div>
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {categoryFlags.map(flag => (
                <div key={flag.name} className="flex items-center justify-between px-4 py-3">
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{flag.name}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{flag.description}</p>
                  </div>
                  <button
                    onClick={() => toggleFlag(flag.name, flag.enabled)}
                    className={`p-1 rounded transition-colors ${flag.enabled ? 'text-green-500' : 'text-gray-400'}`}
                  >
                    {flag.enabled ? <ToggleRight size={28} /> : <ToggleLeft size={28} />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Branding */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Palette size={20} className="text-[#2E5090]" />
          Branding Defaults
        </h2>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          {branding ? (
            <div className="grid grid-cols-2 gap-4 text-sm">
              {Object.entries(branding).map(([key, value]) => (
                <div key={key}>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{key}</p>
                  <p className="text-gray-900 dark:text-gray-100 font-mono text-xs">
                    {key === 'primaryColor' ? (
                      <span className="flex items-center gap-2">
                        <span className="inline-block w-4 h-4 rounded" style={{ backgroundColor: value as string }} />
                        {value as string}
                      </span>
                    ) : (
                      String(value ?? 'null')
                    )}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No branding config loaded</p>
          )}
        </div>
      </section>

      {/* LLM Config */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center gap-2">
          <Cpu size={20} className="text-[#2E5090]" />
          LLM Routing Config
          {llmConfig && (
            <span className="text-xs font-normal px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500">
              source: {llmConfig.source}
            </span>
          )}
        </h2>
        <div className="rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 p-4">
          {llmConfig?.models ? (
            <div className="space-y-3">
              {Object.entries(llmConfig.models).map(([taskType, models]: [string, any]) => (
                <div key={taskType}>
                  <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">{taskType}</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(models).map(([tier, model]: [string, any]) => (
                      <span key={tier} className="px-2 py-1 text-xs rounded-lg bg-gray-50 dark:bg-gray-800 font-mono">
                        <span className="text-gray-400">{tier}:</span> {model}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <div className="pt-2 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400">
                Routing: {llmConfig.routing} | Fallback: {llmConfig.fallback}
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-400">Spaniel not connected — showing defaults</p>
          )}
        </div>
      </section>
    </div>
  );
}
