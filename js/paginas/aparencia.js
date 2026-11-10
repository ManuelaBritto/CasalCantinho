// Aparência: seletor de temas com prévia e preferências visuais.
import { icone } from '../ui/icones.js';
import { adesivo } from '../ui/ilustracoes.js';
import { esc, toast, confirmar } from '../ui/dom.js';
import { TEMAS, temaAtual, aplicarTema, lerPreferencias, salvarPreferencias } from '../tema.js';
import { salvarTemaRemoto } from '../auth.js';
import { storeAtual } from '../store/index.js';
import { montarPainelNotificacoes } from '../painel-notificacoes.js';

const PREVIA = {
  neutro: ['coracao', 'flor', 'brilho'],
  drico: ['morcego', 'lua', 'rosa'],
  kath: ['girassol', 'raposa', 'folhagem'],
};

export async function renderizar(el, ctx) {
  const perfil = ctx.perfil;
  const prefs = lerPreferencias(perfil.id);
  const store = storeAtual();

  const opcao = (nome, valor, rotulo, atual) =>
    `<label class="opcao"><input type="radio" name="${nome}" value="${valor}" ${atual === valor ? 'checked' : ''}><span>${rotulo}</span></label>`;

  el.innerHTML = `
    <div class="cabecalho-secao">
      <div>
        <h1 class="titulo-pagina">Aparência</h1>
        <p>Escolha o clima do cantinho. A troca é imediata e fica salva para o perfil ${esc(perfil.nome)}.</p>
      </div>
    </div>

    <section aria-labelledby="titulo-temas">
      <h2 id="titulo-temas">Tema</h2>
      <fieldset class="temas-grade">
        <legend class="sr-only">Escolha um tema</legend>
        ${Object.entries(TEMAS).map(([id, t]) => `
          <label class="tema-cartao tema-previa-${id}">
            <input type="radio" name="tema-aparencia" value="${id}" ${temaAtual() === id ? 'checked' : ''}>
            <span class="tema-cartao-corpo">
              <span class="tema-amostra" aria-hidden="true">
                ${PREVIA[id].map((a) => `<span>${adesivo(a)}</span>`).join('')}
              </span>
              <span class="tema-nome">${t.nome} <span class="tema-marcado">${icone('check')} Ativo</span></span>
              <span class="tema-desc">${t.descricao}</span>
              <span class="tema-cores" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
            </span>
          </label>`).join('')}
      </fieldset>
    </section>

    <section class="cartao formulario" aria-labelledby="titulo-prefs">
      <h2 id="titulo-prefs">Preferências visuais</h2>
      <fieldset>
        <legend>Ao entrar na conta, usar</legend>
        <div class="opcoes">
          ${opcao('aoEntrar', 'perfil', `O tema do perfil (${perfil.temaPadrao === 'kath' ? 'Kath' : 'Drico'})`, prefs.aoEntrar)}
          ${opcao('aoEntrar', 'ultimo', 'O último tema que escolhi', prefs.aoEntrar)}
        </div>
      </fieldset>
      <fieldset>
        <legend>Animações</legend>
        <div class="opcoes">
          ${opcao('movimento', 'sistema', 'Seguir o sistema', prefs.movimento)}
          ${opcao('movimento', 'reduzir', 'Reduzir movimento', prefs.movimento)}
        </div>
      </fieldset>
      <fieldset>
        <legend>Decoração de fundo</legend>
        <div class="opcoes">
          ${opcao('decoracao', 'normal', 'Normal', prefs.decoracao)}
          ${opcao('decoracao', 'discreta', 'Discreta', prefs.decoracao)}
        </div>
      </fieldset>
      <fieldset>
        <legend>Tamanho do texto</legend>
        <div class="opcoes">
          ${opcao('texto', 'padrao', 'Padrão', prefs.texto)}
          ${opcao('texto', 'maior', 'Maior', prefs.texto)}
        </div>
      </fieldset>
    </section>

    <section class="cartao" aria-labelledby="titulo-notificacoes" id="notificacoes">
      <h2 id="titulo-notificacoes">Notificações e app no celular</h2>
      <div data-painel-notificacoes></div>
    </section>

    <section class="cartao" aria-labelledby="titulo-dados">
      <h2 id="titulo-dados">Conta e dados</h2>
      <p><strong>Perfil:</strong> ${esc(perfil.nome)} · <strong>Modo:</strong> ${ctx.modo === 'demo' ? 'demonstração (sem autenticação real)' : 'Supabase (login real)'}</p>
      <div class="aviso">${icone('info')}<p>${esc(store.descricao)}</p></div>
      ${store.tipo === 'local' ? `
        <div class="grupo-botoes acoes-dados">
          <button type="button" class="botao-sec" data-restaurar>${icone('restaurar')} Restaurar conteúdo de exemplo</button>
          <button type="button" class="botao-perigo" data-apagar>${icone('lixeira')} Apagar todos os dados deste navegador</button>
        </div>` : ''}
    </section>`;

  el.addEventListener('change', (e) => {
    const alvo = e.target;
    if (alvo.name === 'tema-aparencia') {
      aplicarTema(alvo.value, { perfil: perfil.id });
      salvarTemaRemoto(perfil, alvo.value);
      return;
    }
    if (['aoEntrar', 'movimento', 'decoracao', 'texto'].includes(alvo.name)) {
      salvarPreferencias(perfil.id, { [alvo.name]: alvo.value });
      toast('Preferência salva.', 'sucesso', { duracao: 1800 });
    }
  });

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-restaurar')) {
      const ok = await confirmar({ titulo: 'Restaurar exemplos?', mensagem: 'Tudo o que foi salvo neste navegador será substituído pelo conteúdo de exemplo.', textoConfirmar: 'Restaurar' });
      if (!ok) return;
      await store.restaurarExemplos();
      toast('Conteúdo de exemplo restaurado.', 'sucesso');
      ctx.irPara('inicio');
    }
    if (b.hasAttribute('data-apagar')) {
      const ok = await confirmar({ titulo: 'Apagar todos os dados?', mensagem: 'Cartinhas, listas, filmes, vídeos, memórias e ajustes deste navegador serão apagados. Isso não pode ser desfeito.', textoConfirmar: 'Apagar tudo' });
      if (!ok) return;
      await store.apagarTudo();
      localStorage.setItem('nc:v1:semeado', '1'); // não recriar os exemplos automaticamente
      toast('Dados apagados.', 'sucesso');
      ctx.irPara('inicio');
    }
  });

  return montarPainelNotificacoes(el.querySelector('[data-painel-notificacoes]'), perfil);
}
