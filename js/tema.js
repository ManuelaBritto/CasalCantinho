// Temas e preferências visuais.
// A preferência é guardada por perfil neste navegador e,
// quando o Supabase está ativo, também na tabela `perfis` (coluna tema_preferido).
import { renderizarDecoracao } from './ui/ilustracoes.js';

// Um tema por pessoa. Cada cantinho só mostra os temas das duas pessoas do casal.
export const TEMAS = {
  mistica: { nome: 'Lua Mística', descricao: 'Noite roxa, lua dourada, cartas ciganas, mapa astral e um gato preto de guarda.', corMeta: '#120b22', escuro: true },
  punk: { nome: 'Estrela Punk', descricao: 'Fundo roxo com verde neon: respingos, anéis, guitarra de estrela e o pinguim.', corMeta: '#1c0b33', escuro: true },
  laco: { nome: 'Laço de Rosa', descricao: 'Rosa em todos os tons, laços, flores, livros e uma pinguinzinha de laço.', corMeta: '#fff4f8' },
  onda: { nome: 'Onda Coral', descricao: 'Mar azul, coral e areia: ondas, prancha, conchas, trilha e pôr do sol.', corMeta: '#f2f8fb' },
  aquarela: { nome: 'Aquarela', descricao: 'Tons pastéis de livro antigo: gatinho, casinha no campo, flores, vinil e corujinha.', corMeta: '#fbf6ea' },
};

/** Tema da tela de entrada (antes de saber quem é): o rosa da marca. */
export const TEMA_ENTRADA = 'laco';

// Temas antigos (antes de 11/2026) → temas novos
const TEMAS_ANTIGOS = { kath: 'laco', drico: 'punk', neutro: null };
export function normalizarTema(t) {
  if (TEMAS[t]) return t;
  return TEMAS_ANTIGOS[t] ?? null;
}

// Temas que o cantinho atual pode usar (os das duas pessoas do casal)
let disponiveis = Object.keys(TEMAS);
export function definirTemasDisponiveis(lista) {
  const validos = [...new Set(lista.map(normalizarTema).filter(Boolean))];
  disponiveis = validos.length ? validos : Object.keys(TEMAS);
}
export const temasDisponiveis = () => [...disponiveis];

const chaveTema = (perfil) => `nc:tema:${perfil || 'visitante'}`;
const chavePrefs = (perfil) => `nc:prefs:${perfil || 'visitante'}`;

const PREFS_PADRAO = { aoEntrar: 'perfil', movimento: 'sistema', decoracao: 'normal', texto: 'padrao' };

function ler(chave) { try { return localStorage.getItem(chave); } catch { return null; } }
function gravar(chave, valor) { try { localStorage.setItem(chave, valor); } catch { /* armazenamento cheio/bloqueado */ } }

export function temaAtual() { return document.documentElement.dataset.tema || TEMA_ENTRADA; }

export function temaSalvo(perfil) {
  const t = normalizarTema(ler(chaveTema(perfil)));
  return t && disponiveis.includes(t) ? t : null;
}

const ouvintes = new Set();
export function aoMudarTema(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }

/** Aplica um tema imediatamente (sem recarregar). */
export function aplicarTema(tema, { perfil = null, salvar = true, livre = false } = {}) {
  tema = normalizarTema(tema);
  // Fora da regra do cantinho (ou desconhecido): volta para o primeiro tema permitido
  if (!tema || (!livre && !disponiveis.includes(tema))) tema = livre ? TEMA_ENTRADA : disponiveis[0];
  const raiz = document.documentElement;
  const mudou = raiz.dataset.tema !== tema;
  raiz.dataset.tema = tema;
  raiz.dataset.tom = TEMAS[tema].escuro ? 'escuro' : 'claro';
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

/** Ordem dos temas no cantinho: o da pessoa primeiro, depois o do par. */
export function temasDoCasal(perfis, meu) {
  const lista = Object.values(perfis).map((p) => normalizarTema(p.temaPadrao)).filter(Boolean);
  const proprio = normalizarTema(meu?.temaPadrao);
  return [...new Set([proprio, ...lista].filter(Boolean))];
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
