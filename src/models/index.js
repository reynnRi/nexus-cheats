'use strict';

/**
 * Veri katmani: kullanici, urun, paket, siparis, uyelik ve destek islemleri.
 * SQL her zaman parametreli calistirilir.
 */

const { get, all, run, tx } = require('../db');
const { hashPassword, verifyPassword } = require('../lib/security');
const { makeOrderNo } = require('../lib/format');

/* ------------------------------------------------------------------ users */

function parseJsonArray(value) {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** JSON kolonlarini diziye cevirir. */
function hydrateProduct(row) {
  if (!row) return null;
  return { ...row, features: parseJsonArray(row.features) };
}

function hydratePlan(row) {
  if (!row) return null;
  return { ...row, features: parseJsonArray(row.features) };
}

const users = {
  findByEmail(email) {
    return get('SELECT * FROM users WHERE email = ?', String(email || '').trim());
  },

  findById(id) {
    return get('SELECT * FROM users WHERE id = ?', Number(id));
  },

  async create({ email, password, fullName, role = 'user' }) {
    const hash = await hashPassword(password);
    const info = run(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES (?, ?, ?, ?)`,
      String(email).trim().toLowerCase(),
      hash,
      String(fullName).trim(),
      role,
    );
    return users.findById(info.lastInsertRowid);
  },

  async checkPassword(user, password) {
    return verifyPassword(password, user && user.password_hash);
  },

  async updatePassword(userId, password) {
    const hash = await hashPassword(password);
    run(
      `UPDATE users SET password_hash = ?, updated_at = datetime('now') WHERE id = ?`,
      hash,
      Number(userId),
    );
  },

  updateProfile(userId, { fullName, email }) {
    run(
      `UPDATE users SET full_name = ?, email = ?, updated_at = datetime('now') WHERE id = ?`,
      String(fullName).trim(),
      String(email).trim().toLowerCase(),
      Number(userId),
    );
    return users.findById(userId);
  },

  setBlocked(userId, blocked) {
    run('UPDATE users SET is_blocked = ? WHERE id = ?', blocked ? 1 : 0, Number(userId));
  },

  setRole(userId, role) {
    run('UPDATE users SET role = ? WHERE id = ?', role, Number(userId));
  },

  list({ search = '' } = {}) {
    const like = `%${String(search).trim()}%`;
    return all(
      `SELECT u.*,
              (SELECT COUNT(*) FROM orders o WHERE o.user_id = u.id AND o.status = 'paid') AS paid_orders,
              (SELECT COALESCE(SUM(o.amount_kurus), 0) FROM orders o WHERE o.user_id = u.id AND o.status = 'paid') AS total_kurus,
              (SELECT COALESCE(SUM(open_tickets.n), 0) FROM (
                  SELECT COUNT(*) AS n FROM support_tickets t
                  WHERE t.user_id = u.id AND t.status IN ('open', 'answered')
                  GROUP BY t.user_id
              ) AS open_tickets) AS open_tickets
       FROM users u
       WHERE ? = '%%' OR u.email LIKE ? OR u.full_name LIKE ?
       ORDER BY u.id DESC`,
      like,
      like,
      like,
    );
  },

  count() {
    return get('SELECT COUNT(*) AS n FROM users').n;
  },
};

/* --------------------------------------------------------------- products */

const GAME_LABELS = {
  valorant: 'VALORANT',
  cs2: 'COUNTER-STRIKE 2',
};

const GAMES = [
  { key: 'valorant', label: 'VALORANT' },
  { key: 'cs2', label: 'COUNTER-STRIKE 2' },
];

const products = {
  GAMES,
  GAME_LABELS,

  findById(id) {
    return hydrateProduct(get('SELECT * FROM products WHERE id = ?', Number(id)));
  },

  findBySlug(slug) {
    return hydrateProduct(get('SELECT * FROM products WHERE slug = ?', String(slug)));
  },

  listByGame(game, { includeInactive = false } = {}) {
    const rows = includeInactive
      ? all('SELECT * FROM products WHERE game = ? ORDER BY sort_order, id', game)
      : all('SELECT * FROM products WHERE game = ? AND is_active = 1 ORDER BY sort_order, id', game);
    return rows.map(hydrateProduct);
  },

  listAll({ includeInactive = true } = {}) {
    const rows = includeInactive
      ? all('SELECT * FROM products ORDER BY game, sort_order, id')
      : all('SELECT * FROM products WHERE is_active = 1 ORDER BY game, sort_order, id');
    return rows.map(hydrateProduct);
  },

  count(activeOnly = false) {
    const sql = activeOnly
      ? 'SELECT COUNT(*) AS n FROM products WHERE is_active = 1'
      : 'SELECT COUNT(*) AS n FROM products';
    return get(sql).n;
  },

  create(data) {
    const info = run(
      `INSERT INTO products
         (slug, game, name, summary, description, features, compatibility, price_kurus, image_key, is_active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      data.slug,
      data.game,
      data.name,
      data.summary,
      data.description || '',
      JSON.stringify(data.features || []),
      data.compatibility || '',
      Number(data.price_kurus) || 0,
      data.image_key || 'default',
      data.is_active ? 1 : 0,
      Number(data.sort_order) || 0,
    );
    return products.findById(info.lastInsertRowid);
  },

  update(id, data) {
    run(
      `UPDATE products SET
         slug = ?, game = ?, name = ?, summary = ?, description = ?,
         features = ?, compatibility = ?, price_kurus = ?, image_key = ?,
         is_active = ?, sort_order = ?
       WHERE id = ?`,
      data.slug,
      data.game,
      data.name,
      data.summary,
      data.description || '',
      JSON.stringify(data.features || []),
      data.compatibility || '',
      Number(data.price_kurus) || 0,
      data.image_key || 'default',
      data.is_active ? 1 : 0,
      Number(data.sort_order) || 0,
      Number(id),
    );
    return products.findById(id);
  },

  remove(id) {
    run('DELETE FROM products WHERE id = ?', Number(id));
  },
};

/* ------------------------------------------------------------------ plans */

const plans = {
  findById(id) {
    return hydratePlan(get('SELECT * FROM plans WHERE id = ?', Number(id)));
  },

  findBySlug(slug) {
    return hydratePlan(get('SELECT * FROM plans WHERE slug = ?', String(slug)));
  },

  list({ includeInactive = false } = {}) {
    const rows = includeInactive
      ? all('SELECT * FROM plans ORDER BY sort_order, price_kurus')
      : all('SELECT * FROM plans WHERE is_active = 1 ORDER BY sort_order, price_kurus');
    return rows.map(hydratePlan);
  },

  slugTaken(slug, exceptId = null) {
    const row = exceptId
      ? get('SELECT id FROM plans WHERE slug = ? AND id <> ?', String(slug), Number(exceptId))
      : get('SELECT id FROM plans WHERE slug = ?', String(slug));
    return Boolean(row);
  },

  create(data) {
    const info = run(
      `INSERT INTO plans (slug, name, price_kurus, duration_days, tagline, features, badge, sort_order, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      data.slug,
      data.name,
      Number(data.price_kurus) || 0,
      data.duration_days === null || data.duration_days === undefined ? null : Number(data.duration_days),
      data.tagline || '',
      JSON.stringify(data.features || []),
      data.badge || null,
      Number(data.sort_order) || 0,
      data.is_active ? 1 : 0,
    );
    return plans.findById(info.lastInsertRowid);
  },

  update(id, data) {
    run(
      `UPDATE plans SET
         slug = ?, name = ?, price_kurus = ?, duration_days = ?, tagline = ?,
         features = ?, badge = ?, sort_order = ?, is_active = ?
       WHERE id = ?`,
      data.slug,
      data.name,
      Number(data.price_kurus) || 0,
      data.duration_days === null || data.duration_days === undefined ? null : Number(data.duration_days),
      data.tagline || '',
      JSON.stringify(data.features || []),
      data.badge || null,
      Number(data.sort_order) || 0,
      data.is_active ? 1 : 0,
      Number(id),
    );
    return plans.findById(id);
  },

  remove(id) {
    run('DELETE FROM plans WHERE id = ?', Number(id));
  },

  count(activeOnly = false) {
    const sql = activeOnly
      ? 'SELECT COUNT(*) AS n FROM plans WHERE is_active = 1'
      : 'SELECT COUNT(*) AS n FROM plans';
    return get(sql).n;
  },
};

/* ----------------------------------------------------------------- orders */

/**
 * Bekleyen siparis olusturur. Odeme saglayicisi yapilandirilmamis olsa da
 * siparis 'pending' olarak kaydedilir; ancak odeme ONAYI olmadan asla 'paid'
 * durumuna gecmez ve uyelik baslatilmaz.
 */
function createPendingOrder({ userId, planId }) {
  return tx(() => {
    const plan = plans.findById(planId);
    if (!plan || !plan.is_active) {
      const err = new Error('Seçilen paket bulunamadı.');
      err.status = 400;
      throw err;
    }
    const orderNo = makeOrderNo();
    const info = run(
      `INSERT INTO orders (order_no, user_id, plan_id, plan_name, amount_kurus, status)
       VALUES (?, ?, ?, ?, ?, 'pending')`,
      orderNo,
      Number(userId),
      plan.id,
      plan.name,
      plan.price_kurus,
    );
    return orders.findById(info.lastInsertRowid);
  });
}

const orders = {
  findById(id) {
    return get(
      `SELECT o.*, u.email AS user_email, u.full_name AS user_name
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE o.id = ?`,
      Number(id),
    );
  },

  findByNo(orderNo) {
    return get('SELECT * FROM orders WHERE order_no = ?', String(orderNo));
  },

  listByUser(userId) {
    return all(
      'SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC',
      Number(userId),
    );
  },

  list({ status = '', search = '' } = {}) {
    const like = `%${String(search).trim()}%`;
    return all(
      `SELECT o.*, u.email AS user_email, u.full_name AS user_name
       FROM orders o JOIN users u ON u.id = o.user_id
       WHERE (? = '' OR o.status = ?)
         AND (? = '%%' OR o.order_no LIKE ? OR u.email LIKE ?)
       ORDER BY o.id DESC
       LIMIT 500`,
      String(status),
      String(status),
      like,
      like,
      like,
    );
  },

  markPaid(orderId, { provider = null, reference = null } = {}) {
    return tx(() => {
      const order = orders.findById(orderId);
      if (!order) throw new Error('Sipariş bulunamadı.');
      if (order.status === 'paid') return order;

      const plan = order.plan_id ? plans.findById(order.plan_id) : null;
      const now = new Date();
      const startsAt = now.toISOString();
      const lifetime = !plan || plan.duration_days === null;
      const endsAt = lifetime
        ? null
        : new Date(now.getTime() + plan.duration_days * 86400000).toISOString();

      run(
        `UPDATE orders SET status = 'paid', payment_provider = ?, payment_ref = ?,
                           period_start = ?, period_end = ?, updated_at = datetime('now')
         WHERE id = ?`,
        provider,
        reference,
        startsAt,
        endsAt,
        Number(orderId),
      );

      // Mevcut aktif uyeligi varsa kalan sureyi birlestirerek uzat.
      const current = memberships.findActiveByUser(order.user_id);
      if (current && !current.is_lifetime) {
        const base = current.ends_at && new Date(current.ends_at) > now ? new Date(current.ends_at) : now;
        const merged = lifetime ? null : new Date(base.getTime() + plan.duration_days * 86400000).toISOString();
        run(
          `UPDATE memberships SET status = 'superseded' WHERE id = ?`,
          current.id,
        );
        memberships.create({
          userId: order.user_id,
          planId: plan ? plan.id : null,
          planName: order.plan_name,
          orderId: order.id,
          startsAt: current.starts_at,
          endsAt: merged,
          isLifetime: lifetime,
        });
      } else if (!current) {
        memberships.create({
          userId: order.user_id,
          planId: plan ? plan.id : null,
          planName: order.plan_name,
          orderId: order.id,
          startsAt,
          endsAt,
          isLifetime: lifetime,
        });
      } else {
        // Sınırsız üyelik zaten var; sipariş kaydedilir, üyelik değişmez.
      }

      return orders.findById(orderId);
    });
  },

  setStatus(orderId, status) {
    run(
      `UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      status,
      Number(orderId),
    );
    return orders.findById(orderId);
  },

  stats() {
    const totals = get(
      `SELECT
         COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_kurus ELSE 0 END), 0) AS revenue_kurus,
         COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_count,
         COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_count,
         COUNT(*) AS total_count
       FROM orders`,
    );
    const byStatus = all(
      'SELECT status, COUNT(*) AS n FROM orders GROUP BY status ORDER BY n DESC',
    );
    const monthly = all(
      `SELECT strftime('%Y-%m', created_at) AS month,
              COALESCE(SUM(CASE WHEN status = 'paid' THEN amount_kurus ELSE 0 END), 0) AS revenue_kurus,
              COALESCE(SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_count
       FROM orders
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
    );
    return { ...totals, byStatus, monthly: monthly.reverse() };
  },
};

/* ------------------------------------------------------------ memberships */

const memberships = {
  findActiveByUser(userId) {
    return get(
      `SELECT * FROM memberships
       WHERE user_id = ? AND status = 'active'
         AND (is_lifetime = 1 OR ends_at IS NULL OR ends_at > datetime('now'))
       ORDER BY is_lifetime DESC, ends_at DESC
       LIMIT 1`,
      Number(userId),
    );
  },

  historyByUser(userId) {
    return all(
      'SELECT * FROM memberships WHERE user_id = ? ORDER BY id DESC',
      Number(userId),
    );
  },

  create({ userId, planId, planName, orderId, startsAt, endsAt, isLifetime }) {
    const info = run(
      `INSERT INTO memberships (user_id, plan_id, plan_name, order_id, starts_at, ends_at, is_lifetime, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')`,
      Number(userId),
      planId ? Number(planId) : null,
      planName,
      orderId ? Number(orderId) : null,
      startsAt,
      endsAt,
      isLifetime ? 1 : 0,
    );
    return get('SELECT * FROM memberships WHERE id = ?', info.lastInsertRowid);
  },

  /** Yoneticinin manuel olarak uyelik tanimlamasi icin. */
  grant({ userId, planId, startsAt, endsAt, isLifetime }) {
    return tx(() => {
      const plan = plans.findById(planId);
      if (!plan) throw new Error('Paket bulunamadı.');
      const now = new Date();
      const start = startsAt ? new Date(startsAt) : now;
      const lifetime = isLifetime !== undefined ? Boolean(isLifetime) : plan.duration_days === null;
      const end = lifetime
        ? null
        : endsAt
          ? new Date(endsAt)
          : new Date(start.getTime() + plan.duration_days * 86400000);
      run(`UPDATE memberships SET status = 'superseded' WHERE user_id = ? AND status = 'active'`, Number(userId));
      return memberships.create({
        userId,
        planId: plan.id,
        planName: plan.name,
        orderId: null,
        startsAt: start.toISOString(),
        endsAt: end ? end.toISOString() : null,
        isLifetime: lifetime,
      });
    });
  },

  cancel(membershipId) {
    run(`UPDATE memberships SET status = 'cancelled' WHERE id = ?`, Number(membershipId));
  },

  countActive() {
    return get(
      `SELECT COUNT(DISTINCT user_id) AS n FROM memberships
       WHERE status = 'active' AND (is_lifetime = 1 OR ends_at IS NULL OR ends_at > datetime('now'))`,
    ).n;
  },
};

/* --------------------------------------------------------------- support */

const support = {
  createTicket({ userId, subject, category, message }) {
    return tx(() => {
      const info = run(
        `INSERT INTO support_tickets (user_id, subject, category, status)
         VALUES (?, ?, ?, 'open')`,
        Number(userId),
        String(subject).trim(),
        String(category || 'genel'),
      );
      const ticketId = info.lastInsertRowid;
      run(
        `INSERT INTO support_messages (ticket_id, user_id, is_staff, body)
         VALUES (?, ?, 0, ?)`,
        ticketId,
        Number(userId),
        String(message).trim(),
      );
      return support.findTicket(ticketId);
    });
  },

  findTicket(id) {
    return get(
      `SELECT t.*, u.email AS user_email, u.full_name AS user_name
       FROM support_tickets t JOIN users u ON u.id = t.user_id
       WHERE t.id = ?`,
      Number(id),
    );
  },

  listByUser(userId) {
    return all(
      `SELECT t.*,
              (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) AS message_count
       FROM support_tickets t
       WHERE t.user_id = ?
       ORDER BY t.id DESC`,
      Number(userId),
    );
  },

  list({ status = '' } = {}) {
    return all(
      `SELECT t.*, u.email AS user_email, u.full_name AS user_name,
              (SELECT COUNT(*) FROM support_messages m WHERE m.ticket_id = t.id) AS message_count
       FROM support_tickets t JOIN users u ON u.id = t.user_id
       WHERE (? = '' OR t.status = ?)
       ORDER BY CASE t.status WHEN 'open' THEN 0 WHEN 'answered' THEN 1 ELSE 2 END, t.id DESC
       LIMIT 300`,
      String(status),
      String(status),
    );
  },

  messages(ticketId) {
    return all(
      `SELECT m.*, u.full_name AS author_name, u.email AS author_email
       FROM support_messages m LEFT JOIN users u ON u.id = m.user_id
       WHERE m.ticket_id = ?
       ORDER BY m.id ASC`,
      Number(ticketId),
    );
  },

  addMessage({ ticketId, userId, isStaff, body }) {
    const info = run(
      `INSERT INTO support_messages (ticket_id, user_id, is_staff, body)
       VALUES (?, ?, ?, ?)`,
      Number(ticketId),
      userId ? Number(userId) : null,
      isStaff ? 1 : 0,
      String(body).trim(),
    );
    run(
      `UPDATE support_tickets
       SET status = ?, updated_at = datetime('now')
       WHERE id = ?`,
      isStaff ? 'answered' : 'open',
      Number(ticketId),
    );
    return get('SELECT * FROM support_messages WHERE id = ?', info.lastInsertRowid);
  },

  setStatus(ticketId, status) {
    run(
      `UPDATE support_tickets SET status = ?, updated_at = datetime('now') WHERE id = ?`,
      status,
      Number(ticketId),
    );
  },

  openCount() {
    return get(`SELECT COUNT(*) AS n FROM support_tickets WHERE status IN ('open','answered')`).n;
  },
};

module.exports = { users, products, plans, orders, memberships, support, createPendingOrder, GAMES };
