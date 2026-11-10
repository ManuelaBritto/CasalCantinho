// Sincronia do Cinema: regras puras (sem DOM), usadas por paginas/cinema.js.
//
// 1. Relógio: os aparelhos trocam "ping/pong" e medem quanto tempo a mensagem leva.
//    Com isso estimamos a diferença entre o relógio do outro e o nosso (como o NTP),
//    e o atraso da internet deixa de depender de os relógios estarem certos.
// 2. Correção: diferença pequena fica como está; média, quem está atrasado acelera
//    (ou quem está adiantado desacelera) por alguns segundos; grande, pula.

export const TOLERANCIA = 0.35;      // s: abaixo disso, consideramos sincronizados
export const LIMITE_SUAVE = 1.5;     // s: até aqui corrige mudando a velocidade
export const ADIANTO_PULO = 0.3;     // s: o pulo leva um tempinho para voltar a tocar
const ATRASO_PADRAO = 0.15;          // s: enquanto não medimos, supomos isso
const MAX_ATRASO = 4;                // s: mais que isso é mensagem velha, não atraso real
const AMOSTRAS = 10;

export function criarRelogio() {
  let amostras = [];
  const melhor = () => amostras.reduce((m, a) => (!m || a.rtt < m.rtt ? a : m), null);

  return {
    /** t0: envio do ping (meu relógio) · t1: chegada no outro (relógio dele) · t3: volta (meu relógio). */
    registrar({ t0, t1, t3 }) {
      if (![t0, t1, t3].every(Number.isFinite) || t3 < t0) return;
      const rtt = t3 - t0;
      if (rtt > 10000) return;
      amostras = [...amostras, { rtt, deslocamento: t1 - (t0 + t3) / 2 }].slice(-AMOSTRAS);
    },
    get amostras() { return amostras.length; },
    /** Relógio dele − meu relógio, em ms (null enquanto não mediu). */
    deslocamento() { return melhor()?.deslocamento ?? null; },
    /** Tempo de ida e volta mais confiável, em ms. */
    ida() { const m = melhor(); return m ? m.rtt / 2 : null; },
    /** Converte um horário do relógio dele para o meu. */
    paraMeu(emDele) {
      const d = this.deslocamento();
      return d === null ? emDele : emDele - d; // sem medição ainda: supõe relógios iguais
    },
    /** Quanto tempo (s) a mensagem enviada em `emDele` levou para chegar até agora. */
    atrasoDe(emDele, agora = Date.now()) {
      const d = this.deslocamento();
      if (d === null || !Number.isFinite(emDele)) return ATRASO_PADRAO;
      const s = (agora - (emDele - d)) / 1000;
      if (s < 0) return (this.ida() ?? ATRASO_PADRAO * 1000) / 1000;
      return Math.min(s, MAX_ATRASO);
    },
  };
}

/**
 * Decide como corrigir. `diferenca` = minha posição − posição do maestro (s);
 * positivo = estou adiantado. `taxas` = velocidades que o player aceita.
 * Retorna { acao: 'nada' | 'velocidade' | 'pular', taxa?, duracao? }.
 */
export function decidirCorrecao({ diferenca, tocando, taxas = [] }) {
  const d = Math.abs(diferenca);
  if (!Number.isFinite(diferenca) || d < TOLERANCIA) return { acao: 'nada' };
  if (!tocando) return d > 0.5 ? { acao: 'pular' } : { acao: 'nada' };
  if (d <= LIMITE_SUAVE) {
    const taxa = diferenca < 0 ? 1.25 : 0.75;
    if (taxas.includes(taxa)) return { acao: 'velocidade', taxa, duracao: d / Math.abs(taxa - 1) };
  }
  return { acao: 'pular' };
}

/**
 * Quem guia a sessão? Vence a ação mais recente (horários já no meu relógio);
 * empate de até 250 ms → ordem alfabética, igual nos dois aparelhos.
 */
export function maestroVence(atual, candidato) {
  if (!atual) return true;
  if (candidato.desde > atual.desde + 250) return true;
  if (candidato.desde < atual.desde - 250) return false;
  return candidato.perfil < atual.perfil;
}
