// Textos dos "lembretes do cantinho" (avisos para o casal voltar ao app).
// Quem decide QUEM recebe e QUANDO é o banco (supabase/engajamento.sql: limite de 2 por dia,
// silêncio das 22h às 8h, preferências de cada pessoa). Aqui só montamos a mensagem.
import { perguntaRespostaDoDia } from '../js/jogos/regras.js';

const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const artigo = (tratamento) => (tratamento === 'ela' ? 'a' : tratamento === 'ele' ? 'o' : '');
const comArtigo = (nome, tratamento) => (artigo(tratamento) ? `${artigo(tratamento)} ${nome}` : nome);
const deNome = (nome, tratamento) => (tratamento === 'ela' ? `da ${nome}` : tratamento === 'ele' ? `do ${nome}` : `de ${nome}`);
const primeiraMaiuscula = (t) => t.charAt(0).toUpperCase() + t.slice(1);
function juntar(itens) {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}
function tempoJuntos(anos, meses) {
  const partes = [];
  if (anos > 0) partes.push(plural(anos, 'ano', 'anos'));
  if (meses > 0) partes.push(plural(meses, 'mês', 'meses'));
  return partes.join(' e ');
}

/** { titulo, corpo, url, tag } de cada tipo: uma frase só, com o nome do app em cima. */
export function textoEngajamento(l) {
  const d = l.dados || {};
  const outro = l.outro || 'seu amor';
  const oOutro = comArtigo(outro, l.outro_tratamento); // "a Kath", "o Drico"
  const link = (hash) => `/?cantinho=${l.casal}&origem=${l.tipo}#/${hash}`;
  const aviso = (frase, hash) => ({ titulo: 'Nosso Cantinho', corpo: frase, url: link(hash), tag: `cantinho-${l.tipo}-${l.casal}` });
  const ha = (anos) => `Há ${plural(anos || 1, 'ano', 'anos')}`;

  switch (l.tipo) {
    case 'bom_dia':
      return aviso(`Já mandou um elogio de bom dia para ${oOutro} hoje?`, 'cartinhas?elogio');
    case 'boa_noite':
      return aviso(`Dê um boa noite com um elogio para ${oOutro}!`, 'cartinhas?elogio');
    case 'marcos':
      if (d.marco === 'dias') return aviso(`Hoje vocês completam ${d.dias} dias juntos! 💕`, 'inicio');
      return aviso(`Hoje vocês fazem ${tempoJuntos(d.anos || 0, d.meses || 0)} juntos! 💕`, 'inicio');
    case 'nesse_dia':
      if (d.item === 'memoria') return aviso(`${ha(d.anos)}, nesse mesmo dia, vocês guardaram uma memória 📸`, 'memorias');
      return aviso(d.de_mim ? `${ha(d.anos)}, nesse mesmo dia, você mandou uma cartinha 💌` : `${ha(d.anos)}, nesse mesmo dia, ${oOutro} te mandou uma cartinha 💌`, `cartinhas?abrir=${d.id}`);
    case 'pergunta':
      return aviso(`Pergunta do dia: ${perguntaRespostaDoDia(d.dia)}`, 'diversao?resposta');
    case 'falta_voce':
      return aviso(`${primeiraMaiuscula(oOutro)} já respondeu a pergunta de hoje, só falta você! 👀`, 'diversao?resposta');
    case 'resumo': {
      const itens = [];
      if (d.cartas) itens.push(plural(d.cartas, 'cartinha', 'cartinhas'));
      if (d.memorias) itens.push(plural(d.memorias, 'memória nova', 'memórias novas'));
      if (d.partidas) itens.push(plural(d.partidas, 'partida', 'partidas'));
      if (d.forcas) itens.push(plural(d.forcas, 'forca', 'forcas'));
      if (d.respostas) itens.push(plural(d.respostas, 'pergunta respondida', 'perguntas respondidas'));
      return aviso(`Essa semana vocês tiveram ${juntar(itens)} ✨`, 'inicio');
    }
    case 'vez':
      if (d.jogo === 'forca') return aviso(`A forca ${deNome(outro, l.outro_tratamento)} está te esperando há ${plural(d.dias, 'dia', 'dias')} 🔤`, 'diversao?jogo=forca');
      return aviso(`O jogo da velha está esperando sua jogada há ${plural(d.dias, 'dia', 'dias')} 😏`, 'diversao?jogo=velha');
    case 'saudade':
      if (d.cartas > 0) return aviso(`Tem ${plural(d.cartas, 'cartinha', 'cartinhas')} ${deNome(outro, l.outro_tratamento)} esperando você 💌`, 'cartinhas');
      return aviso(`Que tal deixar um recadinho para ${oOutro} hoje? 🥺`, 'inicio');
    case 'cinema':
      return aviso(`Sexta de cinema: que tal ver "${d.filme}" hoje? 🍿`, 'cinema');
    default:
      return null;
  }
}
