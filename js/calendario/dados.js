// Datas do calendário: Supabase (tabela eventos) ou este navegador (modo demonstração).
import { modoAuth, clienteSupabase } from '../auth.js';

const CAMPOS = 'id, titulo, tipo, data, hora, repete, avisar_vespera, avisar_dia, nota, criado_em';
const daLinha = (l) => ({ ...l, hora: l.hora ? String(l.hora).slice(0, 5) : '' });

function erroAmigavel(error, padrao) {
  const m = String(error?.message || '');
  if (/eventos/.test(m) && /(exist|find|schema cache)/i.test(m)) return new Error('Falta rodar o arquivo supabase/calendario.sql no Supabase.');
  return new Error(padrao);
}

function dadosSupabase(cliente, perfil) {
  const casal = perfil.casalId;
  return {
    async listar() {
      const { data, error } = await cliente.from('eventos').select(CAMPOS).eq('casal_id', casal).order('data', { ascending: true });
      if (error) throw erroAmigavel(error, 'Não foi possível carregar o calendário.');
      return (data || []).map(daLinha);
    },
    async salvar(ev) {
      const linha = { titulo: ev.titulo, tipo: ev.tipo, data: ev.data, hora: ev.hora || null, repete: ev.repete, avisar_vespera: ev.avisar_vespera, avisar_dia: ev.avisar_dia, nota: ev.nota || null };
      const consulta = ev.id
        ? cliente.from('eventos').update({ ...linha, atualizado_em: new Date().toISOString() }).eq('id', ev.id).select(CAMPOS).single()
        : cliente.from('eventos').insert({ ...linha, casal_id: casal }).select(CAMPOS).single();
      const { data, error } = await consulta;
      if (error) throw erroAmigavel(error, 'Não foi possível salvar a data.');
      return daLinha(data || { ...linha, id: ev.id });
    },
    async remover(id) {
      const { error } = await cliente.from('eventos').delete().eq('id', id);
      if (error) throw erroAmigavel(error, 'Não foi possível excluir a data.');
    },
  };
}

const CHAVE = 'nc:v1:eventos';
const ler = () => { try { return JSON.parse(localStorage.getItem(CHAVE)) || []; } catch { return []; } };
const gravar = (l) => localStorage.setItem(CHAVE, JSON.stringify(l));

function dadosLocal() {
  return {
    async listar() { return ler().sort((a, b) => a.data.localeCompare(b.data)); },
    async salvar(ev) {
      const lista = ler();
      const novo = { ...ev, id: ev.id || crypto.randomUUID(), criado_em: ev.criado_em || new Date().toISOString() };
      gravar([novo, ...lista.filter((x) => x.id !== novo.id)]);
      return novo;
    },
    async remover(id) { gravar(ler().filter((x) => x.id !== id)); },
  };
}

export function criarDadosCalendario(perfil) {
  const cliente = clienteSupabase();
  return modoAuth() === 'supabase' && cliente && perfil.casalId ? dadosSupabase(cliente, perfil) : dadosLocal();
}
