/**
 * Converts any Eastern Arabic / Hindi numerals (٠١٢٣٤٥٦٧٨٩ or ۰۱۲۳۴۵۶۷۸۹)
 * into standard Arabic numerals (0123456789).
 */
export function toArabicNumerals(input: string | number | undefined | null): string {
  if (input === undefined || input === null) return '';
  return String(input)
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0));
}

/**
 * Formats an ISO date/time string in Arabic locale while strictly enforcing
 * standard Arabic numerals (0123456789).
 */
export function formatDateTimeArabicNumerals(iso?: string): string {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return toArabicNumerals(iso);
    const formatted = d.toLocaleString('ar-AE-u-nu-latn', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      numberingSystem: 'latn',
    });
    return toArabicNumerals(formatted);
  } catch {
    return toArabicNumerals(iso);
  }
}

/**
 * Formats a minute number so it starts at "01" (2-digit zero-padded with Arabic numerals 0-9).
 */
export function formatMinuteNumber(num: string | number | undefined | null): string {
  const cleaned = toArabicNumerals(num).replace(/[^0-9]/g, '');
  const parsed = parseInt(cleaned, 10);
  const validNum = Number.isNaN(parsed) || parsed < 1 ? 1 : parsed;
  return String(validNum).padStart(2, '0');
}

