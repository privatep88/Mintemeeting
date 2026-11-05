import React from 'react';
import { createRoot } from 'react-dom/client';
import html2canvas from 'html2canvas-pro';
import { jsPDF } from 'jspdf';
import { saveAs } from 'file-saver';
import { FullMinuteBundle } from '../types/minutes';
import { formatMinuteNumber, toArabicNumerals } from './numerals';
import { OfficialMinutePrintView } from '../components/OfficialMinutePrintView';

const DEFAULT_APP_TITLE =
  'ساعـد (SAAED) — نظام إدارة محاضر الاجتماعات والأرشفة المؤسسية';

/**
 * Generates the official archive filename (without extension) in the exact format:
 * محضر_اجتماع_رقم_المحضر_تاريخ_الاجتماع
 */
export function getOfficialMinuteFileBaseName(bundle: FullMinuteBundle): string {
  const minuteNum = formatMinuteNumber(bundle.minute.minuteNumber || 1);
  const rawDate = bundle.minute.date
    ? toArabicNumerals(bundle.minute.date).trim()
    : toArabicNumerals(bundle.minute.year || new Date().getFullYear()).trim();
  const safeDate = rawDate.replace(/[\\/:*?"<>|\s]+/g, '-') || String(bundle.minute.year);
  return `محضر_اجتماع_${minuteNum}_${safeDate}`;
}

/**
 * Waits for fonts and all images inside a container to finish loading.
 */
async function waitForContainerAssets(container: HTMLElement): Promise<void> {
  const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 1500));

  const assetsPromise = (async () => {
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      const images = Array.from(container.querySelectorAll('img'));
      await Promise.all(
        images.map((img) => {
          if (img.complete && img.naturalWidth > 0) {
            return Promise.resolve();
          }
          return new Promise<void>((resolve) => {
            const onDone = () => {
              img.removeEventListener('load', onDone);
              img.removeEventListener('error', onDone);
              resolve();
            };
            img.addEventListener('load', onDone, { once: true });
            img.addEventListener('error', onDone, { once: true });
          });
        })
      );
    } catch {
      // Proceed even if an asset fails
    }
  })();

  await Promise.race([assetsPromise, timeoutPromise]);
}

/**
 * Exports the official meeting minute directly as an A4 Portrait PDF file
 * (`محضر_اجتماع_رقم_المحضر_تاريخ_الاجتماع.pdf`) with full Arabic RTL support,
 * logos, borders, colors, signatures, and smart row-aware pagination.
 */
export async function exportMinuteToPdf(bundle: FullMinuteBundle): Promise<void> {
  const fileBaseName = getOfficialMinuteFileBaseName(bundle);

  // Create an offscreen A4-width staging wrapper so rendering works from any tab
  const host = document.createElement('div');
  host.setAttribute('dir', 'rtl');
  host.style.position = 'fixed';
  host.style.top = '0';
  host.style.left = '-9999px';
  host.style.width = '794px'; // 210mm at 96 DPI
  host.style.backgroundColor = '#ffffff';
  host.style.zIndex = '-1000';
  host.style.pointerEvents = 'none';
  document.body.appendChild(host);

  const root = createRoot(host);

  try {
    // Render OfficialMinutePrintView into the offscreen host
    await new Promise<void>((resolve) => {
      root.render(React.createElement(OfficialMinutePrintView, { bundle }));
      requestAnimationFrame(() => {
        requestAnimationFrame(() => resolve());
      });
    });

    await waitForContainerAssets(host);

    const targetEl =
      (host.querySelector('.print-container') as HTMLElement | null) || host;

    // Normalize container styling for crisp A4 capture
    targetEl.style.width = '794px';
    targetEl.style.maxWidth = '794px';
    targetEl.style.minHeight = 'auto';
    targetEl.style.margin = '0';
    targetEl.style.border = 'none';
    targetEl.style.boxShadow = 'none';
    targetEl.style.padding = '32px 36px';
    targetEl.style.backgroundColor = '#ffffff';

    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const containerRect = targetEl.getBoundingClientRect();
    const totalDomHeight = Math.max(1, targetEl.scrollHeight);

    // Collect safe horizontal page-break Y positions (bottoms of table rows and avoid-break blocks)
    const atomicBlocks = Array.from(
      targetEl.querySelectorAll('tr, .avoid-break, .print-section-title, footer')
    );
    const unsafeRanges: Array<{ top: number; bottom: number }> = atomicBlocks.map((el) => {
      const r = el.getBoundingClientRect();
      return {
        top: Math.max(0, r.top - containerRect.top),
        bottom: Math.min(totalDomHeight, r.bottom - containerRect.top),
      };
    });

    const scale = 2;
    const canvas = await html2canvas(targetEl, {
      scale,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: 794,
      windowWidth: 794,
    });

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    });

    const pageWidthMm = 210;
    const pageHeightMm = 297;
    const marginTopBottomMm = 8;
    const usableHeightMm = pageHeightMm - marginTopBottomMm * 2;

    // Calculate how many DOM pixels fit on one usable A4 page
    const domPxPerMm = 794 / pageWidthMm;
    const maxPageDomHeightPx = usableHeightMm * domPxPerMm;

    let currentDomY = 0;
    let pageIndex = 0;

    while (currentDomY < totalDomHeight - 4) {
      let nextDomY = currentDomY + maxPageDomHeightPx;

      if (nextDomY < totalDomHeight) {
        // Check if nextDomY cuts through any atomic row/block
        const cutBlock = unsafeRanges.find(
          (range) =>
            range.top > currentDomY + 24 &&
            range.top < nextDomY &&
            range.bottom > nextDomY &&
            range.bottom - range.top < maxPageDomHeightPx * 0.85
        );
        if (cutBlock) {
          nextDomY = Math.max(currentDomY + 60, cutBlock.top - 2);
        }
      } else {
        nextDomY = totalDomHeight;
      }

      const sliceDomHeight = Math.max(1, nextDomY - currentDomY);
      const sliceCanvasY = Math.round(currentDomY * scale);
      const sliceCanvasHeight = Math.min(
        canvas.height - sliceCanvasY,
        Math.round(sliceDomHeight * scale)
      );

      if (sliceCanvasHeight <= 0) break;

      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = canvas.width;
      pageCanvas.height = sliceCanvasHeight;
      const ctx = pageCanvas.getContext('2d');

      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
        ctx.drawImage(
          canvas,
          0,
          sliceCanvasY,
          canvas.width,
          sliceCanvasHeight,
          0,
          0,
          canvas.width,
          sliceCanvasHeight
        );

        const imgData = pageCanvas.toDataURL('image/jpeg', 0.96);
        const sliceHeightMm = sliceDomHeight / domPxPerMm;

        if (pageIndex > 0) {
          pdf.addPage('a4', 'portrait');
        }

        pdf.addImage(
          imgData,
          'JPEG',
          0,
          marginTopBottomMm,
          pageWidthMm,
          sliceHeightMm,
          undefined,
          'FAST'
        );
      }

      currentDomY = nextDomY;
      pageIndex += 1;
    }

    const pdfBlob = pdf.output('blob');
    saveAs(pdfBlob, `${fileBaseName}.pdf`);
  } finally {
    try {
      root.unmount();
    } catch {
      // Ignore unmount error
    }
    if (host.parentNode) {
      host.parentNode.removeChild(host);
    }
  }
}

/**
 * Triggers the native browser print dialog synchronously while preserving
 * user activation gesture. If the browser/iframe blocks `window.print()`,
 * automatically falls back to generating and downloading the official A4 PDF.
 */
export async function triggerOfficialMinutePrint(bundle: FullMinuteBundle): Promise<void> {
  const previousTitle = document.title || DEFAULT_APP_TITLE;
  const pdfTitle = getOfficialMinuteFileBaseName(bundle);

  // Set document title synchronously so the browser defaults to `محضر_اجتماع_رقم_المحضر_تاريخ_الاجتماع.pdf`
  document.title = pdfTitle;

  let printDialogOpened = false;
  const onBeforePrint = () => {
    printDialogOpened = true;
  };
  window.addEventListener('beforeprint', onBeforePrint, { once: true });

  const restoreTitle = () => {
    window.removeEventListener('afterprint', restoreTitle);
    if (!document.querySelector('.print-preview-wrapper')) {
      document.title = previousTitle;
    }
  };
  window.addEventListener('afterprint', restoreTitle, { once: true });

  const t0 = Date.now();
  try {
    window.focus();
    window.print();
  } catch {
    // Blocked by sandbox
  }
  const elapsed = Date.now() - t0;
  if (elapsed > 80) {
    printDialogOpened = true;
  }

  // Wait briefly to see if `beforeprint` fired or if sandboxed iframe ignored window.print()
  await new Promise<void>((resolve) => setTimeout(resolve, 300));
  window.removeEventListener('beforeprint', onBeforePrint);

  if (!printDialogOpened) {
    // Fallback for sandboxed iframe environments where window.print() is suppressed
    await exportMinuteToPdf(bundle);
  }
}
