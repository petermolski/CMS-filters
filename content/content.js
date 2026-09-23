// Content Script for YouTube CMS Auto-Filter & Video ID Linkifier Extension

(function () {
  'use strict';

  let lastUrl = location.href;
  let isRedirecting = false;

  // =========================================================================
  // 1. YouTube CMS Auto-Filter & Quick Presets Feature
  // =========================================================================

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

  // =========================================================================
  // 2. YouTube CMS Video ID Linkifier & Copy Button Feature
  // =========================================================================

  const observedRoots = new WeakSet();
  const mediaIdRegex = /^Media ID:\s*([a-zA-Z0-9_-]{11})$/i;
  const videoIdRegex = /^[a-zA-Z0-9_-]{11}$/;

  let linkifyEnabled = true;

  // Check linkify settings from storage
  chrome.storage.sync.get(['linkifyEnabled'], (data) => {
    linkifyEnabled = data.linkifyEnabled ?? true;
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'sync' && changes.linkifyEnabled) {
      linkifyEnabled = changes.linkifyEnabled.newValue;
    }
  });

  function observeShadowRoot(shadowRoot) {
    if (observedRoots.has(shadowRoot)) return;
    observedRoots.add(shadowRoot);

    const observer = new MutationObserver(() => {
      scheduleLinkifierProcess();
    });

    observer.observe(shadowRoot, {
      childList: true,
      subtree: true
    });
  }

  function linkifyElement(el, videoId, watchUrl, isYouTubeSpan) {
    el.setAttribute('data-ytcms-linkified', 'true');

    const anchor = document.createElement('a');
    anchor.href = watchUrl;
    anchor.target = '_blank';
    anchor.className = 'ytcms-linkifier-link';
    anchor.textContent = watchUrl;

    if (isYouTubeSpan) {
      el.textContent = '';
      el.appendChild(anchor);
    } else {
      el.textContent = '';
      const prefixNode = document.createTextNode('Media ID: ');
      el.appendChild(prefixNode);
      el.appendChild(anchor);
    }

    // Create copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'ytcms-linkifier-copy-btn';
    copyBtn.title = 'Copy watch link';
    copyBtn.setAttribute('aria-label', 'Copy watch link');
    
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24">
        <path d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"/>
      </svg>
      <span class="ytcms-linkifier-tooltip">Copied!</span>
    `;

    copyBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();

      try {
        await navigator.clipboard.writeText(watchUrl);
        copyBtn.classList.add('copied');

        const svgPath = copyBtn.querySelector('path');
        const copyPath = 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z';
        const checkmarkPath = 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z';
        svgPath.setAttribute('d', checkmarkPath);

        const tooltip = copyBtn.querySelector('.ytcms-linkifier-tooltip');
        tooltip.classList.add('show');

        setTimeout(() => {
          copyBtn.classList.remove('copied');
          svgPath.setAttribute('d', copyPath);
          tooltip.classList.remove('show');
        }, 1500);
      } catch (err) {
        console.error('[YouTube CMS Linkifier] Failed to copy URL:', err);
      }
    });

    if (isYouTubeSpan) {
      el.after(copyBtn);
    } else {
      el.appendChild(copyBtn);
    }
  }

  function processRoot(root = document) {
    if (!linkifyEnabled) return;

    // 1. YouTube CMS Video ID spans
    const youtubeSpans = root.querySelectorAll('span.video-id:not([data-ytcms-linkified])');
    youtubeSpans.forEach((span) => {
      const videoId = span.textContent.trim();
      if (!videoIdRegex.test(videoId)) return;

      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      linkifyElement(span, videoId, watchUrl, true);
    });

    // 2. Media ID text elements
    const textElements = root.querySelectorAll('p:not([data-ytcms-linkified]), span:not([data-ytcms-linkified]), div:not([data-ytcms-linkified]), td:not([data-ytcms-linkified])');
    textElements.forEach((el) => {
      if (el.children.length > 0) return;

      const text = el.textContent.trim();
      const match = mediaIdRegex.exec(text);
      if (!match) return;

      const videoId = match[1];
      const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
      linkifyElement(el, videoId, watchUrl, false);
    });

    // 3. Shadow DOM traversal
    const allElements = root.querySelectorAll('*');
    for (let i = 0; i < allElements.length; i++) {
      const el = allElements[i];
      if (el.shadowRoot) {
        observeShadowRoot(el.shadowRoot);
        processRoot(el.shadowRoot);
      }
    }
  }

  let frameRequested = false;

  function scheduleLinkifierProcess() {
    if (frameRequested || !linkifyEnabled) return;
    frameRequested = true;
    requestAnimationFrame(() => {
      processRoot(document);
      frameRequested = false;
    });
  }

  // =========================================================================
  // 3. Lifecycle & Observers Initialization
  // =========================================================================

  function init() {
    checkAndApplyFilter();
    scheduleLinkifierProcess();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // SPA navigation & DOM changes observer
  const observer = new MutationObserver(() => {
    scheduleLinkifierProcess();

    if (location.href !== lastUrl) {
      lastUrl = location.href;
      isRedirecting = false;
      checkAndApplyFilter();
    }
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true
  });

})();
