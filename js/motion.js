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

  /* ---------- the light on the foil ----------
     A look may print on holographic stock and turn its cards in space (the esports hero card and About card).
     Its stylesheet reads --lx and --ly, from -1 to 1, as where the light sits and how far a card leans: the
     pointer's place on the screen, or the tilt of a phone. --sc is how far the page has carried a card: the
     hero from 0 at rest to 1 when it has scrolled away, the About card from -0.5 as it enters the screen to
     0.5 as it leaves. All are eased, and the loop runs only while one of them moves: with no input, nothing
     is written. */
  var cards = [], settled = false, hero = null, heroH = 0, who = null, whoSeen = false, aim = [0, 0, 0, 0], lit = [0, 0, 0, 0], moving = false, tilting = false;
  function findCards() {
    if (settled) return cards.length > 0;
    cards = Array.prototype.slice.call(document.querySelectorAll('.hero, .who'));
    hero = document.querySelector('.hero'); who = document.querySelector('.who');
    settled = document.readyState !== 'loading';   // the list is final once the page is parsed; a page with no such card then costs nothing
    if (settled && who) {
      // the About card is measured only while it is on the screen; the first sight of it sets its place without a glide
      if (!window.IntersectionObserver) whoSeen = true;
      else new IntersectionObserver(function (es) {
        var first = !whoSeen && lit[3] === 0;
        whoSeen = es[es.length - 1].isIntersecting;
        if (whoSeen) { trackScroll(); if (first) lit[3] = aim[3]; }
      }).observe(who);
    }
    return cards.length > 0;
  }
  function stepLight() {
    var rest = 0;
    for (var i = 0; i < 4; i++) { lit[i] += (aim[i] - lit[i]) * 0.12; rest += Math.abs(aim[i] - lit[i]); }
    moving = rest > 0.002;
    cards.forEach(function (el) { el.style.setProperty('--lx', lit[0].toFixed(3)); el.style.setProperty('--ly', lit[1].toFixed(3)); });
    if (hero) hero.style.setProperty('--sc', lit[2].toFixed(3));
    if (who) who.style.setProperty('--sc', lit[3].toFixed(3));
    if (moving) requestAnimationFrame(stepLight);
  }
  function wake() { if (!moving) { moving = true; requestAnimationFrame(stepLight); } }
  function trackLight(e) {
    if (!findCards()) return;
    if (tilting && e.pointerType !== 'mouse') return;   // on a phone that is steering by its tilt, a finger on the glass is not the light
    aim[0] = (e.clientX / (innerWidth || 1)) * 2 - 1; aim[1] = (e.clientY / (innerHeight || 1)) * 2 - 1;
    wake();
  }
  // a finger that lifts takes its light with it: the card settles back
  function dropLight(e) { if (e.pointerType === 'mouse' || tilting || !findCards()) return; aim[0] = aim[1] = 0; wake(); }
  function trackScroll() {
    if (!findCards()) return;
    var far = aim[2], through = aim[3];
    if (hero) { if (!heroH) heroH = hero.offsetHeight || 1; far = Math.min(Math.max(scrollY / heroH, 0), 1); }
    if (who && whoSeen) { var box = who.getBoundingClientRect(); through = Math.min(Math.max((innerHeight - box.top) / (innerHeight + box.height), 0), 1) - 0.5; }
    if (far === aim[2] && through === aim[3]) return;
    aim[2] = far; aim[3] = through; wake();
  }
  addEventListener('pointermove', trackLight, { passive: true });
  addEventListener('pointerup', dropLight, { passive: true });
  addEventListener('pointercancel', dropLight, { passive: true });
  addEventListener('scroll', trackScroll, { passive: true });
  addEventListener('resize', function () { heroH = 0; });

  /* the tilt of a phone. A look asks for it with --tilt on the hero. The way the phone is held when the first
     reading comes is level; past the card's full lean, level follows the hand, so turning back answers at once.
     iOS gives no readings until the reader allows them, and may only be asked on a tap: the first tap on either
     card asks, and a refusal changes nothing. */
  var level = null, heard = false, asked = false, wants = false, FULL = 22;   // FULL: degrees of tilt for the card's full lean
  function onTilt(e) {
    if (!wants || e.gamma == null || e.beta == null) return;
    var turn = (screen.orientation && screen.orientation.angle) || 0;   // a phone on its side swaps the two axes
    var x = turn === 90 ? e.beta : turn === 270 ? -e.beta : e.gamma, y = turn === 90 ? -e.gamma : turn === 270 ? e.gamma : e.beta;
    if (!level) level = [x, y];
    level[0] = Math.min(Math.max(level[0], x - FULL), x + FULL); level[1] = Math.min(Math.max(level[1], y - FULL), y + FULL);
    x = (x - level[0]) / FULL; y = (y - level[1]) / FULL;
    if (Math.abs(x - aim[0]) + Math.abs(y - aim[1]) < 0.03) return;   // a hand is never quite still: the sensor's noise must not keep the loop awake
    tilting = true; aim[0] = x; aim[1] = y; wake();
  }
  function askTilt(tapped) {
    var D = window.DeviceOrientationEvent;
    wants = findCards() && !!hero && getComputedStyle(hero).getPropertyValue('--tilt').trim() !== '';
    if (!wants) { tilting = false; return; }
    if (!D) return;
    if (!heard) { heard = true; addEventListener('deviceorientation', onTilt, { passive: true }); }
    if (tapped && !asked && typeof D.requestPermission === 'function') { asked = true; D.requestPermission().catch(function () {}); }
  }
  // a tap on either card. iOS Safari sends no click to the window for a tap on an element that is not a
  // control, so the end of the touch is heard too; either one is a gesture the permission accepts
  function tapAsks(e) { if (!asked && e.target && e.target.closest && e.target.closest('.hero__bottom, .who')) askTilt(true); }
  addEventListener('click', tapAsks);
  addEventListener('touchend', tapAsks, { passive: true });
  addEventListener('load', function () { askTilt(false); trackScroll(); });
  document.addEventListener('theme:change', function () { heroH = 0; askTilt(false); });

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
