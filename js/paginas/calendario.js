// Calendário do casal: datas importantes com lembrete na véspera (19h) e no dia (8h ou 1 hora antes).
// Os lembretes saem pelo servidor (lib/lembretes.mjs), mesmo com o site fechado.
import { PERFIS } from '../auth.js';
import { obterAjustes } from '../store/index.js';
import { salaAtual } from '../sala-cinema.js';
import { notificarOutro } from '../notificacoes.js';
import { criarDadosCalendario } from '../calendario/dados.js';
import {
  TIPOS_EVENTO, REPETE, MESES, hojeBrasilia, partes, iso, proximaOcorrencia, ocorrenciaNoMes, contagem, quandoFalta, proximas,
} from '../calendario/regras.js';
import { icone } from '../ui/icones.js';
import { enfeite } from '../ui/ilustracoes.js';
import { esc, toast, confirmar, abrirModal, marcarErro, limparErros } from '../ui/dom.js';

const DIAS_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
const DIAS_SEMANA_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
const mesCurto = (m) => MESES[m - 1].slice(0, 3);
const dataLonga = (s) => { const [, m, d] = partes(s); return `${d} de ${MESES[m - 1]}`; };

export async function renderizar(el, ctx) {
  const perfil = ctx.perfil;
  const outro = Object.values(PERFIS).find((p) => p.id !== perfil.id);
  const dados = criarDadosCalendario(perfil);
  const sala = salaAtual();
  let eventos = [];
  let erro = '';
  let ajustes = {};
  let hoje = hojeBrasilia();
  let [anoVis, mesVis] = partes(hoje);
  let diaSel = null;

  async function carregar() {
    hoje = hojeBrasilia();
    try { eventos = await dados.listar(); erro = ''; } catch (e) { erro = e.message; eventos = []; }
    try { ajustes = (await obterAjustes()) || {}; } catch { ajustes = {}; }
  }

  // ---------------- Partes da página ----------------
  function linhaQuando(ev, ocorr) {
    const p = [quandoFalta(ocorr, hoje)];
    if (ev.hora) p.push(`às ${ev.hora}`);
    p.push(REPETE[ev.repete]);
    return p.join(' · ');
  }

  function htmlItem(ev, ocorr) {
    const [, m, d] = partes(ocorr);
    const t = TIPOS_EVENTO[ev.tipo] || TIPOS_EVENTO.outro;
    const cont = contagem(ev, ocorr);
    const falta = quandoFalta(ocorr, hoje);
    return `
      <li class="proxima ${falta === 'Hoje' ? 'e-hoje' : ''}">
        <span class="proxima-data" aria-hidden="true"><b>${d}</b><span>${mesCurto(m)}</span></span>
        <div class="proxima-info">
          <h3><span aria-hidden="true">${t.emoji}</span> ${esc(ev.titulo)}</h3>
          <p class="meta">${esc(linhaQuando(ev, ocorr))}</p>
          ${cont ? `<p class="proxima-contagem">${esc(cont)}</p>` : ''}
          ${ev.nota ? `<p class="proxima-nota">${esc(ev.nota)}</p>` : ''}
        </div>
        <div class="grupo-botoes acoes-evento">
          <button type="button" class="botao-icone" data-editar-evento="${esc(ev.id)}" aria-label="Editar ${esc(ev.titulo)}" title="Editar">${icone('editar')}</button>
          <button type="button" class="botao-icone perigo" data-excluir-evento="${esc(ev.id)}" aria-label="Excluir ${esc(ev.titulo)}" title="Excluir">${icone('lixeira')}</button>
        </div>
      </li>`;
  }

  function htmlProximas() {
    const lista = proximas(eventos, hoje, 10);
    if (!lista.length) {
      return `<div class="vazio pequeno">
        <span class="ilustracao" aria-hidden="true">${enfeite('contador')}</span>
        <h3>Nenhuma data ainda</h3>
        <p>Guarde aniversários, viagens e compromissos. ${esc(outro?.nome || '')} vê tudo também, e os dois recebem o lembrete.</p>
      </div>`;
    }
    return `<ul class="lista-proximas" role="list">${lista.map(({ ev, ocorr }) => htmlItem(ev, ocorr)).join('')}</ul>`;
  }

  function eventosDoDia(dia) {
    const [a, m] = partes(dia);
    return eventos.filter((ev) => ocorrenciaNoMes(ev, a, m) === dia);
  }

  function htmlMes() {
    const primeiro = new Date(Date.UTC(anoVis, mesVis - 1, 1)).getUTCDay();
    const total = new Date(Date.UTC(anoVis, mesVis, 0)).getUTCDate();
    const celulas = [];
    for (let i = 0; i < primeiro; i++) celulas.push('<span class="dia vazio-dia" aria-hidden="true"></span>');
    for (let d = 1; d <= total; d++) {
      const dia = iso(anoVis, mesVis, d);
      const doDia = eventos.filter((ev) => ocorrenciaNoMes(ev, anoVis, mesVis) === dia);
      const classes = ['dia', dia === hoje ? 'hoje' : '', dia === diaSel ? 'selecionado' : '', doDia.length ? 'tem' : ''].filter(Boolean).join(' ');
      const rotulo = `${d} de ${MESES[mesVis - 1]}${dia === hoje ? ', hoje' : ''}${doDia.length ? `, ${doDia.map((e) => e.titulo).join(', ')}` : ''}`;
      celulas.push(`<button type="button" class="${classes}" data-dia="${dia}" aria-label="${esc(rotulo)}" aria-pressed="${dia === diaSel}">
        <span class="dia-num">${d}</span>
        ${doDia.length ? `<span class="dia-marcas" aria-hidden="true">${doDia.slice(0, 2).map((e) => (TIPOS_EVENTO[e.tipo] || TIPOS_EVENTO.outro).emoji).join('')}${doDia.length > 2 ? '+' : ''}</span>` : ''}
      </button>`);
    }
    const doSel = diaSel ? eventosDoDia(diaSel) : [];
    const [, , dSel] = diaSel ? partes(diaSel) : [];
    return `
      <div class="mes-topo">
        <button type="button" class="botao-icone" data-mes="-1" aria-label="Mês anterior">${icone('esquerda')}</button>
        <h2 id="titulo-mes" class="subtitulo" aria-live="polite">${MESES[mesVis - 1][0].toUpperCase()}${MESES[mesVis - 1].slice(1)} ${anoVis}</h2>
        <button type="button" class="botao-icone" data-mes="1" aria-label="Próximo mês">${icone('direita')}</button>
      </div>
      <div class="mes-grade" role="group" aria-labelledby="titulo-mes">
        ${DIAS_SEMANA.map((s, i) => `<span class="dia-semana" aria-hidden="true" title="${DIAS_SEMANA_LONGO[i]}">${s}</span>`).join('')}
        ${celulas.join('')}
      </div>
      ${iso(anoVis, mesVis, 1).slice(0, 7) !== hoje.slice(0, 7) ? '<button type="button" class="botao-fantasma pequeno" data-ir-hoje>Voltar para hoje</button>' : ''}
      ${diaSel ? `
        <div class="dia-detalhe" aria-live="polite">
          <h3>${dSel} de ${MESES[partes(diaSel)[1] - 1]}</h3>
          ${doSel.length
            ? `<ul class="lista-proximas compacta" role="list">${doSel.map((ev) => htmlItem(ev, diaSel)).join('')}</ul>`
            : '<p class="meta">Nada marcado nesse dia.</p>'}
          <button type="button" class="botao-sec pequeno" data-nova-data="${diaSel}">${icone('mais')} Adicionar nesse dia</button>
        </div>` : ''}`;
  }

  function htmlSugestao() {
    const inicio = ajustes.dataInicio;
    if (!inicio || ajustes.dataInicioExemplo || eventos.some((e) => e.tipo === 'namoro')) return '';
    return `<div class="aviso sugestao-namoro">${icone('coracao')}
      <p>Vocês começaram em <strong>${esc(dataLonga(inicio))} de ${partes(inicio)[0]}</strong>. Quer um lembrete todo ano?</p>
      <button type="button" class="botao pequeno" data-sugestao-namoro>${icone('mais')} Adicionar aniversário de namoro</button>
    </div>`;
  }

  function desenhar({ focar = false } = {}) {
    el.innerHTML = `
      <div class="cabecalho-secao">
        <div>
          <h1 class="titulo-pagina"><span class="enfeite-titulo" aria-hidden="true">${enfeite('contador')}</span>Calendário</h1>
          <p>As datas de vocês dois. O lembrete chega na véspera, às 19h, e no dia.</p>
        </div>
        <button type="button" class="botao" data-nova-data>${icone('mais')} Nova data</button>
      </div>
      ${erro ? `<div class="aviso erro" role="alert">${icone('alerta')}<p>${esc(erro)}</p></div>` : ''}
      ${htmlSugestao()}
      <div class="calendario-layout">
        <section class="cartao" aria-labelledby="titulo-proximas">
          <h2 id="titulo-proximas" class="subtitulo">${icone('calendario')} Próximas datas</h2>
          <div data-proximas>${htmlProximas()}</div>
        </section>
        <section class="cartao calendario-mes" data-mes-area>${htmlMes()}</section>
      </div>`;
    if (focar) el.querySelector('h1')?.focus();
  }

  function redesenharMes() {
    const area = el.querySelector('[data-mes-area]');
    if (area) area.innerHTML = htmlMes();
  }

  // ---------------- Formulário ----------------
  function abrirFormulario(ev = null, dataInicial = '') {
    const novo = !ev;
    const e = ev || { titulo: '', tipo: 'outro', data: dataInicial || hoje, hora: '', repete: 'nao', avisar_vespera: true, avisar_dia: true, nota: '' };
    const sugerido = {
      namoro: 'Aniversário de namoro',
      aniversario: outro ? `Aniversário ${outro.tratamento === 'ele' ? 'do' : outro.tratamento === 'ela' ? 'da' : 'de'} ${outro.nome}` : 'Aniversário',
      viagem: 'Viagem', compromisso: '', outro: '',
    };
    const modal = abrirModal({
      titulo: novo ? 'Nova data' : 'Editar data',
      corpo: `
        <form id="form-evento" class="formulario form-evento" novalidate>
          <div class="campo">
            <label for="ev-tipo">Tipo</label>
            <select id="ev-tipo" name="tipo">${Object.entries(TIPOS_EVENTO).map(([id, t]) => `<option value="${id}" ${e.tipo === id ? 'selected' : ''}>${t.emoji} ${t.nome}</option>`).join('')}</select>
          </div>
          <div class="campo">
            <label for="ev-titulo">Nome da data</label>
            <input id="ev-titulo" name="titulo" maxlength="80" required value="${esc(e.titulo)}" placeholder="Ex.: Viagem pra praia">
          </div>
          <div class="linha-campos">
            <div class="campo"><label for="ev-data">Data</label><input id="ev-data" name="data" type="date" required value="${esc(e.data)}"></div>
            <div class="campo"><label for="ev-hora">Horário <span class="dica">(opcional)</span></label><input id="ev-hora" name="hora" type="time" value="${esc(e.hora || '')}"></div>
          </div>
          <fieldset>
            <legend>Repete</legend>
            <div class="opcoes">${Object.entries(REPETE).map(([id, n]) => `<label class="opcao"><input type="radio" name="repete" value="${id}" ${e.repete === id ? 'checked' : ''}><span>${n}</span></label>`).join('')}</div>
          </fieldset>
          <fieldset>
            <legend>Lembrete para os dois</legend>
            <div class="opcoes coluna">
              <label class="opcao"><input type="checkbox" name="avisar_vespera" ${e.avisar_vespera ? 'checked' : ''}><span>${icone('megafone')} Na véspera, às 19h</span></label>
              <label class="opcao"><input type="checkbox" name="avisar_dia" ${e.avisar_dia ? 'checked' : ''}><span>${icone('megafone')} No dia, às 8h <small>(ou 1 hora antes do horário)</small></span></label>
            </div>
          </fieldset>
          <div class="campo">
            <label for="ev-nota">Anotação <span class="dica">(opcional)</span></label>
            <textarea id="ev-nota" name="nota" maxlength="300" rows="2">${esc(e.nota || '')}</textarea>
          </div>
        </form>`,
      rodape: `<button type="button" class="botao-fantasma" data-fechar>Cancelar</button>
               <button type="submit" form="form-evento" class="botao">${icone('salvar')} ${novo ? 'Adicionar' : 'Salvar'}</button>`,
    });
    const form = modal.el.querySelector('#form-evento');
    let tituloMexido = Boolean(e.titulo);
    form.titulo.addEventListener('input', () => { tituloMexido = true; });
    form.tipo.addEventListener('change', () => {
      const t = form.tipo.value;
      if (!tituloMexido) form.titulo.value = sugerido[t] || '';
      if (novo) form.querySelector(`input[name="repete"][value="${t === 'namoro' || t === 'aniversario' ? 'anual' : 'nao'}"]`).checked = true;
    });
    form.addEventListener('submit', async (evt) => {
      evt.preventDefault();
      limparErros(form);
      const titulo = form.titulo.value.trim();
      if (!titulo) return marcarErro(form.titulo, 'Dê um nome para a data.');
      if (!/^\d{4}-\d{2}-\d{2}$/.test(form.data.value)) return marcarErro(form.data, 'Escolha a data.');
      const doc = {
        ...(ev || {}),
        titulo,
        tipo: form.tipo.value,
        data: form.data.value,
        hora: form.hora.value || '',
        repete: form.querySelector('input[name="repete"]:checked')?.value || 'nao',
        avisar_vespera: form.avisar_vespera.checked,
        avisar_dia: form.avisar_dia.checked,
        nota: form.nota.value.trim(),
      };
      const botao = modal.el.querySelector('button[type="submit"]');
      botao.disabled = true;
      try {
        const salvo = await dados.salvar(doc);
        eventos = [salvo, ...eventos.filter((x) => x.id !== salvo.id)];
        modal.fechar();
        const [a, m] = partes(proximaOcorrencia(salvo.data, salvo.repete, hoje));
        if (salvo.data >= hoje || salvo.repete !== 'nao') { anoVis = a; mesVis = m; }
        desenhar();
        toast(novo ? 'Data adicionada ao calendário!' : 'Data atualizada!', 'sucesso');
        if (sala?.status === 'ok') sala.enviar('calendario', {});
        if (novo) {
          const t = TIPOS_EVENTO[salvo.tipo] || TIPOS_EVENTO.outro;
          notificarOutro({ titulo: 'Calendário', corpo: `${perfil.nome} adicionou: ${t.emoji} ${salvo.titulo} (${dataLonga(salvo.data)})`, url: '/#/calendario', tag: 'calendario' });
        }
      } catch (err) {
        toast(err.message, 'erro');
        botao.disabled = false;
      }
    });
    form.titulo.focus();
  }

  async function excluir(id) {
    const ev = eventos.find((x) => x.id === id);
    if (!ev) return;
    const ok = await confirmar({ titulo: 'Excluir esta data?', mensagem: `"${ev.titulo}" sai do calendário de vocês dois e não terá mais lembrete.` });
    if (!ok) return;
    try {
      await dados.remover(id);
      eventos = eventos.filter((x) => x.id !== id);
      desenhar();
      toast('Data excluída.', 'sucesso');
      if (sala?.status === 'ok') sala.enviar('calendario', {});
    } catch (e) { toast(e.message, 'erro'); }
  }

  async function adicionarNamoro() {
    const inicio = ajustes.dataInicio;
    try {
      const salvo = await dados.salvar({ titulo: 'Aniversário de namoro', tipo: 'namoro', data: inicio, hora: '', repete: 'anual', avisar_vespera: true, avisar_dia: true, nota: '' });
      eventos = [salvo, ...eventos];
      desenhar();
      toast('Aniversário de namoro no calendário! 💕', 'sucesso');
      if (sala?.status === 'ok') sala.enviar('calendario', {});
    } catch (e) { toast(e.message, 'erro'); }
  }

  // ---------------- Eventos ----------------
  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-nova-data')) abrirFormulario(null, b.dataset.novaData || '');
    else if (b.dataset.editarEvento) abrirFormulario(eventos.find((x) => x.id === b.dataset.editarEvento));
    else if (b.dataset.excluirEvento) excluir(b.dataset.excluirEvento);
    else if (b.dataset.mes) {
      mesVis += Number(b.dataset.mes);
      if (mesVis < 1) { mesVis = 12; anoVis -= 1; }
      if (mesVis > 12) { mesVis = 1; anoVis += 1; }
      diaSel = null;
      redesenharMes();
    } else if (b.hasAttribute('data-ir-hoje')) { [anoVis, mesVis] = partes(hoje); diaSel = null; redesenharMes(); }
    else if (b.dataset.dia) { diaSel = diaSel === b.dataset.dia ? null : b.dataset.dia; redesenharMes(); el.querySelector(`[data-dia="${b.dataset.dia}"]`)?.focus(); }
    else if (b.hasAttribute('data-sugestao-namoro')) adicionarNamoro();
  });

  const pararOuvir = sala ? sala.ouvir(async (msg) => {
    if (msg.tipo !== 'calendario' || msg.de === perfil.id) return;
    await carregar();
    if (el.isConnected && !document.querySelector('dialog[open]')) desenhar();
  }) : () => {};

  el.innerHTML = '<div class="estado"><span class="spinner pequeno" aria-hidden="true"></span> Abrindo o calendário…</div>';
  await carregar();
  desenhar();
  return () => pararOuvir();
}
