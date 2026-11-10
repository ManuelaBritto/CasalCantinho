// Notificações no celular/computador (Web Push) e o site como app instalável.
//
// Como funciona:
//  1. O service worker (/sw.js) é registrado ao abrir o site.
//  2. Em Aparência (ou no aviso do Início) a pessoa toca em "Ativar notificações":
//     o navegador pede permissão e cria uma "inscrição" deste aparelho, que fica salva
//     no Supabase (tabela push_inscricoes).
//  3. Quando alguém manda cartinha, elogio ou lembrete, o site chama /api/notificar,
//     que entrega a notificação nos aparelhos do outro perfil.
//     Se o outro estiver com o site aberto na tela, não precisa: o aviso aparece na hora.
//
// No iPhone/iPad, a Apple só libera notificações para sites adicionados à Tela de Início
// (Safari > Compartilhar > Adicionar à Tela de Início) e abertos pelo ícone.
import { config } from './config.js';
import { modoAuth, clienteSupabase, PERFIS, participacoesDaConta, pedirCantinho } from './auth.js';
import { salaAtual } from './sala-cinema.js';

let registro = null;
let perfilAtivo = null;
let pedidoInstalacao = null;

const suportaSW = () => 'serviceWorker' in navigator && window.isSecureContext;
const suportaPush = () => suportaSW() && 'PushManager' in window && 'Notification' in window;
export const ehIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
export const ehAndroid = () => /android/i.test(navigator.userAgent);
export const instalado = () => window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone === true;

function base64ParaBytes(b64) {
  const padrao = (b64 + '='.repeat((4 - (b64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const bruto = atob(padrao);
  return Uint8Array.from(bruto, (c) => c.charCodeAt(0));
}

function nomeAparelho() {
  const ua = navigator.userAgent;
  const sistema = /iphone/i.test(ua) ? 'iPhone' : /ipad/i.test(ua) ? 'iPad' : /android/i.test(ua) ? 'Android' : /mac/i.test(ua) ? 'Mac' : /windows/i.test(ua) ? 'Windows' : 'Outro';
  const nav = /edg\//i.test(ua) ? 'Edge' : /chrome|crios/i.test(ua) ? 'Chrome' : /firefox|fxios/i.test(ua) ? 'Firefox' : /safari/i.test(ua) ? 'Safari' : 'Navegador';
  return `${sistema} · ${nav}${instalado() ? ' (app)' : ''}`;
}

// ---------------- Service worker e instalação ----------------
export async function registrarServiceWorker() {
  if (!suportaSW()) return null;
  try {
    registro = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    // Ao tocar numa notificação com o site aberto, o service worker pede para trocar de página
    navigator.serviceWorker.addEventListener('message', (e) => {
      if (e.data?.tipo !== 'nc:abrir' || typeof e.data.hash !== 'string' || !e.data.hash.startsWith('#/')) return;
      // Notificação de OUTRO cantinho da pessoa (ex.: a Lavi está com a Marih e chegou algo do Ric)
      const cantinho = e.data.cantinho;
      if (cantinho && perfilAtivo?.casalId && cantinho !== perfilAtivo.casalId && participacoesDaConta().some((p) => p.casalId === cantinho)) {
        pedirCantinho(cantinho);
        try { sessionStorage.removeItem('nc:boas-vindas-vista'); } catch { /* ignora */ }
        location.hash = e.data.hash;
        location.reload();
        return;
      }
      location.hash = e.data.hash;
    });
  } catch (e) {
    console.warn('[notificações] service worker não registrado:', e?.message || e);
  }
  return registro;
}

// Android/Chrome/Edge oferecem um botão "Instalar" próprio
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  pedidoInstalacao = e;
  window.dispatchEvent(new CustomEvent('nc:instalacao-disponivel'));
});
window.addEventListener('appinstalled', () => { pedidoInstalacao = null; window.dispatchEvent(new CustomEvent('nc:instalacao-disponivel')); });

export const podeInstalarDireto = () => Boolean(pedidoInstalacao);
export async function instalarApp() {
  if (!pedidoInstalacao) return false;
  pedidoInstalacao.prompt();
  const { outcome } = await pedidoInstalacao.userChoice.catch(() => ({ outcome: 'dismissed' }));
  pedidoInstalacao = null;
  return outcome === 'accepted';
}

// ---------------- Estado ----------------
/**
 * Situação das notificações neste aparelho:
 *  demo · sem-config · precisa-instalar (iPhone fora do app) · nao-suportado · negado · ativo · inativo
 */
export async function estadoNotificacoes() {
  if (modoAuth() !== 'supabase') return 'demo';
  if (!config.notificacoes || !config.vapidPublicKey) return 'sem-config';
  if (ehIOS() && !instalado()) return 'precisa-instalar';
  if (!suportaPush()) return 'nao-suportado';
  if (Notification.permission === 'denied') return 'negado';
  const reg = registro || await navigator.serviceWorker.getRegistration('/').catch(() => null);
  const inscricao = await reg?.pushManager.getSubscription().catch(() => null);
  return inscricao && Notification.permission === 'granted' ? 'ativo' : 'inativo';
}

async function salvarInscricao(inscricao, perfil) {
  const cliente = clienteSupabase();
  const j = inscricao.toJSON();
  // Remove o registro antigo deste aparelho (ex.: era da outra conta) e grava de novo,
  // uma linha por cantinho da pessoa (assim a Lavi recebe da Marih e do Ric no mesmo celular)
  await cliente.from('push_inscricoes').delete().eq('endpoint', j.endpoint);
  const cantinhos = participacoesDaConta().length ? participacoesDaConta() : [{ casalId: perfil.casalId, perfilId: perfil.id }];
  const { error } = await cliente.from('push_inscricoes').insert(cantinhos.map((c) => ({
    casal_id: c.casalId,
    perfil: c.perfilId,
    endpoint: j.endpoint,
    p256dh: j.keys.p256dh,
    auth: j.keys.auth,
    aparelho: nomeAparelho(),
  })));
  if (error) {
    if (/push_inscricoes/.test(error.message || '') || error.code === '42P01' || error.code === 'PGRST205') {
      throw new Error('Falta rodar o arquivo supabase/notificacoes.sql no Supabase.');
    }
    throw new Error('Não foi possível salvar este aparelho para receber notificações.');
  }
}

/** Liga as notificações neste aparelho. Precisa ser chamado a partir de um toque/clique. */
export async function ativarNotificacoes(perfil) {
  const estado = await estadoNotificacoes();
  if (estado === 'demo') throw new Error('No modo demonstração não há notificações (elas precisam do Supabase).');
  if (estado === 'sem-config') throw new Error(config.notificacoesErro || 'As notificações ainda não foram configuradas no servidor (chaves VAPID na Vercel).');
  if (estado === 'precisa-instalar') throw new Error('No iPhone, adicione o site à Tela de Início e abra pelo ícone para ativar.');
  if (estado === 'nao-suportado') throw new Error('Este navegador não aceita notificações de sites.');
  const permissao = await Notification.requestPermission();
  if (permissao !== 'granted') throw new Error(permissao === 'denied'
    ? 'As notificações foram bloqueadas. Libere nas configurações do navegador para este site.'
    : 'Permissão não concedida.');
  const reg = registro || await registrarServiceWorker() || await navigator.serviceWorker.ready;
  let inscricao = await reg.pushManager.getSubscription();
  let chave;
  try { chave = base64ParaBytes(config.vapidPublicKey); } catch { chave = null; }
  if (!chave || chave.length !== 65 || chave[0] !== 4) {
    throw new Error('A chave pública das notificações (VAPID_PUBLIC_KEY) na Vercel está errada. Rode "npm run chaves" de novo, copie só o que vem depois do "=" e faça Redeploy.');
  }
  if (inscricao) {
    // Chaves trocadas no servidor: refaz a inscrição
    const atual = inscricao.options?.applicationServerKey;
    const igual = atual && new Uint8Array(atual).every((b, i) => b === chave[i]);
    if (!igual) { await inscricao.unsubscribe().catch(() => {}); inscricao = null; }
  }
  if (!inscricao) inscricao = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: chave });
  await salvarInscricao(inscricao, perfil);
  return true;
}

export async function desativarNotificacoes() {
  const reg = registro || await navigator.serviceWorker?.getRegistration('/').catch(() => null);
  const inscricao = await reg?.pushManager.getSubscription().catch(() => null);
  if (!inscricao) return;
  const endpoint = inscricao.endpoint;
  await inscricao.unsubscribe().catch(() => {});
  if (modoAuth() === 'supabase') await clienteSupabase().from('push_inscricoes').delete().eq('endpoint', endpoint);
}

/**
 * Ao entrar: se este aparelho já tinha notificações ligadas, confirma que está salvo
 * para o perfil certo (ex.: a outra pessoa entrou neste aparelho antes).
 */
export async function sincronizarNotificacoes(perfil) {
  perfilAtivo = perfil;
  try {
    if (await estadoNotificacoes() !== 'ativo') return;
    const reg = registro || await navigator.serviceWorker.getRegistration('/');
    const inscricao = await reg?.pushManager.getSubscription();
    if (!inscricao) return;
    const { data } = await clienteSupabase().from('push_inscricoes').select('perfil, casal_id').eq('endpoint', inscricao.endpoint);
    const salvas = new Set((data || []).map((d) => `${d.casal_id}:${d.perfil}`));
    const esperadas = participacoesDaConta().map((c) => `${c.casalId}:${c.perfilId}`);
    if (salvas.size !== esperadas.length || esperadas.some((k) => !salvas.has(k))) await salvarInscricao(inscricao, perfil);
  } catch (e) {
    console.warn('[notificações] sincronização:', e?.message || e);
  }
}

export function esquecerPerfilNotificacoes() { perfilAtivo = null; }

// ---------------- Enviar ----------------
async function chamarServidor(dados) {
  const { data } = await clienteSupabase().auth.getSession();
  const token = data?.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Entre de novo.');
  const r = await fetch('/api/notificar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ ...dados, casal: perfilAtivo?.casalId }),
  });
  const corpo = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(corpo.erro || 'Não foi possível enviar a notificação.');
  return corpo;
}

/**
 * Notifica os aparelhos do outro perfil. Não faz nada se ele está com o site aberto na tela
 * (o aviso em tempo real já aparece) ou se as notificações não estão configuradas.
 * Nunca lança erro: notificação é um extra.
 */
export async function notificarOutro({ titulo, corpo, url = '/', tag } = {}) {
  if (modoAuth() !== 'supabase' || !config.notificacoes || !perfilAtivo) return { enviadas: 0, motivo: 'indisponivel' };
  const outro = Object.values(PERFIS).find((p) => p.id !== perfilAtivo.id);
  if (salaAtual()?.vendo?.has(outro.id)) return { enviadas: 0, motivo: 'esta-vendo' };
  try {
    return await chamarServidor({ titulo, corpo, url, tag });
  } catch (e) {
    console.warn('[notificações]', e.message);
    return { enviadas: 0, motivo: 'erro', erro: e.message };
  }
}

/** Notificação de teste para os aparelhos da própria pessoa. */
export async function testarNotificacao() {
  const r = await chamarServidor({ titulo: 'Nosso Cantinho', corpo: 'Tudo certo! As notificações estão funcionando neste aparelho.', url: '/#/aparencia', tag: 'teste', paraMim: true });
  if (!r.enviadas) throw new Error('Nenhum aparelho seu está com notificações ativas.');
  return r;
}
