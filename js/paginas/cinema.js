// Cinema: sala decorada + player oficial do YouTube (IFrame API)
//  - Sessão juntos: o que um perfil coloca/pausa/avança aparece na tela do outro (sala-cinema.js)
//    Sincronia fina (../sincronia-cinema.js): quem agiu por último é o "maestro" e manda a posição
//    a cada 2 s; o outro corrige acelerando/desacelerando um pouco ou pulando. O atraso da internet
//    é medido com ping/pong, então relógios diferentes nos aparelhos não atrapalham. Se o vídeo de
//    um travar para carregar, o do outro pausa e espera.
//  - Reações (risada, tristeza, pipoca, susto) que flutuam na tela dos dois
//  - Todo vídeo assistido fica salvo em "Sessões"; os preferidos ganham estrela em "Favoritos"
//  - Chat do casal ao lado do vídeo (../chat-cinema.js)
//  - "Sessões do dia": fila de vídeos; no fim de cada vídeo passam os créditos (5 s)
//    e o próximo da fila começa, com a cortina abrindo
//  - O tempo com vídeo tocando vira Recompensas do Cinema (aba "Conquistas")
// Respeita as regras de incorporação do YouTube: nada de download nem remoção de anúncios/controles.
import { listar, salvar, remover, obterAjustes, salvarAjustes } from '../store/index.js';
import { salaAtual } from '../sala-cinema.js';
import { PERFIS } from '../auth.js';
import { icone } from '../ui/icones.js';
import { adesivo, enfeite } from '../ui/ilustracoes.js';
import { esc, toast, confirmar, abrirModal, lerFormulario, marcarErro, limparErros, formatarData } from '../ui/dom.js';
import { temaAtual, aoMudarTema } from '../tema.js';
import { somarTempoCinema, gravarTempoCinema, lerProgresso, carregarRecompensas } from '../recompensas.js';
import { montarPainelConquistas } from '../conquistas.js';
import { montarChat, MAX_MENSAGEM } from '../chat-cinema.js';
import { notificarOutro } from '../notificacoes.js';
import { lerFila, adicionarNaFila, removerDaFila, moverNaFila, infoDoYoutube, MAX_FILA } from '../fila-cinema.js';
import { criarRelogio, decidirCorrecao, maestroVence, ADIANTO_PULO } from '../sincronia-cinema.js';

export const REACOES = {
  risada: { emoji: '😂', nome: 'Risada' },
  tristeza: { emoji: '😢', nome: 'Tristeza' },
  pipoca: { emoji: '🍿', nome: 'Pipoca' },
  susto: { emoji: '😱', nome: 'Susto' },
};

export function extrairIdYoutube(entrada) {
  const s = String(entrada || '').trim();
  if (/^[\w-]{11}$/.test(s)) return s;
  let url;
  try { url = new URL(/^https?:\/\//i.test(s) ? s : `https://${s}`); } catch { return null; }
  const host = url.hostname.replace(/^(www|m|music)\./, '');
  let id = null;
  if (host === 'youtu.be') id = url.pathname.slice(1).split('/')[0];
  else if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    if (url.pathname === '/watch') id = url.searchParams.get('v');
    else id = url.pathname.match(/^\/(?:embed|shorts|live|v)\/([\w-]{11})/)?.[1] || null;
  }
  return id && /^[\w-]{11}$/.test(id) ? id : null;
}

const miniatura = (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
const linkYoutube = (id) => `https://www.youtube.com/watch?v=${id}`;
const SALA_VALIDA_MS = 4 * 60 * 60 * 1000;

// Carrega a IFrame API do YouTube uma única vez
let promessaApi = null;
function carregarApiYoutube() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (promessaApi) return promessaApi;
  promessaApi = new Promise((ok, falha) => {
    const anterior = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { anterior?.(); ok(window.YT); };
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    s.async = true;
    s.onerror = () => { promessaApi = null; falha(new Error('api')); };
    document.head.append(s);
    setTimeout(() => { if (!window.YT?.Player) { promessaApi = null; falha(new Error('tempo')); } }, 10000);
  });
  return promessaApi;
}

const ERROS_PLAYER = {
  2: 'O link parece inválido. Confira o endereço do vídeo.',
  5: 'O navegador não conseguiu reproduzir este vídeo aqui.',
  100: 'Este vídeo não foi encontrado ou é privado.',
  101: 'O dono deste vídeo não permite que ele seja reproduzido fora do YouTube.',
  150: 'O dono deste vídeo não permite que ele seja reproduzido fora do YouTube.',
  153: 'O YouTube recusou a reprodução incorporada deste vídeo.',
};

const letreiro = () => 'Cineminha';
const SALA_ENFEITES = {
  mistica: ['lua-mistica', 'constelacao', 'gato-preto', 'cristal'],
  punk: ['estrela-verde', 'estrela-verde', 'guitarra-estrela', 'caixa-som'],
  laco: ['laco-rosa', 'laco-rosa', 'tulipa', 'pinguinzinha'],
  onda: ['concha', 'estrela-mar', 'onda', 'prancha'],
  aquarela: ['nuvem-gordinha', 'flores-campo', 'gatinho', 'vinil'],
};

function enfeitesSala(tema) {
  const lista = SALA_ENFEITES[tema] || SALA_ENFEITES.laco;
  return lista.map((id, n) => `<span class="sala-enfeite se-${n + 1}">${adesivo(id)}</span>`).join('');
}

function poltronas() {
  const assento = (x) => `<g transform="translate(${x} 0)"><rect x="2" y="6" width="36" height="26" rx="10" class="pol-encosto"/><rect x="0" y="26" width="40" height="14" rx="6" class="pol-assento"/></g>`;
  return `<svg class="poltronas" viewBox="0 0 520 44" preserveAspectRatio="xMidYMax meet" aria-hidden="true">${Array.from({ length: 11 }, (_, i) => assento(6 + i * 46.5)).join('')}</svg>`;
}

const ehFavorito = (v) => v.favorito !== false; // favoritos antigos não tinham o campo
const classeModo = (modo) => (modo ? `modo-${modo}` : '');

export async function renderizar(el, ctx) {
  const eu = ctx.perfil.id;
  const outro = Object.values(PERFIS).find((p) => p.id !== eu);
  const nome = (id) => PERFIS[id]?.nome || 'Alguém';
  const sala = salaAtual();

  let videos = [];
  let aba = /[?&]conquistas\b/.test(location.hash) ? 'conquistas' : 'sessoes';
  let limparPainel = null;
  let player = null;
  let playerPronto = null;
  let usandoApi = true;
  let videoAtual = null; // { youtubeId, titulo, docId, escolhidoPor, canal }
  let fila = [];
  let timerCreditos = null;
  let timerCortina = null;
  let cortinaFechadaEm = 0;
  let aplicandoRemotoAte = 0;
  let estadoEsperado = null; // estado que o comando remoto vai provocar (o "eco" a ignorar)
  let ultimoRemoto = null;
  let jaInteragiu = false;
  let timerPersistir = null;
  const timersReacao = new Map();
  let juntosLigado = true;
  // Sincronia fina
  const relogio = criarRelogio();
  let maestro = { perfil: eu, desde: 0 }; // quem guia a sessão (desde: horário no MEU relógio; 0 = ninguém agiu)
  let pausaCorrecaoAte = 0;
  let timerTaxa = null;
  let esperando = null;       // { de, timer }: pausei para esperar o outro carregar
  let timerCarregando = null;
  let avisouCarregando = false;
  let tocavaAntes = false;
  let ultimaDiferenca = null;
  let estadoSinc = '';        // 'ok' | 'ajustando' (visto por quem acompanha)
  let relatoOutro = null;     // { estado, dif, em } enviado por quem acompanha
  let ultimoPulsoEm = 0;
  let marcaEnvio = null;      // { pos, em }: para saber se o vídeo está andando (anúncio = tempo parado)
  let marcaCorrecao = null;
  let marcaTravado = null;
  let ticksParado = 0;
  try { juntosLigado = localStorage.getItem('nc:cinema-juntos') !== 'nao'; } catch { /* ignora */ }

  el.innerHTML = '<div class="estado"><span class="spinner pequeno" aria-hidden="true"></span> Preparando a sala…</div>';
  try {
    videos = await listar('videos');
  } catch (e) {
    el.innerHTML = `<div class="aviso erro" role="alert">${icone('alerta')}<p>${esc(e.message)}</p></div>`;
    return;
  }

  const suportaTelaCheia = Boolean(document.fullscreenEnabled || document.webkitFullscreenEnabled);

  el.innerHTML = `
    <div class="cabecalho-secao">
      <div>
        <h1 class="titulo-pagina">Cinema</h1>
        <p>Apaguem as luzes, peguem a pipoca e escolham um vídeo do YouTube.</p>
      </div>
    </div>

    <section class="sala ${classeModo(lerProgresso().modoCinema)}" aria-label="Sala de cinema">
      <div class="letreiro"><span class="letreiro-texto">${letreiro(temaAtual())}</span></div>
      <div class="palco">
        <div class="cortina esquerda" aria-hidden="true"></div>
        <div class="cortina direita" aria-hidden="true"></div>
        <div class="sala-enfeites" aria-hidden="true">${enfeitesSala(temaAtual())}</div>
        <div class="tela-moldura">
          <div class="tela-cheia" id="tela-cheia">
            <div class="tela" id="tela-cinema">
              <div class="tela-vazia" id="tela-vazia">
                ${icone('cinema')}
                <p>A tela está esperando um filme.</p>
                <p class="dica">Cole um link do YouTube logo abaixo ou escolha uma sessão.</p>
              </div>
              <div id="player-youtube" hidden></div>
              <div class="reacoes-voando" aria-hidden="true"></div>
              <div class="chat-flutuante" aria-hidden="true"></div>
              <div class="creditos" id="creditos" role="status" hidden></div>
              <div class="tela-entrar" id="tela-entrar" hidden></div>
              <div class="sinc-espera" data-sinc-espera role="status" hidden></div>
              <div class="tela-aviso" id="tela-aviso" role="alert" hidden></div>
            </div>
            <div class="barra-reacoes" role="group" aria-label="Reações">
              ${Object.entries(REACOES).map(([id, r]) => `
                <button type="button" class="botao-reacao" data-reagir="${id}" aria-label="Reagir com ${r.nome}" title="${r.nome}">
                  <span class="emoji" aria-hidden="true">${r.emoji}</span><span class="rotulo-reacao">${r.nome}</span>
                </button>`).join('')}
            </div>
            <form class="chat-rapido" data-chat-rapido novalidate>
              <label for="chat-rapido-texto" class="sr-only">Mensagem para ${esc(outro.nome)}</label>
              <input id="chat-rapido-texto" class="entrada" name="texto" maxlength="${MAX_MENSAGEM}" autocomplete="off" placeholder="Escreva para ${esc(outro.nome)}…">
              <button type="submit" class="botao pequeno" aria-label="Enviar mensagem">${icone('enviar')}</button>
            </form>
          </div>
        </div>
      </div>
      ${poltronas()}
    </section>

    <div class="cinema-baixo">
    <section class="cartao controles-cinema" aria-labelledby="titulo-controles">
      <h2 id="titulo-controles" class="sr-only">Carregar vídeo</h2>
      <div class="sala-status" id="sala-status" aria-live="polite"></div>
      <p class="sinc-estado" data-sinc role="status" hidden><span class="ponto" aria-hidden="true"></span><span></span></p>
      <form class="formulario" id="form-video" novalidate>
        <div class="campo">
          <label for="url-video">Link ou ID de um vídeo do YouTube</label>
          <div class="entrada-com-botao">
            <input class="entrada" id="url-video" name="url" placeholder="https://www.youtube.com/watch?v=…" autocomplete="off" inputmode="url">
            <button type="submit" class="botao">${icone('play')} Carregar</button>
            <button type="button" class="botao-sec" data-por-na-fila>${icone('mais')} Pôr na fila</button>
          </div>
          <p class="dica">Aceita links do tipo youtube.com/watch, youtu.be, /shorts e /embed. Todo vídeo carregado fica salvo em "Sessões". "Pôr na fila" guarda o vídeo nas Sessões do dia, para tocar depois.</p>
        </div>
      </form>
      <div class="grupo-botoes">
        <label class="interruptor">
          <input type="checkbox" data-juntos ${juntosLigado ? 'checked' : ''}>
          <span class="interruptor-trilho" aria-hidden="true"></span>
          <span>Assistir junto com ${esc(outro.nome)}</span>
        </label>
        <button type="button" class="botao" data-chamar>${icone('megafone')} Chamar ${esc(outro.nome)}</button>
        <button type="button" class="botao-sec" data-favoritar-atual disabled>${icone('estrela')} Favoritar</button>
        <button type="button" class="botao-sec" data-tela-cheia disabled>${icone('telacheia')} Tela cheia</button>
        ${suportaTelaCheia ? '' : '<span class="dica">Tela cheia não é suportada neste navegador.</span>'}
      </div>
    </section>
    <aside class="cartao chat-cinema" id="chat-cinema"></aside>
    </div>

    <section class="cartao fila-cinema" aria-labelledby="titulo-fila">
      <div class="fila-topo">
        <div>
          <h2 id="titulo-fila" class="subtitulo">${icone('lista')} Sessões do dia</h2>
          <p class="dica">A fila de hoje, para os dois. No fim de cada vídeo passam os créditos e o próximo começa sozinho.</p>
        </div>
        <button type="button" class="botao" data-comecar-fila hidden>${icone('play')} Começar a sessão</button>
      </div>
      <div data-fila aria-live="polite"></div>
    </section>

    <section class="secao-videos" aria-labelledby="titulo-videos">
      <h2 id="titulo-videos" class="sr-only">Vídeos e conquistas</h2>
      <div class="abas" role="tablist" aria-label="Vídeos e conquistas">
        <button type="button" class="aba" role="tab" id="aba-sessoes" aria-controls="painel-videos" data-aba-video="sessoes"></button>
        <button type="button" class="aba" role="tab" id="aba-favoritos" aria-controls="painel-videos" data-aba-video="favoritos"></button>
        <button type="button" class="aba" role="tab" id="aba-conquistas" aria-controls="painel-videos" data-aba-video="conquistas"></button>
      </div>
      <div id="painel-videos" role="tabpanel"></div>
    </section>`;

  const tela = el.querySelector('#tela-cinema');
  const telaCheia = el.querySelector('#tela-cheia');
  const palco = el.querySelector('.palco');
  const vazia = el.querySelector('#tela-vazia');
  const aviso = el.querySelector('#tela-aviso');
  const entrar = el.querySelector('#tela-entrar');
  const alvoPlayer = el.querySelector('#player-youtube');
  const voando = el.querySelector('.reacoes-voando');
  const botaoFavoritar = el.querySelector('[data-favoritar-atual]');
  const botaoTelaCheia = el.querySelector('[data-tela-cheia]');
  const form = el.querySelector('#form-video');
  const statusSala = el.querySelector('#sala-status');
  const creditos = el.querySelector('#creditos');
  const sincEl = el.querySelector('[data-sinc]');
  const esperaEl = el.querySelector('[data-sinc-espera]');
  const filaEl = el.querySelector('[data-fila]');
  const botaoComecar = el.querySelector('[data-comecar-fila]');

  const pararOuvirTema = aoMudarTema((t) => {
    el.querySelector('.letreiro-texto').textContent = letreiro(t);
    el.querySelector('.sala-enfeites').innerHTML = enfeitesSala(t);
  });

  // ---------------- Status da sala compartilhada ----------------
  function desenharStatus() {
    if (!juntosLigado) {
      statusSala.innerHTML = `<span class="ponto desligado" aria-hidden="true"></span> Assistindo sozinho(a). Ligue "Assistir junto" para sincronizar com ${esc(outro.nome)}.`;
      return;
    }
    if (!sala || sala.tipo === 'nenhum') {
      statusSala.innerHTML = `<span class="ponto desligado" aria-hidden="true"></span> Sessão juntos indisponível neste navegador.`;
      return;
    }
    if (sala.status === 'conectando') { statusSala.innerHTML = '<span class="spinner pequeno" aria-hidden="true"></span> Abrindo a sala compartilhada…'; return; }
    if (sala.status === 'erro') { statusSala.innerHTML = `<span class="ponto erro" aria-hidden="true"></span> ${esc(sala.erro)}`; return; }
    const presente = sala.presentes.has(outro.id);
    const local = sala.tipo === 'local' ? ' <span class="dica">(modo demonstração: sincroniza abas deste navegador)</span>' : '';
    statusSala.innerHTML = presente
      ? `<span class="ponto ligado" aria-hidden="true"></span> <strong>${esc(outro.nome)} está na sala.</strong> O que você colocar, pausar ou avançar aparece para ${esc(outro.nome)} também.${local}`
      : `<span class="ponto" aria-hidden="true"></span> ${esc(outro.nome)} ainda não está na sala. Quando abrir o Cinema, vê o mesmo vídeo no mesmo ponto.${local}`;
  }
  const pararStatus = sala ? sala.aoMudar(desenharStatus) : (desenharStatus(), () => {});

  // ---------------- Player ----------------
  const marcarRemoto = (tocando = null) => { aplicandoRemotoAte = Date.now() + 2000; estadoEsperado = tocando; };
  const tempoAtual = () => { try { return player?.getCurrentTime?.() || 0; } catch { return 0; } };
  const tocandoAgora = () => { try { return player?.getPlayerState?.() === 1; } catch { return false; } };
  const estadoPlayer = () => { try { return player?.getPlayerState?.() ?? -1; } catch { return -1; } };

  function mostrarAviso(mensagem, id) {
    aviso.hidden = false;
    aviso.innerHTML = `
      ${icone('alerta')}
      <p>${esc(mensagem)}</p>
      ${id ? `<a class="botao-sec pequeno" href="${linkYoutube(id)}" target="_blank" rel="noopener noreferrer">${icone('link')} Assistir no YouTube</a>` : ''}`;
  }

  function mostrarEntrar(texto) {
    abrirCortina();
    entrar.hidden = false;
    entrar.innerHTML = `<button type="button" class="botao botao-entrar-sessao" data-entrar-sessao>${icone('play')} ${esc(texto)}</button>`;
  }

  function atualizarBotoes() {
    const doc = videoAtual && videos.find((v) => v.youtubeId === videoAtual.youtubeId);
    const fav = Boolean(doc && ehFavorito(doc));
    botaoFavoritar.disabled = !videoAtual;
    botaoFavoritar.setAttribute('aria-pressed', String(fav));
    botaoFavoritar.innerHTML = `${icone('estrela', fav ? 'cheio' : '')} ${fav ? 'Favoritado' : 'Favoritar'}`;
    if (suportaTelaCheia) botaoTelaCheia.disabled = !videoAtual;
    el.querySelectorAll('[data-yt]').forEach((c) => c.classList.toggle('tocando', c.dataset.yt === videoAtual?.youtubeId));
  }

  function usarIframeSimples(id, inicio) {
    alvoPlayer.innerHTML = `<iframe src="https://www.youtube-nocookie.com/embed/${id}?rel=0&playsinline=1&start=${Math.floor(inicio)}" title="Player do YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerpolicy="strict-origin-when-cross-origin" allowfullscreen></iframe>`;
  }

  function aoMudarEstado(ev) {
    const dados = player?.getVideoData?.();
    if (videoAtual && dados?.video_id === videoAtual.youtubeId) {
      aviso.hidden = true;
      if (dados.title) atualizarTituloAutomatico(dados.title);
      if (dados.author) videoAtual.canal = dados.author;
    }
    if (ev.data === 3) comecouCarregar();
    else { terminouCarregar(ev.data); tocavaAntes = ev.data === 1; }
    if (ev.data === 1 && esperando) terminarEspera(null, { tocar: false });
    if (ev.data === 1) { entrar.hidden = true; jaInteragiu = true; abrirCortina(); esconderCreditos(); }
    if (ev.data === 0) mostrarCreditos();
    marcarTocando(ev.data === 1);
    if (ev.data === 2 || ev.data === 0) salvarTempoEConferir();
    if (ev.data !== 1 && ev.data !== 2 && ev.data !== 0) return;
    const tocando = ev.data === 1;
    // Ignora só o eco do comando que veio do outro perfil; ações da própria pessoa sempre passam
    if (Date.now() < aplicandoRemotoAte && (estadoEsperado === null || estadoEsperado === tocando)) {
      estadoEsperado = null;
      aplicandoRemotoAte = 0;
      return;
    }
    enviarEstado(tocando);
  }

  /** Mostra um vídeo na tela. tocar=true tenta reproduzir (pode exigir um toque, regra dos navegadores). */
  async function mostrarVideo(id, titulo, { inicio = 0, tocar = false, escolhidoPor = null } = {}) {
    const novo = videoAtual?.youtubeId !== id;
    videoAtual = {
      youtubeId: id,
      titulo: titulo || (novo ? '' : videoAtual?.titulo) || '',
      docId: videos.find((v) => v.youtubeId === id)?.id,
      escolhidoPor: escolhidoPor || (novo ? null : videoAtual?.escolhidoPor) || eu,
      canal: novo ? '' : (videoAtual?.canal || ''),
    };
    esconderCreditos();
    if (novo) { fecharCortina(); voltarVelocidadeNormal(); terminarEspera(null, { tocar: false }); }
    aviso.hidden = true;
    entrar.hidden = true;
    vazia.hidden = true;
    alvoPlayer.hidden = false;
    palco.classList.add('em-sessao');
    atualizarBotoes();

    if (!usandoApi) { usarIframeSimples(id, inicio); setTimeout(abrirCortina, 1200); return; }
    try {
      const YT = await carregarApiYoutube();
      if (!el.isConnected) return;
      if (player?.loadVideoById) {
        await playerPronto;
        if (tocar) player.loadVideoById({ videoId: id, startSeconds: inicio });
        else player.cueVideoById({ videoId: id, startSeconds: inicio });
        return;
      }
      alvoPlayer.innerHTML = '<div id="yt-alvo"></div>';
      playerPronto = new Promise((pronto) => {
        player = new YT.Player('yt-alvo', {
          videoId: id,
          host: 'https://www.youtube-nocookie.com',
          playerVars: { rel: 0, playsinline: 1, origin: location.origin, start: Math.floor(inicio), autoplay: tocar ? 1 : 0 },
          events: {
            onReady: () => pronto(),
            onError: (ev) => mostrarAviso(ERROS_PLAYER[ev.data] || 'Não foi possível reproduzir este vídeo aqui.', videoAtual?.youtubeId),
            onStateChange: aoMudarEstado,
          },
        });
      });
      await playerPronto;
    } catch {
      usandoApi = false;
      usarIframeSimples(id, inicio);
      statusSala.insertAdjacentHTML('beforeend', '<p class="dica">O player oficial não carregou; a sincronização fica desligada nesta tela.</p>');
    }
  }

  // ---------------- Sincronização ----------------
  const podeSincronizar = () => juntosLigado && sala && sala.status === 'ok';

  function persistirSala(dados) {
    clearTimeout(timerPersistir);
    timerPersistir = setTimeout(() => {
      salvarAjustes({ cinemaAtual: { ...dados, de: eu, em: Date.now() } }).catch(() => { /* sem conexão: tudo bem */ });
    }, 1500);
  }

  function enviarEstado(tocando) {
    if (!videoAtual || !usandoApi) return;
    const dados = { youtubeId: videoAtual.youtubeId, titulo: videoAtual.titulo, escolhidoPor: videoAtual.escolhidoPor, tocando, posicao: tempoAtual() };
    // não devolve o eco do que acabou de chegar do outro perfil
    if (ultimoRemoto && Date.now() - ultimoRemoto.recebidoEm < 2500 && ultimoRemoto.tocando === tocando
      && Math.abs(ultimoRemoto.posicaoEstimada() - dados.posicao) < 1.5) return;
    assumirMaestro(); // ação minha: agora eu guio a sessão
    if (podeSincronizar()) sala.enviar('estado', dados);
    if (juntosLigado) persistirSala(dados);
  }

  /** Posição do outro, estimada para "agora": posição enviada + atraso medido da internet + tempo desde que chegou. */
  function estimador(msg) {
    const recebidoEm = Date.now();
    const base = (Number(msg.posicao) || 0) + (msg.tocando ? relogio.atrasoDe(msg.em, recebidoEm) : 0);
    return () => base + (msg.tocando ? (Date.now() - recebidoEm) / 1000 : 0);
  }

  async function aplicarRemoto(msg, { carregarSeNovo = true } = {}) {
    if (!juntosLigado) return;
    const recebidoEm = Date.now();
    const posicaoEstimada = estimador(msg);
    ultimoRemoto = { ...msg, recebidoEm, posicaoEstimada };
    if (!videoAtual || videoAtual.youtubeId !== msg.youtubeId) {
      if (!carregarSeNovo) return;
      marcarRemoto(msg.tocando && jaInteragiu);
      await mostrarVideo(msg.youtubeId, msg.titulo, { inicio: posicaoEstimada(), tocar: msg.tocando && jaInteragiu, escolhidoPor: msg.escolhidoPor || msg.de });
      if (msg.tocando && !jaInteragiu) mostrarEntrar(`Assistir junto com ${nome(msg.de)}`);
      else if (msg.tocando) conferirAutoplay(msg.de);
      setTimeout(recarregarVideos, 1500);
      return;
    }
    if (!usandoApi || !player?.seekTo) return;
    await playerPronto;
    const alvo = posicaoEstimada();
    const precisaPular = Math.abs(tempoAtual() - alvo) > 1.5;
    const precisaMudar = msg.tocando !== tocandoAgora();
    if (!precisaPular && !precisaMudar) return;
    marcarRemoto(msg.tocando);
    voltarVelocidadeNormal();
    pausaCorrecaoAte = Date.now() + 2500; // deixa assentar antes da correção fina
    if (precisaPular) player.seekTo(alvo + (msg.tocando ? ADIANTO_PULO : 0), true);
    if (msg.tocando) { player.playVideo(); conferirAutoplay(msg.de); } else player.pauseVideo();
  }

  // ---------------- Sincronia fina ----------------
  const comOutro = () => podeSincronizar() && sala.presentes.has(outro.id);
  const souMaestro = () => maestro.perfil === eu;

  function assumirMaestro() {
    maestro = { perfil: eu, desde: Date.now() };
    voltarVelocidadeNormal();
  }

  /** Outro perfil agiu ou está guiando: vira maestro se a ação dele for a mais recente. */
  function considerarMaestro(de, desdeDele) {
    const candidato = { perfil: de, desde: desdeDele ? relogio.paraMeu(desdeDele) : 0 };
    if (maestro.perfil === de || maestroVence(maestro, candidato)) { maestro = candidato; return true; }
    return false;
  }

  const taxasDisponiveis = () => { try { return player?.getAvailablePlaybackRates?.() || []; } catch { return []; } };

  function mudarVelocidade(taxa, segundos) {
    try { player.setPlaybackRate(taxa); } catch { return; }
    clearTimeout(timerTaxa);
    timerTaxa = setTimeout(() => { timerTaxa = null; try { player?.setPlaybackRate?.(1); } catch { /* ignora */ } desenharSinc(); }, Math.min(segundos, 8) * 1000);
  }

  function voltarVelocidadeNormal() {
    clearTimeout(timerTaxa);
    timerTaxa = null;
    try { if (player?.getPlaybackRate?.() !== 1) player?.setPlaybackRate?.(1); } catch { /* ignora */ }
  }

  /** Tocando mas o tempo do vídeo não anda (anúncio do YouTube, travado): não serve de referência. */
  function tempoParado(st, marca) {
    const agora = { pos: tempoAtual(), em: Date.now() };
    const parado = st === 1 && marca && agora.em - marca.em < 5000 && agora.em - marca.em > 900 && agora.pos - marca.pos < 0.3;
    return { parado, agora };
  }

  function enviarPulso() {
    if (!videoAtual || !usandoApi || !player || esperando || !creditos.hidden) return;
    const st = estadoPlayer();
    if (![1, 2, 5].includes(st)) return; // carregando ou terminou: posição não é confiável
    const { parado, agora } = tempoParado(st, marcaEnvio);
    marcaEnvio = agora;
    if (parado) return;
    sala.enviar('sinc-pulso', { youtubeId: videoAtual.youtubeId, titulo: videoAtual.titulo, escolhidoPor: videoAtual.escolhidoPor, tocando: st === 1, posicao: tempoAtual(), desde: maestro.desde });
  }

  function receberPulso(msg) {
    if (!considerarMaestro(msg.de, msg.desde)) return; // eu agi depois: continuo guiando
    ultimoPulsoEm = Date.now();
    if (!videoAtual || videoAtual.youtubeId !== msg.youtubeId) { aplicarRemoto(msg); return; }
    corrigir(msg);
  }

  /** Correção fina de quem acompanha o maestro. */
  function corrigir(msg) {
    if (!usandoApi || !player?.seekTo || esperando || !creditos.hidden || !entrar.hidden) return;
    if (Date.now() < pausaCorrecaoAte || Date.now() < aplicandoRemotoAte) return;
    const st = estadoPlayer();
    if (st === 3 || st === -1 || st === 0) return;
    const tocandoLa = Boolean(msg.tocando);
    if (tocandoLa !== (st === 1)) { aplicarRemoto(msg, { carregarSeNovo: false }); return; }
    const { parado, agora } = tempoParado(st, marcaCorrecao);
    marcaCorrecao = agora;
    if (parado) return; // estou num anúncio: espera ele acabar
    const alvo = estimador(msg)();
    const diferenca = tempoAtual() - alvo;
    ultimaDiferenca = diferenca;
    const decisao = decidirCorrecao({ diferenca, tocando: tocandoLa, taxas: taxasDisponiveis() });
    if (decisao.acao === 'nada') {
      if (!timerTaxa) voltarVelocidadeNormal();
      definirEstadoSinc('ok');
    } else if (decisao.acao === 'velocidade') {
      mudarVelocidade(decisao.taxa, decisao.duracao);
      definirEstadoSinc('ajustando');
    } else {
      voltarVelocidadeNormal();
      marcarRemoto(tocandoLa);
      player.seekTo(alvo + (tocandoLa ? ADIANTO_PULO : 0), true);
      pausaCorrecaoAte = Date.now() + 3000;
      definirEstadoSinc('ajustando');
    }
  }

  function definirEstadoSinc(novo) {
    const mudou = novo !== estadoSinc;
    estadoSinc = novo;
    if (mudou && comOutro()) sala.enviar('sinc-relato', { estado: novo, dif: ultimaDiferenca });
    desenharSinc();
  }

  // Travou para carregar: depois de 1,2 s avisa o outro, que pausa e espera
  function comecouCarregar() {
    if (timerCarregando || avisouCarregando) return;
    timerCarregando = setTimeout(() => {
      timerCarregando = null;
      if (estadoPlayer() !== 3 || !tocavaAntes || !videoAtual || !comOutro()) return;
      avisouCarregando = true;
      sala.enviar('sinc-carregando', { youtubeId: videoAtual.youtubeId, posicao: tempoAtual() });
    }, 1200);
  }

  function terminouCarregar(st) {
    clearTimeout(timerCarregando);
    timerCarregando = null;
    if (!avisouCarregando) return;
    avisouCarregando = false;
    if (videoAtual && comOutro()) sala.enviar('sinc-pronto', { youtubeId: videoAtual.youtubeId, posicao: tempoAtual(), tocando: st === 1 });
  }

  function receberCarregando(msg) {
    if (!videoAtual || msg.youtubeId !== videoAtual.youtubeId || !usandoApi || !player?.pauseVideo || esperando) return;
    if (estadoPlayer() !== 1) return;
    voltarVelocidadeNormal();
    marcarRemoto(false);
    player.pauseVideo();
    esperando = { de: msg.de, timer: setTimeout(() => terminarEspera(null), 12000) }; // não espera para sempre
    desenharSinc();
  }

  /** Fim da espera: com `msg` (o outro terminou de carregar) volta junto no ponto dele. */
  function terminarEspera(msg, { tocar = true } = {}) {
    const e = esperando;
    if (!e) return;
    clearTimeout(e.timer);
    esperando = null;
    desenharSinc();
    if (!tocar || !player?.playVideo) return;
    if (msg && msg.tocando === false) return; // o outro pausou: fica pausado também
    if (msg) {
      const alvo = estimador({ ...msg, tocando: true })();
      if (Math.abs(tempoAtual() - alvo) > 0.25) player.seekTo(alvo, true);
    }
    marcarRemoto(true);
    pausaCorrecaoAte = Date.now() + 2000;
    player.playVideo();
  }

  function desenharSinc() {
    const agora = Date.now();
    let texto = '';
    let classe = 'ok';
    let detalhe = '';
    if (comOutro() && videoAtual && usandoApi && juntosLigado) {
      if (esperando) { texto = `Esperando ${nome(esperando.de)} carregar…`; classe = 'esperando'; }
      else if (souMaestro()) {
        const relato = relatoOutro && agora - relatoOutro.em < 12000 ? relatoOutro : null;
        if (relato) {
          texto = relato.estado === 'ajustando' ? `${nome(outro.id)} está se ajustando…` : `Sincronizados com ${nome(outro.id)}`;
          classe = relato.estado === 'ajustando' ? 'ajustando' : 'ok';
          if (Number.isFinite(relato.dif)) detalhe = `Diferença: ${Math.abs(relato.dif).toFixed(1).replace('.', ',')} s`;
        }
      } else if (agora - ultimoPulsoEm < 7000) {
        const ajustando = estadoSinc === 'ajustando' || timerTaxa || agora < pausaCorrecaoAte;
        texto = ajustando ? 'Ajustando a sincronia…' : `Sincronizados com ${nome(maestro.perfil)}`;
        classe = ajustando ? 'ajustando' : 'ok';
        if (Number.isFinite(ultimaDiferenca)) detalhe = `Diferença: ${Math.abs(ultimaDiferenca).toFixed(1).replace('.', ',')} s`;
      }
    }
    const ida = relogio.ida();
    if (texto && ida !== null) detalhe += `${detalhe ? ' · ' : ''}Conexão: ${Math.round(ida * 2)} ms`;
    sincEl.hidden = !texto;
    if (sincEl.dataset.texto !== texto) { sincEl.dataset.texto = texto; sincEl.querySelector('span:last-child').textContent = texto; }
    sincEl.className = `sinc-estado ${classe}`;
    sincEl.title = detalhe;
    sincEl.dataset.dif = Number.isFinite(ultimaDiferenca) ? ultimaDiferenca.toFixed(2) : '';
    esperaEl.hidden = !esperando;
    if (esperando) esperaEl.textContent = `Esperando ${nome(esperando.de)} carregar…`;
  }

  /** "Tocando" mas o tempo não anda há 2 s (anúncio do YouTube, rede presa): trata como travada. */
  function verificarTravado() {
    const st = estadoPlayer();
    const agora = { pos: tempoAtual(), em: Date.now(), st };
    const anterior = marcaTravado;
    marcaTravado = agora;
    const parado = st === 1 && anterior?.st === 1 && agora.em - anterior.em < 3000 && agora.pos - anterior.pos < 0.3;
    ticksParado = parado ? ticksParado + 1 : 0;
    if (!videoAtual || !comOutro() || timerCarregando) return;
    if (ticksParado >= 2 && !avisouCarregando && !esperando) {
      avisouCarregando = true;
      sala.enviar('sinc-carregando', { youtubeId: videoAtual.youtubeId, posicao: agora.pos });
    } else if (!parado && avisouCarregando && st === 1) {
      avisouCarregando = false;
      sala.enviar('sinc-pronto', { youtubeId: videoAtual.youtubeId, posicao: agora.pos, tocando: true });
    }
  }

  // Relógio da sincronia: mede a conexão, o maestro manda a posição e quem acompanha relata
  let tiqueSinc = 0;
  const relogioSinc = setInterval(() => {
    tiqueSinc += 1;
    verificarTravado();
    if (comOutro()) {
      if (relogio.amostras < 4 ? tiqueSinc % 2 === 0 : tiqueSinc % 15 === 0) sala.enviar('sinc-ping', { t0: Date.now() });
      if (tiqueSinc % 2 === 0 && souMaestro()) enviarPulso();
      if (tiqueSinc % 6 === 0 && !souMaestro() && estadoSinc && Date.now() - ultimoPulsoEm < 7000) sala.enviar('sinc-relato', { estado: estadoSinc, dif: ultimaDiferenca });
    }
    desenharSinc();
  }, 1000);

  /** Navegadores bloqueiam som automático sem um toque: se não tocou, mostra o botão. */
  function conferirAutoplay(de) {
    setTimeout(() => {
      if (!tocandoAgora() && ultimoRemoto?.tocando) mostrarEntrar(`Assistir junto com ${nome(de)}`);
    }, 1800);
  }

  const pararOuvirSala = sala ? sala.ouvir((msg) => {
    if (!juntosLigado) return;
    if (msg.tipo === 'sinc-ping') { sala.enviar('sinc-pong', { para: msg.de, t0: msg.t0, t1: Date.now() }); return; }
    if (msg.tipo === 'sinc-pong') { if (msg.para === eu) relogio.registrar({ t0: msg.t0, t1: msg.t1, t3: Date.now() }); return; }
    if (msg.tipo === 'sinc-pulso') { receberPulso(msg); return; }
    if (msg.tipo === 'sinc-relato') { relatoOutro = { estado: msg.estado, dif: Number(msg.dif), em: Date.now() }; desenharSinc(); return; }
    if (msg.tipo === 'sinc-carregando') { receberCarregando(msg); return; }
    if (msg.tipo === 'sinc-pronto') { if (esperando && msg.youtubeId === videoAtual?.youtubeId) terminarEspera(msg); return; }
    if (msg.tipo === 'carregar' || msg.tipo === 'estado') {
      if (msg.tipo === 'carregar') toast(`${nome(msg.de)} colocou "${msg.titulo || 'um vídeo'}" na tela.`, 'info', { duracao: 3000 });
      // Ação do outro (play, pausa, pulo, vídeo novo) → ele passa a guiar; resposta a "pedir-estado" usa o "desde" dele
      if (msg.resposta) considerarMaestro(msg.de, msg.desde);
      else considerarMaestro(msg.de, msg.em);
      if (esperando) terminarEspera(null, { tocar: false });
      aplicarRemoto(msg);
    } else if (msg.tipo === 'pedir-estado') {
      if (videoAtual && usandoApi) {
        if (!maestro.desde) maestro = { perfil: eu, desde: Date.now() }; // já estava aqui: guio quem chegou
        sala.enviar('estado', { youtubeId: videoAtual.youtubeId, titulo: videoAtual.titulo, escolhidoPor: videoAtual.escolhidoPor, tocando: tocandoAgora(), posicao: tempoAtual(), resposta: true, desde: souMaestro() ? maestro.desde : 0 });
      }
    } else if (msg.tipo === 'reacao' && REACOES[msg.reacao]) {
      if (!videoAtual || msg.youtubeId === videoAtual.youtubeId) soltarReacao(msg.reacao, msg.de);
    }
  }) : () => {};

  // ---------------- Sessões e favoritos ----------------
  async function recarregarVideos() {
    try { videos = await listar('videos'); desenharVideos(); atualizarBotoes(); } catch { /* tenta de novo depois */ }
  }

  async function registrarSessao(id, titulo) {
    if (!titulo) {
      try { const d = player?.getVideoData?.(); if (d?.video_id === id && d.title) titulo = d.title; } catch { /* ainda sem dados */ }
    }
    const existente = videos.find((v) => v.youtubeId === id);
    const vez = { em: new Date().toISOString(), por: eu, juntos: Boolean(podeSincronizar() && sala.presentes.has(outro.id)) };
    const doc = existente
      ? { ...existente, vezes: [vez, ...(existente.vezes || [])].slice(0, 50), ultimoEm: vez.em }
      : { youtubeId: id, titulo: titulo || 'Vídeo do YouTube', tituloAuto: !titulo, favorito: false, vezes: [vez], reacoes: {}, ultimoEm: vez.em };
    try {
      const salvo = await salvar('videos', doc);
      videos = [salvo, ...videos.filter((v) => v.id !== salvo.id)];
      if (videoAtual?.youtubeId === id) videoAtual.docId = salvo.id;
      desenharVideos();
      atualizarBotoes();
    } catch (e) { toast(e.message, 'erro'); }
  }

  async function atualizarTituloAutomatico(titulo) {
    if (videoAtual && !videoAtual.titulo) videoAtual.titulo = titulo;
    const doc = videos.find((v) => v.youtubeId === videoAtual?.youtubeId);
    if (!doc || !doc.tituloAuto || doc.titulo === titulo) return;
    doc.titulo = titulo;
    doc.tituloAuto = false;
    try { const salvo = await salvar('videos', doc); videos = videos.map((v) => (v.id === salvo.id ? salvo : v)); desenharVideos(); } catch { /* ignora */ }
  }

  async function carregarLocal(id, titulo = '', inicio = 0, { escolhidoPor = eu } = {}) {
    jaInteragiu = true;
    const salvo = videos.find((v) => v.youtubeId === id);
    const t = titulo || salvo?.titulo || '';
    await mostrarVideo(id, t, { inicio, tocar: true, escolhidoPor });
    assumirMaestro();
    if (podeSincronizar()) sala.enviar('carregar', { youtubeId: id, titulo: t, escolhidoPor, tocando: true, posicao: inicio });
    if (juntosLigado) persistirSala({ youtubeId: id, titulo: t, escolhidoPor, tocando: true, posicao: inicio });
    registrarSessao(id, t);
    tela.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  function contadorReacoes(v) {
    const r = v.reacoes || {};
    const itens = Object.entries(REACOES).filter(([id]) => r[id]).map(([id, x]) => `<span class="chip-reacao" title="${x.nome}"><span aria-hidden="true">${x.emoji}</span> ${r[id]}<span class="sr-only"> ${x.nome}</span></span>`);
    return itens.length ? `<div class="reacoes-contagem">${itens.join('')}</div>` : '';
  }

  function htmlVideo(v) {
    const vezes = v.vezes?.length || 0;
    const ultima = v.vezes?.[0];
    const fav = ehFavorito(v);
    return `
      <li class="video-cartao ${videoAtual?.youtubeId === v.youtubeId ? 'tocando' : ''}" data-video="${esc(v.id)}" data-yt="${esc(v.youtubeId)}">
        <button type="button" class="video-miniatura" data-assistir aria-label="Assistir ${esc(v.titulo)}">
          <img src="${miniatura(v.youtubeId)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-mini>
          <span class="video-play" aria-hidden="true">${icone('play', 'cheio')}</span>
          ${fav ? `<span class="video-estrela" aria-hidden="true">${icone('estrela', 'cheio')}</span>` : ''}
        </button>
        <div class="video-info">
          <h3>${esc(v.titulo)}</h3>
          <p class="meta">${vezes ? `Assistido ${vezes}× · última vez ${esc(formatarData(ultima.em))}${ultima.por ? ` por ${esc(nome(ultima.por))}` : ''}${ultima.juntos ? ' · juntos' : ''}` : 'Ainda não assistido'}</p>
          ${contadorReacoes(v)}
          <div class="grupo-botoes">
            <button type="button" class="botao pequeno" data-assistir>${icone('play')} Assistir</button>
            <button type="button" class="botao-icone" data-fila-video aria-label="Pôr ${esc(v.titulo)} na fila do dia" title="Pôr na fila do dia">${icone('mais')}</button>
            <button type="button" class="botao-icone" data-favoritar aria-pressed="${fav}" aria-label="${fav ? 'Tirar dos favoritos' : 'Favoritar'}: ${esc(v.titulo)}" title="${fav ? 'Tirar dos favoritos' : 'Favoritar'}">${icone('estrela', fav ? 'cheio' : '')}</button>
            <button type="button" class="botao-icone" data-renomear aria-label="Editar título de ${esc(v.titulo)}" title="Editar título">${icone('editar')}</button>
            <button type="button" class="botao-icone perigo" data-remover aria-label="Remover ${esc(v.titulo)}" title="Remover">${icone('lixeira')}</button>
          </div>
        </div>
      </li>`;
  }

  function desenharAbas() {
    const ordenados = videos.length;
    const favoritos = videos.filter(ehFavorito).length;
    const prog = lerProgresso();
    const abas = {
      sessoes: `Sessões <span class="contador">${ordenados}</span>`,
      favoritos: `${icone('estrela')} Favoritos <span class="contador">${favoritos}</span>`,
      conquistas: `${icone('sparkle')} Conquistas <span class="contador">${prog.desbloqueadas.length}</span>`,
    };
    for (const [id, html] of Object.entries(abas)) {
      const b = el.querySelector(`#aba-${id}`);
      b.innerHTML = html;
      b.setAttribute('aria-selected', String(aba === id));
      b.tabIndex = aba === id ? 0 : -1;
    }
    el.querySelector('#painel-videos').setAttribute('aria-labelledby', `aba-${aba}`);
  }

  function desenharVideos(focarAba = false) {
    desenharAbas();
    if (focarAba) el.querySelector(`[data-aba-video="${aba}"]`)?.focus();
    if (aba === 'conquistas') {
      if (!limparPainel) limparPainel = montarPainelConquistas(el.querySelector('#painel-videos'), ctx.perfil);
      return;
    }
    limparPainel?.();
    limparPainel = null;
    const ordenados = [...videos].sort((a, b) => String(b.ultimoEm || b.atualizadoEm || '').localeCompare(String(a.ultimoEm || a.atualizadoEm || '')));
    const favoritos = ordenados.filter(ehFavorito);
    const lista = aba === 'favoritos' ? favoritos : ordenados;
    el.querySelector('#painel-videos').innerHTML = lista.length
      ? `<ul class="grade grade-videos" role="list">${lista.map(htmlVideo).join('')}</ul>`
      : `<div class="vazio">
          <span class="ilustracao" aria-hidden="true">${enfeite('cinema')}</span>
          <h3>${aba === 'favoritos' ? 'Nenhum favorito ainda' : 'Nenhuma sessão ainda'}</h3>
          <p>${aba === 'favoritos' ? 'Toque na estrela de um vídeo para guardar aqui.' : 'Todo vídeo que vocês colocarem na tela aparece aqui automaticamente.'}</p>
        </div>`;
  }

  async function alternarFavorito(v) {
    try {
      const salvo = await salvar('videos', { ...v, favorito: !ehFavorito(v) });
      videos = videos.map((x) => (x.id === salvo.id ? salvo : x));
      toast(ehFavorito(salvo) ? 'Adicionado aos favoritos.' : 'Removido dos favoritos.', 'sucesso', { duracao: 2000 });
      desenharVideos();
      atualizarBotoes();
    } catch (e) { toast(e.message, 'erro'); }
  }

  function formularioTitulo(titulo) {
    return new Promise((resolver) => {
      let valor = null;
      const { el: modal, fechar } = abrirModal({
        titulo: 'Editar título',
        tamanho: 'pequeno',
        corpo: `<form class="formulario" id="form-titulo-video" novalidate>
            <div class="campo"><label for="titulo-video">Título</label>
            <input id="titulo-video" name="titulo" maxlength="100" value="${esc(titulo)}" required></div></form>`,
        rodape: `<button type="button" class="botao-fantasma" data-fechar>Cancelar</button>
                 <button type="submit" form="form-titulo-video" class="botao">${icone('salvar')} Salvar</button>`,
        aoFechar: () => resolver(valor),
      });
      const f = modal.querySelector('form');
      f.elements.titulo.focus();
      f.elements.titulo.select();
      f.addEventListener('submit', (e) => {
        e.preventDefault();
        limparErros(f);
        const { titulo: t } = lerFormulario(f);
        if (!t) return marcarErro(f.elements.titulo, 'Dê um título para o vídeo.');
        valor = t;
        fechar();
      });
    });
  }

  // ---------------- Reações ----------------
  function soltarReacao(tipo, de) {
    const r = REACOES[tipo];
    const item = document.createElement('span');
    item.className = `reacao-voando ${de === eu ? 'minha' : 'do-outro'}`;
    item.style.setProperty('--x', `${10 + Math.random() * 80}%`);
    item.style.setProperty('--giro', `${(Math.random() - 0.5) * 40}deg`);
    item.innerHTML = `<span class="emoji">${r.emoji}</span>${de !== eu ? `<span class="quem">${esc(nome(de))}</span>` : ''}`;
    voando.append(item);
    setTimeout(() => item.remove(), 2600);
  }

  function contarReacao(tipo) {
    const doc = videos.find((v) => v.youtubeId === videoAtual?.youtubeId);
    if (!doc) return;
    doc.reacoes = { ...(doc.reacoes || {}), [tipo]: ((doc.reacoes || {})[tipo] || 0) + 1 };
    clearTimeout(timersReacao.get(doc.id));
    timersReacao.set(doc.id, setTimeout(async () => {
      try { const salvo = await salvar('videos', doc); videos = videos.map((v) => (v.id === salvo.id ? salvo : v)); desenharVideos(); } catch { /* ignora */ }
    }, 1500));
  }

  // ---------------- Tempo de cinema e recompensas ----------------
  // Conta só com o player oficial tocando. Assistindo juntos, cada um conta metade,
  // assim o total do casal não duplica.
  let ultimoTique = Date.now();
  const relogioCinema = setInterval(() => {
    const agora = Date.now();
    const passou = Math.min(agora - ultimoTique, 5000);
    ultimoTique = agora;
    if (!videoAtual || !usandoApi || !tocandoAgora()) return;
    const juntos = podeSincronizar() && sala.presentes.has(outro.id);
    somarTempoCinema(eu, juntos ? passou / 2 : passou);
  }, 1000);

  function marcarTocando(tocando) {
    botaoComecar.hidden = !fila.length || tocando;
    if (tocando) document.body.dataset.cinemaTocando = 'sim';
    else delete document.body.dataset.cinemaTocando;
  }

  const pedirComemoracao = () => window.dispatchEvent(new CustomEvent('nc:verificar-conquistas'));
  async function salvarTempoEConferir() {
    await gravarTempoCinema();
    if (!tocandoAgora()) pedirComemoracao();
  }

  let desbloqueadasAntes = lerProgresso().desbloqueadas.length;
  const elSala = el.querySelector('.sala');
  function aoMudarRecompensas(e) {
    const prog = e.detail;
    elSala.className = `sala ${classeModo(prog.modoCinema)}`;
    if (aba !== 'conquistas') desenharAbas();
    if (prog.desbloqueadas.length > desbloqueadasAntes) {
      const nova = prog.desbloqueadas.at(-1);
      if (tocandoAgora()) {
        toast(`Recompensa desbloqueada: ${nova.nome}! A comemoração aparece quando pausarem.`, 'sucesso', { duracao: 5000 });
      } else pedirComemoracao();
    }
    desbloqueadasAntes = prog.desbloqueadas.length;
  }
  window.addEventListener('nc:recompensas-mudou', aoMudarRecompensas);
  carregarRecompensas().catch(() => {});
  const gravarAoSair = () => { gravarTempoCinema(); };
  window.addEventListener('pagehide', gravarAoSair);

  // ---------------- Cortina ----------------
  // Fecha quando entra um vídeo novo e abre quando ele começa (pausar/voltar não repete).
  const reduzirMovimento = () => document.documentElement.dataset.movimento === 'reduzir';
  function fecharCortina() {
    if (reduzirMovimento()) return;
    palco.classList.add('cortina-fechada');
    cortinaFechadaEm = Date.now();
    clearTimeout(timerCortina);
    timerCortina = setTimeout(abrirCortina, 4000); // se o vídeo demorar, abre mesmo assim
  }
  function abrirCortina() {
    if (!palco.classList.contains('cortina-fechada')) return;
    clearTimeout(timerCortina);
    const espera = Math.max(0, 700 - (Date.now() - cortinaFechadaEm)); // deixa a cortina terminar de fechar
    timerCortina = setTimeout(() => palco.classList.remove('cortina-fechada'), espera);
  }

  // ---------------- Créditos e próximo da fila ----------------
  function esconderCreditos() {
    clearTimeout(timerCreditos);
    creditos.hidden = true;
    creditos.classList.remove('saindo');
  }

  function mostrarCreditos() {
    if (!videoAtual || !creditos.hidden) return;
    let dados = {};
    try { dados = player?.getVideoData?.() || {}; } catch { /* sem dados */ }
    const titulo = dados.title || videoAtual.titulo || 'Vídeo do YouTube';
    const canal = dados.author || videoAtual.canal || '';
    const quem = nome(videoAtual.escolhidoPor) || nome(eu);
    const proximo = fila[0];
    creditos.innerHTML = `
      <div class="creditos-conteudo">
        <p class="creditos-fim">Fim</p>
        <p class="creditos-titulo">${esc(titulo)}${canal ? ` <span class="creditos-por">por</span> ${esc(canal)}` : ''}</p>
        <p class="creditos-escolha">vídeo escolhido por: <strong>${esc(quem)}</strong></p>
        ${proximo ? `<p class="creditos-proximo">A seguir: ${esc(proximo.titulo || 'próximo vídeo da fila')}</p>` : ''}
      </div>`;
    creditos.classList.remove('saindo');
    creditos.hidden = false;
    const idFim = videoAtual.youtubeId;
    clearTimeout(timerCreditos);
    timerCreditos = setTimeout(() => {
      creditos.classList.add('saindo'); // fade out
      timerCreditos = setTimeout(() => {
        esconderCreditos();
        if (videoAtual?.youtubeId === idFim) avancarFila(idFim);
      }, 700);
    }, 5000);
  }

  /** Assistindo juntos, só um dos dois puxa o próximo (o outro recebe pela sala). */
  const souLider = () => !(podeSincronizar() && sala.presentes.has(outro.id)) || [eu, outro.id].sort()[0] === eu;

  async function avancarFila(idFim) {
    await carregarFila();
    const proximo = fila[0];
    if (!proximo) return;
    if (souLider()) { tocarDaFila(proximo); return; }
    // se quem puxa não fizer isso em alguns segundos, puxo eu
    setTimeout(() => { if (videoAtual?.youtubeId === idFim && fila[0]?.id === proximo.id) tocarDaFila(proximo); }, 4000);
  }

  // ---------------- Sessões do dia (fila) ----------------
  async function carregarFila() {
    try { fila = await lerFila(); } catch { /* mantém a última */ }
    desenharFila();
  }

  function desenharFila() {
    botaoComecar.hidden = !fila.length || Boolean(videoAtual && tocandoAgora());
    if (!fila.length) {
      filaEl.innerHTML = `<p class="fila-vazia">Nenhum vídeo na fila de hoje. Cole um link acima e toque em <strong>Pôr na fila</strong>, ou use o <strong>+</strong> de um vídeo das Sessões.</p>`;
      return;
    }
    filaEl.innerHTML = `<ol class="lista-fila">${fila.map((i, n) => `
      <li class="item-fila" data-item-fila="${esc(i.id)}">
        <span class="fila-numero" aria-hidden="true">${n + 1}</span>
        <img class="fila-miniatura" src="${miniatura(i.youtubeId)}" alt="" loading="lazy" referrerpolicy="no-referrer" data-mini>
        <div class="fila-info">
          <p class="fila-titulo">${esc(i.titulo || 'Vídeo do YouTube')}</p>
          <p class="meta">${i.canal ? `${esc(i.canal)} · ` : ''}escolhido por ${esc(nome(i.por))}</p>
        </div>
        <div class="grupo-botoes fila-acoes">
          <button type="button" class="botao-icone" data-fila-tocar="${esc(i.id)}" aria-label="Tocar agora: ${esc(i.titulo || 'vídeo')}" title="Tocar agora">${icone('play')}</button>
          <button type="button" class="botao-icone" data-fila-mover="-1" data-id="${esc(i.id)}" aria-label="Subir na fila" title="Subir" ${n === 0 ? 'disabled' : ''}><span class="seta-cima">${icone('direita')}</span></button>
          <button type="button" class="botao-icone" data-fila-mover="1" data-id="${esc(i.id)}" aria-label="Descer na fila" title="Descer" ${n === fila.length - 1 ? 'disabled' : ''}><span class="seta-baixo">${icone('direita')}</span></button>
          <button type="button" class="botao-icone perigo" data-fila-remover="${esc(i.id)}" aria-label="Tirar da fila: ${esc(i.titulo || 'vídeo')}" title="Tirar da fila">${icone('fechar')}</button>
        </div>
      </li>`).join('')}</ol>
      <p class="dica">${fila.length} de ${MAX_FILA} na fila de hoje. A fila recomeça vazia amanhã.</p>`;
  }

  async function tocarDaFila(item) {
    try { await removerDaFila(item.id); } catch { /* toca mesmo assim */ }
    fila = fila.filter((x) => x.id !== item.id);
    desenharFila();
    carregarLocal(item.youtubeId, item.titulo, 0, { escolhidoPor: item.por });
  }

  async function porNaFila(id, titulo = '') {
    try {
      const salvo = videos.find((v) => v.youtubeId === id);
      let info = { titulo: titulo || salvo?.titulo || '', canal: '' };
      if (!info.titulo || !info.canal) {
        const extra = await infoDoYoutube(id);
        info = { titulo: info.titulo || extra.titulo || '', canal: extra.canal || '' };
      }
      fila = await adicionarNaFila({ youtubeId: id, titulo: info.titulo, canal: info.canal, por: eu });
      desenharFila();
      toast(`Na fila de hoje (${fila.length}º).`, 'sucesso', { duracao: 2200 });
    } catch (e) { toast(e.message, 'erro'); }
  }

  el.querySelector('[data-por-na-fila]').addEventListener('click', () => {
    limparErros(form);
    const id = extrairIdYoutube(form.elements.url.value);
    if (!id) return marcarErro(form.elements.url, 'Cole o link de um vídeo do YouTube para pôr na fila.');
    form.elements.url.value = '';
    porNaFila(id);
  });

  el.querySelector('.fila-cinema').addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-comecar-fila')) { if (fila[0]) tocarDaFila(fila[0]); return; }
    const item = fila.find((x) => x.id === (b.dataset.filaTocar || b.dataset.filaRemover || b.dataset.id));
    if (!item) return;
    try {
      if (b.dataset.filaTocar) tocarDaFila(item);
      else if (b.dataset.filaRemover) { fila = await removerDaFila(item.id); desenharFila(); }
      else if (b.dataset.filaMover) { fila = await moverNaFila(item.id, Number(b.dataset.filaMover)); desenharFila(); el.querySelector(`[data-fila-mover="${b.dataset.filaMover}"][data-id="${item.id}"]:not([disabled])`)?.focus(); }
    } catch (err) { toast(err.message, 'erro'); }
  });

  const aoMudarFila = (ev) => { fila = ev.detail || fila; desenharFila(); };
  window.addEventListener('nc:fila-mudou', aoMudarFila);
  const pararOuvirFila = sala ? sala.ouvir((msg) => { if (msg.tipo === 'fila-mudou' && msg.de !== eu) carregarFila(); }) : () => {};
  carregarFila();

  // ---------------- Chat ----------------
  const chat = montarChat({
    painel: el.querySelector('#chat-cinema'),
    flutuante: el.querySelector('.chat-flutuante'),
    formRapido: el.querySelector('[data-chat-rapido]'),
    perfil: ctx.perfil,
    sala,
    extrairId: extrairIdYoutube,
    contexto: () => (videoAtual ? { youtubeId: videoAtual.youtubeId, titulo: videoAtual.titulo, posicao: tempoAtual() } : null),
    aoPular: async (yt, posicao, titulo) => {
      if (videoAtual?.youtubeId === yt && usandoApi && player?.seekTo) {
        jaInteragiu = true;
        await playerPronto;
        player.seekTo(posicao, true);
        setTimeout(() => enviarEstado(tocandoAgora()), 300);
        tela.scrollIntoView({ behavior: 'smooth', block: 'center' });
      } else {
        carregarLocal(yt, titulo, posicao);
      }
    },
    aoAssistir: (id) => carregarLocal(id),
  });
  if (/[?&]chat\b/.test(location.hash)) setTimeout(() => chat.focar(), 300);

  // ---------------- Chamar para assistir ----------------
  const SUGESTOES_CONVITE = [
    'Vem ver um vídeo comigo?',
    'Separei um vídeo pra gente, vem!',
    'A pipoca tá pronta, só falta você.',
    'Sessão começando! Guardei seu lugar.',
    `Bora assistir junto, ${outro.nome}?`,
  ];

  function chamarParaAssistir() {
    const video = videoAtual ? { youtubeId: videoAtual.youtubeId, titulo: videoAtual.titulo } : null;
    const { el: modal, fechar } = abrirModal({
      titulo: `Chamar ${outro.nome} para assistir`,
      corpo: `
        <form class="formulario form-bilhete" id="form-convite" novalidate>
          <div class="campo">
            <label for="texto-convite">Mensagem do convite</label>
            <textarea id="texto-convite" name="texto" rows="2" maxlength="140" required placeholder="Ex.: Vem ver um vídeo comigo?">${esc(SUGESTOES_CONVITE[0])}</textarea>
          </div>
          <div class="sugestoes" role="group" aria-label="Sugestões de convite">
            ${SUGESTOES_CONVITE.map((s) => `<button type="button" class="chip-sugestao" data-sugestao="${esc(s)}">${esc(s)}</button>`).join('')}
          </div>
          <p class="dica">${video
            ? `Vai junto o vídeo que está na tela: <strong>${esc(video.titulo || 'vídeo do YouTube')}</strong>. Quando ${esc(outro.nome)} entrar, vocês assistem sincronizados.`
            : `Ainda não tem vídeo na tela: ${esc(outro.nome)} entra no Cinema e vocês escolhem juntos.`}</p>
          <p class="dica">${esc(outro.nome)} recebe um aviso na hora se estiver no site, ou uma notificação no celular se tiver ativado.</p>
        </form>`,
      rodape: `<button type="button" class="botao-fantasma" data-fechar>Cancelar</button>
        <button type="submit" form="form-convite" class="botao">${icone('megafone')} Chamar</button>`,
    });
    const form = modal.querySelector('form');
    const campo = form.elements.texto;
    campo.focus();
    campo.select();
    modal.querySelectorAll('[data-sugestao]').forEach((b) => b.addEventListener('click', () => { campo.value = b.dataset.sugestao; campo.focus(); }));
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      limparErros(form);
      const texto = campo.value.replace(/\s+/g, ' ').trim().slice(0, 140);
      if (!texto) return marcarErro(campo, 'Escreva o convite.');
      fechar();
      if (sala?.status === 'ok') sala.enviar('convite', { para: outro.id, texto, youtubeId: video?.youtubeId || null, titulo: video?.titulo || '' });
      chat.enviar(texto, { notificar: false, convite: true });
      const r = await notificarOutro({
        titulo: `${ctx.perfil.nome} te chamou para assistir`,
        corpo: video?.titulo ? `${texto} (${video.titulo})` : texto,
        url: '/#/cinema?convite',
        tag: 'convite-cinema',
      });
      const presente = sala?.presentes?.has(outro.id);
      if (presente || r?.enviadas > 0 || r?.motivo === 'esta-vendo') toast(`Convite enviado para ${outro.nome}!`, 'sucesso');
      else if (r?.motivo === 'sem-aparelho') toast(`Convite guardado no chat. ${outro.nome} não está no site e ainda não ativou as notificações no celular.`, 'info', { duracao: 8000 });
      else toast(`Convite guardado no chat. ${outro.nome} vê quando abrir o site.`, 'info', { duracao: 6000 });
    });
  }
  el.querySelector('[data-chamar]').addEventListener('click', chamarParaAssistir);

  // ---------------- Eventos ----------------
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    limparErros(form);
    const id = extrairIdYoutube(form.elements.url.value);
    if (!id) return marcarErro(form.elements.url, 'Não reconheci esse link. Use um endereço de vídeo do YouTube.');
    form.elements.url.value = '';
    carregarLocal(id);
  });

  el.querySelector('[data-juntos]').addEventListener('change', (e) => {
    juntosLigado = e.target.checked;
    if (!juntosLigado) { voltarVelocidadeNormal(); terminarEspera(null, { tocar: false }); }
    try { localStorage.setItem('nc:cinema-juntos', juntosLigado ? 'sim' : 'nao'); } catch { /* ignora */ }
    desenharStatus();
    if (juntosLigado && podeSincronizar()) {
      if (videoAtual) enviarEstado(tocandoAgora());
      else sala.enviar('pedir-estado');
    }
  });

  botaoFavoritar.addEventListener('click', () => {
    const doc = videos.find((v) => v.youtubeId === videoAtual?.youtubeId);
    if (doc) alternarFavorito(doc);
  });

  botaoTelaCheia.addEventListener('click', () => {
    const pedir = telaCheia.requestFullscreen || telaCheia.webkitRequestFullscreen;
    if (!pedir) return toast('Tela cheia não é suportada neste navegador.', 'info');
    Promise.resolve(pedir.call(telaCheia)).catch(() => toast('O navegador não permitiu a tela cheia.', 'info'));
  });

  el.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.reagir) {
      jaInteragiu = true;
      soltarReacao(b.dataset.reagir, eu);
      if (videoAtual) {
        if (podeSincronizar()) sala.enviar('reacao', { reacao: b.dataset.reagir, youtubeId: videoAtual.youtubeId });
        contarReacao(b.dataset.reagir);
      }
      return;
    }
    if (b.hasAttribute('data-entrar-sessao')) {
      jaInteragiu = true;
      entrar.hidden = true;
      if (player?.playVideo) {
        marcarRemoto(true);
        if (ultimoRemoto) player.seekTo(ultimoRemoto.posicaoEstimada(), true);
        player.playVideo();
      }
      if (podeSincronizar()) sala.enviar('pedir-estado');
      return;
    }
    if (b.dataset.abaVideo) { aba = b.dataset.abaVideo; desenharVideos(true); return; }
    const cartao = b.closest('[data-video]');
    if (!cartao) return;
    const v = videos.find((x) => x.id === cartao.dataset.video);
    if (!v) return;
    if (b.hasAttribute('data-assistir')) carregarLocal(v.youtubeId, v.titulo);
    else if (b.hasAttribute('data-fila-video')) porNaFila(v.youtubeId, v.titulo);
    else if (b.hasAttribute('data-favoritar')) alternarFavorito(v);
    else if (b.hasAttribute('data-renomear')) {
      const titulo = await formularioTitulo(v.titulo);
      if (!titulo || titulo === v.titulo) return;
      try {
        const salvo = await salvar('videos', { ...v, titulo, tituloAuto: false });
        videos = videos.map((x) => (x.id === salvo.id ? salvo : x));
        if (videoAtual?.youtubeId === salvo.youtubeId) videoAtual.titulo = titulo;
        toast('Título atualizado.', 'sucesso');
        desenharVideos();
      } catch (err) { toast(err.message, 'erro'); }
    } else if (b.hasAttribute('data-remover')) {
      const ok = await confirmar({ titulo: 'Remover vídeo?', mensagem: `"${v.titulo}" sai das sessões e dos favoritos de vocês.`, textoConfirmar: 'Remover' });
      if (!ok) return;
      try {
        await remover('videos', v.id);
        videos = videos.filter((x) => x.id !== v.id);
        toast('Vídeo removido.', 'sucesso');
        desenharVideos();
        atualizarBotoes();
      } catch (err) { toast(err.message, 'erro'); }
    }
  });

  el.addEventListener('keydown', (e) => {
    const atual = e.target.closest('[data-aba-video]');
    if (!atual || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const ordem = ['sessoes', 'favoritos', 'conquistas'];
    aba = ordem[(ordem.indexOf(aba) + (e.key === 'ArrowRight' ? 1 : ordem.length - 1)) % ordem.length];
    desenharVideos(true);
  });

  el.addEventListener('error', (e) => {
    if (e.target instanceof HTMLImageElement && e.target.hasAttribute('data-mini')) e.target.classList.add('sem-imagem');
  }, true);

  desenharVideos();
  atualizarBotoes();

  // Entrou no Cinema: retoma o que estiver passando para o casal
  try {
    const ajustes = await obterAjustes();
    const atual = ajustes?.cinemaAtual;
    if (el.isConnected && !videoAtual && juntosLigado && atual?.youtubeId && Date.now() - (atual.em || 0) < SALA_VALIDA_MS) {
      // posição salva + tempo que passou desde então (se estava tocando)
      const posicaoAgora = () => (Number(atual.posicao) || 0) + (atual.tocando ? (Date.now() - atual.em) / 1000 : 0);
      ultimoRemoto = { ...atual, recebidoEm: 0, posicaoEstimada: posicaoAgora };
      marcarRemoto(false);
      await mostrarVideo(atual.youtubeId, atual.titulo, { inicio: posicaoAgora(), tocar: false, escolhidoPor: atual.escolhidoPor || atual.de });
      if (atual.tocando) mostrarEntrar(atual.de && atual.de !== eu ? `Entrar na sessão com ${nome(atual.de)}` : 'Continuar a sessão');
    }
  } catch { /* sem ajustes: começa com a tela vazia */ }
  if (podeSincronizar()) sala.enviar('pedir-estado');

  return () => {
    pararOuvirTema();
    pararOuvirSala();
    pararStatus();
    clearTimeout(timerPersistir);
    clearInterval(relogioCinema);
    clearInterval(relogioSinc);
    clearTimeout(timerTaxa);
    clearTimeout(timerCarregando);
    if (esperando) clearTimeout(esperando.timer);
    clearTimeout(timerCreditos);
    clearTimeout(timerCortina);
    pararOuvirFila();
    window.removeEventListener('nc:fila-mudou', aoMudarFila);
    chat.limpar();
    window.removeEventListener('nc:recompensas-mudou', aoMudarRecompensas);
    window.removeEventListener('pagehide', gravarAoSair);
    limparPainel?.();
    marcarTocando(false);
    gravarTempoCinema();
    try { player?.destroy?.(); } catch { /* ignora */ }
    player = null;
  };
}
