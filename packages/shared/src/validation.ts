/**
 * Validates whether a string is a valid date in DD/MM/YYYY or YYYY-MM-DD format.
 */
export function isValidDateString(dateStr: string): boolean {
  if (!dateStr || typeof dateStr !== 'string') return false;
  const trimmed = dateStr.trim();

  // Format DD/MM/YYYY
  const brRegex = /^([0-2]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/;
  if (brRegex.test(trimmed)) {
    const [dayStr, monthStr, yearStr] = trimmed.split('/');
    const day = parseInt(dayStr, 10);
    const month = parseInt(monthStr, 10);
    const year = parseInt(yearStr, 10);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  // Format YYYY-MM-DD
  const isoRegex = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
  if (isoRegex.test(trimmed)) {
    const [yearStr, monthStr, dayStr] = trimmed.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const day = parseInt(dayStr, 10);
    const date = new Date(year, month - 1, day);
    return (
      date.getFullYear() === year &&
      date.getMonth() === month - 1 &&
      date.getDate() === day
    );
  }

  return false;
}

/**
 * Converts a DD/MM/YYYY or YYYY-MM-DD string to ISO YYYY-MM-DD for database storage.
 */
export function toDatabaseDate(dateStr: string | null | undefined): string | null {
  if (!dateStr) return null;
  const trimmed = dateStr.trim();
  if (/^([0-2]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('/');
    return `${year}-${month}-${day}`;
  }
  if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(trimmed)) {
    return trimmed;
  }
  return null;
}

/**
 * Converts a YYYY-MM-DD database string (or ISO timestamp) to DD/MM/YYYY for UI display.
 */
export function formatDisplayDate(dateStr: string | null | undefined): string {
  if (!dateStr) return '';
  const trimmed = dateStr.slice(0, 10).trim();
  if (/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-');
    return `${day}/${month}/${year}`;
  }
  if (/^([0-2]\d|3[01])\/(0[1-9]|1[0-2])\/\d{4}$/.test(trimmed)) {
    return trimmed;
  }
  return dateStr;
}

/**
 * Validates whether a string is a valid 24h time in HH:MM format.
 */
export function isValidTimeString(timeStr: string): boolean {
  if (!timeStr || typeof timeStr !== 'string') return false;
  const trimmed = timeStr.trim();
  const regex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return regex.test(trimmed);
}

/**
 * Validates that end time is strictly after start time.
 */
export function isTimeIntervalValid(startTime: string, endTime: string): boolean {
  if (!isValidTimeString(startTime) || !isValidTimeString(endTime)) return false;
  const [h1, m1] = startTime.split(':').map(Number);
  const [h2, m2] = endTime.split(':').map(Number);
  const startMinutes = h1 * 60 + m1;
  const endMinutes = h2 * 60 + m2;
  return endMinutes > startMinutes;
}

/**
 * Applies a DD/MM/YYYY mask to a raw user input string.
 */
export function applyDateMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
}

/**
 * Applies a HH:MM mask to a raw user input string.
 */
export function applyTimeMask(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2, 4)}`;
}
