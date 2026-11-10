// Pesquisa no TMDB feita no SERVIDOR (a chave nunca vai para o navegador).
// Usada pelo servidor-local.mjs (local) e por api/tmdb/search.js (Vercel).

export function tmdbAtivo(env = process.env) {
  return Boolean((env.TMDB_READ_TOKEN || '').trim() || (env.TMDB_API_KEY || '').trim());
}

/** Retorna { status, corpo } com corpo em JSON (texto). */
export async function buscarTmdb({ query, page }, env = process.env) {
  const token = (env.TMDB_READ_TOKEN || '').trim();
  const chave = (env.TMDB_API_KEY || '').trim();
  const json = (status, obj) => ({ status, corpo: JSON.stringify(obj) });

  if (!token && !chave) return json(503, { erro: 'TMDB não configurado no servidor.' });
  const consulta = String(query || '').trim().slice(0, 120);
  if (!consulta) return json(400, { erro: 'Informe o nome do filme.' });
  const pagina = Math.min(Math.max(parseInt(page || '1', 10) || 1, 1), 20);

  const alvo = new URL('https://api.themoviedb.org/3/search/movie');
  alvo.searchParams.set('query', consulta);
  alvo.searchParams.set('page', String(pagina));
  alvo.searchParams.set('language', 'pt-BR');
  alvo.searchParams.set('include_adult', 'false');
  const cabecalhos = { Accept: 'application/json' };
  if (token) cabecalhos.Authorization = `Bearer ${token}`;
  else alvo.searchParams.set('api_key', chave);

  try {
    const resposta = await fetch(alvo, { headers: cabecalhos, signal: AbortSignal.timeout(10000) });
    const texto = await resposta.text();
    if (!resposta.ok) {
      console.warn(`[TMDB] HTTP ${resposta.status}`);
      return json(502, { erro: resposta.status === 401 ? 'Chave do TMDB inválida.' : `O TMDB respondeu com erro ${resposta.status}.` });
    }
    return { status: 200, corpo: texto };
  } catch (e) {
    console.warn('[TMDB] falha de rede:', e.message);
    return json(504, { erro: 'Não foi possível falar com o TMDB agora.' });
  }
}
