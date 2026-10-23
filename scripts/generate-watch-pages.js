/**
 * Maison Black Label — Watch Page Generator
 * Runs at Netlify build time. Reads watches.json and outputs a static
 * HTML landing page for every watch (available + sold) into /watches/.
 *
 * No dependencies — uses only Node built-ins (fs, path).
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── Config ────────────────────────────────────────────────────────────────────
const SITE_URL   = 'https://maisonblacklabel.com';
const GA4_ID     = 'G-2JE3JNYFPL';
const ROOT       = path.join(__dirname, '..');
const WATCHES_FILE = path.join(ROOT, 'watches.json');
const OUTPUT_DIR   = path.join(ROOT, 'watches');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Lowercase, strip specials, collapse to hyphens */
function sanitize(str) {
  return (str || '')
    .trim()
    .toLowerCase()
    .replace(/['"""'']/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Build a URL slug from a watch object.
 * Pattern: {brand}-{model}-{base-ref}
 */
function generateSlug(watch) {
  const brand = sanitize(watch.brand || '');
  const model = sanitize(watch.model || '');
  const refRaw   = (watch.ref || '').split(' / ')[0].trim();
  const refToken  = refRaw.split(/\s+/)[0];
  const refBase   = refToken.split('.')[0];
  const ref       = refBase.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [brand, model, ref].filter(Boolean).join('-');
}

/** Collect all image URLs from a watch, deduplicated */
function getImages(watch) {
  const primary = watch.image  ? [watch.image]  : [];
  const extra   = Array.isArray(watch.images) ? watch.images : [];
  return [...new Set([...primary, ...extra])].filter(Boolean);
}

/** Absolute URL for an image */
function absImg(src) {
  if (!src) return '';
  return src.startsWith('http') ? src : `${SITE_URL}${src}`;
}

/** Strip price symbol and commas → numeric string for schema */
function numericPrice(priceStr) {
  if (!priceStr) return null;
  const n = priceStr.replace(/[^0-9.]/g, '');
  return n || null;
}

/** Escape HTML entities */
function esc(str) {
  return (str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Build spec rows for the grid */
function buildSpecs(watch, isSold) {
  const rows = [];
  if (watch.year)       rows.push({ label: 'Year',         value: watch.year });
  if (watch.condition)  rows.push({ label: 'Condition',    value: watch.condition });
  if (watch.boxPapers)  rows.push({ label: 'Box & Papers', value: watch.boxPapers });
  rows.push({ label: 'Status', value: isSold ? 'Available to Source' : 'Available Now' });
  if (rows.length % 2 !== 0) rows.push({ label: '', value: '' });
  return rows;
}

// ── Page template ─────────────────────────────────────────────────────────────
function generatePage(watch, slug) {
  const isSold    = watch.status === 'sold';
  const images    = getImages(watch);
  const mainImage = images[0] || '';
  const canonRef  = (watch.ref || '').split(' / ')[0].trim();
  const brandTrim = (watch.brand || '').trim();
  const price     = isSold ? null : (watch.price || null);
  const priceNum  = numericPrice(price);
  const pageUrl   = `${SITE_URL}/watches/${slug}.html`;
  const year      = watch.year ? `, ${watch.year}` : '';
  const cond      = watch.condition ? `, ${watch.condition} condition` : '';

  const title    = `${brandTrim} ${watch.model} ${canonRef} For Sale | Maison Black Label`;
  const metaDesc = price
    ? `Pre-owned ${brandTrim} ${watch.model}, Ref. ${canonRef}${year}${cond}. ${price}. 100% authenticated, insured shipping. West Palm Beach, FL.`
    : isSold
      ? `${brandTrim} ${watch.model}, Ref. ${canonRef}${year}. Available to source through Maison Black Label, West Palm Beach, FL.`
      : `${brandTrim} ${watch.model}, Ref. ${canonRef}${year}${cond}. Price on request. Authenticated. West Palm Beach, FL.`;

  // JSON-LD Product schema
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: `${brandTrim} ${watch.model} ${canonRef}`,
    brand: { '@type': 'Brand', name: brandTrim },
    model: watch.model,
    productID: canonRef,
    sku: canonRef,
    description: metaDesc,
    ...(mainImage ? { image: absImg(mainImage) } : {}),
    offers: {
      '@type': 'Offer',
      ...(priceNum ? { price: priceNum, priceCurrency: 'USD' } : {}),
      availability: isSold
        ? 'https://schema.org/Discontinued'
        : 'https://schema.org/InStock',
      itemCondition: 'https://schema.org/UsedCondition',
      url: pageUrl,
      seller: {
        '@type': 'LocalBusiness',
        name: 'Maison Black Label',
        url: SITE_URL,
        telephone: '+15613897382',
        address: {
          '@type': 'PostalAddress',
          addressLocality: 'West Palm Beach',
          addressRegion: 'FL',
          addressCountry: 'US'
        }
      }
    }
  };

  const specs     = buildSpecs(watch, isSold);
  const specsHtml = specs.map(s =>
    `<div class="spec-item"><div class="spec-label">${esc(s.label)}</div><div class="spec-value">${esc(s.value)}</div></div>`
  ).join('');

  // Cinematic slides
  const slidesHtml = images.length
    ? images.map((src, i) =>
        `<div class="slide${i === 0 ? ' active' : ''}" style="background-image:url('${esc(src)}')" role="img" aria-label="${esc(brandTrim)} ${esc(watch.model || '')} photo ${i + 1}"></div>`
      ).join('')
    : `<div class="slide active slide--empty"></div>`;

  // Dots (only if multiple images)
  const dotsHtml = images.length > 1
    ? `<div class="cin-dots" id="cinDots">${images.map((_,i) =>
        `<button class="cin-dot${i===0?' active':''}" onclick="cinGo(${i})" aria-label="Photo ${i+1}"></button>`
      ).join('')}</div>`
    : '';

  // Arrows (only if multiple images)
  const arrowsHtml = images.length > 1
    ? `<button class="cin-arrow cin-prev" onclick="cinNav(-1)" aria-label="Previous photo">&#8592;</button>
       <button class="cin-arrow cin-next" onclick="cinNav(1)"  aria-label="Next photo">&#8594;</button>`
    : '';

  // Counter (only if multiple images)
  const counterHtml = images.length > 1
    ? `<div class="cin-counter" id="cinCounter">1 / ${images.length}</div>`
    : '';

  let priceBlock;
  if (isSold) {
    priceBlock = `<div class="price-row"><span class="price-alt">Available to Source</span></div>`;
  } else if (price) {
    priceBlock = `
    <div class="price-row">
      <span class="price">${esc(price)}</span>
      <span class="price-note">USD</span>
    </div>
    <p class="price-sub">Insured shipping included &nbsp;&middot;&nbsp; Wire transfer &amp; major cards accepted</p>`;
  } else {
    priceBlock = `<div class="price-row"><span class="price-alt">Price on Request</span></div>`;
  }

  const waText  = encodeURIComponent(`Hi, I'm interested in the ${brandTrim} ${watch.model} ${canonRef}.`);
  const ctaHtml = isSold
    ? `<a class="cta-primary" href="/index.html#contact">Inquire to Source This Watch</a>`
    : `<a class="cta-primary" href="/index.html#contact">Inquire About This Watch</a>
    <a class="cta-secondary" href="https://wa.me/15616325092?text=${waText}" target="_blank" rel="noopener">Message on WhatsApp</a>`;

  const year_ = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(metaDesc)}" />
<link rel="canonical" href="${esc(pageUrl)}" />
<meta property="og:title" content="${esc(`${brandTrim} ${watch.model} ${canonRef} | Maison Black Label`)}" />
<meta property="og:description" content="${esc(metaDesc)}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${esc(pageUrl)}" />
${mainImage ? `<meta property="og:image" content="${esc(absImg(mainImage))}" />` : ''}
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Montserrat:wght@300;400;500;600&display=swap" rel="stylesheet" />
<script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script>
<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA4_ID}');</script>
<script type="application/ld+json">${JSON.stringify(schema)}</script>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
:root{--black:#0a0a0a;--charcoal:#141414;--border:#2a2a2a;--gold:#c9a84c;--gold-light:#e0c070;--white:#f5f3ef;--muted:#999;--serif:'Cormorant Garamond',Georgia,serif;--sans:'Montserrat',sans-serif}
html{scroll-behavior:smooth}
body{background:var(--black);color:var(--white);font-family:var(--sans);font-weight:300;line-height:1.7;-webkit-font-smoothing:antialiased}

/* ── Nav ── */
nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0 48px;height:72px;background:rgba(10,10,10,0.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--border)}
.nav-logo{font-family:var(--serif);font-size:1.2rem;font-weight:300;letter-spacing:0.18em;text-transform:uppercase;color:var(--white);text-decoration:none}
.nav-logo span{color:var(--gold)}
.nav-links{display:flex;gap:36px;list-style:none}
.nav-links a{font-size:0.7rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--muted);text-decoration:none;transition:color 0.2s}
.nav-links a:hover,.nav-links a.active{color:var(--white)}
.nav-cta{font-size:0.68rem;letter-spacing:0.18em;text-transform:uppercase;color:var(--gold);text-decoration:none;border:1px solid var(--gold);padding:8px 20px;transition:all 0.25s}
.nav-cta:hover{background:var(--gold);color:var(--black)}

/* ── Breadcrumb ── */
.breadcrumb{padding:96px 48px 24px;font-size:0.62rem;letter-spacing:0.15em;text-transform:uppercase;color:var(--muted)}
.breadcrumb a{color:var(--muted);text-decoration:none}.breadcrumb a:hover,.breadcrumb span{color:var(--gold)}

/* ── Page grid ── */
.watch-page{display:grid;grid-template-columns:58% 42%;max-width:1400px;margin:0 auto;padding:0 48px 80px}

/* ── Cinematic gallery ── */
.gallery{position:relative;overflow:hidden;background:#080808;aspect-ratio:1/1;align-self:start}
.slide{position:absolute;inset:0;opacity:0;transition:opacity 0.65s ease;background-size:cover;background-position:center;background-repeat:no-repeat}
.slide.active{opacity:1}
.slide--empty{background:#111}

/* Bottom gradient for overlay legibility */
.gallery::after{content:'';position:absolute;inset:0;background:linear-gradient(to top,rgba(8,8,8,0.55) 0%,transparent 40%);pointer-events:none;z-index:1}

/* Arrows */
.cin-arrow{position:absolute;top:50%;transform:translateY(-50%);z-index:10;background:rgba(10,10,10,0.55);border:1px solid rgba(201,168,76,0.35);color:var(--gold);width:46px;height:46px;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:1.1rem;transition:all 0.22s;backdrop-filter:blur(6px);font-family:var(--sans)}
.cin-arrow:hover{background:var(--gold);color:var(--black);border-color:var(--gold)}
.cin-prev{left:16px}
.cin-next{right:16px}

/* Dot nav */
.cin-dots{position:absolute;bottom:18px;left:50%;transform:translateX(-50%);display:flex;gap:7px;z-index:10}
.cin-dot{width:5px;height:5px;border-radius:50%;background:rgba(201,168,76,0.3);cursor:pointer;border:none;transition:all 0.22s;padding:0}
.cin-dot.active{background:var(--gold);width:22px;border-radius:3px}

/* Counter */
.cin-counter{position:absolute;bottom:20px;right:18px;z-index:10;font-size:0.5rem;letter-spacing:0.18em;color:rgba(245,243,239,0.5);font-family:var(--sans)}

/* ── Info panel ── */
.watch-info{padding:48px 40px 40px;display:flex;flex-direction:column;background:var(--charcoal);border-left:1px solid var(--border)}
.eyebrow{font-size:0.55rem;letter-spacing:0.38em;text-transform:uppercase;color:var(--gold);margin-bottom:14px;display:flex;align-items:center;gap:10px}
.eyebrow::after{content:'';flex:1;height:1px;background:rgba(201,168,76,0.2)}
.watch-name{font-family:var(--serif);font-size:clamp(1.6rem,3vw,2.4rem);font-weight:300;line-height:1.1;letter-spacing:0.04em;margin-bottom:8px}
.ref-line{font-size:0.62rem;letter-spacing:0.15em;color:var(--muted);margin-bottom:10px}
.avail-badge{display:inline-flex;align-items:center;gap:8px;margin-bottom:28px;font-size:0.58rem;letter-spacing:0.2em;text-transform:uppercase}
.avail-badge.in{color:#4caf50}.avail-badge.in::before{content:'';width:6px;height:6px;border-radius:50%;background:#4caf50;flex-shrink:0}
.avail-badge.out{color:var(--muted)}.avail-badge.out::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--muted);flex-shrink:0}
.spec-grid{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--border);margin-bottom:28px}
.spec-item{padding:13px 16px;border-bottom:1px solid var(--border);border-right:1px solid var(--border)}
.spec-item:nth-child(even){border-right:none}
.spec-item:nth-last-child(-n+2){border-bottom:none}
.spec-label{font-size:0.5rem;letter-spacing:0.28em;text-transform:uppercase;color:var(--muted);margin-bottom:4px}
.spec-value{font-size:0.8rem;letter-spacing:0.06em}
.price-row{display:flex;align-items:baseline;gap:14px;margin-bottom:10px}
.price{font-family:var(--serif);font-size:2.4rem;font-weight:300}
.price-note{font-size:0.55rem;letter-spacing:0.16em;text-transform:uppercase;color:var(--muted)}
.price-alt{font-size:0.9rem;letter-spacing:0.14em;text-transform:uppercase;color:var(--muted);margin-bottom:28px;display:block}
.price-sub{font-size:0.6rem;letter-spacing:0.12em;color:var(--muted);margin-bottom:28px}
.cta-primary{display:block;width:100%;text-align:center;font-size:0.65rem;letter-spacing:0.24em;text-transform:uppercase;background:var(--gold);color:var(--black);padding:16px 24px;text-decoration:none;margin-bottom:10px;transition:background 0.2s;font-family:var(--sans)}
.cta-primary:hover{background:var(--gold-light)}
.cta-secondary{display:block;width:100%;text-align:center;font-size:0.62rem;letter-spacing:0.2em;text-transform:uppercase;border:1px solid var(--border);color:var(--muted);padding:14px 24px;text-decoration:none;margin-bottom:24px;transition:all 0.2s;font-family:var(--sans)}
.cta-secondary:hover{border-color:var(--gold);color:var(--gold)}
.guarantee{display:flex;border:1px solid var(--border);margin-bottom:28px}
.g-item{flex:1;padding:14px 8px;text-align:center;border-right:1px solid var(--border)}
.g-item:last-child{border-right:none}
.g-icon{font-size:0.9rem;margin-bottom:4px}
.g-text{font-size:0.46rem;letter-spacing:0.12em;text-transform:uppercase;color:var(--muted);line-height:1.4}
.cross-link{font-size:0.6rem;letter-spacing:0.12em;color:var(--muted);text-align:center;margin-top:auto}
.cross-link a{color:var(--gold);text-decoration:none}

/* ── Footer ── */
footer{background:var(--charcoal);border-top:1px solid var(--border);padding:32px 48px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:0.6rem;letter-spacing:0.12em;color:var(--muted)}
footer a{color:var(--muted);text-decoration:none}footer a:hover{color:var(--gold)}

/* ── Quick contact ── */
.qc{position:fixed;bottom:28px;right:28px;z-index:500;display:flex;flex-direction:column;gap:12px}
.qc a{width:52px;height:52px;border-radius:50%;background:var(--black);border:1px solid var(--gold);color:var(--gold);display:flex;align-items:center;justify-content:center;text-decoration:none;transition:all 0.25s;box-shadow:0 4px 14px rgba(0,0,0,0.4);font-family:var(--sans);font-size:0.56rem;font-weight:600}
.qc a:hover{background:var(--gold);color:var(--black);transform:translateY(-2px)}

/* ── Responsive ── */
@media(max-width:900px){
  nav{padding:0 24px}.nav-links{display:none}
  .breadcrumb{padding:88px 24px 16px}
  .watch-page{grid-template-columns:1fr;padding:0 0 60px}
  .gallery{aspect-ratio:4/3}
  .watch-info{padding:32px 24px;border-left:none;border-top:1px solid var(--border)}
  footer{flex-direction:column;text-align:center;padding:24px}
  .qc{bottom:20px;right:16px}
}
</style>
</head>
<body>
<nav>
  <a class="nav-logo" href="/index.html"><span>Maison</span> Black Label</a>
  <ul class="nav-links">
    <li><a href="/index.html#about">About</a></li>
    <li><a href="/index.html#services">Services</a></li>
    <li><a href="/index.html#process">Process</a></li>
    <li><a href="/index.html#testimonials">Reviews</a></li>
    <li><a href="/collection.html" class="active">Curate</a></li>
  </ul>
  <a class="nav-cta" href="/index.html#contact">Get in Touch</a>
</nav>

<p class="breadcrumb">
  <a href="/index.html">Home</a> &nbsp;/&nbsp;
  <a href="/collection.html">Curate</a> &nbsp;/&nbsp;
  <span>${esc(brandTrim)} ${esc(watch.model || '')}</span>
</p>

<div class="watch-page">
  <div class="gallery" id="gallery">
    ${slidesHtml}
    ${arrowsHtml}
    ${dotsHtml}
    ${counterHtml}
  </div>

  <div class="watch-info">
    <div class="eyebrow">${esc(brandTrim)}</div>
    <h1 class="watch-name">${esc(watch.model || '')}</h1>
    <p class="ref-line">Ref.&nbsp;${esc(canonRef)}${watch.year ? '&nbsp;&middot;&nbsp;' + esc(watch.year) : ''}</p>
    <div class="avail-badge ${isSold ? 'out' : 'in'}">${isSold ? 'Available to Source' : 'Available Now'}</div>

    <div class="spec-grid">${specsHtml}</div>

    ${priceBlock}
    ${ctaHtml}

    <div class="guarantee">
      <div class="g-item"><div class="g-icon">&#x1F512;</div><div class="g-text">100%<br>Authenticated</div></div>
      <div class="g-item"><div class="g-icon">&#x1F4E6;</div><div class="g-text">Insured<br>Shipping</div></div>
      <div class="g-item"><div class="g-icon">&#x2736;</div><div class="g-text">24hr Quote<br>Turnaround</div></div>
      <div class="g-item"><div class="g-icon">&#x2605;</div><div class="g-text">5-Star<br>Rated</div></div>
    </div>

    <p class="cross-link">
      Browse our full <a href="/collection.html">curated collection</a>
      &nbsp;&middot;&nbsp; <a href="tel:5613897382">(561) 389-7382</a>
    </p>
  </div>
</div>

<footer>
  <span>&copy; ${year_} Maison Black Label. All rights reserved.</span>
  <span>
    <a href="/privacy-policy.html">Privacy Policy</a> &nbsp;&middot;&nbsp;
    <a href="/shipping-policy.html">Shipping Policy</a> &nbsp;&middot;&nbsp;
    <a href="/return-policy.html">Return Policy</a>
  </span>
  <span>West Palm Beach, FL &nbsp;&middot;&nbsp; <a href="tel:5613897382">(561) 389-7382</a> &nbsp;&middot;&nbsp; <a href="mailto:makoa@maisonblacklabel.com">makoa@maisonblacklabel.com</a></span>
</footer>

<div class="qc">
  <a href="https://wa.me/15616325092?text=${waText}" target="_blank" rel="noopener" title="WhatsApp">WA</a>
  <a href="https://ig.me/m/maisonblacklabel" target="_blank" rel="noopener" title="Instagram DM">IG</a>
  <a href="sms:+15613897382" title="Text Us">SMS</a>
</div>

<script>
(function(){
  var total = ${images.length};
  if (total < 2) return;
  var current = 0;
  var slides  = document.querySelectorAll('#gallery .slide');
  var dots    = document.querySelectorAll('#gallery .cin-dot');
  var counter = document.getElementById('cinCounter');

  function cinGo(n) {
    slides[current].classList.remove('active');
    if (dots[current]) dots[current].classList.remove('active');
    current = (n + total) % total;
    slides[current].classList.add('active');
    if (dots[current]) dots[current].classList.add('active');
    if (counter) counter.textContent = (current + 1) + ' / ' + total;
  }

  window.cinGo  = cinGo;
  window.cinNav = function(d) { cinGo(current + d); };

  // Touch/swipe support
  var gallery = document.getElementById('gallery');
  var tx = 0;
  gallery.addEventListener('touchstart', function(e){ tx = e.touches[0].clientX; }, { passive: true });
  gallery.addEventListener('touchend',   function(e){
    var dx = e.changedTouches[0].clientX - tx;
    if (Math.abs(dx) > 40) cinNav(dx < 0 ? 1 : -1);
  }, { passive: true });

  // Auto-advance every 6s (pauses on interaction)
  var timer = setInterval(function(){ cinNav(1); }, 6000);
  gallery.addEventListener('touchstart', function(){ clearInterval(timer); }, { passive: true });
  document.querySelectorAll('.cin-arrow, .cin-dot').forEach(function(el){
    el.addEventListener('click', function(){ clearInterval(timer); });
  });
})();
</script>
</body>
</html>`;
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('\n=== Maison Black Label — Watch Page Generator ===\n');

if (!fs.existsSync(WATCHES_FILE)) {
  console.error('ERROR: watches.json not found at', WATCHES_FILE);
  process.exit(1);
}

const data    = JSON.parse(fs.readFileSync(WATCHES_FILE, 'utf8'));
const watches = data.watches || [];
console.log(`Found ${watches.length} watches in watches.json\n`);

fs.mkdirSync(OUTPUT_DIR, { recursive: true });

const seen    = new Set();
let   count   = 0;
let   skipped = 0;

watches.forEach((watch, idx) => {
  if (!watch.brand && !watch.model) {
    console.warn(`  [${idx}] SKIP — no brand or model`);
    skipped++;
    return;
  }

  const slug = generateSlug(watch);

  if (!slug) {
    console.warn(`  [${idx}] SKIP — could not generate slug for ${watch.brand} ${watch.model}`);
    skipped++;
    return;
  }

  if (seen.has(slug)) {
    const uniqueSlug = `${slug}-${idx}`;
    console.warn(`  [${idx}] DUPLICATE slug "${slug}" → using "${uniqueSlug}"`);
    seen.add(uniqueSlug);
    const html = generatePage(watch, uniqueSlug);
    fs.writeFileSync(path.join(OUTPUT_DIR, `${uniqueSlug}.html`), html, 'utf8');
    count++;
    return;
  }

  seen.add(slug);
  const html = generatePage(watch, slug);
  fs.writeFileSync(path.join(OUTPUT_DIR, `${slug}.html`), html, 'utf8');
  console.log(`  ✓ watches/${slug}.html  [${(watch.brand||'').trim()} ${watch.model || ''}, ${watch.status}]`);
  count++;
});

console.log(`\nDone — ${count} pages generated, ${skipped} skipped.\n`);
