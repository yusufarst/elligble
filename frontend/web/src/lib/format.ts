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
