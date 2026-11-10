// Temas e preferências visuais.
// A preferência é guardada por perfil neste navegador e,
// quando o Supabase está ativo, também na tabela `perfis` (coluna tema_preferido).
import { renderizarDecoracao } from './ui/ilustracoes.js';

export const TEMAS = {
  neutro: { nome: 'Neutro', descricao: 'Linho, rosa antigo e creme. Leve e aconchegante.', corMeta: '#f7f2ee' },
  drico: { nome: 'Gótico', descricao: 'Preto, vinho e roxo profundo. Romance gótico — sem sustos.', corMeta: '#140b13' },
  kath: { nome: 'Girassol', descricao: 'Amarelo girassol, laranja e creme. Vintage e acolhedor.', corMeta: '#fbf2df' },
};

const chaveTema = (perfil) => `nc:tema:${perfil || 'visitante'}`;
const chavePrefs = (perfil) => `nc:prefs:${perfil || 'visitante'}`;

const PREFS_PADRAO = { aoEntrar: 'perfil', movimento: 'sistema', decoracao: 'normal', texto: 'padrao' };

function ler(chave) { try { return localStorage.getItem(chave); } catch { return null; } }
function gravar(chave, valor) { try { localStorage.setItem(chave, valor); } catch { /* armazenamento cheio/bloqueado */ } }

export function temaAtual() { return document.documentElement.dataset.tema || 'neutro'; }

export function temaSalvo(perfil) {
  const t = ler(chaveTema(perfil));
  return TEMAS[t] ? t : null;
}

const ouvintes = new Set();
export function aoMudarTema(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }

/** Aplica um tema imediatamente (sem recarregar). */
export function aplicarTema(tema, { perfil = null, salvar = true } = {}) {
  if (!TEMAS[tema]) tema = 'neutro';
  const raiz = document.documentElement;
  const mudou = raiz.dataset.tema !== tema;
  raiz.dataset.tema = tema;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', TEMAS[tema].corMeta);
  renderizarDecoracao(tema);
  gravar('nc:tema-atual', tema);
  if (salvar && perfil) gravar(chaveTema(perfil), tema);
  // Sincroniza os seletores de tema visíveis
  document.querySelectorAll('input[name="tema"], input[name="tema-aparencia"]').forEach((i) => { i.checked = i.value === tema; });
  if (mudou) ouvintes.forEach((fn) => fn(tema));
}

/** Tema a usar logo após a entrada do perfil. */
export function temaDeEntrada(perfil, temaPadraoDoPerfil) {
  const prefs = lerPreferencias(perfil);
  if (prefs.aoEntrar === 'ultimo') return temaSalvo(perfil) || temaPadraoDoPerfil;
  return temaPadraoDoPerfil;
}

export function lerPreferencias(perfil) {
  try { return { ...PREFS_PADRAO, ...JSON.parse(ler(chavePrefs(perfil)) || '{}') }; } catch { return { ...PREFS_PADRAO }; }
}

export function salvarPreferencias(perfil, prefs) {
  const novas = { ...lerPreferencias(perfil), ...prefs };
  gravar(chavePrefs(perfil), JSON.stringify(novas));
  aplicarPreferencias(novas);
  return novas;
}

const midiaMovimento = window.matchMedia('(prefers-reduced-motion: reduce)');
let prefsAtuais = { ...PREFS_PADRAO };

export function aplicarPreferencias(prefs) {
  prefsAtuais = { ...PREFS_PADRAO, ...prefs };
  const raiz = document.documentElement;
  const reduzir = prefsAtuais.movimento === 'reduzir' || (prefsAtuais.movimento === 'sistema' && midiaMovimento.matches);
  if (reduzir) raiz.dataset.movimento = 'reduzir'; else delete raiz.dataset.movimento;
  raiz.dataset.decoracao = prefsAtuais.decoracao;
  raiz.dataset.texto = prefsAtuais.texto;
}
midiaMovimento.addEventListener?.('change', () => aplicarPreferencias(prefsAtuais));

export function movimentoReduzido() { return document.documentElement.dataset.movimento === 'reduzir'; }
