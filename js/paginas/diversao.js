// Diversão (em desenvolvimento):
//  - Quadro branco: desenhos do casal. Os dois veem, editam, criam e excluem.
//    Se os dois abrirem o mesmo desenho, cada traço aparece na hora na tela do outro.
//  - Álbum de figurinhas: por enquanto só o álbum com os espaços (../album.js)
//  - Como eu te vejo: uma pergunta nova por dia ("Como eu te vejo se você fosse um animal").
//    Cada um desenha a resposta e envia; o desenho chega nas Cartinhas do outro.
import { listar, salvar, remover, enviarImagem, removerImagem } from '../store/index.js';
import { salaAtual } from '../sala-cinema.js';
import { PERFIS } from '../auth.js';
import { criarQuadro } from '../quadro.js';
import { montarAlbum } from '../album.js';
import { avisarOutro } from '../bilhetes.js';
import { notificarOutro } from '../notificacoes.js';
import { cartaVisivelPara } from './cartinhas.js';
import { icone } from '../ui/icones.js';
import { enfeitePorTema } from '../ui/ilustracoes.js';
import { esc, toast, confirmar, formatarData } from '../ui/dom.js';

// Aviso de desenho no quadro branco: no máximo um por desenho a cada 10 minutos,
// para o salvamento automático não encher o celular do outro de notificações.
const INTERVALO_AVISO_QUADRO = 10 * 60 * 1000;
const ultimoAvisoQuadro = new Map();

// ---------------- Pergunta do dia ----------------
export const PERGUNTAS = [
  'um animal', 'uma flor', 'uma comida', 'um doce', 'uma fruta', 'uma estação do ano', 'um lugar do mundo',
  'um objeto da casa', 'uma bebida', 'um personagem de desenho animado', 'uma planta', 'um tipo de clima',
  'uma peça de roupa', 'um instrumento musical', 'um meio de transporte', 'um bichinho do jardim', 'uma sobremesa',
  'um monstrinho fofo', 'um super-herói', 'uma constelação', 'um bicho do mar', 'uma árvore', 'um brinquedo',
  'um emoji', 'um castelo', 'um planeta', 'uma criatura mágica', 'um passarinho', 'um bolo de aniversário', 'uma paisagem',
];

/** Data de hoje no horário de Brasília (AAAA-MM-DD): os dois veem a mesma pergunta. */
export function hojeBrasilia(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

export function perguntaDoDia(agora = new Date()) {
  const dia = hojeBrasilia(agora);
  const dias = Math.floor(Date.parse(`${dia}T12:00:00Z`) / 86400000);
  return { dia, texto: `Como eu te vejo se você fosse ${PERGUNTAS[((dias % PERGUNTAS.length) + PERGUNTAS.length) % PERGUNTAS.length]}` };
}

function tempoAteAmanha(agora = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(agora).map((p) => [p.type, p.value]));
  const passados = (Number(partes.hour) % 24) * 60 + Number(partes.minute);
  const faltam = 24 * 60 - passados;
  const h = Math.floor(faltam / 60);
  const m = faltam % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

// ---------------- Página ----------------
export async function renderizar(el, ctx) {
  const eu = ctx.perfil.id;
  const outro = Object.values(PERFIS).find((p) => p.id !== eu);
  const nome = (id) => PERFIS[id]?.nome || 'Alguém';
  const sala = salaAtual();
  const podeSincronizar = () => sala && sala.status === 'ok';

  let desenhos = [];
  let respostas = [];
  let semTabela = false;
  let limparModo = null; // limpeza do modo atual (editor/como)

  async function carregar() {
    try {
      desenhos = await listar('desenhos');
      semTabela = false;
    } catch {
      desenhos = [];
      semTabela = true;
    }
    try {
      respostas = (await listar('cartas')).filter((c) => c.tipo === 'desenho' && cartaVisivelPara(c, eu));
    } catch { respostas = []; }
  }

  function trocarModo(fn) {
    limparModo?.();
    limparModo = null;
    const r = fn();
    if (typeof r === 'function') limparModo = r;
    window.scrollTo({ top: 0 });
  }

  // ---------------- Visão geral ----------------
  function htmlDesenho(d) {
    const quando = d.atualizadoEm || d.criadoEm;
    return `
      <li class="cartao-desenho">
        <button type="button" class="desenho-miniatura" data-abrir-desenho="${esc(d.id)}" aria-label="Abrir ${esc(d.titulo || 'desenho')}">
          ${d.src ? `<img src="${esc(d.src)}" alt="" loading="lazy">` : `<span class="desenho-vazio">${icone('pincel')}<span>Quadro em branco</span></span>`}
        </button>
        <div class="desenho-info">
          <h3>${esc(d.titulo || 'Desenho sem título')}</h3>
          <p class="meta">${d.atualizadoPor ? `Editado por ${esc(nome(d.atualizadoPor))}` : `Criado por ${esc(nome(d.criadoPor))}`}${quando ? ` · ${esc(formatarData(quando))}` : ''}</p>
          <div class="grupo-botoes">
            <button type="button" class="botao pequeno" data-abrir-desenho="${esc(d.id)}">${icone('pincel')} Desenhar</button>
            <button type="button" class="botao-icone perigo" data-excluir-desenho="${esc(d.id)}" aria-label="Excluir ${esc(d.titulo || 'desenho')}" title="Excluir">${icone('lixeira')}</button>
          </div>
        </div>
      </li>`;
  }

  function htmlResposta(c) {
    const minha = c.de === eu;
    const nova = !minha && !c.lidaEm;
    return `
      <li class="resposta-como">
        <a href="#/cartinhas?abrir=${esc(c.id)}" class="resposta-link" aria-label="${esc(c.pergunta || 'Desenho')}, ${minha ? `enviado para ${esc(nome(c.para))}` : `de ${esc(nome(c.de))}`}">
          ${nova
            ? `<span class="resposta-fechada">${icone('imagem')}<span>Desenho novo de ${esc(nome(c.de))}</span></span>`
            : `<img src="${esc(c.src || '')}" alt="" loading="lazy">`}
        </a>
        <p class="resposta-pergunta">${esc(c.pergunta || '')}</p>
        <p class="meta">${minha ? `Você → ${esc(nome(c.para))}` : `${esc(nome(c.de))} → você`} · ${esc(formatarData(c.enviadaEm))}</p>
      </li>`;
  }

  function mostrarVisaoGeral({ focar = false } = {}) {
    trocarModo(() => {
      const pergunta = perguntaDoDia();
      const respondiHoje = respostas.some((c) => c.de === eu && c.pergunta === pergunta.texto);
      const ordenados = [...desenhos].sort((a, b) => String(b.atualizadoEm || b.criadoEm || '').localeCompare(String(a.atualizadoEm || a.criadoEm || '')));
      const trocadas = [...respostas].sort((a, b) => String(b.enviadaEm || '').localeCompare(String(a.enviadaEm || '')));
      el.innerHTML = `
        <div class="cabecalho-secao">
          <div>
            <h1 class="titulo-pagina">Diversão <span class="selo selo-desenvolvimento">Em desenvolvimento</span></h1>
            <p>Desenhos, brincadeiras e o que mais vier por aí. Tudo aqui é de vocês dois.</p>
          </div>
        </div>

        <section class="cartao como-eu-te-vejo" aria-labelledby="titulo-como">
          <div class="como-topo">
            <span class="como-icone" aria-hidden="true">${icone('pincel')}</span>
            <div>
              <h2 id="titulo-como" class="sobretitulo-como">Como eu te vejo · pergunta de hoje</h2>
              <p class="como-pergunta">${esc(pergunta.texto)}?</p>
              <p class="dica">Desenhe a sua resposta e mande para ${esc(outro.nome)}: ela chega nas Cartinhas. Nova pergunta em ${esc(tempoAteAmanha())}.</p>
            </div>
          </div>
          <div class="grupo-botoes">
            <button type="button" class="botao" data-como-desenhar>${icone('pincel')} ${respondiHoje ? 'Desenhar outra resposta' : 'Desenhar minha resposta'}</button>
            ${respondiHoje ? `<span class="selo selo-ok">${icone('check')} Você já respondeu hoje</span>` : ''}
          </div>
          ${trocadas.length ? `
            <h3 class="subtitulo-pequeno">Desenhos que vocês trocaram</h3>
            <ul class="grade-respostas" role="list">${trocadas.slice(0, 12).map(htmlResposta).join('')}</ul>` : ''}
        </section>

        <section class="secao-quadro" aria-labelledby="titulo-quadro">
          <div class="cabecalho-secao pequeno">
            <div>
              <h2 id="titulo-quadro" class="subtitulo">${icone('pincel')} Quadro branco</h2>
              <p>Os desenhos ficam para os dois. Se vocês abrirem o mesmo desenho, um vê o outro desenhando na hora.</p>
            </div>
            <button type="button" class="botao" data-novo-desenho ${semTabela ? 'disabled' : ''}>${icone('mais')} Novo desenho</button>
          </div>
          ${semTabela ? `<div class="aviso">${icone('info')}<p>Para guardar os desenhos, rode o arquivo <code>supabase/diversao.sql</code> no Supabase (SQL Editor). O "Como eu te vejo" já funciona sem ele.</p></div>` : ''}
          ${ordenados.length
            ? `<ul class="grade grade-desenhos" role="list">${ordenados.map(htmlDesenho).join('')}</ul>`
            : semTabela ? '' : `<div class="vazio">
                <span class="ilustracao" aria-hidden="true">${enfeitePorTema({ neutro: 'coracao', drico: 'morcego', kath: 'girassol' })}</span>
                <h3>Nenhum desenho ainda</h3>
                <p>Crie um quadro e chame ${esc(outro.nome)} para desenhar junto.</p>
              </div>`}
        </section>
        <section class="cartao album" aria-label="Álbum de figurinhas (em desenvolvimento)">
          <div class="album-topo">
            <div>
              <h2 class="subtitulo">${icone('estrela')} Desenvolvendo <span class="selo selo-desenvolvimento">Desenvolvendo</span></h2>
              <p class="dica">Desenvolvendo</p>
            </div>
            <p class="album-contador">Desenvolvendo</p>
          </div>
          <div data-album-livro></div>
        </section>`;
      if (focar) el.querySelector('h1')?.focus();
      montarAlbum(el.querySelector('[data-album-livro]'));

      const aoReceber = (msg) => {
        if (msg.de === eu) return;
        if (msg.tipo === 'quadro-salvo' || msg.tipo === 'quadro-criado' || msg.tipo === 'quadro-excluido') atualizarVisao();
      };
      const pararOuvir = sala ? sala.ouvir(aoReceber) : () => {};
      const aoCarta = () => atualizarVisao();
      window.addEventListener('nc:carta-recebida', aoCarta);
      return () => { pararOuvir(); window.removeEventListener('nc:carta-recebida', aoCarta); };
    });
  }

  let atualizando = false;
  async function atualizarVisao() {
    if (atualizando) return;
    atualizando = true;
    try { await carregar(); if (el.isConnected && !el.querySelector('.quadro')) mostrarVisaoGeral(); } finally { atualizando = false; }
  }

  async function novoDesenho() {
    try {
      const doc = await salvar('desenhos', { titulo: 'Desenho sem título', criadoPor: eu, atualizadoPor: eu });
      desenhos.unshift(doc);
      if (podeSincronizar()) sala.enviar('quadro-criado', { desenhoId: doc.id });
      abrirEditor(doc);
    } catch (e) { toast(e.message, 'erro'); }
  }

  async function excluirDesenho(id) {
    const d = desenhos.find((x) => x.id === id);
    if (!d) return;
    const ok = await confirmar({ titulo: 'Excluir desenho?', mensagem: `"${d.titulo || 'Desenho sem título'}" some para você e para ${outro.nome}. Não dá para desfazer.` });
    if (!ok) return;
    try {
      await remover('desenhos', id);
      desenhos = desenhos.filter((x) => x.id !== id);
      if (podeSincronizar()) sala.enviar('quadro-excluido', { desenhoId: id });
      toast('Desenho excluído.', 'sucesso');
      mostrarVisaoGeral();
    } catch (e) { toast(e.message, 'erro'); }
  }

  // ---------------- Editor do quadro branco ----------------
  function abrirEditor(doc) {
    trocarModo(() => {
      let atual = { ...doc };
      let salvando = null;
      let timerSalvar = null;
      let abertoEm = Date.now();
      const vistos = new Map(); // perfil → último sinal de que está neste desenho
      let desenhouAgora = false; // desenhou algo desde o último salvamento
      history.replaceState(null, '', `#/diversao?desenho=${encodeURIComponent(atual.id)}`);

      el.innerHTML = `
        <h1 class="sr-only" tabindex="-1">Quadro branco</h1>
        <div class="cabecalho-secao">
          <div class="editor-desenho-titulo">
            <label for="titulo-desenho" class="sr-only">Título do desenho</label>
            <input id="titulo-desenho" class="entrada titulo-desenho" maxlength="60" value="${esc(atual.titulo || '')}" placeholder="Desenho sem título">
            <p class="meta" data-status-desenho aria-live="polite"></p>
          </div>
          <div class="grupo-botoes">
            <button type="button" class="botao-fantasma" data-voltar-desenhos>${icone('esquerda')} Voltar</button>
            <button type="button" class="botao-sec" data-baixar-desenho>${icone('baixar')} Baixar</button>
            <button type="button" class="botao" data-salvar-desenho>${icone('salvar')} Salvar</button>
          </div>
        </div>
        <p class="presenca-quadro" data-presenca aria-live="polite"></p>
        <div data-quadro></div>`;

      const status = el.querySelector('[data-status-desenho]');
      const presenca = el.querySelector('[data-presenca]');
      const campoTitulo = el.querySelector('#titulo-desenho');
      const enviar = (tipo, dados) => { if (podeSincronizar()) sala.enviar(tipo, { ...dados, desenhoId: atual.id }); };

      const quadro = criarQuadro(el.querySelector('[data-quadro]'), {
        eu,
        rotulo: `Quadro: ${atual.titulo || 'desenho'}`,
        aoEnviar: enviar,
        aoMudar: () => { desenhouAgora = true; mostrarStatus(); agendarSalvar(); },
      });

      function mostrarStatus(texto) {
        status.textContent = texto || (quadro.alterado ? 'Alterações ainda não salvas' : (atual.atualizadoEm ? `Salvo · ${formatarData(atual.atualizadoEm, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : 'Novo desenho'));
      }

      function agendarSalvar() {
        clearTimeout(timerSalvar);
        timerSalvar = setTimeout(() => salvarDesenho(), 4000);
      }

      async function salvarDesenho({ avisar = false } = {}) {
        clearTimeout(timerSalvar);
        if (salvando) {
          await salvando;
          return avisar ? salvarDesenho({ avisar }) : null;
        }
        const titulo = campoTitulo.value.trim() || 'Desenho sem título';
        if (!quadro.alterado && titulo === atual.titulo) { if (avisar) toast('Desenho salvo!', 'sucesso', { duracao: 1800 }); return null; }
        salvando = (async () => {
          mostrarStatus('Salvando…');
          try {
            const blob = await quadro.exportar();
            quadro.marcarSalvo(); // traços feitos durante o envio voltam a marcar "não salvo"
            const img = await enviarImagem(new File([blob], 'desenho.png', { type: 'image/png' }));
            const antigo = atual.imagemPath;
            const eraNovo = !atual.src && !atual.imagemPath;
            const comTraco = desenhouAgora;
            desenhouAgora = false;
            const salvo = await salvar('desenhos', { ...atual, titulo, src: img.src, imagemPath: img.path || null, atualizadoPor: eu });
            atual = salvo;
            desenhos = [salvo, ...desenhos.filter((x) => x.id !== salvo.id)];
            if (antigo && antigo !== img.path) removerImagem(antigo);
            enviar('quadro-salvo', {});
            if (comTraco) avisarDesenho(salvo, eraNovo);
            mostrarStatus();
            if (avisar) toast('Desenho salvo!', 'sucesso', { duracao: 1800 });
          } catch (e) {
            quadro.marcarAlterado();
            mostrarStatus('Não foi possível salvar. Tente de novo.');
            toast(e.message || 'Não foi possível salvar o desenho.', 'erro');
          } finally {
            salvando = null;
          }
        })();
        return salvando;
      }

      /** Conta para o outro que tem desenho novo (se ele não estiver olhando este desenho agora). */
      function avisarDesenho(d, novo) {
        const outroAqui = Date.now() - (vistos.get(outro.id) || 0) < 10000;
        const ultimo = ultimoAvisoQuadro.get(d.id) || 0;
        if (outroAqui || Date.now() - ultimo < INTERVALO_AVISO_QUADRO) return;
        ultimoAvisoQuadro.set(d.id, Date.now());
        const titulo = d.titulo || 'Desenho sem título';
        if (podeSincronizar()) sala.enviar('quadro-novidade', { desenhoId: d.id, para: outro.id, titulo, novo });
        notificarOutro({
          titulo: novo ? `${ctx.perfil.nome} fez um desenho novo` : `${ctx.perfil.nome} desenhou no quadro branco`,
          corpo: `"${titulo}". Toque para ver (e desenhar junto).`,
          url: `/#/diversao?desenho=${d.id}`,
          tag: 'quadro-branco',
        });
      }

      function desenharPresenca() {
        const agora = Date.now();
        const aqui = [...vistos.entries()].filter(([, t]) => agora - t < 10000).map(([p]) => p);
        presenca.innerHTML = aqui.length
          ? `<span class="ponto ligado" aria-hidden="true"></span> ${esc(nome(aqui[0]))} está neste desenho com você. Os traços aparecem na hora.`
          : (podeSincronizar() ? `<span class="ponto" aria-hidden="true"></span> Quando ${esc(outro.nome)} abrir este desenho, vocês desenham juntos.` : '');
      }

      const pararOuvir = sala ? sala.ouvir((msg) => {
        if (msg.de === eu || msg.desenhoId !== atual.id) return;
        if (msg.tipo?.startsWith('quadro-')) vistos.set(msg.de, Date.now());
        if (msg.tipo === 'quadro-traco' || msg.tipo === 'quadro-desfazer' || msg.tipo === 'quadro-limpar') {
          quadro.aplicarRemoto(msg);
        } else if (msg.tipo === 'quadro-pedir') {
          // quem acabou de abrir quer o desenho atualizado
          enviar('quadro-aqui', {});
          if (quadro.alterado) salvarDesenho();
          else enviar('quadro-salvo', {});
        } else if (msg.tipo === 'quadro-salvo' && !quadro.alterado && Date.now() - abertoEm < 20000) {
          // acabei de entrar e ainda não desenhei: pego a versão salva mais nova
          listar('desenhos').then((todos) => {
            const novo = todos.find((x) => x.id === atual.id);
            if (novo?.src && !quadro.alterado) { atual = novo; quadro.recomecar(novo.src); mostrarStatus(); }
          }).catch(() => {});
          abertoEm = 0;
        } else if (msg.tipo === 'quadro-excluido') {
          toast(`${nome(msg.de)} excluiu este desenho.`, 'info');
          mostrarVisaoGeral();
        }
        desenharPresenca();
      }) : () => {};

      const sinal = setInterval(() => { enviar('quadro-aqui', {}); desenharPresenca(); }, 4000);
      enviar('quadro-pedir', {});

      el.querySelector('[data-salvar-desenho]').addEventListener('click', () => salvarDesenho({ avisar: true }));
      el.querySelector('[data-baixar-desenho]').addEventListener('click', async () => {
        try {
          const blob = await quadro.exportar();
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${(campoTitulo.value.trim() || 'desenho').replace(/[^\w\-]+/g, '-').toLowerCase()}.png`;
          document.body.append(a);
          a.click();
          a.remove();
          setTimeout(() => URL.revokeObjectURL(url), 2000);
        } catch (e) { toast(e.message, 'erro'); }
      });
      el.querySelector('[data-voltar-desenhos]').addEventListener('click', async () => {
        await salvarDesenho();
        if (location.hash.includes('?')) history.replaceState(null, '', '#/diversao');
        mostrarVisaoGeral({ focar: true });
      });
      campoTitulo.addEventListener('change', () => salvarDesenho());

      if (atual.src) quadro.carregarBase(atual.src).then((ok) => { if (!ok) toast('Não foi possível carregar a última versão deste desenho.', 'erro'); });
      mostrarStatus();
      desenharPresenca();
      campoTitulo.focus({ preventScroll: true });

      return () => {
        clearInterval(sinal);
        pararOuvir();
        if (quadro.alterado) salvarDesenho();
        enviar('quadro-saiu', {});
        quadro.destruir();
      };
    });
  }

  // ---------------- Como eu te vejo: desenhar e enviar ----------------
  function abrirComo() {
    trocarModo(() => {
      const pergunta = perguntaDoDia();
      el.innerHTML = `
        <div class="cabecalho-secao">
          <div>
            <h1 class="titulo-pagina">${esc(pergunta.texto)}?</h1>
            <p>Desenhe como você vê ${esc(outro.nome)}. Quando terminar, envie: o desenho chega nas Cartinhas de ${esc(outro.nome)}.</p>
          </div>
          <button type="button" class="botao-fantasma" data-cancelar-como>${icone('esquerda')} Voltar</button>
        </div>
        <div data-quadro-como></div>
        <form class="formulario envio-como" data-form-como novalidate>
          <div class="campo">
            <label for="legenda-como">Recadinho junto <span class="dica">(opcional)</span></label>
            <input id="legenda-como" name="legenda" maxlength="120" placeholder="Ex.: uma raposinha esperta, igual a você">
          </div>
          <div class="grupo-botoes">
            <button type="submit" class="botao">${icone('carta')} Enviar para ${esc(outro.nome)}</button>
          </div>
        </form>`;
      const quadro = criarQuadro(el.querySelector('[data-quadro-como]'), { eu, rotulo: `Desenho: ${pergunta.texto}` });
      el.querySelector('h1').setAttribute('tabindex', '-1');
      el.querySelector('h1').focus();

      el.querySelector('[data-cancelar-como]').addEventListener('click', async () => {
        if (!quadro.vazio) {
          const sair = await confirmar({ titulo: 'Descartar o desenho?', mensagem: 'O que você desenhou ainda não foi enviado.', textoConfirmar: 'Descartar' });
          if (!sair) return;
        }
        if (location.hash.includes('?')) history.replaceState(null, '', '#/diversao');
        mostrarVisaoGeral({ focar: true });
      });

      const form = el.querySelector('[data-form-como]');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (quadro.vazio) { toast('Desenhe alguma coisa antes de enviar.', 'info'); return; }
        const botao = form.querySelector('button[type="submit"]');
        botao.disabled = true;
        try {
          const blob = await quadro.exportar();
          const img = await enviarImagem(new File([blob], 'como-eu-te-vejo.png', { type: 'image/png' }));
          const legenda = form.elements.legenda.value.trim().replace(/\s+/g, ' ').slice(0, 120);
          const salvo = await salvar('cartas', {
            tipo: 'desenho',
            titulo: 'Como eu te vejo',
            pergunta: pergunta.texto,
            dia: pergunta.dia,
            legenda,
            mensagem: legenda || pergunta.texto,
            src: img.src,
            imagemPath: img.path || null,
            de: eu,
            autor: ctx.perfil.nome,
            para: outro.id,
            enviadaEm: new Date().toISOString(),
            lidaEm: null,
            exemplo: false,
          });
          avisarOutro(salvo);
          window.dispatchEvent(new CustomEvent('nc:cartas-mudou'));
          respostas.unshift(salvo);
          toast(`Desenho enviado para ${outro.nome}!`, 'sucesso');
          if (location.hash.includes('?')) history.replaceState(null, '', '#/diversao');
          mostrarVisaoGeral({ focar: true });
        } catch (err) {
          toast(err.message || 'Não foi possível enviar o desenho.', 'erro');
          botao.disabled = false;
        }
      });
      return () => quadro.destruir();
    });
  }

  // ---------------- Eventos da visão geral ----------------
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-novo-desenho')) novoDesenho();
    else if (b.hasAttribute('data-como-desenhar')) abrirComo();
    else if (b.dataset.abrirDesenho) {
      const d = desenhos.find((x) => x.id === b.dataset.abrirDesenho);
      if (d) abrirEditor(d);
    } else if (b.dataset.excluirDesenho) excluirDesenho(b.dataset.excluirDesenho);
  });

  el.innerHTML = '<div class="estado"><span class="spinner pequeno" aria-hidden="true"></span> Abrindo a Diversão…</div>';
  await carregar();
  const parametros = new URLSearchParams(location.hash.split('?')[1] || '');
  const alvo = parametros.get('desenho') && desenhos.find((d) => d.id === parametros.get('desenho'));
  if (parametros.has('como')) abrirComo();
  else if (alvo) abrirEditor(alvo);
  else mostrarVisaoGeral();

  return () => { limparModo?.(); limparModo = null; };
}

