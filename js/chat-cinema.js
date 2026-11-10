// Chat do Cinema: conversa do casal ao lado do vídeo.
//  - Entrega na hora pela sala do casal (Realtime / BroadcastChannel no modo demonstração)
//  - Histórico salvo na coleção "mensagens" (Supabase: supabase/chat-cinema.sql)
//  - Cada mensagem guarda o vídeo e o ponto em que foi escrita ("aos 12:34"), que dá para tocar
//  - Mensagens do outro aparecem por cima do vídeo (inclusive em tela cheia)
//  - "digitando…", separador por dia e link do YouTube vira botão "Colocar na tela"
import { listar, salvar } from './store/index.js';
import { PERFIS } from './auth.js';
import { notificarOutro } from './notificacoes.js';
import { icone } from './ui/icones.js';
import { esc, formatarData } from './ui/dom.js';

export const MAX_MENSAGEM = 500;
const HISTORICO = 150;
const INTERVALO_NOTIFICACAO = 45000;

const relogioVideo = (s) => {
  const t = Math.max(0, Math.floor(Number(s) || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const seg = String(t % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${seg}` : `${m}:${seg}`;
};

// Ordem de chegada: o histórico segue a hora do SERVIDOR (criadoEm), não o relógio de cada aparelho
const ordemServidor = (m) => String(m.criadoEm || m.em || '');
// Horário mostrado: o do servidor; antes de salvar, a hora em que chegou neste aparelho
const quando = (m) => m.criadoEm || m.chegouEm || m.em;

const hora = (iso) => new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });

function rotuloDia(iso) {
  const d = new Date(iso);
  const hoje = new Date();
  const ontem = new Date(); ontem.setDate(hoje.getDate() - 1);
  const mesmo = (a, b) => a.toDateString() === b.toDateString();
  if (mesmo(d, hoje)) return 'Hoje';
  if (mesmo(d, ontem)) return 'Ontem';
  return formatarData(iso, { day: 'numeric', month: 'long' });
}

/**
 * Monta o chat. `extrairId` reconhece links do YouTube; `contexto()` diz o vídeo atual.
 * Retorna { limpar, focar }.
 */
export function montarChat({ painel, flutuante, formRapido, perfil, sala, contexto, extrairId, aoPular, aoAssistir }) {
  const eu = perfil.id;
  const outro = Object.values(PERFIS).find((p) => p.id !== eu);
  const nome = (id) => PERFIS[id]?.nome || 'Alguém';
  let mensagens = [];
  let historicoSalvo = true;
  let ultimaNotificacao = 0;
  let timerDigitando = null;
  let ultimoDigitando = 0;

  painel.innerHTML = `
    <div class="chat-topo">
      <h2 id="titulo-chat" class="subtitulo">${icone('balao')} Chat com ${esc(outro.nome)}</h2>
      <span class="chat-digitando" data-digitando aria-live="polite"></span>
    </div>
    <ol class="chat-mensagens" data-lista role="log" aria-labelledby="titulo-chat" tabindex="0"></ol>
    <button type="button" class="chat-novas" data-novas hidden>${icone('direita')} Novas mensagens</button>
    <p class="dica chat-aviso" data-aviso hidden></p>
    <form class="chat-form" data-form novalidate>
      <label for="chat-texto" class="sr-only">Mensagem para ${esc(outro.nome)}</label>
      <input id="chat-texto" class="entrada" name="texto" maxlength="${MAX_MENSAGEM}" autocomplete="off" enterkeyhint="send" placeholder="Escreva para ${esc(outro.nome)}…">
      <button type="submit" class="botao botao-enviar-chat" aria-label="Enviar mensagem">${icone('enviar')}</button>
    </form>`;
  painel.setAttribute('aria-labelledby', 'titulo-chat');

  const lista = painel.querySelector('[data-lista]');
  const digitando = painel.querySelector('[data-digitando]');
  const aviso = painel.querySelector('[data-aviso]');
  const botaoNovas = painel.querySelector('[data-novas]');

  // ---------------- Desenho ----------------
  const pertoDoFim = () => lista.scrollHeight - lista.scrollTop - lista.clientHeight < 60;
  const rolarFim = () => { lista.scrollTop = lista.scrollHeight; botaoNovas.hidden = true; };

  function htmlTexto(texto) {
    return esc(texto);
  }

  function htmlMensagem(m, anterior) {
    const minha = m.de === eu;
    const novoDia = !anterior || new Date(quando(anterior)).toDateString() !== new Date(quando(m)).toDateString();
    const agrupada = !novoDia && anterior && anterior.de === m.de && Math.abs(new Date(quando(m)) - new Date(quando(anterior))) < 120000;
    const idYt = extrairId(m.texto.match(/\S*(?:youtu\.be|youtube\.com)\S*/i)?.[0] || '');
    return `
      ${novoDia ? `<li class="chat-dia" role="presentation"><span>${esc(rotuloDia(quando(m)))}</span></li>` : ''}
      <li class="msg ${minha ? 'minha' : 'dele'} ${agrupada ? 'agrupada' : ''} ${m.falhou ? 'falhou' : ''} ${m.convite ? 'convite' : ''}" data-msg="${esc(m.idLocal || m.id)}">
        <span class="sr-only">${esc(nome(m.de))} às ${esc(hora(quando(m)))}:</span>
        <div class="msg-balao">${m.convite ? `<span class="msg-convite">${icone('megafone')} Convite para assistir</span>` : ''}<p>${htmlTexto(m.texto)}</p>
          ${idYt ? `<button type="button" class="botao-sec pequeno" data-assistir-link="${esc(idYt)}">${icone('play')} Colocar na tela</button>` : ''}
        </div>
        <p class="msg-meta" aria-hidden="${agrupada ? 'true' : 'false'}">
          ${agrupada ? '' : `<span>${minha ? 'Você' : esc(nome(m.de))} · ${esc(hora(quando(m)))}</span>`}
          ${m.youtubeId && Number.isFinite(Number(m.posicao)) ? `<button type="button" class="msg-tempo" data-pular="${Number(m.posicao)}" data-yt="${esc(m.youtubeId)}" title="Ir para este ponto${m.titulo ? ` de ${esc(m.titulo)}` : ''}">${icone('play')} aos ${relogioVideo(m.posicao)}</button>` : ''}
          ${m.falhou ? '<span class="msg-erro">não salva</span>' : ''}
        </p>
      </li>`;
  }

  function desenhar({ manterPosicao = false } = {}) {
    const estavaNoFim = pertoDoFim();
    // `mensagens` já está na ordem de chegada (não reordena pela hora de quem mandou)
    const ordenadas = mensagens;
    lista.innerHTML = ordenadas.length
      ? ordenadas.map((m, i) => htmlMensagem(m, ordenadas[i - 1])).join('')
      : `<li class="chat-vazio" role="presentation">${icone('balao')}<span>Nenhuma mensagem ainda. Mande um oi para ${esc(outro.nome)}!</span></li>`;
    if (!manterPosicao || estavaNoFim) rolarFim();
  }

  function mostrarFlutuante(m) {
    if (!flutuante) return;
    const item = document.createElement('div');
    item.className = 'chat-bolha';
    item.innerHTML = `<strong>${esc(nome(m.de))}</strong> ${esc(m.texto.length > 140 ? `${m.texto.slice(0, 140)}…` : m.texto)}`;
    flutuante.append(item);
    while (flutuante.children.length > 3) flutuante.firstElementChild.remove();
    setTimeout(() => { item.classList.add('saindo'); setTimeout(() => item.remove(), 400); }, 6000);
  }

  function receber(m, { flutuar = true } = {}) {
    if (mensagens.some((x) => (x.idLocal && x.idLocal === m.idLocal) || (x.id && x.id === m.id))) return;
    mensagens.push(m);
    const noFim = pertoDoFim();
    desenhar({ manterPosicao: true });
    if (!noFim && m.de !== eu) botaoNovas.hidden = false;
    if (flutuar && m.de !== eu) mostrarFlutuante(m);
  }

  // ---------------- Enviar ----------------
  async function enviar(texto, { notificar = true, convite = false } = {}) {
    texto = String(texto || '').replace(/\s+/g, ' ').trim().slice(0, MAX_MENSAGEM);
    if (!texto) return false;
    const ctx = contexto() || {};
    const m = {
      idLocal: `${eu}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      de: eu,
      texto,
      em: new Date().toISOString(),
      youtubeId: ctx.youtubeId || null,
      titulo: ctx.titulo || '',
      posicao: ctx.youtubeId ? Math.floor(ctx.posicao || 0) : null,
      ...(convite ? { convite: true } : {}),
    };
    receber(m, { flutuar: false });
    rolarFim();
    if (sala?.status === 'ok') sala.enviar('chat', m);
    if (notificar && Date.now() - ultimaNotificacao > INTERVALO_NOTIFICACAO) {
      ultimaNotificacao = Date.now();
      notificarOutro({ titulo: `${perfil.nome} no chat do cinema`, corpo: texto, url: '/#/cinema?chat', tag: 'chat-cinema' });
    }
    try {
      const salvo = await salvar('mensagens', m);
      Object.assign(m, { id: salvo.id, criadoEm: salvo.criadoEm || m.criadoEm });
    } catch {
      if (historicoSalvo) {
        m.falhou = true;
        desenhar({ manterPosicao: true });
      }
    }
    return true;
  }

  const form = painel.querySelector('[data-form]');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const campo = form.elements.texto;
    enviar(campo.value);
    campo.value = '';
    campo.focus();
  });
  formRapido?.addEventListener('submit', (e) => {
    e.preventDefault();
    const campo = formRapido.elements.texto;
    enviar(campo.value);
    campo.value = '';
  });

  const avisarDigitando = () => {
    if (sala?.status !== 'ok' || Date.now() - ultimoDigitando < 2000) return;
    ultimoDigitando = Date.now();
    sala.enviar('digitando', {});
  };
  form.elements.texto.addEventListener('input', avisarDigitando);
  formRapido?.elements.texto.addEventListener('input', avisarDigitando);

  // Ações dentro das mensagens
  painel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-novas')) { rolarFim(); return; }
    if (b.dataset.pular) aoPular(b.dataset.yt, Number(b.dataset.pular), mensagens.find((m) => m.youtubeId === b.dataset.yt)?.titulo || '');
    else if (b.dataset.assistirLink) aoAssistir(b.dataset.assistirLink);
  });
  lista.addEventListener('scroll', () => { if (pertoDoFim()) botaoNovas.hidden = true; });

  // ---------------- Receber ----------------
  const pararOuvir = sala ? sala.ouvir((msg) => {
    if (msg.de === eu) return;
    if (msg.tipo === 'chat' && msg.texto) {
      clearTimeout(timerDigitando);
      digitando.textContent = '';
      receber({ idLocal: msg.idLocal, de: msg.de, texto: String(msg.texto).slice(0, MAX_MENSAGEM), em: msg.em ? new Date(msg.em).toISOString() : new Date().toISOString(), chegouEm: new Date().toISOString(), youtubeId: msg.youtubeId || null, titulo: msg.titulo || '', posicao: msg.posicao, convite: Boolean(msg.convite) });
    } else if (msg.tipo === 'digitando') {
      digitando.textContent = `${nome(msg.de)} está digitando…`;
      clearTimeout(timerDigitando);
      timerDigitando = setTimeout(() => { digitando.textContent = ''; }, 3500);
    }
  }) : () => {};

  // ---------------- Histórico ----------------
  let historicoCarregado = false;
  desenhar();
  listar('mensagens', { limite: HISTORICO })
    .then((salvas) => {
      const conhecidas = new Set(mensagens.map((m) => m.idLocal).filter(Boolean));
      const antigas = salvas.filter((m) => !conhecidas.has(m.idLocal)).sort((a, b) => ordemServidor(a).localeCompare(ordemServidor(b)));
      mensagens = [...antigas, ...mensagens];
      historicoCarregado = true;
      if (painel.isConnected) desenhar();
    })
    .catch(() => {
      historicoSalvo = false;
      aviso.hidden = false;
      aviso.textContent = 'O histórico do chat ainda não está sendo salvo: rode o arquivo supabase/chat-cinema.sql no Supabase. As mensagens continuam chegando na hora.';
    });

  // ---------------- O que chegou com a conexão caída ----------------
  // Toda mensagem também fica salva no banco. Quando a conexão volta, quando a tela volta
  // a ficar visível e a cada 20 s, o chat confere se alguma não chegou pelo tempo real.
  let buscando = false;
  async function buscarNovas() {
    if (!historicoCarregado || !historicoSalvo || buscando || !painel.isConnected || document.visibilityState !== 'visible') return;
    buscando = true;
    try {
      const recentes = await listar('mensagens', { limite: 40 });
      const ids = new Set(mensagens.map((m) => m.id).filter(Boolean));
      const locais = new Set(mensagens.map((m) => m.idLocal).filter(Boolean));
      recentes
        .filter((m) => !ids.has(m.id) && !(m.idLocal && locais.has(m.idLocal)))
        .sort((a, b) => ordemServidor(a).localeCompare(ordemServidor(b)))
        .forEach((m) => receber(m));
    } catch { /* sem internet: tenta na próxima */ } finally { buscando = false; }
  }
  let ultimaConexao = null;
  const pararStatusSala = sala?.aoMudar ? sala.aoMudar((s) => {
    if (s.status !== 'ok') return;
    if (ultimaConexao !== null && s.conexao !== ultimaConexao) buscarNovas(); // reconectou
    ultimaConexao = s.conexao;
  }) : () => {};
  const aoVoltarATela = () => { if (document.visibilityState === 'visible') buscarNovas(); };
  document.addEventListener('visibilitychange', aoVoltarATela);
  const conferencia = setInterval(buscarNovas, 20000);

  return {
    enviar,
    focar: () => { painel.scrollIntoView({ behavior: 'smooth', block: 'center' }); form.elements.texto.focus({ preventScroll: true }); },
    limpar: () => {
      pararOuvir();
      clearTimeout(timerDigitando);
      pararStatusSala();
      clearInterval(conferencia);
      document.removeEventListener('visibilitychange', aoVoltarATela);
    },
  };
}
