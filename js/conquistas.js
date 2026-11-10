// Interface das Recompensas do Cinema: painel de conquistas, comemoração e colecionáveis.
import {
  RECOMPENSAS, PORTES, ESTILOS_NOME, MODOS_CINEMA, lerProgresso, carregarRecompensas,
  formatarTempoCinema, rotuloLimite, escolherEstiloNome, escolherModoCinema,
} from './recompensas.js';
import { icone } from './ui/icones.js';
import { esc, toast, abrirModal, formatarData } from './ui/dom.js';

// ---------------- Artes (SVG próprio, sem imagens externas) ----------------
const ARTES = {
  ingresso: `<g transform="rotate(-8 60 60)">
      <path d="M12 38h96v14a8 8 0 0 0 0 16v14H12V68a8 8 0 0 0 0-16z" fill="#f2c14e" stroke="#a8761a" stroke-width="2.5"/>
      <path d="M82 40v40" stroke="#a8761a" stroke-width="2" stroke-dasharray="4 4"/>
      <text x="47" y="58" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="700" font-size="12" fill="#6b4307">ENTRADA</text>
      <text x="47" y="72" text-anchor="middle" font-family="DM Sans, sans-serif" font-weight="700" font-size="8" letter-spacing="1.2" fill="#6b4307">PARA DOIS</text>
      <path d="M95 52l2.4 5 5.4.6-4 3.7 1.1 5.3-4.9-2.7-4.8 2.7 1-5.3-4-3.7 5.4-.6z" fill="#fff6d6"/></g>`,
  pipoca: `<path d="M32 52h56l-8 56H40z" fill="#fffaf2"/>
      <path d="M32 52h11.2l-3.2 56H40z M54.4 52h11.2L64 108h-8z M76.8 52H88l-8 56h-8z" fill="#d23b45"/>
      <g fill="#fff3cf" stroke="#e0b24a" stroke-width="1.5"><circle cx="40" cy="46" r="9"/><circle cx="52" cy="40" r="10"/><circle cx="64" cy="44" r="10"/><circle cx="76" cy="40" r="9"/><circle cx="85" cy="47" r="8"/><circle cx="58" cy="30" r="8"/><circle cx="45" cy="33" r="7"/><circle cx="71" cy="29" r="7"/></g>
      <rect x="29" y="50" width="62" height="7" rx="3" fill="#a92631"/>`,
  claquete: `<rect x="18" y="52" width="84" height="52" rx="5" fill="#26222a"/>
      <rect x="18" y="52" width="84" height="12" fill="#f4f1ea"/>
      <path d="M24 52h10l-6 12h-10zM44 52h10l-6 12H38zM64 52h10l-6 12H58zM84 52h10l-6 12H78z" fill="#26222a"/>
      <g transform="rotate(-16 20 48)"><rect x="18" y="36" width="84" height="12" rx="2" fill="#f4f1ea"/>
      <path d="M24 36h10l-6 12h-10zM44 36h10l-6 12H38zM64 36h10l-6 12H58zM84 36h10l-6 12H78z" fill="#26222a"/></g>
      <circle cx="21" cy="49" r="3.5" fill="#9aa0a8"/>
      <text x="28" y="80" font-family="Courier Prime, monospace" font-weight="700" font-size="9" fill="#f4f1ea">CENA 1</text>
      <text x="28" y="94" font-family="Courier Prime, monospace" font-weight="700" font-size="9" fill="#f4f1ea">TOMADA 1</text>
      <path d="M72 76h22M72 90h22" stroke="#f4f1ea" stroke-width="1.5"/>`,
  rolo: `<path d="M74 82c10 6 18 10 34 10v16c-18 0-28-6-40-14z" fill="#4a3427"/>
      <g fill="#c9b49a"><rect x="80" y="88" width="4" height="4" rx="1"/><rect x="90" y="92" width="4" height="4" rx="1"/><rect x="100" y="95" width="4" height="4" rx="1"/></g>
      <circle cx="54" cy="56" r="40" fill="#9aa1ad" stroke="#5b616c" stroke-width="3"/>
      <g fill="#2f333b"><circle cx="54" cy="32" r="9"/><circle cx="54" cy="80" r="9"/><circle cx="33" cy="44" r="9"/><circle cx="75" cy="44" r="9"/><circle cx="33" cy="68" r="9"/><circle cx="75" cy="68" r="9"/></g>
      <circle cx="54" cy="56" r="7" fill="#d9dde3" stroke="#5b616c" stroke-width="2"/>`,
  trofeu: `<defs><linearGradient id="ouro-trofeu" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffe08a"/><stop offset=".5" stop-color="#e3a92b"/><stop offset="1" stop-color="#a8701a"/></linearGradient></defs>
      <path d="M38 28c-14 0-16 22 6 28M82 28c14 0 16 22-6 28" fill="none" stroke="#c98a1e" stroke-width="5"/>
      <path d="M36 22h48v18c0 16-10 28-24 28S36 56 36 40z" fill="url(#ouro-trofeu)"/>
      <rect x="54" y="66" width="12" height="16" fill="#c98a1e"/>
      <rect x="40" y="82" width="40" height="10" rx="2" fill="url(#ouro-trofeu)"/>
      <rect x="34" y="92" width="52" height="14" rx="3" fill="#4a2d1f"/>
      <path d="M60 50c-9-6-12-10-12-14a5.5 5.5 0 0 1 12-2 5.5 5.5 0 0 1 12 2c0 4-3 8-12 14z" fill="#fff4f6"/>`,
  // Fotos de recordação (miniaturas do layout)
  'foto-polaroid': `<rect x="10" y="10" width="100" height="100" rx="8" fill="#efdcca"/>
      <g transform="rotate(-6 60 60)"><rect x="28" y="20" width="64" height="80" rx="2" fill="#fffdf8"/><rect x="34" y="26" width="52" height="52" fill="#3a2a30"/>
      <path d="m55 44 12 8-12 8z" fill="#f6dcc6"/><path d="M38 88c8-3 16 3 24-1s14 2 22-1" stroke="#7a5560" stroke-width="2" fill="none"/></g>`,
  'foto-cartaz': `<rect x="22" y="8" width="76" height="104" rx="3" fill="#24121c"/>
      <ellipse cx="60" cy="20" rx="34" ry="14" fill="#f6dcc6" opacity=".15"/>
      <text x="60" y="48" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="700" font-size="14" fill="#f8e7c9">KATH</text>
      <text x="60" y="60" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-size="9" fill="#e0a85b">&amp;</text>
      <text x="60" y="74" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="700" font-size="14" fill="#f8e7c9">DRICO</text>
      <path d="M34 90h52M38 96h44M42 102h36" stroke="#b39a84" stroke-width="2"/>`,
  'foto-cabine': `<rect x="8" y="10" width="104" height="100" rx="8" fill="#f3d7de"/>
      <rect x="40" y="6" width="40" height="108" rx="2" fill="#fffdf8"/>
      <g fill="#2b2328"><rect x="45" y="11" width="30" height="22"/><rect x="45" y="37" width="30" height="22"/><rect x="45" y="63" width="30" height="22"/></g>
      <text x="60" y="26" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="700" font-size="10" fill="#f6dcc6">3 h</text>
      <path d="m56 43 8 5-8 5z" fill="#f6dcc6"/>
      <path d="M60 80c-6-4-8-7-8-9a3.5 3.5 0 0 1 8-1 3.5 3.5 0 0 1 8 1c0 2-2 5-8 9z" fill="#ff8fab"/>
      <path d="M48 96h24M50 102h20" stroke="#9e8a90" stroke-width="2"/>`,
  'foto-estrela': `<rect x="8" y="8" width="104" height="104" rx="8" fill="#d9c3c3"/>
      <g fill="#bfa6a8"><circle cx="20" cy="22" r="2"/><circle cx="96" cy="30" r="2.5"/><circle cx="28" cy="96" r="2"/><circle cx="90" cy="94" r="2"/><circle cx="62" cy="104" r="1.6"/></g>
      <path d="M60 18l11.8 24 26.4 3.8-19.1 18.6 4.5 26.3L60 78.3 36.4 90.7l4.5-26.3L21.8 45.8 48.2 42z" fill="#d97a94" stroke="#e9b44c" stroke-width="3" stroke-linejoin="round"/>
      <text x="60" y="62" text-anchor="middle" font-family="Fraunces, Georgia, serif" font-weight="700" font-size="9" fill="#ffe8a8">M &amp; L</text>`,
  // Modos da sala
  noir: `<rect x="8" y="16" width="104" height="88" rx="8" fill="#2a2a2a"/>
      <rect x="8" y="16" width="20" height="88" fill="#555"/><rect x="92" y="16" width="20" height="88" fill="#555"/>
      <rect x="32" y="30" width="56" height="40" rx="2" fill="#d9d9d9"/><path d="m55 42 10 8-10 8z" fill="#333"/>
      <g fill="#777"><rect x="34" y="84" width="10" height="12" rx="3"/><rect x="48" y="84" width="10" height="12" rx="3"/><rect x="62" y="84" width="10" height="12" rx="3"/><rect x="76" y="84" width="10" height="12" rx="3"/></g>`,
  vip: `<rect x="8" y="16" width="104" height="88" rx="8" fill="#1d0509"/>
      <path d="M8 16h22v88H8zM90 16h22v88H90z" fill="#8f0f24"/><path d="M14 16v88M20 16v88M26 16v88M96 16v88M102 16v88M108 16v88" stroke="#5c0816" stroke-width="2"/>
      <rect x="40" y="20" width="40" height="9" rx="3" fill="#1a0b05" stroke="#e3a92b" stroke-width="1.5"/>
      <rect x="34" y="34" width="52" height="36" rx="2" fill="#f2e1c4"/><path d="m55 45 10 7-10 7z" fill="#8f0f24"/>
      <g fill="#a3192f"><rect x="34" y="84" width="10" height="12" rx="3"/><rect x="48" y="84" width="10" height="12" rx="3"/><rect x="62" y="84" width="10" height="12" rx="3"/><rect x="76" y="84" width="10" height="12" rx="3"/></g>`,
};

/** Arte de uma recompensa. Estilos de nome usam o próprio nome estilizado. */
export function arteRecompensa(r, nome = 'Kath') {
  if (r.tipo === 'nome') {
    return `<span class="previa-nome previa-${r.estilo}"><span class="nome-estilo nome-${r.estilo}">${esc(nome)}</span></span>`;
  }
  return `<svg viewBox="0 0 120 120" class="arte-recompensa" aria-hidden="true" focusable="false">${ARTES[r.id] || ARTES[r.modo] || ''}</svg>`;
}

const rotuloPorte = (r) => `${PORTES[r.porte].nome} · ${PORTES[r.porte].tipo}`;
const dataConquista = (prog, r) => (prog.datas[r.id] ? formatarData(prog.datas[r.id], { day: 'numeric', month: 'long', year: 'numeric' }) : '');

function botaoAcao(r, prog, perfil) {
  if (r.tipo === 'colecionavel') return `<button type="button" class="botao-sec pequeno" data-conquista="ver" data-id="${r.id}">${icone('olho')} Ver de perto</button>`;
  if (r.tipo === 'foto') return `<button type="button" class="botao pequeno" data-conquista="foto" data-id="${r.id}">${icone('imagem')} Gerar foto</button>`;
  if (r.tipo === 'nome') {
    const emUso = prog.estiloNome(perfil.id) === r.estilo;
    return `<button type="button" class="botao-sec pequeno" data-conquista="nome" data-id="${r.id}" aria-pressed="${emUso}">${emUso ? `${icone('check')} No seu nome` : 'Usar no meu nome'}</button>`;
  }
  const ativo = prog.modoCinema === r.modo;
  return `<button type="button" class="botao-sec pequeno" data-conquista="modo" data-id="${r.id}" aria-pressed="${ativo}">${ativo ? `${icone('check')} Ativo na sala` : 'Ativar na sala'}</button>`;
}

function htmlCartao(r, prog, perfil) {
  const aberta = prog.desbloqueada(r.id);
  const falta = Math.max(0, r.min * 60000 - prog.totalMs);
  return `
    <li class="conquista porte-${r.porte} ${aberta ? 'aberta' : 'trancada'}">
      <div class="conquista-arte">
        ${arteRecompensa(r, perfil.nome)}
        ${aberta ? '' : `<span class="conquista-cadeado">${icone('cadeado')}</span>`}
      </div>
      <div class="conquista-info">
        <p class="conquista-tag"><span class="selo-porte">${esc(rotuloPorte(r))}</span> <span>${esc(rotuloLimite(r.min))}</span></p>
        <h4>${esc(r.nome)}</h4>
        <p class="conquista-desc">${esc(r.descricao)}</p>
        ${aberta
          ? `<p class="meta">${prog.datas[r.id] ? `Conquistada em ${esc(dataConquista(prog, r))}` : 'Conquistada agora'}</p>${botaoAcao(r, prog, perfil)}`
          : `<p class="meta"><span class="sr-only">Bloqueada. </span>Faltam ${esc(formatarTempoCinema(falta))} de cinema</p>`}
      </div>
    </li>`;
}

function htmlEscolhas(prog, perfil) {
  const estilos = RECOMPENSAS.filter((r) => r.tipo === 'nome' && prog.desbloqueada(r.id));
  const modos = RECOMPENSAS.filter((r) => r.tipo === 'modo' && prog.desbloqueada(r.id));
  if (!estilos.length && !modos.length) return '';
  const opcao = (grupo, valor, rotulo, marcado) => `
    <label class="opcao-escolha"><input type="radio" name="${grupo}" value="${valor}" ${marcado ? 'checked' : ''}><span>${rotulo}</span></label>`;
  return `
    <div class="cartao escolhas-conquistas">
      ${estilos.length ? `<fieldset data-escolha="nome"><legend>Estilo do meu nome</legend>
        ${opcao('estilo-nome', '', 'Normal', !prog.estiloNome(perfil.id))}
        ${estilos.map((r) => opcao('estilo-nome', r.estilo, `<span class="nome-estilo nome-${r.estilo}">${esc(perfil.nome)}</span> <span class="sr-only">${esc(ESTILOS_NOME[r.estilo])}</span>`, prog.estiloNome(perfil.id) === r.estilo)).join('')}
      </fieldset>` : ''}
      ${modos.length ? `<fieldset data-escolha="modo"><legend>Modo da sala de cinema <span class="dica">(vale para os dois)</span></legend>
        ${opcao('modo-sala', '', 'Padrão do tema', !prog.modoCinema)}
        ${modos.map((r) => opcao('modo-sala', r.modo, esc(MODOS_CINEMA[r.modo]), prog.modoCinema === r.modo)).join('')}
      </fieldset>` : ''}
    </div>`;
}

function htmlPainel(prog, perfil) {
  const total = RECOMPENSAS.length;
  const ciclos = [];
  for (let i = 0; i < RECOMPENSAS.length; i += 3) ciclos.push(RECOMPENSAS.slice(i, i + 3));
  return `
    <div class="conquistas">
      <div class="cartao resumo-conquistas">
        <div>
          <p class="sobretitulo">Tempo de cinema do casal</p>
          <p class="tempo-cinema" data-tempo-cinema>${esc(formatarTempoCinema(prog.totalMs))}</p>
          <p class="dica">Conta enquanto um vídeo está tocando. Assistindo juntos, o tempo conta uma vez só.</p>
        </div>
        <div class="resumo-proxima">
          ${prog.proxima
            ? `<p>Próxima: <strong>${esc(prog.proxima.nome)}</strong> · faltam ${esc(formatarTempoCinema(prog.faltaMs))}</p>
               <div class="progresso" role="progressbar" aria-label="Progresso até ${esc(prog.proxima.nome)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(prog.pctProxima)}"><span style="width:${prog.pctProxima.toFixed(1)}%"></span></div>`
            : '<p><strong>Todas as recompensas desbloqueadas!</strong> Vocês fecharam a coleção.</p>'}
          <p class="dica">${prog.desbloqueadas.length} de ${total} desbloqueadas</p>
        </div>
      </div>
      ${htmlEscolhas(prog, perfil)}
      ${ciclos.map((grupo, i) => `
        <section class="ciclo-conquistas" aria-label="${i + 1}ª hora de cinema">
          <h3 class="titulo-ciclo">${i + 1}ª hora</h3>
          <ul class="grade-conquistas" role="list">${grupo.map((r) => htmlCartao(r, prog, perfil)).join('')}</ul>
        </section>`).join('')}
    </div>`;
}

// ---------------- Ações ----------------
async function usarEstiloNome(perfil, estilo) {
  try {
    await escolherEstiloNome(perfil.id, estilo);
    toast(estilo ? `Nome ${ESTILOS_NOME[estilo].toLowerCase()} aplicado.` : 'Nome voltou ao normal.', 'sucesso', { duracao: 2000 });
  } catch (e) { toast(e.message, 'erro'); }
}

async function usarModo(modo) {
  try {
    await escolherModoCinema(modo);
    toast(modo ? (modo === 'vip' ? 'Sala VIP ativada.' : `Modo ${MODOS_CINEMA[modo].toLowerCase()} ativado na sala.`) : 'A sala voltou ao padrão do tema.', 'sucesso', { duracao: 2000 });
  } catch (e) { toast(e.message, 'erro'); }
}

export function verColecionavel(r, prog, perfil) {
  abrirModal({
    titulo: r.nome,
    tamanho: 'pequeno',
    corpo: `<div class="colecionavel-detalhe">
        <div class="colecionavel-arte">${arteRecompensa(r, perfil.nome)}</div>
        <p>${esc(r.descricao)}</p>
        <p class="meta">${prog.datas[r.id] ? `Conquistado em ${esc(dataConquista(prog, r))}` : ''} · ${esc(rotuloLimite(r.min))} de cinema</p>
      </div>`,
    rodape: '<button type="button" class="botao" data-fechar>Fechar</button>',
  });
}

async function abrirFoto(r, perfil) {
  const { abrirFotoRecordacao } = await import('./foto-recordacao.js');
  abrirFotoRecordacao(r, perfil);
}

/** Executa a ação de uma recompensa (usado no painel e na comemoração). */
export async function executarAcao(acao, r, perfil) {
  const prog = lerProgresso();
  if (!prog.desbloqueada(r.id)) return;
  if (acao === 'ver') verColecionavel(r, prog, perfil);
  else if (acao === 'foto') abrirFoto(r, perfil);
  else if (acao === 'nome') await usarEstiloNome(perfil, prog.estiloNome(perfil.id) === r.estilo ? '' : r.estilo);
  else if (acao === 'modo') await usarModo(prog.modoCinema === r.modo ? '' : r.modo);
}

/**
 * Desenha o painel de conquistas dentro de `alvo`. Atualiza sozinho quando o tempo muda.
 * Retorna a função de limpeza.
 */
export function montarPainelConquistas(alvo, perfil) {
  const caixa = document.createElement('div');
  alvo.innerHTML = '';
  alvo.append(caixa);
  let prog = lerProgresso();

  const desenhar = () => {
    const foco = document.activeElement && caixa.contains(document.activeElement)
      ? (document.activeElement.dataset.id ? `[data-conquista="${document.activeElement.dataset.conquista}"][data-id="${document.activeElement.dataset.id}"]` : null)
      : null;
    caixa.innerHTML = htmlPainel(prog, perfil);
    if (foco) caixa.querySelector(foco)?.focus();
  };
  desenhar();
  carregarRecompensas().then((p) => { prog = p; if (caixa.isConnected) desenhar(); }).catch(() => {});

  const aoMudar = (e) => { prog = e.detail; if (caixa.isConnected) desenhar(); };
  window.addEventListener('nc:recompensas-mudou', aoMudar);

  caixa.addEventListener('click', (e) => {
    const b = e.target.closest('[data-conquista]');
    if (!b) return;
    const r = RECOMPENSAS.find((x) => x.id === b.dataset.id);
    if (r) executarAcao(b.dataset.conquista, r, perfil);
  });
  caixa.addEventListener('change', (e) => {
    const grupo = e.target.closest('[data-escolha]')?.dataset.escolha;
    if (grupo === 'nome') usarEstiloNome(perfil, e.target.value);
    else if (grupo === 'modo') usarModo(e.target.value);
  });

  return () => window.removeEventListener('nc:recompensas-mudou', aoMudar);
}

// ---------------- Comemoração ----------------
const ROTULO_ACAO = { colecionavel: 'Ver de perto', foto: 'Gerar a foto', nome: 'Usar no meu nome', modo: 'Ativar na sala' };
const ACAO = { colecionavel: 'ver', foto: 'foto', nome: 'nome', modo: 'modo' };

function confete() {
  const cores = ['#f2b320', '#ff8fab', '#9ad0ec', '#b9e4a8', '#d97a94', '#fff3c4'];
  return `<div class="festa-confete" aria-hidden="true">${Array.from({ length: 22 }, (_, i) => `<span style="--x:${(i * 37) % 100}%;--atraso:${((i * 0.13) % 1.4).toFixed(2)}s;--giro:${(i * 47) % 360}deg;background:${cores[i % cores.length]}"></span>`).join('')}</div>`;
}

/** Mostra a comemoração das recompensas novas (uma de cada vez se forem poucas). */
export function celebrarConquistas(perfil, novas) {
  if (!novas?.length) return Promise.resolve();
  return new Promise((pronto) => {
    const principal = novas.at(-1);
    const outras = novas.slice(0, -1);
    let acaoEscolhida = null;
    abrirModal({
      rotulo: 'Nova recompensa desbloqueada',
      tamanho: 'pequeno comemoracao',
      corpo: `${confete()}
        <div class="comemoracao-conteudo">
          <span class="comemoracao-icone" aria-hidden="true">${icone('estrela', 'cheio')}</span>
          <p class="sobretitulo">${novas.length > 1 ? `${novas.length} recompensas novas` : 'Nova recompensa'}</p>
          <h2>${esc(principal.nome)}!</h2>
          <p>Vocês completaram ${esc(rotuloLimite(principal.min))} de cinema. ${esc(principal.descricao)}</p>
          <div class="comemoracao-arte porte-${principal.porte}">${arteRecompensa(principal, perfil.nome)}</div>
          ${outras.length ? `<p class="dica">Também desbloqueadas: ${outras.map((r) => esc(r.nome)).join(', ')}.</p>` : ''}
        </div>`,
      rodape: `<button type="button" class="botao-fantasma" data-fechar>Depois</button>
        <button type="button" class="botao" data-acao-comemoracao>${esc(ROTULO_ACAO[principal.tipo])}</button>`,
      aoAbrir: (d) => {
        d.querySelector('[data-acao-comemoracao]').addEventListener('click', () => {
          acaoEscolhida = ACAO[principal.tipo];
          d.querySelector('[data-fechar]').click();
        });
        d.querySelector('[data-acao-comemoracao]').focus();
      },
      aoFechar: async () => {
        if (acaoEscolhida) await executarAcao(acaoEscolhida, principal, perfil);
        pronto();
      },
    });
  });
}
