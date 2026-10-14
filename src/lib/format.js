'use strict';

/** Para bicimlendirme ve tarih yardimcilari. Fiyatlar her zaman kurus cinsinden saklanir. */

const TL = new Intl.NumberFormat('tr-TR', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

/** 99900 -> "999 TL"  |  1200000 -> "12.000 TL" */
function formatTL(kurus) {
  const value = (Number(kurus) || 0) / 100;
  return `${TL.format(value)} TL`;
}

/** Sayilari turkce binlik ayraci ile yazar. */
function formatNumber(n) {
  return new Intl.NumberFormat('tr-TR').format(Number(n) || 0);
}

/** ISO/SQLite tarih dizesini Date nesnesine cevirir (SQLite UTC tutar). */
function parseDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value;
  const s = String(value).trim();
  // "2026-10-13 17:00:00" -> "2026-10-13T17:00:00Z"
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(s)
    ? `${s.replace(' ', 'T')}Z`
    : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Turkiye saatine gore "13.10.2026 20:27" bicimi. */
function formatDateTR(value) {
  const d = parseDate(value);
  if (!d) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

/** Turkiye saatine gore sadece tarih: "13.10.2026" */
function formatDayTR(value) {
  const d = parseDate(value);
  if (!d) return '-';
  return new Intl.DateTimeFormat('tr-TR', {
    timeZone: 'Europe/Istanbul',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Iki tarih arasindaki tam gun sayisi (yukari yuvarlanir). */
function daysBetween(from, to) {
  const a = parseDate(from);
  const b = parseDate(to);
  if (!a || !b) return 0;
  return Math.max(0, Math.ceil((b.getTime() - a.getTime()) / DAY_MS));
}

/**
 * Aktif uyelik bilgisini ozetler.
 * @returns {{active:boolean, lifetime:boolean, daysLeft:number, endsAt:Date|null, planName:string|null, label:string}}
 */
function membershipStatus(membership, now = new Date()) {
  if (!membership) {
    return { active: false, lifetime: false, daysLeft: 0, endsAt: null, planName: null, label: 'Aktif üyelik yok' };
  }
  const lifetime = Boolean(membership.is_lifetime);
  const endsAt = parseDate(membership.ends_at);
  const active = lifetime || (endsAt ? endsAt.getTime() > now.getTime() : false);
  const daysLeft = lifetime ? 0 : daysBetween(now, endsAt);
  return {
    active,
    lifetime,
    daysLeft,
    endsAt,
    planName: membership.plan_name,
    label: lifetime
      ? 'Sınırsız üyelik'
      : active
        ? `${daysLeft} gün kaldı`
        : 'Süresi doldu',
  };
}

/** Guvenli siparis numarasi: NX-2026-4F8A21 */
function makeOrderNo(prefix = 'NX') {
  const year = new Date().getFullYear();
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${year}-${rand}`;
}

/** Uzun metinlerde basit kirpma. */
function excerpt(text, max = 140) {
  const s = String(text || '').replace(/\s+/g, ' ').trim();
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

module.exports = {
  formatTL,
  formatNumber,
  formatDateTR,
  formatDayTR,
  parseDate,
  daysBetween,
  membershipStatus,
  makeOrderNo,
  excerpt,
};
