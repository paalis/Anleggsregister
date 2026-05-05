/**
 * api.js — Petors AS Utstyrsregister
 *
 * Dette er datalaget. All kommunikasjon med datakilden går gjennom dette laget.
 *
 * NÅ:     Leser stardata fra data.json, lagrer endringer i localStorage.
 * SENERE: Bytt ut funksjonene nedenfor med fetch()-kall til din backend.
 *         Resten av appen (app.js) trenger ingen endringer.
 *
 * Eksempel på fremtidig bytte:
 *   async function getUtstyr() {
 *     const res = await fetch('/api/utstyr');
 *     return res.json();
 *   }
 */

const API = (() => {

  // ── Intern state ────────────────────────────────────────────
  let _db     = [];
  let _utlaan = [];
  let _logg   = [];
  let _nextId  = 1000;
  let _nextUId = 1000;
  let _nextLId = 1000;

  // ── Persistering (localStorage) ─────────────────────────────
  function _persist() {
    localStorage.setItem('petors_db',     JSON.stringify(_db));
    localStorage.setItem('petors_utlaan', JSON.stringify(_utlaan));
    localStorage.setItem('petors_logg',   JSON.stringify(_logg));
  }

  // ── Init: les fra data.json, override med localStorage hvis finnes ──
  async function init() {
    try {
      // Last stardata fra data.json
      const res  = await fetch('data.json');
      const seed = await res.json();

      // Bruk localStorage hvis den finnes (brukerens egne endringer)
      _db     = JSON.parse(localStorage.getItem('petors_db'))     ?? seed.utstyr;
      _utlaan = JSON.parse(localStorage.getItem('petors_utlaan')) ?? seed.utlaan;
      _logg   = JSON.parse(localStorage.getItem('petors_logg'))   ?? seed.logg;

    } catch (e) {
      // Fallback: bare localStorage (f.eks. lokal fil uten server)
      console.warn('Kunne ikke laste data.json, bruker localStorage.', e);
      _db     = JSON.parse(localStorage.getItem('petors_db'))     ?? [];
      _utlaan = JSON.parse(localStorage.getItem('petors_utlaan')) ?? [];
      _logg   = JSON.parse(localStorage.getItem('petors_logg'))   ?? [];
    }

    _nextId  = Math.max(..._db.map(r => r.id),     999) + 1;
    _nextUId = Math.max(..._utlaan.map(u => u.id), 999) + 1;
    _nextLId = Math.max(..._logg.map(l => l.id),   999) + 1;
  }

  // ════════════════════════════════════════════════════════════
  // UTSTYR
  // Bytt disse ut med fetch('/api/utstyr', ...) for backend.
  // ════════════════════════════════════════════════════════════

  function getUtstyr()       { return [..._db]; }
  function getUtstyrById(id) { return _db.find(r => r.id === id) ?? null; }

  function saveUtstyr(item) {
    if (item.id != null) {
      _db = _db.map(r => r.id === item.id ? { ...item } : r);
    } else {
      item = { ...item, id: _nextId++ };
      _db.push(item);
    }
    _persist();
    return item;
  }

  function deleteUtstyr(id) {
    _db = _db.filter(r => r.id !== id);
    _persist();
  }

  function setUtstyrStatus(id, status) {
    _db = _db.map(r => r.id === id ? { ...r, status } : r);
    _persist();
  }

  // ════════════════════════════════════════════════════════════
  // UTLÅN
  // ════════════════════════════════════════════════════════════

  function getUtlaan()        { return [..._utlaan]; }
  function getUtlaanById(id)  { return _utlaan.find(u => u.id === id) ?? null; }

  function saveUtlaan(entry) {
    if (entry.id != null) {
      _utlaan = _utlaan.map(u => u.id === entry.id ? { ...entry } : u);
    } else {
      entry = { ...entry, id: _nextUId++ };
      _utlaan.push(entry);
      setUtstyrStatus(entry.utstyrId, 'Utlånt');
    }
    _persist();
    return entry;
  }

  function returnerUtlaan(id) {
    const u = _utlaan.find(x => x.id === id);
    if (!u) return;
    _utlaan = _utlaan.filter(x => x.id !== id);
    setUtstyrStatus(u.utstyrId, 'OK');
    _persist();
  }

  function deleteUtlaan(id) {
    _utlaan = _utlaan.filter(u => u.id !== id);
    _persist();
  }

  // ════════════════════════════════════════════════════════════
  // SERVICELOGG
  // ════════════════════════════════════════════════════════════

  function getLogg()             { return [..._logg]; }
  function getLoggForUtstyr(id)  { return _logg.filter(l => l.utstyrId === id); }

  function saveLogg(entry) {
    entry = { ...entry, id: _nextLId++ };
    _logg.push(entry);
    _persist();
    return entry;
  }

  function deleteLogg(id) {
    _logg = _logg.filter(l => l.id !== id);
    _persist();
  }

  // ── Public API ───────────────────────────────────────────────
  return {
    init,
    // Utstyr
    getUtstyr, getUtstyrById, saveUtstyr, deleteUtstyr, setUtstyrStatus,
    // Utlån
    getUtlaan, getUtlaanById, saveUtlaan, returnerUtlaan, deleteUtlaan,
    // Logg
    getLogg, getLoggForUtstyr, saveLogg, deleteLogg,
  };

})();
