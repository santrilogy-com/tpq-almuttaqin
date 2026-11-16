// Service worker: hanya menyimpan berkas statis aplikasi (JS/CSS berhash) dan cangkang halaman agar
// aplikasi terbuka saat sinyal buruk. Seluruh /api/* TIDAK PERNAH disimpan (data santri selalu dari server,
// dan tidak ada data pribadi tertinggal di cache perangkat bersama).
const VERSI = 'v1'
const CACHE = `tpq-statis-${VERSI}`

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      for (const k of await caches.keys()) if (k.startsWith('tpq-') && k !== CACHE) await caches.delete(k)
      await self.clients.claim()
    })()
  )
})

self.addEventListener('fetch', (e) => {
  const r = e.request
  if (r.method !== 'GET') return
  const u = new URL(r.url)
  if (u.origin !== location.origin || u.pathname.startsWith('/api/')) return

  // Berkas berhash: cache-first (isi tidak pernah berubah untuk nama yang sama).
  if (u.pathname.startsWith('/assets/')) {
    e.respondWith(
      caches.open(CACHE).then(async (c) => {
        const ada = await c.match(r)
        if (ada) return ada
        const res = await fetch(r)
        if (res.ok) c.put(r, res.clone())
        return res
      })
    )
    return
  }

  // Navigasi: jaringan dulu supaya selalu versi terbaru; jatuh ke cangkang tersimpan bila offline.
  if (r.mode === 'navigate') {
    e.respondWith(
      fetch(r)
        .then((res) => {
          if (res.ok) {
            const salin = res.clone()
            caches.open(CACHE).then((c) => c.put('/index.html', salin))
          }
          return res
        })
        .catch(async () => (await caches.match('/index.html')) ?? new Response('Tidak ada koneksi', { status: 503 }))
    )
  }
})
