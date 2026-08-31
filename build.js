// build.js — kjøres av Vercel før deploy
// Erstatter %%SUPABASE_URL%% og %%SUPABASE_KEY%% i index.html
// med de faktiske miljøvariablene.
//
// Variablene er valgfrie overstyringer: står de tomme, blir
// plassholderne stående, og api.js faller tilbake på verdiene
// som ligger der. Bygget skal derfor ikke feile uten dem.

const fs   = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

const filePath = path.join(__dirname, 'index.html');
let html = fs.readFileSync(filePath, 'utf8');

if (url) html = html.replace('%%SUPABASE_URL%%', url);
if (key) html = html.replace('%%SUPABASE_KEY%%', key);

fs.writeFileSync(filePath, html);

if (url && key) {
  console.log('✅  Miljøvariabler injisert i index.html');
} else {
  console.warn('⚠️   SUPABASE_URL/SUPABASE_KEY ikke satt i Vercel — api.js bruker sine egne verdier.');
}
