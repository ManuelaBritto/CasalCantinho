// Gera a senha do aviso "chegou uma atualização nova". Rode uma vez:  npm run segredo-aviso
// A senha vai SÓ para a Vercel. O Supabase guarda apenas o resumo (sha256) dela.
import { randomBytes, createHash } from 'node:crypto';

const segredo = randomBytes(32).toString('base64url');
const hash = createHash('sha256').update(segredo).digest('hex');

console.log(`
Senha do aviso de atualização gerada.

1. Na Vercel (Settings > Environment Variables), adicione:

AVISO_SEGREDO=${segredo}

   (nome: AVISO_SEGREDO · valor: o que vem depois do "=") e faça Redeploy.

2. No Supabase (SQL Editor), depois de rodar supabase/aviso-atualizacao.sql, rode esta linha:

insert into privado.segredos (nome, hash) values ('aviso-atualizacao', '${hash}') on conflict (nome) do update set hash = excluded.hash;

Guarde a senha só na Vercel (e no .env, se for testar localmente). Nunca no GitHub.
Se gerar de novo, troque nos dois lugares.
`);
