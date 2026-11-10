// Sala de cinema compartilhada: leva "carregar vídeo", play/pause/posição e reações
// de um perfil para o outro em tempo real.
//
// - Com Supabase: Realtime Broadcast + Presence num canal PRIVADO do casal
//   ("cinema:<id do casal>"), protegido pelas políticas de supabase/cinema-juntos.sql.
// - Modo demonstração: BroadcastChannel do navegador (sincroniza abas do mesmo navegador).
//
// É um único canal para o site todo (aberto ao entrar, fechado ao sair).

let sala = null;
const estouVendo = () => document.visibilityState === 'visible';

function criarBase(perfil) {
  const ouvintes = new Set();
  const ouvintesStatus = new Set();
  const base = {
    tipo: 'nenhum',
    status: 'indisponivel', // conectando | ok | erro | indisponivel
    erro: '',
    presentes: new Set(), // perfis (kath/drico) com a sala aberta, além de mim
    vendo: new Set(),     // dos presentes, quem está com o site visível na tela agora
    conexao: 1,           // aumenta a cada reconexão (o chat usa para buscar o que perdeu)
    perfil,
    enviar() {},
    ouvir(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); },
    aoMudar(fn) { ouvintesStatus.add(fn); fn(base); return () => ouvintesStatus.delete(fn); },
    _emitir(msg) { ouvintes.forEach((fn) => { try { fn(msg); } catch (e) { console.error(e); } }); },
    _mudou() { ouvintesStatus.forEach((fn) => { try { fn(base); } catch (e) { console.error(e); } }); },
    fechar() {},
  };
  return base;
}

function salaSupabase(perfil, cliente) {
  const s = criarBase(perfil);
  s.tipo = 'supabase';
  s.status = 'conectando';
  s.conexao = 0; // quantas vezes entrou na sala (mais de 1 = reconectou depois de cair)
  const topico = `cinema:${perfil.casalId}`;
  let canal = null;
  let fechada = false;
  let tentativa = 0;
  let timerReconectar = null;
  let geracao = 0;

  // A conexão em tempo real cai quando o celular bloqueia a tela, a aba fica em segundo plano
  // ou a internet oscila. Antes ela não voltava sozinha (só atualizando a página).
  async function conectar() {
    clearTimeout(timerReconectar);
    timerReconectar = null;
    if (fechada) return;
    const minha = ++geracao;
    if (canal) {
      const velho = canal;
      canal = null;
      try { await cliente.removeChannel(velho); } catch { /* já estava fechado */ }
    }
    if (minha !== geracao || fechada) return;
    if (s.status !== 'conectando') { s.status = 'conectando'; s._mudou(); }
    try {
      // getSession renova o login se ele venceu enquanto o aparelho dormia
      const { data } = await cliente.auth.getSession();
      await cliente.realtime.setAuth(data?.session?.access_token);
    } catch { /* versões antigas: usa a sessão automaticamente */ }
    if (minha !== geracao || fechada) return;

    const c = cliente.channel(topico, {
      config: { private: true, broadcast: { self: false }, presence: { key: perfil.id } },
    });
    canal = c;
    c.on('broadcast', { event: 'cinema' }, ({ payload }) => {
      if (payload && payload.de !== perfil.id) s._emitir(payload);
    });
    c.on('presence', { event: 'sync' }, () => {
      if (c !== canal) return;
      const estado = c.presenceState();
      s.presentes = new Set(Object.keys(estado).filter((k) => k !== perfil.id));
      s.vendo = new Set([...s.presentes].filter((k) => (estado[k] || []).some((m) => m.visivel !== false)));
      s._mudou();
    });
    c.subscribe(async (status, err) => {
      if (c !== canal) return; // canal antigo, já trocado
      if (status === 'SUBSCRIBED') {
        tentativa = 0;
        s.status = 'ok';
        s.erro = '';
        s.conexao += 1;
        try { await c.track({ perfil: perfil.id, desde: Date.now(), visivel: estouVendo() }); } catch { /* presença é opcional */ }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        s.status = 'erro';
        s.erro = s.conexao === 0 && tentativa >= 2
          ? 'Não foi possível abrir a sala compartilhada. Confira se o arquivo supabase/cinema-juntos.sql foi executado.'
          : 'A conexão caiu. Reconectando…';
        console.warn('[Cinema] canal:', status, err?.message || '');
        agendar();
      } else if (status === 'CLOSED') {
        if (!fechada) { s.status = 'conectando'; agendar(); }
      }
      s._mudou();
    });
  }

  function agendar(agora = false) {
    if (fechada || timerReconectar) return;
    const espera = agora ? 0 : Math.min(30000, 1000 * 2 ** Math.min(tentativa, 5)); // 1, 2, 4… até 30 s
    tentativa += 1;
    timerReconectar = setTimeout(() => { timerReconectar = null; conectar(); }, espera);
  }

  /** Confere se a conexão continua de pé; se não, reconecta na hora. */
  function conferir() {
    if (fechada) return;
    let caiu = s.status !== 'ok';
    try { if (cliente.realtime.isConnected && !cliente.realtime.isConnected()) caiu = true; } catch { /* ignora */ }
    if (canal?.state && !['joined', 'joining'].includes(canal.state)) caiu = true;
    if (!caiu) return;
    clearTimeout(timerReconectar);
    timerReconectar = null;
    agendar(true);
  }

  conectar();

  s.enviar = (tipo, dados = {}) => {
    if (!canal || s.status !== 'ok') return false;
    canal.send({ type: 'broadcast', event: 'cinema', payload: { ...dados, tipo, de: perfil.id, em: Date.now() } });
    return true;
  };
  const aoMudarVisibilidade = () => {
    if (!estouVendo()) { if (canal && s.status === 'ok') canal.track({ perfil: perfil.id, desde: Date.now(), visivel: false }).catch(() => {}); return; }
    conferir(); // voltou para a tela: a conexão pode ter caído enquanto estava em segundo plano
    if (canal && s.status === 'ok') canal.track({ perfil: perfil.id, desde: Date.now(), visivel: true }).catch(() => {});
  };
  const aoVoltarInternet = () => conferir();
  document.addEventListener('visibilitychange', aoMudarVisibilidade);
  window.addEventListener('online', aoVoltarInternet);
  const vigia = setInterval(() => { if (estouVendo()) conferir(); }, 15000);
  s.reconectar = () => conferir();
  s.fechar = () => {
    fechada = true;
    clearTimeout(timerReconectar);
    clearInterval(vigia);
    document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    window.removeEventListener('online', aoVoltarInternet);
    if (canal) cliente.removeChannel(canal);
    canal = null;
  };
  return s;
}

function salaLocal(perfil) {
  const s = criarBase(perfil);
  if (!('BroadcastChannel' in window)) return s;
  s.tipo = 'local';
  s.status = 'ok';
  const aba = Math.random().toString(36).slice(2);
  const canal = new BroadcastChannel('nosso-cantinho-cinema');
  const vistos = new Map(); // aba → { perfil, quando }

  const atualizarPresenca = () => {
    const agora = Date.now();
    for (const [k, v] of vistos) if (agora - v.quando > 12000) vistos.delete(k);
    const novos = new Set([...vistos.values()].map((v) => v.perfil));
    const mudou = novos.size !== s.presentes.size || [...novos].some((p) => !s.presentes.has(p));
    s.presentes = novos;
    s.vendo = new Set([...vistos.values()].filter((v) => v.visivel !== false).map((v) => v.perfil));
    if (mudou) s._mudou();
  };
  canal.onmessage = ({ data }) => {
    if (!data || data.aba === aba) return;
    vistos.set(data.aba, { perfil: data.de, quando: Date.now(), visivel: data.tipo === 'oi' ? data.visivel : (vistos.get(data.aba)?.visivel ?? true) });
    if (data.tipo === 'oi') {
      if (data.pergunta) canal.postMessage({ tipo: 'oi', de: perfil.id, aba, em: Date.now(), visivel: estouVendo() });
      atualizarPresenca();
      return;
    }
    if (data.tipo === 'tchau') { vistos.delete(data.aba); atualizarPresenca(); return; }
    atualizarPresenca();
    s._emitir(data);
  };
  const oi = (pergunta = false) => canal.postMessage({ tipo: 'oi', pergunta, de: perfil.id, aba, em: Date.now(), visivel: estouVendo() });
  const aoMudarVisibilidade = () => oi();
  document.addEventListener('visibilitychange', aoMudarVisibilidade);
  oi(true);
  const batimento = setInterval(() => { oi(); atualizarPresenca(); }, 5000);

  s.enviar = (tipo, dados = {}) => {
    canal.postMessage({ ...dados, tipo, de: perfil.id, aba, em: Date.now() });
    return true;
  };
  s.fechar = () => {
    clearInterval(batimento);
    document.removeEventListener('visibilitychange', aoMudarVisibilidade);
    try { canal.postMessage({ tipo: 'tchau', de: perfil.id, aba }); } catch { /* ignora */ }
    canal.close();
  };
  return s;
}

/** Abre a sala ao entrar no site. */
export function iniciarSala(perfil, { modo, cliente }) {
  encerrarSala();
  try {
    sala = modo === 'supabase' && cliente && perfil.casalId ? salaSupabase(perfil, cliente) : salaLocal(perfil);
  } catch (e) {
    console.warn('[Cinema] sala indisponível:', e);
    sala = criarBase(perfil);
  }
  return sala;
}

export function salaAtual() { return sala; }

export function encerrarSala() {
  try { sala?.fechar(); } catch { /* ignora */ }
  sala = null;
}
