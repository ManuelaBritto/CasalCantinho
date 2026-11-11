// Animação de boas-vindas ao entrar, conforme o tema da pessoa.
// Curta, pode ser pulada (botão ou Esc) e respeita "movimento reduzido".
import { adesivo } from './ui/ilustracoes.js';
import { movimentoReduzido } from './tema.js';

const DURACAO = 3800;
const DURACAO_REDUZIDA = 1800;
const SAIDA = 650;

const aleatorio = (min, max) => Math.round((min + Math.random() * (max - min)) * 100) / 100;

// Cada tema: adesivo principal, adesivos que caem/brilham e o jeito de se mexer
const CENAS = {
  mistica: { heroi: 'lua-mistica', apoio: 'gato-preto', chuva: ['constelacao', 'cristal', 'olho-astral', 'carta-cigana'], jeito: 'brilho' },
  punk: { heroi: 'guitarra-estrela', apoio: 'pinguim-punk', chuva: ['estrela-verde', 'respingo', 'vinil-verde', 'coracao-xadrez'], jeito: 'pulo' },
  laco: { heroi: 'laco-rosa', apoio: 'pinguinzinha', chuva: ['margarida', 'tulipa', 'cerejeira', 'estrelinha'], jeito: 'queda' },
  onda: { heroi: 'prancha', apoio: 'concha', chuva: ['onda', 'estrela-mar', 'caracol', 'concha'], jeito: 'mare' },
  aquarela: { heroi: 'casinha', apoio: 'gatinho', chuva: ['nuvem-gordinha', 'flores-campo', 'cravo', 'violao'], jeito: 'vento' },
  cinza: { heroi: 'coracao-cinza', apoio: 'casinha-cinza', chuva: ['estrela-cinza', 'nuvem-cinza', 'flor-cinza', 'brilho-cinza'], jeito: 'queda' },
  azul: { heroi: 'coracao-azul', apoio: 'casinha-azul', chuva: ['balao-azul', 'nuvem-azul', 'estrela-azul', 'brilho-azul'], jeito: 'mare' },
};

function cena(tema, perfil) {
  const c = CENAS[tema] || CENAS.laco;
  const pecas = Array.from({ length: 14 }, (_, i) =>
    `<span class="bv-peca" style="--x:${aleatorio(2, 94)}%;--y:${aleatorio(4, 70)}%;--atraso:${aleatorio(0, 1.8)}s;--dur:${aleatorio(2.8, 4.4)}s;--giro:${aleatorio(-200, 200)}deg;--desvio:${aleatorio(-60, 60)}px;--e:${aleatorio(.55, 1.1)}">${adesivo(c.chuva[i % c.chuva.length])}</span>`).join('');
  const pontos = Array.from({ length: 22 }, () =>
    `<span class="bv-ponto" style="--x:${aleatorio(0, 100)}%;--y:${aleatorio(0, 100)}%;--atraso:${aleatorio(0, 2)}s"></span>`).join('');
  return `
    <div class="bv-cena bv-${tema} bv-jeito-${c.jeito}">
      <div class="bv-pontos" aria-hidden="true">${pontos}</div>
      <div class="bv-pecas" aria-hidden="true">${pecas}</div>
      <div class="bv-heroi" aria-hidden="true">${adesivo(c.heroi)}</div>
      <div class="bv-apoio" aria-hidden="true">${adesivo(c.apoio)}</div>
      <div class="bv-texto">
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
    ${cena(perfil.temaPadrao, perfil)}
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
