import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/Dashboard';
import { SaasDiscoveryPage } from './pages/SaasDiscovery';
import { DevicesPage } from './pages/Devices';
import { PoliciesPage } from './pages/Policies';
import { ScanPage } from './pages/Scan';
import { ScorePage } from './pages/Score';
import { FreemiumScanPage } from './pages/FreemiumScan';
import { IarFreemiumPage } from './pages/IarFreemium';

export function App() {
  return (
    <Routes>
      {/* Public routes — freemium tools */}
      <Route path="/scan" element={<FreemiumScanPage />} />
      <Route path="/iar" element={<IarFreemiumPage />} />

      {/* Authenticated routes */}
      <Route element={<Layout />}>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/saas" element={<SaasDiscoveryPage />} />
        <Route path="/devices" element={<DevicesPage />} />
        <Route path="/policies" element={<PoliciesPage />} />
        <Route path="/scans" element={<ScanPage />} />
        <Route path="/score" element={<ScorePage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
