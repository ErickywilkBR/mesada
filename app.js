/* Mesada — front (vanilla JS, sem build). Rotas: #/cesar  #/arthur  #/ericky */
(() => {
  'use strict';

  const API = window.MESADA_API;
  const ADMIN = 'ericky';
  const USERS = {
    cesar:  { nome: 'Cesar',  cor: '#3b82f6' },
    arthur: { nome: 'Arthur', cor: '#22c55e' },
    ericky: { nome: 'Ericky', cor: '#f5f5f5' },
  };
  const KIDS = ['cesar', 'arthur'];
  const MAX_REC_SEC = 180;
  const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

  const MEDALS = [
    { e: '🌱', t: '1º',   ok: s => s.aprovados >= 1 },
    { e: '🔟', t: '10',   ok: s => s.aprovados >= 10 },
    { e: '💎', t: '50',   ok: s => s.aprovados >= 50 },
    { e: '⭐', t: '10',   ok: s => s.nota10 >= 1 },
    { e: '🌟', t: '5×',   ok: s => s.nota10 >= 5 },
    { e: '🔥', t: '7d',   ok: s => s.streak >= 7 },
    { e: '💰', t: 'R$50', ok: s => s.total >= 5000 },
    { e: '🎁', t: '1º',   ok: s => s.resgatesEntregues >= 1 },
  ];

  // ofensiva: dias seguidos com relato. Elos inspirados no Free Fire (nomes), emblemas e bichinho são próprios.
  const ELOS = [
    { min: 0,  n: 'Sem elo',         e: '·',  c: '#5b6270' },
    { min: 1,  n: 'Bronze',          e: '🛡️', c: '#cd7f32' },
    { min: 3,  n: 'Prata',           e: '🛡️', c: '#c0c7d1' },
    { min: 5,  n: 'Ouro',            e: '🛡️', c: '#f5c542' },
    { min: 7,  n: 'Platina',         e: '🔰', c: '#5ee0d0' },
    { min: 14, n: 'Diamante',        e: '💎', c: '#5aa9ff' },
    { min: 21, n: 'Heroico',         e: '⚔️', c: '#b06bff' },
    { min: 30, n: 'Mestre',          e: '👑', c: '#ff5a5a' },
    { min: 45, n: 'Mestre de Honra', e: '🏵️', c: '#ff9b2f' },
    { min: 60, n: 'Grão-Mestre',     e: '🔱', c: '#ffd700' },
  ];
  // o bichinho cresce com a ofensiva e dorme quando ela está em risco
  const PETS = [
    { min: 0,  e: '🥚', n: 'Ovo' },
    { min: 3,  e: '🐣', n: 'Filhote' },
    { min: 7,  e: '🦊', n: 'Raposinha' },
    { min: 14, e: '🐺', n: 'Lobo' },
    { min: 30, e: '🐲', n: 'Dragãozinho' },
    { min: 60, e: '🐉', n: 'Dragão' },
  ];
  const nivel = (lista, d) => lista.filter(x => d >= x.min).pop();
  const elo = d => nivel(ELOS, d || 0);
  const proxElo = d => ELOS.find(x => x.min > (d || 0));
  const emblema = (d, cls = '') => {
    const x = elo(d);
    return `<span class="emb ${cls}" style="--c:${x.c}" title="${x.n}"><span>${x.e}</span></span>`;
  };

  // ícones (Lucide, ISC) + logo oficial do Pix (Simple Icons, CC0)
  const svg = (d, fill) => `<svg viewBox="0 0 24 24" ${fill ? 'fill="currentColor"' : 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'} aria-hidden="true">${d}</svg>`;
  const ICON = {
    home: svg('<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>'),
    loja: svg('<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/><path d="M3 6h18"/><path d="M16 10a4 4 0 0 1-8 0"/>'),
    mochila: svg('<path d="M4 10a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z"/><path d="M8 10h8"/><path d="M8 18h8"/><path d="M8 22v-6a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v6"/><path d="M9 6V4a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2"/>'),
    chat: svg('<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>'),
    rank: svg('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
    pix: svg('<path d="M5.283 18.36a3.505 3.505 0 0 0 2.493-1.032l3.6-3.6a.684.684 0 0 1 .946 0l3.613 3.613a3.504 3.504 0 0 0 2.493 1.032h.71l-4.56 4.56a3.647 3.647 0 0 1-5.156 0L4.85 18.36ZM18.428 5.627a3.505 3.505 0 0 0-2.493 1.032l-3.613 3.614a.67.67 0 0 1-.946 0l-3.6-3.6A3.505 3.505 0 0 0 5.283 5.64h-.434l4.573-4.572a3.646 3.646 0 0 1 5.156 0l4.559 4.559ZM1.068 9.422 3.79 6.699h1.492a2.483 2.483 0 0 1 1.744.722l3.6 3.6a1.73 1.73 0 0 0 2.443 0l3.614-3.613a2.482 2.482 0 0 1 1.744-.723h1.767l2.737 2.737a3.646 3.646 0 0 1 0 5.156l-2.736 2.736h-1.768a2.482 2.482 0 0 1-1.744-.722l-3.613-3.613a1.77 1.77 0 0 0-2.444 0l-3.6 3.6a2.483 2.483 0 0 1-1.744.722H3.791l-2.723-2.723a3.646 3.646 0 0 1 0-5.156"/>', true),
    x: svg('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
    inbox: svg('<polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/>'),
    hist: svg('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>'),
    refresh: svg('<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>'),
    trash: svg('<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>'),
    chevron: svg('<path d="m9 18 6-6-6-6"/>'),
    missoes: svg('<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>'),
    carteira: svg('<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>'),
    resumo: svg('<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>'),
    plus: svg('<path d="M5 12h14"/><path d="M12 5v14"/>'),
  };
  ICON.resgates = ICON.mochila;
  ICON.fila = ICON.inbox;
  const PIX = `<span class="pix-logo">${ICON.pix}</span>`;
  const CLOSE = `<button class="close" data-a="close" aria-label="Fechar">${ICON.x}</button>`;

  const S = { me: null, data: null, tab: 'home', rank: 'saldo', adminTab: 'fila', loading: false, chat: { msgs: [], vistos: {} }, draft: '' };
  const media = new Map();      // id -> dataURL
  const pending = new Map();    // id -> Promise
  const review = {};            // relatoId -> { nota, valor }
  const $app = document.getElementById('app');

  // ------------------------------------------------------------ utils
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const user = id => (S.data?.usuarios || []).find(u => u.id === id) || { id, ...USERS[id] };
  const fmtSec = s => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  const quando = iso => {
    const d = new Date(iso), now = new Date();
    const dias = Math.floor((new Date(now.toDateString()) - new Date(d.toDateString())) / 864e5);
    const hh = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (dias === 0) return `hoje ${hh}`;
    if (dias === 1) return `ontem ${hh}`;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + hh;
  };
  const parseMoney = v => {
    const n = Number(String(v).replace(/[^\d,.]/g, '').replace(',', '.'));
    return Number.isFinite(n) ? Math.round(n * 100) : NaN;
  };
  const splitDataUrl = url => {
    const [head, data] = url.split(',');
    return { mime: head.slice(5).split(';')[0], data };
  };
  const blobToB64 = blob => new Promise((ok, err) => {
    const r = new FileReader();
    r.onload = () => ok(r.result.split(',')[1]);
    r.onerror = err;
    r.readAsDataURL(blob);
  });

  async function api(action, params = {}) {
    if (!API || API.startsWith('COLE')) throw new Error('Configure a URL da API no config.js');
    let r;
    try {
      r = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ action, usuario: S.me, ...params }),
      });
    } catch { throw new Error('Sem internet. Tente de novo'); }
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    return j.data;
  }

  let toastT;
  function toast(msg, err) {
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.className = 'show' + (err ? ' err' : '');
    clearTimeout(toastT);
    toastT = setTimeout(() => (t.className = err ? 'err' : ''), 2600);
  }

  // sucesso: sinal grande no meio da tela, entendido sem ler
  function done(label) {
    const d = document.createElement('div');
    d.className = 'done';
    d.innerHTML = `<div class="done-ico">✓</div>${label ? `<b>${esc(label)}</b>` : ''}`;
    document.body.appendChild(d);
    navigator.vibrate?.([30, 40, 30]);
    setTimeout(() => d.remove(), 1400);
  }
  const novaChave = () => (crypto.randomUUID?.() || Math.random().toString(36).slice(2) + Date.now().toString(36))
    .replace(/-/g, '').slice(0, 24);

  function confetti(emojis = ['💰', '⭐', '🎉', '✨', '🪙']) {
    const c = document.createElement('div');
    c.className = 'confetti';
    for (let i = 0; i < 16; i++) {
      const e = document.createElement('i');
      e.textContent = emojis[i % emojis.length];
      e.style.left = Math.random() * 100 + 'vw';
      e.style.animationDelay = Math.random() * .5 + 's';
      c.appendChild(e);
    }
    const f = document.createElement('div');
    f.className = 'flash';
    document.body.append(f, c);
    setTimeout(() => { c.remove(); f.remove(); }, 2300);
    navigator.vibrate?.(60);
  }

  // ------------------------------------------------------------ mídia
  async function getMedia(ids) {
    const want = [...new Set(ids.filter(id => id && !media.has(id) && !pending.has(id)))];
    for (let i = 0; i < want.length; i += 8) {
      const batch = want.slice(i, i + 8);
      const p = api('midia', { ids: batch }).then(res => {
        Object.entries(res).forEach(([id, m]) => media.set(id, `data:${m.mime};base64,${m.data}`));
      }).finally(() => batch.forEach(id => pending.delete(id)));
      batch.forEach(id => pending.set(id, p));
    }
    await Promise.all(ids.map(id => pending.get(id)).filter(Boolean));
  }

  function applyMedia(root = document) {
    root.querySelectorAll('[data-media]').forEach(el => {
      const url = media.get(el.dataset.media);
      if (!url) return;
      el.style.backgroundImage = `url("${url}")`;
      el.classList.add('has-img'); // some o emoji de reserva que fica por cima da foto
      el.removeAttribute('data-media');
      // remove o placeholder (texto/emoji), mantendo o ícone de câmera do avatar
      [...el.childNodes].forEach(n => { if (n.nodeType === 3) n.remove(); });
    });
  }

  async function hydrate(root = document) {
    applyMedia(root);
    const ids = [...root.querySelectorAll('[data-media]')].map(el => el.dataset.media);
    if (!ids.length) return;
    try { await getMedia(ids); } catch (e) { console.warn(e); }
    applyMedia(document);
  }

  // player único de áudio
  const player = new Audio();
  let playingBtn = null;
  const resetBtn = () => { if (playingBtn) { playingBtn.classList.remove('playing'); playingBtn.textContent = '▶'; playingBtn = null; } };
  player.onended = resetBtn;
  player.onpause = resetBtn;

  async function playMedia(id, btn) {
    if (playingBtn === btn && !player.paused) { player.pause(); return; }
    player.pause();
    if (!media.has(id)) {
      // desbloqueia o áudio no iOS dentro do gesto, antes do await
      player.src = SILENT; player.play().catch(() => {});
      btn.innerHTML = '<div class="spin sm"></div>';
      try { await getMedia([id]); } catch (e) { btn.textContent = '▶'; return toast('⚠️ ' + e.message, true); }
    }
    playSrc(media.get(id), btn);
  }

  function playSrc(src, btn) {
    if (playingBtn === btn && !player.paused) { player.pause(); return; }
    player.pause();
    player.src = src;
    player.play().then(() => {
      playingBtn = btn;
      btn.classList.add('playing');
      btn.textContent = '⏸';
    }).catch(() => { btn.textContent = '▶'; toast('⚠️ Não consegui tocar o áudio', true); });
  }

  // ------------------------------------------------------------ captura
  async function compressImage(file, max = 1000, q = 0.72) {
    const url = URL.createObjectURL(file);
    try {
      const img = await new Promise((ok, err) => { const i = new Image(); i.onload = () => ok(i); i.onerror = err; i.src = url; });
      const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s);
      c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      return c.toDataURL('image/jpeg', q);
    } finally { URL.revokeObjectURL(url); }
  }

  /** Gravador reutilizável. onChange({mime,data,url}|null) */
  function mountRecorder(el, onChange) {
    let rec, stream, timer, sec = 0, audio = null;

    const view = state => {
      if (state === 'idle') {
        el.innerHTML = `<div class="rec"><button class="rec-btn" data-r="start" aria-label="Gravar">🎤</button></div>`;
      } else if (state === 'rec') {
        el.innerHTML = `<div class="rec">
          <button class="rec-btn on" data-r="stop" aria-label="Parar">⏹</button>
          <div class="wave">${'<i></i>'.repeat(9)}</div>
          <div class="rec-time mono">0:00</div></div>`;
      } else {
        el.innerHTML = `<div class="rec"><div class="row center" style="gap:22px">
          <button class="btn round" data-r="del" aria-label="Apagar">🗑️</button>
          <button class="play" data-r="play" style="width:96px;height:96px;font-size:38px" aria-label="Ouvir">▶</button>
          <span class="rec-time mono">${fmtSec(sec)}</span></div></div>`;
      }
    };

    const stop = () => { if (rec && rec.state !== 'inactive') rec.stop(); clearInterval(timer); };

    el.onclick = async e => {
      const b = e.target.closest('[data-r]');
      if (!b) return;
      const act = b.dataset.r;
      if (act === 'start') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch { return toast('🎤 Libere o microfone', true); }
        const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(m => window.MediaRecorder?.isTypeSupported?.(m)) || '';
        rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : {});
        const chunks = [];
        rec.ondataavailable = ev => ev.data.size && chunks.push(ev.data);
        rec.onstop = async () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(chunks, { type: (rec.mimeType || mime || 'audio/webm').split(';')[0] });
          const data = await blobToB64(blob);
          audio = { mime: blob.type, data, url: `data:${blob.type};base64,${data}` };
          view('done');
          onChange(audio);
        };
        rec.start(1000);
        sec = 0;
        view('rec');
        navigator.vibrate?.(30);
        timer = setInterval(() => {
          sec++;
          const t = el.querySelector('.rec-time');
          if (t) t.textContent = fmtSec(sec);
          if (sec >= MAX_REC_SEC) stop();
        }, 1000);
      } else if (act === 'stop') {
        stop();
      } else if (act === 'play') {
        playSrc(audio.url, b);
      } else if (act === 'del') {
        player.pause();
        audio = null;
        view('idle');
        onChange(null);
      }
    };
    view('idle');
    return { stop };
  }

  // ------------------------------------------------------------ sheet
  let sheetCleanup = null;
  function openSheet(html, onMount) {
    closeSheet();
    const root = document.getElementById('sheet-root');
    root.innerHTML = `<div class="sheet-back"><div class="sheet"><div class="grab"></div>${html}</div></div>`;
    const back = root.firstElementChild;
    back.addEventListener('click', e => { if (e.target === back) closeSheet(); });
    sheetCleanup = onMount?.(back.firstElementChild) || null;
    return back.firstElementChild;
  }
  function closeSheet() {
    player.pause();
    if (typeof sheetCleanup === 'function') sheetCleanup();
    sheetCleanup = null;
    document.getElementById('sheet-root').innerHTML = '';
  }

  /** Confirmação dentro do app (no lugar do confirm() do navegador). Resolve true/false. */
  function ask({ title, text = '', ok = 'Confirmar', cancel = 'Voltar', danger = false }) {
    return new Promise(resolve => {
      let answered = false;
      const finish = v => { if (answered) return; answered = true; resolve(v); };
      const sh = openSheet(`
        <h2>${title}${CLOSE}</h2>
        ${text ? `<p class="lead">${text}</p>` : ''}
        <div class="duo mt">
          <button class="btn big" data-a="close">${cancel}</button>
          <button class="btn big ${danger ? 'danger solid' : 'primary'}" data-a="ok">${ok}</button>
        </div>`, () => () => finish(false));
      sh.onclick = e => {
        const a = e.target.closest('[data-a]')?.dataset.a;
        if (a === 'ok') { finish(true); closeSheet(); }
        if (a === 'close') closeSheet();
      };
    });
  }

  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const z = document.querySelectorAll('.zoom');
    if (z.length) { z[z.length - 1].querySelector('video')?.pause(); z[z.length - 1].remove(); return; }
    if (document.getElementById('sheet-root').innerHTML) closeSheet();
  });

  function zoom(url) {
    const z = document.createElement('div');
    z.className = 'zoom';
    z.innerHTML = `<img src="${url}">`;
    z.onclick = () => z.remove();
    document.body.appendChild(z);
  }

  // ------------------------------------------------------------ rotas
  function route() {
    const id = location.hash.replace(/^#\/?/, '').split('/')[0].toLowerCase();
    if (id === 'tv') return location.replace('tv.html' + location.search);
    closeSheet();
    if (!USERS[id]) {
      S.me = null;
      document.body.className = '';
      $app.innerHTML = `<div class="splash"><div class="logo">🦊</div><h1>Mesada</h1><p class="muted">Abra pelo seu link.</p></div>`;
      return;
    }
    S.me = id;
    S.data = null;
    S.json = null;
    S.tab = 'home';
    S.chat = { msgs: [], vistos: {} };
    S.draft = '';
    S.draftChecked = false;
    const cor = USERS[id].cor;
    const n = parseInt(cor.slice(1), 16);
    const r = document.documentElement.style;
    r.setProperty('--accent', cor);
    r.setProperty('--accent-rgb', `${n >> 16}, ${(n >> 8) & 255}, ${n & 255}`);
    document.querySelector('meta[name=theme-color]').content = '#08090c';
    document.title = `${USERS[id].nome} · Mesada`;
    document.body.className = id === ADMIN ? 'admin' : 'kid';
    load();
  }

  async function load(silent, auto) {
    if (!silent) $app.innerHTML = skeleton();
    const me = S.me;
    S.fetching = true;
    try {
      const data = await api('bootstrap');
      if (me !== S.me) return;
      const json = JSON.stringify(data);
      if (silent && json === S.json) return; // nada mudou: não mexe na tela
      // atualização automática: se a pessoa começou a mexer enquanto buscava, descarta e tenta depois
      if (auto && busy()) return;
      const saldoAntes = S.data && me !== ADMIN ? user(me).stats?.saldo : null;
      const lidasAntes = S.data ? naoLidas() : 0;
      S.json = json;
      S.data = data;
      S.skew = data.agora ? new Date(data.agora) - Date.now() : 0; // relógio do servidor para o leilão
      mergeMsgs(data.chat || []);
      mergeVistos(data.vistos);
      if (auto && saldoAntes != null && (user(me).stats?.saldo || 0) > saldoAntes) confetti(['💰', '🪙', '⭐']);
      if (auto && naoLidas() > lidasAntes) navigator.vibrate?.([20, 60, 20]);
      // chat aberto tem atualização própria: só atualiza a lista e os contadores, sem redesenhar a tela
      if (silent && chatOpen()) { drawChat(); badges(); return; }
      const y = scrollY;
      render(!silent);
      if (silent) scrollTo(0, y);
    } catch (e) {
      if (auto) return; // falha de rede no automático fica silenciosa
      if (!silent) $app.innerHTML = `<div class="loader-err fade-in"><div class="empty"><span class="big">⚠️</span><p>${esc(e.message)}</p></div>
        <button class="btn primary" onclick="A.reload()">${ICON.refresh} Tentar de novo</button></div>`;
      else toast('⚠️ ' + e.message, true);
    } finally {
      S.fetching = false;
    }
  }

  /** Atualização automática só quando a pessoa não está no meio de nada. */
  function busy() {
    if (document.getElementById('sheet-root').innerHTML) return true;   // tirando foto, gravando, comprando, editando item
    if (document.querySelector('.zoom, .gift')) return true;                     // vendo foto/galeria
    const el = document.activeElement;
    if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return true;   // digitando
    if (!player.paused) return true;                                       // ouvindo áudio
    if (Object.values(review).some(r => r.nota || r.valor)) return true;   // Ericky avaliando um card
    if (Date.now() - S.lastTouch < 4000) return true;                      // acabou de tocar na tela
    if (S.recording) return true;                                          // gravando áudio no chat
    return false;
  }

  const POLL_MS = 20000;
  setInterval(() => {
    if (document.visibilityState !== 'visible' || !S.me || !S.data || S.fetching || busy()) return;
    load(true, true);
  }, POLL_MS);
  S.lastTouch = 0;
  ['pointerdown', 'keydown', 'scroll'].forEach(ev =>
    addEventListener(ev, () => { S.lastTouch = Date.now(); }, { passive: true, capture: true }));

  function skeleton() {
    const b = (h, extra = '') => `<div class="skel" style="height:${h}px;${extra}"></div>`;
    return `<div class="fade-in" style="display:grid;gap:14px;padding-top:6px">
      <div class="row">${b(62, 'width:62px;border-radius:50%')}<div class="grow" style="display:grid;gap:8px">${b(12, 'width:30%')}${b(26, 'width:55%')}</div></div>
      ${b(170, 'border-radius:26px')}${b(78)}${b(104)}${b(104)}</div>`;
  }

  function render(anim = false) {
    if (!S.data) return;
    $app.innerHTML = S.me === ADMIN ? renderAdmin() : renderKid();
    if (anim) {
      $app.querySelectorAll('.top, .balance-wrap, .cta, .section-title, .seg, .tabs-top, .list > *, .shop > *, .podium > *, .admin-grid > *, .medals > *, .hero-admin > *, .medal-who')
        .forEach((el, i) => { el.classList.add('rise'); el.style.setProperty('--i', Math.min(i, 14)); });
    }
    $app.querySelectorAll('.medals > *').forEach((el, i) => el.style.setProperty('--i', i));
    countUp();
    navIndicator();
    hydrate($app);
    if (chatOpen()) mountChat();
    if (S.me !== ADMIN) checarPresentes();
    else if (!S.mercChecked) { S.mercChecked = true; if (lerMerc().length && !document.getElementById('sheet-root').innerHTML) mercadinhoSheet(); }
    if (!S.draftChecked && S.me !== ADMIN) {
      S.draftChecked = true;
      const d = readDraft();
      if (d && d.fotos.length) compose(d.refazerId || undefined, d.missaoId || undefined, d.tarefaId || undefined);
    }
  }

  // saldo sobe animado do último valor mostrado até o novo
  function countUp() {
    $app.querySelectorAll('[data-count]').forEach(el => {
      const key = el.dataset.key || 'k';
      const to = Number(el.dataset.count);
      const from = S.shown?.[key] ?? 0;
      (S.shown ||= {})[key] = to;
      if (from === to || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = brl(to); return; }
      const t0 = performance.now(), dur = 1100;
      const step = t => {
        const p = Math.min(1, (t - t0) / dur);
        const e = 1 - Math.pow(1 - p, 4);
        el.textContent = brl(Math.round(from + (to - from) * e));
        if (p < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    });
  }

  function navIndicator() {
    const nav = $app.querySelector('.nav');
    if (!nav) return;
    const ind = nav.querySelector('.nav-ind');
    const x = t => (nav.querySelector(`[data-tab="${t}"]`)?.offsetLeft ?? 6) - 6;
    ind.style.transition = 'none';
    ind.style.transform = `translateX(${x(S.prevTab ?? S.tab)}px)`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      ind.style.transition = '';
      ind.style.transform = `translateX(${x(S.tab)}px)`;
    }));
    S.prevTab = S.tab;
  }

  // ------------------------------------------------------------ componentes
  function avatar(id, cls = '', cam = false) {
    const u = user(id);
    return `<div class="avatar ${cls}" style="--ring:${u.cor}" ${u.foto_id ? `data-media="${u.foto_id}"` : ''}>
      ${esc(u.nome[0])}${cam ? '<span class="cam">📷</span>' : ''}</div>`;
  }
  const sectionTitle = (ico, title, count) =>
    `<div class="section-title"><span class="ico">${ico}</span>${title ? `<h3>${title}</h3>` : ''}${count != null ? `<span class="count">${count}</span>` : ''}</div>`;
  const stars = n => n ? `<span class="stars">${'★'.repeat(n)}<span style="opacity:.25">${'★'.repeat(10 - n)}</span></span>` : '';

  function badge(r) {
    if (r.status === 'aprovado') return `<span class="badge aprovado">✓ Ganhou <span class="mono">${brl(r.valor)}</span></span>`;
    if (r.status === 'refazer') return `<span class="badge refazer"><span class="live"></span>Refazer</span>`;
    return `<span class="badge pendente"><span class="live"></span>Esperando</span>`;
  }

  // ------------------------------------------------------------ KID
  // crianças: Início (o que fazer) · Carteira (todo o dinheiro) · Loja (comprar + mochila) · Chat
  function renderKid() {
    const me = user(S.me);
    const st = me.stats || {};
    const refazer = S.data.relatos.filter(r => r.status === 'refazer').length;
    const body = { home: kidHome, carteira, loja: kidLoja }[S.tab]?.() || '';
    const tabBtn = (t, label, dot) => `<button data-tab="${t}" ${t === 'chat' ? 'data-badge="chat"' : ''} class="${S.tab === t ? 'on' : ''}" onclick="A.tab('${t}')" aria-label="${label}">
        ${ICON[t]}<small>${label}</small>${dot ? `<span class="dot">${dot}</span>` : ''}</button>`;
    const nav = `<nav class="nav">
        <span class="nav-ind"></span>
        ${tabBtn('home', 'Início', refazer + tarefasFaltando() + (S.data.missoes || []).filter(m => m.status === 'aberta').length)}
        ${tabBtn('carteira', 'Carteira')}
        <button class="nav-go" onclick="A.compose()" aria-label="Relatar"><span>📸</span><small>Relatar</small></button>
        ${tabBtn('loja', 'Loja')}
        ${tabBtn('chat', 'Chat', S.tab !== 'chat' && naoLidas())}
      </nav>`;
    if (S.tab === 'chat') return chatPage() + nav;

    return `
      <div class="top">
        <label style="cursor:pointer">${avatar(S.me, 'ring-anim', true)}
          <input type="file" accept="image/*" hidden onchange="A.setFoto(this)"></label>
        <div class="who"><div class="name"><em>${esc(me.nome)}</em></div>
          <div class="sub">${st.streak ? `<button class="elo-chip" style="--c:${elo(st.streak).c}" onclick="A.elos()">${elo(st.streak).e} ${elo(st.streak).n}</button>` : ''}${st.media ? `<span>⭐ <b class="mono">${st.media}</b></span>` : ''}</div></div>
        ${S.tab === 'carteira' ? '' : `<button class="saldo-pill" onclick="A.tab('carteira')" aria-label="Ver carteira">
          <small>Saldo</small><b class="mono" data-count="${st.saldo || 0}" data-key="saldo">${brl(st.saldo)}</b></button>`}
      </div>
      <div class="view">${body}</div>
      ${nav}`;
  }

  function ofensivaCard(st) {
    const d = st.streak || 0;
    const x = elo(d), prox = proxElo(d), pet = nivel(PETS, d);
    const risco = d > 0 && !st.hojeFeito;
    const pct = prox ? Math.round((d - x.min) / (prox.min - x.min) * 100) : 100;
    return `<div class="card ofensiva ${risco ? 'risco' : ''} ${st.hojeFeito ? 'feito' : ''}" style="--c:${x.c}" onclick="A.elos()">
      <div class="pet ${risco ? 'dorme' : ''}">${pet.e}${risco ? '<i>💤</i>' : ''}</div>
      <div class="of-info">
        <div class="of-top">${emblema(d, 'sm')}<b>${x.n}</b></div>
        <div class="of-dias"><span class="fogo">🔥</span><b class="mono">${d}</b> <span class="muted">${d === 1 ? 'dia' : 'dias'}</span></div>
        ${prox ? `<div class="progress"><i style="width:${pct}%;background:${prox.c}"></i></div>
          <div class="muted small">${prox.e} ${prox.n} em ${prox.min - d} ${prox.min - d === 1 ? 'dia' : 'dias'}</div>` : '<div class="small">🏆 Elo máximo!</div>'}
      </div>
      <div class="of-hoje">${st.hojeFeito ? '✅<small>hoje</small>' : d ? '⚠️<small>relate hoje</small>' : '📸<small>comece</small>'}</div>
    </div>`;
  }

  function kidHome() {
    // "refazer" primeiro; depois os mais novos. Mostra os 3 últimos, o resto sob "ver todos".
    const rel = [...S.data.relatos].sort((a, b) => (b.status === 'refazer') - (a.status === 'refazer'));
    const fazer = tarefasKid() + missoesKid();
    const topo = (fazer || `${sectionTitle('✨', 'Para fazer')}<div class="card vazio-fazer">Nada marcado para hoje. Fez algo legal? Toque em <b>Relatar</b>.</div>`)
      + ofensivaCard(user(S.me).stats || {});
    if (!rel.length) return `${topo}<div class="empty"><span class="big">📸</span><p>Nenhum relato ainda</p><div class="hint">Toque em Relatar para mandar o primeiro</div></div>`;
    const mostra = S.verTodos ? rel : rel.slice(0, Math.max(3, rel.filter(r => r.status === 'refazer').length));
    return `${topo}${sectionTitle('📜', 'Meus relatos', rel.length)}
      <div class="list">${mostra.map(relatoCard).join('')}</div>
      ${rel.length > mostra.length ? `<button class="btn ghost" style="width:100%;margin-top:6px" onclick="A.verTodos()">Ver todos os ${rel.length} relatos</button>` : ''}`;
  }

  const fotosDe = r => String(r.foto_id || '').split(',').filter(Boolean);
  function thumb(r) {
    const f = fotosDe(r);
    return `<div class="thumb" data-media="${f[0]}" onclick="A.gallery('${f.join(',')}')">📷${f.length > 1 ? `<span class="multi">${f.length}</span>` : ''}</div>`;
  }
  const STATUS_COR = { pendente: 'var(--wait)', aprovado: 'var(--ok)', refazer: 'var(--redo)' };
  function relatoCard(r) {
    return `<div class="card">
      <span class="status-bar" style="background:${STATUS_COR[r.status]};box-shadow:0 0 12px ${STATUS_COR[r.status]}"></span>
      <div class="relato">
        ${thumb(r)}
        <div class="info">
          ${badge(r)}
          ${r.missao_id ? `<span class="m-chip">${missao(r.missao_id)?.tipo === 'dupla' ? '👥' : '🎯'} ${esc(missao(r.missao_id)?.titulo || 'Missão')}</span>` : ''}
          ${r.tarefa_id ? `<span class="m-chip">📋 ${esc(tarefa(r.tarefa_id)?.titulo || 'Tarefa')}</span>` : ''}
          ${r.status === 'aprovado' ? stars(r.nota) : ''}
          <div class="date">${quando(r.criado_em)}</div>
        </div>
        ${r.audio_id ? `<button class="play small" onclick="A.play('${r.audio_id}', this)" aria-label="Ouvir">▶</button>` : ''}
        <button class="trash" onclick="A.apagarRelato('${r.id}')" aria-label="Apagar">${ICON.trash}</button>
      </div>
      ${r.status === 'refazer' ? `<div class="redo-box">
        ${r.resposta_audio_id ? `<button class="play small" style="background:var(--redo)" onclick="A.play('${r.resposta_audio_id}', this)">▶</button><span>🗣️</span>` : '<span style="font-size:22px">🔁</span>'}
        <button class="btn warn big-redo" onclick="A.compose('${r.id}')">📸 Refazer</button>
      </div>` : ''}
    </div>`;
  }

  // loja: prêmios com nome e itens do mercadinho (só foto + preço)
  const isMerc = it => it.categoria === 'mercadinho';
  function lojaCard(it, saldo) {
    const ok = saldo >= it.preco;
    const pct = Math.min(100, Math.round(saldo / it.preco * 100));
    const corpo = (it.nome ? `<div class="nm">${esc(it.nome)}</div><div class="pr">${brl(it.preco)}</div>` : '')
      + (ok ? '' : `<div class="progress"><i style="width:${pct}%"></i></div><div class="falta">faltam <span class="mono">${brl(it.preco - saldo)}</span></div>`);
    return `<button class="card item ${ok ? 'can' : 'locked'}" onclick="A.buy('${it.id}')">
      ${ok ? '' : '<span class="lock">🔒</span>'}
      <div class="pic" ${it.imagem_id ? `data-media="${it.imagem_id}"` : ''}><span>${esc(it.emoji || '🎁')}</span>${it.nome ? '' : `<b class="pr-tag mono">${brl(it.preco)}</b>`}</div>
      ${corpo ? `<div class="body">${corpo}</div>` : ''}
    </button>`;
  }

  function kidLoja() {
    const saldo = user(S.me).stats?.saldo || 0;
    const merc = S.data.loja.filter(isMerc), premios = S.data.loja.filter(it => !isMerc(it));
    const grade = (l, cls = '') => `<div class="shop ${cls}">${l.map(it => lojaCard(it, saldo)).join('')}</div>`;
    return `
      ${mochilaTopo()}
      ${leiloesKid()}
      ${merc.length ? sectionTitle('🏪', 'Mercadinho', merc.length) + grade(merc, 'tres') : ''}
      ${premios.length ? sectionTitle('🛍️', merc.length ? 'Prêmios' : 'Loja') + grade(premios) : ''}
      ${S.data.loja.length ? '' : `${sectionTitle('🛍️', 'Loja')}<div class="empty"><span class="big">🏪</span><p>A loja ainda está vazia</p></div>`}`;
  }

  // foto do item comprado: a guardada na compra ou, nos pedidos antigos, a do item da loja
  const resgImg = x => x.imagem_id || lojaItem(x).imagem_id || '';
  const resgThumb = x => `<div class="r-thumb" ${resgImg(x) ? `data-media="${resgImg(x)}" onclick="A.zoomMedia('${resgImg(x)}')"` : ''}>${esc(x.emoji || '🎁')}</div>`;

  function resgateRow(x, admin) {
    const icon = { pendente: '⏳ Na mochila', entregue: '🎁 Entregue', cancelado: '↩️ Cancelado' }[x.status];
    return `<div class="card table-row">
      ${admin ? avatar(x.usuario, 'sm') : ''}
      ${resgThumb(x)}
      <div class="grow"><div style="font-weight:700">${esc(x.nome || 'Mercadinho')}</div><div class="muted small">${quando(x.atualizado_em || x.criado_em)}</div></div>
      <div class="mono" style="font-weight:800">${brl(x.preco)}</div>
      <span class="badge ${x.status}">${icon}</span>
    </div>`;
  }

  function rankView() {
    const key = S.rank;
    const kids = KIDS.map(user).map(u => ({ ...u, v: u.stats?.[key] || 0 })).sort((a, b) => b.v - a.v);
    const max = Math.max(1, ...kids.map(k => k.v));
    const pos = ['🥇', '🥈', '🥉'];
    return `
      ${sectionTitle('🏆', 'Ranking')}
      <div class="seg">
        ${[['saldo', '💰', 'Saldo'], ['semana', '📅', 'Semana'], ['mes', '🗓️', 'Mês']].map(([k, e, t]) =>
          `<button class="${key === k ? 'on' : ''}" onclick="A.rank('${k}')">${e}<span>${t}</span></button>`).join('')}
      </div>
      <div class="podium">${kids.map((k, i) => `
        <div class="card rank-row ${kids[0].v === k.v && k.v > 0 ? 'first' : ''}">
          <div class="pos">${kids[0].v === k.v && i > 0 ? pos[0] : pos[i]}</div>
          ${avatar(k.id, 'md')}
          <div class="nm" style="color:${k.cor}">${esc(k.nome)} ${emblema(k.stats?.streak, 'xs')}</div>
          <div class="v">${brl(k.v)}</div>
          <div class="bar" style="width:${k.v / max * 100}%;background:${k.cor};box-shadow:0 0 12px ${k.cor}"></div>
        </div>`).join('')}</div>
      ${sectionTitle('📈', 'Ganhos por semana')}${graficoSemanas()}
      ${KIDS.map(id => {
        const u = user(id), st = u.stats || {};
        const n = MEDALS.filter(m => m.ok(st)).length;
        return `<div class="medal-who">${avatar(id, 'sm')}<span style="color:${u.cor}">${esc(u.nome)}</span>
            <span class="muted small mono" style="margin-left:auto">🏅 ${n}/${MEDALS.length}</span></div>
          <div class="medals">${MEDALS.map(m => `<div class="medal ${m.ok(st) ? '' : 'off'}">${m.e}<small>${m.t}</small></div>`).join('')}</div>`;
      }).join('')}`;
  }

  // compor relato (novo ou refazer) — tela única: fotos em cima, áudio no meio, enviar embaixo.
  // As fotos ficam salvas num rascunho: se o celular recarregar a página ao abrir a câmera, nada se perde.
  const draftKey = () => 'mesada-rascunho-' + S.me;
  const readDraft = () => { try { return JSON.parse(localStorage.getItem(draftKey())) || null; } catch { return null; } };
  const saveDraft = d => {
    try {
      if (d && d.fotos.length) localStorage.setItem(draftKey(), JSON.stringify(d));
      else localStorage.removeItem(draftKey());
    } catch { /* sem espaço: segue sem rascunho */ }
  };

  function compose(refazerId, missaoId, tarefaId) {
    const rasc = readDraft();
    const mesmo = rasc && (rasc.refazerId || '') === (refazerId || '') && (rasc.missaoId || '') === (missaoId || '')
      && (rasc.tarefaId || '') === (tarefaId || '');
    const st = { fotos: mesmo ? rasc.fotos : [], audio: null };
    let recorder, enviando = false;
    const persist = () => saveDraft({ fotos: st.fotos, refazerId: refazerId || '', missaoId: missaoId || '', tarefaId: tarefaId || '' });
    const ms = missaoId && missao(missaoId);
    const tf = tarefaId && tarefa(tarefaId);
    const sh = openSheet(`
      <h2>${refazerId ? '🔁 Refazer relato' : ms ? `${ms.tipo === 'dupla' ? '👥' : '🎯'} ${esc(ms.titulo || 'Missão')} · <span class="mono">${brl(ms.valor)}</span>`
        : tf ? `${esc(tf.emoji || '📋')} ${esc(tf.titulo)} · <span class="mono">${brl(tf.valor)}</span>` : '📸 Novo relato'}${CLOSE}</h2>
      <div class="cmp-fotos"></div>
      <div class="cmp-rec"><div class="cmp-lbl">🎤 Áudio (opcional)</div><div data-rec></div></div>
      <div class="send-bar"><button class="btn big ok grow send-go" data-a="send" disabled>✅ Enviar <span class="send-n"></span></button></div>`, s => {
        recorder = mountRecorder(s.querySelector('[data-rec]'), a => { st.audio = a; });
        return () => recorder.stop();
      });

    const draw = () => {
      const box = sh.querySelector('.cmp-fotos');
      if (!st.fotos.length) {
        // sem foto ainda: dois botões gigantes
        box.innerHTML = `<div class="pick">
          <label aria-label="Câmera">📷<small>Câmera</small><input type="file" accept="image/*" capture="environment"></label>
          <label aria-label="Galeria">🖼️<small>Galeria</small><input type="file" accept="image/*" multiple></label></div>`;
      } else {
        // com fotos: grade + quadradinhos para adicionar mais (opcional)
        box.innerHTML = `<div class="shots ${st.fotos.length === 1 ? 'one' : ''}">
          ${st.fotos.map((url, i) => `<div class="shot" style="background-image:url('${url}')"><button data-del="${i}" aria-label="Remover">${ICON.x}</button></div>`).join('')}
          </div>
          <div class="add-more">
            <label class="btn small-add" aria-label="Mais foto">➕ 📷<input type="file" accept="image/*" capture="environment" hidden></label>
            <label class="btn small-add" aria-label="Mais da galeria">➕ 🖼️<input type="file" accept="image/*" multiple hidden></label>
          </div>`;
      }
      box.querySelectorAll('input[type=file]').forEach(inp => {
        inp.onchange = () => { const fs = [...inp.files]; inp.value = ''; if (fs.length) addFiles(fs); };
      });
      const go = sh.querySelector('[data-a=send]');
      go.disabled = !st.fotos.length || enviando;
      sh.querySelector('.send-n').textContent = st.fotos.length > 1 ? `📷×${st.fotos.length}` : '';
    };

    const addFiles = async files => {
      const box = sh.querySelector('.cmp-fotos');
      box.insertAdjacentHTML('beforeend', '<div class="cmp-loading"><div class="spin"></div></div>');
      for (const f of files) {
        try { st.fotos.push(await compressImage(f)); } catch { toast('⚠️ Não consegui abrir essa foto', true); }
      }
      persist();
      draw();
      navigator.vibrate?.(15);
    };

    draw();
    if (st.fotos.length) toast('📸 Suas fotos voltaram');

    sh.onclick = async e => {
      const del = e.target.closest('[data-del]');
      if (del) { st.fotos.splice(Number(del.dataset.del), 1); persist(); draw(); return; }
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'close') return closeSheet(); // rascunho continua salvo
      if (b.dataset.a !== 'send' || enviando || !st.fotos.length) return;
      recorder.stop();
      enviando = true;
      b.disabled = true;
      b.innerHTML = '<div class="spin sm"></div>';
      try {
        await api('novoRelato', {
          fotos: st.fotos.map(splitDataUrl),
          foto: splitDataUrl(st.fotos[0]), // compatível com o Apps Script antigo (1 foto)
          audio: st.audio ? { mime: st.audio.mime, data: st.audio.data } : null,
          refazerId: refazerId || '',
          missaoId: missaoId || '',
          tarefaId: tarefaId || '',
        });
        saveDraft(null);
        closeSheet();
        confetti(['📸', '🎤', '✨', '🚀']);
        done('Enviado!');
        load(true);
      } catch (err) {
        enviando = false;
        b.disabled = false;
        b.innerHTML = '✅ Enviar <span class="send-n"></span>';
        draw();
        toast('⚠️ ' + err.message, true);
      }
    };
  }

  function buy(itemId) {
    const it = S.data.loja.find(i => i.id === itemId);
    const saldo = user(S.me).stats?.saldo || 0;
    const ok = saldo >= it.preco;
    const sh = openSheet(`
      <h2>${isMerc(it) ? '🏪' : '🛍️'} ${esc(it.nome || 'Mercadinho')}${CLOSE}</h2>
      <div class="card item" style="margin-bottom:14px"><div class="pic" ${it.imagem_id ? `data-media="${it.imagem_id}"` : ''} style="aspect-ratio:16/10;font-size:84px">${esc(it.emoji || '🎁')}</div>
        <div class="body"><div class="pr" style="font-size:22px">${brl(it.preco)}</div>
          <div class="muted small">💰 Você tem <span class="mono">${brl(saldo)}</span>${ok ? ` · fica com <span class="mono">${brl(saldo - it.preco)}</span>` : ''}</div></div></div>
      ${ok ? `<div class="duo"><button class="btn big" data-a="close">Voltar</button><button class="btn big ok" data-a="buy">🛒 Comprar</button></div>`
           : `<div class="empty" style="padding:10px">🔒<p>Faltam <b class="mono">${brl(it.preco - saldo)}</b></p></div>`}`);
    hydrate(sh);
    sh.onclick = async e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'close') return closeSheet();
      b.disabled = true;
      b.innerHTML = '<div class="spin sm"></div>';
      try {
        await api('resgatar', { itemId });
        closeSheet();
        confetti(['🎁', '🛍️', '🎉', '🎒']);
        done('Na mochila!');
        S.tab = 'loja';
        load(true);
      } catch (err) { b.disabled = false; b.textContent = '🛒 Comprar'; toast('⚠️ ' + err.message, true); }
    };
  }

  // ------------------------------------------------------------ ADMIN
  // painel: Pendências (avaliar + entregar) · Missões · Loja · Chat · Resumo; tudo que se cria fica em "＋ Criar"
  function renderAdmin() {
    const d = S.data;
    const fila = d.relatos.filter(r => r.status === 'pendente').sort((a, b) => a.criado_em < b.criado_em ? -1 : 1);
    const entregar = d.resgates.filter(r => r.status === 'pendente');
    if (!['fila', 'missoes', 'loja', 'chat', 'resumo'].includes(S.adminTab)) S.adminTab = 'fila';
    const tabs = [
      ['fila', 'Pendências', fila.length + entregar.length],
      ['missoes', 'Missões', (d.missoes || []).filter(m => m.status === 'aberta').length],
      ['loja', 'Loja'],
      ['chat', 'Chat', naoLidas()],
      ['resumo', 'Resumo'],
    ];
    const body = {
      fila: () => adminPendencias(fila, entregar),
      missoes: adminMissoes,
      loja: adminLoja,
      chat: chatPage,
      resumo: () => adminResumo(fila),
    }[S.adminTab]();
    const pend = [fila.length && `${fila.length} para avaliar`, entregar.length && `${entregar.length} para entregar`].filter(Boolean);

    return `
      <div class="top">
        <label style="cursor:pointer">${avatar(ADMIN, 'ring-anim', true)}<input type="file" accept="image/*" hidden onchange="A.setFoto(this)"></label>
        <div class="who"><div class="eyebrow">Painel</div><div class="name">Olá, <em>${esc(user(ADMIN).nome)}</em></div>
          <div class="sub">${pend.length ? `<span class="badge pendente"><span class="live"></span>${pend.join(' · ')}</span>` : 'Tudo em dia ✨'}</div></div>
        <button class="btn primary criar-btn" onclick="A.criar()">${ICON.plus}<span>Criar</span></button>
        <button class="icon-btn tv-btn" onclick="A.tv()" aria-label="Controle da TV" title="Controle da TV">📺</button>
        <button class="icon-btn" onclick="A.reload()" aria-label="Atualizar" title="Atualizar">${ICON.refresh}</button>
      </div>
      <div class="tabs-top">${tabs.map(([k, t, n]) => `<button class="${S.adminTab === k ? 'on' : ''}" ${k === 'chat' ? 'data-badge="chat"' : ''} onclick="A.adminTab('${k}')">${ICON[k]}${t}${n ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>
      <div class="mt">${body}</div>`;
  }

  function adminPendencias(fila, entregar) {
    if (!fila.length && !entregar.length) {
      return '<div class="empty"><span class="big">🎉</span><p>Tudo em dia</p><div class="hint">Relatos novos e compras para entregar aparecem aqui</div></div>';
    }
    return `
      ${fila.length ? `${sectionTitle('📥', 'Avaliar', fila.length)}<div class="admin-grid">${fila.map(reviewCard).join('')}</div>` : ''}
      ${entregar.length ? `${sectionTitle('🎒', 'Entregar', entregar.length)}${adminResgates()}` : ''}`;
  }

  function adminResumo(fila) {
    const fin = S.data.resgates.filter(x => x.status !== 'pendente').slice(0, 15);
    return `
      <div class="hero-admin">${KIDS.map(id => {
        const u = user(id), st = u.stats || {};
        const pend = fila.filter(r => r.usuario === id).length;
        return `<div class="card kid-card"><span class="glow-blob" style="background:${u.cor}"></span>${avatar(id, '')}<div class="grow">
          <div class="nm" style="color:${u.cor}">${esc(u.nome)}</div>
          <div class="v" data-count="${st.saldo || 0}" data-key="saldo-${id}">${brl(st.saldo)}</div>
          <div class="kid-stats"><span>Semana <b>${brl(st.semana)}</b></span><span>Esperando <b>${pend}</b></span>
            <span>🐷 <b>${brl(st.cofre?.saldo)}</b></span><span>Nota média <b>${st.media || '–'}</b></span><span>🔥 <b>${st.streak || 0}</b> ${elo(st.streak).n}</span></div></div></div>`;
      }).join('')}
        <div class="card kpi"><div class="eyebrow">Pago este mês</div>
          <div class="v" data-count="${KIDS.reduce((s, id) => s + (user(id).stats?.mes || 0), 0)}" data-key="mes-total">–</div>
          <div class="muted small">Semana <span class="mono">${brl(KIDS.reduce((s, id) => s + (user(id).stats?.semana || 0), 0))}</span></div></div>
      </div>
      ${rankView()}
      ${sectionTitle('📜', 'Relatos avaliados')}${adminHist()}
      ${(S.data.multas || []).length ? `<div class="card" style="margin-top:14px">${multasRecentes()}</div>` : ''}
      ${fin.length ? `${sectionTitle('🎁', 'Entregas recentes', fin.length)}<div class="list">${fin.map(x => resgateRow(x, true)).join('')}</div>` : ''}`;
  }

  // relatos já avaliados (Resumo), filtráveis por filho; os 20 mais novos
  function adminHist() {
    const k = S.histKid || '';
    const rel = S.data.relatos.filter(r => r.status !== 'pendente' && (!k || r.usuario === k));
    const filtro = `<div class="seg inline">${[['', 'Todos'], ...KIDS.map(id => [id, user(id).nome])].map(([id, n]) =>
      `<button class="${k === id ? 'on' : ''}" onclick="A.histKid('${id}')">${esc(n)}</button>`).join('')}</div>`;
    if (!rel.length) return `${filtro}<div class="empty">📭<p>Nenhum relato avaliado ainda.</p></div>`;
    return `${filtro}<div class="list">${rel.slice(0, 20).map(r => `
      <div class="card relato">
        ${thumb(r)}
        <div class="info">
          <div class="row">${avatar(r.usuario, 'sm')}<b style="color:${user(r.usuario).cor}">${esc(user(r.usuario).nome)}</b>${badge(r)}</div>
          ${r.missao_id ? `<span class="m-chip">🎯 ${esc(missao(r.missao_id)?.titulo || 'Missão')}</span>` : ''}
          ${r.tarefa_id ? `<span class="m-chip">📋 ${esc(tarefa(r.tarefa_id)?.titulo || 'Tarefa')}</span>` : ''}
          ${r.status === 'aprovado' ? stars(r.nota) : ''}
          <div class="date">${quando(r.criado_em)}</div>
        </div>
        ${r.audio_id ? `<button class="play small" onclick="A.play('${r.audio_id}', this)" aria-label="Ouvir">▶</button>` : ''}
      </div>`).join('')}</div>`;
  }

  // ＋ Criar: um lugar só para tudo que o Ericky cria
  function criarSheet() {
    const op = [
      ['novaMissao', '🎯', 'Missão', 'Foto de algo para fazer + preço'],
      ['editTarefa', '📋', 'Tarefa fixa', 'Repete nos dias marcados'],
      ['mercadinho', '🏪', 'Mercadinho', 'Várias fotos, cada uma com preço'],
      ['editItem', '🛍️', 'Prêmio', 'Item com nome para a loja'],
      ['novoLeilao', '🔨', 'Leilão', 'Eles dão lances com o saldo'],
      ['presente', '🎁', 'Presente', 'Pix surpresa com mensagem'],
      ['multa', '⚠️', 'Multa', 'Desconto com motivo e foto'],
    ];
    const sh = openSheet(`
      <h2>＋ Criar${CLOSE}</h2>
      <div class="criar-grid">${op.map(([a, e, t, d]) => `<button class="criar-op" data-op="${a}"><span>${e}</span><b>${t}</b><small>${d}</small></button>`).join('')}</div>`);
    sh.onclick = e => {
      const o = e.target.closest('[data-op]');
      if (o) return A[o.dataset.op]();
      if (e.target.closest('[data-a=close]')) closeSheet();
    };
  }

  // ------------------------------------------------------------ CONTROLE DA TV
  // O painel da TV (#/tv) pergunta por comandos; daqui eles saem. Nada disso mexe em saldo:
  // as pegadinhas acontecem só na tela da TV.
  const TV_EMOJIS = ['❤️', '🔥', '😂', '👏', '💰', '🎉', '⭐', '🐷', '😱', '🤡', '👀', '💩', '🏆', '🍕', '🦊', '😴'];
  const TV_SONS = [['tambor', '🥁', 'Rufar'], ['palmas', '👏', 'Palmas'], ['fanfarra', '🎺', 'Vitória'], ['buzina', '📯', 'Buzina'],
    ['sirene', '🚨', 'Sirene'], ['fracasso', '😢', 'Fracasso'], ['alarme', '⏰', 'Alarme'], ['ding', '🔔', 'Ding']];
  const tvEnviar = (tipo, dados = {}) => api('tvEnviar', { tipo, dados });

  function tvSheet() {
    let view = 'menu', fala = null, audio = null, fotoUrl = null, kid = 'cesar', estilo = 'normal', seg = 15, falarAlto = false;
    const ops = [
      ['falar', '🎤', 'Falar', 'Vira legenda ao vivo'],
      ['voz', '🗣️', 'Recado de voz', 'A TV toca o áudio'],
      ['escrever', '✍️', 'Escrever', 'Texto grande na tela'],
      ['emojis', '😀', 'Emojis', 'Chuva de emoji'],
      ['comemorar', '🎉', 'Comemorar', 'Holofote + confete'],
      ['foto', '📸', 'Foto na TV', 'Tela cheia'],
      ['contagem', '⏱️', 'Contagem', 'Relógio regressivo'],
      ['sons', '🔊', 'Sons', 'Tambor, palmas, sirene…'],
      ['pegadinhas', '🃏', 'Pegadinhas', 'Só na TV, saldo real intacto'],
      ['limpar', '🧹', 'Limpar tela', 'Tira tudo da TV'],
    ];
    const kidSeg = (todos) => `<div class="seg inline tv-kids">${[...KIDS, ...(todos ? ['ambos'] : [])].map(k =>
      `<button class="${kid === k ? 'on' : ''}" data-kid="${k}">${k === 'ambos' ? 'Os dois' : esc(user(k).nome)}</button>`).join('')}</div>`;
    const voltar = `<button class="btn ghost tv-voltar" data-a="menu">${ICON.chevron} Voltar</button>`;
    const telas = {
      menu: () => `<p class="lead">Abra <b class="mono">#/tv</b> no navegador da TV. O que você mandar aparece lá em 2 a 4 segundos.</p>
        <div class="criar-grid">${ops.map(([a, e, t, d]) => `<button class="criar-op" data-v="${a}"><span>${e}</span><b>${t}</b><small>${d}</small></button>`).join('')}</div>`,
      falar: () => `${voltar}<div class="tv-fala">
          <button class="rec-btn ${fala ? 'on' : ''}" data-a="falar">${fala ? '⏹' : '🎤'}</button>
          <p class="muted">${fala ? 'Falando… o texto aparece na TV' : 'Toque e fale. Toque de novo para parar.'}</p>
          <div class="tv-trans" data-trans></div></div>`,
      voz: () => `${voltar}<div data-rec></div><button class="btn big primary mt" style="width:100%" data-a="voz" disabled>📺 Tocar na TV</button>`,
      escrever: () => `${voltar}
        <textarea class="input" name="t" rows="3" maxlength="280" placeholder="O que vai aparecer na TV"></textarea>
        <div class="seg inline mt tv-estilo">${[['normal', '💬 Recado'], ['parabens', '🎉 Parabéns'], ['alerta', '🚨 Alerta'], ['letreiro', '📣 Letreiro']].map(([k, t]) =>
          `<button class="${estilo === k ? 'on' : ''}" data-estilo="${k}">${t}</button>`).join('')}</div>
        <div class="quick tv-seg">${[8, 15, 30, 60].map(s => `<button class="${seg === s ? 'on' : ''}" data-seg="${s}">${s} s</button>`).join('')}</div>
        <label class="tv-check"><input type="checkbox" name="falar" ${falarAlto ? 'checked' : ''}> A TV lê em voz alta</label>
        <button class="btn big primary mt" style="width:100%" data-a="escrever">📺 Mostrar na TV</button>
        <p class="note">Letreiro fica rolando no rodapé até você limpar a tela.</p>`,
      emojis: () => `${voltar}<div class="tv-emojis">${TV_EMOJIS.map(e => `<button data-emoji="${e}">${e}</button>`).join('')}</div>
        <p class="note">Cada toque faz chover na TV.</p>`,
      comemorar: () => `${voltar}${kidSeg(true)}
        <input class="input" name="t" maxlength="60" placeholder="Motivo (opcional): ex. nota 10 na prova">
        <button class="btn big ok mt" style="width:100%" data-a="comemorar">🎉 Comemorar na TV</button>`,
      foto: () => `${voltar}
        ${fotoUrl ? `<div class="tv-foto" style="background-image:url('${fotoUrl}')"></div>`
          : `<div class="pick"><label>📷<small>Câmera</small><input type="file" accept="image/*" capture="environment" data-foto></label>
            <label>🖼️<small>Galeria</small><input type="file" accept="image/*" data-foto></label></div>`}
        <input class="input mt" name="t" maxlength="80" placeholder="Legenda (opcional)">
        <div class="quick tv-seg">${[8, 15, 30, 60].map(s => `<button class="${seg === s ? 'on' : ''}" data-seg="${s}">${s} s</button>`).join('')}</div>
        <button class="btn big primary mt" style="width:100%" data-a="foto" ${fotoUrl ? '' : 'disabled'}>📺 Mostrar na TV</button>`,
      contagem: () => `${voltar}
        <input class="input" name="t" maxlength="60" placeholder="Para quê? ex. arrumar o quarto">
        <div class="tv-min">${[1, 2, 5, 10, 15, 30].map(m => `<button class="btn" data-min="${m}">${m} min</button>`).join('')}</div>
        <button class="btn ghost mt" style="width:100%" data-a="parar">Parar contagem</button>`,
      sons: () => `${voltar}<div class="tv-sons">${TV_SONS.map(([s, e, t]) => `<button class="criar-op" data-som="${s}"><span>${e}</span><b>${t}</b></button>`).join('')}</div>
        <p class="note">Na primeira vez, aperte OK no controle da TV para liberar o som.</p>`,
      pegadinhas: () => `${voltar}${kidSeg(false)}
        <div class="criar-grid">
          <button class="criar-op" data-peg="zerar"><span>💸</span><b>Zerar a carteira</b><small>O saldo despenca até R$ 0,00</small></button>
          <button class="criar-op" data-peg="multa"><span>⚠️</span><b>Multa gigante</b><small>Carimbo de multa na tela</small></button>
          <button class="criar-op" data-peg="milionario"><span>💰</span><b>Presente milionário</b><small>R$ 1.000.000,00 do pai</small></button>
        </div>
        <div class="row mt"><div class="money-in grow"><span>R$</span><input name="valor" inputmode="decimal" value="500,00"></div>
          <input class="input grow" name="motivo" maxlength="60" placeholder="Motivo da multa"></div>
        <button class="btn big warn mt" style="width:100%" data-a="revelar">😜 Revelar a brincadeira</button>
        <p class="note">Acontece só na TV: o saldo de verdade e o celular deles não mudam. Revela sozinho em 30 s.</p>`,
    };
    const sh = openSheet(`<h2>📺 Controle da TV${CLOSE}</h2><div class="tv-body"></div>`, () => () => {
      clearInterval(oi);
      if (fala) fala.parar();
    });
    const body = sh.querySelector('.tv-body');
    const draw = () => {
      body.innerHTML = telas[view]();
      if (view === 'voz') {
        audio = null;
        mountRecorder(body.querySelector('[data-rec]'), a => { audio = a; body.querySelector('[data-a=voz]').disabled = !a; });
      }
      body.querySelectorAll('[data-foto]').forEach(inp => {
        inp.onchange = async () => {
          if (!inp.files[0]) return;
          try { fotoUrl = await compressImage(inp.files[0], 1600, 0.8); draw(); } catch { toast('⚠️ Não consegui abrir a foto', true); }
        };
      });
    };
    // avisa a TV que o controle está aberto: ela passa a perguntar mais rápido
    tvEnviar('oi').catch(() => {});
    const oi = setInterval(() => tvEnviar('oi').catch(() => {}), 60000);

    const enviar = async (b, tipo, dados, ok = '📺 Enviado') => {
      if (b) b.disabled = true;
      try { await tvEnviar(tipo, dados); toast(ok); navigator.vibrate?.(15); return true; }
      catch (err) { toast('⚠️ ' + err.message, true); return false; }
      finally { if (b) b.disabled = false; }
    };
    const valor = n => sh.querySelector(`[name=${n}]`)?.value.trim() || '';

    sh.onclick = async e => {
      const t = e.target;
      if (t.closest('[data-a=close]')) return closeSheet();
      const v = t.closest('[data-v]')?.dataset.v;
      if (v === 'limpar') return enviar(t.closest('button'), 'limpar', {}, '🧹 Tela limpa');
      if (v) { view = v; return draw(); }
      const a = t.closest('[data-a]');
      const k = t.closest('[data-kid]');
      if (k) { kid = k.dataset.kid; body.querySelectorAll('[data-kid]').forEach(x => x.classList.toggle('on', x === k)); return; }
      const es = t.closest('[data-estilo]');
      if (es) { estilo = es.dataset.estilo; body.querySelectorAll('[data-estilo]').forEach(x => x.classList.toggle('on', x === es)); return; }
      const sg = t.closest('[data-seg]');
      if (sg) { seg = Number(sg.dataset.seg); body.querySelectorAll('[data-seg]').forEach(x => x.classList.toggle('on', x === sg)); return; }
      const em = t.closest('[data-emoji]');
      if (em) { em.classList.remove('pop'); void em.offsetWidth; em.classList.add('pop'); return enviar(null, 'emoji', { e: em.dataset.emoji, n: 30 }, em.dataset.emoji); }
      const so = t.closest('[data-som]');
      if (so) return enviar(so, 'som', { s: so.dataset.som }, '🔊 Tocando');
      const mi = t.closest('[data-min]');
      if (mi) return enviar(mi, 'contagem', { seg: Number(mi.dataset.min) * 60, t: valor('t') }, `⏱️ ${mi.dataset.min} min na TV`);
      const pg = t.closest('[data-peg]');
      if (pg) {
        const dados = { p: pg.dataset.peg, k: kid };
        if (pg.dataset.peg === 'multa') { dados.valor = parseMoney(valor('valor')) || 50000; dados.motivo = valor('motivo'); }
        return enviar(pg, 'pegadinha', dados, '🃏 Pegadinha no ar');
      }
      if (!a) return;
      const act = a.dataset.a;
      if (act === 'menu') { if (fala) { fala.parar(); fala = null; } view = 'menu'; return draw(); }
      if (act === 'revelar') return enviar(a, 'revelar', {}, '😜 Revelado');
      if (act === 'parar') return enviar(a, 'contagem', { seg: 0 }, 'Contagem parada');
      if (act === 'comemorar') return enviar(a, 'comemorar', { k: kid, t: valor('t') }, '🎉 Comemorando');
      if (act === 'escrever') {
        const txt = valor('t');
        if (!txt) return toast('Escreva o texto', true);
        falarAlto = !!sh.querySelector('[name=falar]')?.checked;
        if (await enviar(a, 'texto', { t: txt, estilo, seg, falar: falarAlto })) sh.querySelector('[name=t]').value = '';
        return;
      }
      if (act === 'voz' || act === 'foto') {
        const midia = act === 'voz' ? audio && { mime: audio.mime, data: audio.data } : fotoUrl && splitDataUrl(fotoUrl);
        if (!midia) return;
        a.disabled = true;
        a.innerHTML = '<div class="spin sm"></div>';
        try {
          await api('tvMidia', { tipo: act === 'voz' ? 'audio' : 'foto', midia, dados: act === 'foto' ? { t: valor('t'), seg } : {} });
          toast('📺 Na TV');
          if (act === 'foto') fotoUrl = null;
          draw();
        } catch (err) { toast('⚠️ ' + err.message, true); a.disabled = false; a.textContent = '📺 Tentar de novo'; }
        return;
      }
      if (act === 'falar') {
        if (fala) { fala.parar(); fala = null; return draw(); }
        fala = falarNaTv(body);
        if (fala) draw();
      }
    };
    draw();
  }

  // fala → texto (reconhecimento de voz do navegador) → legenda na TV.
  // Um envio por vez: enquanto um está indo, guarda só o texto mais novo.
  function falarNaTv(body) {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) { toast('Este navegador não transcreve fala. Use o Recado de voz', true); return null; }
    const rec = new SR();
    rec.lang = 'pt-BR';
    rec.interimResults = true;
    rec.continuous = true;
    let id = novaChave(), indo = false, prox = null, ativo = true;
    const mandar = async d => {
      if (indo) { prox = d; return; }
      indo = true;
      try { await tvEnviar('fala', d); } catch { /* perdeu um pedaço: o próximo corrige */ }
      indo = false;
      if (prox) { const p = prox; prox = null; mandar(p); }
    };
    rec.onresult = ev => {
      let txt = '', fim = false;
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        txt += ev.results[i][0].transcript;
        if (ev.results[i].isFinal) fim = true;
      }
      txt = txt.trim().slice(-200);
      const box = body.querySelector('[data-trans]');
      if (box) box.textContent = txt;
      if (!txt) return;
      mandar({ id, t: txt, fim });
      if (fim) id = novaChave();
    };
    // o Chrome para sozinho depois de um silêncio: recomeça enquanto estiver ligado
    rec.onend = () => { if (ativo) try { rec.start(); } catch { /* já rodando */ } };
    rec.onerror = ev => { if (ev.error === 'not-allowed') { ativo = false; toast('🎤 Libere o microfone', true); } };
    try { rec.start(); } catch { toast('🎤 Não consegui ligar o microfone', true); return null; }
    return { parar: () => { ativo = false; try { rec.stop(); } catch { /* já parado */ } } };
  }

  function reviewCard(r) {
    const u = user(r.usuario);
    const ms = r.missao_id && missao(r.missao_id);
    const tf = r.tarefa_id && tarefa(r.tarefa_id);
    const sugerido = ms ? ms.valor : tf ? tf.valor : 0;
    const st = review[r.id] || (review[r.id] = { nota: 0, valor: sugerido ? centsStr(sugerido) : '' });
    return `<div class="card review ${ms ? 'is-missao' : ''}" data-id="${r.id}">
      <div class="photo" data-media="${fotosDe(r)[0]}" onclick="A.gallery('${fotosDe(r).join(',')}')">📷
        <span class="who" style="color:${u.cor}">${avatar(r.usuario, 'sm')}${esc(u.nome)}</span>
        ${fotosDe(r).length > 1 ? `<span class="tag">${fotosDe(r).length} fotos</span>` : ''}
      </div>
      <div class="body">
        ${ms ? `<div class="m-banner"><span class="m-thumb" data-media="${ms.foto_id}" onclick="A.zoomMedia('${ms.foto_id}')">🎯</span>
          <div class="grow"><b>${ms.tipo === 'dupla' ? '👥 Missão em dupla' : 'Missão'}${ms.titulo ? ': ' + esc(ms.titulo) : ''}</b>
            <div class="muted small">Valor combinado <span class="mono">${brl(ms.valor)}</span>${ms.tipo === 'dupla' ? ' · dividido entre os dois' : ''}</div></div></div>` : ''}
        ${tf ? `<div class="m-banner"><span class="m-thumb">${esc(tf.emoji || '📋')}</span>
          <div class="grow"><b>Tarefa fixa: ${esc(tf.titulo)}</b><div class="muted small">Vale <span class="mono">${brl(tf.valor)}</span> por dia</div></div></div>` : ''}
        ${fotosDe(r).length > 1 ? `<div class="strip">${fotosDe(r).map((id, i) => `<div class="thumb sm" data-media="${id}" onclick="A.gallery('${fotosDe(r).join(',')}', ${i})">📷</div>`).join('')}</div>` : ''}
        <div class="row small muted mono"><span>${quando(r.criado_em)}</span>${r.tentativas > 1 ? `<span class="badge refazer" style="margin-left:auto;font-size:12px">🔁 ${r.tentativas - 1}ª refeita</span>` : ''}</div>
        ${r.audio_id ? `<div class="row"><button class="play" onclick="A.play('${r.audio_id}', this)">▶</button><span class="muted">Ouvir o relato</span></div>` : '<div class="muted small">🔇 Sem áudio</div>'}
        <div class="star-pick">${Array.from({ length: 10 }, (_, i) =>
          `<button class="${i < st.nota ? 'on' : ''}" onclick="A.nota('${r.id}', ${i + 1})" aria-label="${i + 1}">⭐</button>`).join('')}</div>
        <div class="money-in"><span>R$</span><input inputmode="decimal" placeholder="0,00" value="${esc(st.valor)}"
          oninput="A.valor('${r.id}', this.value)"><span class="mono">${st.nota ? st.nota + '/10' : ''}</span></div>
        <div class="quick">${['0,10', '0,50', '1,00', '2,00', '5,00', '10,00'].map(v =>
          `<button class="${st.valor === v ? 'on' : ''}" data-v="${v}" onclick="A.valor('${r.id}', '${v}', true)">${v}</button>`).join('')}</div>
        <div class="row"><button class="btn warn" onclick="A.refazer('${r.id}')">🔁 Refazer</button>
          <button class="btn ok grow" data-approve onclick="A.aprovar('${r.id}', this)">${approveLabel(r.id)}</button></div>
      </div></div>`;
  }

  // entregar: a mochila de cada filho com foto grande; entregar tira o item da mochila dele
  function adminResgates() {
    const all = S.data.resgates;
    const pend = all.filter(x => x.status === 'pendente');
    const grupos = KIDS.map(k => ({ k, l: pend.filter(x => x.usuario === k) })).filter(g => g.l.length);
    return `
      ${grupos.length ? grupos.map(({ k, l }) => `
        <div class="inv-head">${avatar(k, 'md')}
          <div class="grow"><b style="color:${user(k).cor}">${esc(user(k).nome)}</b>
            <div class="muted small">${l.length} ${l.length === 1 ? 'item' : 'itens'} na mochila · <span class="mono">${brl(l.reduce((t, x) => t + Number(x.preco), 0))}</span></div></div>
          ${l.length > 1 ? `<button class="btn ok" onclick="A.entregarTudo('${k}', this)">✅ Entregar tudo</button>` : ''}
        </div>
        <div class="shop">${l.map(x => `
          <div class="card item inv">
            <div class="pic" ${resgImg(x) ? `data-media="${resgImg(x)}" onclick="A.zoomMedia('${resgImg(x)}')"` : ''}><span>${esc(x.emoji || '🎁')}</span><b class="pr-tag mono">${brl(x.preco)}</b></div>
            <div class="body">${x.nome ? `<div class="nm">${esc(x.nome)}</div>` : ''}<div class="muted small">${quando(x.criado_em)}</div>
              <div class="row"><button class="btn ok grow" onclick="A.resgate('${x.id}','entregue', this)">✅ Entregar</button>
                <button class="btn" onclick="A.resgate('${x.id}','cancelado', this)" aria-label="Cancelar e devolver" title="Cancelar e devolver">${ICON.x}</button></div>
            </div>
          </div>`).join('')}</div>`).join('')
      : '<div class="empty"><span class="big">🎒</span><p>Nada para entregar</p><div class="hint">O que eles comprarem aparece aqui, separado por filho</div></div>'}
      <p class="note">O valor já saiu do saldo na compra. <b>Entregar</b> tira o item da mochila; <b>✕</b> cancela e devolve o valor.</p>`;
  }

  function adminLoja() {
    const merc = S.data.loja.filter(isMerc), premios = S.data.loja.filter(it => !isMerc(it));
    const card = it => `<button class="card item" onclick="A.editItem('${it.id}')">
        <div class="pic" ${it.imagem_id ? `data-media="${it.imagem_id}"` : ''}><span>${esc(it.emoji || '🎁')}</span>${it.nome ? '' : `<b class="pr-tag mono">${brl(it.preco)}</b>`}</div>
        ${it.nome ? `<div class="body"><div class="nm">${esc(it.nome)}</div><div class="pr mono">${brl(it.preco)}</div></div>` : ''}
      </button>`;
    const leiloes = S.data.leiloes || [];
    return `
      <div class="row" style="flex-wrap:wrap">
        <button class="btn primary" onclick="A.mercadinho()">🏪 Mercadinho</button>
        <button class="btn" onclick="A.editItem()">➕ Prêmio</button>
        <button class="btn" onclick="A.novoLeilao()">🔨 Leilão</button>
      </div>
      ${leiloes.length ? `${sectionTitle('🔨', 'Leilões')}<div class="shop">${leiloes.map(l => leilaoCard(l, true)).join('')}</div>` : ''}
      ${merc.length ? `${sectionTitle('🏪', 'Mercadinho', merc.length)}<div class="shop">${merc.map(card).join('')}</div>` : ''}
      ${premios.length ? `${sectionTitle('🛍️', 'Prêmios', premios.length)}<div class="shop">${premios.map(card).join('')}</div>` : ''}
      ${S.data.loja.length ? '' : '<div class="empty"><span class="big">🏪</span><p>A loja está vazia</p><div class="hint">Vá ao mercadinho e tire fotos do que quiser oferecer</div></div>'}`;
  }

  // ---- adicionar do mercadinho: foto atrás de foto, cada uma com o preço; a fila fica salva no aparelho
  // (se o celular recarregar a página ao abrir a câmera, as fotos continuam lá)
  const MERC_KEY = 'mesada-mercadinho';
  const lerMerc = () => { try { return JSON.parse(localStorage.getItem(MERC_KEY)) || []; } catch { return []; } };
  const salvarMerc = l => {
    try { l.length ? localStorage.setItem(MERC_KEY, JSON.stringify(l)) : localStorage.removeItem(MERC_KEY); }
    catch { toast('⚠️ Memória cheia: ponha na loja os que já tem antes de tirar mais', true); }
  };

  function mercadinhoSheet() {
    const fila = lerMerc(); // [{ foto: dataURL, preco: '1,50' }]
    let enviando = false;
    const sh = openSheet(`
      <h2>🏪 Itens do mercadinho${CLOSE}</h2>
      <p class="lead">Tire uma foto de cada coisa e coloque o preço. Não precisa escrever nome.</p>
      <div class="row">
        <label class="btn primary grow">📷 Tirar foto<input type="file" accept="image/*" capture="environment" hidden data-f></label>
        <label class="btn grow">🖼️ Várias da galeria<input type="file" accept="image/*" multiple hidden data-f></label>
      </div>
      <div class="merc-fila mt"></div>
      <div class="send-bar"><button class="btn big ok grow" data-a="send" disabled></button></div>`);
    const box = sh.querySelector('.merc-fila');
    const btn = sh.querySelector('[data-a=send]');
    const atualizarBtn = () => {
      if (enviando) return;
      const n = fila.length, prontos = fila.filter(x => parseMoney(x.preco) >= 1).length;
      btn.disabled = !n || prontos < n;
      btn.textContent = !n ? 'Tire a primeira foto' : prontos < n ? `Falta o preço de ${n - prontos}` : `✅ Pôr ${n} ${n === 1 ? 'item' : 'itens'} na loja`;
    };
    const draw = () => {
      box.innerHTML = fila.map((x, i) => `<div class="merc-item">
        <div class="merc-foto" style="background-image:url('${x.foto}')" data-z="${i}"></div>
        <div class="money-in grow"><span>R$</span><input inputmode="decimal" enterkeyhint="next" placeholder="0,00" value="${esc(x.preco)}" data-preco="${i}"></div>
        <button class="m-del" data-del="${i}" aria-label="Remover">${ICON.x}</button>
      </div>`).join('') || '<div class="empty" style="padding:24px"><span class="big">📸</span><p>Nenhuma foto ainda</p></div>';
      atualizarBtn();
    };
    const focarVazio = () => {
      const i = fila.findIndex(x => !(parseMoney(x.preco) >= 1));
      if (i >= 0) box.querySelector(`[data-preco="${i}"]`)?.focus();
    };
    sh.querySelectorAll('[data-f]').forEach(inp => {
      inp.onchange = async () => {
        const fs = [...inp.files];
        inp.value = '';
        if (!fs.length) return;
        box.insertAdjacentHTML('afterbegin', '<div class="cmp-loading" style="position:relative;padding:20px"><div class="spin"></div></div>');
        for (const f of fs) {
          try { fila.push({ foto: await compressImage(f, 800, .72), preco: '' }); } catch { toast('⚠️ Não consegui abrir uma das fotos', true); }
        }
        salvarMerc(fila);
        draw();
        focarVazio();
        navigator.vibrate?.(15);
      };
    });
    sh.addEventListener('input', e => {
      const i = e.target.dataset.preco;
      if (i == null) return;
      fila[i].preco = e.target.value;
      salvarMerc(fila);
      atualizarBtn();
    });
    sh.addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.target.dataset.preco == null) return;
      e.preventDefault();
      const prox = box.querySelector(`[data-preco="${Number(e.target.dataset.preco) + 1}"]`);
      prox ? prox.focus() : e.target.blur();
    });
    draw();
    if (fila.length) toast(`📸 ${fila.length} ${fila.length === 1 ? 'foto voltou' : 'fotos voltaram'}`);

    sh.onclick = async e => {
      if (enviando) return;
      const z = e.target.closest('[data-z]');
      if (z) return zoom(fila[z.dataset.z].foto);
      const d = e.target.closest('[data-del]');
      if (d) { fila.splice(Number(d.dataset.del), 1); salvarMerc(fila); return draw(); }
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'close') return closeSheet(); // a fila continua salva
      if (b.dataset.a !== 'send' || !fila.length) return;
      enviando = true;
      btn.disabled = true;
      let ok = 0;
      const total = fila.length;
      // um por vez: se a rede cair no meio, os que já foram saem da fila e o resto fica salvo
      while (fila.length) {
        btn.innerHTML = `<div class="spin sm"></div> ${ok + 1} de ${total}`;
        try {
          await api('lojaSalvar', { item: { nome: '', emoji: '🛒', preco: parseMoney(fila[0].preco), imagem: splitDataUrl(fila[0].foto), categoria: 'mercadinho' } });
          fila.shift();
          ok++;
          salvarMerc(fila);
          box.firstElementChild?.remove();
        } catch (err) {
          enviando = false;
          draw();
          toast(`⚠️ ${ok} ${ok === 1 ? 'foi' : 'foram'} para a loja; parou: ${err.message}`, true);
          if (ok) load(true);
          return;
        }
      }
      closeSheet();
      done(`${ok} ${ok === 1 ? 'item' : 'itens'} na loja!`);
      load(true);
    };
  }

  function editItem(id) {
    const it = id ? S.data.loja.find(i => i.id === id) : { nome: '', emoji: '🎁', preco: '' };
    let imagem = null, removerImagem = false, categoria = it.categoria || '';
    const sh = openSheet(`
      <h2>${id ? '✏️ Editar item' : '➕ Novo item'}${CLOSE}</h2>
      <div class="list">
        <div class="field"><label>Nome (opcional se tiver foto)</label><input class="input" name="nome" value="${esc(it.nome)}" placeholder="Ex: 1h de videogame"></div>
        <div class="field"><label>Onde aparece</label><div class="seg inline">
          <button class="${categoria === 'mercadinho' ? 'on' : ''}" data-cat="mercadinho">🏪 Mercadinho</button>
          <button class="${categoria === '' ? 'on' : ''}" data-cat="">🛍️ Prêmios</button></div></div>
        <div class="row">
          <div class="field" style="width:96px"><label>Emoji</label><input class="input" name="emoji" value="${esc(it.emoji)}" style="text-align:center;font-size:22px"></div>
          <div class="field grow"><label>Preço</label><div class="money-in"><span>R$</span><input name="preco" inputmode="decimal" value="${it.preco ? (it.preco / 100).toFixed(2).replace('.', ',') : ''}" placeholder="0,00"></div></div>
        </div>
        <div class="field"><label>Imagem (opcional — se não tiver, usa o emoji)</label>
          <div class="item card"><div class="pic" data-pic ${it.imagem_id ? `data-media="${it.imagem_id}"` : ''} style="aspect-ratio:16/9">${esc(it.emoji || '🎁')}</div></div>
          <div class="row"><label class="btn grow">🖼️ Escolher<input type="file" accept="image/*" hidden name="img"></label>
          ${it.imagem_id ? '<button class="btn" data-a="noimg">🗑️ Tirar</button>' : ''}</div>
        </div>
        <div class="row mt">${id ? '<button class="btn danger" data-a="del">🗑️ Remover</button>' : ''}
          <button class="btn primary grow big" data-a="save">💾 Salvar</button></div>
      </div>`);
    hydrate(sh);
    sh.querySelector('[name=img]').onchange = async e => {
      const f = e.target.files[0];
      if (!f) return;
      const url = await compressImage(f, 700, .75);
      imagem = splitDataUrl(url);
      removerImagem = false;
      const p = sh.querySelector('[data-pic]');
      p.style.backgroundImage = `url("${url}")`;
      p.textContent = '';
    };
    sh.onclick = async e => {
      const cat = e.target.closest('[data-cat]');
      if (cat) { categoria = cat.dataset.cat; sh.querySelectorAll('[data-cat]').forEach(x => x.classList.toggle('on', x === cat)); return; }
      const b = e.target.closest('[data-a]');
      if (!b) return;
      const a = b.dataset.a;
      if (a === 'close') return closeSheet();
      if (a === 'noimg') {
        removerImagem = true; imagem = null;
        const p = sh.querySelector('[data-pic]');
        p.style.backgroundImage = ''; p.textContent = sh.querySelector('[name=emoji]').value || '🎁';
        return;
      }
      if (a === 'del' && !b.classList.contains('armed')) {
        b.classList.add('armed');
        b.textContent = 'Toque de novo para remover';
        return;
      }
      const val = n => sh.querySelector(`[name=${n}]`).value.trim();
      const preco = parseMoney(val('preco'));
      if (a === 'save' && !(preco >= 1)) return toast('Preencha o preço', true);
      if (a === 'save' && !val('nome') && !imagem && (!it.imagem_id || removerImagem)) return toast('Coloque um nome ou uma foto', true);
      b.disabled = true;
      try {
        if (a === 'del') await api('lojaRemover', { id });
        else await api('lojaSalvar', { item: { id: id || '', nome: val('nome'), emoji: val('emoji'), preco, imagem, removerImagem, categoria } });
        closeSheet();
        toast(a === 'del' ? 'Item removido' : 'Item salvo ✅');
        load(true);
      } catch (err) { b.disabled = false; toast('⚠️ ' + err.message, true); }
    };
  }

  function refazer(id) {
    let resposta = null, recorder;
    const sh = openSheet(`
      <h2>🔁 Pedir para refazer${CLOSE}</h2>
      <p class="muted" style="margin-top:0">Grave um áudio explicando o que precisa mudar (opcional, mas ajuda quem ainda não lê).</p>
      <div data-rec></div>
      <button class="btn warn big mt" style="width:100%" data-a="send">🔁 Enviar para refazer</button>`, s => {
        recorder = mountRecorder(s.querySelector('[data-rec]'), a => (resposta = a));
        return () => recorder.stop();
      });
    sh.onclick = async e => {
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'close') return closeSheet();
      b.disabled = true;
      b.innerHTML = '<div class="spin sm"></div>';
      try {
        await api('avaliar', { id, status: 'refazer', resposta: resposta ? { mime: resposta.mime, data: resposta.data } : null });
        delete review[id];
        closeSheet();
        toast('🔁 Enviado para refazer');
        load(true);
      } catch (err) { b.disabled = false; b.textContent = '🔁 Enviar para refazer'; toast('⚠️ ' + err.message, true); }
    };
  }

  const approveLabel = id => {
    const v = parseMoney(review[id]?.valor);
    const r = S.data.relatos.find(x => x.id === id);
    const dupla = r?.missao_id && missao(r.missao_id)?.tipo === 'dupla';
    return v >= 1 && v <= (r ? maxValor(r) : 1000) ? `✅ Aprovar ${brl(v)}${dupla ? ' ÷ 2' : ''}` : '✅ Aprovar';
  };

  async function aprovar(id, btn) {
    const st = review[id] || {};
    const valor = parseMoney(st.valor);
    if (!st.nota) return toast('Dê uma nota de 1 a 10 ⭐', true);
    const rel = S.data.relatos.find(x => x.id === id);
    const max = rel ? maxValor(rel) : 1000;
    if (!(valor >= 1 && valor <= max)) return toast(`O valor precisa ser de R$ 0,01 a ${brl(max)}`, true);
    btn.disabled = true;
    btn.innerHTML = '<div class="spin sm"></div>';
    try {
      await api('avaliar', { id, status: 'aprovado', nota: st.nota, valor });
      delete review[id];
      toast(`✅ ${brl(valor)} aprovado`);
      load(true);
    } catch (err) { btn.disabled = false; btn.textContent = approveLabel(id); toast('⚠️ ' + err.message, true); }
  }

  // ------------------------------------------------------------ MOCHILA / PIX
  const outro = k => (k === 'cesar' ? 'arthur' : 'cesar');
  const lojaItem = x => S.data.loja.find(i => i.id === x.item_id) || {};

  // mochila: o que comprou e ainda não recebeu (fica no topo da Loja)
  function mochilaTopo() {
    const pend = S.data.resgates.filter(x => x.usuario === S.me && x.status === 'pendente');
    if (!pend.length) return '';
    return `${sectionTitle('🎒', 'Na sua mochila', pend.length)}
      <div class="mochila-row">${pend.map(x => `<div class="mo-item">${resgThumb(x)}<small class="mono">${brl(x.preco)}</small></div>`).join('')}</div>
      <p class="note" style="margin-top:6px">⏳ Esperando o ${esc(user(ADMIN).nome)} entregar.</p>`;
  }

  function pixSheet() {
    const saldo = user(S.me).stats?.saldo || 0;
    const para = outro(S.me);
    const sh = openSheet(`
      <h2>${PIX} Pix${CLOSE}</h2>
      <div class="pix-to">${avatar(S.me, 'md')}<span class="arrow">➜</span>${avatar(para, 'md')}</div>
      <div class="money-in big-money"><span>R$</span><input name="v" inputmode="decimal" placeholder="0,00"></div>
      <div class="quick">${['0,50', '1,00', '2,00', '5,00', '10,00'].map(v => `<button data-q="${v}">${v}</button>`).join('')}
        <button data-q="${(saldo / 100).toFixed(2).replace('.', ',')}">💰 tudo</button></div>
      <div class="muted small mono" style="text-align:center;margin:10px 0">💰 ${brl(saldo)}</div>
      <button class="btn pix big mt" style="width:100%" data-a="send">${ICON.pix} Enviar</button>`);
    // segurança contra valor duplicado: 1º toque pede confirmação, 2º envia; enquanto envia, nada mais passa.
    // A chave vale para esta tentativa: se a rede cair e tentar de novo, o servidor não cobra duas vezes.
    let confirmando = 0, enviando = false, chave = novaChave();
    const btn = sh.querySelector('[data-a=send]');
    const resetBtn = () => { confirmando = 0; btn.classList.remove('confirm'); btn.innerHTML = `${ICON.pix} Enviar`; };
    sh.querySelector('[name=v]').oninput = () => { if (!enviando) resetBtn(); };
    sh.onclick = async e => {
      const q = e.target.closest('[data-q]');
      if (q && !enviando) { sh.querySelector('[name=v]').value = q.dataset.q; resetBtn(); return; }
      const b = e.target.closest('[data-a]');
      if (!b || enviando) return;
      if (b.dataset.a === 'close') return closeSheet();
      const valor = parseMoney(sh.querySelector('[name=v]').value);
      if (!(valor >= 1)) return toast('Digite o valor', true);
      if (valor > saldo) return toast('🔒 ' + brl(saldo), true);
      if (confirmando !== valor) {
        confirmando = valor;
        b.classList.add('confirm');
        b.innerHTML = `✓ Confirmar ${brl(valor)} para ${esc(user(para).nome)}`;
        navigator.vibrate?.(20);
        return;
      }
      enviando = true;
      b.disabled = true;
      b.innerHTML = '<div class="spin sm"></div>';
      try {
        await api('pix', { valor, chave });
        closeSheet();
        confetti(['💰', '🪙', '✨']);
        done(`${brl(valor)} → ${user(para).nome}`);
        load(true);
      } catch (err) {
        enviando = false;
        b.disabled = false;
        resetBtn();
        toast('⚠️ ' + err.message, true);
      }
    };
  }

  // extrato: cada entrada e saída do saldo (a aba Movimentos), mais novo primeiro
  function extratoLinha(m) {
    const resg = id => S.data.resgates.find(x => x.id === id);
    const rel = id => S.data.relatos.find(x => x.id === id);
    const nomeOutro = esc(user(outro(S.me)).nome);
    {
      const r = m.tipo === 'resgate' || m.tipo === 'estorno' ? resg(m.ref) : null;
      const [ico, txt] = {
        relato: rel(m.ref)?.tarefa_id
          ? [esc(tarefa(rel(m.ref).tarefa_id)?.emoji || '📋'), `Tarefa: ${esc(tarefa(rel(m.ref).tarefa_id)?.titulo || 'tarefa fixa')}`]
          : rel(m.ref)?.missao_id
          ? ['🎯', `Missão${missao(rel(m.ref).missao_id)?.titulo ? ': ' + esc(missao(rel(m.ref).missao_id).titulo) : ' concluída'}`]
          : ['📸', `Relato aprovado${rel(m.ref)?.nota ? ` · ⭐ ${rel(m.ref).nota}` : ''}`],
        cofre_guardar: ['🐷', 'Guardou no cofrinho'],
        missao_dupla: ['👥', `Missão em dupla com ${nomeOutro}`],
        presente: ['🎁', `Presente do ${esc(user(ADMIN).nome)}`],
        multa: ['⚠️', `Multa: ${esc((S.data.multas || []).find(x => x.id === m.ref)?.motivo || '')}`],
        multa_perdoada: ['🤝', 'Multa perdoada'],
        lance: ['🔨', `Lance: ${esc(leilao(m.ref)?.nome || 'leilão')}`],
        lance_devolvido: ['🔨', `Lance devolvido: ${esc(leilao(m.ref)?.nome || 'leilão')}`],
        cofre_retirar: ['🐷', 'Tirou do cofrinho'],
        resgate: [esc(r?.emoji || '🛍️'), `Compra: ${esc(r?.nome || 'item da loja')}`],
        estorno: ['↩️', `Devolvido: ${esc(r?.nome || 'compra cancelada')}`],
        pix_enviado: [ICON.pix, `Pix para ${nomeOutro}`],
        pix_recebido: [ICON.pix, `Pix de ${nomeOutro}`],
      }[m.tipo] || ['•', esc(m.tipo)];
      const v = Number(m.valor) || 0;
      return `<div class="ext-row"><span class="ext-ico">${ico}</span>
        <div class="grow"><div class="t">${txt}</div><div class="d">${quando(m.data)}</div></div>
        <span class="val ${v >= 0 ? 'pos' : 'neg'}">${v >= 0 ? '+' : '−'} ${brl(Math.abs(v))}</span></div>`;
    }
  }

  function extratoSheet() {
    const st = user(S.me).stats || {};
    const linha = extratoLinha;
    const ext = S.data.extrato || [];
    const sh = openSheet(`
      <h2>💰 Extrato${CLOSE}</h2>
      <div class="ext-sum">
        <div><small>Saldo</small><b>${brl(st.saldo)}</b></div>
        <div><small>Semana</small><b>${brl(st.semana)}</b></div>
        <div><small>Mês</small><b>${brl(st.mes)}</b></div>
      </div>
      ${ext.length ? `<div class="ext-list">${ext.map(linha).join('')}</div>`
        : '<div class="empty"><span class="big">🧾</span><p>Nada por aqui ainda</p></div>'}`);
    sh.onclick = e => { if (e.target.closest('[data-a=close]')) closeSheet(); };
  }

  // ------------------------------------------------------------ MISSÕES
  // O Ericky fotografa algo para fazer e põe um preço; o primeiro irmão que mandar o relato pega a missão.
  const missao = id => (S.data.missoes || []).find(m => m.id === id);
  const centsStr = c => (c / 100).toFixed(2).replace('.', ',');
  const maxValor = r => (r.missao_id ? 10000 : 1000);

  function missaoCard(m) {
    const minha = m.usuario === S.me;
    const rel = minha ? S.data.relatos.find(r => r.id === m.relato_id) : null;
    let estado;
    if (m.status === 'aberta') estado = '<span class="m-go">📸 Fazer</span>';
    else if (minha && rel?.status === 'refazer') estado = '<span class="badge refazer"><span class="live"></span>Refazer</span>';
    else if (minha) estado = '<span class="badge pendente"><span class="live"></span>Esperando</span>';
    else if (m.tipo === 'dupla') estado = `<span class="badge pendente"><span class="live"></span>${esc(user(m.usuario).nome)} mandou</span>`;
    else estado = `<span class="badge cancelado">🔒 ${esc(user(m.usuario).nome)}</span>`;
    return `<button class="card missao ${m.status === 'aberta' || minha || m.tipo === 'dupla' ? '' : 'off'}" onclick="A.missao('${m.id}')">
      <div class="pic" data-media="${m.foto_id}"><span>🎯</span>${m.tipo === 'dupla' ? '<i class="m-dupla">👥 Dupla</i>' : ''}<b class="m-val">${brl(m.valor)}</b></div>
      <div class="body"><div class="nm">${esc(m.titulo || 'Missão')}</div>${estado}</div>
    </button>`;
  }

  function missoesKid() {
    const ms = (S.data.missoes || []).filter(m => m.status === 'aberta' || m.status === 'fazendo')
      .sort((a, b) => (a.status !== 'aberta') - (b.status !== 'aberta'));
    if (!ms.length) return '';
    const abertas = ms.filter(m => m.status === 'aberta').length;
    return `${sectionTitle('🎯', 'Missões', abertas || null)}
      <div class="missoes">${ms.map(missaoCard).join('')}</div>`;
  }

  function missaoSheet(id) {
    const m = missao(id);
    if (!m) return;
    const minha = m.usuario === S.me;
    const rel = minha ? S.data.relatos.find(r => r.id === m.relato_id) : null;
    if (minha && rel?.status === 'refazer') return compose(rel.id);
    const pode = m.status === 'aberta';
    const sh = openSheet(`
      <h2>🎯 ${esc(m.titulo || 'Missão')}${CLOSE}</h2>
      <div class="m-photo" data-media="${m.foto_id}" onclick="A.zoomMedia('${m.foto_id}')">🎯</div>
      <div class="m-premio"><span class="muted">Vale</span><b class="mono">${brl(m.valor)}</b></div>
      <p class="lead" style="text-align:center">${m.tipo === 'dupla' ? `👥 <b>Em dupla:</b> façam juntos! Um de vocês manda o relato e o valor é dividido —
        <span class="mono">${brl(Math.ceil(m.valor / 2))}</span> para quem mandar e <span class="mono">${brl(Math.floor(m.valor / 2))}</span> para o outro.<br><br>` : ''}${pode
        ? 'Faça o que está na foto e mande um relato mostrando que ficou pronto.'
        : minha ? '⏳ Você já mandou. Agora é esperar a aprovação.'
        : m.tipo === 'dupla' ? `👥 ${esc(user(m.usuario).nome)} já mandou por vocês dois. Agora é esperar a aprovação.`
        : `🔒 ${esc(user(m.usuario).nome)} pegou essa missão primeiro.`}</p>
      ${pode ? '<button class="btn big ok" style="width:100%" data-a="go">📸 Fazer agora</button>' : ''}`);
    hydrate(sh);
    sh.onclick = e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'close') closeSheet();
      if (a === 'go') compose(undefined, id);
    };
  }

  function adminMissoes() {
    const ms = S.data.missoes || [];
    const grupo = (st, titulo, ico) => {
      const l = ms.filter(m => m.status === st);
      if (!l.length) return '';
      return `${sectionTitle(ico, titulo, l.length)}<div class="shop">${l.map(m => `
        <div class="card item missao-adm">
          <div class="pic" data-media="${m.foto_id}" ${m.foto_id ? `onclick="A.zoomMedia('${m.foto_id}')"` : ''}><span>🎯</span>${m.tipo === 'dupla' ? '<i class="m-dupla">👥 Dupla</i>' : ''}<b class="m-val">${brl(m.valor)}</b></div>
          <div class="body"><div class="nm">${esc(m.titulo || 'Missão')}</div>
            <div class="muted small">${st === 'aberta' ? quando(m.criado_em) : `${esc(user(m.usuario).nome)} · ${quando(m.atualizado_em)}`}</div>
            ${st === 'aberta' ? `<button class="btn danger" style="min-height:38px;padding:6px 10px;font-size:13px" onclick="A.missaoCancelar('${m.id}', this)">Tirar do catálogo</button>` : ''}
          </div></div>`).join('')}</div>`;
    };
    const vazio = !ms.some(m => m.status !== 'cancelada');
    return `
      <button class="btn primary" onclick="A.novaMissao()">📸 Nova missão</button>
      <p class="note">Viu algo para fazer? Tire uma foto e ponha um preço. Aparece no Início dos dois; o primeiro que mandar o relato pega a missão.</p>
      ${vazio ? '<div class="empty"><span class="big">🎯</span><p>Nenhuma missão ainda</p></div>' : ''}
      ${grupo('aberta', 'No catálogo', '🎯')}${grupo('fazendo', 'Sendo feitas', '⏳')}${grupo('concluida', 'Concluídas', '✅')}${adminTarefas()}`;
  }

  function novaMissao() {
    let foto = null, enviando = false, tipo = 'solo';
    const sh = openSheet(`
      <h2>🎯 Nova missão${CLOSE}</h2>
      <div class="m-pick"></div>
      <div class="list mt">
        <div class="field"><label>O que fazer (opcional)</label><input class="input" name="titulo" maxlength="80" placeholder="Ex.: arrumar a cama"></div>
        <div class="field"><label>Quem faz</label><div class="seg inline">
          <button class="on" data-t="solo">🙋 O primeiro que pegar</button><button data-t="dupla">👥 Em dupla</button></div></div>
        <div class="field"><label>Quanto vale</label><div class="money-in"><span>R$</span><input name="valor" inputmode="decimal" placeholder="0,00"></div></div>
        <div class="quick">${['0,50', '1,00', '2,00', '5,00', '10,00', '20,00'].map(v => `<button data-q="${v}">${v}</button>`).join('')}</div>
        <button class="btn primary big" data-a="save">🎯 Publicar missão</button>
      </div>`);
    const pick = sh.querySelector('.m-pick');
    const draw = () => {
      pick.innerHTML = foto
        ? `<div class="m-photo" style="background-image:url('${foto}')"><button class="m-redo" data-a="nofoto" aria-label="Trocar foto">${ICON.x}</button></div>`
        : `<div class="pick"><label>📷<small>Câmera</small><input type="file" accept="image/*" capture="environment"></label>
            <label>🖼️<small>Galeria</small><input type="file" accept="image/*"></label></div>`;
      pick.querySelectorAll('input[type=file]').forEach(inp => {
        inp.onchange = async () => {
          const f = inp.files[0];
          if (!f) return;
          try { foto = await compressImage(f); draw(); } catch { toast('⚠️ Não consegui abrir essa foto', true); }
        };
      });
    };
    draw();
    sh.onclick = async e => {
      const tp = e.target.closest('[data-t]');
      if (tp) { tipo = tp.dataset.t; sh.querySelectorAll('[data-t]').forEach(b => b.classList.toggle('on', b === tp)); return; }
      const q = e.target.closest('[data-q]');
      if (q) {
        sh.querySelector('[name=valor]').value = q.dataset.q;
        sh.querySelectorAll('[data-q]').forEach(b => b.classList.toggle('on', b === q));
        return;
      }
      const b = e.target.closest('[data-a]');
      if (!b || enviando) return;
      if (b.dataset.a === 'close') return closeSheet();
      if (b.dataset.a === 'nofoto') { foto = null; return draw(); }
      if (b.dataset.a !== 'save') return;
      const valor = parseMoney(sh.querySelector('[name=valor]').value);
      if (!foto) return toast('📷 Tire uma foto do que precisa ser feito', true);
      if (!(valor >= 1 && valor <= 10000)) return toast('O valor precisa ser de R$ 0,01 a R$ 100,00', true);
      enviando = true;
      b.disabled = true;
      b.innerHTML = '<div class="spin sm"></div>';
      try {
        await api('missaoCriar', { titulo: sh.querySelector('[name=titulo]').value.trim(), valor, tipo, foto: splitDataUrl(foto) });
        closeSheet();
        done('Missão publicada!');
        load(true);
      } catch (err) {
        enviando = false;
        b.disabled = false;
        b.textContent = '🎯 Publicar missão';
        toast('⚠️ ' + err.message, true);
      }
    };
  }

  // ------------------------------------------------------------ COFRINHO + META
  // O servidor credita o rendimento uma vez por dia (juros compostos); aqui anima o pedaço do dia que já passou,
  // então o valor sobe sem parar na tela e bate com o crédito de amanhã.
  const fracDia = () => {
    const n = new Date();
    return (n - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5;
  };
  const cofreDe = k => user(k).stats?.cofre || { saldo: 0, rendido: 0 };
  function cofreAoVivo(k) {
    const c = cofreDe(k);
    const ganho = c.saldo * (Math.pow(1 + (S.data?.taxas?.dia || 0), fracDia()) - 1);
    return { saldo: c.saldo + ganho, rend: c.rendido + ganho };
  }
  const reaisCasas = (cents, casas) => (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
  // valor do cofrinho: centavos normais em destaque e as casas que estão "sendo geradas" apagadinhas
  const fmtCofre = cents => {
    const s = reaisCasas(cents, 7);
    return `R$ ${s.slice(0, -5)}<small>${s.slice(-5)}</small>`;
  };
  const pct = x => (x * 100).toLocaleString('pt-BR', { maximumFractionDigits: 2 }) + '%';

  setInterval(() => {
    if (document.visibilityState !== 'visible' || !S.data) return;
    document.querySelectorAll('[data-live]').forEach(el => {
      const v = cofreAoVivo(el.dataset.k);
      el.innerHTML = el.dataset.live === 'saldo' ? fmtCofre(v.saldo) : `+ R$ ${reaisCasas(v.rend, 8)}`;
    });
  }, 90);

  const metaDe = k => {
    const id = user(k).meta_item;
    return id ? S.data.loja.find(i => i.id === id) || null : null;
  };
  function metaProgresso(k) {
    const it = metaDe(k);
    if (!it) return null;
    const tem = (user(k).stats?.saldo || 0) + Math.floor(cofreDe(k).saldo + 1e-9);
    return { it, tem, falta: Math.max(0, it.preco - tem), pct: Math.min(100, Math.round(tem / it.preco * 100)) };
  }

  // carteira: saldo, Pix, cofrinho (gerador ao vivo), meta, projeção, extrato e ranking — todo o dinheiro numa página
  function carteira() {
    const st = user(S.me).stats || {};
    const c = cofreDe(S.me);
    const t = S.data.taxas || { ano: 0, cdiAno: 0, dia: 0 };
    const mp = metaProgresso(S.me);
    const ext = S.data.extrato || [];
    const ap = S.aporte || 100;
    // três partes, uma de cada vez, para cada uma caber na tela sem rolar
    const sub = S.cart || 'saldo';
    const seg = `<div class="seg cart-seg">${[['saldo', '💰', 'Saldo'], ['cofre', '🐷', 'Cofrinho'], ['rank', '🏆', 'Ranking']].map(([k, e, t]) =>
      `<button class="${sub === k ? 'on' : ''}" onclick="A.cart('${k}')">${e}<span>${t}</span></button>`).join('')}</div>`;
    if (sub === 'rank') return seg + rankView();
    if (sub === 'cofre') return `${seg}
      <div class="card cofre-box">
        <div class="gerador ${c.saldo > 0 ? 'on' : ''}">
          <div class="g-top"><small>No cofrinho</small><div class="g-val mono" data-live="saldo" data-k="${S.me}">${fmtCofre(c.saldo)}</div></div>
          <div class="g-maquina"><div class="g-moedas">${'<i>🪙</i>'.repeat(5)}</div><div class="porco big ${c.saldo > 0 ? 'vivo' : ''}">🐷</div></div>
          <div class="g-bot"><small>Já rendeu</small><div class="g-gen mono" data-live="rend" data-k="${S.me}">+ R$ ${reaisCasas(c.rendido, 8)}</div></div>
        </div>
        <p class="note" style="text-align:center">${c.saldo > 0
          ? `Rende uns <b class="mono">R$ ${reaisCasas(c.saldo * t.dia, 4)}</b> por dia sozinho`
          : 'Guarde um pouco do saldo e veja ele crescer sozinho, todo dia.'} · ${pct(t.ano)} ao ano</p>
        <div class="duo"><button class="btn ok" onclick="A.cofre('guardar')">⬇️ Guardar</button>
          <button class="btn" onclick="A.cofre('retirar')" ${c.saldo >= 1 ? '' : 'disabled'}>⬆️ Tirar</button></div>
      </div>
      ${sectionTitle('📈', 'Se continuar guardando')}
      <div class="quick" data-aps>${[50, 100, 200, 500].map(v => `<button class="${v === ap ? 'on' : ''}" onclick="A.aporte(${v})">${brl(v)}/sem</button>`).join('')}</div>
      <div data-proj style="margin-top:10px">${graficoCofre(ap)}</div>`;
    return `${seg}
      <div class="balance static">
        <div class="lbl">💰 <span class="eyebrow">Saldo</span>
          <button class="pix-btn" onclick="A.pix()" aria-label="Pix">${ICON.pix}<span>Pix</span></button></div>
        <div class="val" data-count="${st.saldo || 0}" data-key="saldo">${brl(st.saldo)}</div>
        <div class="foot"><span>📅 Semana <span class="mono">${brl(st.semana)}</span></span><span>🗓️ Mês <span class="mono">${brl(st.mes)}</span></span></div>
      </div>

      ${sectionTitle('🎯', 'Minha meta')}
      ${mp ? `<button class="card meta-card" onclick="A.meta()">
          <div class="pic" ${mp.it.imagem_id ? `data-media="${mp.it.imagem_id}"` : ''}><span>${esc(mp.it.emoji || '🎁')}</span></div>
          <div class="grow"><div style="font-weight:700">${esc(mp.it.nome || 'Mercadinho')} · <span class="mono">${brl(mp.it.preco)}</span></div>
            <div class="progress" style="margin:8px 0 6px"><i style="width:${mp.pct}%"></i></div>
            <div class="muted small">${mp.falta ? `Faltam <b class="mono">${brl(mp.falta)}</b> (saldo + cofrinho)` : '🎉 Você já consegue comprar!'}</div></div>
          <span class="muted">${ICON.chevron}</span></button>`
        : `<button class="card meta-vazia" onclick="A.meta()">🎯 <span class="grow">Escolha um prêmio da loja para juntar dinheiro</span>${ICON.chevron}</button>`}

      ${sectionTitle('🧾', 'Últimas movimentações')}
      ${ext.length ? `<div class="card ext-card"><div class="ext-list">${ext.slice(0, 4).map(extratoLinha).join('')}</div>
          ${ext.length > 4 ? `<button class="btn ghost" style="width:100%" onclick="A.extrato()">Ver extrato completo</button>` : ''}</div>`
        : '<div class="empty" style="padding:20px">🧾 Nada por aqui ainda</div>'}`;
  }

  function cofreSheet(modo = 'guardar') {
    const saldo = user(S.me).stats?.saldo || 0;
    const noCofre = Math.floor(cofreDe(S.me).saldo + 1e-9);
    const guardar = modo === 'guardar';
    const disp = guardar ? saldo : noCofre;
    let enviando = false;
    const sh = openSheet(`
      <h2>${guardar ? '⬇️ Guardar no cofrinho' : '⬆️ Tirar do cofrinho'}${CLOSE}</h2>
      <div class="money-in big-money"><span>R$</span><input name="v" inputmode="decimal" placeholder="0,00"></div>
      <div class="quick">${['0,50', '1,00', '2,00', '5,00'].map(v => `<button data-q="${v}">${v}</button>`).join('')}<button data-q="${centsStr(disp)}">tudo</button></div>
      <div class="muted small mono" style="text-align:center;margin:10px 0">${guardar ? `💰 Saldo: ${brl(saldo)}` : `🐷 Dá para tirar: ${brl(noCofre)}`}</div>
      <button class="btn big ${guardar ? 'ok' : 'primary'}" style="width:100%" data-a="send">${guardar ? '⬇️ Guardar' : '⬆️ Tirar para o saldo'}</button>`);
    sh.onclick = async e => {
      if (enviando) return;
      const q = e.target.closest('[data-q]');
      if (q) { sh.querySelector('[name=v]').value = q.dataset.q; return; }
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'close') return closeSheet();
      const valor = parseMoney(sh.querySelector('[name=v]').value);
      if (!(valor >= 1)) return toast('Digite o valor', true);
      if (valor > disp) return toast(guardar ? '🔒 Saldo: ' + brl(saldo) : '🐷 O cofrinho tem ' + brl(noCofre), true);
      enviando = true;
      b.disabled = true;
      b.innerHTML = '<div class="spin sm"></div>';
      try {
        await api(guardar ? 'cofreGuardar' : 'cofreRetirar', { valor });
        closeSheet();
        if (guardar) confetti(['🐷', '🪙', '✨']);
        done(guardar ? `${brl(valor)} no cofrinho` : `${brl(valor)} no saldo`);
        load(true);
      } catch (err) {
        enviando = false;
        b.disabled = false;
        b.textContent = guardar ? '⬇️ Guardar' : '⬆️ Tirar para o saldo';
        toast('⚠️ ' + err.message, true);
      }
    };
  }

  function metaSheet() {
    const atual = user(S.me).meta_item;
    const sh = openSheet(`
      <h2>🎯 Escolher meta${CLOSE}</h2>
      <p class="lead">Escolha o que quer juntar dinheiro para comprar. O progresso soma saldo + cofrinho.</p>
      ${S.data.loja.length ? `<div class="shop">${S.data.loja.map(it => `<button class="card item ${it.id === atual ? 'meta-on' : ''}" data-meta-id="${it.id}">
          <div class="pic" ${it.imagem_id ? `data-media="${it.imagem_id}"` : ''}><span>${esc(it.emoji || '🎁')}</span><b class="pr-tag mono">${brl(it.preco)}</b></div>
          ${it.nome ? `<div class="body"><div class="nm">${esc(it.nome)}</div></div>` : ''}</button>`).join('')}</div>`
        : '<div class="empty">🏪 A loja está vazia</div>'}
      ${atual ? '<button class="btn ghost mt" style="width:100%" data-meta-id="">Tirar meta</button>' : ''}`);
    hydrate(sh);
    sh.onclick = async e => {
      if (e.target.closest('[data-a=close]')) return closeSheet();
      const mt = e.target.closest('[data-meta-id]');
      if (!mt) return;
      mt.disabled = true;
      try {
        await api('setMeta', { itemId: mt.dataset.metaId });
        user(S.me).meta_item = mt.dataset.metaId;
        closeSheet();
        toast(mt.dataset.metaId ? '🎯 Meta escolhida' : 'Meta removida');
        render();
        load(true);
      } catch (err) { mt.disabled = false; toast('⚠️ ' + err.message, true); }
    };
  }

  // ------------------------------------------------------------ TAREFAS FIXAS
  // Repetem nos dias marcados; cada irmão manda uma vez por dia e o valor já vem preenchido na avaliação.
  const DIAS = ['', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
  const hojeDow = () => { const d = new Date().getDay(); return String(d === 0 ? 7 : d); };
  const diasTxt = s => (s === '1234567' ? 'Todo dia' : s === '12345' ? 'Seg a sex' : s === '67' ? 'Fim de semana' : s.split('').map(d => DIAS[d]).join(', '));
  const mesmoDia = iso => new Date(iso).toDateString() === new Date().toDateString();
  const tarefa = id => (S.data.tarefas || []).find(t => t.id === id);
  const relTarefaHoje = id => S.data.relatos.find(r => r.tarefa_id === id && r.usuario === S.me && mesmoDia(r.criado_em));
  const tarefasHoje = () => (S.data.tarefas || []).filter(t => (t.para === 'ambos' || t.para === S.me) && String(t.dias).includes(hojeDow()));
  const tarefasFaltando = () => tarefasHoje().filter(t => !relTarefaHoje(t.id)).length;

  function tarefasKid() {
    const ts = tarefasHoje();
    if (!ts.length) return '';
    const feitas = ts.filter(t => relTarefaHoje(t.id)).length;
    return `${sectionTitle('📋', 'Tarefas de hoje', `${feitas}/${ts.length}`)}
      <div class="card tarefas">${ts.map(t => {
        const r = relTarefaHoje(t.id);
        const st = !r ? '<span class="m-go">📸 Fazer</span>'
          : r.status === 'aprovado' ? '<span class="t-ok" aria-label="Feita">✓</span>'
          : r.status === 'refazer' ? '<span class="badge refazer"><span class="live"></span>Refazer</span>'
          : '<span class="badge pendente"><span class="live"></span>Esperando</span>';
        return `<button class="t-row ${r?.status === 'aprovado' ? 'feita' : ''}" onclick="A.tarefa('${t.id}')">
          <span class="t-emo">${esc(t.emoji || '✅')}</span>
          <span class="grow"><b>${esc(t.titulo)}</b><small class="mono">${brl(t.valor)}</small></span>${st}</button>`;
      }).join('')}</div>`;
  }

  function adminTarefas() {
    const ts = S.data.tarefas || [];
    return `${sectionTitle('📋', 'Tarefas fixas', ts.length || null)}
      <p class="note" style="margin-top:-4px">Aparecem nos dias marcados, no Início de quem você escolher. Cada um manda uma vez por dia.</p>
      ${ts.length ? `<div class="list mt">${ts.map(t => `<button class="card t-adm" onclick="A.editTarefa('${t.id}')">
        <span class="t-emo">${esc(t.emoji || '✅')}</span>
        <span class="grow"><b>${esc(t.titulo)}</b><small>${diasTxt(String(t.dias))} · ${t.para === 'ambos' ? 'Os dois' : esc(user(t.para).nome)}</small></span>
        <b class="mono">${brl(t.valor)}</b></button>`).join('')}</div>` : ''}
      <button class="btn mt" onclick="A.editTarefa()">➕ Nova tarefa fixa</button>`;
  }

  function tarefaSheet(id) {
    const t = id ? tarefa(id) : { titulo: '', emoji: '🛏️', valor: 0, dias: '1234567', para: 'ambos' };
    let dias = String(t.dias), para = t.para, enviando = false;
    const sh = openSheet(`
      <h2>${id ? '✏️ Editar tarefa' : '📋 Nova tarefa fixa'}${CLOSE}</h2>
      <div class="list">
        <div class="row">
          <div class="field" style="width:84px"><label>Emoji</label><input class="input" name="emoji" value="${esc(t.emoji)}" style="text-align:center;font-size:22px"></div>
          <div class="field grow"><label>Tarefa</label><input class="input" name="titulo" maxlength="60" value="${esc(t.titulo)}" placeholder="Ex.: arrumar a cama"></div>
        </div>
        <div class="field"><label>Quanto vale (por dia)</label><div class="money-in"><span>R$</span><input name="valor" inputmode="decimal" value="${t.valor ? centsStr(t.valor) : ''}" placeholder="0,00"></div></div>
        <div class="field"><label>Dias</label><div class="dias">${[1, 2, 3, 4, 5, 6, 7].map(d =>
          `<button class="${dias.includes(d) ? 'on' : ''}" data-d="${d}">${DIAS[d]}</button>`).join('')}</div></div>
        <div class="field"><label>Para quem</label><div class="seg inline">${[['ambos', 'Os dois'], ...KIDS.map(k => [k, user(k).nome])].map(([k, n]) =>
          `<button class="${para === k ? 'on' : ''}" data-p="${k}">${k === 'ambos' ? '👥' : avatar(k, 'xs')}${esc(n)}</button>`).join('')}</div></div>
        <div class="row mt">${id ? '<button class="btn danger" data-a="del">🗑️ Remover</button>' : ''}
          <button class="btn primary grow big" data-a="save">💾 Salvar</button></div>
      </div>`);
    sh.onclick = async e => {
      const d = e.target.closest('[data-d]');
      if (d) {
        dias = dias.includes(d.dataset.d) ? dias.replace(d.dataset.d, '') : [...dias + d.dataset.d].sort().join('');
        d.classList.toggle('on', dias.includes(d.dataset.d));
        return;
      }
      const p = e.target.closest('[data-p]');
      if (p) { para = p.dataset.p; sh.querySelectorAll('[data-p]').forEach(b => b.classList.toggle('on', b === p)); return; }
      const b = e.target.closest('[data-a]');
      if (!b || enviando) return;
      const a = b.dataset.a;
      if (a === 'close') return closeSheet();
      if (a === 'del' && !b.classList.contains('armed')) { b.classList.add('armed'); b.textContent = 'Toque de novo para remover'; return; }
      const val = n => sh.querySelector(`[name=${n}]`).value.trim();
      const valor = parseMoney(val('valor'));
      if (a === 'save') {
        if (!val('titulo')) return toast('Dê um nome para a tarefa', true);
        if (!(valor >= 1 && valor <= 1000)) return toast('O valor precisa ser de R$ 0,01 a R$ 10,00', true);
        if (!dias) return toast('Escolha pelo menos um dia', true);
      }
      enviando = true;
      b.disabled = true;
      try {
        if (a === 'del') await api('tarefaRemover', { id });
        else await api('tarefaSalvar', { tarefa: { id: id || '', titulo: val('titulo'), emoji: val('emoji'), valor, dias, para } });
        closeSheet();
        toast(a === 'del' ? 'Tarefa removida' : 'Tarefa salva ✅');
        load(true);
      } catch (err) { enviando = false; b.disabled = false; toast('⚠️ ' + err.message, true); }
    };
  }

  // ------------------------------------------------------------ PRESENTE DO PAI
  function presenteSheet() {
    let para = 'ambos', confirmando = 0, enviando = false;
    const chave = novaChave();
    const sh = openSheet(`
      <h2>🎁 Presente surpresa${CLOSE}</h2>
      <div class="seg inline">${[['ambos', 'Os dois'], ...KIDS.map(k => [k, user(k).nome])].map(([k, n]) =>
        `<button class="${para === k ? 'on' : ''}" data-p="${k}">${k === 'ambos' ? '👥' : avatar(k, 'xs')}${esc(n)}</button>`).join('')}</div>
      <div class="money-in big-money mt"><span>R$</span><input name="v" inputmode="decimal" placeholder="0,00"></div>
      <div class="quick">${['1,00', '2,00', '5,00', '10,00', '20,00'].map(v => `<button data-q="${v}">${v}</button>`).join('')}</div>
      <div class="field mt"><label>Mensagem (opcional)</label><textarea class="input" name="msg" rows="2" maxlength="300" placeholder="Ex.: Orgulho de vocês!"></textarea></div>
      <p class="note" data-hint>Com "Os dois", o valor é para cada um. Chega com uma caixa de presente para abrir.</p>
      <button class="btn big primary mt" style="width:100%" data-a="send">🎁 Enviar presente</button>`);
    const btn = sh.querySelector('[data-a=send]');
    const reset = () => { confirmando = 0; btn.classList.remove('armed'); btn.innerHTML = '🎁 Enviar presente'; };
    sh.querySelector('[name=v]').oninput = () => !enviando && reset();
    sh.onclick = async e => {
      if (enviando) return;
      const p = e.target.closest('[data-p]');
      if (p) { para = p.dataset.p; sh.querySelectorAll('[data-p]').forEach(b => b.classList.toggle('on', b === p)); return reset(); }
      const q = e.target.closest('[data-q]');
      if (q) { sh.querySelector('[name=v]').value = q.dataset.q; return reset(); }
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'close') return closeSheet();
      const valor = parseMoney(sh.querySelector('[name=v]').value);
      if (!(valor >= 1)) return toast('Digite o valor', true);
      if (confirmando !== valor) {
        confirmando = valor;
        b.classList.add('armed');
        b.textContent = `✓ Confirmar ${brl(valor)} ${para === 'ambos' ? 'para cada um' : 'para ' + user(para).nome}`;
        return;
      }
      enviando = true;
      b.disabled = true;
      b.innerHTML = '<div class="spin sm"></div>';
      try {
        await api('presente', { para, valor, texto: sh.querySelector('[name=msg]').value.trim(), chave });
        closeSheet();
        confetti(['🎁', '❤️', '✨']);
        done('Presente enviado!');
        load(true);
      } catch (err) { enviando = false; b.disabled = false; reset(); toast('⚠️ ' + err.message, true); }
    };
  }

  // a criança vê o presente como uma caixa para abrir (uma vez por presente, guardado neste aparelho)
  const presKey = () => 'mesada-presentes-' + S.me;
  function checarPresentes() {
    if (S.me === ADMIN || document.querySelector('.gift')) return;
    let vistos;
    try { vistos = JSON.parse(localStorage.getItem(presKey())) || []; } catch { vistos = []; }
    const m = S.chat.msgs.find(x => x.tipo === 'presente' && !vistos.includes(x.id)
      && Date.now() - new Date(x.criado_em) < 3 * 864e5 && ['ambos', S.me].includes(String(x.ref).split(':')[0]));
    if (!m) return;
    const v = Number(String(m.ref).split(':')[1]) || 0;
    const g = document.createElement('div');
    g.className = 'gift';
    g.innerHTML = `<div class="gift-box">🎁</div><b>Presente do ${esc(user(ADMIN).nome)}!</b><span class="muted">Toque para abrir</span>`;
    g.onclick = () => {
      if (g.classList.contains('aberto')) return g.remove();
      g.classList.add('aberto');
      try { localStorage.setItem(presKey(), JSON.stringify([...vistos, m.id].slice(-60))); } catch { /* sem storage: mostra de novo */ }
      g.innerHTML = `<div class="gift-val mono">+ ${brl(v)}</div>${m.texto ? `<p class="gift-msg">“${esc(m.texto)}”</p>` : ''}
        <span class="muted">— ${esc(user(ADMIN).nome)} · toque para fechar</span>`;
      confetti(['🎁', '💰', '🎉', '✨', '❤️']);
      navigator.vibrate?.([40, 60, 40]);
    };
    document.body.appendChild(g);
  }

  // ------------------------------------------------------------ MULTAS
  function multaSheet() {
    let para = KIDS[0], foto = null, confirmando = '', enviando = false;
    const sh = openSheet(`
      <h2>⚠️ Multa${CLOSE}</h2>
      <div class="seg inline">${KIDS.map(k => `<button class="${k === para ? 'on' : ''}" data-p="${k}">${avatar(k, 'xs')}${esc(user(k).nome)}</button>`).join('')}</div>
      <div class="m-pick mt" data-foto></div>
      <div class="list mt">
        <div class="field"><label>Motivo</label><input class="input" name="motivo" maxlength="120" placeholder="Ex.: toalha molhada em cima da cama"></div>
        <div class="field"><label>Valor</label><div class="money-in"><span>R$</span><input name="v" inputmode="decimal" placeholder="0,00"></div></div>
        <div class="quick">${['0,10', '0,25', '0,50', '1,00', '2,00'].map(v => `<button data-q="${v}">${v}</button>`).join('')}</div>
        <button class="btn big danger solid" data-a="send">⚠️ Aplicar multa</button>
      </div>
      ${multasRecentes()}`);
    const box = sh.querySelector('[data-foto]');
    const drawFoto = () => {
      box.innerHTML = foto
        ? `<div class="m-photo" style="background-image:url('${foto}')"><button class="m-redo" data-a="nofoto" aria-label="Tirar foto">${ICON.x}</button></div>`
        : `<div class="row"><label class="btn grow">📷 Foto (opcional)<input type="file" accept="image/*" capture="environment" hidden></label>
            <label class="btn grow">🖼️ Galeria<input type="file" accept="image/*" hidden></label></div>`;
      box.querySelectorAll('input[type=file]').forEach(inp => {
        inp.onchange = async () => {
          const f = inp.files[0];
          if (!f) return;
          try { foto = await compressImage(f); drawFoto(); } catch { toast('⚠️ Não consegui abrir essa foto', true); }
        };
      });
    };
    drawFoto();
    const btn = sh.querySelector('[data-a=send]');
    const reset = () => { confirmando = ''; btn.classList.remove('armed'); btn.textContent = '⚠️ Aplicar multa'; };
    sh.querySelector('[name=v]').oninput = () => !enviando && reset();
    sh.onclick = async e => {
      if (enviando) return;
      const p = e.target.closest('[data-p]');
      if (p) { para = p.dataset.p; sh.querySelectorAll('[data-p]').forEach(b => b.classList.toggle('on', b === p)); return reset(); }
      const q = e.target.closest('[data-q]');
      if (q) { sh.querySelector('[name=v]').value = q.dataset.q; return reset(); }
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'close') return closeSheet();
      if (b.dataset.a === 'nofoto') { foto = null; return drawFoto(); }
      if (b.dataset.a !== 'send') return;
      const motivo = sh.querySelector('[name=motivo]').value.trim();
      const valor = parseMoney(sh.querySelector('[name=v]').value);
      if (!motivo) return toast('Escreva o motivo', true);
      if (!(valor >= 1 && valor <= 1000)) return toast('A multa precisa ser de R$ 0,01 a R$ 10,00', true);
      const assinatura = para + valor;
      if (confirmando !== assinatura) {
        confirmando = assinatura;
        b.classList.add('armed');
        b.textContent = `✓ Confirmar: ${user(para).nome} perde ${brl(valor)}`;
        return;
      }
      enviando = true;
      b.disabled = true;
      b.innerHTML = '<div class="spin sm"></div>';
      try {
        await api('multa', { para, valor, motivo, foto: foto ? splitDataUrl(foto) : null });
        closeSheet();
        done('Multa aplicada');
        load(true);
      } catch (err) { enviando = false; b.disabled = false; reset(); toast('⚠️ ' + err.message, true); }
    };
  }

  function multasRecentes() {
    const ms = (S.data.multas || []).slice(0, 10);
    if (!ms.length) return '';
    return `${sectionTitle('📜', 'Últimas multas')}<div class="ext-list">${ms.map(m => `
      <div class="ext-row">${avatar(m.usuario, 'xs')}
        <div class="grow"><div class="t">${esc(m.motivo)}</div><div class="d">${quando(m.criado_em)} · ${brl(m.valor)}</div></div>
        ${m.status === 'aplicada' ? `<button class="btn" style="min-height:36px;padding:6px 10px;font-size:13px" onclick="A.perdoar('${m.id}', this)">🤝 Perdoar</button>`
          : '<span class="badge cancelado">perdoada</span>'}</div>`).join('')}</div>`;
  }

  // ------------------------------------------------------------ LEILÃO
  // O lance fica reservado do saldo; quem é coberto recebe de volta na hora. Lance nos 2 min finais prorroga.
  const leilao = id => (S.data.leiloes || []).find(l => l.id === id);
  const agoraSrv = () => Date.now() + (S.skew || 0);
  const restante = fim => {
    const ms = new Date(fim) - agoraSrv();
    if (ms <= 0) return 'encerrando…';
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60);
    return d ? `${d}d ${h}h` : h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m ${String(s % 60).padStart(2, '0')}s`;
  };
  const proxLance = l => (l.lider ? l.lance + 10 : l.lance_min);

  setInterval(() => {
    if (document.visibilityState !== 'visible' || !S.data) return;
    let acabou = false;
    document.querySelectorAll('[data-fim]').forEach(el => {
      const txt = restante(el.dataset.fim);
      if (txt === 'encerrando…') acabou = true;
      el.textContent = (el.classList.contains('l-timer') ? '⏱ ' : '') + txt;
    });
    // terminou na tela: busca o resultado (no máximo a cada 15 s)
    if (acabou && !S.fetching && Date.now() - (S.fimLoad || 0) > 15000) { S.fimLoad = Date.now(); load(true); }
  }, 1000);

  function leilaoCard(l, admin) {
    const aberto = l.status === 'aberto';
    const lid = l.lider && user(l.lider);
    let acao = '';
    if (admin) acao = aberto ? `<button class="btn danger" style="min-height:38px;font-size:13px" onclick="A.leilaoCancelar('${l.id}', this)">Cancelar leilão</button>` : '';
    else if (aberto) acao = l.lider === S.me ? '<span class="l-win">🏆 Você está ganhando</span>' : `<button class="btn primary" onclick="A.lance('${l.id}')">🔨 Dar lance</button>`;
    return `<div class="card item leilao ${aberto ? '' : 'fim'}">
      <div class="pic" ${l.foto_id ? `data-media="${l.foto_id}"` : ''}><span>${esc(l.emoji || '🎁')}</span>
        ${aberto ? `<b class="l-timer mono" data-fim="${l.fim}">⏱ ${restante(l.fim)}</b>` : '<b class="l-timer">Encerrado</b>'}</div>
      <div class="body">
        <div class="nm">${esc(l.nome)}</div>
        ${aberto
          ? lid ? `<div class="l-lider">${avatar(l.lider, 'xs')}<b class="mono">${brl(l.lance)}</b><span class="muted small">${l.lider === S.me ? 'seu lance' : 'na frente'}</span></div>`
            : `<div class="muted small">Lance inicial <b class="mono">${brl(l.lance_min)}</b></div>`
          : lid ? `<div class="l-lider">🏆 ${avatar(l.lider, 'xs')}<b>${esc(lid.nome)}</b><span class="mono muted small">${brl(l.lance)}</span></div>`
            : '<div class="muted small">Ninguém deu lance</div>'}
        ${acao}
      </div></div>`;
  }

  function leiloesKid() {
    const ls = S.data.leiloes || [];
    if (!ls.length) return '';
    return `${sectionTitle('🔨', 'Leilão', ls.filter(l => l.status === 'aberto').length || null)}
      <div class="shop">${ls.map(l => leilaoCard(l)).join('')}</div>`;
  }

  function lanceSheet(id) {
    const l = leilao(id);
    if (!l) return;
    const saldo = user(S.me).stats?.saldo || 0;
    const min = proxLance(l);
    let confirmando = 0, enviando = false;
    const sh = openSheet(`
      <h2>🔨 ${esc(l.nome)}${CLOSE}</h2>
      <div class="l-head">
        <div><small>${l.lider ? 'Maior lance' : 'Lance inicial'}</small><b class="mono">${brl(l.lider ? l.lance : l.lance_min)}</b>${l.lider ? avatar(l.lider, 'xs') : ''}</div>
        <div><small>Termina em</small><b class="mono" data-fim="${l.fim}">${restante(l.fim)}</b></div>
      </div>
      <div class="money-in big-money mt"><span>R$</span><input name="v" inputmode="decimal" value="${centsStr(min)}"></div>
      <div class="quick">${[min, min + 50, min + 100, min + 200].map(v => `<button data-q="${centsStr(v)}">${centsStr(v)}</button>`).join('')}</div>
      <p class="note" style="text-align:center">💰 Saldo: <b class="mono">${brl(saldo)}</b><br>O lance fica guardado. Se alguém cobrir, ele volta para você na hora.</p>
      <button class="btn big primary" style="width:100%" data-a="send">🔨 Dar lance</button>`);
    const btn = sh.querySelector('[data-a=send]');
    const reset = () => { confirmando = 0; btn.classList.remove('armed'); btn.innerHTML = '🔨 Dar lance'; };
    sh.querySelector('[name=v]').oninput = () => !enviando && reset();
    sh.onclick = async e => {
      if (enviando) return;
      const q = e.target.closest('[data-q]');
      if (q) { sh.querySelector('[name=v]').value = q.dataset.q; return reset(); }
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'close') return closeSheet();
      const valor = parseMoney(sh.querySelector('[name=v]').value);
      if (!(valor >= min)) return toast('O lance mínimo é ' + brl(min), true);
      if (valor > saldo) return toast('🔒 Saldo: ' + brl(saldo), true);
      if (confirmando !== valor) {
        confirmando = valor;
        b.classList.add('armed');
        b.textContent = `✓ Confirmar lance de ${brl(valor)}`;
        navigator.vibrate?.(20);
        return;
      }
      enviando = true;
      b.disabled = true;
      b.innerHTML = '<div class="spin sm"></div>';
      try {
        await api('lance', { id, valor });
        closeSheet();
        confetti(['🔨', '💰', '✨']);
        done('Lance dado!');
        load(true);
      } catch (err) { enviando = false; b.disabled = false; reset(); toast('⚠️ ' + err.message, true); load(true); }
    };
  }

  function novoLeilao() {
    let foto = null, horas = 24, enviando = false;
    const sh = openSheet(`
      <h2>🔨 Novo leilão${CLOSE}</h2>
      <div class="m-pick" data-foto></div>
      <div class="list mt">
        <div class="row">
          <div class="field" style="width:84px"><label>Emoji</label><input class="input" name="emoji" value="🎁" style="text-align:center;font-size:22px"></div>
          <div class="field grow"><label>Item</label><input class="input" name="nome" maxlength="60" placeholder="Ex.: sorvete no sábado"></div>
        </div>
        <div class="field"><label>Lance inicial</label><div class="money-in"><span>R$</span><input name="min" inputmode="decimal" placeholder="0,00"></div></div>
        <div class="field"><label>Duração</label><div class="seg inline">${[[1, '1 hora'], [3, '3 horas'], [24, '1 dia'], [72, '3 dias']].map(([h, t]) =>
          `<button class="${h === horas ? 'on' : ''}" data-h="${h}">${t}</button>`).join('')}</div></div>
        <p class="note">Os dois dão lances com o saldo. Quem estiver na frente no fim leva — o item vai para a mochila como pedido. Lance nos 2 minutos finais prorroga o fim.</p>
        <button class="btn primary big" data-a="save">🔨 Abrir leilão</button>
      </div>`);
    const box = sh.querySelector('[data-foto]');
    const drawFoto = () => {
      box.innerHTML = foto
        ? `<div class="m-photo" style="background-image:url('${foto}')"><button class="m-redo" data-a="nofoto" aria-label="Tirar foto">${ICON.x}</button></div>`
        : `<div class="row"><label class="btn grow">📷 Foto (opcional)<input type="file" accept="image/*" capture="environment" hidden></label>
            <label class="btn grow">🖼️ Galeria<input type="file" accept="image/*" hidden></label></div>`;
      box.querySelectorAll('input[type=file]').forEach(inp => {
        inp.onchange = async () => {
          const f = inp.files[0];
          if (!f) return;
          try { foto = await compressImage(f, 900, .75); drawFoto(); } catch { toast('⚠️ Não consegui abrir essa foto', true); }
        };
      });
    };
    drawFoto();
    sh.onclick = async e => {
      const h = e.target.closest('[data-h]');
      if (h) { horas = Number(h.dataset.h); sh.querySelectorAll('[data-h]').forEach(x => x.classList.toggle('on', x === h)); return; }
      const b = e.target.closest('[data-a]');
      if (!b || enviando) return;
      if (b.dataset.a === 'close') return closeSheet();
      if (b.dataset.a === 'nofoto') { foto = null; return drawFoto(); }
      const nome = sh.querySelector('[name=nome]').value.trim();
      const lanceMin = parseMoney(sh.querySelector('[name=min]').value);
      if (!nome) return toast('Dê um nome para o item', true);
      if (!(lanceMin >= 1)) return toast('Digite o lance inicial', true);
      enviando = true;
      b.disabled = true;
      b.innerHTML = '<div class="spin sm"></div>';
      try {
        await api('leilaoCriar', { nome, emoji: sh.querySelector('[name=emoji]').value.trim(), lanceMin, horas, foto: foto ? splitDataUrl(foto) : null });
        closeSheet();
        done('Leilão aberto!');
        load(true);
      } catch (err) { enviando = false; b.disabled = false; b.textContent = '🔨 Abrir leilão'; toast('⚠️ ' + err.message, true); }
    };
  }

  // ------------------------------------------------------------ GRÁFICOS (SVG à mão)
  // Uma cor por irmão, fixa (nunca pela posição no ranking). Tons validados para o fundo escuro.
  const SERIE_COR = { cesar: '#3b82f6', arthur: '#16a34a' };
  const ddmm = iso => iso.slice(8, 10) + '/' + iso.slice(5, 7);
  const brlEixo = c => 'R$ ' + (c / 100).toLocaleString('pt-BR', { maximumFractionDigits: c % 100 ? 2 : 0 });
  const niceMax = v => {
    if (!(v > 0)) return 100;
    const p = Math.pow(10, Math.floor(Math.log10(v)));
    return [1, 2, 2.5, 5, 10].map(m => m * p).find(x => x >= v);
  };
  // barra com o topo arredondado e a base reta no eixo
  const barra = (x, y, w, h, r = 3) => {
    if (h < .5) return '';
    r = Math.min(r, w / 2, h);
    return `M${x},${y + h}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + h}Z`;
  };

  function graficoSemanas() {
    const ini = user(KIDS[0]).stats?.semanasIni;
    if (!ini) return '';
    const W = 340, H = 180, L = 46, R = 6, T = 12, B = 24, n = ini.length;
    const vals = KIDS.map(k => user(k).stats?.semanas || []);
    const max = niceMax(Math.max(...vals.flat()));
    const gw = (W - L - R) / n, bw = Math.min(14, (gw - 10) / 2);
    const y = v => T + (H - T - B) * (1 - v / max);
    let g = '';
    [0, .5, 1].forEach(f => {
      g += `<line x1="${L}" x2="${W - R}" y1="${y(max * f)}" y2="${y(max * f)}" class="ch-grid"/>
        <text x="${L - 6}" y="${y(max * f) + 4}" class="ch-ax" text-anchor="end">${brlEixo(max * f)}</text>`;
    });
    g += `<rect class="ch-hl" x="${L + gw * (n - 1)}" y="${T}" width="${gw}" height="${H - T - B}" rx="6"/>`;
    ini.forEach((d, i) => {
      const cx = L + gw * i + gw / 2;
      KIDS.forEach((k, j) => {
        const v = vals[j][i] || 0;
        g += `<path d="${barra(cx - bw - 1 + j * (bw + 2), y(v), bw, y(0) - y(v))}" fill="${SERIE_COR[k]}"/>`;
      });
      if (i % 2 === 1) g += `<text x="${cx}" y="${H - 7}" class="ch-ax" text-anchor="middle">${i === n - 1 ? 'esta' : ddmm(d)}</text>`;
    });
    ini.forEach((_, i) => { g += `<rect x="${L + gw * i}" y="${T}" width="${gw}" height="${H - T}" fill="transparent" data-ci="${i}"/>`; });
    return `<div class="card chart" data-chart="semanas">
      <div class="ch-read">${leituraSemana(n - 1)}</div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Ganhos por semana nas últimas 8 semanas">${g}</svg>
      <div class="ch-leg">${KIDS.map(k => `<span><i style="background:${SERIE_COR[k]}"></i>${esc(user(k).nome)}</span>`).join('')}</div>
    </div>`;
  }
  function leituraSemana(i) {
    const ini = user(KIDS[0]).stats.semanasIni;
    const rot = i === ini.length - 1 ? 'Esta semana' : `Semana de ${ddmm(ini[i])}`;
    return `<b>${rot}</b>${KIDS.map(k => `<span><i style="background:${SERIE_COR[k]}"></i>${esc(user(k).nome)} <b class="mono">${brl(user(k).stats.semanas[i] || 0)}</b></span>`).join('')}`;
  }

  // projeção do cofrinho: só o que já tem × guardando um pouco toda semana (12 meses, juros compostos por dia)
  function projecao(aporte) {
    const t = S.data.taxas?.dia || 0;
    let a = cofreDe(S.me).saldo, b = a;
    const pa = [a], pb = [b];
    for (let d = 1; d <= 365; d++) {
      a *= 1 + t;
      b = b * (1 + t) + (d % 7 === 0 ? aporte : 0);
      if (d % 30 === 0 || d === 365) { if (pa.length < 13) { pa.push(a); pb.push(b); } }
    }
    return { pa, pb };
  }
  function graficoCofre(aporte) {
    const { pa, pb } = projecao(aporte);
    const W = 340, H = 180, L = 46, R = 58, T = 14, B = 24, n = pa.length;
    const max = niceMax(Math.max(...pb, ...pa, 1));
    const x = i => L + (W - L - R) * i / (n - 1);
    const y = v => T + (H - T - B) * (1 - v / max);
    const corB = `rgb(${getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb')})`;
    const linha = (p, cor) => `<polyline points="${p.map((v, i) => `${x(i)},${y(v)}`).join(' ')}" fill="none" stroke="${cor}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    let g = '';
    [0, .5, 1].forEach(f => {
      g += `<line x1="${L}" x2="${W - R}" y1="${y(max * f)}" y2="${y(max * f)}" class="ch-grid"/>
        <text x="${L - 6}" y="${y(max * f) + 4}" class="ch-ax" text-anchor="end">${brlEixo(max * f)}</text>`;
    });
    [[0, 'hoje'], [6, '6 meses'], [12, '1 ano']].forEach(([i, t]) => { g += `<text x="${x(i)}" y="${H - 7}" class="ch-ax" text-anchor="middle">${t}</text>`; });
    g += `<line class="ch-cross" x1="${x(n - 1)}" x2="${x(n - 1)}" y1="${T}" y2="${H - B}"/>`;
    g += linha(pa, '#8b93a3') + linha(pb, corB);
    g += `<circle cx="${x(n - 1)}" cy="${y(pa[n - 1])}" r="4" fill="#8b93a3" stroke="var(--surface)" stroke-width="2"/>
      <circle cx="${x(n - 1)}" cy="${y(pb[n - 1])}" r="4" fill="${corB}" stroke="var(--surface)" stroke-width="2"/>
      <text x="${x(n - 1) + 8}" y="${y(pb[n - 1]) + 4}" class="ch-lbl">${brlEixo(Math.round(pb[n - 1]))}</text>
      ${Math.abs(y(pa[n - 1]) - y(pb[n - 1])) > 14 ? `<text x="${x(n - 1) + 8}" y="${y(pa[n - 1]) + 4}" class="ch-lbl muted">${brlEixo(Math.round(pa[n - 1]))}</text>` : ''}`;
    for (let i = 0; i < n; i++) g += `<rect x="${x(i) - (W - L - R) / (n - 1) / 2}" y="${T}" width="${(W - L - R) / (n - 1)}" height="${H - T}" fill="transparent" data-ci="${i}"/>`;
    return `<div class="card chart" data-chart="cofre" data-aporte="${aporte}">
      <div class="ch-read">${leituraCofre(aporte, n - 1)}</div>
      <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Projeção do cofrinho em 12 meses">${g}</svg>
      <div class="ch-leg"><span><i style="background:${corB}"></i>Guardando ${brl(aporte)} por semana</span><span><i style="background:#8b93a3"></i>Só o que tem hoje</span></div>
    </div>`;
  }
  function leituraCofre(aporte, i) {
    const { pa, pb } = projecao(aporte);
    return `<b>${i === 0 ? 'Hoje' : i === 12 ? 'Em 1 ano' : `Em ${i} ${i === 1 ? 'mês' : 'meses'}`}</b>
      <span>Guardando <b class="mono">${brl(Math.round(pb[i]))}</b></span><span>Só o de hoje <b class="mono">${brl(Math.floor(pa[i]))}</b></span>`;
  }

  // tocar/passar o dedo numa coluna mostra os valores dela em cima do gráfico
  const lerGrafico = e => {
    const c = e.target.closest?.('[data-ci]');
    if (!c) return;
    const ch = c.closest('.chart');
    const i = Number(c.dataset.ci);
    const read = ch.querySelector('.ch-read');
    if (ch.dataset.chart === 'semanas') {
      read.innerHTML = leituraSemana(i);
      const hl = ch.querySelector('.ch-hl');
      hl.setAttribute('x', c.getAttribute('x'));
    } else {
      read.innerHTML = leituraCofre(Number(ch.dataset.aporte), i);
      const cx = Number(c.getAttribute('x')) + Number(c.getAttribute('width')) / 2;
      ch.querySelectorAll('.ch-cross').forEach(l => { l.setAttribute('x1', cx); l.setAttribute('x2', cx); });
    }
  };
  document.addEventListener('pointerover', lerGrafico, { passive: true });
  document.addEventListener('pointerdown', lerGrafico, { passive: true });

  // ------------------------------------------------------------ CHAT
  const CHAT_POLL_MS = 3000;
  const MAX_VIDEO = 15 * 1024 * 1024;
  const MAX_FILE = 10 * 1024 * 1024;
  const chatOpen = () => !!S.data && (S.me === ADMIN ? S.adminTab === 'chat' : S.tab === 'chat');
  const serverMsgs = () => S.chat.msgs.filter(m => !m.pending);
  const hora = iso => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  function mergeMsgs(list) {
    list.forEach(m => {
      const i = S.chat.msgs.findIndex(x => x.id === m.id);
      if (i >= 0) S.chat.msgs[i] = m; else S.chat.msgs.push(m);
    });
    S.chat.msgs.sort((a, b) => (a.pending - b.pending) || (a.criado_em < b.criado_em ? -1 : a.criado_em > b.criado_em ? 1 : 0));
    if (S.chat.msgs.length > 400) S.chat.msgs = S.chat.msgs.slice(-400);
  }
  function mergeVistos(v) {
    Object.entries(v || {}).forEach(([k, iso]) => { if ((iso || '') > (S.chat.vistos[k] || '')) S.chat.vistos[k] = iso; });
  }
  function naoLidas() {
    const visto = S.chat.vistos[S.me] || '';
    return S.chat.msgs.filter(m => m.usuario !== S.me && !m.pending && m.criado_em > visto).length;
  }

  function diaLabel(iso) {
    const d = new Date(iso), hoje = new Date();
    const dias = Math.floor((new Date(hoje.toDateString()) - new Date(d.toDateString())) / 864e5);
    if (dias === 0) return 'Hoje';
    if (dias === 1) return 'Ontem';
    return d.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  }

  function ticks(m) {
    if (m.pending) return '<span class="tick">🕓</span>';
    const outros = Object.keys(USERS).filter(id => id !== m.usuario);
    const viram = outros.filter(o => (S.chat.vistos[o] || '') >= m.criado_em).length;
    if (viram === outros.length) return '<span class="tick seen">✓✓</span>';
    return `<span class="tick">${viram ? '✓✓' : '✓'}</span>`;
  }

  const ondas = id => {
    let h = 0;
    for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
    return Array.from({ length: 22 }, (_, i) => `<i style="height:${20 + ((h >> (i % 24)) % 70)}%"></i>`).join('');
  };
  const linkify = s => s.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  const soEmoji = s => /^(\p{Extended_Pictographic}|\p{Emoji_Modifier}|️|‍|\s){1,12}$/u.test(s) && !/^\s*$/.test(s);

  function msgBody(m) {
    const src = id => (m.local ? `style="background-image:url('${m.local}')"` : `data-media="${id}"`);
    switch (m.tipo) {
      case 'texto':
        return `<div class="txt ${soEmoji(m.texto) ? 'emoji' : ''}">${linkify(esc(m.texto)).replace(/\n/g, '<br>')}</div>`;
      case 'imagem':
        return `<div class="bimg" ${src(m.midia_id)} ${m.pending ? '' : `data-zoom="${m.midia_id}"`}>🖼️</div>`;
      case 'video':
        return `<div class="bvid" ${m.local ? `style="background-image:url('${m.local}')"` : m.ref ? `data-media="${m.ref}"` : ''} ${m.pending ? '' : `data-video="${m.midia_id}"`}>
          <span class="pl">${m.pending ? '<div class="spin"></div>' : '▶'}</span><span class="vtag">🎥</span></div>`;
      case 'audio':
        return `<div class="baud">${m.pending ? '<div class="spin"></div>' : `<button class="play small" onclick="A.play('${m.midia_id}', this)" aria-label="Ouvir">▶</button>`}
          <div class="wavebar">${ondas(m.id)}</div></div>`;
      case 'arquivo':
        return `<button class="bfile" ${m.pending ? '' : `data-file="${m.midia_id}" data-name="${esc(m.ref)}"`}>
          <span class="fico">📄</span><span class="fname">${esc(m.ref || 'arquivo')}</span><span>${m.pending ? '<div class="spin sm"></div>' : '⬇️'}</span></button>`;
      case 'pix': {
        const [para, v] = String(m.ref).split(':');
        return `<div class="bpix"><div class="pix-ico">${ICON.pix}</div><div class="grow"><div class="pv mono">${brl(v)}</div>
          <div class="pto">➜ ${avatar(para, 'xs')}<b style="color:${user(para).cor}">${esc(user(para).nome)}</b></div></div></div>
          ${m.texto ? `<div class="txt">${esc(m.texto)}</div>` : ''}`;
      }
      case 'presente': {
        const [para, v] = String(m.ref).split(':');
        return `<div class="bpres"><div class="pres-ico">🎁</div><div class="grow"><div class="pv mono">${brl(v)}${para === 'ambos' ? ' <small>cada</small>' : ''}</div>
          <div class="pto">➜ ${para === 'ambos' ? KIDS.map(k => avatar(k, 'xs')).join('') + '<b>os dois</b>' : `${avatar(para, 'xs')}<b style="color:${user(para).cor}">${esc(user(para).nome)}</b>`}</div></div></div>
          ${m.texto ? `<div class="txt">${esc(m.texto)}</div>` : ''}`;
      }
      case 'multa': {
        const [k, v] = String(m.ref).split(':');
        return `<div class="bmulta">${m.midia_id ? `<div class="bm-foto" data-media="${m.midia_id}" data-zoom="${m.midia_id}">📷</div>` : ''}
          <div class="grow"><div class="mv">⚠️ Multa <span class="mono">− ${brl(v)}</span></div>
          <div class="pto">${avatar(k, 'xs')}<b style="color:${user(k).cor}">${esc(user(k).nome)}</b></div>
          ${m.texto ? `<div class="small" style="margin-top:4px">${esc(m.texto)}</div>` : ''}</div></div>`;
      }
      case 'apagada':
        return '<div class="txt del">🚫</div>';
    }
    return '';
  }

  function msgHtml(m, prev) {
    let sep = '';
    if (!prev || new Date(prev.criado_em).toDateString() !== new Date(m.criado_em).toDateString()) {
      sep = `<div class="day-sep"><span>${diaLabel(m.criado_em)}</span></div>`;
    }
    if (m.tipo === 'sistema') return sep + `<div class="sys"><span>${esc(m.texto)}</span></div>`;
    const mine = m.usuario === S.me;
    const first = !!sep || !prev || prev.usuario !== m.usuario || prev.tipo === 'sistema'
      || new Date(m.criado_em) - new Date(prev.criado_em) > 5 * 60e3;
    const u = user(m.usuario);
    const card = ['pix', 'presente', 'multa'].includes(m.tipo);
    return sep + `<div class="msg ${mine ? 'me' : 'them'} ${first ? 'first' : ''} t-${m.tipo} ${m.pending ? 'pending' : ''}" data-mid="${m.id}" style="--uc:${u.cor}">
      ${mine ? '' : first ? avatar(m.usuario, 'xs') : '<span class="av-sp"></span>'}
      <div class="bubble ${card ? 'cardish' : ''}">
        ${!mine && first ? `<div class="from" style="color:${u.cor}">${esc(u.nome)}</div>` : ''}
        ${msgBody(m)}
        <span class="meta">${hora(m.criado_em)}${mine ? ticks(m) : ''}</span>
      </div></div>`;
  }

  function chatPage() {
    const kid = S.me !== ADMIN;
    return `<div class="chat-page ${kid ? 'kid' : 'adm'}">
      <div class="chat-head">
        ${kid ? '' : `<button class="icon-btn chat-sair" onclick="A.adminTab('fila')" aria-label="Voltar ao painel" title="Voltar ao painel">${ICON.chevron}</button>`}
        <div class="stack">${Object.keys(USERS).map(id => avatar(id, 'sm')).join('')}</div>
        <div class="grow"><div class="ttl">Família</div><div class="muted small">${Object.keys(USERS).map(id => esc(user(id).nome)).join(', ')}</div></div>
      </div>
      <div class="chat-list"></div>
      <div class="composer-wrap"><div class="composer"></div></div>
    </div>`;
  }

  function composerIdle() {
    const c = $app.querySelector('.composer');
    if (!c) return;
    c.classList.remove('rec-on');
    c.innerHTML = `
      <button class="cbtn" data-c="attach" aria-label="Anexar">📎</button>
      <div class="cfield"><textarea rows="1" placeholder="Mensagem" data-c-input>${esc(S.draft || '')}</textarea>
        <label class="cbtn cam" aria-label="Câmera">📷<input type="file" accept="image/*" capture="environment" hidden data-c-file></label></div>
      <button class="cbtn send" data-c="send" aria-label="Enviar">${(S.draft || '').trim() ? '➤' : '🎤'}</button>`;
    const ta = c.querySelector('textarea');
    const grow = () => { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 120) + 'px'; };
    grow();
    ta.oninput = () => {
      S.draft = ta.value;
      grow();
      c.querySelector('[data-c=send]').textContent = ta.value.trim() ? '➤' : '🎤';
    };
    ta.onkeydown = e => {
      if (e.key === 'Enter' && !e.shiftKey && matchMedia('(pointer:fine)').matches) { e.preventDefault(); enviarTexto(); }
    };
    c.querySelector('[data-c-file]').onchange = e => { const fs = [...e.target.files]; e.target.value = ''; fs.forEach(enviarArquivo); };
    c.onclick = e => {
      const a = e.target.closest('[data-c]')?.dataset.c;
      if (a === 'attach') anexos();
      if (a === 'send') (S.draft || '').trim() ? enviarTexto() : gravar(c);
    };
  }

  function mountChat() {
    composerIdle();
    drawChat(true);
    pollChat(true);
  }

  // redesenha a lista só quando algo mudou; mantém a posição se a pessoa estiver lendo lá em cima
  function drawChat(force) {
    const list = $app.querySelector('.chat-list');
    if (!list) return;
    const msgs = S.chat.msgs.filter(m => m.tipo !== 'troca');
    const sig = JSON.stringify([msgs.map(m => m.id + m.tipo + (m.pending ? 1 : 0)), S.chat.vistos]);
    if (!force && sig === S.chat.sig) return;
    if (!force && !player.paused) return; // não corta o áudio que está tocando
    S.chat.sig = sig;
    const doc = document.scrollingElement;
    const pertoDoFim = force || doc.scrollHeight - (scrollY + innerHeight) < 220;
    list.innerHTML = msgs.length
      ? msgs.map((m, i) => msgHtml(m, msgs[i - 1])).join('')
      : '<div class="empty"><span class="big">💬</span><p>Nenhuma mensagem ainda</p></div>';
    hydrate(list);
    if (pertoDoFim) requestAnimationFrame(() => scrollTo(0, doc.scrollHeight));
  }

  async function pollChat(first) {
    if (S.chat.fetching || !chatOpen()) return;
    S.chat.fetching = true;
    try {
      const sm = serverMsgs();
      const desde = first || !sm.length ? '' : sm[sm.length - 1].criado_em;
      const marcar = first || naoLidas() > 0;
      const res = await api('chat', { desde, visto: marcar });
      const novasDeOutros = res.msgs.some(m => m.usuario !== S.me && !S.chat.msgs.find(x => x.id === m.id));
      mergeMsgs(res.msgs);
      mergeVistos(res.vistos);
      if (marcar) S.chat.vistos[S.me] = new Date().toISOString();
      if (!first && novasDeOutros) navigator.vibrate?.(25);
      // pix novos mudam saldo e mochila: busca o resto em segundo plano
      if (res.msgs.some(m => ['pix', 'sistema'].includes(m.tipo) && m.usuario !== S.me) && !first) load(true);
      drawChat();
      badges();
    } catch (e) { console.warn(e); }
    finally { S.chat.fetching = false; }
  }
  setInterval(() => { if (document.visibilityState === 'visible' && chatOpen()) pollChat(false); }, CHAT_POLL_MS);

  /** Atualiza só os contadores (nav / abas) sem redesenhar a tela. */
  function badges() {
    const n = chatOpen() ? 0 : naoLidas();
    const el = $app.querySelector('[data-badge=chat]');
    if (!el) return;
    el.querySelector('.dot, .n')?.remove();
    if (n) el.insertAdjacentHTML('beforeend', S.me === ADMIN ? `<span class="n">${n}</span>` : `<span class="dot">${n}</span>`);
  }

  function addPending(m) {
    const tmp = { id: 'tmp' + Date.now() + Math.random().toString(36).slice(2, 6), usuario: S.me, criado_em: new Date().toISOString(), pending: true, texto: '', ref: '', ...m };
    S.chat.msgs.push(tmp);
    drawChat(true);
    return tmp;
  }
  function resolvePending(tmp, real) {
    const i = S.chat.msgs.indexOf(tmp);
    if (i >= 0) S.chat.msgs.splice(i, 1);
    if (real) mergeMsgs([real]);
    drawChat(true);
  }

  async function enviarTexto() {
    const texto = (S.draft || '').trim();
    if (!texto) return;
    S.draft = '';
    const ta = $app.querySelector('[data-c-input]');
    if (ta) { ta.value = ''; ta.oninput(); ta.focus(); }
    const tmp = addPending({ tipo: 'texto', texto });
    try {
      resolvePending(tmp, await api('enviarMsg', { tipo: 'texto', texto }));
    } catch (err) {
      resolvePending(tmp, null);
      S.draft = texto;
      composerIdle();
      toast('⚠️ ' + err.message, true);
    }
  }

  async function enviarMidia(tipo, dataUrl, extra = {}) {
    const tmp = addPending({ tipo, local: tipo === 'imagem' ? dataUrl : extra.posterUrl, ref: extra.nome || '' });
    try {
      const params = { tipo, midia: splitDataUrl(dataUrl), nome: extra.nome || '' };
      if (extra.posterUrl) params.poster = splitDataUrl(extra.posterUrl);
      const real = await api('enviarMsg', params);
      media.set(real.midia_id, dataUrl);
      if (extra.posterUrl && real.ref) media.set(real.ref, extra.posterUrl);
      resolvePending(tmp, real);
    } catch (err) {
      resolvePending(tmp, null);
      toast('⚠️ ' + err.message, true);
    }
  }

  const fileToDataUrl = f => new Promise((ok, err) => {
    const r = new FileReader();
    r.onload = () => ok(r.result);
    r.onerror = err;
    r.readAsDataURL(f);
  });

  function videoPoster(file) {
    return new Promise(ok => {
      const url = URL.createObjectURL(file);
      const v = document.createElement('video');
      let feito = false;
      const done = r => { if (feito) return; feito = true; URL.revokeObjectURL(url); ok(r); };
      v.muted = true; v.playsInline = true; v.preload = 'auto'; v.src = url;
      v.onloadeddata = () => { v.currentTime = Math.min(0.5, (v.duration || 1) / 2); };
      v.onseeked = () => {
        try {
          const s = Math.min(1, 480 / Math.max(v.videoWidth, v.videoHeight));
          const c = document.createElement('canvas');
          c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s);
          c.getContext('2d').drawImage(v, 0, 0, c.width, c.height);
          done(c.toDataURL('image/jpeg', 0.6));
        } catch { done(null); }
      };
      v.onerror = () => done(null);
      setTimeout(() => done(null), 5000);
    });
  }

  async function enviarArquivo(f) {
    try {
      if (f.type.startsWith('image/') && f.type !== 'image/gif') {
        return enviarMidia('imagem', await compressImage(f, 1280, 0.75));
      }
      if (f.type.startsWith('video/')) {
        if (f.size > MAX_VIDEO) return toast('🎥 Vídeo muito grande (máx. 15 MB)', true);
        const posterUrl = await videoPoster(f);
        return enviarMidia('video', await fileToDataUrl(f), { posterUrl });
      }
      if (f.size > MAX_FILE) return toast('📄 Arquivo muito grande (máx. 10 MB)', true);
      if (f.type.startsWith('audio/')) return enviarMidia('audio', await fileToDataUrl(f));
      if (f.type === 'image/gif') return enviarMidia('imagem', await fileToDataUrl(f));
      const url = await fileToDataUrl(f);
      return enviarMidia('arquivo', url.startsWith('data:;') ? url.replace('data:;', 'data:application/octet-stream;') : url, { nome: f.name });
    } catch (err) { toast('⚠️ ' + (err.message || 'arquivo'), true); }
  }

  function anexos() {
    const kid = S.me !== ADMIN;
    const sh = openSheet(`
      <h2>📎 Enviar${CLOSE}</h2>
      <div class="attach-grid">
        <label class="att" style="--c:#a855f7">🖼️<small>Galeria</small><input type="file" accept="image/*,video/*" multiple hidden></label>
        <label class="att" style="--c:#ef4444">📷<small>Foto</small><input type="file" accept="image/*" capture="environment" hidden></label>
        <label class="att" style="--c:#f97316">🎥<small>Vídeo</small><input type="file" accept="video/*" capture="environment" hidden></label>
        <label class="att" style="--c:#3b82f6">📄<small>Arquivo</small><input type="file" hidden></label>
        ${kid ? `<button class="att pix-att" style="--c:#32bcad" data-a="pix">${ICON.pix}<small>Pix</small></button>` : ''}
      </div>`);
    sh.querySelectorAll('input[type=file]').forEach(inp => {
      inp.onchange = () => { const fs = [...inp.files]; closeSheet(); fs.forEach(enviarArquivo); };
    });
    sh.onclick = e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'close') closeSheet();
      if (a === 'pix') pixSheet();
    };
  }

  // mensagem de voz: toca 🎤 para gravar, 🗑️ cancela, ➤ envia
  async function gravar(c) {
    let stream;
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); }
    catch { return toast('🎤 Libere o microfone', true); }
    const mime = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus'].find(m => window.MediaRecorder?.isTypeSupported?.(m)) || '';
    let rec;
    try { rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 24000 } : {}); }
    catch { stream.getTracks().forEach(t => t.stop()); return toast('🎤 Este aparelho não grava áudio aqui', true); }
    const chunks = [];
    let cancelado = false, sec = 0;
    S.recording = true;
    rec.ondataavailable = ev => ev.data.size && chunks.push(ev.data);
    rec.onstop = async () => {
      clearInterval(timer);
      stream.getTracks().forEach(t => t.stop());
      S.recording = false;
      composerIdle();
      if (cancelado || !chunks.length) return;
      const blob = new Blob(chunks, { type: (rec.mimeType || mime || 'audio/webm').split(';')[0] });
      enviarMidia('audio', `data:${blob.type};base64,${await blobToB64(blob)}`);
    };
    rec.start(1000);
    navigator.vibrate?.(30);
    c.classList.add('rec-on');
    c.innerHTML = `<button class="cbtn" data-r="cancel" aria-label="Cancelar">🗑️</button>
      <div class="cfield recbar"><span class="rdot"></span><span class="mono rt">0:00</span><div class="wave">${'<i></i>'.repeat(9)}</div></div>
      <button class="cbtn send" data-r="send" aria-label="Enviar">➤</button>`;
    const timer = setInterval(() => {
      sec++;
      const t = c.querySelector('.rt');
      if (t) t.textContent = fmtSec(sec);
      if (sec >= MAX_REC_SEC) rec.stop();
    }, 1000);
    c.onclick = e => {
      const r = e.target.closest('[data-r]')?.dataset.r;
      if (!r || rec.state === 'inactive') return;
      cancelado = r === 'cancel';
      rec.stop();
    };
  }

  async function abrirVideo(id) {
    const z = document.createElement('div');
    z.className = 'zoom';
    z.innerHTML = '<div class="spin"></div>';
    z.onclick = e => { if (e.target === z) { z.querySelector('video')?.pause(); z.remove(); } };
    document.body.appendChild(z);
    try {
      await getMedia([id]);
      const blob = await (await fetch(media.get(id))).blob();
      const url = URL.createObjectURL(blob);
      z.innerHTML = `<video src="${url}" controls autoplay playsinline></video><button class="icon-btn gal-x" aria-label="Fechar">${ICON.x}</button>`;
      z.querySelector('.gal-x').onclick = () => { z.querySelector('video').pause(); URL.revokeObjectURL(url); z.remove(); };
    } catch (e) { z.remove(); toast('⚠️ ' + e.message, true); }
  }

  async function baixar(id, nome) {
    try {
      toast('⬇️ Baixando…');
      await getMedia([id]);
      const blob = await (await fetch(media.get(id))).blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nome || 'arquivo';
      document.body.appendChild(a);
      a.click();
      setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    } catch (e) { toast('⚠️ ' + e.message, true); }
  }

  // toques dentro do chat: foto, vídeo, arquivo e segurar para apagar
  document.addEventListener('click', e => {
    const z = e.target.closest?.('[data-zoom]');
    if (z) return A.zoomMedia(z.dataset.zoom);
    const v = e.target.closest?.('[data-video]');
    if (v) return abrirVideo(v.dataset.video);
    const f = e.target.closest?.('[data-file]');
    if (f) return baixar(f.dataset.file, f.dataset.name);
  });
  let holdT = null;
  const apagarMsg = async el => {
    const id = el.dataset.mid;
    const m = S.chat.msgs.find(x => x.id === id);
    if (!m || m.pending || ['pix', 'sistema', 'apagada', 'presente', 'multa'].includes(m.tipo)) return;
    if (m.usuario !== S.me && S.me !== ADMIN) return;
    navigator.vibrate?.(40);
    if (!(await ask({ title: '🗑️ Apagar mensagem?', text: 'Ela some para todo mundo.', ok: 'Apagar', danger: true }))) return;
    try {
      await api('apagarMsg', { id });
      Object.assign(m, { tipo: 'apagada', texto: '', midia_id: '' });
      drawChat(true);
    } catch (err) { toast('⚠️ ' + err.message, true); }
  };
  document.addEventListener('pointerdown', e => {
    const el = e.target.closest?.('.chat-list .msg');
    if (!el || e.target.closest('button, a')) return;
    clearTimeout(holdT);
    holdT = setTimeout(() => apagarMsg(el), 600);
  }, { passive: true });
  ['pointerup', 'pointercancel', 'pointermove'].forEach(ev =>
    document.addEventListener(ev, e => { if (ev !== 'pointermove' || Math.abs(e.movementY) > 4) clearTimeout(holdT); }, { passive: true }));
  document.addEventListener('contextmenu', e => { if (e.target.closest?.('.chat-list .msg')) e.preventDefault(); });

  // ------------------------------------------------------------ ações globais
  window.A = {
    reload: () => load(),
    tab: t => { if (S.tab === t) return; S.tab = t; render(true); if (t !== 'chat') scrollTo({ top: 0, behavior: 'smooth' }); navigator.vibrate?.(8); },
    adminTab: t => { if (S.adminTab === t) return; S.adminTab = t; render(true); },
    rank: k => { S.rank = k; render(true); },
    cart: k => { if (S.cart === k) return; S.cart = k; render(true); scrollTo({ top: 0 }); navigator.vibrate?.(8); },
    compose, buy, editItem, refazer, aprovar,
    pix: () => pixSheet(),
    elos: () => {
      const st = user(S.me).stats || {};
      const d = st.streak || 0;
      const sh = openSheet(`
        <h2>🔥 Ofensiva${CLOSE}</h2>
        <p class="muted small" style="text-align:center;margin-top:0">Mande um relato todo dia para subir de elo. Se passar um dia sem relato, volta para o começo.</p>
        <div class="elos">${ELOS.slice(1).map(x => `
          <div class="elo-row ${d >= x.min ? 'on' : ''} ${elo(d) === x ? 'atual' : ''}" style="--c:${x.c}">
            ${emblema(x.min)}<b>${x.n}</b><span class="mono muted">${x.min}d</span>
            <span class="pet-mini">${nivel(PETS, x.min).e}</span></div>`).join('')}</div>
        <div class="muted small mono" style="text-align:center;margin-top:12px">🏆 Recorde: ${st.recorde || 0} ${st.recorde === 1 ? 'dia' : 'dias'}</div>`);
      sh.onclick = e => { if (e.target.closest('[data-a=close]')) closeSheet(); };
    },
    apagarRelato: id => {
      const r = S.data.relatos.find(x => x.id === id);
      if (!r) return;
      const sh = openSheet(`
        <h2>🗑️ Apagar?${CLOSE}</h2>
        ${r.status === 'aprovado' ? `<p class="muted" style="text-align:center">💰 ${brl(r.valor)} continua com você</p>` : ''}
        <div class="duo mt">
          <button class="btn big" data-a="close">↩️ Voltar</button>
          <button class="btn big danger" data-a="del">🗑️ Apagar</button>
        </div>`);
      sh.onclick = async e => {
        const b = e.target.closest('[data-a]');
        if (!b || b.disabled) return;
        if (b.dataset.a === 'close') return closeSheet();
        b.disabled = true;
        b.innerHTML = '<div class="spin sm"></div>';
        try {
          await api('apagarRelato', { id });
          S.data.relatos = S.data.relatos.filter(x => x.id !== id);
          closeSheet();
          done('Apagado');
          render();
          load(true);
        } catch (err) { b.disabled = false; b.innerHTML = '🗑️ Apagar'; toast('⚠️ ' + err.message, true); }
      };
    },
    play: (id, btn) => playMedia(id, btn),
    zoomMedia: async id => { await getMedia([id]); media.has(id) && zoom(media.get(id)); },
    gallery: async (ids, start = 0) => {
      const list = String(ids).split(',').filter(Boolean);
      if (list.length === 1) return A.zoomMedia(list[0]);
      const z = document.createElement('div');
      z.className = 'zoom gal-wrap';
      z.innerHTML = `<div class="gal">${list.map(() => '<div class="slide"><div class="spin"></div></div>').join('')}</div>
        <div class="gal-dots">${list.map((_, i) => `<i class="${i === start ? 'on' : ''}"></i>`).join('')}</div>
        <button class="icon-btn gal-x" aria-label="Fechar">${ICON.x}</button>`;
      document.body.appendChild(z);
      const gal = z.querySelector('.gal');
      z.querySelector('.gal-x').onclick = () => z.remove();
      gal.onclick = e => { if (e.target.classList.contains('slide')) z.remove(); };
      gal.onscroll = () => {
        const i = Math.round(gal.scrollLeft / gal.clientWidth);
        z.querySelectorAll('.gal-dots i').forEach((d, k) => d.classList.toggle('on', k === i));
      };
      requestAnimationFrame(() => gal.scrollTo({ left: start * gal.clientWidth }));
      try { await getMedia(list); } catch (e) { toast('⚠️ ' + e.message, true); }
      gal.querySelectorAll('.slide').forEach((sl, i) => {
        const url = media.get(list[i]);
        sl.innerHTML = url ? `<img src="${url}">` : '⚠️';
      });
    },
    nota: (id, n) => {
      review[id].nota = n;
      document.querySelectorAll(`[data-id="${id}"] .star-pick button`).forEach((b, i) => {
        b.classList.toggle('on', i < n);
        b.classList.remove('pop');
        if (i < n) { void b.offsetWidth; b.style.animationDelay = i * 25 + 'ms'; b.classList.add('pop'); }
      });
      document.querySelector(`[data-id="${id}"] .money-in .mono`).textContent = n + '/10';
    },
    valor: (id, v, fill) => {
      review[id].valor = v;
      const card = document.querySelector(`[data-id="${id}"]`);
      if (!card) return;
      if (fill) card.querySelector('.money-in input').value = v;
      card.querySelectorAll('.quick [data-v]').forEach(b => b.classList.toggle('on', b.dataset.v === v));
      card.querySelector('[data-approve]').textContent = approveLabel(id);
    },
    resgate: async (id, status, btn) => {
      const x = S.data.resgates.find(r => r.id === id);
      if (status === 'cancelado' && !(await ask({
        title: '↩️ Cancelar pedido?',
        text: x ? `${esc(x.emoji || '🎁')} ${esc(x.nome)} — <b class="mono">${brl(x.preco)}</b> volta para o saldo de ${esc(user(x.usuario).nome)}.` : '',
        ok: 'Cancelar pedido', cancel: 'Manter', danger: true,
      }))) return;
      const row = btn?.closest('.table-row, .inv');
      row?.querySelectorAll('button').forEach(b => (b.disabled = true));
      try { await api('resgateStatus', { id, status }); toast(status === 'entregue' ? '🎁 Marcado como entregue' : '↩️ Pedido cancelado, valor devolvido'); load(true); }
      catch (err) { row?.querySelectorAll('button').forEach(b => (b.disabled = false)); toast('⚠️ ' + err.message, true); }
    },
    histKid: k => { S.histKid = k; render(); },
    missao: id => missaoSheet(id),
    novaMissao: () => novaMissao(),
    missaoCancelar: async (id, btn) => {
      const m = missao(id);
      if (!(await ask({ title: '🎯 Tirar do catálogo?', text: m?.titulo ? esc(m.titulo) : 'A missão some para os dois.', ok: 'Tirar', danger: true }))) return;
      if (btn) btn.disabled = true;
      try { await api('missaoCancelar', { id }); toast('Missão removida'); load(true); }
      catch (err) { if (btn) btn.disabled = false; toast('⚠️ ' + err.message, true); }
    },
    cofre: modo => cofreSheet(modo),
    meta: () => metaSheet(),
    perdoar: async (id, btn) => {
      if (btn) btn.disabled = true;
      try { await api('multaPerdoar', { id }); closeSheet(); toast('🤝 Multa perdoada, valor devolvido'); load(true); }
      catch (err) { if (btn) btn.disabled = false; toast('⚠️ ' + err.message, true); }
    },
    criar: () => criarSheet(),
    tv: () => tvSheet(),
    verTodos: () => { S.verTodos = true; render(); },
    aporte: v => {
      S.aporte = v;
      document.querySelectorAll('[data-aps] button').forEach(b => b.classList.toggle('on', b.getAttribute('onclick') === `A.aporte(${v})`));
      const box = document.querySelector('[data-proj]');
      if (box) box.innerHTML = graficoCofre(v);
    },
    mercadinho: () => mercadinhoSheet(),
    entregarTudo: async (k, btn) => {
      const ids = S.data.resgates.filter(x => x.usuario === k && x.status === 'pendente').map(x => x.id);
      if (!ids.length) return;
      if (!(await ask({ title: `✅ Entregar tudo para ${esc(user(k).nome)}?`, text: `${ids.length} itens saem da mochila dele.`, ok: 'Entregar tudo' }))) return;
      if (btn) btn.disabled = true;
      try { await api('resgatesEntregar', { ids }); done('Entregue!'); load(true); }
      catch (err) { if (btn) btn.disabled = false; toast('⚠️ ' + err.message, true); }
    },
    tarefa: id => {
      const r = relTarefaHoje(id);
      if (!r) return compose(undefined, undefined, id);
      if (r.status === 'refazer') return compose(r.id);
      toast(r.status === 'aprovado' ? '✅ Essa já foi feita hoje' : '⏳ Esperando a aprovação');
    },
    editTarefa: id => tarefaSheet(id),
    presente: () => presenteSheet(),
    multa: () => multaSheet(),
    lance: id => lanceSheet(id),
    novoLeilao: () => novoLeilao(),
    leilaoCancelar: async (id, btn) => {
      const l = leilao(id);
      if (!(await ask({ title: '🔨 Cancelar leilão?', text: l?.lider ? `O lance de ${esc(user(l.lider).nome)} (<b class="mono">${brl(l.lance)}</b>) volta para o saldo.` : '', ok: 'Cancelar leilão', cancel: 'Manter', danger: true }))) return;
      if (btn) btn.disabled = true;
      try { await api('leilaoCancelar', { id }); toast('Leilão cancelado'); load(true); }
      catch (err) { if (btn) btn.disabled = false; toast('⚠️ ' + err.message, true); }
    },
    extrato: () => extratoSheet(),
    setFoto: async input => {
      const f = input.files[0];
      input.value = '';
      if (!f) return;
      try {
        const url = await compressImage(f, 400, .8);
        toast('⏳ Enviando foto…');
        const { foto_id } = await api('setFoto', { foto: splitDataUrl(url) });
        media.set(foto_id, url);
        user(S.me).foto_id = foto_id;
        render();
        toast('✅ Foto atualizada');
      } catch (err) { toast('⚠️ ' + err.message, true); }
    },
  };

  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.me && S.data && !S.fetching && !busy()) load(true, true);
  });
  route();
})();
