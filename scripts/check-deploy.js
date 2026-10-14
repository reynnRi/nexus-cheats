'use strict';

/**
 * Yayına hazırlık kontrolü.
 *
 * Projenin internete yayınlanmaya hazır olup olmadığını denetler ve
 * yayına çıkmadan önce düzeltilmesi gereken maddeleri listeler.
 *
 *   npm run check
 */

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const ROOT = path.join(__dirname, '..');

let pass = 0;
let warn = 0;
let fail = 0;

const ok = (t) => { pass += 1; console.log(`  ✓ ${t}`); };
const wr = (t) => { warn += 1; console.log(`  ! ${t}`); };
const no = (t) => { fail += 1; console.log(`  ✗ ${t}`); };

function exists(rel) {
  return fs.existsSync(path.join(ROOT, rel));
}

function section(title) {
  console.log(`\n${title}`);
  console.log('─'.repeat(58));
}

/* --------------------------------------------------------------- ortam */

section('1. Çalışma ortamı');

const nodeMajor = Number(process.versions.node.split('.')[0]);
const nodeMinor = Number(process.versions.node.split('.')[1]);
const nodeOk = nodeMajor > 22 || (nodeMajor === 22 && nodeMinor >= 5);
if (nodeOk) ok(`Node.js ${process.versions.node} (node:sqlite destekli)`);
else no(`Node.js ${process.versions.node} — en az 22.5 gerekli`);

if (exists('node_modules/express')) ok('Bağımlılıklar kurulu');
else no('Bağımlılıklar kurulu değil — "npm install" çalıştırın');

if (exists('package-lock.json')) ok('package-lock.json mevcut (tekrarlanabilir kurulum)');
else wr('package-lock.json yok — "npm install" ile oluşturun');

/* ---------------------------------------------------------- dosya yapisi */

section('2. Proje dosyaları');

const required = [
  ['src/server.js', 'Sunucu giriş noktası'],
  ['src/db/index.js', 'Veritabanı katmanı'],
  ['src/db/seed.js', 'Tohumlama betiği'],
  ['src/models/index.js', 'Veri erişim katmanı'],
  ['src/lib/payments.js', 'Ödeme katmanı'],
  ['public/css/style.css', 'Stil dosyası'],
  ['public/js/site.js', 'İstemci betiği'],
  ['tests/smoke.js', 'Duman testi'],
  ['README.md', 'Proje kılavuzu'],
];

for (const [file, label] of required) {
  if (exists(file)) ok(`${label} — ${file}`);
  else no(`${label} eksik — ${file}`);
}

/* ------------------------------------------------------------ git ignore */

section('3. Git ve gizli dosyalar');

const gi = exists('.gitignore') ? fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8') : '';
const needed = [
  ['.env', 'Ortam değişkenleri (sırlar)'],
  ['data/', 'Veritabanı ve sertifikalar'],
  ['node_modules/', 'Bağımlılıklar'],
];
for (const [pattern, label] of needed) {
  if (gi.includes(pattern)) ok(`${label} .gitignore içinde (${pattern})`);
  else no(`${label} .gitignore içinde DEĞİL — sırlar sızabilir!`);
}

// Gecici dosyalar
const junk = ['git-installer.exe', 'mingit.zip', 'server.out', 'https.out', 'https2.out', 'https3.out', 'nexus.log'];
const present = junk.filter((f) => exists(f));
if (present.length) wr(`Geçici dosyalar var, silinmeli: ${present.join(', ')}`);
else ok('Geçici kurulum/log dosyası yok');

/* ------------------------------------------------------------ veritabani */

section('4. Veritabanı');

let db = null;
try {
  db = require('../src/db');
  ok('Veritabanı bağlantısı kuruldu');
} catch (err) {
  no(`Veritabanı açılamadı: ${err.message}`);
}

if (db) {
  const plans = db.get('SELECT COUNT(*) AS n FROM plans').n;
  const products = db.get('SELECT COUNT(*) AS n FROM products').n;
  const users = db.get('SELECT COUNT(*) AS n FROM users').n;

  if (plans >= 3) ok(`${plans} üyelik paketi tanımlı`);
  else no(`Yalnızca ${plans} paket var — 3 olmalı ("npm run seed")`);

  if (products >= 4) ok(`${products} ürün tanımlı`);
  else no(`Yalnızca ${products} ürün var — "npm run seed" çalıştırın`);

  if (users >= 1) ok(`${users} kullanıcı kayıtlı`);
  else wr('Hiç kullanıcı yok — yönetici hesabı oluşturulmamış');

  // Fiyat kontrolu
  const expected = { aylik: 99900, yillik: 1200000, sinirsiz: 3300000 };
  let priceOk = true;
  for (const [slug, kurus] of Object.entries(expected)) {
    const row = db.get('SELECT price_kurus FROM plans WHERE slug = ?', slug);
    if (!row || row.price_kurus !== kurus) priceOk = false;
  }
  if (priceOk) ok('Fiyatlar doğru: 999 / 12.000 / 33.000 TL');
  else no('Paket fiyatları beklenen değerlerden farklı!');
}

/* ---------------------------------------------------------------- ayarlar */

section('5. Üretim ayarları');

const env = process.env;

if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 32) {
  ok('SESSION_SECRET tanımlı ve yeterince uzun');
} else if (env.NODE_ENV === 'production') {
  no('SESSION_SECRET yok veya kısa — üretimde uygulama başlamaz!');
} else {
  wr('SESSION_SECRET tanımlı değil (geliştirme için geçici anahtar üretilir)');
}

if (env.NODE_ENV === 'production') ok('NODE_ENV=production');
else wr('NODE_ENV=production değil — üretimde ayarlanmalı');

if (env.DB_PATH) ok(`DB_PATH tanımlı: ${env.DB_PATH}`);
else wr('DB_PATH tanımlı değil — ücretsiz planlarda veri sıfırlanabilir');

if (env.TRUST_PROXY === '1') ok('TRUST_PROXY=1 (ters proxy arkasında doğru IP)');
else wr('TRUST_PROXY tanımlı değil — proxy arkasında yanlış IP görülebilir');

if (env.ADMIN_EMAIL) ok(`ADMIN_EMAIL tanımlı: ${env.ADMIN_EMAIL}`);
else wr('ADMIN_EMAIL tanımlı değil — yönetici hesabı oluşturulamaz');

if (env.ADMIN_PASSWORD) {
  if (env.ADMIN_PASSWORD.length >= 12) ok('ADMIN_PASSWORD yeterince uzun');
  else no('ADMIN_PASSWORD 12 karakterden kısa');
} else {
  wr('ADMIN_PASSWORD tanımlı değil');
}

/* ---------------------------------------------------------------- odeme */

section('6. Ödeme altyapısı');

const payments = require('../src/lib/payments');
const cfg = payments.config();

if (cfg.configured) {
  ok(`Ödeme sağlayıcısı yapılandırılmış: ${cfg.providerLabel}`);
  if (cfg.sandbox) wr('Test (sandbox) modunda — canlıya geçmeden kapatın');
} else {
  wr(`Ödeme yapılandırılmadı${cfg.provider ? ` — eksik: ${cfg.missing.join(', ')}` : ''}`);
  console.log('      Siparişler "ödeme bekliyor" kalır; üyelik başlamaz.');
  console.log('      Bu bir hata değil, bilinçli bir güvenlik önlemidir.');
}

/* -------------------------------------------------------------- guvenlik */

section('7. Güvenlik kontrolleri');

const sec = fs.readFileSync(path.join(ROOT, 'src', 'lib', 'security.js'), 'utf8');
if (sec.includes('bcrypt')) ok('Şifreler bcrypt ile hash\'leniyor');
else no('bcrypt kullanılmıyor');

if (sec.includes('timingSafeEqual')) ok('CSRF karşılaştırması sabit zamanlı');
else wr('CSRF karşılaştırması sabit zamanlı değil');

const server = fs.readFileSync(path.join(ROOT, 'src', 'server.js'), 'utf8');
if (server.includes('helmet')) ok('Helmet güvenlik başlıkları etkin');
else no('Helmet yok');
if (server.includes('rateLimit')) ok('Hız sınırı etkin');
else wr('Hız sınırı yok');
if (server.includes("secure: IS_PROD")) ok('Çerez üretimde Secure');
else wr('Çerez Secure bayrağı koşullu değil');

/* --------------------------------------------------------------- altyapi */

section('8. Alan adı ve sertifika');

if (exists('scripts/generate-cert.js')) ok('Sertifika üretici mevcut (yerel HTTPS)');
if (exists('data/tls/cert.pem')) ok('Yerel TLS sertifikası üretilmiş');
else wr('Yerel TLS sertifikası yok — "npm run cert"');

console.log('      Not: Yayında (Render/VPS) sertifikayı platform kurar.');
console.log('      Yerel kendinden imzalı sertifika yayına yüklenmez.');

/* ------------------------------------------------------------------ test */

section('9. Testler');

if (exists('tests/smoke.js')) {
  console.log('      Uçtan uca testleri çalıştırmak için: npm test');
  ok('Duman testi mevcut (53 kontrol)');
} else {
  no('Test dosyası yok');
}

/* --------------------------------------------------------------- ozet */

console.log(`\n${'═'.repeat(58)}`);
console.log(`  SONUÇ:  ${pass} geçti · ${warn} uyarı · ${fail} hata`);
console.log('═'.repeat(58));

if (fail > 0) {
  console.log('\n  ⛔ Yayına ÇIKMAYIN — önce ✗ işaretli maddeleri düzeltin.\n');
  process.exitCode = 1;
} else if (warn > 0) {
  console.log('\n  ⚠️  Yayına çıkabilirsiniz, ancak ! maddelerini gözden geçirin.');
  console.log('     Uyarıların çoğu üretim ortam değişkenleriyle ilgilidir');
  console.log('     ve yayın panelinde ayarlanır (bkz. YAYINA-ALMA.md).\n');
} else {
  console.log('\n  ✅ Her şey hazır. Yayına alabilirsiniz.\n');
}
