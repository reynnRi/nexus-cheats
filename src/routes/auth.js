'use strict';

/** Kayit, giris ve cikis. */

const express = require('express');
const rateLimit = require('express-rate-limit');
const { users } = require('../models');
const { schemas, validate } = require('../lib/validate');
const { flash } = require('../middleware/context');
const { requireGuest } = require('../middleware/auth');

const router = express.Router();

/** Kaba kuvvet denemelerini sinirlar. */
const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: 'Çok fazla deneme yaptınız. Lütfen 10 dakika sonra tekrar deneyin.',
});

function safeRedirect(target, fallback) {
  if (typeof target === 'string' && target.startsWith('/') && !target.startsWith('//')) return target;
  return fallback;
}

router.get('/kayit', requireGuest, (req, res) => {
  res.render('auth/register', {
    pageTitle: 'Üye Ol — NEXUS CHEATS',
    form: { fullName: '', email: '' },
    errors: {},
  });
});

router.post('/kayit', requireGuest, authLimiter, async (req, res, next) => {
  try {
    const result = validate(schemas.register, req.body);
    if (!result.ok) {
      return res.status(422).render('auth/register', {
        pageTitle: 'Üye Ol — NEXUS CHEATS',
        form: { fullName: req.body.fullName || '', email: req.body.email || '' },
        errors: result.errors,
      });
    }

    const { fullName, email, password } = result.data;
    if (users.findByEmail(email)) {
      return res.status(409).render('auth/register', {
        pageTitle: 'Üye Ol — NEXUS CHEATS',
        form: { fullName, email },
        errors: { email: 'Bu e-posta adresiyle kayıtlı bir hesap zaten var.' },
      });
    }

    const user = await users.create({ email, password, fullName });
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      flash(req, 'success', `Hoş geldiniz ${user.full_name}! Hesabınız oluşturuldu.`);
      return res.redirect('/panel');
    });
  } catch (err) {
    return next(err);
  }
});

router.get('/giris', requireGuest, (req, res) => {
  res.render('auth/login', {
    pageTitle: 'Giriş Yap — NEXUS CHEATS',
    form: { email: '' },
    errors: {},
    next: safeRedirect(req.query.devam, '/panel'),
  });
});

router.post('/giris', requireGuest, authLimiter, async (req, res, next) => {
  try {
    const result = validate(schemas.login, req.body);
    if (!result.ok) {
      return res.status(422).render('auth/login', {
        pageTitle: 'Giriş Yap — NEXUS CHEATS',
        form: { email: req.body.email || '' },
        errors: result.errors,
        next: safeRedirect(req.body.next, '/panel'),
      });
    }

    const { email, password } = result.data;
    const user = users.findByEmail(email);
    const ok = user ? await users.checkPassword(user, password) : false;

    if (!ok) {
      return res.status(401).render('auth/login', {
        pageTitle: 'Giriş Yap — NEXUS CHEATS',
        form: { email },
        errors: { _: 'E-posta adresi veya şifre hatalı.' },
        next: safeRedirect(req.body.next, '/panel'),
      });
    }

    if (user.is_blocked) {
      return res.status(403).render('auth/login', {
        pageTitle: 'Giriş Yap — NEXUS CHEATS',
        form: { email },
        errors: { _: 'Hesabınız askıya alınmış. Destek ekibiyle iletişime geçin.' },
        next: '/panel',
      });
    }

    const target = safeRedirect(req.body.next, user.role === 'admin' ? '/admin' : '/panel');
    return req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      flash(req, 'success', `Tekrar hoş geldiniz, ${user.full_name}.`);
      return res.redirect(target);
    });
  } catch (err) {
    return next(err);
  }
});

router.post('/cikis', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('nexus.sid');
    return res.redirect('/');
  });
});

module.exports = router;
