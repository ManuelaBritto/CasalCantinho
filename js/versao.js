// Avisa quando sai uma versão nova do site enquanto a página está aberta.
// Sem isso, quem deixa o site aberto (ou o app instalado) continua com o código antigo
// até recarregar. A versão vem de /config.js, que muda a cada deploy na Vercel.
import { config } from './config.js';
import { toast } from './ui/dom.js';

const INTERVALO = 3 * 60 * 1000;
const MINIMO_ENTRE_CONFERENCIAS = 60 * 1000;

export function lerVersao(textoConfig) {
  return String(textoConfig || '').match(/"versao":\s*"([^"]*)"/)?.[1] || '';
}

export function vigiarVersao() {
  const minha = config.versao;
  if (!minha) return () => {};
  let avisado = false;
  let ultima = Date.now();

  async function conferir() {
    if (avisado || document.visibilityState !== 'visible' || Date.now() - ultima < MINIMO_ENTRE_CONFERENCIAS) return;
    ultima = Date.now();
    try {
      const resposta = await fetch('config.js', { cache: 'no-store' });
      if (!resposta.ok) return;
      const nova = lerVersao(await resposta.text());
      if (!nova || nova === minha) return;
      avisado = true;
      toast('Saiu uma versão nova do site.', 'info', { acao: { texto: 'Atualizar', executar: () => location.reload() }, duracao: Infinity });
    } catch { /* sem internet: confere de novo depois */ }
  }

  const timer = setInterval(conferir, INTERVALO);
  document.addEventListener('visibilitychange', conferir);
  return () => { clearInterval(timer); document.removeEventListener('visibilitychange', conferir); };
}

/**
 * Reserva do aviso "chegou uma atualização nova": a primeira visita a uma versão nova
 * pede ao servidor para avisar todo mundo. O servidor só avisa uma vez por versão
 * (o normal é o GitHub já ter avisado logo depois do deploy; aí ele só responde "já avisado").
 */
export function pedirAvisoDeVersaoNova() {
  const versao = config.versao;
  if (!versao || !config.notificacoes) return;
  try {
    if (localStorage.getItem('nc:aviso-versao') === versao) return;
    localStorage.setItem('nc:aviso-versao', versao);
  } catch { return; }
  fetch('/api/avisar-atualizacao', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}', keepalive: true }).catch(() => {});
}
