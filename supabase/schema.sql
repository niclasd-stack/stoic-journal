-- Stoisches Journal – im Supabase SQL-Editor einmal komplett ausführen.

create table if not exists public.entries (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users on delete cascade,
  entry_date        date not null,                       -- lokales Datum des Eintrags
  kind              text not null check (kind in ('morning', 'evening')),
  answers           jsonb not null default '{}'::jsonb,
  mood              smallint check (mood between 1 and 5),
  updated_at        timestamptz not null default now(),  -- Zeitpunkt der Änderung (vom Gerät)
  server_updated_at timestamptz not null default now(),  -- vom Server gesetzt, für den Abgleich
  unique (user_id, entry_date, kind)
);

create index if not exists entries_user_server_updated
  on public.entries (user_id, server_updated_at);

-- Server-Zeitstempel setzen; ältere Änderungen überschreiben keine neueren (last-write-wins).
create or replace function public.entries_touch()
returns trigger language plpgsql as $$
begin
  if tg_op = 'UPDATE' and new.updated_at < old.updated_at then
    return old;
  end if;
  new.server_updated_at := now();
  return new;
end $$;

drop trigger if exists entries_touch on public.entries;
create trigger entries_touch
  before insert or update on public.entries
  for each row execute function public.entries_touch();

-- Zugriff nur für angemeldete Nutzer (neue Projekte vergeben keine Standardrechte mehr).
revoke all on public.entries from anon;
grant select, insert, update, delete on public.entries to authenticated;

-- Row Level Security: jeder sieht und ändert nur seine eigenen Einträge.
alter table public.entries enable row level security;

drop policy if exists "eigene lesen" on public.entries;
drop policy if exists "eigene anlegen" on public.entries;
drop policy if exists "eigene ändern" on public.entries;
drop policy if exists "eigene löschen" on public.entries;

create policy "eigene lesen"   on public.entries for select to authenticated using (user_id = auth.uid());
create policy "eigene anlegen" on public.entries for insert to authenticated with check (user_id = auth.uid());
create policy "eigene ändern"  on public.entries for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "eigene löschen" on public.entries for delete to authenticated using (user_id = auth.uid());
