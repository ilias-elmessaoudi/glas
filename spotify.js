// Spotify-Anbindung: Anmeldung (PKCE, ohne eigenen Server) und Web-API-Aufrufe.

const SCOPES = [
  'user-read-playback-state',
  'user-modify-playback-state',
  'user-read-currently-playing',
  'user-read-recently-played',
  'user-top-read',
  'user-library-read',
  'user-library-modify',
  'playlist-read-private',
  'playlist-read-collaborative',
].join(' ');

const API = 'https://api.spotify.com/v1';
const KEY = 'glas.auth';

function speicher(key, wert) {
  try {
    if (wert === undefined) return JSON.parse(localStorage.getItem(key));
    if (wert === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(wert));
  } catch { return null; }
}

export const demo = new URLSearchParams(location.search).has('demo');
export const redirectUri = () => location.origin + location.pathname;
export const clientId = () => speicher('glas.clientId') || window.GLAS_CLIENT_ID || '';
export const setClientId = (id) => speicher('glas.clientId', id.trim());

function zufall(n) {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a)).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]);
}

async function challenge(verifier) {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  return btoa(String.fromCharCode(...new Uint8Array(hash))).replace(/[+/=]/g, (c) => ({ '+': '-', '/': '_', '=': '' })[c]);
}

export async function anmelden() {
  const verifier = zufall(64);
  const state = zufall(16);
  sessionStorage.setItem('glas.pkce', JSON.stringify({ verifier, state }));
  const p = new URLSearchParams({
    client_id: clientId(),
    response_type: 'code',
    redirect_uri: redirectUri(),
    code_challenge_method: 'S256',
    code_challenge: await challenge(verifier),
    scope: SCOPES,
    state,
  });
  location.href = 'https://accounts.spotify.com/authorize?' + p;
}

export function abmelden() {
  speicher(KEY, null);
}

async function tokenAnfrage(body) {
  const r = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), ...body }),
  });
  if (!r.ok) throw new Error('Anmeldung fehlgeschlagen (' + r.status + ')');
  const t = await r.json();
  const alt = speicher(KEY) || {};
  const neu = {
    access: t.access_token,
    refresh: t.refresh_token || alt.refresh,
    bis: Date.now() + (t.expires_in - 60) * 1000,
  };
  speicher(KEY, neu);
  return neu;
}

// Nach der Rückkehr von Spotify: Code gegen Token tauschen. true = angemeldet.
export async function rueckkehrVerarbeiten() {
  if (demo) return true;
  const q = new URLSearchParams(location.search);
  if (!q.has('code') && !q.has('error')) return !!speicher(KEY) && !!clientId();
  const pkce = JSON.parse(sessionStorage.getItem('glas.pkce') || '{}');
  history.replaceState(null, '', redirectUri());
  if (q.has('error') || q.get('state') !== pkce.state) return false;
  await tokenAnfrage({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: redirectUri(), code_verifier: pkce.verifier });
  sessionStorage.removeItem('glas.pkce');
  return true;
}

let erneuern = null;
async function token() {
  let a = speicher(KEY);
  if (!a) throw new Error('nicht angemeldet');
  if (Date.now() > a.bis) {
    erneuern ||= tokenAnfrage({ grant_type: 'refresh_token', refresh_token: a.refresh }).finally(() => (erneuern = null));
    a = await erneuern;
  }
  return a.access;
}

export class ApiFehler extends Error {
  constructor(status, text) { super(text); this.status = status; }
}

export async function api(pfad, { method = 'GET', body, query } = {}, versuch = 0) {
  if (demo) return (await import('./demo.js')).demoApi(pfad, { method, body, query });
  const url = new URL(pfad.startsWith('http') ? pfad : API + pfad);
  if (query) for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, v);
  const r = await fetch(url, {
    method,
    headers: { Authorization: 'Bearer ' + (await token()), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  // Kurze Störungen bei Spotify (5xx) einfach nochmal versuchen
  if (r.status >= 500 && versuch < 2) {
    await new Promise((ok) => setTimeout(ok, 400 * (versuch + 1)));
    return api(pfad, { method, body, query }, versuch + 1);
  }
  if (r.status === 204 || r.status === 202) return null;
  if (r.status === 401) { abmelden(); location.reload(); }
  const text = await r.text();
  if (!r.ok) {
    let msg = text || 'Spotify antwortet gerade nicht (' + r.status + ')';
    try { msg = JSON.parse(text).error.message; } catch {}
    throw new ApiFehler(r.status, msg);
  }
  return text ? JSON.parse(text) : null;
}

// Wiedergabe-Befehle gehen an das aktive Gerät (meist die Spotify-App im Hintergrund).
export const player = {
  status: () => api('/me/player', { query: { additional_types: 'episode' } }),
  geraete: () => api('/me/player/devices').then((d) => d.devices),
  play: (body, device_id) => api('/me/player/play', { method: 'PUT', body, query: { device_id } }),
  pause: () => api('/me/player/pause', { method: 'PUT' }),
  weiter: () => api('/me/player/next', { method: 'POST' }),
  zurueck: () => api('/me/player/previous', { method: 'POST' }),
  springen: (ms) => api('/me/player/seek', { method: 'PUT', query: { position_ms: Math.round(ms) } }),
  zufall: (an) => api('/me/player/shuffle', { method: 'PUT', query: { state: an } }),
  wiederholen: (modus) => api('/me/player/repeat', { method: 'PUT', query: { state: modus } }),
  lautstaerke: (p) => api('/me/player/volume', { method: 'PUT', query: { volume_percent: Math.round(p) } }),
  uebertragen: (id) => api('/me/player', { method: 'PUT', body: { device_ids: [id], play: true } }),
  warteschlange: () => api('/me/player/queue'),
  anstellen: (uri) => api('/me/player/queue', { method: 'POST', query: { uri } }),
};

// Spotify hat 2026 einige Pfade umbenannt (/tracks -> /items); beide versuchen.
export async function playlistTitel(id, offset = 0) {
  try {
    return await api(`/playlists/${id}/items`, { query: { limit: 50, offset } });
  } catch (e) {
    if (e.status !== 404) throw e;
    return api(`/playlists/${id}/tracks`, { query: { limit: 50, offset } });
  }
}
