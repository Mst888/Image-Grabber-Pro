(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  const STORAGE_KEY = 'ibd_selectedImages_v1';
  const QUALITY_KEY = 'ibd_jpegQuality_v1';
  const ENABLED_KEY = 'ibd_enabled_v1';
  const LOCATION_KEY = 'ibd_downloadLocation_v1';
  const FORMAT_KEY = 'ibd_outputFormat_v1';
  const FOLDER_KEY = 'ibd_folderName_v1';
  const USE_SUBFOLDER_KEY = 'ibd_useSubfolder_v1';
  const ASK_LOCATION_KEY = 'ibd_askLocation_v1';
  const LOW_PERF_KEY = 'ibd_lowPerf_v1';
  const PREVIEW_KEY = 'ibd_previews_v1';
  const OVERLAY_KEY = 'ibd_overlays_v1';
  const BATCH_SIZE_KEY = 'ibd_batchSize_v1';
  const DELAY_KEY = 'ibd_downloadDelay_v1';
  const MAX_SELECT_KEY = 'ibd_maxSelection_v1';
  const LAZY_KEY = 'ibd_lazyProcess_v1';
  const THEME_KEY = 'ibd_theme_v1';

  // New Upgrade Keys
  const MODE_KEY = 'ibd_selectionMode_v1';
  const NAMING_KEY = 'ibd_namingMode_v1';
  const ZIP_KEY = 'ibd_zipEnabled_v1';
  const TEMPLATE_KEY = 'ibd_customTemplate_v1';
  const ASPECT_RATIO_KEY = 'ibd_aspectRatio_v1';
  const CUSTOM_RATIO_W_KEY = 'ibd_customRatioW_v1';
  const CUSTOM_RATIO_H_KEY = 'ibd_customRatioH_v1';
  const CROP_MODE_KEY = 'ibd_cropMode_v1';
  const STAY_OPEN_KEY = 'ibd_stayOpen_v1';
  const POPUP_SIZE_PRESET_KEY = 'ibd_popupSizePreset_v1';
  const POPUP_WIDTH_KEY = 'ibd_popupWidth_v1';
  const POPUP_HEIGHT_KEY = 'ibd_popupHeight_v1';
  const CLEAR_ON_DISABLE_KEY = 'ibd_clearOnDisable_v1';
  const SHORTCUTS_ENABLED_KEY = 'ibd_shortcutsEnabled_v1';
  const SHORTCUTS_DATA_KEY = 'ibd_shortcutsData_v1';

  const DEFAULT_SHORTCUTS = {
    toggleSelection: { key: 's', alt: true, ctrl: false, shift: false },
    selectAll: { key: 'a', alt: true, ctrl: false, shift: false },
    clearSelection: { key: 'c', alt: true, ctrl: false, shift: false },
    download: { key: 'd', alt: true, ctrl: false, shift: false },
    downloadZip: { key: 'z', alt: true, ctrl: false, shift: false },
    togglePreview: { key: 'p', alt: true, ctrl: false, shift: false },
    toggleLowPerf: { key: 'l', alt: true, ctrl: false, shift: false }
  };

  // Element references
  const els = {
    selectedCount: document.getElementById('selectedCount'),
    downloadBtn: document.getElementById('downloadBtn'),
    clearBtn: document.getElementById('clearBtn'),
    status: document.getElementById('status'),
    quality: document.getElementById('quality'),
    qualityValue: document.getElementById('qualityValue'),
    qualityField: document.getElementById('qualityField'),
    enabledToggle: document.getElementById('enabledToggle'),
    outputFormat: document.getElementById('outputFormat'),
    askLocationToggle: document.getElementById('askLocationToggle'),
    useSubfolderToggle: document.getElementById('useSubfolderToggle'),
    subfolderField: document.getElementById('subfolderField'),
    folderName: document.getElementById('folderName'),
    lowPerfToggle: document.getElementById('lowPerfToggle'),
    previewToggle: document.getElementById('previewToggle'),
    overlayToggle: document.getElementById('overlayToggle'),
    batchSize: document.getElementById('batchSize'),
    downloadDelay: document.getElementById('downloadDelay'),
    maxSelection: document.getElementById('maxSelection'),
    lazyProcessToggle: document.getElementById('lazyProcessToggle'),
    selectionMode: document.getElementById('selectionMode'),
    previewGallery: document.getElementById('previewGallery'),
    previewDisabledMsg: document.getElementById('previewDisabledMsg'),
    namingMode: document.getElementById('namingMode'),
    customNameField: document.getElementById('customNameField'),
    customTemplate: document.getElementById('customTemplate'),
    zipDownloadToggle: document.getElementById('zipDownloadToggle'),
    aspectRatio: document.getElementById('aspectRatio'),
    customRatioField: document.getElementById('customRatioField'),
    customRatioW: document.getElementById('customRatioW'),
    customRatioH: document.getElementById('customRatioH'),
    cropModeField: document.getElementById('cropModeField'),
    cropMode: document.getElementById('cropMode'),
    // Settings Panel Elements
    homeView: document.getElementById('homeView'),
    settingsView: document.getElementById('settingsView'),
    settingsBtn: document.getElementById('settingsBtn'),
    backBtn: document.getElementById('backBtn'),
    stayOpenToggle: document.getElementById('stayOpenToggle'),
    popupSizePreset: document.getElementById('popupSizePreset'),
    customSizeFields: document.getElementById('customSizeFields'),
    popupWidth: document.getElementById('popupWidth'),
    popupHeight: document.getElementById('popupHeight'),
    themeRadios: document.querySelectorAll('input[name="theme"]'),
    shortcutsToggle: document.getElementById('shortcutsToggle'),
    resetShortcutsBtn: document.getElementById('resetShortcutsBtn'),
    shortcutOverlay: document.getElementById('shortcutOverlay'),
    recorderActionName: document.getElementById('recorderActionName'),
    recorderKeys: document.getElementById('recorderKeys'),
    editShortcutBtns: document.querySelectorAll('.ibd-edit-shortcut')
  };

  let recordingAction = null;
  let currentShortcuts = { ...DEFAULT_SHORTCUTS };

  function setStatus(text, isError) {
    els.status.textContent = text || '';
    els.status.classList.toggle('ibd-status-error', Boolean(isError));
  }

  function applyTheme(theme) {
    const themes = ['light', 'dark', 'blue', 'pink', 'spotify', 'gray'];
    themes.forEach(t => document.body.classList.remove(`ibd-theme-${t}`));
    if (theme && themes.includes(theme)) document.body.classList.add(`ibd-theme-${theme}`);
  }

  function updateLowPerfUI(enabled) {
    document.body.classList.toggle('ibd-low-perf', Boolean(enabled));
    if (enabled) {
      els.previewGallery.style.display = 'none';
      els.previewDisabledMsg.style.display = 'block';
      els.aspectRatio.disabled = true;
      setStatus('Aspect ratio disabled in low-perf mode.', false);
    } else {
      els.previewGallery.style.display = 'flex';
      els.previewDisabledMsg.style.display = 'none';
      els.aspectRatio.disabled = false;
    }
  }

  function clampQuality(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 90;
    return Math.min(100, Math.max(10, Math.round(n)));
  }

  async function getActiveTabId() {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    return (tabs && tabs[0] && tabs[0].id) || null;
  }

  async function renderPreviewGallery() {
    const storedPerf = await api.storage.local.get(LOW_PERF_KEY);
    if (storedPerf[LOW_PERF_KEY]) return;

    const stored = await api.storage.local.get(STORAGE_KEY);
    const selection = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];

    els.previewGallery.innerHTML = '';
    selection.forEach(url => {
      const container = document.createElement('div');
      container.className = 'ibd-thumb-container';
      container.title = 'Click to remove';

      const img = document.createElement('img');
      img.src = url;
      img.className = 'ibd-thumb-img';

      const remove = document.createElement('div');
      remove.className = 'ibd-thumb-remove';
      remove.textContent = '×';

      container.onclick = async () => {
        const current = await api.storage.local.get(STORAGE_KEY);
        const list = Array.isArray(current[STORAGE_KEY]) ? current[STORAGE_KEY] : [];
        const filtered = list.filter(u => u !== url);
        await api.storage.local.set({ [STORAGE_KEY]: filtered });
        const tabId = await getActiveTabId();
        if (tabId) try { await api.tabs.sendMessage(tabId, { type: 'IBD_SYNC_HIGHLIGHTS' }); } catch (_) { }
        updateSelectedCount();
      };

      container.appendChild(img);
      container.appendChild(remove);
      els.previewGallery.appendChild(container);
    });
  }

  async function updateSelectedCount() {
    const stored = await api.storage.local.get(STORAGE_KEY);
    const selection = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
    els.selectedCount.textContent = String(selection.length);
    els.downloadBtn.disabled = selection.length === 0;
    renderPreviewGallery();
  }

  async function loadSettings() {
    const stored = await api.storage.local.get([
      ENABLED_KEY, QUALITY_KEY, FORMAT_KEY, FOLDER_KEY, USE_SUBFOLDER_KEY, ASK_LOCATION_KEY,
      LOW_PERF_KEY, PREVIEW_KEY, OVERLAY_KEY, BATCH_SIZE_KEY, DELAY_KEY, MAX_SELECT_KEY, LAZY_KEY,
      THEME_KEY, MODE_KEY, NAMING_KEY, TEMPLATE_KEY, ZIP_KEY,
      ASPECT_RATIO_KEY, CUSTOM_RATIO_W_KEY, CUSTOM_RATIO_H_KEY, CROP_MODE_KEY,
      STAY_OPEN_KEY, POPUP_SIZE_PRESET_KEY, POPUP_WIDTH_KEY, POPUP_HEIGHT_KEY,
      CLEAR_ON_DISABLE_KEY, SHORTCUTS_ENABLED_KEY, SHORTCUTS_DATA_KEY
    ]);

    els.enabledToggle.checked = !!stored[ENABLED_KEY];
    els.quality.value = String(clampQuality(stored[QUALITY_KEY] ?? 90));
    els.qualityValue.textContent = els.quality.value;
    els.outputFormat.value = stored[FORMAT_KEY] || 'original';
    els.askLocationToggle.checked = !!stored[ASK_LOCATION_KEY];
    els.useSubfolderToggle.checked = !!stored[USE_SUBFOLDER_KEY];
    els.folderName.value = stored[FOLDER_KEY] || '';

    const lowPerf = !!stored[LOW_PERF_KEY];
    els.lowPerfToggle.checked = lowPerf;
    updateLowPerfUI(lowPerf);

    els.previewToggle.checked = stored[PREVIEW_KEY] !== false;
    els.overlayToggle.checked = stored[OVERLAY_KEY] !== false;
    els.batchSize.value = stored[BATCH_SIZE_KEY] ?? 5;
    els.downloadDelay.value = stored[DELAY_KEY] ?? 100;
    els.maxSelection.value = stored[MAX_SELECT_KEY] ?? 50;
    els.lazyProcessToggle.checked = !!stored[LAZY_KEY];

    const theme = stored[THEME_KEY] || 'light';
    els.themeRadios.forEach(r => { if (r.value === theme) r.checked = true; });
    applyTheme(theme);

    els.selectionMode.value = stored[MODE_KEY] || 'normal';
    els.namingMode.value = stored[NAMING_KEY] || 'auto';
    els.customTemplate.value = stored[TEMPLATE_KEY] || '';
    els.zipDownloadToggle.checked = !!stored[ZIP_KEY];

    els.aspectRatio.value = stored[ASPECT_RATIO_KEY] || 'original';
    els.customRatioW.value = stored[CUSTOM_RATIO_W_KEY] || 1;
    els.customRatioH.value = stored[CUSTOM_RATIO_H_KEY] || 1;
    els.cropMode.value = stored[CROP_MODE_KEY] || 'fill';
    els.stayOpenToggle.checked = !!stored[STAY_OPEN_KEY];
    els.popupSizePreset.value = stored[POPUP_SIZE_PRESET_KEY] || 'medium';
    els.popupWidth.value = stored[POPUP_WIDTH_KEY] || 380;
    els.popupHeight.value = stored[POPUP_HEIGHT_KEY] || 500;
    if (els.clearOnDisableToggle) els.clearOnDisableToggle.checked = !!stored[CLEAR_ON_DISABLE_KEY];

    if (els.shortcutsToggle) els.shortcutsToggle.checked = stored[SHORTCUTS_ENABLED_KEY] !== false;
    currentShortcuts = stored[SHORTCUTS_DATA_KEY] || { ...DEFAULT_SHORTCUTS };
    updateShortcutUI();

    updateLocationVisibility();
    updateQualityVisibility();
    updateNamingVisibility();
    updateRatioVisibility();
    updateSizeVisibility();
    applyPopupSize();
  }

  function updateRatioVisibility() {
    const ratio = els.aspectRatio.value;
    els.customRatioField.style.display = ratio === 'custom' ? 'flex' : 'none';
    els.cropModeField.style.display = ratio === 'original' ? 'none' : 'block';
  }

  function updateQualityVisibility() {
    const format = els.outputFormat.value;
    els.qualityField.style.display = (format === 'jpeg' || format === 'webp') ? 'block' : 'none';
  }

  function updateLocationVisibility() {
    els.subfolderField.style.display = els.useSubfolderToggle.checked ? 'block' : 'none';
  }

  function updateNamingVisibility() {
    els.customNameField.style.display = els.namingMode.value === 'custom' ? 'block' : 'none';
  }

  function updateSizeVisibility() {
    els.customSizeFields.style.display = els.popupSizePreset.value === 'custom' ? 'flex' : 'none';
  }

  function showView(viewName) {
    els.homeView.style.display = 'none';
    els.settingsView.style.display = 'none';
    if (viewName === 'home') {
      els.homeView.style.display = 'block';
    } else if (viewName === 'settings') {
      els.settingsView.style.display = 'block';
    }
  }

  function applyPopupSize() {
    const preset = els.popupSizePreset.value;
    let width, height;

    switch (preset) {
      case 'small': width = 300; height = 400; break;
      case 'medium': width = 380; height = 500; break;
      case 'large': width = 450; height = 600; break;
      case 'custom':
        width = Number(els.popupWidth.value);
        height = Number(els.popupHeight.value);
        break;
      default: width = 380; height = 500; break;
    }

    width = Math.max(300, Math.min(800, width));
    height = Math.max(400, Math.min(600, height));

    document.documentElement.style.setProperty('--ibd-popup-width', `${width}px`);
    document.documentElement.style.setProperty('--ibd-popup-height', `${height}px`);
    document.body.style.width = `${width}px`;
    document.body.style.height = `${height}px`;
  }

  async function saveSetting(key, value) {
    await api.storage.local.set({ [key]: value });
  }

  // --- SHORTCUTS LOGIC ---
  function formatShortcut(s) {
    if (!s || !s.key) return 'None';
    const parts = [];
    if (s.ctrl) parts.push('Ctrl');
    if (s.alt) parts.push('Alt');
    if (s.shift) parts.push('Shift');
    parts.push(s.key.toUpperCase());
    return parts.join('+');
  }

  function updateShortcutUI() {
    for (const [action, data] of Object.entries(currentShortcuts)) {
      const el = document.getElementById(`kb-${action}`);
      if (el) el.textContent = formatShortcut(data);
    }
  }

  function startRecording(action) {
    recordingAction = action;
    els.recorderActionName.textContent = action.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
    els.recorderKeys.textContent = 'Press keys...';
    els.shortcutOverlay.style.display = 'flex';
  }

  function stopRecording(save) {
    if (save && recordingAction && lastRecorded) {
      currentShortcuts[recordingAction] = lastRecorded;
      saveSetting(SHORTCUTS_DATA_KEY, currentShortcuts);
      updateShortcutUI();
    }
    recordingAction = null;
    lastRecorded = null;
    els.shortcutOverlay.style.display = 'none';
  }

  let lastRecorded = null;
  window.addEventListener('keydown', (e) => {
    if (recordingAction) {
      e.preventDefault();
      if (e.key === 'Escape') return stopRecording(false);
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) return;

      lastRecorded = {
        key: e.key.toLowerCase(),
        ctrl: e.ctrlKey,
        alt: e.altKey,
        shift: e.shiftKey
      };
      els.recorderKeys.textContent = formatShortcut(lastRecorded);
      setTimeout(() => stopRecording(true), 400);
      return;
    }

    if (els.shortcutsToggle?.checked) {
      for (const [action, data] of Object.entries(currentShortcuts)) {
        if (e.key.toLowerCase() === data.key &&
          e.ctrlKey === !!data.ctrl &&
          e.altKey === !!data.alt &&
          e.shiftKey === !!data.shift) {
          e.preventDefault();
          executeAction(action);
          break;
        }
      }
    }
  });

  async function executeAction(action) {
    switch (action) {
      case 'toggleSelection':
        if (els.enabledToggle) {
          els.enabledToggle.checked = !els.enabledToggle.checked;
          els.enabledToggle.dispatchEvent(new Event('change'));
        }
        break;
      case 'selectAll':
        const tabId = await getActiveTabId();
        if (tabId) try { await api.tabs.sendMessage(tabId, { type: 'IBD_SELECT_ALL' }); } catch (_) { }
        break;
      case 'clearSelection':
        if (els.clearBtn) els.clearBtn.click();
        break;
      case 'download':
        if (els.downloadBtn && !els.downloadBtn.disabled) els.downloadBtn.click();
        break;
      case 'downloadZip':
        if (els.zipDownloadToggle) {
          const wasChecked = els.zipDownloadToggle.checked;
          els.zipDownloadToggle.checked = true;
          await requestDownload();
          els.zipDownloadToggle.checked = wasChecked;
        }
        break;
      case 'togglePreview':
        if (els.previewToggle) {
          els.previewToggle.checked = !els.previewToggle.checked;
          els.previewToggle.dispatchEvent(new Event('change'));
        }
        break;
      case 'toggleLowPerf':
        if (els.lowPerfToggle) {
          els.lowPerfToggle.checked = !els.lowPerfToggle.checked;
          els.lowPerfToggle.dispatchEvent(new Event('change'));
        }
        break;
    }
  }

  async function requestDownload() {
    const stored = await api.storage.local.get(STORAGE_KEY);
    const selection = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
    if (!selection.length) return setStatus('No images selected.', true);

    const settings = await api.storage.local.get([
      QUALITY_KEY, FORMAT_KEY, FOLDER_KEY, USE_SUBFOLDER_KEY, ASK_LOCATION_KEY,
      BATCH_SIZE_KEY, DELAY_KEY, LAZY_KEY, LOW_PERF_KEY, NAMING_KEY, TEMPLATE_KEY, ZIP_KEY,
      ASPECT_RATIO_KEY, CUSTOM_RATIO_W_KEY, CUSTOM_RATIO_H_KEY, CROP_MODE_KEY
    ]);

    const tab = (await api.tabs.query({ active: true, currentWindow: true }))[0];
    const pageTitle = (tab && tab.title) ? tab.title.substring(0, 50).replace(/[\\/:*?"<>|]/g, '_') : 'Images';
    const site = (tab && tab.url) ? new URL(tab.url).hostname : 'any';

    setStatus('Preparing downloads...');
    const payload = {
      urls: selection,
      quality: clampQuality(settings[QUALITY_KEY] ?? 90),
      downloadLocation: settings[ASK_LOCATION_KEY] ? 'ask' : 'default',
      format: settings[FORMAT_KEY] || 'original',
      folderName: settings[USE_SUBFOLDER_KEY] ? (settings[FOLDER_KEY] || '') : '',
      batchSize: Number(settings[BATCH_SIZE_KEY] || 5),
      downloadDelay: Number(settings[DELAY_KEY] || 100),
      lazy: !!settings[LAZY_KEY],
      lowPerf: !!settings[LOW_PERF_KEY],
      namingMode: settings[NAMING_KEY] || 'auto',
      customTemplate: settings[TEMPLATE_KEY] || '',
      zipBundle: els.zipDownloadToggle.checked,
      aspectRatio: els.aspectRatio.value,
      cropMode: els.cropMode.value,
      customRatioW: Number(els.customRatioW.value || 1),
      customRatioH: Number(els.customRatioH.value || 1),
      pageTitle,
      site
    };

    try {
      const res = await api.runtime.sendMessage({ type: 'IBD_DOWNLOAD_SELECTED', payload });
      if (res && res.ok) {
        setStatus('Downloads started!');
        setTimeout(() => {
          setStatus('');
          if (!els.stayOpenToggle?.checked) window.close();
        }, 1500);
      } else if (res && res.failures) {
        setStatus(`Failed to download ${res.failures.length} images.`, true);
      } else {
        setStatus('Error: ' + (res?.error || 'Unknown error'), true);
      }
    } catch (e) {
      setStatus('Sync error: ' + e.message, true);
    }
  }

  // --- SAFE INITIALIZATION ---
  async function init() {
    try {
      await loadSettings();
      await updateSelectedCount();
    } catch (err) {
      console.error('Init error:', err);
      setStatus('Init error: ' + err.message, true);
    }
  }

  // --- LISTENERS ---
  if (els.quality) {
    els.quality.oninput = () => { if (els.qualityValue) els.qualityValue.textContent = els.quality.value; };
    els.quality.onchange = () => saveSetting(QUALITY_KEY, Number(els.quality.value));
  }
  if (els.outputFormat) {
    els.outputFormat.onchange = () => {
      saveSetting(FORMAT_KEY, els.outputFormat.value);
      updateQualityVisibility();
    };
  }
  if (els.askLocationToggle) els.askLocationToggle.onchange = () => saveSetting(ASK_LOCATION_KEY, els.askLocationToggle.checked);
  if (els.useSubfolderToggle) {
    els.useSubfolderToggle.onchange = () => {
      saveSetting(USE_SUBFOLDER_KEY, els.useSubfolderToggle.checked);
      updateLocationVisibility();
    };
  }
  if (els.folderName) els.folderName.oninput = () => saveSetting(FOLDER_KEY, els.folderName.value);

  if (els.themeRadios) {
    els.themeRadios.forEach(i => i.onchange = () => { saveSetting(THEME_KEY, i.value); applyTheme(i.value); });
  }

  if (els.lowPerfToggle) {
    els.lowPerfToggle.onchange = () => {
      const enabled = els.lowPerfToggle.checked;
      saveSetting(LOW_PERF_KEY, enabled);
      updateLowPerfUI(enabled);
      if (enabled) {
        saveSetting(PREVIEW_KEY, false); saveSetting(OVERLAY_KEY, false);
        if (els.previewToggle) els.previewToggle.checked = false;
        if (els.overlayToggle) els.overlayToggle.checked = false;
      }
    };
  }

  if (els.previewToggle) els.previewToggle.onchange = () => saveSetting(PREVIEW_KEY, els.previewToggle.checked);
  if (els.overlayToggle) els.overlayToggle.onchange = () => saveSetting(OVERLAY_KEY, els.overlayToggle.checked);
  if (els.batchSize) els.batchSize.onchange = () => saveSetting(BATCH_SIZE_KEY, Number(els.batchSize.value));
  if (els.downloadDelay) els.downloadDelay.onchange = () => saveSetting(DELAY_KEY, Number(els.downloadDelay.value));
  if (els.maxSelection) els.maxSelection.onchange = () => saveSetting(MAX_SELECT_KEY, Number(els.maxSelection.value));
  if (els.lazyProcessToggle) els.lazyProcessToggle.onchange = () => saveSetting(LAZY_KEY, els.lazyProcessToggle.checked);

  if (els.selectionMode) els.selectionMode.onchange = () => saveSetting(MODE_KEY, els.selectionMode.value);
  if (els.namingMode) {
    els.namingMode.onchange = () => {
      saveSetting(NAMING_KEY, els.namingMode.value);
      updateNamingVisibility();
    };
  }
  if (els.customTemplate) els.customTemplate.oninput = () => saveSetting(TEMPLATE_KEY, els.customTemplate.value);
  if (els.zipDownloadToggle) els.zipDownloadToggle.onchange = () => saveSetting(ZIP_KEY, els.zipDownloadToggle.checked);

  if (els.aspectRatio) {
    els.aspectRatio.onchange = () => {
      saveSetting(ASPECT_RATIO_KEY, els.aspectRatio.value);
      updateRatioVisibility();
    };
  }
  if (els.customRatioW) els.customRatioW.oninput = () => saveSetting(CUSTOM_RATIO_W_KEY, Number(els.customRatioW.value));
  if (els.customRatioH) els.customRatioH.oninput = () => saveSetting(CUSTOM_RATIO_H_KEY, Number(els.customRatioH.value));
  if (els.cropMode) els.cropMode.onchange = () => saveSetting(CROP_MODE_KEY, els.cropMode.value);

  if (els.enabledToggle) {
    els.enabledToggle.onchange = async () => {
      const enabled = els.enabledToggle.checked;
      await saveSetting(ENABLED_KEY, enabled);
      const tabId = await getActiveTabId();
      if (tabId) try { await api.tabs.sendMessage(tabId, { type: 'IBD_SET_ENABLED', payload: { enabled } }); } catch (_) { }
      if (!enabled) {
        if (els.clearOnDisableToggle?.checked) {
          await saveSetting(STORAGE_KEY, []);
          await updateSelectedCount();
          const tabId = await getActiveTabId();
          if (tabId) try { await api.tabs.sendMessage(tabId, { type: 'IBD_CLEAR_SELECTION' }); } catch (_) { }
        }
        setStatus('Selection off.');
      }
      else { setStatus('Selection on.'); }
    };
  }

  if (els.clearBtn) {
    els.clearBtn.onclick = async () => {
      await api.storage.local.set({ [STORAGE_KEY]: [] });
      const tabId = await getActiveTabId();
      if (tabId) try { await api.tabs.sendMessage(tabId, { type: 'IBD_CLEAR_SELECTION' }); } catch (_) { }
      updateSelectedCount();
      setStatus('Cleared.');
    };
  }

  if (els.downloadBtn) els.downloadBtn.onclick = requestDownload;

  if (els.settingsBtn) els.settingsBtn.onclick = () => showView('settings');
  if (els.backBtn) els.backBtn.onclick = () => showView('home');
  if (els.stayOpenToggle) els.stayOpenToggle.onchange = () => saveSetting(STAY_OPEN_KEY, els.stayOpenToggle.checked);
  if (els.clearOnDisableToggle) els.clearOnDisableToggle.onchange = () => saveSetting(CLEAR_ON_DISABLE_KEY, els.clearOnDisableToggle.checked);
  if (els.popupSizePreset) {
    els.popupSizePreset.onchange = () => {
      saveSetting(POPUP_SIZE_PRESET_KEY, els.popupSizePreset.value);
      updateSizeVisibility();
      applyPopupSize();
    };
  }
  if (els.popupWidth) els.popupWidth.oninput = () => { saveSetting(POPUP_WIDTH_KEY, Number(els.popupWidth.value)); applyPopupSize(); };
  if (els.popupHeight) els.popupHeight.oninput = () => { saveSetting(POPUP_HEIGHT_KEY, Number(els.popupHeight.value)); applyPopupSize(); };
  if (els.githubBtn) els.githubBtn.onclick = () => api.tabs.create({ url: 'https://github.com/Mst888/Photo-Grab' });

  if (els.shortcutsToggle) els.shortcutsToggle.onchange = () => saveSetting(SHORTCUTS_ENABLED_KEY, els.shortcutsToggle.checked);
  if (els.resetShortcutsBtn) {
    els.resetShortcutsBtn.onclick = async () => {
      currentShortcuts = { ...DEFAULT_SHORTCUTS };
      await saveSetting(SHORTCUTS_DATA_KEY, currentShortcuts);
      updateShortcutUI();
      setStatus('Shortcuts reset.');
    };
  }
  if (els.editShortcutBtns) {
    els.editShortcutBtns.forEach(btn => {
      btn.onclick = () => startRecording(btn.dataset.action);
    });
  }

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEY]) updateSelectedCount();
    if (changes[LOW_PERF_KEY]) updateLowPerfUI(!!changes[LOW_PERF_KEY].newValue);
  });

  init();
})();
