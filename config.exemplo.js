/*
 * Configuração PÚBLICA do Nosso Cantinho.
 *
 * MODELO. Com `npm start` (servidor-local.mjs) ou na Vercel (api/config.js + vercel.json), o
 * /config.js é gerado automaticamente a partir das variáveis de ambiente — não precisa deste arquivo.
 *
 * Só em outra hospedagem puramente estática: copie este arquivo para `config.js` e preencha:
 *   - supabaseUrl e supabaseAnonKey: são públicos por natureza (a segurança vem das políticas RLS).
 *   - NUNCA coloque aqui a chave service_role do Supabase nem a chave da API do TMDB.
 *   - tmdbProxy só deve ser true se existir um backend respondendo em /api/tmdb/search.
 */
window.NOSSO_CANTINHO_CONFIG = {
  supabaseUrl: "",
  supabaseAnonKey: "",
  tmdbProxy: false,
  // Domínio do "e-mail interno" usado no login por nome (kath → kath@nossocantinho.app)
  loginDominio: "nossocantinho.app"
};
