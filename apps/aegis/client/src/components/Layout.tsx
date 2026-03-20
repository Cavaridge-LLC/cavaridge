/**
 * Main layout with sidebar navigation, theme toggle, and Ducky Intelligence branding.
 * Three portal tiers: Platform Admin, MSP Portal, Client Portal.
 */
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Globe, Monitor, ShieldCheck, ScanLine, Gauge,
  Sun, Moon, MonitorSmartphone, Key,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useTenant } from '../context/TenantContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/saas', label: 'SaaS Discovery', icon: Globe },
  { to: '/devices', label: 'Devices', icon: Monitor },
  { to: '/policies', label: 'Policies', icon: ShieldCheck },
  { to: '/scans', label: 'Scans', icon: ScanLine },
  { to: '/score', label: 'Adjusted Score', icon: Gauge },
];

const ROLE_LABELS: Record<string, string> = {
  platform_admin: 'Platform Admin',
  msp_admin: 'MSP Admin',
  msp_tech: 'MSP Tech',
  client_admin: 'Client Admin',
  client_viewer: 'Client Viewer',
};

export function Layout() {
  const { theme, setTheme } = useTheme();
  const { userRole, tenantId, setTenant } = useTenant();

  const themeIcons = { light: Sun, dark: Moon, system: MonitorSmartphone };
  const nextTheme: Record<string, 'light' | 'dark' | 'system'> = {
    light: 'dark',
    dark: 'system',
    system: 'light',
  };
  const ThemeIcon = themeIcons[theme];

  // Dev mode: show tenant config if not set
  if (!tenantId) {
    return (
      <div className="flex items-center justify-center h-full bg-gray-50 dark:bg-gray-950">
        <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg p-8 max-w-md w-full border border-gray-200 dark:border-gray-800">
          <h1 className="text-xl font-bold text-[#2E5090] mb-2">AEGIS Setup</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
            Configure your tenant context to access the dashboard.
          </p>
          <form onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            setTenant(
              fd.get('tenantId') as string,
              fd.get('userId') as string,
              fd.get('role') as string,
            );
          }}>
            <label className="block text-sm font-medium mb-1">Tenant ID</label>
            <input name="tenantId" required className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm mb-3 focus:outline-none focus:border-[#2E5090]" placeholder="UUID" />

            <label className="block text-sm font-medium mb-1">User ID</label>
            <input name="userId" required className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm mb-3 focus:outline-none focus:border-[#2E5090]" placeholder="UUID" />

            <label className="block text-sm font-medium mb-1">Role</label>
            <select name="role" className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-transparent text-sm mb-4 focus:outline-none focus:border-[#2E5090]">
              <option value="platform_admin">Platform Admin</option>
              <option value="msp_admin" selected>MSP Admin</option>
              <option value="msp_tech">MSP Tech</option>
              <option value="client_admin">Client Admin</option>
              <option value="client_viewer">Client Viewer</option>
            </select>

            <button type="submit" className="w-full py-2 bg-[#2E5090] text-white rounded-lg text-sm font-semibold hover:bg-[#1e3a6e] transition-colors">
              Enter Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-lg font-bold text-[#2E5090]">AEGIS</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Managed Browser Security</p>
          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-medium bg-[#2E5090]/10 text-[#2E5090] rounded-full">
            {ROLE_LABELS[userRole] ?? userRole}
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-[#2E5090] text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-800'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Enrollment token shortcut */}
        <div className="px-2 pb-2">
          <NavLink
            to="/devices"
            className="flex items-center gap-2 px-3 py-2 text-xs text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <Key size={14} />
            Enrollment Tokens
          </NavLink>
        </div>

        {/* Theme toggle */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800">
          <button
            onClick={() => setTheme(nextTheme[theme])}
            className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ThemeIcon size={16} />
            <span className="capitalize">{theme} theme</span>
          </button>
        </div>

        {/* Ducky Intelligence branding */}
        <div className="p-3 border-t border-gray-200 dark:border-gray-800 text-center">
          <p className="text-[10px] text-gray-400 dark:text-gray-500">
            Powered by Ducky Intelligence.
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
