// Conteúdo DEMONSTRATIVO usado apenas no modo local, na primeira abertura.
// Tudo é marcado com `exemplo: true` e aparece com o selo "Exemplo" na interface.
// Não há datas, fotos, histórias ou mensagens reais do casal aqui.

const agora = () => new Date().toISOString();

export function dadosDeExemplo() {
  const t = agora();
  return {
    cartas: [
      {
        id: 'exemplo-carta-1', exemplo: true, criadoEm: t, atualizadoEm: t,
        de: 'drico', para: 'kath', enviadaEm: t, lidaEm: null,
        titulo: 'Cartinha de exemplo', destinatario: '', data: '',
        mensagem: 'Este é um texto de demonstração para mostrar como as cartinhas ficam guardadas aqui.\n\nVocê pode editar este exemplo ou excluí-lo e escrever a primeira cartinha de verdade. Escolha o papel, a cor, a fonte e os enfeites que combinam com o momento.',
        estilo: { papel: 'pautado', cor: '#fff4f6', tinta: 'auto', fonte: 'caveat', alinhamento: 'esquerda', moldura: 'delicada', adesivos: ['coracao', 'flor', 'brilho'] },
      },
      {
        id: 'exemplo-carta-2', exemplo: true, criadoEm: t, atualizadoEm: t,
        de: 'kath', para: 'drico', enviadaEm: t, lidaEm: null,
        titulo: 'Exemplo: bilhete vintage', destinatario: '', data: '',
        mensagem: 'Exemplo de cartinha com papel envelhecido, carimbo e girassóis.\n\nTroque este texto pelo que quiser dizer.',
        estilo: { papel: 'envelhecido', cor: '#f8e7c2', tinta: 'auto', fonte: 'courier', alinhamento: 'esquerda', moldura: 'vintage', adesivos: ['laco-rosa', 'margarida', 'pinguinzinha'] },
      },
      {
        id: 'exemplo-carta-3', exemplo: true, criadoEm: t, atualizadoEm: t,
        titulo: 'Exemplo: carta à luz de velas', destinatario: '', data: '',
        mensagem: 'Exemplo de cartinha no estilo gótico romântico, com lua, morcego e rosa escura.\n\nEdite à vontade.',
        estilo: { papel: 'noite', cor: '#2a1626', tinta: 'auto', fonte: 'cormorant', alinhamento: 'centro', moldura: 'gotica', adesivos: ['lua', 'morcego', 'rosa'] },
      },
    ],
    listas: [
      {
        id: 'exemplo-lista-1', exemplo: true, criadoEm: t, atualizadoEm: t,
        titulo: 'Filmes para assistir', descricao: 'Lista de exemplo — troque pelos filmes de vocês.', categoria: 'Filmes',
        estilo: { cor: 'vinho', papel: 'caderno', adesivo: 'brilho' },
        itens: [
          { id: 'ex-i1', texto: 'Um clássico de animação', feito: false },
          { id: 'ex-i2', texto: 'Uma comédia romântica', feito: true },
          { id: 'ex-i3', texto: 'Um terror bem levinho', feito: false },
        ],
      },
      {
        id: 'exemplo-lista-2', exemplo: true, criadoEm: t, atualizadoEm: t,
        titulo: 'Passeios que queremos fazer', descricao: 'Ideias genéricas de exemplo.', categoria: 'Passeios',
        estilo: { cor: 'salvia', papel: 'postit', adesivo: 'folhagem' },
        itens: [
          { id: 'ex-i4', texto: 'Piquenique no parque', feito: false },
          { id: 'ex-i5', texto: 'Ver o pôr do sol', feito: false },
          { id: 'ex-i6', texto: 'Visitar um museu', feito: true },
          { id: 'ex-i7', texto: 'Ir a uma feira gastronômica', feito: false },
        ],
      },
    ],
    filmes: [
      {
        id: 'exemplo-filme-1', exemplo: true, criadoEm: t, atualizadoEm: t, origem: 'manual',
        titulo: 'A Viagem de Chihiro', ano: '2001', poster: '', status: 'quero', observacoes: '',
        sinopse: 'Uma menina fica presa em um mundo de espíritos e precisa trabalhar em uma casa de banhos para salvar os pais.',
      },
      {
        id: 'exemplo-filme-2', exemplo: true, criadoEm: t, atualizadoEm: t, origem: 'manual',
        titulo: 'Orgulho e Preconceito', ano: '2005', poster: '', status: 'assistindo', observacoes: '',
        sinopse: 'Elizabeth Bennet e o Sr. Darcy precisam superar o orgulho e os mal-entendidos.',
      },
      {
        id: 'exemplo-filme-3', exemplo: true, criadoEm: t, atualizadoEm: t, origem: 'manual',
        titulo: 'Drácula de Bram Stoker', ano: '1992', poster: '', status: 'assistido', observacoes: '',
        sinopse: 'Releitura gótica e romântica do clássico de vampiros.',
      },
    ],
    videos: [],
    memorias: [
      { id: 'exemplo-memoria-1', exemplo: true, criadoEm: t, atualizadoEm: t, src: 'assets/exemplos/memoria-1.svg', legenda: 'Ilustração de exemplo — troque por uma foto de vocês', data: '' },
      { id: 'exemplo-memoria-2', exemplo: true, criadoEm: t, atualizadoEm: t, src: 'assets/exemplos/memoria-2.svg', legenda: 'Ilustração de exemplo — um passeio ao ar livre', data: '' },
      { id: 'exemplo-memoria-3', exemplo: true, criadoEm: t, atualizadoEm: t, src: 'assets/exemplos/memoria-3.svg', legenda: 'Ilustração de exemplo — noite de cinema', data: '' },
      { id: 'exemplo-memoria-4', exemplo: true, criadoEm: t, atualizadoEm: t, src: 'assets/exemplos/memoria-4.svg', legenda: 'Ilustração de exemplo — céu estrelado', data: '' },
    ],
    ajustes: { dataInicio: '2024-01-01', dataInicioExemplo: true, fotoCasal: null },
  };
}
