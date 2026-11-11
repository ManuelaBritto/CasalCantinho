// Sessão e perfis.
// - Com Supabase configurado: login real (Supabase Auth, e-mail + senha).
//   Os perfis vêm da tabela `perfis` (protegida por RLS): ao entrar, carrega as
//   duas pessoas do casal de quem entrou (Kath e Drico, Lavi e Marih…).
// - Sem Supabase: MODO DEMONSTRAÇÃO, claramente sinalizado. Não há senha
//   nem autenticação de verdade — só a escolha do perfil neste navegador.
import { config, supabaseConfigurado } from './config.js';
import { normalizarTema } from './tema.js';

/** Saudação conforme o tratamento escolhido no cadastro. */
const saudacaoPara = (nome, tratamento) => (
  tratamento === 'ela' ? `Bem-vinda, ${nome}!` : tratamento === 'ele' ? `Bem-vindo, ${nome}!` : `Boas-vindas, ${nome}!`
);

// Tema de cada pessoa (usado enquanto o banco não tem tema_padrao com os temas novos)
const TEMA_POR_NOME = { kath: 'laco', drico: 'punk', lavi: 'mistica', marih: 'aquarela', ric: 'onda', rick: 'onda', admin: 'cinza', admin2: 'azul' };

export function montarPerfil({ id, nome, tratamento = 'neutro', temaPadrao = null }) {
  const tema = (temaPadrao && temaPadrao !== 'neutro' ? normalizarTema(temaPadrao) : null) || TEMA_POR_NOME[id] || 'laco';
  return { id, nome, tratamento, temaPadrao: tema, saudacao: saudacaoPara(nome, tratamento) };
}

// Perfis do casal que está usando o site. No modo demonstração: Kath e Drico.
// Com Supabase, é preenchido ao entrar com as duas pessoas do casal da conta.
const PERFIS_DEMO = {
  kath: montarPerfil({ id: 'kath', nome: 'Kath', tratamento: 'ela', temaPadrao: 'laco' }),
  drico: montarPerfil({ id: 'drico', nome: 'Drico', tratamento: 'ele', temaPadrao: 'punk' }),
};
export const PERFIS = { ...PERFIS_DEMO };

/** Troca o conteúdo de PERFIS mantendo o mesmo objeto (os módulos guardam a referência). */
function definirPerfis(lista) {
  Object.keys(PERFIS).forEach((k) => delete PERFIS[k]);
  lista.forEach((p) => { PERFIS[p.id] = p; });
}

/** Escolhe a forma certa da palavra para a pessoa: flexao('kath', { ela: 'linda', ele: 'lindo', neutro: 'linde' }). */
export function flexao(id, formas) {
  const t = PERFIS[id]?.tratamento || 'neutro';
  return formas[t] ?? formas.neutro ?? formas.ela;
}

// Casal antigo (antes de rodar supabase/varios-casais.sql): completa o que falta
const PADROES_ANTIGOS = {
  kath: { nome: 'Kath', tratamento: 'ela', temaPadrao: 'laco' },
  drico: { nome: 'Drico', tratamento: 'ele', temaPadrao: 'punk' },
};
const capitalizar = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// Uma conta pode estar em mais de um casal (ex.: Lavi com a Marih e com o Ric).
// O cantinho escolhido fica guardado neste aparelho; "Trocar de cantinho" escolhe de novo.
let participacoes = []; // [{ casalId, perfilId, parceiro: { nome, tratamento } | null }]
export const participacoesDaConta = () => participacoes;
const chaveCantinho = (userId) => `nc:cantinho:${userId}`;
const CHAVE_PEDIDO = 'nc:cantinho-pedido'; // vindo de uma notificação (?cantinho=…)

function lerEscolha(userId) {
  try {
    const pedido = sessionStorage.getItem(CHAVE_PEDIDO);
    if (pedido) { sessionStorage.removeItem(CHAVE_PEDIDO); return pedido; }
    return localStorage.getItem(chaveCantinho(userId));
  } catch { return null; }
}
function guardarEscolha(userId, casalId) {
  try { localStorage.setItem(chaveCantinho(userId), casalId); } catch { /* ignora */ }
}

/** Pede para abrir um cantinho específico na próxima carga (usado pelas notificações). */
export function pedirCantinho(casalId) {
  try { sessionStorage.setItem(CHAVE_PEDIDO, casalId); } catch { /* ignora */ }
}

/** Volta para a tela "Em qual cantinho você quer entrar?". */
export function trocarCantinho(perfil) {
  try { localStorage.removeItem(chaveCantinho(perfil.userId)); } catch { /* ignora */ }
  try { sessionStorage.removeItem('nc:boas-vindas-vista'); } catch { /* ignora */ }
  location.reload();
}

const montarDaLinha = (p) => {
  const antigo = PADROES_ANTIGOS[p.nome] || {};
  return montarPerfil({
    id: p.nome,
    nome: p.apelido || antigo.nome || capitalizar(p.nome),
    tratamento: p.tratamento && p.tratamento !== 'neutro' ? p.tratamento : antigo.tratamento || p.tratamento || 'neutro',
    temaPadrao: p.tema_padrao || antigo.temaPadrao || null,
  });
};

const CHAVE_DEMO = 'nc:sessao-demo';
let cliente = null;

export const modoAuth = () => (supabaseConfigurado ? 'supabase' : 'demo');
export const clienteSupabase = () => cliente;

async function carregarCliente() {
  if (cliente) return cliente;
  // Carregado só quando o Supabase está configurado (sem dependência no modo demo)
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.118.0');
  cliente = createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    // Batimento do tempo real num Web Worker: com a aba em segundo plano o navegador
    // atrasa os timers normais e a conexão caía sem ninguém perceber.
    realtime: { worker: true },
  });
  return cliente;
}

async function carregarPerfil(userId) {
  // As regras do banco só deixam ver os perfis do PRÓPRIO casal
  let { data, error } = await cliente.from('perfis').select('user_id, nome, apelido, tratamento, tema_padrao, casal_id, tema_preferido');
  if (error && /apelido|tratamento|tema_padrao/.test(error.message || '')) {
    // Banco ainda sem as colunas novas (falta rodar supabase/varios-casais.sql)
    ({ data, error } = await cliente.from('perfis').select('user_id, nome, casal_id, tema_preferido'));
  }
  if (error) throw new Error('Não foi possível carregar o perfil desta conta.');
  const minhas = (data || []).filter((p) => p.user_id === userId);
  if (!minhas.length) return null;
  participacoes = minhas.map((m) => {
    const par = data.find((p) => p.casal_id === m.casal_id && p.user_id !== userId);
    return { casalId: m.casal_id, perfilId: m.nome, parceiro: par ? montarDaLinha(par) : null };
  });

  // Em qual cantinho entrar: o pedido/escolha guardada, o único, ou pergunta
  let casalId = lerEscolha(userId);
  if (!minhas.some((m) => m.casal_id === casalId)) {
    if (minhas.length === 1) casalId = minhas[0].casal_id;
    else {
      const { escolherCantinho } = await import('./escolher-cantinho.js');
      casalId = await escolherCantinho(participacoes);
    }
  }
  guardarEscolha(userId, casalId);
  const meu = minhas.find((m) => m.casal_id === casalId);
  definirPerfis(data.filter((p) => p.casal_id === casalId).map(montarDaLinha));
  const preferido = normalizarTema(meu.tema_preferido);
  if (preferido) {
    try { localStorage.setItem(`nc:tema:${meu.nome}`, preferido); } catch { /* ignora */ }
  }
  return { ...PERFIS[meu.nome], casalId: meu.casal_id, userId };
}

/**
 * Descobre se já existe uma sessão válida.
 * Retorna { modo, perfil|null, erro? }
 */
export async function iniciarAuth() {
  if (modoAuth() === 'demo') {
    definirPerfis(Object.values(PERFIS_DEMO));
    let perfil = null;
    try {
      const salvo = JSON.parse(localStorage.getItem(CHAVE_DEMO) || 'null');
      if (salvo && PERFIS[salvo.perfil]) perfil = PERFIS[salvo.perfil];
    } catch { /* sessão demo inválida: ignora */ }
    return { modo: 'demo', perfil };
  }

  try {
    await carregarCliente();
  } catch (e) {
    console.error(e);
    return { modo: 'supabase', perfil: null, erro: 'Não foi possível carregar o Supabase. Verifique a internet e tente de novo.' };
  }
  const { data } = await cliente.auth.getSession();
  if (!data.session) return { modo: 'supabase', perfil: null };
  try {
    const perfil = await carregarPerfil(data.session.user.id);
    if (!perfil) {
      await cliente.auth.signOut();
      return { modo: 'supabase', perfil: null, erro: 'Esta conta ainda não está vinculada a um casal.' };
    }
    return { modo: 'supabase', perfil };
  } catch (e) {
    return { modo: 'supabase', perfil: null, erro: e.message };
  }
}

export function entrarDemo(idPerfil) {
  definirPerfis(Object.values(PERFIS_DEMO));
  if (!PERFIS[idPerfil]) throw new Error('Perfil desconhecido.');
  try { localStorage.setItem(CHAVE_DEMO, JSON.stringify({ perfil: idPerfil, desde: new Date().toISOString() })); } catch { /* ignora */ }
  return PERFIS[idPerfil];
}

/**
 * Converte o nome digitado no "e-mail interno" da conta no Supabase.
 * "Kath" → "kath@nossocantinho.app". Se a pessoa digitar um e-mail completo, usa como está.
 */
export function emailDoNome(nome) {
  const limpo = String(nome || '').trim();
  if (limpo.includes('@')) return limpo.toLowerCase();
  const usuario = limpo.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9._-]+/g, '');
  return usuario ? `${usuario}@${config.loginDominio}` : '';
}

export async function entrarComNome(nome, senha) {
  const email = emailDoNome(nome);
  if (!email) throw new Error('Informe o nome.');
  await carregarCliente();
  const { data, error } = await cliente.auth.signInWithPassword({ email, password: senha });
  if (error) {
    const msg = /invalid login/i.test(error.message) ? 'Nome ou senha incorretos.' : 'Não foi possível entrar agora. Tente de novo.';
    throw new Error(msg);
  }
  const perfil = await carregarPerfil(data.user.id);
  if (!perfil) {
    await cliente.auth.signOut();
    throw new Error('Esta conta ainda não está vinculada a um casal.');
  }
  return perfil;
}

export async function sair() {
  try { localStorage.removeItem(CHAVE_DEMO); } catch { /* ignora */ }
  try { sessionStorage.removeItem('nc:boas-vindas-vista'); } catch { /* ignora */ }
  if (cliente) await cliente.auth.signOut();
}

/** Guarda o tema escolhido também no Supabase (se ativo). */
export async function salvarTemaRemoto(perfil, tema) {
  if (!cliente || !perfil?.userId) return;
  let consulta = cliente.from('perfis').update({ tema_preferido: tema }).eq('user_id', perfil.userId);
  if (perfil.casalId) consulta = consulta.eq('casal_id', perfil.casalId); // a mesma pessoa pode estar em dois cantinhos
  const { error } = await consulta;
  if (error) console.warn('[Supabase] não foi possível salvar o tema:', error.message);
}

export function aoSairDaSessao(fn) {
  if (!cliente) return;
  cliente.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_OUT') fn(); });
}
