const API = 'https://threat-triage.suryanshsinghrawat.workers.dev/api/analyze';

// Clicking the toolbar icon toggles the sidebar on the active tab
chrome.action.onClicked.addListener((tab) => {
  if (!tab.id) return;
  chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' }).catch(() => {
    // Content script not yet injected — inject it first then toggle
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content.js'],
    }).then(() => {
      chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_SIDEBAR' });
    }).catch(() => {});
  });
});

/**
 * Proxy API calls from content scripts.
 * Content scripts are subject to the host page's CSP (Gmail blocks outgoing
 * fetch). Background service workers are not — they use the extension's own
 * network context and host_permissions.
 */
chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg.type !== 'ANALYZE') return false;

  fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ emailText: msg.emailText }),
  })
    .then(async (res) => {
      const data = await res.json();
      sendResponse({ ok: res.ok, status: res.status, data });
    })
    .catch((err) => {
      sendResponse({ ok: false, status: 0, data: { error: err.message } });
    });

  return true; // keep message channel open for async sendResponse
});
