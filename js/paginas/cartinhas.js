// Cartinhas: coleção + editor livre com decoração e pré-visualização.
// Também recebe os bilhetes rápidos (Enviar elogio e Lembre de mim), ver ../bilhetes.js.
import { listar, salvar, remover } from '../store/index.js';
import { icone } from '../ui/icones.js';
import { adesivo, enfeite, ADESIVOS, PACOTES, pacotesEmOrdem } from '../ui/ilustracoes.js';
import { esc, toast, abrirModal, confirmar, formatarData, hojeISO, seloExemplo, marcarErro, limparErros } from '../ui/dom.js';
import { PERFIS } from '../auth.js';
import { temaAtual, temasDisponiveis } from '../tema.js';
import {
  htmlCarta, estiloPadrao, PAPEIS, FONTES, ALINHAMENTOS, MOLDURAS, CORES_PAPEL, CORES_TINTA, MAX_ADESIVOS,
} from './carta-visual.js';
import { ehBilhete, htmlBilhete, abrirElogio, abrirLembrete, avisarOutro, TIPOS_BILHETE } from '../bilhetes.js';

/** Quem pode ver a cartinha: quem escreveu e, depois de enviada, quem recebeu. */
/** Cartinha agendada que ainda não chegou na hora (quem recebe não vê; com Supabase o banco nem entrega). */
export const aindaAgendada = (c) => Boolean(c?.agendadaPara) && Date.parse(c.agendadaPara) > Date.now();

export function cartaVisivelPara(c, perfilId) {
  if (!c.de) return true; // cartinhas antigas/exemplos sem autor definido
  if (c.de === perfilId) return true;
  return c.para === perfilId && Boolean(c.enviadaEm) && !aindaAgendada(c);
}

const DATA_HORA = { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' };
/** "AAAA-MM-DDTHH:MM" no horário do aparelho (para o campo datetime-local) */
function paraCampoDataHora(data) {
  const d = new Date(data);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

function grupoDa(c, eu) {
  if (c.enviadaEm && c.para === eu && c.de !== eu) return 'recebidas';
  if (c.enviadaEm && c.de === eu) return 'enviadas';
  return 'rascunhos';
}

const ABAS = { recebidas: 'Recebidas', enviadas: 'Enviadas', rascunhos: 'Rascunhos' };

export async function renderizar(el, ctx) {
  const eu = ctx.perfil.id;
  const outro = Object.values(PERFIS).find((p) => p.id !== eu);
  const nome = (id) => PERFIS[id]?.nome || '';
  let cartas = [];
  let modo = 'colecao';
  let aba = 'recebidas';

  async function carregar() {
    el.innerHTML = '<div class="estado"><span class="spinner pequeno" aria-hidden="true"></span> Carregando cartinhas…</div>';
    try {
      cartas = (await listar('cartas')).filter((c) => cartaVisivelPara(c, eu));
    } catch (e) {
      el.innerHTML = `<div class="aviso erro" role="alert">${icone('alerta')}<p>${esc(e.message)}</p></div>`;
      return false;
    }
    return true;
  }

  const avisarMudanca = () => window.dispatchEvent(new CustomEvent('nc:cartas-mudou'));
  const naoLida = (c) => grupoDa(c, eu) === 'recebidas' && !c.lidaEm;

  // ---------------- Coleção ----------------
  function tituloBilhete(c) {
    const recebido = grupoDa(c, eu) === 'recebidas';
    if (c.tipo === 'elogio') return recebido ? `Elogio de ${nome(c.de)}` : `Elogio para ${nome(c.para)}`;
    if (c.tipo === 'desenho') return recebido ? `Desenho de ${nome(c.de)}` : `Desenho para ${nome(c.para)}`;
    return recebido ? `${nome(c.de)} lembrou de você` : `Lembre de mim para ${nome(c.para)}`;
  }
  const TEXTO_DOBRADO = { elogio: 'Elogio novo', lembrete: 'Alguém lembrou de você', desenho: 'Um desenho para você' };

  function htmlCartaoBilhete(c) {
    const grupo = grupoDa(c, eu);
    const fechada = naoLida(c);
    const tipo = TIPOS_BILHETE[c.tipo];
    const titulo = tituloBilhete(c);
    const meta = grupo === 'recebidas'
      ? esc(formatarData(c.enviadaEm))
      : `${esc(formatarData(c.enviadaEm))} · ${c.lidaEm ? `${icone('check')} visto` : 'ainda não visto'}`;
    return `
      <li class="cartao-carta cartao-bilhete ${fechada ? 'nao-lida' : ''}">
        <button type="button" class="carta-miniatura" data-abrir="${esc(c.id)}" aria-label="${fechada ? `Abrir: ${esc(titulo)}` : `Ver: ${esc(titulo)}`}">
          ${fechada
            ? `<span class="bilhete-dobrado tipo-${esc(c.tipo)}" aria-hidden="true">${icone(tipo.icone, 'cheio')}<span>${TEXTO_DOBRADO[c.tipo]}</span></span>`
            : htmlBilhete(c, { compacto: true })}
        </button>
        <div class="cartao-carta-info">
          <div>
            <h2 class="cartao-carta-titulo">${esc(titulo)} ${fechada ? '<span class="selo selo-nova">Novo</span>' : ''}</h2>
            <p class="meta">${meta}</p>
          </div>
          <div class="grupo-botoes acoes-carta">
            <button type="button" class="botao-icone" data-abrir="${esc(c.id)}" aria-label="Ver ${esc(titulo)}" title="Ver">${icone('olho')}</button>
            ${grupo === 'recebidas' ? `<button type="button" class="botao-icone" data-abrir="${esc(c.id)}" aria-label="Responder ${esc(nome(c.de))}" title="Responder">${icone('desfazer')}</button>` : ''}
            ${grupo === 'enviadas' ? `<button type="button" class="botao-icone perigo" data-excluir="${esc(c.id)}" aria-label="Excluir ${esc(titulo)}" title="Excluir">${icone('lixeira')}</button>` : ''}
          </div>
        </div>
      </li>`;
  }

  function htmlCartao(c) {
    if (ehBilhete(c)) return htmlCartaoBilhete(c);
    const grupo = grupoDa(c, eu);
    const fechada = naoLida(c);
    let meta = '';
    if (grupo === 'recebidas') meta = `De ${esc(nome(c.de))} · ${esc(formatarData(c.enviadaEm))}`;
    else if (grupo === 'enviadas' && aindaAgendada(c)) meta = `<span class="selo selo-agendada">${icone('calendario')} Agendada</span> Chega para ${esc(nome(c.para))} em ${esc(formatarData(c.agendadaPara, DATA_HORA))}`;
    else if (grupo === 'enviadas') meta = `Para ${esc(nome(c.para))} · ${c.lidaEm ? `${icone('check')} lida em ${esc(formatarData(c.lidaEm))}` : 'ainda não lida'}`;
    else meta = c.data ? `Rascunho · ${esc(formatarData(c.data))}` : 'Rascunho';
    const podeEditar = grupo !== 'recebidas';
    return `
      <li class="cartao-carta ${fechada ? 'nao-lida' : ''}">
        <button type="button" class="carta-miniatura" data-abrir="${esc(c.id)}" aria-label="${fechada ? `Abrir a cartinha nova de ${esc(nome(c.de))}` : `Abrir a cartinha ${esc(c.titulo)}`}">
          ${fechada
            ? `<span class="envelope-fechado grande" aria-hidden="true"><span class="selo-cera">${icone('coracao')}</span></span>`
            : htmlCarta(c, { compacta: true })}
        </button>
        <div class="cartao-carta-info">
          <div>
            <h2 class="cartao-carta-titulo">${fechada ? 'Cartinha nova' : esc(c.titulo)} ${fechada ? '<span class="selo selo-nova">Nova</span>' : ''} ${c.exemplo ? seloExemplo() : ''}</h2>
            <p class="meta">${meta}</p>
          </div>
          <div class="grupo-botoes acoes-carta">
            <button type="button" class="botao-icone" data-abrir="${esc(c.id)}" aria-label="Abrir ${esc(c.titulo)}" title="Abrir">${icone('olho')}</button>
            ${grupo === 'recebidas' ? `<button type="button" class="botao-icone" data-responder="${esc(c.id)}" aria-label="Responder ${esc(nome(c.de))}" title="Responder">${icone('desfazer')}</button>` : ''}
            ${grupo === 'rascunhos' ? `<button type="button" class="botao-icone" data-enviar="${esc(c.id)}" aria-label="Enviar ${esc(c.titulo)} para ${esc(outro.nome)}" title="Enviar para ${esc(outro.nome)}">${icone('carta')}</button>` : ''}
            ${podeEditar ? `<button type="button" class="botao-icone" data-editar="${esc(c.id)}" aria-label="Editar ${esc(c.titulo)}" title="Editar">${icone('editar')}</button>
            <button type="button" class="botao-icone perigo" data-excluir="${esc(c.id)}" aria-label="Excluir ${esc(c.titulo)}" title="Excluir">${icone('lixeira')}</button>` : ''}
          </div>
        </div>
      </li>`;
  }

  function mostrarColecao({ focar = false, focarAba = false } = {}) {
    modo = 'colecao';
    const porGrupo = { recebidas: [], enviadas: [], rascunhos: [] };
    for (const c of cartas) porGrupo[grupoDa(c, eu)].push(c);
    const data = (c) => String(c.enviadaEm || c.atualizadoEm || '');
    Object.values(porGrupo).forEach((l) => l.sort((x, y) => data(y).localeCompare(data(x))));
    porGrupo.recebidas.sort((x, y) => Number(naoLida(y)) - Number(naoLida(x)));
    const novas = porGrupo.recebidas.filter(naoLida).length;
    const lista = porGrupo[aba];
    const vazios = {
      recebidas: { t: 'Nenhuma cartinha recebida ainda', p: `Quando ${esc(outro.nome)} te mandar uma cartinha, ela chega aqui num envelope fechado.` },
      enviadas: { t: 'Você ainda não enviou cartinhas', p: `Escreva uma e escolha "Enviar para ${esc(outro.nome)}".` },
      rascunhos: { t: 'Nenhum rascunho', p: 'Cartinhas guardadas só com você, ainda não enviadas, ficam aqui.' },
    };
    el.innerHTML = `
      <div class="cabecalho-secao">
        <div>
          <h1 class="titulo-pagina"><span class="enfeite-titulo" aria-hidden="true">${enfeite('cartinhas')}</span>Cartinhas</h1>
          <p>Escreva, enfeite e mande cartinhas para ${esc(outro.nome)}.</p>
        </div>
        <div class="grupo-botoes acoes-cartinhas">
          <button type="button" class="botao-sec" data-elogio>${icone('sparkle')} Enviar elogio</button>
          <button type="button" class="botao-sec" data-lembrete>${icone('coracao')} Lembre de mim</button>
          <button type="button" class="botao" data-nova>${icone('mais')} Nova cartinha</button>
        </div>
      </div>
      <div class="abas" role="tablist" aria-label="Cartinhas">
        ${Object.entries(ABAS).map(([id, n]) => `
          <button type="button" class="aba" role="tab" id="aba-cartas-${id}" aria-controls="painel-cartas" aria-selected="${aba === id}" tabindex="${aba === id ? 0 : -1}" data-aba="${id}">
            ${n} <span class="contador">${porGrupo[id].length}</span>${id === 'recebidas' && novas ? `<span class="selo selo-nova">${novas} ${novas === 1 ? 'nova' : 'novas'}</span>` : ''}
          </button>`).join('')}
      </div>
      <div id="painel-cartas" role="tabpanel" aria-labelledby="aba-cartas-${aba}">
        ${lista.length ? `<ul class="grade colecao-cartas" role="list">${lista.map(htmlCartao).join('')}</ul>` : `
          <div class="vazio">
            <span class="ilustracao" aria-hidden="true">${enfeite('vazio')}</span>
            <h3>${vazios[aba].t}</h3>
            <p>${vazios[aba].p}</p>
            <button type="button" class="botao" data-nova>${icone('carta')} Escrever cartinha</button>
          </div>`}
      </div>`;
    if (focar) el.querySelector('h1')?.focus();
    if (focarAba) el.querySelector(`[data-aba="${aba}"]`)?.focus();
  }

  function mostrarLeituraBilhete(carta, { revelar = false } = {}) {
    const grupo = grupoDa(carta, eu);
    const { el: modal, fechar } = abrirModal({
      titulo: carta.tipo === 'elogio' && grupo === 'recebidas' ? `Um elogio de ${nome(carta.de)}` : tituloBilhete(carta),
      corpo: `<div class="bilhete-leitura ${revelar ? 'revelar' : ''}">${htmlBilhete(carta)}</div>
        <p class="meta centro">${grupo === 'recebidas'
          ? `Recebido em ${esc(formatarData(carta.enviadaEm, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))}`
          : aindaAgendada(carta)
            ? `Agendada: chega para ${esc(nome(carta.para))} em ${esc(formatarData(carta.agendadaPara, DATA_HORA))}`
            : `Enviado em ${esc(formatarData(carta.enviadaEm, { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }))} · ${carta.lidaEm ? 'visto' : 'ainda não visto'}`}</p>`,
      rodape: grupo === 'recebidas' && carta.tipo === 'desenho'
        ? `<button type="button" class="botao-fantasma" data-fechar>Fechar</button>
           <a class="botao" href="#/diversao?como" data-fechar>${icone('pincel')} Desenhar de volta</a>`
        : grupo === 'recebidas'
        ? `<button type="button" class="botao-fantasma" data-fechar>Fechar</button>
           <button type="button" class="botao-sec" data-responder-lembrete>${icone('coracao')} Lembre de mim</button>
           <button type="button" class="botao" data-responder-elogio>${icone('sparkle')} Elogiar de volta</button>`
        : '<button type="button" class="botao" data-fechar>Fechar</button>',
    });
    modal.querySelector('[data-responder-elogio]')?.addEventListener('click', () => { fechar(); enviarRapido('elogio'); });
    modal.querySelector('[data-responder-lembrete]')?.addEventListener('click', () => { fechar(); enviarRapido('lembrete'); });
  }

  async function enviarRapido(tipo) {
    const salvo = await (tipo === 'elogio' ? abrirElogio(ctx.perfil) : abrirLembrete(ctx.perfil));
    if (!salvo || !el.isConnected) return;
    cartas = [salvo, ...cartas.filter((c) => c.id !== salvo.id)];
    if (modo === 'colecao') mostrarColecao();
  }

  function mostrarLeitura(carta) {
    if (ehBilhete(carta)) return mostrarLeituraBilhete(carta);
    const grupo = grupoDa(carta, eu);
    const { el: modal, fechar } = abrirModal({
      titulo: carta.titulo,
      tamanho: 'largo',
      corpo: `<div class="carta-leitura">${htmlCarta(carta)}</div>
        ${grupo === 'recebidas' ? `<p class="meta centro">De ${esc(nome(carta.de))}, enviada em ${esc(formatarData(carta.enviadaEm, { day: 'numeric', month: 'long', year: 'numeric' }))}</p>` : ''}
        ${grupo === 'enviadas' ? `<p class="meta centro">Para ${esc(nome(carta.para))} · ${carta.lidaEm ? `lida em ${esc(formatarData(carta.lidaEm, { day: 'numeric', month: 'long' }))}` : 'ainda não lida'}</p>` : ''}`,
      rodape: `
        <button type="button" class="botao-fantasma" data-fechar>Fechar</button>
        ${grupo === 'recebidas'
          ? `<button type="button" class="botao" data-responder-modal>${icone('desfazer')} Responder</button>`
          : `<button type="button" class="botao-sec" data-editar-modal>${icone('editar')} Editar</button>`}`,
    });
    modal.querySelector('[data-editar-modal]')?.addEventListener('click', () => { fechar(); mostrarEditor(carta); });
    modal.querySelector('[data-responder-modal]')?.addEventListener('click', () => { fechar(); mostrarEditor(null, { respostaA: carta }); });
  }

  async function marcarComoLida(carta) {
    try {
      const salvo = await salvar('cartas', { ...carta, lidaEm: new Date().toISOString() });
      cartas = cartas.map((c) => (c.id === salvo.id ? salvo : c));
      avisarMudanca();
      return salvo;
    } catch (e) {
      toast(e.message, 'erro');
      return carta;
    }
  }

  function abrirCarta(id) {
    const carta = cartas.find((c) => c.id === id);
    if (!carta) return;
    if (!naoLida(carta)) return mostrarLeitura(carta);
    if (ehBilhete(carta)) {
      marcarComoLida(carta).then((lida) => { if (el.isConnected && modo === 'colecao') mostrarColecao(); return lida; });
      return mostrarLeituraBilhete(carta, { revelar: true });
    }

    // Cartinha nova: primeiro o envelope fechado
    const { el: modal, fechar } = abrirModal({
      rotulo: `Cartinha de ${nome(carta.de)}`,
      tamanho: 'envelope-modal',
      corpo: `
        <div class="envelope-cena">
          <p class="envelope-de">Uma cartinha de <strong>${esc(nome(carta.de))}</strong> para você</p>
          <div class="envelope" data-envelope>
            <div class="envelope-costas"></div>
            <div class="envelope-papel" style="--papel:${esc(carta.estilo?.cor || '#fffaf5')}"><span>${esc(carta.titulo)}</span></div>
            <div class="envelope-frente"></div>
            <div class="envelope-aba"></div>
            <span class="selo-cera" aria-hidden="true">${icone('coracao')}</span>
          </div>
          <div class="grupo-botoes">
            <button type="button" class="botao-fantasma" data-fechar>Depois</button>
            <button type="button" class="botao" data-abrir-envelope>${icone('carta')} Abrir</button>
          </div>
        </div>`,
    });
    const botao = modal.querySelector('[data-abrir-envelope]');
    botao.focus();
    botao.addEventListener('click', async () => {
      botao.disabled = true;
      modal.querySelector('[data-envelope]').classList.add('abrindo');
      const lida = marcarComoLida(carta);
      const espera = document.documentElement.dataset.movimento === 'reduzir' ? 0 : 1100;
      await new Promise((r) => setTimeout(r, espera));
      const atualizada = await lida;
      fechar();
      mostrarColecao();
      mostrarLeitura(atualizada);
    });
  }

  async function enviarRascunho(id) {
    const carta = cartas.find((c) => c.id === id);
    if (!carta) return;
    const ok = await confirmar({ titulo: `Enviar para ${outro.nome}?`, mensagem: `"${carta.titulo}" vai aparecer nas cartinhas recebidas de ${outro.nome}.`, textoConfirmar: 'Enviar', perigo: false });
    if (!ok) return;
    try {
      const salvo = await salvar('cartas', { ...carta, de: eu, para: outro.id, enviadaEm: new Date().toISOString(), lidaEm: null, exemplo: false });
      cartas = cartas.map((c) => (c.id === salvo.id ? salvo : c));
      avisarOutro(salvo);
      toast(`Cartinha enviada para ${outro.nome}!`, 'sucesso');
      aba = 'enviadas';
      avisarMudanca();
      mostrarColecao({ focarAba: true });
    } catch (e) { toast(e.message, 'erro'); }
  }

  async function excluirCarta(id) {
    const carta = cartas.find((c) => c.id === id);
    if (!carta) return;
    const enviada = grupoDa(carta, eu) === 'enviadas';
    const ok = await confirmar({
      titulo: 'Excluir cartinha?',
      mensagem: enviada
        ? `"${carta.titulo}" será excluída para você e para ${nome(carta.para)}. Não dá para desfazer.`
        : `"${carta.titulo}" será excluída e não poderá ser recuperada.`,
    });
    if (!ok) return;
    try {
      await remover('cartas', id);
      cartas = cartas.filter((c) => c.id !== id);
      toast('Cartinha excluída.', 'sucesso');
      avisarMudanca();
      mostrarColecao({ focar: true });
    } catch (e) {
      toast(e.message, 'erro');
    }
  }

  // ---------------- Editor ----------------
  function mostrarEditor(original = null, { respostaA = null } = {}) {
    modo = 'editor';
    const base = original
      ? structuredClone(original)
      : { titulo: respostaA ? `Resposta: ${respostaA.titulo}`.slice(0, 80) : '', destinatario: '', mensagem: '', data: hojeISO(), estilo: estiloPadrao(temaAtual()) };
    const agendadaPendente = aindaAgendada(original);
    const jaEnviada = Boolean(original?.enviadaEm) && !agendadaPendente;
    const entregaInicial = jaEnviada ? 'enviar' : agendadaPendente ? 'agendar' : (original ? 'rascunho' : 'enviar');
    const amanha8 = new Date(); amanha8.setDate(amanha8.getDate() + 1); amanha8.setHours(8, 0, 0, 0);
    const valorAgendar = paraCampoDataHora(agendadaPendente ? original.agendadaPara : amanha8);
    base.estilo = { ...estiloPadrao(temaAtual()), ...(base.estilo || {}) };
    let adesivosSel = [...(base.estilo.adesivos || [])];
    let alterado = false;

    const corPersonalizada = !CORES_PAPEL.includes(base.estilo.cor);
    const pacotesOrdenados = pacotesEmOrdem(temaAtual(), temasDisponiveis());

    el.innerHTML = `
      <div class="cabecalho-secao">
        <div>
          <h1 class="titulo-pagina">${original ? 'Editar cartinha' : 'Nova cartinha'}</h1>
          <p>${original ? 'Ajuste o texto e a decoração e salve de novo.' : 'Escreva com calma. A pré-visualização mostra como vai ficar.'}</p>
        </div>
        <button type="button" class="botao-fantasma" data-voltar>${icone('esquerda')} Voltar para a coleção</button>
      </div>

      <form class="editor-carta" id="form-carta" novalidate>
        <div class="editor-campos">
          <section class="cartao formulario" aria-labelledby="sec-entrega">
            <h2 id="sec-entrega" class="subtitulo">${icone('carta')} Entrega</h2>
            ${jaEnviada ? `<p class="aviso">${icone('info')} Já enviada para ${esc(nome(original.para))} em ${esc(formatarData(original.enviadaEm))}. As mudanças aparecem para ${esc(nome(original.para))} também.</p>` : `
            <fieldset>
              <legend class="sr-only">O que fazer com a cartinha</legend>
              <div class="opcoes entrega">
                <label class="opcao"><input type="radio" name="entrega" value="enviar" ${entregaInicial === 'enviar' ? 'checked' : ''}><span>${icone('carta')} Enviar para ${esc(outro.nome)}</span></label>
                <label class="opcao"><input type="radio" name="entrega" value="agendar" ${entregaInicial === 'agendar' ? 'checked' : ''}><span>${icone('calendario')} Agendar a entrega</span></label>
                <label class="opcao"><input type="radio" name="entrega" value="rascunho" ${entregaInicial === 'rascunho' ? 'checked' : ''}><span>${icone('salvar')} Guardar como rascunho</span></label>
              </div>
            </fieldset>
            <div class="campo agendar-quando" data-agendar-quando ${entregaInicial === 'agendar' ? '' : 'hidden'}>
              <label for="carta-agendar">Entregar em</label>
              <input id="carta-agendar" name="agendarPara" type="datetime-local" value="${valorAgendar}" min="${paraCampoDataHora(Date.now() + 2 * 60 * 1000)}">
              <span class="dica">${esc(outro.nome)} só consegue ver a cartinha nesse horário, e recebe a notificação na hora.</span>
            </div>`}
          </section>

          <section class="cartao formulario" aria-labelledby="sec-conteudo">
            <h2 id="sec-conteudo" class="subtitulo">Conteúdo</h2>
            <div class="campo">
              <label for="carta-titulo">Título <span aria-hidden="true">*</span></label>
              <input id="carta-titulo" name="titulo" maxlength="80" required value="${esc(base.titulo)}" placeholder="Ex.: Para ler num dia difícil">
            </div>
            <div class="linha-campos">
              <div class="campo">
                <label for="carta-para">Como chamar <span class="dica">(opcional)</span></label>
                <input id="carta-para" name="destinatario" maxlength="40" value="${esc(base.destinatario || '')}" placeholder="Ex.: meu amor">
              </div>
              <div class="campo">
                <label for="carta-data">Data</label>
                <input id="carta-data" name="data" type="date" value="${esc(base.data || '')}">
              </div>
            </div>
            <div class="campo">
              <label for="carta-mensagem">Mensagem <span aria-hidden="true">*</span></label>
              <textarea id="carta-mensagem" name="mensagem" maxlength="5000" required rows="9" aria-describedby="carta-contador">${esc(base.mensagem)}</textarea>
              <p class="dica" id="carta-contador"></p>
            </div>
          </section>

          <section class="cartao formulario" aria-labelledby="sec-estilo">
            <h2 id="sec-estilo" class="subtitulo">Papel e escrita</h2>
            <fieldset>
              <legend>Papel</legend>
              <div class="opcoes">
                ${Object.entries(PAPEIS).map(([id, nome]) => `
                  <label class="opcao"><input type="radio" name="papel" value="${id}" ${base.estilo.papel === id ? 'checked' : ''}><span><i class="amostra-papel papel-${id}" aria-hidden="true"></i>${nome}</span></label>`).join('')}
              </div>
            </fieldset>
            <fieldset>
              <legend>Cor do papel</legend>
              <div class="opcoes cores">
                ${CORES_PAPEL.map((c) => `
                  <label class="opcao cor"><input type="radio" name="cor" value="${c}" ${base.estilo.cor === c ? 'checked' : ''} aria-label="Cor ${c}"><span style="--c:${c}"></span></label>`).join('')}
                <label class="opcao cor-livre">
                  <input type="radio" name="cor" value="personalizada" ${corPersonalizada ? 'checked' : ''}>
                  <span>Outra cor</span>
                </label>
                <input type="color" name="corLivre" value="${corPersonalizada ? esc(base.estilo.cor) : '#fff7e8'}" aria-label="Escolher outra cor de papel" class="seletor-cor">
              </div>
            </fieldset>
            <div class="linha-campos">
              <div class="campo">
                <label for="carta-fonte">Fonte</label>
                <select id="carta-fonte" name="fonte">
                  ${Object.entries(FONTES).map(([id, f]) => `<option value="${id}" ${base.estilo.fonte === id ? 'selected' : ''}>${f.nome}</option>`).join('')}
                </select>
              </div>
              <div class="campo">
                <label for="carta-tinta">Cor da tinta</label>
                <select id="carta-tinta" name="tinta">
                  ${Object.entries(CORES_TINTA).map(([v, n]) => `<option value="${v}" ${base.estilo.tinta === v ? 'selected' : ''}>${n}</option>`).join('')}
                </select>
              </div>
            </div>
            <fieldset>
              <legend>Alinhamento</legend>
              <div class="opcoes">
                ${Object.entries(ALINHAMENTOS).map(([id, a]) => `
                  <label class="opcao"><input type="radio" name="alinhamento" value="${id}" ${base.estilo.alinhamento === id ? 'checked' : ''}><span>${icone(a.icone)}${a.nome}</span></label>`).join('')}
              </div>
            </fieldset>
            <fieldset>
              <legend>Moldura</legend>
              <div class="opcoes">
                ${Object.entries(MOLDURAS).map(([id, nome]) => `
                  <label class="opcao"><input type="radio" name="moldura" value="${id}" ${base.estilo.moldura === id ? 'checked' : ''}><span>${nome}</span></label>`).join('')}
              </div>
            </fieldset>
          </section>

          <section class="cartao formulario" aria-labelledby="sec-enfeites">
            <h2 id="sec-enfeites" class="subtitulo">Enfeites <span class="dica" id="contador-enfeites"></span></h2>
            ${pacotesOrdenados.map((p) => `
              <fieldset class="pacote-enfeites">
                <legend>${PACOTES[p].nome}</legend>
                <div class="enfeites">
                  ${PACOTES[p].itens.map((id) => `
                    <label class="enfeite-opcao" title="${ADESIVOS[id].nome}">
                      <input type="checkbox" name="adesivo" value="${id}" ${adesivosSel.includes(id) ? 'checked' : ''}>
                      <span>${adesivo(id)}<span class="sr-only">${ADESIVOS[id].nome}</span></span>
                    </label>`).join('')}
                </div>
              </fieldset>`).join('')}
          </section>
        </div>

        <aside class="editor-previa" aria-labelledby="titulo-previa">
          <div class="previa-topo">
            <h2 id="titulo-previa" class="subtitulo">Pré-visualização</h2>
            <button type="button" class="botao-sec pequeno" data-previa-cheia>${icone('olho')} Ver em tamanho grande</button>
          </div>
          <div class="previa-carta" id="previa-carta"></div>
          <div class="grupo-botoes acoes-editor">
            <button type="submit" class="botao" data-botao-salvar></button>
            <button type="button" class="botao-fantasma" data-voltar>Cancelar</button>
          </div>
        </aside>
      </form>`;

    const form = el.querySelector('#form-carta');
    const previa = el.querySelector('#previa-carta');
    const contador = el.querySelector('#carta-contador');
    const contadorEnfeites = el.querySelector('#contador-enfeites');

    function estadoAtual() {
      const f = form.elements;
      const corRadio = form.querySelector('input[name="cor"]:checked')?.value;
      return {
        ...(original || {}),
        titulo: f.titulo.value.trim(),
        destinatario: f.destinatario.value.trim(),
        data: f.data.value,
        mensagem: f.mensagem.value.replace(/\s+$/, ''),
        estilo: {
          papel: form.querySelector('input[name="papel"]:checked')?.value || 'liso',
          cor: corRadio === 'personalizada' ? f.corLivre.value : (corRadio || '#ffffff'),
          tinta: f.tinta.value,
          fonte: f.fonte.value,
          alinhamento: form.querySelector('input[name="alinhamento"]:checked')?.value || 'esquerda',
          moldura: form.querySelector('input[name="moldura"]:checked')?.value || 'nenhuma',
          adesivos: [...adesivosSel],
        },
      };
    }

    function entregaEscolhida() {
      return jaEnviada ? 'enviar' : (form.querySelector('input[name="entrega"]:checked')?.value || 'rascunho');
    }

    function atualizarBotao() {
      const b = form.querySelector('[data-botao-salvar]');
      if (jaEnviada) b.innerHTML = `${icone('salvar')} Salvar alterações`;
      else if (entregaEscolhida() === 'enviar') b.innerHTML = `${icone('carta')} Enviar para ${esc(outro.nome)}`;
      else if (entregaEscolhida() === 'agendar') b.innerHTML = `${icone('calendario')} Agendar entrega`;
      else b.innerHTML = `${icone('salvar')} Salvar rascunho`;
    }

    function atualizarPrevia() {
      atualizarBotao();
      const quando = form.querySelector('[data-agendar-quando]');
      if (quando) quando.hidden = entregaEscolhida() !== 'agendar';
      const atual = estadoAtual();
      previa.innerHTML = htmlCarta({ ...atual, titulo: atual.titulo || 'Título da cartinha' });
      contador.textContent = `${form.elements.mensagem.value.length} de 5000 caracteres`;
      contadorEnfeites.textContent = `(${adesivosSel.length} de ${MAX_ADESIVOS})`;
    }

    form.addEventListener('input', () => { alterado = true; atualizarPrevia(); });
    form.addEventListener('change', (e) => {
      alterado = true;
      if (e.target.name === 'adesivo') {
        const id = e.target.value;
        if (e.target.checked) {
          if (adesivosSel.length >= MAX_ADESIVOS) {
            e.target.checked = false;
            toast(`Use no máximo ${MAX_ADESIVOS} enfeites por cartinha.`, 'info');
          } else adesivosSel.push(id);
        } else adesivosSel = adesivosSel.filter((x) => x !== id);
      }
      if (e.target.name === 'corLivre') form.querySelector('input[name="cor"][value="personalizada"]').checked = true;
      atualizarPrevia();
    });

    el.querySelector('[data-previa-cheia]').addEventListener('click', () => {
      const atual = estadoAtual();
      abrirModal({
        titulo: 'Pré-visualização',
        tamanho: 'largo',
        corpo: `<div class="carta-leitura">${htmlCarta({ ...atual, titulo: atual.titulo || 'Título da cartinha' })}</div>`,
        rodape: '<button type="button" class="botao" data-fechar>Voltar a editar</button>',
      });
    });

    el.querySelectorAll('[data-voltar]').forEach((b) => b.addEventListener('click', async () => {
      if (alterado) {
        const descartar = await confirmar({ titulo: 'Descartar alterações?', mensagem: 'O que você escreveu ainda não foi salvo.', textoConfirmar: 'Descartar' });
        if (!descartar) return;
      }
      if (location.hash.includes('?')) history.replaceState(null, '', '#/cartinhas');
      mostrarColecao({ focar: true });
    }));

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      limparErros(form);
      const doc = estadoAtual();
      if (!doc.titulo) return marcarErro(form.elements.titulo, 'Dê um título para a cartinha.');
      if (!doc.mensagem.trim()) return marcarErro(form.elements.mensagem, 'Escreva a mensagem.');
      if (!original) { doc.autor = ctx.perfil.nome; doc.de = eu; }
      if (!doc.de) doc.de = eu; // cartinhas antigas passam a ter autor
      const entrega = entregaEscolhida();
      const enviar = !jaEnviada && entrega === 'enviar';
      const agendar = !jaEnviada && entrega === 'agendar';
      let quandoAgendada = null;
      if (agendar) {
        const campo = form.elements.agendarPara;
        quandoAgendada = campo.value ? new Date(campo.value) : null;
        if (!quandoAgendada || Number.isNaN(quandoAgendada.getTime())) return marcarErro(campo, 'Escolha o dia e a hora da entrega.');
        if (quandoAgendada.getTime() < Date.now() + 60 * 1000) return marcarErro(campo, 'Escolha um horário daqui a pelo menos 1 minuto.');
        doc.para = outro.id; doc.agendadaPara = quandoAgendada.toISOString(); doc.enviadaEm = doc.agendadaPara; doc.lidaEm = null;
      }
      if (enviar) { doc.para = outro.id; doc.enviadaEm = new Date().toISOString(); doc.lidaEm = null; doc.agendadaPara = null; }
      if (!jaEnviada && entrega === 'rascunho' && agendadaPendente) { doc.enviadaEm = null; doc.agendadaPara = null; }
      if (respostaA) doc.respostaA = respostaA.id;
      doc.exemplo = false;
      const botao = form.querySelector('button[type="submit"]');
      botao.disabled = true;
      try {
        const salvo = await salvar('cartas', doc);
        const i = cartas.findIndex((c) => c.id === salvo.id);
        if (i >= 0) cartas[i] = salvo; else cartas.unshift(salvo);
        if (enviar) avisarOutro(salvo);
        toast(agendar
          ? `Cartinha agendada para ${formatarData(doc.agendadaPara, DATA_HORA)}. ${outro.nome} só vê nessa hora.`
          : enviar ? `Cartinha enviada para ${outro.nome}!` : (original ? 'Cartinha atualizada!' : 'Rascunho guardado.'), 'sucesso', { duracao: agendar ? 6000 : 4200 });
        if (location.hash.includes('?')) history.replaceState(null, '', '#/cartinhas');
        aba = grupoDa(salvo, eu);
        alterado = false;
        window.dispatchEvent(new CustomEvent('nc:cartas-mudou'));
        mostrarColecao({ focar: true });
      } catch (err) {
        toast(err.message, 'erro');
        botao.disabled = false;
      }
    });

    atualizarPrevia();
    el.querySelector('h1').setAttribute('tabindex', '-1');
    el.querySelector('h1').focus();
  }

  // ---------------- Eventos da coleção ----------------
  el.addEventListener('click', (e) => {
    if (modo !== 'colecao') return;
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-nova')) mostrarEditor();
    else if (b.hasAttribute('data-elogio')) enviarRapido('elogio');
    else if (b.hasAttribute('data-lembrete')) enviarRapido('lembrete');
    else if (b.dataset.aba) { aba = b.dataset.aba; mostrarColecao({ focarAba: true }); }
    else if (b.dataset.abrir) abrirCarta(b.dataset.abrir);
    else if (b.dataset.responder) mostrarEditor(null, { respostaA: cartas.find((c) => c.id === b.dataset.responder) });
    else if (b.dataset.enviar) enviarRascunho(b.dataset.enviar);
    else if (b.dataset.editar) mostrarEditor(cartas.find((c) => c.id === b.dataset.editar));
    else if (b.dataset.excluir) excluirCarta(b.dataset.excluir);
  });

  // Setas do teclado nas abas
  el.addEventListener('keydown', (e) => {
    const atual = e.target.closest('[data-aba]');
    if (modo !== 'colecao' || !atual || !['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    e.preventDefault();
    const ids = Object.keys(ABAS);
    const i = ids.indexOf(atual.dataset.aba);
    aba = ids[(i + (e.key === 'ArrowRight' ? 1 : -1) + ids.length) % ids.length];
    mostrarColecao({ focarAba: true });
  });

  if (!(await carregar())) return;
  const parametros = new URLSearchParams(location.hash.split('?')[1] || '');
  const temNova = cartas.some(naoLida);
  if (!temNova && !cartas.some((c) => grupoDa(c, eu) === 'recebidas')) {
    aba = cartas.some((c) => grupoDa(c, eu) === 'rascunhos') && !cartas.some((c) => grupoDa(c, eu) === 'enviadas') ? 'rascunhos' : (cartas.some((c) => grupoDa(c, eu) === 'enviadas') ? 'enviadas' : 'recebidas');
  }
  if (parametros.has('elogio') || parametros.has('lembrete')) {
    history.replaceState(null, '', '#/cartinhas');
    mostrarColecao();
    enviarRapido(parametros.has('elogio') ? 'elogio' : 'lembrete');
  } else if (parametros.has('nova')) {
    mostrarEditor();
  } else if (parametros.get('abrir')) {
    const alvo = cartas.find((c) => c.id === parametros.get('abrir'));
    history.replaceState(null, '', '#/cartinhas');
    if (alvo) aba = grupoDa(alvo, eu);
    mostrarColecao();
    if (alvo) abrirCarta(alvo.id);
  } else {
    mostrarColecao();
  }

  // Chegou algo do outro perfil enquanto esta página está aberta: atualiza a coleção
  const aoReceber = async () => {
    if (modo !== 'colecao') return;
    try {
      cartas = (await listar('cartas')).filter((c) => cartaVisivelPara(c, eu));
      if (modo === 'colecao' && el.isConnected && !document.querySelector('dialog[open]')) mostrarColecao();
    } catch { /* tenta de novo no próximo aviso */ }
  };
  window.addEventListener('nc:carta-recebida', aoReceber);
  return () => window.removeEventListener('nc:carta-recebida', aoReceber);
}
