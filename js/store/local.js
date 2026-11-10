// Armazenamento LOCAL (localStorage) — usado no modo demonstração.
// Os dados ficam apenas neste navegador/dispositivo e não sincronizam.
import { gerarId } from '../ui/dom.js';
import { dadosDeExemplo } from './exemplos.js';
import { reduzirImagem } from './imagens.js';

const PREFIXO = 'nc:v1:';
const COLECOES = ['cartas', 'listas', 'filmes', 'videos', 'memorias', 'mensagens', 'desenhos'];

function ler(chave, padrao) {
  try {
    const bruto = localStorage.getItem(PREFIXO + chave);
    return bruto ? JSON.parse(bruto) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave, valor) {
  try {
    localStorage.setItem(PREFIXO + chave, JSON.stringify(valor));
  } catch (e) {
    const cheio = e && (e.name === 'QuotaExceededError' || e.code === 22);
    throw new Error(cheio
      ? 'O espaço local do navegador acabou. Exclua algumas fotos ou use imagens menores.'
      : 'Não foi possível salvar neste navegador.');
  }
}

function semearSeNecessario() {
  if (localStorage.getItem(PREFIXO + 'semeado')) return;
  const ex = dadosDeExemplo();
  for (const c of COLECOES) if (!localStorage.getItem(PREFIXO + c)) gravar(c, ex[c] || []);
  if (!localStorage.getItem(PREFIXO + 'ajustes')) gravar('ajustes', ex.ajustes);
  localStorage.setItem(PREFIXO + 'semeado', '1');
}

export function criarStoreLocal() {
  try { semearSeNecessario(); } catch { /* sem localStorage: segue com listas vazias */ }

  return {
    tipo: 'local',
    descricao: 'Os dados ficam salvos apenas neste navegador e dispositivo. Não sincronizam e podem ser perdidos ao limpar os dados do navegador.',

    async listar(colecao, { limite } = {}) {
      const itens = ler(colecao, []);
      return limite ? itens.slice(0, limite) : itens;
    },

    async salvar(colecao, doc) {
      const itens = ler(colecao, []);
      const agora = new Date().toISOString();
      const copia = structuredClone(doc);
      if (!copia.id) {
        copia.id = gerarId();
        copia.criadoEm = agora;
      }
      copia.atualizadoEm = agora;
      const i = itens.findIndex((x) => x.id === copia.id);
      if (i >= 0) itens[i] = { ...itens[i], ...copia };
      else itens.unshift({ criadoEm: agora, ...copia });
      gravar(colecao, itens);
      return i >= 0 ? itens[i] : itens[0];
    },

    async remover(colecao, id) {
      gravar(colecao, ler(colecao, []).filter((x) => x.id !== id));
    },

    async obterAjustes() {
      return ler('ajustes', {});
    },

    async salvarAjustes(parcial) {
      const novos = { ...ler('ajustes', {}), ...parcial };
      gravar('ajustes', novos);
      return novos;
    },

    /** Guarda a imagem como data URL reduzida. Retorna { src }. */
    async removerImagem() { /* no modo local a imagem fica dentro do próprio item */ },

    async enviarImagem(arquivo) {
      const { dataUrl } = await reduzirImagem(arquivo, { ladoMaximo: 1100, qualidade: 0.78 });
      return { src: dataUrl };
    },

    async apagarTudo() {
      for (const c of [...COLECOES, 'ajustes', 'semeado']) localStorage.removeItem(PREFIXO + c);
    },

    async restaurarExemplos() {
      await this.apagarTudo();
      semearSeNecessario();
    },
  };
}
