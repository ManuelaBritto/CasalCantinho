// Função da Vercel: POST /api/avisar-atualizacao → manda "chegou uma atualização nova no cantinho!"
// para todos os aparelhos, uma vez por versão. Ver lib/aviso-atualizacao.mjs.
// Precisa das variáveis das notificações (VAPID_*, SUPABASE_*) e de AVISO_SEGREDO.
import webpush from 'web-push';
import { avisarAtualizacao } from '../lib/aviso-atualizacao.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ erro: 'Use POST.' }));
  }
  try {
    let dados = req.body;
    if (typeof dados === 'string') { try { dados = JSON.parse(dados); } catch { dados = {}; } }
    const { status, corpo } = await avisarAtualizacao(dados || {}, process.env, { webpush });
    res.statusCode = status;
    return res.end(JSON.stringify(corpo));
  } catch (e) {
    console.error('[avisar-atualizacao]', e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ erro: 'Erro ao avisar a atualização.' }));
  }
}
