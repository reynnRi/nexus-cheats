'use strict';

/** Form dogrulama yardimcilari (zod). */

const { z } = require('zod');

const password = z
  .string()
  .min(8, 'Şifre en az 8 karakter olmalı.')
  .max(200, 'Şifre çok uzun.')
  .regex(/[A-Za-zÇĞİÖŞÜçğıöşü]/, 'Şifre en az bir harf içermeli.')
  .regex(/\d/, 'Şifre en az bir rakam içermeli.');

const schemas = {
  register: z.object({
    fullName: z.string().trim().min(3, 'Ad soyad en az 3 karakter olmalı.').max(80, 'Ad soyad çok uzun.'),
    email: z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi girin.').max(160),
    password,
    passwordConfirm: z.string(),
  }).refine((d) => d.password === d.passwordConfirm, {
    path: ['passwordConfirm'],
    message: 'Şifreler eşleşmiyor.',
  }),

  login: z.object({
    email: z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi girin.'),
    password: z.string().min(1, 'Şifre gerekli.'),
  }),

  profile: z.object({
    fullName: z.string().trim().min(3, 'Ad soyad en az 3 karakter olmalı.').max(80),
    email: z.string().trim().toLowerCase().email('Geçerli bir e-posta adresi girin.').max(160),
  }),

  passwordChange: z.object({
    currentPassword: z.string().min(1, 'Mevcut şifre gerekli.'),
    newPassword: password,
    newPasswordConfirm: z.string(),
  }).refine((d) => d.newPassword === d.newPasswordConfirm, {
    path: ['newPasswordConfirm'],
    message: 'Yeni şifreler eşleşmiyor.',
  }),

  ticket: z.object({
    subject: z.string().trim().min(5, 'Konu en az 5 karakter olmalı.').max(140),
    category: z.enum(['genel', 'odeme', 'uyelik', 'teknik'], {
      errorMap: () => ({ message: 'Geçerli bir kategori seçin.' }),
    }),
    message: z.string().trim().min(15, 'Mesaj en az 15 karakter olmalı.').max(4000),
  }),

  ticketReply: z.object({
    message: z.string().trim().min(2, 'Mesaj boş olamaz.').max(4000),
  }),

  product: z.object({
    slug: z.string().trim().regex(/^[a-z0-9-]{3,60}$/, 'Slug yalnızca küçük harf, rakam ve tire içerebilir.'),
    game: z.enum(['valorant', 'cs2'], { errorMap: () => ({ message: 'Oyun seçimi geçersiz.' }) }),
    name: z.string().trim().min(3, 'Ürün adı en az 3 karakter olmalı.').max(120),
    summary: z.string().trim().min(10, 'Kısa açıklama en az 10 karakter olmalı.').max(240),
    description: z.string().trim().max(4000).optional().default(''),
    features: z.string().optional().default(''),
    compatibility: z.string().trim().max(300).optional().default(''),
    priceTL: z.coerce.number().min(0, 'Fiyat negatif olamaz.').max(1000000).optional().default(0),
    imageKey: z.string().trim().max(40).optional().default('default'),
    sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
    isActive: z.coerce.boolean().optional().default(false),
  }),

  plan: z.object({
    slug: z.string().trim().regex(/^[a-z0-9-]{3,60}$/, 'Slug yalnızca küçük harf, rakam ve tire içerebilir.'),
    name: z.string().trim().min(2, 'Paket adı en az 2 karakter olmalı.').max(80),
    priceTL: z.coerce.number().min(0, 'Fiyat negatif olamaz.').max(1000000),
    durationDays: z.union([z.coerce.number().int().min(1).max(36500), z.literal('')]).optional(),
    tagline: z.string().trim().max(120).optional().default(''),
    features: z.string().optional().default(''),
    badge: z.string().trim().max(30).optional().default(''),
    sortOrder: z.coerce.number().int().min(0).max(999).optional().default(0),
    isActive: z.coerce.boolean().optional().default(false),
  }),

  membershipGrant: z.object({
    userId: z.coerce.number().int().positive('Kullanıcı seçin.'),
    planId: z.coerce.number().int().positive('Paket seçin.'),
  }),
};

/** zod hatasini alan -> mesaj sozlugune cevirir. */
function fieldErrors(error) {
  const out = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || '_';
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

/**
 * @returns {{ok:true, data:any} | {ok:false, errors:Record<string,string>}}
 */
function validate(schema, input) {
  const result = schema.safeParse(input);
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, errors: fieldErrors(result.error) };
}

/** Yeni satirla ayrilmis metni diziye cevirir. */
function linesToArray(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

module.exports = { schemas, validate, fieldErrors, linesToArray, password };
