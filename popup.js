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

  const selectedCountEl = document.getElementById('selectedCount');
  const downloadBtn = document.getElementById('downloadBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusEl = document.getElementById('status');
  const qualityEl = document.getElementById('quality');
  const qualityValueEl = document.getElementById('qualityValue');
  const qualityFieldEl = document.getElementById('qualityField');
  const enabledToggleEl = document.getElementById('enabledToggle');
  const outputFormatEl = document.getElementById('outputFormat');
  const askLocationToggleEl = document.getElementById('askLocationToggle');
  const useSubfolderToggleEl = document.getElementById('useSubfolderToggle');
  const subfolderFieldEl = document.getElementById('subfolderField');
  const folderNameEl = document.getElementById('folderName');
  const lowPerfToggleEl = document.getElementById('lowPerfToggle');
  const previewToggleEl = document.getElementById('previewToggle');
  const overlayToggleEl = document.getElementById('overlayToggle');
  const batchSizeEl = document.getElementById('batchSize');
  const downloadDelayEl = document.getElementById('downloadDelay');
  const maxSelectionEl = document.getElementById('maxSelection');
  const lazyProcessToggleEl = document.getElementById('lazyProcessToggle');
  const themeInputs = document.querySelectorAll('input[name="theme"]');

  // New Upgrade Elements
  const selectionModeEl = document.getElementById('selectionMode');
  const previewGalleryEl = document.getElementById('previewGallery');
  const previewDisabledMsg = document.getElementById('previewDisabledMsg');
  const namingModeEl = document.getElementById('namingMode');
  const zipDownloadToggleEl = document.getElementById('zipDownloadToggle');

  function setStatus(text, isError) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('ibd-status-error', Boolean(isError));
  }

  function applyTheme(theme) {
    const themes = ['light', 'dark', 'blue', 'pink', 'spotify', 'gray'];
    themes.forEach(t => document.body.classList.remove(`ibd-theme-${t}`));
    if (theme && themes.includes(theme)) document.body.classList.add(`ibd-theme-${theme}`);
  }

  function updateLowPerfUI(enabled) {
    document.body.classList.toggle('ibd-low-perf', Boolean(enabled));
    if (enabled) {
      previewGalleryEl.style.display = 'none';
      previewDisabledMsg.style.display = 'block';
    } else {
      previewGalleryEl.style.display = 'flex';
      previewDisabledMsg.style.display = 'none';
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
    const lowPerf = (await api.storage.local.get(LOW_PERF_KEY))[LOW_PERF_KEY];
    if (lowPerf) return;

    const stored = await api.storage.local.get(STORAGE_KEY);
    const selection = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];

    previewGalleryEl.innerHTML = '';
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
        // Highlights update will be triggered by storage listener in content.js
      };

      container.appendChild(img);
      container.appendChild(remove);
      previewGalleryEl.appendChild(container);
    });
  }

  async function updateSelectedCount() {
    const stored = await api.storage.local.get(STORAGE_KEY);
    const selection = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
    selectedCountEl.textContent = String(selection.length);
    downloadBtn.disabled = selection.length === 0;
    renderPreviewGallery();
  }

  async function loadSettings() {
    const stored = await api.storage.local.get([
      ENABLED_KEY, QUALITY_KEY, FORMAT_KEY, FOLDER_KEY, USE_SUBFOLDER_KEY, ASK_LOCATION_KEY,
      LOW_PERF_KEY, PREVIEW_KEY, OVERLAY_KEY, BATCH_SIZE_KEY, DELAY_KEY, MAX_SELECT_KEY, LAZY_KEY,
      THEME_KEY, MODE_KEY, NAMING_KEY, TEMPLATE_KEY, ZIP_KEY
    ]);

    enabledToggleEl.checked = !!stored[ENABLED_KEY];
    qualityEl.value = String(clampQuality(stored[QUALITY_KEY] ?? 90));
    qualityValueEl.textContent = qualityEl.value;
    outputFormatEl.value = stored[FORMAT_KEY] || 'original';
    askLocationToggleEl.checked = !!stored[ASK_LOCATION_KEY];
    useSubfolderToggleEl.checked = !!stored[USE_SUBFOLDER_KEY];
    folderNameEl.value = stored[FOLDER_KEY] || '';

    const lowPerf = !!stored[LOW_PERF_KEY];
    lowPerfToggleEl.checked = lowPerf;
    updateLowPerfUI(lowPerf);

    previewToggleEl.checked = stored[PREVIEW_KEY] !== false;
    overlayToggleEl.checked = stored[OVERLAY_KEY] !== false;
    batchSizeEl.value = stored[BATCH_SIZE_KEY] ?? 5;
    downloadDelayEl.value = stored[DELAY_KEY] ?? 100;
    maxSelectionEl.value = stored[MAX_SELECT_KEY] ?? 50;
    lazyProcessToggleEl.checked = !!stored[LAZY_KEY];

    const theme = stored[THEME_KEY] || 'light';
    const radio = document.querySelector(`input[name="theme"][value="${theme}"]`);
    if (radio) radio.checked = true;
    applyTheme(theme);

    // New settings
    selectionModeEl.value = stored[MODE_KEY] || 'normal';
    namingModeEl.value = stored[NAMING_KEY] || 'auto';
    zipDownloadToggleEl.checked = !!stored[ZIP_KEY];

    updateLocationVisibility();
    updateQualityVisibility();
    updateNamingVisibility();
  }

  function updateQualityVisibility() {
    const format = outputFormatEl.value;
    qualityFieldEl.style.display = (format === 'jpeg' || format === 'webp') ? 'block' : 'none';
  }

  function updateLocationVisibility() {
    subfolderFieldEl.style.display = useSubfolderToggleEl.checked ? 'block' : 'none';
  }

  function updateNamingVisibility() {
    customNameField.style.display = namingModeEl.value === 'custom' ? 'block' : 'none';
  }

  async function saveSetting(key, value) {
    await api.storage.local.set({ [key]: value });
  }

  async function requestDownload() {
    const stored = await api.storage.local.get(STORAGE_KEY);
    const selection = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
    if (!selection.length) return setStatus('No images selected.', true);

    const settings = await api.storage.local.get([
      QUALITY_KEY, FORMAT_KEY, FOLDER_KEY, USE_SUBFOLDER_KEY, ASK_LOCATION_KEY,
      BATCH_SIZE_KEY, DELAY_KEY, LAZY_KEY, LOW_PERF_KEY, NAMING_KEY, TEMPLATE_KEY, ZIP_KEY
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
      zipBundle: !!settings[ZIP_KEY],
      pageTitle,
      site
    };

    const resp = await api.runtime.sendMessage({ type: 'IBD_DOWNLOAD_SELECTED', payload });
    if (resp && resp.ok) setStatus('Download started.');
    else setStatus((resp && resp.error) || 'Failed to start download.', true);
  }

  // Listeners
  qualityEl.oninput = () => qualityValueEl.textContent = qualityEl.value;
  qualityEl.onchange = () => saveSetting(QUALITY_KEY, Number(qualityEl.value));
  outputFormatEl.onchange = () => { saveSetting(FORMAT_KEY, outputFormatEl.value); updateQualityVisibility(); };
  askLocationToggleEl.onchange = () => saveSetting(ASK_LOCATION_KEY, askLocationToggleEl.checked);
  useSubfolderToggleEl.onchange = () => { saveSetting(USE_SUBFOLDER_KEY, useSubfolderToggleEl.checked); updateLocationVisibility(); };
  folderNameEl.oninput = () => saveSetting(FOLDER_KEY, folderNameEl.value);

  themeInputs.forEach(i => i.onchange = () => { saveSetting(THEME_KEY, i.value); applyTheme(i.value); });

  lowPerfToggleEl.onchange = () => {
    const enabled = lowPerfToggleEl.checked;
    saveSetting(LOW_PERF_KEY, enabled);
    updateLowPerfUI(enabled);
    if (enabled) {
      saveSetting(PREVIEW_KEY, false); saveSetting(OVERLAY_KEY, false);
      previewToggleEl.checked = false; overlayToggleEl.checked = false;
    }
  };

  previewToggleEl.onchange = () => saveSetting(PREVIEW_KEY, previewToggleEl.checked);
  overlayToggleEl.onchange = () => saveSetting(OVERLAY_KEY, overlayToggleEl.checked);
  batchSizeEl.onchange = () => saveSetting(BATCH_SIZE_KEY, Number(batchSizeEl.value));
  downloadDelayEl.onchange = () => saveSetting(DELAY_KEY, Number(downloadDelayEl.value));
  maxSelectionEl.onchange = () => saveSetting(MAX_SELECT_KEY, Number(maxSelectionEl.value));
  lazyProcessToggleEl.onchange = () => saveSetting(LAZY_KEY, lazyProcessToggleEl.checked);

  // New Listeners
  selectionModeEl.onchange = () => saveSetting(MODE_KEY, selectionModeEl.value);
  namingModeEl.onchange = () => { saveSetting(NAMING_KEY, namingModeEl.value); updateNamingVisibility(); };
  zipDownloadToggleEl.onchange = () => saveSetting(ZIP_KEY, zipDownloadToggleEl.checked);

  enabledToggleEl.onchange = async () => {
    const enabled = enabledToggleEl.checked;
    await saveSetting(ENABLED_KEY, enabled);
    const tabId = await getActiveTabId();
    if (tabId) try { await api.tabs.sendMessage(tabId, { type: 'IBD_SET_ENABLED', payload: { enabled } }); } catch (_) { }
    if (!enabled) { await saveSetting(STORAGE_KEY, []); await updateSelectedCount(); setStatus('Selection off.'); }
    else setStatus('Selection on.');
  };

  clearBtn.onclick = async () => {
    await api.storage.local.set({ [STORAGE_KEY]: [] });
    const tabId = await getActiveTabId();
    if (tabId) try { await api.tabs.sendMessage(tabId, { type: 'IBD_CLEAR_SELECTION' }); } catch (_) { }
    updateSelectedCount();
    setStatus('Cleared.');
  };

  downloadBtn.onclick = requestDownload;

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEY]) updateSelectedCount();
    if (changes[LOW_PERF_KEY]) updateLowPerfUI(!!changes[LOW_PERF_KEY].newValue);
  });

  (async () => {
    await loadSettings();
    await updateSelectedCount();
  })();
})();
