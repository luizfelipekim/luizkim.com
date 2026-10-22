/* AI case study teaser on the homepage: a fortune ball that answers the questions
   designers ask about shipping from prototypes. Press, hold and shake it (or drag,
   or shake the phone); it flips to its window and the printed answer clears through
   the ink. Needs js/three.min.js (r128) loaded first. All artwork is drawn on canvas. */
(function () {
  'use strict';
  var stage = document.querySelector('.ball');
  if (!stage) return;
  var view = stage.querySelector('.ball__view'), canvas = stage.querySelector('.ball__canvas');
  var hasGL = (function () { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  if (typeof THREE === 'undefined' || !hasGL) { stage.classList.add('is-flat'); return; }

  var QA = [
    ["You hand off straight from AI?", "Yes. Five tickets were built straight from the prototype."],
    ["Same team, what actually changed?", "Handoffs per designer: 0.8 to 1.8 a week. Same four people."],
    ["So you skipped Figma entirely?", "No. Figma rebuild: 5 hours to one click. Polish runs alongside."],
    ["Doesn't AI output look generic?", "Not on real components. It is wired to our design system."]
  ];
  var FONT = '"Hanken Grotesk", "Helvetica Neue", Arial, sans-serif';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var qEl = stage.querySelector('.ball__q'), aEl = stage.querySelector('.ball__a'), cap = stage.querySelector('.ball__cap'),
      hint = stage.querySelector('.ball__hint'), meter = stage.querySelector('.ball__meter i'),
      btnReveal = stage.querySelector('[data-ball-reveal]'), btnNext = stage.querySelector('[data-ball-next]'),
      btnMotion = stage.querySelector('[data-ball-motion]'), countEl = stage.querySelector('.ball__count');

  /* ---------- renderer / scene ---------- */
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  renderer.outputEncoding = THREE.sRGBEncoding;
  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);
  camera.position.set(0, 0.15, 6.4);

  scene.add(new THREE.AmbientLight(0xffffff, 0.08));
  var key = new THREE.DirectionalLight(0xffffff, 0.5); key.position.set(-0.5, 5, 2.5); scene.add(key);
  var rim = new THREE.DirectionalLight(0x8fa68e, 0.22); rim.position.set(3, -0.5, -2.5); scene.add(rim);

  // studio environment for the reflections: a dark room with a few softboxes, baked once
  function bakeEnv() {
    var room = new THREE.Scene();
    room.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.035, 0.035, 0.035), side: THREE.BackSide })));
    function panel(w, h, col, pos, look) { var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.position.set(pos[0], pos[1], pos[2]); m.lookAt(look[0], look[1], look[2]); room.add(m); }
    panel(12, 9, new THREE.Color(5, 5, 4.8), [0, 5.5, 2.2], [0, 0, 0]);          // overhead softbox
    panel(6, 1.4, new THREE.Color(0.95, 1.0, 0.95), [0, -3.2, 0.6], [0, 0, 0]);   // table bounce
    panel(0.6, 5, new THREE.Color(0.85, 0.95, 0.85), [6, 0.5, -3], [0, 0, 0]);    // edge line, right
    panel(14, 1.1, new THREE.Color(7, 7.3, 7), [0, 3.6, -5.5], [0, 0, 0]);        // rim strip, top
    var pm = new THREE.PMREMGenerator(renderer); pm.compileEquirectangularShader();
    var rt = pm.fromScene(room, 0.04); pm.dispose(); return rt.texture;
  }
  var env = bakeEnv();
  scene.environment = env;
  var rimTop = new THREE.DirectionalLight(0xe6ece4, 0.9); rimTop.position.set(0, 2.6, -4); scene.add(rimTop);

  var R = 1.3;
  var ball = new THREE.Group(); scene.add(ball);   // position = drift + shake
  var body = new THREE.Group(); ball.add(body);    // rotation = roll tilt + flip
  var sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0.0275, 0.0275, 0.0275), roughness: 0.2, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.1, envMap: env, envMapIntensity: 0.9 }));
  body.add(sphere);

  /* ---------- canvas decals: eye on the front, window on the back ---------- */
  function makeTex(size) { var c = document.createElement('canvas'); c.width = c.height = size; var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return { c: c, ctx: c.getContext('2d'), t: t }; }
  var eye = makeTex(512), win = makeTex(512);
  function capMesh(phiCenter, tex, glow) {
    var span = 1.05;
    var g = new THREE.SphereGeometry(R + 0.004, 48, 48, phiCenter - span / 2, span, Math.PI / 2 - span / 2, span);
    var m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.55, metalness: 0, depthWrite: false });
    if (glow) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = tex; m.emissiveIntensity = glow; }
    return new THREE.Mesh(g, m);
  }
  body.add(capMesh(Math.PI / 2, eye.t, 0.6));
  body.add(capMesh(3 * Math.PI / 2, win.t));

  // soft ground shadow
  var shadow = (function () { var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d');
    var g = x.createRadialGradient(128, 128, 10, 128, 128, 128); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256); var t = new THREE.CanvasTexture(c);
    var sh = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.2), new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
    sh.rotation.x = -Math.PI / 2; sh.position.y = -R - 0.35; scene.add(sh); return sh; })();

  /* ---------- eye drawing (line art) ---------- */
  var pupil = { x: 0, y: 0 }, pupilT = { x: 0, y: 0 }, nextBlink = 2.5;
  function drawEye(open) {
    var ctx = eye.ctx, S = 512, cx = 256, cy = 256;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = '#f1f1ef'; ctx.beginPath(); ctx.arc(cx, cy, 214, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#1c1c1c'; ctx.fillStyle = '#1c1c1c'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var w = 140, h = 72 * open;
    function lid() { ctx.beginPath(); ctx.moveTo(cx - w, cy); ctx.quadraticCurveTo(cx, cy - h * 2, cx + w, cy); ctx.quadraticCurveTo(cx, cy + h * 2, cx - w, cy); ctx.closePath(); }
    ctx.save(); lid(); ctx.clip();
    var ix = cx + pupil.x * 28, iy = cy + pupil.y * 14;
    ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ix, iy, 52, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2.5;
    for (var i = 0; i < 24; i++) { var a = i / 24 * Math.PI * 2, r0 = 30 + (i % 2) * 7; ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0); ctx.lineTo(ix + Math.cos(a) * 48, iy + Math.sin(a) * 48); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(ix, iy, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f1f1ef'; ctx.beginPath(); ctx.arc(ix - 8, iy - 8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = '#1c1c1c'; ctx.lineWidth = 5; lid(); ctx.stroke();
    ctx.lineWidth = 4;
    for (var j = 0; j < 7; j++) { var t = (j + 1) / 8, px = cx - w + t * 2 * w, py = cy - 2 * h * t * (1 - t) * 2; var dx = (t - 0.5) * 0.8;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + dx * 22, py - 22 * open); ctx.stroke(); }
    ctx.lineWidth = 3;
    for (var k = 0; k < 5; k++) { var a2 = Math.PI / 2 + (k - 2) * 0.28; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a2) * (h * 2 + 16), cy + Math.sin(a2) * (h * 2 + 16)); ctx.lineTo(cx + Math.cos(a2) * (h * 2 + 34), cy + Math.sin(a2) * (h * 2 + 34)); ctx.stroke(); }
    eye.t.needsUpdate = true;
  }

  /* ---------- window drawing: answer printed under the ink ---------- */
  var cover = 1, swirl = 0, answer = QA[0][1], inkPhase = 0;
  function wrapText(ctx, text, maxW) { var words = text.split(' '), lines = [], line = '';
    words.forEach(function (wd) { var test = line ? line + ' ' + wd : wd; if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = wd; } else line = test; });
    if (line) lines.push(line); return lines; }
  function drawWindow() {
    var ctx = win.ctx, S = 512, cx = 256, cy = 256;
    var faceCol = '#1f2420', textCol = '#f1f1ef', inkCol = '#111412';
    ctx.clearRect(0, 0, S, S);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 214, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = inkCol; ctx.fillRect(0, 0, S, S);
    var up = 1 - cover, sc = 0.86 + 0.14 * up, ay = cy + 40 * (1 - up);
    ctx.save(); ctx.translate(cx, ay); ctx.scale(sc, sc);
    ctx.fillStyle = faceCol; ctx.beginPath(); ctx.arc(0, 0, 170, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(143,166,142,0.35)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 170, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = textCol; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '500 30px ' + FONT;
    var lines = wrapText(ctx, answer, 280), lh = 36, y0 = -(lines.length - 1) * lh / 2;
    lines.forEach(function (l, i) { ctx.fillText(l, 0, y0 + i * lh); });
    ctx.restore();
    ctx.fillStyle = 'rgba(14,18,16,' + (cover * 0.97).toFixed(3) + ')'; ctx.fillRect(0, 0, S, S);
    for (var i = 0; i < 9; i++) {
      var a = inkPhase * (0.6 + i * 0.07) + i * 0.7, r = 60 + i * 17, alpha = (0.12 + 0.25 * swirl) * cover;
      ctx.strokeStyle = 'rgba(96,118,96,' + alpha.toFixed(3) + ')'; ctx.lineWidth = 14 + (i % 3) * 6;
      ctx.beginPath(); ctx.arc(cx + Math.sin(a * 0.5) * 20, cy + Math.cos(a * 0.4) * 20, r, a, a + 1.6 + swirl); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(241,241,239,0.14)'; ctx.lineWidth = 6; ctx.beginPath(); ctx.arc(cx, cy, 214, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 5; ctx.beginPath(); ctx.arc(cx, cy, 200, -2.4, -1.3); ctx.stroke();
    win.t.needsUpdate = true;
  }

  /* ---------- state ---------- */
  var idx = 0, state = 'idle', energy = 0, flip = 0, flipT = 0, held = false, holdStart = 0, last = null, shake = { x: 0, y: 0 }, t0 = performance.now(), prevPos = { x: 0, y: 0 };
  var PHI = 0.3063;
  function setQuestion(i) { qEl.classList.add('is-out'); setTimeout(function () { qEl.textContent = QA[i][0]; qEl.classList.remove('is-out'); }, 350);
    answer = QA[i][1]; aEl.textContent = answer; countEl.textContent = (i + 1) + ' / ' + QA.length; }
  setQuestion(0); qEl.classList.remove('is-out'); qEl.textContent = QA[0][0];

  function reveal() {
    if (state !== 'idle') return;
    state = 'flip'; flipT = 0; energy = 1; held = false; view.classList.remove('is-held');
    hint.classList.add('is-off'); btnReveal.hidden = true; btnMotion.hidden = true;
  }
  function next() {
    if (state !== 'shown') return;
    idx = (idx + 1) % QA.length; setQuestion(idx);
    cap.classList.remove('is-shown'); btnNext.hidden = true;
    state = 'refill'; flipT = 0;
  }
  btnReveal.addEventListener('click', reveal);
  btnNext.addEventListener('click', next);
  view.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (state === 'idle') reveal(); else if (state === 'shown') next(); } });

  view.addEventListener('pointerdown', function (e) {
    if (state !== 'idle') return;
    held = true; holdStart = performance.now(); last = { x: e.clientX, y: e.clientY, t: holdStart };
    view.classList.add('is-held'); try { view.setPointerCapture(e.pointerId); } catch (_) {}
  });
  function release() { held = false; view.classList.remove('is-held'); last = null; }
  view.addEventListener('pointerup', release); view.addEventListener('pointercancel', release); view.addEventListener('lostpointercapture', release);
  view.addEventListener('pointermove', function (e) {
    var r = view.getBoundingClientRect();
    pupilT.x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2));
    pupilT.y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2));
    if (!held || !last || state !== 'idle') return;
    var now = performance.now(), dt = Math.max(1, now - last.t), dx = e.clientX - last.x, dy = e.clientY - last.y;
    var speed = Math.hypot(dx, dy) / dt;
    energy = Math.min(1, energy + Math.min(speed, 3) * 0.028);
    shake.x += dx * 0.004; shake.y -= dy * 0.004;
    last = { x: e.clientX, y: e.clientY, t: now };
    if (energy >= 1) reveal();
  });

  // phone motion where the browser allows it; dragging always works too
  var motionOn = false;
  function onMotion(e) {
    if (state !== 'idle') return;
    var a = e.accelerationIncludingGravity || e.acceleration; if (!a) return;
    var m = Math.hypot(a.x || 0, a.y || 0, a.z || 0);
    if (onMotion.prev != null) { var d = Math.abs(m - onMotion.prev); if (d > 7) { energy = Math.min(1, energy + d * 0.03); shake.x += (Math.random() - 0.5) * 0.3; shake.y += (Math.random() - 0.5) * 0.2; if (energy >= 1) reveal(); } }
    onMotion.prev = m;
  }
  var isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
  if (isTouch && typeof DeviceMotionEvent !== 'undefined') {
    btnMotion.hidden = false;
    btnMotion.addEventListener('click', function () {
      var start = function () { motionOn = true; window.addEventListener('devicemotion', onMotion); btnMotion.textContent = 'Now shake it'; hint.textContent = 'Shake your phone'; };
      var fail = function () { btnMotion.hidden = true; hint.textContent = 'Motion is off here. Drag the ball to shake it'; };
      if (typeof DeviceMotionEvent.requestPermission === 'function') DeviceMotionEvent.requestPermission().then(function (s) { if (s === 'granted') start(); else fail(); }).catch(fail);
      else start();
    });
  }

  /* ---------- animation ---------- */
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  var baseZ = 6.4, zoomZ = 6.4, zoom = 0, TARGET_PX = 16, FONT_TEX = 30;
  function fit() { var w = view.clientWidth, h = view.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    var s = Math.min(1, w / 720); baseZ = 6.4 / Math.max(0.62, s);
    var fontWorld = FONT_TEX * (R * 1.05 / 512);
    var dist = fontWorld * h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * TARGET_PX);
    zoomZ = Math.min(baseZ, R + dist);
    camera.position.z = baseZ + (zoomZ - baseZ) * zoom; }
  fit(); window.addEventListener('resize', fit);

  // only animate while the ball is on screen
  var visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (e) { visible = e.isIntersecting; }); }, { threshold: 0.05 }).observe(view);

  var lastFrame = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible) { lastFrame = now; return; }
    var dt = Math.min(0.05, (now - lastFrame) / 1000); lastFrame = now; var t = (now - t0) / 1000;
    var dx = 0, dy = 0;
    if (!reduce) { var th = Math.PI * (1 + Math.sin(t * 0.11)), r = 0.045 * Math.exp(PHI * th); dx = r * Math.cos(th); dy = r * Math.sin(th) * 0.6 + Math.sin(t * 0.7) * 0.03; }
    dx *= 1 - zoom; dy *= 1 - zoom;
    shake.x *= 0.86; shake.y *= 0.86;
    var jitter = held ? energy * 0.06 : 0;
    var px = dx + shake.x + (Math.random() - 0.5) * jitter, py = dy + shake.y + (Math.random() - 0.5) * jitter;
    ball.position.set(px, py, 0);
    var vx = (px - prevPos.x) / Math.max(dt, 0.001), vy = (py - prevPos.y) / Math.max(dt, 0.001); prevPos = { x: px, y: py };
    body.rotation.z += ((-vx * 0.35) - body.rotation.z) * 0.08;
    body.rotation.x += ((vy * 0.35) - body.rotation.x) * 0.08;
    shadow.position.x = px * 0.9; shadow.material.opacity = 1 - Math.max(0, py) * 0.6;

    if (held && state === 'idle' && now - holdStart > 1300) reveal();
    if (held && state === 'idle') energy = Math.max(0, energy - dt * 0.25);
    meter.style.width = (energy * 100).toFixed(0) + '%';

    if (state === 'flip') { flipT += dt; var k = ease(Math.min(1, flipT / 0.9)); flip = k * Math.PI; swirl = 1 - k; if (flipT >= 0.9) { state = 'clear'; flipT = 0; } }
    else if (state === 'clear') { flipT += dt; cover = 1 - ease(Math.min(1, flipT / 1.3)); swirl = cover * 0.6; if (flipT >= 1.3) { state = 'shown'; cover = 0; cap.classList.add('is-shown'); btnNext.hidden = false; } }
    else if (state === 'refill') { flipT += dt; var k2 = ease(Math.min(1, flipT / 0.9)); cover = k2; flip = Math.PI * (1 + k2); swirl = k2 * 0.5;
      if (flipT >= 0.9) { state = 'idle'; flip = 0; cover = 1; energy = 0; swirl = 0; hint.classList.remove('is-off'); btnReveal.hidden = false; if (isTouch && typeof DeviceMotionEvent !== 'undefined' && !motionOn) btnMotion.hidden = false; } }
    else { swirl += ((held ? energy : 0) - swirl) * 0.1; }
    body.rotation.y = flip;
    inkPhase += dt * (0.3 + swirl * 4);

    var zt = (state === 'clear' || state === 'shown') ? 1 : 0;
    zoom = reduce ? zt : zoom + (zt - zoom) * Math.min(1, dt * 2.6);
    var ez = zoom * zoom * (3 - 2 * zoom);
    camera.position.z = baseZ + (zoomZ - baseZ) * ez;
    camera.position.x = ball.position.x * ez;
    camera.position.y = 0.15 * (1 - ez) + ball.position.y * ez;

    if (!isTouch || held) { pupil.x += (pupilT.x - pupil.x) * 0.1; pupil.y += (pupilT.y - pupil.y) * 0.1; }
    else { pupil.x += ((dx * 4) - pupil.x) * 0.05; pupil.y += ((dy * 4) - pupil.y) * 0.05; }
    nextBlink -= dt; var open = 1;
    if (nextBlink < 0) { var b = -nextBlink; open = b < 0.08 ? 1 - b / 0.08 : b < 0.16 ? (b - 0.08) / 0.08 : 1; if (b > 0.16) nextBlink = 2.5 + Math.random() * 4; }
    if (held && state === 'idle') open = Math.min(open, 1 - energy * 0.85);
    if (state === 'flip') open = 0;
    drawEye(open); drawWindow();
    renderer.render(scene, camera);
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawWindow);
  requestAnimationFrame(frame);
})();
