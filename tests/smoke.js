'use strict';

/**
 * Uctan uca duman testi: sunucuyu gecici bir portta baslatir, kritik
 * sayfalari ve guvenlik davranislarini dogrular, sonra kapatir.
 *
 *   node tests/smoke.js
 */

const http = require('node:http');
const assert = require('node:assert');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.TEST_PORT || 3411);
const BASE = `http://127.0.0.1:${PORT}`;

process.env.NODE_ENV = 'test';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test-anahtari-en-az-otuz-iki-karakter-olmali-1234';
process.env.DB_PATH = path.join(ROOT, 'data', 'test.db');
process.env.ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@nexuscheats.local';
process.env.ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'NexusAdmin2026!';

if (fs.existsSync(process.env.DB_PATH)) fs.rmSync(process.env.DB_PATH);

const app = require(path.join(ROOT, 'src', 'server.js'));
const seed = require(path.join(ROOT, 'src', 'db', 'seed.js'));

let passed = 0;
let failed = 0;

function ok(name, condition, extra = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${name}`);
  } else {
    failed += 1;
    console.log(`  ✗ ${name}${extra ? ` — ${extra}` : ''}`);
  }
}

/** Cerezleri koruyan basit istek yardimcisi. */
function makeClient() {
  let cookies = [];
  return {
    get cookies() { return cookies; },
    async request(method, urlPath, { form = null, headers = {} } = {}) {
      const body = form ? new URLSearchParams(form).toString() : null;
      const reqHeaders = { ...headers };
      if (body) {
        reqHeaders['content-type'] = 'application/x-www-form-urlencoded';
        reqHeaders['content-length'] = Buffer.byteLength(body);
      }
      if (cookies.length) reqHeaders.cookie = cookies.join('; ');

      return new Promise((resolve, reject) => {
        const req = http.request(`${BASE}${urlPath}`, { method, headers: reqHeaders }, (res) => {
          let data = '';
          res.on('data', (c) => { data += c; });
          res.on('end', () => {
            const setCookie = res.headers['set-cookie'] || [];
            for (const c of setCookie) {
              const pair = c.split(';')[0];
              const name = pair.split('=')[0];
              cookies = cookies.filter((x) => !x.startsWith(`${name}=`));
              cookies.push(pair);
            }
            resolve({ status: res.statusCode, headers: res.headers, body: data });
          });
        });
        req.on('error', reject);
        if (body) req.write(body);
        req.end();
      });
    },
    postForm(urlPath, form) { return this.request('POST', urlPath, { form }); },
    get(urlPath) { return this.request('GET', urlPath); },
  };
}

/** Formdaki _csrf degerini cikarir. */
function extractCsrf(html) {
  const m = html.match(/name="_csrf"\s+value="([^"]+)"/);
  return m ? m[1] : null;
}

async function main() {
  console.log('NEXUS CHEATS — duman testi\n');

  await seed.main();

  const server = app.listen(PORT);
  await new Promise((r) => server.once('listening', r));

  try {
    /* ---------------------------------------------------- genel sayfalar */
    console.log('Genel sayfalar:');
    const publicPages = [
      ['/', 'HER MAÇTA', 'ana sayfa hero basligi'],
      ['/urunler', 'VALORANT', 'urunler'],
      ['/paketler', '999 TL', 'aylik fiyat'],
      ['/giris', 'Giriş Yap', 'giris formu'],
      ['/kayit', 'Üye Ol', 'kayit formu'],
      ['/iletisim', 'İletişim', 'iletisim'],
      ['/gizlilik-politikasi', 'Gizlilik', 'gizlilik'],
      ['/kullanim-kosullari', 'Kullanım Koşulları', 'kullanim kosullari'],
      ['/iade-politikasi', 'İade', 'iade'],
    ];

    const client = makeClient();
    for (const [url, needle, label] of publicPages) {
      const res = await client.get(url);
      ok(`${label} (${url}) 200 + içerik`, res.status === 200 && res.body.includes(needle),
        `status=${res.status}`);
    }

    /* ----------------------------------------------------- fiyat kontrolu */
    console.log('\nÜyelik fiyatları:');
    const plansPage = await client.get('/paketler');
    ok('Aylık 999 TL görünüyor', plansPage.body.includes('999 TL'));
    ok('Yıllık 12.000 TL görünüyor', plansPage.body.includes('12.000 TL'));
    ok('Sınırsız 33.000 TL görünüyor', plansPage.body.includes('33.000 TL'));
    ok('Yanlış fiyat yok', !plansPage.body.includes('1.199 TL') && !plansPage.body.includes('9.999 TL'));

    /* -------------------------------------------------- odeme seffafligi */
    console.log('\nÖdeme şeffaflığı:');
    ok('Ödeme yapılandırılmadı uyarısı var',
      plansPage.body.includes('yapılandırılmadı'));
    const health = await client.get('/saglik');
    ok('Sağlık ucu JSON döner', health.status === 200 && health.body.includes('"ok":true'));

    /* ------------------------------------------------------- yetkilendirme */
    console.log('\nYetkilendirme:');
    const panelRes = await client.get('/panel');
    ok('Giriş yapmadan /panel erişilemez', panelRes.status === 302 || panelRes.body.includes('giriş'),
      `status=${panelRes.status}`);

    const adminRes = await client.get('/admin');
    ok('Giriş yapmadan /admin erişilemez', adminRes.status === 302 || adminRes.body.includes('giriş') || adminRes.body.includes('yetki'),
      `status=${adminRes.status}`);

    /* -------------------------------------------------------- csrf kontrolu */
    console.log('\nCSRF koruması:');
    const noCsrf = await client.postForm('/giris', { email: 'a@b.com', password: 'x' });
    ok('CSRF token olmadan POST reddedilir', noCsrf.status === 403, `status=${noCsrf.status}`);

    /* --------------------------------------------------------- kayit akisi */
    console.log('\nKayıt ve giriş akışı:');
    const reg = makeClient();
    const regPage = await reg.get('/kayit');
    const regCsrf = extractCsrf(regPage.body);
    ok('Kayıt formunda CSRF token var', Boolean(regCsrf));

    const weakPass = await reg.postForm('/kayit', {
      _csrf: regCsrf, fullName: 'Test Kullanıcı', email: 'test@ornek.com', password: 'abc', passwordConfirm: 'abc',
    });
    ok('Zayıf şifre reddedilir', weakPass.status === 422, `status=${weakPass.status}`);

    const created = await reg.postForm('/kayit', {
      _csrf: regCsrf, fullName: 'Test Kullanıcı', email: 'test@ornek.com',
      password: 'GucluSifre123', passwordConfirm: 'GucluSifre123',
    });
    ok('Geçerli kayıt panele yönlenir', created.status === 302, `status=${created.status}`);

    const dup = makeClient();
    const dupPage = await dup.get('/kayit');
    const dupCsrf = extractCsrf(dupPage.body);
    const duplicate = await dup.postForm('/kayit', {
      _csrf: dupCsrf, fullName: 'Test Kullanıcı', email: 'test@ornek.com',
      password: 'GucluSifre123', passwordConfirm: 'GucluSifre123',
    });
    ok('Aynı e-posta ile ikinci kayıt reddedilir', duplicate.status === 409, `status=${duplicate.status}`);

    /* ------------------------------------------------------------ panel */
    const dashboard = await reg.get('/panel');
    ok('Kayıtlı kullanıcı paneli açar', dashboard.status === 200 && dashboard.body.includes('KULLANICI PANELİ'));
    ok('Panelde üyelik yok uyarısı var', dashboard.body.includes('Aktif üyeliğiniz bulunmuyor'));

    /* ---------------------------------------------------- siparis olustur */
    console.log('\nSipariş ve ödeme davranışı:');
    const panelCsrf = extractCsrf(dashboard.body);
    const orderRes = await reg.postForm('/panel/siparis', { _csrf: panelCsrf, planId: 1 });
    ok('Sipariş oluşturulur ve ödeme sayfasına yönlenir', orderRes.status === 302, `status=${orderRes.status}`);
    const orderLocation = orderRes.headers.location || '';
    ok('Ödeme sayfası yönlendirmesi doğru', orderLocation.startsWith('/odeme/'), orderLocation);

    const checkout = await reg.get(orderLocation);
    ok('Ödeme sayfası açılır', checkout.status === 200);
    ok('Ödeme devre dışı uyarısı gösterilir',
      checkout.body.includes('yapılandırılmadı') && checkout.body.includes('hiçbir tahsilat yapılmadı'));

    const startRes = await reg.postForm(`${orderLocation}/baslat`, { _csrf: panelCsrf });
    ok('Ödeme başlatma reddedilir (sağlayıcı yok)', startRes.status === 302 || startRes.status === 503,
      `status=${startRes.status}`);

    const afterStart = await reg.get('/panel/uyelik');
    ok('Ödeme onayı olmadan üyelik BAŞLATILMAZ',
      !afterStart.body.includes('Sınırsız</p>') && afterStart.body.includes('Pasif'));

    const callback = await reg.postForm('/odeme/callback', { status: 'success', order: 'x' });
    ok('Sağlayıcı callback ucu kapalı (503)', callback.status === 503, `status=${callback.status}`);

    /* ------------------------------------------------------ yonetici akisi */
    console.log('\nYönetici paneli:');
    const admin = makeClient();
    const adminLoginPage = await admin.get('/giris');
    const adminCsrf = extractCsrf(adminLoginPage.body);
    const adminLogin = await admin.postForm('/giris', {
      _csrf: adminCsrf,
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
      next: '/admin',
    });
    ok('Yönetici girişi başarılı', adminLogin.status === 302, `status=${adminLogin.status}`);

    const adminPages = [
      ['/admin', 'Genel Bakış'],
      ['/admin/urunler', 'Ürünler'],
      ['/admin/urunler/yeni', 'Yeni Ürün'],
      ['/admin/paketler', 'Üyelik Paketleri'],
      ['/admin/siparisler', 'Siparişler'],
      ['/admin/kullanicilar', 'Kullanıcılar'],
      ['/admin/destek', 'Destek Talepleri'],
      ['/admin/istatistikler', 'Satış İstatistikleri'],
    ];
    for (const [url, needle] of adminPages) {
      const res = await admin.get(url);
      ok(`${url} açılır`, res.status === 200 && res.body.includes(needle), `status=${res.status}`);
    }

    /* -------------------------------------------- yonetici urun ekleme */
    const newProductPage = await admin.get('/admin/urunler/yeni');
    const prodCsrf = extractCsrf(newProductPage.body);
    const createdProduct = await admin.postForm('/admin/urunler', {
      _csrf: prodCsrf,
      slug: 'test-urun',
      game: 'valorant',
      name: 'Test Eğitim Modülü',
      summary: 'Duman testi için oluşturulmuş geçici bir ürün kaydı.',
      description: 'Test açıklaması.',
      features: 'Birinci özellik\nİkinci özellik',
      compatibility: 'Test uyumluluk notu',
      priceTL: '199.90',
      imageKey: 'default',
      sortOrder: '9',
      isActive: '1',
    });
    ok('Ürün eklenir', createdProduct.status === 302, `status=${createdProduct.status}`);

    const productList = await admin.get('/admin/urunler');
    ok('Yeni ürün listede görünür', productList.body.includes('Test Eğitim Modülü'));

    const publicProduct = await makeClient().get('/urunler/test-urun');
    ok('Yeni ürün sitede yayınlanır', publicProduct.status === 200 && publicProduct.body.includes('199,9 TL'),
      `status=${publicProduct.status} fiyat=${publicProduct.body.includes('199,9 TL')}`);

    const badSlug = await admin.postForm('/admin/urunler', {
      _csrf: prodCsrf, slug: 'Test-Urun', game: 'valorant', name: 'Geçersiz',
      summary: 'Kısa açıklama yeterli uzunlukta değil mi bakalım.',
    });
    ok('Geçersiz slug reddedilir (422)', badSlug.status === 422, `status=${badSlug.status}`);

    /* --------------------------------------------- siparis durum yonetimi */
    const ordersPage = await admin.get('/admin/siparisler');
    const orderIdMatch = ordersPage.body.match(/\/admin\/siparisler\/(\d+)\/durum/);
    ok('Sipariş listesinde durum formu var', Boolean(orderIdMatch));

    if (orderIdMatch) {
      const markPaid = await admin.postForm(`/admin/siparisler/${orderIdMatch[1]}/durum`, {
        _csrf: extractCsrf(ordersPage.body), status: 'paid',
      });
      ok('Yönetici siparişi ödendi işaretleyebilir', markPaid.status === 302, `status=${markPaid.status}`);

      const memberPage = await reg.get('/panel/uyelik');
      ok('Ödeme onayı sonrası üyelik aktifleşir', memberPage.body.includes('Aktif'));
    }

    /* -------------------------------------------------------- destek akisi */
    console.log('\nDestek sistemi:');
    const supportPage = await reg.get('/panel/destek');
    const supCsrf = extractCsrf(supportPage.body);
    const ticketRes = await reg.postForm('/panel/destek', {
      _csrf: supCsrf,
      subject: 'Test destek talebi',
      category: 'odeme',
      message: 'Bu bir duman testi mesajıdır, yeterli uzunlukta.',
    });
    ok('Destek talebi oluşturulur', ticketRes.status === 302, `status=${ticketRes.status}`);

    const adminSupport = await admin.get('/admin/destek');
    ok('Talep yönetici panelinde görünür', adminSupport.body.includes('Test destek talebi'));

    /* ------------------------------------------------------ profil guncelle */
    console.log('\nProfil:');
    const profilePage = await reg.get('/panel/profil');
    const profCsrf = extractCsrf(profilePage.body);
    const profileUpdate = await reg.postForm('/panel/profil', {
      _csrf: profCsrf, fullName: 'Test Kullanıcı Güncel', email: 'test@ornek.com',
    });
    ok('Profil güncellenir', profileUpdate.status === 302, `status=${profileUpdate.status}`);

    /* ----------------------------------------------------------- 404 */
    const notFound = await makeClient().get('/olmayan-sayfa-xyz');
    ok('404 sayfası doğru döner', notFound.status === 404 && notFound.body.includes('404'));

    /* -------------------------------------------------------- sifre sizinti */
    console.log('\nGüvenlik kontrolleri:');
    const dbRow = require(path.join(ROOT, 'src', 'db')).get(
      'SELECT password_hash FROM users WHERE email = ?', 'test@ornek.com',
    );
    ok('Şifre düz metin saklanmaz', dbRow && !dbRow.password_hash.includes('GucluSifre123')
      && dbRow.password_hash.startsWith('$2'), dbRow ? dbRow.password_hash.slice(0, 7) : 'yok');

    const wrongLogin = makeClient();
    const wl = await wrongLogin.get('/giris');
    const bad = await wrongLogin.postForm('/giris', {
      _csrf: extractCsrf(wl.body), email: 'test@ornek.com', password: 'YanlisSifre123',
    });
    ok('Yanlış şifre reddedilir', bad.status === 401, `status=${bad.status}`);
  } finally {
    server.close();
  }

  console.log(`\nSonuç: ${passed} geçti, ${failed} başarısız.`);
  if (failed > 0) process.exitCode = 1;
}

main().catch((err) => {
  console.error('Test hatası:', err);
  process.exitCode = 1;
});
