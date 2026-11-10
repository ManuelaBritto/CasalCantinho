// Bilhetes rápidos das Cartinhas: "Enviar elogio" e "Lembre de mim".
// Ficam salvos na mesma coleção das cartinhas (campo tipo), então não precisam de tabela nova.
// Quando o outro perfil está com o site aberto, recebe um aviso na hora pela sala do casal.
import { salvar } from './store/index.js';
import { salaAtual } from './sala-cinema.js';
import { notificarOutro } from './notificacoes.js';
import { PERFIS } from './auth.js';
import { icone } from './ui/icones.js';
import { esc, toast, abrirModal, marcarErro, limparErros } from './ui/dom.js';

export const TIPOS_BILHETE = {
  elogio: { nome: 'Elogio', icone: 'sparkle' },
  lembrete: { nome: 'Lembre de mim', icone: 'coracao' },
  desenho: { nome: 'Como eu te vejo', icone: 'pincel' }, // enviado pela aba Diversão
};
export const ehBilhete = (c) => Boolean(TIPOS_BILHETE[c?.tipo]);

export const MAX_ELOGIO = 180;
export const CORES_BILHETE = { '#fff1a8': 'Amarelo', '#ffd9e2': 'Rosa', '#d9ecff': 'Azul', '#dff3d4': 'Verde' };
export const EMOJIS_LEMBRETE = ['🥺', '😘', '❤️', '🥰', '🤗', '😢', '🙈', '💌', '🌻', '🦇', '✨', '😴'];

/** Frases prontas do "Lembre de mim". A 11ª muda conforme quem recebe. */
export function frasesLembrete(paraId) {
  return [
    'Ei, esqueceu de mim?',
    'Estou com saudades, amor!',
    'Passando só pra lembrar que eu existo.',
    'Cadê você? Tô aqui esperando.',
    'Lembrei de você agora e sorri.',
    'Me dá atenção, por favor?',
    'Tô com saudade do seu abraço.',
    'Já pensou em mim hoje?',
    'Volta logo, tá?',
    'Só queria ouvir sua voz.',
    paraId === 'kath' ? 'Ei, sumida!' : 'Ei, sumido!',
    'Um beijo pra você não esquecer de mim.',
    'Contando os minutos pra te ver.',
    'Você tá fazendo falta aqui.',
    'Me manda um oi?',
    'Pensando em você de novo (de novo!).',
    'O cantinho fica vazio sem você.',
    'A saudade tá apertando, viu?',
  ];
}

function sugestoesElogio(paraId) {
  return [
    'Seu sorriso deixa meu dia mais bonito.',
    'Você é a pessoa mais linda que eu conheço.',
    paraId === 'kath' ? 'Você fica ainda mais linda quando ri.' : 'Você fica ainda mais lindo quando ri.',
    'Tenho muito orgulho de você.',
    'Você me faz querer ser melhor todo dia.',
    'Seu abraço é o meu lugar favorito.',
  ];
}

const contarFrases = (t) => String(t).split(/[.!?…]+/).filter((s) => s.trim()).length;
const nomeDe = (id) => PERFIS[id]?.nome || 'Alguém';

/** Texto curto para avisos ("Drico te mandou um elogio!"). */
export function descricaoNova(c) {
  const quem = nomeDe(c.de);
  if (c.tipo === 'elogio') return `${quem} te mandou um elogio!`;
  if (c.tipo === 'lembrete') return `${quem} lembrou de você: ${c.emoji || ''} "${c.mensagem}"`.replace(/\s+/g, ' ');
  if (c.tipo === 'desenho') return `${quem} te mandou um desenho: "${c.mensagem}"`;
  return `${quem} te mandou uma cartinha!`;
}

/** O bilhete desenhado (usado na coleção, na leitura e na prévia). */
export function htmlBilhete(c, { compacto = false } = {}) {
  const de = nomeDe(c.de);
  if (c.tipo === 'desenho') {
    return `
      <figure class="bilhete bilhete-desenho ${compacto ? 'compacto' : ''}">
        <p class="bilhete-rotulo">${icone('pincel')} ${esc(c.pergunta || 'Como eu te vejo')}</p>
        ${c.src ? `<img src="${esc(c.src)}" alt="Desenho de ${esc(de)}: ${esc(c.pergunta || 'Como eu te vejo')}" loading="lazy">` : '<p class="dica">A imagem não carregou.</p>'}
        ${c.legenda ? `<figcaption class="bilhete-texto">${esc(c.legenda)}</figcaption>` : ''}
        <p class="bilhete-assinatura">— ${esc(de)}</p>
      </figure>`;
  }
  if (c.tipo === 'lembrete') {
    return `
      <div class="bilhete bilhete-lembrete ${compacto ? 'compacto' : ''}">
        <span class="bilhete-emoji" aria-hidden="true">${esc(c.emoji || '❤️')}</span>
        <p class="bilhete-texto">${esc(c.mensagem)}</p>
        <p class="bilhete-assinatura">— ${esc(de)}</p>
      </div>`;
  }
  return `
    <div class="bilhete bilhete-elogio ${compacto ? 'compacto' : ''}" style="--bilhete:${esc(c.cor || '#fff1a8')}">
      <span class="bilhete-fita" aria-hidden="true"></span>
      <p class="bilhete-rotulo">${icone('sparkle')} Um elogio de ${esc(de)}</p>
      <p class="bilhete-texto">${esc(c.mensagem)}</p>
    </div>`;
}

/**
 * Avisa o outro perfil: na hora, se ele estiver com o site aberto;
 * e por notificação no celular, se ele não estiver olhando o site.
 */
export function avisarOutro(c) {
  try {
    salaAtual()?.enviar?.('aviso', { id: c.id, para: c.para, tipoCarta: c.tipo || 'carta', texto: c.mensagem?.slice(0, 140) || '', emoji: c.emoji || '' });
  } catch { /* sem sala: o aviso aparece quando abrir o site */ }
  const de = nomeDe(c.de);
  const url = `/#/cartinhas?abrir=${encodeURIComponent(c.id)}`;
  const textos = {
    elogio: { titulo: `${de} te mandou um elogio`, corpo: c.mensagem },
    lembrete: { titulo: `${de} lembrou de você`, corpo: `${c.emoji || ''} ${c.mensagem}`.trim() },
    desenho: { titulo: `${de} te mandou um desenho`, corpo: c.legenda ? `${c.pergunta}: ${c.legenda}` : c.pergunta },
  };
  const envio = notificarOutro({ ...(textos[c.tipo] || { titulo: `Chegou uma cartinha de ${de}`, corpo: 'Toque para abrir o envelope.' }), url });
  envio.then((r) => explicarEntrega(r, c.para)).catch(() => {});
}

// Conta para quem enviou por que a notificação não foi para o celular (uma vez por motivo)
const motivosAvisados = new Set();
function explicarEntrega(r, paraId) {
  if (!r || r.enviadas > 0 || motivosAvisados.has(r.motivo)) return;
  const quem = nomeDe(paraId);
  let texto = '';
  if (r.motivo === 'sem-aparelho') texto = `${quem} ainda não ativou as notificações em nenhum aparelho (Aparência → Ativar notificações, no celular de ${quem}). Ela vai ver quando abrir o site.`.replace('Ela vai', paraId === 'drico' ? 'Ele vai' : 'Ela vai');
  else if (r.motivo === 'erro') texto = `A notificação para ${quem} não foi enviada: ${r.erro || 'erro no servidor'}`;
  if (!texto) return;
  motivosAvisados.add(r.motivo);
  toast(texto, 'info', { duracao: 9000 });
}

async function enviarBilhete(doc, perfil) {
  const outro = Object.values(PERFIS).find((p) => p.id !== perfil.id);
  const salvo = await salvar('cartas', {
    ...doc,
    de: perfil.id,
    autor: perfil.nome,
    para: outro.id,
    enviadaEm: new Date().toISOString(),
    lidaEm: null,
    exemplo: false,
  });
  avisarOutro(salvo);
  window.dispatchEvent(new CustomEvent('nc:cartas-mudou'));
  return salvo;
}

/** Janela "Enviar elogio". Resolve com a cartinha salva (ou null se cancelou). */
export function abrirElogio(perfil) {
  const outro = Object.values(PERFIS).find((p) => p.id !== perfil.id);
  return new Promise((resolver) => {
    let enviado = null;
    const { el, fechar } = abrirModal({
      titulo: `Enviar elogio para ${outro.nome}`,
      corpo: `
        <form class="formulario form-bilhete" id="form-elogio" novalidate>
          <div class="campo">
            <label for="texto-elogio">Seu elogio <span class="dica">(uma ou duas frases)</span></label>
            <textarea id="texto-elogio" name="mensagem" rows="3" maxlength="${MAX_ELOGIO}" required aria-describedby="contador-elogio" placeholder="Ex.: Seu sorriso deixa meu dia mais bonito."></textarea>
            <p class="dica" id="contador-elogio">0 de ${MAX_ELOGIO} caracteres</p>
          </div>
          <div class="sugestoes" role="group" aria-label="Sugestões de elogio">
            ${sugestoesElogio(outro.id).map((s) => `<button type="button" class="chip-sugestao" data-sugestao="${esc(s)}">${esc(s)}</button>`).join('')}
          </div>
          <fieldset>
            <legend>Cor do bilhete</legend>
            <div class="opcoes cores">
              ${Object.entries(CORES_BILHETE).map(([c, n], i) => `
                <label class="opcao cor"><input type="radio" name="cor" value="${c}" ${i === 0 ? 'checked' : ''} aria-label="${n}"><span style="--c:${c}"></span></label>`).join('')}
            </div>
          </fieldset>
          <div class="previa-bilhete" data-previa aria-hidden="true"></div>
        </form>`,
      rodape: `<button type="button" class="botao-fantasma" data-fechar>Cancelar</button>
        <button type="submit" form="form-elogio" class="botao">${icone('carta')} Enviar elogio</button>`,
      aoFechar: () => resolver(enviado),
    });
    const form = el.querySelector('form');
    const campo = form.elements.mensagem;
    const previa = el.querySelector('[data-previa]');
    const atualizar = () => {
      el.querySelector('#contador-elogio').textContent = `${campo.value.length} de ${MAX_ELOGIO} caracteres`;
      previa.innerHTML = htmlBilhete({ tipo: 'elogio', de: perfil.id, mensagem: campo.value.trim() || 'Seu elogio aparece aqui.', cor: form.querySelector('input[name="cor"]:checked')?.value });
    };
    form.addEventListener('input', atualizar);
    form.addEventListener('change', atualizar);
    el.querySelectorAll('[data-sugestao]').forEach((b) => b.addEventListener('click', () => { campo.value = b.dataset.sugestao; atualizar(); campo.focus(); }));
    atualizar();
    campo.focus();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      limparErros(form);
      const mensagem = campo.value.trim().replace(/\s+/g, ' ');
      if (!mensagem) return marcarErro(campo, 'Escreva o elogio.');
      if (contarFrases(mensagem) > 2) return marcarErro(campo, 'O elogio é curtinho: use no máximo duas frases. Para mais, escreva uma cartinha.');
      const botao = el.querySelector('button[type="submit"]');
      botao.disabled = true;
      try {
        enviado = await enviarBilhete({ tipo: 'elogio', titulo: 'Elogio', mensagem, cor: form.querySelector('input[name="cor"]:checked')?.value || '#fff1a8' }, perfil);
        toast(`Elogio enviado para ${outro.nome}!`, 'sucesso');
        fechar();
      } catch (err) {
        toast(err.message, 'erro');
        botao.disabled = false;
      }
    });
  });
}

/** Janela "Lembre de mim": escolhe um emoji e uma frase pronta. */
export function abrirLembrete(perfil) {
  const outro = Object.values(PERFIS).find((p) => p.id !== perfil.id);
  const frases = frasesLembrete(outro.id);
  return new Promise((resolver) => {
    let enviado = null;
    const { el, fechar } = abrirModal({
      titulo: 'Lembre de mim',
      corpo: `
        <form class="formulario form-bilhete" id="form-lembrete" novalidate>
          <fieldset>
            <legend>Escolha um emoji</legend>
            <div class="grade-emojis">
              ${EMOJIS_LEMBRETE.map((e, i) => `
                <label class="opcao-emoji"><input type="radio" name="emoji" value="${e}" ${i === 0 ? 'checked' : ''}><span aria-hidden="true">${e}</span><span class="sr-only">Emoji ${i + 1}</span></label>`).join('')}
            </div>
          </fieldset>
          <fieldset>
            <legend>Escolha a frase para ${esc(outro.nome)}</legend>
            <div class="lista-frases">
              ${frases.map((f, i) => `
                <label class="opcao-frase"><input type="radio" name="frase" value="${i}" ${i === 0 ? 'checked' : ''}><span>${esc(f)}</span></label>`).join('')}
            </div>
          </fieldset>
          <div class="previa-bilhete" data-previa aria-hidden="true"></div>
        </form>`,
      rodape: `<button type="button" class="botao-fantasma" data-fechar>Cancelar</button>
        <button type="submit" form="form-lembrete" class="botao">${icone('coracao')} Enviar para ${esc(outro.nome)}</button>`,
      aoFechar: () => resolver(enviado),
    });
    const form = el.querySelector('form');
    const escolha = () => ({
      emoji: form.querySelector('input[name="emoji"]:checked')?.value || EMOJIS_LEMBRETE[0],
      mensagem: frases[Number(form.querySelector('input[name="frase"]:checked')?.value) || 0],
    });
    const atualizar = () => { el.querySelector('[data-previa]').innerHTML = htmlBilhete({ tipo: 'lembrete', de: perfil.id, ...escolha() }); };
    form.addEventListener('change', atualizar);
    atualizar();
    form.querySelector('input[name="emoji"]:checked').focus();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const botao = el.querySelector('button[type="submit"]');
      botao.disabled = true;
      try {
        enviado = await enviarBilhete({ tipo: 'lembrete', titulo: 'Lembre de mim', ...escolha() }, perfil);
        toast(`${outro.nome} vai saber que você lembrou!`, 'sucesso');
        fechar();
      } catch (err) {
        toast(err.message, 'erro');
        botao.disabled = false;
      }
    });
  });
}
