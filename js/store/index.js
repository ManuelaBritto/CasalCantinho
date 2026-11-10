// Camada de dados: as páginas usam só estas funções e não sabem
// se os dados estão no navegador (modo demonstração) ou no Supabase.
//
// Interface de um store:
//   listar(colecao) · salvar(colecao, doc) · remover(colecao, id)
//   obterAjustes() · salvarAjustes(parcial) · enviarImagem(arquivo)
// Coleções: cartas, listas, filmes, videos, memorias, mensagens (chat do cinema), desenhos (quadro branco)
// listar(colecao, { limite }) devolve os mais novos primeiro.

let atual = null;

export function definirStore(store) { atual = store; }
export function storeAtual() { return atual; }

function exigir() {
  if (!atual) throw new Error('Armazenamento ainda não iniciado.');
  return atual;
}

export const listar = (colecao, opcoes) => exigir().listar(colecao, opcoes);
export const salvar = (colecao, doc) => exigir().salvar(colecao, doc);
export const remover = (colecao, id) => exigir().remover(colecao, id);
export const obterAjustes = () => exigir().obterAjustes();
export const salvarAjustes = (parcial) => exigir().salvarAjustes(parcial);
export const enviarImagem = (arquivo) => exigir().enviarImagem(arquivo);
export const removerImagem = (caminho) => exigir().removerImagem?.(caminho);
