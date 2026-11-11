// Textos dos "lembretes do cantinho" (avisos para o casal voltar ao app).
// Quem decide QUEM recebe e QUANDO é o banco (supabase/engajamento.sql: limite de 2 por dia,
// silêncio das 22h às 8h, preferências de cada pessoa). Aqui só montamos a mensagem.
import { perguntaRespostaDoDia } from '../js/jogos/regras.js';

const sorteio = (lista) => lista[Math.floor(Math.random() * lista.length)];
const plural = (n, um, varios) => `${n} ${n === 1 ? um : varios}`;
const artigo = (tratamento) => (tratamento === 'ela' ? 'a' : tratamento === 'ele' ? 'o' : '');
const comArtigo = (nome, tratamento) => (artigo(tratamento) ? `${artigo(tratamento)} ${nome}` : nome);
const deNome = (nome, tratamento) => (tratamento === 'ela' ? `da ${nome}` : tratamento === 'ele' ? `do ${nome}` : `de ${nome}`);
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

/** { titulo, corpo, url, tag } de cada tipo. */
export function textoEngajamento(l) {
  const d = l.dados || {};
  const outro = l.outro || 'seu amor';
  const link = (hash) => `/?cantinho=${l.casal}&origem=${l.tipo}#/${hash}`;
  const base = { tag: `cantinho-${l.tipo}` };

  switch (l.tipo) {
    case 'marcos': {
      if (d.marco === 'dias') {
        return { ...base, titulo: `${d.dias} dias juntos! 💕`, url: link('inicio'),
          corpo: sorteio([`Hoje vocês completam ${d.dias} dias. Que tal uma cartinha pra comemorar?`, `${d.dias} dias dessa história. Passa no cantinho pra comemorar!`]) };
      }
      const tempo = tempoJuntos(d.anos || 0, d.meses || 0);
      if (!d.meses) {
        return { ...base, titulo: `Hoje vocês fazem ${tempo} juntos! 💕`, url: link('inicio'), corpo: 'Feliz aniversário de namoro! Que tal uma cartinha especial?' };
      }
      return { ...base, titulo: `Hoje fazem ${tempo} juntos 💕`, url: link('inicio'),
        corpo: sorteio(['Feliz mêsversário! Passa no cantinho pra comemorar.', 'Mais um mês dessa história. Que tal mandar uma cartinha?']) };
    }
    case 'nesse_dia': {
      const ha = `Há ${plural(d.anos || 1, 'ano', 'anos')}`;
      if (d.item === 'memoria') {
        return { ...base, titulo: `Nesse dia, ${ha.toLowerCase()} 📸`, url: link('memorias'),
          corpo: d.legenda ? `"${d.legenda}". Bora relembrar?` : 'Tem uma memória de vocês desse mesmo dia. Bora relembrar?' };
      }
      return { ...base, url: link(`cartinhas?abrir=${d.id}`),
        titulo: d.de_mim ? `${ha}, você mandou uma cartinha 💌` : `${ha}, ${outro} te mandou uma cartinha 💌`,
        corpo: d.titulo ? `"${d.titulo}". Quer reler?` : 'Quer reler?' };
    }
    case 'pergunta':
      return { ...base, titulo: sorteio(['Pergunta do dia 💭', 'A pergunta de hoje chegou 💭']), url: link('diversao?resposta'),
        corpo: perguntaRespostaDoDia(d.dia) };
    case 'falta_voce':
      return { ...base, titulo: `${outro} já respondeu a pergunta de hoje 👀`, url: link('diversao?resposta'),
        corpo: `Falta você! Responde pra ver o que ${comArtigo(outro, l.outro_tratamento)} escreveu.` };
    case 'resumo': {
      const itens = [];
      if (d.cartas) itens.push(plural(d.cartas, 'cartinha', 'cartinhas'));
      if (d.memorias) itens.push(plural(d.memorias, 'memória nova', 'memórias novas'));
      if (d.partidas) {
        const placar = d.minhas > d.dele ? `você ganhou de ${d.minhas}×${d.dele}` : d.dele > d.minhas ? `${outro} ganhou de ${d.dele}×${d.minhas}` : 'deu empate';
        itens.push(`${plural(d.partidas, 'partida', 'partidas')} de jogo da velha (${placar})`);
      }
      if (d.forcas) itens.push(plural(d.forcas, 'forca', 'forcas'));
      if (d.respostas) itens.push(`${plural(d.respostas, 'pergunta respondida', 'perguntas respondidas')} juntos`);
      return { ...base, titulo: 'O resumo da semana de vocês ✨', url: link('inicio'), corpo: `Essa semana: ${juntar(itens)}.` };
    }
    case 'vez':
      if (d.jogo === 'forca') {
        return { ...base, titulo: 'A forca está te esperando 🔤', url: link('diversao?jogo=forca'),
          corpo: `${outro} escolheu uma palavra há ${plural(d.dias, 'dia', 'dias')}. Bora adivinhar?` };
      }
      return { ...base, titulo: 'Sua vez no jogo da velha 😏', url: link('diversao?jogo=velha'),
        corpo: `A partida está te esperando há ${plural(d.dias, 'dia', 'dias')}.` };
    case 'saudade':
      if (d.cartas > 0) {
        return { ...base, titulo: `Tem ${plural(d.cartas, 'cartinha', 'cartinhas')} ${deNome(outro, l.outro_tratamento)} esperando você 💌`, url: link('cartinhas'), corpo: 'Toca aqui pra abrir.' };
      }
      return { ...base, titulo: sorteio(['Saudade do cantinho 🥺', 'O cantinho sentiu sua falta 🥺']), url: link('inicio'),
        corpo: sorteio([`Que tal deixar um recadinho pra ${outro} hoje?`, `Passa lá e manda um "Lembre de mim" pra ${outro}.`]) };
    case 'cinema':
      return { ...base, titulo: 'Sexta de cinema 🍿', url: link('cinema'),
        corpo: `Que tal ver "${d.filme}", da lista de vocês, no Cineminha hoje?` };
    default:
      return null;
  }
}
