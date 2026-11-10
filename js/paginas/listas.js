// Listas do casal: listas com categorias, itens, conclusão e progresso.
import { listar, salvar, remover } from '../store/index.js';
import { icone } from '../ui/icones.js';
import { adesivo, enfeitePorTema, ADESIVOS, PACOTES } from '../ui/ilustracoes.js';
import { PERFIS } from '../auth.js';
import { temaAtual } from '../tema.js';
import { esc, toast, abrirModal, confirmar, gerarId, seloExemplo, lerFormulario, marcarErro, limparErros, normalizarTexto } from '../ui/dom.js';

const CATEGORIAS = ['Passeios', 'Filmes', 'Viagens', 'Restaurantes', 'Metas', 'Coisas para fazer juntos'];

// Estilo de cada lista (escolhido no formulário da lista)
const CORES_LISTA = {
  rosa: { nome: 'Rosa antigo', cor: '#a8506b' },
  vinho: { nome: 'Vinho', cor: '#7d2440' },
  lavanda: { nome: 'Lavanda', cor: '#6e5fa3' },
  salvia: { nome: 'Sálvia', cor: '#5d7a55' },
  mostarda: { nome: 'Mostarda', cor: '#a87a1c' },
  terracota: { nome: 'Terracota', cor: '#a8532f' },
  azul: { nome: 'Azul', cor: '#3f6893' },
  grafite: { nome: 'Grafite', cor: '#4d4852' },
};
const PAPEIS_LISTA = {
  simples: 'Simples',
  caderno: 'Caderno',
  postit: 'Post-it',
  quadriculado: 'Quadriculado',
  kraft: 'Kraft',
};
const estiloPadraoLista = () => ({ cor: temaAtual() === 'drico' ? 'vinho' : temaAtual() === 'kath' ? 'mostarda' : 'rosa', papel: 'simples', adesivo: '' });

export async function renderizar(el, ctx) {
  let listas = [];
  let filtro = 'Todas';

  el.innerHTML = '<div class="estado"><span class="spinner pequeno" aria-hidden="true"></span> Carregando listas…</div>';
  try {
    listas = await listar('listas');
  } catch (e) {
    el.innerHTML = `<div class="aviso erro" role="alert">${icone('alerta')}<p>${esc(e.message)}</p></div>`;
    return;
  }

  const progresso = (l) => {
    const total = l.itens?.length || 0;
    const feitos = (l.itens || []).filter((i) => i.feito).length;
    return { total, feitos, pct: total ? Math.round((feitos / total) * 100) : 0 };
  };

  const nome = (id) => PERFIS[id]?.nome || '';

  function htmlItem(lista, item) {
    const autoria = item.feito && item.feitoPor ? `feito por ${nome(item.feitoPor)}` : (item.por ? `por ${nome(item.por)}` : '');
    return `
      <li class="item-lista ${item.feito ? 'feito' : ''}" data-item="${esc(item.id)}">
        <label class="item-check">
          <input type="checkbox" data-alternar ${item.feito ? 'checked' : ''}>
          <span class="caixa" aria-hidden="true">${icone('check')}</span>
          <span class="item-texto">${esc(item.texto)}${autoria ? ` <span class="item-autor">${esc(autoria)}</span>` : ''}</span>
        </label>
        <button type="button" class="botao-icone" data-editar-item aria-label="Editar item: ${esc(item.texto)}">${icone('editar')}</button>
        <button type="button" class="botao-icone perigo" data-excluir-item aria-label="Excluir item: ${esc(item.texto)}">${icone('lixeira')}</button>
      </li>`;
  }

  function htmlLista(l) {
    const p = progresso(l);
    const pendentes = (l.itens || []).filter((i) => !i.feito);
    const feitos = (l.itens || []).filter((i) => i.feito);
    const idTitulo = `lista-${l.id}-titulo`;
    const estilo = { ...estiloPadraoLista(), ...(l.estilo || {}) };
    const cor = (CORES_LISTA[estilo.cor] || CORES_LISTA.rosa).cor;
    return `
      <article class="cartao lista-cartao lista-papel-${esc(estilo.papel)}" style="--lista-cor:${cor}" data-lista="${esc(l.id)}" aria-labelledby="${idTitulo}">
        ${estilo.adesivo && ADESIVOS[estilo.adesivo] ? `<span class="lista-adesivo" aria-hidden="true">${adesivo(estilo.adesivo)}</span>` : ''}
        <header class="lista-topo">
          <div class="lista-titulos">
            <span class="selo">${esc(l.categoria || 'Sem categoria')}</span> ${l.exemplo ? seloExemplo() : ''}
            <h2 id="${idTitulo}">${esc(l.titulo)}</h2>
            ${l.descricao ? `<p class="lista-desc">${esc(l.descricao)}</p>` : ''}
            ${l.criadoPor ? `<p class="lista-autor">Criada por ${esc(nome(l.criadoPor))}</p>` : ''}
          </div>
          <div class="lista-acoes">
            <button type="button" class="botao-icone" data-editar-lista aria-label="Renomear ou editar a lista ${esc(l.titulo)}" title="Editar lista">${icone('editar')}</button>
            <button type="button" class="botao-icone perigo" data-excluir-lista aria-label="Excluir a lista ${esc(l.titulo)}" title="Excluir lista">${icone('lixeira')}</button>
          </div>
        </header>
        <div class="lista-progresso">
          <div class="progresso" role="progressbar" aria-label="Progresso de ${esc(l.titulo)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.pct}"><span style="width:${p.pct}%"></span></div>
          <p class="meta">${p.total ? `${p.feitos} de ${p.total} concluídos · ${p.pct}%` : 'Nenhum item ainda'}</p>
        </div>
        ${pendentes.length ? `<ul class="itens-lista" role="list">${pendentes.map((i) => htmlItem(l, i)).join('')}</ul>` : ''}
        ${feitos.length ? `
          <details class="concluidos" ${feitos.length <= 3 ? 'open' : ''}>
            <summary>Concluídos (${feitos.length})</summary>
            <ul class="itens-lista" role="list">${feitos.map((i) => htmlItem(l, i)).join('')}</ul>
          </details>` : ''}
        <form class="adicionar-item" data-adicionar>
          <label class="sr-only" for="novo-${esc(l.id)}">Novo item em ${esc(l.titulo)}</label>
          <input class="entrada" id="novo-${esc(l.id)}" name="texto" maxlength="120" placeholder="Adicionar item…" autocomplete="off">
          <button type="submit" class="botao-icone contorno" aria-label="Adicionar item em ${esc(l.titulo)}">${icone('mais')}</button>
        </form>
      </article>`;
  }

  function categoriasExistentes() {
    const set = new Set(listas.map((l) => l.categoria).filter(Boolean));
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'));
  }

  function desenhar() {
    const cats = categoriasExistentes();
    if (filtro !== 'Todas' && !cats.includes(filtro)) filtro = 'Todas';
    const visiveis = filtro === 'Todas' ? listas : listas.filter((l) => l.categoria === filtro);
    el.innerHTML = `
      <div class="cabecalho-secao">
        <div>
          <h1 class="titulo-pagina"><span class="enfeite-titulo" aria-hidden="true">${enfeitePorTema({ neutro: 'flor', drico: 'aranha', kath: 'folhagem' })}</span>Listas</h1>
          <p>Planos, desejos e coisinhas para fazer juntos. Tudo o que um muda, o outro vê.</p>
        </div>
        <button type="button" class="botao" data-nova-lista>${icone('mais')} Nova lista</button>
      </div>
      ${cats.length > 1 ? `
        <div class="filtros" role="group" aria-label="Filtrar por categoria">
          ${['Todas', ...cats].map((c) => `<button type="button" class="botao-sec pequeno ${filtro === c ? 'ativo' : ''}" aria-pressed="${filtro === c}" data-filtro="${esc(c)}">${esc(c)}</button>`).join('')}
        </div>` : ''}
      ${visiveis.length ? `<div class="grade grade-listas">${visiveis.map(htmlLista).join('')}</div>` : `
        <div class="vazio">
          <span class="ilustracao" aria-hidden="true">${adesivo('flor')}</span>
          <h3>Nenhuma lista por aqui</h3>
          <p>Crie uma lista de passeios, filmes, viagens, restaurantes, metas… ou o que vocês quiserem.</p>
          <button type="button" class="botao" data-nova-lista>${icone('mais')} Criar lista</button>
        </div>`}`;
  }

  /** Redesenha só o cartão de uma lista e devolve o foco para onde faz sentido. */
  function redesenharLista(id, focoSeletor) {
    const atual = el.querySelector(`[data-lista="${CSS.escape(id)}"]`);
    const lista = listas.find((l) => l.id === id);
    if (!atual || !lista) return desenhar();
    const tmp = document.createElement('div');
    tmp.innerHTML = htmlLista(lista);
    const novo = tmp.firstElementChild;
    atual.replaceWith(novo);
    if (focoSeletor) novo.querySelector(focoSeletor)?.focus();
  }

  async function persistir(lista) {
    try {
      const salvo = await salvar('listas', { ...lista, exemplo: lista.exemplo });
      const i = listas.findIndex((l) => l.id === lista.id);
      if (i >= 0) listas[i] = { ...salvo, itens: salvo.itens || [] };
      return true;
    } catch (e) {
      toast(e.message, 'erro');
      return false;
    }
  }

  function formularioLista(lista = null) {
    const categoriaPersonalizada = lista && lista.categoria && !CATEGORIAS.includes(lista.categoria);
    const estiloAtual = { ...estiloPadraoLista(), ...(lista?.estilo || {}) };
    const { el: modal, fechar } = abrirModal({
      titulo: lista ? 'Editar lista' : 'Nova lista',
      corpo: `
        <form class="formulario" id="form-lista" novalidate>
          <div class="campo">
            <label for="lista-titulo">Título <span aria-hidden="true">*</span></label>
            <input id="lista-titulo" name="titulo" maxlength="60" required value="${esc(lista?.titulo || '')}" placeholder="Ex.: Restaurantes para conhecer">
          </div>
          <div class="campo">
            <label for="lista-desc">Descrição <span class="dica">(opcional)</span></label>
            <input id="lista-desc" name="descricao" maxlength="140" value="${esc(lista?.descricao || '')}">
          </div>
          <div class="campo">
            <label for="lista-cat">Categoria</label>
            <select id="lista-cat" name="categoria">
              ${CATEGORIAS.map((c) => `<option ${lista?.categoria === c ? 'selected' : ''}>${c}</option>`).join('')}
              <option value="__personalizada" ${categoriaPersonalizada ? 'selected' : ''}>Outra (personalizada)…</option>
            </select>
          </div>
          <div class="campo" data-campo-personalizada ${categoriaPersonalizada ? '' : 'hidden'}>
            <label for="lista-cat-livre">Nome da categoria</label>
            <input id="lista-cat-livre" name="categoriaLivre" maxlength="30" value="${categoriaPersonalizada ? esc(lista.categoria) : ''}">
          </div>
          <fieldset>
            <legend>Cor</legend>
            <div class="opcoes cores">
              ${Object.entries(CORES_LISTA).map(([id, c]) => `
                <label class="opcao cor" title="${c.nome}"><input type="radio" name="cor" value="${id}" ${estiloAtual.cor === id ? 'checked' : ''} aria-label="${c.nome}"><span style="--c:${c.cor}"></span></label>`).join('')}
            </div>
          </fieldset>
          <fieldset>
            <legend>Papel</legend>
            <div class="opcoes">
              ${Object.entries(PAPEIS_LISTA).map(([id, n]) => `
                <label class="opcao"><input type="radio" name="papel" value="${id}" ${estiloAtual.papel === id ? 'checked' : ''}><span><i class="amostra-lista lista-papel-${id}" aria-hidden="true"></i>${n}</span></label>`).join('')}
            </div>
          </fieldset>
          <fieldset>
            <legend>Adesivo</legend>
            <div class="enfeites">
              <label class="enfeite-opcao" title="Sem adesivo"><input type="radio" name="adesivo" value="" ${!estiloAtual.adesivo ? 'checked' : ''}><span class="sem-adesivo">${icone('fechar')}<span class="sr-only">Sem adesivo</span></span></label>
              ${[temaAtual(), ...Object.keys(PACOTES).filter((x) => x !== temaAtual())].flatMap((pk) => PACOTES[pk].itens).map((id) => `
                <label class="enfeite-opcao" title="${ADESIVOS[id].nome}"><input type="radio" name="adesivo" value="${id}" ${estiloAtual.adesivo === id ? 'checked' : ''}><span>${adesivo(id)}<span class="sr-only">${ADESIVOS[id].nome}</span></span></label>`).join('')}
            </div>
          </fieldset>
        </form>`,
      rodape: `<button type="button" class="botao-fantasma" data-fechar>Cancelar</button>
               <button type="submit" form="form-lista" class="botao">${icone('salvar')} ${lista ? 'Salvar' : 'Criar lista'}</button>`,
    });
    const form = modal.querySelector('#form-lista');
    const select = form.elements.categoria;
    const campoLivre = form.querySelector('[data-campo-personalizada]');
    select.addEventListener('change', () => {
      campoLivre.hidden = select.value !== '__personalizada';
      if (!campoLivre.hidden) form.elements.categoriaLivre.focus();
    });
    form.elements.titulo.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      limparErros(form);
      const d = lerFormulario(form);
      if (!d.titulo) return marcarErro(form.elements.titulo, 'Dê um nome para a lista.');
      let categoria = d.categoria;
      if (categoria === '__personalizada') {
        if (!d.categoriaLivre) return marcarErro(form.elements.categoriaLivre, 'Escreva o nome da categoria.');
        categoria = d.categoriaLivre;
      }
      const estilo = { cor: d.cor || estiloAtual.cor, papel: d.papel || 'simples', adesivo: d.adesivo || '' };
      const doc = lista
        ? { ...lista, titulo: d.titulo, descricao: d.descricao, categoria, estilo, exemplo: false }
        : { titulo: d.titulo, descricao: d.descricao, categoria, estilo, itens: [], criadoPor: ctx.perfil.id };
      try {
        const salvo = await salvar('listas', doc);
        if (lista) listas = listas.map((l) => (l.id === salvo.id ? salvo : l));
        else listas.unshift(salvo);
        fechar();
        toast(lista ? 'Lista atualizada.' : 'Lista criada!', 'sucesso');
        if (!lista) filtro = 'Todas';
        desenhar();
        el.querySelector(`[data-lista="${CSS.escape(salvo.id)}"] ${lista ? '[data-editar-lista]' : 'input[name="texto"]'}`)?.focus();
      } catch (err) {
        toast(err.message, 'erro');
      }
    });
  }

  function editarItemInline(listaId, itemId) {
    const lista = listas.find((l) => l.id === listaId);
    const item = lista?.itens.find((i) => i.id === itemId);
    const li = el.querySelector(`[data-lista="${CSS.escape(listaId)}"] [data-item="${CSS.escape(itemId)}"]`);
    if (!item || !li) return;
    li.classList.add('editando');
    li.innerHTML = `
      <form class="editar-item">
        <label class="sr-only" for="editar-${esc(itemId)}">Editar item</label>
        <input class="entrada" id="editar-${esc(itemId)}" name="texto" maxlength="120" value="${esc(item.texto)}">
        <button type="submit" class="botao-icone contorno" aria-label="Salvar item">${icone('check')}</button>
        <button type="button" class="botao-icone" data-cancelar aria-label="Cancelar edição">${icone('fechar')}</button>
      </form>`;
    const input = li.querySelector('input');
    input.focus();
    input.select();
    let terminou = false;
    const concluir = async (salvarTexto) => {
      if (terminou) return;
      terminou = true;
      const texto = input.value.trim();
      if (salvarTexto && texto && texto !== item.texto) {
        item.texto = texto;
        lista.exemplo = false;
        await persistir(lista);
      }
      redesenharLista(listaId, `[data-item="${CSS.escape(itemId)}"] [data-editar-item]`);
    };
    li.querySelector('form').addEventListener('submit', (e) => { e.preventDefault(); concluir(true); });
    li.querySelector('[data-cancelar]').addEventListener('click', () => concluir(false));
    input.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); concluir(false); } });
  }

  // ---------------- Eventos ----------------
  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    const cartao = b.closest('[data-lista]');
    const lista = cartao && listas.find((l) => l.id === cartao.dataset.lista);

    if (b.hasAttribute('data-nova-lista')) return formularioLista();
    if (b.dataset.filtro) { filtro = b.dataset.filtro; desenhar(); el.querySelector(`[data-filtro="${CSS.escape(filtro)}"]`)?.focus(); return; }
    if (!lista) return;

    if (b.hasAttribute('data-editar-lista')) return formularioLista(lista);
    if (b.hasAttribute('data-excluir-lista')) {
      const ok = await confirmar({ titulo: 'Excluir lista?', mensagem: `A lista "${lista.titulo}" e todos os ${lista.itens?.length || 0} itens serão excluídos.` });
      if (!ok) return;
      try {
        await remover('listas', lista.id);
        listas = listas.filter((l) => l.id !== lista.id);
        toast('Lista excluída.', 'sucesso');
        desenhar();
        el.querySelector('h1')?.focus();
      } catch (err) { toast(err.message, 'erro'); }
      return;
    }

    const li = b.closest('[data-item]');
    if (!li) return;
    const itemId = li.dataset.item;
    if (b.hasAttribute('data-editar-item')) return editarItemInline(lista.id, itemId);
    if (b.hasAttribute('data-excluir-item')) {
      const indice = lista.itens.findIndex((i) => i.id === itemId);
      const [removido] = lista.itens.splice(indice, 1);
      lista.exemplo = false;
      if (!(await persistir(lista))) { lista.itens.splice(indice, 0, removido); return; }
      redesenharLista(lista.id, 'input[name="texto"]');
      toast(`"${removido.texto}" foi removido.`, 'info', {
        acao: {
          texto: 'Desfazer',
          executar: async () => {
            const l = listas.find((x) => x.id === lista.id);
            if (!l) return;
            l.itens.splice(Math.min(indice, l.itens.length), 0, removido);
            if (await persistir(l)) redesenharLista(l.id);
          },
        },
      });
    }
  });

  el.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-alternar]')) return;
    const cartao = e.target.closest('[data-lista]');
    const lista = listas.find((l) => l.id === cartao.dataset.lista);
    const itemId = e.target.closest('[data-item]').dataset.item;
    const item = lista?.itens.find((i) => i.id === itemId);
    if (!item) return;
    item.feito = e.target.checked;
    item.concluidoEm = item.feito ? new Date().toISOString() : null;
    item.feitoPor = item.feito ? ctx.perfil.id : null;
    if (await persistir(lista)) {
      redesenharLista(lista.id, `[data-item="${CSS.escape(itemId)}"] [data-alternar]`);
      const p = progresso(lista);
      if (item.feito && p.total && p.feitos === p.total) toast(`Lista "${lista.titulo}" completa!`, 'sucesso');
    } else {
      item.feito = !item.feito;
      e.target.checked = item.feito;
    }
  });

  el.addEventListener('submit', async (e) => {
    if (!e.target.matches('[data-adicionar]')) return;
    e.preventDefault();
    const form = e.target;
    const lista = listas.find((l) => l.id === form.closest('[data-lista]').dataset.lista);
    const texto = form.elements.texto.value.trim();
    if (!lista) return;
    if (!texto) { form.elements.texto.focus(); return; }
    if (lista.itens.some((i) => normalizarTexto(i.texto) === normalizarTexto(texto))) {
      toast('Esse item já está na lista.', 'info');
      return;
    }
    lista.itens.push({ id: gerarId(), texto, feito: false, por: ctx.perfil.id });
    if (await persistir(lista)) redesenharLista(lista.id, 'input[name="texto"]');
    else lista.itens.pop();
  });

  desenhar();
}
