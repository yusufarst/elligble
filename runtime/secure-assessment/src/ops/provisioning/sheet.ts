// Printable activation cards (D02.7-39/40): one card per person with their ELLIGBLE ID and
// single-use activation code. The sheet is a secret until handed out: the CLI writes it
// with owner-only permissions and it should be printed and deleted.

export interface ActivationCard {
    elligbleId: string;
    fullName: string;
    code: string;
    expiresAt: Date;
}

function escapeHtml(value: string): string {
    return value.replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!);
}

export function formatExpiry(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone, timeZoneName: 'short',
    }).format(date);
}

export function renderActivationSheetHtml(cards: ActivationCard[], options: { schoolLabel: string; appUrl: string | null; timeZone: string }): string {
    const where = options.appUrl ? `Buka <strong>${escapeHtml(options.appUrl)}</strong>, pilih` : 'Buka aplikasi ELLIGBLE, pilih';
    const items = cards.map(card => `
  <article class="card">
    <p class="school">${escapeHtml(options.schoolLabel)}</p>
    <p class="name">${escapeHtml(card.fullName)}</p>
    <dl>
      <dt>ELLIGBLE ID</dt><dd class="mono">${escapeHtml(card.elligbleId)}</dd>
      <dt>Kode Aktivasi</dt><dd class="mono code">${escapeHtml(card.code)}</dd>
      <dt>Berlaku sampai</dt><dd>${escapeHtml(formatExpiry(card.expiresAt, options.timeZone))}</dd>
    </dl>
    <p class="how">${where} "Belum pernah masuk? Aktifkan akun dengan kode aktivasi", masukkan ELLIGBLE ID dan kode ini, lalu buat kata sandi Anda sendiri. Kode hanya berlaku satu kali. Jangan berikan kode ini kepada orang lain.</p>
  </article>`).join('');
    return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<title>Kartu Aktivasi ELLIGBLE</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 0; padding: 12mm; color: #000; }
  .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
  .card { border: 1px dashed #4e4e4e; border-radius: 3mm; padding: 5mm; break-inside: avoid; }
  .school { margin: 0; font-size: 9pt; color: #4e4e4e; }
  .name { margin: 1mm 0 3mm; font-size: 12pt; font-weight: 600; }
  dl { margin: 0; display: grid; grid-template-columns: auto 1fr; gap: 1mm 4mm; font-size: 10pt; }
  dt { color: #4e4e4e; } dd { margin: 0; }
  .mono { font-family: ui-monospace, monospace; } .code { font-size: 13pt; font-weight: 700; letter-spacing: 0.08em; }
  .how { margin: 3mm 0 0; font-size: 8.5pt; line-height: 1.4; color: #262626; }
  @media print { body { padding: 8mm; } }
</style>
</head>
<body>
<div class="grid">${items}
</div>
</body>
</html>
`;
}
