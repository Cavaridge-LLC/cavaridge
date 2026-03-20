import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/Dashboard';
import { TicketListPage } from './pages/TicketList';
import { TicketDetailPage } from './pages/TicketDetail';
import { ConnectorsPage } from './pages/Connectors';
import { ClientsPage } from './pages/Clients';
import { BillingPage } from './pages/Billing';
import { PartnerSettingsPage } from './pages/PartnerSettings';

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tickets" element={<TicketListPage />} />
        <Route path="/tickets/:id" element={<TicketDetailPage />} />
        <Route path="/connectors" element={<ConnectorsPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/billing" element={<BillingPage />} />
        <Route path="/settings" element={<PartnerSettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
