/* ── LANG SWITCHER ──
   data-en / data-fr + localStorage('lang'), FR par défaut. */
let currentLang = localStorage.getItem('lang') || 'fr';

/* Prix : la source est l'attribut data-price (voir le bloc commenté de la section Offres) */
function formatPrice(n, lang) {
  return lang === 'fr'
    ? n.toLocaleString('fr-FR').replace(/\s/g, ' ') + ' €'
    : '€' + n.toLocaleString('en-US');
}

function renderPrices(lang) {
  document.querySelectorAll('[data-price]').forEach(el => {
    el.textContent = formatPrice(Number(el.dataset.price), lang);
  });
}

function setLang(lang) {
  currentLang = lang;
  const els = document.querySelectorAll('[data-en]');
  els.forEach(el => { el.style.opacity = '0'; });
  setTimeout(() => {
    els.forEach(el => { el.innerHTML = el.getAttribute('data-' + lang); });
    renderPrices(lang);
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
