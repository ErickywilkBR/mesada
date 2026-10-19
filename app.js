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

  const S = { me: null, data: null, tab: 'home', rank: 'saldo', adminTab: 'fila', loading: false };
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
    S.tab = 'home';
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
      S.json = json;
      S.data = data;
      if (auto && saldoAntes != null && (user(me).stats?.saldo || 0) > saldoAntes) confetti(['💰', '🪙', '⭐']);
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
    const idx = ['home', 'loja', 'rank'].indexOf(S.tab);
    const prev = ['home', 'loja', 'rank'].indexOf(S.prevTab ?? S.tab);
    ind.style.transition = 'none';
    ind.style.transform = `translateX(${prev * 76}px)`;
    requestAnimationFrame(() => requestAnimationFrame(() => {
      ind.style.transition = '';
      ind.style.transform = `translateX(${idx * 76}px)`;
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
          <div class="lbl">💰 <span class="eyebrow">saldo</span></div>
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
      <nav class="nav">
        <span class="nav-ind"></span>
        <button class="${S.tab === 'home' ? 'on' : ''}" onclick="A.tab('home')" aria-label="Início">🏠${refazer ? `<span class="dot">${refazer}</span>` : ''}</button>
        <button class="${S.tab === 'loja' ? 'on' : ''}" onclick="A.tab('loja')" aria-label="Loja">🛍️</button>
        <button class="${S.tab === 'rank' ? 'on' : ''}" onclick="A.tab('rank')" aria-label="Ranking">🏆</button>
      </nav>`;
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
    const meus = S.data.resgates;
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
      }).join('')}</div>` : `<div class="empty"><span class="big">🏪</span></div>`}
      ${meus.length ? `${sectionTitle('🎁', '', meus.length)}
        <div class="list">${meus.map(x => resgateRow(x)).join('')}</div>` : ''}`;
  }

  function resgateRow(x, admin) {
    const icon = { pendente: '⏳', entregue: '🎁', cancelado: '↩️' }[x.status];
    return `<div class="card table-row">
      ${admin ? avatar(x.usuario, 'sm') : ''}
      <div style="font-size:30px">${esc(x.emoji || '🎁')}</div>
      <div class="grow"><div style="font-weight:700">${esc(x.nome)}</div><div class="muted small">${quando(x.criado_em)}</div></div>
      <div class="mono" style="font-weight:800">${brl(x.preco)}</div>
      ${admin && x.status === 'pendente'
        ? `<button class="btn ok" onclick="A.resgate('${x.id}','entregue')">✅</button><button class="btn" onclick="A.resgate('${x.id}','cancelado')">✖</button>`
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

  // compor relato (novo ou refazer)
  function compose(refazerId) {
    const MAX = 6;
    const st = { fotos: [], audio: null };
    let recorder;
    const sh = openSheet(`
      <h2>${refazerId ? '🔁' : '➕'} <button class="btn ghost close" data-a="close">✖</button></h2>
      <div class="steps"><i class="on"></i><i></i></div>
      <div data-step="1">
        <div class="pick">
          <label>📷<input type="file" accept="image/*" capture="environment"></label>
          <label>🖼️<input type="file" accept="image/*" multiple></label>
        </div>
      </div>
      <div data-step="2" hidden>
        <div class="shots"></div>
        <div data-rec></div>
        <div class="row mt"><button class="btn big" data-a="back">⬅️</button>
          <button class="btn big ok grow" data-a="send">✅</button></div>
      </div>`, s => {
        recorder = mountRecorder(s.querySelector('[data-rec]'), a => { st.audio = a; });
        return () => recorder.stop();
      });

    const step = n => {
      sh.querySelectorAll('[data-step]').forEach(el => (el.hidden = el.dataset.step != n));
      sh.querySelectorAll('.steps i').forEach((el, i) => el.classList.toggle('on', i < n));
    };

    // grade de fotos escolhidas, com ✖ em cada uma e blocos para adicionar mais
    const drawShots = () => {
      const cheio = st.fotos.length >= MAX;
      sh.querySelector('.shots').innerHTML = st.fotos.map((url, i) =>
        `<div class="shot" style="background-image:url('${url}')"><button data-del="${i}" aria-label="Remover">✖</button></div>`).join('') +
        (cheio ? '' : `<label class="shot add">📷<input type="file" accept="image/*" capture="environment" hidden></label>
          <label class="shot add">🖼️<input type="file" accept="image/*" multiple hidden></label>`);
      sh.querySelectorAll('.shots input').forEach(bind);
      if (!st.fotos.length) step(1);
    };

    const addFiles = async files => {
      const livres = MAX - st.fotos.length;
      if (files.length > livres) toast(`📷 máx. ${MAX}`, true);
      for (const f of files.slice(0, livres)) {
        try { st.fotos.push(await compressImage(f)); } catch { toast('⚠️ Foto inválida', true); }
      }
      if (st.fotos.length) { drawShots(); step(2); }
    };

    function bind(inp) {
      inp.onchange = () => { const fs = [...inp.files]; inp.value = ''; if (fs.length) addFiles(fs); };
    }
    sh.querySelectorAll('.pick input').forEach(bind);

    sh.onclick = async e => {
      const del = e.target.closest('[data-del]');
      if (del) { st.fotos.splice(Number(del.dataset.del), 1); drawShots(); return; }
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'close') closeSheet();
      if (a === 'back') step(1);
      if (a === 'send') {
        const btn = e.target.closest('[data-a]');
        btn.disabled = true;
        btn.innerHTML = '<div class="spin sm"></div>';
        try {
          await api('novoRelato', {
            fotos: st.fotos.map(splitDataUrl),
            audio: st.audio ? { mime: st.audio.mime, data: st.audio.data } : null,
            refazerId: refazerId || '',
          });
          closeSheet();
          confetti(['📸', '🎤', '✨', '🚀']);
          toast('🚀 ✅');
          load(true);
        } catch (err) {
          btn.disabled = false;
          btn.textContent = '✅';
          toast('⚠️ ' + err.message, true);
        }
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
        confetti(['🎁', '🛍️', '🎉']);
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
      ['resgates', '🎁 Resgates', resg.length],
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
      <div class="tabs-top mt">${tabs.map(([k, t, n]) => `<button class="${S.adminTab === k ? 'on' : ''}" onclick="A.adminTab('${k}')">${t}${n ? `<span class="n">${n}</span>` : ''}</button>`).join('')}</div>
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
      <div class="section-title">⏳ Pendentes <span class="count">${pend.length}</span></div>
      ${pend.length ? `<div class="list">${pend.map(x => resgateRow(x, true)).join('')}</div>` : '<p class="muted">Nenhum resgate pendente.</p>'}
      <p class="muted small">O saldo é reservado quando o pedido é feito. Se você cancelar, o valor volta para o saldo.</p>
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

  // ------------------------------------------------------------ ações globais
  window.A = {
    reload: () => load(),
    tab: t => { if (S.tab === t) return; S.tab = t; render(true); scrollTo({ top: 0, behavior: 'smooth' }); navigator.vibrate?.(8); },
    adminTab: t => { S.adminTab = t; render(true); },
    rank: k => { S.rank = k; render(true); },
    compose, buy, editItem, refazer, aprovar,
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
