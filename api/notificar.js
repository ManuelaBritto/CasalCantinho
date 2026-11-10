// Função da Vercel: POST /api/notificar → envia uma notificação para os aparelhos do outro perfil.
// Precisa das variáveis VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT, SUPABASE_URL e SUPABASE_ANON_KEY.
import webpush from 'web-push';
import { enviarNotificacao } from '../lib/notificar.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ erro: 'Use POST.' }));
  }
  try {
    const token = String(req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    let dados = req.body;
    if (typeof dados === 'string') { try { dados = JSON.parse(dados); } catch { dados = {}; } }
    const { status, corpo } = await enviarNotificacao({ token, dados: dados || {} }, process.env, { webpush });
    res.statusCode = status;
    return res.end(JSON.stringify(corpo));
  } catch (e) {
    console.error('[notificar]', e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ erro: 'Erro ao enviar a notificação.' }));
  }
}
