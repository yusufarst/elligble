// Indonesian locale formatting (UI_CONTENT_AND_COPY_STYLE §12). Times are shown in the
// school's time zone with its abbreviation (WIB, WITA or WIT), whatever zone the device is
// set to (D04.2-36). Until the school's zone is known, the device zone is used. The server
// remains the authority for every schedule decision (D04.2-35).

let displayTimeZone: string | undefined;
let formats = buildFormats(undefined);

function buildFormats(timeZone: string | undefined) {
  return {
    dateTime: new Intl.DateTimeFormat('id-ID', {
      day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone,
    }),
    time: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short', timeZone }),
    dayKey: new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone }),
    dateOnly: new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric', timeZone }),
    timeOnly: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZone }),
    clock: new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZoneName: 'short', timeZone }),
  };
}

/** Uses the school's zone for every date and time shown; an unknown zone keeps the device zone. */
export function setDisplayTimeZone(timeZone: string | null | undefined): void {
  const next = timeZone || undefined;
  if (next === displayTimeZone) return;
  try {
    formats = buildFormats(next);
    displayTimeZone = next;
  } catch {
    formats = buildFormats(undefined);
    displayTimeZone = undefined;
  }
}

export function getDisplayTimeZone(): string | undefined {
  return displayTimeZone;
}

export function formatDateTime(iso: string): string {
  return formats.dateTime.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return formats.time.format(new Date(iso));
}

/** "10.14.07 WIB": for showing how fresh monitoring data is (D04.6-17/18). */
export function formatClockTime(iso: string): string {
  return formats.clock.format(new Date(iso));
}

export function formatDurationMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} menit`;
}

/** "29 September 2026, 08.00 sampai 10.00 WIB"; both dates are shown when the window spans days. */
export function formatWindow(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (formats.dayKey.format(start) === formats.dayKey.format(end)) {
    return `${formats.dateOnly.format(start)}, ${formats.timeOnly.format(start)} sampai ${formatTime(endIso)}`;
  }
  return `${formatDateTime(startIso)} sampai ${formatDateTime(endIso)}`;
}

/** "2026-09-30 08:27" in the school's zone: for spreadsheets, which read this form as a date. */
export function formatSheetDateTime(iso: string): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: displayTimeZone,
  }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

/** "2026-09-30" in the school's zone. */
export function formatSheetDate(iso: string): string {
  return formatSheetDateTime(iso).slice(0, 10);
}

/** The school's zone abbreviation at that instant ("WIB", "WITA", "WIT"), or the device's. */
export function zoneLabel(iso: string = new Date().toISOString()): string {
  return formats.time.formatToParts(new Date(iso)).find(p => p.type === 'timeZoneName')?.value ?? '';
}
