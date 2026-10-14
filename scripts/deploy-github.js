'use strict';

/**
 * Projeyi GitHub deposuna yukler.
 *
 * Git kurulu olmasa da calisir: GitHub'in Git Data API'si kullanilir
 * (blob -> tree -> commit -> ref). Token GH_TOKEN ortam degiskeninden okunur.
 *
 * Kullanim:
 *   node scripts/deploy-github.js            # normal yukleme
 *   node scripts/deploy-github.js --dry-run  # sadece listeler
 */

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const OWNER = process.env.GH_OWNER || 'reynnRi';
const REPO = process.env.GH_REPO || 'nexus-cheats';
const BRANCH = process.env.GH_BRANCH || 'main';
const TOKEN = process.env.GH_TOKEN;

const DRY = process.argv.includes('--dry-run');

if (!TOKEN) {
  console.error('HATA: GH_TOKEN tanimli degil.');
  process.exit(1);
}

const API = 'https://api.github.com';
const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'User-Agent': 'nexus-deploy',
  Accept: 'application/vnd.github+json',
  'Content-Type': 'application/json',
};

/* ---------------------------------------------------- yuklenecek dosyalar */

const SKIP_PATTERNS = [
  /^node_modules\//,
  /^data\//,
  /^\.env$/,
  /^\.env\./,
  /\.log$/,
  /\.out$/,
  /\.bak$/,
  /^git-installer\.exe$/,
  /^mingit\.zip$/,
  /^filelist\.json$/,
  /^\.git\//,
];

function collectFiles(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? `${base}/${entry.name}` : entry.name;
    if (SKIP_PATTERNS.some((re) => re.test(rel))) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectFiles(full, rel));
    else out.push(rel);
  }
  return out;
}

/* ------------------------------------------------------------ API cagrilari */

async function api(method, endpoint, body) {
  const res = await fetch(`${API}${endpoint}`, {
    method,
    headers: HEADERS,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* metin yanit */ }
  if (!res.ok) {
    const msg = json && json.message ? json.message : text.slice(0, 200);
    const err = new Error(`${method} ${endpoint} -> ${res.status}: ${msg}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

/* ------------------------------------------------------------------ main */

async function main() {
  console.log('NEXUS CHEATS — GitHub yukleme');
  console.log(`Depo: ${OWNER}/${REPO} (dal: ${BRANCH})\n`);

  /* 1) Depo var mi, yoksa olustur */
  let repo;
  try {
    repo = await api('GET', `/repos/${OWNER}/${REPO}`);
    console.log(`✓ Depo mevcut: ${repo.full_name} (${repo.private ? 'özel' : 'herkese açık'})`);
  } catch (err) {
    if (err.status !== 404) throw err;
    console.log('· Depo bulunamadı, oluşturuluyor...');
    repo = await api('POST', '/user/repos', {
      name: REPO,
      description: 'NEXUS CHEATS — Rekabetçi FPS eğitim ve koçluk platformu (Node.js + Express + SQLite)',
      private: false,
      auto_init: false,
    });
    console.log(`✓ Depo oluşturuldu: ${repo.html_url}`);
  }

  /* 2) Dosyalari topla */
  const files = collectFiles(ROOT);
  const totalBytes = files.reduce((s, f) => s + fs.statSync(path.join(ROOT, f)).size, 0);
  console.log(`\n· ${files.length} dosya toplandı (${(totalBytes / 1024).toFixed(1)} KB)`);

  const leaks = files.filter((f) => /(^|\/)\.env$|\.db$|\.pem$|\.key$|\.cer$/i.test(f));
  if (leaks.length) {
    console.error(`\n✗ GÜVENLİK: sır dosyası tespit edildi, yükleme durduruldu:\n  ${leaks.join('\n  ')}`);
    process.exit(1);
  }
  console.log('✓ Güvenlik kontrolü: hiçbir sır dosyası yüklenmiyor');

  if (DRY) {
    console.log('\n--dry-run: yükleme yapılmadı. Dosyalar:');
    files.forEach((f) => console.log(`  ${f}`));
    return;
  }

  /* 3) Blob'lari olustur (paralel, 8'li gruplar) */
  console.log('\n· Dosyalar yükleniyor...');
  const tree = [];
  const CONCURRENCY = 8;
  for (let i = 0; i < files.length; i += CONCURRENCY) {
    const batch = files.slice(i, i + CONCURRENCY);
    const results = await Promise.all(batch.map(async (file) => {
      const content = fs.readFileSync(path.join(ROOT, file));
      const blob = await api('POST', `/repos/${OWNER}/${REPO}/git/blobs`, {
        content: content.toString('base64'),
        encoding: 'base64',
      });
      return { path: file, mode: '100644', type: 'blob', sha: blob.sha };
    }));
    tree.push(...results);
    process.stdout.write(`\r  ${Math.min(i + CONCURRENCY, files.length)}/${files.length}`);
  }
  console.log('\n✓ Blob\'lar oluşturuldu');

  /* 4) Mevcut dal var mi? */
  let parentSha = null;
  let baseTreeSha = null;
  try {
    const ref = await api('GET', `/repos/${OWNER}/${REPO}/git/ref/heads/${BRANCH}`);
    parentSha = ref.object.sha;
    const commit = await api('GET', `/repos/${OWNER}/${REPO}/git/commits/${parentSha}`);
    baseTreeSha = commit.tree.sha;
    console.log(`· Mevcut dal bulundu (${parentSha.slice(0, 7)}) — üzerine yazılacak`);
  } catch (err) {
    if (err.status !== 404) throw err;
    console.log('· Dal yok — ilk commit oluşturulacak');
  }

  /* 5) Tree olustur */
  const treeBody = { tree };
  if (baseTreeSha) treeBody.base_tree = baseTreeSha;
  const newTree = await api('POST', `/repos/${OWNER}/${REPO}/git/trees`, treeBody);
  console.log('✓ Ağaç (tree) oluşturuldu');

  /* 6) Commit */
  const commitBody = {
    message: parentSha
      ? 'NEXUS CHEATS güncellendi'
      : 'NEXUS CHEATS ilk sürüm\n\nRekabetçi FPS eğitim ve koçluk platformu.\nNode.js + Express + SQLite, tamamen Türkçe arayüz.',
    tree: newTree.sha,
    parents: parentSha ? [parentSha] : [],
  };
  const commit = await api('POST', `/repos/${OWNER}/${REPO}/git/commits`, commitBody);
  console.log(`✓ Commit oluşturuldu (${commit.sha.slice(0, 7)})`);

  /* 7) Ref guncelle / olustur */
  if (parentSha) {
    await api('PATCH', `/repos/${OWNER}/${REPO}/git/refs/heads/${BRANCH}`, {
      sha: commit.sha,
      force: true,
    });
    console.log(`✓ ${BRANCH} dalı güncellendi`);
  } else {
    await api('POST', `/repos/${OWNER}/${REPO}/git/refs`, {
      ref: `refs/heads/${BRANCH}`,
      sha: commit.sha,
    });
    console.log(`✓ ${BRANCH} dalı oluşturuldu`);
  }

  /* 8) Varsayilan dali ayarla */
  try {
    await api('PATCH', `/repos/${OWNER}/${REPO}`, { default_branch: BRANCH });
  } catch { /* onemsiz */ }

  console.log(`\n${'─'.repeat(58)}`);
  console.log('YÜKLEME TAMAMLANDI');
  console.log(`  Depo  : ${repo.html_url}`);
  console.log(`  Commit: ${commit.html_url || `${repo.html_url}/commit/${commit.sha}`}`);
  console.log('─'.repeat(58));
}

main().catch((err) => {
  console.error('\n✗ HATA:', err.message);
  process.exitCode = 1;
});
