'use strict';

/**
 * Veritabani tohumlama.
 *
 * - Uyelik paketleri: aylik 999 TL, yillik 12.000 TL, sinirsiz 33.000 TL (sabit).
 * - Urunler: VALORANT ve CS2 icin egitim/kocluk/analiz urunleri.
 * - Yonetici hesabi: .env icindeki ADMIN_EMAIL / ADMIN_PASSWORD ile olusturulur.
 *
 * SAHTE VERI YOKTUR: musteri yorumu, uydurma satis rakami veya sahte
 * kullanici hesabi olusturulmaz.
 */

require('dotenv').config();

const { users, products, plans } = require('../models');

/* ----------------------------------------------------------------- paketler */

const PLAN_SEED = [
  {
    slug: 'aylik',
    name: 'AYLIK ÜYELİK',
    price_kurus: 99900, // 999 TL
    duration_days: 30,
    tagline: 'Kısa vadeli hedefler için esnek başlangıç',
    badge: null,
    sort_order: 1,
    features: [
      '30 günlük üyelik',
      'Desteklenen ürünlere erişim',
      'Kullanıcı paneli',
      'Üyelik bitiş tarihi takibi',
    ],
  },
  {
    slug: 'yillik',
    name: 'YILLIK ÜYELİK',
    price_kurus: 1200000, // 12.000 TL
    duration_days: 365,
    tagline: 'En çok tercih edilen uzun dönem paketi',
    badge: 'EN AVANTAJLI',
    sort_order: 2,
    features: [
      '365 günlük üyelik',
      'Desteklenen ürünlere erişim',
      'Kullanıcı paneli',
      'Üyelik bitiş tarihi takibi',
    ],
  },
  {
    slug: 'sinirsiz',
    name: 'SINIRSIZ ÜYELİK',
    price_kurus: 3300000, // 33.000 TL
    duration_days: null,
    tagline: 'Tek seferlik ödeme, süresiz erişim',
    badge: 'SINIRSIZ',
    sort_order: 3,
    features: [
      'Süresiz üyelik',
      'Uygun ürünlere erişim',
      'Kullanıcı paneli',
      'Süresiz üyelik durumu',
    ],
  },
];

/* ------------------------------------------------------------------ urunler */

const PRODUCT_SEED = [
  /* --------------------------------------------------------- VALORANT */
  {
    slug: 'valorant-aim-programi',
    game: 'valorant',
    name: 'VALORANT Aim Programı',
    summary: 'Crosshair yerleşimi, spray kontrolü ve refleks antrenmanı için 8 haftalık yapılandırılmış program.',
    description: 'Seviyene göre uyarlanan haftalık antrenman planları ile nişan alma hızını ve isabet oranını ölçülebilir şekilde geliştir. Her hafta hedef skorlarını panelden takip eder, koç geri bildirimi alırsın.',
    features: [
      '8 haftalık kademeli antrenman planı',
      'Crosshair ve sens ayarı rehberi',
      'Spray kontrolü ve tap-fire modülleri',
      'Haftalık isabet istatistikleri',
      'Koç geri bildirimi (haftada 1 kez)',
    ],
    compatibility: 'VALORANT güncel sürüm · Windows 10/11 · Eğitim araçları oyun dosyalarını değiştirmez.',
    price_kurus: 74900,
    image_key: 'aim',
    sort_order: 1,
    is_active: 1,
  },
  {
    slug: 'valorant-lineup-kutuphanesi',
    game: 'valorant',
    name: 'Lineup & Pusu Kütüphanesi',
    summary: 'Harita bazlı lineup, smoke ve pusu kurulumlarının görsel anlatımı; 200+ kayıt.',
    description: 'Ascent, Haven, Lotus, Sunset ve Bind dahil tüm aktif haritalar için site bazlı lineup rehberleri. Her kayıt, konum görseli ve uygulama adımları ile birlikte sunulur.',
    features: [
      '200+ harita ve site bazlı lineup kaydı',
      'Smoke, molotov ve flash kurulum anlatımları',
      'Defans ve atak tarafı için ayrı kurulumlar',
      'Sık güncellenen harita değişiklik notları',
      'Favorilere ekleme ve kendi notunu yazma',
    ],
    compatibility: 'VALORANT güncel harita havuzu · Tarayıcı üzerinden erişim · Kurulum gerektirmez.',
    price_kurus: 49900,
    image_key: 'lineup',
    sort_order: 2,
    is_active: 1,
  },
  {
    slug: 'valorant-vod-analiz',
    game: 'valorant',
    name: 'VOD Analiz & Rank Koçluğu',
    summary: 'Kendi maç kaydını yükle, koçun pozisyonlama ve karar alma hatalarını raporlasın.',
    description: 'Maç kaydını yükledikten sonra 72 saat içinde yazılı analiz raporu ve 30 dakikalık birebir görüşme alırsın. Rapor; pozisyonlama, util kullanımı, ekonomi yönetimi ve iletişim başlıklarını kapsar.',
    features: [
      'Maç kaydı üzerinden birebir analiz',
      'Yazılı rapor (72 saat içinde)',
      '30 dakikalık canlı geri bildirim görüşmesi',
      'Kişiye özel gelişim planı',
      'Rank yükselme takibi',
    ],
    compatibility: 'VALORANT maç kayıtları · Replay dosyası veya ekran kaydı kabul edilir.',
    price_kurus: 129900,
    image_key: 'vod',
    sort_order: 3,
    is_active: 1,
  },

  /* --------------------------------------------------------------- CS2 */
  {
    slug: 'cs2-aim-antrenman',
    game: 'cs2',
    name: 'CS2 Aim Antrenman Modülü',
    summary: 'Aim bot rotaları, spray paternleri ve reaksiyon süresi ölçümü içeren antrenman seti.',
    description: 'Günlük 20 dakikalık rutin ile nişan alma tutarlılığını artır. Modül; patern takibi, counter-strafe alıştırmaları ve reaksiyon ölçüm testlerini bir arada sunar.',
    features: [
      'Günlük 20 dakikalık antrenman rutini',
      'AK-47 / M4 spray patern çalışmaları',
      'Counter-strafe ve peek alıştırmaları',
      'Reaksiyon süresi ölçüm testi',
      'İlerleme grafiği ve hedef takibi',
    ],
    compatibility: 'Counter-Strike 2 güncel sürüm · Steam üzerinden resmî eğitim haritaları kullanılır.',
    price_kurus: 69900,
    image_key: 'aim',
    sort_order: 1,
    is_active: 1,
  },
  {
    slug: 'cs2-utility-rehberi',
    game: 'cs2',
    name: 'CS2 Utility & Smoke Rehberi',
    summary: 'Mirage, Inferno, Dust2 ve Anubis için smoke, molotov ve flash kurulumları.',
    description: 'Aktif harita havuzundaki her site için taraflara ayrılmış utility rehberi. Kurulumlar adım adım görsellerle anlatılır ve pratik haritası bağlantılarıyla desteklenir.',
    features: [
      'Mirage, Inferno, Dust2, Anubis kurulumları',
      'T ve CT tarafı için ayrı rehberler',
      'Adım adım görsel anlatım',
      'Pratik haritası bağlantıları',
      'Yama sonrası güncellenen notlar',
    ],
    compatibility: 'Counter-Strike 2 aktif harita havuzu · Tarayıcı üzerinden erişim.',
    price_kurus: 44900,
    image_key: 'utility',
    sort_order: 2,
    is_active: 1,
  },
  {
    slug: 'cs2-demo-analiz',
    game: 'cs2',
    name: 'CS2 Demo Analiz & Ekonomi Koçluğu',
    summary: 'Demo dosyanı yükle; round bazlı ekonomi, pozisyonlama ve karar analizi al.',
    description: 'Yüklediğin demo dosyası; alım kararları, kayıp roundların nedeni, pozisyon hataları ve iletişim eksikleri başlıklarında raporlanır. Rapor sonrası birebir görüşme yapılır.',
    features: [
      'Round bazlı ekonomi analizi',
      'Alım ve force-buy karar değerlendirmesi',
      'Pozisyonlama ve rotasyon raporu',
      'Yazılı rapor (72 saat içinde)',
      '45 dakikalık birebir görüşme',
    ],
    compatibility: 'CS2 demo (.dem) dosyaları · Faceit ve Premier maç kayıtları desteklenir.',
    price_kurus: 119900,
    image_key: 'demo',
    sort_order: 3,
    is_active: 1,
  },
];

/* ------------------------------------------------------------------- seed */

function seedPlans() {
  for (const plan of PLAN_SEED) {
    const existing = plans.findBySlug(plan.slug);
    if (existing) {
      plans.update(existing.id, {
        slug: plan.slug,
        name: plan.name,
        price_kurus: plan.price_kurus,
        duration_days: plan.duration_days,
        tagline: plan.tagline,
        features: plan.features,
        badge: plan.badge,
        sort_order: plan.sort_order,
        is_active: 1,
      });
      console.log(`  · paket güncellendi: ${plan.name} (${(plan.price_kurus / 100).toLocaleString('tr-TR')} TL)`);
    } else {
      plans.create({ ...plan, is_active: 1 });
      console.log(`  · paket eklendi: ${plan.name} (${(plan.price_kurus / 100).toLocaleString('tr-TR')} TL)`);
    }
  }
}

function seedProducts() {
  for (const product of PRODUCT_SEED) {
    const existing = products.findBySlug(product.slug);
    if (existing) {
      products.update(existing.id, product);
      console.log(`  · ürün güncellendi: ${product.name}`);
    } else {
      products.create(product);
      console.log(`  · ürün eklendi: ${product.name}`);
    }
  }
}

async function seedAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.ADMIN_PASSWORD || '');

  if (!email || !password) {
    console.log('  · yönetici hesabı atlandı (ADMIN_EMAIL / ADMIN_PASSWORD tanımlı değil).');
    return;
  }
  if (password.length < 12) {
    console.log('  · yönetici hesabı atlandı (ADMIN_PASSWORD en az 12 karakter olmalı).');
    return;
  }

  const existing = users.findByEmail(email);
  if (existing) {
    if (existing.role !== 'admin') {
      users.setRole(existing.id, 'admin');
      console.log(`  · mevcut hesap yönetici yapıldı: ${email}`);
    } else {
      console.log(`  · yönetici hesabı zaten mevcut: ${email}`);
    }
    return;
  }

  await users.create({ email, password, fullName: 'NEXUS Yönetici', role: 'admin' });
  console.log(`  · yönetici hesabı oluşturuldu: ${email}`);
}

async function main() {
  console.log('NEXUS CHEATS — veritabanı tohumlama başlıyor...\n');
  console.log('Paketler:');
  seedPlans();
  console.log('\nÜrünler:');
  seedProducts();
  console.log('\nYönetici:');
  await seedAdmin();
  console.log('\nTamamlandı.');
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Tohumlama hatası:', err);
    process.exit(1);
  });
}

module.exports = { main, PLAN_SEED, PRODUCT_SEED };
