# NEXUS CHEATS — yerel HTTPS kurulumu

Site iki modda çalışabilir: **HTTP** (basit) veya **HTTPS** (tarayıcı uyarısı olmadan).

---

## Hızlı yol — tek komut

```bash
npm run https
```

Bu komut şunları yapar:

1. TLS sertifikası yoksa **otomatik üretir** (`data/tls/cert.pem` + `key.pem`).
   OpenSSL kurulu olması gerekmez — sertifika Node'un kendi kripto modülüyle üretilir.
2. HTTPS sunucusunu başlatır.
3. Aynı anda bir HTTP sunucusu açar ve gelen istekleri HTTPS'e yönlendirir.

| Ne | Adres |
|---|---|
| **HTTPS (asıl adres)** | **https://localhost:3443** |
| HTTP → HTTPS yönlendirmesi | http://localhost:3080 |

---

## 1. Sertifika üretimi

```bash
npm run cert            # zaten varsa dokunmaz
npm run cert -- --force # yeniden üretir
```

Üretilen sertifika:

- 2048-bit RSA, SHA-256 imzalı, 825 gün geçerli
- SAN listesi: `localhost`, `127.0.0.1`, makinenin LAN IP'leri ve bunların
  `nip.io` karşılıkları (örn. `192-168-0-6.nip.io`) → telefondan test kolay
- `data/tls/` altında, `chmod 600` ile saklanır (`.gitignore` içinde)

Kendi sertifikanızı kullanmak isterseniz `.env` içine yolları yazın:

```
TLS_CERT=C:/yol/sertifika.pem
TLS_KEY=C:/yol/anahtar.pem
```

---

## 2. Portlar

`.env` içinden değiştirilebilir:

```
HTTPS_PORT=3443
HTTP_PORT=3080
```

`HTTPS_PORT=443` verirseniz adres port'suz `https://localhost` olur.
(Port 443, Windows'ta yönetici yetkisi gerektirebilir.)

---

## 3. Tarayıcı uyarısı hakkında — dürüst açıklama

Sertifika **kendinden imzalıdır**, yani bir sertifika otoritesi tarafından
onaylanmamıştır. Bu yüzden:

- **Bağlantı şifrelidir** (TLS 1.2+). Trafik ağ üzerinde açık gitmez.
- Ancak tarayıcı ilk açılışta "Bağlantınız gizli değil" uyarısı gösterebilir.
  **Gelişmiş → Yine de devam et** ile geçilir.
- Bu uyarı, sertifikanın *kimliğini* doğrulayacak bir otorite olmadığı için
  çıkar; şifrelemenin olmadığı anlamına gelmez.

### Uyarıyı tamamen kaldırmak isterseniz (isteğe bağlı)

Windows'ta sertifikayı "Güvenilen Kök Sertifika Yetkilileri" deposuna
eklerseniz tarayıcı uyarı vermez:

```powershell
# Yönetici PowerShell
Import-Certificate -FilePath "C:\...\nexus-cheats\data\tls\cert.pem" `
  -CertStoreLocation Cert:\LocalMachine\Root
```

> Bu sertifika **yalnızca kendi bilgisayarınız için** güvenilir hale gelir.
> Sertifikayı başka kimseyle paylaşmayın ve üretim ortamında kullanmayın.

---

## 4. Gerçek alan adı + geçerli sertifika (üretim)

`https://nexuscheats.com` gibi gerçek bir adres için kendinden imzalı
sertifika yetmez. Gerekenler:

1. **Alan adı** kaydı (örn. `.com` / `.com.tr`).
2. **Sunucu** — yerel bilgisayarınızı internete açmak yerine bir VPS ya da
   yönetilen platform önerilir.
3. **DNS** — alan adını sunucu IP'sine yönlendiren A kaydı.
4. **Geçerli sertifika** — Let's Encrypt (ücretsiz):
   ```bash
   # Linux sunucuda, alan adı sunucuya yönlendirilmişken
   certbot certonly --standalone -d nexuscheats.com -d www.nexuscheats.com
   ```
   Ardından `.env`:
   ```
   TLS_CERT=/etc/letsencrypt/live/nexuscheats.com/fullchain.pem
   TLS_KEY=/etc/letsencrypt/live/nexuscheats.com/privkey.pem
   HTTPS_PORT=443
   ```
5. **Ters proxy** (önerilir) — Nginx/Caddy ile 80/443'ü karşılar, uygulamayı
   `127.0.0.1:3443` üzerinde tutar. Caddy bunu otomatik yapar:
   ```
   nexuscheats.com {
       reverse_proxy 127.0.0.1:3443
   }
   ```
6. **Üretim ayarları** — `.env` içinde:
   ```
   NODE_ENV=production
   SESSION_SECRET=<32+ karakter rastgele değer>
   ```
   `NODE_ENV=production` iken oturum çerezi `Secure` olur ve `SESSION_SECRET`
   tanımlı değilse uygulama bilinçli olarak başlamaz.

> **Not:** Gerçek alan adı, hosting ve DNS adımları bu makineden yapılamaz —
> alan adı satın alma ve sunucu kurulumu sizin tarafınızda tamamlanmalıdır.

---

## 5. Ağdan / telefondan erişim

Sunucu varsayılan olarak `0.0.0.0` dinler. Aynı Wi-Fi'daki bir telefondan:

```
https://192.168.0.6:3443
```

Sertifikanın SAN listesinde LAN IP'niz (`192.168.0.6`) ve
`192-168-0-6.nip.io` bulunur, bu yüzden uyarı çıkmadan ya da tek onayla açılır.

`HOST=127.0.0.1` verirseniz yalnızca bu bilgisayardan erişilebilir olur.

---

## 6. Komut özeti

| Komut | İş |
|---|---|
| `npm run https` | HTTPS + HTTP→HTTPS yönlendirme (sertifikayı gerekirse üretir) |
| `npm run cert` | Sertifikayı üret / kontrol et |
| `npm start` | Yalnızca HTTP (geliştirme için pratik) |
| `npm test` | 53 uçtan uca duman testi |
| `npm run seed` | Paketler, ürünler ve yönetici hesabı |
