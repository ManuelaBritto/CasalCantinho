// Regras do calendário (as mesmas do banco, em supabase/calendario.sql).

export const TIPOS_EVENTO = {
  namoro: { nome: 'Aniversário de namoro', emoji: '💕' },
  aniversario: { nome: 'Aniversário', emoji: '🎂' },
  viagem: { nome: 'Viagem', emoji: '✈️' },
  compromisso: { nome: 'Compromisso', emoji: '📌' },
  outro: { nome: 'Outra data', emoji: '📅' },
};
export const REPETE = { nao: 'Só uma vez', anual: 'Todo ano', mensal: 'Todo mês' };
export const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

const pad = (n) => String(n).padStart(2, '0');
export const iso = (a, m, d) => `${a}-${pad(m)}-${pad(d)}`;
export const partes = (s) => s.split('-').map(Number);
const ultimoDia = (a, m) => new Date(Date.UTC(a, m, 0)).getUTCDate();
/** Dia que existe no mês (31 vira 30 em novembro; 29/02 vira 28/02 fora de ano bissexto). */
export const diaSeguro = (a, m, d) => iso(a, m, Math.min(d, ultimoDia(a, m)));

export function hojeBrasilia(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}
export function somarDias(s, n) {
  const [a, m, d] = partes(s);
  return new Date(Date.UTC(a, m - 1, d + n)).toISOString().slice(0, 10);
}
export function diasEntre(de, ate) {
  const [a1, m1, d1] = partes(de);
  const [a2, m2, d2] = partes(ate);
  return Math.round((Date.UTC(a2, m2 - 1, d2) - Date.UTC(a1, m1 - 1, d1)) / 86400000);
}

/** Próxima vez que a data acontece, a partir de "desde" (igual ao evento_ocorrencia do banco). */
export function proximaOcorrencia(data, repete, desde) {
  if (repete === 'nao' || data >= desde) return data;
  const [, mE, dE] = partes(data);
  const [aD, mD] = partes(desde);
  if (repete === 'anual') {
    const c = diaSeguro(aD, mE, dE);
    return c >= desde ? c : diaSeguro(aD + 1, mE, dE);
  }
  const c = diaSeguro(aD, mD, dE);
  if (c >= desde) return c;
  return mD === 12 ? diaSeguro(aD + 1, 1, dE) : diaSeguro(aD, mD + 1, dE);
}

/** Em que dia do mês (ano, mês) o evento cai, ou null. */
export function ocorrenciaNoMes(ev, ano, mes) {
  const [aE, mE, dE] = partes(ev.data);
  if (ev.repete === 'nao') return aE === ano && mE === mes ? ev.data : null;
  if (ano < aE || (ano === aE && mes < mE)) return null;
  if (ev.repete === 'anual') return mE === mes ? diaSeguro(ano, mes, dE) : null;
  return diaSeguro(ano, mes, dE);
}

/** "3 anos de namoro", "5 meses", "faz 26 anos"... (só para datas que repetem) */
export function contagem(ev, ocorr) {
  const [aE, mE] = partes(ev.data);
  const [aO, mO] = partes(ocorr);
  if (ev.repete === 'anual') {
    const anos = aO - aE;
    if (anos <= 0) return '';
    if (ev.tipo === 'namoro') return `${anos} ${anos === 1 ? 'ano' : 'anos'} de namoro`;
    if (ev.tipo === 'aniversario') return `${anos} ${anos === 1 ? 'ano' : 'anos'}`;
    return `${anos}ª vez`;
  }
  if (ev.repete === 'mensal') {
    const meses = (aO - aE) * 12 + (mO - mE);
    if (meses <= 0) return '';
    return ev.tipo === 'namoro' ? `${meses} ${meses === 1 ? 'mês' : 'meses'} de namoro` : '';
  }
  return '';
}

export function quandoFalta(ocorr, hoje) {
  const n = diasEntre(hoje, ocorr);
  if (n === 0) return 'Hoje';
  if (n === 1) return 'Amanhã';
  if (n < 0) return n === -1 ? 'Ontem' : `Há ${-n} dias`;
  if (n < 7) return `Em ${n} dias`;
  if (n < 60) return `Em ${n} dias`;
  const meses = Math.round(n / 30);
  return `Em ${meses} meses`;
}

/** Próximas datas (a partir de hoje), ordenadas. */
export function proximas(eventos, hoje, limite = 12) {
  return eventos
    .map((ev) => ({ ev, ocorr: proximaOcorrencia(ev.data, ev.repete, hoje) }))
    .filter(({ ocorr }) => ocorr >= hoje)
    .sort((a, b) => a.ocorr.localeCompare(b.ocorr) || String(a.ev.hora || '99').localeCompare(String(b.ev.hora || '99')))
    .slice(0, limite);
}
