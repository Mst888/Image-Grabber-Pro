(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  const STORAGE_KEY = 'ibd_selectedImages_v1';
  const ATTR_SELECTED = 'data-ibd-selected';
  const ENABLED_KEY = 'ibd_enabled_v1';
  const LOW_PERF_KEY = 'ibd_lowPerf_v1';
  const PREVIEW_KEY = 'ibd_previews_v1';
  const OVERLAY_KEY = 'ibd_overlays_v1';
  const MAX_SELECT_KEY = 'ibd_maxSelection_v1';

  const BADGE_ATTR = 'data-ibd-badge';
  const TOOLBAR_ID = 'ibd-toolbar-v1';

  let settingsCache = {
    enabled: false,
    lowPerf: false,
    previews: true,
    overlays: true,
    maxSelection: 50
  };

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

    // Check picture element first
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

    const candidates = [
      imgEl.currentSrc, imgEl.src,
      imgEl.getAttribute('src'), imgEl.getAttribute('data-src'),
      imgEl.getAttribute('data-original'), imgEl.getAttribute('data-lazy-src')
    ];

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

    // Optimized scan: only check visible/relevant elements
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
    if (!settingsCache.enabled) return;
    const norm = normalizeUrl(url);
    if (!norm) return;

    const selection = await getSelection();
    const set = new Set(selection);

    if (set.has(norm)) {
      set.delete(norm);
    } else {
      if (set.size >= settingsCache.maxSelection) return;
      set.add(norm);
    }

    await setSelection(Array.from(set));
    syncHighlights();
  }

  // Event Delegation
  document.addEventListener('click', async (e) => {
    if (!settingsCache.enabled) return;
    if (e.button !== 0 || e.ctrlKey || e.metaKey || e.shiftKey || e.altKey) return;

    const target = e.target;
    if (target.closest(`[data-ibd-ui="1"], #${TOOLBAR_ID}`)) return;

    let url = null;
    let el = null;

    if (target.tagName === 'IMG') {
      url = getCandidateImgUrl(target);
      el = target;
    } else {
      const bgUrl = extractUrlFromBackgroundImage(window.getComputedStyle(target).backgroundImage);
      if (bgUrl) {
        url = bgUrl;
        el = target;
      }
    }

    if (url) {
      e.preventDefault();
      e.stopPropagation();
      await toggleUrl(url);
    }
  }, true);

  // Toolbar & Messaging
  function ensureToolbar() {
    if (document.getElementById(TOOLBAR_ID) || settingsCache.lowPerf) return;
    const root = document.createElement('div');
    root.id = TOOLBAR_ID;
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

    root.querySelector('[data-ibd-clear]').onclick = async () => {
      await setSelection([]);
      syncHighlights();
    };
    root.querySelector('[data-ibd-download]').onclick = () => {
      api.runtime.sendMessage({ type: 'IBD_DOWNLOAD_REQUEST_FROM_PAGE' });
    };
  }

  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'IBD_SET_ENABLED') {
      settingsCache.enabled = !!msg.payload?.enabled;
      if (!settingsCache.enabled) {
        setSelection([]);
        syncHighlights();
        const tb = document.getElementById(TOOLBAR_ID);
        if (tb) tb.remove();
      } else {
        ensureToolbar();
        syncHighlights();
      }
      sendResponse({ ok: true });
    } else if (msg.type === 'IBD_SYNC_HIGHLIGHTS' || msg.type === 'IBD_CLEAR_SELECTION') {
      if (msg.type === 'IBD_CLEAR_SELECTION') setSelection([]);
      syncHighlights();
      sendResponse({ ok: true });
    }
  });

  async function init() {
    const stored = await api.storage.local.get([ENABLED_KEY, LOW_PERF_KEY, PREVIEW_KEY, OVERLAY_KEY, MAX_SELECT_KEY]);
    settingsCache = {
      enabled: !!stored[ENABLED_KEY],
      lowPerf: !!stored[LOW_PERF_KEY],
      previews: stored[PREVIEW_KEY] !== false,
      overlays: stored[OVERLAY_KEY] !== false,
      maxSelection: stored[MAX_SELECT_KEY] || 50
    };
    if (settingsCache.enabled) {
      ensureToolbar();
      syncHighlights();
    }
  }

  api.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    let needsSync = false;
    if (changes[ENABLED_KEY]) {
      settingsCache.enabled = !!changes[ENABLED_KEY].newValue;
      needsSync = true;
    }
    if (changes[LOW_PERF_KEY]) {
      settingsCache.lowPerf = !!changes[LOW_PERF_KEY].newValue;
      needsSync = true;
    }
    if (changes[PREVIEW_KEY]) {
      settingsCache.previews = !!changes[PREVIEW_KEY].newValue;
      needsSync = true;
    }
    if (changes[OVERLAY_KEY]) {
      settingsCache.overlays = !!changes[OVERLAY_KEY].newValue;
      needsSync = true;
    }
    if (changes[MAX_SELECT_KEY]) {
      settingsCache.maxSelection = changes[MAX_SELECT_KEY].newValue || 50;
    }
    if (changes[STORAGE_KEY]) needsSync = true;

    if (needsSync) syncHighlights();
  });

  init();
})();
