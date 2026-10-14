# Yayına Alma Rehberi — NEXUS CHEATS

Bu dosya, siteyi kendi bilgisayarınızdan çıkarıp **herkesin erişebileceği
bir adrese** taşımanın adım adım yolunu anlatır.

---

## 0. Mevcut durum kontrolü

Projenin yayına hazır olup olmadığını görmek için:

```bash
npm run check
```

Bu komut şunları kontrol eder:

- Node.js sürümü ve bağımlılıklar
- Veritabanı ve tohumlanmış içerik (paketler, ürünler, yönetici)
- `SESSION_SECRET`, `NODE_ENV` gibi üretim ayarları
- Testlerin geçip geçmediği
- Yayına çıkmadan önce düzeltilmesi gereken maddeler

---

## 1. Yayın seçenekleri

| Seçenek | Zorluk | Ücretsiz mi | Alan adı bağlanır mı | Veritabanı kalıcı mı |
|---|---|---|---|---|
| **A) Render.com** | ⭐ Kolay | ✅ Evet | ✅ Evet | ⚠️ Ücretsiz planda diski sıfırlanır |
| **B) Railway.app** | ⭐ Kolay | ⚠️ Sınırlı kredi | ✅ Evet | ✅ Evet (volume) |
| **C) VPS (Hetzner/Contabo)** | ⭐⭐⭐ Zor | ❌ ~5 €/ay | ✅ Evet | ✅ Evet |
| **D) Fly.io** | ⭐⭐ Orta | ⚠️ Sınırlı | ✅ Evet | ✅ Evet (volume) |

**Öneri:** İlk yayın için **A) Render.com** — GitHub'a bağlanır, otomatik
yayınlar, HTTPS'i kendisi kurar, ücretsizdir.

> **Önemli:** Ücretsiz planlarda uygulama 15 dakika trafik almazsa uyur ve
> ilk açılış ~30 saniye sürer. Ayrıca ücretsiz planda kalıcı disk yoktur;
> SQLite veritabanı her yeniden başlatmada sıfırlanır. Kalıcı veri için
> ücretli plan (disk) gerekir.

---

## 2. Yayın öncesi zorunlu değişiklikler

### 2.1 Veritabanı yolu ortam değişkeninden okunmalı

Üretimde veritabanı kalıcı bir diske yazılmalıdır. `DB_PATH` zaten
destekleniyor (`src/db/index.js`), üretimde şu şekilde verilir:

```
DB_PATH=/var/data/nexus.db
```

### 2.2 Üretim ortam değişkenleri

| Değişken | Değer | Neden |
|---|---|---|
| `NODE_ENV` | `production` | Çerez `Secure` olur, hata ayrıntıları gizlenir |
| `SESSION_SECRET` | 32+ rastgele karakter | Oturum imzalama anahtarı |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Güçlü değerler | İlk yönetici hesabı |
| `DB_PATH` | Kalıcı disk yolu | Veri kaybını önler |
| `TRUST_PROXY` | `1` | Ters proxy arkasında doğru IP/HTTPS algısı |

`SESSION_SECRET` üretmek için:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 2.3 `.env` dosyası asla yüklenmez

`.gitignore` içinde `data/`, `.env`, `node_modules/` vardır. Bunlar
GitHub'a gitmez — doğru olan da bu. Ortam değişkenleri yayın panelinden
girilir.

---

## 3. Adım adım: GitHub'a yükleme

### 3.1 Git kurulumu

Git kurulu değilse: https://git-scm.com/download/win

Kurulumda varsayılan seçeneklerle ilerleyebilirsiniz.

### 3.2 Depo oluşturma

1. https://github.com/new adresine gidin
2. **Repository name:** `nexus-cheats`
3. **Private** seçin (önerilir)
4. **Create repository** düğmesine basın

### 3.3 Projeyi yükleme

Proje klasöründe terminal açıp:

```bash
git init
git add .
git commit -m "NEXUS CHEATS ilk sürüm"
git branch -M main
git remote add origin https://github.com/KULLANICI_ADINIZ/nexus-cheats.git
git push -u origin main
```

---

## 4. Adım adım: Render.com'da yayınlama

### 4.1 Hesap açma

1. https://render.com adresine gidin
2. **Get Started** → **GitHub ile devam et**
3. GitHub'a yetki verin

### 4.2 Yeni servis

1. Panelde **New +** düğmesine basın
2. **Web Service** seçin
3. **Build and deploy from a Git repository** → **Next**
4. `nexus-cheats` deposunu seçin → **Connect**

### 4.3 Ayarlar

| Alan | Değer |
|---|---|
| **Name** | `nexus-cheats` |
| **Region** | `Frankfurt (EU Central)` — Türkiye'ye en yakın |
| **Branch** | `main` |
| **Runtime** | `Node` |
| **Build Command** | `npm install && npm run seed` |
| **Start Command** | `npm start` |
| **Instance Type** | `Free` |

> `npm run seed` build sırasında çalışır ve paketleri/ürünleri oluşturur.
> Yönetici hesabı için `ADMIN_EMAIL` ve `ADMIN_PASSWORD` tanımlı olmalıdır.

### 4.4 Ortam değişkenleri

**Advanced** → **Add Environment Variable** ile şunları ekleyin:

| Key | Value |
|---|---|
| `NODE_ENV` | `production` |
| `SESSION_SECRET` | (ürettiğiniz 64 karakterlik değer) |
| `ADMIN_EMAIL` | `admin@siteniz.com` |
| `ADMIN_PASSWORD` | (güçlü bir şifre) |
| `TRUST_PROXY` | `1` |

### 4.5 Disk (kalıcı veritabanı — ücretli plan gerekir)

**Advanced** → **Add Disk**:

| Alan | Değer |
|---|---|
| **Name** | `nexus-data` |
| **Mount Path** | `/var/data` |
| **Size** | `1 GB` |

Sonra ortam değişkenlerine ekleyin:

| Key | Value |
|---|---|
| `DB_PATH` | `/var/data/nexus.db` |

### 4.6 Yayınla

**Create Web Service** düğmesine basın. İlk yayın 2–5 dakika sürer.

Adresiniz şu biçimde olur:

```
https://nexus-cheats.onrender.com
```

Bu adres **herkesin erişebileceği**, HTTPS sertifikası otomatik kurulmuş
gerçek bir internet adresidir.

---

## 5. Kendi alan adınızı bağlama

### 5.1 Alan adı satın alma

- **.com** için: Namecheap, GoDaddy, Cloudflare Registrar
- **.com.tr** için: İsimtescil, Natro, Turhost (belge gerekir)

### 5.2 Render'da alan adı ekleme

1. Render panelinde servisinize gidin
2. **Settings** → **Custom Domains** → **Add Custom Domain**
3. Alan adınızı yazın: `nexuscheats.com`
4. Render size iki kayıt verir:
   - **A kaydı** (kök alan adı için): `216.24.57.1`
   - **CNAME** (`www` için): `nexus-cheats.onrender.com`

### 5.3 DNS kayıtları

Alan adı sağlayıcınızın panelinde **DNS Yönetimi** bölümüne gidin:

| Tür | Ad | Değer | TTL |
|---|---|---|---|
| A | `@` | `216.24.57.1` | 3600 |
| CNAME | `www` | `nexus-cheats.onrender.com` | 3600 |

> IP adresi Render panelinde gösterilen değerdir; değişebilir, panelden
> doğrulayın.

### 5.4 HTTPS sertifikası

DNS yayıldıktan sonra (5 dakika – 24 saat) Render **Let's Encrypt**
sertifikasını kendisi kurar. Ek bir işlem gerekmez.

Adresiniz artık: `https://nexuscheats.com` ✅

---

## 6. Yayın sonrası kontrol listesi

```
[ ] https://adresiniz/ açılıyor mu?
[ ] Ana sayfada "HER MAÇTA FARKINI ORTAYA KOY" görünüyor mu?
[ ] Ürünler sayfası 6 ürünü listeliyor mu?
[ ] Paketler sayfası 999 / 12.000 / 33.000 TL gösteriyor mu?
[ ] Kayıt ol → giriş yap çalışıyor mu?
[ ] /admin adresine yönetici hesabıyla girilebiliyor mu?
[ ] /saglik JSON dönüyor mu?
[ ] Telefonunuzdan açılıyor mu?
[ ] Ödeme sayfası "yapılandırılmadı" uyarısı veriyor mu? (beklenen)
[ ] Adres çubuğunda kilit simgesi var mı?
```

---

## 7. Yayın sonrası yapılacaklar

| Konu | Durum |
|---|---|
| Ödeme entegrasyonu (iyzico/PayTR) | ❌ Henüz yok — satıcı hesabı gerekir |
| E-arşiv fatura entegrasyonu | ❌ Yok — yasal zorunluluk |
| KVKK aydınlatma onayı | ⚠️ Metin var, onay kutusu eklenmeli |
| Mesafeli satış sözleşmesi | ⚠️ Metin var, ödeme akışına bağlanmalı |
| E-posta gönderimi (şifre sıfırlama) | ❌ Yok |
| Yedekleme | ⚠️ SQLite dosyasının düzenli kopyası alınmalı |

---

## 8. Yerel geliştirme devam ederken

Yayına aldıktan sonra yerelde çalışmaya devam etmek için:

```bash
npm run https     # https://localhost:9443
```

Yayındaki sürümü güncellemek için:

```bash
git add .
git commit -m "değişiklik açıklaması"
git push
```

Render otomatik olarak yeni sürümü yayınlar (~2 dakika).
