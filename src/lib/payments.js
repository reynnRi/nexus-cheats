'use strict';

/**
 * Ödeme sağlayıcı katmanı.
 *
 * ÖNEMLİ: Burada gerçek bir ödeme kuruluşu entegrasyonu YOKTUR.
 * Sağlayıcı anahtarları .env dosyasında tanımlanmadığı sürece sistem
 * "yapılandırılmadı" durumundadır ve hiçbir ödeme başarılı sayılmaz.
 * Hiçbir koşulda ödeme yapılmış gibi davranılmaz.
 *
 * Gerçek entegrasyon için:
 *   1) .env içine PAYMENT_PROVIDER=iyzico (veya paytr) ve API anahtarlarını yazın.
 *   2) Aşağıdaki startPayment() fonksiyonunu sağlayıcının 3D Secure akışına
 *      bağlayın; callback'i yalnızca imza doğrulaması sonrası kabul edin.
 *   3) Anahtarlar yalnızca sunucu tarafında okunur, istemciye asla gönderilmez.
 */

const PROVIDERS = {
  iyzico: {
    key: 'iyzico',
    label: 'iyzico',
    envKeys: ['IYZICO_API_KEY', 'IYZICO_SECRET_KEY', 'IYZICO_BASE_URL'],
    docs: 'https://dev.iyzipay.com',
  },
  paytr: {
    key: 'paytr',
    label: 'PayTR',
    envKeys: ['PAYTR_MERCHANT_ID', 'PAYTR_MERCHANT_KEY', 'PAYTR_MERCHANT_SALT'],
    docs: 'https://dev.paytr.com',
  },
};

/** .env'de secili saglayici ve anahtarlari okur. */
function config() {
  const providerKey = String(process.env.PAYMENT_PROVIDER || '').trim().toLowerCase();
  const provider = PROVIDERS[providerKey] || null;

  const missing = [];
  if (provider) {
    for (const envKey of provider.envKeys) {
      if (!process.env[envKey] || String(process.env[envKey]).trim() === '') missing.push(envKey);
    }
  }

  const configured = Boolean(provider) && missing.length === 0;

  return {
    provider,
    providerKey: provider ? provider.key : null,
    providerLabel: provider ? provider.label : null,
    configured,
    missing,
    sandbox: String(process.env.PAYMENT_SANDBOX || '').toLowerCase() === 'true',
    docs: provider ? provider.docs : null,
  };
}

/** Odeme altyapisi hazir mi? */
function isConfigured() {
  return config().configured;
}

/**
 * Odeme oturumu baslatir.
 * Saglayici yapilandirilmamis oldugu icin her zaman reddeder; siparis
 * 'pending' kalir ve kullaniciya acik bir uyari gosterilir.
 */
async function startPayment() {
  const cfg = config();
  if (!cfg.configured) {
    const err = new Error(
      'Ödeme altyapısı henüz yapılandırılmadı. Siparişiniz "ödeme bekliyor" olarak kaydedildi; '
      + 'hiçbir tahsilat yapılmadı ve üyeliğiniz başlatılmadı.',
    );
    err.code = 'PAYMENT_NOT_CONFIGURED';
    err.status = 503;
    throw err;
  }
  // Gercek saglayici akisi buraya baglanir (3D Secure yonlendirmesi).
  const err = new Error('Ödeme sağlayıcı akışı bu kurulumda etkin değil.');
  err.code = 'PAYMENT_FLOW_DISABLED';
  err.status = 501;
  throw err;
}

/** Kullaniciya gosterilecek durum metni. */
function statusSummary() {
  const cfg = config();
  if (!cfg.configured) {
    return {
      ready: false,
      badge: 'Ödeme altyapısı yapılandırılmadı',
      detail: cfg.provider
        ? `${cfg.providerLabel} seçili ancak eksik anahtarlar var: ${cfg.missing.join(', ')}.`
        : 'Hiçbir ödeme sağlayıcısı seçilmedi. Siparişler "ödeme bekliyor" olarak kaydedilir.',
    };
  }
  return {
    ready: true,
    badge: `${cfg.providerLabel} bağlı${cfg.sandbox ? ' (test modu)' : ''}`,
    detail: 'Ödemeler sağlayıcının güvenli sayfasında alınır; kart bilgileri bu sunucuya hiçbir zaman ulaşmaz.',
  };
}

module.exports = { config, isConfigured, startPayment, statusSummary, PROVIDERS };
