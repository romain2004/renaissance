/* ── LANG SWITCHER ──
   data-en / data-fr + localStorage('lang'), FR par défaut. */
let currentLang = localStorage.getItem('lang') || 'fr';
let currentSrvIdx = 0;

const srvLabels = {
  en: ['GULF · SAINT-TROPEZ', "CÔTE D'AZUR · VILLA", 'MEDITERRANEAN · LIGHT', 'PRIVATE · EVENTS'],
  fr: ['GOLFE · SAINT-TROPEZ', "CÔTE D'AZUR · VILLA", 'LUMIÈRE MÉDITERRANÉENNE', 'ÉVÉNEMENTS · PRIVÉS']
};

/* Prix : la source est l'attribut data-price (voir le bloc commenté de la section Offres).
   Un nombre s'affiche en euros ; data-price="on-request" affiche « Sur demande / On request ». */
const priceOnRequest = { fr: 'Sur demande', en: 'On request' };

function formatPrice(value, lang) {
  if (value === 'on-request') return priceOnRequest[lang];
  const n = Number(value);
  return lang === 'fr'
    ? n.toLocaleString('fr-FR').replace(/\s/g, ' ') + ' €'
    : '€' + n.toLocaleString('en-US');
}

function renderPrices(lang) {
  document.querySelectorAll('[data-price]').forEach(el => {
    el.textContent = formatPrice(el.dataset.price, lang);
    const plan = el.closest('.plan');
    if (plan) plan.querySelectorAll('.plan-from, .plan-per').forEach(x => {
      x.style.visibility = el.dataset.price === 'on-request' ? 'hidden' : '';
    });
  });
}

function setLang(lang) {
  currentLang = lang;
  const els = document.querySelectorAll('[data-en]');
  els.forEach(el => { el.style.opacity = '0'; });
  setTimeout(() => {
    els.forEach(el => { el.innerHTML = el.getAttribute('data-' + lang); });
    renderPrices(lang);
    const srvLbl = document.getElementById('services-photo-label');
    if (srvLbl) srvLbl.textContent = srvLabels[lang][currentSrvIdx];
    document.querySelectorAll('.lang-btn[data-lang]').forEach(btn => {
      btn.classList.toggle('lang-active', btn.dataset.lang === lang);
    });
    const desc = document.querySelector('meta[name="description"]');
    if (desc) desc.content = desc.getAttribute('data-desc-' + lang);
    document.documentElement.lang = lang;
    localStorage.setItem('lang', lang);
    els.forEach(el => { el.style.opacity = '1'; });
  }, 150);
}

renderPrices(currentLang);
if (currentLang !== 'fr') setLang(currentLang);

/* ── CUSTOM CURSOR ── */
const dot  = document.getElementById('cursor-dot');
const ring = document.getElementById('cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;

if (window.matchMedia('(hover: hover)').matches) {
  document.addEventListener('mousemove', e => { mx = e.clientX; my = e.clientY; });

  function animCursor() {
    rx += (mx - rx) * .12;
    ry += (my - ry) * .12;
    dot.style.left  = mx + 'px';
    dot.style.top   = my + 'px';
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    requestAnimationFrame(animCursor);
  }
  animCursor();
}

/* ── NAV SCROLL BLUR ── */
const nav = document.getElementById('main-nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* ── INTERSECTION OBSERVER REVEALS ── */
const reveals = document.querySelectorAll('.reveal');
if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
  reveals.forEach(el => el.classList.add('visible'));
} else {
  const io = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        io.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });
  reveals.forEach(el => io.observe(el));
}

/* trigger hero immediately on load */
document.querySelectorAll('#hero .reveal').forEach(el => el.classList.add('visible'));

/* ── SHOWREEL AUTOPLAY ON SCROLL ── */
const showreelVideo = document.getElementById('showreel-video');
if (showreelVideo) {
  const showreelObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        showreelVideo.play().catch(() => {});
      } else {
        showreelVideo.pause();
      }
    });
  }, { threshold: 0.25 });
  showreelObserver.observe(showreelVideo);
}

/* ── SERVICES IMAGE SWAP (page particuliers) ── */
const serviceCards = document.querySelectorAll('.service-card');
const srvImgs      = document.querySelectorAll('.srv-img');

function activateSrvImg(idx) {
  currentSrvIdx = idx;
  srvImgs.forEach((img, i) => img.classList.toggle('srv-img--active', i === idx));
  const lbl = document.getElementById('services-photo-label');
  if (lbl) lbl.textContent = srvLabels[currentLang][idx];
}

if (srvImgs.length) {
  const srvObserver = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const idx = Array.from(serviceCards).indexOf(e.target);
        if (idx !== -1) activateSrvImg(idx);
      }
    });
  }, { threshold: 0.5 });
  serviceCards.forEach(card => srvObserver.observe(card));
}

/* ── BURGER MENU ── */
const burgerBtn   = document.getElementById('burgerBtn');
const menuOverlay = document.getElementById('menuOverlay');

function toggleMenu(force) {
  const open = force !== undefined ? force : !burgerBtn.classList.contains('open');
  burgerBtn.classList.toggle('open', open);
  burgerBtn.setAttribute('aria-expanded', open);
  menuOverlay.classList.toggle('open', open);
  document.body.classList.toggle('no-scroll', open);
}

burgerBtn.addEventListener('click', () => toggleMenu());

menuOverlay.querySelectorAll('.menu-link').forEach(link => {
  link.addEventListener('click', () => toggleMenu(false));
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && menuOverlay.classList.contains('open')) toggleMenu(false);
});

/* ── LIGHTBOX (galerie Selected Work) ── */
const lightbox = document.getElementById('lightbox');
if (lightbox) {
  const lbImage   = document.getElementById('lbImage');
  const lbCaption = document.getElementById('lbCaption');
  const lbCounter = document.getElementById('lbCounter');
  const tiles     = Array.from(document.querySelectorAll('.tile'));
  let lbIndex = 0;

  function lbShow(idx) {
    lbIndex = (idx + tiles.length) % tiles.length;
    const tile = tiles[lbIndex];
    const img = tile.querySelector('img.portfolio-img');
    const titleEl = tile.querySelector('.portfolio-title');
    lbImage.style.backgroundImage = `url('${tile.dataset.full || (img ? img.src : '')}')`;
    lbCaption.textContent = titleEl ? titleEl.textContent : '';
    lbCounter.textContent = `${lbIndex + 1} / ${tiles.length}`;
    lightbox.classList.add('open');
    document.body.classList.add('no-scroll');
  }

  function lbHide() {
    lightbox.classList.remove('open');
    document.body.classList.remove('no-scroll');
  }

  tiles.forEach((tile, i) => tile.addEventListener('click', () => lbShow(i)));
  document.getElementById('lbClose').addEventListener('click', lbHide);
  document.getElementById('lbPrev').addEventListener('click', () => lbShow(lbIndex - 1));
  document.getElementById('lbNext').addEventListener('click', () => lbShow(lbIndex + 1));
  lightbox.addEventListener('click', e => { if (e.target === lightbox) lbHide(); });

  document.addEventListener('keydown', e => {
    if (!lightbox.classList.contains('open')) return;
    if (e.key === 'Escape')     lbHide();
    if (e.key === 'ArrowLeft')  lbShow(lbIndex - 1);
    if (e.key === 'ArrowRight') lbShow(lbIndex + 1);
  });

  /* swipe */
  let tsX = 0;
  lightbox.addEventListener('touchstart', e => { tsX = e.touches[0].clientX; }, { passive: true });
  lightbox.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tsX;
    if (Math.abs(dx) > 50) lbShow(lbIndex + (dx < 0 ? 1 : -1));
  }, { passive: true });
}
