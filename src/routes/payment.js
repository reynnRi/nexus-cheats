'use strict';

/**
 * Odeme sayfalari.
 *
 * Kritik kural: Bu sistemde hicbir odeme "basariyla tamamlandi" olarak
 * isaretlenmez. Saglayici yapilandirilmadigi surece siparis 'pending' kalir.
 * /odeme/:no/onayla ucnoktasi yalnizca saglayici entegrasyonu AKTIF ise
 * calisir; aksi halde acik bir hata dondurur.
 */

const express = require('express');
const { orders } = require('../models');
const { requireAuth } = require('../middleware/auth');
const { flash } = require('../middleware/context');
const payments = require('../lib/payments');

const router = express.Router();

function loadOwnOrder(req, res, next) {
  const order = orders.findByNo(req.params.no);
  if (!order || order.user_id !== req.currentUser.id) {
    const err = new Error('Sipariş bulunamadı.');
    err.status = 404;
    return next(err);
  }
  req.order = order;
  return next();
}

router.get('/:no', requireAuth, loadOwnOrder, (req, res) => {
  const status = payments.statusSummary();
  res.render('payment/checkout', {
    pageTitle: `Ödeme — ${req.order.order_no}`,
    bodyClass: 'page-panel',
    activeNav: 'siparisler',
    order: req.order,
    paymentStatus: status,
    paymentConfig: payments.config(),
  });
});

router.post('/:no/baslat', requireAuth, loadOwnOrder, async (req, res, next) => {
  try {
    if (req.order.status === 'paid') {
      flash(req, 'info', 'Bu sipariş zaten ödenmiş görünüyor.');
      return res.redirect(`/panel/siparisler/${req.order.order_no}`);
    }
    await payments.startPayment({ order: req.order, user: req.currentUser });
    // Bu satira yalnizca gercek bir saglayici akisi baglandiginda gelinir.
    flash(req, 'info', 'Ödeme sağlayıcısına yönlendiriliyorsunuz.');
    return res.redirect(`/odeme/${req.order.order_no}`);
  } catch (err) {
    flash(req, 'error', err.message);
    return res.redirect(`/odeme/${req.order.order_no}`);
  }
});

router.get('/:no/tamamlandi', requireAuth, loadOwnOrder, (req, res) => {
  res.render('payment/result', {
    pageTitle: 'Ödeme Sonucu — NEXUS CHEATS',
    bodyClass: 'page-panel',
    activeNav: 'siparisler',
    order: req.order,
    paymentStatus: payments.statusSummary(),
  });
});

/**
 * Saglayici callback ucnoktasi. Guvenli imza dogrulamasi yapilmadigi ve
 * hicbir saglayici baglanmadigi icin siparisi ODEME ONAYLI saymaz.
 * CSRF korumasi bu ucnoktaya uygulanmaz (saglayicidan gelen sunucu-sunucu
 * istegi oturum cerezi tasimaz); guvenlik imza dogrulamasi ile saglanir.
 */
router.post('/callback', (req, res) => {
  if (!payments.isConfigured()) {
    return res.status(503).json({
      ok: false,
      error: 'PAYMENT_CALLBACK_DISABLED',
      message: 'Ödeme sağlayıcı entegrasyonu yapılandırılmadı; bu uç nokta etkin değil.',
    });
  }
  return res.status(501).json({
    ok: false,
    error: 'PAYMENT_CALLBACK_NOT_IMPLEMENTED',
    message: 'Sağlayıcı imza doğrulaması bu kurulumda etkin değil.',
  });
});

module.exports = router;
