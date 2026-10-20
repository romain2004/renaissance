/* ─────────────────────────────────────────────────────────
   ROMAIN MAULAVÉ — Master Homepage
   ───────────────────────────────────────────────────────── */

// ── Loader ────────────────────────────────────────────────
// Moins d'1 s au total (0,45 s + fondu de 0,3 s), sans attendre le chargement des images ;
// supprimé si prefers-reduced-motion.
const loader = document.getElementById('loader');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if (reduceMotion) loader.classList.add('is-hidden');
else setTimeout(() => loader.classList.add('is-hidden'), 450);


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
