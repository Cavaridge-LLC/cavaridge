/**
 * AEGIS Content Script — Page Metadata Extraction
 *
 * Runs once per page load on all URLs. Extracts minimal metadata
 * and sends to background service worker for SaaS classification.
 *
 * Minimal footprint — no DOM mutation, no persistent listeners.
 */

(function () {
  "use strict";

  // Only run on HTTP(S) pages
  if (!location.protocol.startsWith("http")) return;

  const metadata = {
    type: "PAGE_METADATA",
    url: location.href,
    domain: location.hostname.replace(/^www\./, ""),
    title: document.title || "",
    favicon: getFavicon(),
    metaDescription: getMetaContent("description"),
    metaGenerator: getMetaContent("generator"),
    hasLoginForm: detectLoginForm(),
    hasFileUpload: !!document.querySelector('input[type="file"]'),
    timestamp: new Date().toISOString(),
  };

  // Send to background
  chrome.runtime.sendMessage(metadata).catch(() => {
    // Extension context invalidated — ignore
  });

  function getFavicon() {
    const link =
      document.querySelector('link[rel="icon"]') ||
      document.querySelector('link[rel="shortcut icon"]');
    if (link) return link.href;
    return `${location.origin}/favicon.ico`;
  }

  function getMetaContent(name) {
    const meta = document.querySelector(`meta[name="${name}"]`);
    return meta ? meta.content || "" : "";
  }

  function detectLoginForm() {
    const passwordInputs = document.querySelectorAll('input[type="password"]');
    return passwordInputs.length > 0;
  }
})();
