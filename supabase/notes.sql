-- Gedanken (freies Tagebuch) – zusätzlich zu schema.sql einmal im Supabase SQL-Editor ausführen.
-- Benötigt die Funktion public.entries_touch() aus schema.sql.

create table if not exists public.notes (
  id                uuid primary key,                    -- wird vom Gerät erzeugt
  user_id           uuid not null default auth.uid() references auth.users on delete cascade,
  entry_date        date not null,                       -- Datum, zu dem der Gedanke gehört
  created_at        timestamptz not null default now(),
  body              text not null default '',
  deleted           boolean not null default false,      -- gelöscht (bleibt für den Sync erhalten)
  updated_at        timestamptz not null default now(),
  server_updated_at timestamptz not null default now()
);

create index if not exists notes_user_server_updated
  on public.notes (user_id, server_updated_at);

drop trigger if exists notes_touch on public.notes;
create trigger notes_touch
  before insert or update on public.notes
  for each row execute function public.entries_touch();

revoke all on public.notes from anon;
grant select, insert, update, delete on public.notes to authenticated;

alter table public.notes enable row level security;

drop policy if exists "eigene lesen"   on public.notes;
drop policy if exists "eigene anlegen" on public.notes;
drop policy if exists "eigene ändern"  on public.notes;
drop policy if exists "eigene löschen" on public.notes;

create policy "eigene lesen"   on public.notes for select to authenticated using (user_id = auth.uid());
create policy "eigene anlegen" on public.notes for insert to authenticated with check (user_id = auth.uid());
create policy "eigene ändern"  on public.notes for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "eigene löschen" on public.notes for delete to authenticated using (user_id = auth.uid());
