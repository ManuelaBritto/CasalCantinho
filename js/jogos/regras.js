// Regras dos jogos e da Resposta do dia (as mesmas do banco, em supabase/jogos.sql).
// Usadas no modo demonstração e para desenhar as telas.

export const MAX_ERROS_FORCA = 6;
export const ALFABETO = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const LINHAS_VELHA = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

/** Maiúsculas, sem acento, espaços simples (igual ao forca_normalizar do banco). */
export function normalizarPalavra(texto) {
  return String(texto ?? '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toUpperCase().replace(/\s+/g, ' ').trim();
}

export function palavraValida(texto) {
  const p = normalizarPalavra(texto);
  return /^[A-Z ]{3,24}$/.test(p) && p.replace(/ /g, '').length >= 3;
}

export function mascaraForca(palavra, letras) {
  return palavra.split('').map((c) => (c === ' ' ? ' ' : letras.includes(c) ? c : ''));
}

/** Resultado do tabuleiro: { vencedor, linha, cheio }. */
export function resultadoVelha(tab) {
  for (const l of LINHAS_VELHA) {
    const [a, b, c] = l;
    if (tab[a] && tab[a] === tab[b] && tab[b] === tab[c]) return { vencedor: tab[a], linha: l, cheio: !tab.includes('') };
  }
  return { vencedor: null, linha: null, cheio: !tab.includes('') };
}

/** Placar do casal: velha = vitórias e empates; forca = palavras acertadas por quem adivinhou. */
export function placar(jogos, eu, outro) {
  const p = { velha: { [eu]: 0, [outro]: 0, empates: 0 }, forca: { [eu]: 0, [outro]: 0 } };
  for (const j of jogos) {
    if (j.status !== 'fim') continue;
    if (j.tipo === 'velha') {
      if (j.estado.vencedor && j.estado.vencedor in p.velha) p.velha[j.estado.vencedor] += 1;
      else if (j.estado.empate) p.velha.empates += 1;
    } else if (j.tipo === 'forca' && j.estado.fim === 'acertou' && j.estado.adivinha in p.forca) {
      p.forca[j.estado.adivinha] += 1;
    }
  }
  return p;
}

// ---------------- Resposta do dia ----------------
export const PERGUNTAS_DIA = [
  'Qual foi o melhor dia que a gente já passou junto?',
  'Se a gente fosse viajar amanhã, pra onde iria?',
  'Que música te lembra de mim?',
  'Qual foi a primeira coisa que você reparou em mim?',
  'Qual comida a gente precisa provar junto?',
  'Que filme a gente devia ver essa semana?',
  'Qual é a sua lembrança favorita da gente?',
  'O que te fez sorrir hoje?',
  'Se a gente tivesse um bichinho, qual seria o nome dele?',
  'Qual é o nosso date perfeito?',
  'O que você mais gosta de fazer comigo num dia de chuva?',
  'Qual mania minha você acha fofa?',
  'Que lugar da nossa cidade é mais "a nossa cara"?',
  'Se a nossa história fosse um filme, qual seria o título?',
  'Qual foi a coisa mais engraçada que já aconteceu com a gente?',
  'O que você quer que a gente faça antes do fim do ano?',
  'Qual presente simples te deixaria feliz?',
  'Qual é a sua música pra cantar junto no carro?',
  'Que hábito a gente devia começar junto?',
  'Qual é o seu doce favorito de todos os tempos?',
  'Se você pudesse jantar com qualquer pessoa do mundo, quem seria?',
  'O que te deixa mais tranquilo(a) depois de um dia difícil?',
  'Qual série a gente devia maratonar?',
  'Qual foi a última coisa que te deixou orgulhoso(a) de si?',
  'O que você aprendeu comigo?',
  'Qual é o seu lugar favorito pra ficar à toa?',
  'Que superpoder seria útil pra gente?',
  'Se a gente abrisse um negócio juntos, o que seria?',
  'Qual cheiro te lembra de casa?',
  'Qual foi o melhor conselho que você já recebeu?',
  'Que apelido carinhoso você mais gosta?',
  'Qual estação do ano combina mais com a gente?',
  'O que você faria se ganhasse na loteria hoje?',
  'Qual é o seu momento favorito do dia?',
  'Que jogo de tabuleiro a gente devia jogar?',
  'Qual foi o melhor presente que você já ganhou?',
  'Que cidade você sonha conhecer comigo?',
  'Qual é o seu prato que mais dá saudade?',
  'O que te faz rir sem parar?',
  'Que desenho animado marcou sua infância?',
  'Qual é a sua palavra favorita?',
  'O que você mais gosta no nosso jeito de conversar?',
  'Qual foi o dia em que você mais riu comigo?',
  'Que coisa nova você quer aprender este ano?',
  'Se você fosse um sabor de sorvete, qual seria?',
  'Qual foto nossa você mais gosta?',
  'Qual é o seu lanche perfeito pra ver filme?',
  'Que livro ou história você quer me contar?',
  'Qual é a coisa mais bonita que você viu essa semana?',
  'O que te deixa com saudade de mim?',
  'Qual música você colocaria na nossa playlist agora?',
  'Que lugar você quer me levar um dia?',
  'Qual foi a sua maior conquista do último mês?',
  'O que você faria num dia inteiro sem compromisso?',
  'Qual é o seu emoji mais usado comigo?',
  'Que receita a gente devia tentar fazer junto?',
  'Qual foi a última vez que você se sentiu muito amado(a)?',
  'Se a gente fosse personagens de um jogo, quem seria quem?',
  'Qual é a sua lembrança de infância mais gostosa?',
  'Que mensagem você mandaria pro "eu" de 5 anos atrás?',
  'Qual é o seu passeio favorito de fim de semana?',
  'O que você mais admira em mim?',
  'Qual foi o seu sonho mais doido recentemente?',
  'Que tradição você quer que a gente tenha?',
  'Qual é o melhor jeito de começar o dia?',
  'Se a gente morasse em outro país, qual seria?',
  'Qual foi a melhor surpresa que você já fez ou recebeu?',
  'Que cor representa o nosso relacionamento?',
  'Qual é a sua comida de conforto?',
  'O que você gostaria de ouvir mais vezes de mim?',
  'Qual é o filme que você sempre assiste de novo?',
  'Que animal você seria por um dia?',
  'Qual foi o momento em que você percebeu que gostava de mim?',
  'Qual é o seu plano perfeito pra um domingo?',
  'O que te deixa animado(a) pra semana que vem?',
  'Qual cantor ou banda a gente devia ver ao vivo?',
  'Que pequena coisa eu faço que melhora o seu dia?',
  'Qual é o seu lugar preferido da casa?',
  'Se você pudesse voltar a um dia nosso, qual seria?',
  'O que você mais quer conquistar nos próximos anos?',
  'Qual é a sua sobremesa dos sonhos?',
  'Que piada interna nossa é a sua favorita?',
  'Qual foi a coisa mais corajosa que você já fez?',
  'Que lugar tranquilo você gostaria de visitar comigo?',
  'Qual é a melhor parte de estar com a gente?',
  'Que esporte a gente devia tentar juntos?',
  'Qual é o seu cheiro favorito?',
  'O que você faria se fosse invisível por um dia?',
  'Qual é a sua frase ou lema de vida?',
  'Que coisa simples te deixa muito feliz?',
  'Qual é o seu jeito favorito de receber carinho?',
  'Que apelido você me daria se tivesse que inventar um novo agora?',
  'Qual é a sua lembrança mais engraçada da escola?',
  'Que hobby você teria se tivesse mais tempo?',
  'Qual foi a melhor viagem da sua vida até agora?',
  'O que você colocaria numa cápsula do tempo nossa?',
  'Qual é o seu tipo de chuva favorito: garoa ou tempestade?',
  'Que conselho você me daria hoje?',
  'Qual é a sua bebida favorita pra um dia frio?',
  'Se a gente escrevesse um livro juntos, sobre o que seria?',
  'Qual música te faz dançar na hora?',
  'O que você quer comemorar com a gente esse mês?',
  'Qual é o seu personagem favorito de todos os tempos?',
  'Que lugar te deixa com paz?',
  'Qual é a coisa mais fofa que eu já te disse?',
  'Que talento escondido você tem?',
  'Qual é o melhor cheiro de comida no mundo?',
  'O que a gente devia fazer no próximo feriado?',
  'Qual foi o seu dia mais feliz desse ano?',
  'Se você pudesse morar dentro de um filme, qual seria?',
  'Qual é o seu jeito de mostrar que gosta de alguém?',
  'Que coisa você nunca fez e quer fazer comigo?',
  'Qual é o seu barulho favorito?',
  'Que plantinha a gente devia ter em casa?',
  'O que te faz sentir em casa comigo?',
  'Qual é a melhor hora pra uma conversa longa?',
  'Que frase de filme você usa na vida real?',
  'Qual foi a melhor refeição que a gente já fez junto?',
  'O que você espera do nosso próximo ano?',
  'Qual é o seu pedido pra hoje à noite?',
];

/** Data de hoje no horário de Brasília (AAAA-MM-DD): os dois veem a mesma pergunta. */
export function hojeBrasilia(agora = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora);
}

export function perguntaRespostaDoDia(dia = hojeBrasilia()) {
  const n = Math.floor(Date.parse(`${dia}T12:00:00Z`) / 86400000);
  // O passo 37 espalha as perguntas (dias seguidos não caem em perguntas parecidas)
  const i = (((n * 37) % PERGUNTAS_DIA.length) + PERGUNTAS_DIA.length) % PERGUNTAS_DIA.length;
  return PERGUNTAS_DIA[i];
}

/** "10 de novembro" */
export function diaPorExtenso(dia) {
  return new Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(`${dia}T12:00:00Z`));
}
