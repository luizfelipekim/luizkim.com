/* AI case study teaser on the homepage: a fortune ball that answers the questions
   designers ask about shipping from prototypes. Press, hold and shake it (or drag,
   or shake the phone); it flips to its window and the printed answer clears through
   the ink. Needs js/three.min.js (r128) loaded first. All artwork is drawn on canvas.
   The ball follows the theme through --look, which each theme stylesheet sets on <html>:
   default (charcoal) is a gloss black ball in a dark grey studio, which it mirrors; foil (esports) a lacquer
   ball in a dark arcade, with the eye and the window redrawn as lit displays under the lacquer;
   manual (brutalist) a matte black ball under one hard shadow;
   press (broadsheet) an ink ball with newsprint decals, lit by the page it stands on; win95 a flat ball drawn
   through a 32-colour palette with an ordered dither, at half the resolution. One fixed light rig, driven per
   look; the studio, the arcade and the page each add a set of their own: a floor with a pool of light or of
   shadow on it, and in the two dark rooms a second rim. */
(function () {
  'use strict';
  var stage = document.querySelector('.ball');
  if (!stage) return;
  var view = stage.querySelector('.ball__view'), canvas = stage.querySelector('.ball__canvas');
  var hasGL = (function () { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  if (typeof THREE === 'undefined' || !hasGL) { stage.classList.add('is-flat'); return; }

  function start() {

  var QA = [
    ["You hand off straight from AI?", "Yes. Five tickets were built straight from the prototype."],
    ["Same team, what actually changed?", "Handoffs per designer: 0.8 to 1.8 a week. Same four people."],
    ["So you skipped Figma entirely?", "No. Figma rebuild: 5 hours to one click. Polish runs alongside."],
    ["Doesn't AI output look generic?", "Not on real components. It is wired to our design system."]
  ];
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

  // one fixed rig (ambient, key, rim, rim from above); each look sets colours and intensities, never the set
  // (three looks bring a set of their own besides: SETS)
  var ambient = new THREE.AmbientLight(0xffffff, 0.08); scene.add(ambient);
  var key = new THREE.DirectionalLight(0xffffff, 0.5); key.position.set(-0.5, 5, 2.5); scene.add(key);
  var rim = new THREE.DirectionalLight(0x8fa68e, 0.22); rim.position.set(3, -0.5, -2.5); scene.add(rim);
  var rimTop = new THREE.DirectionalLight(0xe6ece4, 0.9); rimTop.position.set(0, 2.6, -4); scene.add(rimTop);

  // studio environments for the reflections: a dark room with a few softboxes, one set of panels per
  // look that reflects, baked the first time the look is dealt and kept
  var ENVS = {
    // the soft studio the paper decals were drawn under. In the default look they keep it, so the print reads
    // as it always did while the ball itself takes the room below
    softbox: [
      [12, 9, [5, 5, 4.8], [0, 5.5, 2.2]],          // overhead softbox
      [6, 1.4, [0.95, 1.0, 0.95], [0, -3.2, 0.6]],   // table bounce
      [0.6, 5, [0.85, 0.95, 0.85], [6, 0.5, -3]],    // edge line, right
      [14, 1.1, [7, 7.3, 7], [0, 3.6, -5.5]]         // rim strip, top
    ],
    // the default look's studio (the claw's atelier, js/claw-machine.js, laid out for a sphere, as the arcade
    // below is): a softbox overhead, strip lights down the left as in the claw's row, a dimmer strip on the
    // shade side, and strips behind that wrap the edge. Neutral, a shade warmer in front than behind.
    studio: [
      [22, 16, [0.05, 0.05, 0.05], [0, -1, 11], 'soft'],   // behind the viewer: a dim wash with no edge
      [7, 4.5, [5.2, 5.0, 4.6], [-4.5, 8.5, -0.5]],        // softbox, overhead, left
      [0.8, 10, [8, 7.8, 7.3], [-10.5, 0.5, 2]],           // strip lights, left
      [0.8, 10, [4.5, 4.4, 4.1], [-10, 0.5, -3]],
      [0.6, 9, [3.6, 3.5, 3.3], [10.5, 0, 1]],             // a strip right, dimmer: the shade side
      [16, 1.2, [2.6, 2.8, 3.2], [0, 7, -9.5]],            // strip behind, high: the edge on the top
      [1.4, 10, [2.2, 2.35, 2.7], [-7.5, 0, -9]],          // behind left: the cool rim
      [1.4, 10, [1.5, 1.44, 1.3], [7.5, 0, -9]],           // behind right: the warm rim, dimmer
      [9, 9, [0.9, 0.9, 0.95], [0, -6.5, -1], 'soft']      // the pool of light on the floor, seen from above it
    ],
    // Broadsheet's room: the page is the light. Paper lies under the ball and bounces up into it, a window stands
    // in front and a skylight behind, one lamp hangs over it (the hard top light) and a pale wall stands behind
    // (the soft edge). The ink ball is matte, so it keeps only the broad shapes of these. Only the ball takes
    // this room; the lamp and the wall are here, not in the rig, so the printed decals are not lit by them.
    pressroom: [
      [26, 26, [1.5, 1.45, 1.32], [0, -7, 0], 'soft'],     // the page under the ball
      [6, 8, [5.2, 5.0, 4.5], [7, 4, 8]],                  // window, front right
      [9, 2, [4.2, 4.0, 3.6], [-4.5, 8.5, -8.5]],          // skylight, back left, high
      [3, 3, [16, 15.4, 14], [2.2, 8.7, 4.4], 1],          // the lamp, above and a little right
      [4, 10, [2.4, 2.3, 2.1], [-8, 1, -7]]                // the pale wall, behind left
    ],
    // the arcade the foil ball stands in (the claw's hall, js/claw-machine.js, laid out for a sphere). A sphere
    // mirrors every direction: the middle of its face shows what is behind the viewer, a ring halfway out shows
    // the walls, floor and ceiling, and the last sliver before the edge shows what is behind the ball. So the
    // room is dark behind the viewer, where the eye and the answer sit, the screens and cans stand to the
    // sides and above, and the tubes run behind the ball, where they wrap its edge as a rim.
    arcade: [
      [22, 16, [0.07, 0.045, 0.16], [0, -1, 11], 'soft'],  // behind the viewer: a dim violet wash with no edge, so the face is never plain black
      [2.4, 2.4, [11, 10.5, 12], [-6, 8, 2.5], 1],         // ceiling can, front left: the hard highlight
      [2.0, 2.0, [9, 9.5, 10.5], [5.5, 8.5, -3], 1],       // ceiling can, back right
      [3.0, 2.2, [0.2, 4.6, 5.4], [-10.5, 1.2, 2.5]],      // screens of the machines along the left wall,
      [3.0, 0.42, [3.4, 2.2, 0.4], [-10.5, 2.85, 2.5]],    // each under the strip of its marquee
      [3.0, 2.2, [5.6, 0.4, 3.8], [-10.5, 0.2, -2]],
      [3.0, 0.42, [0.2, 2.6, 3.2], [-10.5, 1.85, -2]],
      [3.0, 2.2, [5.2, 3.0, 0.5], [10.5, -0.2, 3]],        // and along the right
      [3.0, 0.42, [3.4, 0.3, 2.4], [10.5, 1.45, 3]],
      [3.0, 2.2, [0.5, 1.2, 5.8], [10.5, 0.9, -1.5]],
      [3.0, 0.42, [2.4, 1.6, 4.2], [10.5, 2.55, -1.5]],
      [13, 0.45, [0.25, 4.6, 5.4], [-9, -5.5, 0.5]],       // floor tube, left, cyan
      [10, 0.45, [5.4, 0.35, 3.8], [9, -4.4, -2.5]],       // floor tube, right and further back, magenta
      [16, 0.35, [3.8, 1.2, 6.2], [0, 7, -10]],            // ceiling tube, back, violet: the edge on the top
      [0.9, 9, [0.2, 6, 8], [-7.5, 0, -9]],                // tube, back left, cyan: the left rim
      [0.9, 9, [8, 0.3, 5.5], [7.5, 0, -9]],               // tube, back right, magenta: the right rim
      [5, 10, [0.03, 0.5, 0.7], [-5, 0, -10.5]],           // a wash behind each tube gives the rim some body
      [5, 10, [0.5, 0.02, 0.32], [5, 0, -10.5]],
      [9, 9, [0.75, 0.55, 1.5], [0, -6.5, -1], 'soft']     // the pool of light on the floor, seen from above it
    ]
  };
  for (var bulb = 0; bulb < 9; bulb++) ENVS.arcade.push([0.5, 0.5, [12, 8.5, 2.5], [10, 5, -4.4 + bulb * 1.1], 1]);   // a marquee's row of bulbs, gold
  var ENV_ROOM = { arcade: { dark: [0.012, 0.008, 0.03], blur: 0.02 }, studio: { dark: [0.02, 0.02, 0.023], blur: 0.03 }, pressroom: { dark: [0.09, 0.087, 0.08] } };   // how dark the room itself is, and how sharp its sources stay
  // white in the middle, black at the edge: the alpha of anything that fades out round, from `hold` of the way
  // out; `knee` puts a grey stop on the way, for a wash of ink that thins slowly
  function radialFade(hold, knee) {
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var x = c.getContext('2d'), fade = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    fade.addColorStop(0, '#fff'); fade.addColorStop(hold, '#fff'); if (knee) fade.addColorStop(knee, '#666'); fade.addColorStop(1, '#000');
    x.fillStyle = fade; x.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }
  function bakeEnv(panels, dark, blur) {
    var room = new THREE.Scene();
    dark = dark || [0.035, 0.035, 0.035];
    room.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(dark[0], dark[1], dark[2]), side: THREE.BackSide })));
    panels.forEach(function (pn) {
      var geo = pn[4] ? new THREE.CircleGeometry(pn[0] / 2, 40) : new THREE.PlaneGeometry(pn[0], pn[1]);   // a fifth entry makes the source round: a can, a bulb; 'soft' also fades it to its edge: a pool of light
      var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: new THREE.Color(pn[2][0], pn[2][1], pn[2][2]), side: THREE.DoubleSide }));
      if (pn[4]) m.scale.y = pn[1] / pn[0];
      if (pn[4] === 'soft') {   // by vertex colour, full at the centre and the room's dark at the rim: the bake cannot blend
        var n = geo.attributes.position.count, tint = new Float32Array(n * 3);
        for (var v = 0; v < n * 3; v++) tint[v] = v < 3 ? 1 : dark[v % 3] / pn[2][v % 3];
        geo.setAttribute('color', new THREE.BufferAttribute(tint, 3)); m.material.vertexColors = true;
      }
      m.position.set(pn[3][0], pn[3][1], pn[3][2]); m.lookAt(0, 0, 0); room.add(m);
    });
    var pm = new THREE.PMREMGenerator(renderer); pm.compileEquirectangularShader();
    var rt = pm.fromScene(room, blur == null ? 0.04 : blur); pm.dispose(); return rt.texture;
  }
  var envs = {};

  var R = 1.3;
  var ball = new THREE.Group(); scene.add(ball);   // position = drift + shake
  var body = new THREE.Group(); ball.add(body);    // rotation = roll tilt + flip
  // the finishes, one mesh: gloss (the clearcoat black), matte (the manual), ink (the newspaper), flat (the 32-colour desktop), lacquer (the arcade)
  var gloss = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.0275, 0.0275, 0.0275), roughness: 0.12, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 0.9 });
  var matte = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.95, metalness: 0 });
  var ink = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.78, metalness: 0, envMapIntensity: 0.22 });   // still matte, with just enough sheen to take the page's bounce and a top light
  var flat = new THREE.MeshLambertMaterial({ color: 0x040404 });   // reads as black through the palette; only the very top of the key catches a few grey blocks
  // the arcade's finish: black lacquer under a hard clear coat, sharp enough to mirror the room's screens and tubes
  var lacquer = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(0.02, 0.016, 0.035), roughness: 0.05, metalness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.6 });
  // the mirrored room turns a few degrees with the visitor's pointer (three r128 has no rotation for an
  // environment, so the reflection vector is turned in the shader), and the reflections slide over the ball
  var roomTurn = { value: new THREE.Matrix3() }, roomTurn4 = new THREE.Matrix4(), roomEuler = new THREE.Euler();
  function turnsWithRoom(m) {
    m.onBeforeCompile = function (sh) {
      sh.uniforms.roomTurn = roomTurn;
      sh.fragmentShader = 'uniform mat3 roomTurn;\n' + sh.fragmentShader.replace('#include <envmap_physical_pars_fragment>',
        THREE.ShaderChunk.envmap_physical_pars_fragment.replace('reflectVec = inverseTransformDirection( reflectVec, viewMatrix );', 'reflectVec = roomTurn * inverseTransformDirection( reflectVec, viewMatrix );'));
    };
    return m;
  }
  turnsWithRoom(lacquer); turnsWithRoom(gloss);
  var sphere = new THREE.Mesh(new THREE.SphereGeometry(R, 96, 64), gloss);
  body.add(sphere);

  /* ---------- canvas decals: eye on the front, window on the back ---------- */
  function makeTex(size) { var c = document.createElement('canvas'); c.width = c.height = size; var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return { c: c, ctx: c.getContext('2d'), t: t }; }
  var eye = makeTex(512), win = makeTex(512);
  function capMesh(phiCenter, tex, glow) {
    var span = 1.05;
    var g = new THREE.SphereGeometry(R + 0.004, 48, 48, phiCenter - span / 2, span, Math.PI / 2 - span / 2, span);
    var m = new THREE.MeshStandardMaterial({ map: tex, transparent: true, roughness: 0.55, metalness: 0, depthWrite: false, toneMapped: false });   // print is print: a look's tone curve is for the ball, not for the paper on it
    if (glow) { m.emissive = new THREE.Color(0xffffff); m.emissiveMap = tex; m.emissiveIntensity = glow; }
    return new THREE.Mesh(g, m);
  }
  var eyeCap = capMesh(Math.PI / 2, eye.t, 0.6); body.add(eyeCap);
  var winCap = capMesh(3 * Math.PI / 2, win.t); body.add(winCap);
  var eyeMat = eyeCap.material, winMat = winCap.material;
  // in the arcade both decals are displays under the lacquer: drawn in light on black and added over the
  // ball, so the room's reflections run across them unbroken, and kept off the tone curve so the neon stays pure
  function display(tex) { return new THREE.MeshBasicMaterial({ map: tex, transparent: true, blending: THREE.AdditiveBlending, premultipliedAlpha: true, depthWrite: false, toneMapped: false }); }
  var eyeLit = display(eye.t), winLit = display(win.t);

  // ground shadow: soft (a blob), pool (a blob of the look's ink), hard (one cast edge), or hatched (cut in ink)
  var shadowC = document.createElement('canvas'); shadowC.width = shadowC.height = 256;
  var shadowT = new THREE.CanvasTexture(shadowC);
  var shadow = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.2), new THREE.MeshBasicMaterial({ map: shadowT, transparent: true, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = -R - 0.35; scene.add(shadow);
  function drawShadow(kind, ink) {
    var x = shadowC.getContext('2d'); x.globalAlpha = 1; x.clearRect(0, 0, 256, 256);   // a hard shadow leaves the alpha at half; start each look clean
    if (kind === 'soft') {
      var g = x.createRadialGradient(128, 128, 10, 128, 128, 128); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    } else if (kind === 'pool') {
      var gp = x.createRadialGradient(128, 128, 0, 128, 128, 128); gp.addColorStop(0, 'rgba(0,0,0,0.7)'); gp.addColorStop(0.45, 'rgba(0,0,0,0.5)'); gp.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gp; x.fillRect(0, 0, 256, 256);
      x.globalCompositeOperation = 'source-in'; x.fillStyle = ink; x.fillRect(0, 0, 256, 256); x.globalCompositeOperation = 'source-over';
    } else if (kind === 'hard') {
      x.fillStyle = ink; x.globalAlpha = 0.5; x.beginPath(); x.arc(128, 128, 104, 0, Math.PI * 2); x.fill();
    } else {
      x.save(); x.beginPath(); x.arc(128, 128, 106, 0, Math.PI * 2); x.clip();
      x.strokeStyle = ink; x.globalAlpha = 0.6; x.lineWidth = 1.5;
      for (var d = -256; d < 512; d += 6) { x.beginPath(); x.moveTo(d, 0); x.lineTo(d + 256, 256); x.stroke(); }
      x.restore();
    }
    shadowT.needsUpdate = true;
  }

  // What a look stands in, besides the rig: a floor that fades out round, and any lights of its own, spots as
  // [colour, power, from, to, angle, softness] and rims as [colour, power, from]. The claw's stages (js/claw-machine.js), at the ball's size.
  // A floor is a dark gloss disc for a pool of light, or, on paper, a flat wash of ink for a pool of shadow.
  // Each set is built the first time its look is dealt.
  var SETS = {
    // a dark hall: a spot from behind pools on the floor, and a cyan rim pairs with the rig's magenta one
    arcade: { floor: { color: 0x0d0822, rough: 0.35, metal: 0.4, env: 0.6, hold: 0.4, deep: 2.6, wide: 3.4 },
              spots: [[0xc9b8ff, 1.3, [0, 7, -5], [0, -R - 0.35, -0.6], 0.6, 0.9]], rims: [[0x00c8ff, 0.9, [-3, 0.5, -2.5]]] },
    // a dark grey studio: the same pool, neutral; a cool rim from the left pairs with the rig's warm one
    studio: { floor: { color: 0x343434, rough: 0.45, metal: 0.3, env: 0.4, hold: 0.12, deep: 2.6, wide: 3.2 },
              spots: [[0xdfe8ff, 0.3, [0, 7, -5], [0, -R - 0.35, -0.6], 0.8, 0.9]], rims: [[0xdfe8ff, 0.6, [-3, 0.5, -2.5]]] },
    // paper and ink: the page is the light, so the ball gets a pool of shadow to stand in, a little to the left of
    // it and behind. Its top light and its soft edge are in its room (ENVS.pressroom), which only the ball takes
    paper: { floor: { color: 0x1a1715, wash: 0.4, deep: 2.4, wide: 2.6, at: [-0.5, -0.2] }, spots: [], rims: [] }
  };
  var sets = {}, set = null;   // built, and the one in use
  function buildSet(name) {
    var sp = SETS[name], f = sp.floor, g = new THREE.Group();
    var fm = f.wash
      ? new THREE.MeshBasicMaterial({ color: f.color, transparent: true, opacity: f.wash, alphaMap: radialFade(0.5, 0.72), depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: f.color, roughness: f.rough, metalness: f.metal, envMapIntensity: f.env, transparent: true, alphaMap: radialFade(f.hold), depthWrite: false });
    var floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64), fm);
    floor.rotation.x = -Math.PI / 2; floor.position.y = -R - 0.352; floor.renderOrder = -1;
    g.add(floor); g.floor = floor; g.fade = f.wash || 1;
    sp.spots.forEach(function (p) { var l = new THREE.SpotLight(p[0], p[1], 30, p[4], p[5], 1); l.position.fromArray(p[2]); l.target.position.fromArray(p[3]); g.add(l); g.add(l.target); });
    sp.rims.forEach(function (r) { var l = new THREE.DirectionalLight(r[0], r[1]); l.position.fromArray(r[2]); g.add(l); });
    scene.add(g); sets[name] = g;
  }

  /* ---------- the looks ----------
     Keyed by --look. Finish and environment for the ball (own: only the ball takes the room, the decals stay
     flat print; print: the decals take this room instead), the set it stands in, the rig's colours and
     intensities, the shadow's kind, and the colours and type of the two decals: paper and ink for the eye;
     face, text, ink, ring, cover and swirl for the window. tone: a filmic curve on the ball and floor;
     turns: the mirrored room follows the pointer. */
  var LOOKS = {
    default: { mat: 'gloss', env: 'studio', print: 'softbox', set: 'studio', tone: true, turns: true, ambient: [0xffffff, 0.08], key: [0xffffff, 0.5], rim: [0xfff0e0, 0.4], rimTop: [0xdfe8ff, 0.5], shadow: 'soft',
      paper: '#f1f1ef', ink: '#1c1c1c', face: '#1f2420', text: '#f1f1ef', ink2: '#111412', ring: 'rgba(143,166,142,0.35)', cover: 'rgba(14,18,16,', swirl: 'rgba(96,118,96,',
      font: '500 30px "Hanken Grotesk","Helvetica Neue",Arial,sans-serif' },
    // neon: the decals are drawn in light (drawEyeNeon, drawWindowNeon), so of the decal colours only the answer's text and type are read
    foil: { mat: 'lacquer', env: 'arcade', set: 'arcade', tone: true, turns: true, neon: true, ambient: [0x8f7bff, 0.05], key: [0xf2f0ff, 0], rim: [0xff00c0, 0.9], rimTop: [0xc9b8ff, 0.4], shadow: 'soft',
      ink: '#120a2c', text: '#f4f1ff', font: '600 30px "Figtree",system-ui,sans-serif' },
    win95: { mat: 'flat', env: null, ambient: [0xffffff, 0.35], key: [0xffffff, 0.9], rim: [0xffffff, 0], rimTop: [0xffffff, 0.5], shadow: 'hard', pixel: true,
      paper: '#ffffff', ink: '#000000', face: '#000080', text: '#ffffff', ink2: '#000000', ring: 'rgba(255,255,255,0.6)', cover: 'rgba(0,0,0,', swirl: 'rgba(0,128,128,',
      font: '900 38px "Arial Black","Helvetica Neue",Arial,sans-serif' },   // heavy strokes survive the 4 px blocks; the pixel face does not
    manual: { mat: 'matte', body: 0x141414, env: null, ambient: [0xffffff, 0.3], key: [0xffffff, 0.95], rim: [0xffffff, 0], rimTop: [0xffffff, 0.25], shadow: 'hard',
      paper: '#efede7', ink: '#0c0c0c', face: '#efede7', text: '#0c0c0c', ink2: '#0c0c0c', ring: 'rgba(12,12,12,0.6)', cover: 'rgba(12,12,12,', swirl: 'rgba(196,22,28,',
      font: '500 26px "IBM Plex Mono",ui-monospace,Menlo,monospace' },
    press: { mat: 'ink', env: 'pressroom', own: true, set: 'paper', ambient: [0xffffff, 0.3], key: [0xffffff, 0.95], rim: [0xffffff, 0], rimTop: [0xffffff, 0.25], shadow: 'pool',
      paper: '#faf8f4', ink: '#1a1715', face: '#faf8f4', text: '#1a1715', ink2: '#1a1715', ring: 'rgba(26,23,21,0.6)', cover: 'rgba(26,23,21,', swirl: 'rgba(26,23,21,',
      font: '400 30px "Source Serif 4",Georgia,"Times New Roman",serif' }
  };
  LOOKS.manual = LOOKS.default;   // Brutalist shows the default look's ball
  function look() { return getComputedStyle(document.documentElement).getPropertyValue('--look').trim() || 'default'; }
  var pal = LOOKS.default, current = null;
  function setL(l, v) { l.color.setHex(v[0]); l.intensity = v[1]; }
  function applyLook() {
    var l = look(); if (l === current) return; current = l;
    pal = LOOKS[l] || LOOKS.default;
    var room = ENV_ROOM[pal.env] || {};
    var e = pal.env ? (envs[pal.env] || (envs[pal.env] = bakeEnv(ENVS[pal.env], room.dark, room.blur))) : null;
    scene.environment = pal.own ? null : e; gloss.envMap = e; gloss.needsUpdate = true;
    ink.envMap = pal.own ? e : null; ink.needsUpdate = true;
    eyeMat.envMap = winMat.envMap = pal.print ? (envs[pal.print] || (envs[pal.print] = bakeEnv(ENVS[pal.print]))) : null;
    if (pal.body) matte.color.setHex(pal.body);
    sphere.material = pal.mat === 'gloss' ? gloss : pal.mat === 'lacquer' ? lacquer : pal.mat === 'ink' ? ink : pal.mat === 'flat' ? flat : matte;
    // a filmic curve where the ball mirrors a room, so the sources roll off instead of clipping. In the arcade
    // also the stage's own colour behind the ball (the glow is added over it, which a see-through canvas cannot carry)
    var tone = pal.tone ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    if (renderer.toneMapping !== tone) { renderer.toneMapping = tone; shadow.material.needsUpdate = true; }
    var hall = getComputedStyle(stage).backgroundColor;
    if (pal.neon) renderer.setClearColor(new THREE.Color().setStyle(hall && hall.indexOf('rgba(0, 0, 0, 0)') < 0 ? hall : '#0a0619'), 1); else renderer.setClearColor(0x000000, 0);
    if (pal.set && !sets[pal.set]) buildSet(pal.set);
    for (var name in sets) sets[name].visible = name === pal.set;
    set = pal.set ? sets[pal.set] : null;
    if (pal.neon && !bloom) buildBloom();
    eyeCap.material = pal.neon ? eyeLit : eyeMat; winCap.material = pal.neon ? winLit : winMat;
    // under the palette both decals light themselves, so their white and black reach it as white and black
    var wm = winMat, em = eyeMat;
    if (pal.pixel) { wm.color.setHex(0x000000); wm.emissive.setHex(0xffffff); wm.emissiveMap = win.t; wm.emissiveIntensity = 1; em.color.setHex(0x000000); em.emissiveIntensity = 1; }
    else { wm.color.setHex(0xffffff); wm.emissive.setHex(0x000000); wm.emissiveMap = null; wm.emissiveIntensity = 1; em.color.setHex(0xffffff); em.emissiveIntensity = 0.6; }
    wm.needsUpdate = em.needsUpdate = true;
    setL(ambient, pal.ambient); setL(key, pal.key); setL(rim, pal.rim); setL(rimTop, pal.rimTop);
    drawShadow(pal.shadow, pal.ink);
    if (fit.ready) fit();
  }
  document.addEventListener('theme:change', applyLook);

  /* ---------- the 32-colour desktop ----------
     Under win95 the scene goes through the shared palette pass (js/pixel-pass.js), the same one the claw
     and the poker peek use: drawn at half the size, snapped to 32 colours after an ordered dither. */
  var pixelPass = THREE.PixelPass ? new THREE.PixelPass(renderer) : null;

  /* ---------- the glow ----------
     In the arcade the lit drawings bloom, as the claw's tubes do (js/claw-machine.js): the scene is drawn once
     more at half size with the ball black, so only the displays carry light, the Unreal bloom pass blurs
     that, and a last pass adds it over the normal frame. Needs js/postprocessing.js; without it the
     drawings still light themselves, only without the halo. */
  var bloom = null, winGlow = 0;
  function buildBloom() {
    if (!THREE.EffectComposer || !THREE.UnrealBloomPass) return;
    var glow = new THREE.EffectComposer(renderer);
    glow.renderToScreen = false;
    glow.addPass(new THREE.RenderPass(scene, camera));
    glow.addPass(new THREE.UnrealBloomPass(renderer.getDrawingBufferSize(new THREE.Vector2()), 1.25, 0.3, 0.0));
    var mix = new THREE.ShaderPass(new THREE.ShaderMaterial({
      uniforms: { baseTexture: { value: null }, bloomTexture: { value: glow.renderTarget2.texture } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(baseTexture, vUv) + max(texture2D(bloomTexture, vUv) - 0.012, 0.0); }'   // the faint far end of the blur is cut, or it would lift the whole box off the stage's colour
    }), 'baseTexture');
    mix.needsSwap = true;
    var base = new THREE.EffectComposer(renderer);
    base.addPass(new THREE.RenderPass(scene, camera));
    base.addPass(mix);
    // the frame is written to the targets in sRGB, as the renderer would write it to the screen
    [glow, base].forEach(function (c) { c.renderTarget1.texture.encoding = THREE.sRGBEncoding; c.renderTarget2.texture.encoding = THREE.sRGBEncoding; });
    glow.setPixelRatio(renderer.getPixelRatio() / 2);
    bloom = { base: base, glow: glow, dark: new THREE.MeshBasicMaterial({ color: 0x000000 }), clear: new THREE.Color() };
  }
  function render() {
    if (pal.pixel && pixelPass) { pixelPass.render(scene, camera); return; }
    if (!pal.neon || !bloom) { renderer.render(scene, camera); return; }
    // the glow pass: the ball goes black and still hides whichever display is behind it; the floor and shadow step out
    var lit = sphere.material; sphere.material = bloom.dark; set.floor.visible = false; shadow.visible = false;
    winLit.color.setScalar(winGlow);
    renderer.getClearColor(bloom.clear); renderer.setClearColor(0x000000, 1);
    bloom.glow.render();
    renderer.setClearColor(bloom.clear, 1);
    sphere.material = lit; set.floor.visible = true; shadow.visible = true; winLit.color.setScalar(1);
    bloom.base.render();
  }

  /* ---------- eye drawing (line art) ---------- */
  var pupil = { x: 0, y: 0 }, pupilT = { x: 0, y: 0 }, nextBlink = 2.5;
  // Under the palette one block covers some twenty texels of this drawing, so the eye is cut as a pixel
  // sprite instead: a heavy almond lid, a solid iris with a white glint, no hairlines.
  function drawEyeBold(open) {
    var ctx = eye.ctx, S = 512, cx = 256, cy = 256;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = pal.paper; ctx.beginPath(); ctx.arc(cx, cy, 214, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink; ctx.lineCap = 'square'; ctx.lineJoin = 'miter';
    var w = 168, h = Math.max(8, 84 * open);
    function lid() { ctx.beginPath(); ctx.moveTo(cx - w, cy); ctx.quadraticCurveTo(cx, cy - h * 2, cx + w, cy); ctx.quadraticCurveTo(cx, cy + h * 2, cx - w, cy); ctx.closePath(); }
    ctx.save(); lid(); ctx.clip();
    var ix = cx + pupil.x * 30, iy = cy + pupil.y * 14;
    ctx.beginPath(); ctx.arc(ix, iy, 78, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.paper; ctx.fillRect(ix - 40, iy - 44, 30, 30);
    ctx.restore();
    ctx.lineWidth = 30; lid(); ctx.stroke();
    eye.t.needsUpdate = true;
  }
  // In the arcade the same eye is redrawn in light: the lids are one neon line that runs cyan to magenta, as the
  // rims on the ball do; the iris is a lens (a limbal ring, a broken ring that turns, fibres, a lit pupil
  // edge); the lashes are the ticks of a gauge; and a fine scale stands where the paper disc ended.
  var NEON = { cyan: '#00c8ff', violet: '#8a5cff', magenta: '#ff00c0', white: '#f4f1ff' }, irisTurn = 0;
  function sweep(ctx, x0, x1) { var g = ctx.createLinearGradient(x0, 0, x1, 0); g.addColorStop(0, NEON.cyan); g.addColorStop(0.5, NEON.violet); g.addColorStop(1, NEON.magenta); return g; }
  function scale(ctx, cx, cy, r) {
    ctx.lineCap = 'butt';
    for (var i = 0; i < 72; i++) { var a = i / 72 * Math.PI * 2, big = i % 6 === 0;
      ctx.strokeStyle = big ? 'rgba(183,162,255,0.85)' : 'rgba(138,92,255,0.5)'; ctx.lineWidth = big ? 2.5 : 1.5;
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * (big ? r - 12 : r - 7), cy + Math.sin(a) * (big ? r - 12 : r - 7)); ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); ctx.stroke(); }
  }
  function drawEyeNeon(open) {
    var ctx = eye.ctx, S = 512, cx = 256, cy = 256, i, a;
    ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
    scale(ctx, cx, cy, 214);
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var w = 184, h = 92 * open, line = sweep(ctx, cx - w, cx + w);
    function lid() { ctx.beginPath(); ctx.moveTo(cx - w, cy); ctx.quadraticCurveTo(cx, cy - h * 2, cx + w, cy); ctx.quadraticCurveTo(cx, cy + h * 2, cx - w, cy); ctx.closePath(); }
    ctx.save(); lid(); ctx.clip();
    var ix = cx + pupil.x * 38, iy = cy + pupil.y * 17;
    var glass = ctx.createRadialGradient(ix, iy, 60, ix, iy, 210); glass.addColorStop(0, 'rgba(90,43,255,0.22)'); glass.addColorStop(1, 'rgba(90,43,255,0.02)');
    ctx.fillStyle = glass; ctx.fillRect(0, 0, S, S);
    var iris = ctx.createRadialGradient(ix, iy, 26, ix, iy, 72); iris.addColorStop(0, 'rgba(255,0,192,0.46)'); iris.addColorStop(0.6, 'rgba(110,60,255,0.32)'); iris.addColorStop(1, 'rgba(0,200,255,0.12)');
    ctx.fillStyle = iris; ctx.beginPath(); ctx.arc(ix, iy, 72, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,190,240,0.9)'; ctx.lineWidth = 1.5; ctx.lineCap = 'butt';
    for (i = 0; i < 48; i++) { a = i / 48 * Math.PI * 2; var r0 = 34 + (i % 2) * 7; ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0); ctx.lineTo(ix + Math.cos(a) * 50, iy + Math.sin(a) * 50); ctx.stroke(); }
    var turn = irisTurn + pupil.x * 0.9;
    ctx.strokeStyle = '#d9ceff'; ctx.lineWidth = 3.5;
    for (i = 0; i < 3; i++) { a = turn + i * Math.PI * 2 / 3; ctx.beginPath(); ctx.arc(ix, iy, 60, a, a + 1.5); ctx.stroke(); }
    ctx.strokeStyle = NEON.cyan; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ix, iy, 72, 0, Math.PI * 2); ctx.stroke();
    // the pupil is an aperture: six blades, and it turns with the ring
    ctx.beginPath(); for (i = 0; i < 6; i++) { a = -turn * 0.5 + i * Math.PI / 3; ctx.lineTo(ix + Math.cos(a) * 27, iy + Math.sin(a) * 27); } ctx.closePath();
    ctx.fillStyle = '#000'; ctx.fill(); ctx.strokeStyle = '#ff7ae0'; ctx.lineWidth = 3; ctx.lineJoin = 'miter'; ctx.stroke();
    ctx.fillStyle = NEON.white; ctx.beginPath(); ctx.arc(ix - 9, iy - 9, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = line;
    ctx.globalAlpha = 0.28; ctx.lineWidth = 16; lid(); ctx.stroke();
    ctx.globalAlpha = 1; ctx.lineWidth = 5; lid(); ctx.stroke();
    ctx.lineWidth = 4;
    for (var j = 0; j < 7; j++) { var t = (j + 1) / 8, px = cx - w + t * 2 * w, py = cy - 2 * h * t * (1 - t) * 2 - 14, dx = (t - 0.5) * 0.8;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + dx * 20, py - 20 * open); ctx.stroke(); }
    ctx.lineWidth = 3;
    for (var k = 0; k < 5; k++) { var a2 = Math.PI / 2 + (k - 2) * 0.24; ctx.beginPath(); ctx.moveTo(cx + Math.cos(a2) * (h + 40), cy + Math.sin(a2) * (h + 40)); ctx.lineTo(cx + Math.cos(a2) * (h + 56), cy + Math.sin(a2) * (h + 56)); ctx.stroke(); }
    eye.t.needsUpdate = true;
  }
  function drawEye(open) {
    if (pal.pixel) return drawEyeBold(open);
    if (pal.neon) return drawEyeNeon(open);
    var ctx = eye.ctx, S = 512, cx = 256, cy = 256;
    ctx.clearRect(0, 0, S, S);
    ctx.fillStyle = pal.paper; ctx.beginPath(); ctx.arc(cx, cy, 214, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = pal.ink; ctx.fillStyle = pal.ink; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    var w = 140, h = 72 * open;
    function lid() { ctx.beginPath(); ctx.moveTo(cx - w, cy); ctx.quadraticCurveTo(cx, cy - h * 2, cx + w, cy); ctx.quadraticCurveTo(cx, cy + h * 2, cx - w, cy); ctx.closePath(); }
    ctx.save(); lid(); ctx.clip();
    var ix = cx + pupil.x * 28, iy = cy + pupil.y * 14;
    ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(ix, iy, 52, 0, Math.PI * 2); ctx.stroke();
    ctx.lineWidth = 2.5;
    for (var i = 0; i < 24; i++) { var a = i / 24 * Math.PI * 2, r0 = 30 + (i % 2) * 7; ctx.beginPath(); ctx.moveTo(ix + Math.cos(a) * r0, iy + Math.sin(a) * r0); ctx.lineTo(ix + Math.cos(a) * 48, iy + Math.sin(a) * 48); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(ix, iy, 22, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = pal.paper; ctx.beginPath(); ctx.arc(ix - 8, iy - 8, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = pal.ink; ctx.lineWidth = 5; lid(); ctx.stroke();
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
  // In the arcade the window is a display: nothing is hidden under ink, the answer is switched on. While it
  // is off, arcs of plasma turn in the glass; they thin out as the readout comes up inside its ring.
  function drawWindowNeon() {
    var ctx = win.ctx, S = 512, cx = 256, cy = 256, up = 1 - cover;
    ctx.globalAlpha = 1; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, S, S);
    scale(ctx, cx, cy, 214);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 198, 0, Math.PI * 2); ctx.clip();
    var sc = 0.86 + 0.14 * up, ay = cy + 40 * (1 - up);
    ctx.save(); ctx.translate(cx, ay); ctx.scale(sc, sc); ctx.globalAlpha = up;
    var face = ctx.createRadialGradient(0, -40, 20, 0, 0, 172); face.addColorStop(0, '#34207e'); face.addColorStop(1, '#1d1247');
    ctx.fillStyle = face; ctx.beginPath(); ctx.arc(0, 0, 172, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = sweep(ctx, -172, 172); ctx.lineCap = 'round';
    ctx.globalAlpha = 0.28 * up; ctx.lineWidth = 14; ctx.beginPath(); ctx.arc(0, 0, 172, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = up; ctx.lineWidth = 4; ctx.beginPath(); ctx.arc(0, 0, 172, 0, Math.PI * 2); ctx.stroke();
    // the iris's broken ring again, inside the rim: it turns into place as the readout comes up
    ctx.strokeStyle = 'rgba(217,206,255,0.4)'; ctx.lineWidth = 2; ctx.lineCap = 'butt';
    for (var s = 0; s < 3; s++) { var a0 = (1 - up) * 2.4 - 0.75 + s * Math.PI * 2 / 3; ctx.beginPath(); ctx.arc(0, 0, 159, a0, a0 + 1.5); ctx.stroke(); }
    ctx.fillStyle = pal.text; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = pal.font;
    var lines = wrapText(ctx, answer, 280), lh = 36, y0 = -(lines.length - 1) * lh / 2;
    lines.forEach(function (l, i) { ctx.fillText(l, 0, y0 + i * lh); });
    ctx.restore();
    var hues = ['0,200,255', '255,0,192', '138,92,255'];
    for (var i = 0; i < 9; i++) {
      var a = inkPhase * (0.6 + i * 0.07) + i * 0.7, r = 60 + i * 17, alpha = Math.min(1, 0.3 + 0.7 * swirl) * cover;
      ctx.strokeStyle = 'rgba(' + hues[i % 3] + ',' + alpha.toFixed(3) + ')'; ctx.lineWidth = 3 + (i % 3) * 4;
      ctx.beginPath(); ctx.arc(cx + Math.sin(a * 0.5) * 20, cy + Math.cos(a * 0.4) * 20, r, a, a + 1.6 + swirl); ctx.stroke();
    }
    ctx.restore();
    win.t.needsUpdate = true;
  }
  function drawWindow() {
    if (pal.neon) return drawWindowNeon();
    var ctx = win.ctx, S = 512, cx = 256, cy = 256;
    var faceCol = pal.face, textCol = pal.text, inkCol = pal.ink2;
    ctx.clearRect(0, 0, S, S);
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, 214, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = inkCol; ctx.fillRect(0, 0, S, S);
    var up = 1 - cover, sc = 0.86 + 0.14 * up, ay = cy + 40 * (1 - up);
    ctx.save(); ctx.translate(cx, ay); ctx.scale(sc, sc);
    ctx.fillStyle = faceCol; ctx.beginPath(); ctx.arc(0, 0, 170, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = pal.ring; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 170, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = textCol; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = pal.font;
    var lines = wrapText(ctx, answer, 280), lh = 36, y0 = -(lines.length - 1) * lh / 2;
    lines.forEach(function (l, i) { ctx.fillText(l, 0, y0 + i * lh); });
    ctx.restore();
    ctx.fillStyle = pal.cover + (cover * 0.97).toFixed(3) + ')'; ctx.fillRect(0, 0, S, S);
    for (var i = 0; i < 9; i++) {
      var a = inkPhase * (0.6 + i * 0.07) + i * 0.7, r = 60 + i * 17, alpha = (0.12 + 0.25 * swirl) * cover;
      ctx.strokeStyle = pal.swirl + alpha.toFixed(3) + ')'; ctx.lineWidth = 14 + (i % 3) * 6;
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
    countEl.textContent = (i + 1) + ' / ' + QA.length; }
  // an answer is written (in the window and in the caption) only while both are hidden: at the start, and when the
  // ball has turned back and refilled. Written with its question, it could be read under the one before
  function setAnswer(i) { answer = QA[i][1]; aEl.textContent = answer; }
  setQuestion(0); setAnswer(0); qEl.classList.remove('is-out'); qEl.textContent = QA[0][0];

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

  // the hint is a tooltip: up until the first touch, then only on hover or focus while idle (CSS reads .is-seen)
  function seen() { stage.classList.add('is-seen'); }
  view.addEventListener('pointerdown', seen, { once: true });
  view.addEventListener('keydown', seen, { once: true });

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
  var motionOn = false, motionOff = false;   // off: refused or not there in this visit, so the button does not come back
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
      var fail = function () { motionOff = true; btnMotion.hidden = true; hint.textContent = 'Motion is off here. Drag the ball to shake it'; };
      if (typeof DeviceMotionEvent.requestPermission === 'function') DeviceMotionEvent.requestPermission().then(function (s) { if (s === 'granted') start(); else fail(); }).catch(fail);
      else start();
    });
  }

  /* ---------- animation ---------- */
  function ease(t) { return 1 - Math.pow(1 - t, 3); }
  var baseZ = 6.4, baseY = 0.15, zoomZ = 6.4, zoom = 0, TARGET_PX = 16, FONT_TEX = 30;
  var HINT_BAND = 56;   // px kept under the ball for the tooltip
  function fit() { var w = view.clientWidth, h = view.clientHeight; if (!w || !h) return; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    fit.ready = true;
    if (pixelPass) pixelPass.setSize(w, h);
    if (bloom) { bloom.base.setSize(w, h); bloom.glow.setSize(w, h); }
    // the ball fills its box: as large as fits above the tooltip's band (with room for its drift), centred in
    // what is left. Distance and height are solved from the box, so the ball is a circle of a known size at any shape.
    var tanH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    var room = Math.max(80, h - HINT_BAND);
    var D = Math.min(room * 0.9, w * 0.84);            // the ball's diameter on screen, px
    baseZ = (2 * R * h) / (D * 2 * tanH);
    baseY = (room / 2 + 2 - h / 2) * (2 * baseZ * tanH / h);   // a camera below the ball's centre lifts it into the room
    var fontWorld = FONT_TEX * (R * 1.05 / 512);
    // the answer is read at 16 px; under the palette it comes a little closer so each letter keeps enough blocks
    var dist = fontWorld * h / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * (pal.pixel ? TARGET_PX * 1.4 : TARGET_PX));
    zoomZ = Math.min(baseZ, R + dist);
    camera.position.z = baseZ + (zoomZ - baseZ) * zoom;
    // a set's floor is an ellipse cut to what the camera sees of it: its near edge ends just inside the
    // bottom of the box and its sides inside the box's sides, so the fade is never clipped at any shape
    for (var name in sets) { var fl = sets[name].floor, f = SETS[name].floor, at = f.at || [0, 0], near = baseZ - (baseY - fl.position.y) / tanH;
      fl.position.x = at[0]; fl.position.z = near - f.deep * 1.04 + at[1];
      fl.scale.set(Math.min(f.wide, (tanH * (w / h) * (baseZ - fl.position.z) - Math.abs(at[0])) * 0.96), f.deep, 1); } }
  applyLook(); fit(); window.addEventListener('resize', fit);
  // the view is a flexible box: it changes size when the buttons under it come and go, when fonts land, or when a
  // theme changes its padding. Fitting only on window resize left the canvas stretched over a stale aspect (an oval).
  if ('ResizeObserver' in window) new ResizeObserver(function () { fit(); }).observe(view);

  // only animate while the ball is on screen
  var visible = true;
  if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { es.forEach(function (e) { visible = e.isIntersecting; }); }, { threshold: 0.05 }).observe(view);

  var lastFrame = performance.now(), onScreen = new THREE.Vector3();
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
    // the tooltip sits under the ball and points up at it; the ball drifts on its spiral, so it follows the
    // ball's centre across and its lowest point down
    if (hint) {
      onScreen.set(ball.position.x, ball.position.y - R, 0).project(camera);
      var half = hint.offsetWidth / 2 + 8, vw = view.clientWidth;   // kept inside the box, wherever the ball drifts
      hint.style.left = Math.min(vw - half, Math.max(half, (onScreen.x + 1) / 2 * vw)).toFixed(1) + 'px';
      hint.style.top = ((1 - onScreen.y) / 2 * view.clientHeight + 14).toFixed(1) + 'px';
    }
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
      if (flipT >= 0.9) { state = 'idle'; flip = 0; cover = 1; energy = 0; swirl = 0; setAnswer(idx); hint.classList.remove('is-off'); btnReveal.hidden = false; if (isTouch && typeof DeviceMotionEvent !== 'undefined' && !motionOn && !motionOff) btnMotion.hidden = false; } }
    else { swirl += ((held ? energy : 0) - swirl) * 0.1; }
    body.rotation.y = flip;
    inkPhase += dt * (0.3 + swirl * 4);
    irisTurn += dt * swirl * 5;   // the lens ring spins up with the shake, and rests when the hand does

    var zt = (state === 'clear' || state === 'shown') ? 1 : 0;
    zoom = reduce ? zt : zoom + (zt - zoom) * Math.min(1, dt * 2.6);
    var ez = zoom * zoom * (3 - 2 * zoom);
    camera.position.z = baseZ + (zoomZ - baseZ) * ez;
    camera.position.x = ball.position.x * ez;
    camera.position.y = baseY * (1 - ez) + ball.position.y * ez;
    if (set) set.floor.material.opacity = set.fade * (1 - ez);   // the camera closes in on the answer and leaves the floor behind

    if (!isTouch || held) { pupil.x += (pupilT.x - pupil.x) * 0.1; pupil.y += (pupilT.y - pupil.y) * 0.1; }
    else { pupil.x += ((dx * 4) - pupil.x) * 0.05; pupil.y += ((dy * 4) - pupil.y) * 0.05; }
    nextBlink -= dt; var open = 1;
    if (nextBlink < 0) { var b = -nextBlink; open = b < 0.08 ? 1 - b / 0.08 : b < 0.16 ? (b - 0.08) / 0.08 : 1; if (b > 0.16) nextBlink = 2.5 + Math.random() * 4; }
    if (held && state === 'idle') open = Math.min(open, 1 - energy * 0.85);
    if (state === 'flip') open = 0;
    drawEye(open); drawWindow();
    if (pal.neon) winGlow = cover;   // the plasma blooms while it hides the answer; the printed answer itself never does
    if (pal.turns) { roomTurn4.makeRotationFromEuler(roomEuler.set(pupil.y * 0.07, pupil.x * 0.12, 0)); roomTurn.value.setFromMatrix4(roomTurn4); }
    render();
  }
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawWindow);
  requestAnimationFrame(frame);
  }

  // Build the scene only when its stage is within three quarters of a screen, so a visitor who never
  // scrolls here pays nothing, and the shaders compile one scroll ahead of the viewer rather than at load.
  var begun = false;
  function begin() { if (begun) return; begun = true; start(); }
  if ('IntersectionObserver' in window) {
    var approach = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { approach.disconnect(); begin(); } }, { rootMargin: '75% 0px' });
    approach.observe(view);
  } else begin();
})();
