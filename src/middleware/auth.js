'use strict';

/** Rol tabanli erisim kontrolu. */

/** Giris yapmis kullanici zorunlu. */
function requireAuth(req, res, next) {
  if (req.currentUser) return next();
  const err = new Error('Bu sayfayı görüntülemek için giriş yapmalısınız.');
  err.status = 401;
  return next(err);
}

/** Yalnizca yonetici. */
function requireAdmin(req, res, next) {
  if (req.currentUser && req.currentUser.role === 'admin') return next();
  const err = new Error(
    req.currentUser
      ? 'Bu alana erişim yetkiniz yok.'
      : 'Yönetim paneline erişmek için yönetici hesabıyla giriş yapmalısınız.',
  );
  err.status = req.currentUser ? 403 : 401;
  return next(err);
}

/** Giris yapmis kullaniciyi giris/kayit sayfalarindan uzak tutar. */
function requireGuest(req, res, next) {
  if (req.currentUser) return res.redirect(req.currentUser.role === 'admin' ? '/admin' : '/panel');
  return next();
}

module.exports = { requireAuth, requireAdmin, requireGuest };
