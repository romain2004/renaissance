/* ─────────────────────────────────────────────────────────
   ROMAIN MAULAVÉ — Master Homepage
   ───────────────────────────────────────────────────────── */

// ── Loader ────────────────────────────────────────────────
const loader = document.getElementById('loader');
window.addEventListener('load', () => {
  setTimeout(() => loader.classList.add('is-hidden'), 1650);
});

// ── Custom cursor ──────────────────────────────────────────
const dot   = document.getElementById('cursor-dot');
const ring  = document.getElementById('cursor-ring');
const label = document.getElementById('cursor-label');

if (dot && ring) {
  let mx = 0, my = 0;
  let rx = 0, ry = 0;

  document.addEventListener('mousemove', e => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.transform = `translate(calc(${mx}px - 50%), calc(${my}px - 50%))`;
  });

  (function animateRing() {
    rx += (mx - rx) * 0.115;
    ry += (my - ry) * 0.115;
    ring.style.transform = `translate(calc(${rx}px - 50%), calc(${ry}px - 50%))`;
    requestAnimationFrame(animateRing);
  })();

  document.querySelectorAll('.world').forEach(world => {
    world.addEventListener('mouseenter', () => {
      ring.classList.add('on-world');
      if (label) label.textContent = 'Enter';
    });
    world.addEventListener('mouseleave', () => {
      ring.classList.remove('on-world');
      if (label) label.textContent = '';
    });
  });
}

// ── Scroll reveal ──────────────────────────────────────────
const io = new IntersectionObserver(
  entries => entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      io.unobserve(e.target);
    }
  }),
  { threshold: 0.12 }
);

document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ── Campaign section — zoom release on enter ───────────────
const campaign = document.getElementById('campaign');
if (campaign) {
  new IntersectionObserver(
    ([e]) => { if (e.isIntersecting) campaign.classList.add('is-visible'); },
    { threshold: 0.08 }
  ).observe(campaign);
}
