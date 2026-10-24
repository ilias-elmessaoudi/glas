// Vorschau-Modus (?demo): spielt Spotify mit Beispieldaten nach, damit man die Oberfläche ohne Anmeldung sieht.

const cover = (h1, h2, text) => [{
  width: 640,
  url: 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${h1} 80% 55%)"/><stop offset="1" stop-color="hsl(${h2} 75% 35%)"/></linearGradient></defs><rect width="64" height="64" fill="url(#g)"/><circle cx="44" cy="20" r="12" fill="#fff" opacity=".18"/><text x="6" y="56" font-family="sans-serif" font-weight="800" font-size="11" fill="#fff">${text}</text></svg>`),
}];

const kuenstler = [
  { id: 'k1', name: 'Neon Avenue', type: 'artist', uri: 'spotify:artist:k1', images: cover(280, 320, 'NA') },
  { id: 'k2', name: 'Luma', type: 'artist', uri: 'spotify:artist:k2', images: cover(20, 350, 'LU') },
  { id: 'k3', name: 'Kaltwelle', type: 'artist', uri: 'spotify:artist:k3', images: cover(190, 230, 'KW') },
  { id: 'k4', name: 'Sora Blue', type: 'artist', uri: 'spotify:artist:k4', images: cover(140, 200, 'SB') },
];
const alben = [
  { id: 'a1', name: 'Nachtglas', type: 'album', uri: 'spotify:album:a1', images: cover(270, 330, 'NACHT'), artists: [kuenstler[0]], release_date: '2026-03-01', album_type: 'album' },
  { id: 'a2', name: 'Sonnenlicht', type: 'album', uri: 'spotify:album:a2', images: cover(30, 10, 'SONNE'), artists: [kuenstler[1]], release_date: '2025-07-11', album_type: 'album' },
  { id: 'a3', name: 'Tiefsee', type: 'album', uri: 'spotify:album:a3', images: cover(200, 240, 'TIEF'), artists: [kuenstler[2]], release_date: '2026-09-20', album_type: 'single' },
  { id: 'a4', name: 'Grünzone', type: 'album', uri: 'spotify:album:a4', images: cover(130, 170, 'GRÜN'), artists: [kuenstler[3]], release_date: '2024-05-02', album_type: 'album' },
];
const namen = ['Glasherz', 'Mitternacht', 'Lichtjahre', 'Gegen den Strom', 'Blaue Stunde', 'Echo', 'Schwerelos', 'Funken', 'Nordlicht', 'Atem', 'Satellit', 'Kein Zurück'];
const titel = namen.map((name, i) => {
  const album = alben[i % 4];
  return { id: 't' + i, name, type: 'track', uri: 'spotify:track:t' + i, duration_ms: 150000 + i * 13000, explicit: i % 5 === 2, artists: album.artists, album };
});
const playlists = [
  { id: 'p1', name: 'Gym Mode', images: cover(0, 30, 'GYM'), owner: { display_name: 'Ilias' }, uri: 'spotify:playlist:p1' },
  { id: 'p2', name: 'Chill Abends', images: cover(250, 210, 'CHILL'), owner: { display_name: 'Ilias' }, uri: 'spotify:playlist:p2' },
  { id: 'p3', name: 'Stream Musik', images: cover(290, 260, 'LIVE'), owner: { display_name: 'Ilias' }, uri: 'spotify:playlist:p3' },
  { id: 'p4', name: 'Volleyball', images: cover(45, 15, 'VB'), owner: { display_name: 'Ilias' }, uri: 'spotify:playlist:p4' },
  { id: 'p5', name: 'Deutschrap', images: cover(350, 320, 'DR'), owner: { display_name: 'Ilias' }, uri: 'spotify:playlist:p5' },
  { id: 'p6', name: 'Fokus', images: cover(170, 200, 'FOKUS'), owner: { display_name: 'Ilias' }, uri: 'spotify:playlist:p6' },
  { id: 'p7', name: 'Autofahrt', images: cover(210, 280, 'AUTO'), owner: { display_name: 'Ilias' }, uri: 'spotify:playlist:p7' },
];
const geraete = [
  { id: 'd1', name: 'iPhone 17 Pro Max', type: 'Smartphone', is_active: true, supports_volume: false, volume_percent: 100 },
  { id: 'd2', name: 'KXD-PC', type: 'Computer', is_active: false, supports_volume: true, volume_percent: 60 },
];

const p = { index: 0, laeuft: true, start: performance.now(), pos: 42000, shuffle: false, repeat: 'off', geraet: geraete[0], context: playlists[1], liked: new Set(['t1', 't4']) };
const jetzt = () => Math.min(p.pos + (p.laeuft ? performance.now() - p.start : 0), titel[p.index].duration_ms);
const setze = (i, pos = 0) => { p.index = (i + titel.length) % titel.length; p.pos = pos; p.start = performance.now(); };

export async function demoApi(pfad, { method = 'GET', body, query = {} } = {}) {
  await new Promise((r) => setTimeout(r, 60));
  const pf = pfad.replace('https://api.spotify.com/v1', '');
  if (jetzt() >= titel[p.index].duration_ms) setze(p.index + 1);
  const route = method + ' ' + pf.split('?')[0];

  if (route === 'GET /me') return { id: 'ilias', display_name: 'Ilias', images: [] };
  if (route === 'GET /me/player') return {
    is_playing: p.laeuft, progress_ms: jetzt(), item: titel[p.index], shuffle_state: p.shuffle, repeat_state: p.repeat,
    device: p.geraet, context: p.context ? { uri: p.context.uri, href: '/playlists/' + p.context.id } : null,
  };
  if (route === 'GET /me/player/devices') return { devices: geraete.map((g) => ({ ...g, is_active: g === p.geraet })) };
  if (route === 'PUT /me/player/play') {
    if (body?.offset?.uri) setze(titel.findIndex((t) => t.uri === body.offset.uri));
    else if (body?.uris) setze(titel.findIndex((t) => t.uri === body.uris[0]));
    else if (body?.context_uri) setze(0);
    if (body?.context_uri) p.context = playlists.find((x) => x.uri === body.context_uri) || null;
    if (!p.laeuft) { p.pos = jetzt(); p.start = performance.now(); }
    p.laeuft = true; return null;
  }
  if (route === 'PUT /me/player/pause') { p.pos = jetzt(); p.laeuft = false; return null; }
  if (route === 'POST /me/player/next') { setze(p.index + 1); return null; }
  if (route === 'POST /me/player/previous') { setze(p.index - 1); return null; }
  if (route === 'PUT /me/player/seek') { p.pos = +query.position_ms; p.start = performance.now(); return null; }
  if (route === 'PUT /me/player/shuffle') { p.shuffle = query.state === true || query.state === 'true'; return null; }
  if (route === 'PUT /me/player/repeat') { p.repeat = query.state; return null; }
  if (route === 'PUT /me/player/volume') { p.geraet.volume_percent = +query.volume_percent; return null; }
  if (route === 'PUT /me/player') { p.geraet = geraete.find((g) => g.id === body.device_ids[0]); return null; }
  if (route === 'GET /me/player/queue') return { queue: [1, 2, 3, 4, 5].map((n) => titel[(p.index + n) % titel.length]) };
  if (route === 'POST /me/player/queue') return null;
  if (route === 'GET /me/player/recently-played') return { items: titel.slice(2, 9).map((t) => ({ track: t })) };
  if (route === 'GET /me/top/artists') return { items: kuenstler };
  if (route === 'GET /me/playlists') return { items: playlists };
  if (route === 'GET /me/tracks') return { total: p.liked.size, items: titel.filter((t) => p.liked.has(t.id)).map((t) => ({ track: t })) };
  if (route === 'GET /me/tracks/contains') return [p.liked.has(query.ids)];
  if (route === 'PUT /me/tracks') { p.liked.add(query.ids); return null; }
  if (route === 'DELETE /me/tracks') { p.liked.delete(query.ids); return null; }
  if (route === 'GET /search') {
    const q = (query.q || '').toLowerCase();
    const passt = (x) => x.name.toLowerCase().includes(q) || x.artists?.some((a) => a.name.toLowerCase().includes(q));
    return { tracks: { items: titel.filter(passt) }, artists: { items: kuenstler.filter(passt) }, albums: { items: alben.filter(passt) }, playlists: { items: playlists.filter(passt) } };
  }
  let m;
  if ((m = pf.match(/^\/playlists\/(\w+)\/(items|tracks)/))) return { total: 8, items: titel.slice(0, 8).map((t) => ({ item: t })) };
  if ((m = pf.match(/^\/playlists\/(\w+)/))) return playlists.find((x) => x.id === m[1]) || playlists[0];
  if ((m = pf.match(/^\/albums\/(\w+)/))) { const a = alben.find((x) => x.id === m[1]); return { ...a, tracks: { items: titel.filter((t) => t.album === a) } }; }
  if ((m = pf.match(/^\/artists\/(\w+)\/albums/))) return { items: alben.filter((a) => a.artists[0].id === m[1]).concat(alben.slice(0, 2)) };
  if ((m = pf.match(/^\/artists\/(\w+)\/top-tracks/))) return { tracks: titel.filter((t) => t.artists[0].id === m[1]) };
  if ((m = pf.match(/^\/artists\/(\w+)/))) return kuenstler.find((x) => x.id === m[1]);
  return null;
}
