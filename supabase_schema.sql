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
  kommentar     text,
  opprettet     timestamptz default now()
);

-- ENHETER (individuelle fysiske enheter av et utstyr)
create table enheter (
  id           bigint primary key generated always as identity,
  utstyr_id    bigint references utstyr(id) on delete cascade,
  enhet_nr     integer not null,
  serienummer  text,
  status       text not null default 'OK',
  kommentar    text,
  innkjopspris numeric,
  innkjopsdato date,
  opprettet    timestamptz default now()
);

-- UTLÅN (alltid knyttet til en spesifikk enhet)
create table utlaan (
  id            bigint primary key generated always as identity,
  utstyr_id     bigint references utstyr(id) on delete cascade,
  enhet_id      bigint not null references enheter(id) on delete cascade,
  laantaker     text not null,
  fra           date not null,
  til           date,
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

-- Utstyr planlagt til et prosjekt (én rad per reservert enhet)
create table prosjekt_utstyr (
  id          bigint primary key generated always as identity,
  prosjekt_id bigint references prosjekt(id) on delete cascade,
  utstyr_id   bigint references utstyr(id) on delete cascade,
  enhet_id    bigint not null references enheter(id) on delete cascade,
  opprettet   timestamptz default now()
);

-- ============================================================
-- Seed: importer eksisterende utstyr
-- ============================================================
insert into utstyr (kategori, vare, kvantitet, kommentar) values
  ('Sub',            'Meyer 650',              2, 'På E-torget'),
  ('Topper',         'Meyer CQ2',              2, 'På E-torget'),
  ('Topper',         'Meyer UPA-1',            2, 'På E-torget'),
  ('Topper',         'RCF TT08-A II',          2, 'På E-torget'),
  ('Monitor',        'Meyer MJF-212A',         2, 'På E-torget'),
  ('Monitor',        'Yamaha DZR-12',          2, 'På E-torget'),
  ('Monitor',        'Yamaha DZR-12-D',        1, 'På E-torget'),
  ('Lydmixer',       'Yamaha MG16x',           1, 'På E-torget'),
  ('Lydmixer',       'Yamaha QL-5',            1, 'På E-torget'),
  ('Lysmixer',       'MA Lighting GrandMA2',   1, 'På E-torget'),
  ('Stagerack',      'Yamaha Rio3224-D2',      1, 'På E-Torget'),
  ('Mikrofon',       'Shure Beta58A',          5, 'Samlekassen'),
  ('Mikrofon',       'Shure SM58',             4, 'Samlekassen'),
  ('Mikrofon',       'Shure SM57',             7, 'Samlekassen'),
  ('Mikrofon',       'Shure Beta87A',          1, 'Samlekassen'),
  ('Mikrofon',       'Shure Beta57A',          1, 'Samlekassen'),
  ('Mikrofon',       'ADK SC-1',               2, 'Samlekassen'),
  ('Mikrofon',       'Audix D6',               1, 'Samlekassen'),
  ('Mikrofon',       'Sennheiser e906',         1, 'Samlekassen'),
  ('Mikrofon',       'Sennheiser e903',         1, 'Samlekassen'),
  ('Mikrofon',       'Shure Beta91A',           1, 'Samlekassen'),
  ('Mikrofon',       'Shure Beta98A',           5, 'Samlekassen'),
  ('Mikrofon',       'Sennheiser e835',         2, 'Samlekassen'),
  ('Mikrofon',       'Shure Beta52A',           1, 'Samlekassen'),
  ('Mikrofon',       'AKG 112',                1, 'Samlekassen'),
  ('Mikrofon',       'Beyerdynamic Opus 87',   2, 'Samlekassen'),
  ('Mikrofon',       'DPA 4099 Core LOUD SPL', 1, 'Samlekassen'),
  ('Mikrofon',       'DPA 4099',               2, 'Samlekassen'),
  ('Mikrofon',       'Shure Super 55',          1, 'Samlekassen'),
  ('DI',             'Countryman Type 10 Stereo', 1, 'Samlekassen'),
  ('DI',             'Countryman Type 10',     4, 'Samlekassen'),
  ('DI',             'LA2 Audio DI2',          1, 'Samlekassen'),
  ('Stativ - gitar', 'K&M Elgitar',            2, 'Samlekassen'),
  ('Stativ - gitar', 'K&M Akkustisk',          1, 'Samlekassen'),
  ('Stativ - gitar', 'Proel El/akk',           1, 'Samlekassen'),
  ('Stativ - gitar', 'Rockline Elgitar',       1, 'Samlekassen'),
  ('Stativ - gitar', 'Supreme Akk',            1, 'Samlekassen');

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
-- alter table utstyr drop column if exists serienummer; -- serienummer flyttet til enheter
-- insert into enheter (utstyr_id, enhet_nr, status, lokasjon)
--   select u.id, 1, u.status, nullif(u.lokasjon, '')
--   from utstyr u where not exists (select 1 from enheter e where e.utstyr_id = u.id);
-- alter table utstyr drop column if exists lokasjon; -- lokasjon flyttet til enheter
--
-- Status finnes nå kun på enhetsnivå: utlån og prosjekt-reservasjon må
-- knyttes til en spesifikk (ledig) enhet, ikke lenger vare + antall.
-- Hadde man data fra før måtte man selv bestemme hvilke fysiske enheter
-- som tilsvarte eksisterende "vare + antall"-reservasjoner/utlån.
-- alter table prosjekt_utstyr add column enhet_id bigint references enheter(id) on delete cascade;
-- -- ... migrer prosjekt_utstyr.enhet_id manuelt her ...
-- alter table prosjekt_utstyr alter column enhet_id set not null;
-- alter table prosjekt_utstyr drop column antall;
-- alter table utlaan alter column enhet_id set not null;
-- alter table utlaan drop column antall;
-- alter table utstyr drop column if exists status;
-- alter table enheter add column innkjopspris numeric; -- innkjøpspris/-dato flyttet til enheter
-- alter table enheter add column innkjopsdato date;
-- alter table utstyr drop column if exists innkjopspris;
-- alter table utstyr drop column if exists innkjopsdato;
-- ============================================================
