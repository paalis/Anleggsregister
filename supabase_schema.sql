-- ============================================================
-- Petors AS — Supabase skjema
-- Kjør dette i Supabase Dashboard → SQL Editor
-- ============================================================

-- UTSTYR
create table utstyr (
  id            bigint primary key generated always as identity,
  kategori      text not null,
  merke         text,
  vare          text not null,
  kvantitet     integer not null default 1,
  lokasjon      text,
  kommentar     text,
  status        text not null default 'OK',
  serienummer   text,
  innkjopspris  numeric,
  innkjopsdato  date,
  opprettet     timestamptz default now()
);

-- ENHETER (individuelle fysiske enheter av et utstyr)
create table enheter (
  id          bigint primary key generated always as identity,
  utstyr_id   bigint references utstyr(id) on delete cascade,
  enhet_nr    integer not null,
  serienummer text,
  status      text not null default 'OK',
  kommentar   text,
  opprettet   timestamptz default now()
);

-- UTLÅN
create table utlaan (
  id            bigint primary key generated always as identity,
  utstyr_id     bigint references utstyr(id) on delete cascade,
  enhet_id      bigint references enheter(id) on delete set null,
  laantaker     text not null,
  fra           date not null,
  til           date,
  antall        integer not null default 1,
  notat         text,
  opprettet     timestamptz default now()
);

-- SERVICELOGG
create table logg (
  id            bigint primary key generated always as identity,
  utstyr_id     bigint references utstyr(id) on delete cascade,
  type          text not null check (type in ('service', 'rep', 'notat')),
  dato          date not null,
  beskrivelse   text not null,
  utfort_av     text,
  opprettet     timestamptz default now()
);

-- PROSJEKTER (planlagte oppdrag)
create table prosjekt (
  id            bigint primary key generated always as identity,
  navn          text not null,
  sted          text,
  fra           date not null,
  til           date,
  oppdragsgiver text,
  status        text not null default 'Planlagt',
  notat         text,
  opprettet     timestamptz default now()
);

-- Utstyr planlagt til et prosjekt (modellnivå + antall)
create table prosjekt_utstyr (
  id          bigint primary key generated always as identity,
  prosjekt_id bigint references prosjekt(id) on delete cascade,
  utstyr_id   bigint references utstyr(id) on delete cascade,
  antall      integer not null default 1,
  opprettet   timestamptz default now()
);

-- ============================================================
-- Seed: importer eksisterende utstyr
-- ============================================================
insert into utstyr (kategori, vare, kvantitet, lokasjon, kommentar, status) values
  ('Sub',            'Meyer 650',              2, 'Selbu', 'På E-torget',  'OK'),
  ('Topper',         'Meyer CQ2',              2, 'Selbu', 'På E-torget',  'OK'),
  ('Topper',         'Meyer UPA-1',            2, 'Selbu', 'På E-torget',  'OK'),
  ('Topper',         'RCF TT08-A II',          2, 'Selbu', 'På E-torget',  'OK'),
  ('Monitor',        'Meyer MJF-212A',         2, 'Selbu', 'På E-torget',  'OK'),
  ('Monitor',        'Yamaha DZR-12',          2, 'Selbu', 'På E-torget',  'OK'),
  ('Monitor',        'Yamaha DZR-12-D',        1, 'Selbu', 'På E-torget',  'OK'),
  ('Lydmixer',       'Yamaha MG16x',           1, 'Selbu', 'På E-torget',  'OK'),
  ('Lydmixer',       'Yamaha QL-5',            1, 'Selbu', 'På E-torget',  'OK'),
  ('Lysmixer',       'MA Lighting GrandMA2',   1, 'Selbu', 'På E-torget',  'OK'),
  ('Stagerack',      'Yamaha Rio3224-D2',      1, 'Selbu', 'På E-Torget',  'OK'),
  ('Mikrofon',       'Shure Beta58A',          5, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'Shure SM58',             4, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'Shure SM57',             7, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'Shure Beta87A',          1, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'Shure Beta57A',          1, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'ADK SC-1',               2, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'Audix D6',               1, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'Sennheiser e906',         1, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'Sennheiser e903',         1, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'Shure Beta91A',           1, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'Shure Beta98A',           5, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'Sennheiser e835',         2, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'Shure Beta52A',           1, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'AKG 112',                1, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'Beyerdynamic Opus 87',   2, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'DPA 4099 Core LOUD SPL', 1, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'DPA 4099',               2, 'Selbu', 'Samlekassen',  'OK'),
  ('Mikrofon',       'Shure Super 55',          1, 'Selbu', 'Samlekassen',  'OK'),
  ('DI',             'Countryman Type 10 Stereo', 1, 'Selbu', 'Samlekassen', 'OK'),
  ('DI',             'Countryman Type 10',     4, 'Selbu', 'Samlekassen',  'OK'),
  ('DI',             'LA2 Audio DI2',          1, 'Selbu', 'Samlekassen',  'OK'),
  ('Stativ - gitar', 'K&M Elgitar',            2, 'Selbu', 'Samlekassen',  'OK'),
  ('Stativ - gitar', 'K&M Akkustisk',          1, 'Selbu', 'Samlekassen',  'OK'),
  ('Stativ - gitar', 'Proel El/akk',           1, 'Selbu', 'Samlekassen',  'OK'),
  ('Stativ - gitar', 'Rockline Elgitar',       1, 'Selbu', 'Samlekassen',  'OK'),
  ('Stativ - gitar', 'Supreme Akk',            1, 'Selbu', 'Samlekassen',  'OK');

-- ============================================================
-- Row Level Security (RLS)
-- Lar alle lese og skrive uten innlogging (intern app).
-- Bytt til autentisert tilgang senere ved behov.
-- ============================================================
alter table utstyr         enable row level security;
alter table enheter        enable row level security;
alter table utlaan         enable row level security;
alter table logg           enable row level security;
alter table prosjekt       enable row level security;
alter table prosjekt_utstyr enable row level security;

create policy "Alle kan lese og skrive utstyr"         on utstyr         for all using (true) with check (true);
create policy "Alle kan lese og skrive enheter"        on enheter        for all using (true) with check (true);
create policy "Alle kan lese og skrive utlaan"         on utlaan         for all using (true) with check (true);
create policy "Alle kan lese og skrive logg"           on logg           for all using (true) with check (true);
create policy "Alle kan lese og skrive prosjekt"       on prosjekt       for all using (true) with check (true);
create policy "Alle kan lese og skrive prosjekt_utstyr" on prosjekt_utstyr for all using (true) with check (true);

-- ============================================================
-- Migrering (kjør dette hvis du allerede har data i databasen):
-- alter table utlaan add column if not exists antall   integer not null default 1;
-- alter table utlaan add column if not exists enhet_id bigint references enheter(id) on delete set null;
-- alter table utstyr add column if not exists merke    text;
-- ============================================================
