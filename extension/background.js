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
