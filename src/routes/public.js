'use strict';

/** Genel (herkese acik) sayfalar: ana sayfa, urunler, paketler, kurumsal. */

const express = require('express');
const { products, plans } = require('../models');
const { statusSummary } = require('../lib/payments');

const router = express.Router();

const COMPANY = {
  name: 'NEXUS CHEATS',
  legalName: 'NEXUS DİJİTAL EĞİTİM HİZMETLERİ',
  email: 'destek@nexuscheats.example',
  supportHours: 'Hafta içi 10:00 – 19:00 (GMT+3)',
  address: 'Maslak Mah. Büyükdere Cad. No: 000, Sarıyer / İstanbul',
  taxOffice: 'Sarıyer',
};

router.use((req, res, next) => {
  res.locals.company = COMPANY;
  next();
});

router.get('/', (req, res) => {
  const valorant = products.listByGame('valorant').slice(0, 3);
  const cs2 = products.listByGame('cs2').slice(0, 3);
  const planList = plans.list();

  res.render('home', {
    pageTitle: 'NEXUS CHEATS — Her maçta farkını ortaya koy',
    pageDescription: 'VALORANT ve Counter-Strike 2 oyuncuları için eğitim programları, koçluk ve maç analizi araçları.',
    valorant,
    cs2,
    planList,
    heroGameCount: products.count(true),
  });
});

router.get('/urunler', (req, res) => {
  const gameFilter = ['valorant', 'cs2'].includes(String(req.query.oyun))
    ? String(req.query.oyun)
    : 'all';

  const all = products.listAll({ includeInactive: false });
  const filtered = gameFilter === 'all' ? all : all.filter((p) => p.game === gameFilter);

  res.render('products', {
    pageTitle: 'Ürünler — NEXUS CHEATS',
    pageDescription: 'VALORANT ve Counter-Strike 2 için eğitim programları, analiz araçları ve koçluk paketleri.',
    gameFilter,
    planList: plans.list(),
    groups: [
      { key: 'valorant', label: 'VALORANT', items: all.filter((p) => p.game === 'valorant') },
      { key: 'cs2', label: 'COUNTER-STRIKE 2', items: all.filter((p) => p.game === 'cs2') },
    ],
    filtered,
  });
});

router.get('/urunler/:slug', (req, res, next) => {
  const product = products.findBySlug(req.params.slug);
  if (!product || !product.is_active) {
    const err = new Error('Aradığınız ürün bulunamadı.');
    err.status = 404;
    return next(err);
  }
  const related = products
    .listByGame(product.game)
    .filter((p) => p.id !== product.id)
    .slice(0, 3);

  return res.render('product-detail', {
    pageTitle: `${product.name} — NEXUS CHEATS`,
    pageDescription: product.summary,
    product,
    related,
    planList: plans.list(),
    paymentStatus: statusSummary(),
  });
});

router.get('/paketler', (req, res) => {
  const planList = plans.list();
  res.render('plans', {
    pageTitle: 'Üyelik Paketleri — NEXUS CHEATS',
    pageDescription: 'Aylık 999 TL, yıllık 12.000 TL ve sınırsız 33.000 TL üyelik paketleri.',
    planList,
    paymentStatus: statusSummary(),
  });
});

/* ------------------------------------------------------------- kurumsal */

router.get('/gizlilik-politikasi', (req, res) => {
  res.render('legal/privacy', { pageTitle: 'Gizlilik Politikası — NEXUS CHEATS' });
});

router.get('/kullanim-kosullari', (req, res) => {
  res.render('legal/terms', { pageTitle: 'Kullanım Koşulları — NEXUS CHEATS' });
});

router.get('/iade-politikasi', (req, res) => {
  res.render('legal/refund', { pageTitle: 'İade ve İptal Politikası — NEXUS CHEATS' });
});

router.get('/iletisim', (req, res) => {
  res.render('legal/contact', { pageTitle: 'İletişim — NEXUS CHEATS' });
});

module.exports = { router, COMPANY };
