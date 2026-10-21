/* Mesada — painel da TV (tv.html, aberto por #/tv).
 * Só leitura: mostra os dois irmãos e obedece aos comandos do celular do Ericky (tvPoll).
 * Escrito sem recursos novos de JS (sem ?. e ??) porque o navegador de Smart TV costuma ser antigo.
 * Tudo é desenhado num palco fixo de 1920×1080 que escala para a tela da TV. */
(function () {
  'use strict';

  const API = window.MESADA_API;
  const KIDS = ['cesar', 'arthur'];
  const NOMES = { cesar: 'Cesar', arthur: 'Arthur', ericky: 'Ericky' };
  // cores das linhas do gráfico: as mesmas validadas no app (contraste no fundo escuro)
  const SERIE = { cesar: '#3b82f6', arthur: '#16a34a' };
  const PAINEL_MS = 60000;          // dados completos
  const POLL_RAPIDO = 1500;         // comandos, com o controle aberto
  const POLL_CALMO = 12000;         // comandos, sem ninguém mexendo
  const PEGADINHA_MAX = 30000;      // a pegadinha se revela sozinha depois disso
  const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';

  // espelham ELOS / PETS do app.js
  const ELOS = [
    { min: 0, n: 'Sem elo', e: '·', c: '#5b6270' },
    { min: 1, n: 'Bronze', e: '🛡️', c: '#cd7f32' },
    { min: 3, n: 'Prata', e: '🛡️', c: '#c0c7d1' },
    { min: 5, n: 'Ouro', e: '🛡️', c: '#f5c542' },
    { min: 7, n: 'Platina', e: '🔰', c: '#5ee0d0' },
    { min: 14, n: 'Diamante', e: '💎', c: '#5aa9ff' },
    { min: 21, n: 'Heroico', e: '⚔️', c: '#b06bff' },
    { min: 30, n: 'Mestre', e: '👑', c: '#ff5a5a' },
    { min: 45, n: 'Mestre de Honra', e: '🏵️', c: '#ff9b2f' },
    { min: 60, n: 'Grão-Mestre', e: '🔱', c: '#ffd700' },
  ];
  const PETS = [
    { min: 0, e: '🥚' }, { min: 3, e: '🐣' }, { min: 7, e: '🦊' },
    { min: 14, e: '🐺' }, { min: 30, e: '🐲' }, { min: 60, e: '🐉' },
  ];
  const nivel = (l, d) => l.filter(x => (d || 0) >= x.min).pop();
  const elo = d => nivel(ELOS, d);
  const proxElo = d => ELOS.find(x => x.min > (d || 0));

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.prototype.slice.call((r || document).querySelectorAll(s));
  const stage = document.getElementById('stage');
  const params = new URLSearchParams(location.search);
  if (params.has('leve')) document.body.classList.add('leve');

  let D = null;                 // dados do painel
  let antes = null;             // stats da atualização anterior (para comemorar o que mudou)
  let vistos = {};              // ids da timeline já mostrados
  let relogioSrv = 0;           // diferença servidor − TV (ms)
  let ultimoEv = 0;             // ts do último comando executado
  let quente = false;
  let letreiro = '';            // recado fixo no letreiro (Escrever → letreiro)
  const pegadinha = {};         // k -> { fim, timer } enquanto uma pegadinha está na tela
  const media = {};

  // ------------------------------------------------------------ utils
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const brl = c => (Number(c || 0) / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  const casas = (c, n) => (c / 100).toLocaleString('pt-BR', { minimumFractionDigits: n, maximumFractionDigits: n });
  const user = id => (D && D.usuarios.find(u => u.id === id)) || { id: id, nome: NOMES[id] || id, cor: '#f0f2f7', stats: {} };
  const st = id => user(id).stats || {};
  const agoraSrv = () => Date.now() + relogioSrv;

  function haQuanto(iso) {
    const d = new Date(iso), s = (agoraSrv() - d.getTime()) / 1000;
    if (s < 60) return 'agora';
    if (s < 3600) return 'há ' + Math.floor(s / 60) + ' min';
    const hoje = new Date(agoraSrv()).toDateString();
    const hh = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    if (d.toDateString() === hoje) return 'hoje ' + hh;
    const ontem = new Date(agoraSrv() - 864e5).toDateString();
    if (d.toDateString() === ontem) return 'ontem ' + hh;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + hh;
  }

  async function api(action, p) {
    const body = { action: action, usuario: 'tv' };
    Object.keys(p || {}).forEach(k => { body[k] = p[k]; });
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!j.ok) throw new Error(j.error);
    return j.data;
  }

  async function midia(ids) {
    const falta = ids.filter(id => id && !media[id]);
    for (let i = 0; i < falta.length; i += 8) {
      try {
        const res = await api('midia', { ids: falta.slice(i, i + 8) });
        Object.keys(res).forEach(id => { media[id] = 'data:' + res[id].mime + ';base64,' + res[id].data; });
      } catch (e) { /* sem a foto: fica o emoji */ }
    }
  }
  async function hidratar(root) {
    const els = $$('[data-media]', root);
    await midia(els.map(el => el.dataset.media));
    els.forEach(el => {
      const url = media[el.dataset.media];
      if (!url) return;
      el.style.backgroundImage = 'url("' + url + '")';
      el.classList.add('tem-img');
      el.removeAttribute('data-media');
    });
  }

  // número que conta até o valor novo
  function contar(el, de, ate, ms, fmt) {
    const t0 = performance.now();
    const f = fmt || brl;
    (function passo(t) {
      const p = Math.min(1, (t - t0) / (ms || 1200));
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = f(Math.round(de + (ate - de) * e));
      if (p < 1) requestAnimationFrame(passo);
    })(t0);
  }

  // ------------------------------------------------------------ palco 1920×1080
  let desvio = [0, 0];
  function escala() {
    const s = Math.min(innerWidth / 1920, innerHeight / 1080);
    stage.style.transform = 'translate(-50%, -50%) translate(' + desvio[0] + 'px,' + desvio[1] + 'px) scale(' + s + ')';
  }
  addEventListener('resize', escala);
  // muda o palco de lugar uns pixels de vez em quando: a TV não marca a imagem parada
  setInterval(() => { desvio = [Math.round(Math.random() * 8 - 4), Math.round(Math.random() * 8 - 4)]; escala(); }, 240000);

  function montar() {
    stage.innerHTML = `
      <header class="topo">
        <div class="marca"><h1>Mesada</h1><span>painel da família</span></div>
        <div class="relogio"><b data-f="hora">--:--</b><span data-f="data"></span></div>
        <div class="vivo"><i></i><span data-f="vivo">conectando…</span></div>
      </header>
      <section class="meio">
        ${kidCard('cesar')}
        <article class="card tl"><h2>Linha do tempo</h2><ol data-f="timeline"></ol></article>
        ${kidCard('arthur')}
      </section>
      <section class="base">
        <article class="card graf"><div class="c-head"><h2>Ganhos por semana</h2><div class="leg">${KIDS.map(k =>
          `<span><i style="background:${SERIE[k]}"></i>${NOMES[k]}</span>`).join('')}</div></div><div data-f="grafico"></div></article>
        <article class="card compras"><h2>Últimas compras</h2><div class="cp-grid" data-f="compras"></div></article>
        <article class="card agora"><h2 data-f="agora-tit">Agora</h2><div data-f="agora"></div></article>
      </section>
      <footer class="letreiro"><div class="lt-trilho" data-f="letreiro"></div></footer>
      <div id="fx"></div>`;
    escala();
  }

  function kidCard(k) {
    return `<article class="card kid" id="k-${k}">
      <div class="k-top">
        <div class="k-av"><span class="k-anel"></span><div class="av" data-f="av">${NOMES[k][0]}</div></div>
        <div class="k-id"><h3>${NOMES[k]}</h3><div class="k-elo" data-f="elo"></div></div>
        <div class="k-pet" data-f="pet"></div>
      </div>
      <div class="k-saldo"><small>Saldo</small><b class="mono" data-f="saldo" data-v="0">R$ 0,00</b>
        <div class="k-sub" data-f="sub"></div></div>
      <div class="k-duo">
        <div class="mini cofre"><small>🐷 Cofrinho</small><b class="mono" data-f="cofre">R$ 0,00</b><span data-f="cofre-dia"></span></div>
        <div class="mini ofen"><small>🔥 Ofensiva</small><b data-f="ofen"></b><div class="barra"><i data-f="ofen-barra"></i></div><span data-f="ofen-prox"></span></div>
      </div>
      <div class="mini meta" data-f="meta"></div>
      <div class="selo" data-f="selo"></div>
    </article>`;
  }

  // ------------------------------------------------------------ preencher
  function preencher() {
    KIDS.forEach(preencherKid);
    preencherTimeline();
    $('[data-f=grafico]').innerHTML = grafico();
    preencherCompras();
    preencherAgora();
    preencherLetreiro();
    hidratar(stage);
  }

  function preencherKid(k) {
    const el = $('#k-' + k), u = user(k), s = st(k);
    const x = elo(s.streak), prox = proxElo(s.streak);
    el.style.setProperty('--k', u.cor);
    el.style.setProperty('--elo', x.c);
    const av = $('[data-f=av]', el);
    if (u.foto_id && !av.classList.contains('tem-img')) av.dataset.media = u.foto_id;
    $('[data-f=elo]', el).innerHTML = `<span class="chip" style="--c:${x.c}">${x.e} ${x.n}</span>${s.media ? `<span class="chip">⭐ ${String(s.media).replace('.', ',')}</span>` : ''}`;
    $('[data-f=pet]', el).textContent = nivel(PETS, s.streak).e;
    $('[data-f=pet]', el).classList.toggle('dorme', !!s.streak && !s.hojeFeito);

    const sal = $('[data-f=saldo]', el);
    if (!pegadinha[k]) {
      const de = Number(sal.dataset.v) || 0;
      if (de !== (s.saldo || 0)) contar(sal, de, s.saldo || 0, 1600);
      sal.dataset.v = s.saldo || 0;
    }
    $('[data-f=sub]', el).innerHTML = `<span>Semana <b class="mono">${brl(s.semana)}</b></span><span>Mês <b class="mono">${brl(s.mes)}</b></span>`;

    const dia = D.taxas ? D.taxas.dia : 0;
    const c = s.cofre || { saldo: 0 };
    $('[data-f=cofre-dia]', el).textContent = c.saldo > 0 ? '+ R$ ' + casas(c.saldo * dia, 4) + ' por dia' : 'vazio por enquanto';

    $('[data-f=ofen]', el).innerHTML = `<span class="mono">${s.streak || 0}</span> ${s.streak === 1 ? 'dia' : 'dias'}`;
    const pctElo = prox ? Math.round(((s.streak || 0) - x.min) / (prox.min - x.min) * 100) : 100;
    $('[data-f=ofen-barra]', el).style.width = pctElo + '%';
    $('[data-f=ofen-barra]', el).style.background = prox ? prox.c : x.c;
    $('[data-f=ofen-prox]', el).textContent = prox ? prox.e + ' ' + prox.n + ' em ' + (prox.min - (s.streak || 0)) + 'd · recorde ' + (s.recorde || 0) : '🏆 elo máximo';

    const selo = $('[data-f=selo]', el);
    selo.className = 'selo ' + (s.hojeFeito ? 'ok' : 'falta');
    selo.textContent = s.hojeFeito ? '✓ relatou hoje' : '⏳ ainda não relatou hoje';

    // meta: anel de progresso com a foto do prêmio
    const it = u.meta_item ? D.loja.find(i => i.id === u.meta_item) : null;
    const meta = $('[data-f=meta]', el);
    if (!it) { meta.innerHTML = '<small>🎯 Meta</small><span class="vazio">nenhuma meta escolhida</span>'; return; }
    const tem = (s.saldo || 0) + Math.floor(c.saldo + 1e-9);
    const pct = Math.min(100, Math.round(tem / it.preco * 100));
    const R = 30, C = 2 * Math.PI * R;
    meta.innerHTML = `<svg class="anel" viewBox="0 0 76 76"><circle cx="38" cy="38" r="${R}" class="trilho"/>
        <circle cx="38" cy="38" r="${R}" class="prog" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - pct / 100)}"/></svg>
      <div class="m-foto" ${it.imagem_id ? `data-media="${it.imagem_id}"` : ''}>${esc(it.emoji || '🎁')}</div>
      <div class="m-txt"><small>🎯 Meta · ${pct}%</small><b>${esc(it.nome || 'Mercadinho')} <span class="mono">${brl(it.preco)}</span></b>
        <span>${tem >= it.preco ? '🎉 já dá para comprar!' : 'faltam <b class="mono">' + brl(it.preco - tem) + '</b>'}</span></div>`;
  }

  // cofrinho rendendo ao vivo (a fração do dia em curso, igual ao app)
  setInterval(() => {
    if (!D) return;
    const n = new Date();
    const frac = (n - new Date(n.getFullYear(), n.getMonth(), n.getDate())) / 864e5;
    KIDS.forEach(k => {
      const c = st(k).cofre || { saldo: 0 };
      const v = c.saldo * Math.pow(1 + (D.taxas ? D.taxas.dia : 0), frac);
      const s = casas(v, 7);
      const el = $('#k-' + k + ' [data-f=cofre]');
      if (el) el.innerHTML = 'R$ ' + s.slice(0, -5) + '<small>' + s.slice(-5) + '</small>';
    });
  }, 100);

  // ------------------------------------------------------------ timeline
  function itensTimeline() {
    const rel = id => D.relatos.find(r => r.id === id);
    const mis = id => D.missoes.find(m => m.id === id);
    const tar = id => (D.tarefas || []).find(t => t.id === id);
    const res = id => D.resgates.find(r => r.id === id);
    const lei = id => D.leiloes.find(l => l.id === id);
    const out = [];
    D.movs.forEach(m => {
      if (m.tipo === 'pix_recebido') return; // o Pix aparece uma vez só, do lado de quem mandou
      const r = rel(m.ref), x = res(m.ref);
      const o = NOMES[m.usuario === 'cesar' ? 'arthur' : 'cesar'];
      const map = {
        relato: r && r.tarefa_id ? ['📋', 'Tarefa: ' + ((tar(r.tarefa_id) || {}).titulo || 'tarefa fixa')]
          : r && r.missao_id ? ['🎯', 'Missão: ' + ((mis(r.missao_id) || {}).titulo || 'concluída')]
          : ['✅', 'Relato aprovado' + (r && r.nota ? ' · ⭐ ' + r.nota : '')],
        missao_dupla: ['👥', 'Missão em dupla com ' + o],
        presente: ['🎁', 'Presente do pai'],
        multa: ['⚠️', 'Multa: ' + ((D.multas.find(y => y.id === m.ref) || {}).motivo || '')],
        multa_perdoada: ['🤝', 'Multa perdoada'],
        lance: ['🔨', 'Lance: ' + ((lei(m.ref) || {}).nome || 'leilão')],
        lance_devolvido: ['🔨', 'Lance devolvido'],
        cofre_guardar: ['🐷', 'Guardou no cofrinho'],
        cofre_retirar: ['🐷', 'Tirou do cofrinho'],
        resgate: [x && x.emoji || '🛍️', 'Comprou ' + (x && x.nome || 'no mercadinho')],
        estorno: ['↩️', 'Compra devolvida'],
        pix_enviado: ['💠', 'Pix para ' + o],
      }[m.tipo] || ['•', m.tipo];
      out.push({ id: m.id, k: m.usuario, ico: map[0], txt: map[1], v: m.valor, data: m.data, neutro: /^cofre_/.test(m.tipo) });
    });
    D.relatos.filter(r => r.status === 'pendente').forEach(r =>
      out.push({ id: 'r' + r.id, k: r.usuario, ico: '📸', txt: 'Mandou um relato · esperando', data: r.criado_em, espera: true }));
    return out.sort((a, b) => (a.data < b.data ? 1 : -1)).slice(0, 6);
  }

  function preencherTimeline() {
    const lista = itensTimeline();
    const primeira = !Object.keys(vistos).length;
    $('[data-f=timeline]').innerHTML = lista.map((it, i) => {
      const novo = !primeira && !vistos[it.id];
      const val = it.v == null ? '' : `<b class="tl-v ${it.neutro ? '' : it.v >= 0 ? 'pos' : 'neg'} mono">${it.neutro ? '' : it.v >= 0 ? '+' : '−'} ${brl(Math.abs(it.v))}</b>`;
      return `<li class="${novo ? 'novo' : ''} ${it.espera ? 'espera' : ''}" style="--i:${i};--k:${user(it.k).cor}">
        <span class="tl-ico">${esc(it.ico)}</span>
        <div class="tl-txt"><b>${esc(NOMES[it.k] || it.k)}</b> ${esc(it.txt)}<small>${haQuanto(it.data)}</small></div>${val}</li>`;
    }).join('') || '<li class="vazio">Nada por aqui ainda</li>';
    lista.forEach(it => { vistos[it.id] = true; });
  }

  // ------------------------------------------------------------ gráfico (2 séries, um eixo, legenda + rótulo direto)
  function grafico() {
    const W = 700, H = 176, L = 58, R = 92, T = 16, B = 30;
    const ser = KIDS.map(k => ({ k: k, v: (st(k).semanas || []).slice(-8) }));
    const n = Math.max.apply(null, ser.map(s => s.v.length));
    if (!n) return '<div class="vazio">Sem ganhos ainda</div>';
    const topo = Math.max(100, Math.max.apply(null, ser.map(s => Math.max.apply(null, s.v.concat([0])))));
    const passo = Math.pow(10, Math.floor(Math.log10(topo)));
    const max = Math.ceil(topo / passo) * passo;
    const x = i => L + i * (W - L - R) / Math.max(1, n - 1);
    const y = v => T + (H - T - B) * (1 - v / max);
    const curto = c => 'R$ ' + Math.round(c / 100);
    let g = '';
    [0, .5, 1].forEach(f => {
      g += `<line class="ch-grid" x1="${L}" x2="${W - R + 10}" y1="${y(max * f)}" y2="${y(max * f)}"/>
        <text class="ch-y" x="${L - 12}" y="${y(max * f) + 5}">${curto(max * f)}</text>`;
    });
    const ini = st(KIDS[0]).semanasIni || [];
    ini.slice(-n).forEach((d, i) => {
      g += `<text class="ch-x" x="${x(i)}" y="${H - 6}">${i === n - 1 ? 'esta' : d.slice(8, 10) + '/' + d.slice(5, 7)}</text>`;
    });
    // rótulos diretos no fim da linha, afastados se ficarem colados
    const fins = ser.map(s => ({ k: s.k, v: s.v[s.v.length - 1] || 0, y: y(s.v[s.v.length - 1] || 0) }));
    if (fins.length === 2 && Math.abs(fins[0].y - fins[1].y) < 24) {
      const meio = (fins[0].y + fins[1].y) / 2, cima = fins[0].y <= fins[1].y ? 0 : 1;
      fins[cima].ly = meio - 13; fins[1 - cima].ly = meio + 13;
    }
    ser.forEach((s, j) => {
      const pts = s.v.map((v, i) => x(i) + ',' + y(v));
      const cor = SERIE[s.k];
      g += `<defs><linearGradient id="ga${j}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${cor}" stop-opacity=".28"/><stop offset="1" stop-color="${cor}" stop-opacity="0"/></linearGradient></defs>
        <polygon class="ch-area" fill="url(#ga${j})" points="${x(0)},${y(0)} ${pts.join(' ')} ${x(s.v.length - 1)},${y(0)}"/>
        <polyline class="ch-linha" style="stroke:${cor};animation-delay:${j * .25}s" pathLength="1" points="${pts.join(' ')}"/>
        <circle class="ch-pulso" style="fill:${cor}" cx="${x(s.v.length - 1)}" cy="${y(s.v[s.v.length - 1] || 0)}" r="7"/>
        <circle class="ch-ponto" style="fill:${cor}" cx="${x(s.v.length - 1)}" cy="${y(s.v[s.v.length - 1] || 0)}" r="7"/>
        <text class="ch-rot" x="${x(s.v.length - 1) + 16}" y="${(fins[j].ly || fins[j].y) + 6}">${brl(fins[j].v)}</text>`;
    });
    return `<svg class="ch" viewBox="0 0 ${W} ${H}" role="img" aria-label="Ganhos das últimas 8 semanas">${g}</svg>`;
  }

  // ------------------------------------------------------------ compras e "agora"
  function preencherCompras() {
    const l = D.resgates.filter(x => x.status !== 'cancelado').slice(0, 4);
    $('[data-f=compras]').innerHTML = l.map((x, i) => {
      const img = x.imagem_id || (D.loja.find(it => it.id === x.item_id) || {}).imagem_id;
      return `<div class="cp" style="--i:${i}">
        <div class="cp-foto" ${img ? `data-media="${img}"` : ''}><span>${esc(x.emoji || '🎁')}</span>
          <i class="cp-quem" style="--k:${user(x.usuario).cor}">${esc(NOMES[x.usuario][0])}</i></div>
        <b class="mono">${brl(x.preco)}</b><small>${x.status === 'pendente' ? '🎒 na mochila' : '🎁 entregue'}</small></div>`;
    }).join('') || '<div class="vazio">Nenhuma compra ainda</div>';
  }

  function restante(fim) {
    const s = Math.max(0, Math.floor((new Date(fim).getTime() - agoraSrv()) / 1000));
    const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), ss = s % 60;
    return (h ? h + 'h ' : '') + String(m).padStart(2, '0') + ':' + String(ss).padStart(2, '0');
  }

  function preencherAgora() {
    const leilao = D.leiloes.find(l => l.status === 'aberto');
    const abertas = D.missoes.filter(m => m.status === 'aberta');
    const box = $('[data-f=agora]');
    if (leilao) {
      $('[data-f=agora-tit]').textContent = '🔨 Leilão ao vivo';
      box.innerHTML = `<div class="leilao"><div class="lei-foto" ${leilao.foto_id ? `data-media="${leilao.foto_id}"` : ''}>${esc(leilao.emoji || '🎁')}</div>
        <div><b class="lei-nome">${esc(leilao.nome)}</b>
          <div class="lei-lance">${leilao.lider ? `<span style="color:${user(leilao.lider).cor}">${esc(NOMES[leilao.lider])}</span> na frente com <b class="mono">${brl(leilao.lance)}</b>`
            : 'lance inicial <b class="mono">' + brl(leilao.lance_min) + '</b>'}</div>
          <div class="lei-tempo mono" data-fim="${leilao.fim}">⏱ ${restante(leilao.fim)}</div></div></div>
        ${abertas.length ? `<div class="ag-mini">🎯 ${abertas.length} ${abertas.length === 1 ? 'missão aberta' : 'missões abertas'}</div>` : ''}`;
      return;
    }
    if (abertas.length) {
      $('[data-f=agora-tit]').textContent = '🎯 Missões abertas';
      box.innerHTML = `<div class="ms-grid">${abertas.slice(0, 3).map(m => `<div class="ms">
        <div class="ms-foto" ${m.foto_id ? `data-media="${m.foto_id}"` : ''}>🎯${m.tipo === 'dupla' ? '<i>👥</i>' : ''}</div>
        <b class="mono">${brl(m.valor)}</b><small>${esc(m.titulo || 'Missão')}</small></div>`).join('')}</div>`;
      return;
    }
    // sem missão nem leilão: placar da semana
    $('[data-f=agora-tit]').textContent = '🏆 Placar da semana';
    const max = Math.max(1, st('cesar').semana || 0, st('arthur').semana || 0);
    box.innerHTML = `<div class="placar">${KIDS.slice().sort((a, b) => (st(b).semana || 0) - (st(a).semana || 0)).map((k, i) => `
      <div class="pl"><span class="pl-pos">${i ? '🥈' : '🥇'}</span><b>${NOMES[k]}</b><b class="mono pl-v">${brl(st(k).semana)}</b>
        <div class="pl-barra"><i style="width:${(st(k).semana || 0) / max * 100}%;background:${user(k).cor}"></i></div></div>`).join('')}</div>`;
  }
  setInterval(() => { $$('[data-fim]').forEach(el => { el.textContent = '⏱ ' + restante(el.dataset.fim); }); }, 1000);

  // ------------------------------------------------------------ letreiro
  function preencherLetreiro() {
    const frases = [];
    if (letreiro) frases.push('<b class="lt-recado">📣 ' + esc(letreiro) + '</b>');
    KIDS.forEach(k => {
      const s = st(k), u = user(k);
      const it = u.meta_item ? D.loja.find(i => i.id === u.meta_item) : null;
      if (it) {
        const falta = it.preco - (s.saldo || 0) - Math.floor((s.cofre || { saldo: 0 }).saldo);
        frases.push(falta > 0 ? `🎯 ${NOMES[k]} está a <b>${brl(falta)}</b> de ${esc(it.nome || 'sua meta')}` : `🎉 ${NOMES[k]} já pode comprar ${esc(it.nome || 'a meta')}!`);
      }
      if (s.streak) frases.push(`🔥 ${NOMES[k]}: <b>${s.streak} ${s.streak === 1 ? 'dia' : 'dias'}</b> seguidos · recorde ${s.recorde}`);
      if (s.semana) frases.push(`📅 ${NOMES[k]} ganhou <b>${brl(s.semana)}</b> esta semana`);
    });
    const rend = KIDS.reduce((a, k) => a + ((st(k).cofre || {}).rendido || 0), 0);
    if (rend > 0) frases.push(`🐷 Os cofrinhos já renderam <b>R$ ${casas(rend, 4)}</b> sozinhos`);
    const abertas = D.missoes.filter(m => m.status === 'aberta');
    if (abertas.length) frases.push(`🎯 ${abertas.length} ${abertas.length === 1 ? 'missão valendo' : 'missões valendo'} <b>${brl(abertas.reduce((a, m) => a + m.valor, 0))}</b>`);
    if (!frases.length) frases.push('✨ Mande um relato e apareça aqui');
    const html = frases.join('<span class="lt-sep">✦</span>');
    const tr = $('[data-f=letreiro]');
    if (tr.dataset.html === html) return;
    tr.dataset.html = html;
    // duas cópias seguidas: a animação anda metade e recomeça sem pulo
    tr.innerHTML = `<span>${html}<span class="lt-sep">✦</span></span><span>${html}<span class="lt-sep">✦</span></span>`;
    tr.style.animationDuration = Math.max(30, html.replace(/<[^>]+>/g, '').length * 0.22) + 's';
  }

  // ------------------------------------------------------------ comemorações automáticas
  function comemorarMudancas() {
    if (!antes) return;
    KIDS.forEach(k => {
      const a = antes[k] || {}, s = st(k);
      const ganho = (s.saldo || 0) - (a.saldo || 0);
      if (ganho > 0 && !pegadinha[k]) { moedas(k, '+ ' + brl(ganho)); som('ding'); }
      if (elo(s.streak).min > elo(a.streak).min) {
        const x = elo(s.streak);
        setTimeout(() => banner(`<div class="b-eyebrow">subiu de patente</div><div class="b-big" style="color:${x.c}">${x.e} ${x.n}</div><div class="b-sub">${NOMES[k]} · ${s.streak} dias seguidos</div>`, 'patente', 7000), 1800);
        chuva([x.e, '✨', '🔥'], 26);
        som('fanfarra');
      }
    });
  }

  function moedas(k, txt) {
    const card = $('#k-' + k);
    if (!card) return;
    card.classList.remove('brilha'); void card.offsetWidth; card.classList.add('brilha');
    const fx = document.createElement('div');
    fx.className = 'moedas';
    fx.innerHTML = '<b class="mono">' + esc(txt) + '</b>' + Array.apply(null, Array(10)).map((_, i) =>
      `<i style="left:${10 + Math.random() * 80}%;animation-delay:${i * .08}s">🪙</i>`).join('');
    card.appendChild(fx);
    setTimeout(() => fx.remove(), 3200);
  }

  // ------------------------------------------------------------ carga
  async function carregar() {
    try {
      const d = await api('tvPainel');
      relogioSrv = new Date(d.agora).getTime() - Date.now();
      if (D) antes = KIDS.reduce((o, k) => { o[k] = st(k); return o; }, {});
      D = d;
      if (!$('#k-cesar')) montar();
      preencher();
      comemorarMudancas();
      stage.classList.remove('erro');
      ultimaCarga = Date.now();
    } catch (e) {
      stage.classList.add('erro');
      if (!D) stage.innerHTML = `<div class="falha"><h1>Mesada</h1><p>Não consegui carregar: ${esc(e.message)}</p><p class="muted">Tentando de novo…</p></div>`;
    }
    setTimeout(carregar, noite() ? PAINEL_MS * 5 : PAINEL_MS);
  }
  let ultimaCarga = 0;

  // relógio, "ao vivo há X s" e modo noite
  const noite = () => { const h = new Date().getHours(); return h >= 22 || h < 7; };
  setInterval(() => {
    const n = new Date();
    const hora = $('[data-f=hora]');
    if (!hora) return;
    hora.innerHTML = String(n.getHours()).padStart(2, '0') + '<i>:</i>' + String(n.getMinutes()).padStart(2, '0');
    const data = n.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
    $('[data-f=data]').textContent = data;
    const s = Math.round((Date.now() - ultimaCarga) / 1000);
    $('[data-f=vivo]').textContent = stage.classList.contains('erro') ? 'sem conexão · tentando' : quente ? 'controle conectado' : 'ao vivo · ' + (s < 5 ? 'agora' : 'há ' + s + ' s');
    $('.vivo').classList.toggle('quente', quente);
    document.body.classList.toggle('noite', noite());
    const v = $('video.bg');
    if (v) { if (noite() && !v.paused) v.pause(); else if (!noite() && v.paused) v.play().catch(() => {}); }
  }, 1000);

  // ------------------------------------------------------------ comandos do celular
  async function poll() {
    try {
      const r = await api('tvPoll', { desde: ultimoEv });
      quente = r.quente;
      if (!ultimoEv) ultimoEv = r.agora; // primeira vez: não repete o que foi mandado antes de a TV abrir
      else r.ev.forEach(e => { if (e.ts > ultimoEv) { ultimoEv = e.ts; executar(e); } });
    } catch (e) { /* sem rede: tenta na próxima */ }
    setTimeout(poll, quente ? POLL_RAPIDO : noite() ? POLL_CALMO * 3 : POLL_CALMO);
  }

  function executar(e) {
    const d = e.dados || {};
    try {
      ({
        emoji: () => { chuva([d.e || '❤️'], Math.min(60, d.n || 30)); som('pop'); },
        texto: () => recado(d),
        fala: () => legenda(d),
        comemorar: () => comemorar(d),
        foto: () => foto(d),
        audio: () => audio(d),
        som: () => som(d.s),
        contagem: () => contagem(d, e.ts),
        pegadinha: () => pegar(d),
        revelar: () => revelar(),
        limpar: () => limpar(),
      }[e.tipo] || function () {})();
    } catch (err) { console.warn(err); }
  }

  // ------------------------------------------------------------ efeitos
  const fx = () => document.getElementById('fx');

  function chuva(emojis, n) {
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      s.className = 'gota';
      s.textContent = emojis[i % emojis.length];
      s.style.left = Math.random() * 100 + '%';
      s.style.fontSize = (56 + Math.random() * 90) + 'px';
      s.style.animationDuration = (3 + Math.random() * 2.5) + 's';
      s.style.animationDelay = Math.random() * 1.6 + 's';
      s.style.setProperty('--r', (Math.random() * 720 - 360) + 'deg');
      s.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
      fx().appendChild(s);
      setTimeout(() => s.remove(), 7000);
    }
  }

  // camada no meio da tela; um banner por vez, cada um com seu tempo
  let bannerT;
  function banner(html, estilo, ms) {
    let b = $('#fx .banner');
    if (b) b.remove();
    clearTimeout(bannerT);
    b = document.createElement('div');
    b.className = 'banner ' + (estilo || '');
    b.innerHTML = '<div class="b-caixa">' + html + '</div>';
    fx().appendChild(b);
    stage.classList.add('foco');
    bannerT = setTimeout(() => fecharBanner(b), ms || 8000);
    return b;
  }
  function fecharBanner(b) {
    if (!b || !b.parentNode) return;
    b.classList.add('sai');
    stage.classList.remove('foco');
    setTimeout(() => b.remove(), 600);
  }

  function falar(t) {
    if (!window.speechSynthesis || !t) return;
    const u = new SpeechSynthesisUtterance(t);
    u.lang = 'pt-BR';
    u.rate = 1;
    speechSynthesis.cancel();
    speechSynthesis.speak(u);
  }

  function recado(d) {
    if (d.estilo === 'letreiro') { letreiro = d.t || ''; if (D) preencherLetreiro(); som('ding'); return; }
    const ico = { parabens: '🎉', alerta: '🚨', aviso: '📣' }[d.estilo] || '💬';
    banner(`<div class="b-ico">${ico}</div><div class="b-texto">${esc(d.t)}</div><div class="b-assin">— ${NOMES.ericky}</div>`,
      'recado ' + (d.estilo || ''), Math.max(4, Math.min(120, d.seg || 12)) * 1000);
    if (d.estilo === 'parabens') { chuva(['🎉', '✨', '🥳'], 30); som('fanfarra'); }
    else if (d.estilo === 'alerta') som('alarme');
    else som('ding');
    if (d.falar) setTimeout(() => falar(d.t), 600);
  }

  // legenda ao vivo do que o Ericky está falando no celular
  let legT;
  function legenda(d) {
    let l = $('#fx .legenda');
    if (!l) {
      l = document.createElement('div');
      l.className = 'legenda';
      l.innerHTML = '<span class="lg-mic"><i></i><i></i><i></i></span><div class="lg-txt"></div>';
      fx().appendChild(l);
    }
    $('.lg-txt', l).textContent = d.t || '';
    l.classList.toggle('fim', !!d.fim);
    clearTimeout(legT);
    legT = setTimeout(() => { l.classList.add('sai'); setTimeout(() => l.remove(), 600); }, d.fim ? 6000 : 10000);
  }

  function comemorar(d) {
    const k = KIDS.indexOf(d.k) >= 0 ? d.k : null;
    stage.classList.add('holofote');
    if (k) stage.dataset.holofote = k;
    banner(`<div class="b-eyebrow">${esc(d.t || 'parabéns')}</div><div class="b-big">${k ? '👏 ' + NOMES[k] + '!' : '👏 Vocês dois!'}</div>`, 'festa', 8000);
    chuva(['🎉', '⭐', '✨', '🥳', '💰'], 46);
    som('palmas');
    setTimeout(() => som('fanfarra'), 300);
    setTimeout(() => { stage.classList.remove('holofote'); delete stage.dataset.holofote; }, 8000);
  }

  async function foto(d) {
    await midia([d.midia_id]);
    if (!media[d.midia_id]) return;
    const f = document.createElement('div');
    f.className = 'foto-full';
    f.innerHTML = `<div class="ff-img" style="background-image:url('${media[d.midia_id]}')"></div>${d.t ? `<div class="ff-leg">${esc(d.t)}</div>` : ''}`;
    $$('#fx .foto-full').forEach(x => x.remove());
    fx().appendChild(f);
    som('ding');
    setTimeout(() => { f.classList.add('sai'); setTimeout(() => f.remove(), 800); }, Math.max(5, Math.min(60, d.seg || 15)) * 1000);
  }

  const player = new Audio();
  async function audio(d) {
    await midia([d.midia_id]);
    if (!media[d.midia_id]) return;
    let b = $('#fx .recado-voz');
    if (!b) { b = document.createElement('div'); b.className = 'recado-voz'; fx().appendChild(b); }
    b.innerHTML = '<span class="lg-mic"><i></i><i></i><i></i></span><b>Recado de voz do pai</b>';
    player.src = media[d.midia_id];
    player.onended = () => b.remove();
    player.play().catch(() => { b.innerHTML = '<b>🔇 Aperte OK no controle da TV para ouvir</b>'; setTimeout(() => b.remove(), 8000); });
  }

  // contagem regressiva grande; seg 0 cancela
  let contaT;
  function contagem(d, ts) {
    clearInterval(contaT);
    $$('#fx .conta').forEach(x => x.remove());
    if (!d.seg) return;
    const fim = ts + d.seg * 1000;
    const c = document.createElement('div');
    c.className = 'conta';
    c.innerHTML = `<small>${esc(d.t || 'Contagem')}</small><b class="mono">--:--</b><div class="conta-barra"><i></i></div>`;
    fx().appendChild(c);
    const tick = () => {
      const s = Math.max(0, Math.ceil((fim - agoraSrv()) / 1000));
      $('b', c).textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
      $('i', c).style.width = (s / d.seg * 100) + '%';
      c.classList.toggle('urgente', s <= 10);
      if (s <= 10 && s > 0) som('tic');
      if (s > 0) return;
      clearInterval(contaT);
      c.remove();
      banner(`<div class="b-big">⏰ TEMPO!</div><div class="b-sub">${esc(d.t || '')}</div>`, 'alerta', 6000);
      som('alarme');
    };
    tick();
    contaT = setInterval(tick, 1000);
  }

  // ------------------------------------------------------------ pegadinhas (só na TV, o saldo de verdade não muda)
  function pegar(d) {
    const k = KIDS.indexOf(d.k) >= 0 ? d.k : 'cesar';
    const card = $('#k-' + k), sal = $('[data-f=saldo]', card);
    if (!card) return;
    if (pegadinha[k]) clearTimeout(pegadinha[k].timer);
    pegadinha[k] = { timer: setTimeout(revelar, PEGADINHA_MAX) };
    const real = st(k).saldo || 0;
    if (d.p === 'milionario') {
      card.classList.add('rico');
      contar(sal, real, 100000000, 4000);
      chuva(['💰', '💸', '🪙', '💎'], 50);
      som('fanfarra');
      banner(`<div class="b-eyebrow">presente do pai</div><div class="b-big ouro">R$ 1.000.000,00</div><div class="b-sub">para ${NOMES[k]} 🎁</div>`, 'ouro', 9000);
      return;
    }
    if (d.p === 'multa') {
      const v = d.valor || 50000;
      card.classList.add('zerado');
      contar(sal, real, real - v, 2500);
      som('sirene');
      banner(`<div class="carimbo">MULTA</div><div class="b-big neg">− ${brl(v)}</div><div class="b-sub">${NOMES[k]} · ${esc(d.motivo || 'bagunça no quarto')}</div>`, 'multa', 10000);
      stage.classList.add('treme');
      setTimeout(() => stage.classList.remove('treme'), 900);
      return;
    }
    // zerar a carteira
    card.classList.add('zerado');
    stage.classList.add('treme');
    som('sirene');
    contar(sal, real, 0, 3200);
    setTimeout(() => {
      stage.classList.remove('treme');
      banner(`<div class="b-eyebrow">⚠️ atenção ⚠️</div><div class="b-big neg">CARTEIRA ZERADA</div><div class="b-sub">${NOMES[k]}: R$ 0,00</div>`, 'multa', 10000);
      som('fracasso');
    }, 3300);
  }

  function revelar() {
    const ks = Object.keys(pegadinha);
    if (!ks.length) return;
    ks.forEach(k => {
      clearTimeout(pegadinha[k].timer);
      delete pegadinha[k];
      const card = $('#k-' + k), sal = $('[data-f=saldo]', card);
      card.classList.remove('zerado', 'rico');
      const atual = Number(String(sal.textContent).replace(/[^\d,-]/g, '').replace(',', '.')) * 100 || 0;
      contar(sal, Math.round(atual), st(k).saldo || 0, 1800);
      sal.dataset.v = st(k).saldo || 0;
    });
    banner('<div class="b-big">😜 É BRINCADEIRA!</div><div class="b-sub">o saldo está certinho</div>', 'festa', 6000);
    chuva(['😜', '😂', '🤣'], 36);
    som('buzina');
  }

  function limpar() {
    Object.keys(pegadinha).forEach(k => { clearTimeout(pegadinha[k].timer); });
    if (Object.keys(pegadinha).length) { Object.keys(pegadinha).forEach(k => delete pegadinha[k]); if (D) KIDS.forEach(k => { $('#k-' + k).classList.remove('zerado', 'rico'); $('#k-' + k + ' [data-f=saldo]').textContent = brl(st(k).saldo); }); }
    clearInterval(contaT);
    clearTimeout(bannerT);
    player.pause();
    if (window.speechSynthesis) speechSynthesis.cancel();
    stage.classList.remove('foco', 'holofote', 'treme');
    letreiro = '';
    if (D) preencherLetreiro();
    fx().innerHTML = '';
  }

  // ------------------------------------------------------------ sons (gerados na hora, sem arquivos)
  let ac = null, somLigado = false;
  function ctx() {
    if (!ac) { const C = window.AudioContext || window.webkitAudioContext; if (C) ac = new C(); }
    return ac;
  }
  function ligarSom() {
    const c = ctx();
    if (c && c.state === 'suspended') c.resume();
    player.src = SILENT;
    player.play().catch(() => {});
    if (!somLigado) { somLigado = true; $('#som-aviso').classList.add('sai'); }
    const el = document.documentElement;
    const fs = el.requestFullscreen || el.webkitRequestFullscreen;
    if (fs && !document.fullscreenElement && !document.webkitFullscreenElement) { try { fs.call(el); } catch (e) { /* TV sem tela cheia */ } }
  }
  addEventListener('click', ligarSom);
  addEventListener('keydown', ligarSom);

  function tom(f, t, dur, tipo, vol, fFim) {
    const c = ctx(), o = c.createOscillator(), g = c.createGain(), t0 = c.currentTime + t;
    o.type = tipo || 'sine';
    o.frequency.setValueAtTime(f, t0);
    if (fFim) o.frequency.linearRampToValueAtTime(fFim, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t0 + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(c.destination); // connect() não encadeia em navegador antigo
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }
  let ruidoBuf = null;
  function ruido(t, dur, vol, freq, q) {
    const c = ctx();
    if (!ruidoBuf) {
      ruidoBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = ruidoBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t0 = c.currentTime + t;
    s.buffer = ruidoBuf;
    f.type = 'bandpass'; f.frequency.value = freq || 1000; f.Q.value = q || 1;
    g.gain.setValueAtTime(vol || 0.3, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    s.connect(f); f.connect(g); g.connect(c.destination);
    s.start(t0);
    s.stop(t0 + dur + 0.05);
  }
  const SONS = {
    ding: () => { tom(880, 0, 0.7, 'sine', 0.25); tom(1318, 0.1, 0.9, 'sine', 0.18); },
    pop: () => tom(520, 0, 0.18, 'triangle', 0.25, 900),
    tic: () => tom(1200, 0, 0.06, 'square', 0.08),
    tambor: () => {
      let t = 0;
      for (let i = 0; i < 34; i++) { ruido(t, 0.09, 0.35 + i / 80, 200, 0.7); t += Math.max(0.035, 0.11 - i * 0.003); }
      ruido(t + 0.05, 1.4, 0.6, 3500, 0.4); tom(70, t + 0.05, 0.6, 'sine', 0.5, 40);
    },
    palmas: () => { for (let i = 0; i < 26; i++) ruido(Math.random() * 2.2, 0.06, 0.5, 1400 + Math.random() * 600, 1.3); },
    buzina: () => { [0, 0.42].forEach(t => [220, 277, 330].forEach(f => tom(f, t, 0.36, 'sawtooth', 0.09))); },
    sirene: () => { for (let i = 0; i < 3; i++) { tom(620, i, 0.5, 'sine', 0.22, 1150); tom(1150, i + 0.5, 0.5, 'sine', 0.22, 620); } },
    fanfarra: () => { [523, 659, 784, 1046].forEach((f, i) => tom(f, i * 0.14, i === 3 ? 0.9 : 0.2, 'triangle', 0.22)); tom(784, 0.42, 0.9, 'triangle', 0.14); },
    fracasso: () => { [392, 370, 349].forEach((f, i) => tom(f, i * 0.45, 0.42, 'sawtooth', 0.1, f - 8)); tom(330, 1.35, 1.2, 'sawtooth', 0.1, 300); },
    alarme: () => { for (let i = 0; i < 8; i++) tom(i % 2 ? 660 : 880, i * 0.22, 0.18, 'square', 0.1); },
  };
  function som(nome) {
    const c = ctx();
    if (!c || !SONS[nome]) return;
    if (c.state === 'suspended') c.resume();
    try { SONS[nome](); } catch (e) { /* TV sem Web Audio completo */ }
  }

  // ------------------------------------------------------------ ambiente
  // brasas subindo devagar (CSS faz a animação; aqui só espalha)
  (function () {
    const b = document.querySelector('.brasas');
    if (document.body.classList.contains('leve')) return;
    for (let i = 0; i < 26; i++) {
      const e = document.createElement('i');
      e.style.left = Math.random() * 100 + '%';
      e.style.animationDuration = (14 + Math.random() * 18) + 's';
      e.style.animationDelay = (-Math.random() * 30) + 's';
      e.style.setProperty('--s', (2 + Math.random() * 4) + 'px');
      e.style.setProperty('--dx', (Math.random() * 160 - 80) + 'px');
      b.appendChild(e);
    }
  })();

  // tela não apaga enquanto o painel está aberto (quando o navegador deixa)
  let trava = null;
  async function manterAcesa() {
    try { if (navigator.wakeLock && document.visibilityState === 'visible') trava = await navigator.wakeLock.request('screen'); } catch (e) { trava = null; }
  }
  document.addEventListener('visibilitychange', manterAcesa);
  manterAcesa();

  if (!API || API.indexOf('COLE') === 0) {
    stage.innerHTML = '<div class="falha"><h1>Mesada</h1><p>Configure a URL da API no config.js</p></div>';
    escala();
    return;
  }
  escala();
  carregar();
  poll();
})();
