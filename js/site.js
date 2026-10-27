/* ============================================================
   COMMUN À TOUT LE SITE — en-tête, menu mobile, langue
   Inséré dans chaque page par tools/build-site.py (partials/scripts.html).
   · Langue : data-fr / data-en + localStorage('lang'), FR par défaut.
     Si la page a sa propre fonction setLang (Riviera : prix, libellés),
     c'est elle qui s'en charge.
   ============================================================ */
(function () {
  'use strict';

  var header = document.getElementById('site-header');
  var menu = document.getElementById('site-menu');
  if (!header) return;

  /* ── Rubrique en cours ── */
  var path = location.pathname;
  var section = path.indexOf('/fashion') === 0 ? 'fashion'
    : path.indexOf('/riviera') === 0 || path.indexOf('/hospitality') === 0 ? 'riviera'
    : path.indexOf('/contact') === 0 ? 'contact' : '';
  document.querySelectorAll('.site-header__nav a, .site-menu > a').forEach(function (a) {
    if (section && a.getAttribute('href') === '/' + section + '/') a.setAttribute('aria-current', 'page');
  });

  /* ── En-tête : fond plein après 40 px ; sur l'accueil, visible seulement en descendant ── */
  var isHome = document.body.classList.contains('is-home');
  function onScroll() {
    var y = window.scrollY;
    header.classList.toggle('is-scrolled', y > 40);
    if (isHome) header.classList.toggle('is-shown', y > window.innerHeight * 0.6);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── Menu mobile ── */
  var burger = header.querySelector('.site-header__burger');
  function setMenu(open) {
    if (!menu || !burger) return;
    menu.classList.toggle('is-open', open);
    burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    document.body.style.overflow = open ? 'hidden' : '';
    if (isHome) header.classList.toggle('is-shown', open || window.scrollY > window.innerHeight * 0.6);
  }
  if (burger) burger.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
  if (menu) menu.querySelectorAll('a').forEach(function (a) { a.addEventListener('click', function () { setMenu(false); }); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setMenu(false); });

  /* ── Langue ── */
  function readLang() {
    try { return localStorage.getItem('lang') || 'fr'; } catch (e) { return 'fr'; }
  }
  function applyLang(lang) {
    if (typeof window.setLang === 'function') {
      window.setLang(lang);                       // Riviera : sa propre fonction (prix, libellés)
    } else {
      document.querySelectorAll('[data-fr][data-en]').forEach(function (el) {
        var value = el.getAttribute('data-' + lang);
        if (el.tagName === 'TITLE') document.title = value;
        else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.placeholder = value;
        else el.innerHTML = value;
      });
      document.querySelectorAll('[data-alt-fr]').forEach(function (img) {
        img.alt = img.getAttribute('data-alt-' + lang);
      });
      var desc = document.querySelector('meta[name="description"]');
      if (desc && desc.getAttribute('data-desc-' + lang)) desc.content = desc.getAttribute('data-desc-' + lang);
      document.documentElement.lang = lang;
      try { localStorage.setItem('lang', lang); } catch (e) {}
    }
    document.querySelectorAll('.site-lang__btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-site-lang') === lang);
      btn.setAttribute('aria-pressed', btn.getAttribute('data-site-lang') === lang ? 'true' : 'false');
    });
    document.dispatchEvent(new CustomEvent('site:lang', { detail: lang }));
  }
  document.querySelectorAll('.site-lang__btn').forEach(function (btn) {
    btn.addEventListener('click', function () { applyLang(btn.getAttribute('data-site-lang')); });
  });
  applyLang(readLang());
})();
