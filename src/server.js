'use strict';

/** NEXUS CHEATS — uygulama giris noktasi. */

require('dotenv').config();

const path = require('node:path');
const crypto = require('node:crypto');
const express = require('express');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts');

const { DB_PATH } = require('./db');
const { csrfProtection } = require('./lib/security');
const { currentUserMiddleware, viewGlobals, flash } = require('./middleware/context');
const publicRoutes = require('./routes/public');
const authRoutes = require('./routes/auth');
const panelRoutes = require('./routes/panel');
const paymentRoutes = require('./routes/payment');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const IS_PROD = process.env.NODE_ENV === 'production';

/* ------------------------------------------------------------- guvenlik */

const scriptSrc = ["'self'", "'unsafe-inline'"];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc,
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: ["'self'"],
      formAction: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: 'same-origin' },
}));

app.disable('x-powered-by');

/* --------------------------------------------------------------- govde */

app.use(express.urlencoded({ extended: false, limit: '64kb' }));
app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

/* -------------------------------------------------------------- oturum */

let secret = process.env.SESSION_SECRET;
if (!secret || secret.length < 32) {
  if (IS_PROD) {
    throw new Error(
      'Üretim ortamında SESSION_SECRET tanımlanmalı (en az 32 karakter). .env dosyasına ekleyin.',
    );
  }
  secret = crypto.randomBytes(32).toString('hex');
  console.warn('[NEXUS] UYARI: SESSION_SECRET tanımlı değil. Geliştirme için geçici anahtar üretildi.');
}

app.use(session({
  name: 'nexus.sid',
  secret,
  resave: false,
  saveUninitialized: false,
  rolling: true,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: IS_PROD,
    maxAge: 1000 * 60 * 60 * 8,
  },
}));

/* --------------------------------------------------------------- statik */

app.use(express.static(path.join(__dirname, '..', 'public'), {
  maxAge: IS_PROD ? '7d' : 0,
  etag: true,
}));

/* ------------------------------------------------------------ sablonlar */

app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');
app.use(expressLayouts);
app.set('layout', 'layouts/base');

/* ------------------------------------------- genel hiz siniri ve baglam */

app.use(rateLimit({
  windowMs: 60 * 1000,
  limit: 240,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
}));

app.use(currentUserMiddleware);
app.use(viewGlobals);
// Odeme saglayicisi callback ucnoktasi CSRF korumasindan muaftir: saglayicidan
// gelen sunucu-sunucu istek oturum cerezi tasimaz. Guvenlik, saglayicinin
// imza dogrulamasiyla saglanir ve uc nokta yapilandirma yoksa her zaman reddeder.
app.use((req, res, next) => {
  if (req.method === 'POST' && req.path === '/odeme/callback') return next();
  return csrfProtection(req, res, next);
});

/* -------------------------------------------------------------- rotalar */

/** Siparis sonrasi HTTPS'e zorlanan devam adimi (bkz. /panel/siparis). */
app.get('/odeme-devam', (req, res) => {
  const orderNo = req.query.siparis;
  const target = orderNo
    ? `/panel/siparisler/${encodeURIComponent(String(orderNo))}`
    : '/panel/siparisler';
  return res.redirect(target);
});

app.get('/saglik', (req, res) => {
  res.json({ ok: true, app: 'NEXUS CHEATS', db: path.basename(DB_PATH) });
});

app.get('/urunlerim', (req, res) => res.redirect('/urunler'));
app.get('/paket', (req, res) => res.redirect('/paketler'));

app.use('/', publicRoutes.router);
app.use('/', authRoutes);
app.use('/panel', panelRoutes.router);
app.use('/admin', adminRoutes);

/* ------------------------------------------- odeme saglayici callback'i */

// Saglayicidan gelen sunucu-sunucu istegi oturum cerezi tasimadigi icin CSRF
// korumasi bu ucnoktaya uygulanmaz; guvenlik imza dogrulamasiyla saglanir.
// Saglayici yapilandirilmadigi surece uc nokta her zaman reddeder.
app.post('/odeme/callback', (req, res, next) => next());

app.use('/odeme', paymentRoutes);

/* -------------------------------------------------------------- hatalar */

app.use((req, res) => {
  res.status(404).render('errors/error', {
    pageTitle: 'Sayfa bulunamadı — NEXUS CHEATS',
    status: 404,
    heading: '404 — Sayfa bulunamadı',
    message: 'Aradığınız sayfa taşınmış ya da hiç var olmamış olabilir.',
  });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || 500;

  if (status === 401) {
    if (req.session) flash(req, 'info', err.message || 'Lütfen giriş yapın.');
    const target = req.originalUrl && req.originalUrl.startsWith('/')
      ? `/giris?devam=${encodeURIComponent(req.originalUrl)}`
      : '/giris';
    return res.redirect(target);
  }

  if (status >= 500) console.error('[NEXUS]', err);

  const headings = {
    403: '403 — Erişim reddedildi',
    404: '404 — Bulunamadı',
    409: '409 — Çakışma',
    422: '422 — Geçersiz istek',
    503: '503 — Hizmet kullanılamıyor',
  };

  return res.status(status).render('errors/error', {
    pageTitle: `${status} — NEXUS CHEATS`,
    status,
    heading: headings[status] || `${status} — Bir hata oluştu`,
    message: status >= 500
      ? 'Beklenmeyen bir hata oluştu. Lütfen kısa süre sonra tekrar deneyin.'
      : err.message,
  });
});

/* ----------------------------------------------------------------- start */

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`NEXUS CHEATS çalışıyor → http://localhost:${PORT}`);
    console.log(`Veritabanı: ${DB_PATH}`);
  });
}

module.exports = app;
