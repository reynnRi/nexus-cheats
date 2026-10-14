'use strict';

/**
 * CSRF korumasi ve sifre hash yardimcilari.
 * Dis bagimliligi olmadan, Node'un yerlesik crypto modulu ile calisir.
 */

const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');

const TOKEN_BYTES = 32;
const SECRET_ENV = 'SESSION_SECRET';

/** Oturum basina bir kez uretilen, tahmin edilemez CSRF tokeni. */
function csrfToken(req) {
  if (!req.session) throw new Error('CSRF için oturum gerekli');
  if (!req.session.csrfToken) {
    req.session.csrfToken = crypto.randomBytes(TOKEN_BYTES).toString('hex');
  }
  return req.session.csrfToken;
}

/** Gelen tokeni sabit zamanli karsilastirma ile dogrular. */
function csrfValid(req) {
  const expected = req.session && req.session.csrfToken;
  if (!expected) return false;
  const raw = (req.body && (req.body._csrf || req.body.csrf_token))
    || req.get('x-csrf-token')
    || (req.query && req.query._csrf);
  if (!raw || typeof raw !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(raw);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Tum POST isteklerinde token dogrular. GET/HEAD/OPTIONS serbesttir.
 * Formlarda <input type="hidden" name="_csrf" value="..."> bekler.
 */
function csrfProtection(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  if (csrfValid(req)) return next();
  req.csrfFailure = true;
  const err = new Error('Güvenlik doğrulaması başarısız oldu. Lütfen sayfayı yenileyip tekrar deneyin.');
  err.status = 403;
  return next(err);
}

const BCRYPT_ROUNDS = 12;

async function hashPassword(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

async function verifyPassword(plain, hash) {
  if (!plain || !hash) return false;
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

module.exports = {
  csrfToken,
  csrfValid,
  csrfProtection,
  hashPassword,
  verifyPassword,
  SECRET_ENV,
};
