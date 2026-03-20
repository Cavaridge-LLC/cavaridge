/**
 * Partner Settings — onboarding, tier management, usage dashboard.
 * Partner tiers: Starter / Professional / Enterprise.
 */
import { useEffect, useState } from 'react';
import { Shield, Zap, Crown, Check } from 'lucide-react';
import { partners } from '../lib/api';
import { useTenant } from '../context/TenantContext';

export function PartnerSettingsPage() {
  const { tenantId, setTenant } = useTenant();
  const [tiers, setTiers] = useState<any[]>([]);
  const [profile, setProfile] = useState<any>(null);
  const [onboardForm, setOnboardForm] = useState({
    companyName: '', contactName: '', contactEmail: '', contactPhone: '', tier: 'starter', techCount: 1,
  });
  const [showOnboard, setShowOnboard] = useState(false);

  useEffect(() => {
    partners.tiers().then(setTiers).catch(() => {});
    if (tenantId) {
      partners.profile().then(setProfile).catch(() => setShowOnboard(true));
    }
  }, [tenantId]);

  const handleOnboard = async () => {
    try {
      await partners.onboard(onboardForm);
      setShowOnboard(false);
      partners.profile().then(setProfile).catch(() => {});
    } catch (err) {
      alert((err as Error).message);
    }
  };

  const tierIcons: Record<string, React.ReactNode> = {
    starter: <Shield size={20} />,
    professional: <Zap size={20} />,
    enterprise: <Crown size={20} />,
  };

  // Dev mode: set tenant context if not set
  if (!tenantId) {
    return (
      <div className="p-6 max-w-md mx-auto mt-12">
        <h2 className="text-xl font-bold mb-4">Set Tenant Context (Dev Mode)</h2>
        <p className="text-sm text-gray-500 mb-4">
          In production, this is handled by Supabase Auth. For development, enter UUIDs manually.
        </p>
        <div className="space-y-3">
          <input
            placeholder="Tenant ID (UUID)"
            className="w-full px-3 py-2 border rounded-lg text-sm"
            onChange={(e) => setOnboardForm((f) => ({ ...f, companyName: e.target.value }))}
          />
          <input
            placeholder="User ID (UUID)"
            className="w-full px-3 py-2 border rounded-lg text-sm"
            onChange={(e) => setOnboardForm((f) => ({ ...f, contactName: e.target.value }))}
          />
          <button
            onClick={() => setTenant(onboardForm.companyName, onboardForm.contactName, 'partner_admin')}
            className="w-full px-4 py-2 bg-[#2E5090] text-white rounded-lg text-sm"
          >
            Set Context
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <h2 className="text-2xl font-bold">Partner Settings</h2>

      {/* Current profile */}
      {profile && (
        <div className="border border-gray-200 dark:border-gray-800 rounded-lg p-5">
          <h3 className="font-semibold mb-3">Partner Profile</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div><span className="text-gray-500">Company:</span> {profile.company_name ?? '—'}</div>
            <div><span className="text-gray-500">Contact:</span> {profile.contact_name ?? '—'}</div>
            <div><span className="text-gray-500">Email:</span> {profile.contact_email ?? '—'}</div>
            <div><span className="text-gray-500">Tier:</span> <span className="capitalize font-medium">{profile.partner_tier ?? 'starter'}</span></div>
            <div><span className="text-gray-500">Technicians:</span> {profile.tech_count ?? 1}</div>
            <div><span className="text-gray-500">Onboarded:</span> {profile.onboarded_at ? new Date(profile.onboarded_at).toLocaleDateString() : '—'}</div>
          </div>
        </div>
      )}

      {/* Tier comparison */}
      <div>
        <h3 className="font-semibold mb-4">Partner Tiers</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((tier) => {
            const isCurrentTier = profile?.partner_tier === tier.id;
            return (
              <div key={tier.id} className={`border rounded-lg p-5 ${
                isCurrentTier ? 'border-[#2E5090] ring-2 ring-[#2E5090]/20' : 'border-gray-200 dark:border-gray-800'
              }`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className="text-[#2E5090]">{tierIcons[tier.id]}</div>
                  <h4 className="font-bold">{tier.name}</h4>
                </div>
                <p className="text-2xl font-bold mb-4">${tier.monthlyPerTech}<span className="text-sm text-gray-500">/tech/mo</span></p>

                <ul className="space-y-2 text-sm mb-4">
                  {tier.features.map((feature: string) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check size={14} className="text-green-500 mt-0.5 shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                <div className="text-xs text-gray-500 space-y-1 mb-4">
                  <div>Connectors: {tier.maxConnectors === -1 ? 'Unlimited' : tier.maxConnectors}</div>
                  <div>Support: {tier.support}</div>
                  <div>HIPAA: {tier.hipaa}</div>
                </div>

                {isCurrentTier ? (
                  <div className="text-center text-sm text-[#2E5090] font-medium py-2">Current Plan</div>
                ) : (
                  <button
                    onClick={() => partners.updateTier(tier.id).then(() => partners.profile().then(setProfile))}
                    className="w-full py-2 text-sm border border-[#2E5090] text-[#2E5090] rounded-lg hover:bg-[#2E5090] hover:text-white transition-colors"
                  >
                    {tier.monthlyPerTech > (profile?.tierDetails?.monthlyPerTech ?? 0) ? 'Upgrade' : 'Change Plan'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Onboarding modal */}
      {showOnboard && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-lg w-full max-w-lg p-6">
            <h3 className="text-lg font-bold mb-4">Welcome to Cavalier Partners</h3>
            <p className="text-sm text-gray-500 mb-4">Complete your partner profile to get started.</p>
            <div className="space-y-3">
              <input placeholder="Company Name" value={onboardForm.companyName}
                onChange={(e) => setOnboardForm((f) => ({ ...f, companyName: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input placeholder="Contact Name" value={onboardForm.contactName}
                onChange={(e) => setOnboardForm((f) => ({ ...f, contactName: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input placeholder="Contact Email" type="email" value={onboardForm.contactEmail}
                onChange={(e) => setOnboardForm((f) => ({ ...f, contactEmail: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <input placeholder="Contact Phone" value={onboardForm.contactPhone}
                onChange={(e) => setOnboardForm((f) => ({ ...f, contactPhone: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm" />
              <select value={onboardForm.tier}
                onChange={(e) => setOnboardForm((f) => ({ ...f, tier: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm">
                <option value="starter">Starter ($149/tech/mo)</option>
                <option value="professional">Professional ($249/tech/mo)</option>
                <option value="enterprise">Enterprise ($349/tech/mo)</option>
              </select>
              <div className="flex justify-end gap-3 pt-2">
                <button onClick={() => setShowOnboard(false)} className="px-4 py-2 text-sm border rounded-lg">Later</button>
                <button onClick={handleOnboard} className="px-4 py-2 text-sm bg-[#2E5090] text-white rounded-lg">Complete Onboarding</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
