// Tela de entrada (modo demonstração ou Supabase).
import { entrarDemo, entrarComNome, modoAuth } from './auth.js';
import { adesivo } from './ui/ilustracoes.js';
import { icone } from './ui/icones.js';
import { esc, limparErros, marcarErro } from './ui/dom.js';

/** Mostra a tela de login e resolve com o perfil quando a pessoa entra. */
export function mostrarLogin({ erroInicial = '' } = {}) {
  const tela = document.getElementById('tela-login');
  const demo = modoAuth() === 'demo';

  tela.innerHTML = `
    <div class="login-cartao cartao">
      <img class="login-logo" src="assets/logo.png" alt="" width="128" height="128">
      <h1 class="login-titulo">Nosso Cantinho</h1>
      <p class="login-sub">Um espaço só de vocês para cartinhas, listas, filmes e memórias.</p>

      ${erroInicial ? `<div class="aviso erro" role="alert">${icone('alerta')}<p>${esc(erroInicial)}</p></div>` : ''}

      ${demo ? `
        <div class="aviso" id="aviso-demo">
          ${icone('info')}
          <div>
            <p><strong>Modo demonstração.</strong> O login real (Supabase) ainda não foi configurado.</p>
            <p>Aqui não existe senha nem autenticação: basta escolher um perfil. Os dados ficam só neste navegador.</p>
          </div>
        </div>
        <h2 class="login-pergunta">Quem está chegando?</h2>
        <div class="login-perfis">
          <button type="button" class="perfil-botao perfil-kath" data-perfil="kath">
            <span class="perfil-ilustra" aria-hidden="true">${adesivo('girassol')}</span>
            <span class="perfil-nome">Kath</span>
            <span class="perfil-acao">Entrar como Kath</span>
          </button>
          <button type="button" class="perfil-botao perfil-drico" data-perfil="drico">
            <span class="perfil-ilustra" aria-hidden="true">${adesivo('morcego')}</span>
            <span class="perfil-nome">Drico</span>
            <span class="perfil-acao">Entrar como Drico</span>
          </button>
        </div>` : `
        <form class="formulario" id="form-login" novalidate>
          <div class="campo">
            <label for="login-nome">Nome</label>
            <input id="login-nome" name="nome" type="text" autocomplete="username" autocapitalize="none" autocorrect="off" spellcheck="false" placeholder="Seu nome de usuário" required>
          </div>
          <div class="campo">
            <label for="login-senha">Senha</label>
            <input id="login-senha" name="senha" type="password" autocomplete="current-password" required>
          </div>
          <p class="erro-login erro-campo" role="alert" hidden></p>
          <button type="submit" class="botao">${icone('cadeado')} Entrar</button>

        </form>`}

    </div>`;

  tela.hidden = false;

  return new Promise((resolver) => {
    if (demo) {
      tela.querySelectorAll('[data-perfil]').forEach((b) => {
        b.addEventListener('click', () => {
          const perfil = entrarDemo(b.dataset.perfil);
          tela.hidden = true;
          tela.innerHTML = '';
          resolver(perfil);
        });
      });
      tela.querySelector('[data-perfil]')?.focus();
      return;
    }

    const form = tela.querySelector('#form-login');
    const erro = form.querySelector('.erro-login');
    const botao = form.querySelector('button[type="submit"]');
    form.querySelector('#login-nome').focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      limparErros(form);
      erro.hidden = true;
      const nome = form.nome.value.trim();
      const senha = form.senha.value;
      if (!nome) return marcarErro(form.nome, 'Informe o nome.');
      if (!senha) return marcarErro(form.senha, 'Informe a senha.');
      botao.disabled = true;
      botao.innerHTML = '<span class="spinner pequeno" aria-hidden="true"></span> Entrando…';
      try {
        const perfil = await entrarComNome(nome, senha);
        form.senha.value = '';
        tela.hidden = true;
        tela.innerHTML = '';
        resolver(perfil);
      } catch (err) {
        erro.textContent = err.message;
        erro.hidden = false;
        botao.disabled = false;
        botao.innerHTML = `${icone('cadeado')} Entrar`;
      }
    });
  });
}
