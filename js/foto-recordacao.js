// Fotos de recordação: imagens 1080×1350 desenhadas no navegador (canvas), sem serviço externo.
// Usam o tempo de cinema, os vídeos mais assistidos, as reações e a foto do casal (se houver).
import { obterAjustes, listar } from './store/index.js';
import { PERFIS } from './auth.js';
import { lerProgresso, formatarTempoCinema, rotuloLimite } from './recompensas.js';
import { REACOES } from './paginas/cinema.js';
import { icone } from './ui/icones.js';
import { esc, toast, abrirModal, formatarData } from './ui/dom.js';

const L = 1080;
const A = 1350;
const NOMES = `${PERFIS.kath?.nome || 'Kath'} & ${PERFIS.drico?.nome || 'Drico'}`;

// ---------------- Dados ----------------
async function coletarDados() {
  const [ajustes, videos] = await Promise.all([obterAjustes(), listar('videos').catch(() => [])]);
  const prog = lerProgresso(ajustes);
  const vezes = (v) => v.vezes?.length || 0;
  const top = [...videos].filter((v) => vezes(v) > 0).sort((a, b) => vezes(b) - vezes(a)).slice(0, 3);
  const reacoes = {};
  for (const v of videos) for (const [id, n] of Object.entries(v.reacoes || {})) if (REACOES[id]) reacoes[id] = (reacoes[id] || 0) + n;
  const favorita = Object.entries(reacoes).sort((a, b) => b[1] - a[1])[0] || null;
  const datas = videos.flatMap((v) => (v.vezes || []).map((x) => x.em)).filter(Boolean).sort();
  return {
    prog,
    top,
    reacoes,
    favorita,
    primeiraSessao: datas[0] || null,
    sessoes: videos.reduce((s, v) => s + vezes(v), 0),
    fotoCasal: ajustes.fotoCasal || null,
  };
}

async function carregarFonts() {
  if (!document.fonts?.load) return;
  const fontes = ['700 80px Fraunces', '600 40px Fraunces', '700 60px Caveat', 'italic 500 40px Lora', '600 40px Lora', '500 30px "DM Sans"', '700 30px "DM Sans"', '700 30px "Courier Prime"'];
  await Promise.race([Promise.all(fontes.map((f) => document.fonts.load(f).catch(() => null))), new Promise((r) => setTimeout(r, 2500))]);
}

function carregarImagem(src) {
  return new Promise((ok) => {
    if (!src) return ok(null);
    const img = new Image();
    if (!src.startsWith('data:')) img.crossOrigin = 'anonymous';
    img.onload = () => ok(img);
    img.onerror = () => ok(null);
    img.src = src;
    setTimeout(() => ok(null), 6000);
  });
}

// ---------------- Ajudantes de desenho ----------------
function cortar(ctx, texto, largura) {
  let t = String(texto || '');
  if (ctx.measureText(t).width <= largura) return t;
  while (t.length > 1 && ctx.measureText(`${t}…`).width > largura) t = t.slice(0, -1);
  return `${t.trimEnd()}…`;
}

function texto(ctx, t, x, y, { fonte, cor, alinhar = 'center', largura = L - 160, espacamento = 0 }) {
  ctx.font = fonte;
  // Diminui a letra (até 65%) antes de cortar com reticências
  const tamanho = Number(fonte.match(/(\d+)px/)?.[1]) || 0;
  for (let px = tamanho; px > tamanho * 0.65 && ctx.measureText(String(t || '')).width > largura; px -= 2) {
    ctx.font = fonte.replace(/\d+px/, `${px}px`);
  }
  ctx.fillStyle = cor;
  ctx.textAlign = alinhar;
  ctx.textBaseline = 'alphabetic';
  if (espacamento && 'letterSpacing' in ctx) ctx.letterSpacing = `${espacamento}px`;
  ctx.fillText(cortar(ctx, t, largura), x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

function retanguloArredondado(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function imagemCobrindo(ctx, img, x, y, w, h) {
  const escala = Math.max(w / img.width, h / img.height);
  const iw = img.width * escala;
  const ih = img.height * escala;
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.drawImage(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  ctx.restore();
}

function coracao(ctx, x, y, t, cor) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(t / 24, t / 24);
  ctx.beginPath();
  ctx.moveTo(0, 8);
  ctx.bezierCurveTo(-14, -2, -12, -14, -6, -14);
  ctx.bezierCurveTo(-2, -14, 0, -11, 0, -9);
  ctx.bezierCurveTo(0, -11, 2, -14, 6, -14);
  ctx.bezierCurveTo(12, -14, 14, -2, 0, 8);
  ctx.fillStyle = cor;
  ctx.fill();
  ctx.restore();
}

function estrela(ctx, cx, cy, rExt, rInt, pontas = 5) {
  ctx.beginPath();
  for (let i = 0; i < pontas * 2; i++) {
    const r = i % 2 ? rInt : rExt;
    const ang = -Math.PI / 2 + (i * Math.PI) / pontas;
    ctx.lineTo(cx + r * Math.cos(ang), cy + r * Math.sin(ang));
  }
  ctx.closePath();
}

/** Cena de cinema desenhada, usada quando não há foto do casal. */
function cenaCinema(ctx, x, y, w, h) {
  const g = ctx.createRadialGradient(x + w / 2, y, 10, x + w / 2, y + h / 2, h);
  g.addColorStop(0, '#5a2a3c');
  g.addColorStop(1, '#1d0c14');
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#8f2a43';
  ctx.fillRect(x, y, w * 0.14, h);
  ctx.fillRect(x + w * 0.86, y, w * 0.14, h);
  ctx.fillStyle = '#f3e3d0';
  ctx.fillRect(x + w * 0.2, y + h * 0.16, w * 0.6, h * 0.42);
  ctx.fillStyle = '#8f2a43';
  ctx.beginPath();
  ctx.moveTo(x + w * 0.46, y + h * 0.28);
  ctx.lineTo(x + w * 0.58, y + h * 0.37);
  ctx.lineTo(x + w * 0.46, y + h * 0.46);
  ctx.fill();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = '#6d1f33';
    retanguloArredondado(ctx, x + w * 0.17 + i * w * 0.11, y + h * 0.72, w * 0.08, h * 0.16, 10);
    ctx.fill();
  }
  coracao(ctx, x + w * 0.5, y + h * 0.66, 34, '#ff8fab');
}

const dataCurta = (iso) => (iso ? formatarData(iso, { day: 'numeric', month: 'long', year: 'numeric' }) : formatarData(new Date().toISOString(), { day: 'numeric', month: 'long', year: 'numeric' }));

// ---------------- Layouts ----------------
function polaroid(ctx, d, r, img) {
  const fundo = ctx.createLinearGradient(0, 0, L, A);
  fundo.addColorStop(0, '#f4e6d8');
  fundo.addColorStop(1, '#e6cdbb');
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, L, A);
  ctx.fillStyle = 'rgba(158, 74, 98, .08)';
  for (let i = 0; i < 40; i++) coracao(ctx, (i * 211) % L, (i * 137) % A, 30, 'rgba(158, 74, 98, .08)');

  ctx.save();
  ctx.translate(L / 2, 610);
  ctx.rotate(-0.045);
  ctx.shadowColor = 'rgba(60, 30, 30, .3)';
  ctx.shadowBlur = 40;
  ctx.shadowOffsetY = 18;
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(-380, -470, 760, 940);
  ctx.shadowColor = 'transparent';
  if (img) imagemCobrindo(ctx, img, -330, -420, 660, 660); else cenaCinema(ctx, -330, -420, 660, 660);
  texto(ctx, 'Nossa primeira hora de cinema', 0, 330, { fonte: '700 64px Caveat', cor: '#3b2a2f', largura: 680 });
  texto(ctx, `${NOMES} · ${dataCurta(d.prog.datas[r.id])}`, 0, 400, { fonte: '500 46px Caveat', cor: '#7a5560', largura: 680 });
  // fita adesiva
  ctx.fillStyle = 'rgba(242, 226, 228, .85)';
  ctx.rotate(0.1);
  ctx.fillRect(-90, -500, 180, 56);
  ctx.restore();

  texto(ctx, `${formatarTempoCinema(d.prog.totalMs)} de cinema juntinhos`, L / 2, 1210, { fonte: 'italic 500 40px Lora', cor: '#6b3a4a' });
  texto(ctx, 'NOSSO CANTINHO', L / 2, 1280, { fonte: '700 24px "DM Sans"', cor: '#9e4a62', espacamento: 6 });
}

function cartaz(ctx, d) {
  const fundo = ctx.createLinearGradient(0, 0, 0, A);
  fundo.addColorStop(0, '#1d0f1a');
  fundo.addColorStop(1, '#3a1424');
  ctx.fillStyle = fundo;
  ctx.fillRect(0, 0, L, A);
  const luz = ctx.createRadialGradient(L / 2, 0, 20, L / 2, 200, 760);
  luz.addColorStop(0, 'rgba(255, 226, 180, .35)');
  luz.addColorStop(1, 'rgba(255, 226, 180, 0)');
  ctx.fillStyle = luz;
  ctx.fillRect(0, 0, L, A);
  ctx.strokeStyle = '#c99a5b';
  ctx.lineWidth = 3;
  ctx.strokeRect(40, 40, L - 80, A - 80);

  texto(ctx, 'NOSSO CANTINHO APRESENTA', L / 2, 150, { fonte: '700 28px "DM Sans"', cor: '#e0b98a', espacamento: 8 });
  texto(ctx, (PERFIS.kath?.nome || 'Kath').toUpperCase(), L / 2, 360, { fonte: '700 170px Fraunces', cor: '#f8e7c9' });
  texto(ctx, '&', L / 2, 470, { fonte: 'italic 500 90px Lora', cor: '#e0a85b' });
  texto(ctx, (PERFIS.drico?.nome || 'Drico').toUpperCase(), L / 2, 640, { fonte: '700 170px Fraunces', cor: '#f8e7c9' });
  for (let i = -2; i <= 2; i++) { estrela(ctx, L / 2 + i * 70, 720, 18, 8); ctx.fillStyle = '#e0a85b'; ctx.fill(); }
  texto(ctx, `em ${formatarTempoCinema(d.prog.totalMs)} de cinema juntinhos`, L / 2, 810, { fonte: 'italic 500 50px Lora', cor: '#f3d9c0' });

  let y = 930;
  texto(ctx, 'ESTRELANDO OS VÍDEOS', L / 2, y, { fonte: '700 26px "DM Sans"', cor: '#b98f7a', espacamento: 6 });
  y += 56;
  const titulos = d.top.length ? d.top.map((v) => v.titulo) : ['Os próximos vídeos de vocês'];
  for (const t of titulos) { texto(ctx, t, L / 2, y, { fonte: '600 40px Fraunces', cor: '#f8e7c9', largura: 860 }); y += 56; }
  const reacoes = Object.entries(REACOES).filter(([id]) => d.reacoes[id]).map(([id, x]) => `${x.emoji} ${d.reacoes[id]}`).join('    ');
  if (reacoes) { texto(ctx, reacoes, L / 2, y + 20, { fonte: '500 38px "DM Sans"', cor: '#f3d9c0' }); y += 60; }
  texto(ctx, `EM CARTAZ DESDE ${dataCurta(d.primeiraSessao).toUpperCase()}`, L / 2, 1250, { fonte: '700 24px "DM Sans"', cor: '#b98f7a', espacamento: 5 });
}

function cabine(ctx, d, r, img) {
  ctx.fillStyle = '#f3d7de';
  ctx.fillRect(0, 0, L, A);
  ctx.fillStyle = '#ecc5cf';
  for (let x = -A; x < L; x += 90) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + 45, 0); ctx.lineTo(x + 45 + A, A); ctx.lineTo(x + A, A); ctx.fill(); }

  const fx = 290;
  const fw = 500;
  ctx.save();
  ctx.translate(L / 2, A / 2);
  ctx.rotate(0.025);
  ctx.translate(-L / 2, -A / 2);
  ctx.shadowColor = 'rgba(80, 30, 50, .3)';
  ctx.shadowBlur = 36;
  ctx.shadowOffsetY = 14;
  ctx.fillStyle = '#fffdf8';
  ctx.fillRect(fx, 50, fw, 1250);
  ctx.shadowColor = 'transparent';

  const quadro = (i) => ({ x: fx + 30, y: 80 + i * 280, w: fw - 60, h: 250 });
  const quadros = [0, 1, 2, 3].map(quadro);
  for (const q of quadros) { ctx.fillStyle = '#2b2328'; ctx.fillRect(q.x, q.y, q.w, q.h); }

  let q = quadros[0];
  texto(ctx, formatarTempoCinema(d.prog.totalMs), q.x + q.w / 2, q.y + 140, { fonte: '700 84px Fraunces', cor: '#f6dcc6', largura: q.w - 30 });
  texto(ctx, 'de cinema', q.x + q.w / 2, q.y + 200, { fonte: '500 34px "DM Sans"', cor: '#d9b8bf' });

  q = quadros[1];
  texto(ctx, 'MAIS ASSISTIDO', q.x + q.w / 2, q.y + 60, { fonte: '700 22px "DM Sans"', cor: '#d9b8bf', espacamento: 4 });
  const top = d.top[0];
  texto(ctx, top ? top.titulo : 'Ainda em cartaz', q.x + q.w / 2, q.y + 140, { fonte: '600 38px Fraunces', cor: '#f6dcc6', largura: q.w - 40 });
  texto(ctx, top ? `${top.vezes.length}× na tela` : '', q.x + q.w / 2, q.y + 200, { fonte: '500 32px "DM Sans"', cor: '#d9b8bf' });

  q = quadros[2];
  texto(ctx, 'REAÇÃO FAVORITA', q.x + q.w / 2, q.y + 60, { fonte: '700 22px "DM Sans"', cor: '#d9b8bf', espacamento: 4 });
  if (d.favorita) {
    texto(ctx, REACOES[d.favorita[0]].emoji, q.x + q.w / 2, q.y + 160, { fonte: '90px "DM Sans"', cor: '#fff' });
    texto(ctx, `${REACOES[d.favorita[0]].nome} · ${d.favorita[1]}×`, q.x + q.w / 2, q.y + 220, { fonte: '500 30px "DM Sans"', cor: '#d9b8bf' });
  } else {
    texto(ctx, 'Pipoca na mão', q.x + q.w / 2, q.y + 150, { fonte: '600 40px Fraunces', cor: '#f6dcc6' });
  }

  q = quadros[3];
  if (img) imagemCobrindo(ctx, img, q.x, q.y, q.w, q.h);
  else {
    coracao(ctx, q.x + q.w / 2, q.y + 110, 110, '#ff8fab');
    texto(ctx, NOMES, q.x + q.w / 2, q.y + 215, { fonte: '700 40px Caveat', cor: '#f6dcc6' });
  }
  texto(ctx, `${NOMES.toUpperCase()} · ${dataCurta(d.prog.datas[r.id]).toUpperCase()}`, L / 2, 1250 + 20, { fonte: '700 22px "Courier Prime"', cor: '#5a4048', largura: fw - 40 });
  ctx.restore();
}

function estrelaCalcada(ctx, d, r) {
  ctx.fillStyle = '#d6c0c0';
  ctx.fillRect(0, 0, L, A);
  for (let i = 0; i < 900; i++) {
    const x = (i * 9301 + 49297) % L;
    const y = (i * 4373 + 1931) % A;
    ctx.fillStyle = ['#c3a9aa', '#e6d6d4', '#b8999c', '#efe3e1'][i % 4];
    ctx.beginPath();
    ctx.arc(x, y, 2 + (i % 5), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.strokeStyle = 'rgba(120, 90, 92, .35)';
  ctx.lineWidth = 4;
  ctx.strokeRect(70, 70, L - 140, A - 140);

  ctx.save();
  ctx.shadowColor = 'rgba(80, 30, 40, .35)';
  ctx.shadowBlur = 30;
  ctx.shadowOffsetY = 10;
  estrela(ctx, L / 2, 560, 420, 175);
  const g = ctx.createLinearGradient(0, 160, 0, 960);
  g.addColorStop(0, '#e48ba3');
  g.addColorStop(1, '#b45470');
  ctx.fillStyle = g;
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.lineWidth = 16;
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#e9b44c';
  ctx.stroke();
  ctx.restore();

  texto(ctx, (PERFIS.kath?.nome || 'Kath').toUpperCase(), L / 2, 520, { fonte: '700 92px Fraunces', cor: '#ffe8a8', largura: 380 });
  texto(ctx, '&', L / 2, 590, { fonte: 'italic 500 56px Lora', cor: '#ffe8a8' });
  texto(ctx, (PERFIS.drico?.nome || 'Drico').toUpperCase(), L / 2, 690, { fonte: '700 92px Fraunces', cor: '#ffe8a8', largura: 380 });
  ctx.fillStyle = '#e9b44c';
  ctx.beginPath();
  ctx.arc(L / 2, 790, 46, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#b45470';
  ctx.beginPath();
  ctx.moveTo(L / 2 - 14, 768);
  ctx.lineTo(L / 2 + 22, 790);
  ctx.lineTo(L / 2 - 14, 812);
  ctx.fill();

  texto(ctx, `${formatarTempoCinema(d.prog.totalMs)} de cinema juntos`, L / 2, 1090, { fonte: '600 56px Fraunces', cor: '#4a2a33' });
  texto(ctx, `${d.sessoes} ${d.sessoes === 1 ? 'sessão' : 'sessões'} · estrela desde ${dataCurta(d.prog.datas[r.id])}`, L / 2, 1160, { fonte: '500 34px "DM Sans"', cor: '#6b4a52' });
  texto(ctx, 'NOSSO CANTINHO', L / 2, 1240, { fonte: '700 24px "DM Sans"', cor: '#8a3a52', espacamento: 6 });
}

const LAYOUTS = { polaroid, cartaz, cabine, estrela: estrelaCalcada };

/** Desenha a foto e devolve o canvas. */
export async function desenharFoto(r) {
  const [d] = await Promise.all([coletarDados(), carregarFonts()]);
  const img = ['polaroid', 'cabine'].includes(r.layout) ? await carregarImagem(d.fotoCasal) : null;
  const canvas = document.createElement('canvas');
  canvas.width = L;
  canvas.height = A;
  const ctx = canvas.getContext('2d');
  (LAYOUTS[r.layout] || polaroid)(ctx, d, r, img);
  return canvas;
}

function paraBlob(canvas) {
  return new Promise((ok, falha) => canvas.toBlob((b) => (b ? ok(b) : falha(new Error('Não foi possível gerar a imagem.'))), 'image/png'));
}

export function abrirFotoRecordacao(r) {
  const nomeArquivo = `nosso-cantinho-${r.id}.png`;
  let url = null;
  let blob = null;
  const { el } = abrirModal({
    titulo: r.nome,
    corpo: `<div class="foto-recordacao" aria-live="polite">
        <div class="foto-previa" data-previa><span class="spinner pequeno" aria-hidden="true"></span> Revelando a foto…</div>
        <p class="dica">Foto de recordação de ${esc(rotuloLimite(r.min))} de cinema. ${r.layout === 'polaroid' || r.layout === 'cabine' ? 'Usa a foto de vocês da página Início, se houver.' : ''}</p>
      </div>`,
    rodape: `<button type="button" class="botao-fantasma" data-fechar>Fechar</button>
      <button type="button" class="botao-sec" data-compartilhar hidden>${icone('link')} Compartilhar</button>
      <a class="botao" data-baixar aria-disabled="true" download="${nomeArquivo}">${icone('baixar')} Baixar foto</a>`,
    aoFechar: () => { if (url) URL.revokeObjectURL(url); },
  });
  const baixar = el.querySelector('[data-baixar]');
  const compartilhar = el.querySelector('[data-compartilhar]');

  desenharFoto(r)
    .then(paraBlob)
    .then((b) => {
      if (!el.isConnected) return;
      blob = b;
      url = URL.createObjectURL(b);
      el.querySelector('[data-previa]').innerHTML = `<img src="${url}" alt="${esc(r.nome)}: foto de recordação do cinema de ${esc(NOMES)}">`;
      baixar.href = url;
      baixar.removeAttribute('aria-disabled');
      const arquivo = new File([b], nomeArquivo, { type: 'image/png' });
      if (navigator.canShare?.({ files: [arquivo] })) compartilhar.hidden = false;
    })
    .catch((e) => {
      if (!el.isConnected) return;
      el.querySelector('[data-previa]').innerHTML = `<div class="aviso erro" role="alert">${icone('alerta')}<p>${esc(e.message || 'Não foi possível gerar a foto.')}</p></div>`;
    });

  baixar.addEventListener('click', (e) => { if (!blob) e.preventDefault(); });
  compartilhar.addEventListener('click', async () => {
    if (!blob) return;
    try {
      await navigator.share({ files: [new File([blob], nomeArquivo, { type: 'image/png' })], title: r.nome });
    } catch (e) {
      if (e?.name !== 'AbortError') toast('Não foi possível compartilhar daqui. Use "Baixar foto".', 'info');
    }
  });
}
