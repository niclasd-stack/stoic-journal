# Prosoche – Stoisches Journal

*Prosoche* (griechisch: Aufmerksamkeit) ist die stoische Grundhaltung, ständig auf das eigene Denken und Handeln zu achten.

Eine installierbare Web-App (PWA) für Handy und Computer. Morgens bereitest du den Tag vor, abends prüfst du ihn. Dazu gibt es jeden Tag ein Zitat, eine Serie (Streak) und eine Statistik. Die Einträge werden über Supabase synchronisiert.

Die App braucht keinen Build-Schritt: Was in diesem Ordner liegt, wird genau so veröffentlicht.

## Lokal ausprobieren

```powershell
python -m http.server 8000
```

Danach http://localhost:8000 öffnen. Solange `js/config.js` leer ist, läuft die App im **lokalen Modus** ohne Login und ohne Sync.

## Einrichtung

### 1. Supabase (Datenbank und Login)
1. Auf https://supabase.com ein Konto anlegen und mit **New project** ein Projekt erstellen. Eine Region in der EU wählen, z. B. Frankfurt.
2. Links **SQL Editor** öffnen → **New query**, den Inhalt von `supabase/schema.sql` einfügen und **Run** klicken. Danach genauso `supabase/notes.sql` ausführen (Tabelle für die freien Gedanken).
3. Unter **Project Settings → API** die **Project URL** und den **anon public**-Key kopieren und in `js/config.js` eintragen.
4. Optional: Unter **Authentication → Sign In / Providers → Email** die Option „Confirm email“ ausschalten. Dann kannst du dich sofort nach der Registrierung anmelden.

### 2. GitHub Pages (Hosting mit HTTPS)
1. Auf GitHub ein öffentliches Repository `stoic-journal` anlegen.
2. Diesen Ordner hochladen (pushen).
3. Im Repository **Settings → Pages** öffnen und als Quelle **Deploy from a branch** mit `main` und `/ (root)` wählen.
4. Die App ist danach unter `https://<dein-name>.github.io/stoic-journal/` erreichbar.
5. Zurück in Supabase unter **Authentication → URL Configuration** diese Adresse als **Site URL** eintragen.

### 3. Installieren
- **Android:** Die URL in Chrome öffnen und über das Menü ⋮ **App installieren** wählen.
- **PC:** In Chrome oder Edge auf das Installieren-Symbol in der Adressleiste klicken.

## Updates veröffentlichen
Nach jeder Änderung in `sw.js` die `VERSION` erhöhen, z. B. `v2`, und dann pushen. Die Geräte laden die neue Fassung beim nächsten Öffnen.

## Datenschutz
Die Einträge liegen in deinem Supabase-Projekt. Row Level Security stellt sicher, dass jedes Konto nur seine eigenen Einträge lesen und ändern kann. Der anon-Key in `js/config.js` darf deshalb öffentlich sein. Über **Konto → Backup exportieren** bekommst du alle Einträge als JSON-Datei.
