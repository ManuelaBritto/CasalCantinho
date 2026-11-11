// Ponto de entrada: sessão → boas-vindas → estrutura da página → rotas.
import { guardarOrigemDaUrl, registrarVisita } from './engajamento.js';
import { injetarSpriteIcones, icone } from './ui/icones.js';
import { ICONE_TEMA } from './ui/ilustracoes.js';
import { esc, toast, abrirModal } from './ui/dom.js';
import { TEMAS, TEMA_ENTRADA, aplicarTema, aplicarPreferencias, lerPreferencias, temaDeEntrada, temaSalvo, temaAtual, aoMudarTema, definirTemasDisponiveis, temasDisponiveis, temasDoCasal } from './tema.js';
import { iniciarAuth, modoAuth, clienteSupabase, sair, salvarTemaRemoto, aoSairDaSessao, PERFIS, participacoesDaConta, trocarCantinho, pedirCantinho } from './auth.js';
import { mostrarLogin } from './login.js';
import { mostrarBoasVindas } from './boas-vindas.js';
import { definirStore, storeAtual, listar, obterAjustes, salvarAjustes } from './store/index.js';
import { lerJuntos, normalizarJuntos, tempoAtualMs, relogio } from './juntos.js';
import { iniciarSala, encerrarSala } from './sala-cinema.js';
import { vigiarVersao, pedirAvisoDeVersaoNova, conferirLembretes } from './versao.js';
import { criarStoreLocal } from './store/local.js';
import { registrarServiceWorker, sincronizarNotificacoes, esquecerPerfilNotificacoes, estadoNotificacoes } from './notificacoes.js';
import { carregarRecompensas, verificarConquistas, aplicarEstilosNome, gravarTempoCinema, esperarGravacao, limparCacheRecompensas } from './recompensas.js';

export const ROTAS = [
  { id: 'inicio', titulo: 'Início', icone: 'casa', modulo: () => import('./paginas/inicio.js') },
  { id: 'cartinhas', titulo: 'Cartinhas', icone: 'carta', modulo: () => import('./paginas/cartinhas.js') },
  { id: 'listas', titulo: 'Listas', icone: 'lista', modulo: () => import('./paginas/listas.js') },
  { id: 'calendario', titulo: 'Calendário', icone: 'calendario', modulo: () => import('./paginas/calendario.js') },
  { id: 'cinemateca', titulo: 'Cinemateca', icone: 'filme', modulo: () => import('./paginas/cinemateca.js') },
  { id: 'cinema', titulo: 'Cinema', icone: 'cinema', modulo: () => import('./paginas/cinema.js') },
  { id: 'memorias', titulo: 'Memórias', icone: 'imagem', modulo: () => import('./paginas/memorias.js') },
  { id: 'diversao', titulo: 'Diversão', icone: 'pincel', modulo: () => import('./paginas/diversao.js') },
  { id: 'aparencia', titulo: 'Aparência', icone: 'paleta', modulo: () => import('./paginas/aparencia.js') },
];
const NAV_INFERIOR = ['inicio', 'cartinhas', 'listas', 'cinema'];

let perfilAtual = null;
let limparPagina = null;
let renderizacao = 0;
let removerOuvinteTema = null;
let intervaloAvisos = null;
let intervaloRelogio = null;
let estadoJuntos = null;
const midiaCelular = window.matchMedia('(max-width: 920px)');

// ------------------------------------------------------------------
async function iniciar() {
  injetarSpriteIcones();
  vigiarVersao();
  pedirAvisoDeVersaoNova();
  conferirLembretes();
  registrarServiceWorker();
  aplicarPreferencias(lerPreferencias(null));
  // Veio de um "lembrete do cantinho"? (?origem=…) guarda para contar a abertura
  guardarOrigemDaUrl();
  if (new URLSearchParams(location.search).has('origem') && !new URLSearchParams(location.search).has('cantinho')) {
    history.replaceState(null, '', location.pathname + location.hash);
  }
  // Notificação de outro cantinho (?cantinho=…): abre direto nele
  const pedido = new URLSearchParams(location.search).get('cantinho');
  if (pedido) {
    if (/^[0-9a-f-]{36}$/i.test(pedido)) pedirCantinho(pedido);
    history.replaceState(null, '', location.pathname + location.hash);
  }
  const auth = await iniciarAuth();
  document.getElementById('carregando').hidden = true;
  if (auth.perfil) {
    let jaViu = false;
    try { jaViu = sessionStorage.getItem('nc:boas-vindas-vista') === '1'; } catch { /* ignora */ }
    await abrirApp(auth.perfil, { primeiraEntrada: false, animar: !jaViu });
  } else {
    await fluxoLogin(auth.erro);
  }
}

async function fluxoLogin(erro) {
  aplicarPreferencias(lerPreferencias(null));
  aplicarTema(TEMA_ENTRADA, { salvar: false, livre: true });
  const perfil = await mostrarLogin({ erroInicial: erro });
  await abrirApp(perfil, { primeiraEntrada: true, animar: true });
}

async function abrirApp(perfil, { primeiraEntrada, animar }) {
  perfilAtual = perfil;
  if (modoAuth() === 'supabase') {
    const { criarStoreSupabase } = await import('./store/supabase.js');
    definirStore(criarStoreSupabase(clienteSupabase(), perfil));
    aoSairDaSessao(() => { if (perfilAtual) location.reload(); });
  } else {
    definirStore(criarStoreLocal());
  }

  // Anota a visita do dia (lembretes do cantinho)
  registrarVisita(perfil);

  // Sala do cinema (sessão juntos): um canal só para o site todo
  const sala = iniciarSala(perfil, { modo: modoAuth(), cliente: clienteSupabase() });
  sala.ouvir((msg) => {
    if (msg.tipo === 'aviso') { receberAviso(msg); return; }
    if (msg.tipo === 'convite') { receberConvite(msg); return; }
    if (msg.tipo === 'quadro-novidade') { receberDesenho(msg); return; }
    if (msg.tipo === 'chat' && msg.texto && !msg.convite && rotaDoHash().id !== 'cinema') {
      const texto = String(msg.texto);
      toast(`${PERFIS[msg.de]?.nome || 'Alguém'} no chat do cinema: "${texto.length > 80 ? `${texto.slice(0, 80)}…` : texto}"`, 'info', {
        acao: { texto: 'Responder', executar: () => { location.hash = '#/cinema?chat'; } },
        duracao: 9000,
      });
      return;
    }
    if (msg.tipo !== 'carregar' || rotaDoHash().id === 'cinema') return;
    toast(`${PERFIS[msg.de]?.nome || 'Alguém'} colocou "${msg.titulo || 'um vídeo'}" no cinema.`, 'info', {
      acao: { texto: 'Assistir junto', executar: () => { location.hash = '#/cinema'; } },
      duracao: 9000,
    });
  });

  aplicarPreferencias(lerPreferencias(perfil.id));
  // Cada casal só usa os temas das duas pessoas dele
  definirTemasDisponiveis(temasDoCasal(PERFIS, perfil));
  const tema = primeiraEntrada ? temaDeEntrada(perfil.id, perfil.temaPadrao) : (temaSalvo(perfil.id) || perfil.temaPadrao);
  aplicarTema(tema, { perfil: perfil.id });

  montarEstrutura(perfil);
  sincronizarNotificacoes(perfil);
  const recompensas = carregarRecompensas().catch(() => null);
  const animacao = animar ? escolherAnimacao(perfil) : null;

  window.addEventListener('hashchange', navegar);
  const avisos = iniciarAvisos();
  await navegar({ focar: !animacao });
  if (animacao) {
    await animacao;
    focarTitulo();
  }
  const novas = await avisos;
  if (novas > 0 && primeiraEntrada !== null) {
    toast(novas === 1 ? 'Chegou novidade nas Cartinhas!' : `Você tem ${novas} novidades nas Cartinhas!`, 'info', {
      acao: { texto: 'Abrir', executar: () => { location.hash = '#/cartinhas'; } },
    });
  }
  await recompensas;
  comemorarNovidades();
}

async function removerAparelhoDaConta() {
  const reg = await navigator.serviceWorker?.getRegistration('/');
  const inscricao = await reg?.pushManager.getSubscription();
  if (inscricao) await clienteSupabase().from('push_inscricoes').delete().eq('endpoint', inscricao.endpoint);
}

/** O outro desenhou no quadro branco (site aberto): aviso com "Ver", se não estiver no mesmo desenho. */
function receberDesenho(msg) {
  if (!perfilAtual || msg.para !== perfilAtual.id) return;
  if (location.hash.includes(`desenho=${encodeURIComponent(msg.desenhoId)}`)) return;
  const quem = PERFIS[msg.de]?.nome || 'Alguém';
  const titulo = String(msg.titulo || 'Desenho sem título').slice(0, 60);
  toast(msg.novo ? `${quem} fez um desenho novo: "${titulo}"` : `${quem} desenhou em "${titulo}"`, 'info', {
    acao: { texto: 'Ver', executar: () => { location.hash = `#/diversao?desenho=${encodeURIComponent(msg.desenhoId)}`; } },
    duracao: 9000,
  });
}

/** O outro perfil chamou para assistir junto: janela com "Entrar no cinema". */
function receberConvite(msg) {
  if (!perfilAtual || msg.para !== perfilAtual.id) return;
  const quem = PERFIS[msg.de]?.nome || 'Alguém';
  const texto = String(msg.texto || 'Vem assistir comigo?').slice(0, 140);
  const noCinema = rotaDoHash().id === 'cinema';
  if (noCinema || document.querySelector('dialog[open]')) {
    toast(`${quem} te chamou para assistir: "${texto}"`, 'info', noCinema ? { duracao: 9000 } : {
      acao: { texto: 'Entrar', executar: () => { location.hash = '#/cinema'; } }, duracao: 20000,
    });
    return;
  }
  const { el, fechar } = abrirModal({
    rotulo: `${quem} te chamou para assistir`,
    tamanho: 'pequeno convite-modal',
    corpo: `
      <div class="convite-conteudo">
        <span class="convite-icone" aria-hidden="true">${icone('megafone')}</span>
        <p class="sobretitulo">${esc(quem)} te chamou para assistir</p>
        <p class="convite-texto">"${esc(texto)}"</p>
        ${msg.titulo ? `<p class="dica">${icone('play')} ${esc(msg.titulo)}</p>` : ''}
      </div>`,
    rodape: `<button type="button" class="botao-fantasma" data-fechar>Agora não</button>
      <button type="button" class="botao" data-entrar-convite>${icone('cinema')} Entrar no cinema</button>`,
  });
  const entrar = el.querySelector('[data-entrar-convite]');
  entrar.focus();
  entrar.addEventListener('click', () => { fechar(); location.hash = '#/cinema'; });
}

/** Cartinha, elogio ou lembrete que o outro perfil acabou de enviar (site aberto). */
async function receberAviso(msg) {
  if (!perfilAtual || msg.para !== perfilAtual.id) return;
  const { descricaoNova } = await import('./bilhetes.js');
  window.dispatchEvent(new CustomEvent('nc:carta-recebida', { detail: msg }));
  atualizarAvisos();
  toast(descricaoNova({ de: msg.de, tipo: msg.tipoCarta === 'carta' ? undefined : msg.tipoCarta, mensagem: msg.texto, emoji: msg.emoji }), 'info', {
    acao: { texto: 'Ver', executar: () => { location.hash = `#/cartinhas?abrir=${encodeURIComponent(msg.id)}`; } },
    duracao: 10000,
  });
}

/**
 * Recompensas do cinema desbloqueadas que este perfil ainda não viu (inclusive as que
 * o outro perfil desbloqueou assistindo sozinho). Não interrompe outra janela aberta.
 */
let comemorando = false;
export async function comemorarNovidades() {
  if (!perfilAtual || comemorando || document.querySelector('dialog[open], .intro, .boas-vindas:not([hidden])')
    || document.body.dataset.cinemaTocando === 'sim') return;
  comemorando = true;
  try {
    const perfil = perfilAtual;
    const novas = await verificarConquistas(perfil);
    if (novas.length && perfilAtual === perfil) {
      const { celebrarConquistas } = await import('./conquistas.js');
      await celebrarConquistas(perfil, novas);
    }
  } finally {
    comemorando = false;
  }
}

/** Animação de boas-vindas ao entrar. */
async function escolherAnimacao(perfil) {
  await mostrarBoasVindas(perfil);
}

// ------------------------------------------------------------------
// Avisos globais: cartinhas não lidas e cronômetro "juntos" no topo
function desenharChipJuntos() {
  const chip = document.querySelector('[data-chip-juntos]');
  if (!chip) return;
  const ativo = Boolean(estadoJuntos?.ativoDesde);
  chip.hidden = !ativo;
  if (ativo) chip.querySelector('[data-chip-tempo]').textContent = relogio(tempoAtualMs(estadoJuntos));
}

async function atualizarAvisos() {
  if (!perfilAtual) return 0;
  try {
    const [cartas, juntos] = await Promise.all([listar('cartas'), lerJuntos()]);
    const novas = cartas.filter((c) => c.para === perfilAtual.id && c.de !== perfilAtual.id && c.enviadaEm && !c.lidaEm && !(c.agendadaPara && Date.parse(c.agendadaPara) > Date.now())).length;
    document.querySelectorAll('[data-badge-cartas]').forEach((b) => {
      b.hidden = !novas;
      b.textContent = String(novas);
      b.title = `${novas} ${novas === 1 ? 'cartinha nova' : 'cartinhas novas'}`;
    });
    estadoJuntos = juntos;
    desenharChipJuntos();
    return novas;
  } catch {
    return 0;
  }
}

const aoMudarCartas = () => atualizarAvisos();
const aoPedirComemoracao = () => comemorarNovidades();
const aoMudarJuntos = (e) => { estadoJuntos = normalizarJuntos(e.detail); desenharChipJuntos(); };

function iniciarAvisos() {
  pararAvisos();
  window.addEventListener('nc:cartas-mudou', aoMudarCartas);
  window.addEventListener('nc:juntos-mudou', aoMudarJuntos);
  window.addEventListener('nc:verificar-conquistas', aoPedirComemoracao);
  intervaloAvisos = setInterval(() => { atualizarAvisos(); comemorarNovidades(); }, 45000);
  intervaloRelogio = setInterval(desenharChipJuntos, 1000);
  return atualizarAvisos();
}

function pararAvisos() {
  clearInterval(intervaloAvisos);
  clearInterval(intervaloRelogio);
  window.removeEventListener('nc:cartas-mudou', aoMudarCartas);
  window.removeEventListener('nc:juntos-mudou', aoMudarJuntos);
  window.removeEventListener('nc:verificar-conquistas', aoPedirComemoracao);
  estadoJuntos = null;
}

// ------------------------------------------------------------------
function montarEstrutura(perfil) {
  const shell = document.getElementById('app-shell');
  const demo = modoAuth() === 'demo';
  const local = storeAtual()?.tipo === 'local';

  const seletorTema = (nome) => `
    <fieldset class="seletor-tema">
      <legend>Tema</legend>
      ${temasDisponiveis().map((id) => [id, TEMAS[id]]).map(([id, t]) => `
        <label title="Tema ${t.nome}">
          <input type="radio" name="${nome}" value="${id}" ${temaAtual() === id ? 'checked' : ''}>
          <span>${ICONE_TEMA[id]()}<span class="nome-tema">${t.nome}</span></span>
        </label>`).join('')}
    </fieldset>`;

  shell.innerHTML = `
    <aside class="menu-lateral" id="menu-lateral" aria-label="Menu principal">
      <a class="marca" href="#/inicio">
        <span class="marca-icone" aria-hidden="true">${ICONE_TEMA[temaAtual()]()}</span>
        <span class="marca-nome">Nosso Cantinho</span>
      </a>
      <nav aria-label="Seções">
        <ul class="menu-lista">
          ${ROTAS.map((r) => `<li><a class="menu-link" href="#/${r.id}" data-rota="${r.id}">${icone(r.icone)}<span>${r.titulo}</span>${r.id === 'cartinhas' ? '<span class="badge-menu" data-badge-cartas hidden></span>' : ''}</a></li>`).join('')}
        </ul>
      </nav>
      <div class="menu-rodape">
        ${local ? `<p class="aviso-local">${icone('info')} Dados salvos só neste navegador.</p>` : ''}
        ${participacoesDaConta().length > 1 ? `<button type="button" class="botao-sec pequeno botao-trocar-cantinho" data-trocar-cantinho title="Você está no cantinho com ${esc(Object.values(PERFIS).find((p) => p.id !== perfil.id)?.nome || '')}">${icone('coracao')} Trocar de cantinho</button>` : ''}
        <button type="button" class="botao-sec pequeno" data-sair>${icone('sair')} Sair da conta</button>
      </div>
    </aside>
    <div class="fundo-menu" data-fechar-menu></div>
    <div class="area-principal">
      <header class="topo">
        <button type="button" class="botao-icone contorno botao-menu" aria-label="Abrir menu" aria-expanded="false" aria-controls="menu-lateral" data-abrir-menu>${icone('menu')}</button>
        <p class="topo-titulo" id="topo-titulo">Início</p>
        <a class="chip-juntos" href="#/inicio" data-chip-juntos hidden title="Vocês estão juntos agora">
          ${icone('coracao', 'cheio')}<span class="chip-rotulo">Juntos</span><span data-chip-tempo>00:00:00</span>
        </a>
        ${seletorTema('tema')}
        <div class="usuario">
          <span class="avatar" aria-hidden="true">${(ICONE_TEMA[perfil.temaPadrao] || ICONE_TEMA[TEMA_ENTRADA])()}</span>
          <span class="usuario-nome"><span data-nome-perfil="${perfil.id}">${esc(perfil.nome)}</span>${demo ? '<small>modo demonstração</small>' : ''}</span>
          <button type="button" class="botao-icone" data-sair aria-label="Sair da conta" title="Sair da conta">${icone('sair')}</button>
        </div>
      </header>
      <main id="conteudo" tabindex="-1"></main>
    </div>
    <nav class="nav-inferior" aria-label="Navegação rápida">
      ${NAV_INFERIOR.map((id) => { const r = ROTAS.find((x) => x.id === id); return `<a href="#/${r.id}" data-rota="${r.id}">${icone(r.icone)}<span>${r.titulo}</span>${id === 'cartinhas' ? '<span class="badge-menu" data-badge-cartas hidden></span>' : ''}</a>`; }).join('')}
      <button type="button" data-abrir-menu data-mais aria-controls="menu-lateral" aria-expanded="false">${icone('pontos')}<span>Mais</span></button>
    </nav>`;
  shell.hidden = false;

  // Troca de tema no topo
  shell.querySelectorAll('input[name="tema"]').forEach((input) => {
    input.addEventListener('change', () => {
      aplicarTema(input.value, { perfil: perfilAtual.id });
      salvarTemaRemoto(perfilAtual, input.value);
    });
  });
  removerOuvinteTema?.();
  removerOuvinteTema = aoMudarTema((tema) => {
    const marca = document.querySelector('.marca-icone');
    if (marca && ICONE_TEMA[tema]) marca.innerHTML = ICONE_TEMA[tema]();
    toast(`Tema ${TEMAS[tema]?.nome || ''} aplicado`, 'sucesso', { duracao: 1800 });
  });

  // Menu no celular
  const menu = shell.querySelector('#menu-lateral');
  const fundo = shell.querySelector('.fundo-menu');
  const botoesMenu = shell.querySelectorAll('[data-abrir-menu]');
  const ajustarInert = () => { if (midiaCelular.matches && !menu.classList.contains('aberto')) menu.inert = true; else menu.inert = false; };
  const abrirMenu = () => {
    menu.classList.add('aberto'); fundo.classList.add('visivel'); ajustarInert();
    botoesMenu.forEach((b) => b.setAttribute('aria-expanded', 'true'));
    menu.querySelector('[aria-current="page"], .menu-link')?.focus();
  };
  const fecharMenu = (devolverFoco = false) => {
    if (!menu.classList.contains('aberto')) return;
    menu.classList.remove('aberto'); fundo.classList.remove('visivel'); ajustarInert();
    botoesMenu.forEach((b) => b.setAttribute('aria-expanded', 'false'));
    if (devolverFoco) shell.querySelector('.botao-menu')?.focus();
  };
  botoesMenu.forEach((b) => b.addEventListener('click', abrirMenu));
  fundo.addEventListener('click', () => fecharMenu(true));
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) fecharMenu(); });
  menu.addEventListener('keydown', (e) => { if (e.key === 'Escape') fecharMenu(true); });
  midiaCelular.onchange = () => { if (!midiaCelular.matches) fecharMenu(); ajustarInert(); };
  ajustarInert();

  shell.querySelectorAll('[data-sair]').forEach((b) => b.addEventListener('click', encerrarSessao));
  shell.querySelector('[data-trocar-cantinho]')?.addEventListener('click', () => trocarCantinho(perfil));
}

async function encerrarSessao() {
  window.removeEventListener('hashchange', navegar);
  limparPagina?.();
  limparPagina = null;
  removerOuvinteTema?.();
  removerOuvinteTema = null;
  pararAvisos();
  encerrarSala();
  try { await gravarTempoCinema(); await esperarGravacao(); } catch { /* sem conexão: tudo bem */ }
  limparCacheRecompensas();
  // Ao sair, este aparelho para de receber avisos desta conta (volta ao entrar de novo)
  try { if (await estadoNotificacoes() === 'ativo') await removerAparelhoDaConta(); } catch { /* sem conexão: tudo bem */ }
  esquecerPerfilNotificacoes();
  try { await sair(); } catch (e) { console.warn(e); }
  perfilAtual = null;
  const shell = document.getElementById('app-shell');
  shell.hidden = true;
  shell.innerHTML = '';
  history.replaceState(null, '', location.pathname + location.search);
  toast('Você saiu da conta.', 'info', { duracao: 2500 });
  await fluxoLogin();
}

// ------------------------------------------------------------------
function rotaDoHash() {
  const id = location.hash.replace(/^#\/?/, '').split(/[/?]/)[0] || 'inicio';
  return ROTAS.find((r) => r.id === id) || ROTAS[0];
}

function focarTitulo() {
  const h1 = document.querySelector('#conteudo h1');
  if (h1) { h1.setAttribute('tabindex', '-1'); h1.focus({ preventScroll: true }); }
}

async function navegar({ focar = true } = {}) {
  if (!perfilAtual) return;
  const rota = rotaDoHash();
  const minha = ++renderizacao;
  const main = document.getElementById('conteudo');

  document.querySelectorAll('[data-rota]').forEach((a) => {
    if (a.dataset.rota === rota.id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
  });
  const mais = document.querySelector('[data-mais]');
  if (mais) { if (NAV_INFERIOR.includes(rota.id)) mais.removeAttribute('aria-current'); else mais.setAttribute('aria-current', 'page'); }
  document.getElementById('topo-titulo').textContent = rota.titulo;
  document.title = `${rota.titulo} · Nosso Cantinho`;

  limparPagina?.();
  limparPagina = null;
  main.innerHTML = '<div class="estado"><span class="spinner pequeno" aria-hidden="true"></span> Carregando…</div>';
  main.dataset.pagina = rota.id;

  try {
    const modulo = await rota.modulo();
    if (minha !== renderizacao) return;
    // Cada página recebe um contêiner novo: ouvintes de eventos não "vazam" entre páginas
    main.innerHTML = '';
    const pagina = document.createElement('div');
    pagina.className = `pagina pagina-${rota.id}`;
    main.append(pagina);
    const contexto = {
      perfil: perfilAtual,
      modo: modoAuth(),
      armazenamento: storeAtual(),
      irPara: (id) => { location.hash = `#/${id}`; },
    };
    const limpeza = await modulo.renderizar(pagina, contexto);
    if (minha !== renderizacao) { if (typeof limpeza === 'function') limpeza(); return; }
    limparPagina = typeof limpeza === 'function' ? limpeza : null;
    aplicarEstilosNome(pagina);
    window.scrollTo({ top: 0 });
    if (focar) focarTitulo();
  } catch (e) {
    console.error(e);
    if (minha !== renderizacao) return;
    main.innerHTML = `
      <div class="aviso erro" role="alert">${icone('alerta')}
        <div><p><strong>Não foi possível abrir esta área.</strong></p><p>${esc(e.message || 'Erro inesperado.')}</p>
        <p><button type="button" class="botao-sec pequeno" data-tentar>${icone('restaurar')} Tentar de novo</button></p></div>
      </div>`;
    main.querySelector('[data-tentar]').addEventListener('click', () => navegar());
  }
}

iniciar().catch((e) => {
  console.error(e);
  document.getElementById('carregando').innerHTML = `<p>Algo deu errado ao abrir o site. Recarregue a página.</p>`;
});
