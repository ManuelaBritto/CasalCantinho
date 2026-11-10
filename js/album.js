// Álbum de figurinhas (aba Diversão) — por enquanto só o álbum com os espaços vazios
// e todos os textos visíveis como "Desenvolvendo" (TEXTO_PROVISORIO).
// Os títulos reais das páginas ficam guardados em PAGINAS_ALBUM para quando o álbum ficar pronto.
// A ideia é, no futuro, preencher `coladas` com as figurinhas que o casal ganhar.
// Para mudar páginas ou espaços, edite PAGINAS_ALBUM.
import { icone } from './ui/icones.js';

// Formatos dos espaços: retrato (3:4), quadrado e redondo. "especial" = figurinha brilhante.
const MOLDE = [
  { formato: 'retrato' }, { formato: 'retrato' }, { formato: 'redondo', especial: true },
  { formato: 'quadrado' }, { formato: 'retrato' }, { formato: 'retrato' },
];

export const PAGINAS_ALBUM = [
  { titulo: 'Nós dois', icone: 'coracao' },
  { titulo: 'Primeiros encontros', icone: 'calendario' },
  { titulo: 'Noites de cinema', icone: 'cinema' },
  { titulo: 'Lugares que fomos', icone: 'casa' },
  { titulo: 'Comidas favoritas', icone: 'estrela' },
  { titulo: 'Momentos especiais', icone: 'sparkle' },
].map((p, i) => ({ ...p, espacos: MOLDE.map((m, j) => ({ ...m, numero: i * MOLDE.length + j + 1 })) }));

export const TOTAL_FIGURINHAS = PAGINAS_ALBUM.reduce((s, p) => s + p.espacos.length, 0);

const TEXTO_PROVISORIO = 'Desenvolvendo';

let spreadAtual = 0; // par de páginas aberto (lembra ao voltar para a aba)

function htmlPagina(p, indice, lado) {
  return `
    <div class="album-pagina ${lado}">
      <h3 class="album-pagina-titulo">${icone(p.icone)} ${TEXTO_PROVISORIO}</h3>
      <ul class="album-espacos" role="list">
        ${p.espacos.map((e) => `
          <li class="album-espaco formato-${e.formato} ${e.especial ? 'especial' : ''}" aria-label="Espaço vazio (em desenvolvimento)">
            <span class="album-silhueta" aria-hidden="true">${icone(p.icone)}</span>
            ${e.especial ? `<span class="album-brilho" aria-hidden="true">${TEXTO_PROVISORIO}</span>` : ''}
          </li>`).join('')}
      </ul>
      <span class="album-rodape-pagina" aria-hidden="true">${TEXTO_PROVISORIO}</span>
    </div>`;
}

/** Desenha o álbum dentro de `alvo` (com navegação entre as páginas). */
export function montarAlbum(alvo) {
  const totalSpreads = Math.ceil(PAGINAS_ALBUM.length / 2);
  spreadAtual = Math.min(spreadAtual, totalSpreads - 1);

  function desenhar(focar = null) {
    const i = spreadAtual * 2;
    const [esq, dir] = [PAGINAS_ALBUM[i], PAGINAS_ALBUM[i + 1]];
    alvo.innerHTML = `
      <div class="album-livro" aria-live="polite">
        ${htmlPagina(esq, i, 'esquerda')}
        ${dir ? htmlPagina(dir, i + 1, 'direita') : ''}
      </div>
      <div class="album-nav">
        <button type="button" class="botao-icone contorno" data-album="-1" aria-label="Páginas anteriores" ${spreadAtual === 0 ? 'disabled' : ''}>${icone('esquerda')}</button>
        <span>${TEXTO_PROVISORIO}</span>
        <button type="button" class="botao-icone contorno" data-album="1" aria-label="Próximas páginas" ${spreadAtual >= totalSpreads - 1 ? 'disabled' : ''}>${icone('direita')}</button>
      </div>`;
    if (focar) alvo.querySelector(`[data-album="${focar}"]:not([disabled])`)?.focus();
  }

  alvo.addEventListener('click', (e) => {
    const b = e.target.closest('[data-album]');
    if (!b || b.disabled) return;
    spreadAtual = Math.max(0, Math.min(totalSpreads - 1, spreadAtual + Number(b.dataset.album)));
    desenhar(b.dataset.album);
  });
  desenhar();
}
