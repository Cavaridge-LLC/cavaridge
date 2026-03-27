/**
 * CVG-CAVALIER — Partner Onboarding Wizard
 *
 * Multi-step onboarding flow for new channel partners:
 * 1. Company Information
 * 2. RMM Selection ("Bring your RMM")
 * 3. API Credentials for selected RMM
 * 4. Service Tier Selection (Starter / Professional / Enterprise)
 * 5. Review & Confirm
 *
 * Dark theme with Cavaridge branding (#2E5090).
 * Submits to POST /api/v1/partners/onboard on completion.
 */
import { useState } from 'react';
import {
  Building2, Server, KeyRound, Crown, CheckCircle,
  ChevronRight, ChevronLeft, Loader2, Check,
} from 'lucide-react';
import { partners } from '../lib/api';

// ─── Types ───────────────────────────────────────────────────────────────

interface CompanyInfo {
  companyName: string;
  domain: string;
  industry: string;
  companySize: string;
  primaryContactName: string;
  primaryContactEmail: string;
  primaryContactPhone: string;
}

type RmmProvider =
  | 'ninjaone'
  | 'connectwise_automate'
  | 'datto_rmm'
  | 'atera'
  | 'syncro'
  | 'halopsa'
  | 'other';

interface RmmSelection {
  provider: RmmProvider | '';
  otherName: string;
}

interface ApiCredentials {
  clientId: string;
  clientSecret: string;
  apiKey: string;
  instanceUrl: string;
}

type TierId = 'starter' | 'professional' | 'enterprise';

interface BrandingInfo {
  logoFile: File | null;
  logoPreview: string;
  primaryColor: string;
  tagline: string;
}

interface OnboardingData {
  company: CompanyInfo;
  rmm: RmmSelection;
  credentials: ApiCredentials;
  tier: TierId;
  techCount: number;
  branding: BrandingInfo;
  termsAccepted: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────────

const STEPS = [
  { id: 1, label: 'Company Info', icon: Building2 },
  { id: 2, label: 'RMM Selection', icon: Server },
  { id: 3, label: 'API Credentials', icon: KeyRound },
  { id: 4, label: 'Service Tier', icon: Crown },
  { id: 5, label: 'Branding', icon: Building2 },
  { id: 6, label: 'Review & Confirm', icon: CheckCircle },
] as const;

const RMM_PROVIDERS: { id: RmmProvider; name: string; logo: string }[] = [
  { id: 'ninjaone', name: 'NinjaOne', logo: 'NJ' },
  { id: 'connectwise_automate', name: 'ConnectWise Automate', logo: 'CW' },
  { id: 'datto_rmm', name: 'Datto RMM', logo: 'DT' },
  { id: 'atera', name: 'Atera', logo: 'AT' },
  { id: 'syncro', name: 'Syncro', logo: 'SY' },
  { id: 'halopsa', name: 'HaloPSA', logo: 'HP' },
  { id: 'other', name: 'Other', logo: '??' },
];

const RMM_CREDENTIAL_FIELDS: Record<RmmProvider, { label: string; field: keyof ApiCredentials; type: string; placeholder: string }[]> = {
  ninjaone: [
    { label: 'Client ID', field: 'clientId', type: 'text', placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' },
    { label: 'Client Secret', field: 'clientSecret', type: 'password', placeholder: 'Enter client secret' },
    { label: 'Instance URL', field: 'instanceUrl', type: 'url', placeholder: 'https://app.ninjarmm.com' },
  ],
  connectwise_automate: [
    { label: 'Client ID', field: 'clientId', type: 'text', placeholder: 'Your CW Automate client ID' },
    { label: 'Client Secret', field: 'clientSecret', type: 'password', placeholder: 'Enter client secret' },
    { label: 'Instance URL', field: 'instanceUrl', type: 'url', placeholder: 'https://yourserver.hostedrmm.com' },
  ],
  datto_rmm: [
    { label: 'API Key', field: 'apiKey', type: 'password', placeholder: 'Your Datto RMM API key' },
    { label: 'API Secret', field: 'clientSecret', type: 'password', placeholder: 'Your Datto RMM API secret' },
    { label: 'Instance URL', field: 'instanceUrl', type: 'url', placeholder: 'https://pinotage-api.centrastage.net' },
  ],
  atera: [
    { label: 'API Key', field: 'apiKey', type: 'password', placeholder: 'Your Atera API key' },
    { label: 'Instance URL', field: 'instanceUrl', type: 'url', placeholder: 'https://app.atera.com' },
  ],
  syncro: [
    { label: 'API Key', field: 'apiKey', type: 'password', placeholder: 'Your Syncro API key' },
    { label: 'Instance URL', field: 'instanceUrl', type: 'url', placeholder: 'https://yourcompany.syncromsp.com' },
  ],
  halopsa: [
    { label: 'Client ID', field: 'clientId', type: 'text', placeholder: 'HaloPSA client ID' },
    { label: 'Client Secret', field: 'clientSecret', type: 'password', placeholder: 'HaloPSA client secret' },
    { label: 'Instance URL', field: 'instanceUrl', type: 'url', placeholder: 'https://yourcompany.halopsa.com' },
  ],
  other: [
    { label: 'API Key / Token', field: 'apiKey', type: 'password', placeholder: 'Your API key or token' },
    { label: 'Instance URL', field: 'instanceUrl', type: 'url', placeholder: 'https://api.yourtool.com' },
  ],
};

const TIERS: {
  id: TierId;
  name: string;
  price: number;
  priceLabel: string;
  features: string[];
  highlighted: boolean;
}[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: 149,
    priceLabel: '$149/tech/mo',
    features: [
      'Ducky Intelligence + Spaniel',
      'PSA-lite ticketing',
      'Client Portal (co-branded)',
      '2 RMM connectors',
      '3 standard connectors',
      'Community support',
      'HIPAA templates only',
    ],
    highlighted: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 249,
    priceLabel: '$249/tech/mo',
    features: [
      'Everything in Starter',
      'Caelum SoW Builder',
      'Midas QBR / Roadmap',
      'Vespar Migration Planning',
      '4 RMM connectors',
      '10 standard connectors',
      'Priority Slack support',
      'HIPAA automation',
    ],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 349,
    priceLabel: '$349/tech/mo',
    features: [
      'Everything in Professional',
      'AEGIS Security Platform',
      'Meridian M&A Intelligence',
      'Brain Knowledge Capture',
      'Unlimited connectors',
      'White-label branding',
      'Dedicated PSM',
      'Full HIPAA + audit',
    ],
    highlighted: false,
  },
];

const INDUSTRY_OPTIONS = [
  'Managed Service Provider',
  'Healthcare IT',
  'Financial Services',
  'Legal',
  'Education',
  'Government',
  'Manufacturing',
  'Retail',
  'Other',
];

const COMPANY_SIZE_OPTIONS = [
  '1-5 employees',
  '6-15 employees',
  '16-50 employees',
  '51-100 employees',
  '100+ employees',
];

// ─── Component ───────────────────────────────────────────────────────────

export function PartnerOnboardingPage() {
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');

  const [data, setData] = useState<OnboardingData>({
    company: {
      companyName: '',
      domain: '',
      industry: '',
      companySize: '',
      primaryContactName: '',
      primaryContactEmail: '',
      primaryContactPhone: '',
    },
    rmm: { provider: '', otherName: '' },
    credentials: { clientId: '', clientSecret: '', apiKey: '', instanceUrl: '' },
    tier: 'professional',
    techCount: 1,
    branding: { logoFile: null, logoPreview: '', primaryColor: '#2E5090', tagline: '' },
    termsAccepted: false,
  });

  const updateCompany = (field: keyof CompanyInfo, value: string) => {
    setData((prev) => ({ ...prev, company: { ...prev.company, [field]: value } }));
  };

  const updateRmm = (field: keyof RmmSelection, value: string) => {
    setData((prev) => ({
      ...prev,
      rmm: { ...prev.rmm, [field]: value },
      // Reset credentials when provider changes
      ...(field === 'provider' ? { credentials: { clientId: '', clientSecret: '', apiKey: '', instanceUrl: '' } } : {}),
    }));
  };

  const updateCredentials = (field: keyof ApiCredentials, value: string) => {
    setData((prev) => ({ ...prev, credentials: { ...prev.credentials, [field]: value } }));
  };

  const canProceed = (): boolean => {
    switch (step) {
      case 1:
        return !!(
          data.company.companyName &&
          data.company.domain &&
          data.company.industry &&
          data.company.companySize &&
          data.company.primaryContactName &&
          data.company.primaryContactEmail
        );
      case 2:
        return !!(data.rmm.provider && (data.rmm.provider !== 'other' || data.rmm.otherName));
      case 3: {
        if (!data.rmm.provider) return false;
        const fields = RMM_CREDENTIAL_FIELDS[data.rmm.provider as RmmProvider] ?? [];
        return fields.every((f) => data.credentials[f.field]?.trim());
      }
      case 4:
        return !!data.tier && data.techCount >= 1;
      case 5:
        return true; // Branding is optional
      case 6:
        return data.termsAccepted;
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      await partners.onboard({
        companyName: data.company.companyName,
        contactName: data.company.primaryContactName,
        contactEmail: data.company.primaryContactEmail,
        contactPhone: data.company.primaryContactPhone,
        tier: data.tier,
        techCount: data.techCount,
        domain: data.company.domain,
        industry: data.company.industry,
        companySize: data.company.companySize,
        rmmProvider: data.rmm.provider === 'other' ? data.rmm.otherName : data.rmm.provider,
        rmmCredentials: data.credentials,
        branding: {
          primaryColor: data.branding.primaryColor,
          tagline: data.branding.tagline,
          hasLogo: !!data.branding.logoFile,
        },
      });
      setSubmitted(true);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-full flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
            <CheckCircle className="text-green-600 dark:text-green-400" size={32} />
          </div>
          <h2 className="text-2xl font-bold">Welcome to Cavalier Partners</h2>
          <p className="text-gray-500 dark:text-gray-400">
            Your partner account has been created. Our team will review your RMM credentials
            and activate your {TIERS.find((t) => t.id === data.tier)?.name} tier within 24 hours.
          </p>
          <a
            href="/"
            className="inline-block mt-4 px-6 py-3 bg-[#2E5090] text-white rounded-lg font-medium hover:bg-[#243f73] transition-colors"
          >
            Go to Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-8">
      <div>
        <h2 className="text-2xl font-bold">Partner Onboarding</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Set up your Cavalier Partners account in a few steps.
        </p>
      </div>

      {/* Progress stepper */}
      <div className="flex items-center justify-between">
        {STEPS.map(({ id, label, icon: Icon }, idx) => (
          <div key={id} className="flex items-center flex-1">
            <div className="flex flex-col items-center">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                  step > id
                    ? 'bg-green-600 text-white'
                    : step === id
                    ? 'bg-[#2E5090] text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                }`}
              >
                {step > id ? <Check size={18} /> : <Icon size={18} />}
              </div>
              <span
                className={`text-xs mt-1.5 font-medium hidden sm:block ${
                  step === id ? 'text-[#2E5090]' : 'text-gray-400 dark:text-gray-500'
                }`}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`flex-1 h-0.5 mx-2 ${
                  step > id ? 'bg-green-600' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="border border-gray-200 dark:border-gray-800 rounded-xl p-6 bg-white dark:bg-gray-900">
        {step === 1 && <StepCompanyInfo data={data.company} onChange={updateCompany} />}
        {step === 2 && <StepRmmSelection data={data.rmm} onChange={updateRmm} />}
        {step === 3 && <StepApiCredentials provider={data.rmm.provider as RmmProvider} data={data.credentials} onChange={updateCredentials} />}
        {step === 4 && (
          <StepTierSelection
            tier={data.tier}
            techCount={data.techCount}
            onTierChange={(t) => setData((prev) => ({ ...prev, tier: t }))}
            onTechCountChange={(n) => setData((prev) => ({ ...prev, techCount: n }))}
          />
        )}
        {step === 5 && (
          <StepBranding
            data={data.branding}
            onChange={(branding) => setData((prev) => ({ ...prev, branding }))}
          />
        )}
        {step === 6 && (
          <StepReview
            data={data}
            onTermsChange={(v) => setData((prev) => ({ ...prev, termsAccepted: v }))}
          />
        )}
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200 text-sm">{error}</p>
        </div>
      )}

      {/* Navigation buttons */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1))}
          disabled={step === 1}
          className="flex items-center gap-2 px-5 py-2.5 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <ChevronLeft size={16} /> Back
        </button>

        {step < 6 ? (
          <button
            onClick={() => setStep((s) => Math.min(6, s + 1))}
            disabled={!canProceed()}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#2E5090] text-white rounded-lg text-sm font-medium hover:bg-[#243f73] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Continue <ChevronRight size={16} />
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed() || submitting}
            className="flex items-center gap-2 px-6 py-2.5 bg-[#2E5090] text-white rounded-lg text-sm font-medium hover:bg-[#243f73] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Submitting...
              </>
            ) : (
              <>
                <CheckCircle size={16} /> Complete Onboarding
              </>
            )}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Step Components ─────────────────────────────────────────────────────

function StepCompanyInfo({
  data,
  onChange,
}: {
  data: CompanyInfo;
  onChange: (field: keyof CompanyInfo, value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold">Company Information</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Tell us about your organization so we can configure the right partner experience.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <FormField label="Company Name" required>
          <input
            type="text"
            value={data.companyName}
            onChange={(e) => onChange('companyName', e.target.value)}
            placeholder="Acme MSP"
            className="form-input"
          />
        </FormField>

        <FormField label="Domain" required>
          <input
            type="text"
            value={data.domain}
            onChange={(e) => onChange('domain', e.target.value)}
            placeholder="acmemsp.com"
            className="form-input"
          />
        </FormField>

        <FormField label="Industry" required>
          <select
            value={data.industry}
            onChange={(e) => onChange('industry', e.target.value)}
            className="form-input"
          >
            <option value="">Select industry...</option>
            {INDUSTRY_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </FormField>

        <FormField label="Company Size" required>
          <select
            value={data.companySize}
            onChange={(e) => onChange('companySize', e.target.value)}
            className="form-input"
          >
            <option value="">Select size...</option>
            {COMPANY_SIZE_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        </FormField>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
        <h4 className="text-sm font-medium mb-3">Primary Contact</h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <FormField label="Full Name" required>
            <input
              type="text"
              value={data.primaryContactName}
              onChange={(e) => onChange('primaryContactName', e.target.value)}
              placeholder="Jane Smith"
              className="form-input"
            />
          </FormField>

          <FormField label="Email" required>
            <input
              type="email"
              value={data.primaryContactEmail}
              onChange={(e) => onChange('primaryContactEmail', e.target.value)}
              placeholder="jane@acmemsp.com"
              className="form-input"
            />
          </FormField>

          <FormField label="Phone">
            <input
              type="tel"
              value={data.primaryContactPhone}
              onChange={(e) => onChange('primaryContactPhone', e.target.value)}
              placeholder="(555) 123-4567"
              className="form-input"
            />
          </FormField>
        </div>
      </div>
    </div>
  );
}

function StepRmmSelection({
  data,
  onChange,
}: {
  data: RmmSelection;
  onChange: (field: keyof RmmSelection, value: string) => void;
}) {
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold">Bring Your RMM</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Cavalier Partners integrates with your existing RMM. Select the platform you use today
        and we will configure the connector for you.
      </p>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {RMM_PROVIDERS.map(({ id, name, logo }) => (
          <button
            key={id}
            onClick={() => onChange('provider', id)}
            className={`flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 transition-all ${
              data.provider === id
                ? 'border-[#2E5090] bg-[#2E5090]/10 dark:bg-[#2E5090]/20'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            <div
              className={`w-12 h-12 rounded-lg flex items-center justify-center text-sm font-bold ${
                data.provider === id
                  ? 'bg-[#2E5090] text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
              }`}
            >
              {logo}
            </div>
            <span className="text-sm font-medium text-center">{name}</span>
          </button>
        ))}
      </div>

      {data.provider === 'other' && (
        <FormField label="RMM Platform Name" required>
          <input
            type="text"
            value={data.otherName}
            onChange={(e) => onChange('otherName', e.target.value)}
            placeholder="Name of your RMM platform"
            className="form-input"
          />
        </FormField>
      )}
    </div>
  );
}

function StepApiCredentials({
  provider,
  data,
  onChange,
}: {
  provider: RmmProvider;
  data: ApiCredentials;
  onChange: (field: keyof ApiCredentials, value: string) => void;
}) {
  const fields = RMM_CREDENTIAL_FIELDS[provider] ?? [];
  const providerName = RMM_PROVIDERS.find((p) => p.id === provider)?.name ?? 'Your RMM';

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold">API Credentials</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Enter your {providerName} API credentials. These are encrypted at rest and used solely for
        connector sync operations. Credentials are stored in Doppler and never in plaintext.
      </p>

      <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
        <p className="text-amber-800 dark:text-amber-200 text-xs">
          Credentials are transmitted over TLS and stored using AES-256 encryption. You can revoke
          access at any time from the Connectors page.
        </p>
      </div>

      <div className="space-y-4">
        {fields.map(({ label, field, type, placeholder }) => (
          <FormField key={field} label={label} required>
            <input
              type={type}
              value={data[field]}
              onChange={(e) => onChange(field, e.target.value)}
              placeholder={placeholder}
              className="form-input"
              autoComplete="off"
            />
          </FormField>
        ))}
      </div>
    </div>
  );
}

function StepTierSelection({
  tier,
  techCount,
  onTierChange,
  onTechCountChange,
}: {
  tier: TierId;
  techCount: number;
  onTierChange: (t: TierId) => void;
  onTechCountChange: (n: number) => void;
}) {
  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold">Select Your Service Tier</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        All tiers include per-tech monthly billing. Choose the tier that fits your practice.
      </p>

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {TIERS.map((t) => (
          <button
            key={t.id}
            onClick={() => onTierChange(t.id)}
            className={`relative flex flex-col text-left p-5 rounded-xl border-2 transition-all ${
              tier === t.id
                ? 'border-[#2E5090] bg-[#2E5090]/5 dark:bg-[#2E5090]/15'
                : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {t.highlighted && (
              <span className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#2E5090] text-white text-xs font-bold px-3 py-0.5 rounded-full">
                Most Popular
              </span>
            )}
            <h4 className="text-lg font-bold">{t.name}</h4>
            <p className="text-2xl font-bold text-[#2E5090] mt-1">{t.priceLabel}</p>
            <ul className="mt-4 space-y-2 flex-1">
              {t.features.map((f) => (
                <li key={f} className="flex items-start gap-2 text-sm text-gray-600 dark:text-gray-400">
                  <Check size={14} className="mt-0.5 shrink-0 text-green-500" />
                  {f}
                </li>
              ))}
            </ul>
            {tier === t.id && (
              <div className="mt-4 text-center text-sm font-medium text-[#2E5090]">
                Selected
              </div>
            )}
          </button>
        ))}
      </div>

      {/* Tech count */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <FormField label="Number of Technicians">
          <div className="flex items-center gap-4">
            <input
              type="number"
              min={1}
              max={500}
              value={techCount}
              onChange={(e) => onTechCountChange(Math.max(1, parseInt(e.target.value) || 1))}
              className="form-input w-24"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Estimated monthly: <strong className="text-gray-900 dark:text-gray-100">
                ${(TIERS.find((t) => t.id === tier)?.price ?? 0) * techCount}/mo
              </strong>
            </span>
          </div>
        </FormField>
      </div>

      {/* Feature comparison table */}
      <details className="border border-gray-200 dark:border-gray-700 rounded-lg">
        <summary className="px-4 py-3 text-sm font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800">
          View Full Feature Comparison
        </summary>
        <div className="px-4 pb-4 overflow-x-auto">
          <table className="w-full text-sm mt-2">
            <thead>
              <tr className="text-left border-b border-gray-200 dark:border-gray-700">
                <th className="py-2 font-medium text-gray-500">Feature</th>
                <th className="py-2 font-medium text-center">Starter</th>
                <th className="py-2 font-medium text-center">Professional</th>
                <th className="py-2 font-medium text-center">Enterprise</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {[
                { feature: 'Ducky Intelligence', s: true, p: true, e: true },
                { feature: 'PSA-lite Ticketing', s: true, p: true, e: true },
                { feature: 'Client Portal', s: true, p: true, e: true },
                { feature: 'Caelum SoW Builder', s: false, p: true, e: true },
                { feature: 'Midas QBR / Roadmap', s: false, p: true, e: true },
                { feature: 'Vespar Migration', s: false, p: true, e: true },
                { feature: 'AEGIS Security', s: false, p: false, e: true },
                { feature: 'Meridian M&A Intel', s: false, p: false, e: true },
                { feature: 'Brain Knowledge', s: false, p: false, e: true },
                { feature: 'RMM Connectors', s: '2', p: '4', e: 'Unlimited' },
                { feature: 'Standard Connectors', s: '3', p: '10', e: 'Unlimited' },
                { feature: 'White-label', s: false, p: false, e: true },
                { feature: 'Support', s: 'Community', p: 'Priority Slack', e: 'Dedicated PSM' },
                { feature: 'HIPAA', s: 'Templates', p: 'Automation', e: 'Full + audit' },
              ].map(({ feature, s, p, e }) => (
                <tr key={feature}>
                  <td className="py-2 text-gray-600 dark:text-gray-400">{feature}</td>
                  <td className="py-2 text-center">{renderFeatureValue(s)}</td>
                  <td className="py-2 text-center">{renderFeatureValue(p)}</td>
                  <td className="py-2 text-center">{renderFeatureValue(e)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}

function StepBranding({
  data,
  onChange,
}: {
  data: BrandingInfo;
  onChange: (branding: BrandingInfo) => void;
}) {
  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) return;
    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) return;

    const reader = new FileReader();
    reader.onload = () => {
      onChange({
        ...data,
        logoFile: file,
        logoPreview: reader.result as string,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold">Partner Branding</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Customize the look and feel of your co-branded or white-label portal. These settings
        can be updated later from Partner Settings.
      </p>

      {/* Logo upload */}
      <div>
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Company Logo</span>
        <div className="mt-2 flex items-center gap-4">
          <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 flex items-center justify-center overflow-hidden bg-gray-50 dark:bg-gray-800">
            {data.logoPreview ? (
              <img
                src={data.logoPreview}
                alt="Logo preview"
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-xs text-gray-400">No logo</span>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <label className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
              <input
                type="file"
                accept="image/png,image/jpeg,image/svg+xml"
                onChange={handleLogoUpload}
                className="hidden"
              />
              Upload Logo
            </label>
            <span className="text-xs text-gray-400">PNG, JPG, or SVG. Max 2MB.</span>
          </div>
        </div>
      </div>

      {/* Primary color picker */}
      <FormField label="Primary Brand Color">
        <div className="flex items-center gap-3">
          <input
            type="color"
            value={data.primaryColor}
            onChange={(e) => onChange({ ...data, primaryColor: e.target.value })}
            className="w-10 h-10 rounded-lg border border-gray-300 dark:border-gray-600 cursor-pointer p-0.5"
          />
          <input
            type="text"
            value={data.primaryColor}
            onChange={(e) => {
              const val = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(val)) {
                onChange({ ...data, primaryColor: val });
              }
            }}
            placeholder="#2E5090"
            className="form-input w-32"
          />
          <div
            className="w-24 h-10 rounded-lg"
            style={{ backgroundColor: data.primaryColor }}
          />
        </div>
      </FormField>

      {/* Company tagline */}
      <FormField label="Company Tagline">
        <input
          type="text"
          value={data.tagline}
          onChange={(e) => onChange({ ...data, tagline: e.target.value })}
          placeholder="Your trusted IT partner"
          maxLength={100}
          className="form-input"
        />
        <span className="text-xs text-gray-400 mt-1 block">
          {data.tagline.length}/100 characters. Displayed in your partner portal header.
        </span>
      </FormField>

      {/* Preview */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <h4 className="text-sm font-medium mb-3">Preview</h4>
        <div
          className="rounded-lg p-4 flex items-center gap-3"
          style={{ backgroundColor: data.primaryColor + '15', borderLeft: `4px solid ${data.primaryColor}` }}
        >
          {data.logoPreview ? (
            <img src={data.logoPreview} alt="Logo" className="w-8 h-8 object-contain" />
          ) : (
            <div className="w-8 h-8 rounded bg-gray-200 dark:bg-gray-700" />
          )}
          <div>
            <span className="font-semibold text-sm" style={{ color: data.primaryColor }}>
              Your Partner Portal
            </span>
            {data.tagline && (
              <p className="text-xs text-gray-500 dark:text-gray-400">{data.tagline}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StepReview({
  data,
  onTermsChange,
}: {
  data: OnboardingData;
  onTermsChange: (v: boolean) => void;
}) {
  const tierInfo = TIERS.find((t) => t.id === data.tier);
  const rmmName =
    data.rmm.provider === 'other'
      ? data.rmm.otherName
      : RMM_PROVIDERS.find((p) => p.id === data.rmm.provider)?.name ?? '—';

  return (
    <div className="space-y-5">
      <h3 className="text-lg font-semibold">Review & Confirm</h3>
      <p className="text-sm text-gray-500 dark:text-gray-400">
        Please review your onboarding details before submitting.
      </p>

      {/* Company */}
      <ReviewSection title="Company Information">
        <ReviewRow label="Company" value={data.company.companyName} />
        <ReviewRow label="Domain" value={data.company.domain} />
        <ReviewRow label="Industry" value={data.company.industry} />
        <ReviewRow label="Size" value={data.company.companySize} />
        <ReviewRow label="Contact" value={`${data.company.primaryContactName} (${data.company.primaryContactEmail})`} />
        {data.company.primaryContactPhone && (
          <ReviewRow label="Phone" value={data.company.primaryContactPhone} />
        )}
      </ReviewSection>

      {/* RMM */}
      <ReviewSection title="RMM Integration">
        <ReviewRow label="Platform" value={rmmName} />
        <ReviewRow label="Instance" value={data.credentials.instanceUrl || '—'} />
        <ReviewRow label="Credentials" value="Provided (encrypted)" />
      </ReviewSection>

      {/* Tier */}
      <ReviewSection title="Service Tier">
        <ReviewRow label="Tier" value={tierInfo?.name ?? '—'} />
        <ReviewRow label="Technicians" value={String(data.techCount)} />
        <ReviewRow label="Monthly Estimate" value={`$${(tierInfo?.price ?? 0) * data.techCount}/mo`} />
      </ReviewSection>

      {/* Branding */}
      <ReviewSection title="Branding">
        <ReviewRow label="Logo" value={data.branding.logoFile ? data.branding.logoFile.name : 'Not uploaded'} />
        <ReviewRow label="Primary Color" value={data.branding.primaryColor} />
        <ReviewRow label="Tagline" value={data.branding.tagline || 'Not set'} />
      </ReviewSection>

      {/* Terms */}
      <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
        <label className="flex items-start gap-3 cursor-pointer">
          <input
            type="checkbox"
            checked={data.termsAccepted}
            onChange={(e) => onTermsChange(e.target.checked)}
            className="mt-1 w-4 h-4 accent-[#2E5090]"
          />
          <span className="text-sm text-gray-600 dark:text-gray-400">
            I agree to the Cavalier Partners Program Terms of Service and acknowledge that
            the monthly billing estimate above is subject to final pricing confirmation.
            Cavaridge, LLC retains all platform IP. API credentials will be used solely for
            connector sync operations.
          </span>
        </label>
      </div>
    </div>
  );
}

// ─── Shared UI helpers ───────────────────────────────────────────────────

function FormField({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </span>
      <div className="mt-1 [&_.form-input]:w-full [&_.form-input]:px-3 [&_.form-input]:py-2 [&_.form-input]:border [&_.form-input]:border-gray-300 [&_.form-input]:dark:border-gray-600 [&_.form-input]:rounded-lg [&_.form-input]:text-sm [&_.form-input]:bg-white [&_.form-input]:dark:bg-gray-800 [&_.form-input]:text-gray-900 [&_.form-input]:dark:text-gray-100 [&_.form-input]:focus:outline-none [&_.form-input]:focus:ring-2 [&_.form-input]:focus:ring-[#2E5090] [&_.form-input]:focus:border-transparent [&_.form-input]:placeholder:text-gray-400">
        {children}
      </div>
    </label>
  );
}

function ReviewSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
      <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2">
        <h4 className="text-sm font-semibold">{title}</h4>
      </div>
      <div className="divide-y divide-gray-100 dark:divide-gray-800">{children}</div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-4 py-2.5 text-sm">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function renderFeatureValue(v: boolean | string) {
  if (v === true) return <Check size={16} className="inline text-green-500" />;
  if (v === false) return <span className="text-gray-300 dark:text-gray-600">—</span>;
  return <span className="text-xs font-medium">{v}</span>;
}
