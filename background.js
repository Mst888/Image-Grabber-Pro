(() => {
  const api = typeof browser !== 'undefined' ? browser : chrome;

  const STORAGE_KEY = 'ibd_selectedImages_v1';
  const inFlight = new Set();
  const DEFAULT_FETCH_TIMEOUT_MS = 25000;

  function isValidHttpUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch (_) {
      return false;
    }
  }

  async function fetchAsBlob(url, timeoutMs) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || DEFAULT_FETCH_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        signal: controller.signal,
      });

      if (!res.ok) throw new Error(`Fetch failed (${res.status})`);
      return await res.blob();
    } finally {
      clearTimeout(timeout);
    }
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
    } finally {
      if (bitmap) bitmap.close();
    }
  }

  async function downloadBlob(blob, filename, folderName, downloadLocation) {
    const objectUrl = URL.createObjectURL(blob);
    const finalFilename = folderName ? `${folderName.replace(/[\\/:*?"<>|]/g, '_')}/${filename}` : filename;

    try {
      return await api.downloads.download({
        url: objectUrl,
        filename: finalFilename,
        saveAs: downloadLocation === 'ask',
        conflictAction: 'uniquify',
      });
    } finally {
      setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
    }
  }

  async function handleDownloadSelected(payload) {
    const {
      urls = [],
      quality = 90,
      downloadLocation = 'default',
      format = 'original',
      folderName = '',
      batchSize = 5,
      downloadDelay = 100
    } = payload;

    const uniqueUrls = Array.from(new Set(urls.filter(isValidHttpUrl)));
    if (!uniqueUrls.length) return { ok: false, error: 'No valid URLs.' };

    const batchKey = uniqueUrls.join('|');
    if (inFlight.has(batchKey)) return { ok: false, error: 'Download in progress.' };
    inFlight.add(batchKey);

    const failures = [];
    const isLowPerf = !!payload.lowPerf;
    let finalQuality = quality;
    if (isLowPerf && uniqueUrls.length > 20) {
      finalQuality = Math.max(50, quality - 20);
    }

    try {
      for (let i = 0; i < uniqueUrls.length; i += batchSize) {
        const chunk = uniqueUrls.slice(i, i + batchSize);

        await Promise.all(chunk.map(async (url, index) => {
          const globalIndex = i + index;
          const ext = format === 'original' ? 'jpg' : (format === 'jpeg' ? 'jpg' : format);
          const filename = `image_${globalIndex + 1}.${ext}`;

          try {
            const blob = await fetchAsBlob(url);
            const processed = await convertToFormat(blob, format, finalQuality);
            await downloadBlob(processed, filename, folderName, downloadLocation);

            if (blob !== processed && blob.close) blob.close();
            if (processed.close) processed.close();
          } catch (err) {
            failures.push({ url, error: err.message });
          }
        }));

        if (i + batchSize < uniqueUrls.length && downloadDelay > 0) {
          await new Promise(r => setTimeout(r, downloadDelay));
        }
      }

      await api.storage.local.set({ [STORAGE_KEY]: [] });
      return failures.length ? { ok: false, failures } : { ok: true };
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
      (async () => {
        const stored = await api.storage.local.get([
          STORAGE_KEY, 'ibd_jpegQuality_v1', 'ibd_downloadLocation_v1',
          'ibd_outputFormat_v1', 'ibd_folderName_v1', 'ibd_batchSize_v1',
          'ibd_downloadDelay_v1', 'ibd_lazyProcess_v1'
        ]);

        const payload = {
          urls: stored[STORAGE_KEY] || [],
          quality: stored['ibd_jpegQuality_v1'] || 90,
          downloadLocation: stored['ibd_downloadLocation_v1'] || 'default',
          format: stored['ibd_outputFormat_v1'] || 'original',
          folderName: stored['ibd_folderName_v1'] || '',
          batchSize: stored['ibd_batchSize_v1'] || 5,
          downloadDelay: stored['ibd_downloadDelay_v1'] || 100,
          lazy: !!stored['ibd_lazyProcess_v1']
        };

        const result = await handleDownloadSelected(payload);
        sendResponse(result);
      })();
      return true;
    }
  });
})();
