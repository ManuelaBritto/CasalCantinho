// Início: boas-vindas, foto/ilustração, contador de tempo juntos, atalhos e destaques.
import { listar, obterAjustes, salvarAjustes, enviarImagem } from '../store/index.js';
import { icone } from '../ui/icones.js';
import { adesivo, cenaCasal } from '../ui/ilustracoes.js';
import { esc, toast, confirmar, formatarData, seloExemplo, hojeISO, abrirModal, lerFormulario } from '../ui/dom.js';
import { montarDicaNotificacoes } from '../painel-notificacoes.js';
import { PERFIS } from '../auth.js';
import { normalizarJuntos, comecarJuntos, encerrarJuntos, cancelarJuntos, removerEncontro, lerJuntos, tempoAtualMs, relogio, duracaoPorExtenso } from '../juntos.js';
import { cartaVisivelPara } from './cartinhas.js';
import { mensagemCuriosa } from '../curiosidades.js';
import { temaAtual, aoMudarTema } from '../tema.js';
import { htmlCarta } from './carta-visual.js';

const FRASES = {
  neutro: 'Um cantinho só nosso, para guardar tudo o que faz o coração sorrir.',
  drico: 'Sob a luz da lua, cada lembrança nossa ganha um lugar para sempre.',
  kath: 'Como os girassóis, a gente sempre encontra a luz — e guarda tudo aqui.',
};

/** Diferença de calendário entre duas datas (anos, meses, dias) + total de dias. */
export function tempoJuntos(inicioISO, hoje = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(inicioISO || '')) return null;
  const [a, m, d] = inicioISO.split('-').map(Number);
  const ini = new Date(a, m - 1, d);
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  if (Number.isNaN(ini.getTime()) || ini > fim) return null;
  let anos = fim.getFullYear() - ini.getFullYear();
  let meses = fim.getMonth() - ini.getMonth();
  let dias = fim.getDate() - ini.getDate();
  if (dias < 0) {
    meses -= 1;
    dias += new Date(fim.getFullYear(), fim.getMonth(), 0).getDate();
  }
  if (meses < 0) { anos -= 1; meses += 12; }
  const total = Math.round((Date.UTC(fim.getFullYear(), fim.getMonth(), fim.getDate()) - Date.UTC(a, m - 1, d)) / 86400000);
  return { anos, meses, dias, total };
}

export async function renderizar(el, ctx) {
  let ajustes = {};
  let dados = { cartas: [], listas: [], filmes: [], videos: [], memorias: [] };

  el.innerHTML = '<div class="estado"><span class="spinner pequeno" aria-hidden="true"></span> Arrumando o cantinho…</div>';
  try {
    const [aj, cartas, listas, filmes, videos, memorias] = await Promise.all([
      obterAjustes(), listar('cartas'), listar('listas'), listar('filmes'), listar('videos'), listar('memorias'),
    ]);
    ajustes = aj || {};
    // Cada pessoa só vê as cartinhas que escreveu ou que recebeu (nunca o rascunho da outra)
    dados = { cartas: cartas.filter((c) => cartaVisivelPara(c, ctx.perfil.id)), listas, filmes, videos, memorias };
  } catch (e) {
    el.innerHTML = `<div class="aviso erro" role="alert">${icone('alerta')}<p>${esc(e.message)}</p></div>`;
    return;
  }

  const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
  let juntos = normalizarJuntos(ajustes.juntos);
  const nomePerfil = (id) => PERFIS[id]?.nome || '';
  const textoNova = (c) => (c.tipo === 'elogio' ? `Chegou um elogio de ${nomePerfil(c.de)}!` : c.tipo === 'lembrete' ? `${nomePerfil(c.de)} lembrou de você!` : c.tipo === 'desenho' ? `${nomePerfil(c.de)} te mandou um desenho!` : `Chegou uma cartinha de ${nomePerfil(c.de)}!`);
  const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

  /** Curiosidade do encontro atual (ao vivo) ou do último encontro. */
  function htmlCuriosidade() {
    const j = juntos;
    const base = j.ativoDesde
      ? { ms: tempoAtualMs(j), chave: j.ativoDesde, prefixo: 'Até agora' }
      : (j.encontros[0] ? { ms: j.encontros[0].duracaoMs, chave: j.encontros[0].id, prefixo: 'No último encontro' } : null);
    if (!base) return '';
    const m = mensagemCuriosa(base.ms, base.chave);
    if (!m) return '';
    return `
      <p class="juntos-curiosidade"><span class="rotulo-curiosidade">${base.prefixo}</span> ${esc(m.texto)}
        <a class="fonte-curiosidade" href="${esc(m.fonte.url)}" target="_blank" rel="noopener noreferrer">Fonte: ${esc(m.fonte.nome)}</a></p>`;
  }

  function htmlJuntos() {
    const j = juntos;
    const maior = j.encontros.reduce((m, e) => Math.max(m, Number(e.duracaoMs) || 0), 0);
    const estatisticas = `
      <dl class="juntos-stats">
        <div><dt>Total juntos</dt><dd data-juntos-total>${duracaoPorExtenso(j.totalMs + tempoAtualMs(j))}</dd></div>
        <div><dt>Encontros</dt><dd>${j.encontros.length}</dd></div>
        <div><dt>Maior encontro</dt><dd>${maior ? duracaoPorExtenso(maior) : '—'}</dd></div>
      </dl>
      <div data-curiosidade>${htmlCuriosidade()}</div>
      ${j.encontros.length ? `<button type="button" class="botao-fantasma pequeno" data-historico-juntos>${icone('calendario')} Ver nossos encontros</button>` : ''}`;
    if (j.ativoDesde) {
      return `
        <div class="juntos-ativo">
          <p class="juntos-status"><span class="pulso" aria-hidden="true"></span>
            Juntos agora · desde ${hora(j.ativoDesde)}${j.iniciadoPor ? ` · ${esc(nomePerfil(j.iniciadoPor))} começou` : ''}</p>
          <p class="cronometro" role="timer" aria-label="Tempo juntos neste encontro" data-cronometro>${relogio(tempoAtualMs(j))}</p>
          <div class="grupo-botoes">
            <button type="button" class="botao" data-encerrar-juntos>${icone('check')} Encerrar encontro</button>
            <button type="button" class="botao-fantasma pequeno" data-cancelar-juntos>Foi sem querer</button>
          </div>
        </div>
        ${estatisticas}`;
    }
    return `
      <div class="juntos-parado">
        <p>Quando estiverem juntinhos, toquem no botão. O cantinho conta o tempo e guarda para vocês dois.</p>
        <button type="button" class="botao botao-juntos" data-comecar-juntos>${icone('coracao')} Estamos juntos?</button>
      </div>
      ${estatisticas}`;
  }

  function redesenharJuntos(focoSeletor) {
    const area = el.querySelector('#juntos-corpo');
    if (!area) return;
    area.innerHTML = htmlJuntos();
    el.querySelector('.juntos')?.classList.toggle('ativo', Boolean(juntos.ativoDesde));
    if (focoSeletor) area.querySelector(focoSeletor)?.focus();
  }

  const paraInputLocal = (d) => {
    const z = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`;
  };

  function modalEncerrar() {
    const inicio = new Date(juntos.ativoDesde);
    const { el: modal, fechar } = abrirModal({
      titulo: 'Encerrar encontro',
      corpo: `
        <form class="formulario" id="form-encerrar" novalidate>
          <p>Vocês ficaram juntos por <strong data-duracao-previa>${duracaoPorExtenso(tempoAtualMs(juntos))}</strong> (desde ${hora(juntos.ativoDesde)}).</p>
          <div class="campo">
            <label for="encontro-nota">Como foi? <span class="dica">(opcional)</span></label>
            <textarea id="encontro-nota" name="nota" rows="3" maxlength="280" placeholder="Ex.: cinema e pizza"></textarea>
          </div>
          <details class="ajuste-fim">
            <summary>Esqueceram de encerrar na hora?</summary>
            <div class="campo">
              <label for="encontro-fim">Horário em que o encontro terminou</label>
              <input id="encontro-fim" name="fim" type="datetime-local" min="${paraInputLocal(inicio)}" max="${paraInputLocal(new Date())}" value="${paraInputLocal(new Date())}">
            </div>
          </details>
        </form>`,
      rodape: `<button type="button" class="botao-fantasma" data-fechar>Voltar</button>
               <button type="submit" form="form-encerrar" class="botao">${icone('salvar')} Guardar encontro</button>`,
    });
    const form = modal.querySelector('form');
    form.elements.nota.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const d = lerFormulario(form);
      const ajustado = form.querySelector('details').open && d.fim ? new Date(d.fim) : null;
      try {
        juntos = await encerrarJuntos(ctx.perfil, { nota: d.nota, fim: ajustado });
        fechar();
        toast(`Encontro de ${duracaoPorExtenso(juntos.encontros[0]?.duracaoMs || 0)} guardado.`, 'sucesso');
        redesenharJuntos('[data-comecar-juntos]');
      } catch (err) { toast(err.message, 'erro'); }
    });
  }

  function modalHistorico() {
    const { el: modal } = abrirModal({
      titulo: 'Nossos encontros',
      corpo: '<div data-lista-encontros></div>',
      rodape: '<button type="button" class="botao" data-fechar>Fechar</button>',
    });
    const desenharLista = () => {
      const area = modal.querySelector('[data-lista-encontros]');
      if (!juntos.encontros.length) { area.innerHTML = '<p class="meta">Nenhum encontro guardado.</p>'; return; }
      area.innerHTML = `
        <p class="meta">Total: ${duracaoPorExtenso(juntos.totalMs)} em ${plural(juntos.encontros.length, 'encontro', 'encontros')}.</p>
        <ul class="lista-encontros" role="list">
          ${juntos.encontros.map((e) => `
            <li class="encontro" data-encontro="${esc(e.id)}">
              <div>
                <p class="encontro-data">${esc(formatarData(e.inicio, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</p>
                <p class="meta">${hora(e.inicio)} – ${hora(e.fim)} · <strong>${duracaoPorExtenso(e.duracaoMs)}</strong></p>
                ${e.nota ? `<p class="encontro-nota">${esc(e.nota)}</p>` : ''}
              </div>
              <button type="button" class="botao-icone perigo" data-remover-encontro aria-label="Excluir encontro de ${esc(formatarData(e.inicio))}">${icone('lixeira')}</button>
            </li>`).join('')}
        </ul>`;
    };
    modal.querySelector('[data-lista-encontros]').addEventListener('click', async (e) => {
      const b = e.target.closest('[data-remover-encontro]');
      if (!b) return;
      e.stopPropagation();
      const id = b.closest('[data-encontro]').dataset.encontro;
      const linha = b.closest('[data-encontro]');
      if (!linha.classList.contains('confirmando')) {
        linha.classList.add('confirmando');
        b.insertAdjacentHTML('beforebegin', `<button type="button" class="botao-perigo pequeno" data-confirmar-remocao>Excluir mesmo</button>`);
        linha.querySelector('[data-confirmar-remocao]').focus();
        linha.querySelector('[data-confirmar-remocao]').addEventListener('click', async () => {
          try {
            juntos = await removerEncontro(id);
            desenharLista();
            redesenharJuntos();
            toast('Encontro excluído.', 'sucesso');
          } catch (err) { toast(err.message, 'erro'); }
        });
      }
    });
    desenharLista();
  }

  function htmlFoto() {
    const tema = temaAtual();
    return ajustes.fotoCasal
      ? `<img src="${esc(ajustes.fotoCasal)}" alt="Foto do casal" class="foto-casal">`
      : `<div class="cena-casal" role="img" aria-label="Ilustração decorativa do tema ${tema}">${cenaCasal(tema)}</div>`;
  }

  function htmlContador() {
    const t = tempoJuntos(ajustes.dataInicio);
    const exemplo = ajustes.dataInicioExemplo;
    if (!ajustes.dataInicio) {
      return `
        <div class="contador-vazio">
          <p>Defina a data em que a história de vocês começou para ver o contador.</p>
          <button type="button" class="botao" data-editar-data>${icone('calendario')} Definir data</button>
        </div>`;
    }
    if (!t) {
      return `<p>A data definida (${esc(formatarData(ajustes.dataInicio))}) ainda não chegou.</p>
              <button type="button" class="botao-sec pequeno" data-editar-data>${icone('editar')} Alterar data</button>`;
    }
    return `
      <div class="contador-numeros" role="group" aria-label="Tempo juntos: ${plural(t.anos, 'ano', 'anos')}, ${plural(t.meses, 'mês', 'meses')} e ${plural(t.dias, 'dia', 'dias')}">
        <div class="numero"><strong>${t.anos}</strong><span>${t.anos === 1 ? 'ano' : 'anos'}</span></div>
        <div class="numero"><strong>${t.meses}</strong><span>${t.meses === 1 ? 'mês' : 'meses'}</span></div>
        <div class="numero"><strong>${t.dias}</strong><span>${t.dias === 1 ? 'dia' : 'dias'}</span></div>
      </div>
      <p class="contador-rodape">
        Desde ${esc(formatarData(ajustes.dataInicio, { day: 'numeric', month: 'long', year: 'numeric' }))} · ${t.total.toLocaleString('pt-BR')} dias
        ${exemplo ? seloExemplo('Data de exemplo') : ''}
      </p>
      <button type="button" class="botao-sec pequeno" data-editar-data>${icone('editar')} ${exemplo ? 'Definir a data real' : 'Alterar data'}</button>`;
  }

  function desenhar() {
    const tema = temaAtual();
    const memoriasRecentes = [...dados.memorias].sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || ''))).slice(0, 3);
    const novas = dados.cartas.filter((c) => c.para === ctx.perfil.id && c.enviadaEm && !c.lidaEm);
    const novasCartas = novas.filter((c) => !c.tipo);
    const cartaDestaque = novasCartas[0] || [...dados.cartas].filter((c) => !c.tipo).sort((a, b) => String(b.enviadaEm || b.atualizadoEm || '').localeCompare(String(a.enviadaEm || a.atualizadoEm || '')))[0];
    const itensPendentes = dados.listas.reduce((s, l) => s + (l.itens || []).filter((i) => !i.feito).length, 0);
    const atalhos = [
      { rota: 'cartinhas', titulo: 'Cartinhas', icone: 'carta', texto: plural(dados.cartas.length, 'cartinha guardada', 'cartinhas guardadas'), enfeite: { neutro: 'laco', drico: 'vela', kath: 'selo' } },
      { rota: 'listas', titulo: 'Listas', icone: 'lista', texto: `${plural(dados.listas.length, 'lista', 'listas')} · ${plural(itensPendentes, 'item pendente', 'itens pendentes')}`, enfeite: { neutro: 'flor', drico: 'aranha', kath: 'folhagem' } },
      { rota: 'cinemateca', titulo: 'Cinemateca', icone: 'filme', texto: plural(dados.filmes.length, 'filme na coleção', 'filmes na coleção'), enfeite: { neutro: 'brilho', drico: 'lua', kath: 'polaroid' } },
      { rota: 'cinema', titulo: 'Cinema', icone: 'cinema', texto: plural(dados.videos.length, 'vídeo favorito', 'vídeos favoritos'), enfeite: { neutro: 'coracao', drico: 'morcego', kath: 'girassol' } },
    ];

    el.innerHTML = `
      <section class="hero cartao" aria-labelledby="hero-titulo">
        <div class="hero-texto">
          <p class="hero-saudacao">Olá, <span data-nome-perfil="${ctx.perfil.id}">${esc(ctx.perfil.nome)}</span>!</p>
          <h1 id="hero-titulo">${FRASES[tema]}</h1>
          <p class="hero-resumo">Aqui ficam as cartinhas, as listas, os filmes, os vídeos e as memórias de vocês — tudo num lugar só.</p>
          <div class="grupo-botoes">
            <a class="botao" href="#/cartinhas?nova">${icone('carta')} Escrever cartinha</a>
            <a class="botao-sec" href="#/memorias">${icone('imagem')} Ver memórias</a>
          </div>
        </div>
        <figure class="hero-foto">
          <div class="moldura-foto">${htmlFoto()}</div>
          <figcaption>
            ${ajustes.fotoCasal ? '' : '<span class="dica">Ilustração do tema — adicione uma foto de vocês.</span>'}
            <span class="grupo-botoes">
              <label class="botao-sec pequeno botao-arquivo">
                ${icone('upload')} ${ajustes.fotoCasal ? 'Trocar foto' : 'Adicionar foto'}
                <input type="file" accept="image/*" data-foto class="sr-only">
              </label>
              ${ajustes.fotoCasal ? `<button type="button" class="botao-fantasma pequeno" data-remover-foto>${icone('lixeira')} Remover</button>` : ''}
            </span>
          </figcaption>
        </figure>
      </section>

      ${novas.length ? `
        <a class="aviso-carta-nova cartao" href="#/cartinhas?abrir=${esc(novas[0].id)}">
          <span class="envelope-mini" aria-hidden="true">${icone('carta')}</span>
          <span><strong>${novas.length === 1 ? esc(textoNova(novas[0])) : `Chegaram ${novas.length} cartinhas e bilhetes novos!`}</strong>
          <span class="meta">Toque para abrir.</span></span>
          ${icone('direita')}
        </a>` : ''}

      <div data-dica-notificacoes></div>

      <section class="juntos cartao ${juntos.ativoDesde ? 'ativo' : ''}" aria-labelledby="titulo-juntos">
        <h2 id="titulo-juntos">Estamos juntos?</h2>
        <div id="juntos-corpo">${htmlJuntos()}</div>
      </section>

      <section class="contador cartao" aria-labelledby="titulo-contador">
        <span class="contador-enfeite" aria-hidden="true">${adesivo(tema === 'drico' ? 'lua' : tema === 'kath' ? 'girassol' : 'coracao')}</span>
        <h2 id="titulo-contador">Tempo juntos</h2>
        <div id="contador-corpo">${htmlContador()}</div>
      </section>

      <section aria-labelledby="titulo-atalhos" class="secao-atalhos">
        <h2 id="titulo-atalhos">Atalhos</h2>
        <ul class="atalhos" role="list">
          ${atalhos.map((a) => `
            <li>
              <a class="atalho cartao" href="#/${a.rota}">
                <span class="atalho-enfeite" aria-hidden="true">${adesivo(a.enfeite[tema])}</span>
                <span class="atalho-icone" aria-hidden="true">${icone(a.icone)}</span>
                <span class="atalho-titulo">${a.titulo}</span>
                <span class="atalho-texto">${a.texto}</span>
              </a>
            </li>`).join('')}
        </ul>
      </section>

      <div class="inicio-destaques">
        <section class="cartao" aria-labelledby="titulo-memorias-recentes">
          <div class="cabecalho-secao compacto">
            <h2 id="titulo-memorias-recentes">Memórias recentes</h2>
            <a href="#/memorias" class="botao-fantasma pequeno">Ver todas ${icone('direita')}</a>
          </div>
          ${memoriasRecentes.length ? `
            <ul class="mini-galeria" role="list">
              ${memoriasRecentes.map((m) => `
                <li class="memoria mini">
                  <figure>
                    <a href="#/memorias" class="memoria-foto">${m.src ? `<img src="${esc(m.src)}" alt="${esc(m.legenda || 'Memória')}" loading="lazy">` : `<span class="foto-indisponivel">${icone('imagem')}</span>`}</a>
                    <figcaption><span class="memoria-legenda">${esc(m.legenda || 'Sem legenda')}</span>${m.exemplo ? seloExemplo() : ''}</figcaption>
                  </figure>
                </li>`).join('')}
            </ul>` : `<p class="meta">Nenhuma memória ainda. <a href="#/memorias">Adicionar a primeira</a>.</p>`}
        </section>

        <section class="cartao carta-destaque" aria-labelledby="titulo-carta-destaque">
          <div class="cabecalho-secao compacto">
            <h2 id="titulo-carta-destaque">${novasCartas.length ? 'Cartinha nova' : 'Cartinha em destaque'}</h2>
            ${cartaDestaque?.exemplo ? seloExemplo() : ''}
          </div>
          ${cartaDestaque ? `
            ${novasCartas.length ? `<a href="#/cartinhas?abrir=${esc(cartaDestaque.id)}" class="envelope-destaque" aria-label="Abrir a cartinha nova de ${esc(nomePerfil(cartaDestaque.de))}">
                <span class="envelope-fechado" aria-hidden="true"><span class="selo-cera">${icone('coracao')}</span></span>
                <span class="meta">De ${esc(nomePerfil(cartaDestaque.de))} · toque para abrir</span></a>`
              : `<a href="#/cartinhas?abrir=${esc(cartaDestaque.id)}" class="carta-link" aria-label="Abrir cartinha: ${esc(cartaDestaque.titulo)}">${htmlCarta(cartaDestaque, { compacta: true })}</a>`}` : `
            <p class="meta">Nenhuma cartinha ainda.</p>
            <a class="botao pequeno" href="#/cartinhas?nova">${icone('carta')} Escrever a primeira</a>`}
        </section>
      </div>`;
    montarDicaNotificacoes(el.querySelector('[data-dica-notificacoes]'), ctx.perfil);
  }

  function editarData() {
    const corpo = el.querySelector('#contador-corpo');
    const atual = ajustes.dataInicioExemplo ? '' : (ajustes.dataInicio || '');
    corpo.innerHTML = `
      <form class="form-data" novalidate>
        <div class="campo">
          <label for="data-inicio">Data de início do relacionamento</label>
          <input id="data-inicio" name="data" type="date" max="${hojeISO()}" value="${esc(atual)}" required>
          <p class="dica">Fica salva para vocês dois. Pode alterar quando quiser.</p>
        </div>
        <div class="grupo-botoes">
          <button type="submit" class="botao pequeno">${icone('salvar')} Salvar data</button>
          <button type="button" class="botao-fantasma pequeno" data-cancelar-data>Cancelar</button>
          ${ajustes.dataInicio ? `<button type="button" class="botao-fantasma pequeno" data-limpar-data>${icone('lixeira')} Limpar</button>` : ''}
        </div>
      </form>`;
    const form = corpo.querySelector('form');
    form.elements.data.focus();
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const valor = form.elements.data.value;
      if (!valor) { form.elements.data.setAttribute('aria-invalid', 'true'); form.elements.data.focus(); return; }
      if (valor > hojeISO()) { toast('Escolha uma data que já passou.', 'info'); return; }
      try {
        ajustes = await salvarAjustes({ dataInicio: valor, dataInicioExemplo: false });
        toast('Data salva!', 'sucesso');
        reDesenharContador(true);
      } catch (err) { toast(err.message, 'erro'); }
    });
    form.querySelector('[data-cancelar-data]').addEventListener('click', () => reDesenharContador(true));
    form.querySelector('[data-limpar-data]')?.addEventListener('click', async () => {
      try {
        ajustes = await salvarAjustes({ dataInicio: null, dataInicioExemplo: false });
        reDesenharContador(true);
      } catch (err) { toast(err.message, 'erro'); }
    });
  }

  function reDesenharContador(focar) {
    el.querySelector('#contador-corpo').innerHTML = htmlContador();
    if (focar) el.querySelector('#contador-corpo [data-editar-data]')?.focus();
  }

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-comecar-juntos')) {
      b.disabled = true;
      try {
        juntos = await comecarJuntos(ctx.perfil);
        redesenharJuntos('[data-encerrar-juntos]');
        toast('Cronômetro ligado. Aproveitem!', 'sucesso');
      } catch (err) { toast(err.message, 'erro'); b.disabled = false; }
      return;
    }
    if (b.hasAttribute('data-encerrar-juntos')) return modalEncerrar();
    if (b.hasAttribute('data-historico-juntos')) return modalHistorico();
    if (b.hasAttribute('data-cancelar-juntos')) {
      const ok = await confirmar({ titulo: 'Descartar este encontro?', mensagem: 'O cronômetro para e este tempo não é somado ao total.', textoConfirmar: 'Descartar' });
      if (!ok) return;
      try { juntos = await cancelarJuntos(); redesenharJuntos('[data-comecar-juntos]'); } catch (err) { toast(err.message, 'erro'); }
      return;
    }
    if (b.hasAttribute('data-editar-data')) editarData();
    if (b.hasAttribute('data-remover-foto')) {
      const ok = await confirmar({ titulo: 'Remover foto?', mensagem: 'A foto do casal sai da página inicial e volta a ilustração do tema.', textoConfirmar: 'Remover' });
      if (!ok) return;
      try {
        ajustes = await salvarAjustes({ fotoCasal: null, fotoCasalPath: null });
        desenhar();
      } catch (err) { toast(err.message, 'erro'); }
    }
  });

  el.addEventListener('change', async (e) => {
    if (!e.target.matches('[data-foto]')) return;
    const arquivo = e.target.files[0];
    if (!arquivo) return;
    const moldura = el.querySelector('.moldura-foto');
    moldura.classList.add('carregando-foto');
    try {
      const img = await enviarImagem(arquivo);
      ajustes = await salvarAjustes({ fotoCasal: img.src, fotoCasalPath: img.path || null });
      toast('Foto atualizada!', 'sucesso');
      desenhar();
    } catch (err) {
      toast(err.message, 'erro');
      moldura.classList.remove('carregando-foto');
    }
  });

  const pararOuvir = aoMudarTema(() => desenhar());
  // Atualiza o cronômetro a cada segundo e busca mudanças do outro perfil a cada 30 s
  const tique = setInterval(() => {
    if (!juntos.ativoDesde) return;
    const c = el.querySelector('[data-cronometro]');
    if (c) c.textContent = relogio(tempoAtualMs(juntos));
    const t = el.querySelector('[data-juntos-total]');
    if (t) t.textContent = duracaoPorExtenso(juntos.totalMs + tempoAtualMs(juntos));
    // a curiosidade acompanha o tempo, mas sem piscar a cada segundo
    if (Math.floor(tempoAtualMs(juntos) / 1000) % 15 === 0) {
      const cur = el.querySelector('[data-curiosidade]');
      if (cur) cur.innerHTML = htmlCuriosidade();
    }
  }, 1000);
  const sincronizar = setInterval(async () => {
    if (document.querySelector('dialog[open]')) return;
    try {
      const novo = await lerJuntos();
      if (JSON.stringify(novo) !== JSON.stringify(juntos)) { juntos = novo; redesenharJuntos(); }
    } catch { /* sem conexão: tenta de novo depois */ }
  }, 30000);
  const aoMudarJuntos = (e) => { juntos = normalizarJuntos(e.detail); redesenharJuntos(); };
  window.addEventListener('nc:juntos-mudou', aoMudarJuntos);
  desenhar();
  return () => { pararOuvir(); clearInterval(tique); clearInterval(sincronizar); window.removeEventListener('nc:juntos-mudou', aoMudarJuntos); };
}
