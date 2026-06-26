export interface CredentialRow {
  sbd: string;
  pin?: string;
  fullName?: string;
  className?: string;
  comboCode?: string;
  labRoom?: string;
  examAccount?: string;
  subjectCode?: string;
  subjectName?: string;
  dateOfBirth?: string;
  gender?: string;
}

function formatDobDisplay(iso?: string): string {
  if (!iso) return '';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return iso;
}

/** In phiếu tài khoản gọn — 10 phiếu/trang A4 (2×5), kích thước ~99×52 mm/phiếu */
export function printCredentialSlips(
  rows: CredentialRow[],
  options: {
    sessionName: string;
    schoolName: string;
    soGdName?: string;
    layout: 'slip' | 'table' | 'account-6up' | 'account-10up';
    logoUrl?: string;
  },
) {
  const { sessionName, schoolName, soGdName, layout, logoUrl } = options;
  let body: string;

  const slipHtml = (r: CredentialRow) => {
    const meta = [formatDobDisplay(r.dateOfBirth), r.gender].filter(Boolean).join(' · ');
    return `
        <div class="slip-ticket">
          ${logoUrl ? `<img class="slip-logo" src="${esc(logoUrl)}" alt="" />` : ''}
          <div class="slip-head">${esc(soGdName ?? 'SỞ GDĐT CÀ MAU')}</div>
          <div class="slip-school">${esc(schoolName)}</div>
          <div class="slip-title">${esc(r.subjectName ?? r.subjectCode ?? 'MÔN THI')}</div>
          <table class="slip-table">
            <tr><td>Họ tên</td><td><strong>${esc(r.fullName)}</strong></td></tr>
            ${meta ? `<tr><td>NS/GT</td><td>${esc(meta)}</td></tr>` : ''}
            <tr><td>Lớp</td><td>${esc(r.className)}</td></tr>
            <tr><td>SBD</td><td>${esc(r.sbd)}</td></tr>
            <tr><td>Tài khoản</td><td class="acct">${esc(r.examAccount)}</td></tr>
            <tr><td>Mật khẩu</td><td class="pin">${esc(r.pin)}</td></tr>
          </table>
        </div>`;
  };

  if (layout === 'account-10up' || layout === 'account-6up') {
    const perPage = layout === 'account-10up' ? 10 : 6;
    const cols = layout === 'account-10up' ? 2 : 3;
    const chunks: CredentialRow[][] = [];
    for (let i = 0; i < rows.length; i += perPage) chunks.push(rows.slice(i, i + perPage));
    body = chunks
      .map((page) => {
        const slips = page.map(slipHtml).join('');
        return `<div class="sheet" style="--cols:${cols}">${slips}</div>`;
      })
      .join('');
  } else if (layout === 'table') {
    const tr = rows
      .map(
        (r) =>
          `<tr><td>${esc(r.examAccount ?? r.sbd)}</td><td>${esc(r.fullName)}</td><td>${esc(r.className ?? r.comboCode)}</td><td>${esc(r.sbd)}</td><td><strong>${esc(r.pin)}</strong></td></tr>`,
      )
      .join('');
    body = `<h1>${esc(schoolName)}</h1><h2>Danh sách tài khoản — ${esc(sessionName)}</h2>
      <table><thead><tr><th>Tài khoản</th><th>Họ tên</th><th>Lớp</th><th>SBD</th><th>PIN</th></tr></thead><tbody>${tr}</tbody></table>`;
  } else {
    body = rows.map((r) => slipHtml(r).replace('slip-ticket', 'slip slip-ticket')).join('');
  }

  const win = window.open('', '_blank', 'width=900,height=700');
  if (!win) return alert('Cho phép popup để in phiếu');
  win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>In phiếu</title>
    <style>
      @page { size: A4 portrait; margin: 6mm; }
      * { box-sizing: border-box; }
      body { font-family: Arial, sans-serif; margin: 0; padding: 0; }
      .sheet {
        display: grid;
        grid-template-columns: repeat(var(--cols, 2), 1fr);
        gap: 2mm;
        page-break-after: always;
        align-content: start;
      }
      .sheet:last-child { page-break-after: auto; }
      .slip-ticket {
        border: 0.4pt solid #1e40af;
        border-radius: 2px;
        padding: 2.5mm 3mm 2mm;
        font-size: 7.5pt;
        line-height: 1.25;
        height: 52mm;
        overflow: hidden;
        position: relative;
      }
      .slip-logo {
        position: absolute;
        top: 2mm;
        left: 2mm;
        width: 7mm;
        height: 7mm;
        object-fit: contain;
      }
      .slip-head { font-size: 6.5pt; text-align: center; font-weight: 700; margin-top: 0; }
      .slip-school { font-size: 7pt; text-align: center; font-weight: 700; }
      .slip-title { font-size: 6.5pt; text-align: center; margin: 1mm 0; font-weight: 600; }
      .slip-table { width: 100%; border-collapse: collapse; font-size: 7pt; }
      .slip-table td { border: 0.3pt solid #cbd5e1; padding: 0.6mm 1.2mm; vertical-align: top; }
      .slip-table td:first-child { width: 28%; color: #475569; }
      .slip-table .acct, .slip-table .pin { color: #dc2626; font-weight: 700; font-size: 8pt; letter-spacing: 0.5px; }
      .slip { border: 2px solid #1e40af; border-radius: 8px; padding: 16px; margin: 8px; width: 45%; display: inline-block; vertical-align: top; }
      table { border-collapse: collapse; width: 100%; }
      th, td { border: 1px solid #333; padding: 8px; }
      th { background: #eee; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
    </style></head><body>${body}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

function esc(s?: string) {
  return (s ?? '—').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
