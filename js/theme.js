/* Theme switch. Runs synchronously in <head> so the chosen theme is on <html> before first paint.
   A theme is a CSS file in css/themes/ scoped under html[data-theme="name"]; "charcoal" is the
   default look and needs no file. The claw machine fires `claw:caught` on every prize; this picks a
   look at random, never the current one and no repeats until all have shown this session.
   State lives in sessionStorage only, so it dies with the tab. ?theme=name forces a look. */
(function () {
  var THEMES = ['brutalist', 'windows95', 'broadsheet', 'esports'];            // one entry per file in css/themes/; charcoal is implicit
  var LOOKS = ['charcoal'].concat(THEMES);
  var LABELS = { charcoal: 'Charcoal', brutalist: 'Brutalist', windows95: 'Windows 95', broadsheet: 'Broadsheet', esports: 'E-sports' };
  var KEY = 'theme', SEEN = 'theme-seen';
  var html = document.documentElement;
  var loaded = {};

  function store(k, v) { try { if (v == null) sessionStorage.removeItem(k); else sessionStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function valid(name) { return LOOKS.indexOf(name) >= 0 ? name : 'charcoal'; }
  function href(name) { return (html.getAttribute('data-root') || '') + 'css/themes/' + name + '.css'; }

  /* ---------- first paint ---------- */
  var fromUrl = /[?&]theme=([^&#]*)/.exec(location.search);
  var initial = valid(fromUrl ? decodeURIComponent(fromUrl[1]) : read(KEY));
  if (fromUrl) store(KEY, initial === 'charcoal' ? null : initial);
  if (initial !== 'charcoal') {
    html.setAttribute('data-theme', initial);
    // document.write keeps the stylesheet render-blocking, so there is no flash of charcoal
    document.write('<link rel="stylesheet" href="' + href(initial) + '" data-theme-css="' + initial + '">');
    loaded[initial] = true;
  }

  /* ---------- switching ---------- */
  function ensure(name, done) {
    if (name === 'charcoal' || loaded[name]) return done();
    var link = document.createElement('link');
    link.rel = 'stylesheet'; link.href = href(name); link.setAttribute('data-theme-css', name);
    var fired = false; var finish = function () { if (!fired) { fired = true; loaded[name] = true; done(); } };
    // past the timeout the look is already on the page without its tokens, and the 3D scenes have read them
    // empty; when the sheet does land they are told again
    link.onload = function () {
      if (fired && current() === name) document.dispatchEvent(new CustomEvent('theme:change', { detail: { theme: name } }));
      finish();
    };
    link.onerror = finish; setTimeout(finish, 2500);
    document.head.appendChild(link);
  }

  function apply(name) {
    if (name === 'charcoal') html.removeAttribute('data-theme'); else html.setAttribute('data-theme', name);
    store(KEY, name === 'charcoal' ? null : name);
    document.dispatchEvent(new CustomEvent('theme:change', { detail: { theme: name } }));
  }

  function pick() {
    var current = html.getAttribute('data-theme') || 'charcoal';
    var seen = (read(SEEN) || '').split(',').filter(Boolean);
    if (seen.indexOf(current) < 0) seen.push(current);
    var pool = LOOKS.filter(function (n) { return seen.indexOf(n) < 0; });
    if (!pool.length) { seen = [current]; pool = LOOKS.filter(function (n) { return n !== current; }); }
    var next = pool[Math.floor(Math.random() * pool.length)];
    seen.push(next); store(SEEN, seen.join(','));
    return next;
  }

  var still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  function shutter(swap) {
    if (still) return swap();
    if (document.startViewTransition) { document.startViewTransition(swap); return; }   // the dissolve in css/tokens.css
    var s = document.createElement('div');
    s.style.cssText = 'position:fixed;inset:0;z-index:9999;pointer-events:none;opacity:0;transition:opacity 250ms ease;background:' + getComputedStyle(document.body).color;
    document.body.appendChild(s);
    requestAnimationFrame(function () { requestAnimationFrame(function () { s.style.opacity = '1'; }); });
    setTimeout(function () {
      swap();
      s.style.background = getComputedStyle(document.body).color;
      requestAnimationFrame(function () { s.style.opacity = '0'; });
      setTimeout(function () { s.remove(); }, 300);
    }, 280);
  }

  function announce(prize, name) {
    var el = document.querySelector('.claw__hint');
    if (!el) return;
    var line = name === 'charcoal' ? 'The site is back to its default look.' : 'The site is now ' + (LABELS[name] || name) + '.';
    var head = el.querySelector('b'), tail = el.querySelector('span');
    if (head && tail) { head.textContent = 'Got the ' + prize + '.'; tail.textContent = line + ' Catch another to change it again.'; }
    else el.textContent = 'Got the ' + prize + '. ' + line;
  }

  /* ---------- hold the page still through a swap ----------
     A look changes section heights, so a swap would move the page under the reader. `keep` measures an
     anchor just before the swap and returns a function that puts it back where it was (or, for the claw,
     centres it). It runs once more when the look's web fonts arrive, since they shift layout a second
     time, unless the reader has scrolled in the meantime. */
  function keep(anchor, align) {
    if (!anchor || typeof anchor.getBoundingClientRect !== 'function') return function () {};
    var before = anchor.getBoundingClientRect().top, lastY = null;
    function fix() {
      if (lastY !== null && Math.abs(window.scrollY - lastY) > 2) return;   // the reader moved on
      var r = anchor.getBoundingClientRect();
      var dy = align === 'center' ? r.top + r.height / 2 - window.innerHeight / 2 : r.top - before;
      if (Math.abs(dy) > 1) window.scrollBy({ top: dy, left: 0, behavior: 'instant' });
      lastY = window.scrollY;
    }
    return function () {
      fix();
      // the look's web fonts arrive after its stylesheet and shift layout again; hold the anchor through that too
      [250, 1000, 2500].forEach(function (ms) { setTimeout(fix, ms); });
      if (document.fonts && document.fonts.ready) requestAnimationFrame(function () { document.fonts.ready.then(fix); });
    };
  }

  var busy = false;
  function switchTo(name, opts) {
    opts = opts || {};
    if (busy) return false; busy = true;
    ensure(name, function () {
      shutter(function () {
        var settle = keep(opts.anchor, opts.align);
        apply(name); settle();
        if (opts.after) opts.after();
        busy = false;
      });
    });
    return true;
  }

  document.addEventListener('claw:caught', function (e) {
    if (busy) return;
    var prize = (e.detail && e.detail.label) || 'prize';
    var next = pick();
    switchTo(next, { anchor: document.querySelector('.claw__stage'), align: 'center', after: function () { announce(prize, next); } });
  });

  /* ---------- the picker in the header: an icon button that opens a menu of the looks ----------
     One per page, items written in the HTML. A menu button pattern: the button names the current look for
     screen readers; arrows, Home and End move through the items, Enter or Space picks, Escape closes and
     hands focus back, and a click outside or tabbing away closes it. */
  function current() { return html.getAttribute('data-theme') || 'charcoal'; }
  function picks() { return Array.prototype.slice.call(document.querySelectorAll('[data-theme-pick]')); }
  function itemsOf(p) { return Array.prototype.slice.call(p.querySelectorAll('[data-look]')); }
  function syncPicks(name) {
    picks().forEach(function (p) {
      itemsOf(p).forEach(function (it) { it.setAttribute('aria-checked', it.getAttribute('data-look') === name ? 'true' : 'false'); });
      var on = p.querySelector('[data-look="' + name + '"]');
      p.querySelector('.pick__btn').setAttribute('aria-label', 'Theme: ' + (on ? on.textContent : name));
    });
  }
  function wirePick(p) {
    var btn = p.querySelector('.pick__btn'), menu = p.querySelector('.pick__menu'), items = itemsOf(p);
    function isOpen() { return btn.getAttribute('aria-expanded') === 'true'; }
    function open(focusLast) {
      menu.hidden = false; btn.setAttribute('aria-expanded', 'true');
      var at = items.filter(function (it) { return it.getAttribute('aria-checked') === 'true'; })[0];
      (focusLast ? items[items.length - 1] : at || items[0]).focus();
    }
    function close(refocus) {
      if (!isOpen()) return;
      menu.hidden = true; btn.setAttribute('aria-expanded', 'false');
      if (refocus) btn.focus();
    }
    btn.addEventListener('click', function () { if (isOpen()) close(false); else open(); });
    btn.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); open(e.key === 'ArrowUp'); }
    });
    items.forEach(function (it, i) {
      it.addEventListener('click', function () {
        var name = valid(it.getAttribute('data-look'));
        close(true);
        if (name === current()) return;
        // whatever sits mid-screen stays there through the swap
        var anchor = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2);
        switchTo(name, { anchor: anchor, align: 'keep' });
      });
      it.addEventListener('keydown', function (e) {
        var to = null;
        if (e.key === 'ArrowDown') to = items[(i + 1) % items.length];
        else if (e.key === 'ArrowUp') to = items[(i - 1 + items.length) % items.length];
        else if (e.key === 'Home') to = items[0];
        else if (e.key === 'End') to = items[items.length - 1];
        else if (e.key === 'Escape') { e.preventDefault(); close(true); return; }
        else if (e.key === 'Tab') { close(false); return; }
        if (to) { e.preventDefault(); to.focus(); }
      });
    });
    document.addEventListener('pointerdown', function (e) { if (isOpen() && !p.contains(e.target)) close(false); });
  }
  function wirePicks() { picks().forEach(wirePick); syncPicks(current()); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wirePicks); else wirePicks();
  document.addEventListener('theme:change', function (e) { syncPicks(e.detail.theme); });

  window.siteTheme = { looks: LOOKS, set: function (n) { n = valid(n); ensure(n, function () { apply(n); }); } };
})();
