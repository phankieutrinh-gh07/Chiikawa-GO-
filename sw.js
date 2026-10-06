/* Service worker – cho phép chơi Chiikawa GO! khi KHÔNG có mạng.
   - Lần đầu mở game (có mạng), nó tự lưu index.html, ảnh, nhạc, font vào máy.
   - Khi có mạng, game luôn tải bản mới nhất (sửa game xong không cần đổi gì ở đây).
   - File này phải nằm cùng chỗ với index.html. */
const CACHE = 'chiikawa-go-v1';
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'music/bgm.mp3'];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(CORE.map(u => c.add(u).catch(() => {})))) // thiếu file nào thì bỏ qua file đó
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || !req.url.startsWith('http')) return;

  // trang game: ưu tiên bản mới trên mạng, mất mạng thì mở bản đã lưu
  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then(res => {
          if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy)); }
          return res;
        })
        .catch(() => caches.match('index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // nhạc mp3 (trình duyệt xin từng đoạn): trả nguyên file đã lưu
  if (req.headers.has('range')) {
    e.respondWith(caches.match(req.url, { ignoreSearch: true }).then(r => r || fetch(req)));
    return;
  }

  // ảnh, font…: dùng bản đã lưu cho nhanh, đồng thời tải bản mới về cho lần sau
  e.respondWith(
    caches.open(CACHE).then(c => c.match(req).then(hit => {
      const net = fetch(req).then(res => {
        if (res.ok || res.type === 'opaque') c.put(req, res.clone());
        return res;
      });
      if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
      return net;
    }))
  );
});
