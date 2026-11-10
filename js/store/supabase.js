// Armazenamento no SUPABASE — usado quando SUPABASE_URL e SUPABASE_ANON_KEY estão configurados.
// Mesma interface do store local, então as páginas não precisam saber qual está ativo.
// O isolamento entre casais é garantido pelas políticas RLS do banco. Como uma pessoa
// pode participar de mais de um casal, o site ainda filtra e grava pelo casal ATIVO.
import { gerarId } from '../ui/dom.js';
import { reduzirImagem } from './imagens.js';

const COLECOES = new Set(['cartas', 'listas', 'filmes', 'videos', 'memorias', 'mensagens', 'desenhos']);
const BUCKET = 'memorias';
const VALIDADE_URL = 60 * 60; // 1 hora

function conferir(colecao) {
  if (!COLECOES.has(colecao)) throw new Error(`Coleção desconhecida: ${colecao}`);
}

function falha(erro, acao) {
  console.error(`[Supabase] ${acao}:`, erro);
  return new Error(`Não foi possível ${acao}. Verifique a conexão e tente de novo.`);
}

function paraDoc(linha) {
  return { ...(linha.dados || {}), id: linha.id, criadoEm: linha.criado_em, atualizadoEm: linha.atualizado_em };
}

function paraDados(doc) {
  const { id, criadoEm, atualizadoEm, ...dados } = doc;
  // URLs assinadas expiram: guardamos só o caminho no Storage
  if (dados.imagemPath) delete dados.src;
  return dados;
}

export function criarStoreSupabase(cliente, perfil) {
  async function assinar(caminhos) {
    if (!caminhos.length) return {};
    const { data, error } = await cliente.storage.from(BUCKET).createSignedUrls(caminhos, VALIDADE_URL);
    if (error) { console.warn('[Supabase] URLs assinadas:', error); return {}; }
    return Object.fromEntries(data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]));
  }

  return {
    tipo: 'supabase',
    descricao: 'Os dados ficam salvos no Supabase e sincronizam entre os dispositivos de vocês.',

    async listar(colecao, { limite } = {}) {
      conferir(colecao);
      let consulta = cliente.from(colecao)
        .select('id, dados, criado_em, atualizado_em')
        .eq('casal_id', perfil.casalId)
        .order('criado_em', { ascending: false });
      if (limite) consulta = consulta.limit(limite);
      const { data, error } = await consulta;
      if (error) throw falha(error, 'carregar os dados');
      const docs = data.map(paraDoc);
      const caminhos = docs.map((d) => d.imagemPath).filter(Boolean);
      if (caminhos.length) {
        const urls = await assinar(caminhos);
        docs.forEach((d) => { if (d.imagemPath) d.src = urls[d.imagemPath] || ''; });
      }
      return docs;
    },

    async salvar(colecao, doc) {
      conferir(colecao);
      const dados = paraDados(doc);
      const consulta = doc.id
        ? cliente.from(colecao).update({ dados, atualizado_em: new Date().toISOString() }).eq('id', doc.id)
        : cliente.from(colecao).insert({ dados, casal_id: perfil.casalId });
      const { data, error } = await consulta.select('id, dados, criado_em, atualizado_em').single();
      if (error) throw falha(error, 'salvar');
      const salvo = paraDoc(data);
      if (salvo.imagemPath) salvo.src = doc.src || (await assinar([salvo.imagemPath]))[salvo.imagemPath] || '';
      return salvo;
    },

    async remover(colecao, id) {
      conferir(colecao);
      const { data: atual } = await cliente.from(colecao).select('dados').eq('id', id).maybeSingle();
      const { error } = await cliente.from(colecao).delete().eq('id', id);
      if (error) throw falha(error, 'excluir');
      const caminho = atual?.dados?.imagemPath;
      if (caminho) await cliente.storage.from(BUCKET).remove([caminho]);
    },

    async obterAjustes() {
      const { data, error } = await cliente.from('casais').select('ajustes').eq('id', perfil.casalId).maybeSingle();
      if (error) throw falha(error, 'carregar os ajustes');
      const ajustes = { ...(data?.ajustes || {}) };
      if (ajustes.fotoCasalPath) ajustes.fotoCasal = (await assinar([ajustes.fotoCasalPath]))[ajustes.fotoCasalPath] || null;
      return ajustes;
    },

    async salvarAjustes(parcial) {
      const atuais = await this.obterAjustes();
      const novos = { ...atuais, ...parcial };
      const paraGravar = { ...novos };
      if (paraGravar.fotoCasalPath) delete paraGravar.fotoCasal;
      const { error } = await cliente.from('casais').update({ ajustes: paraGravar }).eq('id', perfil.casalId);
      if (error) throw falha(error, 'salvar os ajustes');
      return novos;
    },

    /** Envia a imagem ao bucket privado "memorias", numa pasta com o id do casal. */
    /** Apaga uma imagem do Storage (ex.: a versão antiga de um desenho). */
    async removerImagem(caminho) {
      if (!caminho) return;
      const { error } = await cliente.storage.from(BUCKET).remove([caminho]);
      if (error) console.warn('[Supabase] remover imagem:', error);
    },

    async enviarImagem(arquivo) {
      const { blob } = await reduzirImagem(arquivo, { ladoMaximo: 1600, qualidade: 0.85 });
      const caminho = `${perfil.casalId}/${gerarId()}.jpg`;
      const { error } = await cliente.storage.from(BUCKET).upload(caminho, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw falha(error, 'enviar a imagem');
      const urls = await assinar([caminho]);
      return { src: urls[caminho] || '', path: caminho };
    },
  };
}
