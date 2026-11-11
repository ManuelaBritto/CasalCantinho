// Desenho de uma cartinha (usado no editor, na coleção e na página inicial).
import { adesivo } from '../ui/ilustracoes.js';
import { esc, formatarData } from '../ui/dom.js';

export const PAPEIS = {
  liso: 'Liso',
  pautado: 'Pautado',
  quadriculado: 'Quadriculado',
  envelhecido: 'Envelhecido',
  kraft: 'Kraft',
  noite: 'Noite',
};

export const FONTES = {
  caveat: { nome: 'Manuscrita (Caveat)', css: '"Caveat", cursive', escala: 1.35 },
  dancing: { nome: 'Caligrafia (Dancing Script)', css: '"Dancing Script", cursive', escala: 1.25 },
  cormorant: { nome: 'Clássica (Cormorant)', css: '"Cormorant Garamond", Georgia, serif', escala: 1.2 },
  courier: { nome: 'Máquina de escrever (Courier)', css: '"Courier Prime", "Courier New", monospace', escala: 1 },
  fraunces: { nome: 'Vintage (Fraunces)', css: '"Fraunces", Georgia, serif', escala: 1.02 },
  nunito: { nome: 'Simples (DM Sans)', css: '"DM Sans", system-ui, sans-serif', escala: 1 },
};

export const ALINHAMENTOS = {
  esquerda: { nome: 'À esquerda', css: 'left', icone: 'alinharEsq' },
  centro: { nome: 'Centralizado', css: 'center', icone: 'alinharCentro' },
  direita: { nome: 'À direita', css: 'right', icone: 'alinharDir' },
  justificado: { nome: 'Justificado', css: 'justify', icone: 'justificar' },
};

export const MOLDURAS = {
  nenhuma: 'Sem moldura',
  delicada: 'Delicada',
  gotica: 'Gótica',
  vintage: 'Vintage',
};

export const CORES_PAPEL = ['#ffffff', '#fff4f6', '#fde4ec', '#fff4d6', '#f8e7c2', '#efe6ff', '#e8f4ea', '#2a1626', '#1e1b2e'];
export const CORES_TINTA = { auto: 'Automática', '#3a2530': 'Grafite', '#7a1530': 'Vinho', '#5a3a1e': 'Sépia', '#2f3b6b': 'Azul-tinta', '#f7e9ef': 'Clara' };
export const MAX_ADESIVOS = 6;

export function estiloPadrao(tema) {
  if (tema === 'mistica') return { papel: 'noite', cor: '#1e1b2e', tinta: 'auto', fonte: 'cormorant', alinhamento: 'centro', moldura: 'gotica', adesivos: [] };
  if (tema === 'punk') return { papel: 'noite', cor: '#1e1b2e', tinta: 'auto', fonte: 'courier', alinhamento: 'esquerda', moldura: 'nenhuma', adesivos: [] };
  if (tema === 'laco') return { papel: 'pautado', cor: '#fde4ec', tinta: 'auto', fonte: 'caveat', alinhamento: 'esquerda', moldura: 'delicada', adesivos: [] };
  if (tema === 'onda') return { papel: 'liso', cor: '#fff4d6', tinta: 'auto', fonte: 'dancing', alinhamento: 'esquerda', moldura: 'nenhuma', adesivos: [] };
  if (tema === 'cinza') return { papel: 'liso', cor: '#ffffff', tinta: 'auto', fonte: 'nunito', alinhamento: 'esquerda', moldura: 'nenhuma', adesivos: [] };
  if (tema === 'azul') return { papel: 'pautado', cor: '#ffffff', tinta: '#2f3b6b', fonte: 'caveat', alinhamento: 'esquerda', moldura: 'delicada', adesivos: [] };
  if (tema === 'aquarela') return { papel: 'envelhecido', cor: '#f8e7c2', tinta: 'auto', fonte: 'fraunces', alinhamento: 'esquerda', moldura: 'vintage', adesivos: [] };
  return { papel: 'pautado', cor: '#fff4f6', tinta: 'auto', fonte: 'caveat', alinhamento: 'esquerda', moldura: 'delicada', adesivos: [] };
}

function luminancia(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  const canal = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * canal((n >> 16) & 255) + 0.7152 * canal((n >> 8) & 255) + 0.0722 * canal(n & 255);
}

export function papelEscuro(cor) { return luminancia(cor) < 0.2; }

function tintaFinal(estilo) {
  if (estilo.tinta && estilo.tinta !== 'auto') return estilo.tinta;
  return papelEscuro(estilo.cor) ? '#f7e9ef' : '#3a2530';
}

/** Retorna o HTML de uma carta. `compacta` mostra só o começo do texto. */
export function htmlCarta(carta, { compacta = false, idTitulo = '' } = {}) {
  const estilo = { ...estiloPadrao(''), ...(carta.estilo || {}) };
  const fonte = FONTES[estilo.fonte] || FONTES.nunito;
  const alinhar = ALINHAMENTOS[estilo.alinhamento]?.css || 'left';
  const escuro = papelEscuro(estilo.cor);
  const paragrafos = String(carta.mensagem || '').split(/\n{2,}/).map((p) => `<p>${esc(p).replace(/\n/g, '<br>')}</p>`).join('');
  const adesivos = (estilo.adesivos || []).slice(0, MAX_ADESIVOS);
  return `
    <article class="carta papel-${esc(estilo.papel)} moldura-${esc(estilo.moldura)} ${escuro ? 'carta-escura' : ''} ${compacta ? 'compacta' : ''}"
      style="--papel:${esc(estilo.cor)};--tinta:${esc(tintaFinal(estilo))};--fonte-carta:${esc(fonte.css)};--escala-fonte:${fonte.escala};text-align:${alinhar}"
      ${idTitulo ? `aria-labelledby="${idTitulo}"` : ''}>
      ${adesivos.length ? `<div class="carta-adesivos" aria-hidden="true">${adesivos.map((id, i) => `<span class="adesivo pos-${i}">${adesivo(id)}</span>`).join('')}</div>` : ''}
      <header class="carta-cab">
        ${carta.destinatario ? `<p class="carta-para">Para ${esc(carta.destinatario)}</p>` : ''}
        <h3 class="carta-titulo" ${idTitulo ? `id="${idTitulo}"` : ''}>${esc(carta.titulo || 'Sem título')}</h3>
        ${carta.data ? `<p class="carta-data">${esc(formatarData(carta.data, { day: 'numeric', month: 'long', year: 'numeric' }))}</p>` : ''}
      </header>
      <div class="carta-texto">${paragrafos || '<p class="carta-placeholder">Sua mensagem aparece aqui…</p>'}</div>
    </article>`;
}
