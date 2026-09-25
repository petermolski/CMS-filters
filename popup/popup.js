// Popup Script for YouTube CMS Auto-Filter & Linkifier Extension

document.addEventListener('DOMContentLoaded', async () => {
  // DOM Elements - Main View
  const autoApplyToggle = document.getElementById('auto-apply-toggle');
  const linkifyToggle = document.getElementById('linkify-toggle');
  const presetSelect = document.getElementById('preset-select');
  const btnEditActive = document.getElementById('btn-edit-active');
  const btnManagePresets = document.getElementById('btn-manage-presets');
  const btnApplyTab = document.getElementById('btn-apply-tab');
  const filterSummary = document.getElementById('filter-summary');
  const btnToggleJson = document.getElementById('btn-toggle-json');
  const jsonContainer = document.getElementById('json-editor-container');
  const jsonFilterInput = document.getElementById('json-filter-input');
  const jsonSortInput = document.getElementById('json-sort-input');
  const btnSaveJson = document.getElementById('btn-save-json');
  const btnCancelJson = document.getElementById('btn-cancel-json');
  const statusMessage = document.getElementById('status-message');

  // DOM Elements - Modal & Manager Views
  const modalOverlay = document.getElementById('modal-overlay');
  const viewPresetList = document.getElementById('view-preset-list');
  const viewPresetEditor = document.getElementById('view-preset-editor');
  const btnCloseModal = document.getElementById('btn-close-modal');
  const btnBackToList = document.getElementById('btn-back-to-list');
  const btnCreatePreset = document.getElementById('btn-create-preset');
  const managerPresetList = document.getElementById('manager-preset-list');

  // DOM Elements - Preset Form Editor
  const editorTitle = document.getElementById('editor-title');
  const editorPresetName = document.getElementById('editor-preset-name');
  const btnModeVisual = document.getElementById('btn-mode-visual');
  const btnModeJson = document.getElementById('btn-mode-json');
  const editorVisualSection = document.getElementById('editor-visual-section');
  const editorJsonSection = document.getElementById('editor-json-section');
  const rulesContainer = document.getElementById('rules-container');
  const btnAddRule = document.getElementById('btn-add-rule');
  const editorSortColumn = document.getElementById('editor-sort-column');
  const editorSortOrder = document.getElementById('editor-sort-order');
  const editorJsonFilter = document.getElementById('editor-json-filter');
  const editorJsonSort = document.getElementById('editor-json-sort');
  const btnSavePreset = document.getElementById('btn-save-preset');
  const btnCancelEditor = document.getElementById('btn-cancel-editor');

  // Standard YouTube CMS Filter Parameter Recommendations
  const PARAM_PRESETS = [
    { label: 'Allowlisted (ALLOWLISTED)', value: 'ALLOWLISTED' },
    { label: 'Claim Status (CLAIM_STATUS)', value: 'CLAIM_STATUS' },
    { label: 'Claimable (CLAIMABLE)', value: 'CLAIMABLE' },
    { label: 'Shorts (SHORTS)', value: 'SHORTS' },
    { label: 'Video Duration (VIDEO_DURATION)', value: 'VIDEO_DURATION' },
    { label: 'Reviewed (REVIEWED)', value: 'REVIEWED' },
    { label: 'Livestream (LIVESTREAM)', value: 'LIVESTREAM' },
    { label: 'Keyword (KEYWORD)', value: 'KEYWORD' },
    { label: 'Published Date (PUBLISH_DATE)', value: 'PUBLISH_DATE' },
    { label: 'Channel ID (CHANNEL_ID)', value: 'CHANNEL_ID' },
    { label: 'Video ID (VIDEO_ID)', value: 'VIDEO_ID' },
    { label: 'Custom Parameter...', value: 'CUSTOM' }
  ];

  let currentData = {
    autoApply: true,
    linkifyEnabled: true,
    activePresetId: 'default-unclaimed',
    presets: []
  };

  let editingPresetId = null; // null if creating new preset
  let currentEditMode = 'visual'; // 'visual' | 'json'

  // Load initial settings from chrome.storage.sync
  await loadState();

  // --- Main View Event Listeners ---
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

  btnEditActive.addEventListener('click', () => {
    const active = getActivePreset();
    if (active) openPresetEditor(active.id);
  });

  btnManagePresets.addEventListener('click', () => {
    openPresetManager();
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

  // --- Modal Navigation Listeners ---
  btnCloseModal.addEventListener('click', () => {
    closeModal();
  });

  btnBackToList.addEventListener('click', () => {
    showManagerListView();
  });

  btnCreatePreset.addEventListener('click', () => {
    openPresetEditor(null); // null = new preset
  });

  // --- Form Editor Listeners ---
  btnModeVisual.addEventListener('click', () => {
    if (currentEditMode === 'visual') return;
    try {
      // Sync from JSON to Visual if switching back
      const filterData = JSON.parse(editorJsonFilter.value);
      const sortData = JSON.parse(editorJsonSort.value);
      populateVisualRules(filterData);
      populateVisualSort(sortData);
      setEditMode('visual');
    } catch (err) {
      showStatus('Cannot switch to Visual: Invalid JSON (' + err.message + ')', true);
    }
  });

  btnModeJson.addEventListener('click', () => {
    if (currentEditMode === 'json') return;
    // Sync from Visual to JSON before switching
    const visualPreset = extractPresetFromVisualForm();
    editorJsonFilter.value = JSON.stringify(visualPreset.filter, null, 2);
    editorJsonSort.value = JSON.stringify(visualPreset.sort, null, 2);
    setEditMode('json');
  });

  btnAddRule.addEventListener('click', () => {
    addRuleRow({ name: 'CLAIM_STATUS', value: '' });
  });

  btnCancelEditor.addEventListener('click', () => {
    showManagerListView();
  });

  btnSavePreset.addEventListener('click', async () => {
    await handleSavePreset();
  });

  // --- State & Rendering Functions ---
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
        <span class="item-val">${escapeHtml(valText)}</span>
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

  // --- Preset Manager Functions ---
  function openPresetManager() {
    modalOverlay.classList.remove('hidden');
    showManagerListView();
  }

  function closeModal() {
    modalOverlay.classList.add('hidden');
  }

  function showManagerListView() {
    viewPresetList.classList.remove('hidden');
    viewPresetEditor.classList.add('hidden');
    renderManagerPresetList();
  }

  function renderManagerPresetList() {
    managerPresetList.innerHTML = '';

    currentData.presets.forEach((preset) => {
      const item = document.createElement('div');
      const isActive = preset.id === currentData.activePresetId;
      item.className = `preset-manager-item ${isActive ? 'active' : ''}`;

      const ruleCount = preset.filter ? preset.filter.length : 0;
      const sortCol = preset.sort ? preset.sort.columnType : 'None';

      item.innerHTML = `
        <div class="preset-item-info">
          <div class="preset-item-title">
            ${escapeHtml(preset.name)}
            ${isActive ? '<span class="active-badge">Active</span>' : ''}
          </div>
          <div class="preset-item-meta">${ruleCount} filter rules • Sort: ${sortCol}</div>
        </div>
        <div class="preset-item-actions">
          <button class="btn-icon-action btn-edit-preset" title="Edit preset" data-id="${preset.id}">✏️</button>
          <button class="btn-icon-action btn-dup-preset" title="Duplicate preset" data-id="${preset.id}">📋</button>
          <button class="btn-icon-action danger btn-del-preset" title="Delete preset" data-id="${preset.id}">🗑️</button>
        </div>
      `;

      managerPresetList.appendChild(item);
    });

    // Attach row action handlers
    managerPresetList.querySelectorAll('.btn-edit-preset').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.currentTarget.dataset.id;
        openPresetEditor(id);
      });
    });

    managerPresetList.querySelectorAll('.btn-dup-preset').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        await duplicatePreset(id);
      });
    });

    managerPresetList.querySelectorAll('.btn-del-preset').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        await deletePreset(id);
      });
    });
  }

  async function duplicatePreset(presetId) {
    const original = currentData.presets.find(p => p.id === presetId);
    if (!original) return;

    const dup = {
      id: 'preset_' + Date.now(),
      name: `${original.name} (Copy)`,
      filter: JSON.parse(JSON.stringify(original.filter)),
      sort: JSON.parse(JSON.stringify(original.sort))
    };

    currentData.presets.push(dup);
    await chrome.storage.sync.set({ presets: currentData.presets });
    renderPresetsDropdown();
    renderManagerPresetList();
    showStatus(`Duplicated preset: ${dup.name}`);
  }

  async function deletePreset(presetId) {
    if (currentData.presets.length <= 1) {
      showStatus('Cannot delete the only remaining preset!', true);
      return;
    }

    const presetToDelete = currentData.presets.find(p => p.id === presetId);
    if (!presetToDelete) return;

    currentData.presets = currentData.presets.filter(p => p.id !== presetId);

    // If active preset was deleted, switch to first available
    if (currentData.activePresetId === presetId) {
      currentData.activePresetId = currentData.presets[0].id;
    }

    await chrome.storage.sync.set({
      presets: currentData.presets,
      activePresetId: currentData.activePresetId
    });

    renderPresetsDropdown();
    renderActivePresetDetails();
    renderManagerPresetList();
    showStatus(`Deleted preset: ${presetToDelete.name}`);
  }

  // --- Preset Editor Functions ---
  function openPresetEditor(presetId) {
    editingPresetId = presetId;
    viewPresetList.classList.add('hidden');
    viewPresetEditor.classList.remove('hidden');
    modalOverlay.classList.remove('hidden');

    let presetToEdit;
    if (presetId) {
      editorTitle.textContent = 'Edit Preset';
      presetToEdit = currentData.presets.find(p => p.id === presetId);
    } else {
      editorTitle.textContent = 'Create New Preset';
      const active = getActivePreset();
      presetToEdit = {
        id: 'preset_' + Date.now(),
        name: 'New Custom Preset',
        filter: active ? JSON.parse(JSON.stringify(active.filter)) : [],
        sort: active ? JSON.parse(JSON.stringify(active.sort)) : { columnType: 'totalViews', sortOrder: 'DESCENDING' }
      };
    }

    editorPresetName.value = presetToEdit.name;

    // Populate Visual Form & JSON Textareas
    populateVisualRules(presetToEdit.filter);
    populateVisualSort(presetToEdit.sort);

    editorJsonFilter.value = JSON.stringify(presetToEdit.filter, null, 2);
    editorJsonSort.value = JSON.stringify(presetToEdit.sort, null, 2);

    setEditMode('visual');
  }

  function setEditMode(mode) {
    currentEditMode = mode;
    if (mode === 'visual') {
      btnModeVisual.classList.add('active');
      btnModeJson.classList.remove('active');
      editorVisualSection.classList.remove('hidden');
      editorJsonSection.classList.add('hidden');
    } else {
      btnModeJson.classList.add('active');
      btnModeVisual.classList.remove('active');
      editorJsonSection.classList.remove('hidden');
      editorVisualSection.classList.add('hidden');
    }
  }

  function populateVisualRules(filterRules) {
    rulesContainer.innerHTML = '';
    if (Array.isArray(filterRules) && filterRules.length > 0) {
      filterRules.forEach(rule => addRuleRow(rule));
    } else {
      addRuleRow({ name: 'CLAIM_STATUS', value: 'VIDEO_CLAIM_STATUS_NOT_CLAIMED_BY_OWNER' });
    }
  }

  function addRuleRow(rule = { name: 'CLAIM_STATUS', value: 'VIDEO_CLAIM_STATUS_NOT_CLAIMED_BY_OWNER' }) {
    const row = document.createElement('div');
    row.className = 'rule-row';

    // Left side: parameter name selector + custom input
    const paramContainer = document.createElement('div');
    paramContainer.className = 'rule-param-container';

    const select = document.createElement('select');
    select.className = 'rule-param-select';

    let isStandardParam = false;
    PARAM_PRESETS.forEach(p => {
      const opt = document.createElement('option');
      opt.value = p.value;
      opt.textContent = p.label;
      if (p.value === rule.name) {
        opt.selected = true;
        isStandardParam = true;
      }
      select.appendChild(opt);
    });

    if (!isStandardParam) {
      const customOpt = document.createElement('option');
      customOpt.value = rule.name;
      customOpt.textContent = `${rule.name} (Custom)`;
      customOpt.selected = true;
      select.insertBefore(customOpt, select.firstChild);
    }

    const customNameInput = document.createElement('input');
    customNameInput.type = 'text';
    customNameInput.className = 'rule-param-select mt-4 hidden';
    customNameInput.placeholder = 'Param Name';
    customNameInput.value = rule.name;

    paramContainer.appendChild(select);
    paramContainer.appendChild(customNameInput);

    // Center: value container
    const valueContainer = document.createElement('div');
    valueContainer.className = 'rule-value-container';

    let currentParam = select.value;
    renderValueControl(valueContainer, currentParam, rule.value);

    select.addEventListener('change', () => {
      let newParam = select.value;
      if (newParam === 'CUSTOM') {
        customNameInput.classList.remove('hidden');
        customNameInput.focus();
        newParam = customNameInput.value.trim() || 'CUSTOM';
      } else {
        customNameInput.classList.add('hidden');
      }
      renderValueControl(valueContainer, newParam, null);
    });

    // Right side: delete button
    const btnDelete = document.createElement('button');
    btnDelete.className = 'btn-delete-rule';
    btnDelete.innerHTML = '&times;';
    btnDelete.title = 'Remove rule';
    btnDelete.addEventListener('click', () => {
      row.remove();
    });

    row.appendChild(paramContainer);
    row.appendChild(valueContainer);
    row.appendChild(btnDelete);

    rulesContainer.appendChild(row);
  }

  function renderValueControl(valueContainer, paramName, currentValue) {
    valueContainer.innerHTML = '';

    if (paramName === 'ALLOWLISTED') {
      const select = document.createElement('select');
      select.className = 'rule-value-select';
      const options = [
        { label: 'Not allowlisted (FALSE)', value: 'FALSE' },
        { label: 'Is allowlisted (TRUE)', value: 'TRUE' }
      ];
      let valStr = String(currentValue ?? 'FALSE').toUpperCase();
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === valStr) o.selected = true;
        select.appendChild(o);
      });
      valueContainer.appendChild(select);
    } else if (paramName === 'CLAIM_STATUS') {
      const select = document.createElement('select');
      select.className = 'rule-value-select';
      const options = [
        { label: 'Not claimed by me', value: 'VIDEO_CLAIM_STATUS_NOT_CLAIMED_BY_OWNER' },
        { label: 'Claimed by me', value: 'VIDEO_CLAIM_STATUS_CLAIMED_BY_OWNER' },
        { label: 'Claimed by others', value: 'VIDEO_CLAIM_STATUS_CLAIMED_BY_OTHERS' },
        { label: 'Not claimed by others', value: 'VIDEO_CLAIM_STATUS_NOT_CLAIMED_BY_OTHERS' }
      ];
      let valStr = String(currentValue ?? 'VIDEO_CLAIM_STATUS_NOT_CLAIMED_BY_OWNER');
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === valStr) o.selected = true;
        select.appendChild(o);
      });
      valueContainer.appendChild(select);
    } else if (paramName === 'CLAIMABLE') {
      const group = document.createElement('div');
      group.className = 'rule-checkbox-group';
      const options = [
        { label: 'Can claim', value: 'VIDEO_CLAIMABILITY_CAN_CLAIM' },
        { label: 'Cannot claim', value: 'VIDEO_CLAIMABILITY_CANNOT_CLAIM' },
        { label: 'Can takedown', value: 'VIDEO_CLAIMABILITY_CAN_TAKEDOWN' },
        { label: 'Partially claimable', value: 'VIDEO_CLAIMABILITY_PARTIALLY_CLAIMABLE' }
      ];
      let selectedArr = Array.isArray(currentValue) ? currentValue : ['VIDEO_CLAIMABILITY_CAN_CLAIM'];
      options.forEach(opt => {
        const lbl = document.createElement('label');
        lbl.className = 'rule-checkbox-item';
        const chk = document.createElement('input');
        chk.type = 'checkbox';
        chk.value = opt.value;
        if (selectedArr.includes(opt.value)) chk.checked = true;
        lbl.appendChild(chk);
        lbl.appendChild(document.createTextNode(opt.label));
        group.appendChild(lbl);
      });
      valueContainer.appendChild(group);
    } else if (paramName === 'SHORTS') {
      const select = document.createElement('select');
      select.className = 'rule-value-select';
      const options = [
        { label: 'False (Exclude Shorts)', value: 'FALSE' },
        { label: 'True (Include Shorts)', value: 'TRUE' }
      ];
      let valStr = String(currentValue ?? 'FALSE').toUpperCase();
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === valStr) o.selected = true;
        select.appendChild(o);
      });
      valueContainer.appendChild(select);
    } else if (paramName === 'REVIEWED') {
      const select = document.createElement('select');
      select.className = 'rule-value-select';
      const options = [
        { label: 'False (Unreviewed)', value: 'FALSE' },
        { label: 'True (Reviewed)', value: 'TRUE' }
      ];
      let valStr = String(currentValue ?? 'FALSE').toUpperCase();
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === valStr) o.selected = true;
        select.appendChild(o);
      });
      valueContainer.appendChild(select);
    } else if (paramName === 'LIVESTREAM') {
      const select = document.createElement('select');
      select.className = 'rule-value-select';
      const options = [
        { label: 'False (Exclude Livestreams)', value: 'FALSE' },
        { label: 'True (Include Livestreams)', value: 'TRUE' }
      ];
      let valStr = String(currentValue ?? 'FALSE').toUpperCase();
      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === valStr) o.selected = true;
        select.appendChild(o);
      });
      valueContainer.appendChild(select);
    } else if (paramName === 'VIDEO_DURATION') {
      const select = document.createElement('select');
      select.className = 'rule-value-select';
      const options = [
        { label: 'Short (< 4 min)', value: 'VIDEO_LENGTH_SHORT' },
        { label: 'Medium (4 - 20 min)', value: 'VIDEO_LENGTH_MEDIUM' },
        { label: 'Long (> 20 min)', value: 'VIDEO_LENGTH_LONG' },
        { label: 'Custom Duration...', value: 'VIDEO_LENGTH_CUSTOM' }
      ];

      let isCustom = typeof currentValue === 'object' && currentValue?.lengthType === 'VIDEO_LENGTH_CUSTOM';
      let selectedVal = isCustom ? 'VIDEO_LENGTH_CUSTOM' : (typeof currentValue === 'string' ? currentValue : 'VIDEO_LENGTH_SHORT');

      options.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value;
        o.textContent = opt.label;
        if (opt.value === selectedVal) o.selected = true;
        select.appendChild(o);
      });

      const customRow = document.createElement('div');
      customRow.className = `rule-input-row mt-4 ${selectedVal === 'VIDEO_LENGTH_CUSTOM' ? '' : 'hidden'}`;

      const opSelect = document.createElement('select');
      opSelect.className = 'rule-value-select';
      const ops = [
        { label: 'Less than or equal (<=)', value: 'LESS_EQUAL' },
        { label: 'Greater than or equal (>=)', value: 'GREATER_EQUAL' },
        { label: 'Equals (=)', value: 'EQUAL' }
      ];
      let currOp = isCustom ? (currentValue?.customValue?.name || 'LESS_EQUAL') : 'LESS_EQUAL';
      ops.forEach(op => {
        const o = document.createElement('option');
        o.value = op.value;
        o.textContent = op.label;
        if (op.value === currOp) o.selected = true;
        opSelect.appendChild(o);
      });

      const secInput = document.createElement('input');
      secInput.type = 'number';
      secInput.className = 'rule-value-input';
      secInput.placeholder = 'Seconds (e.g. 600)';
      secInput.value = isCustom ? (currentValue?.customValue?.value ?? 600) : 600;

      customRow.appendChild(opSelect);
      customRow.appendChild(secInput);

      select.addEventListener('change', () => {
        if (select.value === 'VIDEO_LENGTH_CUSTOM') {
          customRow.classList.remove('hidden');
        } else {
          customRow.classList.add('hidden');
        }
      });

      valueContainer.appendChild(select);
      valueContainer.appendChild(customRow);
    } else if (paramName === 'KEYWORD') {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'rule-value-input';
      input.placeholder = 'Keyword / Search phrase (e.g. Young Sheldon)';
      let kwVal = '';
      if (typeof currentValue === 'object' && currentValue?.value) {
        kwVal = currentValue.value;
      } else if (typeof currentValue === 'string') {
        kwVal = currentValue;
      }
      if (kwVal.startsWith('"') && kwVal.endsWith('"')) {
        kwVal = kwVal.slice(1, -1);
      }
      input.value = kwVal;
      valueContainer.appendChild(input);
    } else if (paramName === 'CHANNEL_ID') {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'rule-value-input';
      input.placeholder = 'Channel ID (e.g. UCkeO-_dqxBNy_4yhWkhjaOA)';
      let chVal = '';
      if (typeof currentValue === 'object' && currentValue?.value) {
        chVal = currentValue.value;
      } else if (typeof currentValue === 'string') {
        chVal = currentValue;
      }
      input.value = chVal;
      valueContainer.appendChild(input);
    } else if (paramName === 'PUBLISH_DATE') {
      const dateRow = document.createElement('div');
      dateRow.className = 'rule-input-row';

      let startDateStr = '';
      let endDateStr = '';

      if (typeof currentValue === 'object' && currentValue?.start && currentValue?.end) {
        const s = currentValue.start;
        const e = currentValue.end;
        if (s.year && s.month && s.day) {
          startDateStr = `${s.year}-${String(s.month).padStart(2, '0')}-${String(s.day).padStart(2, '0')}`;
        }
        if (e.year && e.month && e.day) {
          endDateStr = `${e.year}-${String(e.month).padStart(2, '0')}-${String(e.day).padStart(2, '0')}`;
        }
      }

      const lblStart = document.createElement('span');
      lblStart.className = 'rule-date-label';
      lblStart.textContent = 'Start:';

      const inputStart = document.createElement('input');
      inputStart.type = 'date';
      inputStart.className = 'rule-value-input';
      inputStart.value = startDateStr;

      const lblEnd = document.createElement('span');
      lblEnd.className = 'rule-date-label';
      lblEnd.textContent = 'End:';

      const inputEnd = document.createElement('input');
      inputEnd.type = 'date';
      inputEnd.className = 'rule-value-input';
      inputEnd.value = endDateStr;

      dateRow.appendChild(lblStart);
      dateRow.appendChild(inputStart);
      dateRow.appendChild(lblEnd);
      dateRow.appendChild(inputEnd);

      valueContainer.appendChild(dateRow);
    } else {
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'rule-value-input';
      input.placeholder = 'Value';

      let valString = typeof currentValue === 'object' ? JSON.stringify(currentValue) : String(currentValue ?? '');
      input.value = valString;
      valueContainer.appendChild(input);
    }
  }

  function populateVisualSort(sortConfig) {
    if (!sortConfig) return;
    const col = sortConfig.columnType || 'totalViews';
    const validCols = ['totalViews', 'relevance', 'publishDate'];

    if (validCols.includes(col)) {
      editorSortColumn.value = col;
    } else {
      editorSortColumn.value = 'totalViews';
    }

    editorSortOrder.value = sortConfig.sortOrder || 'DESCENDING';
  }

  function extractPresetFromVisualForm() {
    const name = editorPresetName.value.trim() || 'Untitled Preset';
    const filter = [];

    const rows = rulesContainer.querySelectorAll('.rule-row');
    rows.forEach(row => {
      const paramSelect = row.querySelector('.rule-param-select');
      const customNameInput = row.querySelectorAll('.rule-param-select')[1];
      const valueContainer = row.querySelector('.rule-value-container');

      let paramName = paramSelect.value;
      if (paramName === 'CUSTOM') {
        paramName = customNameInput ? customNameInput.value.trim() : 'CUSTOM_PARAM';
      }

      let parsedVal = '';

      if (['ALLOWLISTED', 'CLAIM_STATUS', 'SHORTS', 'REVIEWED', 'LIVESTREAM'].includes(paramName)) {
        const valSelect = valueContainer.querySelector('.rule-value-select');
        parsedVal = valSelect ? valSelect.value : '';
      } else if (paramName === 'CLAIMABLE') {
        const checkboxes = valueContainer.querySelectorAll('input[type="checkbox"]:checked');
        parsedVal = Array.from(checkboxes).map(c => c.value);
      } else if (paramName === 'VIDEO_DURATION') {
        const durSelect = valueContainer.querySelector('.rule-value-select');
        if (durSelect && durSelect.value === 'VIDEO_LENGTH_CUSTOM') {
          const opSelect = valueContainer.querySelectorAll('.rule-value-select')[1];
          const secInput = valueContainer.querySelector('input[type="number"]');
          const sec = secInput ? parseInt(secInput.value, 10) || 600 : 600;
          const op = opSelect ? opSelect.value : 'LESS_EQUAL';
          parsedVal = {
            customValue: { name: op, value: sec },
            lengthType: 'VIDEO_LENGTH_CUSTOM'
          };
        } else {
          parsedVal = durSelect ? durSelect.value : 'VIDEO_LENGTH_SHORT';
        }
      } else if (paramName === 'KEYWORD') {
        const kwInput = valueContainer.querySelector('input[type="text"]');
        let text = kwInput ? kwInput.value.trim() : '';
        if (text) {
          let formattedText = text;
          if (!formattedText.startsWith('"') && !formattedText.endsWith('"')) {
            formattedText = `"${formattedText}"`;
          }
          parsedVal = { name: 'CONTAINS', value: formattedText };
        } else {
          parsedVal = { name: 'CONTAINS', value: '' };
        }
      } else if (paramName === 'CHANNEL_ID') {
        const chInput = valueContainer.querySelector('input[type="text"]');
        let text = chInput ? chInput.value.trim() : '';
        parsedVal = { name: 'IS', value: text };
      } else if (paramName === 'PUBLISH_DATE') {
        const dateInputs = valueContainer.querySelectorAll('input[type="date"]');
        const startVal = dateInputs[0]?.value;
        const endVal = dateInputs[1]?.value;

        if (startVal && endVal) {
          const [sY, sM, sD] = startVal.split('-').map(n => parseInt(n, 10));
          const [eY, eM, eD] = endVal.split('-').map(n => parseInt(n, 10));
          parsedVal = {
            start: { day: sD, month: sM, year: sY },
            end: { day: eD, month: eM, year: eY }
          };
        }
      } else {
        const genInput = valueContainer.querySelector('.rule-value-input');
        let rawVal = genInput ? genInput.value.trim() : '';
        if ((rawVal.startsWith('[') && rawVal.endsWith(']')) || (rawVal.startsWith('{') && rawVal.endsWith('}'))) {
          try {
            parsedVal = JSON.parse(rawVal);
          } catch (_) {
            parsedVal = rawVal;
          }
        } else {
          parsedVal = rawVal;
        }
      }

      if (paramName) {
        filter.push({ name: paramName, value: parsedVal });
      }
    });

    const columnType = editorSortColumn.value;
    const sortOrder = editorSortOrder.value;

    return {
      name,
      filter,
      sort: { columnType, sortOrder }
    };
  }

  async function handleSavePreset() {
    try {
      let updatedFilter;
      let updatedSort;
      let name = editorPresetName.value.trim() || 'Untitled Preset';

      if (currentEditMode === 'visual') {
        const visualData = extractPresetFromVisualForm();
        updatedFilter = visualData.filter;
        updatedSort = visualData.sort;
      } else {
        // Raw JSON mode
        updatedFilter = JSON.parse(editorJsonFilter.value);
        updatedSort = JSON.parse(editorJsonSort.value);
      }

      if (editingPresetId) {
        // Update existing
        const index = currentData.presets.findIndex(p => p.id === editingPresetId);
        if (index !== -1) {
          currentData.presets[index] = {
            id: editingPresetId,
            name: name,
            filter: updatedFilter,
            sort: updatedSort
          };
        }
      } else {
        // Create new
        const newPreset = {
          id: 'preset_' + Date.now(),
          name: name,
          filter: updatedFilter,
          sort: updatedSort
        };
        currentData.presets.push(newPreset);
        currentData.activePresetId = newPreset.id;
      }

      await chrome.storage.sync.set({
        presets: currentData.presets,
        activePresetId: currentData.activePresetId
      });

      renderPresetsDropdown();
      renderActivePresetDetails();
      closeModal();
      showStatus(`Saved preset: ${name}`);
    } catch (err) {
      showStatus('Failed to save preset: ' + err.message, true);
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

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
});

