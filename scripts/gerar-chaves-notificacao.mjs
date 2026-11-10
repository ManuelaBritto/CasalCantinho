// Gera o par de chaves das notificações (VAPID). Rode uma vez:  npm run chaves
// Copie as linhas mostradas para o .env (local) e para as Environment Variables da Vercel.
// A chave PRIVADA é secreta: nunca coloque no front-end nem no GitHub.
import { generateKeyPairSync } from 'node:crypto';

const b64url = (buf) => Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deB64url = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
const pub = publicKey.export({ format: 'jwk' });
const priv = privateKey.export({ format: 'jwk' });

// Chave pública no formato "não comprimido" (0x04 || X || Y), que o navegador espera
const publica = b64url(Buffer.concat([Buffer.from([4]), deB64url(pub.x), deB64url(pub.y)]));
const privada = priv.d;

const site = process.argv[2] || 'https://cantinho-red.vercel.app';

console.log(`
Chaves das notificações geradas. Copie estas 3 linhas:

VAPID_PUBLIC_KEY=${publica}
VAPID_PRIVATE_KEY=${privada}
VAPID_SUBJECT=${site}

1. Cole no arquivo .env (para testar localmente).
2. Na Vercel: Settings > Environment Variables > adicione as 3 (Production e Preview).
3. Faça um novo deploy (Deployments > ... > Redeploy).

Guarde a chave privada só nesses dois lugares. Se trocar as chaves, cada aparelho
precisa ativar as notificações de novo.
`);
