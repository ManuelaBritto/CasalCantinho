// Função da Vercel: /api/lembretes → manda os lembretes do calendário e as cartinhas agendadas
// que chegaram na hora. O Supabase chama a cada 5 minutos (supabase/agendar-lembretes.sql).
// Precisa das variáveis das notificações (VAPID_*, SUPABASE_*) e de AVISO_SEGREDO.
import webpush from 'web-push';
import { enviarLembretes } from '../lib/lembretes.mjs';

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.statusCode = 405;
    return res.end(JSON.stringify({ erro: 'Use POST.' }));
  }
  try {
    const { status, corpo } = await enviarLembretes(process.env, { webpush });
    res.statusCode = status;
    return res.end(JSON.stringify(corpo));
  } catch (e) {
    console.error('[lembretes]', e);
    res.statusCode = 500;
    return res.end(JSON.stringify({ erro: 'Erro ao enviar os lembretes.' }));
  }
}
