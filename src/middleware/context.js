'use strict';

/** Her istekte kullaniciyi, flash mesajlarini ve gorunum degiskenlerini hazirlar. */

const { users, memberships, support } = require('../models');
const { membershipStatus, formatTL, formatDateTR, formatDayTR, formatNumber } = require('../lib/format');
const { csrfToken } = require('../lib/security');
const { productArt, planArt } = require('../lib/art');
const payments = require('../lib/payments');

function flash(req, type, message) {
  if (!req.session) return;
  if (!Array.isArray(req.session.flashes)) req.session.flashes = [];
  req.session.flashes.push({ type, message });
}

function takeFlashes(req) {
  const list = (req.session && req.session.flashes) || [];
  if (req.session) req.session.flashes = [];
  return list;
}

function currentUserMiddleware(req, res, next) {
  try {
    let user = null;
    if (req.session && req.session.userId) {
      user = users.findById(req.session.userId);
      if (!user || user.is_blocked) {
        req.session.userId = null;
        user = null;
      }
    }
    req.currentUser = user;
    req.user = user;

    if (user) {
      const active = memberships.findActiveByUser(user.id);
      req.membership = active;
      req.membershipInfo = membershipStatus(active);
    } else {
      req.membership = null;
      req.membershipInfo = membershipStatus(null);
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

function viewGlobals(req, res, next) {
  res.locals.currentUser = req.currentUser || null;
  res.locals.membership = req.membership || null;
  res.locals.membershipInfo = req.membershipInfo || membershipStatus(null);
  res.locals.flashes = takeFlashes(req);
  res.locals.csrfToken = req.session ? csrfToken(req) : '';
  res.locals.currentPath = req.path;
  res.locals.payments = payments.statusSummary();
  res.locals.openTicketCount = req.currentUser && req.currentUser.role === 'admin'
    ? support.openCount()
    : 0;
  res.locals.helpers = {
    formatTL,
    formatDateTR,
    formatDayTR,
    formatNumber,
    productArt,
    planArt,
  };
  res.locals.siteName = 'NEXUS CHEATS';
  res.locals.pageTitle = 'NEXUS CHEATS';
  res.locals.pageDescription = 'Rekabetçi FPS oyuncuları için eğitim, analiz ve koçluk platformu.';
  res.locals.bodyClass = '';
  return next();
}

module.exports = { currentUserMiddleware, viewGlobals, flash, takeFlashes };
