// Lembretes do calendário e cartinhas agendadas: manda as notificações que chegaram na hora.
// Usada por api/lembretes.js (Vercel) e pelo servidor-local.mjs.
//
// Quem chama: o próprio Supabase, a cada 5 minutos (supabase/agendar-lembretes.sql),
// e, de reserva, o site quando alguém abre. O banco devolve cada lembrete UMA vez só,
// então chamar a mais não repete notificação. A lista só sai do banco com a senha
// AVISO_SEGREDO (a mesma do aviso de atualização), que fica só no servidor.
import { notificacoesAtivas, problemaChaves, lerChave } from './notificar.mjs';
import { textoEngajamento } from './engajamento.mjs';

const EMOJI = { namoro: '💕', aniversario: '🎂', viagem: '✈️', compromisso: '📌', outro: '📅' };

/** Texto da notificação de cada lembrete. */
export function textoLembrete(l) {
  if (l.tipo === 'carta') {
    return { titulo: `Chegou uma cartinha de ${l.de_nome || 'quem te ama'}`, corpo: 'Toque para abrir o envelope.', url: `/?cantinho=${l.casal}#/cartinhas?abrir=${l.id}`, tag: `carta-${String(l.id).slice(0, 8)}` };
  }
  const emoji = EMOJI[l.tipo_evento] || EMOJI.outro;
  const quando = l.quando === 'vespera' ? 'Amanhã' : 'Hoje';
  let titulo = `${quando}: ${l.titulo} ${emoji}`;
  if (l.tipo_evento === 'namoro') titulo = `${quando} é o aniversário de vocês! ${emoji}`;
  const partes = [];
  if (l.tipo_evento === 'namoro' && l.anos > 0) partes.push(`${l.anos} ${l.anos === 1 ? 'ano' : 'anos'} juntos`);
  else if (l.tipo_evento === 'namoro' && l.meses > 0) partes.push(`${l.meses} ${l.meses === 1 ? 'mês' : 'meses'} juntos`);
  else if (l.tipo_evento === 'aniversario' && l.anos > 0) partes.push(`${l.anos} ${l.anos === 1 ? 'ano' : 'anos'}`);
  if (l.tipo_evento === 'namoro' && l.titulo && !/anivers/i.test(l.titulo)) partes.unshift(l.titulo);
  if (l.hora) partes.push(`às ${l.hora}`);
  return { titulo, corpo: partes.join(' · ') || 'Toque para ver o calendário.', url: `/?cantinho=${l.casal}#/calendario`, tag: `evento-${String(l.id).slice(0, 8)}` };
}

let webpushPadrao = null;
async function carregarWebPush() {
  if (!webpushPadrao) webpushPadrao = (await import('web-push')).default;
  return webpushPadrao;
}

/** @returns {Promise<{status:number, corpo:object}>} */
export async function enviarLembretes(env = process.env, deps = {}) {
  const buscar = deps.fetch || fetch;
  if (env.VERCEL_ENV && env.VERCEL_ENV !== 'production') return { status: 200, corpo: { enviadas: 0, motivo: 'nao-e-producao' } };
  if (!notificacoesAtivas(env)) {
    const p = problemaChaves(env);
    return { status: 503, corpo: { erro: p && p !== 'faltam' ? p : 'As notificações ainda não foram configuradas no servidor (chaves VAPID).' } };
  }
  const segredo = lerChave(env.AVISO_SEGREDO, 'AVISO_SEGREDO');
  if (!segredo) return { status: 503, corpo: { erro: 'Falta a variável AVISO_SEGREDO (rode "npm run segredo-aviso").' } };

  const base = env.SUPABASE_URL.trim().replace(/\/+$/, '');
  const anon = env.SUPABASE_ANON_KEY.trim();
  const cab = { apikey: anon, Authorization: `Bearer ${anon}`, 'Content-Type': 'application/json' };
  const r = await buscar(`${base}/rest/v1/rpc/lembretes_pendentes`, { method: 'POST', headers: cab, body: JSON.stringify({ segredo }) });
  if (!r.ok) {
    const texto = await r.text().catch(() => '');
    if (/lembretes_pendentes/.test(texto) && /(find|exist)/i.test(texto)) return { status: 500, corpo: { erro: 'Falta rodar o arquivo supabase/calendario.sql no Supabase.' } };
    if (/aviso-atualizacao\.sql/.test(texto)) return { status: 500, corpo: { erro: 'Falta rodar o arquivo supabase/aviso-atualizacao.sql no Supabase.' } };
    if (/segredo/i.test(texto)) return { status: 500, corpo: { erro: 'A AVISO_SEGREDO da Vercel não bate com a do Supabase.' } };
    return { status: 502, corpo: { erro: 'Não foi possível buscar os lembretes.' } };
  }
  const lembretes = (await r.json()) || [];

  // Lembretes do cantinho (engajamento): se o SQL ainda não foi rodado, só pula
  let engajamento = [];
  try {
    const re = await buscar(`${base}/rest/v1/rpc/engajamento_pendente`, { method: 'POST', headers: cab, body: JSON.stringify({ segredo }) });
    if (re.ok) engajamento = (await re.json()) || [];
    else if (!/engajamento_pendente/.test(await re.text().catch(() => ''))) console.warn('[lembretes] engajamento: falhou');
  } catch (e) { console.warn('[lembretes] engajamento:', e?.message || e); }

  const envios = [
    ...(Array.isArray(lembretes) ? lembretes : []).map((l) => ({ texto: textoLembrete(l), inscricoes: l.inscricoes })),
    ...(Array.isArray(engajamento) ? engajamento : []).map((l) => ({ texto: textoEngajamento(l), inscricoes: l.inscricoes })).filter((e) => e.texto),
  ];
  if (!envios.length) return { status: 200, corpo: { lembretes: 0, engajamento: 0, enviadas: 0 } };

  const webpush = deps.webpush || await carregarWebPush();
  const opcoes = {
    TTL: 60 * 60 * 24,
    urgency: 'high',
    vapidDetails: {
      subject: lerChave(env.VAPID_SUBJECT, 'VAPID_SUBJECT') || 'https://nossocantinho.app',
      publicKey: lerChave(env.VAPID_PUBLIC_KEY, 'VAPID_PUBLIC_KEY'),
      privateKey: lerChave(env.VAPID_PRIVATE_KEY, 'VAPID_PRIVATE_KEY'),
    },
  };
  let enviadas = 0;
  const vencidas = new Set();
  await Promise.all(envios.flatMap((l) => {
    const payload = JSON.stringify(l.texto);
    return (l.inscricoes || []).map(async (i) => {
      try {
        await webpush.sendNotification({ endpoint: i.endpoint, keys: { p256dh: i.p256dh, auth: i.auth } }, payload, opcoes);
        enviadas += 1;
      } catch (e) {
        if (e?.statusCode === 404 || e?.statusCode === 410) vencidas.add(i.endpoint);
        else console.warn('[lembretes] falha ao enviar:', e?.statusCode || '', e?.body || e?.message || e);
      }
    });
  }));
  if (vencidas.size) {
    await buscar(`${base}/rest/v1/rpc/aviso_atualizacao_limpar`, { method: 'POST', headers: cab, body: JSON.stringify({ segredo, enderecos: [...vencidas] }) }).catch(() => {});
  }
  return { status: 200, corpo: { lembretes: Array.isArray(lembretes) ? lembretes.length : 0, engajamento: engajamento.length || 0, enviadas, removidas: vencidas.size } };
}
