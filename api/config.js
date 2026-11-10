// Função da Vercel: entrega /config.js (ver vercel.json) a partir das variáveis de ambiente.
// Configure SUPABASE_URL e SUPABASE_ANON_KEY em Project Settings > Environment Variables.
import { configPublicaJs } from '../lib/config-publica.mjs';

export default function handler(req, res) {
  res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  try {
    res.statusCode = 200;
    res.end(configPublicaJs());
  } catch (e) {
    console.error(e.message);
    res.statusCode = 500;
    res.end('/* Configuração inválida no servidor. Veja os logs da Vercel. */\nwindow.NOSSO_CANTINHO_CONFIG = {};\n');
  }
}
