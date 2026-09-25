// Service worker for YouTube CMS Auto-Filter & Presets Extension

const DEFAULT_PRESETS = [
  {
    id: 'default-unclaimed',
    name: 'Default Unclaimed (Views DESC)',
    filter: [
      { name: 'ALLOWLISTED', value: 'FALSE' },
      { name: 'CLAIM_STATUS', value: 'VIDEO_CLAIM_STATUS_NOT_CLAIMED_BY_OWNER' },
      { name: 'CLAIMABLE', value: ['VIDEO_CLAIMABILITY_CAN_CLAIM'] },
      { name: 'SHORTS', value: 'FALSE' }
    ],
    sort: {
      columnType: 'totalViews',
      sortOrder: 'DESCENDING'
    }
  }
];

// Initialize default storage on install
chrome.runtime.onInstalled.addListener(async () => {
  const existing = await chrome.storage.sync.get(['autoApply', 'activePresetId', 'presets']);

  const updates = {};
  if (existing.autoApply === undefined) {
    updates.autoApply = true;
  }
  if (!existing.presets || existing.presets.length === 0) {
    updates.presets = DEFAULT_PRESETS;
  }
  if (!existing.activePresetId) {
    updates.activePresetId = 'default-unclaimed';
  }

  if (Object.keys(updates).length > 0) {
    await chrome.storage.sync.set(updates);
  }
});

// Listen for messages from popup or content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  (async () => {
    try {
      if (message.type === 'APPLY_PRESET_TO_TAB') {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab && tab.url && tab.url.includes('studio.youtube.com')) {
          const newUrl = buildUrlWithPreset(tab.url, message.preset);
          await chrome.tabs.update(tab.id, { url: newUrl });
          sendResponse({ success: true, url: newUrl });
        } else {
          sendResponse({ success: false, error: 'Current tab is not YouTube Studio.' });
        }
      } else if (message.type === 'GET_ACTIVE_PRESET') {
        const data = await chrome.storage.sync.get(['autoApply', 'activePresetId', 'presets']);
        const presets = data.presets || DEFAULT_PRESETS;
        const active = presets.find(p => p.id === data.activePresetId) || presets[0];
        sendResponse({
          autoApply: data.autoApply ?? true,
          preset: active,
          allPresets: presets
        });
      }
    } catch (err) {
      sendResponse({ success: false, error: err.message });
    }
  })();
  return true; // Keep message channel open for async response
});

// Helper to construct YouTube CMS URL with filter and sort parameters while preserving active search parameters
function buildUrlWithPreset(currentUrlStr, preset) {
  const url = new URL(currentUrlStr);
  let existingFilter = [];
  const existingFilterStr = url.searchParams.get('filter');

  if (existingFilterStr) {
    try {
      existingFilter = JSON.parse(existingFilterStr);
    } catch (e) {
      existingFilter = [];
    }
  }

  // Start merged filter with preset rules
  const mergedFilter = [...preset.filter];

  // Preserve rules from existing URL (e.g. KEYWORD) that are NOT explicitly overridden by preset
  if (Array.isArray(existingFilter)) {
    existingFilter.forEach(existingRule => {
      if (existingRule && existingRule.name) {
        const isOverridden = mergedFilter.some(r => r.name === existingRule.name);
        if (!isOverridden) {
          mergedFilter.push(existingRule);
        }
      }
    });
  }

  url.searchParams.set('filter', JSON.stringify(mergedFilter));
  url.searchParams.set('sort', JSON.stringify(preset.sort));
  return url.toString();
}
