import { FullMinuteBundle } from '../types/minutes';
import { formatMinuteNumber, toArabicNumerals } from './numerals';

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
 * Waits for fonts and all images inside the print container to finish loading
 * before invoking the browser's print / Save-as-PDF engine.
 */
async function waitForPrintAssets(): Promise<void> {
  const timeoutPromise = new Promise<void>((resolve) => setTimeout(resolve, 900));

  const assetsPromise = (async () => {
    try {
      if (document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
      const printRoot = document.querySelector('.print-container') || document;
      const images = Array.from(printRoot.querySelectorAll('img'));
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
 * Sets the official document title to `محضر_اجتماع_رقم_المحضر_تاريخ_الاجتماع`
 * so the browser's Print / Save as PDF dialog automatically uses
 * `محضر_اجتماع_رقم_المحضر_تاريخ_الاجتماع.pdf` as the default filename,
 * waits for fonts & images to settle, and opens the native print dialog.
 */
export async function triggerOfficialMinutePrint(bundle: FullMinuteBundle): Promise<void> {
  const previousTitle = document.title || DEFAULT_APP_TITLE;
  const pdfTitle = getOfficialMinuteFileBaseName(bundle);

  document.title = pdfTitle;

  await waitForPrintAssets();

  // Wait two frames to guarantee layout & RTL font shaping are committed
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });

  const restoreTitle = () => {
    window.removeEventListener('afterprint', restoreTitle);
    // If still on preview tab, keep the PDF title for Ctrl+P convenience; otherwise restore
    if (!document.querySelector('.print-preview-wrapper')) {
      document.title = previousTitle;
    }
  };

  window.addEventListener('afterprint', restoreTitle, { once: true });

  window.focus();
  window.print();
}
