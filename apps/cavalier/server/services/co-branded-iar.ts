/**
 * CVG-CAVALIER — Co-Branded AEGIS Identity Access Review Service
 *
 * Generates co-branded IAR landing page configurations for channel partners,
 * tracks lead attribution for commission calculation, and computes
 * IAR-specific commission amounts based on partner tier.
 *
 * Partners can offer the AEGIS freemium IAR as a lead-gen tool with their
 * own branding. Leads are attributed to the partner for commission tracking.
 *
 * See: docs/architecture/CVG-AEGIS-IDENTITY-REVIEW-v1.0.md
 * See: docs/architecture/CVG-CAVALIER-ARCH-v1.0.md
 */
import { getSql } from '../db';

// ─── Types ───────────────────────────────────────────────────────────────

export interface CoBrandedConfig {
  partnerId: string;
  partnerName: string;
  logoUrl: string | null;
  primaryColor: string;
  secondaryColor: string;
  companyName: string;
  tagline: string;
  attributionCode: string;
  landingPageUrl: string;
  footerText: string;
  contactEmail: string;
  partnerTier: string;
}

export interface LeadAttribution {
  id: string;
  partnerId: string;
  leadEmail: string;
  reportId: string;
  attributedAt: string;
  conversionStatus: 'new' | 'engaged' | 'converted_freemium' | 'converted_paid';
}

// ─── Commission rates per tier for IAR conversions ───────────────────

const IAR_COMMISSION_RATES: Record<
  string,
  { freemium_to_paid: number; direct_sale: number }
> = {
  starter: {
    freemium_to_paid: 50,    // $50 flat per freemium-to-paid conversion
    direct_sale: 100,         // $100 flat per direct sale
  },
  professional: {
    freemium_to_paid: 75,
    direct_sale: 150,
  },
  enterprise: {
    freemium_to_paid: 100,
    direct_sale: 200,
  },
};

// Default Cavaridge brand colors
const DEFAULT_PRIMARY = '#2E5090';
const DEFAULT_SECONDARY = '#1A1A1A';

// ─── Service Functions ───────────────────────────────────────────────────

/**
 * Generate a co-branded IAR landing page configuration for a partner.
 *
 * Pulls partner profile, branding overrides, and builds a complete config
 * object that the AEGIS IAR frontend uses to render the co-branded page.
 *
 * @param partnerId - The partner's tenant ID
 * @returns CoBrandedConfig with all branding and attribution details
 */
export async function generateCoBrandedIarPage(
  partnerId: string,
): Promise<CoBrandedConfig> {
  const sql = getSql();

  // Fetch partner profile with branding
  const profileResult = await sql.unsafe(
    `SELECT
       pp.tenant_id,
       pp.company_name,
       pp.contact_email,
       pp.partner_tier,
       pp.domain,
       t.name as tenant_name,
       t.config
     FROM partner_profiles pp
     JOIN tenants t ON t.id = pp.tenant_id
     WHERE pp.tenant_id = $1`,
    [partnerId],
  );

  const profile = profileResult[0] as any;
  if (!profile) {
    throw new Error(`Partner profile not found for ID: ${partnerId}`);
  }

  // Extract branding from tenant config (if MSP has configured it)
  const config = typeof profile.config === 'string'
    ? JSON.parse(profile.config)
    : profile.config ?? {};

  const branding = config.branding ?? {};

  // Generate deterministic attribution code from partner ID
  const attributionCode = generateAttributionCode(partnerId);

  return {
    partnerId,
    partnerName: profile.company_name ?? profile.tenant_name ?? 'Partner',
    logoUrl: branding.logoUrl ?? null,
    primaryColor: branding.primaryColor ?? DEFAULT_PRIMARY,
    secondaryColor: branding.secondaryColor ?? DEFAULT_SECONDARY,
    companyName: profile.company_name ?? profile.tenant_name,
    tagline: branding.tagline ?? `Identity Access Review powered by ${profile.company_name}`,
    attributionCode,
    landingPageUrl: `https://iar.cavaridge.com/p/${attributionCode}`,
    footerText: `Powered by Ducky Intelligence. Offered by ${profile.company_name}.`,
    contactEmail: profile.contact_email ?? '',
    partnerTier: profile.partner_tier ?? 'starter',
  };
}

/**
 * Record a lead attribution when a prospect completes an IAR scan
 * through a partner's co-branded page.
 *
 * This creates the attribution record used for commission calculation
 * when the lead converts to a paid subscription.
 *
 * @param partnerId - The partner's tenant ID
 * @param leadEmail - Email of the prospect who completed the scan
 * @param reportId - ID of the generated IAR report
 */
export async function attributeLead(
  partnerId: string,
  leadEmail: string,
  reportId: string,
): Promise<void> {
  const sql = getSql();

  if (!partnerId || !leadEmail || !reportId) {
    throw new Error('partnerId, leadEmail, and reportId are required');
  }

  // Validate partner exists
  const partnerCheck = await sql.unsafe(
    `SELECT tenant_id FROM partner_profiles WHERE tenant_id = $1`,
    [partnerId],
  );

  if (!partnerCheck[0]) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  // Upsert lead attribution (idempotent on partner + email + report)
  await sql.unsafe(
    `INSERT INTO iar_lead_attributions
      (partner_id, lead_email, report_id, conversion_status, attributed_at)
     VALUES ($1, $2, $3, 'new', NOW())
     ON CONFLICT ON CONSTRAINT uq_iar_lead_partner_report
     DO UPDATE SET
       lead_email = EXCLUDED.lead_email,
       updated_at = NOW()`,
    [partnerId, leadEmail, reportId],
  );

  // Increment the partner's lead count for metrics
  await sql.unsafe(
    `UPDATE partner_profiles
     SET iar_leads_count = COALESCE(iar_leads_count, 0) + 1,
         updated_at = NOW()
     WHERE tenant_id = $1`,
    [partnerId],
  );
}

/**
 * Calculate IAR commission amount based on partner tier and conversion type.
 *
 * Two conversion paths:
 * - freemium_to_paid: Prospect used the free IAR scan, then purchased AEGIS
 * - direct_sale: Partner sold AEGIS directly (IAR used as demo tool)
 *
 * @param partnerId - The partner's tenant ID
 * @param conversionType - The type of conversion
 * @returns Commission amount in dollars
 */
export async function calculateIarCommission(
  partnerId: string,
  conversionType: 'freemium_to_paid' | 'direct_sale',
): Promise<number> {
  const sql = getSql();

  // Look up partner tier
  const profileResult = await sql.unsafe(
    `SELECT partner_tier FROM partner_profiles WHERE tenant_id = $1`,
    [partnerId],
  );

  const profile = profileResult[0] as any;
  if (!profile) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  const tier = (profile.partner_tier ?? 'starter') as string;
  const rates = IAR_COMMISSION_RATES[tier] ?? IAR_COMMISSION_RATES.starter;

  return rates[conversionType];
}

// ─── Internal Helpers ────────────────────────────────────────────────────

/**
 * Generate a short, URL-safe attribution code from a partner ID.
 * Deterministic so the same partner always gets the same code.
 */
function generateAttributionCode(partnerId: string): string {
  // Use a simple hash of the partner ID to generate a 8-char code
  let hash = 0;
  for (let i = 0; i < partnerId.length; i++) {
    const char = partnerId.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }

  // Convert to base36 and ensure consistent length
  const code = Math.abs(hash).toString(36).padStart(8, '0').slice(0, 8);
  return `cvg-${code}`;
}
