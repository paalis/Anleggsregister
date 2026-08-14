/**
 * api.js — Supabase-versjon
 *
 * Lim inn dine Supabase-verdier nedenfor.
 * For intern bruk er dette trygt nok.
 */

const SUPABASE_URL = 'https://wocbanyacwklsgemjcnx.supabase.co'; // <- din URL
const SUPABASE_KEY = 'sb_publishable_cI4_LoUOOQG8B36Z98Y2TQ_y3INe4Hr';                  // <- din publishable key

const API = (() => {

  let sb;

  async function init() {
    const { createClient } = supabase;
    sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  function check(error, context) {
    if (error) {
      console.error(`Supabase feil (${context}):`, error.message);
      throw error;
    }
  }

  async function getUtstyr() {
    const { data, error } = await sb.from('utstyr').select('*').order('kategori');
    check(error, 'getUtstyr'); return data;
  }

  async function getUtstyrById(id) {
    const { data, error } = await sb.from('utstyr').select('*').eq('id', id).single();
    check(error, 'getUtstyrById'); return data;
  }

  async function saveUtstyr(item) {
    const row = {
      kategori: item.kategori, merke: item.merke || null, vare: item.vare,
      kommentar: item.kommentar,
    };
    if (item.id != null) {
      const { data, error } = await sb.from('utstyr').update(row).eq('id', item.id).select().single();
      check(error, 'saveUtstyr (update)'); return data;
    } else {
      const { data, error } = await sb.from('utstyr').insert(row).select().single();
      check(error, 'saveUtstyr (insert)'); return data;
    }
  }

  async function deleteUtstyr(id) {
    const { error } = await sb.from('utstyr').delete().eq('id', id);
    check(error, 'deleteUtstyr');
  }

  // ── Enheter ──────────────────────────────────────────────────

  async function getEnheter(utstyrId) {
    const { data, error } = await sb.from('enheter').select('*').eq('utstyr_id', utstyrId).order('enhet_nr');
    check(error, 'getEnheter'); return data;
  }

  async function getAlleEnheter() {
    const { data, error } = await sb.from('enheter').select('*');
    check(error, 'getAlleEnheter'); return data;
  }

  async function getEnhetById(id) {
    const { data, error } = await sb.from('enheter').select('*').eq('id', id).single();
    check(error, 'getEnhetById'); return data;
  }

  async function getNextEnhetNr(utstyrId) {
    const { data } = await sb.from('enheter').select('enhet_nr').eq('utstyr_id', utstyrId).order('enhet_nr', { ascending: false }).limit(1);
    return data && data.length > 0 ? data[0].enhet_nr + 1 : 1;
  }

  async function lagAssetId(kategori) {
    const prefix = kategori.replace(/[^a-zA-ZæøåÆØÅ]/g, '').substring(0, 2).toUpperCase();
    const { data } = await sb.from('enheter').select('asset_id').like('asset_id', `${prefix}-%`);
    let nestNum = 1;
    if (data && data.length > 0) {
      const nums = data
        .map(e => parseInt((e.asset_id || '').split('-')[1] || '0'))
        .filter(n => n > 0);
      if (nums.length > 0) nestNum = Math.max(...nums) + 1;
    }
    return `${prefix}-${String(nestNum).padStart(3, '0')}`;
  }

  async function saveEnhet(entry) {
    const row = {
      utstyr_id:   entry.utstyrId,
      enhet_nr:    entry.enhetNr,
      serienummer: entry.serienummer || null,
      status:      entry.status || 'OK',
      kommentar:   entry.kommentar || null,
      lokasjon:    entry.lokasjon || null,
      innkjopspris: entry.innkjopspris || null,
      innkjopsdato: entry.innkjopsdato || null,
    };
    if (entry.id != null) {
      const { data, error } = await sb.from('enheter').update(row).eq('id', entry.id).select().single();
      check(error, 'saveEnhet (update)'); return data;
    } else {
      const { data, error } = await sb.from('enheter').insert(row).select().single();
      check(error, 'saveEnhet (insert)');
      const utstyr   = await getUtstyrById(entry.utstyrId);
      const asset_id = await lagAssetId(utstyr.kategori);
      await sb.from('enheter').update({ asset_id }).eq('id', data.id);
      return { ...data, asset_id };
    }
  }

  async function deleteEnhet(id) {
    const { error } = await sb.from('enheter').delete().eq('id', id);
    check(error, 'deleteEnhet');
  }

  async function setEnhetStatus(id, status) {
    const { error } = await sb.from('enheter').update({ status }).eq('id', id);
    check(error, 'setEnhetStatus');
  }

  // ── Utlån ────────────────────────────────────────────────────

  async function getUtlaan() {
    const { data, error } = await sb.from('utlaan').select('*').order('fra', { ascending: false });
    check(error, 'getUtlaan');
    return data.map(u => ({ ...u, utstyrId: u.utstyr_id, enhetId: u.enhet_id }));
  }

  async function getUtlaanById(id) {
    const { data, error } = await sb.from('utlaan').select('*').eq('id', id).single();
    check(error, 'getUtlaanById');
    return { ...data, utstyrId: data.utstyr_id, enhetId: data.enhet_id };
  }

  async function saveUtlaan(entry) {
    const row = {
      utstyr_id: entry.utstyrId,
      enhet_id:  entry.enhetId,
      laantaker: entry.laantaker,
      fra:       entry.fra,
      til:       entry.til || null,
      notat:     entry.notat || null,
    };
    if (entry.id != null) {
      const { data, error } = await sb.from('utlaan').update(row).eq('id', entry.id).select().single();
      check(error, 'saveUtlaan (update)');
      return { ...data, utstyrId: data.utstyr_id, enhetId: data.enhet_id };
    } else {
      const { data, error } = await sb.from('utlaan').insert(row).select().single();
      check(error, 'saveUtlaan (insert)');
      await setEnhetStatus(entry.enhetId, 'Utlånt');
      return { ...data, utstyrId: data.utstyr_id, enhetId: data.enhet_id };
    }
  }

  async function returnerUtlaan(id) {
    const u = await getUtlaanById(id);
    await sb.from('utlaan').delete().eq('id', id);
    await setEnhetStatus(u.enhetId, 'OK');
  }

  async function deleteUtlaan(id) {
    const { error } = await sb.from('utlaan').delete().eq('id', id);
    check(error, 'deleteUtlaan');
  }

  // ── Logg ─────────────────────────────────────────────────────

  async function getLogg() {
    const { data, error } = await sb.from('logg').select('*').order('dato', { ascending: false });
    check(error, 'getLogg');
    return data.map(l => ({ ...l, utstyrId: l.utstyr_id, enhetId: l.enhet_id, desc: l.beskrivelse, av: l.utfort_av }));
  }

  async function getLoggForUtstyr(id) {
    const { data, error } = await sb.from('logg').select('*').eq('utstyr_id', id).order('dato', { ascending: false });
    check(error, 'getLoggForUtstyr');
    return data.map(l => ({ ...l, utstyrId: l.utstyr_id, enhetId: l.enhet_id, desc: l.beskrivelse, av: l.utfort_av }));
  }

  async function saveLogg(entry) {
    const row = {
      utstyr_id: entry.utstyrId,
      enhet_id:  entry.enhetId || null,
      type:      entry.type,
      dato:      entry.dato,
      beskrivelse: entry.desc,
      utfort_av: entry.av || null,
    };
    const { data, error } = await sb.from('logg').insert(row).select().single();
    check(error, 'saveLogg');
    return { ...data, utstyrId: data.utstyr_id, enhetId: data.enhet_id, desc: data.beskrivelse, av: data.utfort_av };
  }

  async function deleteLogg(id) {
    const { error } = await sb.from('logg').delete().eq('id', id);
    check(error, 'deleteLogg');
  }

  // ── Prosjekter ───────────────────────────────────────────────

  async function getProsjekter() {
    const { data, error } = await sb.from('prosjekt').select('*').order('fra', { ascending: false });
    check(error, 'getProsjekter'); return data;
  }

  async function getProsjektById(id) {
    const { data, error } = await sb.from('prosjekt').select('*').eq('id', id).single();
    check(error, 'getProsjektById'); return data;
  }

  async function saveProsjekt(entry) {
    const row = {
      navn: entry.navn, sted: entry.sted || null,
      fra: entry.fra, til: entry.til || null,
      oppdragsgiver: entry.oppdragsgiver || null,
      status: entry.status || 'Planlagt',
      notat: entry.notat || null,
    };
    if (entry.id != null) {
      const { data, error } = await sb.from('prosjekt').update(row).eq('id', entry.id).select().single();
      check(error, 'saveProsjekt (update)'); return data;
    } else {
      const { data, error } = await sb.from('prosjekt').insert(row).select().single();
      check(error, 'saveProsjekt (insert)'); return data;
    }
  }

  async function deleteProsjekt(id) {
    const { error } = await sb.from('prosjekt').delete().eq('id', id);
    check(error, 'deleteProsjekt');
  }

  async function getProsjektUtstyr(prosjektId) {
    const { data, error } = await sb.from('prosjekt_utstyr').select('*').eq('prosjekt_id', prosjektId).order('id');
    check(error, 'getProsjektUtstyr');
    return data.map(p => ({ ...p, prosjektId: p.prosjekt_id, utstyrId: p.utstyr_id, enhetId: p.enhet_id }));
  }

  async function addProsjektUtstyr(entry) {
    const row = { prosjekt_id: entry.prosjektId, utstyr_id: entry.utstyrId, enhet_id: entry.enhetId };
    const { data, error } = await sb.from('prosjekt_utstyr').insert(row).select().single();
    check(error, 'addProsjektUtstyr');
    return { ...data, prosjektId: data.prosjekt_id, utstyrId: data.utstyr_id, enhetId: data.enhet_id };
  }

  async function removeProsjektUtstyr(id) {
    const { error } = await sb.from('prosjekt_utstyr').delete().eq('id', id);
    check(error, 'removeProsjektUtstyr');
  }

  return {
    init,
    getUtstyr, getUtstyrById, saveUtstyr, deleteUtstyr,
    getEnheter, getAlleEnheter, getEnhetById, getNextEnhetNr, saveEnhet, deleteEnhet, setEnhetStatus,
    getUtlaan, getUtlaanById, saveUtlaan, returnerUtlaan, deleteUtlaan,
    getLogg, getLoggForUtstyr, saveLogg, deleteLogg,
    getProsjekter, getProsjektById, saveProsjekt, deleteProsjekt,
    getProsjektUtstyr, addProsjektUtstyr, removeProsjektUtstyr,
  };

})();
