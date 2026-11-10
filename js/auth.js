// Sessão e perfis.
// - Com Supabase configurado: login real (Supabase Auth, e-mail + senha).
//   O perfil (Kath/Drico) vem da tabela `perfis`, protegida por RLS.
// - Sem Supabase: MODO DEMONSTRAÇÃO, claramente sinalizado. Não há senha
//   nem autenticação de verdade — só a escolha do perfil neste navegador.
import { config, supabaseConfigurado } from './config.js';

export const PERFIS = {
  kath: { id: 'kath', nome: 'Kath', saudacao: 'Bem-vinda, Kath!', temaPadrao: 'kath' },
  drico: { id: 'drico', nome: 'Drico', saudacao: 'Bem-vindo, Drico!', temaPadrao: 'drico' },
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
  });
  return cliente;
}

async function carregarPerfil(userId) {
  const { data, error } = await cliente
    .from('perfis')
    .select('nome, casal_id, tema_preferido')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error('Não foi possível carregar o perfil desta conta.');
  if (!data || !PERFIS[data.nome]) return null;
  if (data.tema_preferido) {
    try { localStorage.setItem(`nc:tema:${data.nome}`, data.tema_preferido); } catch { /* ignora */ }
  }
  return { ...PERFIS[data.nome], casalId: data.casal_id, userId };
}

/**
 * Descobre se já existe uma sessão válida.
 * Retorna { modo, perfil|null, erro? }
 */
export async function iniciarAuth() {
  if (modoAuth() === 'demo') {
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
      return { modo: 'supabase', perfil: null, erro: 'Esta conta ainda não está vinculada ao perfil Kath ou Drico.' };
    }
    return { modo: 'supabase', perfil };
  } catch (e) {
    return { modo: 'supabase', perfil: null, erro: e.message };
  }
}

export function entrarDemo(idPerfil) {
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
    throw new Error('Esta conta ainda não está vinculada ao perfil Kath ou Drico.');
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
  const { error } = await cliente.from('perfis').update({ tema_preferido: tema }).eq('user_id', perfil.userId);
  if (error) console.warn('[Supabase] não foi possível salvar o tema:', error.message);
}

export function aoSairDaSessao(fn) {
  if (!cliente) return;
  cliente.auth.onAuthStateChange((evento) => { if (evento === 'SIGNED_OUT') fn(); });
}
