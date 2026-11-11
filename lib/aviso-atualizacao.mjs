// Notificação "chegou uma atualização nova no cantinho" para todos os aparelhos.
// Usada por api/avisar-atualizacao.js (Vercel) e pelo servidor-local.mjs.
//
// Quem dispara:
//  - o GitHub, logo depois que a Vercel termina o deploy (.github/workflows/aviso-atualizacao.yml);
//  - e, de reserva, o próprio site: a primeira pessoa que abre a versão nova chama esta rota.
// Cada versão (commit) avisa UMA vez só: o banco guarda as versões já avisadas.
// Para subir uma correção sem avisar ninguém, coloque [sem aviso] na mensagem do commit.
//
// Segurança: a rota é pública, mas só consegue avisar a versão que está no ar, uma vez.
// A lista de aparelhos só sai do banco com a senha AVISO_SEGREDO (só no servidor).
import { notificacoesAtivas, problemaChaves, lerChave } from './notificar.mjs';

export const TEXTO_ATUALIZACAO = {
  titulo: 'Nosso Cantinho',
  corpo: 'Hey, chegou uma atualização nova no cantinho! Venha ver!',
};

/** Versão no ar: o commit (assim um "Redeploy" do mesmo código não avisa de novo). */
export function versaoNoAr(env = process.env) {
  const v = String(env.VERCEL_GIT_COMMIT_SHA || env.VERCEL_DEPLOYMENT_ID || env.VERSAO_SITE || '').trim();
  return /^[A-Za-z0-9_.-]{1,100}$/.test(v) ? v : '';
}

let webpushPadrao = null;
async function carregarWebPush() {
  if (!webpushPadrao) webpushPadrao = (await import('web-push')).default;
  return webpushPadrao;
}

/** @returns {Promise<{status:number, corpo:object}>} */
export async function avisarAtualizacao(dados = {}, env = process.env, deps = {}) {
  const buscar = deps.fetch || fetch;
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production') return { status: 200, corpo: { enviadas: 0, motivo: 'nao-e-producao' } };
  if (!notificacoesAtivas(env)) {
    const p = problemaChaves(env);
    return { status: 503, corpo: { erro: p && p !== 'faltam' ? p : 'As notificações ainda não foram configuradas no servidor (chaves VAPID).' } };
  }
  const segredo = lerChave(env.AVISO_SEGREDO, 'AVISO_SEGREDO');
  if (!segredo) return { status: 503, corpo: { erro: 'Falta a variável AVISO_SEGREDO (rode "npm run segredo-aviso").' } };

  const versao = versaoNoAr(env);
  if (!versao) return { status: 200, corpo: { enviadas: 0, motivo: 'sem-versao' } };

  // O GitHub manda o commit que acabou de subir: se o site ainda está com o antigo, tenta de novo depois
  const sha = typeof dados.sha === 'string' && /^[0-9a-f]{7,40}$/i.test(dados.sha) ? dados.sha.toLowerCase() : '';
  const shaNoAr = String(env.VERCEL_GIT_COMMIT_SHA || '').toLowerCase();
  if (sha && shaNoAr && !shaNoAr.startsWith(sha) && !sha.startsWith(shaNoAr)) {
    return { status: 409, corpo: { enviadas: 0, motivo: 'versao-ainda-nao-esta-no-ar' } };
  }
  if (/\[sem aviso\]/i.test(String(env.VERCEL_GIT_COMMIT_MESSAGE || ''))) {
    return { status: 200, corpo: { enviadas: 0, motivo: 'sem-aviso' } };
  }

  const base = env.SUPABASE_URL.trim().replace(/\/+$/, '');
  const anon = env.SUPABASE_ANON_KEY.trim();
  const cab = { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' };
  const r = await buscar(`${base}/rest/v1/rpc/aviso_atualizacao`, { method: 'POST', headers: cab, body: JSON.stringify({ segredo, versao }) });
  if (!r.ok) {
    const texto = await r.text().catch(() => '');
    if (/aviso_atualizacao/.test(texto) && /(find|exist)/i.test(texto)) return { status: 500, corpo: { erro: 'Falta rodar o arquivo supabase/aviso-atualizacao.sql no Supabase.' } };
    if (/segredo/i.test(texto)) return { status: 500, corpo: { erro: 'A AVISO_SEGREDO da Vercel não bate com a do Supabase. Rode "npm run segredo-aviso" de novo e troque nos dois lugares.' } };
    return { status: 502, corpo: { erro: 'Não foi possível ler os aparelhos cadastrados.' } };
  }
  const resultado = await r.json();
  if (resultado?.ja_enviado) return { status: 200, corpo: { enviadas: 0, motivo: 'ja-avisado', versao } };
  const inscricoes = Array.isArray(resultado?.inscricoes) ? resultado.inscricoes : [];

  const webpush = deps.webpush || await carregarWebPush();
  const payload = JSON.stringify({ ...TEXTO_ATUALIZACAO, url: '/', tag: 'atualizacao' });
  const opcoes = {
    TTL: 60 * 60 * 24 * 3,
    urgency: 'normal',
    vapidDetails: {
      subject: lerChave(env.VAPID_SUBJECT, 'VAPID_SUBJECT') || 'https://nossocantinho.app',
      publicKey: lerChave(env.VAPID_PUBLIC_KEY, 'VAPID_PUBLIC_KEY'),
      privateKey: lerChave(env.VAPID_PRIVATE_KEY, 'VAPID_PRIVATE_KEY'),
    },
  };
  let enviadas = 0;
  const vencidas = [];
  await Promise.all(inscricoes.map(async (i) => {
    try {
      await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, payload, opcoes);
      enviadas += 1;
    } catch (e) {
      if (e?.statusCode === 404 || e?.statusCode === 410) vencidas.push(i.endpoint);
      else console.warn('[aviso-atualizacao] falha ao enviar:', e?.statusCode || '', e?.body || e?.message || e);
    }
  }));
  if (vencidas.length) {
    await buscar(`${base}/rest/v1/rpc/aviso_atualizacao_limpar`, { method: 'POST', headers: cab, body: JSON.stringify({ segredo, enderecos: vencidas }) }).catch(() => {});
  }
  return { status: 200, corpo: { enviadas, removidas: vencidas.length, versao } };
}
