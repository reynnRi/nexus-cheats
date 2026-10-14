'use strict';

/** Yonetici paneli. Yalnizca role='admin' kullanicilar erisebilir. */

const express = require('express');
const {
  users, products, plans, orders, memberships, support,
} = require('../models');
const { schemas, validate, linesToArray } = require('../lib/validate');
const { flash } = require('../middleware/context');
const { requireAdmin } = require('../middleware/auth');
const payments = require('../lib/payments');

const router = express.Router();
router.use(requireAdmin);

router.use((req, res, next) => {
  res.locals.bodyClass = 'page-admin';
  next();
});

/* ----------------------------------------------------------- genel bakis */

router.get('/', (req, res) => {
  const stats = orders.stats();
  res.render('admin/dashboard', {
    pageTitle: 'Yönetim Paneli — NEXUS CHEATS',
    activeAdminNav: 'dashboard',
    stats,
    userCount: users.count(),
    activeMembers: memberships.countActive(),
    productCount: products.count(true),
    planCount: plans.count(true),
    openTickets: support.openCount(),
    recentOrders: orders.list().slice(0, 8),
    paymentStatus: payments.statusSummary(),
    planList: plans.list({ includeInactive: true }),
  });
});

/* ---------------------------------------------------------------- urunler */

router.get('/urunler', (req, res) => {
  res.render('admin/products', {
    pageTitle: 'Ürün Yönetimi — NEXUS CHEATS',
    activeAdminNav: 'urunler',
    productList: products.listAll({ includeInactive: true }),
    games: products.GAMES,
    gameLabels: products.GAME_LABELS,
  });
});

router.get('/urunler/yeni', (req, res) => {
  res.render('admin/product-form', {
    pageTitle: 'Yeni Ürün — NEXUS CHEATS',
    activeAdminNav: 'urunler',
    product: null,
    featuresText: '',
    games: products.GAMES,
    errors: {},
    form: { is_active: 1, image_key: 'default', price_kurus: 0, game: 'valorant' },
  });
});

router.get('/urunler/:id/duzenle', (req, res, next) => {
  const product = products.findById(req.params.id);
  if (!product) {
    const err = new Error('Ürün bulunamadı.');
    err.status = 404;
    return next(err);
  }
  return res.render('admin/product-form', {
    pageTitle: `${product.name} — Düzenle`,
    activeAdminNav: 'urunler',
    product,
    featuresText: product.features.join('\n'),
    games: products.GAMES,
    errors: {},
    form: product,
  });
});

function productFormValues(body) {
  return {
    slug: String(body.slug || '').trim().toLowerCase(),
    game: body.game,
    name: body.name,
    summary: body.summary,
    description: body.description || '',
    features: linesToArray(body.features),
    compatibility: body.compatibility || '',
    price_kurus: Math.round((Number(body.priceTL) || 0) * 100),
    image_key: body.imageKey || 'default',
    sort_order: Number(body.sortOrder) || 0,
    is_active: body.isActive ? 1 : 0,
  };
}

function renderProductForm(res, { product, form, errors, status = 422 }) {
  return res.status(status).render('admin/product-form', {
    pageTitle: product ? `${product.name} — Düzenle` : 'Yeni Ürün — NEXUS CHEATS',
    activeAdminNav: 'urunler',
    product,
    featuresText: (form.features || []).join('\n'),
    games: products.GAMES,
    errors,
    form,
  });
}

router.post('/urunler', (req, res, next) => {
  try {
    const result = validate(schemas.product, req.body);
    const form = productFormValues(req.body);
    if (!result.ok) return renderProductForm(res, { product: null, form, errors: result.errors });
    if (products.findBySlug(form.slug)) {
      return renderProductForm(res, { product: null, form, errors: { slug: 'Bu slug zaten kullanılıyor.' } });
    }
    products.create(form);
    flash(req, 'success', 'Ürün eklendi.');
    return res.redirect('/admin/urunler');
  } catch (err) {
    return next(err);
  }
});

router.post('/urunler/:id', (req, res, next) => {
  try {
    const product = products.findById(req.params.id);
    if (!product) {
      const err = new Error('Ürün bulunamadı.');
      err.status = 404;
      return next(err);
    }
    const result = validate(schemas.product, req.body);
    const form = productFormValues(req.body);
    if (!result.ok) return renderProductForm(res, { product, form, errors: result.errors });
    const clash = products.findBySlug(form.slug);
    if (clash && clash.id !== product.id) {
      return renderProductForm(res, { product, form, errors: { slug: 'Bu slug zaten kullanılıyor.' } });
    }
    products.update(product.id, form);
    flash(req, 'success', 'Ürün güncellendi.');
    return res.redirect('/admin/urunler');
  } catch (err) {
    return next(err);
  }
});

router.post('/urunler/:id/sil', (req, res, next) => {
  try {
    products.remove(req.params.id);
    flash(req, 'success', 'Ürün silindi.');
    return res.redirect('/admin/urunler');
  } catch (err) {
    return next(err);
  }
});

/* ----------------------------------------------------------------- paketler */

router.get('/paketler', (req, res) => {
  res.render('admin/plans', {
    pageTitle: 'Üyelik Paketleri — NEXUS CHEATS',
    activeAdminNav: 'paketler',
    planList: plans.list({ includeInactive: true }),
  });
});

router.post('/paketler/:id', (req, res, next) => {
  try {
    const plan = plans.findById(req.params.id);
    if (!plan) {
      const err = new Error('Paket bulunamadı.');
      err.status = 404;
      return next(err);
    }
    const result = validate(schemas.plan, req.body);
    if (!result.ok) {
      flash(req, 'error', Object.values(result.errors)[0]);
      return res.redirect('/admin/paketler');
    }
    const data = result.data;
    plans.update(plan.id, {
      slug: data.slug,
      name: data.name,
      price_kurus: Math.round(data.priceTL * 100),
      duration_days: data.durationDays === '' || data.durationDays === undefined ? null : Number(data.durationDays),
      tagline: data.tagline,
      features: linesToArray(data.features),
      badge: data.badge,
      sort_order: data.sortOrder,
      is_active: data.isActive ? 1 : 0,
    });
    flash(req, 'success', `${plan.name} paketi güncellendi.`);
    return res.redirect('/admin/paketler');
  } catch (err) {
    return next(err);
  }
});

router.post('/paketler', (req, res, next) => {
  try {
    const result = validate(schemas.plan, req.body);
    if (!result.ok) {
      flash(req, 'error', Object.values(result.errors)[0]);
      return res.redirect('/admin/paketler');
    }
    const data = result.data;
    if (plans.slugTaken(data.slug)) {
      flash(req, 'error', 'Bu slug zaten kullanılıyor.');
      return res.redirect('/admin/paketler');
    }
    plans.create({
      slug: data.slug,
      name: data.name,
      price_kurus: Math.round(data.priceTL * 100),
      duration_days: data.durationDays === '' || data.durationDays === undefined ? null : Number(data.durationDays),
      tagline: data.tagline,
      features: linesToArray(data.features),
      badge: data.badge,
      sort_order: data.sortOrder,
      is_active: data.isActive ? 1 : 0,
    });
    flash(req, 'success', 'Yeni paket oluşturuldu.');
    return res.redirect('/admin/paketler');
  } catch (err) {
    return next(err);
  }
});

/* --------------------------------------------------------------- siparisler */

router.get('/siparisler', (req, res) => {
  res.render('admin/orders', {
    pageTitle: 'Siparişler — NEXUS CHEATS',
    activeAdminNav: 'siparisler',
    orderList: orders.list({ status: req.query.durum || '', search: req.query.q || '' }),
    filter: { status: req.query.durum || '', q: req.query.q || '' },
    paymentStatus: payments.statusSummary(),
  });
});

router.post('/siparisler/:id/durum', (req, res, next) => {
  try {
    const order = orders.findById(req.params.id);
    if (!order) {
      const err = new Error('Sipariş bulunamadı.');
      err.status = 404;
      return next(err);
    }
    const status = String(req.body.status || '');
    if (!['pending', 'paid', 'cancelled', 'refunded'].includes(status)) {
      flash(req, 'error', 'Geçersiz sipariş durumu.');
      return res.redirect('/admin/siparisler');
    }

    // Odeme onayi verilmeden siparis 'paid' yapilamaz; bu ancak saglayici
    // callback'i ile veya yoneticinin bilinçli manuel onayi ile mumkundur.
    if (status === 'paid') {
      orders.markPaid(order.id, { provider: 'manual', reference: `admin:${req.currentUser.id}` });
      flash(req, 'success', 'Sipariş ödenmiş olarak işaretlendi ve üyelik tanımlandı.');
    } else {
      orders.setStatus(order.id, status);
      flash(req, 'success', 'Sipariş durumu güncellendi.');
    }
    return res.redirect('/admin/siparisler');
  } catch (err) {
    return next(err);
  }
});

/* -------------------------------------------------------------- kullanicilar */

router.get('/kullanicilar', (req, res) => {
  res.render('admin/users', {
    pageTitle: 'Kullanıcılar — NEXUS CHEATS',
    activeAdminNav: 'kullanicilar',
    userList: users.list({ search: req.query.q || '' }),
    filter: { q: req.query.q || '' },
    planList: plans.list({ includeInactive: true }),
  });
});

router.get('/kullanicilar/:id', (req, res, next) => {
  const user = users.findById(req.params.id);
  if (!user) {
    const err = new Error('Kullanıcı bulunamadı.');
    err.status = 404;
    return next(err);
  }
  return res.render('admin/user-detail', {
    pageTitle: `${user.full_name} — Kullanıcı`,
    activeAdminNav: 'kullanicilar',
    user,
    orderList: orders.listByUser(user.id),
    membershipList: memberships.historyByUser(user.id),
    ticketList: support.listByUser(user.id),
    planList: plans.list({ includeInactive: true }),
    errors: {},
  });
});

router.post('/kullanicilar/:id/durum', (req, res, next) => {
  try {
    const user = users.findById(req.params.id);
    if (!user) {
      const err = new Error('Kullanıcı bulunamadı.');
      err.status = 404;
      return next(err);
    }
    if (user.id === req.currentUser.id) {
      flash(req, 'error', 'Kendi hesabınızı askıya alamazsınız.');
      return res.redirect(`/admin/kullanicilar/${user.id}`);
    }
    users.setBlocked(user.id, req.body.blocked === '1');
    flash(req, 'success', req.body.blocked === '1' ? 'Kullanıcı askıya alındı.' : 'Kullanıcının askısı kaldırıldı.');
    return res.redirect(`/admin/kullanicilar/${user.id}`);
  } catch (err) {
    return next(err);
  }
});

router.post('/kullanicilar/:id/uyelik', (req, res, next) => {
  try {
    const user = users.findById(req.params.id);
    if (!user) {
      const err = new Error('Kullanıcı bulunamadı.');
      err.status = 404;
      return next(err);
    }
    const result = validate(schemas.membershipGrant, req.body);
    if (!result.ok) {
      flash(req, 'error', Object.values(result.errors)[0]);
      return res.redirect(`/admin/kullanicilar/${user.id}`);
    }
    const membership = memberships.grant({ userId: user.id, planId: result.data.planId });
    flash(req, 'success', `Üyelik tanımlandı: ${membership.plan_name}.`);
    return res.redirect(`/admin/kullanicilar/${user.id}`);
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------------ destek */

router.get('/destek', (req, res) => {
  res.render('admin/support', {
    pageTitle: 'Destek Talepleri — NEXUS CHEATS',
    activeAdminNav: 'destek',
    ticketList: support.list({ status: req.query.durum || '' }),
    filter: { status: req.query.durum || '' },
  });
});

router.get('/destek/:id', (req, res, next) => {
  const ticket = support.findTicket(req.params.id);
  if (!ticket) {
    const err = new Error('Destek talebi bulunamadı.');
    err.status = 404;
    return next(err);
  }
  return res.render('admin/ticket', {
    pageTitle: `${ticket.subject} — Destek`,
    activeAdminNav: 'destek',
    ticket,
    messageList: support.messages(ticket.id),
    errors: {},
  });
});

router.post('/destek/:id', (req, res, next) => {
  try {
    const ticket = support.findTicket(req.params.id);
    if (!ticket) {
      const err = new Error('Destek talebi bulunamadı.');
      err.status = 404;
      return next(err);
    }
    const result = validate(schemas.ticketReply, req.body);
    if (!result.ok) {
      return res.status(422).render('admin/ticket', {
        pageTitle: `${ticket.subject} — Destek`,
        activeAdminNav: 'destek',
        ticket,
        messageList: support.messages(ticket.id),
        errors: result.errors,
      });
    }
    support.addMessage({
      ticketId: ticket.id,
      userId: req.currentUser.id,
      isStaff: true,
      body: result.data.message,
    });
    if (req.body.closeTicket === '1') support.setStatus(ticket.id, 'closed');
    flash(req, 'success', 'Yanıtınız gönderildi.');
    return res.redirect(`/admin/destek/${ticket.id}`);
  } catch (err) {
    return next(err);
  }
});

/* ------------------------------------------------------------ istatistikler */

router.get('/istatistikler', (req, res) => {
  const stats = orders.stats();
  res.render('admin/stats', {
    pageTitle: 'Satış İstatistikleri — NEXUS CHEATS',
    activeAdminNav: 'istatistikler',
    stats,
    planList: plans.list({ includeInactive: true }),
    userCount: users.count(),
    activeMembers: memberships.countActive(),
  });
});

module.exports = router;
