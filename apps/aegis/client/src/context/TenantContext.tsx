/**
 * Tenant context — provides tenantId, userId, userRole to all components.
 * In production, this reads from Supabase Auth JWT claims.
 * For dev, uses localStorage.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';

interface TenantContextValue {
  tenantId: string;
  userId: string;
  userRole: string;
  setTenant: (tenantId: string, userId: string, role: string) => void;
}

const TenantContext = createContext<TenantContextValue>({
  tenantId: '',
  userId: '',
  userRole: 'msp_admin',
  setTenant: () => {},
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenantId] = useState(() => localStorage.getItem('aegis-tenant-id') ?? '');
  const [userId, setUserId] = useState(() => localStorage.getItem('aegis-user-id') ?? '');
  const [userRole, setUserRole] = useState(() => localStorage.getItem('aegis-user-role') ?? 'msp_admin');

  function setTenant(t: string, u: string, r: string) {
    setTenantId(t);
    setUserId(u);
    setUserRole(r);
    localStorage.setItem('aegis-tenant-id', t);
    localStorage.setItem('aegis-user-id', u);
    localStorage.setItem('aegis-user-role', r);
  }

  return (
    <TenantContext.Provider value={{ tenantId, userId, userRole, setTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
