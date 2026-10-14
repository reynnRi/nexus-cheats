'use strict';

/**
 * Chrome uyumlu, kendinden imzali TLS sertifikasi uretir.
 *
 * OpenSSL kurulu olmasa da calisir: anahtar cifti Node ile uretilir, X.509
 * sertifikasi ASN.1/DER seviyesinde elle olusturulur ve PEM'e cevrilir.
 *
 * Chrome'un kabul ettigi yapi:
 *   - v3 sertifika, zorunlu temel uzantilar
 *   - basicConstraints: CA:FALSE, pathLen yok
 *   - keyUsage: digitalSignature + keyEncipherment
 *   - extendedKeyUsage: serverAuth
 *   - subjectKeyIdentifier + authorityKeyIdentifier
 *   - subjectAltName: alan adlari ve IP adresleri
 *
 * Kullanim:
 *   node scripts/generate-cert.js [--force] [--cn=alan.adi]
 */

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const TLS_DIR = path.join(__dirname, '..', 'data', 'tls');
const CERT_PATH = path.join(TLS_DIR, 'cert.pem');
const KEY_PATH = path.join(TLS_DIR, 'key.pem');

const FORCE = process.argv.includes('--force');
const CN_ARG = (process.argv.find((a) => a.startsWith('--cn=')) || '').split('=')[1];

/* --------------------------------------------------- ASN.1 / DER araclari */

function derLength(len) {
  if (len < 0x80) return Buffer.from([len]);
  const bytes = [];
  let n = len;
  while (n > 0) { bytes.unshift(n & 0xff); n >>>= 8; }
  return Buffer.from([0x80 | bytes.length, ...bytes]);
}

function der(tag, content) {
  const body = Buffer.isBuffer(content) ? content : Buffer.from(content);
  return Buffer.concat([Buffer.from([tag]), derLength(body.length), body]);
}

const SEQ = 0x30;
const SET = 0x31;
const INT = 0x02;
const BITSTR = 0x03;
const OCTSTR = 0x04;
const NULL = 0x05;
const OID = 0x06;
const PRINTABLESTR = 0x13;
const UTF8 = 0x0c;
const BOOL = 0x01;
const UTCTIME = 0x17;
const CTX = (n, constructed = true) => (constructed ? 0xa0 : 0x80) | n;

function derInt(value) {
  let buf;
  if (Buffer.isBuffer(value)) {
    // Ham bayt dizisi: basindaki gereksiz sifirlari temizle.
    let i = 0;
    while (i < value.length - 1 && value[i] === 0x00) i += 1;
    buf = value.subarray(i);
  } else if (typeof value === 'bigint') {
    let hex = value.toString(16);
    if (hex.length % 2) hex = `0${hex}`;
    buf = Buffer.from(hex, 'hex');
  } else {
    // Kucuk tam sayilar (surum numarasi gibi) icin dogru yol: sayidan bayt uret.
    const bytes = [];
    let n = Number(value);
    do { bytes.unshift(n & 0xff); n = Math.floor(n / 256); } while (n > 0);
    buf = Buffer.from(bytes);
  }
  // Pozitif kalsin diye bas bayt 1 ise basa 0x00 eklenir.
  if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0x00]), buf]);
  return der(INT, buf);
}

function derOid(oid) {
  const parts = oid.split('.').map(Number);
  const bytes = [parts[0] * 40 + parts[1]];
  for (let i = 2; i < parts.length; i += 1) {
    let v = parts[i];
    const stack = [v & 0x7f];
    v >>>= 7;
    while (v > 0) { stack.unshift((v & 0x7f) | 0x80); v >>>= 7; }
    bytes.push(...stack);
  }
  return der(OID, Buffer.from(bytes));
}

function derUtcTime(date) {
  const p = (n) => String(n).padStart(2, '0');
  const s = `${p(date.getUTCFullYear() % 100)}${p(date.getUTCMonth() + 1)}${p(date.getUTCDate())}`
    + `${p(date.getUTCHours())}${p(date.getUTCMinutes())}${p(date.getUTCSeconds())}Z`;
  return der(UTCTIME, Buffer.from(s, 'ascii'));
}

/** RDNSequence — CN, O, C. */
function derName({ commonName, organization, country }) {
  const rdn = (oid, value, tag = PRINTABLESTR) => der(SET, der(SEQ, Buffer.concat([
    derOid(oid),
    der(tag, Buffer.from(value, 'ascii')),
  ])));
  return der(SEQ, Buffer.concat([
    rdn('2.5.4.3', commonName),
    rdn('2.5.4.10', organization),
    rdn('2.5.4.6', country),
  ]));
}

/** X.501 Name'in DER kodlamasi (key identifier icin hash girdisi). */
function nameDerBytes(name) {
  return name;
}

function ipToOctets(ip) {
  return Buffer.from(ip.split('.').map((n) => Number(n) & 0xff));
}

/** GeneralNames: dNSName [2], iPAddress [7] */
function generalNames(dnsNames, ipAddresses) {
  const entries = [];
  for (const name of dnsNames) entries.push(der(0x82, Buffer.from(name, 'ascii')));
  for (const ip of ipAddresses) entries.push(der(0x87, ipToOctets(ip)));
  return der(SEQ, Buffer.concat(entries));
}

/** Extension ::= SEQUENCE { extnID, critical BOOLEAN DEFAULT FALSE, extnValue OCTET STRING } */
function extension(oid, critical, valueDer) {
  const parts = [derOid(oid)];
  if (critical) parts.push(der(BOOL, Buffer.from([0xff])));
  parts.push(der(OCTSTR, valueDer));
  return der(SEQ, Buffer.concat(parts));
}

/** SHA-1 tabanli 20 baytlik anahtar kimligi. */
function keyIdentifier(publicKeyDer) {
  return crypto.createHash('sha1').update(publicKeyDer).digest();
}

/* ------------------------------------------------------ alternatif adlar */

function collectAltNames(extraDnsNames = []) {
  const dnsNames = ['localhost', ...extraDnsNames];
  const ipAddresses = ['127.0.0.1'];

  for (const list of Object.values(os.networkInterfaces())) {
    for (const net of list || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ipAddresses.push(net.address);
        dnsNames.push(`${net.address.replace(/\./g, '-')}.nip.io`);
      }
    }
  }
  return { dnsNames: [...new Set(dnsNames)], ipAddresses: [...new Set(ipAddresses)] };
}

/* ---------------------------------------------------- sertifika uretimi */

function generate({
  commonName = 'localhost',
  organization = 'NEXUS CHEATS (Gelistirme)',
  country = 'TR',
  extraDnsNames = [],
} = {}) {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'der' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  const { dnsNames, ipAddresses } = collectAltNames(extraDnsNames);
  const now = new Date();
  const notBefore = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const notAfter = new Date(now.getTime() + 825 * 24 * 60 * 60 * 1000);

  const serial = crypto.randomBytes(16);
  serial[0] &= 0x7f;
  if (serial[0] === 0) serial[0] = 1;
  // sha256WithRSAEncryption
  const sigAlg = der(SEQ, Buffer.concat([
    derOid('1.2.840.113549.1.1.11'),
    der(NULL, Buffer.alloc(0)),
  ]));

  const name = derName({ commonName, organization, country });
  const ski = keyIdentifier(publicKey);
  const aki = ski; // kendinden imzali: ayni anahtar

  const extensions = der(CTX(3, true), der(SEQ, Buffer.concat([
    // basicConstraints: critical, CA:FALSE (yalnizca cA bayragi; pathLen yok)
    extension('2.5.29.19', true, der(SEQ, Buffer.concat([
      der(BOOL, Buffer.from([0x00])),
    ]))),

    // keyUsage: critical, digitalSignature(0) + keyEncipherment(2)
    extension('2.5.29.15', true, der(BITSTR, Buffer.concat([
      Buffer.from([0x05]),       // 5 kullanilmayan bit
      Buffer.from([0xa0]),       // 1010 0000 -> bit0 ve bit2 set
    ]))),

    // extendedKeyUsage: serverAuth (non-critical)
    extension('2.5.29.37', false, der(SEQ, derOid('1.3.6.1.5.5.7.3.1'))),

    // subjectAltName (non-critical)
    extension('2.5.29.17', false, generalNames(dnsNames, ipAddresses)),

    // subjectKeyIdentifier
    extension('2.5.29.14', false, der(OCTSTR, ski)),

    // authorityKeyIdentifier
    extension('2.5.29.35', false, der(SEQ, der(CTX(0, false), aki))),
  ])));

  const tbs = der(SEQ, Buffer.concat([
    der(CTX(0, true), derInt(2)),   // version v3
    derInt(serial),
    sigAlg,
    name,                            // issuer
    der(SEQ, Buffer.concat([         // validity
      derUtcTime(notBefore),
      derUtcTime(notAfter),
    ])),
    name,                            // subject
    publicKey,                       // SubjectPublicKeyInfo (DER)
    extensions,
  ]));

  const signature = crypto.sign('sha256', tbs, {
    key: crypto.createPrivateKey(privateKey),
    padding: crypto.constants.RSA_PKCS1_PADDING,
  });

  const certificate = der(SEQ, Buffer.concat([
    tbs,
    sigAlg,
    der(BITSTR, Buffer.concat([Buffer.from([0x00]), signature])),
  ]));

  const toPem = (label, buf) => {
    const b64 = buf.toString('base64').replace(/(.{64})/g, '$1\n').replace(/\n$/, '');
    return `-----BEGIN ${label}-----\n${b64}\n-----END ${label}-----\n`;
  };

  return {
    certPem: toPem('CERTIFICATE', certificate),
    keyPem: privateKey,
    certDer: certificate,
    dnsNames,
    ipAddresses,
    notAfter,
    notBefore,
  };
}

/* --------------------------------------------------------------- dogrulama */

/** Sertifikayi Chrome'un yaptigi gibi kontrol eder. */
function selfCheck(certPem, keyPem) {
  const problems = [];
  const x509 = new crypto.X509Certificate(certPem);

  // 1) imza
  if (!x509.verify(x509.publicKey)) problems.push('imza doğrulanamadı');

  // 2) gecerlilik
  const now = Date.now();
  if (new Date(x509.validFrom).getTime() > now) problems.push('sertifika henüz geçerli değil');
  if (new Date(x509.validTo).getTime() < now) problems.push('sertifika süresi dolmuş');

  // 3) SAN
  if (!x509.subjectAltName) problems.push('subjectAltName yok (Chrome zorunlu tutar)');

  // 4) basicConstraints CA:FALSE
  if (x509.ca) problems.push('basicConstraints CA:TRUE (uç sertifika CA olmamalı)');

  // 5) anahtar kullanimi
  const ku = x509.keyUsage || [];
  if (!ku.includes('1.3.6.1.5.5.7.3.1')) problems.push('extendedKeyUsage serverAuth yok');

  // 6) anahtar ile sertifika eslesiyor mu
  const priv = crypto.createPrivateKey(keyPem);
  const pubFromPriv = crypto.createPublicKey(priv).export({ type: 'spki', format: 'der' });
  const pubFromCert = x509.publicKey.export({ type: 'spki', format: 'der' });
  if (!pubFromPriv.equals(pubFromCert)) problems.push('özel anahtar sertifikayla eşleşmiyor');

  // 7) TLS baglami kurulabiliyor mu
  try {
    require('node:tls').createSecureContext({ cert: certPem, key: keyPem });
  } catch (err) {
    problems.push(`TLS bağlamı kurulamadı: ${err.message}`);
  }

  return { problems, x509 };
}

/* ---------------------------------------------------------------------- main */

function main() {
  fs.mkdirSync(TLS_DIR, { recursive: true });

  if (!FORCE && fs.existsSync(CERT_PATH) && fs.existsSync(KEY_PATH)) {
    const existing = fs.readFileSync(CERT_PATH, 'utf8');
    const { problems } = selfCheck(existing, fs.readFileSync(KEY_PATH, 'utf8'));
    if (problems.length === 0 && !CN_ARG) {
      console.log('Sertifika mevcut ve geçerli:');
      console.log(`  ${CERT_PATH}`);
      console.log(`  ${KEY_PATH}`);
      console.log('Yeniden üretmek için: node scripts/generate-cert.js --force');
      return;
    }
    console.log('Mevcut sertifika yeniden üretiliyor...');
    for (const p of problems) console.log(`  ! ${p}`);
  }

  const commonName = CN_ARG || 'nexuscheats.local';
  const result = generate({
    commonName,
    extraDnsNames: commonName === 'localhost' ? [] : [commonName, `www.${commonName}`],
  });

  const { problems, x509 } = selfCheck(result.certPem, result.keyPem);

  if (problems.length > 0) {
    console.error('Sertifika doğrulaması BAŞARISIZ:');
    for (const p of problems) console.error(`  ✗ ${p}`);
    process.exitCode = 1;
    return;
  }

  fs.writeFileSync(CERT_PATH, result.certPem, { encoding: 'utf8', mode: 0o600 });
  fs.writeFileSync(KEY_PATH, result.keyPem, { encoding: 'utf8', mode: 0o600 });

  // Windows sertifika deposu icin DER kopyasi
  const cerPath = path.join(TLS_DIR, `${commonName}.cer`);
  fs.writeFileSync(cerPath, result.certDer);

  const daysLeft = Math.round((result.notAfter.getTime() - Date.now()) / 86400000);

  console.log('Kendinden imzalı TLS sertifikası oluşturuldu ve doğrulandı:');
  console.log(`  Sertifika : ${CERT_PATH}`);
  console.log(`  Anahtar   : ${KEY_PATH}`);
  console.log(`  Windows   : ${cerPath}`);
  console.log(`  Konu      : ${x509.subject.replace(/\n/g, ', ')}`);
  console.log(`  Geçerlilik: ${daysLeft} gün (${x509.validTo})`);
  console.log(`  SAN DNS   : ${result.dnsNames.join(', ')}`);
  console.log(`  SAN IP    : ${result.ipAddresses.join(', ')}`);
  console.log('  Kontroller: imza ✓  SAN ✓  CA:FALSE ✓  serverAuth ✓  anahtar eşleşmesi ✓  TLS bağlamı ✓');
}

if (require.main === module) main();

module.exports = { generate, selfCheck, CERT_PATH, KEY_PATH };
