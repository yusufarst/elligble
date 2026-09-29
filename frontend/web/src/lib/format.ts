// Indonesian locale formatting (UI_CONTENT_AND_COPY_STYLE §12). Times are shown in the
// device time zone with its abbreviation (for example WIB); the server remains the
// authority for every schedule decision.

const dateTimeFormat = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZoneName: 'short',
});

const timeFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', timeZoneName: 'short' });

export function formatDateTime(iso: string): string {
  return dateTimeFormat.format(new Date(iso));
}

export function formatTime(iso: string): string {
  return timeFormat.format(new Date(iso));
}

export function formatDurationMinutes(seconds: number): string {
  return `${Math.round(seconds / 60)} menit`;
}

const dayKeyFormat = new Intl.DateTimeFormat('id-ID', { year: 'numeric', month: '2-digit', day: '2-digit' });
const dateOnlyFormat = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
const timeOnlyFormat = new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' });

/** "29 September 2026, 08.00 sampai 10.00 WIB"; both dates are shown when the window spans days. */
export function formatWindow(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (dayKeyFormat.format(start) === dayKeyFormat.format(end)) {
    return `${dateOnlyFormat.format(start)}, ${timeOnlyFormat.format(start)} sampai ${formatTime(endIso)}`;
  }
  return `${formatDateTime(startIso)} sampai ${formatDateTime(endIso)}`;
}
