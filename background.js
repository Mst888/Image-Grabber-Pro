(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  // For compatibility with some MV3 environments (like Chrome)
  try {
    if (typeof JSZip === 'undefined' && typeof importScripts !== 'undefined') {
      importScripts('jszip.min.js');
    }
  } catch (e) {
    console.warn('JSZip could not be pre-loaded:', e);
  }

  const STORAGE_KEY = 'ibd_selectedImages_v1';
  const inFlight = new Set();
  const DEFAULT_FETCH_TIMEOUT_MS = 25000;

  function isValidHttpUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (_) { return false; }
  }

  function generateFilename(settings, index, pageTitle, site, originalExt) {
    const { namingMode, customTemplate, format } = settings;
    const ext = format === 'original' ? originalExt : (format === 'jpeg' ? 'jpg' : format);
    const id = String(index + 1).padStart(3, '0');

    let base = 'image';
    if (namingMode === 'auto') {
      base = `${pageTitle}_${id}`;
    } else if (namingMode === 'sequential') {
      base = `image_${id}`;
    } else if (namingMode === 'custom' && customTemplate) {
      base = customTemplate
        .replace(/{site}/g, site)
        .replace(/{title}/g, pageTitle)
        .replace(/{index}/g, id);
    } else {
      base = `image_${id}`;
    }

    // Clean filename
    return base.replace(/[\\/:*?"<>|]/g, '_') + '.' + ext;
  }

  async function fetchAsBlob(url, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || DEFAULT_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal });
      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
      return await res.blob();
    } finally { clearTimeout(timeout); }
  }

  async function convertToFormat(blob, format, qualityPercent) {
    if (format === 'original') return blob;
    const quality = (qualityPercent || 90) / 100;
    const mimeType = `image/${format === 'jpg' ? 'jpeg' : format}`;
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d', { alpha: format !== 'jpeg' });
      ctx.drawImage(bitmap, 0, 0);
      const outBlob = await canvas.convertToBlob({
        type: mimeType,
        quality: (format === 'jpeg' || format === 'webp') ? quality : undefined
      });
      if (!outBlob) throw new Error(`${format.toUpperCase()} conversion failed.`);
      return outBlob;
    } finally { if (bitmap) bitmap.close(); }
  }

  async function handleDownloadSelected(payload) {
    const {
      urls = [],
      quality = 90,
      downloadLocation = 'default',
      format = 'original',
      folderName = '',
      batchSize = 5,
      downloadDelay = 100,
      namingMode = 'auto',
      customTemplate = '',
      zipBundle = false,
      pageTitle = 'Images',
      site = 'any'
    } = payload;

    const uniqueUrls = Array.from(new Set(urls.filter(isValidHttpUrl)));
    if (!uniqueUrls.length) return { ok: false, error: 'No valid URLs.' };

    const batchKey = uniqueUrls.join('|');
    if (inFlight.has(batchKey)) return { ok: false, error: 'Download in progress.' };
    inFlight.add(batchKey);

    const failures = [];
    const isLowPerf = !!payload.lowPerf;
    let finalQuality = quality;
    if (isLowPerf && uniqueUrls.length > 20) finalQuality = Math.max(50, quality - 20);

    try {
      if (zipBundle && typeof JSZip !== 'undefined') {
        const zip = new JSZip();
        for (let i = 0; i < uniqueUrls.length; i++) {
          const url = uniqueUrls[i];
          try {
            const blob = await fetchAsBlob(url);
            const processed = await convertToFormat(blob, format, finalQuality);
            const ext = format === 'original' ? (url.split('.').pop().split(/[?#]/)[0] || 'jpg') : (format === 'jpeg' ? 'jpg' : format);
            const filename = generateFilename({ namingMode, customTemplate, format }, i, pageTitle, site, ext);
            zip.file(filename, processed);
          } catch (err) {
            failures.push({ url, error: err.message });
          }
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const zipName = (folderName || pageTitle || 'images') + '.zip';
        await api.downloads.download({
          url: URL.createObjectURL(content),
          filename: zipName.replace(/[\\/:*?"<>|]/g, '_'),
          saveAs: downloadLocation === 'ask'
        });
      } else {
        // Normal sequential download
        for (let i = 0; i < uniqueUrls.length; i += batchSize) {
          const chunk = uniqueUrls.slice(i, i + batchSize);
          await Promise.all(chunk.map(async (url, idx) => {
            const globalIdx = i + idx;
            try {
              const blob = await fetchAsBlob(url);
              const processed = await convertToFormat(blob, format, finalQuality);
              const ext = format === 'original' ? (url.split('.').pop().split(/[?#]/)[0] || 'jpg') : (format === 'jpeg' ? 'jpg' : format);
              const filename = generateFilename({ namingMode, customTemplate, format }, globalIdx, pageTitle, site, ext);

              const objectUrl = URL.createObjectURL(processed);
              const finalPath = folderName ? `${folderName.replace(/[\\/:*?"<>|]/g, '_')}/${filename}` : filename;
              await api.downloads.download({
                url: objectUrl,
                filename: finalPath,
                saveAs: downloadLocation === 'ask',
                conflictAction: 'uniquify'
              });
              setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
            } catch (err) {
              failures.push({ url, error: err.message });
            }
          }));
          if (i + batchSize < uniqueUrls.length && downloadDelay > 0) {
            await new Promise(r => setTimeout(r, downloadDelay));
          }
        }
      }

      await api.storage.local.set({ [STORAGE_KEY]: [] });
      return failures.length ? { ok: false, failures } : { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      inFlight.delete(batchKey);
    }
  }

  api.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'IBD_DOWNLOAD_SELECTED') {
      handleDownloadSelected(msg.payload).then(sendResponse);
      return true;
    }
    if (msg.type === 'IBD_DOWNLOAD_REQUEST_FROM_PAGE') {
      // Not implemented for page yet, would need full settings fetch
      sendResponse({ ok: false, error: 'Please use the extension popup for advanced downloads.' });
      return true;
    }
  });
})();
