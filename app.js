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
function naa() { return new Date().toISOString(); }
function catColor(cat) { return CAT_COLORS[cat] || CAT_COLORS['Annet']; }
function isOverdue(til) { return til && til < today(); }

function enhetLabel(e) {
  if (!e) return 'Ukjent';
  return (e.asset_id || '#' + e.enhet_nr) + (e.serienummer ? ' · ' + e.serienummer : '');
}

// ── Tilgjengelighet ──────────────────────────────────────────
// En enhet er ikke "ledig" eller "opptatt" i seg selv — den er opptatt i
// en periode. Alle spørsmål om tilgjengelighet går derfor gjennom
// bookinglista fra API.getBookinger() og en datosammenligning, slik at
// samme enhet kan bookes til flere oppdrag som ikke overlapper.
//
// Datoene er ISO-strenger (YYYY-MM-DD) og kan sammenlignes direkte.
// Åpen slutt betyr "til noen avslutter den", ikke "én dag".
const ALLTID = '9999-12-31';

function overlapper(fra1, til1, fra2, til2) {
  return fra1 <= (til2 || ALLTID) && fra2 <= (til1 || ALLTID);
}

// ignorer: bookingen man selv holder på å redigere, som ikke skal telle
// som konflikt med seg selv.
function finnKonflikter(bookinger, enhetId, fra, til, ignorer = null) {
  return bookinger.filter(b =>
    b.enhetId === enhetId
    && !(ignorer && b.kilde === ignorer.kilde && b.id === ignorer.id)
    && overlapper(fra, til, b.fra, b.til));
}

function kortDato(d) {
  if (!d) return '';
  const [aar, mnd, dag] = d.split('-');
  return aar === String(new Date().getFullYear()) ? `${dag}.${mnd}` : `${dag}.${mnd}.${aar.slice(2)}`;
}

function periodeTekst({ fra, til }) {
  if (!til)        return `fra ${kortDato(fra)}`;
  if (til === fra) return kortDato(fra);
  return `${kortDato(fra)}–${kortDato(til)}`;
}

// Enhetens tilstand på en gitt dato: fysisk status går foran, ellers
// avgjør bookingene. Er den ledig i dag, sier detaljen når den er booket
// neste gang — det er som regel det man lurer på.
function enhetTilstand(enhet, bookinger, dato = today()) {
  if (enhet.status !== 'OK') return { status: enhet.status, detalj: '' };

  const mine = bookinger.filter(b => b.enhetId === enhet.id);
  const aktiv = mine.find(b => overlapper(dato, dato, b.fra, b.til));
  if (aktiv) {
    return {
      status: aktiv.kilde === 'utlaan' ? 'Utlånt' : 'Reservert',
      detalj: `${aktiv.tittel} · ${periodeTekst(aktiv)}`,
    };
  }

  const neste = mine.filter(b => b.fra > dato).sort((a, b) => a.fra.localeCompare(b.fra))[0];
  return { status: 'Ledig', detalj: neste ? `booket ${periodeTekst(neste)} — ${neste.tittel}` : '' };
}

// Bygger enhetsvelgeren for en periode. Alle enheter listes — de som er
// opptatt eller ute av drift er avslått med begrunnelse, i stedet for å
// mangle i lista uten forklaring.
async function byggEnhetValg(sel, utstyrId, opsjoner = {}) {
  const { fra, til = null, ignorer = null, paaListen = [], valgtEnhetId = null } = opsjoner;

  if (!utstyrId) { sel.innerHTML = '<option value="">— ingen enheter —</option>'; return; }

  const [enheter, bookinger] = await Promise.all([
    API.getEnheter(parseInt(utstyrId)),
    API.getBookinger(),
  ]);

  if (!enheter.length) {
    sel.innerHTML = '<option value="">— ingen enheter registrert —</option>';
    return;
  }

  const forrigeValg = sel.value;
  let antallLedige = 0;

  const valg = enheter.map(e => {
    const erValgt = e.id === valgtEnhetId;
    let sperre = null;

    if (erValgt)                        sperre = null;
    else if (paaListen.includes(e.id))  sperre = 'allerede på lista';
    else if (e.status !== 'OK')         sperre = e.status.toLowerCase();
    else {
      const k = finnKonflikter(bookinger, e.id, fra, til, ignorer);
      if (k.length) sperre = `opptatt: ${k[0].tittel} ${periodeTekst(k[0])}`;
    }

    if (!sperre) antallLedige++;
    return `<option value="${e.id}"${sperre ? ' disabled' : ''}>${enhetLabel(e)}${sperre ? ` — ${sperre}` : ''}</option>`;
  });

  // Plassholderen står alltid først, slik at .value er tom til noen
  // faktisk velger en enhet — ellers ville en avslått enhet blitt lest
  // som valgt når ingen er ledige.
  sel.innerHTML = (antallLedige
    ? '<option value="">— velg enhet —</option>'
    : '<option value="">— ingen ledige i perioden —</option>') + valg.join('');

  if (valgtEnhetId) {
    sel.value = String(valgtEnhetId);
  } else if (forrigeValg) {
    const o = sel.querySelector(`option[value="${forrigeValg}"]`);
    if (o && !o.disabled) sel.value = forrigeValg;
  }
}

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

// ── Oppstartsskjerm ──────────────────────────────────────────
// Splash-skjermen (logoen med roterende o-ring) står til første
// datainnlasting er ferdig. Minstetiden gjør at den ikke blinker
// forbi når dataene kommer med én gang.
const splashStart = Date.now();

function hideSplash() {
  const el = $('splash');
  if (!el) return;
  setTimeout(() => {
    el.classList.add('hidden');
    setTimeout(() => el.remove(), 500);
  }, Math.max(0, 600 - (Date.now() - splashStart)));
}

function splashStatus(tekst) {
  const el = $('splash-status');
  if (el) el.textContent = tekst;
}

function splashFeil(tekst, detalj) {
  const el = $('splash');
  if (!el) return;
  el.classList.add('error');
  splashStatus(tekst);
  const d = $('splash-detalj');
  if (d && detalj) { d.textContent = detalj; d.hidden = false; }
}

// Selve feilen fra Supabase, pluss URL-en som ble brukt. Uten dette sier
// skjermen bare "fikk ikke kontakt", og feil oppsett (gal SUPABASE_URL
// eller nøkkel) ser likt ut som at databasen er nede.
function feilDetalj(err) {
  const melding = err?.message || String(err);
  const kode    = err?.code ? ` (${err.code})` : '';
  const url     = typeof SUPABASE_URL === 'string' ? SUPABASE_URL : '';
  return `${melding}${kode}${url ? `\n${url}` : ''}`;
}

function fullNavn(r) { return r?.merke ? `${r.merke} ${r.vare}` : (r?.vare ?? ''); }

function statusDot(s) {
  const cls = s === 'OK'        ? 'dot-ok'
            : s === 'Ledig'     ? 'dot-ok'
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
  if (tabId === 'tab-qr')         renderQR();
  if (tabId === 'tab-logg')       renderItemLogg();
  if (tabId === 'tab-enheter')    renderItemEnheter();
  if (tabId === 'ptab-utstyr')    renderProsjektUtstyrTab();

  // Kameraet skal bare stå på i pakkliste-fanen.
  if (tabId === 'ptab-pakkliste') renderPakkliste();
  else                            stoppSkanning();
}

// ── Modal helpers ─────────────────────────────────────────────
function closeModal(id) {
  // Kameraet skal slås av uansett hvordan prosjektmodalen lukkes.
  if (id === 'prosjekt-modal-overlay') stoppSkanning();
  $(id).classList.remove('open');
}
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

    // Stats. "Utlånt" teller utlån som løper i dag — et utlån som er
    // registrert fram i tid hører ikke med før det starter.
    const [all, enheter, bookinger] = await Promise.all([
      API.getUtstyr(), API.getAlleEnheter(), API.getBookinger(),
    ]);
    const idag = today();
    $('stat-total').textContent   = all.reduce((s, r) => s + (parseInt(r.kvantitet) || 0), 0);
    $('stat-items').textContent   = all.length;
    $('stat-utlaan').textContent  = bookinger
      .filter(b => b.kilde === 'utlaan' && overlapper(idag, idag, b.fra, b.til)).length;
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

  // Nullstill ev. åpne enhets-skjemaer som ble stående fra forrige gang
  // modalen var oppe, slik at man ikke ser data fra et annet utstyr.
  avbrytEnhetRedigering();
  skjulNyEnhetForm();

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
    ? enheter.map(e => `<option value="${e.id}" data-asset="${e.asset_id || ''}">${enhetLabel(e)}</option>`).join('')
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
    $('btn-vis-ny-enhet').style.display = 'none';
    return;
  }
  $('btn-vis-ny-enhet').style.display = 'inline-block';
  const enheter = await API.getEnheter(editId);
  const el = $('item-enheter-list');
  if (!enheter.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.78rem;padding:8px 0">Ingen individuelle enheter registrert ennå.</p>';
  } else {
    const bookinger = await API.getBookinger();
    el.innerHTML = enheter.map(e => {
      const t = enhetTilstand(e, bookinger);
      return `
      <div class="inline-logg-item">
        <span class="inline-logg-date" style="font-family:'Syne',sans-serif;font-weight:700;color:var(--accent2)">${e.asset_id || '#' + e.enhet_nr}</span>
        <span class="inline-logg-text">
          ${statusDot(t.status)}
          ${e.lokasjon    ? `<span style="color:var(--muted);margin-left:10px">📍 ${e.lokasjon}</span>` : ''}
          ${e.serienummer ? `<span style="color:var(--muted);margin-left:10px">SN: ${e.serienummer}</span>` : ''}
          ${e.kommentar   ? `<span style="color:var(--muted);margin-left:8px">— ${e.kommentar}</span>` : ''}
        </span>
        <span class="inline-logg-prosjekt">${t.detalj}</span>
        <button class="logg-del-btn" style="margin-right:2px" onclick="redigerEnhet(${e.id})" title="Rediger">✎</button>
        <button class="logg-del-btn" onclick="slett_enhet(${e.id})">×</button>
      </div>`;
    }).join('');
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
  if (editId === null) { showToast('Lagre utstyret først, så kan du legge til enheter.', 'error'); return; }
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
    const badge = enhet ? `<span class="enhet-badge">${enhetLabel(enhet)}</span> ` : '';
    return `<div class="inline-logg-item">
      <span class="inline-logg-date">${e.dato}</span>
      <span class="inline-logg-text">
        ${badge}<strong>${e.type === 'service' ? 'Service' : e.type === 'rep' ? 'Reparasjon' : 'Notat'}</strong>
        — ${e.desc}${e.av ? ' (' + e.av + ')' : ''}
      </span>
    </div>`;
  }).join('');

  // Fyll enhet-dropdown i logg-skjema
  const sel = $('nl-enhet');
  sel.innerHTML = '<option value="">— hele modellen —</option>'
    + enheter.map(e => `<option value="${e.id}">${enhetLabel(e)}</option>`).join('');
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
    + enheter.map(e => `<option value="${e.id}">${enhetLabel(e)}</option>`).join('');
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

// Returnerte utlån ligger igjen som historikk og vises bare på forespørsel.
let visReturnerte = false;

function toggleReturnerte() {
  visReturnerte = !visReturnerte;
  $('btn-vis-returnerte').textContent = visReturnerte ? 'Skjul returnerte' : 'Vis returnerte';
  renderUtlaan();
}

async function renderUtlaan() {
  showLoading();
  try {
  const el = $('utlaan-grid');
  const [all, utstyr, enheter] = await Promise.all([
    API.getUtlaan({ inkluderReturnerte: visReturnerte }),
    API.getUtstyr(),
    API.getAlleEnheter(),
  ]);
  if (!all.length) {
    el.innerHTML = '<p style="color:var(--muted);padding:20px 0;grid-column:1/-1">Ingen aktive utlån.</p>';
    return;
  }

  const utstyrMap = Object.fromEntries(utstyr.map(r => [r.id, r]));
  const enhetMap  = Object.fromEntries(enheter.map(e => [e.id, e]));
  const idag = today();

  el.innerHTML = all.map(u => {
    const item  = utstyrMap[u.utstyrId];
    const enhet = enhetMap[u.enhetId];

    // Et utlån kan være registrert fram i tid — da er det ikke ute ennå,
    // og skal verken se forfalt ut eller kunne returneres.
    const kommer = !u.returnert && u.fra > idag;
    const over   = !u.returnert && isOverdue(u.til);
    const merke  = u.returnert ? `Returnert ${kortDato(u.returnert)}`
                 : kommer     ? `Fra ${kortDato(u.fra)}`
                 : over       ? 'Forfalt' : 'Utlånt';

    const enhetBadge = enhet ? `<span class="enhet-badge">${enhetLabel(enhet)}</span>` : '';
    return `<div class="utlaan-card${u.returnert ? ' utlaan-card-historikk' : ''}">
      <div class="utlaan-card-header">
        <div class="utlaan-card-title">${item ? fullNavn(item) : 'Ukjent'}${enhetBadge ? ' ' + enhetBadge : ''}</div>
        <span class="utlaan-badge${over ? ' overdue' : ''}${u.returnert ? ' returnert' : ''}">${merke}</span>
      </div>
      <div class="utlaan-meta">
        <div><strong>Låntaker:</strong> ${u.laantaker}</div>
        <div><strong>Fra:</strong> ${u.fra}</div>
        ${u.til   ? `<div><strong>Retur:</strong> ${u.til}</div>` : ''}
        ${u.notat ? `<div><strong>Notat:</strong> ${u.notat}</div>` : ''}
      </div>
      <div class="utlaan-actions">
        ${u.returnert ? '' : `<button class="btn btn-accent" style="font-size:0.7rem;padding:7px 12px" onclick="returnerUtlaan(${u.id})">Returner</button>`}
        <button class="btn btn-ghost" style="font-size:0.7rem;padding:7px 12px" onclick="openUtlaanModal(${u.id})">Rediger</button>
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

// Enhetslista avhenger av perioden, så den bygges på nytt når utstyr
// eller datoer endres.
function oppdaterUtlaanEnheter() {
  return oppdaterEnhetSelect($('ul-utstyr').value);
}

async function oppdaterEnhetSelect(utstyrId, valgtEnhetId = null) {
  await byggEnhetValg($('ul-enhet'), utstyrId, {
    fra:     $('ul-fra').value || today(),
    til:     $('ul-til').value || null,
    ignorer: editUId !== null ? { kilde: 'utlaan', id: editUId } : null,
    valgtEnhetId,
  });
}

async function saveUtlaan() {
  const laantaker = $('ul-laantaker').value.trim();
  if (!laantaker) { showToast('Låntaker er påkrevd.', 'error'); return; }

  const enhetId = $('ul-enhet').value ? parseInt($('ul-enhet').value) : null;
  if (!enhetId) { showToast('Velg en enhet.', 'error'); return; }

  const fra = $('ul-fra').value || today();
  const til = $('ul-til').value || null;
  if (til && til < fra) { showToast('Forventet retur kan ikke være før utlånsdatoen.', 'error'); return; }

  // Siste kontroll mot databasen: nedtrekkslista kan ha blitt bygget før
  // noen andre booket den samme enheten i perioden.
  const konflikter = finnKonflikter(await API.getBookinger(), enhetId, fra, til,
    editUId !== null ? { kilde: 'utlaan', id: editUId } : null);
  if (konflikter.length) {
    showToast(`Enheten er allerede booket: ${konflikter[0].tittel} (${periodeTekst(konflikter[0])}).`, 'error');
    return;
  }

  await API.saveUtlaan({
    id: editUId, utstyrId: parseInt($('ul-utstyr').value), enhetId,
    laantaker, fra, til,
    notat: $('ul-notat').value.trim(),
  });

  closeModal('utlaan-modal-overlay');
  await renderUtlaan();
  await render();
}

async function returnerUtlaan(id) {
  const u    = await API.getUtlaanById(id);
  const item = u ? await API.getUtstyrById(u.utstyrId) : null;
  if (!confirm(`Marker "${item ? fullNavn(item) : 'utstyr'}" som returnert?`)) return;
  await API.returnerUtlaan(id, today());
  showToast('Registrert som returnert — enheten er ledig igjen.');
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

// Reservert utstyr trenger ikke lenger frigis manuelt: en booking teller
// bare så lenge prosjektet er Planlagt eller Pågår, så utstyret blir
// ledig av seg selv når prosjektet fullføres, avlyses eller slettes.

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
      const ut  = linjer.filter(l => l.pakketUt).length;
      const inn = linjer.filter(l => l.pakketInn).length;
      const pakkeTekst = !linjer.length ? 'Ingen lagt til ennå'
        : `${linjer.length} enhet${linjer.length === 1 ? '' : 'er'} · pakket ut ${ut}/${linjer.length}${ut ? ` · inn ${inn}/${linjer.length}` : ''}`;
      return `<div class="utlaan-card" style="cursor:pointer" onclick="openProsjektModal(${p.id})">
        <div class="utlaan-card-header">
          <div class="utlaan-card-title">${p.navn}</div>
          <span class="cat-badge" style="color:${c};border-color:${c}22;background:${c}11">${p.status}</span>
        </div>
        <div class="utlaan-meta">
          ${p.sted ? `<div><strong>Sted:</strong> ${p.sted}</div>` : ''}
          <div><strong>Dato:</strong> ${p.fra}${p.til ? ' – ' + p.til : ''}</div>
          ${p.oppdragsgiver ? `<div><strong>Oppdragsgiver:</strong> ${p.oppdragsgiver}</div>` : ''}
          <div><strong>Utstyr:</strong> ${pakkeTekst}</div>
          ${p.notat ? `<div><strong>Notat:</strong> ${p.notat}</div>` : ''}
        </div>
        <div class="utlaan-actions">
          ${linjer.length ? `<button class="btn btn-purple" style="font-size:0.7rem;padding:7px 12px" onclick="event.stopPropagation(); openProsjektModal(${p.id}, 'ptab-pakkliste')">Pakkliste</button>` : ''}
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
  // Utstyr som er pakket ut, men aldri krysset inn igjen, er i praksis
  // fortsatt ute på oppdrag — verdt en advarsel før man lukker saken.
  const linjer = await API.getProsjektUtstyr(id);
  const utestaaende = linjer.filter(l => l.pakketUt && !l.pakketInn).length;
  const advarsel = utestaaende
    ? `\n\nOBS: ${utestaaende} enhet${utestaaende === 1 ? ' er' : 'er er'} pakket ut, men ikke krysset inn igjen på pakklista.`
    : '';
  if (!confirm(`Merk prosjektet som fullført? Reservert utstyr blir ledig igjen.${advarsel}`)) return;

  const p = await API.getProsjektById(id);
  await API.saveProsjekt({ ...p, id, status: 'Fullført' });
  await renderProsjekter();
  await render();
}

async function openProsjektModal(id, tab = 'ptab-info') {
  editProsjektId = id;
  prosjektKommentarApen = null;
  await stoppSkanning();
  settPakkeRetning('ut');   // pakking er utgangspunktet, og knappene resynkes

  document.querySelectorAll('.modal-tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
  $(tab).classList.add('active');
  $('prosjekt-modal-overlay').querySelector(`[data-tab="${tab}"]`).classList.add('active');

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
  if (tab === 'ptab-pakkliste') await renderPakkliste();
  $('prosjekt-modal-overlay').classList.add('open');
}

async function renderProsjektUtstyrTab() {
  const utstyr = await API.getUtstyr();
  const sel = $('pu-utstyr');
  sel.innerHTML = utstyr.map(r => `<option value="${r.id}">${fullNavn(r)} (${r.kategori})</option>`).join('');
  await oppdaterProsjektEnhetSelect(sel.value);

  const el     = $('prosjekt-utstyr-list');
  const varsel = $('prosjekt-konflikt-varsel');
  varsel.innerHTML = '';

  if (editProsjektId === null) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.78rem">Lagre prosjektet først for å legge til utstyr.</p>';
    return;
  }

  const [p, linjer, alleEnheter, bookinger] = await Promise.all([
    API.getProsjektById(editProsjektId),
    API.getProsjektUtstyr(editProsjektId),
    API.getAlleEnheter(),
    API.getBookinger(),
  ]);

  // Enhetene båndlegges i prosjektets lagrede periode. Har man endret
  // datoene i skjemaet uten å lagre, gjelder ledigheten under fortsatt
  // de gamle datoene — det må man få vite.
  const meldinger = [];
  if ($('p-fra').value !== p.fra || ($('p-til').value || '') !== (p.til || '')) {
    meldinger.push({ feil: false, tekst: 'Datoene er endret, men ikke lagret. Ledigheten under gjelder de lagrede datoene.' });
  }

  // Dobbeltbooking kan oppstå i ettertid — typisk ved at prosjektet
  // flyttes til datoer der utstyret allerede er lovt bort.
  const konflikter = linjer
    .map(l => ({ l, k: finnKonflikter(bookinger, l.enhetId, p.fra, p.til || p.fra, { kilde: 'prosjekt', id: l.id })[0] }))
    .filter(x => x.k);
  if (konflikter.length) {
    const enhetNavn = id => enhetLabel(alleEnheter.find(e => e.id === id));
    meldinger.push({
      feil: true,
      tekst: `Dobbeltbooket: ${konflikter.map(({ l, k }) => `${enhetNavn(l.enhetId)} → ${k.tittel} (${periodeTekst(k)})`).join(', ')}`,
    });
  }
  varsel.innerHTML = meldinger.map(m =>
    `<div class="varsel${m.feil ? ' varsel-feil' : ''}">${m.tekst}</div>`).join('');

  if (!linjer.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.78rem;padding:8px 0">Ingen utstyr lagt til ennå.</p>';
    return;
  }
  const utstyrMap  = Object.fromEntries(utstyr.map(r => [r.id, r]));
  const enheterMap = Object.fromEntries(alleEnheter.map(e => [e.id, e]));

  // Slå sammen linjer per varemodell: "Vare × antall" med hver enkelt
  // reservert enhet som en egen fjernbar merkelapp på slutten av linjen.
  const grupper = new Map();
  for (const l of linjer) {
    if (!grupper.has(l.utstyrId)) grupper.set(l.utstyrId, []);
    grupper.get(l.utstyrId).push(l);
  }

  // Grupperes og sorteres etter kategori, med en subtil kategorioverskrift
  // hver gang kategorien endrer seg.
  const grupperArr = [...grupper.entries()]
    .map(([utstyrId, gruppeLinjer]) => ({ utstyrId, gruppeLinjer, kategori: utstyrMap[utstyrId]?.kategori || 'Annet' }))
    .sort((a, b) => a.kategori.localeCompare(b.kategori, 'no'));

  let sisteKategori = null;
  el.innerHTML = grupperArr.map(({ utstyrId, gruppeLinjer, kategori }) => {
    const item = utstyrMap[utstyrId];
    const badges = gruppeLinjer.map(l => {
      const enhet = enheterMap[l.enhetId];
      const label = enhet ? (enhet.asset_id || '#' + enhet.enhet_nr) : 'Ukjent';
      return `<span class="enhet-badge removable-badge" onclick="event.stopPropagation(); fjernProsjektUtstyr(${l.id})" title="Fjern ${label}">${label} ×</span>`;
    }).join('');
    const kommentar = gruppeLinjer.find(l => l.kommentar)?.kommentar || '';
    const kommentarAttr = kommentar.replace(/"/g, '&quot;');
    const erApen = prosjektKommentarApen === utstyrId;
    const kommentarHtml = erApen
      ? `<input type="text" class="prosjekt-utstyr-kommentar" placeholder="Kommentar (valgfritt)" value="${kommentarAttr}" autofocus
           onclick="event.stopPropagation()" onchange="lagreProsjektUtstyrKommentar(${utstyrId}, this.value)">`
      : (kommentar ? `<span class="prosjekt-kommentar-tekst" title="${kommentarAttr}">${kommentar}</span>` : '');
    const overskrift = kategori !== sisteKategori ? `<div class="prosjekt-utstyr-kategori">${kategori}</div>` : '';
    sisteKategori = kategori;
    return `${overskrift}<div class="inline-logg-item prosjekt-utstyr-rad" onclick="toggleProsjektKommentar(${utstyrId})">
      <span class="inline-logg-text">${item ? fullNavn(item) : 'Ukjent utstyr'} <span style="color:var(--muted)">× ${gruppeLinjer.length}</span> ${badges}</span>
      ${kommentarHtml}
    </div>`;
  }).join('');
}

// Hvilken varegruppes kommentarfelt som er åpent i prosjektets utstyrsliste.
let prosjektKommentarApen = null;

function toggleProsjektKommentar(utstyrId) {
  prosjektKommentarApen = prosjektKommentarApen === utstyrId ? null : utstyrId;
  renderProsjektUtstyrTab();
}

async function lagreProsjektUtstyrKommentar(utstyrId, kommentar) {
  await API.setProsjektUtstyrKommentar(editProsjektId, utstyrId, kommentar.trim());
}

// Enhetene reserveres for prosjektets lagrede periode — enheter som er
// opptatt i den perioden, eller allerede står på lista, vises avslått.
async function oppdaterProsjektEnhetSelect(utstyrId) {
  if (editProsjektId === null) {
    $('pu-enhet').innerHTML = '<option value="">— lagre prosjektet først —</option>';
    return;
  }
  const [p, linjer] = await Promise.all([
    API.getProsjektById(editProsjektId),
    API.getProsjektUtstyr(editProsjektId),
  ]);
  await byggEnhetValg($('pu-enhet'), utstyrId, {
    fra: p.fra, til: p.til || p.fra,
    paaListen: linjer.map(l => l.enhetId),
  });
}

async function leggTilProsjektUtstyr() {
  if (editProsjektId === null) { showToast('Lagre prosjektet først.', 'error'); return; }
  const utstyrId = parseInt($('pu-utstyr').value);
  const enhetId  = $('pu-enhet').value ? parseInt($('pu-enhet').value) : null;
  if (!utstyrId || !enhetId) { showToast('Velg en ledig enhet.', 'error'); return; }

  const p = await API.getProsjektById(editProsjektId);
  const konflikter = finnKonflikter(await API.getBookinger(), enhetId, p.fra, p.til || p.fra);
  if (konflikter.length) {
    showToast(`Enheten er allerede booket: ${konflikter[0].tittel} (${periodeTekst(konflikter[0])}).`, 'error');
    await renderProsjektUtstyrTab();
    return;
  }

  await API.addProsjektUtstyr({ prosjektId: editProsjektId, utstyrId, enhetId });
  await render();
  await renderProsjektUtstyrTab();
}

async function fjernProsjektUtstyr(id) {
  await API.removeProsjektUtstyr(id);
  await renderProsjektUtstyrTab();
  await render();
}

async function saveProsjekt() {
  const navn = $('p-navn').value.trim();
  if (!navn) { showToast('Navn er påkrevd.', 'error'); return; }
  const fra = $('p-fra').value;
  if (!fra) { showToast('Fra-dato er påkrevd.', 'error'); return; }
  const til = $('p-til').value;
  if (til && til < fra) { showToast('Til-dato kan ikke være før fra-dato.', 'error'); return; }

  const p = await API.saveProsjekt({
    id:            editProsjektId,
    navn, fra, til,
    sted:          $('p-sted').value.trim(),
    oppdragsgiver: $('p-oppdragsgiver').value.trim(),
    status:        $('p-status').value,
    notat:         $('p-notat').value.trim(),
  });
  editProsjektId = p.id;

  // Flyttes prosjektet til datoer der utstyret allerede er lovt bort,
  // skal man få vite det med en gang — ikke oppdage det på lasterampen.
  const [linjer, bookinger] = await Promise.all([
    API.getProsjektUtstyr(p.id), API.getBookinger(),
  ]);
  const antall = linjer.filter(l =>
    finnKonflikter(bookinger, l.enhetId, p.fra, p.til || p.fra, { kilde: 'prosjekt', id: l.id }).length).length;

  closeModal('prosjekt-modal-overlay');
  await renderProsjekter();
  await render();
  if (antall) {
    showToast(`${antall} enhet${antall === 1 ? ' er' : 'er er'} dobbeltbooket i den nye perioden — se Utstyr-fanen.`, 'error');
  }
}

async function deleteProsjekt() {
  if (!confirm('Slette dette prosjektet? Reservert utstyr blir ledig igjen.')) return;
  await API.deleteProsjekt(editProsjektId);
  closeModal('prosjekt-modal-overlay');
  await renderProsjekter();
  await render();
}

// ════════════════════════════════════════════════════════════
// PAKKLISTE
// ════════════════════════════════════════════════════════════
// Reservasjonene i prosjektet er planen; pakklista er det som faktisk
// skjer fysisk. Hver enhet krysses "ut" når den lastes til oppdraget og
// "inn" når den er tilbake på lager — for hånd eller ved å skanne
// QR-koden på enheten.

// Hvilken vei skanning teller.
let pakkeRetning = 'ut';

function settPakkeRetning(retning) {
  pakkeRetning = retning;
  document.querySelectorAll('.pakk-retning-btn').forEach(b =>
    b.classList.toggle('valgt', b.dataset.retning === retning));
  $('skann-manuelt').placeholder = retning === 'ut'
    ? 'Asset-ID → kryss ut' : 'Asset-ID → kryss inn';
}

async function renderPakkliste() {
  const el = $('pakkliste-innhold');
  const fremdrift = $('pakkliste-fremdrift');

  if (editProsjektId === null) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.78rem">Lagre prosjektet og legg til utstyr først.</p>';
    fremdrift.textContent = '';
    return;
  }

  const [linjer, utstyr, enheter] = await Promise.all([
    API.getProsjektUtstyr(editProsjektId), API.getUtstyr(), API.getAlleEnheter(),
  ]);

  if (!linjer.length) {
    el.innerHTML = '<p style="color:var(--muted);font-size:0.78rem;padding:8px 0">Ingen enheter reservert — legg til utstyr under Utstyr-fanen.</p>';
    fremdrift.textContent = '';
    return;
  }

  const utstyrMap = Object.fromEntries(utstyr.map(r => [r.id, r]));
  const enhetMap  = Object.fromEntries(enheter.map(e => [e.id, e]));
  const ut  = linjer.filter(l => l.pakketUt).length;
  const inn = linjer.filter(l => l.pakketInn).length;
  fremdrift.innerHTML = `<strong>${ut}</strong>/${linjer.length} ut · <strong>${inn}</strong>/${linjer.length} inn`;

  const rader = linjer
    .map(l => ({ l, item: utstyrMap[l.utstyrId], enhet: enhetMap[l.enhetId] }))
    .sort((a, b) =>
      (a.item?.kategori || '').localeCompare(b.item?.kategori || '', 'no')
      || fullNavn(a.item).localeCompare(fullNavn(b.item), 'no')
      || (a.enhet?.asset_id || '').localeCompare(b.enhet?.asset_id || ''));

  let sisteKategori = null;
  el.innerHTML = rader.map(({ l, item, enhet }) => {
    const kategori = item?.kategori || 'Annet';
    const overskrift = kategori !== sisteKategori ? `<div class="prosjekt-utstyr-kategori">${kategori}</div>` : '';
    sisteKategori = kategori;
    return `${overskrift}<div class="pakk-rad${l.pakketInn ? ' pakk-ferdig' : ''}">
      <span class="pakk-id">${enhet?.asset_id || '#' + (enhet?.enhet_nr ?? '?')}</span>
      <span class="pakk-navn">${fullNavn(item)}${l.kommentar ? `<span class="pakk-kommentar"> — ${l.kommentar}</span>` : ''}</span>
      <button class="pakk-boks${l.pakketUt  ? ' av' : ''}" onclick="togglePakket(${l.id},'ut')"  title="${l.pakketUt  ? 'Pakket ut ' + kortDato(l.pakketUt.split('T')[0])  : 'Kryss ut'}">UT</button>
      <button class="pakk-boks${l.pakketInn ? ' av' : ''}" onclick="togglePakket(${l.id},'inn')" title="${l.pakketInn ? 'Pakket inn ' + kortDato(l.pakketInn.split('T')[0]) : 'Kryss inn'}">INN</button>
    </div>`;
  }).join('');
}

async function togglePakket(linjeId, retning) {
  const linjer = await API.getProsjektUtstyr(editProsjektId);
  const l = linjer.find(x => x.id === linjeId);
  if (!l) return;
  const alleredeSatt = retning === 'ut' ? l.pakketUt : l.pakketInn;
  await API.setProsjektUtstyrPakket(linjeId, retning, alleredeSatt ? null : naa());
  await renderPakkliste();
  await renderProsjekter();
}

// ── Skanning ─────────────────────────────────────────────────

let skanner = null;                        // Html5Qrcode-instans
let sisteSkann = { kode: null, tid: 0 };   // demper gjentatte avlesninger

// QR-koden inneholder JSON ({asset_id, vare, …}), men et asset-ID tastet
// for hånd — eller sendt fra en strekkodeleser — skal virke like godt.
function tolkSkannKode(tekst) {
  const raa = (tekst || '').trim();
  if (!raa) return null;
  try {
    const o = JSON.parse(raa);
    if (o && o.asset_id) return String(o.asset_id).trim().toUpperCase();
  } catch { /* ikke JSON — behandles som rått asset-ID */ }
  return raa.toUpperCase();
}

function pakkeTilbakemelding(tekst, erFeil = false) {
  showToast(tekst, erFeil ? 'error' : 'info');
  const el = $('skann-status');
  if (el) {
    el.textContent = tekst;
    el.className = 'skann-status' + (erFeil ? ' feil' : ' ok');
  }
  // Ute på lasterampen ser man ikke nødvendigvis på skjermen.
  if (navigator.vibrate) navigator.vibrate(erFeil ? [60, 50, 60] : 40);
}

async function registrerSkann(tekst) {
  const kode = tolkSkannKode(tekst);
  if (!kode || editProsjektId === null) return;

  // Kameraet leser den samme koden flere ganger i sekundet.
  const naaMs = Date.now();
  if (kode === sisteSkann.kode && naaMs - sisteSkann.tid < 2500) return;
  sisteSkann = { kode, tid: naaMs };

  const enhet = await API.getEnhetByAssetId(kode);
  if (!enhet) { pakkeTilbakemelding(`Ukjent kode: ${kode}`, true); return; }

  const linje = (await API.getProsjektUtstyr(editProsjektId)).find(l => l.enhetId === enhet.id);
  if (!linje) { pakkeTilbakemelding(`${kode} står ikke på denne pakklista`, true); return; }

  if (retningSatt(linje, pakkeRetning)) {
    pakkeTilbakemelding(`${kode} er allerede krysset ${pakkeRetning}`);
    return;
  }

  await API.setProsjektUtstyrPakket(linje.id, pakkeRetning, naa());
  pakkeTilbakemelding(`${kode} krysset ${pakkeRetning}`);
  await renderPakkliste();
  await renderProsjekter();
}

function retningSatt(linje, retning) {
  return retning === 'ut' ? !!linje.pakketUt : !!linje.pakketInn;
}

// Enter i feltet registrerer koden. Det gjør at feltet også virker med
// en vanlig strekkodeleser, som skriver koden og trykker Enter selv.
function skannManuelt(input) {
  const verdi = input.value.trim();
  if (!verdi) return;
  input.value = '';
  sisteSkann = { kode: null, tid: 0 };  // manuell inntasting er aldri dobbeltlesing
  registrerSkann(verdi);
}

function toggleSkanning() {
  return skanner ? stoppSkanning() : startSkanning();
}

async function startSkanning() {
  // Biblioteket lastes fra CDN. Er det ikke tilgjengelig (offline, blokkert)
  // fungerer pakklista fortsatt — man taster asset-ID i stedet.
  if (typeof Html5Qrcode === 'undefined') {
    showToast('Skanneren er ikke tilgjengelig — skriv asset-ID i feltet i stedet.', 'error');
    return;
  }
  $('skann-boks').style.display = 'block';
  try {
    skanner = new Html5Qrcode('skann-video', { verbose: false });
    await skanner.start(
      { facingMode: 'environment' },
      { fps: 10, qrbox: { width: 220, height: 220 } },
      tekst => registrerSkann(tekst),
      () => { /* ingen kode i bildet — helt normalt */ },
    );
    $('btn-skann').textContent = 'Stopp skanning';
  } catch (err) {
    console.error('Kunne ikke starte skanning:', err);
    skanner = null;
    $('skann-boks').style.display = 'none';
    showToast('Fikk ikke tilgang til kameraet — skriv asset-ID i feltet i stedet.', 'error');
  }
}

async function stoppSkanning() {
  if (!skanner) return;
  try {
    await skanner.stop();
    skanner.clear();
  } catch (err) {
    console.error('Feil ved stopp av skanning:', err);
  }
  skanner = null;
  $('skann-boks').style.display = 'none';
  $('skann-status').textContent = '';
  $('btn-skann').textContent = 'Skann';
}

// ── Utskrift ─────────────────────────────────────────────────
// Papirlista er fortsatt det som faktisk brukes i bilen og på riggen.
async function skrivUtPakkliste() {
  if (editProsjektId === null) return;
  const [p, linjer, utstyr, enheter] = await Promise.all([
    API.getProsjektById(editProsjektId), API.getProsjektUtstyr(editProsjektId),
    API.getUtstyr(), API.getAlleEnheter(),
  ]);
  if (!linjer.length) { showToast('Ingen utstyr å skrive ut.', 'error'); return; }

  const utstyrMap = Object.fromEntries(utstyr.map(r => [r.id, r]));
  const enhetMap  = Object.fromEntries(enheter.map(e => [e.id, e]));
  const rader = linjer
    .map(l => ({ l, item: utstyrMap[l.utstyrId], enhet: enhetMap[l.enhetId] }))
    .sort((a, b) => (a.item?.kategori || '').localeCompare(b.item?.kategori || '', 'no')
      || fullNavn(a.item).localeCompare(fullNavn(b.item), 'no'));

  const vindu = window.open('', '_blank');
  if (!vindu) { showToast('Nettleseren blokkerte utskriftsvinduet.', 'error'); return; }

  vindu.document.write(`<!DOCTYPE html><html lang="no"><head><meta charset="utf-8">
    <title>Pakkliste — ${p.navn}</title>
    <style>
      body { font-family: Arial, sans-serif; margin: 28px; color: #000; }
      h1 { font-size: 18px; margin: 0 0 4px; }
      .meta { font-size: 12px; color: #444; margin-bottom: 18px; }
      table { width: 100%; border-collapse: collapse; font-size: 12px; }
      th { text-align: left; border-bottom: 1.5px solid #000; padding: 6px 4px; font-size: 11px; text-transform: uppercase; }
      td { border-bottom: 1px solid #ccc; padding: 7px 4px; }
      .boks { display: inline-block; width: 13px; height: 13px; border: 1.5px solid #000; }
      .kat td { background: #f0f0f0; font-weight: bold; padding-top: 10px; }
      @media print { @page { margin: 14mm; } }
    </style></head><body>
    <h1>Pakkliste — ${p.navn}</h1>
    <div class="meta">
      ${p.sted ? p.sted + ' · ' : ''}${p.fra}${p.til ? ' – ' + p.til : ''}
      ${p.oppdragsgiver ? ' · ' + p.oppdragsgiver : ''} · ${linjer.length} enheter
    </div>
    <table><thead><tr>
      <th style="width:70px">Ut</th><th style="width:70px">Inn</th>
      <th style="width:90px">Asset-ID</th><th>Utstyr</th><th style="width:150px">Merknad</th>
    </tr></thead><tbody>
      ${(() => {
        let kat = null;
        return rader.map(({ l, item, enhet }) => {
          const k = item?.kategori || 'Annet';
          const rad = k !== kat ? `<tr class="kat"><td colspan="5">${k}</td></tr>` : '';
          kat = k;
          return `${rad}<tr>
            <td><span class="boks"></span></td>
            <td><span class="boks"></span></td>
            <td>${enhet?.asset_id || '#' + (enhet?.enhet_nr ?? '?')}</td>
            <td>${fullNavn(item)}</td>
            <td>${l.kommentar || ''}</td>
          </tr>`;
        }).join('');
      })()}
    </tbody></table></body></html>`);
  vindu.document.close();
  vindu.focus();
  vindu.print();
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
  // Sier fra hvis databasen ikke svarer (f.eks. et pauset Supabase-
  // prosjekt), slik at man ikke blir stående foran en animasjon uten
  // å vite hva som skjer.
  const tregTimer = setTimeout(
    () => splashStatus('Databasen bruker uvanlig lang tid…'), 8000);

  try {
    await API.init();

    ['search','filter-kat','filter-merke'].forEach(id =>
      $(id).addEventListener('input', render)
    );
    $('nl-dato').value = today();

    await render();
  } catch (err) {
    console.error('Oppstart feilet:', err);
    splashFeil('Fikk ikke kontakt med databasen — last siden på nytt.', feilDetalj(err));
    return;
  } finally {
    clearTimeout(tregTimer);
  }

  hideSplash();
}

initApp();
