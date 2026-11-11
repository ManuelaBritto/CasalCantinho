// Dados dos jogos e da Resposta do dia.
//  - Supabase: tudo passa pelas funções de supabase/jogos.sql (o banco confere vez, letra, palavra...).
//  - Modo demonstração: guarda neste navegador, com as mesmas regras (js/jogos/regras.js).
import { modoAuth, clienteSupabase, PERFIS } from '../auth.js';
import {
  normalizarPalavra, palavraValida, mascaraForca, resultadoVelha, MAX_ERROS_FORCA, hojeBrasilia,
} from './regras.js';

const outroDe = (perfil) => Object.values(PERFIS).find((p) => p.id !== perfil.id)?.id || '';

/** Mensagem amigável para os erros do banco. */
function erroAmigavel(error, padrao) {
  const m = String(error?.message || '');
  if (/jogos|respostas_dia|velha_|forca_/.test(m) && /(exist|find|schema cache)/i.test(m)) {
    return new Error('Falta rodar o arquivo supabase/jogos.sql no Supabase.');
  }
  return new Error(m && m.length < 120 && !/violates|permission|JWT/i.test(m) ? m : padrao);
}

// ---------------- Supabase ----------------
function dadosSupabase(cliente, perfil) {
  const casal = perfil.casalId;
  const rpc = async (nome, args, padrao) => {
    const { data, error } = await cliente.rpc(nome, args);
    if (error) throw erroAmigavel(error, padrao);
    return data;
  };
  return {
    async listarJogos() {
      const { data, error } = await cliente.from('jogos').select('id, tipo, status, estado, criado_por, criado_em, atualizado_em')
        .eq('casal_id', casal).order('criado_em', { ascending: false }).limit(200);
      if (error) throw erroAmigavel(error, 'Não foi possível carregar os jogos.');
      return data || [];
    },
    velhaNova: () => rpc('velha_nova', { p_casal: casal }, 'Não foi possível começar a partida.'),
    velhaJogar: (id, casa) => rpc('velha_jogar', { p_jogo: id, p_casa: casa }, 'Não foi possível jogar.'),
    forcaNova: (palavra, dica) => rpc('forca_nova', { p_casal: casal, p_palavra: palavra, p_dica: dica }, 'Não foi possível criar a forca.'),
    forcaChutar: (id, letra) => rpc('forca_chutar', { p_jogo: id, p_letra: letra }, 'Não foi possível chutar a letra.'),
    desistir: (id) => rpc('jogo_desistir', { p_jogo: id }, 'Não foi possível encerrar a partida.'),

    async respostas() {
      const hoje = hojeBrasilia();
      const [{ data, error }, quem] = await Promise.all([
        cliente.from('respostas_dia').select('perfil, dia, pergunta, texto, atualizado_em').eq('casal_id', casal).order('dia', { ascending: false }).limit(120),
        cliente.rpc('respostas_dia_quem', { p_casal: casal, p_dia: hoje }),
      ]);
      if (error) throw erroAmigavel(error, 'Não foi possível carregar as respostas.');
      return { linhas: data || [], respondeuHoje: quem.data || [] };
    },
    async responder(texto, pergunta) {
      const hoje = hojeBrasilia();
      const { data: existente } = await cliente.from('respostas_dia').select('id').eq('casal_id', casal).eq('perfil', perfil.id).eq('dia', hoje).maybeSingle();
      const consulta = existente
        ? cliente.from('respostas_dia').update({ texto, atualizado_em: new Date().toISOString() }).eq('id', existente.id)
        : cliente.from('respostas_dia').insert({ casal_id: casal, perfil: perfil.id, pergunta, texto });
      const { error } = await consulta;
      if (error) throw erroAmigavel(error, 'Não foi possível salvar a resposta.');
    },
  };
}

// ---------------- Modo demonstração (este navegador) ----------------
const CHAVE_JOGOS = 'nc:v1:jogos';
const CHAVE_PALAVRAS = 'nc:v1:forca-palavras';
const CHAVE_RESPOSTAS = 'nc:v1:respostas-dia';
const ler = (k, padrao) => { try { return JSON.parse(localStorage.getItem(k)) ?? padrao; } catch { return padrao; } };
const gravar = (k, v) => localStorage.setItem(k, JSON.stringify(v));

function dadosLocal(perfil) {
  const eu = perfil.id;
  const outro = outroDe(perfil);
  const todos = () => ler(CHAVE_JOGOS, []);
  const salvarJogo = (j) => { const lista = todos().filter((x) => x.id !== j.id); gravar(CHAVE_JOGOS, [j, ...lista]); return j; };
  const pegar = (id) => {
    const j = todos().find((x) => x.id === id);
    if (!j) throw new Error('Partida não encontrada.');
    return j;
  };
  const encerrarAbertos = (tipo) => {
    const palavras = ler(CHAVE_PALAVRAS, {});
    gravar(CHAVE_JOGOS, todos().map((j) => (j.tipo === tipo && j.status === 'andamento'
      ? { ...j, status: 'abandonado', atualizado_em: new Date().toISOString(), estado: tipo === 'forca' ? { ...j.estado, fim: 'desistiu', palavra: palavras[j.id] } : j.estado }
      : j)));
  };
  const novo = (tipo, estado) => ({ id: crypto.randomUUID(), tipo, status: 'andamento', estado, criado_por: eu, criado_em: new Date().toISOString(), atualizado_em: new Date().toISOString() });

  return {
    async listarJogos() { return todos(); },
    async velhaNova() {
      encerrarAbertos('velha');
      const ultimo = todos().find((j) => j.tipo === 'velha')?.estado.primeiro;
      const primeiro = ultimo === eu ? outro : eu;
      return salvarJogo(novo('velha', { tab: Array(9).fill(''), jogadores: [eu, outro], primeiro, vez: primeiro, ultima: null, vencedor: null, linha: null, empate: false }));
    },
    async velhaJogar(id, casa) {
      const j = pegar(id);
      if (j.status !== 'andamento') throw new Error('Esta partida já acabou.');
      if (j.estado.vez !== eu) throw new Error('Ainda não é a sua vez.');
      if (j.estado.tab[casa] !== '') throw new Error('Essa casa já foi usada.');
      const tab = [...j.estado.tab];
      tab[casa] = eu;
      const r = resultadoVelha(tab);
      const fim = Boolean(r.vencedor) || r.cheio;
      return salvarJogo({ ...j, status: fim ? 'fim' : 'andamento', atualizado_em: new Date().toISOString(),
        estado: { ...j.estado, tab, ultima: casa, vez: fim ? null : j.estado.jogadores.find((p) => p !== eu), vencedor: r.vencedor, linha: r.linha, empate: !r.vencedor && r.cheio } });
    },
    async forcaNova(palavraBruta, dica) {
      if (!palavraValida(palavraBruta)) throw new Error('Use só letras (de 3 a 24).');
      const palavra = normalizarPalavra(palavraBruta);
      encerrarAbertos('forca');
      const j = novo('forca', { autor: eu, adivinha: outro, dica: String(dica || '').trim().slice(0, 80), tamanho: palavra.replace(/ /g, '').length, mascara: mascaraForca(palavra, []), letras: [], erros: 0, fim: null });
      gravar(CHAVE_PALAVRAS, { ...ler(CHAVE_PALAVRAS, {}), [j.id]: palavra });
      return salvarJogo(j);
    },
    async forcaChutar(id, letraBruta) {
      const j = pegar(id);
      const letra = normalizarPalavra(letraBruta);
      if (j.status !== 'andamento') throw new Error('Esta forca já acabou.');
      if (j.estado.adivinha !== eu) throw new Error('Quem escolheu a palavra não chuta letras.');
      if (j.estado.letras.includes(letra)) throw new Error('Essa letra já foi.');
      const palavra = ler(CHAVE_PALAVRAS, {})[id] || '';
      const letras = [...j.estado.letras, letra];
      const erros = j.estado.erros + (palavra.includes(letra) ? 0 : 1);
      const mascara = mascaraForca(palavra, letras);
      const fim = !mascara.includes('') ? 'acertou' : erros >= MAX_ERROS_FORCA ? 'perdeu' : null;
      return salvarJogo({ ...j, status: fim ? 'fim' : 'andamento', atualizado_em: new Date().toISOString(),
        estado: { ...j.estado, letras, erros, mascara, fim, ...(fim ? { palavra } : {}) } });
    },
    async desistir(id) {
      const j = pegar(id);
      if (j.status === 'andamento') encerrarAbertos(j.tipo);
      return pegar(id);
    },
    async respostas() {
      const hoje = hojeBrasilia();
      const linhas = ler(CHAVE_RESPOSTAS, []);
      const respondi = (dia) => linhas.some((l) => l.perfil === eu && l.dia === dia);
      return {
        linhas: linhas.filter((l) => l.perfil === eu || l.dia < hoje || respondi(l.dia)).sort((a, b) => b.dia.localeCompare(a.dia)),
        respondeuHoje: linhas.filter((l) => l.dia === hoje).map((l) => l.perfil),
      };
    },
    async responder(texto, pergunta) {
      const hoje = hojeBrasilia();
      const linhas = ler(CHAVE_RESPOSTAS, []).filter((l) => !(l.perfil === eu && l.dia === hoje));
      gravar(CHAVE_RESPOSTAS, [{ perfil: eu, dia: hoje, pergunta, texto, atualizado_em: new Date().toISOString() }, ...linhas]);
    },
  };
}

export function criarDadosJogos(perfil) {
  const cliente = clienteSupabase();
  return modoAuth() === 'supabase' && cliente && perfil.casalId ? dadosSupabase(cliente, perfil) : dadosLocal(perfil);
}
