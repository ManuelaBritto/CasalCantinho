// Curiosidades e recordes para comparar com o tempo que vocês ficaram juntos.
// Pesquisados na web em 31/10/2026; cada um traz a fonte. Para atualizar um recorde,
// edite só esta lista (segundos = duração do fato).

export const CURIOSIDADES = [
  {
    segundos: 2.76,
    mesmo: 'o recorde mundial do cubo mágico (2,76 s, Teodor Zajder, 2026)',
    vezes: (n) => `daria para resolver o cubo mágico no tempo do recorde mundial ${n} vezes`,
    fonte: { nome: 'Guinness World Records', url: 'https://www.guinnessworldrecords.com/world-records/72863-fastest-time-to-solve-a-rubiks-cube' },
  },
  {
    segundos: 9.58,
    mesmo: 'o recorde do Usain Bolt nos 100 m (9,58 s)',
    vezes: (n) => `daria para o Usain Bolt correr os 100 m do recorde mundial ${n} vezes`,
    fonte: { nome: 'Guinness World Records', url: 'https://www.guinnessworldrecords.com/world-records/fastest-run-100-metres-male' },
  },
  {
    segundos: 500,
    mesmo: 'a luz do Sol leva para chegar à Terra (8 min 20 s)',
    vezes: (n) => `a luz do Sol viajaria até a Terra ${n} vezes`,
    fonte: { nome: 'BBC Sky at Night Magazine', url: 'https://skyatnightmagazine.com/space-science/how-take-light-from-sun-reach-earth' },
  },
  {
    segundos: 29 * 60 + 3,
    mesmo: 'o recorde de alguém que ficou embaixo d’água sem respirar (29 min 3 s, Vitomir Maričić, 2025)',
    vezes: (n) => `daria para bater o recorde de ficar embaixo d’água sem respirar ${n} vezes`,
    fonte: { nome: 'Guinness World Records', url: 'https://guinnessworldrecords.com/news/2025/9/freediver-holds-breath-underwater-for-almost-half-an-hour-to-smash-iconic-record' },
  },
  {
    segundos: 90 * 60,
    mesmo: 'uma volta completa da Estação Espacial Internacional ao redor da Terra (90 min)',
    vezes: (n) => `a Estação Espacial Internacional daria ${n} voltas ao redor da Terra`,
    fonte: { nome: 'NASA', url: 'https://science.nasa.gov/eclips/videos/what-time-is-it-in-space/' },
  },
  {
    segundos: 2 * 3600 + 35,
    mesmo: 'o recorde mundial da maratona (2 h 0 min 35 s, Kelvin Kiptum)',
    vezes: (n) => `daria para correr a maratona no tempo do recorde mundial ${n} vezes`,
    fonte: { nome: 'CBC Sports', url: 'https://amp.cbc.ca/sports/olympics/summer/athletics/kenya-kelvin-kiptum-mens-world-record-marathon-oct-8-1.6990532' },
  },
  {
    segundos: 2 * 3600 + 31 * 60 + 40,
    mesmo: 'a primeira caminhada na Lua, da Apollo 11 (2 h 31 min)',
    vezes: (n) => `daria para repetir a caminhada da Apollo 11 na Lua ${n} vezes`,
    fonte: { nome: 'Smithsonian Air and Space Museum', url: 'https://airandspace.si.edu/stories/editorial/small-steps-and-giant-leaps-apollo-lunar-landings' },
  },
  {
    segundos: 194 * 60,
    mesmo: 'o filme Titanic inteiro (3 h 14 min)',
    vezes: (n) => `daria para assistir Titanic inteiro ${n} vezes`,
    fonte: { nome: 'Wikipédia', url: 'https://simple.wikipedia.org/wiki/Titanic_(1997_film)' },
  },
  {
    segundos: 9 * 3600 + 38 * 60 + 47,
    mesmo: 'o recorde mundial de prancha abdominal (9 h 38 min, Josef Šálek)',
    vezes: (n) => `daria para bater o recorde mundial de prancha ${n} vezes`,
    fonte: { nome: 'Guinness World Records', url: 'https://www.guinnessworldrecords.com/world-records/longest-time-in-an-abdominal-plank-position.html' },
  },
  {
    segundos: 18 * 3600 + 40 * 60,
    mesmo: 'o voo comercial mais longo do mundo, Nova York → Singapura (cerca de 18 h 40 min)',
    vezes: (n) => `daria para fazer o voo mais longo do mundo ${n} vezes`,
    fonte: { nome: 'Russian Tourism News (dados OAG)', url: 'https://www.rustourismnews.com/2026/08/31/the-15-longest-flights-in-the-world-and-the-20-hour-route-coming-next/' },
  },
  {
    segundos: 58 * 3600 + 35 * 60 + 58,
    mesmo: 'o beijo mais longo da história (58 h 35 min, Ekkachai e Laksana Tiranarat)',
    vezes: (n) => `daria para bater o recorde do beijo mais longo ${n} vezes`,
    fonte: { nome: 'NBC News', url: 'https://www.nbcnews.com/news/photo/smooooooooooch-thai-couple-kisses-58-hours-sets-new-world-record-flna1c8380649' },
  },
];

/** "15 minutos", "1 hora e 5 minutos", "40 segundos" */
export function tempoFalado(ms) {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s} ${s === 1 ? 'segundo' : 'segundos'}`;
  const totalMin = Math.floor(s / 60);
  const d = Math.floor(totalMin / 1440);
  const h = Math.floor((totalMin % 1440) / 60);
  const m = totalMin % 60;
  const p = [];
  if (d) p.push(`${d} ${d === 1 ? 'dia' : 'dias'}`);
  if (h) p.push(`${h} ${h === 1 ? 'hora' : 'horas'}`);
  if (m && !d) p.push(`${m} ${m === 1 ? 'minuto' : 'minutos'}`);
  return p.length > 1 ? `${p.slice(0, -1).join(', ')} e ${p.at(-1)}` : p[0];
}

function semente(texto) {
  let h = 0;
  for (const c of String(texto)) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
}

/**
 * Monta a mensagem divertida. `chave` deixa a escolha estável para o mesmo encontro.
 * Retorna { texto, fonte } ou null.
 */
export function mensagemCuriosa(ms, chave = '') {
  const seg = ms / 1000;
  if (seg < 2) return null;
  const tempo = tempoFalado(ms);

  // Algum fato com duração quase igual? → "o mesmo tempo que…"
  const parecido = CURIOSIDADES.find((f) => seg / f.segundos >= 0.85 && seg / f.segundos <= 1.2);
  if (parecido) {
    return { texto: `Nossa! Vocês ficaram ${tempo} juntos — praticamente o mesmo tempo que ${parecido.mesmo}!`, fonte: parecido.fonte };
  }

  // Senão, compara com um dos fatos mais longos que cabem no tempo → "daria para … N vezes"
  const cabem = CURIOSIDADES.filter((f) => f.segundos <= seg).sort((a, b) => b.segundos - a.segundos).slice(0, 3);
  if (!cabem.length) return null;
  const multiplos = cabem.filter((f) => seg / f.segundos >= 2); // "N vezes" fica mais divertido
  const opcoes = multiplos.length ? multiplos : cabem;
  const f = opcoes[semente(chave || Math.floor(seg / 60)) % opcoes.length];
  const n = Math.floor(seg / f.segundos);
  const comparacao = n >= 2 ? f.vezes(n.toLocaleString('pt-BR')) : `foi mais do que ${f.mesmo}`;
  return { texto: `Nossa! Vocês ficaram ${tempo} juntos — ${comparacao}!`, fonte: f.fonte };
}
