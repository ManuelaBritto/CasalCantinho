// Envia notificações (Web Push) para os aparelhos do outro perfil.
// Usada por api/notificar.js (Vercel) e pelo servidor-local.mjs.
//
// Segurança:
//  - Quem chama precisa mandar o token de login do Supabase (Authorization: Bearer ...).
//  - As consultas ao banco usam ESSE token, então as regras de acesso (RLS) valem:
//    só dá para ler os aparelhos do próprio casal. Nenhuma chave secreta do Supabase é usada.
//  - O destinatário é sempre o outro perfil (ou você mesmo, no teste). O texto é limitado.
//  - A chave privada VAPID fica só nas variáveis de ambiente do servidor.

/** Lê uma chave tirando espaços, aspas e o "NOME=" que às vezes vêm junto ao colar na Vercel. */
export function lerChave(valor, nome) {
  return String(valor || '').trim()
    .replace(new RegExp(`^${nome}\\s*=\\s*`), '')
    .replace(/^["'\s]+|["'\s]+$/g, '');
}

const bytesB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/**
 * Confere o formato das chaves VAPID. Devolve '' se estiverem certas, 'faltam' se não
 * foram configuradas, ou um texto explicando o que está errado.
 */
export function problemaChaves(env = process.env) {
  const pub = lerChave(env.VAPID_PUBLIC_KEY, 'VAPID_PUBLIC_KEY');
  const priv = lerChave(env.VAPID_PRIVATE_KEY, 'VAPID_PRIVATE_KEY');
  if (!pub || !priv) return 'faltam';
  const dica = 'Rode "npm run chaves" de novo e copie só o que vem DEPOIS do "=" de cada linha, sem aspas.';
  if (!/^[A-Za-z0-9_-]+$/.test(pub) || bytesB64url(pub).length !== 65 || bytesB64url(pub)[0] !== 4) {
    return `A VAPID_PUBLIC_KEY na Vercel está errada: tem ${pub.length} caracteres, e a certa tem 87 e começa com "B"${pub.length === 43 ? ' (parece que é a chave privada)' : ''}. ${dica}`;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(priv) || bytesB64url(priv).length !== 32) {
    return `A VAPID_PRIVATE_KEY na Vercel está errada: tem ${priv.length} caracteres, e a certa tem 43${priv.length === 87 ? ' (parece que é a chave pública)' : ''}. ${dica}`;
  }
  return '';
}

export function notificacoesAtivas(env = process.env) {
  return Boolean(
    problemaChaves(env) === ''
    && (env.SUPABASE_URL || '').trim() && (env.SUPABASE_ANON_KEY || '').trim(),
  );
}

const limpar = (t, max) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, max);

/** Normaliza o pedido vindo do navegador. */
export function prepararMensagem(dados = {}) {
  const url = typeof dados.url === 'string' && /^\/(#\/[\w\-/?=&%.]*)?$/.test(dados.url) ? dados.url : '/';
  const tag = typeof dados.tag === 'string' && /^[a-z0-9-]{1,40}$/i.test(dados.tag) ? dados.tag : undefined;
  return {
    titulo: limpar(dados.titulo, 80) || 'Nosso Cantinho',
    corpo: limpar(dados.corpo, 180),
    url,
    tag,
    paraMim: dados.paraMim === true,
    casal: typeof dados.casal === 'string' && /^[0-9a-f-]{36}$/i.test(dados.casal) ? dados.casal : '',
  };
}

let webpushPadrao = null;
async function carregarWebPush() {
  if (!webpushPadrao) webpushPadrao = (await import('web-push')).default;
  return webpushPadrao;
}

/**
 * @returns {Promise<{status:number, corpo:object}>}
 */
export async function enviarNotificacao({ token, dados }, env = process.env, deps = {}) {
  const buscar = deps.fetch || fetch;
  if (!notificacoesAtivas(env)) {
    const problema = problemaChaves(env);
    return { status: 503, corpo: { erro: problema && problema !== 'faltam' ? problema : 'As notificações ainda não foram configuradas no servidor (chaves VAPID).' } };
  }
  if (!token) return { status: 401, corpo: { erro: 'Entre na sua conta para enviar notificações.' } };

  const base = env.SUPABASE_URL.trim().replace(/\/+$/, '');
  const cab = { apikey: env.SUPABASE_ANON_KEY.trim(), Authorization: `Bearer ${token}` };

  // 1. Quem está pedindo
  const rUser = await buscar(`${base}/auth/v1/user`, { headers: cab });
  if (!rUser.ok) return { status: 401, corpo: { erro: 'Sessão inválida ou expirada. Entre de novo.' } };
  const usuario = await rUser.json();
  if (!usuario?.id) return { status: 401, corpo: { erro: 'Sessão inválida.' } };

  // As regras do banco só devolvem os perfis do casal de quem pediu
  const rPerfis = await buscar(`${base}/rest/v1/perfis?select=user_id,nome,casal_id`, { headers: cab });
  const perfis = rPerfis.ok ? await rPerfis.json() : [];
  const msg = prepararMensagem(dados);
  // Quem tem mais de um casal informa de qual cantinho está falando
  const meus = Array.isArray(perfis) ? perfis.filter((p) => p.user_id === usuario.id) : [];
  const perfil = meus.find((p) => p.casal_id === msg.casal) || meus[0];
  if (!perfil) return { status: 403, corpo: { erro: 'Esta conta não está vinculada a um casal.' } };

  // 2. Para quem vai (a outra pessoa do MESMO casal)
  const para = msg.paraMim ? perfil.nome : perfis.find((p) => p.casal_id === perfil.casal_id && p.user_id !== usuario.id)?.nome;
  if (!para) return { status: 200, corpo: { enviadas: 0, removidas: 0, motivo: 'sem-aparelho' } };
  const rIns = await buscar(`${base}/rest/v1/push_inscricoes?select=id,endpoint,p256dh,auth&casal_id=eq.${encodeURIComponent(perfil.casal_id)}&perfil=eq.${encodeURIComponent(para)}`, { headers: cab });
  if (!rIns.ok) {
    const texto = await rIns.text().catch(() => '');
    if (/push_inscricoes/.test(texto) && /exist|find/i.test(texto)) return { status: 500, corpo: { erro: 'Falta rodar o arquivo supabase/notificacoes.sql no Supabase.' } };
    return { status: 502, corpo: { erro: 'Não foi possível ler os aparelhos cadastrados.' } };
  }
  const inscricoes = await rIns.json();
  if (!inscricoes.length) return { status: 200, corpo: { enviadas: 0, removidas: 0, motivo: 'sem-aparelho' } };

  // 3. Envia para cada aparelho
  const webpush = deps.webpush || await carregarWebPush();
  // O link abre o cantinho certo (importa para quem participa de mais de um casal)
  const url = `/?cantinho=${perfil.casal_id}${msg.url.slice(1)}`;
  const payload = JSON.stringify({ titulo: msg.titulo, corpo: msg.corpo, url, tag: msg.tag && `${msg.tag}-${String(perfil.casal_id).slice(0, 8)}`, de: perfil.nome });
  const opcoes = {
    TTL: 60 * 60 * 24 * 2,
    urgency: 'high',
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
      // 404/410: o aparelho desativou ou desinstalou → remove do banco
      if (e?.statusCode === 404 || e?.statusCode === 410) vencidas.push(i.id);
      else console.warn('[notificar] falha ao enviar:', e?.statusCode || '', e?.body || e?.message || e);
    }
  }));
  if (vencidas.length) {
    await buscar(`${base}/rest/v1/push_inscricoes?id=in.(${vencidas.join(',')})`, { method: 'DELETE', headers: cab }).catch(() => {});
  }
  return { status: 200, corpo: { enviadas, removidas: vencidas.length } };
}
