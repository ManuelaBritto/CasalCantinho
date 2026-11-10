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
  const topico = `cinema:${perfil.casalId}`;
  let canal = null;

  (async () => {
    try { await cliente.realtime.setAuth(); } catch { /* versões antigas: usa a sessão automaticamente */ }
    canal = cliente.channel(topico, {
      config: { private: true, broadcast: { self: false }, presence: { key: perfil.id } },
    });
    canal.on('broadcast', { event: 'cinema' }, ({ payload }) => {
      if (payload && payload.de !== perfil.id) s._emitir(payload);
    });
    canal.on('presence', { event: 'sync' }, () => {
      const estado = canal.presenceState();
      s.presentes = new Set(Object.keys(estado).filter((k) => k !== perfil.id));
      s.vendo = new Set([...s.presentes].filter((k) => (estado[k] || []).some((m) => m.visivel !== false)));
      s._mudou();
    });
    canal.subscribe(async (status, err) => {
      if (status === 'SUBSCRIBED') {
        s.status = 'ok';
        s.erro = '';
        try { await canal.track({ perfil: perfil.id, desde: Date.now(), visivel: estouVendo() }); } catch { /* presença é opcional */ }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        s.status = 'erro';
        s.erro = 'Não foi possível abrir a sala compartilhada. Confira se o arquivo supabase/cinema-juntos.sql foi executado.';
        console.warn('[Cinema] canal:', status, err?.message || '');
      } else if (status === 'CLOSED') {
        if (s.status !== 'erro') s.status = 'indisponivel';
      }
      s._mudou();
    });
  })();

  s.enviar = (tipo, dados = {}) => {
    if (!canal || s.status !== 'ok') return false;
    canal.send({ type: 'broadcast', event: 'cinema', payload: { ...dados, tipo, de: perfil.id, em: Date.now() } });
    return true;
  };
  const aoMudarVisibilidade = () => {
    if (canal && s.status === 'ok') canal.track({ perfil: perfil.id, desde: Date.now(), visivel: estouVendo() }).catch(() => {});
  };
  document.addEventListener('visibilitychange', aoMudarVisibilidade);
  s.fechar = () => {
    document.removeEventListener('visibilitychange', aoMudarVisibilidade);
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
