/* Page motion. Runs in <head> so `pagereveal` is heard before the first paint of a page arriving through the
   dissolve (css/tokens.css). Headings marked data-lines rise one line at a time in the default look; every
   other look, a reader who asks for less motion, and a page where this file fails all keep the plain reveal. */
(function () {
  var html = document.documentElement;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  html.classList.add('has-lines');

  // a page arriving through the dissolve holds its opening rise until the old page has mostly gone
  addEventListener('pagereveal', function (e) {
    if (!e.viewTransition) return;
    html.classList.add('is-arriving');
    function release() { html.classList.remove('is-arriving'); }
    e.viewTransition.ready.then(function () { setTimeout(release, 350); }, release);
  });

  /* ---------- line by line ----------
     The wrap is measured at the moment of the reveal. The lines stay after landing, because repainting the
     text would count as a late LCP; the original goes back only when a new width or look would change the wrap. */
  var held = [];
  function restore() {
    held.forEach(function (h) { h.box.textContent = h.text; });
    held = [];
  }
  var width = innerWidth;
  addEventListener('resize', function () { if (innerWidth !== width) { width = innerWidth; restore(); } });
  document.addEventListener('theme:change', restore);

  function split(el) {
    if (html.hasAttribute('data-theme')) return;
    var box = el.querySelector('a') || el, text = box.textContent.trim();
    var words = text.split(/\s+/);
    function esc(t) { return t.replace(/&/g, '&amp;').replace(/</g, '&lt;'); }
    box.innerHTML = words.map(function (w) { return '<span>' + esc(w) + '</span>'; }).join(' ');
    var lines = [], top = null;
    Array.prototype.forEach.call(box.children, function (w) {
      if (w.offsetTop !== top) { lines.push([]); top = w.offsetTop; }
      lines[lines.length - 1].push(w.textContent);
    });
    box.innerHTML = lines.map(function (l, n) { return '<span class="line" style="--l:' + n + '">' + esc(l.join(' ')) + ' </span>'; }).join('');
    el.classList.add('is-split');
    held.push({ box: box, text: text });
  }

  function wire() {
    // fonts decide the wrap, but a slow font must not hold a headline back; `ready` only waits for a font
    // that layout has already asked for, so the page is laid out first
    document.body.offsetWidth;
    var fonts = Promise.race([document.fonts.ready, new Promise(function (go) { setTimeout(go, 1200); })]);
    Array.prototype.forEach.call(document.querySelectorAll('[data-lines]'), function (el) {
      if (el.hasAttribute('data-rise')) { fonts.then(function () { split(el); }); return; }
      new MutationObserver(function (_, watch) {
        if (!el.classList.contains('is-in')) return;
        watch.disconnect();
        split(el);
      }).observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire();
})();
