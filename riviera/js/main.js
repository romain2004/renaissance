/* ── LANG SWITCHER ── */
let currentLang = localStorage.getItem('lang') || 'en';
let currentSrvIdx = 0;

const srvLabelsEN = ['GULF · SAINT-TROPEZ', "CÔTE D'AZUR · VILLA", 'MEDITERRANEAN · LIGHT'];
const srvLabelsFR = ['GOLFE · SAINT-TROPEZ', "CÔTE D'AZUR · VILLA", 'LUMIÈRE MÉDITERRANÉENNE'];

function setLang(lang) {
  currentLang = lang;
  const els = document.querySelectorAll('[data-en]');
  els.forEach(el => { el.style.opacity = '0'; });
  setTimeout(() => {
    els.forEach(el => { el.innerHTML = el.getAttribute('data-' + lang); });
    const srvLbl = document.getElementById('services-photo-label');
    const labels = lang === 'fr' ? srvLabelsFR : srvLabelsEN;
    if (srvLbl) srvLbl.textContent = labels[currentSrvIdx];
    document.getElementById('lang-en').classList.toggle('lang-active', lang === 'en');
    document.getElementById('lang-fr').classList.toggle('lang-active', lang === 'fr');
    document.documentElement.lang = lang;
    localStorage.setItem('lang', lang);
    els.forEach(el => { el.style.opacity = '1'; });
  }, 150);
}

if (currentLang === 'fr') setLang('fr');

/* ── CUSTOM CURSOR ── */
const dot  = document.getElementById('cursor-dot');
const ring = document.getElementById('cursor-ring');
let mx = 0, my = 0, rx = 0, ry = 0;

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

/* ── NAV SCROLL BLUR ── */
const nav = document.getElementById('main-nav');
window.addEventListener('scroll', () => {
  nav.classList.toggle('scrolled', window.scrollY > 60);
}, { passive: true });

/* ── INTERSECTION OBSERVER REVEALS ── */
const reveals = document.querySelectorAll('.reveal');
const io = new IntersectionObserver((entries) => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      io.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });
reveals.forEach(el => io.observe(el));

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

/* ── SERVICES IMAGE SWAP ── */
const serviceCards = document.querySelectorAll('.service-card');
const srvImgs      = document.querySelectorAll('.srv-img');

function activateSrvImg(idx) {
  currentSrvIdx = idx;
  srvImgs.forEach((img, i) => img.classList.toggle('srv-img--active', i === idx));
  const lbl = document.getElementById('services-photo-label');
  const labels = currentLang === 'fr' ? srvLabelsFR : srvLabelsEN;
  if (lbl) lbl.textContent = labels[idx];
}

const srvObserver = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      const idx = Array.from(serviceCards).indexOf(e.target);
      if (idx !== -1) activateSrvImg(idx);
    }
  });
}, { threshold: 0.5 });

serviceCards.forEach(card => srvObserver.observe(card));
