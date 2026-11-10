// "Sessões do dia": fila de vídeos do Cinema, compartilhada pelos dois.
// Fica nos ajustes do casal (filaCinema) e vale só para o dia (horário de Brasília):
// no dia seguinte a fila começa vazia. Quando um vídeo da fila começa, ele sai da fila
// (e continua no histórico de Sessões).
import { obterAjustes, salvarAjustes } from './store/index.js';
import { salaAtual } from './sala-cinema.js';

export const MAX_FILA = 30;

export function hojeBrasilia(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

const deHoje = (lista) => (Array.isArray(lista) ? lista : []).filter((i) => i && i.dia === hojeBrasilia() && /^[\w-]{11}$/.test(i.youtubeId));

export async function lerFila() {
  const ajustes = await obterAjustes();
  return deHoje(ajustes?.filaCinema);
}

async function gravar(transformar) {
  const atual = await lerFila();
  const nova = transformar(atual).slice(0, MAX_FILA);
  await salvarAjustes({ filaCinema: nova });
  try { salaAtual()?.enviar?.('fila-mudou', {}); } catch { /* sem sala */ }
  window.dispatchEvent(new CustomEvent('nc:fila-mudou', { detail: nova }));
  return nova;
}

/** Busca título e canal pelo oEmbed do YouTube (se a rede permitir). */
export async function infoDoYoutube(id) {
  try {
    const controle = new AbortController();
    const timer = setTimeout(() => controle.abort(), 4000);
    const r = await fetch(`https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(`https://www.youtube.com/watch?v=${id}`)}`, { signal: controle.signal });
    clearTimeout(timer);
    if (!r.ok) return {};
    const d = await r.json();
    return { titulo: String(d.title || '').slice(0, 140), canal: String(d.author_name || '').slice(0, 80) };
  } catch {
    return {};
  }
}

export function adicionarNaFila({ youtubeId, titulo = '', canal = '', por }) {
  return gravar((fila) => {
    if (fila.length >= MAX_FILA) throw new Error(`A fila do dia já tem ${MAX_FILA} vídeos.`);
    return [...fila, { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, youtubeId, titulo, canal, por, dia: hojeBrasilia(), em: new Date().toISOString() }];
  });
}

export const removerDaFila = (id) => gravar((fila) => fila.filter((i) => i.id !== id));

export function moverNaFila(id, delta) {
  return gravar((fila) => {
    const i = fila.findIndex((x) => x.id === id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= fila.length) return fila;
    const copia = [...fila];
    [copia[i], copia[j]] = [copia[j], copia[i]];
    return copia;
  });
}

