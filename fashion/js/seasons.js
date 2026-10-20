/* ============================================================
   FASHION — pages générées (accueil Fashion + saisons)
   · Langue : data-fr / data-en + localStorage('lang'), FR par défaut,
     comme sur le reste du site. Les alt suivent via data-alt-fr / data-alt-en.
   · Lightbox : flèches, clavier, glisser ; légende = data-caption.
   main.js (curseur, nav, menu mobile, reveal) est chargé avant.
   ============================================================ */
(function () {
  'use strict';

  /* ── LANGUE ── */
  var currentLang = 'fr';
  try { currentLang = localStorage.getItem('lang') || 'fr'; } catch (e) {}

  function setLang(lang) {
    currentLang = lang;
    document.querySelectorAll('[data-fr][data-en]').forEach(function (el) {
      var value = el.getAttribute('data-' + lang);
      if (el.tagName === 'TITLE') document.title = value;
      else el.innerHTML = value;
    });
    document.querySelectorAll('[data-alt-fr]').forEach(function (img) {
      img.alt = img.getAttribute('data-alt-' + lang);
    });
    var desc = document.querySelector('meta[name="description"]');
    if (desc && desc.getAttribute('data-desc-' + lang)) desc.content = desc.getAttribute('data-desc-' + lang);
    document.querySelectorAll('.fx-lang__btn').forEach(function (btn) {
      btn.classList.toggle('is-active', btn.getAttribute('data-lang') === lang);
    });
    document.documentElement.lang = lang;
    try { localStorage.setItem('lang', lang); } catch (e) {}
  }

  document.querySelectorAll('.fx-lang__btn').forEach(function (btn) {
    btn.addEventListener('click', function () { setLang(btn.getAttribute('data-lang')); });
  });
  if (currentLang !== 'fr') setLang(currentLang);

  /* ── LIGHTBOX ── */
  var box = document.getElementById('season-lightbox');
  if (!box) return;

  var items   = Array.prototype.slice.call(document.querySelectorAll('.ss-item img'));
  var img     = box.querySelector('.ss-lightbox__img');
  var caption = box.querySelector('.ss-lightbox__caption');
  var counter = box.querySelector('.ss-lightbox__counter');
  var index   = 0;

  function show(i) {
    index = (i + items.length) % items.length;
    var src = items[index];
    img.src = src.getAttribute('data-full') || src.currentSrc || src.src;
    img.alt = src.alt;
    caption.textContent = src.getAttribute('data-caption') || '';
    counter.textContent = (index + 1) + ' / ' + items.length;
    box.classList.add('is-open');
    box.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function hide() {
    box.classList.remove('is-open');
    box.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  items.forEach(function (el, i) {
    el.addEventListener('click', function () { show(i); });
  });
  box.querySelector('.lightbox__backdrop').addEventListener('click', hide);
  box.querySelector('.ss-lightbox__close').addEventListener('click', hide);
  box.querySelector('.ss-lightbox__nav--prev').addEventListener('click', function () { show(index - 1); });
  box.querySelector('.ss-lightbox__nav--next').addEventListener('click', function () { show(index + 1); });

  document.addEventListener('keydown', function (e) {
    if (!box.classList.contains('is-open')) return;
    if (e.key === 'Escape') hide();
    if (e.key === 'ArrowLeft') show(index - 1);
    if (e.key === 'ArrowRight') show(index + 1);
  });

  var startX = 0;
  box.addEventListener('touchstart', function (e) { startX = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', function (e) {
    var dx = e.changedTouches[0].clientX - startX;
    if (Math.abs(dx) > 50) show(index + (dx < 0 ? 1 : -1));
  }, { passive: true });
})();
