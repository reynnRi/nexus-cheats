'use strict';

/** Kullanici paneli: uyelik, siparisler, profil, destek. */

const express = require('express');
const {
  users, orders, memberships, support, plans, products, createPendingOrder,
} = require('../models');
const { schemas, validate } = require('../lib/validate');
const { membershipStatus } = require('../lib/format');
const { flash } = require('../middleware/context');
const { requireAuth } = require('../middleware/auth');
const payments = require('../lib/payments');

const router = express.Router();
router.use(requireAuth);

/* ----------------------------------------------------------- genel bakis */

router.get('/', (req, res) => {
  const user = req.currentUser;
  const orderList = orders.listByUser(user.id).slice(0, 5);
  const ticketList = support.listByUser(user.id).slice(0, 4);
  const membershipList = memberships.historyByUser(user.id);

  res.render('panel/dashboard', {
    pageTitle: 'Kullanıcı Paneli — NEXUS CHEATS',
    bodyClass: 'page-panel',
    activeNav: 'panel',
    orderList,
    ticketList,
    membershipList,
    paymentStatus: payments.statusSummary(),
    unlockedProducts: products.listAll({ includeInactive: false }),
  });
});

/* ------------------------------------------------------------- siparisler */

router.get('/siparisler', (req, res) => {
  res.render('panel/orders', {
    pageTitle: 'Siparişlerim — NEXUS CHEATS',
    bodyClass: 'page-panel',
    activeNav: 'siparisler',
    orderList: orders.listByUser(req.currentUser.id),
    paymentStatus: payments.statusSummary(),
  });
});

router.get('/siparisler/:no', (req, res, next) => {
  const order = orders.findByNo(req.params.no);
  if (!order || order.user_id !== req.currentUser.id) {
    const err = new Error('Sipariş bulunamadı.');
    err.status = 404;
    return next(err);
  }
  return res.render('panel/order-detail', {
    pageTitle: `Sipariş ${order.order_no} — NEXUS CHEATS`,
    bodyClass: 'page-panel',
    activeNav: 'siparisler',
    order,
    paymentStatus: payments.statusSummary(),
  });
});

/** Yeni siparis olusturur ve odeme sayfasina yonlendirir. */
router.post('/siparis', (req, res, next) => {
  try {
    const planId = Number(req.body.planId);
    const plan = plans.findById(planId);
    if (!plan || !plan.is_active) {
      flash(req, 'error', 'Seçilen üyelik paketi bulunamadı.');
      return res.redirect('/paketler');
    }
    const order = createPendingOrder({ userId: req.currentUser.id, planId });
    // Guvenli yonlendirme: protokol-goreli "//host" hedefleri kabul edilmez.
    const requested = String(req.body.next || '');
    const nextUrl = requested.startsWith('/') && !requested.startsWith('//')
      ? requested
      : `/odeme/${order.order_no}`;
    flash(req, 'info', 'Siparişiniz oluşturuldu. Ödeme adımını tamamlayın.');
    return res.redirect(nextUrl);
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------------ profil */

router.get('/profil', (req, res) => {
  res.render('panel/profile', {
    pageTitle: 'Profil Ayarları — NEXUS CHEATS',
    bodyClass: 'page-panel',
    activeNav: 'profil',
    form: { fullName: req.currentUser.full_name, email: req.currentUser.email },
    errors: {},
    passwordErrors: {},
  });
});

router.post('/profil', async (req, res, next) => {
  try {
    const result = validate(schemas.profile, req.body);
    if (!result.ok) {
      return res.status(422).render('panel/profile', {
        pageTitle: 'Profil Ayarları — NEXUS CHEATS',
        bodyClass: 'page-panel',
        activeNav: 'profil',
        form: { fullName: req.body.fullName || '', email: req.body.email || '' },
        errors: result.errors,
        passwordErrors: {},
      });
    }

    const { fullName, email } = result.data;
    const existing = users.findByEmail(email);
    if (existing && existing.id !== req.currentUser.id) {
      return res.status(409).render('panel/profile', {
        pageTitle: 'Profil Ayarları — NEXUS CHEATS',
        bodyClass: 'page-panel',
        activeNav: 'profil',
        form: { fullName, email },
        errors: { email: 'Bu e-posta adresi başka bir hesapta kullanılıyor.' },
        passwordErrors: {},
      });
    }

    users.updateProfile(req.currentUser.id, { fullName, email });
    flash(req, 'success', 'Profil bilgileriniz güncellendi.');
    return res.redirect('/panel/profil');
  } catch (err) {
    return next(err);
  }
});

router.post('/profil/sifre', async (req, res, next) => {
  try {
    const result = validate(schemas.passwordChange, req.body);
    if (!result.ok) {
      return res.status(422).render('panel/profile', {
        pageTitle: 'Profil Ayarları — NEXUS CHEATS',
        bodyClass: 'page-panel',
        activeNav: 'profil',
        form: { fullName: req.currentUser.full_name, email: req.currentUser.email },
        errors: {},
        passwordErrors: result.errors,
      });
    }

    const { currentPassword, newPassword } = result.data;
    const ok = await users.checkPassword(req.currentUser, currentPassword);
    if (!ok) {
      return res.status(401).render('panel/profile', {
        pageTitle: 'Profil Ayarları — NEXUS CHEATS',
        bodyClass: 'page-panel',
        activeNav: 'profil',
        form: { fullName: req.currentUser.full_name, email: req.currentUser.email },
        errors: {},
        passwordErrors: { currentPassword: 'Mevcut şifreniz hatalı.' },
      });
    }

    await users.updatePassword(req.currentUser.id, newPassword);
    flash(req, 'success', 'Şifreniz güncellendi.');
    return res.redirect('/panel/profil');
  } catch (err) {
    return next(err);
  }
});

/* -------------------------------------------------------------- uyelikler */

router.get('/uyelik', (req, res) => {
  res.render('panel/membership', {
    pageTitle: 'Üyeliğim — NEXUS CHEATS',
    bodyClass: 'page-panel',
    activeNav: 'uyelik',
    membershipList: memberships.historyByUser(req.currentUser.id),
    planList: plans.list(),
  });
});

/* ------------------------------------------------------------------ destek */

router.get('/destek', (req, res) => {
  res.render('panel/support', {
    pageTitle: 'Destek — NEXUS CHEATS',
    bodyClass: 'page-panel',
    activeNav: 'destek',
    ticketList: support.listByUser(req.currentUser.id),
    form: {},
    errors: {},
  });
});

router.post('/destek', (req, res, next) => {
  try {
    const result = validate(schemas.ticket, req.body);
    if (!result.ok) {
      return res.status(422).render('panel/support', {
        pageTitle: 'Destek — NEXUS CHEATS',
        bodyClass: 'page-panel',
        activeNav: 'destek',
        ticketList: support.listByUser(req.currentUser.id),
        form: req.body,
        errors: result.errors,
      });
    }
    const ticket = support.createTicket({ userId: req.currentUser.id, ...result.data });
    flash(req, 'success', 'Destek talebiniz oluşturuldu. Ekibimiz en kısa sürede yanıtlayacak.');
    return res.redirect(`/panel/destek/${ticket.id}`);
  } catch (err) {
    return next(err);
  }
});

router.get('/destek/:id', (req, res, next) => {
  const ticket = support.findTicket(req.params.id);
  if (!ticket || (ticket.user_id !== req.currentUser.id && req.currentUser.role !== 'admin')) {
    const err = new Error('Destek talebi bulunamadı.');
    err.status = 404;
    return next(err);
  }
  return res.render('panel/ticket', {
    pageTitle: `${ticket.subject} — Destek`,
    bodyClass: 'page-panel',
    activeNav: 'destek',
    ticket,
    messageList: support.messages(ticket.id),
    errors: {},
  });
});

router.post('/destek/:id', (req, res, next) => {
  try {
    const ticket = support.findTicket(req.params.id);
    if (!ticket || (ticket.user_id !== req.currentUser.id && req.currentUser.role !== 'admin')) {
      const err = new Error('Destek talebi bulunamadı.');
      err.status = 404;
      return next(err);
    }

    const result = validate(schemas.ticketReply, req.body);
    if (!result.ok) {
      return res.status(422).render('panel/ticket', {
        pageTitle: `${ticket.subject} — Destek`,
        bodyClass: 'page-panel',
        activeNav: 'destek',
        ticket,
        messageList: support.messages(ticket.id),
        errors: result.errors,
      });
    }

    const isStaff = req.currentUser.role === 'admin';
    support.addMessage({
      ticketId: ticket.id,
      userId: req.currentUser.id,
      isStaff,
      body: result.data.message,
    });
    if (isStaff) support.setStatus(ticket.id, 'answered');
    else support.setStatus(ticket.id, 'open');

    flash(req, 'success', 'Mesajınız gönderildi.');
    return res.redirect(`/panel/destek/${ticket.id}`);
  } catch (err) {
    return next(err);
  }
});

module.exports = { router, membershipStatus };
