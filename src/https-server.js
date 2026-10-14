'use strict';

/**
 * HTTPS destekli yerel sunucu.
 *
 * - TLS sertifikasi yoksa (dev) otomatik olarak uretilir (2048-bit RSA, 825 gun).
 * - Sertifika diskte data/tls/ altinda saklanir ve sonraki baslatmalarda yeniden
 *   kullanilir. .env icinde TLS_CERT / TLS_KEY verilirse o dosyalar kullanilir.
 * - Sunucu HTTP ve HTTPS'i AYNI ANDA dinler ve HTTP isteklerini HTTPS'e
 *   yonlendirir. Boylece tarayici "bu site guvenli degil" uyarisi vermez.
 * - HTTP -> HTTPS yonlendirmesindeki Location basligi, istegin Host basligina
 *   gore uretilir; boylece farkli adreslerden (localhost, LAN IP, hosts kaydi)
 *   erisim de sorunsuz calisir.
 *
 *   node src/https-server.js
 */

require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const app = require('./server');

const HTTPS_PORT = Number(process.env.HTTPS_PORT || process.env.PORT || 3443);
const HTTP_PORT = Number(process.env.HTTP_PORT || 3080);
const HOST = process.env.HOST || '0.0.0.0';

const TLS_DIR = path.join(__dirname, '..', 'data', 'tls');
const CERT_PATH = process.env.TLS_CERT || path.join(TLS_DIR, 'cert.pem');
const KEY_PATH = process.env.TLS_KEY || path.join(TLS_DIR, 'key.pem');

/* ------------------------------------------------ sertifika uretimi */

/** Node ile kendinden imzali sertifika uretir (OpenSSL gerekmez). */
function generateWithNode(certPath, keyPath) {
  const generator = require('../scripts/generate-cert');
  const { certPem, keyPem } = generator.generate();
  fs.writeFileSync(certPath, certPem, { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(keyPath, keyPem, { encoding: 'utf8', mode: 0o600 });
}

/** OpenSSL varsa onu kullanir; yoksa Node ile uretir. */
function generateWithOpenSSL(certPath, keyPath) {
  let openssl = null;
  try {
    execFileSync('openssl', ['version'], { stdio: 'ignore' });
    openssl = 'openssl';
  } catch {
    openssl = null;
  }

  if (!openssl) {
    generateWithNode(certPath, keyPath);
    return;
  }

  const altNames = ['DNS:localhost', 'IP:127.0.0.1'];

  // Makinenin yerel IPv4 adreslerini SAN listesine ekle.
  try {
    const nets = require('node:os').networkInterfaces();
    for (const list of Object.values(nets)) {
      for (const net of list || []) {
        if (net.family === 'IPv4' && !net.internal) altNames.push(`IP:${net.address}`);
      }
    }
  } catch { /* yok say */ }

  const config = [
    '[req]',
    'distinguished_name = dn',
    'x509_extensions = v3',
    'prompt = no',
    '[dn]',
    'C = TR',
    'O = NEXUS CHEATS (Gelistirme)',
    'CN = localhost',
    '[v3]',
    'basicConstraints = critical, CA:FALSE',
    'keyUsage = critical, digitalSignature, keyEncipherment',
    'extendedKeyUsage = serverAuth',
    `subjectAltName = ${altNames.join(', ')}`,
  ].join('\n');

  const configPath = path.join(TLS_DIR, 'openssl.cnf');
  fs.writeFileSync(configPath, config, 'utf8');

  execFileSync('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', keyPath, '-out', certPath,
    '-days', '825', '-config', configPath,
  ], { stdio: 'ignore' });

  fs.rmSync(configPath, { force: true });
}

/* ------------------------------------------------------ ana akis */

function ensureCertificate() {
  if (fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) return 'mevcut';

  fs.mkdirSync(TLS_DIR, { recursive: true });

  try {
    generateWithOpenSSL(CERT_PATH, KEY_PATH);
    return 'yeni üretildi';
  } catch (err) {
    console.warn('[HTTPS] Sertifika üretilemedi:', err.message);
    return 'yok';
  }
}

function readCredentials() {
  return {
    cert: fs.readFileSync(CERT_PATH, 'utf8'),
    key: fs.readFileSync(KEY_PATH, 'utf8'),
  };
}

/** Istegin Host basligina gore guvenli HTTPS adresi uretir. */
function httpsUrlFor(req) {
  const host = String(req.headers.host || 'localhost').replace(/:\d+$/, '');
  const portSuffix = HTTPS_PORT === 443 ? '' : `:${HTTPS_PORT}`;
  return `https://${host}${portSuffix}${req.url}`;
}

function start() {
  const certStatus = ensureCertificate();

  if (!fs.existsSync(CERT_PATH) || !fs.existsSync(KEY_PATH)) {
    console.error("\n[TLS] Sertifika üretilemedi.");
    console.error('  1) OpenSSL kurun ve tekrar deneyin.');
    console.error('  2) .env içine TLS_CERT ve TLS_KEY yollarını tanımlayın.');
    console.error('  3) Sertifikasız çalıştırmak için: npm start\n');
    process.exitCode = 1;
    return;
  }

  const credentials = readCredentials();

  const secure = https.createServer(
    { cert: credentials.cert, key: credentials.key, minVersion: 'TLSv1.2' },
    app,
  );

  const redirector = http.createServer((req, res) => {
    // Saglik ucu HTTP uzerinden de yanit verir (izleme araclari icin).
    if (req.url === '/saglik') {
      res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: true, app: 'NEXUS CHEATS', https: true }));
      return;
    }
    res.writeHead(301, { location: httpsUrlFor(req) });
    res.end();
  });

  secure.listen(HTTPS_PORT, HOST, () => {
    console.log(`\nNEXUS CHEATS (HTTPS) → https://localhost:${HTTPS_PORT}`);
    console.log(`HTTP → HTTPS yönlendirmesi → http://localhost:${HTTP_PORT}`);
    console.log(`Sertifika: ${CERT_PATH} (${certStatus})`);
    console.log('\nNot: Sertifika kendinden imzalıdır; tarayıcı ilk açılışta');
    console.log('"Gelişmiş → Devam et" adımını isteyebilir.\n');
  });

  redirector.listen(HTTP_PORT, HOST);

  const shutdown = () => {
    secure.close();
    redirector.close();
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

/** Gelistirme icin anahtar uretimi (OpenSSL yoksa). */
function generateFallbackHint() {
  console.log('İpucu: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
}

if (require.main === module) {
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    console.warn('[NEXUS] UYARI: SESSION_SECRET tanımlı değil veya kısa; geliştirme anahtarı kullanılacak.');
  }
  start();
}

module.exports = { start, httpsUrlFor, CERT_PATH, KEY_PATH, HTTPS_PORT, HTTP_PORT };
