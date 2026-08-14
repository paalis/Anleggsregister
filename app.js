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

const PROSJEKT_STATUS_COLORS = {
  'Planlagt': 'var(--accent2)',
  'Pågår':    'var(--accent)',
  'Fullført': 'var(--ok)',
  'Avlyst':   'var(--danger)',
};

// ── State ────────────────────────────────────────────────────
let sortCol    = 'kategori', sortDir = 1;
let editId     = null;   // utstyr
let editUId    = null;   // utlån
let editEnhetId = null;  // enhet som redigeres
let editProsjektId = null; // prosjekt

// ── Hjelpere ─────────────────────────────────────────────────
const $ = id => document.getElementById(id);
function today() { return new Date().toISOString().split('T')[0]; }
function catColor(cat) { return CAT_COLORS[cat] || CAT_COLORS['Annet']; }
function isOverdue(til) { return til && til < today(); }

function showToast(message, type = 'info') {
  const container = $('toast-container');
  const el = document.createElement('div');
  el.className = 'toast' + (type === 'error' ? ' toast-error' : '');
  el.textContent = message;
  container.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 200);
  }, 3000);
}

let loadingCount = 0;
function showLoading() { loadingCount++; $('loading-bar').classList.add('active'); }
function hideLoading() { loadingCount = Math.max(0, loadingCount - 1); if (loadingCount === 0) $('loading-bar').classList.remove('active'); }

function fullNavn(r) { return r?.merke ? `${r.merke} ${r.vare}` : (r?.vare ?? ''); }

function statusDot(s) {
  const cls = s === 'OK'        ? 'dot-ok'
            : s === 'Service'   ? 'dot-service'
            : s === 'Reservert' ? 'dot-reservert'
            : s === 'Utlånt'    ? 'dot-utlaan'
            : 'dot-utgatt';
  return `<span class="status-dot"><span class="dot ${cls}"></span>${s}</span>`;
}

function prosjektStatusColor(s) { return PROSJEKT_STATUS_COLORS[s] || 'var(--muted)'; }

// ── View switching ────────────────────────────────────────────
function switchView(name, btn) {
  document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  $('view-' + name).classList.add('active');
  btn.classList.add('active');
  $('nav-current-label').textContent = btn.textContent;
  $('nav-tabs').classList.remove('open');
  if (name === 'prosjekt') renderProsjekter();
  if (name === 'utlaan')   renderUtlaan();
  if (name === 'logg')     renderLogg();
}

function toggleMobileNav() {
  $('nav-tabs').classList.toggle('open');
}

document.addEventListener('click', (e) => {
  const nav = $('nav-tabs');
  const toggle = $('nav-mobile-toggle');
  if (nav.classList.contains('open') && !nav.contains(e.target) && !toggle.contains(e.target)) {
    nav.classList.remove('open');
  }
});

function switchModalTab(tabId, btn) {
  document.querySelectorAll('.modal-tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  $(tabId).classList.add('active');
  btn.classList.add('active');
  if (tabId === 'tab-qr')       renderQR();
  if (tabId === 'tab-logg')     renderItemLogg();
  if (tabId === 'tab-enheter')  renderItemEnheter();
  if (tabId === 'ptab-utstyr')  renderProsjektUtstyrTab();
}

// ── Modal helpers ─────────────────────────────────────────────
function closeModal(id) { $(id).classList.remove('open'); }
function closeModalIfBg(e, id) { if (e.target.id === id) closeModal(id); }

// ════════════════════════════════════════════════════════════
// REGISTER
// ════════════════════════════════════════════════════════════

async function getFiltered() {
  const q   = $('search').value.toLowerCase();
  const kat = $('filter-kat').value;
  const mer = $('filter-merke').value;

  const all = await API.getUtstyr();
  return all
    .filter(r => {
      const match = !q || [r.vare, r.merke, r.kategori, r.kommentar]
        .some(v => (v || '').toLowerCase().includes(q));
      return match
        && (!kat || r.kategori === kat)
        && (!mer || r.merke   === mer);
    })
    .sort((a, b) => {
      const av = a[sortCol] ?? '', bv = b[sortCol] ?? '';
      return (av < bv ? -1 : av > bv ? 1 : 0) * sortDir;
    });
}

async function render() {
  $('mobile-sort').value = sortCol;
  showLoading();
  try {
    const rows  = await getFiltered();
    const tbody = $('table-body');
    const noR   = $('no-results');

    if (!rows.length) {
      tbody.innerHTML = '';
      noR.style.display = 'block';
    } else {
      noR.style.display = 'none';
      tbody.innerHTML = rows.map(r => `
        <tr onclick="openItemModal(${r.id}, 'tab-enheter')">
          <td data-label="Kategori"><span class="cat-badge" style="color:${catColor(r.kategori)};border-color:${catColor(r.kategori)}22;background:${catColor(r.kategori)}11">${r.kategori}</span></td>
          <td data-label="Merke">${r.merke || '—'}</td>
          <td data-label="Modell">${r.vare || '—'}</td>
          <td data-label="Ant."><span class="qty-badge">${r.kvantitet}</span></td>
          <td data-label="Kommentar" style="color:var(--muted);font-size:0.78rem;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.kommentar || ''}</td>
        </tr>`).join('');
    }

    // Stats
    const all     = await API.getUtstyr();
    const utlaan  = await API.getUtlaan();
    const enheter = await API.getAlleEnheter();
    $('stat-total').textContent   = all.reduce((s, r) => s + (parseInt(r.kvantitet) || 0), 0);
    $('stat-items').textContent   = all.length;
    $('stat-utlaan').textContent  = utlaan.length;
    $('stat-service').textContent = enheter.filter(e => e.status === 'Service').length;

    populateFilters(all);
  } finally {
    hideLoading();
  }
}

async function populateFilters(all) {
  if (!all) all = await API.getUtstyr();
  const kats   = [...new Set(all.map(r => r.kategori).filter(Boolean))].sort();
  const merker = [...new Set(all.map(r => r.merke).filter(Boolean))].sort();
  const fk = $('filter-kat'), fm = $('filter-merke');
  const ck = fk.value, cm = fm.value;
  fk.innerHTML = '<option value="">Alle kategorier</option>' + kats.map(k => `<option value="${k}">${k}</option>`).join('');
  fm.innerHTML = '<option value="">Alle merker</option>' + merker.map(m => `<option value="${m}">${m}</option>`).join('');
  fk.value = ck; fm.value = cm;
}

const SORT_COLS = ['kategori','merke','vare','kvantitet'];

function sortBy(col) {
  if (sortCol === col) sortDir *= -1; else { sortCol = col; sortDir = 1; }
  document.querySelectorAll('thead th').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
  const idx = SORT_COLS.indexOf(col);
  if (idx >= 0) document.querySelectorAll('thead th')[idx].classList.add(sortDir === 1 ? 'sort-asc' : 'sort-desc');
  render();
}

// Kolonneoverskriftene (der man klikker for å sortere) er skjult på mobil
// (kortvisning), så mobil bruker en egen dropdown i stedet.
function setMobileSort(col) {
  sortCol = col; sortDir = 1;
  document.querySelectorAll('thead th').forEach(th => th.classList.remove('sort-asc', 'sort-desc'));
  const idx = SORT_COLS.indexOf(col);
  if (idx >= 0) document.querySelectorAll('thead th')[idx].classList.add('sort-asc');
  render();
}

// ── Item modal ────────────────────────────────────────────────
// tab: hvilken fane som skal vises først (default Info). Klikk på en
// rad i utstyrslisten hopper rett til Enheter, siden lokasjon og
// serienummer nå bare finnes der.
async function openItemModal(id, tab = 'tab-info') {
  editId = id;

  document.querySelectorAll('.modal-tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  $(tab).classList.add('active');
  $('item-modal-overlay').querySelector(`[data-tab="${tab}"]`).classList.add('active');

  $('item-modal-title').textContent = id === null ? 'Legg til utstyr' : 'Rediger utstyr';
  $('btn-item-delete').style.display = id === null ? 'none' : 'inline-block';

  const r = id !== null ? await API.getUtstyrById(id) : null;
  const subtitle = $('item-modal-subtitle');
  if (r) { subtitle.textContent = fullNavn(r); subtitle.style.display = 'block'; }
  else   { subtitle.style.display = 'none'; }

  $('f-kategori').value    = r?.kategori     ?? 'Sub';
  $('f-merke').value       = r?.merke        ?? '';
  $('f-vare').value        = r?.vare         ?? '';
  $('f-kvantitet').textContent = r?.kvantitet ?? 0;
  $('f-kommentar').value   = r?.kommentar    ?? '';

  if (tab === 'tab-enheter') await renderItemEnheter();
  if (tab === 'tab-logg')    await renderItemLogg();
  if (tab === 'tab-qr')      await renderQR();

  $('item-modal-overlay').classList.add('open');
}

async function saveItem() {
  const vare = $('f-vare').value.trim();
  if (!vare) { showToast('Modellnavn er påkrevd.', 'error'); return; }

  await API.saveUtstyr({
    id:           editId,
    kategori:     $('f-kategori').value,
    merke:        $('f-merke').value.trim(),
    vare,
    kommentar:    $('f-kommentar').value.trim(),
  });

  closeModal('item-modal-overlay');
  render();
}

async function deleteItem() {
  if (!confirm('Slett dette utstyret?')) return;
  await API.deleteUtstyr(editId);
  closeModal('item-modal-overlay');
  render();
}

// ── QR ────────────────────────────────────────────────────────
async function renderQR() {
  if (editId === null) return;
  const r       = await API.getUtstyrById(editId);
  const enheter = await API.getEnheter(editId);

  // Bygg enhet-dropdown (bevar valgt verdi hvis dropdown allerede er populert)
  const sel = $('qr-enhet-select');
  const forrigeValg = sel.value;
  sel.innerHTML = enheter.length
    ? enheter.map(e => `<option value="${e.id}" data-asset="${e.asset_id || ''}">${e.asset_id || '#' + e.enhet_nr}${e.serienummer ? ' · ' + e.serienummer : ''}</option>`).join('')
    : '<option value="">Ingen enheter registrert</option>';

  if (forrigeValg) sel.value = forrigeValg;
  const enhet = enheter.find(e => e.id === parseInt(sel.value)) || enheter[0] || null;

  const assetId   = enhet?.asset_id || null;
  const navn      = fullNavn(r);
  const visNavn   = assetId || navn;
  const qrTekst   = assetId
    ? JSON.stringify({ asset_id: assetId, vare: navn, kategori: r.kategori, serienummer: enhet?.serienummer || '' })
    : JSON.stringify({ id: r.id, vare: navn, kategori: r.kategori });

  $('qr-vare-name').textContent = visNavn;
  $('qr-vare-meta').textContent = `${navn} · ${r.kategori}${enhet?.serienummer ? ' · SN: ' + enhet.serienummer : ''}`;

  const el = $('qr-canvas');
  el.innerHTML = '';
  new QRCode(el, {
    text: qrTekst,
    width: 180, height: 180,
    colorDark: '#000', colorLight: '#fff',
    correctLevel: QRCode.CorrectLevel.M,
  });
}

async function downloadQR() {
  const canvas = $('qr-canvas').querySelector('canvas');
  if (!canvas) { showToast('Generer QR-kode først.', 'error'); return; }
  const sel     = $('qr-enhet-select');
  const assetId = sel.options[sel.selectedIndex]?.dataset.asset;
  const r       = editId !== null ? await API.getUtstyrById(editId) : null;
  const navn    = assetId || (r ? fullNavn(r).replace(/\s+/g, '_') : 'utstyr');
  const a = document.createElement('a');
  a.href     = canvas.toDataURL('image/png');
  a.download = `QR_${navn}.png`;
  a.click();
}

// ════════════════════════════════════════════════════════════
// ENHETER
// ════════════════════════════════════════════════════════════

async function renderItemEnheter() {
  if (editId === null) {
    $('item-enheter-list').innerHTML = '<p style="color:var(--muted);font-size:0.78rem">Lagre utstyret først for å registrere enheter.</p>';
    return;
  }
  const enheter = await API.getEnheter(editId);
  const el = $('item-enheter-list');
  if (!enheter.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.78rem;padding:8px 0">Ingen individuelle enheter registrert ennå.</p>';
  } else {
    el.innerHTML = enheter.map(e => `
      <div class="inline-logg-item">
        <span class="inline-logg-date" style="font-family:'Syne',sans-serif;font-weight:700;color:var(--accent2)">${e.asset_id || '#' + e.enhet_nr}</span>
        <span class="inline-logg-text">
          ${statusDot(e.status)}
          ${e.lokasjon    ? `<span style="color:var(--muted);margin-left:10px">📍 ${e.lokasjon}</span>` : ''}
          ${e.serienummer ? `<span style="color:var(--muted);margin-left:10px">SN: ${e.serienummer}</span>` : ''}
          ${e.kommentar   ? `<span style="color:var(--muted);margin-left:8px">— ${e.kommentar}</span>` : ''}
        </span>
        <button class="logg-del-btn" style="margin-right:2px" onclick="redigerEnhet(${e.id})" title="Rediger">✎</button>
        <button class="logg-del-btn" onclick="slett_enhet(${e.id})">×</button>
      </div>`).join('');
  }
}

function visNyEnhetForm() {
  $('btn-vis-ny-enhet').style.display = 'none';
  $('ny-enhet-form').style.display = 'block';
}

function skjulNyEnhetForm() {
  $('ny-enhet-form').style.display = 'none';
  $('btn-vis-ny-enhet').style.display = 'inline-block';
  $('ne-lokasjon').value    = '';
  $('ne-serienummer').value = '';
  $('ne-kommentar').value   = '';
}

async function leggTilEnhet() {
  if (editId === null) { showToast('Lagre utstyret først.', 'error'); return; }
  const nr = await API.getNextEnhetNr(editId);
  await API.saveEnhet({
    utstyrId:    editId,
    enhetNr:     nr,
    lokasjon:    $('ne-lokasjon').value.trim(),
    serienummer: $('ne-serienummer').value.trim(),
    kommentar:   $('ne-kommentar').value.trim(),
  });
  skjulNyEnhetForm();
  await renderItemEnheter();
}

async function redigerEnhet(id) {
  const enheter = await API.getEnheter(editId);
  const e = enheter.find(x => x.id === id);
  if (!e) return;
  editEnhetId = id;
  $('ee-asset-id').textContent         = e.asset_id || '#' + e.enhet_nr;
  $('ee-asset-id-display').textContent = e.asset_id || '#' + e.enhet_nr;
  $('ee-lokasjon').value               = e.lokasjon    || '';
  $('ee-serienummer').value            = e.serienummer || '';
  $('ee-kommentar').value              = e.kommentar   || '';
  $('ee-status').value                 = e.status      || 'OK';
  $('ee-pris').value                   = e.innkjopspris ?? '';
  $('ee-dato').value                   = e.innkjopsdato ?? '';
  $('enhet-edit-form').style.display = 'block';
  $('enhet-edit-form').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

async function lagreEnhetRedigering() {
  if (!editEnhetId) return;
  const enheter = await API.getEnheter(editId);
  const e = enheter.find(x => x.id === editEnhetId);
  await API.saveEnhet({
    id:          editEnhetId,
    utstyrId:    e.utstyr_id,
    enhetNr:     e.enhet_nr,
    lokasjon:    $('ee-lokasjon').value.trim(),
    serienummer: $('ee-serienummer').value.trim(),
    kommentar:   $('ee-kommentar').value.trim(),
    status:      $('ee-status').value,
    innkjopspris: $('ee-pris').value,
    innkjopsdato: $('ee-dato').value,
  });
  editEnhetId = null;
  $('enhet-edit-form').style.display = 'none';
  await renderItemEnheter();
}

function avbrytEnhetRedigering() {
  editEnhetId = null;
  $('enhet-edit-form').style.display = 'none';
}

async function slett_enhet(id) {
  if (!confirm('Slett denne enheten?')) return;
  await API.deleteEnhet(id);
  await renderItemEnheter();
}

// ════════════════════════════════════════════════════════════
// SERVICELOGG
// ════════════════════════════════════════════════════════════

async function renderItemLogg() {
  if (editId === null) {
    $('item-logg-list').innerHTML = '<p style="color:var(--muted);font-size:0.78rem">Lagre utstyret først for å loggføre.</p>';
    return;
  }
  const entries = (await API.getLoggForUtstyr(editId)).sort((a, b) => b.dato.localeCompare(a.dato));
  const el = $('item-logg-list');
  if (!entries.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.78rem;padding:8px 0">Ingen loggføringer ennå.</p>';
    return;
  }

  const enheter = await API.getEnheter(editId);
  const enhetMap = Object.fromEntries(enheter.map(e => [e.id, e]));

  el.innerHTML = entries.map(e => {
    const enhet = e.enhetId ? enhetMap[e.enhetId] : null;
    const enhetLabel = enhet ? `<span class="enhet-badge">${enhet.asset_id || '#' + enhet.enhet_nr}${enhet.serienummer ? ' · ' + enhet.serienummer : ''}</span> ` : '';
    return `<div class="inline-logg-item">
      <span class="inline-logg-date">${e.dato}</span>
      <span class="inline-logg-text">
        ${enhetLabel}<strong>${e.type === 'service' ? 'Service' : e.type === 'rep' ? 'Reparasjon' : 'Notat'}</strong>
        — ${e.desc}${e.av ? ' (' + e.av + ')' : ''}
      </span>
    </div>`;
  }).join('');

  // Fyll enhet-dropdown i logg-skjema
  const sel = $('nl-enhet');
  sel.innerHTML = '<option value="">— hele modellen —</option>'
    + enheter.map(e => `<option value="${e.id}">${e.asset_id || '#' + e.enhet_nr}${e.serienummer ? ' · ' + e.serienummer : ''}</option>`).join('');
}

async function addLoggEntry() {
  if (editId === null) { showToast('Lagre utstyret først.', 'error'); return; }
  const desc = $('nl-desc').value.trim();
  if (!desc) { showToast('Beskrivelse er påkrevd.', 'error'); return; }

  await API.saveLogg({
    utstyrId: editId,
    enhetId:  $('nl-enhet').value ? parseInt($('nl-enhet').value) : null,
    type:     $('nl-type').value,
    dato:     $('nl-dato').value || today(),
    desc,
    av:       '',
  });

  $('nl-desc').value = '';
  await renderItemLogg();
  await renderLogg();
}

async function renderLogg() {
  showLoading();
  try {
  const sorted = (await API.getLogg()).sort((a, b) => b.dato.localeCompare(a.dato));
  const el = $('logg-list');
  if (!sorted.length) {
    el.innerHTML = '<p style="color:var(--muted);padding:20px 0">Ingen loggføringer ennå.</p>';
    return;
  }

  const utstyrMap = {};
  for (const e of sorted) {
    if (!utstyrMap[e.utstyrId]) {
      utstyrMap[e.utstyrId] = await API.getUtstyrById(e.utstyrId);
    }
  }

  el.innerHTML = sorted.map(e => {
    const item     = utstyrMap[e.utstyrId];
    const tagCls   = e.type === 'service' ? 'logg-tag-service' : e.type === 'rep' ? 'logg-tag-rep' : 'logg-tag-notat';
    const typeLabel= e.type === 'service' ? 'Service' : e.type === 'rep' ? 'Reparasjon' : 'Notat';
    return `<div class="logg-item">
      <div class="logg-date">${e.dato}</div>
      <div class="logg-body">
        <div class="logg-title">${item ? fullNavn(item) : 'Ukjent utstyr'}</div>
        <div class="logg-desc">
          <span class="logg-tag ${tagCls}">${typeLabel}</span>
          ${e.desc}${e.av ? ' — <em>' + e.av + '</em>' : ''}
        </div>
      </div>
      <button class="logg-del-btn" onclick="deleteLogg(${e.id})">×</button>
    </div>`;
  }).join('');
  } finally {
    hideLoading();
  }
}

async function oppdaterLoggEnhetSelect(utstyrId) {
  const sel = $('lg-enhet');
  if (!utstyrId) { sel.innerHTML = '<option value="">— hele modellen —</option>'; return; }
  const enheter = await API.getEnheter(parseInt(utstyrId));
  sel.innerHTML = '<option value="">— hele modellen —</option>'
    + enheter.map(e => `<option value="${e.id}">${e.asset_id || '#' + e.enhet_nr}${e.serienummer ? ' · ' + e.serienummer : ''}</option>`).join('');
}

async function openLoggModal(utstyrId = null) {
  $('lg-dato').value = today();
  const utstyr = await API.getUtstyr();
  const sel = $('lg-utstyr');
  sel.innerHTML = utstyr.map(r => `<option value="${r.id}">${fullNavn(r)} (${r.kategori})</option>`).join('');
  if (utstyrId !== null) sel.value = utstyrId;
  await oppdaterLoggEnhetSelect(sel.value);
  $('logg-modal-overlay').classList.add('open');
}

async function saveLogg() {
  const desc = $('lg-desc').value.trim();
  if (!desc) { showToast('Beskrivelse er påkrevd.', 'error'); return; }

  await API.saveLogg({
    utstyrId: parseInt($('lg-utstyr').value),
    enhetId:  $('lg-enhet').value ? parseInt($('lg-enhet').value) : null,
    type:     $('lg-type').value,
    dato:     $('lg-dato').value || today(),
    desc,
    av:       $('lg-av').value.trim(),
  });

  $('lg-desc').value = '';
  $('lg-av').value   = '';
  closeModal('logg-modal-overlay');
  await renderLogg();
}

async function deleteLogg(id) {
  if (!confirm('Slett loggføring?')) return;
  await API.deleteLogg(id);
  await renderLogg();
}

// ════════════════════════════════════════════════════════════
// UTLÅN
// ════════════════════════════════════════════════════════════

async function renderUtlaan() {
  showLoading();
  try {
  const el  = $('utlaan-grid');
  const all = await API.getUtlaan();
  if (!all.length) {
    el.innerHTML = '<p style="color:var(--muted);padding:20px 0;grid-column:1/-1">Ingen aktive utlån.</p>';
    return;
  }

  const utstyrMap = {};
  const enhetMap  = {};
  for (const u of all) {
    if (!utstyrMap[u.utstyrId]) utstyrMap[u.utstyrId] = await API.getUtstyrById(u.utstyrId);
    if (u.enhetId && !enhetMap[u.enhetId]) enhetMap[u.enhetId] = await API.getEnhetById(u.enhetId);
  }

  el.innerHTML = all.map(u => {
    const item  = utstyrMap[u.utstyrId];
    const enhet = enhetMap[u.enhetId];
    const over  = isOverdue(u.til);
    const enhetBadge = enhet
      ? `<span class="enhet-badge">${enhet.asset_id || '#' + enhet.enhet_nr}${enhet.serienummer ? ' · ' + enhet.serienummer : ''}</span>`
      : '';
    return `<div class="utlaan-card">
      <div class="utlaan-card-header">
        <div class="utlaan-card-title">${item ? fullNavn(item) : 'Ukjent'}${enhetBadge ? ' ' + enhetBadge : ''}</div>
        <span class="utlaan-badge${over ? ' overdue' : ''}">${over ? 'Forfalt' : 'Utlånt'}</span>
      </div>
      <div class="utlaan-meta">
        <div><strong>Låntaker:</strong> ${u.laantaker}</div>
        <div><strong>Fra:</strong> ${u.fra}</div>
        ${u.til   ? `<div><strong>Retur:</strong> ${u.til}</div>` : ''}
        ${u.notat ? `<div><strong>Notat:</strong> ${u.notat}</div>` : ''}
      </div>
      <div class="utlaan-actions">
        <button class="btn btn-accent"  style="font-size:0.7rem;padding:7px 12px" onclick="returnerUtlaan(${u.id})">Returner</button>
        <button class="btn btn-ghost"   style="font-size:0.7rem;padding:7px 12px" onclick="openUtlaanModal(${u.id})">Rediger</button>
      </div>
    </div>`;
  }).join('');
  } finally {
    hideLoading();
  }
}

async function openUtlaanModal(id) {
  editUId = id;
  $('utlaan-modal-title').textContent = id === null ? 'Registrer utlån' : 'Rediger utlån';
  $('btn-utlaan-delete').style.display = id === null ? 'none' : 'inline-block';

  const utstyr = await API.getUtstyr();
  const sel = $('ul-utstyr');
  sel.innerHTML = utstyr.map(r => `<option value="${r.id}">${fullNavn(r)} (${r.kategori})</option>`).join('');

  const u = id !== null ? await API.getUtlaanById(id) : null;
  if (u) {
    sel.value               = u.utstyrId;
    $('ul-laantaker').value = u.laantaker;
    $('ul-fra').value       = u.fra;
    $('ul-til').value       = u.til || '';
    $('ul-notat').value     = u.notat || '';
    await oppdaterEnhetSelect(u.utstyrId, u.enhetId);
  } else {
    $('ul-laantaker').value = '';
    $('ul-fra').value       = today();
    $('ul-til').value       = '';
    $('ul-notat').value     = '';
    await oppdaterEnhetSelect(utstyr[0]?.id ?? null, null);
  }

  $('utlaan-modal-overlay').classList.add('open');
}

// Kun ledige enheter (status OK) kan velges — bortsett fra enheten som
// allerede er knyttet til utlånet man redigerer.
async function oppdaterEnhetSelect(utstyrId, valgtEnhetId = null) {
  const sel = $('ul-enhet');
  if (!utstyrId) { sel.innerHTML = '<option value="">— ingen enheter —</option>'; return; }
  const enheter = (await API.getEnheter(utstyrId)).filter(e => e.status === 'OK' || e.id === valgtEnhetId);
  sel.innerHTML = enheter.length
    ? '<option value="">— velg enhet —</option>'
      + enheter.map(e => `<option value="${e.id}">${e.asset_id || '#' + e.enhet_nr}${e.serienummer ? ' · ' + e.serienummer : ''}</option>`).join('')
    : '<option value="">— ingen ledige enheter —</option>';
  if (valgtEnhetId) sel.value = valgtEnhetId;
}

async function saveUtlaan() {
  const laantaker = $('ul-laantaker').value.trim();
  if (!laantaker) { showToast('Låntaker er påkrevd.', 'error'); return; }

  const enhetId = $('ul-enhet').value ? parseInt($('ul-enhet').value) : null;
  if (!enhetId) { showToast('Velg en enhet.', 'error'); return; }

  await API.saveUtlaan({
    id:        editUId,
    utstyrId:  parseInt($('ul-utstyr').value),
    enhetId,
    laantaker,
    fra:       $('ul-fra').value || today(),
    til:       $('ul-til').value,
    notat:     $('ul-notat').value.trim(),
  });

  closeModal('utlaan-modal-overlay');
  await renderUtlaan();
  await render();
}

async function returnerUtlaan(id) {
  const u    = await API.getUtlaanById(id);
  const item = u ? await API.getUtstyrById(u.utstyrId) : null;
  if (!confirm(`Marker "${item ? fullNavn(item) : 'utstyr'}" som returnert?`)) return;
  await API.returnerUtlaan(id);
  await renderUtlaan();
  await render();
}

async function deleteUtlaan() {
  if (!confirm('Fjern dette utlånet?')) return;
  await API.deleteUtlaan(editUId);
  closeModal('utlaan-modal-overlay');
  await renderUtlaan();
  await render();
}

// ════════════════════════════════════════════════════════════
// PROSJEKTER
// ════════════════════════════════════════════════════════════

// Frigir en enhet tilbake til "OK" hvis den ikke lenger er reservert
// av noe planlagt eller pågående prosjekt.
async function releaseEnhetHvisUbrukt(enhetId) {
  const enhet = await API.getEnhetById(enhetId);
  if (enhet.status !== 'Reservert') return;
  const aktiveProsjekter = (await API.getProsjekter()).filter(p => p.status === 'Planlagt' || p.status === 'Pågår');
  for (const p of aktiveProsjekter) {
    const linjer = await API.getProsjektUtstyr(p.id);
    if (linjer.some(l => l.enhetId === enhetId)) return;
  }
  await API.setEnhetStatus(enhetId, 'OK');
}

async function renderProsjekter() {
  showLoading();
  try {
    const el = $('prosjekt-grid');
    const all = await API.getProsjekter();
    if (!all.length) {
      el.innerHTML = '<p style="color:var(--muted);padding:20px 0;grid-column:1/-1">Ingen prosjekter ennå.</p>';
      return;
    }

    el.innerHTML = (await Promise.all(all.map(async p => {
      const linjer = await API.getProsjektUtstyr(p.id);
      const aktiv = p.status === 'Planlagt' || p.status === 'Pågår';
      const c = prosjektStatusColor(p.status);
      return `<div class="utlaan-card" style="cursor:pointer" onclick="openProsjektModal(${p.id})">
        <div class="utlaan-card-header">
          <div class="utlaan-card-title">${p.navn}</div>
          <span class="cat-badge" style="color:${c};border-color:${c}22;background:${c}11">${p.status}</span>
        </div>
        <div class="utlaan-meta">
          ${p.sted ? `<div><strong>Sted:</strong> ${p.sted}</div>` : ''}
          <div><strong>Dato:</strong> ${p.fra}${p.til ? ' – ' + p.til : ''}</div>
          ${p.oppdragsgiver ? `<div><strong>Oppdragsgiver:</strong> ${p.oppdragsgiver}</div>` : ''}
          <div><strong>Utstyr:</strong> ${linjer.length ? `${linjer.length} enhet${linjer.length === 1 ? '' : 'er'} reservert` : 'Ingen lagt til ennå'}</div>
          ${p.notat ? `<div><strong>Notat:</strong> ${p.notat}</div>` : ''}
        </div>
        <div class="utlaan-actions">
          <button class="btn btn-ghost" style="font-size:0.7rem;padding:7px 12px" onclick="event.stopPropagation(); openProsjektModal(${p.id})">Rediger</button>
          ${aktiv ? `<button class="btn btn-accent" style="font-size:0.7rem;padding:7px 12px" onclick="event.stopPropagation(); fullforProsjekt(${p.id})">Fullfør oppdrag</button>` : ''}
        </div>
      </div>`;
    }))).join('');
  } finally {
    hideLoading();
  }
}

async function fullforProsjekt(id) {
  if (!confirm('Merk prosjektet som fullført? Reservert utstyr blir frigitt.')) return;
  const p = await API.getProsjektById(id);
  await API.saveProsjekt({ ...p, id, status: 'Fullført' });
  const linjer = await API.getProsjektUtstyr(id);
  for (const l of linjer) await releaseEnhetHvisUbrukt(l.enhetId);
  await renderProsjekter();
  await render();
}

async function openProsjektModal(id) {
  editProsjektId = id;

  document.querySelectorAll('.modal-tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  $('ptab-info').classList.add('active');
  $('prosjekt-modal-overlay').querySelector('.modal-tab').classList.add('active');

  $('prosjekt-modal-title').textContent = id === null ? 'Nytt prosjekt' : 'Rediger prosjekt';
  $('btn-prosjekt-delete').style.display = id === null ? 'none' : 'inline-block';

  const p = id !== null ? await API.getProsjektById(id) : null;
  $('p-navn').value          = p?.navn          ?? '';
  $('p-sted').value          = p?.sted          ?? '';
  $('p-oppdragsgiver').value = p?.oppdragsgiver ?? '';
  $('p-fra').value           = p?.fra           ?? today();
  $('p-til').value           = p?.til           ?? '';
  $('p-status').value        = p?.status        ?? 'Planlagt';
  $('p-notat').value         = p?.notat         ?? '';

  await renderProsjektUtstyrTab();
  $('prosjekt-modal-overlay').classList.add('open');
}

async function renderProsjektUtstyrTab() {
  const utstyr = await API.getUtstyr();
  const sel = $('pu-utstyr');
  sel.innerHTML = utstyr.map(r => `<option value="${r.id}">${fullNavn(r)} (${r.kategori})</option>`).join('');
  await oppdaterProsjektEnhetSelect(sel.value);

  const el = $('prosjekt-utstyr-list');
  if (editProsjektId === null) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.78rem">Lagre prosjektet først for å legge til utstyr.</p>';
    return;
  }

  const linjer = await API.getProsjektUtstyr(editProsjektId);
  if (!linjer.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.78rem;padding:8px 0">Ingen utstyr lagt til ennå.</p>';
    return;
  }
  const utstyrMap = Object.fromEntries(utstyr.map(r => [r.id, r]));
  el.innerHTML = (await Promise.all(linjer.map(async l => {
    const item  = utstyrMap[l.utstyrId];
    const enhet = await API.getEnhetById(l.enhetId);
    const enhetLabel = enhet ? (enhet.asset_id || '#' + enhet.enhet_nr) : 'Ukjent enhet';
    return `<div class="inline-logg-item">
      <span class="inline-logg-text">${item ? fullNavn(item) : 'Ukjent utstyr'} <span style="color:var(--muted)">— ${enhetLabel}</span></span>
      <button class="logg-del-btn" onclick="fjernProsjektUtstyr(${l.id})">×</button>
    </div>`;
  }))).join('');
}

// Kun ledige enheter (status OK) kan reserveres til et prosjekt.
async function oppdaterProsjektEnhetSelect(utstyrId) {
  const sel = $('pu-enhet');
  if (!utstyrId) { sel.innerHTML = '<option value="">— ingen enheter —</option>'; return; }
  const enheter = (await API.getEnheter(parseInt(utstyrId))).filter(e => e.status === 'OK');
  sel.innerHTML = enheter.length
    ? enheter.map(e => `<option value="${e.id}">${e.asset_id || '#' + e.enhet_nr}${e.serienummer ? ' · ' + e.serienummer : ''}</option>`).join('')
    : '<option value="">— ingen ledige enheter —</option>';
}

async function leggTilProsjektUtstyr() {
  if (editProsjektId === null) { showToast('Lagre prosjektet først.', 'error'); return; }
  const utstyrId = parseInt($('pu-utstyr').value);
  const enhetId  = $('pu-enhet').value ? parseInt($('pu-enhet').value) : null;
  if (!utstyrId || !enhetId) { showToast('Velg en ledig enhet.', 'error'); return; }

  await API.setEnhetStatus(enhetId, 'Reservert');
  await API.addProsjektUtstyr({ prosjektId: editProsjektId, utstyrId, enhetId });
  await render();
  await renderProsjektUtstyrTab();
}

async function fjernProsjektUtstyr(id) {
  const linjer = await API.getProsjektUtstyr(editProsjektId);
  const linje = linjer.find(l => l.id === id);
  await API.removeProsjektUtstyr(id);
  if (linje) await releaseEnhetHvisUbrukt(linje.enhetId);
  await renderProsjektUtstyrTab();
  await render();
}

async function saveProsjekt() {
  const navn = $('p-navn').value.trim();
  if (!navn) { showToast('Navn er påkrevd.', 'error'); return; }
  const fra = $('p-fra').value;
  if (!fra) { showToast('Fra-dato er påkrevd.', 'error'); return; }

  const forrigeStatus = editProsjektId !== null ? (await API.getProsjektById(editProsjektId)).status : null;
  const nyStatus = $('p-status').value;

  const p = await API.saveProsjekt({
    id:            editProsjektId,
    navn, fra,
    sted:          $('p-sted').value.trim(),
    til:           $('p-til').value,
    oppdragsgiver: $('p-oppdragsgiver').value.trim(),
    status:        nyStatus,
    notat:         $('p-notat').value.trim(),
  });
  editProsjektId = p.id;

  // Frigi reservert utstyr hvis prosjektet akkurat ble fullført/avlyst
  const erAktiv = s => s === 'Planlagt' || s === 'Pågår';
  let frigjortNoe = false;
  if (forrigeStatus !== null && erAktiv(forrigeStatus) && !erAktiv(nyStatus)) {
    const linjer = await API.getProsjektUtstyr(editProsjektId);
    for (const l of linjer) await releaseEnhetHvisUbrukt(l.enhetId);
    frigjortNoe = linjer.length > 0;
  }

  closeModal('prosjekt-modal-overlay');
  await renderProsjekter();
  if (frigjortNoe) await render();
}

async function deleteProsjekt() {
  if (!confirm('Slette dette prosjektet? Reservert utstyr blir frigitt.')) return;
  const linjer = await API.getProsjektUtstyr(editProsjektId);
  await API.deleteProsjekt(editProsjektId);
  for (const l of linjer) await releaseEnhetHvisUbrukt(l.enhetId);
  closeModal('prosjekt-modal-overlay');
  await renderProsjekter();
  if (linjer.length) await render();
}

// ── CSV-eksport ───────────────────────────────────────────────
async function exportCSV() {
  const rows    = await getFiltered();
  const headers = ['Kategori','Merke','Modell','Kvantitet','Kommentar'];
  const lines   = [
    headers.join(';'),
    ...rows.map(r =>
      [r.kategori,r.merke,r.vare,r.kvantitet,r.kommentar]
        .map(v => `"${(v || '').toString().replace(/"/g, '""')}"`)
        .join(';')
    ),
  ];
  const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = 'Petors_Anlegg.csv';
  a.click();
}

// ── Oppstart ──────────────────────────────────────────────────
async function initApp() {
  await API.init();

  ['search','filter-kat','filter-merke'].forEach(id =>
    $(id).addEventListener('input', render)
  );
  $('nl-dato').value = today();

  await render();
}

initApp();
