/**
 * Clients page — child tenant list for MSP portal.
 * Shows open tickets and active contracts per client.
 */
import { useEffect, useState } from 'react';
import { Users, Building, Ticket, FileText } from 'lucide-react';
import { partners } from '../lib/api';

export function ClientsPage() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    partners.clients()
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .catch(() => setClients([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Clients</h2>
        <span className="text-sm text-gray-500">{clients.length} clients</span>
      </div>

      {loading ? (
        <p className="text-gray-400">Loading...</p>
      ) : clients.length === 0 ? (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-8 text-center">
          <Building size={32} className="mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">No clients found. Client tenants will appear here once created in the platform.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {clients.map((client) => (
            <div key={client.id} className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-lg bg-[#2E5090]/10 flex items-center justify-center">
                  <Building size={18} className="text-[#2E5090]" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">{client.name ?? 'Unnamed Client'}</h3>
                  <span className="text-xs text-gray-400 capitalize">{client.type}</span>
                </div>
              </div>

              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-gray-500">
                    <Ticket size={12} /> Open Tickets
                  </span>
                  <span className={`font-medium ${(client.open_tickets ?? 0) > 0 ? 'text-orange-600' : ''}`}>
                    {client.open_tickets ?? 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1 text-gray-500">
                    <FileText size={12} /> Active Contracts
                  </span>
                  <span className="font-medium">{client.active_contracts ?? 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
