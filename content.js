(() => {
  const api = browser;

  const STORAGE_KEY = 'ibd_selectedImages_v1';
  const ATTR_SELECTED = 'data-ibd-selected';
  const ENABLED_KEY = 'ibd_enabled_v1';
  const LOW_PERF_KEY = 'ibd_lowPerf_v1';
  const PREVIEW_KEY = 'ibd_previews_v1';
  const OVERLAY_KEY = 'ibd_overlays_v1';
  const MAX_SELECT_KEY = 'ibd_maxSelection_v1';
  const THEME_KEY = 'ibd_theme_v1';
  const MODE_KEY = 'ibd_selectionMode_v1';
  const BADGE_ATTR = 'data-ibd-badge';
  const TOOLBAR_ID = 'ibd-toolbar-v1';
  const CONVERTER_TOOLBAR_ID = 'ibd-converter-toolbar-v1';
  const SHORTCUTS_ENABLED_KEY = 'ibd_shortcutsEnabled_v1';
  const SHORTCUTS_DATA_KEY = 'ibd_shortcutsData_v1';
  const CONVERTER_ENABLED_KEY = 'ibd_converterEnabled_v1';
  const CONVERTER_TOOLBAR_KEY = 'ibd_converterToolbarVisible_v1';
  const CONVERTER_FORMAT_KEY = 'ibd_converterDefaultFormat_v1';
  const CONVERTER_QUALITY_KEY = 'ibd_converterQuality_v1';
  const CONVERTER_AUTO_DOWNLOAD_KEY = 'ibd_converterAutoDownload_v1';

  const DEFAULT_SHORTCUTS = {
    toggleSelection: { key: 'e', alt: true, ctrl: false, shift: false },
    selectAll: { key: 'a', alt: true, ctrl: false, shift: false },
    clearSelection: { key: 'x', alt: true, ctrl: false, shift: false },
    download: { key: 'd', alt: true, ctrl: false, shift: false },
    downloadZip: { key: 'z', alt: true, ctrl: false, shift: false },
    togglePreview: { key: 'p', alt: true, ctrl: false, shift: false },
    toggleLowPerf: { key: 'l', alt: true, ctrl: false, shift: false },
    toggleConverter: { key: 'c', alt: true, ctrl: false, shift: false }
  };

  let settingsCache = {
    enabled: false,
    lowPerf: false,
    previews: true,
    overlays: true,
    maxSelection: 50,
    theme: 'light',
    mode: 'normal',
    shortcutsEnabled: true,
    shortcuts: { ...DEFAULT_SHORTCUTS },
    converterEnabled: false,
    converterToolbarVisible: false,
    converterFormat: 'jpeg',
    converterQuality: 90,
    converterAutoDownload: true
  };

  let areaRect = null;
  let isDragging = false;
  let dragStart = { x: 0, y: 0 };

  // --- UTILS ---
  function normalizeUrl(url) {
    if (!url) return null;
    const trimmed = String(url).trim();
    return trimmed || null;
  }

  function resolveUrl(maybeUrl) {
    const norm = normalizeUrl(maybeUrl);
    if (!norm) return null;
    try {
      return new URL(norm, document.baseURI).toString();
    } catch (_) {
      return norm;
    }
  }

  function pickBestSrcsetUrl(srcset) {
    if (!srcset) return null;
    const parts = srcset.split(',').map(p => p.trim()).filter(Boolean);
    const parsed = parts.map(part => {
      const tokens = part.split(/\s+/);
      const url = resolveUrl(tokens[0]);
      let score = 0;
      if (tokens[1]) {
        const mW = /^([0-9]+)w$/i.exec(tokens[1]);
        const mX = /^([0-9]*\.?[0-9]+)x$/i.exec(tokens[1]);
        if (mW) score = Number(mW[1]) || 0;
        if (mX) score = (Number(mX[1]) || 0) * 10000;
      }
      return { url, score };
    }).filter(p => p.url);
    if (!parsed.length) return null;
    return parsed.sort((a, b) => b.score - a.score)[0].url;
  }

  function extractUrlFromBackgroundImage(bgValue) {
    if (!bgValue || bgValue === 'none') return null;
    const m = /url\((['"]?)(.*?)\1\)/i.exec(bgValue);
    return m ? resolveUrl(m[2]) : null;
  }

  function getCandidateImgUrl(imgEl) {
    if (!imgEl) return null;
    const picture = imgEl.closest('picture');
    if (picture) {
      const source = picture.querySelector('source');
      if (source) {
        const url = pickBestSrcsetUrl(source.getAttribute('srcset') || source.getAttribute('data-srcset'));
        if (url) return url;
      }
    }
    const srcset = imgEl.getAttribute('srcset') || imgEl.getAttribute('data-srcset');
    const srcsetBest = pickBestSrcsetUrl(srcset);
    if (srcsetBest) return srcsetBest;
    const candidates = [imgEl.currentSrc, imgEl.src, imgEl.getAttribute('src'), imgEl.getAttribute('data-src')];
    for (const c of candidates) {
      const norm = resolveUrl(c);
      if (norm) return norm;
    }
    return null;
  }

  async function getSelection() {
    const result = await api.storage.local.get(STORAGE_KEY);
    return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  }

  async function setSelection(urls) {
    const unique = Array.from(new Set(urls.filter(Boolean))).slice(0, settingsCache.maxSelection);
    await api.storage.local.set({ [STORAGE_KEY]: unique });
    return unique;
  }

  // --- UI HELPERS ---
  function ensureBadge(el) {
    if (settingsCache.lowPerf || !settingsCache.overlays) return;
    if (!(el instanceof Element) || el.querySelector(`span[${BADGE_ATTR}]`)) return;
    const badge = document.createElement('span');
    badge.setAttribute(BADGE_ATTR, '1');
    badge.textContent = '✓';
    el.appendChild(badge);
  }

  function removeBadge(el) {
    if (!(el instanceof Element)) return;
    const b = el.querySelector(`span[${BADGE_ATTR}]`);
    if (b) b.remove();
  }

  function updateToolbarCount(count) {
    const toolbar = document.getElementById(TOOLBAR_ID);
    if (!toolbar) return;
    const countEl = toolbar.querySelector('[data-ibd-count]');
    if (countEl) countEl.textContent = String(count);
    const dlBtn = toolbar.querySelector('[data-ibd-download]');
    if (dlBtn) dlBtn.disabled = count === 0;
  }

  function applyHighlight(el, isSelected) {
    if (!settingsCache.overlays) {
      el.removeAttribute(ATTR_SELECTED);
      removeBadge(el);
      return;
    }
    if (isSelected) {
      el.setAttribute(ATTR_SELECTED, '1');
      if (el.tagName !== 'IMG') ensureBadge(el);
      else {
        const parent = el.parentElement;
        if (parent && parent !== document.body) {
          parent.setAttribute(ATTR_SELECTED, '1');
          ensureBadge(parent);
        }
      }
    } else {
      el.removeAttribute(ATTR_SELECTED);
      removeBadge(el);
      const parent = el.parentElement;
      if (parent) {
        parent.removeAttribute(ATTR_SELECTED);
        removeBadge(parent);
      }
    }
  }

  async function blobToDataUrl(url, imgEl) {
    if (!url || !url.startsWith('blob:')) return url;

    // Attempt 1: Fetch (Standard)
    try {
      const res = await fetch(url);
      const blob = await res.blob();
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (e) {
      console.warn('IBD: fetch failed for blob, trying canvas fallback:', e);

      // Attempt 2: Canvas Fallback (Works if we have the img element and it's not cross-origin tainted)
      // Blobs are same-origin, so they never taint the canvas.
      if (imgEl && imgEl.complete && imgEl.naturalWidth > 0) {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = imgEl.naturalWidth;
          canvas.height = imgEl.naturalHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(imgEl, 0, 0);
          return canvas.toDataURL('image/png');
        } catch (canvasErr) {
          console.error('IBD: Canvas fallback failed:', canvasErr);
        }
      }
      return url;
    }
  }

  async function processUrls(items) {
    // items can be array of URLs or array of {url, el}
    const results = await Promise.all(items.map(async (item) => {
      const url = typeof item === 'string' ? item : item.url;
      const el = typeof item === 'object' ? item.el : null;
      return blobToDataUrl(normalizeUrl(url), el);
    }));
    return results.filter(Boolean);
  }

  async function syncHighlights() {
    const currentlyMarked = document.querySelectorAll(`[${ATTR_SELECTED}], span[${BADGE_ATTR}]`);
    currentlyMarked.forEach(el => {
      el.removeAttribute(ATTR_SELECTED);
      if (el.hasAttribute(BADGE_ATTR)) el.remove();
    });
    if (!settingsCache.enabled || (!settingsCache.overlays && !settingsCache.previews)) return;
    const selection = await getSelection();
    const selectedSet = new Set(selection);

    // For blob-converted data urls, we might need a more flexible check
    const dataUrlShortcuts = new Set(selection.filter(s => s.startsWith('data:')).map(s => s.substring(0, 50)));

    const imgs = document.querySelectorAll('img');
    imgs.forEach(img => {
      const url = getCandidateImgUrl(img);
      if (url) {
        if (selectedSet.has(url) || (url.startsWith('blob:') && dataUrlShortcuts.has(url.substring(0, 50)))) {
          applyHighlight(img, true);
        }
      }
    });

    const bgs = document.querySelectorAll('[style*="background-image"]');
    bgs.forEach(el => {
      const url = extractUrlFromBackgroundImage(el.style.backgroundImage);
      if (url) {
        // Check if regular URL matches or if it's a blob that was converted
        if (selectedSet.has(url) || (url.startsWith('blob:') && dataUrlShortcuts.has(url.substring(0, 50)))) {
          applyHighlight(el, true);
        }
      }
    });
    updateToolbarCount(selection.length);
  }

  async function toggleUrl(url, el) {
    if (!settingsCache.enabled) return;
    const norm = await blobToDataUrl(normalizeUrl(url), el);
    if (!norm) return;
    const selection = await getSelection();
    const set = new Set(selection);
    if (set.has(norm)) set.delete(norm);
    else {
      if (set.size >= settingsCache.maxSelection) return;
      set.add(norm);
    }
    await setSelection(Array.from(set));
    syncHighlights();
  }

  // --- NEW SELECTION MODES ---
  function onMouseDown(e) {
    if (!settingsCache.enabled || settingsCache.mode !== 'area') return;
    if (e.button !== 0 || e.target.closest(`[data-ibd-ui="1"], #${TOOLBAR_ID}`)) return;
    e.preventDefault();
    isDragging = true;
    dragStart = { x: e.clientX, y: e.clientY };
    if (!areaRect) {
      areaRect = document.createElement('div');
      areaRect.className = 'ibd-selection-rect';
      document.body.appendChild(areaRect);
    }
    updateRect(e.clientX, e.clientY);
  }

  function onMouseMove(e) {
    if (!isDragging || !areaRect) return;
    updateRect(e.clientX, e.clientY);
  }

  async function onMouseUp(e) {
    if (!isDragging || !areaRect) return;
    isDragging = false;
    const rect = areaRect.getBoundingClientRect();
    areaRect.remove();
    areaRect = null;
    if (rect.width < 5 && rect.height < 5) return;
    const imgs = document.querySelectorAll('img');
    const toSelect = [];
    imgs.forEach(img => {
      const imgRect = img.getBoundingClientRect();
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w < 32 || h < 32) return;
      const overlaps = !(imgRect.right < rect.left || imgRect.left > rect.right || imgRect.bottom < rect.top || imgRect.top > rect.bottom);
      if (overlaps) {
        const url = getCandidateImgUrl(img);
        if (url) toSelect.push({ url, el: img });
      }
    });
    if (toSelect.length) {
      const current = await getSelection();
      const processed = await processUrls(toSelect);
      await setSelection([...current, ...processed]);
      syncHighlights();
    }
  }

  function updateRect(currentX, currentY) {
    const left = Math.min(dragStart.x, currentX);
    const top = Math.min(dragStart.y, currentY);
    areaRect.style.left = left + 'px';
    areaRect.style.top = top + 'px';
    areaRect.style.width = Math.abs(dragStart.x - currentX) + 'px';
    areaRect.style.height = Math.abs(dragStart.y - currentY) + 'px';
  }

  async function handleSameSizeSelection(imgEl) {
    const w = imgEl.naturalWidth || imgEl.width;
    const h = imgEl.naturalHeight || imgEl.height;
    if (!w || !h) return;
    const imgs = document.querySelectorAll('img');
    const toSelect = [];
    imgs.forEach(img => {
      const imgW = img.naturalWidth || img.width;
      const imgH = img.naturalHeight || img.height;
      if (imgW === w && imgH === h) {
        const url = getCandidateImgUrl(img);
        if (url) toSelect.push(url);
      }
    });
    const current = await getSelection();
    const processed = await processUrls(toSelect);
    await setSelection([...current, ...processed]);
    syncHighlights();
  }

  function updateModeListeners() {
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);
    if (settingsCache.enabled && settingsCache.mode === 'area') {
      document.addEventListener('mousedown', onMouseDown, true);
      document.addEventListener('mousemove', onMouseMove, true);
      document.addEventListener('mouseup', onMouseUp, true);
    }
  }

  // --- CORE LOGIC ---
  document.addEventListener('click', async (e) => {
    if (!settingsCache.enabled || e.button !== 0 || e.ctrlKey || e.metaKey) return;
    const target = e.target;
    if (target.closest(`[data-ibd-ui="1"], #${TOOLBAR_ID}`)) return;
    if (settingsCache.mode === 'area') return;

    if (target.tagName === 'IMG') {
      if (settingsCache.mode === 'sameSize') {
        e.preventDefault(); e.stopPropagation();
        await handleSameSizeSelection(target);
        return;
      }
      if (settingsCache.mode === 'large') {
        const w = target.naturalWidth || target.width;
        const h = target.naturalHeight || target.height;
        if (w < 800 && h < 600) return;
      }
      e.preventDefault(); e.stopPropagation();
      await toggleUrl(getCandidateImgUrl(target), target);
    } else if (settingsCache.mode === 'normal') {
      const bgUrl = extractUrlFromBackgroundImage(window.getComputedStyle(target).backgroundImage);
      if (bgUrl) {
        e.preventDefault(); e.stopPropagation();
        await toggleUrl(bgUrl);
      }
    }
  }, true);

  function ensureToolbar() {
    if (document.getElementById(TOOLBAR_ID) || settingsCache.lowPerf) return;
    const root = document.createElement('div');
    root.id = TOOLBAR_ID;
    if (settingsCache.theme) root.className = `ibd-theme-${settingsCache.theme}`;
    root.innerHTML = `
      <div class="ibd-toolbar" data-ibd-ui="1">
        <div class="ibd-toolbar__left">
          <div class="ibd-toolbar__title">Grabber Pro</div>
          <div class="ibd-toolbar__meta">Selected: <span data-ibd-count>0</span></div>
        </div>
        <div class="ibd-toolbar__actions">
          <button data-ibd-clear class="ibd-toolbar__btn">Clear</button>
          <button data-ibd-download class="ibd-toolbar__btn ibd-toolbar__btn--primary" disabled>Download</button>
        </div>
      </div>
    `;
    document.documentElement.appendChild(root);
    root.querySelector('[data-ibd-clear]').onclick = async () => { await setSelection([]); syncHighlights(); };
    root.querySelector('[data-ibd-download]').onclick = () => { api.runtime.sendMessage({ type: 'IBD_DOWNLOAD_REQUEST_FROM_PAGE' }); };
  }

  function ensureConverterToolbar() {
    if (document.getElementById(CONVERTER_TOOLBAR_ID)) return;
    if (!settingsCache.converterEnabled || !settingsCache.converterToolbarVisible) return;

    const root = document.createElement('div');
    root.id = CONVERTER_TOOLBAR_ID;
    if (settingsCache.theme) root.className = `ibd-theme-${settingsCache.theme}`;
    root.innerHTML = `
      <div class="ibd-converter-toolbar" data-ibd-ui="1">
        <div class="ibd-converter-header">
          <div class="ibd-converter-title">🔄 Photo Converter</div>
          <button class="ibd-converter-close" data-converter-close title="Close">×</button>
        </div>
        <div class="ibd-converter-body">
          <input type="file" id="converterFileInput" accept="image/*" multiple style="display:none;" />
          <button class="ibd-converter-upload-btn" data-converter-upload>
            <span>📁 Upload Image</span>
          </button>
          <div class="ibd-converter-preview" data-converter-preview style="display:none;">
            <img data-converter-img style="max-width: 100%; max-height: 150px; border-radius: 6px;" />
            <div data-converter-filename style="font-size: 11px; margin-top: 4px; color: var(--ibd-text-sub);"></div>
          </div>
          <div class="ibd-converter-controls">
            <label class="ibd-converter-label">Format:</label>
            <select class="ibd-converter-select" data-converter-format>
              <option value="jpeg">JPEG</option>
              <option value="png">PNG</option>
              <option value="webp">WEBP</option>
            </select>
            <label class="ibd-converter-label">Quality:</label>
            <input type="range" class="ibd-converter-range" data-converter-quality min="60" max="100" value="90" />
            <span class="ibd-converter-quality-val" data-converter-quality-val>90%</span>
          </div>
          <button class="ibd-converter-convert-btn" data-converter-convert disabled>
            ⚡ Convert & Download
          </button>
        </div>
      </div>
    `;
    document.documentElement.appendChild(root);

    const fileInput = root.querySelector('#converterFileInput');
    const uploadBtn = root.querySelector('[data-converter-upload]');
    const convertBtn = root.querySelector('[data-converter-convert]');
    const closeBtn = root.querySelector('[data-converter-close]');
    const formatSelect = root.querySelector('[data-converter-format]');
    const qualityRange = root.querySelector('[data-converter-quality]');
    const qualityVal = root.querySelector('[data-converter-quality-val]');
    const preview = root.querySelector('[data-converter-preview]');
    const previewImg = root.querySelector('[data-converter-img]');
    const filenameDiv = root.querySelector('[data-converter-filename]');

    let currentFile = null;

    formatSelect.value = settingsCache.converterFormat;
    qualityRange.value = settingsCache.converterQuality;
    qualityVal.textContent = settingsCache.converterQuality + '%';

    uploadBtn.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
      const file = e.target.files[0];
      if (!file || !file.type.startsWith('image/')) return;
      currentFile = file;
      const reader = new FileReader();
      reader.onload = (ev) => {
        previewImg.src = ev.target.result;
        filenameDiv.textContent = file.name;
        preview.style.display = 'block';
        convertBtn.disabled = false;
      };
      reader.readAsDataURL(file);
    };

    qualityRange.oninput = () => {
      qualityVal.textContent = qualityRange.value + '%';
    };

    convertBtn.onclick = async () => {
      if (!currentFile) return;
      const format = formatSelect.value;
      const quality = parseInt(qualityRange.value) / 100;

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const response = await api.runtime.sendMessage({
            type: 'IBD_CONVERT_IMAGE',
            payload: {
              dataUrl: e.target.result,
              format: format,
              quality: quality,
              filename: currentFile.name,
              autoDownload: settingsCache.converterAutoDownload
            }
          });

          if (response && response.ok) {
            convertBtn.textContent = '✓ Converted!';
            setTimeout(() => {
              convertBtn.textContent = '⚡ Convert & Download';
              if (settingsCache.converterAutoDownload) {
                fileInput.value = '';
                currentFile = null;
                preview.style.display = 'none';
                convertBtn.disabled = true;
              }
            }, 2000);
          } else {
            convertBtn.textContent = '✗ Failed';
            setTimeout(() => { convertBtn.textContent = '⚡ Convert & Download'; }, 2000);
          }
        } catch (err) {
          console.error('Conversion error:', err);
          convertBtn.textContent = '✗ Error';
          setTimeout(() => { convertBtn.textContent = '⚡ Convert & Download'; }, 2000);
        }
      };
      reader.readAsDataURL(currentFile);
    };

    closeBtn.onclick = () => {
      root.remove();
      api.storage.local.set({ [CONVERTER_TOOLBAR_KEY]: false });
    };
  }

  function removeConverterToolbar() {
    const toolbar = document.getElementById(CONVERTER_TOOLBAR_ID);
    if (toolbar) toolbar.remove();
  }

  api.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    if (msg.type === 'IBD_SET_ENABLED') {
      settingsCache.enabled = !!msg.payload?.enabled;
      if (!settingsCache.enabled) {
        const tb = document.getElementById(TOOLBAR_ID); if (tb) tb.remove();
        syncHighlights();
      } else { ensureToolbar(); syncHighlights(); }
      updateModeListeners();
      sendResponse({ ok: true });
    } else if (msg.type === 'IBD_CONVERTER_TOGGLE') {
      settingsCache.converterEnabled = !!msg.payload?.enabled;
      if (settingsCache.converterEnabled && settingsCache.converterToolbarVisible) {
        ensureConverterToolbar();
      } else {
        removeConverterToolbar();
      }
      sendResponse({ ok: true });
    } else if (msg.type === 'IBD_CONVERTER_TOOLBAR_TOGGLE') {
      settingsCache.converterToolbarVisible = !!msg.payload?.visible;
      if (settingsCache.converterEnabled && settingsCache.converterToolbarVisible) {
        ensureConverterToolbar();
      } else {
        removeConverterToolbar();
      }
      sendResponse({ ok: true });
    } else if (msg.type === 'IBD_SYNC_HIGHLIGHTS' || msg.type === 'IBD_CLEAR_SELECTION') {
      if (msg.type === 'IBD_CLEAR_SELECTION') setSelection([]);
      syncHighlights();
      sendResponse({ ok: true });
    } else if (msg.type === 'IBD_SELECT_ALL') {
      const imgs = document.querySelectorAll('img');
      const candidates = [];
      imgs.forEach(img => {
        const url = getCandidateImgUrl(img);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (url && w >= 32 && h >= 32) candidates.push({ url, el: img });
      });
      const current = await getSelection();
      const processed = await processUrls(candidates);
      await setSelection([...current, ...processed]);
      syncHighlights();
      sendResponse({ ok: true });
    }
  });

  // --- SHORTCUTS EXECUTION ---
  async function executeAction(action) {
    if (!settingsCache.shortcutsEnabled) return;

    switch (action) {
      case 'toggleSelection':
        await api.storage.local.set({ [ENABLED_KEY]: !settingsCache.enabled });
        break;
      case 'selectAll':
        if (!settingsCache.enabled) return;
        const imgs = document.querySelectorAll('img');
        const candidates = [];
        imgs.forEach(img => {
          const url = getCandidateImgUrl(img);
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (url && w >= 32 && h >= 32) candidates.push({ url, el: img });
        });
        const current = await getSelection();
        const processed = await processUrls(candidates);
        await setSelection([...current, ...processed]);
        syncHighlights();
        break;
      case 'clearSelection':
        if (!settingsCache.enabled) return;
        await setSelection([]);
        syncHighlights();
        break;
      case 'download':
        if (!settingsCache.enabled) return;
        api.runtime.sendMessage({ type: 'IBD_DOWNLOAD_REQUEST_FROM_PAGE' }, (res) => {
          if (res && !res.ok) alert('Photo-Grab: ' + (res.error || 'Download failed'));
        });
        break;
      case 'downloadZip':
        if (!settingsCache.enabled) return;
        // Check if ZIP is enabled, if not enable it temporarily or just trigger download
        // For now, trigger standard download request which respects popup settings (but popup is closed)
        // Ideally we would toggle the ZIP setting in storage then request download
        const zipKey = 'ibd_zipEnabled_v1';
        await api.storage.local.set({ [zipKey]: true });
        api.runtime.sendMessage({ type: 'IBD_DOWNLOAD_REQUEST_FROM_PAGE' }, (res) => {
          if (res && !res.ok) alert('Photo-Grab: ' + (res.error || 'ZIP Download failed'));
        });
        break;
      case 'toggleLowPerf':
        await api.storage.local.set({ [LOW_PERF_KEY]: !settingsCache.lowPerf });
        break;
      case 'togglePreview':
        // This is a popup-only setting mostly, but we can toggle it in storage
        const previewKey = 'ibd_previews_v1';
        await api.storage.local.set({ [previewKey]: !settingsCache.previews });
        break;
      case 'toggleConverter':
        const newVisibility = !settingsCache.converterToolbarVisible;
        await api.storage.local.set({ [CONVERTER_TOOLBAR_KEY]: newVisibility });
        if (settingsCache.converterEnabled && newVisibility) {
          ensureConverterToolbar();
        } else {
          removeConverterToolbar();
        }
        break;
    }
  }

  document.addEventListener('keydown', (e) => {
    if (!settingsCache.shortcutsEnabled) return;

    // Ignore if typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable) return;

    const shortcuts = settingsCache.shortcuts || DEFAULT_SHORTCUTS;
    for (const [action, data] of Object.entries(shortcuts)) {
      if (e.key.toLowerCase() === data.key &&
        e.ctrlKey === !!data.ctrl &&
        e.altKey === !!data.alt &&
        e.shiftKey === !!data.shift) {

        e.preventDefault();
        executeAction(action);
        break;
      }
    }
  });

  async function init() {
    const stored = await api.storage.local.get([
      ENABLED_KEY, LOW_PERF_KEY, PREVIEW_KEY, OVERLAY_KEY, MAX_SELECT_KEY, THEME_KEY, MODE_KEY,
      SHORTCUTS_ENABLED_KEY, SHORTCUTS_DATA_KEY,
      CONVERTER_ENABLED_KEY, CONVERTER_TOOLBAR_KEY, CONVERTER_FORMAT_KEY, CONVERTER_QUALITY_KEY, CONVERTER_AUTO_DOWNLOAD_KEY
    ]);
    settingsCache = {
      enabled: !!stored[ENABLED_KEY],
      lowPerf: !!stored[LOW_PERF_KEY],
      previews: stored[PREVIEW_KEY] !== false,
      overlays: stored[OVERLAY_KEY] !== false,
      maxSelection: stored[MAX_SELECT_KEY] || 50,
      theme: stored[THEME_KEY] || 'light',
      mode: stored[MODE_KEY] || 'normal',
      shortcutsEnabled: stored[SHORTCUTS_ENABLED_KEY] !== false,
      shortcuts: stored[SHORTCUTS_DATA_KEY] || { ...DEFAULT_SHORTCUTS },
      converterEnabled: !!stored[CONVERTER_ENABLED_KEY],
      converterToolbarVisible: !!stored[CONVERTER_TOOLBAR_KEY],
      converterFormat: stored[CONVERTER_FORMAT_KEY] || 'jpeg',
      converterQuality: stored[CONVERTER_QUALITY_KEY] || 90,
      converterAutoDownload: stored[CONVERTER_AUTO_DOWNLOAD_KEY] !== false
    };
    if (settingsCache.enabled) { ensureToolbar(); syncHighlights(); updateModeListeners(); }
    if (settingsCache.converterEnabled && settingsCache.converterToolbarVisible) { ensureConverterToolbar(); }
  }

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let needsSync = false;
    if (changes[ENABLED_KEY]) { settingsCache.enabled = !!changes[ENABLED_KEY].newValue; updateModeListeners(); needsSync = true; }
    if (changes[MODE_KEY]) { settingsCache.mode = changes[MODE_KEY].newValue || 'normal'; updateModeListeners(); needsSync = true; }
    if (changes[SHORTCUTS_ENABLED_KEY]) { settingsCache.shortcutsEnabled = changes[SHORTCUTS_ENABLED_KEY].newValue !== false; }
    if (changes[SHORTCUTS_DATA_KEY]) { settingsCache.shortcuts = changes[SHORTCUTS_DATA_KEY].newValue || { ...DEFAULT_SHORTCUTS }; }
    if (changes[LOW_PERF_KEY]) { settingsCache.lowPerf = !!changes[LOW_PERF_KEY].newValue; needsSync = true; }
    if (changes[CONVERTER_ENABLED_KEY]) { settingsCache.converterEnabled = !!changes[CONVERTER_ENABLED_KEY].newValue; }
    if (changes[CONVERTER_TOOLBAR_KEY]) { settingsCache.converterToolbarVisible = !!changes[CONVERTER_TOOLBAR_KEY].newValue; }
    if (changes[CONVERTER_FORMAT_KEY]) { settingsCache.converterFormat = changes[CONVERTER_FORMAT_KEY].newValue || 'jpeg'; }
    if (changes[CONVERTER_QUALITY_KEY]) { settingsCache.converterQuality = changes[CONVERTER_QUALITY_KEY].newValue || 90; }
    if (changes[CONVERTER_AUTO_DOWNLOAD_KEY]) { settingsCache.converterAutoDownload = changes[CONVERTER_AUTO_DOWNLOAD_KEY].newValue !== false; }
    if (changes[THEME_KEY]) {
      settingsCache.theme = changes[THEME_KEY].newValue || 'light';
      const tb = document.getElementById(TOOLBAR_ID);
      if (tb) {
        const themes = ['light', 'dark', 'blue', 'pink', 'purple', 'spotify', 'gray'];
        themes.forEach(t => tb.classList.remove(`ibd-theme-${t}`));
        tb.classList.add(`ibd-theme-${settingsCache.theme}`);
      }
      const ctb = document.getElementById(CONVERTER_TOOLBAR_ID);
      if (ctb) {
        const themes = ['light', 'dark', 'blue', 'pink', 'purple', 'spotify', 'gray'];
        themes.forEach(t => ctb.classList.remove(`ibd-theme-${t}`));
        ctb.classList.add(`ibd-theme-${settingsCache.theme}`);
      }
    }
    if (changes[STORAGE_KEY]) needsSync = true;
    if (needsSync) syncHighlights();
  });

  init();
})();
