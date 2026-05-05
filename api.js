/**
 * api.js — Supabase-versjon
 *
 * Erstatter localStorage-versjonen. app.js er uendret.
 *
 * Sett disse i Vercel Dashboard → Settings → Environment Variables:
 *   SUPABASE_URL  → Supabase Dashboard → Settings → API → Project URL
 *   SUPABASE_KEY  → Supabase Dashboard → Settings → API → anon/public key
 */

const SUPABASE_URL = window.ENV?.SUPABASE_URL || '';
const SUPABASE_KEY = window.ENV?.SUPABASE_KEY || '';

const API = (() => {

  let sb;

  async function init() {
    const { createClient } = supabase; // fra CDN-script i index.html
    sb = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  function check(error, context) {
    if (error) {
      console.error(`Supabase feil (${context}):`, error.message);
      throw error;
    }
  }

  // ════════════════════════════════════════════════════════════
  // UTSTYR
  // ════════════════════════════════════════════════════════════

  async function getUtstyr() {
    const { data, error } = await sb.from('utstyr').select('*').order('kategori');
    check(error, 'getUtstyr');
    return data;
  }

  async function getUtstyrById(id) {
    const { data, error } = await sb.from('utstyr').select('*').eq('id', id).single();
    check(error, 'getUtstyrById');
    return data;
  }

  async function saveUtstyr(item) {
    const row = {
      kategori: item.kategori, vare: item.vare, kvantitet: item.kvantitet,
      lokasjon: item.lokasjon, kommentar: item.kommentar, status: item.status,
      serienummer: item.serienummer,
      innkjopspris: item.innkjopspris || null,
      innkjopsdato: item.innkjopsdato || null,
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

  async function setUtstyrStatus(id, status) {
    const { error } = await sb.from('utstyr').update({ status }).eq('id', id);
    check(error, 'setUtstyrStatus');
  }

  // ════════════════════════════════════════════════════════════
  // UTLÅN
  // ════════════════════════════════════════════════════════════

  async function getUtlaan() {
    const { data, error } = await sb.from('utlaan').select('*').order('fra', { ascending: false });
    check(error, 'getUtlaan');
    return data.map(u => ({ ...u, utstyrId: u.utstyr_id }));
  }

  async function getUtlaanById(id) {
    const { data, error } = await sb.from('utlaan').select('*').eq('id', id).single();
    check(error, 'getUtlaanById');
    return { ...data, utstyrId: data.utstyr_id };
  }

  async function saveUtlaan(entry) {
    const row = {
      utstyr_id: entry.utstyrId, laantaker: entry.laantaker,
      fra: entry.fra, til: entry.til || null, notat: entry.notat || null,
    };
    if (entry.id != null) {
      const { data, error } = await sb.from('utlaan').update(row).eq('id', entry.id).select().single();
      check(error, 'saveUtlaan (update)');
      return { ...data, utstyrId: data.utstyr_id };
    } else {
      const { data, error } = await sb.from('utlaan').insert(row).select().single();
      check(error, 'saveUtlaan (insert)');
      await setUtstyrStatus(entry.utstyrId, 'Utlånt');
      return { ...data, utstyrId: data.utstyr_id };
    }
  }

  async function returnerUtlaan(id) {
    const u = await getUtlaanById(id);
    await sb.from('utlaan').delete().eq('id', id);
    await setUtstyrStatus(u.utstyrId, 'OK');
  }

  async function deleteUtlaan(id) {
    const { error } = await sb.from('utlaan').delete().eq('id', id);
    check(error, 'deleteUtlaan');
  }

  // ════════════════════════════════════════════════════════════
  // SERVICELOGG
  // ════════════════════════════════════════════════════════════

  async function getLogg() {
    const { data, error } = await sb.from('logg').select('*').order('dato', { ascending: false });
    check(error, 'getLogg');
    return data.map(l => ({ ...l, utstyrId: l.utstyr_id, desc: l.beskrivelse, av: l.utfort_av }));
  }

  async function getLoggForUtstyr(id) {
    const { data, error } = await sb.from('logg').select('*').eq('utstyr_id', id).order('dato', { ascending: false });
    check(error, 'getLoggForUtstyr');
    return data.map(l => ({ ...l, utstyrId: l.utstyr_id, desc: l.beskrivelse, av: l.utfort_av }));
  }

  async function saveLogg(entry) {
    const row = {
      utstyr_id: entry.utstyrId, type: entry.type, dato: entry.dato,
      beskrivelse: entry.desc, utfort_av: entry.av || null,
    };
    const { data, error } = await sb.from('logg').insert(row).select().single();
    check(error, 'saveLogg');
    return { ...data, utstyrId: data.utstyr_id, desc: data.beskrivelse, av: data.utfort_av };
  }

  async function deleteLogg(id) {
    const { error } = await sb.from('logg').delete().eq('id', id);
    check(error, 'deleteLogg');
  }

  return {
    init,
    getUtstyr, getUtstyrById, saveUtstyr, deleteUtstyr, setUtstyrStatus,
    getUtlaan, getUtlaanById, saveUtlaan, returnerUtlaan, deleteUtlaan,
    getLogg, getLoggForUtstyr, saveLogg, deleteLogg,
  };

})();
