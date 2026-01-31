(() => {
  const api = browser;

  // Load JSZip for Firefox
  try {
    if (typeof JSZip === 'undefined' && typeof importScripts !== 'undefined') {
      importScripts('jszip.js');
    }
  } catch (e) {
    console.warn('JSZip could not be pre-loaded:', e);
  }

  const STORAGE_KEY = 'ibd_selectedImages_v1';
  const QUALITY_KEY = 'ibd_jpegQuality_v1';
  const FORMAT_KEY = 'ibd_outputFormat_v1';
  const FOLDER_KEY = 'ibd_folderName_v1';
  const USE_SUBFOLDER_KEY = 'ibd_useSubfolder_v1';
  const ASK_LOCATION_KEY = 'ibd_askLocation_v1';
  const BATCH_SIZE_KEY = 'ibd_batchSize_v1';
  const DELAY_KEY = 'ibd_downloadDelay_v1';
  const LAZY_KEY = 'ibd_lazyProcess_v1';
  const LOW_PERF_KEY = 'ibd_lowPerf_v1';
  const NAMING_KEY = 'ibd_namingMode_v1';
  const TEMPLATE_KEY = 'ibd_customTemplate_v1';
  const ZIP_KEY = 'ibd_zipEnabled_v1';
  const ASPECT_RATIO_KEY = 'ibd_aspectRatio_v1';
  const CUSTOM_RATIO_W_KEY = 'ibd_customRatioW_v1';
  const CUSTOM_RATIO_H_KEY = 'ibd_customRatioH_v1';
  const CROP_MODE_KEY = 'ibd_cropMode_v1';
  const inFlight = new Set();
  const DEFAULT_FETCH_TIMEOUT_MS = 25000;

  function isValidHttpUrl(url) {
    try {
      const u = new URL(url);
      return u.protocol === 'http:' || u.protocol === 'https:' || u.protocol === 'data:' || u.protocol === 'blob:';
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
    // 1. Handle Data URLs manually (avoids fetch overhead and protocol blocks)
    if (url.startsWith('data:')) {
      try {
        const parts = url.split(',');
        if (parts.length < 2) throw new Error('Invalid Data URL');
        const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(parts[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        return new Blob([u8arr], { type: mime });
      } catch (e) {
        console.error('IBD DEBUG: Data URL parse error:', e);
        throw new Error('Failed to parse image data');
      }
    }

    // 2. Try Fetch API
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || DEFAULT_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { cache: 'no-store', signal: controller.signal });
      if (res.ok) return await res.blob();
      throw new Error(`Fetch failed (${res.status})`);
    } catch (err) {
      console.warn('IBD DEBUG: Fetch failed, trying XHR fallback for:', url, err.message);

      // 3. XHR Fallback (Sometimes more privileged in Firefox extensions)
      return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';
        xhr.timeout = timeoutMs || DEFAULT_FETCH_TIMEOUT_MS;

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve(xhr.response);
          else reject(new Error(`XHR failed (${xhr.status})`));
        };

        xhr.onerror = () => {
          let msg = 'NetworkError (Check CORS/CSP or Origin)';
          if (url.startsWith('blob:')) msg = 'Blob access denied (Origin mismatch)';
          reject(new Error(msg));
        };

        xhr.ontimeout = () => reject(new Error('Timeout / Aborted'));
        xhr.send();
      });
    } finally { clearTimeout(timeout); }
  }

  async function convertToFormat(blob, format, qualityPercent, aspectRatio, cropMode, customW, customH) {
    if (format === 'original' && aspectRatio === 'original') return blob;
    const quality = (qualityPercent || 90) / 100;
    const mimeType = `image/${format === 'jpg' ? 'jpeg' : format}`;
    let bitmap;
    try {
      bitmap = await createImageBitmap(blob);
      let targetW = bitmap.width;
      let targetH = bitmap.height;

      if (aspectRatio && aspectRatio !== 'original') {
        let ratioW, ratioH;
        if (aspectRatio === '1:1') { ratioW = 1; ratioH = 1; }
        else if (aspectRatio === '4:3') { ratioW = 4; ratioH = 3; }
        else if (aspectRatio === '16:9') { ratioW = 16; ratioH = 9; }
        else if (aspectRatio === 'custom') { ratioW = customW || 1; ratioH = customH || 1; }

        if (ratioW && ratioH) {
          const currentRatio = bitmap.width / bitmap.height;
          const targetRatio = ratioW / ratioH;

          if (cropMode === 'fit') {
            if (currentRatio > targetRatio) {
              targetH = bitmap.width / targetRatio;
            } else {
              targetW = bitmap.height * targetRatio;
            }
          } else { // 'fill' (Center Crop)
            if (currentRatio > targetRatio) {
              targetW = bitmap.height * targetRatio;
            } else {
              targetH = bitmap.width / targetRatio;
            }
          }
        }
      }

      // Try OffscreenCanvas first, fallback to regular canvas
      let canvas, ctx;
      try {
        if (typeof OffscreenCanvas !== 'undefined') {
          canvas = new OffscreenCanvas(targetW, targetH);
          ctx = canvas.getContext('2d', { alpha: format !== 'jpeg' });
        } else {
          throw new Error('OffscreenCanvas not available');
        }
      } catch (offscreenError) {
        // Fallback to regular canvas (this shouldn't normally happen in service worker, but just in case)
        console.warn('OffscreenCanvas not available, this may cause issues:', offscreenError);
        throw new Error('Canvas operations not available in this context. Please try normal download instead of format conversion.');
      }

      if (aspectRatio && aspectRatio !== 'original' && cropMode === 'fill') {
        const sourceW = targetW;
        const sourceH = targetH;
        const offsetX = (bitmap.width - sourceW) / 2;
        const offsetY = (bitmap.height - sourceH) / 2;
        ctx.drawImage(bitmap, offsetX, offsetY, sourceW, sourceH, 0, 0, targetW, targetH);
      } else if (aspectRatio && aspectRatio !== 'original' && cropMode === 'fit') {
        ctx.fillStyle = (format === 'jpeg') ? '#ffffff' : 'rgba(0,0,0,0)';
        ctx.fillRect(0, 0, targetW, targetH);
        const scale = Math.min(targetW / bitmap.width, targetH / bitmap.height);
        const drawW = bitmap.width * scale;
        const drawH = bitmap.height * scale;
        const drawX = (targetW - drawW) / 2;
        const drawY = (targetH - drawH) / 2;
        ctx.drawImage(bitmap, drawX, drawY, drawW, drawH);
      } else {
        ctx.drawImage(bitmap, 0, 0, targetW, targetH);
      }

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
      aspectRatio = 'original',
      cropMode = 'fill',
      customRatioW = 1,
      customRatioH = 1,
      pageTitle = 'Images',
      site = 'any'
    } = payload;

    const uniqueUrls = Array.from(new Set(urls.filter(isValidHttpUrl)));
    console.log('IBD DEBUG: uniqueUrls count:', uniqueUrls.length);
    if (!uniqueUrls.length) {
      console.warn('IBD DEBUG: No valid URLs found from:', urls.length, 'total urls');
      return { ok: false, error: 'No valid URLs selected (only http, https, data and blob are supported).' };
    }

    const batchKey = uniqueUrls.join('|');
    if (inFlight.has(batchKey)) {
      console.warn('IBD DEBUG: Download already in flight.');
      return { ok: false, error: 'Download is already in progress.' };
    }
    inFlight.add(batchKey);

    const failures = [];
    const isLowPerf = !!payload.lowPerf;
    let finalQuality = quality;
    if (isLowPerf && uniqueUrls.length > 20) finalQuality = Math.max(50, quality - 20);

    console.log('IBD DEBUG: Starting download. zipBundle:', zipBundle, 'JSZip exists:', typeof JSZip !== 'undefined');
    try {
      if (zipBundle && typeof JSZip !== 'undefined') {
        const zip = new JSZip();
        for (let i = 0; i < uniqueUrls.length; i++) {
          const url = uniqueUrls[i];
          try {
            const blob = await fetchAsBlob(url);
            const processed = await convertToFormat(blob, format, finalQuality, aspectRatio, cropMode, customRatioW, customRatioH);
            const ext = format === 'original' ? (url.split('.').pop().split(/[?#]/)[0] || 'jpg') : (format === 'jpeg' ? 'jpg' : format);
            const filename = generateFilename({ namingMode, customTemplate, format }, i, pageTitle, site, ext);
            zip.file(filename, processed);
          } catch (err) {
            console.error('IBD DEBUG: Zip item failure:', url, err);
            failures.push({ url, error: err.message });
          }
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const zipName = (folderName || pageTitle || 'images') + '.zip';
        console.log('IBD DEBUG: Zip generated, size:', content.size);

        const blobUrl = URL.createObjectURL(content);
        try {
          await api.downloads.download({
            url: blobUrl,
            filename: zipName.replace(/[\\/:*?"<>|]/g, '_'),
            saveAs: downloadLocation === 'ask'
          });
        } finally {
          setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        }
      } else {
        // Normal sequential download
        for (let i = 0; i < uniqueUrls.length; i += batchSize) {
          const chunk = uniqueUrls.slice(i, i + batchSize);
          await Promise.all(chunk.map(async (url, idx) => {
            const globalIdx = i + idx;
            const ext = format === 'original' ? (url.split('.').pop().split(/[?#]/)[0] || 'jpg') : (format === 'jpeg' ? 'jpg' : format);
            const filename = generateFilename({ namingMode, customTemplate, format }, globalIdx, pageTitle, site, ext);
            const finalPath = folderName ? `${folderName.replace(/[\\/:*?"<>|]/g, '_')}/${filename}` : filename;
            let processed = null;
            try {
              // If no conversion is needed, we prefer a more direct approach if fetch fails
              const needsConversion = format !== 'original' || aspectRatio !== 'original';

              try {
                const blob = await fetchAsBlob(url);
                processed = await convertToFormat(blob, format, finalQuality, aspectRatio, cropMode, customRatioW, customRatioH);
              } catch (fetchErr) {
                console.warn('IBD DEBUG: Fetch failed, checking fallback for:', url, fetchErr);
                // Fallback: If no processing is needed, use direct URL download
                if (!needsConversion && (url.startsWith('http') || url.startsWith('https'))) {
                  console.log('IBD DEBUG: Fallback to direct URL download for:', url);
                  await api.downloads.download({
                    url: url,
                    filename: finalPath,
                    saveAs: downloadLocation === 'ask',
                    conflictAction: 'uniquify'
                  });
                  return; // Item handled by direct download
                } else {
                  throw fetchErr; // Re-throw if fallback not possible
                }
              }

              if (processed) {
                const blobUrl = URL.createObjectURL(processed);
                try {
                  await api.downloads.download({
                    url: blobUrl,
                    filename: finalPath,
                    saveAs: downloadLocation === 'ask',
                    conflictAction: 'uniquify'
                  });
                } finally {
                  setTimeout(() => URL.revokeObjectURL(blobUrl), 20000 * (idx + 1));
                }
              }
            } catch (err) {
              console.error('IBD DEBUG: Item download failure:', url, err);
              // Ultimate Fallback: Try downloading the original URL directly via browser API
              // This bypasses CORS/CSP but means no format conversion or custom naming (might fallback to url filename)
              if (!url.startsWith('data:') && !url.startsWith('blob:')) {
                try {
                  console.log('IBD DEBUG: Attempting direct download fallback for:', url);
                  await api.downloads.download({
                    url: url,
                    saveAs: false // Don't annoy user with save as for fallback
                  });
                  // Consider it a pseudo-success or at least handled
                  return;
                } catch (fallbackErr) {
                  console.error('IBD DEBUG: Direct download fallback also failed:', fallbackErr);
                  failures.push({ url, error: err.message + ' (Fallback failed: ' + fallbackErr.message + ')' });
                }
              } else {
                failures.push({ url, error: err.message });
              }
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
      console.error('IBD DEBUG: Global download error:', err);
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
      (async () => {
        const stored = await api.storage.local.get([
          STORAGE_KEY, QUALITY_KEY, FORMAT_KEY, FOLDER_KEY, USE_SUBFOLDER_KEY, ASK_LOCATION_KEY,
          BATCH_SIZE_KEY, DELAY_KEY, LAZY_KEY, LOW_PERF_KEY, NAMING_KEY, TEMPLATE_KEY, ZIP_KEY,
          ASPECT_RATIO_KEY, CUSTOM_RATIO_W_KEY, CUSTOM_RATIO_H_KEY, CROP_MODE_KEY
        ]);

        const selection = Array.isArray(stored[STORAGE_KEY]) ? stored[STORAGE_KEY] : [];
        if (!selection.length) return sendResponse({ ok: false, error: 'No images selected.' });

        const pageTitle = (sender.tab && sender.tab.title) ? sender.tab.title.substring(0, 50).replace(/[\\/:*?"<>|]/g, '_') : 'Images';
        const site = (sender.tab && sender.tab.url) ? new URL(sender.tab.url).hostname : 'any';

        const payload = {
          urls: selection,
          quality: Number(stored[QUALITY_KEY] ?? 90),
          downloadLocation: stored[ASK_LOCATION_KEY] ? 'ask' : 'default',
          format: stored[FORMAT_KEY] || 'original',
          folderName: stored[USE_SUBFOLDER_KEY] ? (stored[FOLDER_KEY] || '') : '',
          batchSize: Number(stored[BATCH_SIZE_KEY] || 5),
          downloadDelay: Number(stored[DELAY_KEY] || 100),
          lazy: !!stored[LAZY_KEY],
          lowPerf: !!stored[LOW_PERF_KEY],
          namingMode: stored[NAMING_KEY] || 'auto',
          customTemplate: stored[TEMPLATE_KEY] || '',
          zipBundle: !!stored[ZIP_KEY],
          aspectRatio: stored[ASPECT_RATIO_KEY] || 'original',
          cropMode: stored[CROP_MODE_KEY] || 'fill',
          customRatioW: Number(stored[CUSTOM_RATIO_W_KEY] || 1),
          customRatioH: Number(stored[CUSTOM_RATIO_H_KEY] || 1),
          pageTitle,
          site
        };

        const result = await handleDownloadSelected(payload);
        sendResponse(result);
      })();
      return true;
    }

    if (msg.type === 'IBD_CONVERT_IMAGE') {
      (async () => {
        try {
          const { dataUrl, format, quality, filename, autoDownload } = msg.payload;

          const response = await fetch(dataUrl);
          const blob = await response.blob();

          const convertedBlob = await convertImageFormat(blob, format, quality);

          const originalName = filename.replace(/\.[^/.]+$/, '');
          const newExt = format === 'jpeg' ? 'jpg' : format;
          const newFilename = `${originalName}_converted.${newExt}`;

          if (autoDownload) {
            const blobUrl = URL.createObjectURL(convertedBlob);
            await api.downloads.download({
              url: blobUrl,
              filename: newFilename,
              saveAs: false
            });
            setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
          }

          sendResponse({ ok: true, filename: newFilename });
        } catch (error) {
          console.error('Conversion error:', error);
          sendResponse({ ok: false, error: error.message });
        }
      })();
      return true;
    }
  });

  async function convertImageFormat(blob, format, quality) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(blob);

      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;

          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0);

          const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/webp';

          canvas.toBlob((convertedBlob) => {
            URL.revokeObjectURL(url);
            if (convertedBlob) {
              resolve(convertedBlob);
            } else {
              reject(new Error('Conversion failed'));
            }
          }, mimeType, quality);
        } catch (error) {
          URL.revokeObjectURL(url);
          reject(error);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Failed to load image'));
      };

      img.src = url;
    });
  }
})();
