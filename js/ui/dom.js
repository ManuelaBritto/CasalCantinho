// Utilitários de interface: escape de HTML, toasts, modais e confirmações.
import { icone } from './icones.js';

export function esc(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function gerarId() {
  if (globalThis.crypto?.randomUUID) return crypto.randomUUID();
  return 'id-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

export function hojeISO() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Formata "2026-10-31" ou ISO completo para "31 de out. de 2026". */
export function formatarData(valor, opcoes = { day: 'numeric', month: 'short', year: 'numeric' }) {
  if (!valor) return '';
  const somenteData = /^\d{4}-\d{2}-\d{2}$/.test(valor);
  const d = somenteData ? new Date(`${valor}T12:00:00`) : new Date(valor);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', opcoes);
}

export const seloExemplo = (texto = 'Exemplo') => `<span class="selo-exemplo" title="Conteúdo demonstrativo — pode editar ou excluir">${esc(texto)}</span>`;

// ---------- Toasts ----------
export function toast(mensagem, tipo = 'info', { acao, duracao = 4200 } = {}) {
  const area = document.getElementById('toasts');
  if (!area) return;
  // No máximo 3 avisos na tela: o mais antigo sai
  while (area.children.length >= 3) area.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = `toast ${tipo}`;
  el.setAttribute('role', tipo === 'erro' ? 'alert' : 'status');
  const nomeIcone = tipo === 'sucesso' ? 'check' : tipo === 'erro' ? 'alerta' : 'info';
  el.innerHTML = `${icone(nomeIcone)}<span>${esc(mensagem)}</span>`;
  if (acao) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'botao-sec pequeno';
    b.textContent = acao.texto;
    b.addEventListener('click', () => { acao.executar(); fechar(); });
    el.append(b);
  }
  const fecharBtn = document.createElement('button');
  fecharBtn.type = 'button';
  fecharBtn.className = 'botao-icone';
  fecharBtn.setAttribute('aria-label', 'Fechar aviso');
  fecharBtn.innerHTML = icone('fechar');
  fecharBtn.addEventListener('click', () => fechar());
  el.append(fecharBtn);
  area.append(el);
  let timer = setTimeout(fechar, acao ? duracao + 3000 : duracao);
  el.addEventListener('mouseenter', () => clearTimeout(timer));
  el.addEventListener('mouseleave', () => { timer = setTimeout(fechar, 2000); });
  function fechar() {
    clearTimeout(timer);
    el.classList.add('saindo');
    setTimeout(() => el.remove(), 260);
  }
}

// ---------- Modais (usando <dialog> nativo: foco preso e tecla Esc já inclusos) ----------
/**
 * abrirModal({ titulo, corpo, rodape, tamanho, aoAbrir, aoFechar })
 * Retorna { el, fechar }.
 */
export function abrirModal({ titulo, corpo = '', rodape = '', tamanho = '', aoAbrir, aoFechar, rotulo } = {}) {
  const dialog = document.createElement('dialog');
  dialog.className = `modal ${tamanho}`;
  const idTitulo = 'modal-titulo-' + Math.random().toString(36).slice(2, 8);
  if (titulo) dialog.setAttribute('aria-labelledby', idTitulo);
  else if (rotulo) dialog.setAttribute('aria-label', rotulo);
  dialog.innerHTML = `
    ${titulo ? `<div class="modal-topo"><h2 id="${idTitulo}">${esc(titulo)}</h2>
      <button type="button" class="botao-icone" data-fechar aria-label="Fechar">${icone('fechar')}</button></div>` : ''}
    <div class="modal-corpo">${corpo}</div>
    ${rodape ? `<div class="modal-rodape">${rodape}</div>` : ''}`;
  document.body.append(dialog);
  const anterior = document.activeElement;

  let fechado = false;
  const fechar = (resultado) => {
    if (fechado) return;
    fechado = true;
    if (dialog.open) dialog.close();
    dialog.remove();
    if (anterior && typeof anterior.focus === 'function' && document.contains(anterior)) anterior.focus();
    aoFechar?.(resultado);
  };
  dialog.addEventListener('click', (e) => {
    if (e.target.closest('[data-fechar]')) fechar();
    // clique fora do conteúdo (no backdrop)
    if (e.target === dialog) {
      const r = dialog.getBoundingClientRect();
      const dentro = e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
      if (!dentro) fechar();
    }
  });
  dialog.addEventListener('cancel', (e) => { e.preventDefault(); fechar(); });
  dialog.showModal();
  aoAbrir?.(dialog);
  return { el: dialog, fechar };
}

/** Confirmação antes de ações destrutivas. Retorna Promise<boolean>. */
export function confirmar({ titulo = 'Tem certeza?', mensagem = '', textoConfirmar = 'Excluir', perigo = true } = {}) {
  return new Promise((resolver) => {
    let resposta = false;
    const { el, fechar } = abrirModal({
      titulo,
      tamanho: 'pequeno',
      corpo: `<p>${esc(mensagem)}</p>`,
      rodape: `<button type="button" class="botao-fantasma" data-fechar>Cancelar</button>
               <button type="button" class="${perigo ? 'botao-perigo' : 'botao'}" data-confirmar>${esc(textoConfirmar)}</button>`,
      aoFechar: () => resolver(resposta),
    });
    el.querySelector('[data-confirmar]').addEventListener('click', () => { resposta = true; fechar(); });
    el.querySelector('[data-fechar].botao-fantasma')?.focus();
  });
}

/** Lê um formulário como objeto simples. */
export function lerFormulario(form) {
  const dados = {};
  for (const [k, v] of new FormData(form).entries()) dados[k] = typeof v === 'string' ? v.trim() : v;
  return dados;
}

export function marcarErro(campo, mensagem) {
  if (!campo) return;
  campo.setAttribute('aria-invalid', 'true');
  let msg = campo.parentElement.querySelector('.erro-campo');
  if (!msg) {
    msg = document.createElement('p');
    msg.className = 'erro-campo';
    msg.id = (campo.id || campo.name) + '-erro';
    campo.parentElement.append(msg);
  }
  msg.textContent = mensagem;
  campo.setAttribute('aria-describedby', msg.id);
  campo.focus();
  // Some o aviso assim que a pessoa corrigir o campo
  campo.addEventListener('input', () => {
    campo.removeAttribute('aria-invalid');
    campo.removeAttribute('aria-describedby');
    msg.remove();
  }, { once: true });
}

export function limparErros(form) {
  form.querySelectorAll('[aria-invalid]').forEach((c) => c.removeAttribute('aria-invalid'));
  form.querySelectorAll('.erro-campo').forEach((m) => m.remove());
}

export function normalizarTexto(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
}
