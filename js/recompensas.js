// Recompensas do Cinema: o tempo assistido no YouTube vira conquistas do casal.
//
// Ritmo: a cada hora de cinema vem uma recompensa pequena (aos 15 min, um colecionável),
// uma média (aos 30 min, um visual do site: estilo de nome ou modo da sala)
// e uma grande (na hora cheia, uma foto de recordação). São 14 no total.
//
// Onde fica salvo (ajustes do casal, local ou Supabase):
//   cinemaMs_<perfil>          tempo que cada um contou (assistindo juntos, cada um conta metade,
//                              então o total do casal não duplica)
//   conquistas                 { idDaRecompensa: data em que foi desbloqueada }
//   recompensasVistas_<perfil> ids que esse perfil já viu na tela de comemoração
//   estiloNome_<perfil>        estilo de nome escolhido (cromado, neon, letreiro)
//   modoCinema                 modo da sala escolhido pelo casal (noir, vip)
// Cada chave é gravada separada para que um perfil não sobrescreva o outro.
import { obterAjustes, salvarAjustes } from './store/index.js';
import { PERFIS } from './auth.js';

export const PORTES = {
  pequena: { nome: 'Pequena', tipo: 'Colecionável' },
  media: { nome: 'Média', tipo: 'Visual do site' },
  grande: { nome: 'Grande', tipo: 'Foto de recordação' },
};

export const RECOMPENSAS = [
  { id: 'ingresso', min: 15, porte: 'pequena', tipo: 'colecionavel', nome: 'Ingresso dourado', descricao: 'O primeiro item da coleção: um ingresso para dois, com a data da conquista.' },
  { id: 'cromado', min: 30, porte: 'media', tipo: 'nome', estilo: 'cromado', nome: 'Nome cromado', descricao: 'Seu nome com brilho de metal no topo do site e na saudação.' },
  { id: 'foto-polaroid', min: 60, porte: 'grande', tipo: 'foto', layout: 'polaroid', nome: 'Polaroid da primeira hora', descricao: 'Uma polaroid de recordação com a foto de vocês e a data da primeira hora de cinema.' },
  { id: 'pipoca', min: 75, porte: 'pequena', tipo: 'colecionavel', nome: 'Balde de pipoca', descricao: 'O balde listrado de toda sessão, para a estante de colecionáveis.' },
  { id: 'noir', min: 90, porte: 'media', tipo: 'modo', modo: 'noir', nome: 'Modo noir', descricao: 'A sala de cinema em preto e branco, com granulado de filme antigo.' },
  { id: 'foto-cartaz', min: 120, porte: 'grande', tipo: 'foto', layout: 'cartaz', nome: 'Cartaz do casal', descricao: 'Um cartaz de filme estrelado por vocês dois, com os vídeos mais assistidos nos créditos.' },
  { id: 'claquete', min: 135, porte: 'pequena', tipo: 'colecionavel', nome: 'Claquete', descricao: 'Cena 1, tomada 1: a claquete que marca o começo de tudo.' },
  { id: 'neon', min: 150, porte: 'media', tipo: 'nome', estilo: 'neon', nome: 'Nome neon', descricao: 'Seu nome aceso em neon cor-de-rosa, piscando de leve.' },
  { id: 'foto-cabine', min: 180, porte: 'grande', tipo: 'foto', layout: 'cabine', nome: 'Tira de cabine de fotos', descricao: 'Uma tirinha de cabine com o tempo de cinema, o vídeo mais visto e a reação favorita.' },
  { id: 'rolo', min: 195, porte: 'pequena', tipo: 'colecionavel', nome: 'Rolo de filme', descricao: 'Um rolo de filme antigo, com tudo o que vocês já assistiram enrolado nele.' },
  { id: 'vip', min: 210, porte: 'media', tipo: 'modo', modo: 'vip', nome: 'Sala VIP', descricao: 'Cortinas de veludo vermelho, letreiro dourado e luz baixa na sala.' },
  { id: 'foto-estrela', min: 240, porte: 'grande', tipo: 'foto', layout: 'estrela', nome: 'Estrela de cinema', descricao: 'Uma estrela na calçada com os nomes de vocês gravados em dourado.' },
  { id: 'trofeu', min: 255, porte: 'pequena', tipo: 'colecionavel', nome: 'Troféu do casal', descricao: 'O troféu de melhor dupla de cinema, para fechar a coleção.' },
  { id: 'letreiro', min: 270, porte: 'media', tipo: 'nome', estilo: 'letreiro', nome: 'Nome em letreiro', descricao: 'Seu nome em letras douradas, iluminado como a fachada de um cinema.' },
];

export const ESTILOS_NOME = { cromado: 'Cromado', neon: 'Neon', letreiro: 'Letreiro' };
export const MODOS_CINEMA = { noir: 'Noir', vip: 'Sala VIP' };

const chaveTempo = (id) => `cinemaMs_${id}`;
const chaveVistas = (id) => `recompensasVistas_${id}`;
const chaveEstilo = (id) => `estiloNome_${id}`;

// Último estado lido, para desenhar nomes sem esperar a rede
let cache = {};

function emitir(ajustes) {
  cache = ajustes || cache;
  aplicarEstilosNome();
  window.dispatchEvent(new CustomEvent('nc:recompensas-mudou', { detail: lerProgresso(cache) }));
}

export function formatarTempoCinema(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'menos de 1 min';
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export const rotuloLimite = (min) => formatarTempoCinema(min * 60000);

/** Junta tudo o que a tela precisa a partir dos ajustes do casal. */
export function lerProgresso(ajustes = cache) {
  let totalMs = 0;
  for (const id of Object.keys(PERFIS)) totalMs += Math.max(0, Number(ajustes?.[chaveTempo(id)]) || 0);
  const minutos = totalMs / 60000;
  const desbloqueadas = RECOMPENSAS.filter((r) => minutos >= r.min);
  const proxima = RECOMPENSAS.find((r) => minutos < r.min) || null;
  const inicio = desbloqueadas.at(-1)?.min || 0;
  const pctProxima = proxima ? Math.min(100, Math.max(0, ((minutos - inicio) / (proxima.min - inicio)) * 100)) : 100;
  const ids = new Set(desbloqueadas.map((r) => r.id));
  return {
    totalMs,
    minutos,
    desbloqueadas,
    desbloqueada: (id) => ids.has(id),
    proxima,
    faltaMs: proxima ? Math.max(0, proxima.min * 60000 - totalMs) : 0,
    pctProxima,
    datas: ajustes?.conquistas || {},
    estiloNome: (perfilId) => {
      const e = ajustes?.[chaveEstilo(perfilId)];
      const r = RECOMPENSAS.find((x) => x.estilo === e);
      return r && ids.has(r.id) ? e : '';
    },
    modoCinema: (() => {
      const r = RECOMPENSAS.find((x) => x.modo === ajustes?.modoCinema);
      return r && ids.has(r.id) ? r.modo : '';
    })(),
  };
}

export async function carregarRecompensas() {
  const ajustes = await obterAjustes();
  emitir(ajustes);
  return lerProgresso(ajustes);
}

// ---------------- Contagem do tempo ----------------
const pendente = {};   // ms ainda não gravados, por perfil
const conhecido = {};  // maior total já visto nesta aba, por perfil (corrige gravações concorrentes)
let timerGravar = null;
let gravando = null;

/** Espera a gravação em andamento terminar (usado antes de sair da conta). */
export const esperarGravacao = () => gravando || Promise.resolve();

/** Soma tempo assistido. A gravação acontece em lotes (a cada 30 s ou ao pausar). */
export function somarTempoCinema(perfilId, ms) {
  if (!PERFIS[perfilId] || !(ms > 0)) return;
  pendente[perfilId] = (pendente[perfilId] || 0) + ms;
  if (!timerGravar) timerGravar = setTimeout(() => { gravarTempoCinema(); }, 30000);
}

/** Grava o tempo pendente. Retorna os ajustes novos (ou null se não havia nada). */
export function gravarTempoCinema() {
  const atual = (gravando || Promise.resolve()).then(gravarAgora, gravarAgora);
  const marcador = atual.finally(() => { if (gravando === marcador) gravando = null; });
  gravando = marcador;
  return atual;
}

async function gravarAgora() {
  clearTimeout(timerGravar);
  timerGravar = null;
  const ids = Object.keys(pendente).filter((id) => pendente[id] >= 1000);
  if (!ids.length) return null;
  const deltas = {};
  for (const id of ids) { deltas[id] = pendente[id]; pendente[id] = 0; }
  try {
    const atuais = await obterAjustes();
    const parcial = {};
    for (const id of ids) {
      const base = Math.max(Number(atuais?.[chaveTempo(id)]) || 0, conhecido[id] || 0);
      conhecido[id] = Math.round(base + deltas[id]);
      parcial[chaveTempo(id)] = conhecido[id];
    }
    const novos = await salvarAjustes(parcial);
    emitir(novos);
    return novos;
  } catch {
    for (const id of ids) pendente[id] = (pendente[id] || 0) + deltas[id];
    return null;
  }
}

// ---------------- Conquistas novas ----------------
let verificando = null;

/**
 * Confere se há recompensas que este perfil ainda não viu. Registra a data das que
 * acabaram de ser desbloqueadas e marca as novas como vistas. Retorna a lista das novas.
 */
export function verificarConquistas(perfil) {
  if (verificando) return verificando;
  verificando = (async () => {
    try {
      const ajustes = await obterAjustes();
      const prog = lerProgresso(ajustes);
      const datas = { ...(ajustes.conquistas || {}) };
      const vistas = new Set(Array.isArray(ajustes[chaveVistas(perfil.id)]) ? ajustes[chaveVistas(perfil.id)] : []);
      const semData = prog.desbloqueadas.filter((r) => !datas[r.id]);
      const novas = prog.desbloqueadas.filter((r) => !vistas.has(r.id));
      if (!semData.length && !novas.length) { emitir(ajustes); return []; }
      const agora = new Date().toISOString();
      semData.forEach((r) => { datas[r.id] = agora; });
      novas.forEach((r) => vistas.add(r.id));
      const novos = await salvarAjustes({ conquistas: datas, [chaveVistas(perfil.id)]: [...vistas] });
      emitir(novos);
      return novas;
    } catch {
      return [];
    } finally {
      verificando = null;
    }
  })();
  return verificando;
}

// ---------------- Escolhas: estilo de nome e modo da sala ----------------
export async function escolherEstiloNome(perfilId, estilo) {
  const novos = await salvarAjustes({ [chaveEstilo(perfilId)]: estilo || '' });
  emitir(novos);
  return novos;
}

export async function escolherModoCinema(modo) {
  const novos = await salvarAjustes({ modoCinema: modo || '' });
  emitir(novos);
  return novos;
}

/** Classe CSS do nome de um perfil (vazia se não escolheu estilo). */
export function classeNome(perfilId) {
  const estilo = lerProgresso(cache).estiloNome(perfilId);
  return estilo ? `nome-estilo nome-${estilo}` : '';
}

/** Atualiza todos os nomes marcados com data-nome-perfil na página. */
export function aplicarEstilosNome(raiz = document) {
  const prog = lerProgresso(cache);
  raiz.querySelectorAll('[data-nome-perfil]').forEach((el) => {
    const estilo = prog.estiloNome(el.dataset.nomePerfil);
    el.classList.remove('nome-estilo', ...Object.keys(ESTILOS_NOME).map((e) => `nome-${e}`));
    if (estilo) el.classList.add('nome-estilo', `nome-${estilo}`);
  });
}

export function limparCacheRecompensas() {
  cache = {};
  for (const k of Object.keys(pendente)) delete pendente[k];
  for (const k of Object.keys(conhecido)) delete conhecido[k];
  clearTimeout(timerGravar);
  timerGravar = null;
}
