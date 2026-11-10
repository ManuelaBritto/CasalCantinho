// Memórias: galeria de fotos com legenda, data e visualização ampliada.
import { listar, salvar, remover, enviarImagem } from '../store/index.js';
import { icone } from '../ui/icones.js';
import { adesivo, enfeite } from '../ui/ilustracoes.js';
import { esc, toast, abrirModal, confirmar, formatarData, seloExemplo, marcarErro, limparErros } from '../ui/dom.js';

export async function renderizar(el, ctx) {
  let memorias = [];

  el.innerHTML = '<div class="estado"><span class="spinner pequeno" aria-hidden="true"></span> Carregando memórias…</div>';
  try {
    memorias = await listar('memorias');
  } catch (e) {
    el.innerHTML = `<div class="aviso erro" role="alert">${icone('alerta')}<p>${esc(e.message)}</p></div>`;
    return;
  }

  const ordenar = () => memorias.sort((a, b) => String(b.data || b.criadoEm || '').localeCompare(String(a.data || a.criadoEm || '')));

  function desenhar() {
    ordenar();
    el.innerHTML = `
      <div class="cabecalho-secao">
        <div>
          <h1 class="titulo-pagina"><span class="enfeite-titulo" aria-hidden="true">${enfeite('memorias')}</span>Memórias</h1>
          <p>Fotos e momentos para guardar com carinho.</p>
        </div>
        <button type="button" class="botao" data-nova>${icone('upload')} Adicionar memória</button>
      </div>
      ${ctx.armazenamento.tipo === 'local' ? `<div class="aviso aviso-compacto">${icone('info')}<p>No modo demonstração as fotos ficam só neste navegador (com tamanho reduzido). O espaço é limitado: algumas dezenas de fotos.</p></div>` : ''}
      ${memorias.length ? `
        <ul class="galeria" role="list">
          ${memorias.map((m, i) => `
            <li class="memoria" data-memoria="${esc(m.id)}" style="--giro:${((i % 5) - 2) * 1.2}deg">
              <figure>
                <button type="button" class="memoria-foto" data-ampliar aria-label="Ampliar: ${esc(m.legenda || 'memória sem legenda')}">
                  ${m.src ? `<img src="${esc(m.src)}" alt="${esc(m.legenda || 'Memória')}" loading="lazy" data-foto>` : `<span class="foto-indisponivel">${icone('imagem')} Imagem indisponível</span>`}
                </button>
                <figcaption>
                  <span class="memoria-legenda">${esc(m.legenda || 'Sem legenda')}</span>
                  <span class="memoria-meta">${m.data ? esc(formatarData(m.data)) : ''} ${m.exemplo ? seloExemplo() : ''}</span>
                </figcaption>
              </figure>
              <div class="memoria-acoes">
                <button type="button" class="botao-icone" data-editar aria-label="Editar memória: ${esc(m.legenda || '')}" title="Editar">${icone('editar')}</button>
                <button type="button" class="botao-icone perigo" data-excluir aria-label="Excluir memória: ${esc(m.legenda || '')}" title="Excluir">${icone('lixeira')}</button>
              </div>
            </li>`).join('')}
        </ul>` : `
        <div class="vazio">
          <span class="ilustracao" aria-hidden="true">${adesivo('polaroid')}</span>
          <h3>Nenhuma memória guardada</h3>
          <p>Adicione a primeira foto de vocês, com uma legenda e a data do momento.</p>
          <button type="button" class="botao" data-nova>${icone('upload')} Adicionar memória</button>
        </div>`}`;
  }

  function ampliar(id) {
    let indice = memorias.findIndex((m) => m.id === id);
    if (indice < 0) return;
    const { el: modal } = abrirModal({
      rotulo: 'Visualização da memória',
      tamanho: 'largo visualizador',
      corpo: `
        <div class="visualizador-topo"><button type="button" class="botao-icone contorno" data-fechar aria-label="Fechar">${icone('fechar')}</button></div>
        <figure class="visualizador-figura">
          <div class="visualizador-imagem"></div>
          <figcaption class="visualizador-legenda" aria-live="polite"></figcaption>
        </figure>
        <div class="visualizador-nav">
          <button type="button" class="botao-icone contorno" data-anterior aria-label="Memória anterior">${icone('esquerda')}</button>
          <span class="visualizador-pos"></span>
          <button type="button" class="botao-icone contorno" data-proxima aria-label="Próxima memória">${icone('direita')}</button>
        </div>`,
    });
    const mostrar = () => {
      const m = memorias[indice];
      modal.querySelector('.visualizador-imagem').innerHTML = m.src
        ? `<img src="${esc(m.src)}" alt="${esc(m.legenda || 'Memória')}">`
        : `<span class="foto-indisponivel">${icone('imagem')} Imagem indisponível</span>`;
      modal.querySelector('.visualizador-legenda').innerHTML = `
        <strong>${esc(m.legenda || 'Sem legenda')}</strong>
        ${m.data ? `<span>${esc(formatarData(m.data, { day: 'numeric', month: 'long', year: 'numeric' }))}</span>` : ''}
        ${m.exemplo ? seloExemplo() : ''}`;
      modal.querySelector('.visualizador-pos').textContent = `${indice + 1} de ${memorias.length}`;
      const sozinha = memorias.length < 2;
      modal.querySelector('[data-anterior]').disabled = sozinha;
      modal.querySelector('[data-proxima]').disabled = sozinha;
    };
    const passo = (d) => { indice = (indice + d + memorias.length) % memorias.length; mostrar(); };
    modal.querySelector('[data-anterior]').addEventListener('click', () => passo(-1));
    modal.querySelector('[data-proxima]').addEventListener('click', () => passo(1));
    modal.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowLeft') passo(-1);
      if (e.key === 'ArrowRight') passo(1);
    });
    mostrar();
  }

  function formulario(memoria = null) {
    let novaImagem = null; // { src, path? }
    const { el: modal, fechar } = abrirModal({
      titulo: memoria ? 'Editar memória' : 'Nova memória',
      corpo: `
        <form class="formulario" id="form-memoria" novalidate>
          <div class="previa-memoria" id="previa-memoria">
            ${memoria?.src ? `<img src="${esc(memoria.src)}" alt="Prévia da imagem">` : `<span>${icone('imagem')} A prévia da foto aparece aqui</span>`}
          </div>
          <div class="campo">
            <label for="mem-arquivo">${memoria ? 'Trocar foto' : 'Foto'} <span class="dica">(JPG, PNG, WEBP)</span></label>
            <input id="mem-arquivo" name="arquivo" type="file" accept="image/*" class="entrada">
          </div>
          <div class="campo">
            <label for="mem-url">ou endereço (URL) de uma imagem</label>
            <input id="mem-url" name="url" type="url" placeholder="https://…" value="${memoria && !memoria.imagemPath && /^https?:/.test(memoria.src || '') ? esc(memoria.src) : ''}">
          </div>
          <div class="campo">
            <label for="mem-legenda">Legenda</label>
            <input id="mem-legenda" name="legenda" maxlength="140" value="${esc(memoria?.legenda || '')}" placeholder="O que aconteceu nesse dia?">
          </div>
          <div class="campo">
            <label for="mem-data">Data <span class="dica">(opcional)</span></label>
            <input id="mem-data" name="data" type="date" value="${esc(memoria?.data || '')}">
          </div>
        </form>`,
      rodape: `<button type="button" class="botao-fantasma" data-fechar>Cancelar</button>
               <button type="submit" form="form-memoria" class="botao">${icone('salvar')} Salvar</button>`,
    });
    const form = modal.querySelector('#form-memoria');
    const previa = modal.querySelector('#previa-memoria');
    const botao = modal.querySelector('button[type="submit"]');

    form.elements.arquivo.addEventListener('change', async () => {
      const arquivo = form.elements.arquivo.files[0];
      if (!arquivo) return;
      limparErros(form);
      previa.innerHTML = '<span><span class="spinner pequeno" aria-hidden="true"></span> Preparando a imagem…</span>';
      botao.disabled = true;
      try {
        novaImagem = await enviarImagem(arquivo);
        previa.innerHTML = `<img src="${esc(novaImagem.src)}" alt="Prévia da imagem escolhida">`;
        form.elements.url.value = '';
      } catch (e) {
        novaImagem = null;
        previa.innerHTML = `<span>${icone('imagem')} A prévia da foto aparece aqui</span>`;
        marcarErro(form.elements.arquivo, e.message);
      } finally {
        botao.disabled = false;
      }
    });
    form.elements.url.addEventListener('change', () => {
      const url = form.elements.url.value.trim();
      if (/^https?:\/\//i.test(url)) {
        novaImagem = null;
        previa.innerHTML = `<img src="${esc(url)}" alt="Prévia da imagem da URL" referrerpolicy="no-referrer">`;
      }
    });

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      limparErros(form);
      const url = form.elements.url.value.trim();
      if (url && !/^https?:\/\//i.test(url)) return marcarErro(form.elements.url, 'Use um endereço que comece com http:// ou https://');
      let imagem = null;
      if (novaImagem) imagem = { src: novaImagem.src, imagemPath: novaImagem.path || null };
      else if (url) imagem = { src: url, imagemPath: null };
      if (!imagem && !memoria) return marcarErro(form.elements.arquivo, 'Escolha uma foto ou informe a URL de uma imagem.');

      const doc = {
        ...(memoria || {}),
        ...(imagem || {}),
        legenda: form.elements.legenda.value.trim(),
        data: form.elements.data.value,
        exemplo: imagem ? false : Boolean(memoria?.exemplo),
      };
      if (!doc.imagemPath) delete doc.imagemPath;
      botao.disabled = true;
      try {
        const salvo = await salvar('memorias', doc);
        const i = memorias.findIndex((m) => m.id === salvo.id);
        if (i >= 0) memorias[i] = salvo; else memorias.unshift(salvo);
        fechar();
        toast(memoria ? 'Memória atualizada.' : 'Memória guardada!', 'sucesso');
        desenhar();
        el.querySelector(`[data-memoria="${CSS.escape(salvo.id)}"] [data-ampliar]`)?.focus();
      } catch (err) {
        toast(err.message, 'erro');
        botao.disabled = false;
      }
    });
  }

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-nova')) return formulario();
    const item = b.closest('[data-memoria]');
    const m = item && memorias.find((x) => x.id === item.dataset.memoria);
    if (!m) return;
    if (b.hasAttribute('data-ampliar')) ampliar(m.id);
    else if (b.hasAttribute('data-editar')) formulario(m);
    else if (b.hasAttribute('data-excluir')) {
      const ok = await confirmar({ titulo: 'Excluir memória?', mensagem: `A memória "${m.legenda || 'sem legenda'}" será excluída.` });
      if (!ok) return;
      try {
        await remover('memorias', m.id);
        memorias = memorias.filter((x) => x.id !== m.id);
        toast('Memória excluída.', 'sucesso');
        desenhar();
        el.querySelector('h1')?.focus();
      } catch (err) { toast(err.message, 'erro'); }
    }
  });

  el.addEventListener('error', (e) => {
    const img = e.target;
    if (img instanceof HTMLImageElement && img.hasAttribute('data-foto')) {
      img.replaceWith(Object.assign(document.createElement('span'), { className: 'foto-indisponivel', textContent: 'Imagem indisponível' }));
    }
  }, true);

  desenhar();
}
