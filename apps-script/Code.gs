/**
 * Mesada — backend (Google Apps Script + Google Sheets)
 *
 * Toda chamada chega por POST (Content-Type text/plain, evita preflight CORS)
 * com corpo JSON { action, ...params } e responde { ok, data | error }.
 *
 * Dinheiro sempre em CENTAVOS (inteiro). Saldo = soma da aba Movimentos.
 * Mídia (foto/áudio) em base64, quebrada em partes de CHUNK caracteres
 * na aba Midia (uma linha por parte) e remontada na leitura.
 */

const TZ = 'America/Sao_Paulo';
const CHUNK = 45000; // limite de célula do Sheets é 50.000 caracteres
const KIDS = ['cesar', 'arthur'];
const ADMIN = 'ericky';

const SHEETS = {
  Usuarios:   ['id', 'nome', 'cor', 'foto_id', 'chat_visto', 'meta_item'],
  Relatos:    ['id', 'usuario', 'criado_em', 'foto_id', 'audio_id', 'status', 'nota', 'valor', 'resposta_audio_id', 'avaliado_em', 'tentativas', 'missao_id', 'tarefa_id'],
  Midia:      ['midia_id', 'parte', 'total', 'mime', 'dados'],
  // categoria: '' (prêmio) ou 'mercadinho' (foto + preço, nome opcional)
  Loja:       ['id', 'nome', 'emoji', 'preco', 'imagem_id', 'ativo', 'categoria'],
  // imagem_id: a foto do item no momento da compra (o item pode sair da loja depois)
  Resgates:   ['id', 'usuario', 'item_id', 'nome', 'emoji', 'preco', 'status', 'criado_em', 'atualizado_em', 'imagem_id'],
  Movimentos: ['id', 'usuario', 'tipo', 'valor', 'ref', 'data'],
  Mensagens:  ['id', 'usuario', 'criado_em', 'tipo', 'texto', 'midia_id', 'mime', 'ref'],
  // missões avulsas: o Ericky fotografa algo para fazer e põe um preço; o primeiro que pegar faz
  // tipo: solo (o primeiro que pegar leva tudo) ou dupla (um relato vale pelos dois, o valor é dividido)
  Missoes:    ['id', 'titulo', 'foto_id', 'valor', 'status', 'criado_em', 'usuario', 'relato_id', 'atualizado_em', 'tipo'],
  // tarefas fixas: dias = dígitos 1..7 (1 = segunda); para = ambos | cesar | arthur; uma vez por dia
  Tarefas:    ['id', 'titulo', 'emoji', 'valor', 'dias', 'para', 'ativo', 'criado_em'],
  Multas:     ['id', 'usuario', 'motivo', 'foto_id', 'valor', 'status', 'criado_em'],
  // leilão: o lance fica reservado do saldo; quem é coberto recebe de volta na hora
  Leiloes:    ['id', 'nome', 'emoji', 'foto_id', 'lance_min', 'fim', 'status', 'lider', 'lance', 'resgate_id', 'criado_em'],
  // cofrinho: guardar (+), retirar (−), rendimento (+). Centavos COM casas decimais (o rendimento é fração de centavo)
  Cofre:      ['id', 'usuario', 'tipo', 'valor', 'data'],
};

// rendimento do cofrinho: metade do CDI (≈ metade de um CDB 100% do CDI), creditado por dia corrido
const COFRE_FRACAO_CDI = 0.5;
const CDI_PADRAO_ANO = 0.149;     // usado só se o Banco Central nunca tiver respondido
const MISSAO_MAX = 10000;         // R$ 100,00
const LANCE_PASSO = 10;           // lance seguinte: no mínimo R$ 0,10 acima
const LEILAO_PRORROGA_MS = 2 * 60 * 1000; // lance nos últimos 2 min empurra o fim
const GANHOS = ['relato', 'missao_dupla']; // o que conta como "ganhou" (semana, mês, ranking, medalhas)

/** Rode uma vez pelo editor: cria abas, cabeçalhos e usuários. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (name) {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(SHEETS[name]);
      sh.setFrozenRows(1);
    } else {
      // colunas novas entram no fim do cabeçalho de abas que já existiam
      sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]);
    }
    sh.getRange(1, 1, sh.getMaxRows(), SHEETS[name].length).setNumberFormat('@');
  });
  const u = sheet_('Usuarios');
  if (u.getLastRow() === 1) {
    u.getRange(2, 1, 3, 4).setValues([
      ['cesar', 'Cesar', '#3b82f6', ''],
      ['arthur', 'Arthur', '#22c55e', ''],
      ['ericky', 'Ericky', '#f5f5f5', ''],
    ]);
  }
  const d = ss.getSheetByName('Sheet1') || ss.getSheetByName('Página1');
  if (d && ss.getSheets().length > 1) ss.deleteSheet(d);
}

// ---------------------------------------------------------------- entrada

function doPost(e) {
  let out;
  try {
    const req = JSON.parse(e.postData.contents);
    const fn = API[req.action];
    if (!fn) throw new Error('Ação inválida: ' + req.action);
    if (READ_ONLY.indexOf(req.action) >= 0 || LOCK_PROPRIO.indexOf(req.action) >= 0) {
      out = { ok: true, data: fn(req) };
    } else {
      const lock = LockService.getScriptLock();
      lock.waitLock(25000);
      try { out = { ok: true, data: fn(req) }; } finally { lock.releaseLock(); }
    }
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  return ContentService.createTextOutput(JSON.stringify({ ok: true, data: 'mesada api' }))
    .setMimeType(ContentService.MimeType.JSON);
}

const READ_ONLY = ['bootstrap', 'midia', 'chat', 'tvPainel', 'tvPoll'];
// tvEnviar só mexe no cache (não na planilha): tem trava própria para não esperar o upload de um relato
const LOCK_PROPRIO = ['tvEnviar'];

const API = {
  bootstrap: bootstrap_,
  midia: function (r) { return getMidia_(r.ids || []); },
  novoRelato: novoRelato_,
  setFoto: setFoto_,
  avaliar: avaliar_,
  lojaSalvar: lojaSalvar_,
  lojaRemover: lojaRemover_,
  resgatar: resgatar_,
  resgateStatus: resgateStatus_,
  resgatesEntregar: resgatesEntregar_,
  chat: chat_,
  enviarMsg: enviarMsg_,
  apagarMsg: apagarMsg_,
  pix: pix_,
  apagarRelato: apagarRelato_,
  missaoCriar: missaoCriar_,
  missaoCancelar: missaoCancelar_,
  cofreGuardar: cofreGuardar_,
  cofreRetirar: cofreRetirar_,
  setMeta: setMeta_,
  tarefaSalvar: tarefaSalvar_,
  tarefaRemover: tarefaRemover_,
  presente: presente_,
  multa: multa_,
  multaPerdoar: multaPerdoar_,
  leilaoCriar: leilaoCriar_,
  leilaoCancelar: leilaoCancelar_,
  lance: lance_,
  tvPainel: tvPainel_,
  tvPoll: tvPoll_,
  tvEnviar: tvEnviar_,
  tvMidia: tvMidia_,
};

// ---------------------------------------------------------------- leitura

function bootstrap_(r) {
  const me = checkUser_(r.usuario);
  const admin = me === ADMIN;
  // bootstrap não pega o lock do doPost; o crédito diário do cofrinho escreve, então pega o seu (ocupado: credita na próxima)
  const lock = LockService.getScriptLock();
  if (lock.tryLock(5000)) { try { acumularCofre_(); encerrarLeiloes_(); } finally { lock.releaseLock(); } }

  const usuarios = rows_('Usuarios');
  const relatos = rows_('Relatos');
  const resgates = rows_('Resgates');
  const movs = rows_('Movimentos');

  const cofre = rows_('Cofre');
  const stats = {};
  KIDS.forEach(function (k) { stats[k] = statsDe_(k, relatos, resgates, movs); stats[k].cofre = cofreDe_(k, cofre); });

  const minhas = function (x) { return admin || x.usuario === me; };
  const byNewest = function (a, b) { return a.criado_em < b.criado_em ? 1 : -1; };

  return {
    me: me,
    usuarios: usuarios.map(function (u) {
      return { id: u.id, nome: u.nome, cor: u.cor, foto_id: u.foto_id, meta_item: u.meta_item, stats: stats[u.id] || null };
    }),
    relatos: relatos.filter(minhas).sort(byNewest).slice(0, admin ? 300 : 100).map(numRelato_),
    resgates: resgates.filter(minhas).sort(byNewest).slice(0, 300).map(function (x) {
      x.preco = Number(x.preco); return x;
    }),
    chat: ultimasMsgs_(80),
    vistos: vistos_(usuarios),
    loja: rows_('Loja').filter(function (i) { return i.ativo !== 'false'; }).map(function (i) {
      i.preco = Number(i.preco); return i;
    }).sort(function (a, b) { return a.preco - b.preco; }),
    extrato: admin ? [] : movs.filter(function (m) { return m.usuario === me; })
      .sort(function (a, b) { return a.data < b.data ? 1 : -1; }).slice(0, 50)
      .map(function (m) { m.valor = Number(m.valor); return m; }),
    missoes: rows_('Missoes').filter(function (m) {
      return m.status === 'aberta' || m.status === 'fazendo'
        || (m.status === 'concluida' && (admin || m.usuario === me || m.tipo === 'dupla'));
    }).sort(byNewest).slice(0, 60).map(function (m) { m.valor = Number(m.valor); m.tipo = m.tipo || 'solo'; return m; }),
    tarefas: rows_('Tarefas').filter(function (t) {
      return t.ativo !== 'false' && (admin || t.para === 'ambos' || t.para === me);
    }).map(function (t) { t.valor = Number(t.valor); return t; }),
    multas: rows_('Multas').filter(function (m) { return admin || m.usuario === me; })
      .sort(byNewest).slice(0, 40).map(function (m) { m.valor = Number(m.valor); return m; }),
    leiloes: rows_('Leiloes').filter(function (l) {
      return l.status === 'aberto' || (l.status === 'encerrado' && Date.now() - new Date(l.fim).getTime() < 7 * 864e5);
    }).sort(byNewest).map(function (l) { l.lance_min = Number(l.lance_min); l.lance = Number(l.lance || 0); return l; }),
    agora: new Date().toISOString(),
    taxas: taxas_(),
  };
}

function numRelato_(x) {
  x.nota = x.nota === '' ? null : Number(x.nota);
  x.valor = x.valor === '' ? null : Number(x.valor);
  x.tentativas = Number(x.tentativas || 1);
  return x;
}

function statsDe_(k, relatos, resgates, movs) {
  const now = new Date();
  const hoje = dia_(now);
  const semanaIni = dia_(inicioSemana_(now));
  const mesIni = hoje.slice(0, 7);

  // últimas 8 semanas (segunda a domingo), da mais antiga para a atual — gráfico de ganhos
  const inicios = [];
  for (let i = 7; i >= 0; i--) { const x = inicioSemana_(now); x.setDate(x.getDate() - 7 * i); inicios.push(dia_(x)); }
  const semanas = inicios.map(function () { return 0; });

  let saldo = 0, semana = 0, mes = 0, total = 0;
  movs.forEach(function (m) {
    if (m.usuario !== k) return;
    const v = Number(m.valor);
    saldo += v;
    if (GANHOS.indexOf(m.tipo) >= 0) {
      const d = dia_(new Date(m.data));
      for (let j = inicios.length - 1; j >= 0; j--) if (d >= inicios[j]) { semanas[j] += v; break; }
      total += v;
      if (d >= semanaIni) semana += v;
      if (d.slice(0, 7) === mesIni) mes += v;
    }
  });

  const meus = relatos.filter(function (x) { return x.usuario === k; });
  const aprovados = meus.filter(function (x) { return x.status === 'aprovado'; });
  const notas = aprovados.map(function (x) { return Number(x.nota); });

  // sequência: dias consecutivos (terminando hoje ou ontem) com relato enviado
  const dias = {};
  meus.forEach(function (x) { dias[dia_(new Date(x.criado_em))] = true; });
  let streak = 0;
  const cur = new Date(now);
  const hojeFeito = !!dias[hoje];
  if (!hojeFeito) cur.setDate(cur.getDate() - 1); // ainda dá tempo de manter a ofensiva hoje
  while (dias[dia_(cur)]) { streak++; cur.setDate(cur.getDate() - 1); }

  // recorde: a maior sequência de dias seguidos de todos os tempos
  let recorde = 0, seq = 0, ant = null;
  Object.keys(dias).sort().forEach(function (d) {
    const t = new Date(d + 'T12:00:00Z').getTime();
    seq = ant !== null && Math.round((t - ant) / 864e5) === 1 ? seq + 1 : 1;
    if (seq > recorde) recorde = seq;
    ant = t;
  });

  return {
    saldo: saldo, semana: semana, mes: mes, total: total, semanas: semanas, semanasIni: inicios,
    relatos: meus.length,
    aprovados: aprovados.length,
    nota10: notas.filter(function (n) { return n === 10; }).length,
    media: notas.length ? Math.round(notas.reduce(function (a, b) { return a + b; }, 0) / notas.length * 10) / 10 : 0,
    streak: streak,
    recorde: Math.max(recorde, streak),
    hojeFeito: hojeFeito,
    resgatesEntregues: resgates.filter(function (x) { return x.usuario === k && x.status === 'entregue'; }).length,
  };
}

// ---------------------------------------------------------------- escrita

function novoRelato_(r) {
  const k = checkKid_(r.usuario);
  const fotos = r.fotos || (r.foto ? [r.foto] : []);
  if (!fotos.length) throw new Error('Envie pelo menos uma foto');
  const agora = new Date().toISOString();
  // missão: confere ANTES de gravar a mídia, para não deixar foto órfã se o outro irmão pegou primeiro
  let missaoRow = 0;
  if (r.missaoId && !r.refazerId) {
    missaoRow = findRow_('Missoes', r.missaoId);
    const ms = rowObj_('Missoes', missaoRow);
    if (ms.status !== 'aberta') throw new Error(ms.status === 'fazendo' ? nome_(ms.usuario) + ' já pegou essa missão' : 'Essa missão não está mais disponível');
  }
  let tarefaId = '';
  if (r.tarefaId && !r.refazerId && !missaoRow) {
    const t = rowObj_('Tarefas', findRow_('Tarefas', r.tarefaId));
    if (t.ativo === 'false' || (t.para !== 'ambos' && t.para !== k)) throw new Error('Essa tarefa não é sua');
    if (String(t.dias).indexOf(Utilities.formatDate(new Date(), TZ, 'u')) < 0) throw new Error('Essa tarefa não é para hoje');
    const hoje = dia_(new Date());
    if (rows_('Relatos').some(function (x) { return x.tarefa_id === t.id && x.usuario === k && dia_(new Date(x.criado_em)) === hoje; })) {
      throw new Error('Você já mandou essa tarefa hoje');
    }
    tarefaId = t.id;
  }
  const fotoId = fotos.map(saveMidia_).join(','); // várias fotos: ids separados por vírgula
  const audioId = r.audio && r.audio.data ? saveMidia_(r.audio) : '';

  if (r.refazerId) {
    const row = findRow_('Relatos', r.refazerId);
    const x = rowObj_('Relatos', row);
    if (x.usuario !== k || x.status !== 'refazer') throw new Error('Esse relato não pode ser refeito');
    x.foto_id.split(',').forEach(deleteMidia_);
    deleteMidia_(x.audio_id);
    setFields_('Relatos', row, {
      foto_id: fotoId, audio_id: audioId, status: 'pendente', criado_em: agora,
      tentativas: Number(x.tentativas || 1) + 1,
    });
    return { id: x.id };
  }

  const id = uid_();
  sheet_('Relatos').appendRow([id, k, agora, fotoId, audioId, 'pendente', '', '', '', '', 1, missaoRow ? r.missaoId : '', tarefaId]);
  if (missaoRow) setFields_('Missoes', missaoRow, { status: 'fazendo', usuario: k, relato_id: id, atualizado_em: agora });
  return { id: id };
}

/** Apaga um relato (qualquer status). Dinheiro já ganho continua no saldo. */
function apagarRelato_(r) {
  const me = checkUser_(r.usuario);
  const row = findRow_('Relatos', r.id);
  const x = rowObj_('Relatos', row);
  if (x.usuario !== me && me !== ADMIN) throw new Error('Só dá para apagar os seus');
  x.foto_id.split(',').forEach(deleteMidia_);
  deleteMidia_(x.audio_id);
  deleteMidia_(x.resposta_audio_id);
  sheet_('Relatos').deleteRow(row);
  // relato de missão apagado antes de aprovar: a missão volta para o catálogo
  if (x.missao_id && x.status !== 'aprovado') {
    try {
      const mr = findRow_('Missoes', x.missao_id);
      if (rowObj_('Missoes', mr).status === 'fazendo') {
        setFields_('Missoes', mr, { status: 'aberta', usuario: '', relato_id: '', atualizado_em: new Date().toISOString() });
      }
    } catch (e) { /* missão já removida */ }
  }
  return { ok: true };
}

function setFoto_(r) {
  const me = checkUser_(r.usuario);
  const row = findRow_('Usuarios', me);
  const u = rowObj_('Usuarios', row);
  const novo = saveMidia_(r.foto);
  deleteMidia_(u.foto_id);
  setFields_('Usuarios', row, { foto_id: novo });
  return { foto_id: novo };
}

function avaliar_(r) {
  checkAdmin_(r.usuario);
  const row = findRow_('Relatos', r.id);
  const x = rowObj_('Relatos', row);
  if (x.status !== 'pendente') throw new Error('Esse relato já foi avaliado');
  const agora = new Date().toISOString();

  if (r.status === 'aprovado') {
    const nota = Math.round(Number(r.nota));
    const valor = Math.round(Number(r.valor));
    if (!(nota >= 1 && nota <= 10)) throw new Error('Nota deve ser de 1 a 10');
    const max = x.missao_id ? MISSAO_MAX : 1000;
    if (!(valor >= 1 && valor <= max)) throw new Error('Valor deve ser de R$ 0,01 a ' + reais_(max));
    setFields_('Relatos', row, { status: 'aprovado', nota: nota, valor: valor, avaliado_em: agora });
    let ms = null, mr = 0;
    if (x.missao_id) {
      try { mr = findRow_('Missoes', x.missao_id); ms = rowObj_('Missoes', mr); } catch (e) { /* missão já removida */ }
    }
    if (ms && ms.tipo === 'dupla') {
      // dupla: metade para cada; o centavo ímpar fica com quem mandou o relato
      const meu = Math.ceil(valor / 2);
      addMov_(x.usuario, 'relato', meu, x.id);
      addMov_(outro_(x.usuario), 'missao_dupla', valor - meu, x.id);
    } else {
      addMov_(x.usuario, 'relato', valor, x.id);
    }
    if (ms) {
      setFields_('Missoes', mr, { status: 'concluida', atualizado_em: agora });
      sistema_(ms.tipo === 'dupla'
        ? '👥 Cesar e Arthur concluíram a missão' + (ms.titulo ? ' "' + ms.titulo + '"' : '') + ' — ' + reais_(valor) + ' divididos'
        : '🎯 ' + nome_(x.usuario) + ' concluiu a missão' + (ms.titulo ? ' "' + ms.titulo + '"' : '') + ' e ganhou ' + reais_(valor), ms.id);
    }
  } else if (r.status === 'refazer') {
    const resp = r.resposta ? saveMidia_(r.resposta) : '';
    deleteMidia_(x.resposta_audio_id);
    setFields_('Relatos', row, { status: 'refazer', resposta_audio_id: resp, avaliado_em: agora });
  } else {
    throw new Error('Status inválido');
  }
  return { ok: true };
}

function lojaSalvar_(r) {
  checkAdmin_(r.usuario);
  const it = r.item || {};
  const preco = Math.round(Number(it.preco));
  const nome = String(it.nome || '').trim().slice(0, 60);
  const categoria = it.categoria === 'mercadinho' ? 'mercadinho' : '';
  if (!(preco >= 1)) throw new Error('Preço é obrigatório');
  if (!nome && !it.imagem && !it.id) throw new Error('Coloque um nome ou uma foto');
  const imagemNova = it.imagem ? saveMidia_(it.imagem) : null;

  if (it.id) {
    const row = findRow_('Loja', it.id);
    const old = rowObj_('Loja', row);
    const f = { nome: nome, emoji: it.emoji || '', preco: preco, categoria: categoria };
    if (imagemNova) { deleteMidia_(old.imagem_id); f.imagem_id = imagemNova; }
    if (it.removerImagem) { deleteMidia_(old.imagem_id); f.imagem_id = ''; }
    setFields_('Loja', row, f);
    return { id: it.id };
  }
  const id = uid_();
  sheet_('Loja').appendRow([id, nome, it.emoji || (categoria ? '🛒' : '🎁'), preco, imagemNova || '', 'true', categoria]);
  return { id: id };
}

function lojaRemover_(r) {
  checkAdmin_(r.usuario);
  setFields_('Loja', findRow_('Loja', r.id), { ativo: 'false' });
  return { ok: true };
}

function resgatar_(r) {
  const k = checkKid_(r.usuario);
  const item = rowObj_('Loja', findRow_('Loja', r.itemId));
  if (item.ativo === 'false') throw new Error('Item indisponível');
  const preco = Number(item.preco);
  if (saldo_(k) < preco) throw new Error('Saldo insuficiente');

  const id = uid_();
  const agora = new Date().toISOString();
  sheet_('Resgates').appendRow([id, k, item.id, item.nome, item.emoji, preco, 'pendente', agora, agora, item.imagem_id]);
  addMov_(k, 'resgate', -preco, id); // reserva o saldo na hora do pedido
  return { id: id };
}

function resgateStatus_(r) {
  checkAdmin_(r.usuario);
  const row = findRow_('Resgates', r.id);
  const x = rowObj_('Resgates', row);
  if (x.status !== 'pendente') throw new Error('Resgate já finalizado');
  if (r.status === 'entregue') {
    setFields_('Resgates', row, { status: 'entregue', atualizado_em: new Date().toISOString() });
    sistema_('🎁 ' + x.emoji + ' ' + (x.nome || 'item do mercadinho') + ' → ' + nome_(x.usuario), x.id);
  } else if (r.status === 'cancelado') {
    setFields_('Resgates', row, { status: 'cancelado', atualizado_em: new Date().toISOString() });
    addMov_(x.usuario, 'estorno', Number(x.preco), x.id);
  } else {
    throw new Error('Status inválido');
  }
  return { ok: true };
}

/** Entrega vários itens da mochila de uma vez (tela "Entregar"); ignora os que já foram finalizados. */
function resgatesEntregar_(r) {
  checkAdmin_(r.usuario);
  const ids = (r.ids || []).map(String);
  const agora = new Date().toISOString();
  const porKid = {};
  ids.forEach(function (id) {
    const row = findRow_('Resgates', id);
    const x = rowObj_('Resgates', row);
    if (x.status !== 'pendente') return;
    setFields_('Resgates', row, { status: 'entregue', atualizado_em: agora });
    (porKid[x.usuario] = porKid[x.usuario] || []).push(x.emoji || '🎁');
  });
  Object.keys(porKid).forEach(function (k) {
    const l = porKid[k];
    sistema_('🎁 Entregue para ' + nome_(k) + ': ' + l.join(' ') + (l.length > 1 ? ' (' + l.length + ' itens)' : ''), '');
  });
  return { ok: true };
}

// ---------------------------------------------------------------- chat

function ultimasMsgs_(n, desde) {
  let msgs = rows_('Mensagens');
  if (desde) msgs = msgs.filter(function (m) { return m.criado_em > desde; });
  return msgs.slice(-n);
}

function vistos_(usuarios) {
  const v = {};
  usuarios.forEach(function (u) { v[u.id] = u.chat_visto || ''; });
  return v;
}

/** Busca rápida do chat (polling): mensagens novas + quem já viu. Pode marcar como visto. */
function chat_(r) {
  const me = checkUser_(r.usuario);
  if (r.visto) setFields_('Usuarios', findRow_('Usuarios', me), { chat_visto: new Date().toISOString() });
  return { msgs: ultimasMsgs_(200, r.desde || ''), vistos: vistos_(rows_('Usuarios')) };
}

function enviarMsg_(r) {
  const me = checkUser_(r.usuario);
  const tipo = r.tipo || 'texto';
  if (['texto', 'imagem', 'video', 'audio', 'arquivo'].indexOf(tipo) < 0) throw new Error('Tipo inválido');
  const texto = String(r.texto || '').slice(0, 4000);
  let midiaId = '', mime = '';
  if (tipo !== 'texto') {
    if (!r.midia || !r.midia.data) throw new Error('Mídia vazia');
    midiaId = saveMidia_(r.midia);
    mime = r.midia.mime;
  } else if (!texto.trim()) {
    throw new Error('Mensagem vazia');
  }
  // ref: nome do arquivo, ou a capa (primeiro quadro) do vídeo
  const ref = tipo === 'video' && r.poster && r.poster.data ? saveMidia_(r.poster) : String(r.nome || '').slice(0, 120);
  return addMsg_(me, tipo, texto, midiaId, mime, ref);
}

function addMsg_(usuario, tipo, texto, midiaId, mime, ref) {
  const m = {
    id: uid_(), usuario: usuario, criado_em: new Date().toISOString(), tipo: tipo,
    texto: texto || '', midia_id: midiaId || '', mime: mime || '', ref: ref || '',
  };
  sheet_('Mensagens').appendRow(SHEETS.Mensagens.map(function (k) { return m[k]; }));
  return m;
}

function sistema_(texto, ref) { return addMsg_('sistema', 'sistema', texto, '', '', ref); }

function apagarMsg_(r) {
  const me = checkUser_(r.usuario);
  const row = findRow_('Mensagens', r.id);
  const m = rowObj_('Mensagens', row);
  if (m.usuario !== me && me !== ADMIN) throw new Error('Só dá para apagar as suas');
  if (['pix', 'sistema', 'presente', 'multa'].indexOf(m.tipo) >= 0) throw new Error('Essa não pode ser apagada');
  deleteMidia_(m.midia_id);
  if (m.tipo === 'video') deleteMidia_(m.ref);
  setFields_('Mensagens', row, { tipo: 'apagada', texto: '', midia_id: '', mime: '', ref: '' });
  return { ok: true };
}

// ---------------------------------------------------------------- missões

function missaoCriar_(r) {
  checkAdmin_(r.usuario);
  const valor = Math.round(Number(r.valor));
  if (!(valor >= 1 && valor <= MISSAO_MAX)) throw new Error('Valor deve ser de R$ 0,01 a ' + reais_(MISSAO_MAX));
  if (!r.foto || !r.foto.data) throw new Error('Tire uma foto do que precisa ser feito');
  const titulo = String(r.titulo || '').trim().slice(0, 80);
  const agora = new Date().toISOString();
  const tipo = r.tipo === 'dupla' ? 'dupla' : 'solo';
  const m = { id: uid_(), titulo: titulo, foto_id: saveMidia_(r.foto), valor: valor, status: 'aberta', criado_em: agora, usuario: '', relato_id: '', atualizado_em: agora, tipo: tipo };
  sheet_('Missoes').appendRow(SHEETS.Missoes.map(function (k) { return m[k]; }));
  sistema_((tipo === 'dupla' ? '👥 Nova missão em dupla' : '🎯 Nova missão') + (titulo ? ': ' + titulo : '') + ' — vale ' + reais_(valor), m.id);
  return { id: m.id };
}

/** Só missão ainda aberta sai do catálogo; se alguém já pegou, o Ericky avalia o relato. */
function missaoCancelar_(r) {
  checkAdmin_(r.usuario);
  const row = findRow_('Missoes', r.id);
  const m = rowObj_('Missoes', row);
  if (m.status !== 'aberta') throw new Error(m.status === 'fazendo' ? nome_(m.usuario) + ' já está fazendo — avalie o relato' : 'Essa missão já foi finalizada');
  deleteMidia_(m.foto_id);
  setFields_('Missoes', row, { status: 'cancelada', foto_id: '', atualizado_em: new Date().toISOString() });
  return { ok: true };
}

// ---------------------------------------------------------------- cofrinho e meta

/** Taxas do dia: CDI anual (Banco Central, série 12 — % ao dia útil), metade dele ao ano e o equivalente por dia corrido. */
function taxas_() {
  const props = PropertiesService.getScriptProperties();
  const hoje = dia_(new Date());
  let cdi = Number(props.getProperty('cdi_ano')) || CDI_PADRAO_ANO;
  if (props.getProperty('cdi_dia') !== hoje) {
    try {
      const res = UrlFetchApp.fetch('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados/ultimos/1?formato=json', { muteHttpExceptions: true });
      if (res.getResponseCode() === 200) {
        const d = Number(String(JSON.parse(res.getContentText())[0].valor).replace(',', '.'));
        if (d > 0 && d < 1) cdi = Math.pow(1 + d / 100, 252) - 1;
      }
    } catch (e) { /* sem resposta: mantém o último CDI conhecido */ }
    props.setProperties({ cdi_ano: String(cdi), cdi_dia: hoje });
  }
  const ano = cdi * COFRE_FRACAO_CDI;
  return { cdiAno: cdi, ano: ano, dia: Math.pow(1 + ano, 1 / 365) - 1, desde: hoje };
}

/**
 * Credita o rendimento dos dias que passaram desde o último crédito (uma linha por irmão, juros compostos).
 * O que entra hoje passa a contar no crédito de amanhã cedo; o front anima o pedaço do dia em curso.
 */
function acumularCofre_() {
  const props = PropertiesService.getScriptProperties();
  const hoje = dia_(new Date());
  const ate = props.getProperty('cofre_ate');
  if (ate === hoje) return;
  if (ate) {
    const dias = Math.round((Date.parse(hoje + 'T12:00:00Z') - Date.parse(ate + 'T12:00:00Z')) / 864e5);
    if (dias > 0) {
      const t = taxas_();
      const cofre = rows_('Cofre');
      const agora = new Date().toISOString();
      KIDS.forEach(function (k) {
        const rend = cofreDe_(k, cofre).saldo * (Math.pow(1 + t.dia, dias) - 1);
        if (rend > 0) sheet_('Cofre').appendRow([uid_(), k, 'rendimento', rend.toFixed(6), agora]);
      });
    }
  }
  props.setProperty('cofre_ate', hoje);
}

function cofreDe_(k, cofre) {
  let saldo = 0, rendido = 0;
  cofre.forEach(function (c) {
    if (c.usuario !== k) return;
    const v = Number(String(c.valor).replace(',', '.')) || 0;
    saldo += v;
    if (c.tipo === 'rendimento') rendido += v;
  });
  return { saldo: saldo, rendido: rendido };
}

function cofreGuardar_(r) {
  const k = checkKid_(r.usuario);
  const valor = Math.round(Number(r.valor));
  if (!(valor >= 1)) throw new Error('Valor inválido');
  if (saldo_(k) < valor) throw new Error('Saldo insuficiente');
  acumularCofre_();
  const id = uid_();
  addMov_(k, 'cofre_guardar', -valor, id);
  sheet_('Cofre').appendRow([id, k, 'guardar', String(valor), new Date().toISOString()]);
  return { id: id };
}

/** Só centavos inteiros voltam para o saldo; a fração de centavo continua rendendo no cofrinho. */
function cofreRetirar_(r) {
  const k = checkKid_(r.usuario);
  acumularCofre_();
  const disponivel = Math.floor(cofreDe_(k, rows_('Cofre')).saldo + 1e-9);
  const valor = Math.round(Number(r.valor));
  if (!(valor >= 1)) throw new Error('Valor inválido');
  if (valor > disponivel) throw new Error('O cofrinho tem ' + reais_(disponivel));
  const id = uid_();
  sheet_('Cofre').appendRow([id, k, 'retirar', String(-valor), new Date().toISOString()]);
  addMov_(k, 'cofre_retirar', valor, id);
  return { id: id };
}

function setMeta_(r) {
  const k = checkKid_(r.usuario);
  const item = String(r.itemId || '');
  if (item && rowObj_('Loja', findRow_('Loja', item)).ativo === 'false') throw new Error('Item indisponível');
  setFields_('Usuarios', findRow_('Usuarios', k), { meta_item: item });
  return { ok: true };
}

function reais_(c) { return 'R$ ' + (Number(c) / 100).toFixed(2).replace('.', ','); }

// ---------------------------------------------------------------- tarefas fixas

function tarefaSalvar_(r) {
  checkAdmin_(r.usuario);
  const t = r.tarefa || {};
  const valor = Math.round(Number(t.valor));
  const titulo = String(t.titulo || '').trim().slice(0, 60);
  const dias = String(t.dias || '').replace(/[^1-7]/g, '');
  const para = ['ambos'].concat(KIDS).indexOf(t.para) >= 0 ? t.para : 'ambos';
  if (!titulo) throw new Error('Dê um nome para a tarefa');
  if (!(valor >= 1 && valor <= 1000)) throw new Error('Valor deve ser de R$ 0,01 a R$ 10,00');
  if (!dias) throw new Error('Escolha pelo menos um dia');
  const f = { titulo: titulo, emoji: String(t.emoji || '✅').slice(0, 8), valor: valor, dias: dias, para: para };
  if (t.id) {
    setFields_('Tarefas', findRow_('Tarefas', t.id), f);
    return { id: t.id };
  }
  const id = uid_();
  sheet_('Tarefas').appendRow([id, f.titulo, f.emoji, f.valor, f.dias, f.para, 'true', new Date().toISOString()]);
  return { id: id };
}

function tarefaRemover_(r) {
  checkAdmin_(r.usuario);
  setFields_('Tarefas', findRow_('Tarefas', r.id), { ativo: 'false' });
  return { ok: true };
}

// ---------------------------------------------------------------- presente do pai e multas

/** Pix surpresa do Ericky: para um irmão ou para os dois (o valor é para cada um). */
function presente_(r) {
  checkAdmin_(r.usuario);
  const valor = Math.round(Number(r.valor));
  if (!(valor >= 1 && valor <= 100000)) throw new Error('Valor inválido');
  const para = r.para === 'ambos' ? KIDS : [checkKid_(r.para)];
  const chave = String(r.chave || '');
  if (chave && !/^[a-z0-9]{8,32}$/.test(chave)) throw new Error('Chave inválida');
  if (chave && rows_('Movimentos').some(function (m) { return m.tipo === 'presente' && m.ref === chave; })) return { id: chave, repetido: true };
  const id = chave || uid_();
  para.forEach(function (k) { addMov_(k, 'presente', valor, id); });
  return addMsg_(ADMIN, 'presente', String(r.texto || '').slice(0, 300), '', '', (r.para === 'ambos' ? 'ambos' : para[0]) + ':' + valor);
}

function multa_(r) {
  checkAdmin_(r.usuario);
  const k = checkKid_(r.para);
  const valor = Math.round(Number(r.valor));
  if (!(valor >= 1 && valor <= 1000)) throw new Error('Multa deve ser de R$ 0,01 a R$ 10,00');
  const motivo = String(r.motivo || '').trim().slice(0, 120);
  if (!motivo) throw new Error('Escreva o motivo');
  const fotoId = r.foto && r.foto.data ? saveMidia_(r.foto) : '';
  const id = uid_();
  sheet_('Multas').appendRow([id, k, motivo, fotoId, valor, 'aplicada', new Date().toISOString()]);
  addMov_(k, 'multa', -valor, id);
  addMsg_(ADMIN, 'multa', motivo, fotoId, fotoId ? 'image/jpeg' : '', k + ':' + valor + ':' + id);
  return { id: id };
}

function multaPerdoar_(r) {
  checkAdmin_(r.usuario);
  const row = findRow_('Multas', r.id);
  const m = rowObj_('Multas', row);
  if (m.status !== 'aplicada') throw new Error('Essa multa já foi perdoada');
  setFields_('Multas', row, { status: 'perdoada' });
  addMov_(m.usuario, 'multa_perdoada', Number(m.valor), m.id);
  sistema_('🤝 Multa perdoada: ' + nome_(m.usuario) + ' recebeu ' + reais_(m.valor) + ' de volta', m.id);
  return { ok: true };
}

// ---------------------------------------------------------------- leilão

function leilaoCriar_(r) {
  checkAdmin_(r.usuario);
  const nome = String(r.nome || '').trim().slice(0, 60);
  const min = Math.round(Number(r.lanceMin));
  const horas = Number(r.horas);
  if (!nome) throw new Error('Dê um nome para o item');
  if (!(min >= 1)) throw new Error('Lance mínimo inválido');
  if (!(horas > 0 && horas <= 24 * 14)) throw new Error('Duração inválida');
  const fotoId = r.foto && r.foto.data ? saveMidia_(r.foto) : '';
  const agora = new Date();
  const fim = new Date(agora.getTime() + horas * 3600e3).toISOString();
  const id = uid_();
  sheet_('Leiloes').appendRow([id, nome, String(r.emoji || '🎁').slice(0, 8), fotoId, min, fim, 'aberto', '', '', '', agora.toISOString()]);
  sistema_('🔨 Leilão aberto: ' + nome + ' — lance inicial ' + reais_(min), id);
  return { id: id };
}

function leilaoCancelar_(r) {
  checkAdmin_(r.usuario);
  const row = findRow_('Leiloes', r.id);
  const l = rowObj_('Leiloes', row);
  if (l.status !== 'aberto') throw new Error('Esse leilão já terminou');
  if (l.lider) addMov_(l.lider, 'lance_devolvido', Number(l.lance), l.id);
  setFields_('Leiloes', row, { status: 'cancelado' });
  sistema_('🔨 Leilão cancelado: ' + l.nome + (l.lider ? ' — o lance voltou para ' + nome_(l.lider) : ''), l.id);
  return { ok: true };
}

function lance_(r) {
  const k = checkKid_(r.usuario);
  encerrarLeiloes_();
  const row = findRow_('Leiloes', r.id);
  const l = rowObj_('Leiloes', row);
  const agora = new Date();
  if (l.status !== 'aberto' || agora >= new Date(l.fim)) throw new Error('Esse leilão já terminou');
  if (l.lider === k) throw new Error('Você já está ganhando');
  const valor = Math.round(Number(r.valor));
  const min = l.lider ? Number(l.lance) + LANCE_PASSO : Number(l.lance_min);
  if (!(valor >= min)) throw new Error('O lance mínimo agora é ' + reais_(min));
  if (saldo_(k) < valor) throw new Error('Saldo insuficiente');
  if (l.lider) addMov_(l.lider, 'lance_devolvido', Number(l.lance), l.id);
  addMov_(k, 'lance', -valor, l.id);
  let fim = l.fim;
  if (new Date(fim) - agora < LEILAO_PRORROGA_MS) fim = new Date(agora.getTime() + LEILAO_PRORROGA_MS).toISOString();
  setFields_('Leiloes', row, { lider: k, lance: valor, fim: fim });
  sistema_('🔨 ' + nome_(k) + ' deu ' + reais_(valor) + ' no leilão: ' + l.nome, l.id);
  return { fim: fim };
}

/** Fecha os leilões vencidos: o lance do líder (já reservado) vira o pedido na mochila. */
function encerrarLeiloes_() {
  const ls = rows_('Leiloes');
  const agora = new Date();
  ls.forEach(function (l, i) {
    if (l.status !== 'aberto' || agora < new Date(l.fim)) return;
    const row = i + 2;
    if (!l.lider) {
      setFields_('Leiloes', row, { status: 'encerrado' });
      return;
    }
    const rid = uid_();
    const iso = agora.toISOString();
    sheet_('Resgates').appendRow([rid, l.lider, l.id, l.nome, l.emoji, Number(l.lance), 'pendente', iso, iso, l.foto_id]);
    setFields_('Leiloes', row, { status: 'encerrado', resgate_id: rid });
    sistema_('🏆 ' + nome_(l.lider) + ' venceu o leilão ' + l.nome + ' por ' + reais_(l.lance), l.id);
  });

}

// ---------------------------------------------------------------- pix

function saldo_(k) {
  return rows_('Movimentos').reduce(function (s, m) {
    return m.usuario === k ? s + Number(m.valor) : s;
  }, 0);
}

function outro_(k) { return k === 'cesar' ? 'arthur' : 'cesar'; }
function nome_(k) { return { cesar: 'Cesar', arthur: 'Arthur', ericky: 'Ericky' }[k] || k; }

function pix_(r) {
  const de = checkKid_(r.usuario);
  const para = outro_(de);
  const valor = Math.round(Number(r.valor));
  if (!(valor >= 1)) throw new Error('Valor inválido');
  // chave única por envio: toque duplo ou reenvio após queda de rede devolve o mesmo Pix
  // em vez de cobrar duas vezes (o lock do doPost garante que a checagem e a gravação não se cruzam)
  const chave = String(r.chave || '');
  if (chave && !/^[a-z0-9]{8,32}$/.test(chave)) throw new Error('Chave inválida');
  if (chave && rows_('Movimentos').some(function (m) { return m.tipo === 'pix_enviado' && m.ref === chave; })) {
    return { id: chave, repetido: true };
  }
  if (saldo_(de) < valor) throw new Error('Saldo insuficiente');
  const id = chave || uid_();
  addMov_(de, 'pix_enviado', -valor, id);
  addMov_(para, 'pix_recebido', valor, id);
  addMsg_(de, 'pix', String(r.texto || '').slice(0, 200), '', '', para + ':' + valor);
  return { id: id };
}

// ---------------------------------------------------------------- mídia

/** m = { mime, data(base64) } → id. Quebra em partes de CHUNK caracteres. */
function saveMidia_(m) {
  if (!m || !m.data || !m.mime) throw new Error('Mídia inválida');
  const id = uid_();
  const parts = [];
  for (let i = 0; i < m.data.length; i += CHUNK) parts.push(m.data.slice(i, i + CHUNK));
  const sh = sheet_('Midia');
  // prefixo "b:" impede o Sheets de interpretar o conteúdo (ex.: começar com "+")
  const values = parts.map(function (p, i) { return [id, i, parts.length, m.mime, 'b:' + p]; });
  const start = sh.getLastRow() + 1;
  const falta = start + values.length - 1 - sh.getMaxRows();
  if (falta > 0) sh.insertRowsAfter(sh.getMaxRows(), falta);
  for (let i = 0; i < values.length; i += 100) {
    const bloco = values.slice(i, i + 100);
    sh.getRange(start + i, 1, bloco.length, 5).setNumberFormat('@').setValues(bloco);
  }
  return id;
}

function getMidia_(ids) {
  const sh = sheet_('Midia');
  const out = {};
  ids.slice(0, 40).forEach(function (id) {
    if (!id) return;
    const found = sh.getRange('A:A').createTextFinder(id).matchEntireCell(true).findAll();
    if (!found.length) return;
    // as partes são gravadas juntas: lê o bloco inteiro numa chamada só (vídeo tem centenas)
    const linhas = found.map(function (c) { return c.getRow(); });
    const ini = Math.min.apply(null, linhas), fim = Math.max.apply(null, linhas);
    const parts = sh.getRange(ini, 1, fim - ini + 1, 5).getValues()
      .filter(function (v) { return String(v[0]) === id; })
      .map(function (v) { return { i: Number(v[1]), mime: v[3], data: String(v[4]).slice(2) }; })
      .sort(function (a, b) { return a.i - b.i; });
    out[id] = { mime: parts[0].mime, data: parts.map(function (p) { return p.data; }).join('') };
  });
  return out;
}

function deleteMidia_(id) {
  if (!id) return;
  const sh = sheet_('Midia');
  const rows = sh.getRange('A:A').createTextFinder(id).matchEntireCell(true).findAll()
    .map(function (c) { return c.getRow(); }).sort(function (a, b) { return b - a; });
  if (rows.length && rows[0] - rows[rows.length - 1] === rows.length - 1) {
    sh.deleteRows(rows[rows.length - 1], rows.length); // bloco contíguo: uma chamada só
  } else {
    rows.forEach(function (r) { sh.deleteRow(r); });
  }
}

// ---------------------------------------------------------------- painel da TV
// A TV (#/tv) lê tudo dos dois e pergunta por comandos do celular do Ericky.
// Comandos vivem só no cache (rápido, some sozinho): nada disso mexe em saldo nem na planilha,
// a não ser a foto/áudio mandados para a TV (aba Midia, só os últimos ficam guardados).
const TV_EVENTOS = 40;              // comandos guardados para a TV buscar
const TV_TTL = 21600;               // 6 h: máximo do CacheService
const TV_QUENTE_MS = 90 * 1000;     // depois de um comando, a TV pergunta mais rápido por 90 s
const TV_MIDIAS = 6;                // fotos/áudios da TV mantidos na aba Midia
const TV_TIPOS = ['oi', 'emoji', 'texto', 'fala', 'comemorar', 'som', 'contagem', 'pegadinha', 'revelar', 'limpar'];

function tvPainel_() {
  const d = bootstrap_({ usuario: ADMIN });
  const movs = rows_('Movimentos').filter(function (m) { return KIDS.indexOf(m.usuario) >= 0; })
    .sort(function (a, b) { return a.data < b.data ? 1 : -1; }).slice(0, 40)
    .map(function (m) { m.valor = Number(m.valor); return m; });
  return {
    usuarios: d.usuarios,
    relatos: d.relatos.slice(0, 40),
    resgates: d.resgates.slice(0, 30),
    loja: d.loja,
    missoes: d.missoes,
    tarefas: d.tarefas,
    multas: d.multas.slice(0, 20),
    leiloes: d.leiloes,
    movs: movs,
    agora: d.agora,
    taxas: d.taxas,
  };
}

function tvPoll_(r) {
  const c = CacheService.getScriptCache();
  const desde = Number(r.desde) || 0;
  const ev = JSON.parse(c.get('tv:ev') || '[]').filter(function (e) { return e.ts > desde; });
  return { agora: Date.now(), quente: Number(c.get('tv:quente') || 0) > Date.now(), ev: ev };
}

function tvEnviar_(r) {
  checkAdmin_(r.usuario);
  if (TV_TIPOS.indexOf(r.tipo) < 0) throw new Error('Comando inválido');
  return tvPush_(r.tipo, tvDados_(r.dados));
}

// foto ou recado de voz: grava a mídia (com a trava da planilha, pelo doPost) e avisa a TV
function tvMidia_(r) {
  checkAdmin_(r.usuario);
  const tipo = r.tipo === 'audio' ? 'audio' : 'foto';
  const m = r.midia || {};
  if (String(m.mime).indexOf(tipo === 'audio' ? 'audio/' : 'image/') !== 0) throw new Error('Mídia inválida');
  if (String(m.data || '').length > 4e6) throw new Error('Arquivo grande demais');
  const id = saveMidia_(m);
  const props = PropertiesService.getScriptProperties();
  const lista = JSON.parse(props.getProperty('tv_midias') || '[]');
  lista.push(id);
  while (lista.length > TV_MIDIAS) deleteMidia_(lista.shift());
  props.setProperty('tv_midias', JSON.stringify(lista));
  const dados = tvDados_(r.dados);
  dados.midia_id = id;
  return tvPush_(tipo, dados);
}

function tvPush_(tipo, dados) {
  const lock = LockService.getDocumentLock() || LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const c = CacheService.getScriptCache();
    const agora = Date.now();
    if (tipo !== 'oi') {
      // só os últimos 10 min interessam: a TV pergunta no máximo a cada poucos segundos
      const ev = JSON.parse(c.get('tv:ev') || '[]').filter(function (e) { return agora - e.ts < 600000; });
      const ts = ev.length && agora <= ev[ev.length - 1].ts ? ev[ev.length - 1].ts + 1 : agora;
      ev.push({ ts: ts, tipo: tipo, dados: dados });
      while (ev.length > TV_EVENTOS) ev.shift();
      c.put('tv:ev', JSON.stringify(ev), TV_TTL);
    }
    c.put('tv:quente', String(agora + TV_QUENTE_MS), TV_TTL);
    return { agora: agora };
  } finally { lock.releaseLock(); }
}

// dados do comando: só texto curto, número e sim/não
function tvDados_(d) {
  const out = {};
  Object.keys(d || {}).slice(0, 12).forEach(function (k) {
    const v = d[k];
    if (typeof v === 'string') out[k] = v.slice(0, 300);
    else if (typeof v === 'number' && isFinite(v)) out[k] = v;
    else if (typeof v === 'boolean') out[k] = v;
  });
  return out;
}

// ---------------------------------------------------------------- helpers

function sheet_(name) {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(name);
  if (!sh && name !== 'Usuarios' && SHEETS[name]) {
    // abas novas (ex.: Mensagens) nascem sozinhas, sem precisar rodar setup() de novo
    sh = ss.insertSheet(name);
    sh.appendRow(SHEETS[name]);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, sh.getMaxRows(), SHEETS[name].length).setNumberFormat('@');
  }
  if (!sh) throw new Error('Aba ' + name + ' não existe — rode setup()');
  return sh;
}

function rows_(name) {
  const sh = sheet_(name);
  const n = sh.getLastRow() - 1;
  if (n < 1) return [];
  const h = SHEETS[name];
  return sh.getRange(2, 1, n, h.length).getValues().map(function (v) {
    const o = {};
    h.forEach(function (k, i) { o[k] = v[i] instanceof Date ? v[i].toISOString() : String(v[i]); });
    return o;
  });
}

function findRow_(name, id) {
  const c = sheet_(name).getRange('A:A').createTextFinder(String(id)).matchEntireCell(true).findNext();
  if (!c) throw new Error('Registro não encontrado');
  return c.getRow();
}

function rowObj_(name, row) {
  const h = SHEETS[name];
  const v = sheet_(name).getRange(row, 1, 1, h.length).getValues()[0];
  const o = {};
  h.forEach(function (k, i) { o[k] = String(v[i]); });
  return o;
}

function setFields_(name, row, fields) {
  const sh = sheet_(name);
  Object.keys(fields).forEach(function (k) {
    const col = SHEETS[name].indexOf(k) + 1;
    sh.getRange(row, col).setValue(fields[k]);
  });
}

function addMov_(usuario, tipo, valor, ref) {
  sheet_('Movimentos').appendRow([uid_(), usuario, tipo, valor, ref, new Date().toISOString()]);
}

function checkUser_(u) {
  if (KIDS.indexOf(u) < 0 && u !== ADMIN) throw new Error('Usuário inválido');
  return u;
}
function checkKid_(u) {
  if (KIDS.indexOf(u) < 0) throw new Error('Só Cesar e Arthur podem fazer isso');
  return u;
}
function checkAdmin_(u) {
  if (u !== ADMIN) throw new Error('Só o Ericky pode fazer isso');
  return u;
}

function uid_() {
  return Utilities.getUuid().replace(/-/g, '').slice(0, 16);
}
function dia_(d) {
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}
function inicioSemana_(d) {
  const dow = Number(Utilities.formatDate(d, TZ, 'u')); // 1 = segunda
  const x = new Date(d);
  x.setDate(x.getDate() - (dow - 1));
  return x;
}
