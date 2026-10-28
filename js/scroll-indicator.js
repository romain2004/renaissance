/* ============================================================
   BARRE DE DÉFILEMENT — commune à tout le site
   <script src="/js/scroll-indicator.js" data-variant="tape" defer></script>
   Variantes : "tape" (Fashion), "sun" (Riviera), "dot" (accueil, contact).
   · Bureau : la barre native est habillée en CSS (css/scroll-indicator.css) ;
     ce script pose seulement data-scroll sur <html>.
   · Mobile (< 768 px) : barre orange de 2 px sous l'en-tête, qui apparaît après
     100 px de défilement ; au défilement, seul un transform change (rAF).
   ============================================================ */
(function () {
  'use strict';

  var script = document.currentScript;
  document.documentElement.setAttribute('data-scroll', (script && script.getAttribute('data-variant')) || 'dot');

  var bar = document.createElement('div');
  bar.className = 'rm-scroll-bar';
  bar.setAttribute('aria-hidden', 'true');
  var fill = document.createElement('span');
  bar.appendChild(fill);
  document.body.appendChild(bar);

  /* Juste sous l'en-tête fixe de la page, s'il y en a un */
  function placeBar() {
    var header = document.querySelector('#nav, #main-nav, .nav');
    var bottom = 0;
    if (header && getComputedStyle(header).position === 'fixed') bottom = Math.round(header.getBoundingClientRect().bottom);
    bar.style.top = bottom + 'px';
  }

  var ticking = false;
  function update() {
    ticking = false;
    var max = document.documentElement.scrollHeight - window.innerHeight;
    var y = window.scrollY;
    var p = max > 0 ? Math.min(1, Math.max(0, y / max)) : 0;
    bar.classList.toggle('is-visible', max > 100 && y > 100);
    fill.style.transform = 'scaleX(' + p.toFixed(4) + ')';
  }
  function onScroll() {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { placeBar(); onScroll(); }, { passive: true });
  window.addEventListener('load', function () { placeBar(); update(); });
  if ('ResizeObserver' in window) new ResizeObserver(onScroll).observe(document.body);
  placeBar();
  update();
})();
