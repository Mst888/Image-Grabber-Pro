// Import JSZip for Chrome service worker
try {
  if (typeof JSZip === 'undefined' && typeof importScripts !== 'undefined') {
    importScripts('jszip.min.js');
  }
} catch (e) {
  console.warn('JSZip could not be pre-loaded:', e);
}

(() => {

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
      // Support data URLs (base64 encoded images) and blob URLs
      if (url && typeof url === 'string') {
        if (url.startsWith('data:image/') || url.startsWith('blob:')) {
          return true;
        }
      }
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
    // Handle data URLs directly
    if (url && url.startsWith('data:')) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Data URL fetch failed: ${res.status}`);
        return await res.blob();
      } catch (err) {
        throw new Error(`Data URL error: ${err.message}`);
      }
    }
    
    // Handle blob URLs
    if (url && url.startsWith('blob:')) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Blob URL fetch failed: ${res.status}`);
        return await res.blob();
      } catch (err) {
        throw new Error(`Blob URL error: ${err.message}`);
      }
    }
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs || DEFAULT_FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-store', signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return await res.blob();
    } catch (err) {
      if (err.name === 'AbortError') {
        throw new Error(`Timeout after ${timeoutMs || DEFAULT_FETCH_TIMEOUT_MS}ms`);
      }
      throw new Error(`Network error: ${err.message}`);
    } finally { clearTimeout(timeout); }
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
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

      const canvas = new OffscreenCanvas(targetW, targetH);
      const ctx = canvas.getContext('2d', { alpha: format !== 'jpeg' });

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

    console.log('[Photo-Grab Debug] Received URLs:', urls);
    const uniqueUrls = Array.from(new Set(urls.filter(isValidHttpUrl)));
    console.log('[Photo-Grab Debug] Valid URLs after filtering:', uniqueUrls);
    if (!uniqueUrls.length) {
      console.error('[Photo-Grab Debug] No valid URLs found. Original URLs:', urls);
      return { ok: false, error: 'No valid URLs.' };
    }

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
            const processed = await convertToFormat(blob, format, finalQuality, aspectRatio, cropMode, customRatioW, customRatioH);
            const ext = format === 'original' ? (url.split('.').pop().split(/[?#]/)[0] || 'jpg') : (format === 'jpeg' ? 'jpg' : format);
            const filename = generateFilename({ namingMode, customTemplate, format }, i, pageTitle, site, ext);
            zip.file(filename, processed);
          } catch (err) {
            console.error('[Photo-Grab] Failed to download:', url, err);
            failures.push({ url, error: err.message });
          }
        }
        const content = await zip.generateAsync({ type: 'blob' });
        const zipName = (folderName || pageTitle || 'images') + '.zip';
        const dataUrl = await blobToDataURL(content);
        await chrome.downloads.download({
          url: dataUrl,
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
              const processed = await convertToFormat(blob, format, finalQuality, aspectRatio, cropMode, customRatioW, customRatioH);
              const ext = format === 'original' ? (url.split('.').pop().split(/[?#]/)[0] || 'jpg') : (format === 'jpeg' ? 'jpg' : format);
              const filename = generateFilename({ namingMode, customTemplate, format }, globalIdx, pageTitle, site, ext);

              const dataUrl = await blobToDataURL(processed);
              const finalPath = folderName ? `${folderName.replace(/[\\/:*?"<>|]/g, '_')}/${filename}` : filename;
              await chrome.downloads.download({
                url: dataUrl,
                filename: finalPath,
                saveAs: downloadLocation === 'ask',
                conflictAction: 'uniquify'
              });
            } catch (err) {
              console.error('[Photo-Grab] Failed to download:', url, err);
              failures.push({ url, error: err.message });
            }
          }));
          if (i + batchSize < uniqueUrls.length && downloadDelay > 0) {
            await new Promise(r => setTimeout(r, downloadDelay));
          }
        }
      }

      await chrome.storage.local.set({ [STORAGE_KEY]: [] });
      
      if (failures.length) {
        console.error('[Photo-Grab] Download completed with failures:', failures.length, 'failed out of', uniqueUrls.length);
        console.error('[Photo-Grab] Failed URLs:', failures);
        return { 
          ok: false, 
          failures,
          message: `Failed to download ${failures.length} out of ${uniqueUrls.length} images. Check console for details.`
        };
      }
      
      console.log('[Photo-Grab] All downloads completed successfully');
      return { ok: true, message: `Successfully downloaded ${uniqueUrls.length} images` };
    } catch (err) {
      return { ok: false, error: err.message };
    } finally {
      inFlight.delete(batchKey);
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'IBD_DOWNLOAD_SELECTED') {
      handleDownloadSelected(msg.payload).then(sendResponse);
      return true;
    }
    if (msg.type === 'IBD_DOWNLOAD_REQUEST_FROM_PAGE') {
      (async () => {
        const stored = await chrome.storage.local.get([
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
  });
})();
