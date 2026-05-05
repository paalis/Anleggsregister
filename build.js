// build.js — kjøres av Vercel før deploy
// Erstatter %%SUPABASE_URL%% og %%SUPABASE_KEY%% i index.html
// med de faktiske miljøvariablene

const fs   = require('fs');
const path = require('path');

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY;

if (!url || !key) {
  console.error('❌  SUPABASE_URL og SUPABASE_KEY må være satt som miljøvariabler i Vercel.');
  process.exit(1);
}

const filePath = path.join(__dirname, 'public', 'index.html');
let html = fs.readFileSync(filePath, 'utf8');

html = html.replace('%%SUPABASE_URL%%', url);
html = html.replace('%%SUPABASE_KEY%%', key);

fs.writeFileSync(filePath, html);
console.log('✅  Miljøvariabler injisert i index.html');
