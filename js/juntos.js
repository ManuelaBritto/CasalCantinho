// "Estamos juntos?" — cronômetro compartilhado entre os dois perfis.
// O estado fica nos ajustes do casal (local ou Supabase), então os dois veem o mesmo tempo.
import { obterAjustes, salvarAjustes } from './store/index.js';

const MAX_ENCONTROS = 300;

export function normalizarJuntos(j) {
  return {
    ativoDesde: j?.ativoDesde || null,
    iniciadoPor: j?.iniciadoPor || null,
    totalMs: Number(j?.totalMs) || 0,
    encontros: Array.isArray(j?.encontros) ? j.encontros : [],
  };
}

export async function lerJuntos() {
  const ajustes = await obterAjustes();
  return normalizarJuntos(ajustes?.juntos);
}

async function gravar(j) {
  await salvarAjustes({ juntos: j });
  window.dispatchEvent(new CustomEvent('nc:juntos-mudou', { detail: j }));
  return j;
}

/** Começa a contar. Se o outro perfil já começou, mantém o horário dele. */
export async function comecarJuntos(perfil) {
  const j = await lerJuntos();
  if (j.ativoDesde) return j;
  j.ativoDesde = new Date().toISOString();
  j.iniciadoPor = perfil.id;
  return gravar(j);
}

/** Encerra o encontro atual, somando ao total. `fim` permite corrigir o horário. */
export async function encerrarJuntos(perfil, { nota = '', fim = null } = {}) {
  const j = await lerJuntos();
  if (!j.ativoDesde) return j;
  const inicio = new Date(j.ativoDesde);
  let termino = fim ? new Date(fim) : new Date();
  if (Number.isNaN(termino.getTime()) || termino > new Date()) termino = new Date();
  if (termino < inicio) termino = inicio;
  const duracaoMs = termino - inicio;
  j.encontros.unshift({
    id: `${inicio.getTime()}`,
    inicio: inicio.toISOString(),
    fim: termino.toISOString(),
    duracaoMs,
    nota: String(nota || '').trim().slice(0, 280),
    iniciadoPor: j.iniciadoPor,
    encerradoPor: perfil.id,
  });
  j.encontros = j.encontros.slice(0, MAX_ENCONTROS);
  j.totalMs += duracaoMs;
  j.ativoDesde = null;
  j.iniciadoPor = null;
  return gravar(j);
}

/** Cancela o cronômetro atual sem salvar (ex.: tocaram sem querer). */
export async function cancelarJuntos() {
  const j = await lerJuntos();
  j.ativoDesde = null;
  j.iniciadoPor = null;
  return gravar(j);
}

export async function removerEncontro(id) {
  const j = await lerJuntos();
  const e = j.encontros.find((x) => x.id === id);
  if (!e) return j;
  j.encontros = j.encontros.filter((x) => x.id !== id);
  j.totalMs = Math.max(0, j.totalMs - (Number(e.duracaoMs) || 0));
  return gravar(j);
}

export function tempoAtualMs(j) {
  return j?.ativoDesde ? Math.max(0, Date.now() - new Date(j.ativoDesde).getTime()) : 0;
}

/** 3725000 → "01:02:05" */
export function relogio(ms) {
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const seg = s % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(seg).padStart(2, '0')}`;
}

/** 3725000 → "1 h 2 min";  90000000 → "1 dia 1 h" */
export function duracaoPorExtenso(ms) {
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'menos de 1 min';
  const dias = Math.floor(min / 1440);
  const h = Math.floor((min % 1440) / 60);
  const m = min % 60;
  const partes = [];
  if (dias) partes.push(`${dias} ${dias === 1 ? 'dia' : 'dias'}`);
  if (h) partes.push(`${h} h`);
  if (m && dias === 0) partes.push(`${m} min`);
  return partes.join(' ');
}
