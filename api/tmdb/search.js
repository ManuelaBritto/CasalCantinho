// Função da Vercel: GET /api/tmdb/search?query=...
// Configure TMDB_READ_TOKEN (ou TMDB_API_KEY) em Project Settings > Environment Variables.
import { buscarTmdb } from '../../lib/tmdb.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    return res.end('Método não permitido');
  }
  const url = new URL(req.url, 'http://localhost');
  const { status, corpo } = await buscarTmdb({ query: url.searchParams.get('query'), page: url.searchParams.get('page') });
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', status === 200 ? 'private, max-age=300' : 'no-store');
  res.end(corpo);
}
