// Content Script for YouTube CMS Auto-Filter Extension

(function () {
  'use strict';

  let lastUrl = location.href;
  let isRedirecting = false;

  // Check and auto-apply filters when on YouTube Studio Manual Claims
  async function checkAndApplyFilter() {
    if (isRedirecting) return;

    // Check if we are on the Manual Claims page
    if (!location.pathname.includes('/claims/manual')) return;

    const data = await chrome.storage.sync.get(['autoApply', 'activePresetId', 'presets']);
    if (data.autoApply === false) return;

    const presets = data.presets || [];
    const activePreset = presets.find(p => p.id === data.activePresetId) || presets[0];

    if (!activePreset) return;

    const urlParams = new URLSearchParams(location.search);
    const hasFilter = urlParams.has('filter');
    const hasSort = urlParams.has('sort');

    // If filter or sort is missing from the query string, auto-apply default filter preset
    if (!hasFilter || !hasSort) {
      isRedirecting = true;
      const currentUrl = new URL(location.href);

      if (!hasFilter) {
        currentUrl.searchParams.set('filter', JSON.stringify(activePreset.filter));
      }
      if (!hasSort) {
        currentUrl.searchParams.set('sort', JSON.stringify(activePreset.sort));
      }

      console.log('[YouTube CMS Auto-Filter] Applying preset filters:', activePreset.name);
      location.replace(currentUrl.toString());
    } else {
      // Injects floating UI toolbar if not already present
      renderFloatingPresetBar(activePreset, presets);
    }
  }

  // Inject Floating Quick-Apply Preset Toolbar into YouTube Studio
  function renderFloatingPresetBar(activePreset, presets) {
    let existingBar = document.getElementById('yt-cms-filter-toolbar');
    if (existingBar) {
      updateToolbarState(existingBar, activePreset, presets);
      return;
    }

    const toolbar = document.createElement('div');
    toolbar.id = 'yt-cms-filter-toolbar';
    toolbar.className = 'yt-cms-filter-bar';

    toolbar.innerHTML = `
      <div class="yt-cms-bar-header">
        <span class="yt-cms-bar-title">⚡ CMS Filters</span>
        <button class="yt-cms-bar-toggle" id="yt-cms-toggle-btn" title="Toggle Panel">—</button>
      </div>
      <div class="yt-cms-bar-body" id="yt-cms-bar-body">
        <div class="yt-cms-bar-label">Preset:</div>
        <div class="yt-cms-pills-container" id="yt-cms-pills"></div>
      </div>
    `;

    document.body.appendChild(toolbar);

    document.getElementById('yt-cms-toggle-btn').addEventListener('click', () => {
      const body = document.getElementById('yt-cms-bar-body');
      body.classList.toggle('hidden');
    });

    updateToolbarState(toolbar, activePreset, presets);
  }

  function updateToolbarState(toolbar, activePreset, presets) {
    const pillsContainer = toolbar.querySelector('#yt-cms-pills');
    if (!pillsContainer) return;

    pillsContainer.innerHTML = '';

    presets.forEach(preset => {
      const pill = document.createElement('button');
      const isActive = preset.id === activePreset.id;
      pill.className = `yt-cms-pill ${isActive ? 'active' : ''}`;
      pill.textContent = preset.name;

      pill.addEventListener('click', async () => {
        // Save as active preset
        await chrome.storage.sync.set({ activePresetId: preset.id });

        // Apply new preset to current URL
        const url = new URL(location.href);
        url.searchParams.set('filter', JSON.stringify(preset.filter));
        url.searchParams.set('sort', JSON.stringify(preset.sort));
        location.assign(url.toString());
      });

      pillsContainer.appendChild(pill);
    });
  }

  // SPA Navigation listener (YouTube Studio uses client-side routing)
  const observer = new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      isRedirecting = false;
      checkAndApplyFilter();
    }
  });

  // Initial execution when page loads
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAndApplyFilter);
  } else {
    checkAndApplyFilter();
  }

  observer.observe(document.documentElement, { childList: true, subtree: true });

})();
