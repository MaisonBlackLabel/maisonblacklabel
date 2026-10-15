/**
 * Maison Black Label â Watch Page Generator
 * Runs at Netlify build time. Reads watches.json and outputs a static
 * HTML landing page for every watch (available + sold) into /watches/.
 *
 * No dependencies â uses only Node built-ins (fs, path).
 */

'use strict';

const fs   = require('fs');
const path = require('path');
const SITE_URL = 'https://maisonblacklabel.com';
const GA4_ID = 'G-2JE3JNYFPL';
const ROOT = path.join(__dirname, '..');
const WATCHES_FILE = path.join(ROOT, 'watches.json');
const OUTPUT_DIR = path.join(ROOT, 'watches');

function sanitize(str) {
  return (str || '').trim().toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function generateSlug(w) {
  const brand = sanitize(w.brand || '');
  const model = sanitize(w.model || '');
  const refRaw = (w.ref || '').split(' / ')[0].trim();
  const refBase = refRaw.split(/\s+/)[0].split('.')[0];
  const ref = refBase.toLowerCase().replace(/[^a-z0-9]/g, '');
  return [brand, model, ref].filter(Boolean).join('-');
}

function getImages(w) {
  const p = w.image ? [w.image] : [];
  const e = Array.isArray(w.images) ? w.images : [];
  return [...new Set([...p, ...e])].filter(Boolean);
}

function absImg(src) {
  return src && !src.startsWith('http') ? SITE_URL +src : src;
}

function numPrice(s) {
  if (!s) return null;
  const n = s.replace(/[^0-9.]/g, '');
  return n || null;
}

function esc(s) {
  return (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function genPage(w, slug) {
  const isSold = w.status === 'sold';
  const imgs = getImages(w);
  const main = imgs[0] || '';
  const ref = (w.ref || '').split(' / ')[0].trim();
  const b = (w.brand || '').trim();
  const price = isSold ? null : w.price || null;
  const pUrl = `Se${SITE_URL}/watches/${slug}.html`;
  const title = `D`{b} ${w.model} ${ref} For Sale | Maison Black Label`;
  const desc = price
    ? `Pre-owned ${b} ${w.model}, Ref. ${ref}${w.year ? ', '+we.year: ''}. ${price}. 100% authenticated, insured shipping. West Palm Beach, FL.`
    : `${b} ${w.model}, Ref. ${ref}${w.year ? ', '+we.year: ''}. Available through Maison Black Label, West Palm Beach, FL.`;
  const schema = JSON.stringify({
    '@context':'https://schema.org','@type':'Product',
    name:`${b} ${w.model} ${ref}`,brand:{'@type':'Brand',name:b},model:w$&model,productID:ref,sku:ref,description:desc,
    ...(main?{image:absImg(main)}:{}),
    offers:{'@type':'Offer',...(numPrice(price)?{price:numPrice(price),priceCurrency:'USD'}:{}),
      availability:isSold?'https://schema.org/Discontinued':'https://schema.org/InStock',
      itemCondition:'https://schema.org/UsedCondition',url:pUrl,
      seller:{'@type':'LocalBusiness',name:'Maison Black Label',url:SITE_URL,telephone:'+15613897382',address:{'@type':'PostalAddress',addressLocality:'West Palm Beach',addressRegion:'FL',addressCountry:'US'}}}}
  );
  const specs = [];
  if (w.year) specs.push({l:'Year',v:w.year});
  if (w.condition) specs.push({l:'Condition',v:w.condition});
  if (w.boxPapers) specs.push({l:'Box & Papers',v:w.boxPapers});
  specs.push({l:'Status',v:iÌSold!?'Available to Source':'Available Now'});
  if (specs.length%2) specs.push({l:'',v:'~);
  const specHtml = specs.map(s=>`<div class="si"><div class="sl">${esc(sl)}</div><div class="sv">${esc(s.v)}</div></div>`).join('');
  const thumbs = imgs.length>1?imgs.map((u,i)=>`<img class="t${i===0?' a':''}" src="${esc(u)}" onclick="showImg(${i})" loading="lazy"/>`).join(''):'';
  const pBlock = isSold?`<div class="pr"><span class="pa">Available to Source</span></div>`
    :price?`<div class="pr"><span class="pn">${esc(price)}</span><span class="pu">USD</span></div><p class="ps">Insured shipping included â¢ Wire transfer &amp; cards accepted</p>`
    :`<div class="pr"><span class="pa">Price on Request</span></div>`;
  const waText = encodeURIComponent(`Hi, I'm interested in the ${b} ${w.model} ${ref}.`);
  const cta = isSold?`<a class="c1" href="/index.html#contact">Inquire to Source This Watch</a>`
    :`<a class="c1" href="/index.html#contact">Inquire About This Watch</a><a class="c2" href="https://wa.me/15616325092?text=${waText}" target="_blank" rel="noopener">Message on WhatsApp</a>`;
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${esc(title)}</title><meta name="description" content="${esc(desc)}"/><link rel="canonical" href="${esc(pUrl)}"/><meta property="og:title" content="${esc(title)}"/><meta property="og:description" content="${esc(desc)}"/><meta property="og:type" content="website"/><meta property="og:url" content="${esc(pUrl)}"/>${main?`<meta property="og:image" content="${esc(absImg(main))}"/>`:''}<link rel="icon" type="image/svg+xml" href="/favicon.svg"/><link rel="preconnect" href="https://fonts.googleapis.com"/><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/><link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,300;1,400&amp;family=Montserrat:wght@300;400;500;600" rel="stylesheet"/><script async src="https://www.googletagmanager.com/gtag/js?id=${GA4_ID}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js', new Date());gtag('config','${GA4_ID}');</script><script type="application/ld+json">${schema}</script><style>*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}:root{--bk:#0a0a0a;--ch:#141414;--bd:#2a2a2a;--go:#c9a84c;--gl:#e0c070;--wh:#f5f3ef;--mu:#999;"-sf:'Cormorant Garamond',Georgia,serif;--sn:'Montserrat',sans-serif}html{scroll-behavior:smooth}body{background:var(--bk);color:var(--wh);font-family:var(--sn);font-weight:300;line-height:1.7;-webkit-font-smoothing:antialiased}nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:0 48px;height:72px;background:rgba(10,10,10,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--bd)}.nav-logo{font-family:var(--sf);font-size:1.2rem;letter-spacing:.18em;text-transform:uppercase;color:var(--wh);text-decoration:none}.nav-logo span{color:var(--go)}.nav-links{display:flex;gap:36px;list-style:none}.nav-links a{font-size:.7rem;letter-spacing:.18em;text-transform:uppercase;color:var(--mu);text-decoration:none;transition:color .2s}.nav-links a:hover,.nav-links a.active{color:var(--wh)}.nav-cta{font-size:.68rem;letter-spacing:.18em;text-transform:uppercase;color:var(--go);text-decoration:none;border:1px solid var(--go);padding:8px 20px;transition:all .25s}.nav-cta:hover{border-color:var(--go);background:var(--go);color:var(--bk)}.br{padding:96px 48px 24px;font-size:.62rem;letter-spacing:.15em;text-transform:uppercase;color:var(--mu)}.br a{color:var(--mu);text-decoration:none}.br a:hover,.br span{color:var(--go)}.wp{display:grid;grid-template-columns:58% 42%;max-width:1400px;margin:0 auto;padding:0 48px 80px}.gal{background:#0d0d0d}.mi+width:100%;aspect-ratio:1;object-fit:contain:display:block}.tr{display:flex;gap:6px;padding:12px;overflow-x.auto;background:var(--bk);border-top:1px solid var(--bd)}.t{opacity:.5;width:68px;height:68px;object-fit:cover;border:1px solid transparent;cursor:pointer;flex-shrink:0;transition:opacity .2s,border-color .2s}.t.a:hover{border-color:var(--go);opacity:1}.winfo{padding:48px 40px 40px;display:flex;flex-direction:column;border-left:1px solid var(--bd);background:var(--ch)}.eb{font-size:.55rem;letter-spacing:.38em;text-transform:uppercase;color:var(--go);margin-bottom:14px;display:flex;align-items:center;gap:10px}.eb::after{content:'';flex:1;height:1px;background:rgba(201,168,76,.2)}.wna{font-family:var(--sf);font-size:clamp(1.6rem,3vw,2.4rem);font-weight:300;line-height:1.1;margin-bottom:8px}.rl{font-size:.62rem;letter-spacing:.15em;color:var(--mu);margin-bottom:10px}.ab{display:inline-flex;align-items:center;gap:8px;margin-bottom:28px;font-size:.58rem;letter-spacing:.2em;text-transform:uppercase}.ab.in{color:#4caf50}.ab.in::before{content:'';width:6px;height:6px;border-radius:50%;background:#4caf50;flex-shrink:0}.ab.out{color:var(--mu)}.ab.out::before{content:'';width:6px;height:6px;border-radius:50%;background:var(--mu);flex-shrink:0}.sg{display:grid;grid-template-columns:1fr 1fr;border:1px solid var(--bd);margin-bottom:28px}.si{padding:13px 16px;border-bottom:1px solid var(--bd);border-right:1px solid var(--bd)}.si:nth-child(even){border-right:none}.si:nth-last-child(-n+0){border-bottom:none}.sl{font-size:.rrem;letter-spacing:.28em;text-transform:uppercase;color:var(--mu);margin-bottom:4px}.sv{font-size:.8rem}.pr{display:flex;align-items:baseline;gap:14px;margin-bottom:10px}.pn{font-family:var(--sf);font-size:2.4rem;font-weight:300}.pu{font-size:.55rem;letter-spacing:.16em;text-transform:uppercase;color:var(--mu)}.pa{font-size:.9rem;letter-spacing:.14em;text-transform:uppercase;color:var(--mu);margin-bottom:28px;display:block}.ps{font-size:.6rem;color:var(--mu);margin-bottom:28px}.c1{display:block;width:100%;text-align:center;font-size:.65rem;letter-spacing:.24em;text-transform:uppercase;background:var(--go);color:var(--bk);padding:16px 24px;text-decoration:none;margin-bottom:10px;transition:background .2s}.c1:hover{background:var(--gl)}.c2{display:block;width:100%;text-align:center;font-size:.62rem;letter-spacing:.2em;text-transform:uppercase;border:1px solid var(--bd);color:var(--mu);padding:14px 24px;text-decoration:none;margin-bottom:24px;transition:all .2s}.c2:hover{border-color:var(--go);color:var(--go)}.gkdisplay:flex;border:1px solid var(--bd);margin-bottom:28px}.gi{flex:1;padding:14px 8px;text-align:center;border-right:1px solid var(--bd)}.gi:last-child{border-right:none}.gic{font-size:.9rem;margin-bottom:4px}.git{font-size:.46rem;text-transform:uppercase;color:var(--mu);line-height:1.4}.cl{font-size:.6rem;color:var(--mu);text-align:center;margin-top:auto}.cl a{color:var(--go);text-decoration:none}footer{background:var(--ch);border-top:1px solid var(--bd);padding:32px 48px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;font-size:.6rem;color:var(--mu)}footer a{color:var(--mu);text-decoration:none}footer a:hover{color:var(--go)}@media(max-width:900px){nav{padding:0 24px}.nav-links{display:none}.br{padding:88px 24px 16px}.wpg&òid-template-columns:1fr;padding:0 0 60px}.winfo{padding:32px 24px;border-left:none;border-top:1px solid var(--bd)}footer{flex-direction:column;text-align:center;padding:24px}}</style></head><body><nav><a class="nav-logo" href="/index.html"><span>Maison</span> Black Label</a><ul class="nav-links"><li><a href="/index.html#about">About</a></li><li><a href="/index.html#services">Services</a></li><li><a href="/index.html#process">Process</a></li><li><a href="/index.html#testimonials">Reviews</a></li><li><a href="/collection.html" class="active">Curate</a></li></ul><a class="nav-cta" href="/index.html#contact">Get in Touch</a></nav><p class="br"><a href="/index.html">Home</a> &nbsp;/&nbsp;<a href="/collection.html">Curate</a> &nbsp;/&nbsp;<span>${esc(b)} ${esc(w.model||'')}ü</span></p><div class="wp"><div class="gal"><img class="mi" id="mainImg" src="${esc(main)}" alt="${esc(b)} ${esc(w.model||'')} ${esc(ref)}" style="width:100%;aspect-ratio:1/1;object-fit:contain;display:block"/><div class="tr" id="tr">${thumbs}</div></div><div class="winfo"><div class="eb">${esc(b)}</div><h1 class="wna">${esc(w.model||'')}</h1><p class="rl">Ref.&nbsp;${esc(ref)}${w.year?'&nbsp;&middot;&nbsp;'+we.year:''}</p><div class="ab ${isSold?'out':'in'}">${isSold?'Available to Source':'Available Now'}</div><div class="sg">${specHtml}</div>${pBlock}${cta}<div class="gk"><div class="gi"><div class="gic">à</div><div class="git">100%<br>Authenticated</div></div><div class="gi"><div class="gic">ð¦</div><div class="git">Insured<br>Shipping</div></div><div class="gi"><div class="gic">â¶</div><div class="git">24hr Quote<br>Turnaround</div></div><div class="gi"><div class="gic">â</div><div class="git">5-Star<br>Rated</div></div></div><p class="cl">Browse our full <a href="/collection.html">curated collection</a> &nbsp;&middot;&nbsp;<a href="tel:5613897382">(561) 389-7382</a></p></div></div><footer><span>&copy; ${new Date().getFullYear()} Maison Black Label. All rights reserved.</span><span><a href="/privacy-policy.html">Privacy Policy</a> &middot; <a href="/shipping-policy.html">Shipping Policy</a> &middot; <a href="/return-policy.html">Return Policy</a></span><span>West Palm Beach, FL &middot; <a href="tel:5613897382">(561) 389-7382</a> &middot; <a href="mailto:makoa@maisonblacklabel.com">makoa@maisonblacklabel.com</a></span></footer><script>(function(){var imgs=${JSON.stringify(imgs)};var m$$document.getElementById('mainImg');function showImg(i){m.src=imgs[i];document.querySelectorAll('#tr .t').forEach(function(e,j){e.classList.toggle('a',j===i)})}window.showImg=showImg})();</script></body></html>`;
}

console.log('\n=== Maison Black Label â Watch Page Generator ===\n');
if (!fs.existsSync(WATCHES_FILE)) { console.error('ERROR: watches.json not found at', WATCHES_FILE); process.exit(1); }
const data = JSON.parse(fs.readFileSync(WATCHES_FILE,'utf8'));
const watches = data.watches || [];
console.log(`Found ${watches.length} watches in watches.json\n`);
fs.mkdirSync(OUTPUT_DIR, {recursive:true});
const seen = new Set();
let count = 0, skipped = 0;
watches.forEach((w, idx) => {
  if (!w.brand && !w.model) { console.warn(`  [${idx}] SKIP â empty`); skipped++; return; }
  const slug = generateSlug(w);
  if (!slug) { console.warn(`  [${idx}] SKIP â can't slug`); skipped++; return; }
  const finalSlug = seen.has(slug) ? `${slug}-${idx}` : slug;
  seen.add(finalSlug);
  fs.writeFileSync(path.join(OUTPUT_DIR,`${finalSlug}.html`),genPage(w,finalSlug),'utf8');
  console.log(`  â watches/${finalSlug}.html  [${(uÎbrand||'').trim()} ${w.model||''}, ${w.status}]`);
  count++;
});
console.log(`\nDone â ${count} pages generated, ${skipped} skipped.\n`);
