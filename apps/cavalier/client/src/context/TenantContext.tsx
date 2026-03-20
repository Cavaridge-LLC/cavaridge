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
  userRole: 'partner_admin',
  setTenant: () => {},
});

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenantId, setTenantId] = useState(() => localStorage.getItem('cavalier-tenant-id') ?? '');
  const [userId, setUserId] = useState(() => localStorage.getItem('cavalier-user-id') ?? '');
  const [userRole, setUserRole] = useState(() => localStorage.getItem('cavalier-user-role') ?? 'partner_admin');

  function setTenant(t: string, u: string, r: string) {
    setTenantId(t);
    setUserId(u);
    setUserRole(r);
    localStorage.setItem('cavalier-tenant-id', t);
    localStorage.setItem('cavalier-user-id', u);
    localStorage.setItem('cavalier-user-role', r);
  }

  return (
    <TenantContext.Provider value={{ tenantId, userId, userRole, setTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export const useTenant = () => useContext(TenantContext);
