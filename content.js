(() => {

  // Check if extension context is valid
  function isExtensionValid() {
    return !!(chrome && chrome.runtime && chrome.runtime.id);
  }

  // Safe wrapper for chrome API calls
  async function safeChromeCall(fn, fallback = null) {
    if (!isExtensionValid()) {
      console.warn('[Photo-Grab] Extension context invalidated. Please refresh the page.');
      return fallback;
    }
    try {
      return await fn();
    } catch (err) {
      if (err.message && err.message.includes('Extension context invalidated')) {
        console.warn('[Photo-Grab] Extension reloaded. Please refresh the page.');
        return fallback;
      }
      throw err;
    }
  }

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

  let settingsCache = {
    enabled: false,
    lowPerf: false,
    previews: true,
    overlays: true,
    maxSelection: 50,
    theme: 'light',
    maxSelection: 50,
    theme: 'light',
    mode: 'normal',
    shortcutsEnabled: true,
    shortcuts: { ...DEFAULT_SHORTCUTS }
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
    
    // Don't try to resolve data: or blob: URLs - they're already absolute
    if (norm.startsWith('data:') || norm.startsWith('blob:')) {
      return norm;
    }
    
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
      const sources = picture.querySelectorAll('source[srcset]');
      for (const src of sources) {
        const best = pickBestSrcsetUrl(src.getAttribute('srcset'));
        if (best) return best;
      }
    }
    const srcset = imgEl.getAttribute('srcset');
    const srcsetBest = srcset ? pickBestSrcsetUrl(srcset) : null;
    if (srcsetBest) return srcsetBest;
    
    // Extended list of attributes for lazy loading and various image sources
    const candidates = [
      imgEl.currentSrc, 
      imgEl.src, 
      imgEl.getAttribute('src'),
      imgEl.getAttribute('data-src'),
      imgEl.getAttribute('data-lazy-src'),
      imgEl.getAttribute('data-original'),
      imgEl.getAttribute('data-fallback-src'),
      imgEl.getAttribute('data-lazy'),
      imgEl.getAttribute('data-srcset')
    ];
    
    for (const c of candidates) {
      const norm = resolveUrl(c);
      if (norm) {
        return norm;
      }
    }
    return null;
  }

  async function getSelection() {
    return safeChromeCall(async () => {
      const result = await chrome.storage.local.get(STORAGE_KEY);
      const selection = Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
      console.log('[Photo-Grab Debug] Retrieved from storage:', selection.length, 'URLs');
      return selection;
    }, []);
  }

  async function setSelection(urls) {
    return safeChromeCall(async () => {
      const unique = Array.from(new Set(urls.filter(Boolean))).slice(0, settingsCache.maxSelection);
      console.log('[Photo-Grab Debug] Saving to storage:', unique.length, 'URLs');
      await chrome.storage.local.set({ [STORAGE_KEY]: unique });
      return unique;
    }, []);
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

  async function syncHighlights() {
    const currentlyMarked = document.querySelectorAll(`[${ATTR_SELECTED}], span[${BADGE_ATTR}]`);
    currentlyMarked.forEach(el => {
      el.removeAttribute(ATTR_SELECTED);
      if (el.hasAttribute(BADGE_ATTR)) el.remove();
    });
    if (!settingsCache.enabled || (!settingsCache.overlays && !settingsCache.previews)) return;
    const selection = await getSelection();
    const selectedSet = new Set(selection);
    const imgs = document.querySelectorAll('img');
    imgs.forEach(img => {
      const url = getCandidateImgUrl(img);
      if (url && selectedSet.has(url)) applyHighlight(img, true);
    });
    const bgs = document.querySelectorAll('[style*="background-image"]');
    bgs.forEach(el => {
      const url = extractUrlFromBackgroundImage(el.style.backgroundImage);
      if (url && selectedSet.has(url)) applyHighlight(el, true);
    });
    updateToolbarCount(selection.length);
  }

  async function toggleUrl(url) {
    if (!settingsCache.enabled) {
      console.warn('[Photo-Grab Debug] Toggle blocked - extension not enabled');
      return;
    }
    const norm = normalizeUrl(url);
    if (!norm) {
      console.warn('[Photo-Grab Debug] Toggle blocked - invalid URL:', url);
      return;
    }
    console.log('[Photo-Grab Debug] Toggling URL:', norm);
    const selection = await getSelection();
    const set = new Set(selection);
    if (set.has(norm)) {
      set.delete(norm);
      console.log('[Photo-Grab Debug] Removed URL from selection');
    } else {
      if (set.size >= settingsCache.maxSelection) {
        console.warn('[Photo-Grab Debug] Max selection reached:', settingsCache.maxSelection);
        return;
      }
      set.add(norm);
      console.log('[Photo-Grab Debug] Added URL to selection');
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

      // Filter out small logos/icons (e.g., < 32x32)
      const w = img.naturalWidth || img.width;
      const h = img.naturalHeight || img.height;
      if (w < 32 || h < 32) return;

      // Intersection check
      const overlaps = !(imgRect.right < rect.left ||
        imgRect.left > rect.right ||
        imgRect.bottom < rect.top ||
        imgRect.top > rect.bottom);

      if (overlaps) {
        const url = getCandidateImgUrl(img);
        if (url) toSelect.push(url);
      }
    });
    if (toSelect.length) {
      const current = await getSelection();
      await setSelection([...current, ...toSelect]);
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
    await setSelection([...current, ...toSelect]);
    syncHighlights();
  }

  function updateModeListeners() {
    console.log('[Photo-Grab Debug] updateModeListeners called - enabled:', settingsCache.enabled, 'mode:', settingsCache.mode);
    document.removeEventListener('mousedown', onMouseDown, true);
    document.removeEventListener('mousemove', onMouseMove, true);
    document.removeEventListener('mouseup', onMouseUp, true);
    if (settingsCache.enabled && settingsCache.mode === 'area') {
      console.log('[Photo-Grab Debug] Area mode listeners attached');
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
      console.log('[Photo-Grab Debug] Image clicked, mode:', settingsCache.mode);
      if (settingsCache.mode === 'sameSize') {
        e.preventDefault(); e.stopPropagation();
        await handleSameSizeSelection(target);
        return;
      }
      if (settingsCache.mode === 'large') {
        const w = target.naturalWidth || target.width;
        const h = target.naturalHeight || target.height;
        console.log('[Photo-Grab Debug] Image size:', w, 'x', h);
        if (w < 800 && h < 600) {
          console.log('[Photo-Grab Debug] Image too small for large mode');
          return;
        }
      }
      e.preventDefault(); e.stopPropagation();
      const imgUrl = getCandidateImgUrl(target);
      console.log('[Photo-Grab Debug] Extracted image URL:', imgUrl);
      await toggleUrl(imgUrl);
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
    root.querySelector('[data-ibd-download]').onclick = () => { 
      if (isExtensionValid()) {
        chrome.runtime.sendMessage({ type: 'IBD_DOWNLOAD_REQUEST_FROM_PAGE' });
      }
    };
  }

  chrome.runtime.onMessage.addListener(async (msg, sender, sendResponse) => {
    if (msg.type === 'IBD_SET_ENABLED') {
      settingsCache.enabled = !!msg.payload?.enabled;
      if (!settingsCache.enabled) {
        const tb = document.getElementById(TOOLBAR_ID); if (tb) tb.remove();
        syncHighlights();
      } else { ensureToolbar(); syncHighlights(); }
      updateModeListeners();
      sendResponse({ ok: true });
    } else if (msg.type === 'IBD_SYNC_HIGHLIGHTS' || msg.type === 'IBD_CLEAR_SELECTION') {
      if (msg.type === 'IBD_CLEAR_SELECTION') setSelection([]);
      syncHighlights();
      sendResponse({ ok: true });
    } else if (msg.type === 'IBD_SELECT_ALL') {
      const imgs = document.querySelectorAll('img');
      const toSelect = [];
      imgs.forEach(img => {
        const url = getCandidateImgUrl(img);
        const w = img.naturalWidth || img.width;
        const h = img.naturalHeight || img.height;
        if (url && w >= 32 && h >= 32) toSelect.push(url);
      });
      const current = await getSelection();
      await setSelection([...current, ...toSelect]);
      syncHighlights();
      syncHighlights();
      sendResponse({ ok: true });
    }
  });

  // --- SHORTCUTS EXECUTION ---
  async function executeAction(action) {
    if (!settingsCache.shortcutsEnabled) return;

    switch (action) {
      case 'toggleSelection':
        await safeChromeCall(async () => {
          await chrome.storage.local.set({ [ENABLED_KEY]: !settingsCache.enabled });
        });
        break;
      case 'selectAll':
        if (!settingsCache.enabled) return;
        const imgs = document.querySelectorAll('img');
        const toSelect = [];
        imgs.forEach(img => {
          const url = getCandidateImgUrl(img);
          const w = img.naturalWidth || img.width;
          const h = img.naturalHeight || img.height;
          if (url && w >= 32 && h >= 32) toSelect.push(url);
        });
        const current = await getSelection();
        await setSelection([...current, ...toSelect]);
        syncHighlights();
        break;
      case 'clearSelection':
        if (!settingsCache.enabled) return;
        await setSelection([]);
        syncHighlights();
        break;
      case 'download':
        if (!settingsCache.enabled || !isExtensionValid()) return;
        chrome.runtime.sendMessage({ type: 'IBD_DOWNLOAD_REQUEST_FROM_PAGE' }, (res) => {
          if (chrome.runtime.lastError) {
            console.warn('[Photo-Grab] Extension context invalidated');
            return;
          }
          if (res && !res.ok) alert('Photo-Grab: ' + (res.error || 'Download failed'));
        });
        break;
      case 'downloadZip':
        if (!settingsCache.enabled || !isExtensionValid()) return;
        const zipKey = 'ibd_zipEnabled_v1';
        await safeChromeCall(async () => {
          await chrome.storage.local.set({ [zipKey]: true });
        });
        if (isExtensionValid()) {
          chrome.runtime.sendMessage({ type: 'IBD_DOWNLOAD_REQUEST_FROM_PAGE' }, (res) => {
            if (chrome.runtime.lastError) {
              console.warn('[Photo-Grab] Extension context invalidated');
              return;
            }
            if (res && !res.ok) alert('Photo-Grab: ' + (res.error || 'ZIP Download failed'));
          });
        }
        break;
      case 'toggleLowPerf':
        await safeChromeCall(async () => {
          await chrome.storage.local.set({ [LOW_PERF_KEY]: !settingsCache.lowPerf });
        });
        break;
      case 'togglePreview':
        const previewKey = 'ibd_previews_v1';
        await safeChromeCall(async () => {
          await chrome.storage.local.set({ [previewKey]: !settingsCache.previews });
        });
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
    if (!isExtensionValid()) {
      console.warn('[Photo-Grab] Extension context not available');
      return;
    }
    const stored = await safeChromeCall(async () => {
      return await chrome.storage.local.get([
        ENABLED_KEY, LOW_PERF_KEY, PREVIEW_KEY, OVERLAY_KEY, MAX_SELECT_KEY, THEME_KEY, MODE_KEY,
        SHORTCUTS_ENABLED_KEY, SHORTCUTS_DATA_KEY
      ]);
    }, {});
    
    settingsCache = {
      enabled: !!stored[ENABLED_KEY],
      lowPerf: !!stored[LOW_PERF_KEY],
      previews: stored[PREVIEW_KEY] !== false,
      overlays: stored[OVERLAY_KEY] !== false,
      maxSelection: stored[MAX_SELECT_KEY] || 50,
      theme: stored[THEME_KEY] || 'light',
      mode: stored[MODE_KEY] || 'normal',
      shortcutsEnabled: stored[SHORTCUTS_ENABLED_KEY] !== false,
      shortcuts: stored[SHORTCUTS_DATA_KEY] || { ...DEFAULT_SHORTCUTS }
    };
    console.log('[Photo-Grab Debug] Initialized with mode:', settingsCache.mode, 'enabled:', settingsCache.enabled);
    if (settingsCache.enabled) { ensureToolbar(); syncHighlights(); updateModeListeners(); }
  }

  if (isExtensionValid()) {
    chrome.storage.onChanged.addListener((changes, area) => {
      if (!isExtensionValid() || area !== 'local') return;
    let needsSync = false;
    if (changes[ENABLED_KEY]) { 
      settingsCache.enabled = !!changes[ENABLED_KEY].newValue; 
      updateModeListeners(); 
      needsSync = true; 
    }
    if (changes[MODE_KEY]) { 
      settingsCache.mode = changes[MODE_KEY].newValue || 'normal'; 
      console.log('[Photo-Grab Debug] Mode changed to:', settingsCache.mode);
      updateModeListeners(); 
      needsSync = true; 
    }
    if (changes[SHORTCUTS_ENABLED_KEY]) { settingsCache.shortcutsEnabled = changes[SHORTCUTS_ENABLED_KEY].newValue !== false; }
    if (changes[SHORTCUTS_DATA_KEY]) { settingsCache.shortcuts = changes[SHORTCUTS_DATA_KEY].newValue || { ...DEFAULT_SHORTCUTS }; }
    if (changes[LOW_PERF_KEY]) { settingsCache.lowPerf = !!changes[LOW_PERF_KEY].newValue; needsSync = true; }
    if (changes[THEME_KEY]) {
      settingsCache.theme = changes[THEME_KEY].newValue || 'light';
      const tb = document.getElementById(TOOLBAR_ID);
      if (tb) {
        const themes = ['light', 'dark', 'blue', 'pink', 'purple', 'spotify', 'gray'];
        themes.forEach(t => tb.classList.remove(`ibd-theme-${t}`));
        tb.classList.add(`ibd-theme-${settingsCache.theme}`);
      }
    }
      if (changes[STORAGE_KEY]) needsSync = true;
      if (needsSync) syncHighlights();
    });
  }

  init();
})();
