# NEXUS CHEATS — `https://nexuscheats.local` kurulumu

Chrome'da **uyarısız, kilitli** bir HTTPS adresi için gereken 3 adım.

---

## Tek adımda kurulum (önerilen)

1. Dosya Gezgini'nde şu klasöre gidin:

   ```
   C:\Users\Pc\.abacusai-bot\session-home\nexus-cheats
   ```

2. **`kurulum-yonetici.cmd`** dosyasına **sağ tıklayın** → **"Yönetici olarak çalıştır"**

3. Çıkan pencerede işlem biter, `pause` bekler → bir tuşa basın.

Bu script üç işi yapar:

| Adım | Ne yapar |
|---|---|
| 1 | `hosts` dosyasına `127.0.0.1  nexuscheats.local` ekler |
| 2 | Sertifikayı **Güvenilen Kök Sertifika Yetkilileri** deposuna ekler |
| 3 | DNS önbelleğini temizler (`ipconfig /flushdns`) |

---

## Sonra: sunucuyu başlatın

```bash
cd C:/Users/Pc/.abacusai-bot/session-home/nexus-cheats
npm run https
```

Chrome'da açın:

```
https://nexuscheats.local:3443
```

Artık **hiçbir uyarı çıkmaz** ve adres çubuğunda kilit simgesi görünür.

---

## Alternatif: komut satırından

Yönetici PowerShell'de:

```powershell
cd "C:\Users\Pc\.abacusai-bot\session-home\nexus-cheats"
npm run setup-domain
```

Bu script aynı işlemleri yapar ve her adımda ne yaptığını raporlar.

---

## Port'suz adres istiyorsanız (`https://nexuscheats.local`)

`.env` dosyasına şunu ekleyin:

```
HTTPS_PORT=443
HTTP_PORT=80
```

Sonra sunucuyu **yönetici olarak** başlatın (80/443 düşük porttur, Windows'ta
yönetici yetkisi ister). Artık adres port'suz olur:

```
https://nexuscheats.local
```

---

## Kurulum çalışmadıysa — manuel adımlar

### A) hosts kaydı

Yönetici Not Defteri ile `C:\Windows\System32\drivers\etc\hosts` dosyasını açın
ve sonuna ekleyin:

```
127.0.0.1    nexuscheats.local
127.0.0.1    www.nexuscheats.local
```

Veya yönetici PowerShell'de:

```powershell
Add-Content -Path "$env:SystemRoot\System32\drivers\etc\hosts" `
  -Value "`n127.0.0.1 nexuscheats.local`n127.0.0.1 www.nexuscheats.local"
```

### B) Sertifikayı güvenilir yap

```powershell
certutil -addstore -f Root "C:\Users\Pc\.abacusai-bot\session-home\nexus-cheats\data\tls\nexuscheats.local.cer"
```

### C) Doğrula

```powershell
certutil -store Root | Select-String "nexuscheats"
ipconfig /flushdns
```

---

## Sertifika detayları

| Özellik | Değer |
|---|---|
| Dosyalar | `data/tls/cert.pem`, `data/tls/key.pem`, `data/tls/nexuscheats.local.cer` |
| Anahtar | RSA 2048-bit |
| İmza | SHA-256 |
| Geçerlilik | 825 gün (~2 yıl 3 ay) |
| CN | `nexuscheats.local` |
| SAN (DNS) | `localhost`, `nexuscheats.local`, `www.nexuscheats.local`, LAN `nip.io` adresleri |
| SAN (IP) | `127.0.0.1`, `192.168.56.1`, `192.168.0.6` |

Sertifikayı yeniden üretmek için (hosts kaydını ve güven deposunu **tekrar**
kurmanız gerekir):

```bash
npm run cert -- --force
npm run setup-domain     # yönetici olarak
```

---

## Chrome'da "ERR_CERT_AUTHORITY_INVALID" almaya devam ediyorsanız

1. `chrome://settings/certificates` → **Yetkili sertifika yetkilileri** sekmesinde
   `nexuscheats.local` var mı bakın.
2. Yoksa `kurulum-yonetici.cmd` adımını atlamış olabilirsiniz.
3. Chrome'u tamamen kapatıp yeniden açın (sertifika deposu önbelleğe alınır).
4. Chrome'da `chrome://net-internals/#dns` → **Clear host cache** ve
   `chrome://net-internals/#sockets` → **Flush socket pools** yapın.

---

## Not: bu adres yalnızca sizin bilgisayarınızda geçerlidir

`nexuscheats.local` bir hosts kaydıdır; internette var olan bir alan adı
**değildir**. Başka bir bilgisayardan veya telefondan erişmek için:

- Aynı Wi-Fi'da: `https://192.168.0.6:3443` (sertifikada SAN olarak kayıtlı)
- Gerçek alan adı gerekiyorsa: `HTTPS-KURULUM.md` dosyasının 4. bölümüne bakın
  (alan adı + DNS + Let's Encrypt + ters proxy)
