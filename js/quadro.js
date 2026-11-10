// Quadro de desenho em <canvas>, usado no quadro branco e no "Como eu te vejo".
//
// Cada traço é guardado como uma lista de pontos (não como pixels). Isso permite:
//  - desenhar ao vivo junto: os pontos vão para o outro perfil em pacotinhos e ele desenha igual;
//  - desfazer/refazer leve: redesenha a imagem base + os traços que sobraram.
// Funciona com mouse, caneta e dedo (Pointer Events). A tela tem resolução fixa (1200×800)
// e se ajusta à largura da página.
import { icone } from './ui/icones.js';
import { esc } from './ui/dom.js';

export const LARGURA = 1200;
export const ALTURA = 800;
export const CORES = ['#222222', '#ffffff', '#e5383b', '#ff8fab', '#f77f00', '#fcbf49', '#2a9d8f', '#80b918', '#3a86ff', '#9b5de5', '#8d5524', '#ced4da'];
const TAMANHOS = { fino: 4, medio: 10, grosso: 22, enorme: 44 };
const NOMES_TAMANHO = { fino: 'Fino', medio: 'Médio', grosso: 'Grosso', enorme: 'Enorme' };
const NOMES_COR = ['Preto', 'Branco', 'Vermelho', 'Rosa', 'Laranja', 'Amarelo', 'Verde-água', 'Verde', 'Azul', 'Roxo', 'Marrom', 'Cinza'];
const PACOTE_MS = 40;

let contador = 0;

/**
 * Cria o quadro dentro de `alvo`.
 *  - eu: id do perfil (marca os próprios traços para desfazer só os seus)
 *  - aoEnviar(tipo, dados): opcional, recebe os traços para mandar ao outro perfil
 *  - aoMudar(): opcional, chamado quando a pessoa desenha/apaga/desfaz
 */
export function criarQuadro(alvo, { eu, aoEnviar = null, aoMudar = () => {}, rotulo = 'Quadro de desenho' } = {}) {
  const uid = ++contador;
  alvo.innerHTML = `
    <div class="quadro">
      <div class="quadro-ferramentas" role="toolbar" aria-label="Ferramentas de desenho">
        <div class="quadro-grupo" role="group" aria-label="Ferramenta">
          <button type="button" class="botao-ferramenta" data-ferramenta="pincel" aria-pressed="true" title="Pincel">${icone('pincel')}<span class="sr-only">Pincel</span></button>
          <button type="button" class="botao-ferramenta" data-ferramenta="borracha" aria-pressed="false" title="Borracha">${icone('borracha')}<span class="sr-only">Borracha</span></button>
        </div>
        <div class="quadro-grupo quadro-cores" role="radiogroup" aria-label="Cor">
          ${CORES.map((c, i) => `<label class="cor-quadro" title="${NOMES_COR[i]}"><input type="radio" name="cor-quadro-${uid}" value="${c}" ${i === 0 ? 'checked' : ''}><span style="--c:${c}"></span><span class="sr-only">${NOMES_COR[i]}</span></label>`).join('')}
          <label class="cor-quadro cor-livre-quadro" title="Outra cor"><input type="color" value="#b5179e" data-cor-livre aria-label="Escolher outra cor"></label>
        </div>
        <div class="quadro-grupo" role="radiogroup" aria-label="Espessura">
          ${Object.entries(TAMANHOS).map(([id, px], i) => `<label class="tamanho-quadro" title="${NOMES_TAMANHO[id]}"><input type="radio" name="tamanho-quadro-${uid}" value="${id}" ${i === 1 ? 'checked' : ''}><span><i style="--t:${Math.min(22, Math.max(4, px / 2))}px"></i></span><span class="sr-only">${NOMES_TAMANHO[id]}</span></label>`).join('')}
        </div>
        <div class="quadro-grupo">
          <button type="button" class="botao-ferramenta" data-acao-quadro="desfazer" title="Desfazer" disabled>${icone('desfazer')}<span class="sr-only">Desfazer</span></button>
          <button type="button" class="botao-ferramenta espelhado" data-acao-quadro="refazer" title="Refazer" disabled>${icone('desfazer')}<span class="sr-only">Refazer</span></button>
          <button type="button" class="botao-ferramenta perigo" data-acao-quadro="limpar" title="Limpar tudo">${icone('lixeira')}<span class="sr-only">Limpar tudo</span></button>
        </div>
      </div>
      <div class="quadro-tela">
        <canvas width="${LARGURA}" height="${ALTURA}" role="img" aria-label="${esc(rotulo)}"></canvas>
      </div>
    </div>`;

  const canvas = alvo.querySelector('canvas');
  const ctx = canvas.getContext('2d');
  let base = null;       // imagem salva (HTMLImageElement) por baixo dos traços
  let tracos = [];       // { id, de, cor, tamanho, borracha, pontos: [x, y, x, y...] }
  let desfeitos = [];    // meus traços desfeitos (para refazer)
  let atual = null;      // traço em andamento
  let pendentes = [];    // pontos do traço atual ainda não enviados
  let timerPacote = null;
  let ferramenta = 'pincel';
  let alterado = false;

  const corAtual = () => alvo.querySelector(`input[name="cor-quadro-${uid}"]:checked`)?.value || alvo.querySelector('[data-cor-livre]').value;
  const tamanhoAtual = () => TAMANHOS[alvo.querySelector(`input[name="tamanho-quadro-${uid}"]:checked`)?.value] || TAMANHOS.medio;

  // ---------------- Desenho ----------------
  function estilo(t) {
    ctx.strokeStyle = t.borracha ? '#ffffff' : t.cor;
    ctx.fillStyle = ctx.strokeStyle;
    ctx.lineWidth = t.tamanho;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }

  /** Desenha os pontos a partir do índice `de` (em pares x,y). */
  function desenharTrecho(t, de = 0) {
    const p = t.pontos;
    if (p.length < 2) return;
    estilo(t);
    if (p.length === 2) {
      ctx.beginPath();
      ctx.arc(p[0], p[1], t.tamanho / 2, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    const inicio = Math.max(0, de - 2);
    ctx.beginPath();
    ctx.moveTo(p[inicio], p[inicio + 1]);
    for (let i = inicio + 2; i < p.length; i += 2) ctx.lineTo(p[i], p[i + 1]);
    ctx.stroke();
  }

  function redesenhar() {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, LARGURA, ALTURA);
    if (base) {
      const escala = Math.min(LARGURA / base.naturalWidth, ALTURA / base.naturalHeight);
      const w = base.naturalWidth * escala;
      const h = base.naturalHeight * escala;
      ctx.drawImage(base, (LARGURA - w) / 2, (ALTURA - h) / 2, w, h);
    }
    for (const t of tracos) desenharTrecho(t);
  }

  function atualizarBotoes() {
    alvo.querySelector('[data-acao-quadro="desfazer"]').disabled = !tracos.some((t) => t.de === eu);
    alvo.querySelector('[data-acao-quadro="refazer"]').disabled = !desfeitos.length;
  }

  function mudou() { alterado = true; atualizarBotoes(); aoMudar(); }

  // ---------------- Ponteiro ----------------
  function posicao(ev) {
    const r = canvas.getBoundingClientRect();
    return [Math.round(((ev.clientX - r.left) / r.width) * LARGURA), Math.round(((ev.clientY - r.top) / r.height) * ALTURA)];
  }

  function enviarPendentes(final = false) {
    clearTimeout(timerPacote);
    timerPacote = null;
    if (!aoEnviar || !atual || (!pendentes.length && !final)) return;
    aoEnviar('quadro-traco', { id: atual.id, cor: atual.cor, tamanho: atual.tamanho, borracha: atual.borracha, pontos: pendentes, fim: final });
    pendentes = [];
  }

  canvas.addEventListener('pointerdown', (ev) => {
    if (ev.button !== undefined && ev.button > 0) return;
    ev.preventDefault();
    canvas.setPointerCapture?.(ev.pointerId);
    const [x, y] = posicao(ev);
    atual = { id: `${eu}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, de: eu, cor: corAtual(), tamanho: tamanhoAtual(), borracha: ferramenta === 'borracha', pontos: [x, y] };
    tracos.push(atual);
    desfeitos = [];
    pendentes = [x, y];
    desenharTrecho(atual);
    enviarPendentes();
  });

  canvas.addEventListener('pointermove', (ev) => {
    if (!atual) return;
    ev.preventDefault();
    const eventos = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
    const antes = atual.pontos.length;
    for (const e of (eventos.length ? eventos : [ev])) {
      const [x, y] = posicao(e);
      const n = atual.pontos.length;
      if (Math.abs(x - atual.pontos[n - 2]) + Math.abs(y - atual.pontos[n - 1]) < 2) continue;
      atual.pontos.push(x, y);
      pendentes.push(x, y);
    }
    if (atual.pontos.length > antes) desenharTrecho(atual, antes);
    if (!timerPacote && aoEnviar) timerPacote = setTimeout(() => enviarPendentes(), PACOTE_MS);
  });

  const terminar = () => {
    if (!atual) return;
    enviarPendentes(true);
    atual = null;
    mudou();
  };
  canvas.addEventListener('pointerup', terminar);
  canvas.addEventListener('pointercancel', terminar);
  canvas.addEventListener('lostpointercapture', terminar);

  // ---------------- Ferramentas ----------------
  alvo.querySelector('.quadro-ferramentas').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.ferramenta) {
      ferramenta = b.dataset.ferramenta;
      alvo.querySelectorAll('[data-ferramenta]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    } else if (b.dataset.acaoQuadro === 'desfazer') desfazer();
    else if (b.dataset.acaoQuadro === 'refazer') refazer();
    else if (b.dataset.acaoQuadro === 'limpar') limpar();
  });
  alvo.querySelector('[data-cor-livre]').addEventListener('input', () => {
    alvo.querySelectorAll(`input[name="cor-quadro-${uid}"]`).forEach((r) => { r.checked = false; });
    if (ferramenta === 'borracha') alvo.querySelector('[data-ferramenta="pincel"]').click();
  });
  alvo.querySelectorAll(`input[name="cor-quadro-${uid}"]`).forEach((r) => r.addEventListener('change', () => {
    if (ferramenta === 'borracha') alvo.querySelector('[data-ferramenta="pincel"]').click();
  }));

  function desfazer() {
    for (let i = tracos.length - 1; i >= 0; i--) {
      if (tracos[i].de !== eu) continue;
      const [t] = tracos.splice(i, 1);
      desfeitos.push(t);
      redesenhar();
      aoEnviar?.('quadro-desfazer', { id: t.id });
      mudou();
      return;
    }
  }

  function refazer() {
    const t = desfeitos.pop();
    if (!t) return;
    tracos.push(t);
    desenharTrecho(t);
    aoEnviar?.('quadro-traco', { id: t.id, cor: t.cor, tamanho: t.tamanho, borracha: t.borracha, pontos: t.pontos, fim: true });
    mudou();
  }

  function limpar({ avisar = true } = {}) {
    base = null;
    tracos = [];
    desfeitos = [];
    redesenhar();
    if (avisar) { aoEnviar?.('quadro-limpar', {}); mudou(); } else atualizarBotoes();
  }

  redesenhar();

  return {
    canvas,
    get alterado() { return alterado; },
    get vazio() { return !base && !tracos.length; },
    marcarSalvo() { alterado = false; },
    marcarAlterado() { alterado = true; },

    /** Coloca uma imagem salva por baixo (o desenho anterior). Mantém os traços ao vivo. */
    carregarBase(src) {
      return new Promise((ok) => {
        if (!src) { base = null; redesenhar(); return ok(true); }
        const img = new Image();
        if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
        img.onload = () => { base = img; redesenhar(); ok(true); };
        img.onerror = () => ok(false);
        img.src = src;
      });
    },

    /** Recomeça a partir de uma imagem salva (descarta os traços da sessão). */
    async recomecar(src) {
      tracos = [];
      desfeitos = [];
      await this.carregarBase(src);
      alterado = false;
      atualizarBotoes();
    },

    /** Aplica o que veio do outro perfil. */
    aplicarRemoto(msg) {
      if (msg.tipo === 'quadro-traco' && Array.isArray(msg.pontos)) {
        const pontos = msg.pontos.map(Number).filter(Number.isFinite).slice(0, 20000);
        let t = tracos.find((x) => x.id === msg.id);
        if (!t) {
          t = { id: String(msg.id), de: msg.de, cor: /^#[0-9a-f]{6}$/i.test(msg.cor) ? msg.cor : '#222222', tamanho: Math.min(80, Math.max(1, Number(msg.tamanho) || 10)), borracha: Boolean(msg.borracha), pontos: [] };
          tracos.push(t);
        }
        const antes = t.pontos.length;
        t.pontos.push(...pontos);
        // traço que chegou fora de ordem (ex.: refazer) é desenhado inteiro
        if (antes === 0 || pontos.length === t.pontos.length) desenharTrecho(t); else desenharTrecho(t, antes);
      } else if (msg.tipo === 'quadro-desfazer') {
        const i = tracos.findIndex((x) => x.id === msg.id);
        if (i >= 0) { tracos.splice(i, 1); redesenhar(); }
      } else if (msg.tipo === 'quadro-limpar') {
        limpar({ avisar: false });
      }
    },

    /** PNG do quadro (para salvar ou enviar). */
    exportar() {
      return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Não foi possível gerar a imagem do desenho.'))), 'image/png'));
    },

    destruir() { clearTimeout(timerPacote); },
  };
}
