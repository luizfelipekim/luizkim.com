/* The foil on the hero portrait.

   A look may frame the portrait in the hero as card art (.hero__art) and print it in holographic foil; it
   says so with --look: foil, as it does for the 3D scenes. The stylesheet paints that art first, with
   gradients, and that paint stays as the fallback. This file lays one small WebGL picture over it: the same
   foil as the claw's sticker and the poker cards (soft patches, each with its own grating; the grating
   equation picks a colour from the fixed palette), but pressed over the sculpture's relief, which is read
   from the portrait's own light and shade. So the colour runs along the forms of the face and the hair, and
   it moves when the light moves.

   Nothing here runs by itself. js/motion.js writes the light (--lx, --ly, --sc) on the hero and the
   stylesheet works out the card's lean (--lean-x, --lean-y); a frame is drawn only when one of them changes.
   It starts after the page has loaded and is idle, so the name and the card paint first. */
(function () {
  var art = document.querySelector('.hero__art');
  if (!art || !window.WebGLRenderingContext) return;
  var hero = art.closest('.hero') || art, root = document.documentElement;
  var canvas = null, gl = null, uni = null, tex = null, img = null, queued = false, shown = false, seen = true, foil = false;

  function readLook() { foil = getComputedStyle(root).getPropertyValue('--look').trim() === 'foil'; return foil; }

  var VERT = 'attribute vec2 p; varying vec2 vUv; void main(){ vUv = vec2(p.x * 0.5 + 0.5, 0.5 - p.y * 0.5); gl_Position = vec4(p, 0.0, 1.0); }';
  var FRAG = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH',
    'precision highp float;',
    '#else',
    'precision mediump float;',
    '#endif',
    'varying vec2 vUv; uniform sampler2D uMap; uniform vec2 uRes; uniform vec2 uLight; uniform vec2 uLean;',
    'float fHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
    '// the foil palette, as on the sticker: cyan, violet, magenta, gold, round again',
    'vec3 fPal(float t){ t = fract(t) * 4.0; float i = floor(t), f = smoothstep(0.0, 1.0, fract(t));',
    '  vec3 c0 = vec3(0.0, 0.85, 1.0), c1 = vec3(0.42, 0.18, 1.0), c2 = vec3(1.0, 0.08, 0.72), c3 = vec3(1.0, 0.72, 0.12);',
    '  vec3 a = i < 1.0 ? c0 : i < 2.0 ? c1 : i < 3.0 ? c2 : c3; vec3 b = i < 1.0 ? c1 : i < 2.0 ? c2 : i < 3.0 ? c3 : c0;',
    '  return mix(a, b, f); }',
    'float fNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);',
    '  return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), f.x), mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), f.x), f.y); }',
    '// a hex grid: x,y name the cell (whole numbers, so every pixel of a cell agrees), z the distance to its nearest edge',
    'vec3 fHex(vec2 p){ vec2 s = vec2(1.0, 1.7320508); vec2 h = 0.5 * s;',
    '  vec2 a = mod(p, s) - h, b = mod(p - h, s) - h; vec2 g = dot(a, a) < dot(b, b) ? a : b;',
    '  vec2 q = abs(g); float e = 0.5 - max(dot(q, normalize(s)), q.x); return vec3(floor((p - g) / h + 0.5), e); }',
    'float lum(vec3 c){ return dot(c, vec3(0.3, 0.59, 0.11)); }',
    '// give a colour the light and shade of the sculpture: the face keeps its own modelling under any hue',
    'vec3 shade(vec3 c, float l){ c += l - lum(c); float n = min(c.r, min(c.g, c.b)), x = max(c.r, max(c.g, c.b));',
    '  if (n < 0.0) c = l + (c - l) * l / (l - n);',
    '  if (x > 1.0) c = l + (c - l) * (1.0 - l) / (x - l);',
    '  return c; }',
    'float tone(vec2 q, float blur){ return texture2D(uMap, q, blur).r; }',
    'void main(){',
    '  // the portrait sits where the stylesheet puts it: 116% of the window wide, set back, so it slides against the frame',
    '  float S = 1.16 * uRes.x; vec2 px = vUv * uRes;',
    '  vec2 q = vec2((px.x - (uRes.x - S) * 0.5 + uLean.x * 9.0) / S, (px.y - (uRes.y - S) * 0.14 - uLean.y * 8.0) / S);',
    '  float l = tone(q, 0.0), soft = tone(q, 2.0);',
    '  float inside = step(0.0, q.y) * step(q.y, 1.0);',
    '  float bust = smoothstep(0.035, 0.1, max(l, soft)) * inside;',
    '  // the relief: where the light and shade of the sculpture changes, its surface turns',
    '  float e = 6.0 / 1024.0;',
    '  vec2 g = vec2(tone(q + vec2(e, 0.0), 3.4) - tone(q - vec2(e, 0.0), 3.4), tone(q - vec2(0.0, e), 3.4) - tone(q + vec2(0.0, e), 3.4));',
    '  vec3 N = normalize(vec3(-g, 0.9));',
    '  vec3 L = normalize(vec3(uLight.x, -uLight.y, 0.9));',
    '  vec3 V = normalize(vec3(-uLean.x * 0.45, -uLean.y * 0.4, 1.0));',
    '  vec3 H = normalize(L + V);',
    '  // foil pressed in large patches, each with its own grating direction and pitch; the relief turns the grating',
    '  vec2 sp = (q - 0.5) * 2.6;',
    '  float gA = 6.2831853 * fNoise(sp * 0.9 + 1.7); vec3 T = vec3(cos(gA), sin(gA), 0.0); T = normalize(T - N * dot(T, N));',
    '  float pitch = 0.7 + 0.6 * fNoise(sp * 1.4 + 9.2);',
    '  float fU = dot(T, L) + dot(T, V);',
    '  vec3 foil = fPal(fU * 0.85 * pitch + 0.8 * fNoise(sp * 0.7 + 4.4) - 0.2);',
    '  float body = clamp(pow(l / 0.62, 1.2), 0.0, 1.0) * 0.82;',
    '  // the light is a lamp close to the card: the foil is at full colour where it falls and pearl silver away from it,',
    '  // so the colour crosses the face with the light',
    '  vec2 wp = (vUv - 0.5) * vec2(2.0 * uRes.x / uRes.y, -2.0);',
    '  vec2 away = vec2(uLight.x * 1.3, -uLight.y * 1.1) - wp + N.xy * 1.6;',
    '  float near = exp(-dot(away, away) * 1.3);',
    '  vec3 col = shade(mix(vec3(0.74, 0.72, 0.9), foil, mix(0.3, 0.84, near)), body);',
    '  // the gloss of the foil: a highlight that runs over the forms as the light moves',
    '  col += mix(foil, vec3(1.0), 0.6) * pow(near, 5.0) * 0.28 * smoothstep(0.12, 0.5, l);',
    '  // the hall\'s two rim lights on the edge of the bust: cyan from the left, magenta from the right',
    '  float e2 = 18.0 / 1024.0;',
    '  col += vec3(0.0, 0.78, 1.0) * (1.0 - smoothstep(0.03, 0.14, tone(q - vec2(e2, 0.0), 4.0))) * 0.6;',
    '  col += vec3(1.0, 0.0, 0.75) * (1.0 - smoothstep(0.03, 0.14, tone(q + vec2(e2, 0.0), 4.0))) * 0.55;',
    '  // behind the bust: the dark hall, a violet wash, and a field of foil cells that each catch the light in turn',
    '  vec2 bp = (vUv - 0.5) * vec2(uRes.x / uRes.y, 1.0) + uLean * vec2(20.0, -18.0) / uRes.y;',
    '  vec3 hx = fHex(bp * 24.0); float cA = 6.2831853 * fHash(hx.xy); vec2 cd = vec2(cos(cA), sin(cA));',
    '  float cU = dot(cd, L.xy) + dot(cd, V.xy);',
    '  float wash = exp(-dot(bp * vec2(1.0, 0.9) + vec2(0.0, 0.06), bp * vec2(1.0, 0.9) + vec2(0.0, 0.06)) * 3.2);',
    '  float lit = pow(0.5 + 0.5 * cos(6.2831853 * (cU * 0.9 + fHash(hx.xy + 3.1))), 4.0);',
    '  vec3 back = vec3(0.039, 0.024, 0.098) + vec3(0.3, 0.15, 0.95) * wash * 0.42;',
    '  back += fPal(cU * 1.2 + fHash(hx.xy + 7.7)) * (0.03 + 0.24 * lit) * smoothstep(0.03, 0.09, hx.z) * (0.25 + 0.75 * wash);',
    '  gl_FragColor = vec4(mix(back, col, bust), 1.0);',
    '}'
  ].join('\n');

  function compile(type, src) {
    var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
  }
  function build() {
    var vs = compile(gl.VERTEX_SHADER, VERT), fs = compile(gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) return false;
    var prog = gl.createProgram(); gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);   // one triangle over the whole picture
    var at = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(at); gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    uni = { res: gl.getUniformLocation(prog, 'uRes'), light: gl.getUniformLocation(prog, 'uLight'), lean: gl.getUniformLocation(prog, 'uLean') };
    // the portrait, redrawn at a power of two so it can carry mipmaps: the blurred levels are the relief
    var sq = document.createElement('canvas'); sq.width = sq.height = 1024;
    sq.getContext('2d').drawImage(img, 0, 0, 1024, 1024);
    tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, sq);
    gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return true;
  }

  function num(el, name) { var v = parseFloat(el.style.getPropertyValue(name)); return isFinite(v) ? v : 0; }
  function draw() {
    queued = false;
    if (!gl || gl.isContextLost() || !foil || !seen) return;
    var w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return;
    var k = Math.min(window.devicePixelRatio || 1, 2), W = Math.round(w * k), H = Math.round(h * k);
    if (canvas.width !== W || canvas.height !== H) { canvas.width = W; canvas.height = H; }
    gl.viewport(0, 0, W, H);
    // the light is the pointer or the phone's tilt, pushed on by the scroll, as on the stock around it
    var sc = num(hero, '--sc'), cs = getComputedStyle(hero);
    var lx = parseFloat(cs.getPropertyValue('--lean-x')), ly = parseFloat(cs.getPropertyValue('--lean-y'));
    gl.uniform2f(uni.res, w, h);
    gl.uniform2f(uni.light, num(hero, '--lx') + sc * 1.4 - 0.5, num(hero, '--ly') + sc * 0.9 - 0.3);
    gl.uniform2f(uni.lean, isFinite(lx) ? lx : 0, isFinite(ly) ? ly : 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    if (!shown) { shown = true; canvas.classList.add('is-on'); }
  }
  function ask() { if (!queued && gl) { queued = true; requestAnimationFrame(draw); } }

  function start() {
    if (canvas || !readLook()) return;
    canvas = document.createElement('canvas');
    var opts = { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' };
    try { gl = canvas.getContext('webgl', opts) || canvas.getContext('experimental-webgl', opts); } catch (err) { gl = null; }
    if (!gl) { canvas = null; return; }   // no WebGL: the stylesheet's picture stays
    img = new Image();
    img.onload = function () {
      if (!build()) { gl = null; return; }
      art.appendChild(canvas);
      // the picture is lost with the context (a sleeping tab, a busy GPU): the stylesheet's shows again until it is back
      canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); shown = false; canvas.classList.remove('is-on'); });
      canvas.addEventListener('webglcontextrestored', function () { if (build()) ask(); });
      new MutationObserver(ask).observe(hero, { attributes: true, attributeFilter: ['style'] });
      if (window.ResizeObserver) new ResizeObserver(ask).observe(art); else addEventListener('resize', ask);
      // off the screen nothing is drawn; the picture is brought up to date when the card comes back
      if (window.IntersectionObserver) new IntersectionObserver(function (es) { seen = es[es.length - 1].isIntersecting; if (seen) ask(); }).observe(art);
      ask();
    };
    img.src = 'img/portrait.webp';
  }

  function idle() { if (window.requestIdleCallback) requestIdleCallback(start, { timeout: 1500 }); else setTimeout(start, 200); }
  if (document.readyState === 'complete') idle(); else addEventListener('load', idle);
  document.addEventListener('theme:change', function () { if (canvas) { readLook(); ask(); } else idle(); });
})();
