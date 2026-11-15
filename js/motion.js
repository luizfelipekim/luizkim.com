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
     It asks for the light with --tilt on the hero. Its stylesheet then reads --lx and --ly, from -1 to 1, as
     where the light sits and how far a card leans: the pointer's place on the screen, or the tilt of a phone.
     --sc is how far the page has carried a card: the hero from 0 at rest to 1 when it has scrolled away, the
     About card from -0.5 as it enters the screen to 0.5 as it leaves. All are eased, and the loop runs only
     while one of them moves: with no input, nothing is written. In a look that does not ask, and while neither
     card is on the screen, nothing is written and no frame is asked for at all. */
  var hero = null, who = null, settled = false, heroH = 0, heroSeen = false, whoSeen = false, wants = false, sure = false;
  var aim = [0, 0, 0, 0], lit = [0, 0, 0, 0], moving = false, tilting = false;
  function findCards() {
    if (settled) return !!(hero || who);
    hero = document.querySelector('.hero'); who = document.querySelector('.who');
    settled = document.readyState !== 'loading';   // final once the page is parsed; a page with no such card then costs nothing
    if (settled) [hero, who].forEach(function (el) {
      if (!el) return;
      if (!window.IntersectionObserver) { sight(el, true); return; }
      new IntersectionObserver(function (es) { sight(el, es[es.length - 1].isIntersecting); }).observe(el);
    });
    return !!(hero || who);
  }
  // does this look read the light? The stylesheet that says so may arrive after the page, so the answer is kept only once the page has loaded
  function uses() {
    if (!sure && findCards()) {
      wants = getComputedStyle(hero || who).getPropertyValue('--tilt').trim() !== '';
      sure = document.readyState === 'complete';
      if (!wants) tilting = false;
    }
    return wants;
  }
  // a card comes onto the screen or leaves it. One that arrives takes its place at once, with no glide
  function sight(el, on) {
    var none = !heroSeen && !whoSeen;
    if (el === hero) heroSeen = on; else whoSeen = on;
    tune();
    if (!on || !uses()) return;
    trackScroll();
    if (none) { lit[0] = aim[0]; lit[1] = aim[1]; }
    if (el === hero) lit[2] = aim[2]; else lit[3] = aim[3];
    put(el, el === hero ? lit[2] : lit[3]); wake();
  }
  function put(el, far) { el.style.setProperty('--lx', lit[0].toFixed(3)); el.style.setProperty('--ly', lit[1].toFixed(3)); el.style.setProperty('--sc', far.toFixed(3)); }
  function stepLight() {
    var rest = 0;
    for (var i = 0; i < 4; i++) { lit[i] += (aim[i] - lit[i]) * 0.12; rest += Math.abs(aim[i] - lit[i]); }
    if (heroSeen) put(hero, lit[2]);
    if (whoSeen) put(who, lit[3]);
    moving = rest > 0.002 && wants && (heroSeen || whoSeen);
    if (moving) requestAnimationFrame(stepLight);
  }
  function wake() { if (!moving && wants && (heroSeen || whoSeen)) { moving = true; requestAnimationFrame(stepLight); } }
  function trackLight(e) {
    if (!uses()) return;
    if (tilting && e.pointerType !== 'mouse') return;   // on a phone that is steering by its tilt, a finger on the glass is not the light
    aim[0] = (e.clientX / (innerWidth || 1)) * 2 - 1; aim[1] = (e.clientY / (innerHeight || 1)) * 2 - 1;
    wake();
  }
  // a finger that lifts takes its light with it: the card settles back
  function dropLight(e) { if (e.pointerType === 'mouse' || tilting || !uses()) return; aim[0] = aim[1] = 0; wake(); }
  function trackScroll() {
    if (!uses()) return;
    var far = aim[2], through = aim[3];
    if (heroSeen) { if (!heroH) heroH = hero.offsetHeight || 1; far = Math.min(Math.max(scrollY / heroH, 0), 1); }
    if (whoSeen) { var box = who.getBoundingClientRect(); through = Math.min(Math.max((innerHeight - box.top) / (innerHeight + box.height), 0), 1) - 0.5; }
    if (far === aim[2] && through === aim[3]) return;
    aim[2] = far; aim[3] = through; wake();
  }
  addEventListener('pointermove', trackLight, { passive: true });
  addEventListener('pointerup', dropLight, { passive: true });
  addEventListener('pointercancel', dropLight, { passive: true });
  addEventListener('scroll', trackScroll, { passive: true });
  addEventListener('resize', function () { heroH = 0; });

  /* the tilt of a phone. It is read from which way is up in the screen's own axes, not from the raw angles, which
     jump when the phone passes upright or is held overhead. Two angles come out of it: the roll to left and
     right, and the pitch forward and back. The way the phone is held is level: level follows the hand slowly
     (several seconds), so a new resting pose becomes level again while a quick tilt still leans the card, and
     past the card's full lean it follows at once, so turning back answers at once. The sensor is heard only
     while the look asks for it and a card is on the screen.
     iOS gives no readings until the reader allows them, and may only be asked on a tap: a tap on either card
     asks, and a refusal changes nothing. */
  var level = null, pitch = 0, lost = false, tiltAt = 0, heard = false, asked = false, asking = false, down = null;
  var FULL_X = 16, FULL_Y = 22, DRIFT = 4000;   // degrees of roll and of pitch for the card's full lean; ms for level to follow a held pose
  function around(deg) { return deg - 360 * Math.round(deg / 360); }   // the short way round between two angles
  function onTilt(e) {
    if (e.gamma == null || e.beta == null) return;
    var rad = Math.PI / 180, b = e.beta * rad, g = e.gamma * rad;
    // up, in the phone's axes (x to its right, y to its top, z out of the glass)...
    var ux = -Math.sin(g) * Math.cos(b), uy = Math.sin(b), uz = Math.cos(g) * Math.cos(b);
    // ...and in the screen's, when the phone is held on its side. Phones say how far the screen is turned in
    // window.orientation; where that is missing, screen.orientation says it
    var turn = (typeof window.orientation === 'number' ? window.orientation : (screen.orientation && screen.orientation.angle) || 0) * rad;
    var sx = Math.cos(turn) * ux - Math.sin(turn) * uy, sy = Math.sin(turn) * ux + Math.cos(turn) * uy;
    var roll = Math.asin(Math.max(-1, Math.min(1, -sx))) / rad;
    // with a side edge straight up there is no forward or back: the last pitch stands, and the one that comes back is taken as where it left off
    var steady = Math.abs(sy) + Math.abs(uz) > 0.25, was = pitch;
    if (steady) pitch = Math.atan2(sy, uz) / rad;
    if (level && steady && lost) level[1] += around(pitch - was);
    lost = !steady;
    if (!level) level = [roll, pitch];
    else {
      var k = 1 - Math.exp(-Math.max(0, e.timeStamp - tiltAt) / DRIFT);
      level[0] += (roll - level[0]) * k; level[1] += around(pitch - level[1]) * k;
    }
    tiltAt = e.timeStamp;
    var x = Math.max(-FULL_X, Math.min(FULL_X, roll - level[0])), y = Math.max(-FULL_Y, Math.min(FULL_Y, around(pitch - level[1])));
    level[0] = roll - x; level[1] = pitch - y;
    x /= FULL_X; y /= FULL_Y;
    if (Math.abs(x - aim[0]) + Math.abs(y - aim[1]) < 0.03) return;   // a hand is never quite still: the sensor's noise must not keep the loop awake
    tilting = true; aim[0] = x; aim[1] = y; wake();
  }
  // the sensor is listened to, or let go; when it comes back, the pose of that moment is level
  function tune() {
    var on = wants && (heroSeen || whoSeen) && !!window.DeviceOrientationEvent;
    if (on === heard) return;
    heard = on; level = null;
    if (on) addEventListener('deviceorientation', onTilt, { passive: true }); else removeEventListener('deviceorientation', onTilt);
  }
  function askTilt() {
    var D = window.DeviceOrientationEvent;
    if (asked || asking || !uses() || !D || typeof D.requestPermission !== 'function') return;
    asking = true;
    // the answer is final only when the reader has given one. A call the browser turns away (it saw no tap) may be made again at the next tap
    try { D.requestPermission().then(function (state) { asking = false; asked = state === 'granted' || state === 'denied'; }, function () { asking = false; }); }
    catch (err) { asking = false; }
  }
  // a tap on either card. iOS Safari sends no click to the window for a tap on an element that is not a
  // control, so the end of the touch is heard too; either one is a gesture the permission accepts. The end of
  // a touch counts only as a tap: one that began near by and a moment ago, not the end of a swipe that scrolls
  function tapAsks(e) {
    var from = down; if (e.type === 'touchend') down = null;
    if (asked || asking || !e.target || !e.target.closest || !e.target.closest('.hero__bottom, .who')) return;
    if (e.type === 'touchend') {
      var t = e.changedTouches && e.changedTouches[0];
      if (!t || !from || Math.abs(t.clientX - from[0]) + Math.abs(t.clientY - from[1]) > 10 || e.timeStamp - from[2] > 600) return;
    }
    askTilt();
  }
  addEventListener('touchstart', function (e) { var t = e.touches.length === 1 ? e.touches[0] : null; down = t ? [t.clientX, t.clientY, e.timeStamp] : null; }, { passive: true });
  addEventListener('click', tapAsks);
  addEventListener('touchend', tapAsks, { passive: true });
  // the look is known for sure once the page has loaded, and again each time it changes
  function relook() { sure = false; heroH = 0; uses(); tune(); if (wants) { trackScroll(); wake(); } }
  addEventListener('load', relook);
  document.addEventListener('theme:change', relook);

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
