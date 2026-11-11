// "Lembretes do cantinho" (avisos para o casal voltar ao app) — lado do site:
//  - anota que a pessoa abriu o site hoje (o servidor usa para não mandar "volta pra cá" à toa);
//  - conta quando alguém abre o site tocando num desses avisos (para medir o que funciona);
//  - painel em Aparência para ligar/desligar cada tipo.
// Quem decide quando mandar é o banco (supabase/engajamento.sql).
import { modoAuth, clienteSupabase, PERFIS } from './auth.js';
import { hojeBrasilia } from './jogos/regras.js';
import { esc, toast } from './ui/dom.js';
import { icone } from './ui/icones.js';

export const TIPOS_LEMBRETE = [
  ['marcos', 'Datas especiais do namoro', '500 dias juntos, mêsversário…'],
  ['nesse_dia', 'Nesse dia', 'cartinhas e memórias de anos atrás, no mesmo dia'],
  ['pergunta', 'Pergunta do dia', 'e um toque quando {outro} já respondeu'],
  ['vez', 'Sua vez num jogo parado', 'jogo da velha ou forca esperando há mais de 1 dia'],
  ['cinema', 'Sexta de cinema', 'um filme da lista de vocês'],
  ['resumo', 'Resumo da semana', 'no domingo, o que vocês fizeram'],
  ['saudade', 'Quando você some por uns dias', 'no máximo 1 por semana'],
];
const ORIGENS = new Set([...TIPOS_LEMBRETE.map(([t]) => t), 'falta_voce']);
const CHAVE_ORIGEM = 'nc:origem-push';

const usaBanco = (perfil) => modoAuth() === 'supabase' && Boolean(clienteSupabase()) && Boolean(perfil?.casalId);

/** Guarda de qual aviso a pessoa veio (?origem=…), antes de a URL ser limpa. */
export function guardarOrigemDaUrl() {
  const origem = new URLSearchParams(location.search).get('origem');
  if (origem && ORIGENS.has(origem)) { try { sessionStorage.setItem(CHAVE_ORIGEM, origem); } catch { /* ignora */ } }
}

/** Conta a abertura de um aviso (uma vez por tipo, por pessoa, por dia: o banco garante). */
export async function registrarAbertura(perfil, origem) {
  if (!ORIGENS.has(origem) || !usaBanco(perfil)) return;
  try { await clienteSupabase().rpc('registrar_abertura_push', { p_casal: perfil.casalId, p_tipo: origem }); } catch { /* não atrapalha o uso */ }
}

/** Chamado ao entrar no app: anota a visita do dia e a origem, se veio de um aviso. */
export function registrarVisita(perfil) {
  if (!usaBanco(perfil)) return () => {};
  const chave = `nc:visto:${perfil.casalId}`;
  const marcar = async () => {
    if (document.visibilityState !== 'visible') return;
    const hoje = hojeBrasilia();
    try { if (localStorage.getItem(chave) === hoje) return; } catch { /* segue */ }
    const { error } = await clienteSupabase().rpc('marcar_visto', { p_casal: perfil.casalId });
    if (!error) { try { localStorage.setItem(chave, hoje); } catch { /* ignora */ } }
  };
  marcar();
  let origem = null;
  try { origem = sessionStorage.getItem(CHAVE_ORIGEM); sessionStorage.removeItem(CHAVE_ORIGEM); } catch { /* ignora */ }
  if (origem) registrarAbertura(perfil, origem);
  // O app pode ficar aberto de um dia para o outro (celular): confere ao voltar para a tela
  document.addEventListener('visibilitychange', marcar);
  return () => document.removeEventListener('visibilitychange', marcar);
}

/** Painel "Lembretes do cantinho" (Aparência). */
export async function montarPainelLembretes(alvo, perfil) {
  if (!alvo) return;
  const outro = Object.values(PERFIS).find((p) => p.id !== perfil.id)?.nome || 'seu amor';
  const desenhar = (prefs, { desativado = false, aviso = '' } = {}) => {
    alvo.innerHTML = `
      <h3 class="subtitulo-pequeno">${icone('megafone')} Lembretes do cantinho</h3>
      <p class="dica">Avisos para vocês não esquecerem do cantinho: até 2 por dia, nunca entre 22h e 8h.
        Os de cartinha, jogo e calendário continuam chegando sempre.</p>
      ${aviso ? `<div class="aviso">${icone('info')}<p>${aviso}</p></div>` : ''}
      <fieldset ${desativado ? 'disabled' : ''}>
        <legend class="sr-only">Quais lembretes receber</legend>
        <div class="opcoes coluna lembretes-opcoes">
          ${TIPOS_LEMBRETE.map(([id, nome, desc]) => `
            <label class="opcao"><input type="checkbox" name="lembrete" value="${id}" ${prefs[id] === false ? '' : 'checked'}>
              <span><strong>${esc(nome)}</strong> <small>${esc(desc.replace('{outro}', outro))}</small></span></label>`).join('')}
        </div>
      </fieldset>`;
  };
  if (!usaBanco(perfil)) {
    desenhar({}, { desativado: true, aviso: 'No modo demonstração os lembretes ficam desligados: eles precisam do login real (Supabase).' });
    return;
  }
  const cliente = clienteSupabase();
  const { data, error } = await cliente.from('perfis').select('prefs_push').eq('user_id', perfil.userId).eq('casal_id', perfil.casalId).maybeSingle();
  if (error) {
    desenhar({}, { desativado: true, aviso: /prefs_push/.test(error.message || '') ? 'Falta rodar o arquivo supabase/engajamento.sql no Supabase.' : 'Não foi possível carregar suas preferências agora.' });
    return;
  }
  let prefs = data?.prefs_push || {};
  desenhar(prefs);
  alvo.addEventListener('change', async (e) => {
    const caixa = e.target;
    if (caixa.name !== 'lembrete') return;
    const { data: salvas, error: erro } = await cliente.rpc('salvar_prefs_push', { p_casal: perfil.casalId, p_prefs: { [caixa.value]: caixa.checked } });
    if (erro) {
      caixa.checked = !caixa.checked;
      toast('Não foi possível salvar agora. Tente de novo.', 'erro');
      return;
    }
    prefs = salvas || { ...prefs, [caixa.value]: caixa.checked };
    toast(caixa.checked ? 'Lembrete ligado.' : 'Lembrete desligado.', 'sucesso', { duracao: 1800 });
  });
}
