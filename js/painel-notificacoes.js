// Interface das notificações: painel em Aparência e o convite no Início.
import {
  estadoNotificacoes, ativarNotificacoes, desativarNotificacoes, testarNotificacao,
  ehIOS, ehAndroid, instalado, podeInstalarDireto, instalarApp,
} from './notificacoes.js';
import { PERFIS } from './auth.js';
import { config } from './config.js';
import { icone } from './ui/icones.js';
import { esc, toast } from './ui/dom.js';

const outroDe = (perfil) => Object.values(PERFIS).find((p) => p.id !== perfil.id);

export function htmlComoInstalar({ aberto = false } = {}) {
  const ios = ehIOS();
  const android = ehAndroid();
  const passosIos = `
    <ol>
      <li>Abra o site no <strong>Safari</strong>.</li>
      <li>Toque em <strong>Compartilhar</strong> (o quadrado com a seta para cima).</li>
      <li>Role e toque em <strong>Adicionar à Tela de Início</strong> e depois em <strong>Adicionar</strong>.</li>
      <li>Abra o <strong>Cantinho</strong> pelo ícone novo, entre na conta e ative as notificações em Aparência.</li>
    </ol>
    <p class="dica">Precisa do iOS 16.4 ou mais novo. No app instalado é preciso entrar na conta de novo (ele guarda os dados separado do Safari).</p>`;
  const passosAndroid = `
    <ol>
      <li>Abra o site no <strong>Chrome</strong>.</li>
      <li>Toque no menu <strong>⋮</strong> e em <strong>Instalar app</strong> (ou <strong>Adicionar à tela inicial</strong>).</li>
      <li>Abra o <strong>Cantinho</strong> pelo ícone. Segurando o ícone aparecem atalhos: Lembre de mim, Elogio, Cinema e Cartinhas.</li>
    </ol>
    <p class="dica">No Android as notificações também funcionam direto no Chrome, sem instalar.</p>`;
  return `
    <details class="como-instalar" ${aberto ? 'open' : ''}>
      <summary>${icone('info')} Como instalar o Cantinho no celular</summary>
      ${ios ? `<h3>iPhone / iPad</h3>${passosIos}` : android ? `<h3>Android</h3>${passosAndroid}` : `<h3>iPhone / iPad</h3>${passosIos}<h3>Android</h3>${passosAndroid}`}
    </details>`;
}

export function htmlEstado(estado, perfil) {
  const outro = outroDe(perfil);
  const instalar = !instalado() && podeInstalarDireto()
    ? `<button type="button" class="botao-sec" data-instalar>${icone('upload')} Instalar o app</button>` : '';
  switch (estado) {
    case 'demo':
      return `<div class="aviso">${icone('info')}<p>No modo demonstração as notificações ficam desligadas: elas precisam do login real (Supabase).</p></div>${instalar ? `<div class="grupo-botoes">${instalar}</div>` : ''}`;
    case 'sem-config':
      if (config.notificacoesErro) return `<div class="aviso erro" role="alert">${icone('alerta')}<p>${esc(config.notificacoesErro)}</p></div>`;
      return `<div class="aviso">${icone('info')}<p>As notificações ainda não foram configuradas no servidor. Quem cuida do site precisa gerar as chaves (<code>npm run chaves</code>) e colocar na Vercel — o passo a passo está no README.</p></div>${instalar ? `<div class="grupo-botoes">${instalar}</div>` : ''}`;
    case 'precisa-instalar':
      return `<div class="aviso">${icone('info')}<p>No iPhone, a Apple só libera notificações para sites <strong>adicionados à Tela de Início</strong> e abertos pelo ícone. Veja os passos abaixo.</p></div>`;
    case 'nao-suportado':
      return `<div class="aviso">${icone('alerta')}<p>Este navegador não aceita notificações de sites. Tente pelo Chrome (Android/computador) ou pelo app instalado (iPhone).</p></div>${instalar ? `<div class="grupo-botoes">${instalar}</div>` : ''}`;
    case 'negado':
      return `<div class="aviso erro">${icone('alerta')}<p>As notificações estão <strong>bloqueadas</strong> para este site. Libere nas configurações do navegador (ou do celular, em Notificações) e volte aqui.</p></div>`;
    case 'ativo':
      return `
        <p class="estado-notificacoes ativo">${icone('check')} <strong>Ativas neste aparelho.</strong> Você recebe um aviso quando ${esc(outro.nome)} te mandar cartinha, elogio ou lembrete.</p>
        <div class="grupo-botoes">
          <button type="button" class="botao-sec" data-testar-notificacao>${icone('sparkle')} Enviar um teste</button>
          <button type="button" class="botao-fantasma" data-desativar-notificacoes>Desativar neste aparelho</button>
          ${instalar}
        </div>`;
    default:
      return `
        <p class="estado-notificacoes">Receba um aviso quando ${esc(outro.nome)} te mandar cartinha, elogio ou lembrete, mesmo com o site fechado.</p>
        <div class="grupo-botoes">
          <button type="button" class="botao" data-ativar-notificacoes>${icone('coracao')} Ativar notificações</button>
          ${instalar}
        </div>`;
  }
}

async function acao(botao, fn) {
  botao.disabled = true;
  try { await fn(); } catch (e) { toast(e.message, 'erro', { duracao: 7000 }); } finally { if (botao.isConnected) botao.disabled = false; }
}

/** Painel completo (Aparência). */
export function montarPainelNotificacoes(alvo, perfil) {
  const desenhar = async () => {
    const estado = await estadoNotificacoes();
    if (!alvo.isConnected) return;
    alvo.innerHTML = `
      <div class="painel-notificacoes" data-estado="${estado}">
        <div data-notif-estado>${htmlEstado(estado, perfil)}</div>
        ${estado === 'demo' ? '' : htmlComoInstalar({ aberto: estado === 'precisa-instalar' })}
      </div>`;
  };

  alvo.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.hasAttribute('data-ativar-notificacoes')) {
      acao(b, async () => { await ativarNotificacoes(perfil); toast('Notificações ativadas neste aparelho!', 'sucesso'); await desenhar(); });
    } else if (b.hasAttribute('data-desativar-notificacoes')) {
      acao(b, async () => { await desativarNotificacoes(); toast('Notificações desativadas neste aparelho.', 'info'); await desenhar(); });
    } else if (b.hasAttribute('data-testar-notificacao')) {
      acao(b, async () => { await testarNotificacao(); toast('Teste enviado. Deve aparecer em instantes.', 'sucesso'); });
    } else if (b.hasAttribute('data-instalar')) {
      acao(b, async () => { if (await instalarApp()) toast('Cantinho instalado!', 'sucesso'); await desenhar(); });
    }
  });
  const redesenhar = () => desenhar();
  window.addEventListener('nc:instalacao-disponivel', redesenhar);
  desenhar();
  return () => window.removeEventListener('nc:instalacao-disponivel', redesenhar);
}

/** Convite discreto no Início (some quando ativa ou quando a pessoa dispensa). */
export async function montarDicaNotificacoes(alvo, perfil) {
  const chave = `nc:dica-notificacoes:${perfil.id}`;
  try { if (localStorage.getItem(chave)) return; } catch { /* ignora */ }
  const estado = await estadoNotificacoes();
  if (!alvo.isConnected || !['inativo', 'precisa-instalar'].includes(estado)) return;
  const outro = outroDe(perfil);
  alvo.innerHTML = `
    <aside class="dica-notificacoes cartao" aria-label="Notificações">
      <span class="dica-notificacoes-icone" aria-hidden="true">${icone('coracao', 'cheio')}</span>
      <div>
        <p><strong>Quer saber na hora quando ${esc(outro.nome)} te mandar algo?</strong></p>
        <p class="meta">${estado === 'precisa-instalar' ? 'No iPhone, primeiro adicione o Cantinho à Tela de Início.' : 'Ative as notificações neste aparelho.'}</p>
      </div>
      <div class="grupo-botoes">
        ${estado === 'precisa-instalar'
          ? `<a class="botao pequeno" href="#/aparencia">Ver como</a>`
          : `<button type="button" class="botao pequeno" data-ativar-dica>Ativar</button>`}
        <button type="button" class="botao-icone" data-fechar-dica aria-label="Agora não" title="Agora não">${icone('fechar')}</button>
      </div>
    </aside>`;
  alvo.querySelector('[data-fechar-dica]').addEventListener('click', () => {
    try { localStorage.setItem(chave, '1'); } catch { /* ignora */ }
    alvo.innerHTML = '';
  });
  alvo.querySelector('[data-ativar-dica]')?.addEventListener('click', (e) => acao(e.currentTarget, async () => {
    await ativarNotificacoes(perfil);
    toast('Notificações ativadas neste aparelho!', 'sucesso');
    alvo.innerHTML = '';
  }));
}
