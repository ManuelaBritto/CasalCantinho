// Animação de início (primeira vez da Kath e botão "Animação de início" no login).
// Tudo feito à mão: confetes e fogos de artifício desenhados em <canvas>, sem bibliotecas.
import { adesivo } from './ui/ilustracoes.js';
import { movimentoReduzido } from './tema.js';

const TEXTO_ASSINATURA = 'Feito pelo seu amorzinho, Drico!';
const TEXTO_FINAL = 'O nosso cantinho está pronto, amor!';
const TEXTO_FINAL_2 = 'Nada de serviços e ferramentas terceirizadas, agora é tudo nosso!';

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const sortear = (lista) => lista[Math.floor(Math.random() * lista.length)];

// ---------- Céu com fogos e confetes ----------
function criarCeu(canvas) {
  const ctx = canvas.getContext('2d');
  const cores = ['#f2b320', '#ff8fab', '#ffd6e4', '#e0702a', '#fff3c4', '#c45a6f', '#9ad0ec', '#b9e4a8'];
  const foguetes = [];
  const faiscas = [];
  const confetes = [];
  let largura = 0;
  let altura = 0;
  let fogosLigados = false;
  let proximoFoguete = 0;
  let quadro = null;

  function redimensionar() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    largura = window.innerWidth;
    altura = window.innerHeight;
    canvas.width = largura * dpr;
    canvas.height = altura * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  redimensionar();
  window.addEventListener('resize', redimensionar);

  function lancar() {
    foguetes.push({
      x: largura * (0.12 + Math.random() * 0.76),
      y: altura + 10,
      vy: -(altura * 0.011 + Math.random() * altura * 0.004),
      alvo: altura * (0.12 + Math.random() * 0.33),
      cor: sortear(cores),
    });
  }

  function explodir(f) {
    const n = 90 + Math.floor(Math.random() * 40);
    const forca = 3.2 + Math.random() * 2.6;
    for (let i = 0; i < n; i++) {
      const angulo = (Math.PI * 2 * i) / n + Math.random() * 0.2;
      const velocidade = forca * (0.55 + Math.random() * 0.6);
      faiscas.push({
        x: f.x, y: f.y,
        vx: Math.cos(angulo) * velocidade, vy: Math.sin(angulo) * velocidade,
        vida: 1, decai: 0.008 + Math.random() * 0.007,
        cor: Math.random() < 0.25 ? '#fff6e0' : f.cor,
      });
    }
  }

  function soltarConfetes(qtd, deCima = true) {
    for (let i = 0; i < qtd; i++) {
      confetes.push({
        x: Math.random() * largura,
        y: deCima ? -20 - Math.random() * altura * 0.6 : altura * 0.4,
        vy: 1.4 + Math.random() * 2.4,
        vx: (Math.random() - 0.5) * 1.2,
        giro: Math.random() * Math.PI,
        vgiro: (Math.random() - 0.5) * 0.18,
        w: 6 + Math.random() * 6,
        h: 9 + Math.random() * 8,
        fase: Math.random() * Math.PI * 2,
        cor: sortear(cores),
        coracao: Math.random() < 0.12,
      });
    }
  }

  function desenharCoracao(x, y, t, cor) {
    ctx.fillStyle = cor;
    ctx.beginPath();
    ctx.moveTo(x, y + t * 0.3);
    ctx.bezierCurveTo(x, y, x - t * 0.5, y, x - t * 0.5, y + t * 0.3);
    ctx.bezierCurveTo(x - t * 0.5, y + t * 0.6, x, y + t * 0.8, x, y + t);
    ctx.bezierCurveTo(x, y + t * 0.8, x + t * 0.5, y + t * 0.6, x + t * 0.5, y + t * 0.3);
    ctx.bezierCurveTo(x + t * 0.5, y, x, y, x, y + t * 0.3);
    ctx.fill();
  }

  function passo(tempo) {
    ctx.clearRect(0, 0, largura, altura);

    if (fogosLigados && tempo > proximoFoguete) {
      lancar();
      if (Math.random() < 0.5) lancar();
      proximoFoguete = tempo + 320 + Math.random() * 420;
    }

    // Foguetes subindo
    for (let i = foguetes.length - 1; i >= 0; i--) {
      const f = foguetes[i];
      f.y += f.vy;
      f.vy *= 0.99;
      ctx.strokeStyle = f.cor;
      ctx.globalAlpha = 0.8;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(f.x, f.y);
      ctx.lineTo(f.x, f.y - f.vy * 4);
      ctx.stroke();
      if (f.y <= f.alvo) { explodir(f); foguetes.splice(i, 1); }
    }

    // Faíscas das explosões
    for (let i = faiscas.length - 1; i >= 0; i--) {
      const p = faiscas[i];
      p.x += p.vx; p.y += p.vy;
      p.vy += 0.035; p.vx *= 0.986; p.vy *= 0.986;
      p.vida -= p.decai;
      if (p.vida <= 0) { faiscas.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.vida);
      ctx.strokeStyle = p.cor;
      ctx.lineWidth = 1.2 + p.vida * 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x - p.vx * 4, p.y - p.vy * 4);
      ctx.lineTo(p.x, p.y);
      ctx.stroke();
    }

    // Confetes caindo
    ctx.globalAlpha = 1;
    for (let i = confetes.length - 1; i >= 0; i--) {
      const c = confetes[i];
      c.y += c.vy;
      c.x += c.vx + Math.sin(c.fase + tempo / 420) * 0.7;
      c.giro += c.vgiro;
      if (c.y > altura + 30) { confetes.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.rotate(c.giro);
      if (c.coracao) {
        desenharCoracao(0, -c.h / 2, c.h * 1.1, c.cor);
      } else {
        ctx.scale(1, Math.cos(c.giro * 2));
        ctx.fillStyle = c.cor;
        ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
    quadro = requestAnimationFrame(passo);
  }

  return {
    iniciar() { if (!quadro) quadro = requestAnimationFrame(passo); },
    ligarFogos() { fogosLigados = true; },
    desligarFogos() { fogosLigados = false; },
    soltarConfetes,
    parar() {
      cancelAnimationFrame(quadro);
      quadro = null;
      window.removeEventListener('resize', redimensionar);
    },
  };
}

// ---------- Cena dos girassóis (mesmo visual do tema Kath) ----------
function cenaGirassois() {
  const aleatorio = (min, max) => Math.round((min + Math.random() * (max - min)) * 100) / 100;
  const petalas = Array.from({ length: 14 }, () =>
    `<span class="bv-petala" style="--x:${aleatorio(0, 100)}%;--atraso:${aleatorio(0, 2)}s;--dur:${aleatorio(3, 4.6)}s;--giro:${aleatorio(-260, 260)}deg;--desvio:${aleatorio(-60, 60)}px"></span>`).join('');
  const flores = [
    { x: 7, h: 32, e: 0.8 }, { x: 22, h: 46, e: 1 }, { x: 38, h: 24, e: 0.7 },
    { x: 62, h: 26, e: 0.72 }, { x: 78, h: 50, e: 1.05 }, { x: 93, h: 34, e: 0.85 },
  ].map((f, i) => `
    <div class="bv-flor" style="--x:${f.x}%;--h:${f.h}vh;--e:${f.e};--i:${i}">
      <span class="bv-haste"></span>
      <span class="bv-cabeca">${adesivo('girassol')}</span>
    </div>`).join('');
  return `
    <div class="bv-cena bv-kath intro-girassois">
      <div class="bv-raios" aria-hidden="true"></div>
      <div class="bv-petalas" aria-hidden="true">${petalas}</div>
      <div class="bv-campo" aria-hidden="true">${flores}</div>
    </div>`;
}

/**
 * Mostra a animação completa. Resolve quando termina (botão Entrar, Pular ou Esc).
 * { textoBotao }: texto do botão final (ex.: "Voltar" quando é só uma prévia no login).
 */
export function mostrarIntro({ textoBotao = 'Entrar no nosso cantinho' } = {}) {
  const reduzido = movimentoReduzido();
  const camada = document.createElement('div');
  camada.className = `intro ${reduzido ? 'estatica' : ''}`;
  camada.setAttribute('role', 'dialog');
  camada.setAttribute('aria-modal', 'true');
  camada.setAttribute('aria-label', 'Animação de início');
  camada.innerHTML = `
    <div class="intro-fase intro-noite" data-fase1 hidden></div>
    <div class="intro-fase" data-fase2 hidden></div>
    <canvas class="intro-ceu" aria-hidden="true"></canvas>
    <div class="intro-textos">
      <div class="intro-assinatura" data-texto1 hidden>
        <span class="intro-coracao" aria-hidden="true">${adesivo('coracao')}</span>
        <p class="intro-assinatura-texto" aria-live="polite">${TEXTO_ASSINATURA}</p>
      </div>
      <div class="intro-final" data-texto2 hidden>
        <h2 class="intro-final-titulo">${TEXTO_FINAL}</h2>
        <p class="intro-final-sub">${TEXTO_FINAL_2}</p>
        <button type="button" class="intro-entrar" data-intro-entrar hidden>Entrar no nosso cantinho</button>
      </div>
    </div>
    <button type="button" class="bv-pular intro-pular">Pular animação</button>`;
  document.body.append(camada);
  const anterior = document.activeElement;
  const ceu = reduzido ? null : criarCeu(camada.querySelector('canvas'));
  const pular = camada.querySelector('.intro-pular');

  return new Promise((resolver) => {
    let encerrado = false;
    const encerrar = () => {
      if (encerrado) return;
      encerrado = true;
      document.removeEventListener('keydown', teclado);
      camada.classList.add('saindo');
      setTimeout(() => {
        ceu?.parar();
        camada.remove();
        if (anterior && document.contains(anterior)) anterior.focus?.();
        resolver();
      }, reduzido ? 100 : 700);
    };
    const teclado = (e) => { if (e.key === 'Escape') encerrar(); };
    document.addEventListener('keydown', teclado);
    pular.addEventListener('click', encerrar);

    (async () => {
      // 1) A tela escurece (fade out do site)
      requestAnimationFrame(() => camada.classList.add('visivel'));
      pular.focus({ preventScroll: true });
      await espera(reduzido ? 150 : 1000);
      if (encerrado) return;

      // 2) "Feito pelo seu amorzinho, Drico!" com fogos e confetes
      camada.querySelector('[data-fase1]').hidden = false;
      camada.querySelector('[data-texto1]').hidden = false;
      if (ceu) {
        ceu.iniciar();
        ceu.ligarFogos();
        setTimeout(() => ceu.soltarConfetes(140), 900);
        setTimeout(() => ceu.soltarConfetes(90), 3200);
      }
      await espera(reduzido ? 3000 : 6500);
      if (encerrado) return;

      // 3) Girassóis + "O nosso cantinho está pronto, amor!"
      const fase1 = camada.querySelector('[data-fase1]');
      const fase2 = camada.querySelector('[data-fase2]');
      fase2.innerHTML = cenaGirassois();
      fase2.hidden = false;
      fase1.classList.add('sumindo');
      const texto1 = camada.querySelector('[data-texto1]');
      texto1.classList.add('sumindo');
      setTimeout(() => { texto1.hidden = true; camada.querySelector('[data-texto2]').hidden = false; }, reduzido ? 0 : 600);
      if (ceu) { ceu.desligarFogos(); ceu.soltarConfetes(70); }
      setTimeout(() => { fase1.hidden = true; }, 900);
      await espera(reduzido ? 200 : 2800);
      if (encerrado) return;
      const entrar = camada.querySelector('[data-intro-entrar]');
      entrar.textContent = textoBotao;
      entrar.hidden = false;
      entrar.addEventListener('click', encerrar);
      entrar.focus({ preventScroll: true });
      pular.hidden = true;
    })();
  });
}
