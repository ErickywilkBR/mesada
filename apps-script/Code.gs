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
  Usuarios:   ['id', 'nome', 'cor', 'foto_id'],
  Relatos:    ['id', 'usuario', 'criado_em', 'foto_id', 'audio_id', 'status', 'nota', 'valor', 'resposta_audio_id', 'avaliado_em', 'tentativas'],
  Midia:      ['midia_id', 'parte', 'total', 'mime', 'dados'],
  Loja:       ['id', 'nome', 'emoji', 'preco', 'imagem_id', 'ativo'],
  Resgates:   ['id', 'usuario', 'item_id', 'nome', 'emoji', 'preco', 'status', 'criado_em', 'atualizado_em'],
  Movimentos: ['id', 'usuario', 'tipo', 'valor', 'ref', 'data'],
};

/** Rode uma vez pelo editor: cria abas, cabeçalhos e usuários. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  Object.keys(SHEETS).forEach(function (name) {
    const sh = ss.getSheetByName(name) || ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.appendRow(SHEETS[name]);
      sh.setFrozenRows(1);
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
    if (READ_ONLY.indexOf(req.action) >= 0) {
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

const READ_ONLY = ['bootstrap', 'midia'];

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
};

// ---------------------------------------------------------------- leitura

function bootstrap_(r) {
  const me = checkUser_(r.usuario);
  const admin = me === ADMIN;
  const usuarios = rows_('Usuarios');
  const relatos = rows_('Relatos');
  const resgates = rows_('Resgates');
  const movs = rows_('Movimentos');

  const stats = {};
  KIDS.forEach(function (k) { stats[k] = statsDe_(k, relatos, resgates, movs); });

  const minhas = function (x) { return admin || x.usuario === me; };
  const byNewest = function (a, b) { return a.criado_em < b.criado_em ? 1 : -1; };

  return {
    me: me,
    usuarios: usuarios.map(function (u) {
      return { id: u.id, nome: u.nome, cor: u.cor, foto_id: u.foto_id, stats: stats[u.id] || null };
    }),
    relatos: relatos.filter(minhas).sort(byNewest).slice(0, admin ? 300 : 100).map(numRelato_),
    resgates: resgates.filter(minhas).sort(byNewest).slice(0, 200).map(function (x) {
      x.preco = Number(x.preco); return x;
    }),
    loja: rows_('Loja').filter(function (i) { return i.ativo !== 'false'; }).map(function (i) {
      i.preco = Number(i.preco); return i;
    }).sort(function (a, b) { return a.preco - b.preco; }),
    extrato: admin ? [] : movs.filter(function (m) { return m.usuario === me; })
      .sort(function (a, b) { return a.data < b.data ? 1 : -1; }).slice(0, 50)
      .map(function (m) { m.valor = Number(m.valor); return m; }),
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

  let saldo = 0, semana = 0, mes = 0, total = 0;
  movs.forEach(function (m) {
    if (m.usuario !== k) return;
    const v = Number(m.valor);
    saldo += v;
    if (m.tipo === 'relato') {
      total += v;
      const d = dia_(new Date(m.data));
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
  if (!dias[dia_(cur)]) cur.setDate(cur.getDate() - 1);
  while (dias[dia_(cur)]) { streak++; cur.setDate(cur.getDate() - 1); }

  return {
    saldo: saldo, semana: semana, mes: mes, total: total,
    relatos: meus.length,
    aprovados: aprovados.length,
    nota10: notas.filter(function (n) { return n === 10; }).length,
    media: notas.length ? Math.round(notas.reduce(function (a, b) { return a + b; }, 0) / notas.length * 10) / 10 : 0,
    streak: streak,
    resgatesEntregues: resgates.filter(function (x) { return x.usuario === k && x.status === 'entregue'; }).length,
  };
}

// ---------------------------------------------------------------- escrita

function novoRelato_(r) {
  const k = checkKid_(r.usuario);
  const fotos = r.fotos || (r.foto ? [r.foto] : []);
  if (!fotos.length) throw new Error('Envie pelo menos uma foto');
  const fotoId = fotos.map(saveMidia_).join(','); // várias fotos: ids separados por vírgula
  const audioId = r.audio && r.audio.data ? saveMidia_(r.audio) : '';
  const agora = new Date().toISOString();

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
  sheet_('Relatos').appendRow([id, k, agora, fotoId, audioId, 'pendente', '', '', '', '', 1]);
  return { id: id };
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
    if (!(valor >= 1 && valor <= 1000)) throw new Error('Valor deve ser de R$ 0,01 a R$ 10,00');
    setFields_('Relatos', row, { status: 'aprovado', nota: nota, valor: valor, avaliado_em: agora });
    addMov_(x.usuario, 'relato', valor, x.id);
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
  if (!it.nome || !(preco >= 1)) throw new Error('Nome e preço são obrigatórios');
  const imagemNova = it.imagem ? saveMidia_(it.imagem) : null;

  if (it.id) {
    const row = findRow_('Loja', it.id);
    const old = rowObj_('Loja', row);
    const f = { nome: it.nome, emoji: it.emoji || '', preco: preco };
    if (imagemNova) { deleteMidia_(old.imagem_id); f.imagem_id = imagemNova; }
    if (it.removerImagem) { deleteMidia_(old.imagem_id); f.imagem_id = ''; }
    setFields_('Loja', row, f);
    return { id: it.id };
  }
  const id = uid_();
  sheet_('Loja').appendRow([id, it.nome, it.emoji || '🎁', preco, imagemNova || '', 'true']);
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
  const saldo = rows_('Movimentos').reduce(function (s, m) {
    return m.usuario === k ? s + Number(m.valor) : s;
  }, 0);
  if (saldo < preco) throw new Error('Saldo insuficiente');

  const id = uid_();
  const agora = new Date().toISOString();
  sheet_('Resgates').appendRow([id, k, item.id, item.nome, item.emoji, preco, 'pendente', agora, agora]);
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
  } else if (r.status === 'cancelado') {
    setFields_('Resgates', row, { status: 'cancelado', atualizado_em: new Date().toISOString() });
    addMov_(x.usuario, 'estorno', Number(x.preco), x.id);
  } else {
    throw new Error('Status inválido');
  }
  return { ok: true };
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
  sh.getRange(start, 1, values.length, 5).setNumberFormat('@').setValues(values);
  return id;
}

function getMidia_(ids) {
  const sh = sheet_('Midia');
  const out = {};
  ids.slice(0, 40).forEach(function (id) {
    if (!id) return;
    const found = sh.getRange('A:A').createTextFinder(id).matchEntireCell(true).findAll();
    if (!found.length) return;
    const parts = found.map(function (c) {
      const v = sh.getRange(c.getRow(), 2, 1, 4).getValues()[0];
      return { i: Number(v[0]), mime: v[2], data: String(v[3]).slice(2) };
    }).sort(function (a, b) { return a.i - b.i; });
    out[id] = { mime: parts[0].mime, data: parts.map(function (p) { return p.data; }).join('') };
  });
  return out;
}

function deleteMidia_(id) {
  if (!id) return;
  const sh = sheet_('Midia');
  const rows = sh.getRange('A:A').createTextFinder(id).matchEntireCell(true).findAll()
    .map(function (c) { return c.getRow(); }).sort(function (a, b) { return b - a; });
  rows.forEach(function (r) { sh.deleteRow(r); });
}

// ---------------------------------------------------------------- helpers

function sheet_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
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
