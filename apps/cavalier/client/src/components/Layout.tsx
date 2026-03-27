/**
 * Main layout with sidebar navigation, theme toggle, and Ducky Intelligence branding.
 * Three portal tiers: Platform Admin, MSP Portal, Client Portal.
 */
import { Outlet, NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Ticket, Plug, Users, Receipt, Settings,
  Sun, Moon, Monitor, DollarSign, UserPlus,
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/tickets', label: 'Tickets', icon: Ticket },
  { to: '/connectors', label: 'Connectors', icon: Plug },
  { to: '/clients', label: 'Clients', icon: Users },
  { to: '/billing', label: 'Billing', icon: Receipt },
  { to: '/commissions', label: 'Commissions', icon: DollarSign },
  { to: '/onboarding', label: 'Onboarding', icon: UserPlus },
  { to: '/settings', label: 'Settings', icon: Settings },
];

export function Layout() {
  const { theme, setTheme } = useTheme();

  const themeIcons = { light: Sun, dark: Moon, system: Monitor };
  const nextTheme: Record<string, 'light' | 'dark' | 'system'> = {
    light: 'dark',
    dark: 'system',
    system: 'light',
  };
  const ThemeIcon = themeIcons[theme];

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900 flex flex-col">
        {/* Logo */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <h1 className="text-lg font-bold text-[#2E5090]">
            Cavalier Partners
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Channel GTM Platform</p>
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
