// Animação de boas-vindas ao entrar, conforme o tema da pessoa (girassóis ou morcegos).
// Curta, pode ser pulada (botão ou Esc) e respeita "movimento reduzido".
import { adesivo } from './ui/ilustracoes.js';
import { movimentoReduzido } from './tema.js';

const DURACAO = 3800;
const DURACAO_REDUZIDA = 1800;
const SAIDA = 650;

const aleatorio = (min, max) => Math.round((min + Math.random() * (max - min)) * 100) / 100;

function cenaKath(perfil) {
  const petalas = Array.from({ length: 16 }, () =>
    `<span class="bv-petala" style="--x:${aleatorio(0, 100)}%;--atraso:${aleatorio(0, 1.6)}s;--dur:${aleatorio(2.8, 4.2)}s;--giro:${aleatorio(-260, 260)}deg;--desvio:${aleatorio(-60, 60)}px"></span>`).join('');
  const flores = [
    { x: 8, h: 34, e: .8 }, { x: 24, h: 46, e: 1 }, { x: 74, h: 50, e: 1.05 }, { x: 90, h: 36, e: .85 }, { x: 50, h: 22, e: .65 },
  ].map((f, i) => `
    <div class="bv-flor" style="--x:${f.x}%;--h:${f.h}vh;--e:${f.e};--i:${i}">
      <span class="bv-haste"></span>
      <span class="bv-cabeca">${adesivo('girassol')}</span>
    </div>`).join('');
  return `
    <div class="bv-cena bv-kath">
      <div class="bv-raios" aria-hidden="true"></div>
      <div class="bv-petalas" aria-hidden="true">${petalas}</div>
      <div class="bv-campo" aria-hidden="true">${flores}</div>
      <div class="bv-raposa" aria-hidden="true">${adesivo('raposa')}</div>
      <div class="bv-texto">
        <p class="bv-pre">seu cantinho está prontinho</p>
        <h2 class="bv-titulo">${perfil.saudacao}</h2>
      </div>
    </div>`;
}

function castelo() {
  return `<svg viewBox="0 0 400 140" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
    <g fill="#160912">
      <path d="M0 140V110q40-14 80-6t90 0 120-8 110 10v34z"/>
      <path d="M120 140V70l14-30 14 30v70z"/><path d="M150 140V86h8v-8h8v8h10v-8h8v8h8v-8h8v8h8v54z"/>
      <path d="M210 140V52l18-40 18 40v88z"/><path d="M246 140V92h10v-8h8v8h10v48z"/>
      <path d="M276 140V76l12-24 12 24v64z"/>
    </g>
    <g fill="#f6c66b"><rect x="130" y="84" width="8" height="12" rx="4"/><rect x="223" y="64" width="10" height="14" rx="5"/><rect x="284" y="92" width="7" height="11" rx="3.5"/><rect x="172" y="104" width="7" height="10" rx="3.5"/></g>
  </svg>`;
}

function cenaDrico(perfil) {
  const morcegos = Array.from({ length: 8 }, (_, i) =>
    `<span class="bv-morcego" style="--y:${aleatorio(8, 55)}vh;--atraso:${(i * 0.32).toFixed(2)}s;--dur:${aleatorio(2.6, 3.8)}s;--e:${aleatorio(.5, 1.15)};--onda:${aleatorio(-40, 40)}px">${adesivo('morcego')}</span>`).join('');
  const estrelas = Array.from({ length: 28 }, () =>
    `<span class="bv-estrela" style="--x:${aleatorio(0, 100)}%;--y:${aleatorio(0, 60)}%;--atraso:${aleatorio(0, 2)}s"></span>`).join('');
  return `
    <div class="bv-cena bv-drico">
      <div class="bv-estrelas" aria-hidden="true">${estrelas}</div>
      <div class="bv-lua" aria-hidden="true"></div>
      <div class="bv-castelo" aria-hidden="true">${castelo()}</div>
      <div class="bv-morcegos" aria-hidden="true">${morcegos}</div>
      <div class="bv-texto">
        <p class="bv-pre">a noite ficou mais bonita</p>
        <h2 class="bv-titulo">${perfil.saudacao}</h2>
      </div>
    </div>`;
}

/** Mostra a animação e resolve quando termina (ou é pulada). */
export function mostrarBoasVindas(perfil) {
  const camada = document.getElementById('boas-vindas');
  const reduzido = movimentoReduzido();
  camada.className = `boas-vindas ${reduzido ? 'estatica' : ''}`;
  camada.setAttribute('role', 'dialog');
  camada.setAttribute('aria-label', perfil.saudacao);
  camada.innerHTML = `
    ${perfil.temaPadrao === 'drico' ? cenaDrico(perfil) : cenaKath(perfil)}
    <button type="button" class="bv-pular">Pular animação</button>`;
  camada.hidden = false;
  try { sessionStorage.setItem('nc:boas-vindas-vista', '1'); } catch { /* ignora */ }

  return new Promise((resolver) => {
    let encerrado = false;
    const botao = camada.querySelector('.bv-pular');
    const encerrar = () => {
      if (encerrado) return;
      encerrado = true;
      clearTimeout(timer);
      document.removeEventListener('keydown', teclado);
      camada.classList.add('saindo');
      setTimeout(() => {
        camada.hidden = true;
        camada.innerHTML = '';
        camada.className = 'boas-vindas';
        camada.removeAttribute('role');
        camada.removeAttribute('aria-label');
        resolver();
      }, reduzido ? 150 : SAIDA);
    };
    const teclado = (e) => { if (e.key === 'Escape') encerrar(); };
    botao.addEventListener('click', encerrar);
    document.addEventListener('keydown', teclado);
    botao.focus({ preventScroll: true });
    const timer = setTimeout(encerrar, reduzido ? DURACAO_REDUZIDA : DURACAO);
  });
}
