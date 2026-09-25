// Content Script for YouTube CMS Auto-Filter & Video ID Linkifier Extension

(function () {
  'use strict';

  let lastUrl = location.href;
  let isRedirecting = false;

  // =========================================================================
  // 1. YouTube CMS Auto-Filter & Quick Presets Feature
  // =========================================================================

  // Helper to construct YouTube CMS URL with filter and sort parameters while preserving active search parameters (e.g. KEYWORD)
  function mergePresetWithCurrentUrl(currentUrlStr, preset) {
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

    // Start merged filter array with preset rules
    const mergedFilter = [...preset.filter];

    // Preserve existing URL rules (e.g. KEYWORD, CHANNEL_ID) that are NOT explicitly overridden by preset
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

    // If filter or sort is missing from query string, auto-apply default filter preset
    if (!hasFilter || !hasSort) {
      isRedirecting = true;
      const mergedUrlStr = mergePresetWithCurrentUrl(location.href, activePreset);
      console.log('[YouTube CMS Auto-Filter] Applying preset filters:', activePreset.name);
      location.replace(mergedUrlStr);
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
        <div class="yt-cms-bar-actions">
          <button class="yt-cms-bar-icon-btn" id="yt-cms-edit-btn" title="Manage Presets Directly On Page">⚙️ Edit</button>
          <button class="yt-cms-bar-toggle" id="yt-cms-toggle-btn" title="Toggle Panel">—</button>
        </div>
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

    document.getElementById('yt-cms-edit-btn').addEventListener('click', () => {
      openInPagePresetManager();
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

        // Apply merged preset to current URL (preserving search terms)
        const mergedUrlStr = mergePresetWithCurrentUrl(location.href, preset);
        location.assign(mergedUrlStr);
      });

      pillsContainer.appendChild(pill);
    });
  }

  // =========================================================================
  // In-Page Preset Manager Modal Overlay Feature
  // =========================================================================

  let inPageModalOverlay = null;

  async function openInPagePresetManager() {
    if (!inPageModalOverlay) {
      createInPageModalDOM();
    }
    inPageModalOverlay.classList.remove('hidden');
    await renderInPagePresetList();
  }

  function createInPageModalDOM() {
    inPageModalOverlay = document.createElement('div');
    inPageModalOverlay.id = 'yt-cms-inpage-modal';
    inPageModalOverlay.className = 'yt-cms-modal-overlay hidden';

    inPageModalOverlay.innerHTML = `
      <div class="yt-cms-modal-box">
        <div class="yt-cms-modal-header">
          <h3 id="yt-cms-inpage-title">Preset Management</h3>
          <button class="yt-cms-modal-close" id="yt-cms-inpage-close">&times;</button>
        </div>
        <div class="yt-cms-modal-body" id="yt-cms-inpage-body">
          <!-- Views rendered dynamically -->
        </div>
      </div>
    `;

    document.body.appendChild(inPageModalOverlay);

    document.getElementById('yt-cms-inpage-close').addEventListener('click', () => {
      inPageModalOverlay.classList.add('hidden');
    });

    // Close on backdrop click
    inPageModalOverlay.addEventListener('click', (e) => {
      if (e.target === inPageModalOverlay) {
        inPageModalOverlay.classList.add('hidden');
      }
    });
  }

  async function renderInPagePresetList() {
    const body = document.getElementById('yt-cms-inpage-body');
    const title = document.getElementById('yt-cms-inpage-title');
    title.textContent = 'Preset Management';

    const data = await chrome.storage.sync.get(['activePresetId', 'presets']);
    const presets = data.presets || [];
    const activePresetId = data.activePresetId || presets[0]?.id;

    let html = `
      <button class="yt-cms-btn-primary" id="yt-cms-btn-new-preset">+ Create New Preset</button>
      <div style="display: flex; flex-direction: column; gap: 8px; margin-top: 8px;">
    `;

    presets.forEach(p => {
      const isActive = p.id === activePresetId;
      const ruleCount = p.filter ? p.filter.length : 0;
      const sortCol = p.sort ? p.sort.columnType : 'totalViews';

      html += `
        <div class="yt-cms-manager-item ${isActive ? 'active' : ''}">
          <div>
            <div class="yt-cms-item-title">
              ${escapeHtmlStr(p.name)}
              ${isActive ? '<span class="yt-cms-active-badge">Active</span>' : ''}
            </div>
            <div class="yt-cms-item-meta">${ruleCount} rules • Sort: ${sortCol}</div>
          </div>
          <div class="yt-cms-item-actions">
            <button class="yt-cms-icon-action btn-edit" data-id="${p.id}" title="Edit">✏️</button>
            <button class="yt-cms-icon-action btn-dup" data-id="${p.id}" title="Duplicate">📋</button>
            <button class="yt-cms-icon-action danger btn-del" data-id="${p.id}" title="Delete">🗑️</button>
          </div>
        </div>
      `;
    });

    html += `</div>`;
    body.innerHTML = html;

    document.getElementById('yt-cms-btn-new-preset').addEventListener('click', () => {
      openInPagePresetEditor(null, presets, activePresetId);
    });

    body.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        openInPagePresetEditor(btn.dataset.id, presets, activePresetId);
      });
    });

    body.querySelectorAll('.btn-dup').forEach(btn => {
      btn.addEventListener('click', async () => {
        const pToDup = presets.find(p => p.id === btn.dataset.id);
        if (!pToDup) return;
        const newP = {
          id: 'preset_' + Date.now(),
          name: `${pToDup.name} (Copy)`,
          filter: JSON.parse(JSON.stringify(pToDup.filter)),
          sort: JSON.parse(JSON.stringify(pToDup.sort))
        };
        presets.push(newP);
        await chrome.storage.sync.set({ presets });
        await refreshToolbarAndPage(newP.id);
        renderInPagePresetList();
      });
    });

    body.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (presets.length <= 1) return;
        const updated = presets.filter(p => p.id !== btn.dataset.id);
        let newActive = activePresetId;
        if (activePresetId === btn.dataset.id) {
          newActive = updated[0].id;
        }
        await chrome.storage.sync.set({ presets: updated, activePresetId: newActive });
        await refreshToolbarAndPage(newActive);
        renderInPagePresetList();
      });
    });
  }

  function openInPagePresetEditor(presetId, presets, activePresetId) {
    const body = document.getElementById('yt-cms-inpage-body');
    const title = document.getElementById('yt-cms-inpage-title');
    title.textContent = presetId ? 'Edit Preset' : 'Create New Preset';

    let targetPreset = presets.find(p => p.id === presetId);
    if (!targetPreset) {
      targetPreset = {
        id: 'preset_' + Date.now(),
        name: 'New Custom Preset',
        filter: [
          { name: 'ALLOWLISTED', value: 'FALSE' },
          { name: 'CLAIM_STATUS', value: 'VIDEO_CLAIM_STATUS_NOT_CLAIMED_BY_OWNER' },
          { name: 'CLAIMABLE', value: ['VIDEO_CLAIMABILITY_CAN_CLAIM'] },
          { name: 'SHORTS', value: 'FALSE' }
        ],
        sort: { columnType: 'totalViews', sortOrder: 'DESCENDING' }
      };
    }

    body.innerHTML = `
      <div class="yt-cms-form-group">
        <label class="yt-cms-form-label">Preset Name:</label>
        <input type="text" id="yt-cms-edit-name" class="yt-cms-form-input" value="${escapeHtmlStr(targetPreset.name)}">
      </div>

      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed rgba(255,255,255,0.1); padding-bottom:4px; margin-top:8px;">
        <span class="yt-cms-form-label">Filter Rules</span>
        <button class="yt-cms-btn-text" id="yt-cms-btn-add-rule">+ Add Rule</button>
      </div>

      <div id="yt-cms-editor-rules" style="display:flex; flex-direction:column; gap:6px;"></div>

      <div class="yt-cms-form-group" style="margin-top:8px;">
        <label class="yt-cms-form-label">Sort Column:</label>
        <select id="yt-cms-edit-sort-col" class="yt-cms-form-select">
          <option value="totalViews" ${targetPreset.sort?.columnType === 'totalViews' ? 'selected' : ''}>Total Views (totalViews)</option>
          <option value="relevance" ${targetPreset.sort?.columnType === 'relevance' ? 'selected' : ''}>Relevance (relevance)</option>
          <option value="publishDate" ${targetPreset.sort?.columnType === 'publishDate' ? 'selected' : ''}>Published Date (publishDate)</option>
        </select>
      </div>

      <div class="yt-cms-form-group">
        <label class="yt-cms-form-label">Sort Order:</label>
        <select id="yt-cms-edit-sort-order" class="yt-cms-form-select">
          <option value="DESCENDING" ${targetPreset.sort?.sortOrder === 'DESCENDING' ? 'selected' : ''}>Descending</option>
          <option value="ASCENDING" ${targetPreset.sort?.sortOrder === 'ASCENDING' ? 'selected' : ''}>Ascending</option>
        </select>
      </div>

      <div style="display:flex; gap:8px; margin-top:12px; border-top:1px solid rgba(255,255,255,0.1); padding-top:10px;">
        <button class="yt-cms-btn-primary" id="yt-cms-btn-save-preset">Save Preset</button>
        <button class="yt-cms-btn-secondary" id="yt-cms-btn-cancel-editor">Cancel</button>
      </div>
    `;

    const rulesContainer = document.getElementById('yt-cms-editor-rules');
    (targetPreset.filter || []).forEach(rule => {
      addInPageRuleRow(rulesContainer, rule);
    });

    document.getElementById('yt-cms-btn-add-rule').addEventListener('click', () => {
      addInPageRuleRow(rulesContainer, { name: 'CLAIM_STATUS', value: 'VIDEO_CLAIM_STATUS_NOT_CLAIMED_BY_OWNER' });
    });

    document.getElementById('yt-cms-btn-cancel-editor').addEventListener('click', () => {
      renderInPagePresetList();
    });

    document.getElementById('yt-cms-btn-save-preset').addEventListener('click', async () => {
      const name = document.getElementById('yt-cms-edit-name').value.trim() || 'Untitled Preset';
      const sortCol = document.getElementById('yt-cms-edit-sort-col').value;
      const sortOrd = document.getElementById('yt-cms-edit-sort-order').value;

      const newFilter = [];
      rulesContainer.querySelectorAll('.yt-cms-inpage-rule-row').forEach(row => {
        const paramSelect = row.querySelector('.rule-param-select');
        const customNameInput = row.querySelectorAll('.rule-param-select')[1];
        const valContainer = row.querySelector('.rule-val-container');

        let paramName = paramSelect.value;
        if (paramName === 'CUSTOM') {
          paramName = customNameInput ? customNameInput.value.trim() : 'CUSTOM';
        }

        let parsedVal = '';
        if (['ALLOWLISTED', 'CLAIM_STATUS', 'SHORTS', 'REVIEWED', 'LIVESTREAM'].includes(paramName)) {
          const s = valContainer.querySelector('.rule-val-select');
          parsedVal = s ? s.value : '';
        } else if (paramName === 'CLAIMABLE') {
          const chks = valContainer.querySelectorAll('input[type="checkbox"]:checked');
          parsedVal = Array.from(chks).map(c => c.value);
        } else if (paramName === 'VIDEO_DURATION') {
          const s = valContainer.querySelector('.rule-val-select');
          if (s && s.value === 'VIDEO_LENGTH_CUSTOM') {
            const op = valContainer.querySelectorAll('.rule-val-select')[1]?.value || 'LESS_EQUAL';
            const sec = parseInt(valContainer.querySelector('input[type="number"]')?.value || '600', 10);
            parsedVal = { customValue: { name: op, value: sec }, lengthType: 'VIDEO_LENGTH_CUSTOM' };
          } else {
            parsedVal = s ? s.value : 'VIDEO_LENGTH_SHORT';
          }
        } else if (paramName === 'KEYWORD') {
          let text = valContainer.querySelector('input[type="text"]')?.value.trim() || '';
          if (text && !text.startsWith('"') && !text.endsWith('"')) text = `"${text}"`;
          parsedVal = { name: 'CONTAINS', value: text };
        } else if (paramName === 'CHANNEL_ID') {
          let text = valContainer.querySelector('input[type="text"]')?.value.trim() || '';
          parsedVal = { name: 'IS', value: text };
        } else if (paramName === 'PUBLISH_DATE') {
          const dateInputs = valContainer.querySelectorAll('input[type="date"]');
          const startVal = dateInputs[0]?.value;
          const endVal = dateInputs[1]?.value;
          if (startVal && endVal) {
            const [sY, sM, sD] = startVal.split('-').map(n => parseInt(n, 10));
            const [eY, eM, eD] = endVal.split('-').map(n => parseInt(n, 10));
            parsedVal = { start: { day: sD, month: sM, year: sY }, end: { day: eD, month: eM, year: eY } };
          }
        } else {
          let rawText = valContainer.querySelector('.rule-val-input')?.value.trim() || '';
          if ((rawText.startsWith('[') && rawText.endsWith(']')) || (rawText.startsWith('{') && rawText.endsWith('}'))) {
            try { parsedVal = JSON.parse(rawText); } catch (_) { parsedVal = rawText; }
          } else { parsedVal = rawText; }
        }

        if (paramName) {
          newFilter.push({ name: paramName, value: parsedVal });
        }
      });

      const updatedPreset = {
        id: presetId || targetPreset.id,
        name,
        filter: newFilter,
        sort: { columnType: sortCol, sortOrder: sortOrd }
      };

      if (presetId) {
        const idx = presets.findIndex(p => p.id === presetId);
        if (idx !== -1) presets[idx] = updatedPreset;
      } else {
        presets.push(updatedPreset);
      }

      await chrome.storage.sync.set({ presets, activePresetId: updatedPreset.id });
      await refreshToolbarAndPage(updatedPreset.id);
      renderInPagePresetList();
    });
  }

  function addInPageRuleRow(container, rule = { name: 'CLAIM_STATUS', value: 'VIDEO_CLAIM_STATUS_NOT_CLAIMED_BY_OWNER' }) {
    const row = document.createElement('div');
    row.className = 'yt-cms-inpage-rule-row';
    row.style.cssText = 'display:flex; gap:6px; align-items:flex-start; background:rgba(255,255,255,0.02); padding:6px; border:1px solid rgba(255,255,255,0.08); border-radius:6px;';

    const paramSel = document.createElement('select');
    paramSel.className = 'rule-param-select yt-cms-form-select';
    paramSel.style.width = '120px';

    const params = [
      { label: 'ALLOWLISTED', value: 'ALLOWLISTED' },
      { label: 'CLAIM_STATUS', value: 'CLAIM_STATUS' },
      { label: 'CLAIMABLE', value: 'CLAIMABLE' },
      { label: 'SHORTS', value: 'SHORTS' },
      { label: 'VIDEO_DURATION', value: 'VIDEO_DURATION' },
      { label: 'REVIEWED', value: 'REVIEWED' },
      { label: 'LIVESTREAM', value: 'LIVESTREAM' },
      { label: 'KEYWORD', value: 'KEYWORD' },
      { label: 'PUBLISH_DATE', value: 'PUBLISH_DATE' },
      { label: 'CHANNEL_ID', value: 'CHANNEL_ID' },
      { label: 'VIDEO_ID', value: 'VIDEO_ID' },
      { label: 'Custom...', value: 'CUSTOM' }
    ];

    let isStd = false;
    params.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.value;
      opt.textContent = p.label;
      if (p.value === rule.name) { opt.selected = true; isStd = true; }
      paramSel.appendChild(opt);
    });

    if (!isStd) {
      const customOpt = document.createElement('option');
      customOpt.value = rule.name;
      customOpt.textContent = `${rule.name} (Custom)`;
      customOpt.selected = true;
      paramSel.insertBefore(customOpt, paramSel.firstChild);
    }

    const valContainer = document.createElement('div');
    valContainer.className = 'rule-val-container';
    valContainer.style.flex = '1';

    renderInPageValControl(valContainer, paramSel.value, rule.value);

    paramSel.addEventListener('change', () => {
      renderInPageValControl(valContainer, paramSel.value, null);
    });

    const btnDel = document.createElement('button');
    btnDel.className = 'yt-cms-icon-action danger';
    btnDel.innerHTML = '&times;';
    btnDel.style.fontSize = '14px';
    btnDel.addEventListener('click', () => row.remove());

    row.appendChild(paramSel);
    row.appendChild(valContainer);
    row.appendChild(btnDel);

    container.appendChild(row);
  }

  function renderInPageValControl(container, paramName, currentValue) {
    container.innerHTML = '';

    if (['ALLOWLISTED', 'SHORTS', 'REVIEWED', 'LIVESTREAM'].includes(paramName)) {
      const sel = document.createElement('select');
      sel.className = 'rule-val-select yt-cms-form-select';
      const opts = paramName === 'ALLOWLISTED' ? [
        { label: 'Not allowlisted (FALSE)', value: 'FALSE' },
        { label: 'Is allowlisted (TRUE)', value: 'TRUE' }
      ] : [
        { label: 'False', value: 'FALSE' },
        { label: 'True', value: 'TRUE' }
      ];
      let valStr = String(currentValue ?? 'FALSE').toUpperCase();
      opts.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value; opt.textContent = o.label;
        if (o.value === valStr) opt.selected = true;
        sel.appendChild(opt);
      });
      container.appendChild(sel);
    } else if (paramName === 'CLAIM_STATUS') {
      const sel = document.createElement('select');
      sel.className = 'rule-val-select yt-cms-form-select';
      const opts = [
        { label: 'Not claimed by me', value: 'VIDEO_CLAIM_STATUS_NOT_CLAIMED_BY_OWNER' },
        { label: 'Claimed by me', value: 'VIDEO_CLAIM_STATUS_CLAIMED_BY_OWNER' },
        { label: 'Claimed by others', value: 'VIDEO_CLAIM_STATUS_CLAIMED_BY_OTHERS' },
        { label: 'Not claimed by others', value: 'VIDEO_CLAIM_STATUS_NOT_CLAIMED_BY_OTHERS' }
      ];
      let valStr = String(currentValue ?? 'VIDEO_CLAIM_STATUS_NOT_CLAIMED_BY_OWNER');
      opts.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value; opt.textContent = o.label;
        if (o.value === valStr) opt.selected = true;
        sel.appendChild(opt);
      });
      container.appendChild(sel);
    } else if (paramName === 'CLAIMABLE') {
      const group = document.createElement('div');
      group.className = 'yt-cms-form-group';
      const opts = [
        { label: 'Can claim', value: 'VIDEO_CLAIMABILITY_CAN_CLAIM' },
        { label: 'Cannot claim', value: 'VIDEO_CLAIMABILITY_CANNOT_CLAIM' },
        { label: 'Can takedown', value: 'VIDEO_CLAIMABILITY_CAN_TAKEDOWN' },
        { label: 'Partially claimable', value: 'VIDEO_CLAIMABILITY_PARTIALLY_CLAIMABLE' }
      ];
      let arr = Array.isArray(currentValue) ? currentValue : ['VIDEO_CLAIMABILITY_CAN_CLAIM'];
      opts.forEach(o => {
        const lbl = document.createElement('label');
        lbl.style.cssText = 'display:flex; align-items:center; gap:6px; font-size:11px;';
        const chk = document.createElement('input');
        chk.type = 'checkbox'; chk.value = o.value;
        if (arr.includes(o.value)) chk.checked = true;
        lbl.appendChild(chk);
        lbl.appendChild(document.createTextNode(o.label));
        group.appendChild(lbl);
      });
      container.appendChild(group);
    } else if (paramName === 'VIDEO_DURATION') {
      const sel = document.createElement('select');
      sel.className = 'rule-val-select yt-cms-form-select';
      const opts = [
        { label: 'Short (< 4 min)', value: 'VIDEO_LENGTH_SHORT' },
        { label: 'Medium (4 - 20 min)', value: 'VIDEO_LENGTH_MEDIUM' },
        { label: 'Long (> 20 min)', value: 'VIDEO_LENGTH_LONG' },
        { label: 'Custom Duration...', value: 'VIDEO_LENGTH_CUSTOM' }
      ];
      let isCustom = typeof currentValue === 'object' && currentValue?.lengthType === 'VIDEO_LENGTH_CUSTOM';
      let selectedVal = isCustom ? 'VIDEO_LENGTH_CUSTOM' : (typeof currentValue === 'string' ? currentValue : 'VIDEO_LENGTH_SHORT');

      opts.forEach(o => {
        const opt = document.createElement('option');
        opt.value = o.value; opt.textContent = o.label;
        if (o.value === selectedVal) opt.selected = true;
        sel.appendChild(opt);
      });

      const customRow = document.createElement('div');
      customRow.className = `${selectedVal === 'VIDEO_LENGTH_CUSTOM' ? '' : 'hidden'}`;
      customRow.style.cssText = 'display:flex; gap:6px; margin-top:4px;';

      const opSel = document.createElement('select');
      opSel.className = 'rule-val-select yt-cms-form-select';
      [{ label: '<=', value: 'LESS_EQUAL' }, { label: '>=', value: 'GREATER_EQUAL' }, { label: '=', value: 'EQUAL' }].forEach(op => {
        const o = document.createElement('option');
        o.value = op.value; o.textContent = op.label;
        if (op.value === (isCustom ? currentValue?.customValue?.name : 'LESS_EQUAL')) o.selected = true;
        opSel.appendChild(o);
      });

      const secInp = document.createElement('input');
      secInp.type = 'number'; secInp.className = 'yt-cms-form-input';
      secInp.placeholder = 'Seconds';
      secInp.value = isCustom ? (currentValue?.customValue?.value ?? 600) : 600;

      customRow.appendChild(opSel);
      customRow.appendChild(secInp);

      sel.addEventListener('change', () => {
        if (sel.value === 'VIDEO_LENGTH_CUSTOM') customRow.classList.remove('hidden');
        else customRow.classList.add('hidden');
      });

      container.appendChild(sel);
      container.appendChild(customRow);
    } else if (paramName === 'KEYWORD' || paramName === 'CHANNEL_ID') {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'rule-val-input yt-cms-form-input';
      inp.placeholder = paramName === 'KEYWORD' ? 'Search keyword...' : 'Channel ID...';
      let val = typeof currentValue === 'object' ? (currentValue?.value || '') : (currentValue || '');
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      inp.value = val;
      container.appendChild(inp);
    } else if (paramName === 'PUBLISH_DATE') {
      const row = document.createElement('div');
      row.style.cssText = 'display:flex; gap:4px; align-items:center;';
      let sStr = '', eStr = '';
      if (typeof currentValue === 'object' && currentValue?.start && currentValue?.end) {
        const s = currentValue.start, e = currentValue.end;
        if (s.year) sStr = `${s.year}-${String(s.month).padStart(2,'0')}-${String(s.day).padStart(2,'0')}`;
        if (e.year) eStr = `${e.year}-${String(e.month).padStart(2,'0')}-${String(e.day).padStart(2,'0')}`;
      }
      const sInp = document.createElement('input'); sInp.type = 'date'; sInp.className = 'yt-cms-form-input'; sInp.value = sStr;
      const eInp = document.createElement('input'); eInp.type = 'date'; eInp.className = 'yt-cms-form-input'; eInp.value = eStr;
      row.appendChild(sInp); row.appendChild(eInp);
      container.appendChild(row);
    } else {
      const inp = document.createElement('input');
      inp.type = 'text'; inp.className = 'rule-val-input yt-cms-form-input';
      inp.placeholder = 'Value';
      inp.value = typeof currentValue === 'object' ? JSON.stringify(currentValue) : String(currentValue ?? '');
      container.appendChild(inp);
    }
  }

  async function refreshToolbarAndPage(activePresetId) {
    const data = await chrome.storage.sync.get(['presets']);
    const presets = data.presets || [];
    const activePreset = presets.find(p => p.id === activePresetId) || presets[0];

    const toolbar = document.getElementById('yt-cms-filter-toolbar');
    if (toolbar && activePreset) {
      updateToolbarState(toolbar, activePreset, presets);
    }
  }

  function escapeHtmlStr(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
