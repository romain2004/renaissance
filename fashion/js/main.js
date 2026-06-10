/* ============================================================
   ROMAIN MAULAVE — Portfolio JS
   01 · Custom cursor (desktop, lerp lag)
   02 · Film grain — CSS-only, no JS needed
   03 · Intro loader
   Nav scroll · Mobile menu · Scroll reveal
   10 · Horizontal drag-to-scroll with momentum
   ============================================================ */

(function () {
  'use strict';

  /* ──────────────────────────────────────────────────────────
     03 · INTRO LOADER
     "RM" animates in (1.45s CSS animation) then JS fades the
     loader out. Body scroll is locked while loader is visible.
     ────────────────────────────────────────────────────────── */
  var loader = document.getElementById('loader');
  if (loader) {
    document.body.style.overflow = 'hidden';

    setTimeout(function () {
      loader.classList.add('is-hidden');
      document.body.style.overflow = '';

      // Remove from DOM once the CSS transition finishes (0.55s)
      setTimeout(function () {
        if (loader.parentNode) loader.parentNode.removeChild(loader);
      }, 600);
    }, 1450); // matches animation duration in CSS
  }


  /* ──────────────────────────────────────────────────────────
     01 · CUSTOM CURSOR
     - cursor-dot  follows mouse instantly
     - cursor-ring follows with lerp (0.11 factor) → lag
     - Links   → ring expands + label "OPEN"
     - .fw-card → ring expands further + label "VIEW"
     - Only active on devices with a real pointer (no touch)
     ────────────────────────────────────────────────────────── */
  var cursorDot   = document.getElementById('cursor-dot');
  var cursorRing  = document.getElementById('cursor-ring');
  var cursorLabel = document.getElementById('cursor-label');

  var hasPointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

  if (cursorDot && cursorRing && hasPointer) {

    var mouseX = 0, mouseY = 0;
    var ringX  = 0, ringY  = 0;

    // Dot: instant follow
    document.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      cursorDot.style.transform =
        'translate3d(calc(' + mouseX + 'px - 50%), calc(' + mouseY + 'px - 50%), 0)';
    });

    // Ring: lerp lag animation loop
    (function lerpLoop() {
      ringX += (mouseX - ringX) * 0.11;
      ringY += (mouseY - ringY) * 0.11;
      cursorRing.style.transform =
        'translate3d(calc(' + ringX + 'px - 50%), calc(' + ringY + 'px - 50%), 0)';
      requestAnimationFrame(lerpLoop);
    }());

    // Fade cursor when mouse leaves the page
    document.addEventListener('mouseleave', function () {
      cursorDot.style.opacity  = '0';
      cursorRing.style.opacity = '0';
    });
    document.addEventListener('mouseenter', function () {
      cursorDot.style.opacity  = '1';
      cursorRing.style.opacity = '1';
    });

    // Helper: set cursor state
    function setCursor(state, label) {
      cursorRing.classList.remove('is-link', 'is-card');
      cursorDot.classList.remove('is-hidden');
      if (state) {
        cursorRing.classList.add(state);
        cursorDot.classList.add('is-hidden');
      }
      if (cursorLabel) cursorLabel.textContent = label || '';
    }

    // Links & buttons → "OPEN"
    document.querySelectorAll('a, button').forEach(function (el) {
      el.addEventListener('mouseenter', function () { setCursor('is-link', 'OPEN'); });
      el.addEventListener('mouseleave', function () { setCursor(null, ''); });
    });

    // Fashion week cards → "VIEW" (overrides link state)
    document.querySelectorAll('.fw-card').forEach(function (el) {
      el.addEventListener('mouseenter', function () { setCursor('is-card', 'VIEW'); });
      el.addEventListener('mouseleave', function () { setCursor(null, ''); });
    });
  }


  /* ──────────────────────────────────────────────────────────
     NAV — transparent on hero, solid black after 48px scroll
     Inner pages always start .scrolled (set in HTML)
     ────────────────────────────────────────────────────────── */
  var nav = document.getElementById('nav');

  function updateNav() {
    if (!nav) return;
    nav.classList.toggle('scrolled', window.scrollY > 48);
  }

  window.addEventListener('scroll', updateNav, { passive: true });
  updateNav();


  /* ──────────────────────────────────────────────────────────
     MOBILE HAMBURGER MENU
     ────────────────────────────────────────────────────────── */
  var hamburger  = document.querySelector('.nav__hamburger');
  var mobileMenu = document.querySelector('.nav__mobile');

  if (hamburger && mobileMenu) {
    hamburger.addEventListener('click', function () {
      var isOpen = mobileMenu.classList.toggle('open');
      hamburger.classList.toggle('open', isOpen);
      document.body.style.overflow = isOpen ? 'hidden' : '';
    });

    mobileMenu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        mobileMenu.classList.remove('open');
        hamburger.classList.remove('open');
        document.body.style.overflow = '';
      });
    });
  }


  /* ──────────────────────────────────────────────────────────
     SCROLL REVEAL
     Elements with class .reveal fade + rise into view once.
     ────────────────────────────────────────────────────────── */
  var reveals = document.querySelectorAll('.reveal');

  if (reveals.length && 'IntersectionObserver' in window) {
    var revealObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            revealObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -28px 0px' }
    );
    reveals.forEach(function (el) { revealObserver.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  }


  /* ──────────────────────────────────────────────────────────
     10 · HORIZONTAL DRAG-TO-SCROLL WITH MOMENTUM
     Mouse drag scrolls the fashion weeks track horizontally.
     On release, momentum carries the scroll forward naturally.
     Touch devices use native -webkit-overflow-scrolling.
     ────────────────────────────────────────────────────────── */
  var trackWrap = document.getElementById('fw-track-wrap');

  if (trackWrap) {
    var isDragging = false;
    var startX     = 0;
    var baseScroll = 0;
    var velocity   = 0;
    var lastX      = 0;
    var momentumId = null;

    trackWrap.addEventListener('mousedown', function (e) {
      isDragging = true;
      trackWrap.classList.add('is-dragging');
      startX     = e.pageX - trackWrap.offsetLeft;
      baseScroll = trackWrap.scrollLeft;
      lastX      = e.pageX;
      velocity   = 0;
      cancelAnimationFrame(momentumId);
    });

    // Use window listeners so drag continues if mouse leaves the element
    window.addEventListener('mouseup', function () {
      if (!isDragging) return;
      isDragging = false;
      trackWrap.classList.remove('is-dragging');
      applyMomentum();
    });

    window.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      e.preventDefault();
      var x    = e.pageX - trackWrap.offsetLeft;
      var walk = (x - startX) * 1.4; // 1.4x multiplier = snappy feel
      velocity = e.pageX - lastX;
      lastX    = e.pageX;
      trackWrap.scrollLeft = baseScroll - walk;
    });

    function applyMomentum() {
      if (Math.abs(velocity) < 0.6) return;
      velocity   *= 0.93; // friction
      trackWrap.scrollLeft -= velocity;
      momentumId = requestAnimationFrame(applyMomentum);
    }
  }


  /* ──────────────────────────────────────────────────────────
     AUTO-SCROLL STRIPS — clone children for seamless loop
     Each .auto-scroll-track gets its children duplicated so
     the CSS animation can loop from 0 → -50% invisibly.
     Speed is set via animation-duration inline on each track.
     ────────────────────────────────────────────────────────── */
  if (window.innerWidth > 768) {
    document.querySelectorAll('.auto-scroll-track').forEach(function (track) {
      var children = Array.prototype.slice.call(track.children);
      children.forEach(function (child) {
        track.appendChild(child.cloneNode(true));
      });
    });
  }


  /* ──────────────────────────────────────────────────────────
     CAROUSEL
     One instance per [data-carousel] element.
     - Click prev/next buttons to navigate
     - Touch swipe (mobile) — threshold 50px
     - Keyboard left/right when carousel is focused
     ────────────────────────────────────────────────────────── */
  function pad(n) { return n < 10 ? '0' + n : String(n); }

  document.querySelectorAll('[data-carousel]').forEach(function (carousel) {
    var track      = carousel.querySelector('.carousel__track');
    var slides     = Array.prototype.slice.call(track.querySelectorAll('img'));
    var prevBtn    = carousel.querySelector('.carousel__btn--prev');
    var nextBtn    = carousel.querySelector('.carousel__btn--next');
    var counterEl  = carousel.querySelector('.carousel__counter');
    var total      = slides.length;
    var current    = 0;

    function goTo(index) {
      current = Math.max(0, Math.min(index, total - 1));
      track.style.transform = 'translateX(-' + (current * 100) + '%)';
      if (counterEl) {
        counterEl.textContent = pad(current + 1) + ' / ' + pad(total);
      }
      if (prevBtn) prevBtn.disabled = current === 0;
      if (nextBtn) nextBtn.disabled = current === total - 1;
    }

    if (prevBtn) prevBtn.addEventListener('click', function () { goTo(current - 1); });
    if (nextBtn) nextBtn.addEventListener('click', function () { goTo(current + 1); });

    // Touch swipe
    var touchStartX = 0;
    var touchStartY = 0;
    track.addEventListener('touchstart', function (e) {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
    }, { passive: true });
    track.addEventListener('touchend', function (e) {
      var diffX = touchStartX - e.changedTouches[0].clientX;
      var diffY = touchStartY - e.changedTouches[0].clientY;
      if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
        goTo(diffX > 0 ? current + 1 : current - 1);
      }
    }, { passive: true });

    // Keyboard nav when carousel is in view
    carousel.setAttribute('tabindex', '0');
    carousel.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft')  goTo(current - 1);
      if (e.key === 'ArrowRight') goTo(current + 1);
    });

    goTo(0); // init
  });


  /* ──────────────────────────────────────────────────────────
     LIGHTBOX
     Click any .auto-scroll-track img or .carousel__track img
     to open it full-screen in a rounded card.
     Close: click backdrop · × button · Escape key.
     ────────────────────────────────────────────────────────── */
  var lightbox     = document.getElementById('lightbox');
  var lightboxImg  = document.getElementById('lightbox-img');

  function openLightbox(src, alt) {
    if (!lightbox || !lightboxImg) return;
    lightboxImg.src = src;
    lightboxImg.alt = alt || '';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    if (!lightbox) return;
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  if (lightbox) {
    // Clicks on carousel images
    document.querySelectorAll('.auto-scroll-track img, .carousel__track img').forEach(function (img) {
      img.addEventListener('click', function () {
        openLightbox(this.src, this.alt);
      });
    });

    // Close on backdrop
    var backdrop = lightbox.querySelector('.lightbox__backdrop');
    if (backdrop) backdrop.addEventListener('click', closeLightbox);

    // Close on × button
    var closeBtn = lightbox.querySelector('.lightbox__close');
    if (closeBtn) closeBtn.addEventListener('click', closeLightbox);

    // Close on Escape
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') closeLightbox();
    });
  }


  /* ──────────────────────────────────────────────────────────
     CONTACT FORM
     1. Validates each field — shows red error if empty/invalid
     2. On success → submits to Formspree via fetch (no redirect)
     ────────────────────────────────────────────────────────── */
  var form = document.querySelector('.contact-form');
  if (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();

      // Clear previous errors
      form.querySelectorAll('.form-error').forEach(function (el) { el.remove(); });
      form.querySelectorAll('.has-error').forEach(function (el) { el.classList.remove('has-error'); });

      var nameEl    = form.querySelector('#name');
      var emailEl   = form.querySelector('#email');
      var subjectEl = form.querySelector('#subject');
      var messageEl = form.querySelector('#message');
      var valid     = true;

      function showError(el, msg) {
        valid = false;
        el.classList.add('has-error');
        var span = document.createElement('span');
        span.className   = 'form-error';
        span.textContent = msg;
        el.insertAdjacentElement('afterend', span);
        el.addEventListener('change', function clear() {
          el.classList.remove('has-error');
          var next = el.nextElementSibling;
          if (next && next.classList.contains('form-error')) next.remove();
          el.removeEventListener('change', clear);
        });
        el.addEventListener('input', function clearInput() {
          el.classList.remove('has-error');
          var next = el.nextElementSibling;
          if (next && next.classList.contains('form-error')) next.remove();
          el.removeEventListener('input', clearInput);
        });
      }

      if (nameEl && !nameEl.value.trim()) {
        showError(nameEl, 'Ce champ est requis');
      }
      if (emailEl) {
        var emailVal = emailEl.value.trim();
        if (!emailVal || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailVal)) {
          showError(emailEl, 'Adresse email invalide');
        }
      }
      if (subjectEl && !subjectEl.value) {
        showError(subjectEl, 'Veuillez sélectionner un sujet');
      }
      if (messageEl && !messageEl.value.trim()) {
        showError(messageEl, 'Ce champ est requis');
      }

      if (!valid) return;

      // Native form POST — bypasses all CORS restrictions
      var btn = form.querySelector('.btn-submit');
      btn.textContent         = 'Envoi en cours…';
      btn.style.pointerEvents = 'none';
      form.submit();
    });
  }

}());
