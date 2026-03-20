/**
 * CVG-AEGIS — SaaS Application Catalog
 *
 * Known SaaS applications with domain matching patterns.
 * Used for URL visit classification and Shadow IT detection.
 */

export interface SaasEntry {
  name: string;
  domains: string[];
  category: string;
  vendor: string;
  riskScore: number;
}

/**
 * Built-in SaaS catalog for Phase 1.
 * In Phase 2+, this moves to the saas_catalog DB table with admin CRUD.
 */
export const SAAS_CATALOG: SaasEntry[] = [
  // ─── Collaboration ──────────────────────────────────────────────────
  { name: 'Slack', domains: ['slack.com', 'app.slack.com'], category: 'collaboration', vendor: 'Salesforce', riskScore: 20 },
  { name: 'Microsoft Teams', domains: ['teams.microsoft.com', 'teams.live.com'], category: 'collaboration', vendor: 'Microsoft', riskScore: 10 },
  { name: 'Zoom', domains: ['zoom.us', 'zoom.com'], category: 'collaboration', vendor: 'Zoom', riskScore: 25 },
  { name: 'Google Meet', domains: ['meet.google.com'], category: 'collaboration', vendor: 'Google', riskScore: 15 },
  { name: 'Discord', domains: ['discord.com', 'discord.gg'], category: 'collaboration', vendor: 'Discord', riskScore: 55 },

  // ─── Productivity ───────────────────────────────────────────────────
  { name: 'Google Workspace', domains: ['docs.google.com', 'sheets.google.com', 'slides.google.com', 'drive.google.com'], category: 'productivity', vendor: 'Google', riskScore: 15 },
  { name: 'Microsoft 365', domains: ['office.com', 'outlook.office.com', 'outlook.live.com', 'onedrive.live.com', 'sharepoint.com'], category: 'productivity', vendor: 'Microsoft', riskScore: 10 },
  { name: 'Notion', domains: ['notion.so', 'notion.site'], category: 'productivity', vendor: 'Notion', riskScore: 25 },
  { name: 'Airtable', domains: ['airtable.com'], category: 'productivity', vendor: 'Airtable', riskScore: 30 },
  { name: 'Monday.com', domains: ['monday.com'], category: 'productivity', vendor: 'Monday.com', riskScore: 25 },

  // ─── CRM ────────────────────────────────────────────────────────────
  { name: 'Salesforce', domains: ['salesforce.com', 'force.com', 'lightning.force.com'], category: 'crm', vendor: 'Salesforce', riskScore: 15 },
  { name: 'HubSpot', domains: ['hubspot.com', 'app.hubspot.com'], category: 'crm', vendor: 'HubSpot', riskScore: 20 },

  // ─── DevTools ───────────────────────────────────────────────────────
  { name: 'GitHub', domains: ['github.com', 'github.dev'], category: 'devtools', vendor: 'Microsoft', riskScore: 20 },
  { name: 'GitLab', domains: ['gitlab.com'], category: 'devtools', vendor: 'GitLab', riskScore: 25 },
  { name: 'Jira', domains: ['atlassian.net', 'jira.com'], category: 'devtools', vendor: 'Atlassian', riskScore: 20 },
  { name: 'Vercel', domains: ['vercel.com', 'vercel.app'], category: 'devtools', vendor: 'Vercel', riskScore: 25 },

  // ─── Cloud Infrastructure ──────────────────────────────────────────
  { name: 'AWS Console', domains: ['console.aws.amazon.com', 'aws.amazon.com'], category: 'cloud', vendor: 'Amazon', riskScore: 15 },
  { name: 'Azure Portal', domains: ['portal.azure.com', 'azure.microsoft.com'], category: 'cloud', vendor: 'Microsoft', riskScore: 15 },
  { name: 'Google Cloud', domains: ['console.cloud.google.com', 'cloud.google.com'], category: 'cloud', vendor: 'Google', riskScore: 15 },

  // ─── Finance ────────────────────────────────────────────────────────
  { name: 'QuickBooks', domains: ['quickbooks.intuit.com', 'qbo.intuit.com'], category: 'finance', vendor: 'Intuit', riskScore: 20 },
  { name: 'Xero', domains: ['xero.com', 'go.xero.com'], category: 'finance', vendor: 'Xero', riskScore: 25 },
  { name: 'Stripe', domains: ['dashboard.stripe.com', 'stripe.com'], category: 'finance', vendor: 'Stripe', riskScore: 20 },

  // ─── MSP Tools ──────────────────────────────────────────────────────
  { name: 'NinjaOne', domains: ['app.ninjarmm.com', 'ninjaone.com'], category: 'msp', vendor: 'NinjaOne', riskScore: 15 },
  { name: 'ConnectWise', domains: ['connectwise.com', 'screenconnect.com'], category: 'msp', vendor: 'ConnectWise', riskScore: 20 },
  { name: 'HaloPSA', domains: ['halopsa.com'], category: 'msp', vendor: 'HaloPSA', riskScore: 20 },
  { name: 'Datto', domains: ['datto.com', 'dattobackup.com'], category: 'msp', vendor: 'Kaseya', riskScore: 20 },
  { name: 'IT Glue', domains: ['itglue.com'], category: 'msp', vendor: 'Kaseya', riskScore: 20 },

  // ─── Security ───────────────────────────────────────────────────────
  { name: 'SentinelOne', domains: ['sentinelone.net', 'sentinelone.com'], category: 'security', vendor: 'SentinelOne', riskScore: 10 },
  { name: 'CrowdStrike', domains: ['falcon.crowdstrike.com', 'crowdstrike.com'], category: 'security', vendor: 'CrowdStrike', riskScore: 10 },
  { name: 'Duo Security', domains: ['duosecurity.com', 'duo.com'], category: 'security', vendor: 'Cisco', riskScore: 10 },

  // ─── Storage / File Sharing ─────────────────────────────────────────
  { name: 'Dropbox', domains: ['dropbox.com', 'dropboxusercontent.com'], category: 'storage', vendor: 'Dropbox', riskScore: 35 },
  { name: 'Box', domains: ['box.com', 'app.box.com'], category: 'storage', vendor: 'Box', riskScore: 25 },
  { name: 'WeTransfer', domains: ['wetransfer.com'], category: 'storage', vendor: 'WeTransfer', riskScore: 60 },

  // ─── Social / Marketing ─────────────────────────────────────────────
  { name: 'LinkedIn', domains: ['linkedin.com'], category: 'social', vendor: 'Microsoft', riskScore: 30 },
  { name: 'Twitter/X', domains: ['twitter.com', 'x.com'], category: 'social', vendor: 'X Corp', riskScore: 40 },
  { name: 'Facebook', domains: ['facebook.com', 'fb.com'], category: 'social', vendor: 'Meta', riskScore: 45 },
  { name: 'Mailchimp', domains: ['mailchimp.com'], category: 'marketing', vendor: 'Intuit', riskScore: 25 },

  // ─── AI Tools ───────────────────────────────────────────────────────
  { name: 'ChatGPT', domains: ['chat.openai.com', 'chatgpt.com'], category: 'ai', vendor: 'OpenAI', riskScore: 55 },
  { name: 'Claude', domains: ['claude.ai'], category: 'ai', vendor: 'Anthropic', riskScore: 45 },
  { name: 'Gemini', domains: ['gemini.google.com'], category: 'ai', vendor: 'Google', riskScore: 45 },
  { name: 'Perplexity', domains: ['perplexity.ai'], category: 'ai', vendor: 'Perplexity', riskScore: 50 },

  // ─── HR ─────────────────────────────────────────────────────────────
  { name: 'BambooHR', domains: ['bamboohr.com'], category: 'hr', vendor: 'BambooHR', riskScore: 25 },
  { name: 'Gusto', domains: ['gusto.com'], category: 'hr', vendor: 'Gusto', riskScore: 25 },

  // ─── Healthcare ─────────────────────────────────────────────────────
  { name: 'athenahealth', domains: ['athenahealth.com', 'athenanet.athenahealth.com'], category: 'healthcare', vendor: 'athenahealth', riskScore: 15 },
  { name: 'Epic MyChart', domains: ['mychart.com'], category: 'healthcare', vendor: 'Epic', riskScore: 15 },
];

/**
 * Match a visited domain against the SaaS catalog.
 * Returns the matched entry or null.
 */
export function classifyDomain(domain: string): SaasEntry | null {
  const normalized = domain.toLowerCase().replace(/^www\./, '');

  for (const entry of SAAS_CATALOG) {
    for (const pattern of entry.domains) {
      // Exact match
      if (normalized === pattern) return entry;
      // Subdomain match (e.g., 'app.slack.com' matches 'slack.com')
      if (normalized.endsWith('.' + pattern)) return entry;
    }
  }

  return null;
}

/**
 * Get all unique categories in the catalog.
 */
export function getCategories(): string[] {
  return [...new Set(SAAS_CATALOG.map(e => e.category))].sort();
}
