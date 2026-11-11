// Service worker do Nosso Cantinho.
// Só cuida de notificações (push) e de abrir o site ao tocar nelas.
// Não guarda páginas em cache: cada deploy novo aparece na hora.

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (evento) => evento.waitUntil(self.clients.claim()));

self.addEventListener('push', (evento) => {
  let dados = {};
  try { dados = evento.data ? evento.data.json() : {}; } catch { dados = { corpo: evento.data ? evento.data.text() : '' }; }
  const titulo = dados.titulo || 'Nosso Cantinho';
  evento.waitUntil(self.registration.showNotification(titulo, {
    body: dados.corpo || '',
    icon: '/assets/icones/icone-192.png',
    badge: '/assets/icones/badge-96.png',
    tag: dados.tag || undefined,
    renotify: Boolean(dados.tag),
    lang: 'pt-BR',
    data: { url: dados.url || '/' },
  }));
});

self.addEventListener('notificationclick', (evento) => {
  evento.notification.close();
  const destino = new URL(evento.notification.data?.url || '/', self.location.origin);
  evento.waitUntil((async () => {
    const janelas = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const aberta = janelas.find((j) => new URL(j.url).origin === self.location.origin);
    if (aberta) {
      // Site já aberto: só troca a página (sem recarregar)
      aberta.postMessage({ tipo: 'nc:abrir', hash: destino.hash || '#/inicio', cantinho: destino.searchParams.get('cantinho') || '', origem: destino.searchParams.get('origem') || '' });
      try { await aberta.focus(); } catch { /* alguns sistemas não deixam focar */ }
      return;
    }
    await self.clients.openWindow(destino.href);
  })());
});
