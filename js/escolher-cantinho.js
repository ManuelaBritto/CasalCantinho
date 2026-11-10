// "Em qual cantinho você quer entrar?" — para quem participa de mais de um casal.
import { adesivo } from './ui/ilustracoes.js';
import { icone } from './ui/icones.js';
import { esc } from './ui/dom.js';

const ENFEITES = ['coracao', 'girassol', 'lua', 'flor', 'brilho', 'laco'];
const com = (p) => (p?.tratamento === 'ela' ? 'com a' : p?.tratamento === 'ele' ? 'com o' : 'com');

/** Mostra as opções e resolve com o id do casal escolhido. */
export function escolherCantinho(participacoes) {
  const tela = document.getElementById('tela-login');
  document.getElementById('carregando')?.setAttribute('hidden', '');
  tela.innerHTML = `
    <div class="login-cartao cartao escolher-cantinho">
      <img class="login-logo" src="assets/logo.png" alt="" width="96" height="96">
      <h1 class="login-titulo">Qual cantinho?</h1>
      <p class="login-sub">Você participa de mais de um. Dá para trocar depois pelo menu.</p>
      <div class="cantinhos" role="list">
        ${participacoes.map((p, i) => `
          <button type="button" class="cantinho-opcao" role="listitem" data-casal="${esc(p.casalId)}">
            <span class="cantinho-enfeite" aria-hidden="true">${adesivo(ENFEITES[i % ENFEITES.length])}</span>
            <span class="cantinho-texto">
              <strong>Cantinho ${esc(com(p.parceiro))} ${esc(p.parceiro?.nome || 'seu par')}</strong>
              <small>${p.parceiro ? `Cartinhas, cinema e memórias de vocês` : 'Ainda sem par'}</small>
            </span>
            ${icone('direita')}
          </button>`).join('')}
      </div>
    </div>`;
  tela.hidden = false;
  tela.querySelector('.cantinho-opcao')?.focus();
  return new Promise((resolver) => {
    tela.querySelectorAll('[data-casal]').forEach((b) => b.addEventListener('click', () => {
      tela.hidden = true;
      tela.innerHTML = '';
      resolver(b.dataset.casal);
    }));
  });
}
