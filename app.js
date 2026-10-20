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
  const hexA = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`;
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
    const r = await fetch(API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, usuario: S.me, ...params }),
    });
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
    document.querySelector('meta[name=theme-color]').content = '#02060e';
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
        <button class="btn primary" onclick="A.reload()">🔄</button></div>`;
      else toast('⚠️ ' + e.message, true);
    } finally {
      S.fetching = false;
    }
  }

  /** Atualização automática só quando a pessoa não está no meio de nada. */
  function busy() {
    if (document.getElementById('sheet-root').innerHTML) return true;   // tirando foto, gravando, comprando, editando item
    if (document.querySelector('.zoom')) return true;                     // vendo foto/galeria
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
    if (!S.draftChecked && S.me !== ADMIN) {
      S.draftChecked = true;
      const d = readDraft();
      if (d && d.fotos.length) compose(d.refazerId || undefined);
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
    const x = t => (nav.querySelector(`[data-tab="${t}"]`)?.offsetLeft ?? 7) - 7;
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
    if (r.status === 'aprovado') return `<span class="badge aprovado">✅ <span class="mono">${brl(r.valor)}</span></span>`;
    if (r.status === 'refazer') return `<span class="badge refazer"><span class="live"></span>🔁</span>`;
    return `<span class="badge pendente"><span class="live"></span>⏳</span>`;
  }

  // ------------------------------------------------------------ KID
  function renderKid() {
    const me = user(S.me);
    const st = me.stats || {};
    const refazer = S.data.relatos.filter(r => r.status === 'refazer').length;
    let body = '';
    if (S.tab === 'home') body = kidHome();
    if (S.tab === 'loja') body = kidLoja();
    if (S.tab === 'rank') body = rankView();
    if (S.tab === 'mochila') body = mochila();
    const lidas = naoLidas();
    const mochilaN = S.data.resgates.filter(x => x.usuario === S.me && x.status === 'pendente').length;
    const trocaN = (S.data.trocas || []).filter(t => t.status === 'pendente' && t.para === S.me).length;
    const nav = `<nav class="nav">
        <span class="nav-ind"></span>
        <button data-tab="home" class="${S.tab === 'home' ? 'on' : ''}" onclick="A.tab('home')" aria-label="Início">🏠${refazer ? `<span class="dot">${refazer}</span>` : ''}</button>
        <button data-tab="loja" class="${S.tab === 'loja' ? 'on' : ''}" onclick="A.tab('loja')" aria-label="Loja">🛍️</button>
        <button data-tab="mochila" class="${S.tab === 'mochila' ? 'on' : ''}" onclick="A.tab('mochila')" aria-label="Mochila">🎒${trocaN ? `<span class="dot">${trocaN}</span>` : mochilaN ? `<span class="dot soft">${mochilaN}</span>` : ''}</button>
        <button data-tab="chat" data-badge="chat" class="${S.tab === 'chat' ? 'on' : ''}" onclick="A.tab('chat')" aria-label="Chat">💬${lidas && S.tab !== 'chat' ? `<span class="dot">${lidas}</span>` : ''}</button>
        <button data-tab="rank" class="${S.tab === 'rank' ? 'on' : ''}" onclick="A.tab('rank')" aria-label="Ranking">🏆</button>
      </nav>`;
    if (S.tab === 'chat') return chatPage() + nav;

    return `
      <div class="top">
        <label style="cursor:pointer">${avatar(S.me, 'ring-anim', true)}
          <input type="file" accept="image/*" hidden onchange="A.setFoto(this)"></label>
        <div class="who"><div class="eyebrow">Mesada</div><div class="name"><em>${esc(me.nome)}</em></div>
          <div class="sub">${st.streak ? `<span>🔥 <b class="mono">${st.streak}</b></span>` : ''}${st.media ? `<span>⭐ <b class="mono">${st.media}</b></span>` : ''}</div></div>
        <button class="icon-btn" onclick="A.reload()" aria-label="Atualizar">🔄</button>
      </div>
      <div class="balance-wrap">
        <div class="balance" data-tilt>
          <div class="shine"></div>
          <div class="coins">${[12, 34, 58, 80].map((l, i) => `<i style="left:${l}%;bottom:10px;animation-delay:${i * 1.5}s">🪙</i>`).join('')}</div>
          <div class="lbl">💰 <span class="eyebrow">saldo</span>
            <button class="pix-btn" onclick="event.stopPropagation();A.pix()" aria-label="Pix">💸</button></div>
          <div class="val" data-count="${st.saldo || 0}" data-key="saldo">${brl(st.saldo)}</div>
          <div class="chips">
            <span class="chip">📅 <span class="mono">${brl(st.semana)}</span></span>
            <span class="chip">🗓️ <span class="mono">${brl(st.mes)}</span></span>
            <span class="chip">✅ <span class="mono">${st.aprovados || 0}</span></span>
          </div>
        </div>
      </div>
      ${S.tab === 'home' ? `<button class="cta shimmer" onclick="A.compose()"><span class="ico">📸</span><span class="plus">+</span><span class="ico">🎤</span></button>` : ''}
      <div class="view">${body}</div>
      ${nav}`;
  }

  function kidHome() {
    // "refazer" primeiro; o resto mantém a ordem (mais novo primeiro)
    const rel = [...S.data.relatos].sort((a, b) => (b.status === 'refazer') - (a.status === 'refazer'));
    if (!rel.length) return `<div class="empty"><span class="big">📭</span></div>`;
    return `${sectionTitle('📜', '', rel.length)}
      <div class="list">${rel.map(relatoCard).join('')}</div>`;
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
          ${r.status === 'aprovado' ? stars(r.nota) : ''}
          <div class="date">${quando(r.criado_em)}</div>
        </div>
        ${r.audio_id ? `<button class="play small" onclick="A.play('${r.audio_id}', this)" aria-label="Ouvir">▶</button>` : ''}
      </div>
      ${r.status === 'refazer' ? `<div class="redo-box">
        ${r.resposta_audio_id ? `<button class="play small" style="background:var(--redo)" onclick="A.play('${r.resposta_audio_id}', this)">▶</button><span>🗣️</span>` : '<span style="font-size:22px">🔁</span>'}
        <button class="btn warn" onclick="A.compose('${r.id}')">📸 🎤</button>
      </div>` : ''}
    </div>`;
  }

  function kidLoja() {
    const saldo = user(S.me).stats?.saldo || 0;
    const itens = S.data.loja;
    return `
      ${sectionTitle('🛍️', 'Loja')}
      ${itens.length ? `<div class="shop">${itens.map(it => {
        const ok = saldo >= it.preco;
        const pct = Math.min(100, Math.round(saldo / it.preco * 100));
        return `<button class="card item ${ok ? 'can' : 'locked'}" onclick="A.buy('${it.id}')">
          ${ok ? '' : '<span class="lock">🔒</span>'}
          <div class="pic" ${it.imagem_id ? `data-media="${it.imagem_id}"` : ''}><span>${esc(it.emoji || '🎁')}</span></div>
          <div class="body"><div class="nm">${esc(it.nome)}</div><div class="pr">${brl(it.preco)}</div>
          ${ok ? '' : `<div class="progress"><i style="width:${pct}%"></i></div>`}</div>
        </button>`;
      }).join('')}</div>` : `<div class="empty"><span class="big">🏪</span></div>`}`;
  }

  function resgateRow(x, admin) {
    const icon = { pendente: '⏳', entregue: '🎁', cancelado: '↩️' }[x.status];
    return `<div class="card table-row">
      ${admin ? avatar(x.usuario, 'sm') : ''}
      <div style="font-size:30px">${esc(x.emoji || '🎁')}</div>
      <div class="grow"><div style="font-weight:700">${esc(x.nome)}</div><div class="muted small">${quando(x.criado_em)}</div></div>
      <div class="mono" style="font-weight:800">${brl(x.preco)}</div>
      ${admin && x.status === 'pendente'
        ? `<button class="btn ok" onclick="A.resgate('${x.id}','entregue')">✅ Atendi</button><button class="btn" onclick="A.resgate('${x.id}','cancelado')" aria-label="Cancelar">✖</button>`
        : `<span class="badge ${x.status}">${icon}</span>`}
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
          <div class="nm" style="color:${k.cor}">${esc(k.nome)}</div>
          <div class="v">${brl(k.v)}</div>
          <div class="bar" style="width:${k.v / max * 100}%;background:${k.cor};box-shadow:0 0 12px ${k.cor}"></div>
        </div>`).join('')}</div>
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

  function compose(refazerId) {
    const rasc = readDraft();
    const st = {
      fotos: rasc && (rasc.refazerId || '') === (refazerId || '') ? rasc.fotos : [],
      audio: null,
    };
    let recorder, enviando = false;
    const persist = () => saveDraft({ fotos: st.fotos, refazerId: refazerId || '' });
    const sh = openSheet(`
      <h2>${refazerId ? '🔁' : '📸'} <button class="btn ghost close" data-a="close" aria-label="Fechar">✖</button></h2>
      <div class="cmp-fotos"></div>
      <div class="cmp-rec"><div class="cmp-lbl">🎤 <span class="muted small">+</span></div><div data-rec></div></div>
      <div class="send-bar"><button class="btn big ok grow send-go" data-a="send" disabled>✅ <span class="send-n"></span></button></div>`, s => {
        recorder = mountRecorder(s.querySelector('[data-rec]'), a => { st.audio = a; });
        return () => recorder.stop();
      });

    const draw = () => {
      const box = sh.querySelector('.cmp-fotos');
      if (!st.fotos.length) {
        // sem foto ainda: dois botões gigantes
        box.innerHTML = `<div class="pick">
          <label aria-label="Câmera">📷<input type="file" accept="image/*" capture="environment"></label>
          <label aria-label="Galeria">🖼️<input type="file" accept="image/*" multiple></label></div>`;
      } else {
        // com fotos: grade + quadradinhos para adicionar mais (opcional)
        box.innerHTML = `<div class="shots ${st.fotos.length === 1 ? 'one' : ''}">
          ${st.fotos.map((url, i) => `<div class="shot" style="background-image:url('${url}')"><button data-del="${i}" aria-label="Remover">✖</button></div>`).join('')}
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
        try { st.fotos.push(await compressImage(f)); } catch { toast('⚠️ 📷', true); }
      }
      persist();
      draw();
      navigator.vibrate?.(15);
    };

    draw();
    if (st.fotos.length) toast('📸 ↩️');

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
        });
        saveDraft(null);
        closeSheet();
        confetti(['📸', '🎤', '✨', '🚀']);
        toast('🚀 ✅');
        load(true);
      } catch (err) {
        enviando = false;
        b.disabled = false;
        b.innerHTML = '✅ <span class="send-n"></span>';
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
      <h2><span class="mono">${brl(it.preco)}</span><button class="btn ghost close" data-a="close">✖</button></h2>
      <div class="card item" style="margin-bottom:16px"><div class="pic" ${it.imagem_id ? `data-media="${it.imagem_id}"` : ''} style="aspect-ratio:16/10;font-size:90px">${esc(it.emoji || '🎁')}</div>
        <div class="body"><div class="nm" style="font-size:18px">${esc(it.nome)}</div></div></div>
      ${ok ? `<div class="row"><button class="btn big grow" data-a="close">❌</button><button class="btn big ok grow" data-a="buy">✅ 🛒</button></div>`
           : `<div class="empty" style="padding:10px">🔒<p class="mono">${brl(saldo)} / ${brl(it.preco)}</p></div>`}`);
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
        toast('🎒 ✅');
        S.tab = 'mochila';
        load(true);
      } catch (err) { b.disabled = false; b.textContent = '✅ 🛒'; toast('⚠️ ' + err.message, true); }
    };
  }

  // ------------------------------------------------------------ ADMIN
  function renderAdmin() {
    const d = S.data;
    const fila = d.relatos.filter(r => r.status === 'pendente').sort((a, b) => a.criado_em < b.criado_em ? -1 : 1);
    const resg = d.resgates.filter(r => r.status === 'pendente');
    const tabs = [
      ['fila', '📥 Fila', fila.length],
      ['resgates', '🎒 Itens', resg.length],
      ['chat', '💬 Chat', naoLidas()],
      ['loja', '🛍️ Loja'],
      ['hist', '📜 Histórico'],
      ['rank', '🏆 Ranking'],
    ];
    let body = '';
    if (S.adminTab === 'fila') body = fila.length ? `<div class="admin-grid">${fila.map(reviewCard).join('')}</div>` : `<div class="empty"><span class="big">🎉</span><p>Nada para avaliar. Tudo em dia.</p></div>`;
    if (S.adminTab === 'resgates') body = adminResgates();
    if (S.adminTab === 'loja') body = adminLoja();
    if (S.adminTab === 'hist') body = adminHist();
    if (S.adminTab === 'rank') body = rankView();
    if (S.adminTab === 'chat') body = chatPage();

    return `
      <div class="top">
        <label style="cursor:pointer">${avatar(ADMIN, 'ring-anim', true)}<input type="file" accept="image/*" hidden onchange="A.setFoto(this)"></label>
        <div class="who"><div class="eyebrow">Painel de controle</div><div class="name">Olá, <em>${esc(user(ADMIN).nome)}</em></div>
          <div class="sub">${fila.length ? `<span class="badge pendente"><span class="live"></span>${fila.length} relato${fila.length > 1 ? 's' : ''} esperando</span>` : 'Tudo avaliado ✨'}</div></div>
        <button class="icon-btn" onclick="A.reload()" aria-label="Atualizar">🔄</button>
      </div>
      <div class="hero-admin">${KIDS.map(id => {
        const u = user(id), st = u.stats || {};
        const pend = fila.filter(r => r.usuario === id).length;
        return `<div class="card kid-card"><span class="glow-blob" style="background:${u.cor}"></span>${avatar(id, '')}<div class="grow">
          <div class="nm" style="color:${u.cor}">${esc(u.nome)}</div>
          <div class="v" data-count="${st.saldo || 0}" data-key="saldo-${id}">${brl(st.saldo)}</div>
          <div class="muted small mono">📅 ${brl(st.semana)} · ⏳ ${pend} · ⭐ ${st.media || '–'} · 🔥 ${st.streak || 0}</div></div></div>`;
      }).join('')}
        <div class="card kpi"><div class="eyebrow">Pago este mês</div>
          <div class="v" data-count="${KIDS.reduce((s, id) => s + (user(id).stats?.mes || 0), 0)}" data-key="mes-total">–</div>
          <div class="muted small mono">semana ${brl(KIDS.reduce((s, id) => s + (user(id).stats?.semana || 0), 0))}</div></div>
      </div>
      <div class="tabs-top mt">${tabs.map(([k, t, n]) => `<button class="${S.adminTab === k ? 'on' : ''}" ${k === 'chat' ? 'data-badge="chat"' : ''} onclick="A.adminTab('${k}')">${t}${n ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>
      <div class="mt">${body}</div>`;
  }

  function reviewCard(r) {
    const u = user(r.usuario);
    const st = review[r.id] || (review[r.id] = { nota: 0, valor: '' });
    return `<div class="card review" data-id="${r.id}">
      <div class="photo" data-media="${fotosDe(r)[0]}" onclick="A.gallery('${fotosDe(r).join(',')}')">📷</div>
      <div class="photo-meta" style="position:relative;margin-top:-56px;height:56px;pointer-events:none">
        <span class="who" style="position:absolute;left:14px;bottom:12px;display:flex;align-items:center;gap:10px;font:700 20px var(--font-display);color:${u.cor}">${avatar(r.usuario, 'sm')}${esc(u.nome)}</span>
      </div>
      <div class="body">
        ${fotosDe(r).length > 1 ? `<div class="strip">${fotosDe(r).map((id, i) => `<div class="thumb sm" data-media="${id}" onclick="A.gallery('${fotosDe(r).join(',')}', ${i})">📷</div>`).join('')}</div>` : ''}
        <div class="row small muted mono"><span>${quando(r.criado_em)}</span>${r.tentativas > 1 ? `<span class="badge refazer" style="margin-left:auto;font-size:12px">🔁 ${r.tentativas - 1}ª refeita</span>` : ''}</div>
        ${r.audio_id ? `<div class="row"><button class="play" onclick="A.play('${r.audio_id}', this)">▶</button><span class="muted">Ouvir o relato</span></div>` : '<div class="muted small">🔇 Sem áudio</div>'}
        <div class="star-pick">${Array.from({ length: 10 }, (_, i) =>
          `<button class="${i < st.nota ? 'on' : ''}" onclick="A.nota('${r.id}', ${i + 1})" aria-label="${i + 1}">⭐</button>`).join('')}</div>
        <div class="money-in"><span>R$</span><input inputmode="decimal" placeholder="0,00" value="${esc(st.valor)}"
          oninput="A.valor('${r.id}', this.value)"><span class="mono">${st.nota ? st.nota + '/10' : ''}</span></div>
        <div class="quick">${['0,10', '0,50', '1,00', '2,00', '5,00', '10,00'].map(v =>
          `<button onclick="A.valor('${r.id}', '${v}', true)">${v}</button>`).join('')}</div>
        <div class="row"><button class="btn warn" onclick="A.refazer('${r.id}')">🔁 Refazer</button>
          <button class="btn ok grow" onclick="A.aprovar('${r.id}', this)">✅ Aprovar</button></div>
      </div></div>`;
  }

  function adminResgates() {
    const all = S.data.resgates;
    const pend = all.filter(x => x.status === 'pendente');
    const hist = all.filter(x => x.status !== 'pendente');
    return `
      <div class="section-title">🎒 Na mochila, esperando você <span class="count">${pend.length}</span></div>
      ${pend.length ? `<div class="list">${pend.map(x => resgateRow(x, true)).join('')}</div>` : '<p class="muted">Nenhum item esperando.</p>'}
      <p class="muted small">Comprou, fica na mochila até você marcar <b>Atendi</b>. Eles podem trocar itens da mochila entre si. Se cancelar, o valor volta para o saldo de quem estiver com o item.</p>
      ${(S.data.trocas || []).filter(t => t.status === 'pendente').length ? `<div class="section-title">🔄 Trocas em aberto</div>
        <div class="list">${S.data.trocas.filter(t => t.status === 'pendente').map(t => `<div class="card">${trocaCard(t)}</div>`).join('')}</div>` : ''}
      ${hist.length ? `<div class="section-title">📜 Histórico</div><div class="list">${hist.map(x => resgateRow(x, true)).join('')}</div>` : ''}`;
  }

  function adminLoja() {
    return `
      <button class="btn primary" onclick="A.editItem()">➕ Novo item</button>
      <div class="shop mt">${S.data.loja.map(it => `
        <button class="card item" onclick="A.editItem('${it.id}')">
          <div class="pic" ${it.imagem_id ? `data-media="${it.imagem_id}"` : ''}>${esc(it.emoji || '🎁')}</div>
          <div class="body"><div class="nm">${esc(it.nome)}</div><div class="pr mono">${brl(it.preco)}</div></div>
        </button>`).join('')}</div>
      ${S.data.loja.length ? '' : '<div class="empty">🏪<p>Cadastre o primeiro prêmio.</p></div>'}`;
  }

  function adminHist() {
    const rel = S.data.relatos.filter(r => r.status !== 'pendente');
    if (!rel.length) return '<div class="empty">📭<p>Nenhum relato avaliado ainda.</p></div>';
    return `<div class="list">${rel.map(r => `
      <div class="card relato">
        ${thumb(r)}
        <div class="info">
          <div class="row">${avatar(r.usuario, 'sm')}<b style="color:${user(r.usuario).cor}">${esc(user(r.usuario).nome)}</b>${badge(r)}</div>
          ${r.status === 'aprovado' ? stars(r.nota) : ''}
          <div class="date">${quando(r.criado_em)}</div>
        </div>
        ${r.audio_id ? `<button class="play small" onclick="A.play('${r.audio_id}', this)">▶</button>` : ''}
      </div>`).join('')}</div>`;
  }

  function editItem(id) {
    const it = id ? S.data.loja.find(i => i.id === id) : { nome: '', emoji: '🎁', preco: '' };
    let imagem = null, removerImagem = false;
    const sh = openSheet(`
      <h2>${id ? '✏️ Editar item' : '➕ Novo item'}<button class="btn ghost close" data-a="close">✖</button></h2>
      <div class="list">
        <div class="field"><label>Nome</label><input class="input" name="nome" value="${esc(it.nome)}" placeholder="Ex: 1h de videogame"></div>
        <div class="row">
          <div class="field" style="width:96px"><label>Emoji</label><input class="input" name="emoji" value="${esc(it.emoji)}" style="text-align:center;font-size:22px"></div>
          <div class="field grow"><label>Preço</label><div class="money-in"><span>R$</span><input name="preco" inputmode="decimal" value="${it.preco ? (it.preco / 100).toFixed(2).replace('.', ',') : ''}" placeholder="0,00"></div></div>
        </div>
        <div class="field"><label>Imagem (opcional — se não tiver, usa o emoji)</label>
          <div class="item card"><div class="pic" data-pic ${it.imagem_id ? `data-media="${it.imagem_id}"` : ''} style="aspect-ratio:16/9">${esc(it.emoji || '🎁')}</div></div>
          <div class="row"><label class="btn grow">🖼️ Escolher<input type="file" accept="image/*" hidden name="img"></label>
          ${it.imagem_id ? '<button class="btn" data-a="noimg">🗑️ Tirar</button>' : ''}</div>
        </div>
        <div class="row mt">${id ? '<button class="btn" data-a="del">🗑️ Remover</button>' : ''}
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
      if (a === 'del' && !confirm('Remover este item da loja?')) return;
      const val = n => sh.querySelector(`[name=${n}]`).value.trim();
      const preco = parseMoney(val('preco'));
      if (a === 'save' && (!val('nome') || !(preco >= 1))) return toast('Preencha o nome e o preço', true);
      b.disabled = true;
      try {
        if (a === 'del') await api('lojaRemover', { id });
        else await api('lojaSalvar', { item: { id: id || '', nome: val('nome'), emoji: val('emoji'), preco, imagem, removerImagem } });
        closeSheet();
        toast(a === 'del' ? 'Item removido' : 'Item salvo ✅');
        load(true);
      } catch (err) { b.disabled = false; toast('⚠️ ' + err.message, true); }
    };
  }

  function refazer(id) {
    let resposta = null, recorder;
    const sh = openSheet(`
      <h2>🔁 Pedir para refazer<button class="btn ghost close" data-a="close">✖</button></h2>
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

  async function aprovar(id, btn) {
    const st = review[id] || {};
    const valor = parseMoney(st.valor);
    if (!st.nota) return toast('Dê uma nota de 1 a 10 ⭐', true);
    if (!(valor >= 1 && valor <= 1000)) return toast('O valor precisa ser de R$ 0,01 a R$ 10,00', true);
    btn.disabled = true;
    btn.innerHTML = '<div class="spin sm"></div>';
    try {
      await api('avaliar', { id, status: 'aprovado', nota: st.nota, valor });
      delete review[id];
      toast(`✅ ${brl(valor)} aprovado`);
      load(true);
    } catch (err) { btn.disabled = false; btn.textContent = '✅ Aprovar'; toast('⚠️ ' + err.message, true); }
  }

  // ------------------------------------------------------------ MOCHILA / PIX / TROCAS
  const outro = k => (k === 'cesar' ? 'arthur' : 'cesar');
  const itemPic = (x, cls = '') =>
    `<div class="pic ${cls}" ${x.imagem_id ? `data-media="${x.imagem_id}"` : ''}><span>${esc(x.emoji || '🎁')}</span></div>`;
  const lojaItem = x => S.data.loja.find(i => i.id === x.item_id) || {};

  function mochila() {
    const meus = S.data.resgates.filter(x => x.usuario === S.me);
    const pend = meus.filter(x => x.status === 'pendente');
    const feitos = meus.filter(x => x.status === 'entregue');
    const trocas = (S.data.trocas || []).filter(t => t.status === 'pendente');
    return `
      ${sectionTitle('🎒', 'Mochila', pend.length)}
      ${pend.length ? `<div class="inv-grid">${pend.map(x => `
        <div class="card item inv">${itemPic({ ...x, imagem_id: lojaItem(x).imagem_id })}
          <span class="badge pendente inv-st"><span class="live"></span>⏳</span>
          <div class="body"><div class="nm">${esc(x.nome)}</div><div class="pr">${brl(x.preco)}</div></div>
        </div>`).join('')}</div>` : `<div class="empty"><span class="big">🎒</span></div>`}
      <div class="row mt duo">
        <button class="btn big grow" onclick="A.pix()">💸</button>
        <button class="btn big grow" onclick="A.troca()">🔄</button>
      </div>
      ${trocas.length ? `${sectionTitle('🔄', '', trocas.length)}<div class="list">${trocas.map(t => `<div class="card">${trocaCard(t)}</div>`).join('')}</div>` : ''}
      ${feitos.length ? `${sectionTitle('✅', '', feitos.length)}<div class="list">${feitos.map(x => `
        <div class="card table-row"><div style="font-size:28px">${esc(x.emoji || '🎁')}</div>
          <div class="grow"><div style="font-weight:700">${esc(x.nome)}</div><div class="muted small">${quando(x.atualizado_em)}</div></div>
          <span class="badge entregue">🎁 ✅</span></div>`).join('')}</div>` : ''}`;
  }

  function trocaCard(t) {
    if (!t) return '<div class="txt">🔄</div>';
    const itens = ids => String(ids || '').split(',').filter(Boolean)
      .map(id => S.data.resgates.find(x => x.id === id) || { emoji: '🎁', nome: '?' });
    const lado = (k, ids, v) => {
      const its = itens(ids);
      return `<div class="tside">${avatar(k, 'xs')}<div class="titems">
        ${its.map(x => `<span class="tit">${esc(x.emoji || '🎁')}<small>${esc(x.nome)}</small></span>`).join('')}
        ${v ? `<span class="tit money">💰<small class="mono">${brl(v)}</small></span>` : ''}
        ${!its.length && !v ? '<span class="muted">—</span>' : ''}</div></div>`;
    };
    const ico = { pendente: '⏳', aceita: '✅', recusada: '❌', cancelada: '↩️' }[t.status];
    const cls = { pendente: 'pendente', aceita: 'aprovado', recusada: 'cancelado', cancelada: 'cancelado' }[t.status];
    let acts = '';
    if (t.status === 'pendente') {
      if (S.me === t.para) acts = `<button class="btn" onclick="A.trocaStatus('${t.id}','recusada')" aria-label="Recusar">❌</button>
        <button class="btn ok grow" onclick="A.trocaStatus('${t.id}','aceita')" aria-label="Aceitar">✅ 🤝</button>`;
      else if (S.me === t.de || S.me === ADMIN) acts = `<button class="btn" style="margin-left:auto" onclick="A.trocaStatus('${t.id}','cancelada')" aria-label="Cancelar">↩️</button>`;
    }
    return `<div class="troca">${lado(t.de, t.dar_itens, t.dar_valor)}<div class="tx">⇅</div>${lado(t.para, t.pedir_itens, t.pedir_valor)}
      <div class="row tfoot"><span class="badge ${cls}">${t.status === 'pendente' ? '<span class="live"></span>' : ''}🔄 ${ico}</span>${acts}</div></div>`;
  }

  function pixSheet() {
    const saldo = user(S.me).stats?.saldo || 0;
    const para = outro(S.me);
    const sh = openSheet(`
      <h2>💸 Pix<button class="btn ghost close" data-a="close">✖</button></h2>
      <div class="pix-to">${avatar(S.me, 'md')}<span class="arrow">➜</span>${avatar(para, 'md')}</div>
      <div class="money-in big-money"><span>R$</span><input name="v" inputmode="decimal" placeholder="0,00"></div>
      <div class="quick">${['0,50', '1,00', '2,00', '5,00', '10,00'].map(v => `<button data-q="${v}">${v}</button>`).join('')}
        <button data-q="${(saldo / 100).toFixed(2).replace('.', ',')}">💰 tudo</button></div>
      <div class="muted small mono" style="text-align:center;margin:10px 0">💰 ${brl(saldo)}</div>
      <input class="input" name="msg" maxlength="200" placeholder="💬">
      <button class="btn ok big mt" style="width:100%" data-a="send">✅ 💸</button>`);
    sh.onclick = async e => {
      const q = e.target.closest('[data-q]');
      if (q) { sh.querySelector('[name=v]').value = q.dataset.q; return; }
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'close') return closeSheet();
      const valor = parseMoney(sh.querySelector('[name=v]').value);
      if (!(valor >= 1)) return toast('💸 ?', true);
      if (valor > saldo) return toast('🔒 ' + brl(saldo), true);
      b.disabled = true;
      b.innerHTML = '<div class="spin sm"></div>';
      try {
        await api('pix', { valor, texto: sh.querySelector('[name=msg]').value.trim() });
        closeSheet();
        confetti(['💸', '💰', '🪙', '✨']);
        toast(`💸 ${brl(valor)} ➜ ${user(para).nome}`);
        load(true);
      } catch (err) { b.disabled = false; b.textContent = '✅ 💸'; toast('⚠️ ' + err.message, true); }
    };
  }

  function trocaSheet() {
    const para = outro(S.me);
    const st = { dar: new Set(), pedir: new Set() };
    const inv = k => S.data.resgates.filter(x => x.usuario === k && x.status === 'pendente');
    const grid = (k, set) => inv(k).length
      ? `<div class="pick-items">${inv(k).map(x => `<button class="pi" data-pi="${set}:${x.id}">${esc(x.emoji || '🎁')}<small>${esc(x.nome)}</small></button>`).join('')}</div>`
      : '<div class="muted small" style="padding:8px 2px">🎒 —</div>';
    const sh = openSheet(`
      <h2>🔄 Troca<button class="btn ghost close" data-a="close">✖</button></h2>
      <div class="tsec"><div class="row">${avatar(S.me, 'sm')}<b>📤</b></div>${grid(S.me, 'dar')}
        <div class="money-in sm"><span>+ R$</span><input name="darValor" inputmode="decimal" placeholder="0,00"></div></div>
      <div class="tx big">⇅</div>
      <div class="tsec"><div class="row">${avatar(para, 'sm')}<b>📥</b></div>${grid(para, 'pedir')}
        <div class="money-in sm"><span>+ R$</span><input name="pedirValor" inputmode="decimal" placeholder="0,00"></div></div>
      <button class="btn ok big mt" style="width:100%" data-a="send">✅ 🔄</button>`);
    hydrate(sh);
    sh.onclick = async e => {
      const pi = e.target.closest('[data-pi]');
      if (pi) {
        const [set, id] = pi.dataset.pi.split(':');
        st[set].has(id) ? st[set].delete(id) : st[set].add(id);
        pi.classList.toggle('on', st[set].has(id));
        navigator.vibrate?.(8);
        return;
      }
      const b = e.target.closest('[data-a]');
      if (!b) return;
      if (b.dataset.a === 'close') return closeSheet();
      const darValor = parseMoney(sh.querySelector('[name=darValor]').value) || 0;
      const pedirValor = parseMoney(sh.querySelector('[name=pedirValor]').value) || 0;
      if (!st.dar.size && !st.pedir.size) return toast('🎁 ?', true);
      b.disabled = true;
      b.innerHTML = '<div class="spin sm"></div>';
      try {
        await api('propor', { dar: [...st.dar], pedir: [...st.pedir], darValor, pedirValor });
        closeSheet();
        toast('🔄 ➜ ' + user(para).nome);
        load(true);
      } catch (err) { b.disabled = false; b.textContent = '✅ 🔄'; toast('⚠️ ' + err.message, true); }
    };
  }

  async function trocaStatus(id, status) {
    if (status === 'aceita' && !confirm('🤝 ✅ ?')) return;
    try {
      await api('trocaStatus', { id, status });
      if (status === 'aceita') confetti(['🤝', '🔄', '🎁', '✨']);
      load(true);
    } catch (err) { toast('⚠️ ' + err.message, true); }
  }

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
        return `<div class="bpix"><div class="pix-ico">💸</div><div class="grow"><div class="pv mono">${brl(v)}</div>
          <div class="pto">➜ ${avatar(para, 'xs')}<b style="color:${user(para).cor}">${esc(user(para).nome)}</b></div></div></div>
          ${m.texto ? `<div class="txt">${esc(m.texto)}</div>` : ''}`;
      }
      case 'troca':
        return trocaCard((S.data.trocas || []).find(t => t.id === m.ref));
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
    const card = ['pix', 'troca'].includes(m.tipo);
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
        <div class="stack">${Object.keys(USERS).map(id => avatar(id, 'sm')).join('')}</div>
        <div class="grow"><div class="ttl">👨‍👦‍👦</div><div class="muted small">${Object.keys(USERS).map(id => esc(user(id).nome)).join(', ')}</div></div>
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
      <div class="cfield"><textarea rows="1" placeholder="💬" data-c-input>${esc(S.draft || '')}</textarea>
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
    const msgs = S.chat.msgs;
    const sig = JSON.stringify([msgs.map(m => m.id + m.tipo + (m.pending ? 1 : 0)), S.chat.vistos, (S.data.trocas || []).map(t => t.id + t.status)]);
    if (!force && sig === S.chat.sig) return;
    if (!force && !player.paused) return; // não corta o áudio que está tocando
    S.chat.sig = sig;
    const doc = document.scrollingElement;
    const pertoDoFim = force || doc.scrollHeight - (scrollY + innerHeight) < 220;
    list.innerHTML = msgs.length
      ? msgs.map((m, i) => msgHtml(m, msgs[i - 1])).join('')
      : '<div class="empty"><span class="big">💬</span></div>';
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
      // pix/troca novos mudam saldo e mochila: busca o resto em segundo plano
      if (res.msgs.some(m => ['pix', 'troca', 'sistema'].includes(m.tipo) && m.usuario !== S.me) && !first) load(true);
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
        if (f.size > MAX_VIDEO) return toast('🎥 máx. 15 MB', true);
        const posterUrl = await videoPoster(f);
        return enviarMidia('video', await fileToDataUrl(f), { posterUrl });
      }
      if (f.size > MAX_FILE) return toast('📄 máx. 10 MB', true);
      if (f.type.startsWith('audio/')) return enviarMidia('audio', await fileToDataUrl(f));
      if (f.type === 'image/gif') return enviarMidia('imagem', await fileToDataUrl(f));
      const url = await fileToDataUrl(f);
      return enviarMidia('arquivo', url.startsWith('data:;') ? url.replace('data:;', 'data:application/octet-stream;') : url, { nome: f.name });
    } catch (err) { toast('⚠️ ' + (err.message || 'arquivo'), true); }
  }

  function anexos() {
    const kid = S.me !== ADMIN;
    const sh = openSheet(`
      <h2>📎<button class="btn ghost close" data-a="close">✖</button></h2>
      <div class="attach-grid">
        <label class="att" style="--c:#a855f7">🖼️<input type="file" accept="image/*,video/*" multiple hidden></label>
        <label class="att" style="--c:#ef4444">📷<input type="file" accept="image/*" capture="environment" hidden></label>
        <label class="att" style="--c:#f97316">🎥<input type="file" accept="video/*" capture="environment" hidden></label>
        <label class="att" style="--c:#3b82f6">📄<input type="file" hidden></label>
        ${kid ? `<button class="att" style="--c:#22c55e" data-a="pix">💸</button>
        <button class="att" style="--c:#eab308" data-a="troca">🔄</button>` : ''}
      </div>`);
    sh.querySelectorAll('input[type=file]').forEach(inp => {
      inp.onchange = () => { const fs = [...inp.files]; closeSheet(); fs.forEach(enviarArquivo); };
    });
    sh.onclick = e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'close') closeSheet();
      if (a === 'pix') pixSheet();
      if (a === 'troca') trocaSheet();
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
    catch { stream.getTracks().forEach(t => t.stop()); return toast('🎤 ⚠️', true); }
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
      z.innerHTML = `<video src="${url}" controls autoplay playsinline></video><button class="icon-btn gal-x">✖</button>`;
      z.querySelector('.gal-x').onclick = () => { z.querySelector('video').pause(); URL.revokeObjectURL(url); z.remove(); };
    } catch (e) { z.remove(); toast('⚠️ ' + e.message, true); }
  }

  async function baixar(id, nome) {
    try {
      toast('⬇️');
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
    if (!m || m.pending || ['pix', 'troca', 'sistema', 'apagada'].includes(m.tipo)) return;
    if (m.usuario !== S.me && S.me !== ADMIN) return;
    navigator.vibrate?.(40);
    if (!confirm('🗑️ ?')) return;
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
    compose, buy, editItem, refazer, aprovar, trocaStatus,
    pix: () => pixSheet(),
    troca: () => trocaSheet(),
    play: (id, btn) => playMedia(id, btn),
    zoomMedia: async id => { await getMedia([id]); media.has(id) && zoom(media.get(id)); },
    gallery: async (ids, start = 0) => {
      const list = String(ids).split(',').filter(Boolean);
      if (list.length === 1) return A.zoomMedia(list[0]);
      const z = document.createElement('div');
      z.className = 'zoom gal-wrap';
      z.innerHTML = `<div class="gal">${list.map(() => '<div class="slide"><div class="spin"></div></div>').join('')}</div>
        <div class="gal-dots">${list.map((_, i) => `<i class="${i === start ? 'on' : ''}"></i>`).join('')}</div>
        <button class="icon-btn gal-x">✖</button>`;
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
      if (fill) document.querySelector(`[data-id="${id}"] .money-in input`).value = v;
    },
    resgate: async (id, status) => {
      if (status === 'cancelado' && !confirm('Cancelar e devolver o saldo?')) return;
      try { await api('resgateStatus', { id, status }); toast(status === 'entregue' ? '🎁 Entregue' : '↩️ Cancelado'); load(true); }
      catch (err) { toast('⚠️ ' + err.message, true); }
    },
    setFoto: async input => {
      const f = input.files[0];
      input.value = '';
      if (!f) return;
      try {
        const url = await compressImage(f, 400, .8);
        toast('⏳');
        const { foto_id } = await api('setFoto', { foto: splitDataUrl(url) });
        media.set(foto_id, url);
        user(S.me).foto_id = foto_id;
        render();
        toast('✅');
      } catch (err) { toast('⚠️ ' + err.message, true); }
    },
  };

  // ------------------------------------------------------------ efeitos globais
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

  // spotlight: o brilho do card segue o dedo/mouse
  document.addEventListener('pointermove', e => {
    const el = e.target.closest?.('.card, .glass');
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  }, { passive: true });

  // ripple no toque + spotlight aceso no mobile
  document.addEventListener('pointerdown', e => {
    const card = e.target.closest?.('.card');
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
      card.classList.add('lit');
      setTimeout(() => card.classList.remove('lit'), 500);
    }
    const b = e.target.closest?.('.btn, .cta, .nav button, .icon-btn');
    if (!b || calm) return;
    const r = b.getBoundingClientRect();
    const s = Math.max(r.width, r.height);
    const rip = document.createElement('span');
    rip.className = 'ripple';
    rip.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden';
    b.appendChild(rip);
    setTimeout(() => rip.remove(), 650);
  }, { passive: true });

  // inclinação 3D do cartão de saldo (mouse/dedo e giroscópio)
  const tilt = (x, y) => {
    const el = document.querySelector('[data-tilt]');
    if (el) el.style.transform = `rotateY(${x * 4}deg) rotateX(${-y * 4}deg)`;
  };
  if (!calm) {
    document.addEventListener('pointermove', e => {
      const el = e.target.closest?.('[data-tilt]');
      if (!el) return tilt(0, 0);
      const r = el.getBoundingClientRect();
      tilt((e.clientX - r.left) / r.width - .5, (e.clientY - r.top) / r.height - .5);
    }, { passive: true });
    window.addEventListener('deviceorientation', e => {
      if (e.gamma == null) return;
      tilt(Math.max(-1, Math.min(1, e.gamma / 30)) * .5, Math.max(-1, Math.min(1, (e.beta - 45) / 30)) * .5);
    }, { passive: true });
  }

  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.me && S.data && !S.fetching && !busy()) load(true, true);
  });
  route();
})();
