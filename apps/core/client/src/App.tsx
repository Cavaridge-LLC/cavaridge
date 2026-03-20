import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/Dashboard';
import { TenantsPage } from './pages/Tenants';
import { TenantTreePage } from './pages/TenantTree';
import { UsersPage } from './pages/Users';
import { AppRegistryPage } from './pages/AppRegistry';
import { SettingsPage } from './pages/Settings';
import { AuditLogPage } from './pages/AuditLog';
import { ConnectorMarketplacePage } from './pages/ConnectorMarketplace';
import { DatabaseHealthPage } from './pages/DatabaseHealth';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tenants" element={<TenantsPage />} />
        <Route path="/tenants/tree" element={<TenantTreePage />} />
        <Route path="/users" element={<UsersPage />} />
        <Route path="/apps" element={<AppRegistryPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/audit" element={<AuditLogPage />} />
        <Route path="/connectors" element={<ConnectorMarketplacePage />} />
        <Route path="/database" element={<DatabaseHealthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
