// Login per E-Mail und Passwort über Supabase Auth.
const MESSAGES = {
  'Invalid login credentials': 'E-Mail oder Passwort ist falsch.',
  'Email not confirmed': 'Bitte bestätige zuerst deine E-Mail-Adresse (Link im Postfach).',
  'User already registered': 'Für diese E-Mail gibt es schon ein Konto. Melde dich an.',
  'Password should be at least 6 characters.': 'Das Passwort muss mindestens 6 Zeichen haben.',
};

export function translateError(err) {
  if (!err) return '';
  if (!navigator.onLine) return 'Keine Internetverbindung.';
  return MESSAGES[err.message] || err.message || 'Unbekannter Fehler.';
}

// Anfragen nach 20 s abbrechen, damit ein hängendes Mobilnetz den Sync nicht dauerhaft blockiert.
function fetchWithTimeout(input, init = {}) {
  const timeout = AbortSignal.timeout ? AbortSignal.timeout(20000) : null;
  let signal = init.signal || timeout;
  if (init.signal && timeout && AbortSignal.any) signal = AbortSignal.any([init.signal, timeout]);
  return fetch(input, { ...init, signal });
}

export function createClient(url, key) {
  if (!window.supabase?.createClient) return null;
  return window.supabase.createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    global: { fetch: fetchWithTimeout },
  });
}

export async function currentUser(client) {
  const { data } = await client.auth.getSession();
  return data?.session?.user ?? null;
}

export async function signIn(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function signUp(client, email, password) {
  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
  return { user: data.user, session: data.session };
}

export async function signOut(client) {
  await client.auth.signOut();
}
