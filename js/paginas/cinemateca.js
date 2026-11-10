// Cinemateca: coleção de filmes + pesquisa no TMDB (via proxy) + cadastro manual.
import { listar, salvar, remover } from '../store/index.js';
import { config } from '../config.js';
import { icone } from '../ui/icones.js';
import { adesivo, enfeite, posterVazio } from '../ui/ilustracoes.js';
import { esc, toast, abrirModal, confirmar, seloExemplo, lerFormulario, marcarErro, limparErros, normalizarTexto } from '../ui/dom.js';

const STATUS = {
  quero: 'Queremos assistir',
  assistindo: 'Assistindo',
  assistido: 'Assistidos',
};
const STATUS_SINGULAR = { quero: 'Queremos assistir', assistindo: 'Assistindo', assistido: 'Assistido' };

const urlPoster = (caminho, tamanho = 'w342') => (caminho ? `${config.tmdbImagens}${tamanho}${caminho}` : '');

export async function renderizar(el, ctx) {
  let filmes = [];
  let aba = 'quero';
  let resultados = null; // null = sem pesquisa; [] = nenhum resultado
  let estadoBusca = 'parado'; // parado | carregando | erro | ok
  let erroBusca = '';
  let ultimaBusca = '';
  let controle = null;
  // Busca enquanto digita (AJAX): espera uma pausa curta, cancela a anterior e guarda o que já veio
  const ESPERA_DIGITACAO = 400;
  const MIN_LETRAS = 2;
  let timerDigitacao = null;
  const cacheBusca = new Map(); // termo normalizado → resultados

  el.innerHTML = '<div class="estado"><span class="spinner pequeno" aria-hidden="true"></span> Carregando filmes…</div>';
  try {
    filmes = await listar('filmes');
  } catch (e) {
    el.innerHTML = `<div class="aviso erro" role="alert">${icone('alerta')}<p>${esc(e.message)}</p></div>`;
    return;
  }

  const chaveDuplicata = (titulo, ano) => `${normalizarTexto(titulo)}|${String(ano || '').slice(0, 4)}`;
  function jaNaColecao({ tmdbId, titulo, ano }) {
    return filmes.find((f) => (tmdbId && f.tmdbId === tmdbId) || chaveDuplicata(f.titulo, f.ano) === chaveDuplicata(titulo, ano));
  }

  function htmlPoster(f, classe = '') {
    return f.poster
      ? `<img class="poster ${classe}" src="${esc(f.poster)}" alt="Pôster de ${esc(f.titulo)}" loading="lazy" referrerpolicy="no-referrer" data-poster>`
      : `<div class="poster ${classe}">${posterVazio(f.titulo)}</div>`;
  }

  // ---------------- Pesquisa ----------------
  function htmlPesquisa() {
    if (!config.tmdbProxy) {
      return `
        <div class="aviso" id="aviso-tmdb">
          ${icone('info')}
          <div>
            <p><strong>Pesquisa no TMDB ainda não configurada.</strong> Por enquanto, adicione filmes manualmente.</p>
            <p>Para ativar: copie <code>.env.example</code> para <code>.env</code>, preencha <code>TMDB_READ_TOKEN</code> (ou <code>TMDB_API_KEY</code>) e rode <code>npm start</code>. A chave fica só no servidor local.</p>
          </div>
        </div>`;
    }
    return `
      <form class="busca-filme" data-buscar role="search">
        <label class="sr-only" for="busca-tmdb">Nome do filme</label>
        <div class="entrada-com-botao">
          <input class="entrada" id="busca-tmdb" name="q" type="search" placeholder="Comece a digitar o nome do filme…" value="${esc(ultimaBusca)}" autocomplete="off" maxlength="120" aria-describedby="dica-busca-tmdb">
          <button type="submit" class="botao">${icone('busca')} Buscar</button>
        </div>
        <p class="dica" id="dica-busca-tmdb">Os filmes aparecem enquanto você digita.</p>
      </form>
      <div class="area-resultados" aria-live="polite">${htmlResultados()}</div>`;
  }

  function htmlResultados() {
    let corpo = '';
    const lista = resultados?.length ? htmlListaResultados() : '';
    if (estadoBusca === 'carregando') corpo = `<div class="estado busca-carregando" role="status"><span class="spinner pequeno" aria-hidden="true"></span> Buscando "${esc(ultimaBusca)}" no TMDB…</div>${lista}`;
    else if (estadoBusca === 'erro') corpo = `<div class="aviso erro" role="alert">${icone('alerta')}<div><p><strong>A pesquisa falhou.</strong> ${esc(erroBusca)}</p><p>Você ainda pode adicionar o filme manualmente.</p></div></div>`;
    else if (resultados && !resultados.length) corpo = `<div class="aviso" role="status">${icone('info')}<p>Nenhum filme encontrado para "<strong>${esc(ultimaBusca)}</strong>". Confira a grafia ou adicione manualmente.</p></div>`;
    else if (resultados?.length) {
      corpo = `<p class="sr-only" role="status">${resultados.length} resultados para ${esc(ultimaBusca)}</p>${lista}`;
    }
    return corpo;
  }

  function htmlListaResultados() {
    return `
        <ul class="resultados-tmdb" role="list">
          ${resultados.map((r, i) => {
            const existente = jaNaColecao(r);
            return `
              <li class="resultado">
                ${htmlPoster(r, 'pequeno')}
                <div class="resultado-info">
                  <h3>${esc(r.titulo)}</h3>
                  <p class="meta">${r.ano ? esc(r.ano) : 'Ano desconhecido'}</p>
                </div>
                ${existente
                  ? `<span class="selo">${icone('check')} Na coleção</span>`
                  : `<button type="button" class="botao-sec pequeno" data-adicionar-resultado="${i}" aria-label="Adicionar ${esc(r.titulo)} à coleção">${icone('mais')} Adicionar</button>`}
              </li>`;
          }).join('')}
        </ul>
        <p class="credito-tmdb">Dados e pôsteres: The Movie Database (TMDB). Este produto usa a API do TMDB, mas não é endossado nem certificado pelo TMDB.</p>`;
  }

  async function buscar(termo) {
    termo = termo.trim().replace(/\s+/g, ' ');
    if (!termo) return;
    clearTimeout(timerDigitacao);
    controle?.abort();
    ultimaBusca = termo;
    const chave = normalizarTexto(termo);
    if (cacheBusca.has(chave)) { // já buscado: mostra na hora, sem ir ao servidor
      resultados = cacheBusca.get(chave);
      estadoBusca = 'ok';
      desenharPesquisa();
      return;
    }
    controle = new AbortController();
    estadoBusca = 'carregando';
    desenharPesquisa();
    try {
      const resp = await fetch(`${config.tmdbProxyUrl}?query=${encodeURIComponent(termo)}`, { signal: controle.signal, headers: { Accept: 'application/json' } });
      let dados = null;
      try { dados = await resp.json(); } catch { dados = null; }
      if (!resp.ok) throw new Error(dados?.erro || `Erro ${resp.status} no servidor.`);
      resultados = (dados?.results || []).slice(0, 12).map((r) => ({
        tmdbId: r.id,
        titulo: r.title || r.original_title || 'Sem título',
        ano: (r.release_date || '').slice(0, 4),
        poster: urlPoster(r.poster_path),
        sinopse: r.overview || '',
      }));
      cacheBusca.set(chave, resultados);
      if (cacheBusca.size > 40) cacheBusca.delete(cacheBusca.keys().next().value);
      estadoBusca = 'ok';
    } catch (e) {
      if (e.name === 'AbortError') return;
      estadoBusca = 'erro';
      erroBusca = e.message === 'Failed to fetch' ? 'Sem conexão com o servidor local.' : e.message;
      resultados = null;
    }
    desenharPesquisa();
  }

  function desenharPesquisa() {
    // Com o formulário na tela, troca só os resultados: o campo (e o cursor) fica como está
    const resultadosEl = el.querySelector('#secao-pesquisa-corpo .area-resultados');
    if (resultadosEl) { resultadosEl.innerHTML = htmlResultados(); return; }
    const area = el.querySelector('#secao-pesquisa-corpo');
    if (!area) return;
    const tinhaFoco = document.activeElement?.id === 'busca-tmdb';
    area.innerHTML = htmlPesquisa();
    if (tinhaFoco) area.querySelector('#busca-tmdb')?.focus();
  }

  // ---------------- Coleção ----------------
  function htmlColecao() {
    const lista = filmes.filter((f) => (f.status || 'quero') === aba);
    return `
      <div class="abas" role="tablist" aria-label="Status dos filmes">
        ${Object.entries(STATUS).map(([id, nome]) => `
          <button type="button" class="aba" role="tab" id="aba-${id}" aria-controls="painel-filmes" aria-selected="${aba === id}" tabindex="${aba === id ? 0 : -1}" data-aba="${id}">
            ${nome} <span class="contador">${filmes.filter((f) => (f.status || 'quero') === id).length}</span>
          </button>`).join('')}
      </div>
      <div id="painel-filmes" role="tabpanel" aria-labelledby="aba-${aba}">
        ${lista.length ? `
          <ul class="grade estreita grade-filmes" role="list">
            ${lista.map((f) => `
              <li class="filme-cartao" data-filme="${esc(f.id)}">
                <button type="button" class="filme-capa" data-detalhes aria-label="Ver detalhes de ${esc(f.titulo)}">${htmlPoster(f)}</button>
                <div class="filme-info">
                  <h3>${esc(f.titulo)}</h3>
                  <p class="meta">${f.ano ? esc(f.ano) : 'Ano não informado'} ${f.exemplo ? seloExemplo() : ''}</p>
                  <label class="sr-only" for="status-${esc(f.id)}">Status de ${esc(f.titulo)}</label>
                  <select class="entrada pequena" id="status-${esc(f.id)}" data-status>
                    ${Object.entries(STATUS_SINGULAR).map(([id, n]) => `<option value="${id}" ${f.status === id ? 'selected' : ''}>${n}</option>`).join('')}
                  </select>
                  <div class="grupo-botoes">
                    <button type="button" class="botao-icone" data-detalhes aria-label="Detalhes de ${esc(f.titulo)}" title="Detalhes">${icone('olho')}</button>
                    <button type="button" class="botao-icone perigo" data-remover aria-label="Remover ${esc(f.titulo)} da coleção" title="Remover">${icone('lixeira')}</button>
                  </div>
                </div>
              </li>`).join('')}
          </ul>` : `
          <div class="vazio">
            <span class="ilustracao" aria-hidden="true">${enfeite('cinematecaVazia')}</span>
            <h3>Nada em "${STATUS[aba]}"</h3>
            <p>${aba === 'quero' ? 'Pesquise um filme ou adicione manualmente.' : 'Mude o status de um filme para ele aparecer aqui.'}</p>
          </div>`}
      </div>`;
  }

  function desenharColecao(focarAba = false) {
    const area = el.querySelector('#secao-colecao-corpo');
    area.innerHTML = htmlColecao();
    if (focarAba) area.querySelector(`[data-aba="${aba}"]`)?.focus();
  }

  function desenhar() {
    el.innerHTML = `
      <div class="cabecalho-secao">
        <div>
          <h1 class="titulo-pagina"><span class="enfeite-titulo" aria-hidden="true">${enfeite('cinemateca')}</span>Cinemateca</h1>
          <p>Os filmes de vocês: o que querem ver, o que estão vendo e o que já viram.</p>
        </div>
        <button type="button" class="botao-sec" data-manual>${icone('mais')} Adicionar manualmente</button>
      </div>
      <section class="cartao secao-pesquisa" aria-labelledby="titulo-pesquisa">
        <h2 id="titulo-pesquisa" class="subtitulo">${icone('busca')} Pesquisar filmes</h2>
        <div id="secao-pesquisa-corpo">${htmlPesquisa()}</div>
      </section>
      <section class="secao-colecao" aria-labelledby="titulo-colecao">
        <h2 id="titulo-colecao">Nossa coleção</h2>
        <div id="secao-colecao-corpo">${htmlColecao()}</div>
      </section>`;
  }

  async function adicionar(doc) {
    if (jaNaColecao(doc)) {
      toast(`"${doc.titulo}" já está na coleção.`, 'info');
      return null;
    }
    try {
      const salvo = await salvar('filmes', { status: 'quero', observacoes: '', ...doc });
      filmes.unshift(salvo);
      toast(`"${salvo.titulo}" adicionado em ${STATUS_SINGULAR[salvo.status]}.`, 'sucesso');
      return salvo;
    } catch (e) {
      toast(e.message, 'erro');
      return null;
    }
  }

  function formularioManual() {
    const { el: modal, fechar } = abrirModal({
      titulo: 'Adicionar filme manualmente',
      corpo: `
        <form class="formulario" id="form-filme" novalidate>
          <div class="campo">
            <label for="filme-titulo">Título <span aria-hidden="true">*</span></label>
            <input id="filme-titulo" name="titulo" maxlength="120" required>
          </div>
          <div class="linha-campos">
            <div class="campo">
              <label for="filme-ano">Ano <span class="dica">(opcional)</span></label>
              <input id="filme-ano" name="ano" inputmode="numeric" maxlength="4" pattern="\\d{4}" placeholder="Ex.: 1999">
            </div>
            <div class="campo">
              <label for="filme-status">Status</label>
              <select id="filme-status" name="status">${Object.entries(STATUS_SINGULAR).map(([id, n]) => `<option value="${id}">${n}</option>`).join('')}</select>
            </div>
          </div>
          <div class="campo">
            <label for="filme-poster">URL da imagem/pôster <span class="dica">(opcional)</span></label>
            <input id="filme-poster" name="poster" type="url" placeholder="https://…">
          </div>
          <div class="campo">
            <label for="filme-sinopse">Sinopse <span class="dica">(opcional)</span></label>
            <textarea id="filme-sinopse" name="sinopse" maxlength="600" rows="3"></textarea>
          </div>
          <div class="campo">
            <label for="filme-obs">Observações <span class="dica">(opcional)</span></label>
            <textarea id="filme-obs" name="observacoes" maxlength="600" rows="2"></textarea>
          </div>
        </form>`,
      rodape: `<button type="button" class="botao-fantasma" data-fechar>Cancelar</button>
               <button type="submit" form="form-filme" class="botao">${icone('salvar')} Adicionar</button>`,
    });
    const form = modal.querySelector('#form-filme');
    form.elements.titulo.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      limparErros(form);
      const d = lerFormulario(form);
      if (!d.titulo) return marcarErro(form.elements.titulo, 'Informe o título do filme.');
      if (d.ano && !/^\d{4}$/.test(d.ano)) return marcarErro(form.elements.ano, 'Use 4 dígitos, como 2005.');
      if (d.poster && !/^https?:\/\//i.test(d.poster)) return marcarErro(form.elements.poster, 'Use um endereço que comece com http:// ou https://');
      if (jaNaColecao(d)) return marcarErro(form.elements.titulo, 'Este filme já está na coleção.');
      const salvo = await adicionar({ ...d, origem: 'manual' });
      if (salvo) {
        fechar();
        aba = salvo.status;
        desenharColecao();
        desenharPesquisa();
      }
    });
  }

  function detalhes(id) {
    const f = filmes.find((x) => x.id === id);
    if (!f) return;
    const { el: modal, fechar } = abrirModal({
      titulo: f.titulo,
      tamanho: 'largo',
      corpo: `
        <div class="filme-detalhes">
          <div class="filme-detalhes-poster">${htmlPoster(f, 'grande')}</div>
          <form class="formulario" id="form-detalhes">
            <p class="meta">${f.ano ? esc(f.ano) : 'Ano não informado'} · ${f.origem === 'tmdb' ? 'Adicionado pela pesquisa do TMDB' : 'Cadastro manual'} ${f.exemplo ? seloExemplo() : ''}</p>
            <div class="campo">
              <span class="rotulo">Sinopse</span>
              <p class="sinopse">${f.sinopse ? esc(f.sinopse) : '<em>Sem sinopse.</em>'}</p>
            </div>
            <div class="campo">
              <label for="det-status">Status</label>
              <select id="det-status" name="status">${Object.entries(STATUS_SINGULAR).map(([sid, n]) => `<option value="${sid}" ${f.status === sid ? 'selected' : ''}>${n}</option>`).join('')}</select>
            </div>
            <div class="campo">
              <label for="det-obs">Observações</label>
              <textarea id="det-obs" name="observacoes" maxlength="600" rows="3" placeholder="Ex.: ver num sábado à noite">${esc(f.observacoes || '')}</textarea>
            </div>
          </form>
        </div>`,
      rodape: `<button type="button" class="botao-fantasma" data-fechar>Fechar</button>
               <button type="submit" form="form-detalhes" class="botao">${icone('salvar')} Salvar</button>`,
    });
    modal.querySelector('#form-detalhes').addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = lerFormulario(e.target);
      try {
        const salvo = await salvar('filmes', { ...f, status: d.status, observacoes: d.observacoes });
        filmes = filmes.map((x) => (x.id === salvo.id ? salvo : x));
        fechar();
        toast('Filme atualizado.', 'sucesso');
        desenharColecao();
      } catch (err) { toast(err.message, 'erro'); }
    });
    ligarFallbackPoster(modal);
  }

  /** Se um pôster não carregar, mostra o pôster genérico (sem quebrar o layout). */
  function ligarFallbackPoster(raiz) {
    raiz.addEventListener('error', (e) => {
      const img = e.target;
      if (!(img instanceof HTMLImageElement) || !img.hasAttribute('data-poster')) return;
      const div = document.createElement('div');
      div.className = img.className;
      div.innerHTML = posterVazio(img.alt.replace(/^Pôster de /, ''));
      img.replaceWith(div);
    }, true);
  }

  // ---------------- Eventos ----------------
  el.addEventListener('input', (e) => {
    if (e.target.id !== 'busca-tmdb') return;
    clearTimeout(timerDigitacao);
    const termo = e.target.value.trim();
    if (termo.length < MIN_LETRAS) {
      // apagou tudo (ou só 1 letra): limpa os resultados
      controle?.abort();
      if (!termo) { resultados = null; estadoBusca = 'parado'; ultimaBusca = ''; desenharPesquisa(); }
      return;
    }
    if (normalizarTexto(termo) === normalizarTexto(ultimaBusca) && estadoBusca !== 'erro') return;
    timerDigitacao = setTimeout(() => buscar(termo), ESPERA_DIGITACAO);
  });

  el.addEventListener('submit', (e) => {
    if (!e.target.matches('[data-buscar]')) return;
    e.preventDefault();
    const termo = e.target.elements.q.value;
    if (!termo.trim()) { e.target.elements.q.focus(); return; }
    buscar(termo);
  });

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-manual')) return formularioManual();
    if (b.dataset.aba) { aba = b.dataset.aba; desenharColecao(true); return; }
    if (b.dataset.adicionarResultado) {
      const r = resultados?.[Number(b.dataset.adicionarResultado)];
      if (!r) return;
      b.disabled = true;
      const salvo = await adicionar({ ...r, origem: 'tmdb', status: 'quero' });
      desenharPesquisa();
      if (salvo) { aba = 'quero'; desenharColecao(); }
      return;
    }
    const cartao = b.closest('[data-filme]');
    if (!cartao) return;
    const f = filmes.find((x) => x.id === cartao.dataset.filme);
    if (!f) return;
    if (b.hasAttribute('data-detalhes')) return detalhes(f.id);
    if (b.hasAttribute('data-remover')) {
      const ok = await confirmar({ titulo: 'Remover filme?', mensagem: `"${f.titulo}" sairá da coleção de vocês.`, textoConfirmar: 'Remover' });
      if (!ok) return;
      try {
        await remover('filmes', f.id);
        filmes = filmes.filter((x) => x.id !== f.id);
        toast('Filme removido.', 'sucesso');
        desenharColecao(true);
        desenharPesquisa();
      } catch (err) { toast(err.message, 'erro'); }
    }
  });

  // Teclado nas abas (setas esquerda/direita)
  el.addEventListener('keydown', (e) => {
    const atual = e.target.closest('[data-aba]');
    if (!atual || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const ids = Object.keys(STATUS);
    let i = ids.indexOf(atual.dataset.aba);
    if (e.key === 'ArrowLeft') i = (i - 1 + ids.length) % ids.length;
    if (e.key === 'ArrowRight') i = (i + 1) % ids.length;
    if (e.key === 'Home') i = 0;
    if (e.key === 'End') i = ids.length - 1;
    aba = ids[i];
    desenharColecao(true);
  });

  el.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-status]')) return;
    const f = filmes.find((x) => x.id === e.target.closest('[data-filme]').dataset.filme);
    if (!f) return;
    try {
      const salvo = await salvar('filmes', { ...f, status: e.target.value });
      filmes = filmes.map((x) => (x.id === salvo.id ? salvo : x));
      toast(`"${salvo.titulo}" agora está em ${STATUS_SINGULAR[salvo.status]}.`, 'sucesso');
      aba = salvo.status; // acompanha o filme até a aba nova
      desenharColecao();
      el.querySelector(`[data-filme="${CSS.escape(salvo.id)}"] [data-status]`)?.focus();
    } catch (err) { toast(err.message, 'erro'); desenharColecao(); }
  });

  ligarFallbackPoster(el);
  desenhar();
  return () => { clearTimeout(timerDigitacao); controle?.abort(); };
}
