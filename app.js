/**
 * app.js — Petors AS Utstyrsregister
 *
 * UI-logikk. Kommuniserer utelukkende via API.* — ingen direktebruk
 * av localStorage, fetch eller hardkodet data her.
 */

// ── Konstanter ───────────────────────────────────────────────
const CAT_COLORS = {
  'Sub':           'var(--cat-sub)',
  'Topper':        'var(--cat-topper)',
  'Monitor':       'var(--cat-monitor)',
  'Lydmixer':      'var(--cat-lydmixer)',
  'Lysmixer':      'var(--cat-lysmixer)',
  'Stagerack':     'var(--cat-stagerack)',
  'Mikrofon':      'var(--cat-mikrofon)',
  'DI':            'var(--cat-di)',
  'Stativ - gitar':'var(--cat-stativ)',
  'Annet':         'var(--cat-default)',
};

// ── State ────────────────────────────────────────────────────
let sortCol = 'kategori', sortDir = 1;
let editId  = null;   // utstyr
let editUId = null;   // utlån

// ── Hjelpere ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function today() { return new Date().toISOString().split('T')[0]; }
function catColor(cat) { return CAT_COLORS[cat] || CAT_COLORS['Annet']; }
function isOverdue(til) { return til && til < today(); }

function statusDot(s) {
  const cls = s === 'OK'     ? 'dot-ok'
            : s === 'Service' ? 'dot-service'
            : s === 'Utlånt'  ? 'dot-utlaan'
            : 'dot-utgatt';
  return `<span class="status-dot"><span class="dot ${cls}"></span>${s}</span>`;
}

// ── View switching ────────────────────────────────────────────
function switchView(name, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  $('view-' + name).classList.add('active');
  btn.classList.add('active');
  if (name === 'utlaan') renderUtlaan();
  if (name === 'logg')   renderLogg();
}

function switchModalTab(tabId, btn) {
  document.querySelectorAll('.modal-tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  $(tabId).classList.add('active');
  btn.classList.add('active');
  if (tabId === 'tab-qr')   renderQR();
  if (tabId === 'tab-logg') renderItemLogg();
}

// ── Modal helpers ─────────────────────────────────────────────
function closeModal(id) { $(id).classList.remove('open'); }
function closeModalIfBg(e, id) { if (e.target.id === id) closeModal(id); }

// ════════════════════════════════════════════════════════════
// REGISTER
// ════════════════════════════════════════════════════════════

function getFiltered() {
  const q   = $('search').value.toLowerCase();
  const kat = $('filter-kat').value;
  const lok = $('filter-lok').value;
  const st  = $('filter-status').value;

  return API.getUtstyr()
    .filter(r => {
      const match = !q || [r.vare, r.kategori, r.lokasjon, r.kommentar, r.serienummer]
        .some(v => (v || '').toLowerCase().includes(q));
      return match
        && (!kat || r.kategori === kat)
        && (!lok || r.lokasjon === lok)
        && (!st  || r.status   === st);
    })
    .sort((a, b) => {
      const av = a[sortCol] ?? '', bv = b[sortCol] ?? '';
      return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir;
    });
}

function render() {
  const rows = getFiltered();
  const tbody = $('table-body');
  const noR   = $('no-results');

  if (!rows.length) {
    tbody.innerHTML = '';
    noR.style.display = 'block';
  } else {
    noR.style.display = 'none';
    tbody.innerHTML = rows.map(r => `
      <tr onclick="openItemModal(${r.id})">
        <td><span class="cat-badge" style="color:${catColor(r.kategori)};border-color:${catColor(r.kategori)}22;background:${catColor(r.kategori)}11">${r.kategori}</span></td>
        <td>${r.vare || '—'}</td>
        <td><span class="qty-badge">${r.kvantitet}</span></td>
        <td>${r.lokasjon || '—'}</td>
        <td>${statusDot(r.status)}</td>
        <td style="color:var(--muted);font-size:0.78rem">${r.serienummer || '—'}</td>
        <td style="color:var(--muted);font-size:0.78rem">${r.innkjopspris ? Number(r.innkjopspris).toLocaleString('nb-NO') : '—'}</td>
        <td style="color:var(--muted);font-size:0.78rem">${r.innkjopsdato || '—'}</td>
        <td style="color:var(--muted);font-size:0.78rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.kommentar || ''}</td>
      </tr>`).join('');
  }

  // Stats
  const all = API.getUtstyr();
  $('stat-total').textContent   = all.reduce((s, r) => s + (parseInt(r.kvantitet) || 0), 0);
  $('stat-items').textContent   = all.length;
  $('stat-utlaan').textContent  = API.getUtlaan().length;
  $('stat-service').textContent = all.filter(r => r.status === 'Service').length;

  populateFilters();
}

function populateFilters() {
  const all  = API.getUtstyr();
  const kats = [...new Set(all.map(r => r.kategori).filter(Boolean))].sort();
  const loks = [...new Set(all.map(r => r.lokasjon).filter(Boolean))].sort();
  const fk = $('filter-kat'), fl = $('filter-lok');
  const ck = fk.value, cl = fl.value;
  fk.innerHTML = '<option value="">Alle kategorier</option>' + kats.map(k => `<option value="${k}">${k}</option>`).join('');
  fl.innerHTML = '<option value="">Alle lokasjoner</option>' + loks.map(l => `<option value="${l}">${l}</option>`).join('');
  fk.value = ck; fl.value = cl;
}

function sortBy(col) {
  if (sortCol === col) sortDir *= -1; else { sortCol = col; sortDir = 1; }
  document.querySelectorAll('thead th').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
  const idx = ['kategori','vare','kvantitet','lokasjon','status','serienummer','innkjopspris','innkjopsdato'].indexOf(col);
  if (idx >= 0) document.querySelectorAll('thead th')[idx].classList.add(sortDir === 1 ? 'sort-asc' : 'sort-desc');
  render();
}

// ── Item modal ────────────────────────────────────────────────
function openItemModal(id) {
  editId = id;

  // Reset til info-tab
  document.querySelectorAll('.modal-tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  $('tab-info').classList.add('active');
  document.querySelector('.modal-tab').classList.add('active');

  $('item-modal-title').textContent = id === null ? 'Legg til utstyr' : 'Rediger utstyr';
  $('btn-item-delete').style.display = id === null ? 'none' : 'inline-block';

  const r = id !== null ? API.getUtstyrById(id) : null;
  $('f-kategori').value   = r?.kategori    ?? 'Sub';
  $('f-vare').value       = r?.vare        ?? '';
  $('f-kvantitet').value  = r?.kvantitet   ?? 1;
  $('f-lokasjon').value   = r?.lokasjon    ?? '';
  $('f-kommentar').value  = r?.kommentar   ?? '';
  $('f-status').value     = r?.status      ?? 'OK';
  $('f-serienummer').value= r?.serienummer ?? '';
  $('f-pris').value       = r?.innkjopspris ?? '';
  $('f-dato').value       = r?.innkjopsdato ?? '';

  $('item-modal-overlay').classList.add('open');
}

function saveItem() {
  const vare = $('f-vare').value.trim();
  if (!vare) { alert('Vare/modell er påkrevd.'); return; }

  API.saveUtstyr({
    id:           editId,
    kategori:     $('f-kategori').value,
    vare,
    kvantitet:    parseInt($('f-kvantitet').value) || 1,
    lokasjon:     $('f-lokasjon').value.trim(),
    kommentar:    $('f-kommentar').value.trim(),
    status:       $('f-status').value,
    serienummer:  $('f-serienummer').value.trim(),
    innkjopspris: $('f-pris').value,
    innkjopsdato: $('f-dato').value,
  });

  closeModal('item-modal-overlay');
  render();
}

function deleteItem() {
  if (!confirm('Slett dette utstyret?')) return;
  API.deleteUtstyr(editId);
  closeModal('item-modal-overlay');
  render();
}

// ── QR ────────────────────────────────────────────────────────
function renderQR() {
  if (editId === null) return;
  const r = API.getUtstyrById(editId);
  if (!r) return;

  $('qr-vare-name').textContent = r.vare;
  $('qr-vare-meta').textContent = `${r.kategori} · ${r.lokasjon || '—'} · ID: ${r.id}`;

  const el = $('qr-canvas');
  el.innerHTML = '';
  new QRCode(el, {
    text: JSON.stringify({ id: r.id, vare: r.vare, kategori: r.kategori, serienummer: r.serienummer || '' }),
    width: 180, height: 180,
    colorDark: '#000', colorLight: '#fff',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

function downloadQR() {
  const canvas = $('qr-canvas').querySelector('canvas');
  if (!canvas) { alert('Generer QR-kode først.'); return; }
  const r = editId !== null ? API.getUtstyrById(editId) : null;
  const a = document.createElement('a');
  a.href     = canvas.toDataURL('image/png');
  a.download = `QR_${r ? r.vare.replace(/\s+/g, '_') : 'utstyr'}.png`;
  a.click();
}

// ════════════════════════════════════════════════════════════
// SERVICELOGG
// ════════════════════════════════════════════════════════════

function renderItemLogg() {
  if (editId === null) {
    $('item-logg-list').innerHTML = '<p style="color:var(--muted);font-size:0.78rem">Lagre utstyret først for å loggføre.</p>';
    return;
  }
  const entries = API.getLoggForUtstyr(editId).sort((a, b) => b.dato.localeCompare(a.dato));
  const el = $('item-logg-list');
  if (!entries.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.78rem;padding:8px 0">Ingen loggføringer ennå.</p>';
    return;
  }
  el.innerHTML = entries.map(e => `
    <div class="inline-logg-item">
      <span class="inline-logg-date">${e.dato}</span>
      <span class="inline-logg-text">
        <strong>${e.type === 'service' ? 'Service' : e.type === 'rep' ? 'Reparasjon' : 'Notat'}</strong>
        — ${e.desc}${e.av ? ' (' + e.av + ')' : ''}
      </span>
    </div>`).join('');
}

function addLoggEntry() {
  if (editId === null) { alert('Lagre utstyret først.'); return; }
  const desc = $('nl-desc').value.trim();
  if (!desc) { alert('Beskrivelse er påkrevd.'); return; }

  API.saveLogg({
    utstyrId: editId,
    type:     $('nl-type').value,
    dato:     $('nl-dato').value || today(),
    desc,
    av:       '',
  });

  $('nl-desc').value = '';
  renderItemLogg();
  renderLogg();
}

function renderLogg() {
  const sorted = API.getLogg().sort((a, b) => b.dato.localeCompare(a.dato));
  const el = $('logg-list');
  if (!sorted.length) {
    el.innerHTML = '<p style="color:var(--muted);padding:20px 0">Ingen loggføringer ennå.</p>';
    return;
  }
  el.innerHTML = sorted.map(e => {
    const item     = API.getUtstyrById(e.utstyrId);
    const tagCls   = e.type === 'service' ? 'logg-tag-service' : e.type === 'rep' ? 'logg-tag-rep' : 'logg-tag-notat';
    const typeLabel= e.type === 'service' ? 'Service' : e.type === 'rep' ? 'Reparasjon' : 'Notat';
    return `<div class="logg-item">
      <div class="logg-date">${e.dato}</div>
      <div class="logg-body">
        <div class="logg-title">${item ? item.vare : 'Ukjent utstyr'}</div>
        <div class="logg-desc">
          <span class="logg-tag ${tagCls}">${typeLabel}</span>
          ${e.desc}${e.av ? ' — <em>' + e.av + '</em>' : ''}
        </div>
      </div>
      <button class="logg-del-btn" onclick="deleteLogg(${e.id})">×</button>
    </div>`;
  }).join('');
}

function openLoggModal(utstyrId = null) {
  $('lg-dato').value = today();
  const sel = $('lg-utstyr');
  sel.innerHTML = API.getUtstyr().map(r => `<option value="${r.id}">${r.vare} (${r.kategori})</option>`).join('');
  if (utstyrId !== null) sel.value = utstyrId;
  $('logg-modal-overlay').classList.add('open');
}

function saveLogg() {
  const desc = $('lg-desc').value.trim();
  if (!desc) { alert('Beskrivelse er påkrevd.'); return; }

  API.saveLogg({
    utstyrId: parseInt($('lg-utstyr').value),
    type:     $('lg-type').value,
    dato:     $('lg-dato').value || today(),
    desc,
    av:       $('lg-av').value.trim(),
  });

  $('lg-desc').value = '';
  $('lg-av').value   = '';
  closeModal('logg-modal-overlay');
  renderLogg();
}

function deleteLogg(id) {
  if (!confirm('Slett loggføring?')) return;
  API.deleteLogg(id);
  renderLogg();
}

// ════════════════════════════════════════════════════════════
// UTLÅN
// ════════════════════════════════════════════════════════════

function renderUtlaan() {
  const el = $('utlaan-grid');
  const all = API.getUtlaan();
  if (!all.length) {
    el.innerHTML = '<p style="color:var(--muted);padding:20px 0;grid-column:1/-1">Ingen aktive utlån.</p>';
    return;
  }
  el.innerHTML = all.map(u => {
    const item = API.getUtstyrById(u.utstyrId);
    const over = isOverdue(u.til);
    return `<div class="utlaan-card">
      <div class="utlaan-card-header">
        <div class="utlaan-card-title">${item ? item.vare : 'Ukjent'}</div>
        <span class="utlaan-badge${over ? ' overdue' : ''}">${over ? 'Forfalt' : 'Utlånt'}</span>
      </div>
      <div class="utlaan-meta">
        <div><strong>Låntaker:</strong> ${u.laantaker}</div>
        <div><strong>Fra:</strong> ${u.fra}</div>
        ${u.til  ? `<div><strong>Retur:</strong> ${u.til}</div>` : ''}
        ${u.notat? `<div><strong>Notat:</strong> ${u.notat}</div>` : ''}
      </div>
      <div class="utlaan-actions">
        <button class="btn btn-accent"  style="font-size:0.7rem;padding:7px 12px" onclick="returnerUtlaan(${u.id})">Returner</button>
        <button class="btn btn-ghost"   style="font-size:0.7rem;padding:7px 12px" onclick="openUtlaanModal(${u.id})">Rediger</button>
      </div>
    </div>`;
  }).join('');
}

function openUtlaanModal(id) {
  editUId = id;
  $('utlaan-modal-title').textContent = id === null ? 'Registrer utlån' : 'Rediger utlån';
  $('btn-utlaan-delete').style.display = id === null ? 'none' : 'inline-block';

  const sel = $('ul-utstyr');
  sel.innerHTML = API.getUtstyr().map(r => `<option value="${r.id}">${r.vare} (${r.kategori})</option>`).join('');

  const u = id !== null ? API.getUtlaanById(id) : null;
  if (u) {
    sel.value = u.utstyrId;
    $('ul-laantaker').value = u.laantaker;
    $('ul-fra').value       = u.fra;
    $('ul-til').value       = u.til || '';
    $('ul-notat').value     = u.notat || '';
  } else {
    $('ul-laantaker').value = '';
    $('ul-fra').value       = today();
    $('ul-til').value       = '';
    $('ul-notat').value     = '';
  }
  $('utlaan-modal-overlay').classList.add('open');
}

function saveUtlaan() {
  const laantaker = $('ul-laantaker').value.trim();
  if (!laantaker) { alert('Låntaker er påkrevd.'); return; }

  API.saveUtlaan({
    id:        editUId,
    utstyrId:  parseInt($('ul-utstyr').value),
    laantaker,
    fra:       $('ul-fra').value || today(),
    til:       $('ul-til').value,
    notat:     $('ul-notat').value.trim(),
  });

  closeModal('utlaan-modal-overlay');
  renderUtlaan();
  render();
}

function returnerUtlaan(id) {
  const u    = API.getUtlaanById(id);
  const item = u ? API.getUtstyrById(u.utstyrId) : null;
  if (!confirm(`Marker "${item?.vare ?? 'utstyr'}" som returnert?`)) return;
  API.returnerUtlaan(id);
  renderUtlaan();
  render();
}

function deleteUtlaan() {
  if (!confirm('Fjern dette utlånet?')) return;
  API.deleteUtlaan(editUId);
  closeModal('utlaan-modal-overlay');
  renderUtlaan();
  render();
}

// ── CSV-eksport ───────────────────────────────────────────────
function exportCSV() {
  const rows    = getFiltered();
  const headers = ['Kategori','Vare','Kvantitet','Lokasjon','Status','Serienummer','Innkjøpspris','Innkjøpsdato','Kommentar'];
  const lines   = [
    headers.join(';'),
    ...rows.map(r =>
      [r.kategori,r.vare,r.kvantitet,r.lokasjon,r.status,r.serienummer,r.innkjopspris,r.innkjopsdato,r.kommentar]
        .map(v => `"${(v || '').toString().replace(/"/g, '""')}"`)
        .join(';')
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'Petors_Anlegg.csv';
  a.click();
}

// ── Oppstart ──────────────────────────────────────────────────
async function initApp() {
  await API.init();

  ['search','filter-kat','filter-lok','filter-status'].forEach(id =>
    $(id).addEventListener('input', render)
  );
  $('nl-dato').value = today();

  render();
}

initApp();
