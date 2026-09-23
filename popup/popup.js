// Popup Script for YouTube CMS Auto-Filter & Linkifier Extension

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements
  const autoApplyToggle = document.getElementById('auto-apply-toggle');
  const linkifyToggle = document.getElementById('linkify-toggle');
  const presetSelect = document.getElementById('preset-select');
  const btnNewPreset = document.getElementById('btn-new-preset');
  const btnApplyTab = document.getElementById('btn-apply-tab');
  const btnOpenCms = document.getElementById('btn-open-cms');
  const filterSummary = document.getElementById('filter-summary');
  const btnToggleJson = document.getElementById('btn-toggle-json');
  const jsonContainer = document.getElementById('json-editor-container');
  const jsonFilterInput = document.getElementById('json-filter-input');
  const jsonSortInput = document.getElementById('json-sort-input');
  const btnSaveJson = document.getElementById('btn-save-json');
  const btnCancelJson = document.getElementById('btn-cancel-json');
  const statusMessage = document.getElementById('status-message');

  let currentData = {
    autoApply: true,
    linkifyEnabled: true,
    activePresetId: 'default-unclaimed',
    presets: []
  };

  // Load initial settings from chrome.storage.sync
  await loadState();

  // Event Listeners
  autoApplyToggle.addEventListener('change', async () => {
    currentData.autoApply = autoApplyToggle.checked;
    await chrome.storage.sync.set({ autoApply: currentData.autoApply });
    showStatus('Auto-Apply setting updated');
  });

  linkifyToggle.addEventListener('change', async () => {
    currentData.linkifyEnabled = linkifyToggle.checked;
    await chrome.storage.sync.set({ linkifyEnabled: currentData.linkifyEnabled });
    showStatus('Video ID Linkifier setting updated');
  });

  presetSelect.addEventListener('change', async () => {
    currentData.activePresetId = presetSelect.value;
    await chrome.storage.sync.set({ activePresetId: currentData.activePresetId });
    renderActivePresetDetails();
    showStatus('Switched preset');
  });

  btnNewPreset.addEventListener('click', async () => {
    const name = prompt('Enter a name for the new filter preset:', 'New Preset');
    if (!name) return;

    const activePreset = getActivePreset();
    const newPreset = {
      id: 'preset_' + Date.now(),
      name: name.trim(),
      filter: JSON.parse(JSON.stringify(activePreset.filter)),
      sort: JSON.parse(JSON.stringify(activePreset.sort))
    };

    currentData.presets.push(newPreset);
    currentData.activePresetId = newPreset.id;

    await chrome.storage.sync.set({
      presets: currentData.presets,
      activePresetId: currentData.activePresetId
    });

    renderPresetsDropdown();
    renderActivePresetDetails();
    showStatus(`Created preset: ${name}`);
  });

  btnApplyTab.addEventListener('click', async () => {
    const activePreset = getActivePreset();
    if (!activePreset) return;

    chrome.runtime.sendMessage(
      { type: 'APPLY_PRESET_TO_TAB', preset: activePreset },
      (response) => {
        if (response && response.success) {
          showStatus('Applied preset to tab!');
        } else {
          showStatus(response?.error || 'Failed to update current tab.', true);
        }
      }
    );
  });

  btnOpenCms.addEventListener('click', async () => {
    const activePreset = getActivePreset();
    const sampleUrl = 'https://studio.youtube.com/owner/CMS_ID/claims/manual';
    const url = new URL(sampleUrl);
    url.searchParams.set('filter', JSON.stringify(activePreset.filter));
    url.searchParams.set('sort', JSON.stringify(activePreset.sort));

    await chrome.tabs.create({ url: url.toString() });
  });

  btnToggleJson.addEventListener('click', () => {
    jsonContainer.classList.toggle('hidden');
    if (!jsonContainer.classList.contains('hidden')) {
      const activePreset = getActivePreset();
      jsonFilterInput.value = JSON.stringify(activePreset.filter, null, 2);
      jsonSortInput.value = JSON.stringify(activePreset.sort, null, 2);
    }
  });

  btnCancelJson.addEventListener('click', () => {
    jsonContainer.classList.add('hidden');
  });

  btnSaveJson.addEventListener('click', async () => {
    try {
      const newFilter = JSON.parse(jsonFilterInput.value);
      const newSort = JSON.parse(jsonSortInput.value);

      const activePreset = getActivePreset();
      activePreset.filter = newFilter;
      activePreset.sort = newSort;

      await chrome.storage.sync.set({ presets: currentData.presets });

      jsonContainer.classList.add('hidden');
      renderActivePresetDetails();
      showStatus('Preset JSON saved successfully');
    } catch (err) {
      showStatus('Invalid JSON syntax: ' + err.message, true);
    }
  });

  // Functions
  async function loadState() {
    const data = await chrome.storage.sync.get(['autoApply', 'linkifyEnabled', 'activePresetId', 'presets']);
    currentData.autoApply = data.autoApply ?? true;
    currentData.linkifyEnabled = data.linkifyEnabled ?? true;
    currentData.presets = data.presets || [];
    currentData.activePresetId = data.activePresetId || (currentData.presets[0]?.id);

    autoApplyToggle.checked = currentData.autoApply;
    linkifyToggle.checked = currentData.linkifyEnabled;
    renderPresetsDropdown();
    renderActivePresetDetails();
  }

  function renderPresetsDropdown() {
    presetSelect.innerHTML = '';
    currentData.presets.forEach(preset => {
      const opt = document.createElement('option');
      opt.value = preset.id;
      opt.textContent = preset.name;
      if (preset.id === currentData.activePresetId) {
        opt.selected = true;
      }
      presetSelect.appendChild(opt);
    });
  }

  function getActivePreset() {
    return currentData.presets.find(p => p.id === currentData.activePresetId) || currentData.presets[0];
  }

  function renderActivePresetDetails() {
    const activePreset = getActivePreset();
    if (!activePreset) return;

    filterSummary.innerHTML = '';

    // Render filter summary items
    activePreset.filter.forEach(rule => {
      const row = document.createElement('div');
      row.className = 'summary-item';

      const valText = Array.isArray(rule.value) ? rule.value.join(', ') : rule.value;
      row.innerHTML = `
        <span class="item-key">${rule.name}</span>
        <span class="item-val">${valText}</span>
      `;
      filterSummary.appendChild(row);
    });

    // Render sort summary item
    if (activePreset.sort) {
      const sortRow = document.createElement('div');
      sortRow.className = 'summary-item';
      sortRow.innerHTML = `
        <span class="item-key">SORT BY</span>
        <span class="item-val">${activePreset.sort.columnType} (${activePreset.sort.sortOrder})</span>
      `;
      filterSummary.appendChild(sortRow);
    }
  }

  function showStatus(msg, isError = false) {
    statusMessage.textContent = msg;
    statusMessage.className = `status-msg ${isError ? 'error' : ''}`;
    setTimeout(() => {
      if (statusMessage.textContent === msg) {
        statusMessage.textContent = '';
      }
    }, 3000);
  }
});
