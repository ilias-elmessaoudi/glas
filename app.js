import { api, player, playlistTitel, anmelden, abmelden, rueckkehrVerarbeiten, clientId, setClientId, redirectUri, ApiFehler } from './spotify.js';

const $ = (s, el = document) => el.querySelector(s);
const ansicht = $('#ansicht');

const ICON = {
  play: '<svg viewBox="0 0 24 24"><path d="M7 4.5v15a1 1 0 0 0 1.5.86l12.4-7.5a1 1 0 0 0 0-1.72L8.5 3.64A1 1 0 0 0 7 4.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><rect x="5.5" y="4" width="4.5" height="16" rx="1.4"/><rect x="14" y="4" width="4.5" height="16" rx="1.4"/></svg>',
  weiter: '<svg viewBox="0 0 24 24"><path d="M16 5h2v14h-2zM5 5l9.5 7L5 19z"/></svg>',
  herz: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.9c0 5.9-8 10.6-8 10.6z" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  herzVoll: '<svg viewBox="0 0 24 24"><path d="M12 20.5s-8-4.7-8-10.6A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8 2.9c0 5.9-8 10.6-8 10.6z"/></svg>',
  mehr: '<svg viewBox="0 0 24 24"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>',
  zurueck: '<svg viewBox="0 0 24 24"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lupe: '<svg viewBox="0 0 24 24"><path d="M10.5 3a7.5 7.5 0 0 1 5.9 12.1l4.3 4.3-1.4 1.4-4.3-4.3A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z"/></svg>',
  welle: '<svg viewBox="0 0 24 24"><path d="M3 10h2v4H3zm4-3h2v10H7zm4-4h2v18h-2zm4 4h2v10h-2zm4 3h2v4h-2z"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24"><path d="M17 3l4 4-4 4V8h-2.2l-3.1 4 3.1 4H17v-3l4 4-4 4v-3h-3.2l-3.6-4.7L6.6 18H3v-2h2.6l3.3-4.3L5.6 8H3V6h3.6l3.5 4.5L13.8 6H17z"/></svg>',
  wiederholenEins: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/><path d="M11 10h1.6v5H11z"/></svg>',
  wiederholen: '<svg viewBox="0 0 24 24"><path d="M7 7h10v3l4-4-4-4v3H5v6h2zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2z"/></svg>',
  handy: '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="3"/></svg>',
  pc: '<svg viewBox="0 0 24 24"><path d="M3 4h18v12H3zm5 14h8v2H8z"/></svg>',
  lautsprecher: '<svg viewBox="0 0 24 24"><rect x="6" y="2" width="12" height="20" rx="3"/><circle cx="12" cy="14" r="3.5" fill="#000" opacity=".4"/></svg>',
};

const esc = (s = '') => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const bild = (imgs, groesse = 300) => {
  if (!imgs?.length) return 'icons/leer.svg';
  return [...imgs].sort((a, b) => (a.width || 0) - (b.width || 0)).find((i) => (i.width || 640) >= groesse)?.url || imgs[0].url;
};
const namen = (artists = []) => artists.map((a) => a.name).join(', ');
const zeit = (ms = 0) => { const s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

function toast(text, ms = 2600) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  t.style.animation = 'none'; t.offsetHeight; t.style.animation = '';
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), ms);
}

// Weicher Wechsel zwischen Seiten, wenn der Browser View Transitions kann.
async function weich(fn) {
  if (!document.startViewTransition || document.hidden || matchMedia('(prefers-reduced-motion: reduce)').matches) return fn();
  const vt = document.startViewTransition(fn);
  vt.ready.catch(() => {});
  vt.finished.catch(() => {});
  await vt.updateCallbackDone;
}

/* ================= Hintergrundfarben aus dem Cover ================= */

const farbCache = new Map();
async function coverFarben(url) {
  if (farbCache.has(url)) return farbCache.get(url);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.src = url;
  try { await img.decode(); } catch { return null; }
  const c = document.createElement('canvas');
  c.width = c.height = 24;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, 24, 24);
  let d;
  try { d = ctx.getImageData(0, 0, 24, 24).data; } catch { return null; }
  // Farben in grobe Töpfe sortieren, kräftige Farben bevorzugen.
  const toepfe = new Map();
  for (let i = 0; i < d.length; i += 4) {
    const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const satt = max ? (max - min) / max : 0;
    const hell = max / 255;
    if (hell < .12) continue;
    const k = (r >> 5) + ',' + (g >> 5) + ',' + (b >> 5);
    const t = toepfe.get(k) || { r: 0, g: 0, b: 0, n: 0, w: 0 };
    t.r += r; t.g += g; t.b += b; t.n++; t.w += .4 + satt * 1.6 + (hell > .9 ? -.3 : 0);
    toepfe.set(k, t);
  }
  const liste = [...toepfe.values()].sort((a, b) => b.w - a.w);
  const farben = [];
  for (const t of liste) {
    const f = [t.r / t.n, t.g / t.n, t.b / t.n];
    if (farben.every((x) => Math.hypot(x[0] - f[0], x[1] - f[1], x[2] - f[2]) > 60)) farben.push(f);
    if (farben.length === 3) break;
  }
  while (farben.length < 3) farben.push(farben[0] || [70, 50, 120]);
  const css = farben.map(([r, g, b]) => `rgb(${r | 0},${g | 0},${b | 0})`);
  farbCache.set(url, css);
  return css;
}

let ambientUrl = null;
async function ambient(url) {
  if (!url || url === ambientUrl) return;
  ambientUrl = url;
  const f = await coverFarben(url);
  if (!f || url !== ambientUrl) return;
  const [alt, neu] = [$('.ambient-ebene.aktiv'), $('.ambient-ebene:not(.aktiv)')];
  neu.style.setProperty('--fa', f[0]);
  neu.style.setProperty('--fb', f[1]);
  neu.style.setProperty('--fc', f[2]);
  neu.classList.add('aktiv');
  alt.classList.remove('aktiv');
  document.querySelector('meta[name=theme-color]').content = f[0];
}

/* ================= Wiedergabe-Zustand ================= */

const z = {
  status: null,        // letzte Antwort von /me/player
  abgerufen: 0,        // wann (performance.now)
  liked: new Map(),    // Track-ID -> true/false
  ich: null,
  zieht: false,
};

const aktuellerTitel = () => z.status?.item || null;
const spielt = () => !!z.status?.is_playing;
const position = () => {
  if (!z.status) return 0;
  const p = z.status.progress_ms + (spielt() ? performance.now() - z.abgerufen : 0);
  return Math.min(p, z.status.item?.duration_ms || p);
};

let abfrageTimer = null;
async function abfragen() {
  clearTimeout(abfrageTimer);
  try {
    const s = await player.status();
    const vorher = aktuellerTitel()?.id;
    z.status = s;
    z.abgerufen = performance.now();
    if (s?.item && s.item.id !== vorher) await titelGewechselt(s.item);
    zeigeStatus();
  } catch (e) {
    if (!(e instanceof ApiFehler)) console.warn(e);
  }
  if (!document.hidden) abfrageTimer = setTimeout(abfragen, spielt() ? 1500 : 4000);
}
// Nach einem Befehl kurz warten, bis Spotify den neuen Zustand meldet.
const baldAbfragen = (ms = 350) => { clearTimeout(abfrageTimer); abfrageTimer = setTimeout(abfragen, ms); };

document.addEventListener('visibilitychange', () => { if (!document.hidden) abfragen(); });

async function titelGewechselt(t) {
  const cover = bild(t.album?.images || t.images, 640);
  ambient(cover);
  // Cover im großen Player weich austauschen
  const pc = $('.player-cover');
  if (pc.getAttribute('src') && pc.getAttribute('src') !== cover) {
    pc.classList.add('wechsel');
    const neu = new Image(); neu.src = cover;
    try { await neu.decode(); } catch {}
    pc.src = cover;
    requestAnimationFrame(() => pc.classList.remove('wechsel'));
  } else pc.src = cover;
  $('.mini-cover').src = bild(t.album?.images || t.images, 120);
  if (t.type === 'track' && !z.liked.has(t.id)) {
    try {
      const [ja] = await api('/me/library/contains', { query: { uris: t.uri } });
      z.liked.set(t.id, ja);
    } catch {}
  }
  markiereLaufend();
}

function zeigeStatus() {
  const s = z.status, t = s?.item;
  $('#mini').hidden = !t;
  if (!t) return;
  const sub = t.type === 'episode' ? t.show?.name : namen(t.artists);
  $('.mini-text b').textContent = t.name;
  $('.mini-text span').textContent = sub;
  $('.player-titel b').textContent = t.name;
  $('.player-titel span').textContent = sub;
  $('.player-quelle b').textContent = s.context ? quelleName(s.context) : (t.album?.name || '');
  const pp = spielt() ? ICON.pause : ICON.play;
  for (const b of document.querySelectorAll('[data-aktion=playpause]')) if (b.dataset.zeigt !== pp) { b.innerHTML = pp; b.dataset.zeigt = pp; }
  if (!$('.mini-weiter').innerHTML) $('.mini-weiter').innerHTML = ICON.weiter;
  $('#player').classList.toggle('spielt', spielt());
  $('[data-aktion=zufall]').classList.toggle('an', s.shuffle_state);
  const w = $('[data-aktion=wiederholen]');
  w.classList.toggle('an', s.repeat_state !== 'off');
  w.innerHTML = s.repeat_state === 'track' ? ICON.wiederholenEins : ICON.wiederholen;
  const herz = $('.herz'), ja = z.liked.get(t.id);
  herz.classList.toggle('an', !!ja);
  herz.innerHTML = ja ? ICON.herzVoll : ICON.herz;
  const g = s.device;
  $('.geraet-knopf span').textContent = g ? g.name : 'Gerät wählen';
  $('.geraet-knopf').classList.toggle('aktiv', !!g);
  $('#laut').style.display = g?.supports_volume === false ? 'none' : '';
  if (g?.volume_percent != null && !z.zieht) $('#laut i').style.width = g.volume_percent + '%';
}

const kontextNamen = new Map();
function quelleName(ctx) {
  if (kontextNamen.has(ctx.uri)) return kontextNamen.get(ctx.uri);
  kontextNamen.set(ctx.uri, '');
  if (ctx.uri.endsWith(':collection')) kontextNamen.set(ctx.uri, 'Lieblingssongs');
  else if (ctx.href) api(ctx.href, { query: { fields: 'name' } }).then((d) => { kontextNamen.set(ctx.uri, d.name); zeigeStatus(); }).catch(() => {});
  return '';
}

// Fortschrittsbalken flüssig mitlaufen lassen, ohne Spotify ständig zu fragen.
(function schleife() {
  const t = aktuellerTitel();
  if (t && !z.zieht) {
    const p = position(), d = t.duration_ms;
    const anteil = (p / d) * 100 + '%';
    $('.mini-fortschritt i').style.width = anteil;
    $('#zeit i').style.width = anteil;
    const [a, b] = document.querySelectorAll('#zeit .zeiten span');
    a.textContent = zeit(p);
    b.textContent = '-' + zeit(d - p);
    if (spielt() && p >= d - 200) baldAbfragen(600);
  }
  requestAnimationFrame(schleife);
})();

/* ================= Abspielen ================= */

async function abspielen(body) {
  try {
    await player.play(body);
  } catch (e) {
    if (e.status !== 404) return fehler(e);
    // Kein aktives Gerät: erstes verfügbares nehmen oder Auswahl zeigen.
    const geraete = await player.geraete().catch(() => []);
    if (geraete.length === 1) {
      try { await player.play(body, geraete[0].id); } catch (e2) { return fehler(e2); }
    } else return geraeteBlatt(geraete, body);
  }
  baldAbfragen();
}

function fehler(e) {
  if (e.status === 403) toast('Das erlaubt Spotify hier gerade nicht.');
  else if (e.status === 404) toast('Kein Gerät aktiv – öffne kurz Spotify.');
  else if (e.status === 429) toast('Zu viele Anfragen – kurz warten.');
  else toast('Fehler: ' + e.message);
}

const aktionen = {
  async playpause() {
    if (!z.status?.item) return abspielen();
    const war = spielt();
    z.status.progress_ms = position(); z.abgerufen = performance.now();
    z.status.is_playing = !war; zeigeStatus();
    try { await (war ? player.pause() : player.play()); } catch (e) { fehler(e); }
    baldAbfragen(600);
  },
  async weiter() { try { await player.weiter(); } catch (e) { fehler(e); } baldAbfragen(); },
  async zurueck() {
    try { position() > 3000 ? await player.springen(0) : await player.zurueck(); } catch (e) { fehler(e); }
    baldAbfragen();
  },
  async zufall() { try { await player.zufall(!z.status?.shuffle_state); } catch (e) { fehler(e); } baldAbfragen(); },
  async wiederholen() {
    const naechster = { off: 'context', context: 'track', track: 'off' }[z.status?.repeat_state || 'off'];
    try { await player.wiederholen(naechster); } catch (e) { fehler(e); }
    baldAbfragen();
  },
  async like() {
    const t = aktuellerTitel(); if (!t || t.type !== 'track') return;
    const neu = !z.liked.get(t.id);
    z.liked.set(t.id, neu); zeigeStatus();
    try { await api('/me/library', { method: neu ? 'PUT' : 'DELETE', query: { uris: t.uri } }); }
    catch (e) { z.liked.set(t.id, !neu); zeigeStatus(); fehler(e); }
  },
  oeffnen() { spielerAuf(); },
  schliessen() { spielerZu(); },
  async geraete() { geraeteBlatt(await player.geraete().catch(() => [])); },
  warteschlange() { warteschlangeBlatt(); },
  'blatt-zu'() { blattZu(); },
};

document.addEventListener('click', (ev) => {
  const el = ev.target.closest('[data-aktion]');
  if (!el) return;
  ev.preventDefault(); ev.stopPropagation();
  aktionen[el.dataset.aktion]?.(el);
});
$('#mini').addEventListener('click', (ev) => { if (!ev.target.closest('button')) spielerAuf(); });

/* ================= Großer Player: auf/zu + Wischen ================= */

function spielerAuf() {
  const p = $('#player');
  p.hidden = false;
  requestAnimationFrame(() => requestAnimationFrame(() => p.classList.add('offen')));
}
function spielerZu() {
  const p = $('#player');
  p.style.transform = '';
  p.classList.remove('offen');
  setTimeout(() => { if (!p.classList.contains('offen')) p.hidden = true; }, 560);
}
(() => {
  const p = $('#player');
  let start = null, dy = 0;
  p.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.regler, button')) return;
    start = e.clientY; dy = 0; p.style.transition = 'none';
  });
  p.addEventListener('pointermove', (e) => {
    if (start == null) return;
    dy = Math.max(0, e.clientY - start);
    p.style.transform = `translateY(${dy}px)`;
  });
  const ende = () => {
    if (start == null) return;
    start = null; p.style.transition = '';
    if (dy > 120) spielerZu(); else p.style.transform = '';
  };
  p.addEventListener('pointerup', ende);
  p.addEventListener('pointercancel', ende);
})();

// Regler zum Ziehen (Zeit und Lautstärke)
function regler(el, { wert, fertig }) {
  const spur = $('.regler-spur', el);
  const anteil = (e) => Math.min(1, Math.max(0, (e.clientX - spur.getBoundingClientRect().left) / spur.offsetWidth));
  el.addEventListener('pointerdown', (e) => {
    z.zieht = true; el.classList.add('zieht'); el.setPointerCapture(e.pointerId);
    wert(anteil(e));
    const bewegen = (e2) => wert(anteil(e2));
    const los = (e2) => {
      el.removeEventListener('pointermove', bewegen);
      el.classList.remove('zieht');
      fertig(anteil(e2)).finally(() => (z.zieht = false));
    };
    el.addEventListener('pointermove', bewegen);
    el.addEventListener('pointerup', los, { once: true });
  });
}
regler($('#zeit'), {
  wert: (a) => {
    const d = aktuellerTitel()?.duration_ms || 0;
    $('#zeit i').style.width = a * 100 + '%';
    const [x, y] = document.querySelectorAll('#zeit .zeiten span');
    x.textContent = zeit(a * d); y.textContent = '-' + zeit(d - a * d);
  },
  fertig: async (a) => {
    const d = aktuellerTitel()?.duration_ms || 0;
    if (z.status) { z.status.progress_ms = a * d; z.abgerufen = performance.now(); }
    try { await player.springen(a * d); } catch (e) { fehler(e); }
    baldAbfragen(500);
  },
});
regler($('#laut'), {
  wert: (a) => { $('#laut i').style.width = a * 100 + '%'; },
  fertig: async (a) => { try { await player.lautstaerke(a * 100); } catch (e) { fehler(e); } baldAbfragen(500); },
});

/* ================= Blätter ================= */

function blatt(html) {
  const b = $('#blatt');
  $('.blatt-inhalt', b).innerHTML = html;
  b.hidden = false;
  return $('.blatt-inhalt', b);
}
function blattZu() { $('#blatt').hidden = true; }

function geraeteBlatt(geraete, nachherAbspielen) {
  const icon = (t) => (t === 'Smartphone' ? ICON.handy : t === 'Computer' ? ICON.pc : ICON.lautsprecher);
  const el = blatt(`<h2>Wo abspielen?</h2>${geraete.length ? geraete.map((g) => `
    <button class="blatt-zeile ${g.is_active ? 'aktiv' : ''}" data-id="${esc(g.id)}">${icon(g.type)}<div>${esc(g.name)}<small>${g.is_active ? 'Spielt gerade' : esc(g.type)}</small></div></button>`).join('')
    : `<p class="leer">Kein Gerät gefunden.<br>Öffne einmal die Spotify-App, dann taucht sie hier auf.</p>`}
    <a class="blatt-zeile" href="spotify:">${ICON.welle}<div>Spotify-App öffnen<small>Danach hierher zurückkommen</small></div></a>`);
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-id]'); if (!b) return;
    blattZu();
    try {
      if (nachherAbspielen !== undefined) await player.play(nachherAbspielen, b.dataset.id);
      else await player.uebertragen(b.dataset.id);
    } catch (err) { fehler(err); }
    baldAbfragen(600);
  });
}

async function warteschlangeBlatt() {
  const el = blatt('<h2>Als Nächstes</h2><div class="lade"></div>');
  try {
    const q = await player.warteschlange();
    const liste = (q.queue || []).slice(0, 30);
    el.innerHTML = `<h2>Als Nächstes</h2><div class="liste">${liste.map((t) => titelZeile(t, { ohneMenue: true })).join('') || '<p class="leer">Warteschlange ist leer.</p>'}</div>`;
    el.addEventListener('click', (e) => {
      const z2 = e.target.closest('.zeile'); if (!z2) return;
      blattZu(); abspielen({ uris: [z2.dataset.uri] });
    });
  } catch (e) { blattZu(); fehler(e); }
}

function titelMenue(t) {
  const el = blatt(`
    <div class="zeile" style="margin-bottom:8px"><img src="${bild(t.album?.images, 120)}" alt=""><div><b>${esc(t.name)}</b><small>${esc(namen(t.artists))}</small></div></div>
    <button class="blatt-zeile" data-m="anstellen">${ICON.welle}<div>Als Nächstes spielen</div></button>
    ${t.album?.id ? `<button class="blatt-zeile" data-m="album">${ICON.play}<div>Zum Album<small>${esc(t.album.name)}</small></div></button>` : ''}
    ${t.artists?.[0]?.id ? `<button class="blatt-zeile" data-m="kuenstler">${ICON.lupe}<div>Zum Künstler<small>${esc(t.artists[0].name)}</small></div></button>` : ''}`);
  el.addEventListener('click', async (e) => {
    const m = e.target.closest('[data-m]')?.dataset.m; if (!m) return;
    blattZu();
    if (m === 'anstellen') { try { await player.anstellen(t.uri); toast('Kommt als Nächstes'); } catch (err) { fehler(err); } }
    if (m === 'album') location.hash = '#/album/' + t.album.id;
    if (m === 'kuenstler') location.hash = '#/kuenstler/' + t.artists[0].id;
  });
}

/* ================= Bausteine für Seiten ================= */

const titelSpeicher = new Map(); // uri -> Track (für Menü)

function titelZeile(t, { nr, kontext, ohneMenue, ohneBild } = {}) {
  if (!t) return '';
  titelSpeicher.set(t.uri, t);
  return `<div class="zeile" data-uri="${esc(t.uri)}" ${kontext ? `data-kontext="${esc(kontext)}"` : ''}>
    ${ohneBild ? `<span class="nr">${nr}</span>` : `<img loading="lazy" src="${bild(t.album?.images, 120)}" alt="">`}
    <div><b>${esc(t.name)}</b><small>${t.explicit ? '🅴 ' : ''}${esc(namen(t.artists))}</small></div>
    ${ohneMenue ? '' : `<button class="mehr" data-menue="${esc(t.uri)}" aria-label="Mehr">${ICON.mehr}</button>`}
  </div>`;
}

function karte(x, unter = '') {
  const typ = x.type === 'artist' ? 'kuenstler' : x.type;
  return `<a class="karte ${x.type === 'artist' ? 'rund' : ''}" href="#/${typ}/${x.id}">
    <img loading="lazy" src="${bild(x.images, 300)}" alt=""><b>${esc(x.name)}</b><small>${esc(unter)}</small></a>`;
}

function markiereLaufend() {
  const uri = aktuellerTitel()?.uri;
  for (const el of document.querySelectorAll('.zeile[data-uri]')) el.classList.toggle('laeuft', el.dataset.uri === uri);
}

// Klicks auf Titel in Listen
ansicht.addEventListener('click', (e) => {
  const m = e.target.closest('[data-menue]');
  if (m) { e.preventDefault(); return titelMenue(titelSpeicher.get(m.dataset.menue)); }
  const z2 = e.target.closest('.zeile[data-uri]');
  if (!z2) return;
  const ctx = z2.dataset.kontext;
  abspielen(ctx ? { context_uri: ctx, offset: { uri: z2.dataset.uri } } : { uris: [z2.dataset.uri] });
});

function seite(html) {
  return weich(() => {
    ansicht.innerHTML = `<div class="seite">${html}</div>`;
    ansicht.scrollTop = 0;
    markiereLaufend();
  });
}
const laden = () => { ansicht.innerHTML = '<div class="lade"></div>'; };
const zurueckKnopf = '<button class="zurueck-knopf glas" onclick="history.back()" aria-label="Zurück">' + ICON.zurueck + '</button>';

/* ================= Seiten ================= */

const seiten = {
  async start() {
    laden();
    const [ich, zuletzt, playlists, top] = await Promise.all([
      z.ich || api('/me'),
      api('/me/player/recently-played', { query: { limit: 30 } }).catch(() => null),
      api('/me/playlists', { query: { limit: 20 } }).catch(() => null),
      api('/me/top/artists', { query: { limit: 12, time_range: 'short_term' } }).catch(() => null),
    ]);
    z.ich = ich;
    const stunde = new Date().getHours();
    const gruss = stunde < 5 ? 'Gute Nacht' : stunde < 11 ? 'Guten Morgen' : stunde < 18 ? 'Hallo' : 'Guten Abend';
    // Zuletzt gehört: doppelte Titel raus
    const gesehen = new Set();
    const titel = (zuletzt?.items || []).map((i) => i.track).filter((t) => t && !gesehen.has(t.id) && gesehen.add(t.id)).slice(0, 8);
    const pl = playlists?.items?.filter(Boolean) || [];
    await seite(`
      <div class="kopfzeile"><h1>${gruss}${ich.display_name ? ', ' + esc(ich.display_name.split(' ')[0]) : ''}</h1>
        ${ich.images?.length ? `<img class="avatar" src="${bild(ich.images, 64)}" alt="">` : ''}</div>
      <div class="raster">
        <a class="kachel glas" href="#/lieblingssongs"><img src="icons/herz.svg" alt=""><span>Lieblingssongs</span></a>
        ${pl.slice(0, 5).map((p) => `<a class="kachel glas" href="#/playlist/${p.id}"><img loading="lazy" src="${bild(p.images, 120)}" alt=""><span>${esc(p.name)}</span></a>`).join('')}
      </div>
      ${titel.length ? `<h2>Zuletzt gehört</h2><div class="liste">${titel.map((t) => titelZeile(t)).join('')}</div>` : ''}
      ${top?.items?.length ? `<h2>Deine Künstler gerade</h2><div class="reihe">${top.items.map((a) => karte(a, 'Künstler')).join('')}</div>` : ''}
      ${pl.length > 5 ? `<h2>Deine Playlists</h2><div class="reihe">${pl.slice(5).map((p) => karte(p, p.owner?.display_name)).join('')}</div>` : ''}
    `);
  },

  async suche() {
    const letzte = sessionStorage.getItem('glas.suche') || '';
    const typ = sessionStorage.getItem('glas.suchtyp') || 'track';
    await seite(`<h1>Suche</h1>
      <label class="suchfeld glas">${ICON.lupe}<input id="q" type="search" placeholder="Songs, Künstler, Alben" value="${esc(letzte)}" autocomplete="off" enterkeyhint="search"></label>
      <div class="chips">${[['track', 'Songs'], ['artist', 'Künstler'], ['album', 'Alben'], ['playlist', 'Playlists']].map(([k, n]) => `<button class="chip glas ${k === typ ? 'an' : ''}" data-typ="${k}">${n}</button>`).join('')}</div>
      <div id="treffer"></div>`);
    const q = $('#q'), treffer = $('#treffer');
    let aktTyp = typ, timer;
    const suchen = async () => {
      const text = q.value.trim();
      sessionStorage.setItem('glas.suche', text);
      if (!text) { treffer.innerHTML = '<p class="leer">Was willst du hören?</p>'; return; }
      treffer.innerHTML = '<div class="lade"></div>';
      try {
        const r = await api('/search', { query: { q: text, type: aktTyp, limit: 10 } });
        if (text !== q.value.trim()) return;
        const items = (r[aktTyp + 's']?.items || []).filter(Boolean);
        if (!items.length) treffer.innerHTML = '<p class="leer">Nichts gefunden.</p>';
        else if (aktTyp === 'track') treffer.innerHTML = `<div class="liste">${items.map((t) => titelZeile(t)).join('')}</div>`;
        else treffer.innerHTML = `<div class="raster">${items.map((x) => karte(x, x.type === 'album' ? namen(x.artists) : x.owner?.display_name || '')).join('')}</div>`;
        markiereLaufend();
      } catch (e) { treffer.innerHTML = `<p class="leer">${esc(e.message)}</p>`; }
    };
    q.addEventListener('input', () => { clearTimeout(timer); timer = setTimeout(suchen, 280); });
    $('.chips').addEventListener('click', (e) => {
      const c = e.target.closest('[data-typ]'); if (!c) return;
      aktTyp = c.dataset.typ; sessionStorage.setItem('glas.suchtyp', aktTyp);
      for (const x of document.querySelectorAll('.chip')) x.classList.toggle('an', x === c);
      suchen();
    });
    suchen();
    if (!letzte) q.focus();
  },

  async bibliothek() {
    laden();
    const r = await api('/me/playlists', { query: { limit: 50 } });
    const pl = (r.items || []).filter(Boolean);
    await seite(`<h1>Bibliothek</h1>
      <div class="liste">
        <a class="zeile" href="#/lieblingssongs"><img src="icons/herz.svg" alt=""><div><b>Lieblingssongs</b><small>Playlist</small></div></a>
        ${pl.map((p) => `<a class="zeile" href="#/playlist/${p.id}"><img loading="lazy" src="${bild(p.images, 120)}" alt=""><div><b>${esc(p.name)}</b><small>Playlist · ${esc(p.owner?.display_name || '')}</small></div></a>`).join('')}
      </div>`);
  },

  async lieblingssongs() {
    laden();
    const [r, ich] = await Promise.all([api('/me/tracks', { query: { limit: 50 } }), z.ich || api('/me')]);
    z.ich = ich;
    const ctx = `spotify:user:${ich.id}:collection`;
    await seite(`${zurueckKnopf}
      <div class="detail-kopf"><img src="icons/herz.svg" alt=""><h1>Lieblingssongs</h1><p>${r.total} Songs</p>
        <div class="detail-knoepfe"><button class="pille glas" id="alle">${ICON.play} Abspielen</button></div></div>
      <div class="liste">${r.items.map((i) => titelZeile(i.track, { kontext: ctx })).join('')}</div>`);
    $('#alle').onclick = () => abspielen({ context_uri: ctx });
  },

  async playlist(id) {
    laden();
    const [p, t] = await Promise.all([api(`/playlists/${id}`), playlistTitel(id)]);
    const titel = (t.items || []).map((i) => i.item || i.track).filter((x) => x?.type === 'track');
    await seite(`${zurueckKnopf}
      <div class="detail-kopf"><img src="${bild(p.images, 640)}" alt=""><h1>${esc(p.name)}</h1><p>${esc(p.owner?.display_name || '')} · ${t.total ?? titel.length} Songs</p>
        <div class="detail-knoepfe"><button class="pille glas" id="alle">${ICON.play} Abspielen</button><button class="pille glas" id="misch">${ICON.shuffle} Mischen</button></div></div>
      <div class="liste">${titel.map((x) => titelZeile(x, { kontext: p.uri })).join('')}</div>`);
    $('#alle').onclick = () => abspielen({ context_uri: p.uri });
    $('#misch').onclick = async () => { await player.zufall(true).catch(() => {}); abspielen({ context_uri: p.uri }); };
    ambient(bild(p.images, 640));
  },

  async album(id) {
    laden();
    const a = await api(`/albums/${id}`);
    await seite(`${zurueckKnopf}
      <div class="detail-kopf"><img src="${bild(a.images, 640)}" alt=""><h1>${esc(a.name)}</h1><p>${esc(namen(a.artists))} · ${(a.release_date || '').slice(0, 4)}</p>
        <div class="detail-knoepfe"><button class="pille glas" id="alle">${ICON.play} Abspielen</button></div></div>
      <div class="liste">${a.tracks.items.map((t, i) => titelZeile({ ...t, album: a }, { kontext: a.uri, nr: i + 1, ohneBild: true })).join('')}</div>`);
    $('#alle').onclick = () => abspielen({ context_uri: a.uri });
    ambient(bild(a.images, 640));
  },

  async kuenstler(id) {
    laden();
    const [k, alben] = await Promise.all([
      api(`/artists/${id}`),
      api(`/artists/${id}/albums`, { query: { include_groups: 'album,single', limit: 10 } }).catch(() => null),
    ]);
    // "Top-Titel" ist für eigene Apps seit 2026 gesperrt, die Suche liefert die beliebtesten Songs ähnlich.
    const suche = await api('/search', { query: { q: `artist:"${k.name}"`, type: 'track', limit: 10 } }).catch(() => null);
    const top = { tracks: (suche?.tracks?.items || []).filter((t) => t?.artists?.some((a) => a.id === id)) };
    await seite(`${zurueckKnopf}
      <div class="detail-kopf rund"><img src="${bild(k.images, 640)}" alt=""><h1>${esc(k.name)}</h1><p>Künstler</p>
        <div class="detail-knoepfe"><button class="pille glas" id="alle">${ICON.play} Abspielen</button></div></div>
      ${top?.tracks?.length ? `<h2>Beliebt</h2><div class="liste">${top.tracks.slice(0, 10).map((t) => titelZeile(t)).join('')}</div>` : ''}
      ${alben?.items?.length ? `<h2>Musik</h2><div class="reihe">${alben.items.map((a) => karte(a, (a.release_date || '').slice(0, 4) + ' · ' + (a.album_type === 'single' ? 'Single' : 'Album'))).join('')}</div>` : ''}`);
    $('#alle').onclick = () => abspielen({ context_uri: k.uri });
    ambient(bild(k.images, 640));
  },
};

async function route() {
  const [, name = '', id] = location.hash.split('/');
  const n = name || 'start';
  const tab = n === 'start' || n === 'suche' ? n : 'bibliothek';
  for (const a of document.querySelectorAll('#tabs a')) a.classList.toggle('an', a.dataset.tab === tab);
  try {
    await (seiten[n] || seiten.start)(id);
  } catch (e) {
    await seite(`<div class="leer">Konnte nicht geladen werden.<br><small>${esc(e.message)}</small><br><br><button class="pille glas" onclick="dispatchEvent(new HashChangeEvent('hashchange'))">Nochmal</button></div>`);
  }
}

/* ================= Anmeldung ================= */

function anmeldeSeite(fehlertext) {
  document.body.classList.add('abgemeldet');
  $('#tabs').hidden = true;
  const ohneId = !clientId();
  ansicht.innerHTML = `<div class="seite anmeldung">
    <div class="logo glas"><svg viewBox="0 0 24 24"><path d="M3 10h2v4H3zm4-3h2v10H7zm4-4h2v18h-2zm4 4h2v10h-2zm4 3h2v4h-2z"/></svg></div>
    <h1>Glas</h1>
    <p>Dein Spotify, in Glas. Die Musik läuft über deinen Premium-Account, du steuerst sie hier.</p>
    ${fehlertext ? `<p style="color:#ff8a8a">${esc(fehlertext)}</p>` : ''}
    ${ohneId ? `<p>Einmalig: Füge die <b>Client-ID</b> deiner Spotify-App ein.</p>
      <input id="cid" placeholder="Client-ID" autocomplete="off" spellcheck="false">
      <p style="font-size:12px">Weiterleitungs-Adresse für das Spotify-Dashboard:</p><code>${esc(redirectUri())}</code>` : ''}
    <button class="pille glas" id="los">Mit Spotify anmelden</button>
  </div>`;
  $('#los').onclick = () => {
    if (ohneId) {
      const v = $('#cid').value.trim();
      if (!/^[0-9a-f]{32}$/i.test(v)) return toast('Die Client-ID hat 32 Zeichen.');
      setClientId(v);
    }
    anmelden();
  };
}

async function start() {
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
  let drin = false;
  try { drin = await rueckkehrVerarbeiten(); } catch (e) { return anmeldeSeite(e.message); }
  if (!drin) return anmeldeSeite();
  addEventListener('hashchange', route);
  route();
  abfragen();
}

window.glasAbmelden = () => { abmelden(); location.reload(); };
start();
