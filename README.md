# NEXUS CHEATS

Rekabetçi FPS oyuncuları için eğitim, antrenman ve maç analizi platformu.
Tamamen Türkçe, siyah–kırmızı neon temalı, mobil uyumlu ve gerçek üyelik
sistemi içeren çalışan bir web uygulaması.

> **Önemli:** Bu proje bir **eğitim ve koçluk** platformudur. Oyun dosyalarını
> değiştiren, oyun içi haksız avantaj sağlayan veya anti-cheat sistemlerini
> atlatan hiçbir yazılım/hizmet sunulmaz. Sunulan tüm ürünler VALORANT ve
> Counter-Strike 2'nin kullanım koşullarına uygun içeriklerdir. Proje, oyun
> geliştiricileriyle resmî bir ortaklık iddiası taşımaz; markalar ilgili
> sahiplerine aittir.

---

## Hızlı başlangıç

```bash
# 1) Bağımlılıklar
npm install

# 2) Yapılandırma
cp env.example .env      # Windows: copy env.example .env
#   .env içindeki SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD değerlerini doldurun

# 3) Veritabanı + örnek içerik (paketler, ürünler, yönetici hesabı)
npm run seed

# 4) Sunucuyu başlat
npm start                # http://localhost:3000
```

Testleri çalıştırmak için:

```bash
npm test                 # 53 uçtan uca duman testi
```

---

## Teknoloji

| Katman | Seçim | Not |
|---|---|---|
| Çalışma ortamı | Node.js ≥ 22.5 | `node:sqlite` yerleşik modülü kullanılır |
| Sunucu | Express 4 | Şablon motoru olarak EJS |
| Veritabanı | SQLite (`data/nexus.db`) | WAL modu, foreign key kısıtları açık |
| Şifreleme | bcrypt (12 tur) | Şifreler asla düz metin saklanmaz |
| Oturum | express-session + httpOnly çerez | Üretimde `Secure` + `SameSite` |
| Giriş doğrulama | zod | Türkçe hata mesajları |
| Güvenlik başlıkları | helmet + CSP | `frame-ancestors 'none'` |
| Hız sınırı | express-rate-limit | Genel + kimlik doğrulama uçları |

Bağımlılıklar bilinçli olarak az tutuldu; ödeme ve CSRF gibi kritik noktalar
harici, denetlenmemiş paketlere bırakılmadı.

---

## Üyelik paketleri (sabit fiyatlar)

| Paket | Fiyat | Süre |
|---|---|---|
| Aylık Üyelik | **999 TL** | 30 gün |
| Yıllık Üyelik | **12.000 TL** | 365 gün |
| Sınırsız Üyelik | **33.000 TL** | Süresiz |

Fiyatlar `src/db/seed.js` içinde kuruş cinsinden tanımlıdır
(`99900`, `1200000`, `3300000`). Yeni paket alındığında kalan süre silinmez,
kalan sürenin üzerine eklenir.

---

## Oyun kategorileri ve ürünler

**VALORANT**
- Aim Programı — 8 haftalık antrenman planı
- Lineup & Pusu Kütüphanesi — 200+ harita kaydı
- VOD Analiz & Rank Koçluğu — birebir maç analizi

**COUNTER-STRIKE 2**
- Aim Antrenman Modülü — spray/reaksiyon rutini
- Utility & Smoke Rehberi — harita bazlı kurulumlar
- Demo Analiz & Ekonomi Koçluğu — demo dosyası analizi

Ürün kartları; görsel, açıklama, özellik listesi, uyumluluk bilgisi ve
üyelik seçeneklerini içerir.

---

## Sayfa yapısı

**Genel**
`/` ana sayfa · `/urunler` ve `/urunler/:slug` · `/paketler` ·
`/iletisim` · `/gizlilik-politikasi` · `/kullanim-kosullari` · `/iade-politikasi`

**Kimlik**
`/kayit` · `/giris` · `/cikis`

**Kullanıcı paneli**
`/panel` genel bakış · `/panel/uyelik` · `/panel/siparisler` (+ detay) ·
`/panel/destek` (+ talep detayı) · `/panel/profil`

**Ödeme**
`/odeme/:siparisNo` · `/odeme/:siparisNo/baslat` · `/odeme/callback`

**Yönetim paneli** (yalnızca `role = 'admin'`)
`/admin` · `/admin/urunler` (+ yeni/düzenle/sil) · `/admin/paketler` ·
`/admin/siparisler` · `/admin/kullanicilar` (+ detay) · `/admin/destek` ·
`/admin/istatistikler`

---

## Ödeme sistemi hakkında (dürüstlük notu)

**Gerçek bir ödeme entegrasyonu bu kurulumda YOKTUR ve çalışıyormuş gibi
gösterilmez.** Davranış şöyledir:

- `PAYMENT_PROVIDER` ve ilgili anahtarlar `.env` içinde boşsa sistem
  **"yapılandırılmadı"** durumundadır.
- Sipariş oluşturulabilir, ancak `pending` (ödeme bekliyor) olarak kaydedilir.
- `/odeme/:no/baslat` uç noktası **503** döner; hiçbir tahsilat yapılmaz.
- `/odeme/callback` uç noktası **503** döner; sahte bir "başarılı ödeme"
  kabul etmez.
- **Üyelik yalnızca** şu iki durumda etkinleşir: (a) sağlayıcıdan doğrulanmış
  ödeme onayı, (b) yöneticinin siparişi bilinçli olarak "ödendi" işaretlemesi.

Gerçek entegrasyon için yapılacaklar `src/lib/payments.js` içinde
yorumlanmıştır: iyzico veya PayTR anahtarlarını `.env`'e ekleyin,
`startPayment()` fonksiyonunu sağlayıcının 3D Secure akışına bağlayın ve
callback'te **imza doğrulaması** yapın. API anahtarları yalnızca sunucu
tarafında okunur, istemciye hiçbir zaman gönderilmez.

Kart bilgileri hiçbir koşulda bu sunucuya ulaşmaz ve saklanmaz.

---

## Güvenlik

- Şifreler bcrypt ile 12 tur hash'lenir; düz metin saklanmaz.
- Tüm POST istekleri CSRF token doğrulamasına tabidir (ödeme sağlayıcı
  callback'i imza doğrulaması ile korunur ve CSRF'ten muaftır).
- Oturum çerezi `HttpOnly` + `SameSite=Lax`; üretimde `Secure`.
- Rol tabanlı erişim: `requireAuth`, `requireAdmin`.
- 404/403/500 için tek merkezden hata yönetimi; 5xx hatalar sunucu
  günlüğüne yazılır, kullanıcıya iç ayrıntı gösterilmez.
- `helmet` ile CSP dâhil güvenlik başlıkları; `unescaped` EJS çıktısı
  yalnızca sunucunun kendi ürettiği SVG'ler için kullanılır.

---

## Veri şeffaflığı

- **Sahte müşteri yorumu yoktur.** Sitede hiçbir kullanıcı yorumu üretilmez.
- **Kurgusal satış istatistiği yoktur.** Yönetim panelindeki tüm sayılar
  `orders`, `memberships` ve `users` tablolarından anlık hesaplanır;
  veri yoksa "—" veya "Veri yok" gösterilir.
- Vitrindeki `hero-stats` sayaçları yalnızca gerçek kayıt sayılarından
  (yayındaki ürün sayısı, kategori sayısı, paket sayısı) beslenir.

---

## Proje yapısı

```
nexus-cheats/
├── data/                  # SQLite veritabanı (git'e girmez)
├── public/                # CSS, JS, favicon
│   ├── css/style.css
│   ├── js/site.js
│   └── img/favicon.svg
├── src/
│   ├── db/
│   │   ├── index.js       # bağlantı + şema
│   │   └── seed.js        # paketler, ürünler, yönetici hesabı
│   ├── lib/
│   │   ├── art.js         # SVG ürün görselleri (data URI)
│   │   ├── format.js      # TL/tarih biçimlendirme, üyelik durumu
│   │   ├── payments.js    # ödeme sağlayıcı katmanı (yapılandırma bekler)
│   │   ├── security.js    # CSRF + şifre hash
│   │   └── validate.js    # zod şemaları
│   ├── middleware/
│   │   ├── auth.js
│   │   └── context.js
│   ├── models/index.js    # veri erişim katmanı
│   ├── routes/
│   │   ├── admin.js
│   │   ├── auth.js
│   │   ├── panel.js
│   │   ├── payment.js
│   │   └── public.js
│   ├── views/             # EJS şablonları
│   └── server.js
├── tests/smoke.js         # 53 uçtan uca test
├── env.example
└── package.json
```

---

## Yapılandırma değişkenleri

| Değişken | Açıklama |
|---|---|
| `PORT` | Sunucu portu (varsayılan 3000) |
| `NODE_ENV` | `production` iken zorunlu güvenlik sıkılaştırmaları devreye girer |
| `SESSION_SECRET` | **Zorunlu** (≥32 karakter). Üretimde tanımsızsa uygulama başlamaz |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `npm run seed` sırasında oluşturulacak yönetici hesabı |
| `PAYMENT_PROVIDER` | `iyzico` veya `paytr`. Boşsa ödeme adımı devre dışı |
| `PAYMENT_SANDBOX` | `true` ise test modu |
| `DB_PATH` | Veritabanı yolu (isteğe bağlı) |

`.env` dosyası `.gitignore` içindedir; hiçbir zaman sürüm kontrolüne girmemeli.
