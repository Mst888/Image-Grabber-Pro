(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  const STORAGE_KEY = 'ibd_selectedImages_v1';
  const QUALITY_KEY = 'ibd_jpegQuality_v1';
  const ENABLED_KEY = 'ibd_enabled_v1';
  const LOCATION_KEY = 'ibd_downloadLocation_v1';

  // New keys
  const FORMAT_KEY = 'ibd_outputFormat_v1';
  const FOLDER_KEY = 'ibd_folderName_v1';
  const LOW_PERF_KEY = 'ibd_lowPerf_v1';
  const PREVIEW_KEY = 'ibd_previews_v1';
  const OVERLAY_KEY = 'ibd_overlays_v1';
  const BATCH_SIZE_KEY = 'ibd_batchSize_v1';
  const DELAY_KEY = 'ibd_downloadDelay_v1';
  const MAX_SELECT_KEY = 'ibd_maxSelection_v1';
  const LAZY_KEY = 'ibd_lazyProcess_v1';

  const selectedCountEl = document.getElementById('selectedCount');
  const downloadBtn = document.getElementById('downloadBtn');
  const clearBtn = document.getElementById('clearBtn');
  const statusEl = document.getElementById('status');
  const qualityEl = document.getElementById('quality');
  const qualityValueEl = document.getElementById('qualityValue');
  const qualityFieldEl = document.getElementById('qualityField');
  const downloadLocationEl = document.getElementById('downloadLocation');
  const enabledToggleEl = document.getElementById('enabledToggle');

  // New elements
  const outputFormatEl = document.getElementById('outputFormat');
  const folderNameEl = document.getElementById('folderName');
  const lowPerfToggleEl = document.getElementById('lowPerfToggle');
  const previewToggleEl = document.getElementById('previewToggle');
  const overlayToggleEl = document.getElementById('overlayToggle');
  const batchSizeEl = document.getElementById('batchSize');
  const downloadDelayEl = document.getElementById('downloadDelay');
  const maxSelectionEl = document.getElementById('maxSelection');
  const lazyProcessToggleEl = document.getElementById('lazyProcessToggle');

  function setStatus(text, isError) {
    statusEl.textContent = text || '';
    statusEl.classList.toggle('ibd-status-error', Boolean(isError));
  }

  function clampQuality(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 90;
    return Math.min(100, Math.max(10, Math.round(n)));
  }

  async function getActiveTabId() {
    const tabs = await api.tabs.query({ active: true, currentWindow: true });
    if (!tabs || !tabs.length || !tabs[0].id) return null;
    return tabs[0].id;
  }

  async function updateSelectedCount() {
    const stored = await api.storage.local.get(STORAGE_KEY);
    const selection = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
    selectedCountEl.textContent = String(selection.length);
    downloadBtn.disabled = selection.length === 0;
  }

  async function loadSettings() {
    const stored = await api.storage.local.get([
      ENABLED_KEY, QUALITY_KEY, LOCATION_KEY, FORMAT_KEY,
      FOLDER_KEY, LOW_PERF_KEY, PREVIEW_KEY, OVERLAY_KEY,
      BATCH_SIZE_KEY, DELAY_KEY, MAX_SELECT_KEY, LAZY_KEY
    ]);

    enabledToggleEl.checked = Boolean(stored[ENABLED_KEY] ?? false);

    const q = clampQuality(stored[QUALITY_KEY] ?? 90);
    qualityEl.value = String(q);
    qualityValueEl.textContent = String(q);

    downloadLocationEl.value = stored[LOCATION_KEY] || 'default';
    outputFormatEl.value = stored[FORMAT_KEY] || 'original';
    folderNameEl.value = stored[FOLDER_KEY] || '';

    lowPerfToggleEl.checked = Boolean(stored[LOW_PERF_KEY] ?? false);
    previewToggleEl.checked = Boolean(stored[PREVIEW_KEY] ?? true);
    overlayToggleEl.checked = Boolean(stored[OVERLAY_KEY] ?? true);

    batchSizeEl.value = stored[BATCH_SIZE_KEY] ?? 5;
    downloadDelayEl.value = stored[DELAY_KEY] ?? 100;
    maxSelectionEl.value = stored[MAX_SELECT_KEY] ?? 50;
    lazyProcessToggleEl.checked = Boolean(stored[LAZY_KEY] ?? false);

    updateQualityVisibility();
  }

  function updateQualityVisibility() {
    const format = outputFormatEl.value;
    qualityFieldEl.style.display = (format === 'jpeg' || format === 'webp') ? 'block' : 'none';
  }

  async function saveSetting(key, value) {
    await api.storage.local.set({ [key]: value });
  }

  async function clearSelectionOnPage() {
    const tabId = await getActiveTabId();
    if (!tabId) return;
    try {
      await api.tabs.sendMessage(tabId, { type: 'IBD_CLEAR_SELECTION' });
    } catch (_) { }
  }

  async function requestDownload() {
    const stored = await api.storage.local.get(STORAGE_KEY);
    const selection = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
    if (!selection.length) {
      setStatus('No images selected.', true);
      return;
    }

    const settings = await api.storage.local.get([
      QUALITY_KEY, LOCATION_KEY, FORMAT_KEY, FOLDER_KEY,
      BATCH_SIZE_KEY, DELAY_KEY, LAZY_KEY
    ]);

    setStatus('Preparing downloads...');

    const response = await api.runtime.sendMessage({
      type: 'IBD_DOWNLOAD_SELECTED',
      payload: {
        urls: selection,
        quality: clampQuality(settings[QUALITY_KEY] ?? 90),
        downloadLocation: settings[LOCATION_KEY] || 'default',
        format: settings[FORMAT_KEY] || 'original',
        folderName: settings[FOLDER_KEY] || '',
        batchSize: Number(settings[BATCH_SIZE_KEY] || 5),
        downloadDelay: Number(settings[DELAY_KEY] || 100),
        lazy: Boolean(settings[LAZY_KEY]),
        lowPerf: !!settings[LOW_PERF_KEY]
      },
    });

    if (response && response.ok) {
      setStatus(`Started downloading ${selection.length} image(s).`);
      return;
    }

    const failures = response && Array.isArray(response.failures) ? response.failures : null;
    if (failures && failures.length) {
      const okCount = Math.max(0, selection.length - failures.length);
      setStatus(`Downloaded ${okCount}/${selection.length}. Failed: ${failures.length}.`, true);
      return;
    }

    const msg = response && response.error ? response.error : 'Download failed.';
    setStatus(msg, true);
  }

  // Event Listeners
  qualityEl.addEventListener('input', () => {
    const q = clampQuality(qualityEl.value);
    qualityValueEl.textContent = String(q);
  });

  qualityEl.addEventListener('change', () => saveSetting(QUALITY_KEY, clampQuality(qualityEl.value)));
  downloadLocationEl.addEventListener('change', () => saveSetting(LOCATION_KEY, downloadLocationEl.value));
  outputFormatEl.addEventListener('change', () => {
    saveSetting(FORMAT_KEY, outputFormatEl.value);
    updateQualityVisibility();
  });
  folderNameEl.addEventListener('input', () => saveSetting(FOLDER_KEY, folderNameEl.value));

  lowPerfToggleEl.addEventListener('change', () => {
    const enabled = lowPerfToggleEl.checked;
    saveSetting(LOW_PERF_KEY, enabled);
    if (enabled) {
      previewToggleEl.checked = false;
      overlayToggleEl.checked = false;
      saveSetting(PREVIEW_KEY, false);
      saveSetting(OVERLAY_KEY, false);
    }
  });

  previewToggleEl.addEventListener('change', () => saveSetting(PREVIEW_KEY, previewToggleEl.checked));
  overlayToggleEl.addEventListener('change', () => saveSetting(OVERLAY_KEY, overlayToggleEl.checked));
  batchSizeEl.addEventListener('change', () => saveSetting(BATCH_SIZE_KEY, Number(batchSizeEl.value)));
  downloadDelayEl.addEventListener('change', () => saveSetting(DELAY_KEY, Number(downloadDelayEl.value)));
  maxSelectionEl.addEventListener('change', () => saveSetting(MAX_SELECT_KEY, Number(maxSelectionEl.value)));
  lazyProcessToggleEl.addEventListener('change', () => saveSetting(LAZY_KEY, lazyProcessToggleEl.checked));

  enabledToggleEl.addEventListener('change', async () => {
    const enabled = enabledToggleEl.checked;
    await saveSetting(ENABLED_KEY, enabled);

    const tabId = await getActiveTabId();
    if (tabId) {
      try {
        await api.tabs.sendMessage(tabId, { type: 'IBD_SET_ENABLED', payload: { enabled } });
      } catch (_) { }
    }

    if (!enabled) {
      setStatus('Selection mode off.');
      await clearSelectionOnPage();
      await updateSelectedCount();
    } else {
      setStatus('Selection mode on.');
    }
  });

  clearBtn.addEventListener('click', async () => {
    setStatus('Clearing selection...');
    await clearSelectionOnPage();
    await updateSelectedCount();
    setStatus('Selection cleared.');
  });

  downloadBtn.addEventListener('click', async () => {
    try {
      await requestDownload();
    } catch (err) {
      setStatus(err?.message || 'Download failed.', true);
    }
  });

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    if (changes[STORAGE_KEY]) updateSelectedCount();
    if (changes[ENABLED_KEY]) enabledToggleEl.checked = Boolean(changes[ENABLED_KEY].newValue);
    if (changes[LOW_PERF_KEY]) {
      const lowPerf = Boolean(changes[LOW_PERF_KEY].newValue);
      lowPerfToggleEl.checked = lowPerf;
      if (lowPerf) {
        previewToggleEl.checked = false;
        overlayToggleEl.checked = false;
      }
    }
  });

  (async () => {
    setStatus('');
    await loadSettings();
    await updateSelectedCount();

    const tabId = await getActiveTabId();
    if (tabId) {
      try {
        await api.tabs.sendMessage(tabId, { type: 'IBD_SYNC_HIGHLIGHTS' });
      } catch (_) { }
    }
  })();
})();
