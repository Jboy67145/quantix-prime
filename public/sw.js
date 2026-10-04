self.addEventListener('push', (event) => {
  const fallback = { title: 'Quantix Prime', body: 'You have a new admin notification.', url: '/qx7-ops-4m9k2', important: true };
  let data = fallback;
  try { data = event.data ? { ...fallback, ...event.data.json() } : fallback } catch {}
  event.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: data.type || 'quantix-admin-important',
    renotify: true,
    requireInteraction: true,
    vibrate: [180, 90, 180, 90, 300],
    timestamp: Date.now(),
    data: { url: data.url || '/qx7-ops-4m9k2' },
  }))
})
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/qx7-ops-4m9k2'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((items) => {
      const existing = items.find((client) => 'focus' in client)
      if (existing) { existing.navigate(url); return existing.focus() }
      return clients.openWindow(url)
    })
  )
})
