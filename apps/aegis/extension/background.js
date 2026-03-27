/**
 * CVG-AEGIS — Chrome Extension Service Worker (MV3)
 *
 * Responsibilities:
 * 1. Device enrollment (check storage → enroll if needed)
 * 2. URL visit reporting (batched HTTPS POST every 60 seconds)
 * 3. SaaS classification (categorize visited URLs)
 * 4. Policy cache refresh (every 15 minutes)
 * 5. declarativeNetRequest rule updates from policy
 */

// ─── Import SaaS Catalog ─────────────────────────────────────────────
importScripts('saas-catalog.js');

// ─── Configuration ────────────────────────────────────────────────────

const CONFIG = {
  apiBase: '', // Set during enrollment or via storage
  telemetryIntervalSeconds: 60,
  policyCacheMinutes: 15,
};

// ─── State ────────────────────────────────────────────────────────────

let visitBuffer = [];
let deviceId = null;
let tenantId = null;
let policies = [];

// ─── Initialization ───────────────────────────────────────────────────

chrome.runtime.onInstalled.addListener(async () => {
  console.log('[aegis] Extension installed');
  await initialize();
});

chrome.runtime.onStartup.addListener(async () => {
  console.log('[aegis] Extension started');
  await initialize();
});

async function initialize() {
  const stored = await chrome.storage.local.get([
    'aegis_device_id',
    'aegis_tenant_id',
    'aegis_api_base',
    'aegis_policies',
  ]);

  deviceId = stored.aegis_device_id || null;
  tenantId = stored.aegis_tenant_id || null;
  CONFIG.apiBase = stored.aegis_api_base || '';
  policies = stored.aegis_policies || [];

  if (!deviceId) {
    console.log('[aegis] No device_id found — awaiting enrollment');
    return;
  }

  console.log('[aegis] Device enrolled:', deviceId);
  startAlarms();
}

// ─── Enrollment ───────────────────────────────────────────────────────

async function enroll(enrollmentToken, apiBase) {
  try {
    CONFIG.apiBase = apiBase;

    const response = await fetch(`${apiBase}/api/v1/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: enrollmentToken,
        hostname: await getHostname(),
        os: navigator.platform,
        browser: 'Chrome',
        browserVersion: navigator.userAgent.match(/Chrome\/([\d.]+)/)?.[1] ?? 'unknown',
        extensionVersion: chrome.runtime.getManifest().version,
        userAgent: navigator.userAgent,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new Error(err.error || 'Enrollment failed');
    }

    const data = await response.json();

    deviceId = data.deviceId;
    tenantId = data.tenantId;
    policies = data.policies || [];

    await chrome.storage.local.set({
      aegis_device_id: deviceId,
      aegis_tenant_id: tenantId,
      aegis_api_base: apiBase,
      aegis_policies: policies,
      aegis_enrolled_at: new Date().toISOString(),
    });

    // Apply URL blocking rules from policies
    await applyPolicies(policies);

    console.log('[aegis] Enrollment successful:', deviceId);
    startAlarms();

    return { success: true, deviceId };
  } catch (err) {
    console.error('[aegis] Enrollment failed:', err);
    return { success: false, error: err.message };
  }
}

async function getHostname() {
  try {
    const info = await chrome.system?.cpu?.getInfo?.();
    return info?.modelName ?? 'Unknown';
  } catch {
    return 'Unknown';
  }
}

// ─── Alarms ───────────────────────────────────────────────────────────

function startAlarms() {
  // Telemetry flush every 60 seconds
  chrome.alarms.create('aegis_telemetry_flush', {
    periodInMinutes: CONFIG.telemetryIntervalSeconds / 60,
  });

  // Policy refresh every 15 minutes
  chrome.alarms.create('aegis_policy_refresh', {
    periodInMinutes: CONFIG.policyCacheMinutes,
  });
}

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'aegis_telemetry_flush') {
    await flushTelemetry();
  } else if (alarm.name === 'aegis_policy_refresh') {
    await refreshPolicies();
  }
});

// ─── URL Visit Tracking ──────────────────────────────────────────────

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!deviceId) return;
  if (changeInfo.status !== 'complete') return;
  if (!tab.url) return;

  // Skip chrome:// and extension pages
  if (tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) return;
  if (tab.url.startsWith('about:') || tab.url.startsWith('edge://')) return;

  try {
    const url = new URL(tab.url);
    const domain = url.hostname.replace(/^www\./, '');
    const saasMatch = typeof classifyDomain === 'function' ? classifyDomain(domain) : null;

    visitBuffer.push({
      type: 'url_visit',
      domain,
      url: `${url.protocol}//${url.hostname}${url.pathname}`,
      title: tab.title || '',
      saasApp: saasMatch?.name || null,
      saasCategory: saasMatch?.category || null,
      saasRisk: saasMatch?.risk || null,
      timestamp: new Date().toISOString(),
    });
  } catch {
    // Invalid URL — skip
  }
});

// ─── Telemetry Flush ──────────────────────────────────────────────────

async function flushTelemetry() {
  if (!deviceId || visitBuffer.length === 0) return;

  const events = [...visitBuffer];
  visitBuffer = [];

  try {
    const response = await fetch(`${CONFIG.apiBase}/api/v1/telemetry/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId, events }),
    });

    if (!response.ok) {
      console.warn('[aegis] Telemetry flush failed:', response.status);
      // Put events back in buffer for retry
      visitBuffer = [...events, ...visitBuffer];
    } else {
      const data = await response.json();
      console.log(`[aegis] Flushed ${data.accepted} events, ${data.classified} classified`);
    }
  } catch (err) {
    console.warn('[aegis] Telemetry flush error:', err);
    visitBuffer = [...events, ...visitBuffer];
  }
}

// ─── Policy Refresh ───────────────────────────────────────────────────

async function refreshPolicies() {
  if (!deviceId) return;

  try {
    const response = await fetch(`${CONFIG.apiBase}/api/v1/policies/device/${deviceId}`);

    if (!response.ok) {
      console.warn('[aegis] Policy refresh failed:', response.status);
      return;
    }

    const data = await response.json();
    policies = data.policies || [];

    await chrome.storage.local.set({ aegis_policies: policies });
    await applyPolicies(policies);

    console.log(`[aegis] Refreshed ${policies.length} policies`);
  } catch (err) {
    console.warn('[aegis] Policy refresh error:', err);
  }
}

// ─── Apply Policies via declarativeNetRequest ─────────────────────────

async function applyPolicies(policyList) {
  try {
    // Get existing dynamic rules
    const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
    const existingIds = existingRules.map(r => r.id);

    // Remove all existing dynamic rules
    if (existingIds.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existingIds,
      });
    }

    // Build new rules from url_block policies
    const newRules = [];
    let ruleId = 1;

    for (const policy of policyList) {
      if (policy.type !== 'url_block') continue;
      if (!Array.isArray(policy.rules)) continue;

      for (const rule of policy.rules) {
        if (!rule.pattern) continue;

        newRules.push({
          id: ruleId++,
          priority: policy.priority || 1,
          action: { type: 'block' },
          condition: {
            urlFilter: rule.pattern,
            resourceTypes: [
              'main_frame', 'sub_frame', 'stylesheet', 'script',
              'image', 'font', 'object', 'xmlhttprequest', 'ping',
              'media', 'websocket', 'other',
            ],
          },
        });
      }
    }

    if (newRules.length > 0) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        addRules: newRules,
      });
      console.log(`[aegis] Applied ${newRules.length} blocking rules`);
    }
  } catch (err) {
    console.error('[aegis] Failed to apply policies:', err);
  }
}

// ─── Message Handling (from popup) ────────────────────────────────────

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'AEGIS_ENROLL') {
    enroll(message.token, message.apiBase).then(sendResponse);
    return true; // async response
  }

  if (message.type === 'AEGIS_GET_STATUS') {
    sendResponse({
      enrolled: !!deviceId,
      deviceId,
      tenantId,
      bufferedEvents: visitBuffer.length,
      policyCount: policies.length,
    });
    return false;
  }

  if (message.type === 'AEGIS_FLUSH') {
    flushTelemetry().then(() => sendResponse({ ok: true }));
    return true;
  }

  // Content script metadata
  if (message.type === 'PAGE_METADATA') {
    if (!deviceId) return false;
    const saasMatch = typeof classifyDomain === 'function' ? classifyDomain(message.domain) : null;
    if (saasMatch) {
      visitBuffer.push({
        type: 'saas_detection',
        domain: message.domain,
        saasApp: saasMatch.name,
        saasCategory: saasMatch.category,
        saasRisk: saasMatch.risk,
        hasLoginForm: message.hasLoginForm,
        hasFileUpload: message.hasFileUpload,
        title: message.title,
        timestamp: message.timestamp,
      });
    }
    return false;
  }
});
