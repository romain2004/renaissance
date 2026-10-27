/* ============================================================
   CONTACT — vérification et envoi du formulaire, sans quitter la page
   · Le service d'envoi est dans data-endpoint sur le <form> :
       FormSubmit  https://formsubmit.co/ajax/hello@romainmaulave.com (actuel)
       Web3Forms   https://api.web3forms.com/submit  + data-access-key="…"
       Formspree   https://formspree.io/f/xxxxxxx
   · Champ piège « _honey » : s'il est rempli (robot), on n'envoie rien.
   · Messages en FR et en EN, selon la langue de la page.
   ============================================================ */
(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  if (!form) return;

  var T = {
    fr: {
      required: 'Ce champ est requis.',
      email: 'Adresse e-mail invalide.',
      project: 'Choisissez un type de projet.',
      sending: 'Envoi…',
      send: 'Envoyer',
      ok: 'Merci, votre message est bien parti. Je vous réponds sous 24 h.',
      fail: 'L\'envoi n\'a pas abouti. Réessayez, ou écrivez-moi directement à <a href="mailto:hello@romainmaulave.com">hello@romainmaulave.com</a>.'
    },
    en: {
      required: 'This field is required.',
      email: 'Invalid email address.',
      project: 'Please choose a project type.',
      sending: 'Sending…',
      send: 'Send',
      ok: 'Thank you, your message is on its way. I will reply within 24 hours.',
      fail: 'Your message could not be sent. Please try again, or write to me at <a href="mailto:hello@romainmaulave.com">hello@romainmaulave.com</a>.'
    }
  };
  function lang() { return document.documentElement.lang === 'en' ? 'en' : 'fr'; }

  /* Exemple du champ date dans la langue de la page (fashion/js/seasons.js règle la langue) */
  function placeholders() {
    form.querySelectorAll('[data-ph-fr]').forEach(function (el) {
      el.placeholder = el.getAttribute('data-ph-' + (document.documentElement.lang === 'en' ? 'en' : 'fr'));
    });
  }
  placeholders();
  new MutationObserver(placeholders).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });

  var F = form.elements;   // form.name serait le nom du formulaire, pas le champ « Nom »
  var status = form.querySelector('.ct-status');
  var button = form.querySelector('.ct-submit');

  function clearErrors() {
    form.querySelectorAll('.ct-error').forEach(function (el) { el.remove(); });
    form.querySelectorAll('.has-error').forEach(function (el) { el.classList.remove('has-error'); });
  }
  function fieldError(field, key) {
    field.classList.add('has-error');
    var p = document.createElement('p');
    p.className = 'ct-error';
    p.textContent = T[lang()][key];
    field.appendChild(p);
  }

  form.addEventListener('input', function (e) {
    var field = e.target.closest('.ct-field');
    if (field && field.classList.contains('has-error')) {
      field.classList.remove('has-error');
      var err = field.querySelector('.ct-error');
      if (err) err.remove();
    }
  });

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    clearErrors();
    status.textContent = '';
    status.className = 'ct-status';

    var data = {
      name: F['name'].value.trim(),
      email: F['email'].value.trim(),
      project: (form.querySelector('input[name="project"]:checked') || {}).value || '',
      date: F['date'].value.trim(),
      message: F['message'].value.trim()
    };

    var first = null;
    function bad(el, key) { fieldError(el.closest('.ct-field'), key); first = first || el; }
    if (!data.name) bad(F['name'], 'required');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) bad(F['email'], data.email ? 'email' : 'required');
    if (!data.project) bad(form.querySelector('input[name="project"]'), 'project');
    if (!data.message) bad(F['message'], 'required');
    if (first) { first.focus(); return; }

    // Robot : le champ piège est rempli → on fait comme si tout allait bien, sans rien envoyer
    if (F['_honey'].value) { done(true); return; }

    var payload = {
      name: data.name,
      email: data.email,
      projet: data.project,
      date: data.date || '—',
      message: data.message,
      _subject: 'Nouveau message du site — ' + data.project,
      _template: 'table',
      _captcha: 'false'
    };
    if (form.dataset.accessKey) payload.access_key = form.dataset.accessKey;

    button.disabled = true;
    button.textContent = T[lang()].sending;

    fetch(form.dataset.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (body) {
          var ok = res.ok && body.success !== false && body.success !== 'false';
          done(ok);
        });
      })
      .catch(function () { done(false); });
  });

  function done(ok) {
    button.disabled = false;
    button.textContent = T[lang()].send;
    status.className = 'ct-status ' + (ok ? 'is-ok' : 'is-error');
    status.innerHTML = T[lang()][ok ? 'ok' : 'fail'];
    if (ok) form.reset();
  }
})();
