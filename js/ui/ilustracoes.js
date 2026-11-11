// Ilustrações desenhadas em SVG. Todas são originais e decorativas (aria-hidden como enfeite).
// Os desenhos dos cinco temas atuais ficam em adesivos-temas.js. Os desenhos dos temas
// antigos continuam aqui só para as cartinhas e listas que já os usam.
import { ADESIVOS_TEMAS, PACOTES_TEMAS } from './adesivos-temas.js';

const svg = (conteudo, vb = '0 0 64 64') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" aria-hidden="true" focusable="false">${conteudo}</svg>`;

function petalas(qtd, raioCentro, rx, ry, cor, borda) {
  let s = '';
  for (let i = 0; i < qtd; i++) {
    s += `<ellipse cx="0" cy="${-raioCentro}" rx="${rx}" ry="${ry}" transform="rotate(${(360 / qtd) * i})" fill="${cor}" stroke="${borda}" stroke-width="1.2"/>`;
  }
  return s;
}

function teiaSvg(cor = '#cdb6d6') {
  const cx = 32, cy = 32, raios = 8;
  let linhas = '';
  const pontos = (r) => Array.from({ length: raios }, (_, i) => {
    const a = (Math.PI * 2 * i) / raios - Math.PI / 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  for (const [x, y] of pontos(30)) linhas += `<path d="M${cx} ${cy}L${x.toFixed(1)} ${y.toFixed(1)}"/>`;
  for (const r of [9, 17, 25]) {
    const p = pontos(r);
    let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
    for (let i = 1; i <= raios; i++) {
      const [x, y] = p[i % raios];
      const [px, py] = p[i - 1];
      const mx = (x + px) / 2, my = (y + py) / 2;
      const qx = mx + (cx - mx) * 0.18, qy = my + (cy - my) * 0.18;
      d += ` Q${qx.toFixed(1)} ${qy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    linhas += `<path d="${d}"/>`;
  }
  return svg(`<g fill="none" stroke="${cor}" stroke-width="1.3" stroke-linecap="round">${linhas}</g>`);
}

function seloPostal() {
  return svg(`
    <rect x="9" y="7" width="46" height="50" fill="#f6e2b6" stroke="#fffaf0" stroke-width="5" stroke-dasharray="0 5.2" stroke-linecap="round"/>
    <rect x="14" y="12" width="36" height="40" fill="#fdf3dc" stroke="#b8560f" stroke-width="1.5"/>
    <g transform="translate(32 30)">${petalas(10, 8, 3, 6, '#f2b320', '#d9921a')}<circle r="5" fill="#6b3e1d"/></g>
    <text x="32" y="48" text-anchor="middle" font-family="Courier Prime, monospace" font-size="6" font-weight="700" fill="#8a3b06">CORREIO</text>`);
}

// ---------- Adesivos (também usados nas cartinhas) ----------
export const ADESIVOS = {
  // Neutro
  coracao: { nome: 'Coração', pacote: 'neutro', svg: () => svg('<path d="M32 56C12 42 5 31 5 21A13 13 0 0 1 32 15a13 13 0 0 1 27 6c0 10-7 21-27 35z" fill="#f28fae"/><path d="M15 19a7 7 0 0 1 8-5" stroke="#fff" stroke-width="3" stroke-linecap="round" fill="none" opacity=".75"/>') },
  flor: { nome: 'Flor', pacote: 'neutro', svg: () => svg(`<g transform="translate(32 32)">${petalas(5, 14, 9, 13, '#f7b6c8', '#e98aa8')}</g><circle cx="32" cy="32" r="8" fill="#ffd98a" stroke="#e9b14f" stroke-width="1.5"/>`) },
  brilho: { nome: 'Brilho', pacote: 'neutro', svg: () => svg('<path d="M30 6c2 16 7 22 22 24-15 2-20 8-22 24-2-16-7-22-22-24 15-2 20-8 22-24z" fill="#f6c66b"/><path d="M52 6c1 5 2 7 7 8-5 1-6 3-7 8-1-5-2-7-7-8 5-1 6-3 7-8z" fill="#f7b6c8"/>') },
  laco: { nome: 'Laço', pacote: 'neutro', svg: () => svg('<g fill="#f49ab5" stroke="#d76d92" stroke-width="2" stroke-linejoin="round"><path d="M32 30C22 16 8 16 8 28s14 14 24 4z"/><path d="M32 30c10-14 24-14 24-2s-14 14-24 4z"/><path d="M30 34 20 56l7-4 4 6 2-23z"/><path d="M34 34l10 22-7-4-4 6-2-23z"/></g><circle cx="32" cy="31" r="6" fill="#e77ea1" stroke="#d76d92" stroke-width="2"/>') },
  nuvem: { nome: 'Nuvem', pacote: 'neutro', svg: () => svg('<path d="M18 48h30a10 10 0 0 0 1-20 14 14 0 0 0-27-4 12 12 0 0 0-4 24z" fill="#fff" stroke="#f2b8c9" stroke-width="2.5"/><circle cx="27" cy="36" r="2" fill="#7a5462"/><circle cx="39" cy="36" r="2" fill="#7a5462"/><path d="M30 41q3 2.5 6 0" stroke="#7a5462" stroke-width="1.8" fill="none" stroke-linecap="round"/><circle cx="23" cy="40" r="2.5" fill="#f7b6c8"/><circle cx="43" cy="40" r="2.5" fill="#f7b6c8"/>') },

  // Drico
  morcego: { nome: 'Morcego', pacote: 'drico', svg: () => svg('<path d="M32 27C26 17 15 15 3 21c6 2 8 6 8 11 4-3 8-2 10 2 2-4 7-4 11 0 4-4 9-4 11 0 2-4 6-5 10-2 0-5 2-9 8-11-12-6-23-4-29 6z" fill="#3b2140"/><path d="m25 24 1-10 5 7zM39 24l-1-10-5 7z" fill="#4a2a52"/><circle cx="32" cy="29" r="8" fill="#4a2a52"/><circle cx="29" cy="28" r="1.8" fill="#ffd6e4"/><circle cx="35" cy="28" r="1.8" fill="#ffd6e4"/><path d="M29.6 32.5h2l-1 2.4zM32.4 32.5h2l-1 2.4z" fill="#fff"/><circle cx="26.5" cy="31" r="1.4" fill="#e86a94" opacity=".6"/><circle cx="37.5" cy="31" r="1.4" fill="#e86a94" opacity=".6"/>') },
  rosa: { nome: 'Rosa escura', pacote: 'drico', svg: () => svg('<path d="M32 40v20" stroke="#3f5a35" stroke-width="3" stroke-linecap="round"/><path d="M32 52c-6-6-14-4-16 0 6 3 12 3 16 0zM32 47c6-5 13-4 15 0-5 3-11 3-15 0z" fill="#4e6e40"/><circle cx="32" cy="26" r="16" fill="#7a1530"/><path d="M18 30c2 8 8 12 14 12s12-4 14-12c-4 5-8 7-14 7s-10-2-14-7z" fill="#5e1026"/><path d="M32 13c-8 0-12 6-10 12 2-4 6-6 10-6s8 2 10 6c2-6-2-12-10-12z" fill="#a3294b"/><path d="M26 28c0-5 4-8 8-7 4 1 5 6 2 9-2 2-6 1-6-2 0-2 2-3 3-2" fill="none" stroke="#4e0b1d" stroke-width="2" stroke-linecap="round"/>') },
  lua: { nome: 'Lua', pacote: 'drico', svg: () => svg('<circle cx="34" cy="32" r="27" fill="#f3e3b5" opacity=".12"/><path d="M40 6a26 26 0 1 0 18 40A21 21 0 1 1 40 6z" fill="#f3e3b5"/><circle cx="22" cy="30" r="3" fill="#e2cc93"/><circle cx="28" cy="46" r="2" fill="#e2cc93"/><circle cx="18" cy="42" r="1.6" fill="#e2cc93"/>') },
  teia: { nome: 'Teia', pacote: 'drico', svg: () => teiaSvg('#c9b0d4') },
  aranha: { nome: 'Aranha', pacote: 'drico', svg: () => svg('<path d="M32 2v26" stroke="#bfa6c9" stroke-width="1.3"/><g stroke="#2b1a30" stroke-width="3" stroke-linecap="round" fill="none"><path d="M24 34c-6-6-12-6-16-2M24 38c-7-2-12 0-15 4M25 42c-5 2-8 6-9 11M27 30c-4-7-9-9-13-8"/><path d="M40 34c6-6 12-6 16-2M40 38c7-2 12 0 15 4M39 42c5 2 8 6 9 11M37 30c4-7 9-9 13-8"/></g><circle cx="32" cy="38" r="11" fill="#3a2342"/><circle cx="28" cy="36" r="3" fill="#fff"/><circle cx="36" cy="36" r="3" fill="#fff"/><circle cx="28.5" cy="36.6" r="1.5" fill="#1a0b12"/><circle cx="36.5" cy="36.6" r="1.5" fill="#1a0b12"/><path d="M29 42q3 2 6 0" stroke="#ffb3c8" stroke-width="1.6" fill="none" stroke-linecap="round"/>') },
  vela: { nome: 'Vela', pacote: 'drico', svg: () => svg('<circle cx="32" cy="17" r="14" fill="#f6c66b" opacity=".22"/><path d="M32 6c5 7 6 11 3 15a4 4 0 0 1-6 0c-3-4-2-8 3-15z" fill="#ffb347"/><path d="M32 12c2 4 2 6 1 8a1.5 1.5 0 0 1-2 0c-1-2-1-4 1-8z" fill="#fff3c4"/><path d="M32 23v4" stroke="#2b1a30" stroke-width="1.5"/><rect x="24" y="27" width="16" height="28" rx="3" fill="#f2e6ee"/><path d="M24 32c3 0 3 6 6 6s2-6 5-6 2 3 5 3" fill="none" stroke="#d9c5d3" stroke-width="2"/><rect x="18" y="54" width="28" height="5" rx="2.5" fill="#7a2a45"/>') },
  castelo: { nome: 'Castelo', pacote: 'drico', svg: () => svg('<g fill="#3a1f3f"><path d="M6 26 14 10l8 16z"/><rect x="8" y="26" width="12" height="32"/><path d="m42 26 8-16 8 16z"/><rect x="44" y="26" width="12" height="32"/><path d="M20 36h4v-4h4v4h8v-4h4v4h4v22H20z"/><path d="M25 18 32 4l7 14z"/><rect x="27" y="18" width="10" height="16"/></g><path d="M29 58v-8a3 3 0 0 1 6 0v8z" fill="#f6c66b"/><rect x="12" y="32" width="4" height="6" rx="2" fill="#f6c66b"/><rect x="48" y="32" width="4" height="6" rx="2" fill="#f6c66b"/><rect x="30" y="22" width="4" height="6" rx="2" fill="#f6c66b"/>') },
  vampiro: { nome: 'Vampirinho', pacote: 'drico', svg: () => svg('<path d="M10 62c2-14 10-22 22-22s20 8 22 22z" fill="#2a1428"/><path d="m14 42 8 6 10-6 10 6 8-6-4 10H18z" fill="#9d2449"/><circle cx="32" cy="28" r="15" fill="#f6e3ea"/><path d="M17 26c0-10 7-16 15-16s15 6 15 16c-3-3-7-4-9-3l-6 6-6-6c-2-1-6 0-9 3z" fill="#2a1428"/><circle cx="26" cy="30" r="2" fill="#2a1428"/><circle cx="38" cy="30" r="2" fill="#2a1428"/><circle cx="23" cy="34" r="2.5" fill="#f4a3bd" opacity=".75"/><circle cx="41" cy="34" r="2.5" fill="#f4a3bd" opacity=".75"/><path d="M28 36q4 3 8 0" fill="none" stroke="#2a1428" stroke-width="1.6" stroke-linecap="round"/><path d="m29.6 36.8 1 2.3.9-1.8zM32.5 37.2l.9 1.9 1-2.4z" fill="#fff"/>') },

  // Kath
  girassol: { nome: 'Girassol', pacote: 'kath', svg: () => svg(`<g transform="translate(32 32)">${petalas(14, 17, 5, 12, '#f2b320', '#d9921a')}</g><circle cx="32" cy="32" r="11" fill="#6b3e1d"/><g fill="#8a5428"><circle cx="28" cy="29" r="1.6"/><circle cx="34" cy="28" r="1.6"/><circle cx="37" cy="33" r="1.6"/><circle cx="31" cy="35" r="1.6"/><circle cx="26" cy="34" r="1.4"/><circle cx="33" cy="39" r="1.4"/></g>`) },
  raposa: { nome: 'Raposa', pacote: 'kath', svg: () => svg('<path d="m8 10 16 14q8-4 16 0l16-14-2 24q-4 16-22 22-18-6-22-22z" fill="#e0702a"/><path d="m12 16 9 9-6 4zM52 16l-9 9 6 4z" fill="#7a3b17"/><path d="M12 36q10 2 20 20-16-4-20-20zM52 36q-10 2-20 20 16-4 20-20z" fill="#fff6e8"/><circle cx="24" cy="36" r="2.6" fill="#3e2716"/><circle cx="40" cy="36" r="2.6" fill="#3e2716"/><path d="M29 49h6l-3 4z" fill="#3e2716"/>') },
  folhagem: { nome: 'Folhagem', pacote: 'kath', svg: () => svg('<path d="M8 56C8 28 26 10 56 8c-2 30-20 48-48 48z" fill="#7d8f3a"/><path d="M10 54C22 40 34 28 50 14" stroke="#4f5e1f" stroke-width="2" fill="none" stroke-linecap="round"/><path d="m22 42-2-10M30 34l-2-10M38 26l-1-8M22 42l10 1M30 34l10 1" stroke="#4f5e1f" stroke-width="1.5" stroke-linecap="round"/>') },
  carimbo: { nome: 'Carimbo', pacote: 'kath', svg: () => svg('<g fill="none" stroke="#b8560f" stroke-width="2" opacity=".9"><circle cx="32" cy="32" r="26"/><circle cx="32" cy="32" r="20" stroke-dasharray="3 3"/></g><text x="32" y="30" text-anchor="middle" font-family="Courier Prime, monospace" font-size="9" font-weight="700" fill="#b8560f">COM</text><text x="32" y="41" text-anchor="middle" font-family="Courier Prime, monospace" font-size="9" font-weight="700" fill="#b8560f">AMOR</text>') },
  selo: { nome: 'Selo postal', pacote: 'kath', svg: seloPostal },
  polaroid: { nome: 'Polaroid', pacote: 'kath', svg: () => svg('<g transform="rotate(-6 32 32)"><rect x="12" y="8" width="40" height="48" rx="2" fill="#fffdf6" stroke="#e4cda3" stroke-width="1.5"/><rect x="16" y="12" width="32" height="30" fill="#f4c96b"/><circle cx="38" cy="21" r="5" fill="#fff3c4"/><path d="M16 42l10-12 8 8 5-5 9 9z" fill="#7d8f3a"/></g>') },

  // Temas atuais
  ...ADESIVOS_TEMAS,
};

// Pacotes de adesivos: os 5 temas + os enfeites dos temas antigos. Todo mundo pode usar todos.
const idsDoPacote = (pacote) => Object.keys(ADESIVOS).filter((id) => ADESIVOS[id].pacote === pacote);
export const PACOTES = {
  ...PACOTES_TEMAS,
  gotico: { nome: 'Gótico', itens: idsDoPacote('drico') },
  girassol: { nome: 'Girassol', itens: idsDoPacote('kath') },
  classicos: { nome: 'Clássicos', itens: idsDoPacote('neutro') },
};

/** Ordem dos pacotes no seletor: tema atual, o do par, os outros temas e os antigos. */
export function pacotesEmOrdem(atual, doCasal = []) {
  const ordem = [atual, ...doCasal, ...Object.keys(PACOTES)];
  return [...new Set(ordem)].filter((p) => PACOTES[p]);
}

export function adesivo(id) {
  const a = ADESIVOS[id];
  return a ? a.svg() : '';
}

// Ícones dos temas (seletor)
export const ICONE_TEMA = {
  mistica: () => adesivo('lua-mistica'),
  punk: () => adesivo('estrela-verde'),
  laco: () => adesivo('laco-rosa'),
  onda: () => adesivo('onda'),
  aquarela: () => adesivo('gatinho'),
  cinza: () => adesivo('coracao-cinza'),
  azul: () => adesivo('coracao-azul'),
};

/** Enfeites de cada página, por tema (o CSS mostra só o do tema ativo). */
export const ENFEITES = {
  cartinhas: { mistica: 'carta-cigana', punk: 'coracao-xadrez', laco: 'laco-rosa', onda: 'concha', aquarela: 'cravo', cinza: 'coracao-cinza', azul: 'coracao-azul' },
  listas: { mistica: 'constelacao', punk: 'paisley', laco: 'livros', onda: 'trilha', aquarela: 'coruja', cinza: 'casinha-cinza', azul: 'casinha-azul' },
  cinemateca: { mistica: 'olho-astral', punk: 'vinil-verde', laco: 'tulipa', onda: 'estrela-mar', aquarela: 'nuvem-gordinha', cinza: 'estrela-cinza', azul: 'estrela-azul' },
  cinematecaVazia: { mistica: 'cristal', punk: 'caixa-som', laco: 'margarida', onda: 'por-do-sol', aquarela: 'casinha', cinza: 'nuvem-cinza', azul: 'nuvem-azul' },
  memorias: { mistica: 'lua-mistica', punk: 'estrela-verde', laco: 'cerejeira', onda: 'onda', aquarela: 'flores-campo', cinza: 'flor-cinza', azul: 'flor-azul' },
  cinema: { mistica: 'gato-preto', punk: 'guitarra-estrela', laco: 'pinguinzinha', onda: 'prancha', aquarela: 'vinil', cinza: 'balao-cinza', azul: 'balao-azul' },
  diversao: { mistica: 'mapa-astral', punk: 'respingo', laco: 'estrelinha', onda: 'bola', aquarela: 'violao', cinza: 'brilho-cinza', azul: 'brilho-azul' },
  vazio: { mistica: 'coracao', punk: 'coracao-xadrez', laco: 'coracao', onda: 'coracao', aquarela: 'coracao', cinza: 'coracao-cinza', azul: 'coracao-azul' },
  contador: { mistica: 'lua-mistica', punk: 'estrela-verde', laco: 'laco-rosa', onda: 'concha', aquarela: 'gatinho', cinza: 'coracao-cinza', azul: 'coracao-azul' },
};
export const enfeite = (nome) => enfeitePorTema(ENFEITES[nome]);

// ---------- Decoração de fundo por tema ----------
// t = largura, o = opacidade, r = rotação, d = duração da flutuação, opcional = escondido no modo "discreta"
const DECORACOES = {
  mistica: [
    { id: 'lua-mistica', x: '90%', y: '5%', t: 92, o: .6, r: 0 },
    { id: 'constelacao', x: '4%', y: '12%', t: 70, o: .45, r: -8 },
    { id: 'carta-cigana', x: '84%', y: '44%', t: 46, o: .4, r: 12, opcional: true },
    { id: 'cristal', x: '8%', y: '60%', t: 40, o: .4, r: -10, opcional: true },
    { id: 'gato-preto', x: '92%', y: '82%', t: 66, o: .5, r: 0 },
    { id: 'olho-astral', x: '45%', y: '94%', t: 40, o: .3, r: 0, opcional: true },
  ],
  punk: [
    { id: 'estrela-verde', x: '92%', y: '6%', t: 70, o: .55, r: 14 },
    { id: 'respingo', x: '4%', y: '10%', t: 74, o: .4, r: -12 },
    { id: 'vinil-verde', x: '86%', y: '46%', t: 50, o: .35, r: 0, opcional: true },
    { id: 'paisley', x: '6%', y: '64%', t: 44, o: .35, r: 18, opcional: true },
    { id: 'pinguim-punk', x: '92%', y: '84%', t: 64, o: .5, r: 0 },
    { id: 'estrela-verde', x: '48%', y: '94%', t: 30, o: .35, r: -10, opcional: true },
  ],
  laco: [
    { id: 'laco-rosa', x: '92%', y: '6%', t: 64, o: .5, r: 12 },
    { id: 'cerejeira', x: '4%', y: '12%', t: 54, o: .45, r: -10 },
    { id: 'estrelinha', x: '86%', y: '46%', t: 38, o: .45, r: 0, opcional: true },
    { id: 'tulipa', x: '6%', y: '74%', t: 52, o: .4, r: -6, opcional: true },
    { id: 'pinguinzinha', x: '93%', y: '84%', t: 58, o: .45, r: 0 },
    { id: 'margarida', x: '48%', y: '94%', t: 34, o: .4, r: 10, opcional: true },
  ],
  onda: [
    { id: 'por-do-sol', x: '91%', y: '6%', t: 70, o: .5, r: 0 },
    { id: 'concha', x: '4%', y: '12%', t: 48, o: .45, r: -14 },
    { id: 'estrela-mar', x: '86%', y: '46%', t: 40, o: .4, r: 10, opcional: true },
    { id: 'caracol', x: '6%', y: '70%', t: 44, o: .4, r: 0, opcional: true },
    { id: 'onda', x: '92%', y: '84%', t: 66, o: .45, r: 0 },
    { id: 'trilha', x: '48%', y: '94%', t: 40, o: .3, r: 0, opcional: true },
  ],
  aquarela: [
    { id: 'nuvem-gordinha', x: '90%', y: '5%', t: 80, o: .55, r: 0 },
    { id: 'flores-campo', x: '4%', y: '12%', t: 54, o: .45, r: -8 },
    { id: 'coruja', x: '86%', y: '46%', t: 42, o: .4, r: 0, opcional: true },
    { id: 'cravo', x: '6%', y: '70%', t: 46, o: .4, r: -10, opcional: true },
    { id: 'gatinho', x: '92%', y: '84%', t: 62, o: .5, r: 0 },
    { id: 'vinil', x: '48%', y: '94%', t: 36, o: .3, r: 0, opcional: true },
  ],
  cinza: [
    { id: 'nuvem-cinza', x: '90%', y: '5%', t: 74, o: .5, r: 0 },
    { id: 'estrela-cinza', x: '4%', y: '12%', t: 46, o: .45, r: -10 },
    { id: 'brilho-cinza', x: '86%', y: '46%', t: 38, o: .4, r: 0, opcional: true },
    { id: 'flor-cinza', x: '6%', y: '70%', t: 44, o: .4, r: 8, opcional: true },
    { id: 'coracao-cinza', x: '92%', y: '84%', t: 54, o: .45, r: 0 },
    { id: 'lua-cinza', x: '48%', y: '94%', t: 36, o: .3, r: 0, opcional: true },
  ],
  azul: [
    { id: 'nuvem-azul', x: '90%', y: '5%', t: 74, o: .5, r: 0 },
    { id: 'estrela-azul', x: '4%', y: '12%', t: 46, o: .45, r: -10 },
    { id: 'brilho-azul', x: '86%', y: '46%', t: 38, o: .4, r: 0, opcional: true },
    { id: 'flor-azul', x: '6%', y: '70%', t: 44, o: .4, r: 8, opcional: true },
    { id: 'coracao-azul', x: '92%', y: '84%', t: 54, o: .45, r: 0 },
    { id: 'lua-azul', x: '48%', y: '94%', t: 36, o: .3, r: 0, opcional: true },
  ],
};

export function renderizarDecoracao(tema) {
  const alvo = document.getElementById('decoracao');
  if (!alvo) return;
  alvo.innerHTML = (DECORACOES[tema] || [])
    .map((d, i) => `<div class="enfeite ${d.opcional ? 'opcional' : ''}" style="left:${d.x};top:${d.y};--t:${d.t}px;--o:${(d.o * 0.55).toFixed(2)};--r:${d.r}deg;--d:${7 + (i % 4) * 1.5}s;margin-left:-${Math.round(d.t / 2)}px">${adesivo(d.id)}</div>`)
    .join('');
}

// ---------- Cena ilustrada para o espaço da foto do casal ----------
const CENAS = {
  mistica: { ceu: ['#2a1a4d', '#120b22'], chao: '#0b0716', itens: [['lua-mistica', 210, 18, 1.6], ['constelacao', 30, 20, 1.2], ['carta-cigana', 120, 70, 1], ['gato-preto', 196, 120, 1.4]] },
  punk: { ceu: ['#2a1150', '#12061f'], chao: '#0a0414', itens: [['respingo', 20, 20, 1.3], ['estrela-verde', 220, 20, 1.3], ['guitarra-estrela', 120, 60, 1.7], ['pinguim-punk', 30, 120, 1.3]] },
  laco: { ceu: ['#ffe3ee', '#fff4f8'], chao: '#f7c4d6', itens: [['laco-rosa', 128, 14, 1.2], ['cerejeira', 24, 30, 1], ['livros', 200, 110, 1.4], ['pinguinzinha', 60, 110, 1.4], ['estrelinha', 246, 24, .8]] },
  onda: { ceu: ['#bfe3f6', '#ffe1d2'], chao: '#f4e3c1', itens: [['por-do-sol', 110, 50, 1.6], ['prancha', 228, 70, 1.6], ['concha', 30, 140, 1], ['estrela-mar', 150, 150, .9]] },
  aquarela: { ceu: ['#cfe6f3', '#fbf6ea'], chao: '#b7d3b0', itens: [['nuvem-gordinha', 30, 14, 1.3], ['nuvem-gordinha', 200, 30, 1], ['casinha', 190, 96, 1.6], ['gatinho', 40, 128, 1.3]] },
  cinza: { ceu: ['#d9d9d9', '#f4f4f4'], chao: '#bdbdbd', itens: [['nuvem-cinza', 30, 18, 1.3], ['lua-cinza', 220, 16, 1.2], ['casinha-cinza', 180, 100, 1.5], ['coracao-cinza', 50, 120, 1.2]] },
  azul: { ceu: ['#b9d6f7', '#eaf2fc'], chao: '#8fb8ea', itens: [['nuvem-azul', 30, 18, 1.3], ['balao-azul', 220, 16, 1.3], ['casinha-azul', 180, 100, 1.5], ['coracao-azul', 50, 120, 1.2]] },
};

export function cenaCasal(tema) {
  const c = CENAS[tema] || CENAS.laco;
  const dentro = (id) => (ADESIVOS[id]?.svg() || '').replace(/^<svg[^>]*>|<\/svg>$/g, '');
  return svg(`
    <defs><linearGradient id="cena-ceu-${tema}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c.ceu[0]}"/><stop offset="1" stop-color="${c.ceu[1]}"/></linearGradient></defs>
    <rect width="320" height="220" fill="url(#cena-ceu-${tema})"/>
    <path d="M0 180q80-26 160-4t160-6v50H0z" fill="${c.chao}"/>
    ${c.itens.map(([id, x, y, e]) => `<g transform="translate(${x} ${y}) scale(${e})">${dentro(id)}</g>`).join('')}`, '0 0 320 220');
}

// Pôster genérico (quando um filme não tem imagem)
export function posterVazio(titulo) {
  return `<div class="poster-vazio" role="img" aria-label="Sem pôster: ${titulo.replace(/"/g, '&quot;')}">
    <svg class="icone" aria-hidden="true"><use href="#i-filme"></use></svg>
    <span>${titulo.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</span>
  </div>`;
}

/**
 * Enfeite que acompanha o tema sem redesenhar a página:
 * renderiza uma versão por tema e o CSS mostra só a do tema ativo.
 */
export function enfeitePorTema(mapa) {
  return Object.entries(mapa).map(([tema, id]) => `<span class="por-tema so-${tema}">${adesivo(id)}</span>`).join('');
}
