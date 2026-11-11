// Diversão: Resposta do dia, jogo da velha e forca (telas e interação).
// Os dados vêm de ./dados.js; o "ao vivo" usa a mesma sala do cinema (mensagens 'jogo' e 'resposta-dia').
import { PERFIS } from '../auth.js';
import { notificarOutro } from '../notificacoes.js';
import { temaAtual } from '../tema.js';
import { adesivo, ICONE_TEMA } from '../ui/ilustracoes.js';
import { icone } from '../ui/icones.js';
import { esc, toast, confirmar } from '../ui/dom.js';
import { criarDadosJogos } from './dados.js';
import {
  ALFABETO, MAX_ERROS_FORCA, placar as calcularPlacar, palavraValida, hojeBrasilia, perguntaRespostaDoDia, diaPorExtenso,
} from './regras.js';

const MAX_RESPOSTA = 500;
const MASCOTE = { punk: 'pinguim-punk', laco: 'pinguinzinha', mistica: 'gato-preto', onda: 'concha', aquarela: 'gatinho', cinza: 'coracao-cinza', azul: 'coracao-azul' };
const semSvg = (s) => s.replace(/^<svg[^>]*>|<\/svg>$/g, '');

const X_GENERICO = '<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M16 16l32 32M48 16L16 48" stroke="var(--cor-primaria)" stroke-width="9" stroke-linecap="round"/></svg>';
const O_GENERICO = '<svg viewBox="0 0 64 64" aria-hidden="true"><circle cx="32" cy="32" r="18" fill="none" stroke="var(--cor-destaque)" stroke-width="9"/></svg>';

const MINI_VELHA = '<svg viewBox="0 0 44 44" aria-hidden="true"><g stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity=".55"><path d="M15 4v36M29 4v36M4 15h36M4 29h36"/></g><g stroke="var(--cor-primaria)" stroke-width="3" stroke-linecap="round"><path d="M6 6l6 6M12 6l-6 6M32 32l6 6M38 32l-6 6"/></g><circle cx="22" cy="22" r="4" fill="none" stroke="var(--cor-destaque)" stroke-width="3"/></svg>';
const MINI_FORCA = '<svg viewBox="0 0 44 44" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true"><path d="M6 40h20M12 40V5h18v6"/><circle cx="30" cy="15" r="4" stroke="var(--cor-primaria)"/><path d="M30 19v10M30 22l-5 4M30 22l5 4M30 29l-4 7M30 29l4 7" stroke="var(--cor-primaria)"/></svg>';

function tempoAteAmanha(agora = new Date()) {
  const partes = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit', hour12: false })
    .formatToParts(agora).map((p) => [p.type, p.value]));
  const faltam = 24 * 60 - ((Number(partes.hour) % 24) * 60 + Number(partes.minute));
  const h = Math.floor(faltam / 60);
  return h ? `${h} h ${faltam % 60} min` : `${faltam % 60} min`;
}

/**
 * @param {{ el: HTMLElement, perfil: object, sala: object|null, trocarModo: Function, voltar: Function }} opcoes
 */
export function criarJogos({ el, perfil, sala, trocarModo, voltar }) {
  const eu = perfil.id;
  const outro = Object.values(PERFIS).find((p) => p.id !== eu)?.id || '';
  const nome = (id) => (id === eu ? 'Você' : PERFIS[id]?.nome || 'Alguém');
  const nomeOutro = PERFIS[outro]?.nome || 'seu amor';
  const dados = criarDadosJogos(perfil);
  const podeSincronizar = () => sala && sala.status === 'ok';
  const online = () => Boolean(sala?.presentes?.has(outro));

  let jogos = [];
  let resp = { linhas: [], respondeuHoje: [] };
  let erroJogos = '';
  let erroResp = '';
  let tela = null;         // null (visão geral) | { tipo: 'velha'|'forca'|'forca-nova' }
  let editandoResposta = false;
  let enviando = false;

  // Peças: o ícone do tema de cada um (se os dois tiverem o mesmo tema, X e O)
  const temaDe = (id) => PERFIS[id]?.temaPadrao;
  const mesmasPecas = temaDe(eu) === temaDe(outro) || !ICONE_TEMA[temaDe(eu)] || !ICONE_TEMA[temaDe(outro)];
  const peca = (id) => {
    if (mesmasPecas) return id === eu ? X_GENERICO : O_GENERICO;
    return ICONE_TEMA[temaDe(id)]();
  };

  const ativo = (tipo) => jogos.find((j) => j.tipo === tipo && j.status === 'andamento') || null;
  const ultimo = (tipo) => jogos.find((j) => j.tipo === tipo) || null;

  async function carregarJogos() {
    try { jogos = await dados.listarJogos(); erroJogos = ''; } catch (e) { erroJogos = e.message; jogos = []; }
  }
  async function carregarRespostas() {
    try { resp = await dados.respostas(); erroResp = ''; } catch (e) { erroResp = e.message; resp = { linhas: [], respondeuHoje: [] }; }
  }

  function avisar(tipoMsg, extra = {}) {
    if (podeSincronizar()) sala.enviar(tipoMsg, extra);
  }

  // ===================== Resposta do dia =====================
  function htmlRespostaDoDia() {
    if (erroResp) return `<section class="cartao resposta-dia"><div class="aviso">${icone('info')}<p>${esc(erroResp)}</p></div></section>`;
    const hoje = hojeBrasilia();
    const pergunta = perguntaRespostaDoDia(hoje);
    const minha = resp.linhas.find((l) => l.perfil === eu && l.dia === hoje);
    const dele = resp.linhas.find((l) => l.perfil === outro && l.dia === hoje);
    const eleRespondeu = resp.respondeuHoje.includes(outro);
    const mostrarForm = !minha || editandoResposta;

    const passados = [...new Set(resp.linhas.filter((l) => l.dia < hoje).map((l) => l.dia))].slice(0, 30);
    const historico = passados.length ? `
      <details class="rd-historico">
        <summary>Respostas dos outros dias</summary>
        ${passados.map((dia) => {
          const doDia = resp.linhas.filter((l) => l.dia === dia);
          const m = doDia.find((l) => l.perfil === eu);
          const d = doDia.find((l) => l.perfil === outro);
          return `<div class="rd-dia"><p class="meta">${esc(diaPorExtenso(dia))}</p><h4>${esc((m || d).pergunta)}</h4>
            <ul><li><strong>Você:</strong>${m ? esc(m.texto) : '<em>não respondeu</em>'}</li>
            <li><strong>${esc(nomeOutro)}:</strong>${d ? esc(d.texto) : '<em>não respondeu</em>'}</li></ul></div>`;
        }).join('')}
      </details>` : '';

    return `
      <section class="cartao resposta-dia" aria-labelledby="titulo-rd">
        <div class="rd-topo">
          <span class="rd-icone" aria-hidden="true">${icone('balao')}</span>
          <div>
            <h2 id="titulo-rd" class="sobretitulo-como">Resposta do dia · ${esc(diaPorExtenso(hoje))}</h2>
            <p class="rd-pergunta">${esc(pergunta)}</p>
          </div>
        </div>
        ${!minha && eleRespondeu ? `
          <div class="rd-trancada">
            ${icone('cadeado')}
            <p><strong>${esc(nomeOutro)} já respondeu.</strong> Responda também para ver o que ${esc(nomeOutro)} escreveu.
              <span class="rd-borrado" aria-hidden="true">uma resposta que só aparece depois da sua</span></p>
          </div>` : ''}
        ${minha && !editandoResposta ? `
          <div class="rd-respostas">
            <figure class="rd-balao minha"><figcaption>${peca(eu)} Você</figcaption><blockquote>${esc(minha.texto)}</blockquote></figure>
            ${dele
              ? `<figure class="rd-balao"><figcaption>${peca(outro)} ${esc(nomeOutro)}</figcaption><blockquote>${esc(dele.texto)}</blockquote></figure>`
              : `<p class="rd-esperando">${icone('info')} Esperando ${esc(nomeOutro)} responder…</p>`}
          </div>
          <div class="grupo-botoes" style="margin-top:.8rem"><button type="button" class="botao-fantasma pequeno" data-rd-editar>${icone('editar')} Editar minha resposta</button></div>` : ''}
        ${mostrarForm ? `
          <form class="rd-form" data-rd-form novalidate>
            <label class="sr-only" for="rd-texto">Sua resposta</label>
            <textarea id="rd-texto" class="entrada" maxlength="${MAX_RESPOSTA}" placeholder="Escreva a sua resposta…" required>${minha ? esc(minha.texto) : ''}</textarea>
            <div class="grupo-botoes">
              <span class="rd-contador" data-rd-contador>${minha ? minha.texto.length : 0} / ${MAX_RESPOSTA}</span>
              <span class="grupo-botoes">
                ${editandoResposta ? '<button type="button" class="botao-fantasma" data-rd-cancelar>Cancelar</button>' : ''}
                <button type="submit" class="botao">${icone('enviar')} ${minha ? 'Salvar' : eleRespondeu ? `Responder e ver a de ${esc(nomeOutro)}` : 'Responder'}</button>
              </span>
            </div>
          </form>` : ''}
        <p class="meta" style="margin:.8rem 0 0">Nova pergunta em ${esc(tempoAteAmanha())}.</p>
        ${historico}
      </section>`;
  }

  async function responder(form) {
    const campo = form.querySelector('textarea');
    const texto = campo.value.trim();
    if (!texto) { campo.setAttribute('aria-invalid', 'true'); campo.focus(); toast('Escreva a sua resposta primeiro.', 'erro'); return; }
    if (enviando) return;
    enviando = true;
    const jaTinha = resp.linhas.some((l) => l.perfil === eu && l.dia === hojeBrasilia());
    const eleRespondeu = resp.respondeuHoje.includes(outro);
    try {
      await dados.responder(texto.slice(0, MAX_RESPOSTA), perguntaRespostaDoDia());
      editandoResposta = false;
      await carregarRespostas();
      redesenharResposta();
      avisar('resposta-dia');
      if (!jaTinha) {
        notificarOutro({
          titulo: 'Resposta do dia',
          corpo: eleRespondeu ? `${perfil.nome} respondeu a pergunta do dia. Vem ver!` : `${perfil.nome} respondeu a pergunta do dia. Responda pra ver!`,
          url: '/#/diversao?resposta',
          tag: 'resposta-dia',
        });
      }
    } catch (e) { toast(e.message, 'erro'); } finally { enviando = false; }
  }

  function redesenharResposta() {
    const alvo = el.querySelector('[data-resposta-dia]');
    if (alvo) alvo.innerHTML = htmlRespostaDoDia();
  }

  // ===================== Cartões dos jogos =====================
  function htmlPlacar(p, rotulo) {
    return `<p class="placar"><span>${esc(PERFIS[eu]?.nome || 'Você')}</span> <b>${p[eu] || 0}</b> <span class="vs">×</span> <b>${p[outro] || 0}</b> <span>${esc(nomeOutro)}</span><span class="empates">${rotulo}</span></p>`;
  }

  function htmlCartoesJogos() {
    if (erroJogos) return `<div class="aviso">${icone('info')}<p>${esc(erroJogos)}</p></div>`;
    const p = calcularPlacar(jogos, eu, outro);
    const v = ativo('velha');
    const f = ativo('forca');
    const statusVelha = v
      ? (v.estado.vez === eu ? `<p class="jogo-status sua-vez">${icone('sparkle')} Sua vez de jogar!</p>` : `<p class="jogo-status">${icone('info')} Vez de ${esc(nomeOutro)}</p>`)
      : `<p class="jogo-status">${icone('info')} Chame ${esc(nomeOutro)} para uma partida</p>`;
    const statusForca = f
      ? (f.estado.adivinha === eu
        ? `<p class="jogo-status sua-vez">${icone('sparkle')} Adivinhe a palavra de ${esc(nomeOutro)} · ${f.estado.erros} de ${MAX_ERROS_FORCA} erros</p>`
        : `<p class="jogo-status">${icone('info')} ${esc(nomeOutro)} está adivinhando · ${f.estado.erros} de ${MAX_ERROS_FORCA} erros</p>`)
      : `<p class="jogo-status">${icone('info')} Escolha uma palavra para ${esc(nomeOutro)} adivinhar</p>`;
    return `
      <div class="jogos-grade">
        <article class="cartao jogo-cartao">
          <div class="jogo-cartao-topo"><span class="jogo-miniatura">${MINI_VELHA}</span><div><h3>Jogo da velha</h3><p class="meta">${v ? 'Partida em andamento' : 'Nenhuma partida agora'}</p></div></div>
          ${htmlPlacar(p.velha, `${p.velha.empates} ${p.velha.empates === 1 ? 'empate' : 'empates'}`)}
          ${statusVelha}
          <div class="grupo-botoes"><button type="button" class="botao" data-abrir-jogo="velha">${icone('play')} ${v ? 'Continuar partida' : 'Nova partida'}</button></div>
        </article>
        <article class="cartao jogo-cartao">
          <div class="jogo-cartao-topo"><span class="jogo-miniatura">${MINI_FORCA}</span><div><h3>Forca</h3><p class="meta">${f ? (f.estado.autor === eu ? 'Você escolheu uma palavra' : `${esc(nomeOutro)} escolheu uma palavra`) : 'Nenhuma palavra agora'}</p></div></div>
          ${htmlPlacar(p.forca, 'palavras acertadas')}
          ${statusForca}
          <div class="grupo-botoes">
            ${f ? `<button type="button" class="botao" data-abrir-jogo="forca">${icone('play')} ${f.estado.adivinha === eu ? 'Continuar' : 'Ver'}</button>` : ''}
            <button type="button" class="${f ? 'botao-sec' : 'botao'}" data-abrir-jogo="forca-nova">${icone('mais')} Nova palavra</button>
          </div>
        </article>
      </div>`;
  }

  function redesenharCartoes() {
    const alvo = el.querySelector('[data-jogos]');
    if (alvo) alvo.innerHTML = htmlCartoesJogos();
  }

  // ===================== Telas dos jogos =====================
  function cabecalho(titulo, daVez, p) {
    return `
      <button type="button" class="botao-fantasma pequeno" data-voltar-diversao>${icone('esquerda')} Diversão</button>
      <div class="jogo-cabecalho">
        <h1 class="titulo-pagina" tabindex="-1">${titulo}</h1>
        <div class="jogadores" aria-label="Placar">
          <span class="jogador ${daVez === eu ? 'da-vez' : ''}">${peca(eu)}<span><small>você</small>${esc(PERFIS[eu]?.nome || '')}</span><span class="pontos">${p[eu] || 0}</span></span>
          <span class="vs" aria-hidden="true">×</span>
          <span class="jogador ${daVez === outro ? 'da-vez' : ''}">${peca(outro)}<span><small>&nbsp;</small>${esc(nomeOutro)}</span><span class="pontos">${p[outro] || 0}</span></span>
        </div>
      </div>`;
  }

  function htmlVelha() {
    const j = ativo('velha') || ultimo('velha');
    const p = calcularPlacar(jogos, eu, outro).velha;
    if (!j) {
      return `<div class="jogo-tela">${cabecalho('Jogo da velha', null, p)}
        <div class="vazio"><span class="ilustracao" aria-hidden="true">${MINI_VELHA}</span><h3>Nenhuma partida ainda</h3>
        <p>Comece uma e ${esc(nomeOutro)} recebe o convite.</p>
        <button type="button" class="botao" data-velha-nova>${icone('play')} Começar partida</button></div></div>`;
    }
    const e = j.estado;
    const andamento = j.status === 'andamento';
    const minhaVez = andamento && e.vez === eu;
    let aviso;
    if (andamento) {
      aviso = minhaVez
        ? `Sua vez!<small>${online() ? `${esc(nomeOutro)} está online` : `${esc(nomeOutro)} recebe um aviso quando você jogar`}</small>`
        : `Vez de ${esc(nomeOutro)}<small>${online() ? `${esc(nomeOutro)} está online` : 'Você recebe um aviso quando for a sua vez'}</small>`;
    } else if (j.status === 'abandonado') aviso = 'Partida encerrada<small>Comece outra quando quiser.</small>';
    else if (e.vencedor === eu) aviso = `Você ganhou! 🎉<small>Placar: ${esc(PERFIS[eu]?.nome || '')} ${p[eu]} × ${p[outro]} ${esc(nomeOutro)}</small>`;
    else if (e.vencedor) aviso = `${esc(nomeOutro)} ganhou!<small>Placar: ${esc(PERFIS[eu]?.nome || '')} ${p[eu]} × ${p[outro]} ${esc(nomeOutro)}</small>`;
    else aviso = 'Deu velha! Empate.<small>Bora de novo?</small>';

    const casas = e.tab.map((v, i) => {
      const classes = [(e.linha || []).includes(i) ? 'vitoria' : '', e.ultima === i && andamento ? 'ultima' : ''].filter(Boolean).join(' ');
      const rotulo = v ? `Casa ${i + 1}, ${nome(v)}` : `Casa ${i + 1}, vazia`;
      return `<button type="button" data-casa="${i}" class="${classes}" aria-label="${esc(rotulo)}" ${v || !minhaVez ? 'disabled' : ''}>${v ? peca(v) : ''}</button>`;
    }).join('');
    return `<div class="jogo-tela">
      ${cabecalho('Jogo da velha', andamento ? e.vez : null, p)}
      <p class="aviso-vez" role="status" aria-live="polite">${aviso}</p>
      <div class="velha" aria-label="Tabuleiro do jogo da velha">${casas}</div>
      <p class="velha-legenda"><span>${peca(eu)} ${esc(PERFIS[eu]?.nome || '')}</span><span>${peca(outro)} ${esc(nomeOutro)}</span></p>
      <div class="grupo-botoes" style="justify-content:center">
        ${andamento
          ? `<button type="button" class="botao-sec" data-velha-recomecar>${icone('desfazer')} Recomeçar</button>`
          : `<button type="button" class="botao" data-velha-nova>${icone('restaurar')} ${j.status === 'fim' ? 'Revanche' : 'Nova partida'}</button>`}
      </div>
    </div>`;
  }

  function desenhoForca(erros) {
    const parte = (n, conteudo) => `<g class="parte ${erros >= n ? '' : 'oculta'}">${conteudo}</g>`;
    const mascote = semSvg(adesivo(MASCOTE[temaAtual()] || 'coracao'));
    return `<svg class="forca-desenho" viewBox="0 0 200 230" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" role="img" aria-label="${erros} de ${MAX_ERROS_FORCA} erros">
      <path d="M20 215h110M50 215V18h90v26M50 60l34-42"/>
      ${parte(1, `<g transform="translate(112 44) scale(.875)" stroke="none">${mascote}</g>`)}
      ${parte(2, '<path d="M140 102v52" stroke="var(--cor-primaria)"/>')}
      ${parte(3, '<path d="M140 116l-24 20" stroke="var(--cor-primaria)"/>')}
      ${parte(4, '<path d="M140 116l24 20" stroke="var(--cor-primaria)"/>')}
      ${parte(5, '<path d="M140 154l-20 34" stroke="var(--cor-primaria)"/>')}
      ${parte(6, '<path d="M140 154l20 34" stroke="var(--cor-primaria)"/>')}
    </svg>`;
  }

  function htmlForca() {
    const j = ativo('forca') || ultimo('forca');
    const p = calcularPlacar(jogos, eu, outro).forca;
    if (!j) return htmlForcaNova();
    const e = j.estado;
    const andamento = j.status === 'andamento';
    const adivinho = e.adivinha === eu;
    const podeChutar = andamento && adivinho;
    const palavra = e.palavra ? esc(e.palavra) : '';
    let aviso = '';
    if (!andamento) {
      if (e.fim === 'acertou') aviso = adivinho ? `Você acertou! 🎉 A palavra era <b>${palavra}</b>.` : `${esc(nomeOutro)} acertou a sua palavra: <b>${palavra}</b>.`;
      else if (e.fim === 'perdeu') aviso = adivinho ? `Não foi dessa vez. A palavra era <b>${palavra}</b>.` : `${esc(nomeOutro)} não acertou. A palavra era <b>${palavra}</b>.`;
      else aviso = `Partida encerrada. A palavra era <b>${palavra}</b>.`;
    } else if (!adivinho) aviso = `${esc(nomeOutro)} está adivinhando a sua palavra.`;

    return `<div class="jogo-tela">
      ${cabecalho('Forca', andamento ? e.adivinha : null, p)}
      <div class="forca-area">
        ${desenhoForca(e.erros)}
        <div>
          ${e.dica ? `<p class="forca-dica"><b>${e.autor === eu ? 'Sua dica' : `Dica de ${esc(nomeOutro)}`}</b>${esc(e.dica)}</p>` : ''}
          <p class="forca-quem">${e.tamanho} letras</p>
          <div class="forca-palavra" aria-label="Palavra: ${e.mascara.map((c) => c || 'vazio').join(', ')}">${e.mascara.map((c, i) => {
            const real = e.palavra ? e.palavra[i] : c;
            return real === ' ' ? '<span class="espaco"></span>' : `<span>${esc(c || (!andamento && real) || '')}</span>`;
          }).join('')}</div>
          <p class="forca-erros">Erros: ${Array.from({ length: MAX_ERROS_FORCA }, (_, i) => `<i class="${i < e.erros ? 'cheio' : ''}"></i>`).join('')} ${e.erros} de ${MAX_ERROS_FORCA}</p>
          ${aviso ? `<p class="aviso-vez" style="text-align:left;font-size:1.1rem" role="status" aria-live="polite">${aviso}</p>` : '<p class="sr-only" role="status" aria-live="polite"></p>'}
          <div class="teclado" aria-label="Letras">${ALFABETO.map((l) => {
            const usada = e.letras.includes(l);
            const certa = usada && e.mascara.includes(l);
            return `<button type="button" data-letra="${l}" class="${usada ? (certa ? 'acerto' : 'erro') : ''}" ${usada || !podeChutar ? 'disabled' : ''} aria-label="Letra ${l}${usada ? (certa ? ', acertou' : ', errou') : ''}">${l}</button>`;
          }).join('')}</div>
          <div class="grupo-botoes" style="margin-top:1rem">
            ${andamento ? `<button type="button" class="botao-fantasma" data-forca-desistir>${icone('fechar')} Encerrar partida</button>` : ''}
            <button type="button" class="${andamento ? 'botao-sec' : 'botao'}" data-abrir-jogo="forca-nova">${icone('mais')} Nova palavra</button>
          </div>
        </div>
      </div>
    </div>`;
  }

  function htmlForcaNova() {
    return `<div class="jogo-tela">
      <button type="button" class="botao-fantasma pequeno" data-voltar-diversao>${icone('esquerda')} Diversão</button>
      <h1 class="titulo-pagina" tabindex="-1">Nova palavra na forca</h1>
      <form class="cartao formulario forca-nova" data-forca-form novalidate>
        <div class="campo">
          <label for="forca-palavra">Palavra secreta</label>
          <input id="forca-palavra" type="password" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="24" required>
          <span class="dica">Só letras (pode ter espaço), de 3 a 24. ${esc(nomeOutro)} não consegue ver a palavra, nem mexendo no navegador.</span>
          <label class="opcao" style="margin-top:.4rem"><input type="checkbox" data-mostrar-palavra><span>Mostrar a palavra</span></label>
        </div>
        <div class="campo">
          <label for="forca-dica">Dica <span class="dica">(opcional)</span></label>
          <input id="forca-dica" maxlength="80" autocomplete="off">
        </div>
        ${ativo('forca') ? `<p class="dica">${icone('info')} A forca que está em andamento será encerrada.</p>` : ''}
        <div class="grupo-botoes"><button type="submit" class="botao">${icone('enviar')} Desafiar ${esc(nomeOutro)}</button></div>
      </form>
    </div>`;
  }

  function desenharTela({ focar = false } = {}) {
    if (!tela) return;
    const html = tela.tipo === 'velha' ? htmlVelha() : tela.tipo === 'forca' ? htmlForca() : htmlForcaNova();
    const ativoAntes = document.activeElement?.dataset?.casa ?? document.activeElement?.dataset?.letra;
    el.innerHTML = html;
    if (focar) el.querySelector('h1')?.focus();
    else if (ativoAntes !== undefined) el.querySelector(`[data-casa="${ativoAntes}"]:not(:disabled), [data-letra="${ativoAntes}"]:not(:disabled)`)?.focus();
  }

  // Quando não é a minha vez, confere de tempos em tempos (caso o "ao vivo" caia)
  let timerEspera = null;
  function vigiarEspera() {
    clearInterval(timerEspera);
    timerEspera = setInterval(async () => {
      if (!tela || document.visibilityState !== 'visible') return;
      const j = ativo(tela.tipo === 'velha' ? 'velha' : 'forca');
      const esperando = j && (tela.tipo === 'velha' ? j.estado.vez !== eu : j.estado.adivinha !== eu);
      if (!esperando) return;
      const antes = JSON.stringify(j);
      await carregarJogos();
      const depois = jogos.find((x) => x.id === j.id);
      if (tela && JSON.stringify(depois) !== antes) desenharTela();
    }, 12000);
  }

  function abrir(tipo) {
    trocarModo(() => {
      tela = { tipo };
      desenharTela({ focar: true });
      vigiarEspera();
      const teclas = (ev) => {
        if (tela?.tipo !== 'forca' || ev.ctrlKey || ev.metaKey || ev.altKey || /input|textarea/i.test(ev.target.tagName)) return;
        const l = ev.key?.length === 1 ? ev.key.toUpperCase() : '';
        const botao = l && el.querySelector(`[data-letra="${l}"]:not(:disabled)`);
        if (botao) { ev.preventDefault(); botao.click(); }
      };
      document.addEventListener('keydown', teclas);
      return () => { tela = null; clearInterval(timerEspera); document.removeEventListener('keydown', teclas); };
    });
  }

  // ===================== Ações =====================
  const notificar = (titulo, corpo, jogo) => notificarOutro({ titulo, corpo, url: `/#/diversao?jogo=${jogo}`, tag: `jogo-${jogo}` });

  async function executar(fn) {
    if (enviando) return null;
    enviando = true;
    try { return await fn(); } catch (e) { toast(e.message, 'erro'); await carregarJogos(); desenharTela(); return null; } finally { enviando = false; }
  }

  function trocarNaLista(j) {
    if (!j) return;
    jogos = [j, ...jogos.filter((x) => x.id !== j.id)];
  }

  async function velhaNova() {
    const j = await executar(() => dados.velhaNova());
    if (!j) return;
    await carregarJogos();
    trocarNaLista(j);
    desenharTela();
    avisar('jogo', { jogo: j.id });
    notificar('Jogo da velha', j.estado.vez === outro ? `${perfil.nome} começou uma partida. Você começa!` : `${perfil.nome} começou uma partida de jogo da velha.`, 'velha');
  }

  async function velhaJogar(casa) {
    const j0 = ativo('velha');
    if (!j0) return;
    const j = await executar(() => dados.velhaJogar(j0.id, casa));
    if (!j) return;
    trocarNaLista(j);
    desenharTela();
    avisar('jogo', { jogo: j.id });
    if (j.status === 'andamento') notificar('Jogo da velha', `${perfil.nome} jogou. Sua vez!`, 'velha');
    else if (j.estado.vencedor === eu) notificar('Jogo da velha', `${perfil.nome} ganhou essa 😜 Revanche?`, 'velha');
    else notificar('Jogo da velha', 'Deu velha! Bora de novo?', 'velha');
  }

  async function forcaChutar(letra) {
    const j0 = ativo('forca');
    if (!j0) return;
    const j = await executar(() => dados.forcaChutar(j0.id, letra));
    if (!j) return;
    trocarNaLista(j);
    desenharTela();
    const anuncio = el.querySelector('[role="status"]');
    if (anuncio && j.status === 'andamento') anuncio.textContent = j.estado.mascara.includes(letra) ? `Tem ${letra}!` : `Não tem ${letra}.`;
    avisar('jogo', { jogo: j.id });
    if (j.estado.fim === 'acertou') notificar('Forca', `${perfil.nome} acertou a sua palavra: ${j.estado.palavra}`, 'forca');
    else if (j.estado.fim === 'perdeu') notificar('Forca', `${perfil.nome} não acertou a sua palavra (${j.estado.palavra}) 😏`, 'forca');
  }

  async function forcaNova(form) {
    const campo = form.querySelector('#forca-palavra');
    if (!palavraValida(campo.value)) {
      campo.setAttribute('aria-invalid', 'true');
      campo.focus();
      toast('Use só letras (de 3 a 24). Acentos podem: viram letra sem acento.', 'erro');
      return;
    }
    const j = await executar(() => dados.forcaNova(campo.value, form.querySelector('#forca-dica').value));
    if (!j) return;
    await carregarJogos();
    trocarNaLista(j);
    tela = { tipo: 'forca' };
    desenharTela({ focar: true });
    avisar('jogo', { jogo: j.id });
    notificar('Forca', `${perfil.nome} escolheu uma palavra pra você adivinhar!`, 'forca');
  }

  async function desistir(tipo, mensagem) {
    const j0 = ativo(tipo);
    if (!j0) return;
    const ok = await confirmar({ titulo: tipo === 'velha' ? 'Recomeçar a partida?' : 'Encerrar a forca?', mensagem, textoConfirmar: tipo === 'velha' ? 'Recomeçar' : 'Encerrar' });
    if (!ok) return;
    if (tipo === 'velha') { await executar(() => dados.desistir(j0.id)); await velhaNova(); return; }
    const j = await executar(() => dados.desistir(j0.id));
    if (!j) return;
    trocarNaLista(j);
    desenharTela();
    avisar('jogo', { jogo: j.id });
  }

  // ===================== Eventos =====================
  function aoClicar(ev) {
    const b = ev.target.closest('button');
    if (!b || !el.contains(b)) return;
    if (b.dataset.abrirJogo) { abrir(b.dataset.abrirJogo); return; }
    if (b.hasAttribute('data-voltar-diversao')) { voltar(); return; }
    if (b.dataset.casa !== undefined) { velhaJogar(Number(b.dataset.casa)); return; }
    if (b.dataset.letra) { forcaChutar(b.dataset.letra); return; }
    if (b.hasAttribute('data-velha-nova')) { velhaNova(); return; }
    if (b.hasAttribute('data-velha-recomecar')) { desistir('velha', 'A partida atual não conta no placar.'); return; }
    if (b.hasAttribute('data-forca-desistir')) { desistir('forca', 'A palavra aparece e a partida não conta no placar.'); return; }
    if (b.hasAttribute('data-rd-editar')) { editandoResposta = true; redesenharResposta(); el.querySelector('#rd-texto')?.focus(); return; }
    if (b.hasAttribute('data-rd-cancelar')) { editandoResposta = false; redesenharResposta(); }
  }
  function aoEnviar(ev) {
    const form = ev.target;
    if (form.matches('[data-rd-form]')) { ev.preventDefault(); responder(form); }
    else if (form.matches('[data-forca-form]')) { ev.preventDefault(); forcaNova(form); }
  }
  function aoDigitar(ev) {
    if (ev.target.id === 'rd-texto') {
      const c = el.querySelector('[data-rd-contador]');
      if (c) c.textContent = `${ev.target.value.length} / ${MAX_RESPOSTA}`;
      ev.target.removeAttribute('aria-invalid');
    }
  }
  function aoMarcar(ev) {
    if (ev.target.matches('[data-mostrar-palavra]')) {
      const campo = el.querySelector('#forca-palavra');
      if (campo) campo.type = ev.target.checked ? 'text' : 'password';
    }
  }
  el.addEventListener('click', aoClicar);
  el.addEventListener('submit', aoEnviar);
  el.addEventListener('input', aoDigitar);
  el.addEventListener('change', aoMarcar);

  // Ao vivo: o outro jogou ou respondeu
  const pararOuvir = sala ? sala.ouvir(async (msg) => {
    if (msg.de === eu) return;
    if (msg.tipo === 'jogo') {
      await carregarJogos();
      if (tela) desenharTela(); else redesenharCartoes();
    } else if (msg.tipo === 'resposta-dia') {
      await carregarRespostas();
      if (!tela && !editandoResposta) redesenharResposta();
    }
  }) : () => {};
  const aoVoltarParaAba = async () => {
    if (document.visibilityState !== 'visible' || !el.isConnected) return;
    await Promise.all([carregarJogos(), carregarRespostas()]);
    if (tela && tela.tipo !== 'forca-nova') desenharTela();
    else if (!tela) { redesenharCartoes(); if (!editandoResposta) redesenharResposta(); }
  };
  document.addEventListener('visibilitychange', aoVoltarParaAba);

  return {
    /** HTML dos espaços na visão geral (preenchidos por preencherVisao). */
    htmlEspacos: () => ({
      resposta: `<div data-resposta-dia>${htmlRespostaDoDia()}</div>`,
      jogos: `
        <section class="secao-jogos" aria-labelledby="titulo-jogos">
          <div class="cabecalho-secao pequeno"><div>
            <h2 id="titulo-jogos" class="subtitulo">${icone('estrela')} Jogos</h2>
            <p>Joguem juntos: cada jogada aparece na hora para ${esc(nomeOutro)}.</p>
          </div></div>
          <div data-jogos>${htmlCartoesJogos()}</div>
        </section>`,
    }),
    async carregar() { await Promise.all([carregarJogos(), carregarRespostas()]); },
    /** Busca de novo e redesenha a visão geral (ex.: ao voltar de um jogo). */
    async atualizar() {
      await Promise.all([carregarJogos(), carregarRespostas()]);
      if (!tela && el.isConnected) { redesenharCartoes(); if (!editandoResposta) redesenharResposta(); }
    },
    abrir,
    estaNumJogo: () => Boolean(tela),
    destruir() {
      clearInterval(timerEspera);
      pararOuvir();
      document.removeEventListener('visibilitychange', aoVoltarParaAba);
      el.removeEventListener('click', aoClicar);
      el.removeEventListener('submit', aoEnviar);
      el.removeEventListener('input', aoDigitar);
      el.removeEventListener('change', aoMarcar);
    },
  };
}
