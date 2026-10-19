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
    for (let i = 0; i < 28; i++) {
      const e = document.createElement('i');
      e.textContent = emojis[i % emojis.length];
      e.style.left = Math.random() * 100 + 'vw';
      e.style.animationDelay = Math.random() * .5 + 's';
      c.appendChild(e);
    }
    document.body.appendChild(c);
    setTimeout(() => c.remove(), 2300);
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
    const r = document.documentElement.style;
    r.setProperty('--accent', cor);
    r.setProperty('--accent-soft', hexA(cor, id === ADMIN ? .08 : .16));
    document.title = `${USERS[id].nome} · Mesada`;
    document.body.className = id === ADMIN ? 'admin' : 'kid';
    load();
  }

  async function load(silent) {
    if (!silent) $app.innerHTML = `<div class="loader"><div class="spin"></div></div>`;
    const me = S.me;
    try {
      const data = await api('bootstrap');
      if (me !== S.me) return;
      S.data = data;
      render();
    } catch (e) {
      if (!silent) $app.innerHTML = `<div class="loader"><div style="font-size:48px">⚠️</div><p>${esc(e.message)}</p>
        <button class="btn primary" onclick="A.reload()">🔄</button></div>`;
      else toast('⚠️ ' + e.message, true);
    }
  }

  function render() {
    if (!S.data) return;
    $app.innerHTML = S.me === ADMIN ? renderAdmin() : renderKid();
    hydrate($app);
  }

  // ------------------------------------------------------------ componentes
  function avatar(id, cls = '', cam = false) {
    const u = user(id);
    return `<div class="avatar ${cls}" style="border-color:${u.cor}" ${u.foto_id ? `data-media="${u.foto_id}"` : ''}>
      ${esc(u.nome[0])}${cam ? '<span class="cam">📷</span>' : ''}</div>`;
  }
  const stars = n => n ? `<span class="stars">${'★'.repeat(n)}<span style="opacity:.25">${'★'.repeat(10 - n)}</span></span>` : '';

  function badge(r) {
    if (r.status === 'aprovado') return `<span class="badge aprovado">✅ ${brl(r.valor)}</span>`;
    if (r.status === 'refazer') return `<span class="badge refazer">🔁</span>`;
    return `<span class="badge pendente">⏳</span>`;
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
        <label style="cursor:pointer">${avatar(S.me, '', true)}
          <input type="file" accept="image/*" hidden onchange="A.setFoto(this)"></label>
        <div class="who"><div class="name">${esc(me.nome)}</div>
          <div class="sub">${st.streak ? `🔥 ${st.streak}` : ''} ${st.media ? `· ⭐ ${st.media}` : ''}</div></div>
        <button class="icon-btn" onclick="A.reload()" aria-label="Atualizar">🔄</button>
      </div>
      <div class="balance">
        <div class="lbl">💰</div>
        <div class="val mono">${brl(st.saldo)}</div>
        <div class="chips">
          <span class="chip">📅 ${brl(st.semana)}</span>
          <span class="chip">🗓️ ${brl(st.mes)}</span>
          <span class="chip">✅ ${st.aprovados || 0}</span>
        </div>
      </div>
      ${S.tab === 'home' ? `<button class="cta" onclick="A.compose()"><span class="ico">📸</span>+<span class="ico">🎤</span></button>` : ''}
      ${body}
      <nav class="nav">
        <button class="${S.tab === 'home' ? 'on' : ''}" onclick="A.tab('home')" aria-label="Início">🏠${refazer ? `<span class="dot">${refazer}</span>` : ''}</button>
        <button class="${S.tab === 'loja' ? 'on' : ''}" onclick="A.tab('loja')" aria-label="Loja">🛍️</button>
        <button class="${S.tab === 'rank' ? 'on' : ''}" onclick="A.tab('rank')" aria-label="Ranking">🏆</button>
      </nav>`;
  }

  function kidHome() {
    // "refazer" primeiro; o resto mantém a ordem (mais novo primeiro)
    const rel = [...S.data.relatos].sort((a, b) => (b.status === 'refazer') - (a.status === 'refazer'));
    if (!rel.length) return `<div class="empty">📭<p>Nenhum relato ainda</p></div>`;
    return `<div class="section-title">📜 <span class="count">${rel.length}</span></div>
      <div class="list">${rel.map(relatoCard).join('')}</div>`;
  }

  function relatoCard(r) {
    return `<div class="card">
      <div class="relato">
        <div class="thumb" data-media="${r.foto_id}" onclick="A.zoomMedia('${r.foto_id}')">📷</div>
        <div class="info">
          ${badge(r)}
          ${r.status === 'aprovado' ? stars(r.nota) : ''}
          <div class="date">${quando(r.criado_em)}</div>
        </div>
        <button class="play small" onclick="A.play('${r.audio_id}', this)" aria-label="Ouvir">▶</button>
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
      <div class="section-title">🛍️</div>
      ${itens.length ? `<div class="shop">${itens.map(it => {
        const ok = saldo >= it.preco;
        const pct = Math.min(100, Math.round(saldo / it.preco * 100));
        return `<button class="card item ${ok ? '' : 'locked'}" onclick="A.buy('${it.id}')">
          <div class="pic" ${it.imagem_id ? `data-media="${it.imagem_id}"` : ''}>${esc(it.emoji || '🎁')}</div>
          <div class="body"><div class="nm">${esc(it.nome)}</div><div class="pr mono">${brl(it.preco)}</div>
          ${ok ? '' : `<div class="progress"><i style="width:${pct}%"></i></div>`}</div>
        </button>`;
      }).join('')}</div>` : `<div class="empty">🏪<p>A loja ainda está vazia</p></div>`}
      ${meus.length ? `<div class="section-title">🎁 <span class="count">${meus.length}</span></div>
        <div class="list">${meus.map(resgateRow).join('')}</div>` : ''}`;
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
      <div class="section-title">🏆</div>
      <div class="seg">
        ${[['saldo', '💰', 'Saldo'], ['semana', '📅', 'Semana'], ['mes', '🗓️', 'Mês']].map(([k, e, t]) =>
          `<button class="${key === k ? 'on' : ''}" onclick="A.rank('${k}')">${e}<span>${t}</span></button>`).join('')}
      </div>
      <div class="podium">${kids.map((k, i) => `
        <div class="card rank-row">
          <div class="pos">${kids[0].v === k.v && i > 0 ? pos[0] : pos[i]}</div>
          ${avatar(k.id, 'sm')}
          <div class="nm" style="color:${k.cor}">${esc(k.nome)}</div>
          <div class="v mono">${brl(k.v)}</div>
          <div class="bar" style="width:${k.v / max * 100}%;background:${k.cor}"></div>
        </div>`).join('')}</div>
      ${KIDS.map(id => {
        const u = user(id), st = u.stats || {};
        const n = MEDALS.filter(m => m.ok(st)).length;
        return `<div class="medal-who">${avatar(id, 'sm')}<span style="color:${u.cor}">${esc(u.nome)}</span>
            <span class="muted small" style="margin-left:auto">🏅 ${n}/${MEDALS.length}</span></div>
          <div class="medals">${MEDALS.map(m => `<div class="medal ${m.ok(st) ? '' : 'off'}">${m.e}<small>${m.t}</small></div>`).join('')}</div>`;
      }).join('')}`;
  }

  // compor relato (novo ou refazer)
  function compose(refazerId) {
    const st = { foto: null, audio: null };
    let recorder;
    const sh = openSheet(`
      <h2>${refazerId ? '🔁' : '➕'} <button class="btn ghost close" data-a="close">✖</button></h2>
      <div class="steps"><i class="on"></i><i></i></div>
      <div data-step="1">
        <div class="pick">
          <label>📷<input type="file" accept="image/*" capture="environment"></label>
          <label>🖼️<input type="file" accept="image/*"></label>
        </div>
      </div>
      <div data-step="2" hidden>
        <img class="preview" alt="">
        <div data-rec></div>
        <div class="row mt"><button class="btn big" data-a="back">⬅️</button>
          <button class="btn big ok grow" data-a="send" disabled>✅</button></div>
      </div>`, s => {
        recorder = mountRecorder(s.querySelector('[data-rec]'), a => {
          st.audio = a;
          s.querySelector('[data-a="send"]').disabled = !a;
        });
        return () => recorder.stop();
      });

    const step = n => {
      sh.querySelectorAll('[data-step]').forEach(el => (el.hidden = el.dataset.step != n));
      sh.querySelectorAll('.steps i').forEach((el, i) => el.classList.toggle('on', i < n));
    };

    sh.querySelectorAll('.pick input').forEach(inp => inp.onchange = async () => {
      const f = inp.files[0];
      inp.value = '';
      if (!f) return;
      try {
        st.foto = await compressImage(f);
        sh.querySelector('.preview').src = st.foto;
        step(2);
      } catch { toast('⚠️ Foto inválida', true); }
    });

    sh.onclick = async e => {
      const a = e.target.closest('[data-a]')?.dataset.a;
      if (a === 'close') closeSheet();
      if (a === 'back') step(1);
      if (a === 'send') {
        const btn = e.target.closest('[data-a]');
        btn.disabled = true;
        btn.innerHTML = '<div class="spin sm"></div>';
        try {
          await api('novoRelato', { foto: splitDataUrl(st.foto), audio: { mime: st.audio.mime, data: st.audio.data }, refazerId: refazerId || '' });
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
      ['fila', `📥 Fila${fila.length ? ` (${fila.length})` : ''}`],
      ['resgates', `🎁 Resgates${resg.length ? ` (${resg.length})` : ''}`],
      ['loja', '🛍️ Loja'],
      ['hist', '📜 Histórico'],
      ['rank', '🏆 Ranking'],
    ];
    let body = '';
    if (S.adminTab === 'fila') body = fila.length ? `<div class="admin-grid">${fila.map(reviewCard).join('')}</div>` : `<div class="empty">🎉<p>Nada para avaliar.</p></div>`;
    if (S.adminTab === 'resgates') body = adminResgates();
    if (S.adminTab === 'loja') body = adminLoja();
    if (S.adminTab === 'hist') body = adminHist();
    if (S.adminTab === 'rank') body = rankView();

    return `
      <div class="top">
        <label style="cursor:pointer">${avatar(ADMIN, '', true)}<input type="file" accept="image/*" hidden onchange="A.setFoto(this)"></label>
        <div class="who"><div class="name">Painel do ${esc(user(ADMIN).nome)}</div><div class="sub">Avalie os relatos e gerencie a loja</div></div>
        <button class="icon-btn" onclick="A.reload()" aria-label="Atualizar">🔄</button>
      </div>
      <div class="kid-sum">${KIDS.map(id => {
        const u = user(id), st = u.stats || {};
        const pend = fila.filter(r => r.usuario === id).length;
        return `<div class="card">${avatar(id)}<div><div style="font-weight:800;color:${u.cor}">${esc(u.nome)}</div>
          <div class="v mono">${brl(st.saldo)}</div>
          <div class="muted small">📅 ${brl(st.semana)} · ⏳ ${pend} · ⭐ ${st.media || '–'}</div></div></div>`;
      }).join('')}</div>
      <div class="tabs-top mt">${tabs.map(([k, t]) => `<button class="${S.adminTab === k ? 'on' : ''}" onclick="A.adminTab('${k}')">${t}</button>`).join('')}</div>
      <div class="mt">${body}</div>`;
  }

  function reviewCard(r) {
    const u = user(r.usuario);
    const st = review[r.id] || (review[r.id] = { nota: 0, valor: '' });
    return `<div class="card review" data-id="${r.id}">
      <div class="photo" data-media="${r.foto_id}" onclick="A.zoomMedia('${r.foto_id}')">📷</div>
      <div class="body">
        <div class="head">${avatar(r.usuario, 'sm')}<span class="nm" style="color:${u.cor}">${esc(u.nome)}</span>
          <span class="tag">${quando(r.criado_em)}${r.tentativas > 1 ? ` · 🔁${r.tentativas - 1}` : ''}</span></div>
        <div class="row"><button class="play" onclick="A.play('${r.audio_id}', this)">▶</button><span class="muted">Ouvir o relato</span></div>
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
        <div class="thumb" data-media="${r.foto_id}" onclick="A.zoomMedia('${r.foto_id}')">📷</div>
        <div class="info">
          <div class="row">${avatar(r.usuario, 'sm')}<b style="color:${user(r.usuario).cor}">${esc(user(r.usuario).nome)}</b>${badge(r)}</div>
          ${r.status === 'aprovado' ? stars(r.nota) : ''}
          <div class="date">${quando(r.criado_em)}</div>
        </div>
        <button class="play small" onclick="A.play('${r.audio_id}', this)">▶</button>
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
    tab: t => { S.tab = t; render(); scrollTo(0, 0); },
    adminTab: t => { S.adminTab = t; render(); },
    rank: k => { S.rank = k; render(); },
    compose, buy, editItem, refazer, aprovar,
    play: (id, btn) => playMedia(id, btn),
    zoomMedia: async id => { await getMedia([id]); media.has(id) && zoom(media.get(id)); },
    nota: (id, n) => {
      review[id].nota = n;
      document.querySelectorAll(`[data-id="${id}"] .star-pick button`).forEach((b, i) => b.classList.toggle('on', i < n));
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

  window.addEventListener('hashchange', route);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && S.me && S.data && !document.getElementById('sheet-root').innerHTML) load(true);
  });
  route();
})();
