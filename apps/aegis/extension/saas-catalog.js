/**
 * AEGIS SaaS Application Catalog
 *
 * 200+ SaaS applications organized by category with risk classification.
 * Used by background.js to classify URL visits for shadow IT discovery.
 *
 * Risk levels:
 *   low    — Sanctioned business tools (Microsoft, Google workspace)
 *   medium — Could contain sensitive data (cloud storage, CRM)
 *   high   — Shadow IT risk (personal file sharing, unauthorized AI, personal email)
 */

// eslint-disable-next-line no-unused-vars
const SAAS_CATALOG = [
  // ─── Productivity ──────────────────────────────────────────────────
  { domain: "office.com", name: "Microsoft 365", category: "Productivity", risk: "low" },
  { domain: "microsoft365.com", name: "Microsoft 365", category: "Productivity", risk: "low" },
  { domain: "outlook.com", name: "Outlook", category: "Productivity", risk: "low" },
  { domain: "outlook.office.com", name: "Outlook Web", category: "Productivity", risk: "low" },
  { domain: "outlook.office365.com", name: "Outlook 365", category: "Productivity", risk: "low" },
  { domain: "teams.microsoft.com", name: "Microsoft Teams", category: "Communication", risk: "low" },
  { domain: "teams.live.com", name: "Microsoft Teams", category: "Communication", risk: "low" },
  { domain: "sharepoint.com", name: "SharePoint", category: "Storage", risk: "low" },
  { domain: "onedrive.live.com", name: "OneDrive", category: "Storage", risk: "low" },
  { domain: "docs.google.com", name: "Google Docs", category: "Productivity", risk: "low" },
  { domain: "sheets.google.com", name: "Google Sheets", category: "Productivity", risk: "low" },
  { domain: "slides.google.com", name: "Google Slides", category: "Productivity", risk: "low" },
  { domain: "drive.google.com", name: "Google Drive", category: "Storage", risk: "low" },
  { domain: "calendar.google.com", name: "Google Calendar", category: "Productivity", risk: "low" },
  { domain: "mail.google.com", name: "Gmail", category: "Communication", risk: "low" },
  { domain: "meet.google.com", name: "Google Meet", category: "Communication", risk: "low" },
  { domain: "admin.google.com", name: "Google Admin", category: "Productivity", risk: "low" },
  { domain: "notion.so", name: "Notion", category: "Productivity", risk: "medium" },
  { domain: "airtable.com", name: "Airtable", category: "Productivity", risk: "medium" },
  { domain: "monday.com", name: "Monday.com", category: "Project Management", risk: "medium" },
  { domain: "asana.com", name: "Asana", category: "Project Management", risk: "medium" },
  { domain: "clickup.com", name: "ClickUp", category: "Project Management", risk: "medium" },
  { domain: "basecamp.com", name: "Basecamp", category: "Project Management", risk: "medium" },
  { domain: "todoist.com", name: "Todoist", category: "Productivity", risk: "low" },
  { domain: "trello.com", name: "Trello", category: "Project Management", risk: "medium" },
  { domain: "smartsheet.com", name: "Smartsheet", category: "Project Management", risk: "medium" },
  { domain: "coda.io", name: "Coda", category: "Productivity", risk: "medium" },
  { domain: "evernote.com", name: "Evernote", category: "Productivity", risk: "medium" },

  // ─── Communication ─────────────────────────────────────────────────
  { domain: "slack.com", name: "Slack", category: "Communication", risk: "low" },
  { domain: "zoom.us", name: "Zoom", category: "Communication", risk: "low" },
  { domain: "webex.com", name: "Webex", category: "Communication", risk: "low" },
  { domain: "gotomeeting.com", name: "GoToMeeting", category: "Communication", risk: "low" },
  { domain: "ringcentral.com", name: "RingCentral", category: "Communication", risk: "low" },
  { domain: "8x8.com", name: "8x8", category: "Communication", risk: "low" },
  { domain: "dialpad.com", name: "Dialpad", category: "Communication", risk: "medium" },
  { domain: "discord.com", name: "Discord", category: "Communication", risk: "high" },
  { domain: "telegram.org", name: "Telegram", category: "Communication", risk: "high" },
  { domain: "web.telegram.org", name: "Telegram Web", category: "Communication", risk: "high" },
  { domain: "web.whatsapp.com", name: "WhatsApp Web", category: "Communication", risk: "high" },
  { domain: "signal.org", name: "Signal", category: "Communication", risk: "high" },
  { domain: "messenger.com", name: "Facebook Messenger", category: "Communication", risk: "high" },

  // ─── Cloud Storage ─────────────────────────────────────────────────
  { domain: "dropbox.com", name: "Dropbox", category: "Storage", risk: "medium" },
  { domain: "box.com", name: "Box", category: "Storage", risk: "medium" },
  { domain: "app.box.com", name: "Box", category: "Storage", risk: "medium" },
  { domain: "wetransfer.com", name: "WeTransfer", category: "Storage", risk: "high" },
  { domain: "mega.nz", name: "MEGA", category: "Storage", risk: "high" },
  { domain: "mediafire.com", name: "MediaFire", category: "Storage", risk: "high" },
  { domain: "sendgb.com", name: "SendGB", category: "Storage", risk: "high" },
  { domain: "file.io", name: "File.io", category: "Storage", risk: "high" },
  { domain: "send-anywhere.com", name: "Send Anywhere", category: "Storage", risk: "high" },
  { domain: "gofile.io", name: "GoFile", category: "Storage", risk: "high" },
  { domain: "icloud.com", name: "iCloud", category: "Storage", risk: "medium" },

  // ─── CRM / Sales ──────────────────────────────────────────────────
  { domain: "salesforce.com", name: "Salesforce", category: "CRM", risk: "low" },
  { domain: "lightning.force.com", name: "Salesforce Lightning", category: "CRM", risk: "low" },
  { domain: "hubspot.com", name: "HubSpot", category: "CRM", risk: "medium" },
  { domain: "app.hubspot.com", name: "HubSpot", category: "CRM", risk: "medium" },
  { domain: "zoho.com", name: "Zoho CRM", category: "CRM", risk: "medium" },
  { domain: "pipedrive.com", name: "Pipedrive", category: "CRM", risk: "medium" },
  { domain: "close.com", name: "Close CRM", category: "CRM", risk: "medium" },
  { domain: "freshsales.io", name: "Freshsales", category: "CRM", risk: "medium" },
  { domain: "copper.com", name: "Copper CRM", category: "CRM", risk: "medium" },
  { domain: "insightly.com", name: "Insightly", category: "CRM", risk: "medium" },

  // ─── Development ───────────────────────────────────────────────────
  { domain: "github.com", name: "GitHub", category: "Development", risk: "medium" },
  { domain: "gitlab.com", name: "GitLab", category: "Development", risk: "medium" },
  { domain: "bitbucket.org", name: "Bitbucket", category: "Development", risk: "medium" },
  { domain: "jira.atlassian.net", name: "Jira", category: "Development", risk: "low" },
  { domain: "atlassian.net", name: "Atlassian", category: "Development", risk: "low" },
  { domain: "confluence.atlassian.net", name: "Confluence", category: "Development", risk: "low" },
  { domain: "vercel.com", name: "Vercel", category: "Development", risk: "medium" },
  { domain: "netlify.com", name: "Netlify", category: "Development", risk: "medium" },
  { domain: "heroku.com", name: "Heroku", category: "Development", risk: "medium" },
  { domain: "railway.app", name: "Railway", category: "Development", risk: "medium" },
  { domain: "render.com", name: "Render", category: "Development", risk: "medium" },
  { domain: "replit.com", name: "Replit", category: "Development", risk: "high" },
  { domain: "codepen.io", name: "CodePen", category: "Development", risk: "medium" },
  { domain: "codesandbox.io", name: "CodeSandbox", category: "Development", risk: "medium" },
  { domain: "stackblitz.com", name: "StackBlitz", category: "Development", risk: "medium" },
  { domain: "stackoverflow.com", name: "Stack Overflow", category: "Development", risk: "low" },
  { domain: "npmjs.com", name: "npm", category: "Development", risk: "low" },
  { domain: "docker.com", name: "Docker Hub", category: "Development", risk: "medium" },
  { domain: "aws.amazon.com", name: "AWS Console", category: "Development", risk: "medium" },
  { domain: "console.cloud.google.com", name: "Google Cloud", category: "Development", risk: "medium" },
  { domain: "portal.azure.com", name: "Azure Portal", category: "Development", risk: "medium" },

  // ─── Finance / Accounting ──────────────────────────────────────────
  { domain: "quickbooks.intuit.com", name: "QuickBooks", category: "Finance", risk: "medium" },
  { domain: "qbo.intuit.com", name: "QuickBooks Online", category: "Finance", risk: "medium" },
  { domain: "xero.com", name: "Xero", category: "Finance", risk: "medium" },
  { domain: "stripe.com", name: "Stripe", category: "Finance", risk: "medium" },
  { domain: "dashboard.stripe.com", name: "Stripe Dashboard", category: "Finance", risk: "medium" },
  { domain: "wave.com", name: "Wave", category: "Finance", risk: "medium" },
  { domain: "freshbooks.com", name: "FreshBooks", category: "Finance", risk: "medium" },
  { domain: "expensify.com", name: "Expensify", category: "Finance", risk: "medium" },
  { domain: "brex.com", name: "Brex", category: "Finance", risk: "medium" },
  { domain: "ramp.com", name: "Ramp", category: "Finance", risk: "medium" },
  { domain: "bill.com", name: "Bill.com", category: "Finance", risk: "medium" },
  { domain: "paypal.com", name: "PayPal", category: "Finance", risk: "medium" },
  { domain: "venmo.com", name: "Venmo", category: "Finance", risk: "high" },

  // ─── HR / People ───────────────────────────────────────────────────
  { domain: "workday.com", name: "Workday", category: "HR", risk: "low" },
  { domain: "bamboohr.com", name: "BambooHR", category: "HR", risk: "low" },
  { domain: "gusto.com", name: "Gusto", category: "HR", risk: "medium" },
  { domain: "adp.com", name: "ADP", category: "HR", risk: "low" },
  { domain: "paychex.com", name: "Paychex", category: "HR", risk: "low" },
  { domain: "rippling.com", name: "Rippling", category: "HR", risk: "medium" },
  { domain: "deel.com", name: "Deel", category: "HR", risk: "medium" },
  { domain: "lattice.com", name: "Lattice", category: "HR", risk: "medium" },
  { domain: "namely.com", name: "Namely", category: "HR", risk: "medium" },

  // ─── Security ──────────────────────────────────────────────────────
  { domain: "lastpass.com", name: "LastPass", category: "Security", risk: "low" },
  { domain: "1password.com", name: "1Password", category: "Security", risk: "low" },
  { domain: "bitwarden.com", name: "Bitwarden", category: "Security", risk: "low" },
  { domain: "vault.bitwarden.com", name: "Bitwarden Vault", category: "Security", risk: "low" },
  { domain: "duo.com", name: "Duo Security", category: "Security", risk: "low" },
  { domain: "okta.com", name: "Okta", category: "Security", risk: "low" },
  { domain: "login.microsoftonline.com", name: "Entra ID", category: "Security", risk: "low" },
  { domain: "crowdstrike.com", name: "CrowdStrike", category: "Security", risk: "low" },
  { domain: "sentinelone.com", name: "SentinelOne", category: "Security", risk: "low" },
  { domain: "knowbe4.com", name: "KnowBe4", category: "Security", risk: "low" },
  { domain: "proofpoint.com", name: "Proofpoint", category: "Security", risk: "low" },
  { domain: "mimecast.com", name: "Mimecast", category: "Security", risk: "low" },
  { domain: "datto.com", name: "Datto", category: "Security", risk: "low" },
  { domain: "connectwise.com", name: "ConnectWise", category: "Security", risk: "low" },
  { domain: "ninjarmm.com", name: "NinjaOne", category: "Security", risk: "low" },
  { domain: "app.ninjarmm.com", name: "NinjaOne", category: "Security", risk: "low" },

  // ─── Design ────────────────────────────────────────────────────────
  { domain: "figma.com", name: "Figma", category: "Design", risk: "medium" },
  { domain: "canva.com", name: "Canva", category: "Design", risk: "medium" },
  { domain: "adobe.com", name: "Adobe", category: "Design", risk: "low" },
  { domain: "creativecloud.adobe.com", name: "Adobe CC", category: "Design", risk: "low" },
  { domain: "sketch.com", name: "Sketch", category: "Design", risk: "medium" },
  { domain: "invisionapp.com", name: "InVision", category: "Design", risk: "medium" },
  { domain: "miro.com", name: "Miro", category: "Design", risk: "medium" },
  { domain: "lucidchart.com", name: "Lucidchart", category: "Design", risk: "medium" },
  { domain: "whimsical.com", name: "Whimsical", category: "Design", risk: "medium" },

  // ─── AI Tools ──────────────────────────────────────────────────────
  { domain: "chat.openai.com", name: "ChatGPT", category: "AI", risk: "high" },
  { domain: "chatgpt.com", name: "ChatGPT", category: "AI", risk: "high" },
  { domain: "openai.com", name: "OpenAI", category: "AI", risk: "high" },
  { domain: "platform.openai.com", name: "OpenAI Platform", category: "AI", risk: "high" },
  { domain: "claude.ai", name: "Claude", category: "AI", risk: "high" },
  { domain: "anthropic.com", name: "Anthropic", category: "AI", risk: "high" },
  { domain: "gemini.google.com", name: "Gemini", category: "AI", risk: "high" },
  { domain: "bard.google.com", name: "Gemini (Bard)", category: "AI", risk: "high" },
  { domain: "copilot.microsoft.com", name: "Microsoft Copilot", category: "AI", risk: "medium" },
  { domain: "midjourney.com", name: "Midjourney", category: "AI", risk: "high" },
  { domain: "perplexity.ai", name: "Perplexity", category: "AI", risk: "high" },
  { domain: "poe.com", name: "Poe", category: "AI", risk: "high" },
  { domain: "character.ai", name: "Character.AI", category: "AI", risk: "high" },
  { domain: "huggingface.co", name: "Hugging Face", category: "AI", risk: "high" },
  { domain: "stability.ai", name: "Stability AI", category: "AI", risk: "high" },
  { domain: "runwayml.com", name: "Runway", category: "AI", risk: "high" },
  { domain: "deepl.com", name: "DeepL", category: "AI", risk: "medium" },
  { domain: "grammarly.com", name: "Grammarly", category: "AI", risk: "medium" },
  { domain: "jasper.ai", name: "Jasper AI", category: "AI", risk: "high" },
  { domain: "writesonic.com", name: "Writesonic", category: "AI", risk: "high" },
  { domain: "copy.ai", name: "Copy.ai", category: "AI", risk: "high" },
  { domain: "phind.com", name: "Phind", category: "AI", risk: "high" },
  { domain: "you.com", name: "You.com", category: "AI", risk: "high" },

  // ─── Marketing ─────────────────────────────────────────────────────
  { domain: "mailchimp.com", name: "Mailchimp", category: "Marketing", risk: "medium" },
  { domain: "constantcontact.com", name: "Constant Contact", category: "Marketing", risk: "medium" },
  { domain: "sendgrid.com", name: "SendGrid", category: "Marketing", risk: "medium" },
  { domain: "hootsuite.com", name: "Hootsuite", category: "Marketing", risk: "medium" },
  { domain: "buffer.com", name: "Buffer", category: "Marketing", risk: "medium" },
  { domain: "semrush.com", name: "SEMrush", category: "Marketing", risk: "medium" },
  { domain: "ahrefs.com", name: "Ahrefs", category: "Marketing", risk: "medium" },
  { domain: "marketo.com", name: "Marketo", category: "Marketing", risk: "medium" },
  { domain: "pardot.com", name: "Pardot", category: "Marketing", risk: "medium" },
  { domain: "activecampaign.com", name: "ActiveCampaign", category: "Marketing", risk: "medium" },

  // ─── Analytics / Observability ─────────────────────────────────────
  { domain: "analytics.google.com", name: "Google Analytics", category: "Analytics", risk: "low" },
  { domain: "mixpanel.com", name: "Mixpanel", category: "Analytics", risk: "medium" },
  { domain: "amplitude.com", name: "Amplitude", category: "Analytics", risk: "medium" },
  { domain: "hotjar.com", name: "Hotjar", category: "Analytics", risk: "medium" },
  { domain: "datadog.com", name: "Datadog", category: "Analytics", risk: "medium" },
  { domain: "app.datadoghq.com", name: "Datadog", category: "Analytics", risk: "medium" },
  { domain: "newrelic.com", name: "New Relic", category: "Analytics", risk: "medium" },
  { domain: "sentry.io", name: "Sentry", category: "Analytics", risk: "medium" },
  { domain: "logrocket.com", name: "LogRocket", category: "Analytics", risk: "medium" },
  { domain: "fullstory.com", name: "FullStory", category: "Analytics", risk: "medium" },
  { domain: "heap.io", name: "Heap", category: "Analytics", risk: "medium" },
  { domain: "posthog.com", name: "PostHog", category: "Analytics", risk: "medium" },
  { domain: "plausible.io", name: "Plausible", category: "Analytics", risk: "low" },

  // ─── Support / Helpdesk ────────────────────────────────────────────
  { domain: "zendesk.com", name: "Zendesk", category: "Support", risk: "low" },
  { domain: "freshdesk.com", name: "Freshdesk", category: "Support", risk: "low" },
  { domain: "intercom.com", name: "Intercom", category: "Support", risk: "medium" },
  { domain: "helpscout.com", name: "Help Scout", category: "Support", risk: "medium" },
  { domain: "servicenow.com", name: "ServiceNow", category: "Support", risk: "low" },
  { domain: "kayako.com", name: "Kayako", category: "Support", risk: "medium" },

  // ─── MSP / IT Management ──────────────────────────────────────────
  { domain: "itglue.com", name: "IT Glue", category: "IT Management", risk: "low" },
  { domain: "hudu.com", name: "Hudu", category: "IT Management", risk: "low" },
  { domain: "halopsa.com", name: "HaloPSA", category: "IT Management", risk: "low" },
  { domain: "atera.com", name: "Atera", category: "IT Management", risk: "low" },
  { domain: "syncromsp.com", name: "Syncro", category: "IT Management", risk: "low" },
  { domain: "home.connectwise.com", name: "ConnectWise Home", category: "IT Management", risk: "low" },
  { domain: "screenconnect.com", name: "ConnectWise Control", category: "IT Management", risk: "low" },
  { domain: "manage.cw.com", name: "ConnectWise Manage", category: "IT Management", risk: "low" },

  // ─── Healthcare / Compliance ───────────────────────────────────────
  { domain: "athenahealth.com", name: "athenahealth", category: "Healthcare", risk: "medium" },
  { domain: "kareo.com", name: "Kareo", category: "Healthcare", risk: "medium" },
  { domain: "practicefusion.com", name: "Practice Fusion", category: "Healthcare", risk: "medium" },
  { domain: "drchrono.com", name: "DrChrono", category: "Healthcare", risk: "medium" },
  { domain: "eclinicalworks.com", name: "eClinicalWorks", category: "Healthcare", risk: "medium" },

  // ─── Social Media (Shadow IT) ──────────────────────────────────────
  { domain: "facebook.com", name: "Facebook", category: "Social Media", risk: "high" },
  { domain: "twitter.com", name: "Twitter/X", category: "Social Media", risk: "high" },
  { domain: "x.com", name: "X (Twitter)", category: "Social Media", risk: "high" },
  { domain: "instagram.com", name: "Instagram", category: "Social Media", risk: "high" },
  { domain: "linkedin.com", name: "LinkedIn", category: "Social Media", risk: "medium" },
  { domain: "reddit.com", name: "Reddit", category: "Social Media", risk: "high" },
  { domain: "tiktok.com", name: "TikTok", category: "Social Media", risk: "high" },
  { domain: "youtube.com", name: "YouTube", category: "Social Media", risk: "medium" },
  { domain: "pinterest.com", name: "Pinterest", category: "Social Media", risk: "high" },
  { domain: "snapchat.com", name: "Snapchat", category: "Social Media", risk: "high" },

  // ─── Personal Email (Shadow IT) ────────────────────────────────────
  { domain: "mail.yahoo.com", name: "Yahoo Mail", category: "Personal Email", risk: "high" },
  { domain: "outlook.live.com", name: "Outlook Personal", category: "Personal Email", risk: "high" },
  { domain: "protonmail.com", name: "ProtonMail", category: "Personal Email", risk: "high" },
  { domain: "mail.proton.me", name: "Proton Mail", category: "Personal Email", risk: "high" },
  { domain: "tutanota.com", name: "Tutanota", category: "Personal Email", risk: "high" },
  { domain: "aol.com", name: "AOL Mail", category: "Personal Email", risk: "high" },
  { domain: "zoho.com/mail", name: "Zoho Mail", category: "Personal Email", risk: "high" },

  // ─── E-Commerce / Shopping (Shadow IT) ─────────────────────────────
  { domain: "amazon.com", name: "Amazon", category: "Shopping", risk: "high" },
  { domain: "ebay.com", name: "eBay", category: "Shopping", risk: "high" },
  { domain: "etsy.com", name: "Etsy", category: "Shopping", risk: "high" },

  // ─── Streaming (Shadow IT) ─────────────────────────────────────────
  { domain: "netflix.com", name: "Netflix", category: "Streaming", risk: "high" },
  { domain: "hulu.com", name: "Hulu", category: "Streaming", risk: "high" },
  { domain: "disneyplus.com", name: "Disney+", category: "Streaming", risk: "high" },
  { domain: "twitch.tv", name: "Twitch", category: "Streaming", risk: "high" },
  { domain: "spotify.com", name: "Spotify", category: "Streaming", risk: "high" },

  // ─── Pastebin / Code Sharing (Data Exfiltration Risk) ──────────────
  { domain: "pastebin.com", name: "Pastebin", category: "Code Sharing", risk: "high" },
  { domain: "paste.ee", name: "Paste.ee", category: "Code Sharing", risk: "high" },
  { domain: "hastebin.com", name: "Hastebin", category: "Code Sharing", risk: "high" },
  { domain: "gist.github.com", name: "GitHub Gist", category: "Code Sharing", risk: "medium" },
  { domain: "jsfiddle.net", name: "JSFiddle", category: "Code Sharing", risk: "medium" },
];

/**
 * Look up a domain in the SaaS catalog.
 * Matches exact domain or parent domain (e.g., "app.slack.com" matches "slack.com").
 */
function classifyDomain(domain) {
  if (!domain) return null;

  const normalized = domain.toLowerCase().replace(/^www\./, "");

  // Exact match first
  const exact = SAAS_CATALOG.find((e) => e.domain === normalized);
  if (exact) return exact;

  // Parent domain match (e.g., "app.slack.com" → "slack.com")
  const parts = normalized.split(".");
  for (let i = 1; i < parts.length - 1; i++) {
    const parent = parts.slice(i).join(".");
    const match = SAAS_CATALOG.find((e) => e.domain === parent);
    if (match) return match;
  }

  return null;
}

// Make available to background.js in MV3 service worker context
if (typeof globalThis !== "undefined") {
  globalThis.SAAS_CATALOG = SAAS_CATALOG;
  globalThis.classifyDomain = classifyDomain;
}
