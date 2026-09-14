/* Visitor counter: "You're the 42nd person to visit this website."
   The number comes from a public counter service (see visitorCounter in content/site.js).
   A browser is counted once: the number it receives is kept in localStorage and shown again on later visits. */
window.Visitors = (function () {
  'use strict';
  var U = window.U;

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n.toLocaleString() + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function render(el, n, cfg) {
    var tpl = (cfg && cfg.template) || "You're the {n} person to visit this website.";
    var parts = tpl.split('{n}');
    el.innerHTML = U.esc(parts[0]) + '<b class="visitor-n"></b>' + U.esc(parts[1] || '');
    el.hidden = false;
    var b = el.querySelector('.visitor-n');
    if (U.prefersReducedMotion() || n < 3) { b.textContent = ordinal(n); return; }
    // count up to the number over ~0.9 s
    var from = Math.max(1, n - 24), start = performance.now(), dur = 900;
    (function tick(now) {
      var u = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - u, 3);
      b.textContent = ordinal(Math.round(from + (n - from) * e));
      if (u < 1) requestAnimationFrame(tick);
    })(start);
  }

  /** Fill `el` with the visitor line. Hides it if the service cannot be reached. */
  function mount(el, cfg) {
    if (!el || !cfg || cfg.enabled === false || !cfg.namespace || !cfg.key) return;
    var stored = parseInt(U.local.get('visitorNumber'), 10);
    if (stored > 0) { render(el, stored, cfg); return; }
    var base = (cfg.endpoint || 'https://abacus.jasoncameron.dev').replace(/\/+$/, '');
    var url = base + '/hit/' + encodeURIComponent(cfg.namespace) + '/' + encodeURIComponent(cfg.key);
    fetch(url, { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var n = parseInt(d && (d.value != null ? d.value : d.count), 10);
        if (!(n > 0)) throw new Error('bad count');
        U.local.set('visitorNumber', String(n));
        render(el, n, cfg);
      })
      .catch(function () { el.hidden = true; });
  }

  return { mount: mount, ordinal: ordinal };
})();
