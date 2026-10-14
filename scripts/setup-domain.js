'use strict';

/**
 * NEXUS CHEATS — Chrome'da güvenilir HTTPS için yerel alan adı kurulumu.
 *
 * Yaptığı iş:
 *   1) TLS sertifikasını üretir (yoksa).
 *   2) hosts dosyasına "127.0.0.1  nexuscheats.local" satırını ekler.
 *   3) Sertifikayı Windows "Güvenilen Kök Sertifika Yetkilileri" deposuna ekler.
 *   4) Sertifikanın geçerliliğini doğrular.
 *
 * Böylece Chrome https://nexuscheats.local adresini uyarı VERMEDEN açar.
 *
 * Kullanım (yönetici PowerShell / cmd gerekir):
 *   npm run setup-domain
 *
 * Yönetici yetkisi yoksa hosts ve sertifika deposu adımları başarısız olur;
 * script size hangi komutu yönetici olarak çalıştırmanız gerektiğini söyler.
 */

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const ROOT = path.join(__dirname, '..');
const DOMAIN = process.env.LOCAL_DOMAIN || 'nexuscheats.local';
const HOSTS_PATH = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'drivers', 'etc', 'hosts');
const TLS_DIR = path.join(ROOT, 'data', 'tls');
const CERT_PATH = path.join(TLS_DIR, 'cert.pem');
const KEY_PATH = path.join(TLS_DIR, 'key.pem');
const CER_PATH = path.join(TLS_DIR, `${DOMAIN}.cer`);

const step = (n, text) => console.log(`\n[${n}/4] ${text}`);
const ok = (t) => console.log(`      ✓ ${t}`);
const warn = (t) => console.log(`      ! ${t}`);
const fail = (t) => console.log(`      ✗ ${t}`);

/* ------------------------------------------------------------ yetki testi */

function isAdmin() {
  try {
    execFileSync('net', ['session'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

/* ------------------------------------------------- 1) sertifika uretimi */

function ensureCertificate() {
  if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    // Mevcut sertifikada alan adi SAN olarak var mi?
    const pem = fs.readFileSync(CERT_PATH, 'utf8');
    const x509 = new crypto.X509Certificate(pem);
    const hasDomain = /DNS:?nexuscheats\.local/i.test(x509.subjectAltName || '')
      || (x509.subjectAltName || '').toLowerCase().includes(DOMAIN.toLowerCase());
    if (hasDomain) {
      ok(`sertifika mevcut ve ${DOMAIN} içeriyor`);
      return true;
    }
    warn(`sertifika mevcut ancak ${DOMAIN} içermiyor, yeniden üretiliyor`);
  } else {
    warn('sertifika bulunamadı, üretiliyor');
  }

  const generator = require('./generate-cert');
  const { certPem, keyPem, dnsNames } = generator.generate({
    commonName: DOMAIN,
    extraDnsNames: [DOMAIN, `www.${DOMAIN}`],
  });

  fs.mkdirSync(TLS_DIR, { recursive: true });
  fs.writeFileSync(CERT_PATH, certPem, { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(KEY_PATH, keyPem, { encoding: 'utf8', mode: 0o600 });

  const x509 = new crypto.X509Certificate(certPem);
  ok(`sertifika üretildi — CN=${DOMAIN}`);
  ok(`SAN: ${dnsNames.join(', ')}`);
  return true;
}

/* ------------------------------------------------------ 2) hosts kaydi */

function ensureHostsEntry() {
  let content = '';
  try {
    content = fs.readFileSync(HOSTS_PATH, 'utf8');
  } catch (err) {
    fail(`hosts dosyası okunamadı: ${err.message}`);
    return false;
  }

  const lines = content.split(/\r?\n/);
  const already = lines.some((line) => {
    const clean = line.replace(/#.*/, '').trim();
    if (!clean) return false;
    const parts = clean.split(/\s+/);
    return parts.includes(DOMAIN) || parts.includes(`www.${DOMAIN}`);
  });

  if (already) {
    ok(`hosts dosyasında ${DOMAIN} kaydı zaten var`);
    return true;
  }

  const addition = [
    '',
    '# NEXUS CHEATS — yerel geliştirme alan adı',
    `127.0.0.1    ${DOMAIN}`,
    `127.0.0.1    www.${DOMAIN}`,
    '',
  ].join('\r\n');

  try {
    fs.appendFileSync(HOSTS_PATH, addition, 'utf8');
    ok(`hosts dosyasına eklendi: 127.0.0.1 → ${DOMAIN}`);
    return true;
  } catch (err) {
    fail(`hosts dosyasına yazılamadı (${err.code})`);
    console.log('\n      Yönetici olarak şu komutu çalıştırın:');
    console.log('      ─────────────────────────────────────────');
    console.log(`      Add-Content -Path "$env:SystemRoot\\System32\\drivers\\etc\\hosts" -Value "\`n127.0.0.1 ${DOMAIN}\`n127.0.0.1 www.${DOMAIN}"`);
    return false;
  }
}

/* ------------------------------------------ 3) sertifika deposuna ekleme */

function ensureTrustedRoot() {
  // certutil .cer dosyasi ister; PEM'i DER'e cevir.
  const pem = fs.readFileSync(CERT_PATH, 'utf8');
  const b64 = pem.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Buffer.from(b64, 'base64');
  fs.writeFileSync(CER_PATH, der);

  try {
    execFileSync('certutil', ['-addstore', '-f', 'Root', CER_PATH], { stdio: 'ignore' });
    ok('sertifika "Güvenilen Kök Sertifika Yetkilileri" deposuna eklendi');
    return true;
  } catch (err) {
    fail('sertifika deposuna eklenemedi (yönetici yetkisi gerekir)');
    console.log('\n      Yönetici olarak şu komutu çalıştırın:');
    console.log('      ─────────────────────────────────────────');
    console.log(`      certutil -addstore -f Root "${CER_PATH}"`);
    return false;
  }
}

/* ------------------------------------------------------ 4) dogrulama */

function verify() {
  try {
    const pem = fs.readFileSync(CERT_PATH, 'utf8');
    const x509 = new crypto.X509Certificate(pem);
    const selfSigned = x509.verify(x509.publicKey);
    const san = x509.subjectAltName || '';
    ok(`imza geçerli: ${selfSigned ? 'evet' : 'HAYIR'}`);
    ok(`geçerlilik bitişi: ${x509.validTo}`);
    ok(`${DOMAIN} SAN içinde: ${san.toLowerCase().includes(DOMAIN.toLowerCase()) ? 'evet' : 'HAYIR'}`);
    return selfSigned;
  } catch (err) {
    fail(`doğrulama hatası: ${err.message}`);
    return false;
  }
}

/* --------------------------------------------------------------- main */

function main() {
  console.log('NEXUS CHEATS — yerel alan adı kurulumu');
  console.log(`Alan adı: https://${DOMAIN}`);

  const admin = isAdmin();
  if (!admin) {
    console.log('\n! Bu işlem YÖNETİCİ yetkisi gerektirir.');
    console.log('  PowerShell\'i "Yönetici olarak çalıştır" ile açıp tekrar deneyin:');
    console.log(`  cd "${ROOT}"`);
    console.log('  npm run setup-domain\n');
  }

  step(1, 'TLS sertifikası');
  const certOk = ensureCertificate();

  step(2, 'hosts dosyası kaydı');
  const hostsOk = ensureHostsEntry();

  step(3, 'Güvenilen kök sertifika deposu');
  const trustOk = ensureTrustedRoot();

  step(4, 'Doğrulama');
  const valid = verify();

  console.log('\n' + '─'.repeat(58));
  if (certOk && hostsOk && trustOk && valid) {
    console.log('KURULUM TAMAM.');
    console.log(`\nChrome\'da açın:  https://${DOMAIN}`);
    console.log('\nSunucuyu başlatmayı unutmayın:  npm run https');
  } else {
    console.log('KURULUM TAMAMLANMADI — yukarıdaki ✗ satırlarına bakın.');
    console.log('Yönetici PowerShell açıp tekrar çalıştırın:');
    console.log(`  cd "${ROOT}"`);
    console.log('  npm run setup-domain');
  }
  console.log('─'.repeat(58) + '\n');
}

if (require.main === module) main();

module.exports = { DOMAIN, CERT_PATH, KEY_PATH, ensureCertificate };
