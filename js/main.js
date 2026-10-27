/* ─────────────────────────────────────────────────────────
   ROMAIN MAULAVÉ — Master Homepage
   ───────────────────────────────────────────────────────── */

// L'écran de chargement et l'en-tête sont communs à tout le site : css/site.css, js/site.js.


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
