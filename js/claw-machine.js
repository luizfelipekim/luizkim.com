/* Design-system case study teaser on the homepage: a claw machine filled with the
   system's foundational components (toggle, pill, checkbox, radio, button, text input).
   Drag the glass or hold the pad to steer, press Drop, and each catch lights up a live
   component in the tray. Needs js/three.min.js (r128) loaded first.
   A look can ask for the machine as an engraved plate (by setting --claw-plate on .claw; no look does today): the
   cabinet goes to ink and paper, and on browsers with WebGPU the frame is piped through the 2D shader
   library's Engraving effect (js/shaders.js) onto a second canvas over the first. */
(function () {
  'use strict';
  var root = document.querySelector('.claw');
  if (!root) return;
  // the 2D shader library sits next to this file; import() in a classic script resolves against this script's URL
  var LIB = document.currentScript && document.currentScript.src ? new URL('shaders.js', document.currentScript.src).href : './shaders.js';
  var stage = root.querySelector('.claw__stage'), canvas = root.querySelector('.claw__canvas');
  var hasGL = (function () { try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  if (typeof THREE === 'undefined' || !hasGL) { root.classList.add('is-flat'); return; }

  function start() {

  var S = {
    W: 6, D: 5, H: 6.2,
    topY: 5.2, grabY: 1.05, gantryY: 6.2,
    boundX: 2.5, boundZ: 2.0,
    speed: 3.2,
    chute: { x: -2.1, z: 1.7, size: 1.3 },
    grabRadius: 1.25, sureRadius: 0.75   // a prize within sureRadius of the claw is always caught; out to grabRadius the odds fall, never below 45%
  };
  var LABELS = { toggle: 'Toggle', pill: 'Pill', checkbox: 'Checkbox', radio: 'Radio', button: 'Button', input: 'Text input' };
  var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var statusEl = root.querySelector('.claw__status'), dropBtn = root.querySelector('[data-claw-drop]'),
      refillBtn = root.querySelector('[data-claw-refill]');
  function setStatus(html) { if (statusEl) statusEl.innerHTML = html; }

  /* ---------- renderer / scene ---------- */
  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  // the stage colour is whatever the page paints behind the machine; read it, never assume it
  function stageColor() { var c = getComputedStyle(root).backgroundColor; return (c && c.indexOf('rgba(0, 0, 0, 0)') < 0) ? c : '#1c1c1c'; /* fallback */ }
  renderer.setClearColor(new THREE.Color().setStyle(stageColor()), 1);
  // relative luminance of the stage behind the machine: dark looks keep the glass almost clear, light looks tint it
  function stageLuminance() {
    var c = new THREE.Color().setStyle(stageColor());
    return [c.r, c.g, c.b].reduce(function (sum, v, i) { v = v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); return sum + v * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  var tintGlass = function () {};
  document.addEventListener('theme:change', function () { renderer.setClearColor(new THREE.Color().setStyle(stageColor()), 1); tintGlass(); resize(); });
  renderer.outputEncoding = THREE.sRGBEncoding;
  // a filmic curve so lit whites roll off instead of clipping flat; shadows so the prizes and claw sit on something
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;   // the plain PCF map honours shadow.radius, so the edges can be blurred

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  var camTarget = new THREE.Vector3(0, 2.05, 0);
  var camDir = new THREE.Vector3(0.38, 0.4, 1).normalize();   // a three-quarter view, so the perspective has faces to work on

  // a soft studio: the key is high and only a little to the side so the frame's shadows fall short, the
  // hemisphere and fill carry the rest, and the shadow edge is blurred rather than cut
  var hemi = new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.5); scene.add(hemi);
  var key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(2, 10, 3); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6;
  key.shadow.camera.left = key.shadow.camera.bottom = -4.5; key.shadow.camera.right = key.shadow.camera.top = 4.5;
  key.shadow.camera.near = 2; key.shadow.camera.far = 25;
  key.shadow.bias = -0.0008; key.shadow.normalBias = 0.03;
  var fill = new THREE.DirectionalLight(0xffffff, 0.4); fill.position.set(-6, 3, 6); scene.add(fill);
  // the arcade (a look asks with spots: true): a dark hall where light comes in pools, not evenly. One spot on
  // the marquee, one from behind that pools on the floor and edges the tops, two coloured rims from the back
  // corners, and a gloss floor that fades into the dark so the cabinet stands on something. No extra shadow maps.
  var arcade = null, arcadeFollow = null;
  function buildArcade() {
    var g = new THREE.Group();
    function spot(color, power, from, to, angle, soft) {
      var l = new THREE.SpotLight(color, power, 30, angle, soft, 1);
      l.position.set(from[0], from[1], from[2]); l.target.position.set(to[0], to[1], to[2]); g.add(l); g.add(l.target); return l;
    }
    spot(0xfff2ff, 0.75, [1.5, 14, 6], [0, 8.1, 2.6], 0.26, 0.8);    // the crown; the sticker under it lights itself and stays out of the beam's centre
    spot(0xc9b8ff, 1.3, [0, 12, -7], [0, -1.4, -2.5], 0.6, 0.9);    // behind: the floor pool, and an edge on the tops
    arcadeFollow = new THREE.SpotLight(0xf2f6ff, 1.6, 30, 0.13, 0.6, 1);   // a follow spot on the claw: the hard highlight on the chrome, and a little light on what it carries
    arcadeFollow.position.set(-1.2, 10.5, 6.5); arcadeFollow.target = clawGroup; g.add(arcadeFollow);
    var rimA = new THREE.DirectionalLight(0x00c8ff, 0.9); rimA.position.set(-7, 4, -6); g.add(rimA);
    var rimB = new THREE.DirectionalLight(0xff00c0, 0.9); rimB.position.set(8, 4, -5); g.add(rimB);
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var x = c.getContext('2d'), fade = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    fade.addColorStop(0, '#fff'); fade.addColorStop(0.45, '#fff'); fade.addColorStop(1, '#000');
    x.fillStyle = fade; x.fillRect(0, 0, 256, 256);
    var floor = new THREE.Mesh(new THREE.CircleGeometry(11, 48), new THREE.MeshStandardMaterial({ color: 0x0d0822, roughness: 0.35, metalness: 0.4, envMapIntensity: 0.6, transparent: true, alphaMap: new THREE.CanvasTexture(c), depthWrite: false }));
    floor.rotation.x = -Math.PI / 2; floor.position.y = -1.41; floor.receiveShadow = true; floor.renderOrder = -1;
    g.add(floor);
    scene.add(g); arcade = g;
  }
  // What the arcade is to the foil look, for the looks that wear the art deco kit: the same method in each look's
  // own palette. Spots as [colour, power, from, to, angle, softness]; rims as [colour, power, from]; lamps are the
  // kit's own lights (sconces, marquee) as [finish key, power, at, reach]; the floor is a disc that fades out with a
  // radial alpha, either a gloss surface for a pool of light or, on paper, a flat wash of ink for a pool of shadow.
  var STAGES = {
    // a dark grey studio: neutral light, a shade warmer from the front than from behind
    studio: {
      spots: [[0xfff4e6, 0.9, [2.5, 15, 7], [0, 7.6, 2.8], 0.3, 0.8],      // the crown
              [0xdfe8ff, 0.48, [0, 13, -8], [0, -1.4, -2.6], 0.62, 0.9]],   // behind: the floor pool, and an edge on the tops
      follow: [0xffffff, 1.3, [-1.2, 10.5, 6.5], 0.13, 0.6],
      rims: [[0xdfe8ff, 0.8, [-7, 4, -6]], [0xfff0e0, 0.55, [8, 4, -5]]],
      lamps: [['lamp', 0.9, [-3.3, 4.0, 3.7], 4], ['lamp', 0.9, [3.3, 4.0, 3.7], 4], ['lamp', 0.5, [0, 6.2, 3.9], 5]],
      floor: { color: 0x101010, rough: 0.45, metal: 0.3, env: 0.4, at: [0, 0] }
    },
    // paper and ink: the page is the light, so the cabinet gets a pool of shadow to stand in and a hard top light
    paper: {
      spots: [[0xfff6e8, 0.7, [2.5, 15, 7], [0, 7.6, 2.8], 0.3, 0.8],
              [0xfff6e8, 0.9, [0, 13, -8], [0, 3, -2.6], 0.5, 0.9]],
      follow: [0xfffaf0, 0.9, [-1.2, 10.5, 6.5], 0.13, 0.6],
      rims: [[0xfff6e8, 0.6, [-7, 5, -6]]],
      lamps: [['lamp', 0.45, [-3.3, 4.0, 3.9], 5], ['lamp', 0.45, [3.3, 4.0, 3.9], 5], ['lamp', 0.35, [0, 6.2, 3.9], 5]],
      floor: { color: 0x1a1715, wash: 0.55, at: [-1.0, -0.8] }
    }
  };
  var stages = {}, stageLamps = [];
  function buildStage(name) {
    var sp = STAGES[name], g = new THREE.Group();
    sp.spots.forEach(function (s) {
      var l = new THREE.SpotLight(s[0], s[1], 30, s[4], s[5], 1);
      l.position.fromArray(s[2]); l.target.position.fromArray(s[3]); g.add(l); g.add(l.target);
    });
    var follow = new THREE.SpotLight(sp.follow[0], sp.follow[1], 30, sp.follow[3], sp.follow[4], 1);   // on the claw, as in the arcade
    follow.position.fromArray(sp.follow[2]); follow.target = clawGroup; g.add(follow);
    sp.rims.forEach(function (r) { var l = new THREE.DirectionalLight(r[0], r[1]); l.position.fromArray(r[2]); g.add(l); });
    sp.lamps.forEach(function (p) { var l = new THREE.PointLight(0xffffff, p[1], p[3], 2); l.position.fromArray(p[2]); l.userData.key = p[0]; g.add(l); stageLamps.push(l); });
    var c = document.createElement('canvas'); c.width = c.height = 256;
    var x = c.getContext('2d'), fade = x.createRadialGradient(128, 128, 0, 128, 128, 128);
    if (sp.floor.wash) { fade.addColorStop(0, '#fff'); fade.addColorStop(0.5, '#fff'); fade.addColorStop(0.72, '#666'); fade.addColorStop(1, '#000'); }
    else { fade.addColorStop(0, '#fff'); fade.addColorStop(0.45, '#fff'); fade.addColorStop(1, '#000'); }
    x.fillStyle = fade; x.fillRect(0, 0, 256, 256);
    var fm = sp.floor.wash
      ? new THREE.MeshBasicMaterial({ color: sp.floor.color, transparent: true, opacity: sp.floor.wash, alphaMap: new THREE.CanvasTexture(c), depthWrite: false })
      : new THREE.MeshStandardMaterial({ color: sp.floor.color, roughness: sp.floor.rough, metalness: sp.floor.metal, envMapIntensity: sp.floor.env, transparent: true, alphaMap: new THREE.CanvasTexture(c), depthWrite: false });
    var floor = new THREE.Mesh(new THREE.CircleGeometry(sp.floor.wash ? 9 : 11, 48), fm);
    floor.rotation.x = -Math.PI / 2; floor.position.set(sp.floor.at[0], -1.41, sp.floor.at[1]); floor.receiveShadow = !sp.floor.wash; floor.renderOrder = -1;
    g.add(floor);
    scene.add(g); stages[name] = g;
  }
  // everything solid casts and receives; the glass and the lines are left out
  function shadowed(obj) { obj.traverse(function (o) { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } }); return obj; }

  // the rooms the cabinet reflects: a dark room with a few bright sources, one set of panels per look that has
  // its own light, baked the first time a look asks for it and kept. The fortune ball (js/fortune-ball.js)
  // bakes its own rooms the same way, placed for a sphere.
  var ENVS = {
    default: [
      [12, 9, [5, 5, 4.8], [0, 5.5, 2.2]],          // overhead softbox
      [6, 1.4, [0.95, 1.0, 0.95], [0, -3.2, 0.6]],   // table bounce
      [0.6, 5, [0.85, 0.95, 0.85], [6, 0.5, -3]],    // edge line, right
      [14, 1.1, [7, 7.3, 7], [0, 3.6, -5.5]]         // rim strip, top
    ],
    foil: [
      [12, 9, [4.2, 3.6, 6.2], [0, 5.5, 2.2]],       // overhead, violet
      [6, 1.4, [1.3, 0.7, 1.2], [0, -3.2, 0.6]],     // table bounce, rose
      [0.6, 5, [0.5, 1.5, 1.7], [6, 0.5, -3]],       // edge line, cyan
      [14, 1.1, [7, 3.8, 7.2], [0, 3.6, -5.5]]       // rim strip, rose
    ],
    // the claw's own room under the foil look: a dark arcade. Other machines' screens, tube runs at the floor and
    // ceiling, two ceiling cans. A gloss face mirrors one part of the room each: the fronts see front-left and low,
    // the right sides see back-right and low, the tops see back-left and high, so the light is placed there.
    arcade: [
      [11, 5, [0.26, 0.18, 0.52], [-3, -3.5, 9]],    // front, low: a violet wash, so a front face is never plain black
      [1.7, 1.25, [0.2, 4.6, 5.4], [-6.5, -1.2, 7.5]],   // screens of the machines across the aisle
      [1.7, 1.25, [5.6, 0.4, 3.8], [-3.6, -2.4, 9]],
      [1.7, 1.25, [5.2, 3.0, 0.5], [-0.6, -1.4, 9.5]],
      [1.7, 1.25, [0.5, 1.2, 5.8], [2.6, -2.6, 9]],
      [13, 0.28, [0.3, 5.5, 6.5], [-2, -5.2, 8]],    // floor tube, front, cyan
      [9, 4, [0.85, 0.3, 0.75], [7, -3.5, -8]],      // back right, low: a rose wash for the right sides
      [1.7, 1.25, [5.8, 0.5, 4.2], [8.5, -1.5, -5.5]],
      [1.7, 1.25, [0.3, 4.2, 5.2], [5.5, -2.5, -9]],
      [11, 0.28, [6.5, 0.4, 4.6], [8, -5, -6]],      // floor tube, right, rose
      [2.2, 2.2, [11, 10.5, 12], [-3.5, 8.5, -6]],   // ceiling can, back left: the hard highlight on the tops
      [1.8, 1.8, [9, 9.5, 10.5], [2.5, 9.5, 3]],     // ceiling can, over the marquee
      [12, 0.3, [3.8, 1.2, 6.2], [-5, 6.5, -9]],     // ceiling tube, back, violet
      [0.5, 6, [0.4, 3.2, 3.8], [-9.5, 1, -2]],      // an edge line, left, cyan
      [0.5, 6, [4.2, 0.4, 3.0], [9.5, 1.5, 2]]       // an edge line, right, rose
    ],
    // the default look's own room: a dark photo studio set for chrome. Tall strip lights stand in a row low in front,
    // where the fluted bands look, so each flute picks up light, dark, light; a softbox back-left and high for the
    // tops; the right sides see only a dim wall, and that keeps them the shade side.
    atelier: [
      [0.8, 9, [9, 9, 9.6], [-9, -2.5, 7]],          // strip lights, front, low
      [0.8, 9, [6, 6, 6.4], [-4.2, -3.5, 9.8]],
      [0.8, 9, [9, 9, 9.6], [1.2, -3.5, 10.5]],
      [0.8, 9, [4, 4, 4.3], [6.5, -3, 8.6]],
      [12, 2.5, [0.3, 0.3, 0.33], [-3, -8, 6.5]],    // the floor in front, a dim bounce
      [9, 1.6, [3.4, 3.4, 3.7], [-4.5, 8.5, -8.5]],  // a strip back left, high: an edge of light along the tops
      [8, 5, [0.5, 0.5, 0.55], [-5, 5, -9]],         // and a dim wash under it, so a top face is never plain black
      [6, 6, [0.36, 0.36, 0.4], [8, -3.5, -7.5]],    // back right, low: the right sides, kept dim
      [0.5, 9, [6, 6, 6.5], [10.5, 0, -2]],          // an edge line, right
      [0.5, 9, [4, 4, 4.4], [-10.5, 1, -3]],         // an edge line, left
      [5, 3, [2.2, 2.2, 2.4], [1, 10.5, 3]]          // overhead softbox
    ],
    // Broadsheet's room: paper and ink. A grey room lit by two windows the colour of the page, with black cards
    // stood in it: polished metal only reads against white when it is darker than the page and has ink to mirror.
    pressroom: [
      [5, 7, [5.2, 5.0, 4.5], [-6.5, 3, 8.5]],       // window, front left
      [1.0, 9, [6.5, 6.3, 5.7], [-1.5, -3.5, 10.5]], // a slot of light low in front: the bright line in each flute
      [1.0, 9, [4.5, 4.3, 3.9], [4.2, -3.5, 9.8]],
      [1.4, 9, [0.005, 0.005, 0.005], [-4.6, -3.5, 9.8]],   // black cards between them: the ink line in each flute
      [1.4, 9, [0.005, 0.005, 0.005], [1.4, -3.5, 10.4]],
      [12, 3, [0.22, 0.21, 0.19], [-3, -8.5, 6]],    // the floor in front: paper, in shade
      [9, 1.8, [4.2, 4.0, 3.6], [-4.5, 8.5, -8.5]],  // skylight, back left, high: an edge of light along the tops
      [8, 5, [0.9, 0.86, 0.78], [-5, 5, -9]],        // and a wash under it
      [7, 7, [0.3, 0.29, 0.26], [8, -3.5, -7.5]],    // back right, low: the right sides stay the shade side
      [0.6, 9, [4.5, 4.3, 3.9], [10.5, 0, -1]],      // an edge line, right
      [5, 3, [2.6, 2.5, 2.3], [1, 10.5, 3]]          // overhead
    ]
  };
  var ENV_DARK = { arcade: [0.012, 0.008, 0.03], atelier: [0.02, 0.02, 0.023], pressroom: [0.09, 0.087, 0.08] };   // how dark the room itself is; the studio default is a neutral 0.035
  function bakeEnv(panels, dark) {
    var room = new THREE.Scene();
    dark = dark || [0.035, 0.035, 0.035];
    room.add(new THREE.Mesh(new THREE.BoxGeometry(24, 24, 24), new THREE.MeshBasicMaterial({ color: new THREE.Color(dark[0], dark[1], dark[2]), side: THREE.BackSide })));
    panels.forEach(function (pn) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(pn[0], pn[1]), new THREE.MeshBasicMaterial({ color: new THREE.Color(pn[2][0], pn[2][1], pn[2][2]), side: THREE.DoubleSide }));
      m.position.set(pn[3][0], pn[3][1], pn[3][2]); m.lookAt(0, 0, 0); room.add(m);
    });
    var pm = new THREE.PMREMGenerator(renderer); pm.compileEquirectangularShader();
    var rt = pm.fromScene(room, 0.04); pm.dispose(); return rt.texture;
  }
  var envs = {};
  function setEnvironment(name) {
    var e = envs[name] || (envs[name] = bakeEnv(ENVS[name] || ENVS.default, ENV_DARK[name]));
    if (scene.environment !== e) scene.environment = e;
  }
  setEnvironment('default');

  var WHITE = new THREE.MeshStandardMaterial({ color: 0xdedbd4, roughness: 0.55 });   // headroom: the tone curve brings it back to white
  var BONE = new THREE.MeshStandardMaterial({ color: 0xb8b4ac, roughness: 0.6 });     // a second tone for the prizes, so the pile has depth
  var TONE3 = new THREE.MeshStandardMaterial({ color: 0xdedbd4, roughness: 0.55 });
  var TONE4 = new THREE.MeshStandardMaterial({ color: 0xb8b4ac, roughness: 0.6 });
  var PRIZE = [WHITE, BONE, TONE3, TONE4];   // dealt round the pile; each look colours the four
  var INK = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.5 });
  var STEEL = new THREE.MeshStandardMaterial({ color: 0xdedbd4, roughness: 0.35, metalness: 0.15 });
  var FLOOR = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.95 });
  var BODY = new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.9 });
  var LINE = new THREE.LineBasicMaterial({ color: 0x4a4a46 });
  /* ---------- finishes ----------
     One neutral cabinet, dressed per look. Each look names the colours of the procedural parts (floor,
     chute, steel, prizes) and of the model's three materials (body, paper, ink), the surface (roughness,
     metalness, how much of the environment shows), the glass, and which ornament set of the model to show.
     Looks are keyed by --look, which each theme stylesheet sets on <html>; they inherit from `default`
     (the bare neutral cabinet) and override what they need. The site's default look is `charcoal`. The plate (engraving pass) is a separate
     flag the theme sets in CSS, so a look can be dressed without being engraved. */
  var FINISH = {
    default:    { floor: 0x262626, hole: 0x0e0e0e, steel: 0xdedbd4, prizes: [0xdedbd4, 0xb8b4ac],
                  body: 0x202020, paper: 0xdedbd4, ink: 0x141414, roughness: 0.8, metalness: 0, env: 0.6, steelEnv: 1, glass: 0.16, ornament: null,
                  floorRough: 0.95, floorMetal: 0, steelRough: 0.35, steelMetal: 0.15, topY: 5.2, room: 'default', rig: [1.1, 0.4, 0.5],   // key, fill, hemisphere
                  neonA: 0x8fe4ff, neonB: 0xff9df0, glow: 0xffffff, gold: 0xffcf3a, lit: 1.6, prizeEnv: 1, prizeRough: 0.55, glassEnv: 1.3,   // the lit parts of an ornament set: two tube colours, bulbs and type, the tier band
                  // the art deco kit's parts: panels (wood, or metal with no grain), polished trim, frosted lamps, the lever's ball
                  wood: 0x1c1e22, woodMap: false, woodRough: 0.34, woodMetal: 0.9, woodEnv: 1.2, woodCoat: 0, trim: 0xf0f1f4, trimRough: 0.14, trimEnv: 1.7,
                  lamp: 0xffcf9a, lampLit: 1.0, knob: 0x8fa68e },   // the ball in the page's sage
    // the default look: the art deco kit in metal. Gunmetal panels, chrome trim, a dark grey studio round it
    charcoal:   { ornament: 'artdeco', room: 'atelier', stage: 'studio', rig: [0.5, 0.2, 0.3], fitW: 4.8, fitH: 6.5, fitY: 3.35, slide: 0.45, topY: 4.35,   // the claw rests lower, clear of the roof
                  body: 0x101010, steel: 0xeef0f4, steelRough: 0.18, steelMetal: 1, steelEnv: 1.8, floor: 0x1e1e1e, inner: 0.1 },
    manual:     { body: 0x2b2a27, paper: 0xe4e1d9, ink: 0x0c0c0c, roughness: 1, env: 0.25, glass: 0.12 },              // unpainted, no sheen
    // the Broadsheet crane (near-black cabinet, paper trim, the deco front) in place of grey chrome, which went
    // grey-on-white in the 95 window; drawn through the 32-colour palette instead of the engraving
    win95:      { floor: 0x4a4540, hole: 0x0a0a0a, body: 0x0a0a0a, paper: 0xdedbd4, ink: 0x0c0c0c,
                  roughness: 0.85, env: 0.2, glass: 0.14, ornament: 'broadsheet', pixel: true },
    // Broadsheet: the same kit as a 1940s cabinet. Walnut under a satin varnish (the grain is a baked image only
    // this look fetches), nickel trim, the lever's ball in the page's one red
    press:      { floor: 0x4a4540, hole: 0x0a0a0a, body: 0x0a0a0a, paper: 0xdedbd4, ink: 0x0c0c0c,
                  roughness: 0.85, env: 0.2, glass: 0.14, ornament: 'artdeco', room: 'pressroom', stage: 'paper', rig: [0.95, 0.3, 0.5],
                  fitW: 4.8, fitH: 6.5, fitY: 3.35, slide: 0.45, topY: 4.35, inner: 0.16,
                  wood: 0x4f3423, woodMap: true, woodRough: 0.42, woodMetal: 0, woodEnv: 0.55, woodCoat: 0.7, trim: 0xd9d5cb, trimRough: 0.16, trimEnv: 1.0,
                  steel: 0xe9e6de, steelRough: 0.2, steelMetal: 1, steelEnv: 1.2, lamp: 0xffc98a, lampLit: 0.7, knob: 0x8b1a1a },
    // the foil pull: the sleeve's near-black indigo, glossy enough to carry the light, and the card's iris
    // (cyan, rose, violet-white) as the only light in the scene: tubes, bulbs, type, and the lights they throw
    foil:       { body: 0x160b44, paper: 0xe8e2ff, ink: 0x12083a, steel: 0xeef1f8, steelRough: 0.16, steelMetal: 1, steelEnv: 2.2,   // the claw and gantry as polished chrome: it shows the room, pushed bright so it never sinks into the dark
                  prizes: [0x5a2bff, 0xff1fb4, 0x00a8ff, 0x9a6bff],   // the iris dealt round the pile, deep enough that the lights do not bleach them
                  floor: 0x1a0f4e, floorRough: 0.25, floorMetal: 0.5, roughness: 0.24, metalness: 0.85, env: 1.1, glass: 0.2,
                  neonA: 0x00c8ff, neonB: 0xff00c0, glow: 0xe8e2ff, ornament: 'foil', lit: 0.6, room: 'arcade', spots: true, bloom: true,   // pure cyan and pink, the minor channel at zero (the sRGB curve lifts any small channel toward white); the tubes skip the tone curve
                  rig: [0.4, 0.15, 0.22], ribs: 18, ribDepth: 0.45, sticker: true, fitW: 4.9, fitH: 6.05, fitY: 3.5, topY: 4.35,   /* the claw rests lower here, clear of the marquee */ prizeEnv: 0.18, prizeRough: 0.35, glassEnv: 0.35, glass: 0.1, inner: 0.5 }   // the studio dims right down: in this look the neon is the light   // the iris, a step deeper so the tubes stay cyan and rose under the tone curve
  };
  // the theme stylesheet names the look on <html> as --look (manual, press, win95, foil); charcoal names none
  function look() { return getComputedStyle(document.documentElement).getPropertyValue('--look').trim() || 'charcoal'; }
  function finish() { var f = Object.assign({}, FINISH.default); Object.assign(f, FINISH[look()] || {}); return f; }
  var plate = '';   // the post pass a look asks for on the overlay: '' (none), 'engraving' or 'glow'
  var shell = new THREE.Group();  // the procedural cabinet: plinth, posts, frame; stands in until the modelled one loads
  var cabinet = null, cabMats = {}, ornaments = {}; // the modelled cabinet (models/claw-cabinet.glb), its body / paper / ink materials, its ornament nodes by name
  function wantsPlate() { return getComputedStyle(root).getPropertyValue('--claw-plate').trim(); }

  /* ---------- cabinet ---------- */
  var HOLE = new THREE.MeshBasicMaterial({ color: 0x0e0e0e });
  (function buildCabinet() {
    var floor = new THREE.Mesh(new THREE.PlaneGeometry(S.W + 0.2, S.D + 0.2), FLOOR);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

    var glassBox = new THREE.BoxGeometry(S.W + 0.2, S.H, S.D + 0.2);
    var edges = new THREE.LineSegments(new THREE.EdgesGeometry(glassBox), LINE);
    edges.position.y = S.H / 2; scene.add(edges);
    // the frame: four corner posts, a top frame with a deeper header over the front, and a lip and skirt on the plinth
    var hw = S.W / 2 + 0.1, hd = S.D / 2 + 0.1;
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(function (c) {
      var post = new THREE.Mesh(new THREE.BoxGeometry(0.14, S.H + 0.1, 0.14), BODY);
      post.position.set(c[0] * hw, S.H / 2, c[1] * hd); shell.add(shadowed(post));
    });
    var topFront = new THREE.Mesh(new THREE.BoxGeometry(S.W + 0.34, 0.26, 0.16), BODY);
    topFront.position.set(0, S.H + 0.02, hd); shell.add(shadowed(topFront));
    var topBack = new THREE.Mesh(new THREE.BoxGeometry(S.W + 0.34, 0.14, 0.14), BODY);
    topBack.position.set(0, S.H + 0.02, -hd); shell.add(shadowed(topBack));
    [-1, 1].forEach(function (sgn) {
      var side = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, S.D + 0.34), BODY);
      side.position.set(sgn * hw, S.H + 0.02, 0); shell.add(shadowed(side));
    });
    var lip = new THREE.Mesh(new THREE.BoxGeometry(S.W + 0.6, 0.1, S.D + 0.6), BODY);
    lip.position.y = -0.05; shell.add(shadowed(lip));
    var skirt = new THREE.Mesh(new THREE.BoxGeometry(S.W + 0.6, 0.12, S.D + 0.6), BODY);
    skirt.position.y = -1.36; shell.add(shadowed(skirt));
    // tinted glass: the inside walls carry the tint (back faces), so the white claw and prizes keep their
    // brightness in front of a darkened interior; the front pane is only a faint sheen. On a light stage the
    // tint is strong enough for the machine to read as a machine, on Charcoal it is barely there.
    var inner = new THREE.Mesh(glassBox, new THREE.MeshBasicMaterial({ color: 0x0b0b0b, transparent: true, opacity: 0.08, side: THREE.BackSide, depthWrite: false }));
    inner.position.y = S.H / 2; scene.add(inner);
    // the pane is glass: a clearcoat over a near-clear surface, so the edges catch the environment at grazing angles
    var GLASS = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.04, metalness: 0, transparent: true, opacity: 0.16, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3, side: THREE.FrontSide, depthWrite: false });
    var pane = new THREE.Mesh(glassBox, GLASS);
    pane.position.y = S.H / 2; pane.renderOrder = 2; scene.add(pane);
    tintGlass = function () {
      var light = stageLuminance() > 0.35;
      plate = wantsPlate();
      var f = finish();
      BODY.color.setHex(f.body); FLOOR.color.setHex(f.floor); HOLE.color.setHex(f.hole); STEEL.color.setHex(f.steel);
      PRIZE.forEach(function (m, i) { m.color.setHex(f.prizes[i % f.prizes.length]); m.envMapIntensity = f.prizeEnv; m.roughness = f.prizeRough; });
      S.topY = f.topY;   // where the claw rests and carries
      STEEL.envMapIntensity = f.steelEnv; STEEL.roughness = f.steelRough; STEEL.metalness = f.steelMetal;
      pixelOn = !!f.pixel;
      FLOOR.roughness = f.floorRough; FLOOR.metalness = f.floorMetal;
      key.intensity = f.rig[0]; fill.intensity = f.rig[1]; hemi.intensity = f.rig[2];
      setEnvironment(f.room);
      if (f.spots && !arcade) buildArcade();
      if (arcade) arcade.visible = !!f.spots;
      if (f.stage && !stages[f.stage]) buildStage(f.stage);
      for (var sn in stages) stages[sn].visible = (sn === f.stage);
      stageLamps.forEach(function (l) { l.color.setHex(f[l.userData.key]); });
      if (f.bloom && !bloom) buildBloom();
      if (bloom) {
        bloom.on = !!f.bloom;
        bloom.lit = [cabMats.neon_a, cabMats.neon_b, cabMats.glow].filter(Boolean);   // the tubes and the bar; the plaque type stays crisp
      }
      if (neon) {
        neon.group.visible = (f.ornament === 'foil');
        neon.lights.forEach(function (l) { l.color.setHex(f[l.userData.key]); });
        neon.halos.forEach(function (h) { h.material.color.setHex(f[h.userData.key]); h.visible = !(f.bloom && bloom); h.material.opacity = 0.6; });   // the bloom replaces the halos where it runs
      }
      inner.material.opacity = plate === 'engraving' ? 0.1 : (f.inner != null ? f.inner : (light ? 0.42 : 0.08));
      GLASS.opacity = f.glass; GLASS.envMapIntensity = f.glassEnv;
      LINE.color.setHex(light ? 0x1c1c1c : 0x4a4a46);
      // the clear colour is not tone mapped; on the plate it is pure white so the engraving leaves it as clean paper
      renderer.setClearColor(plate === 'engraving' ? new THREE.Color(0xffffff) : new THREE.Color().setStyle(stageColor()), 1);
      if (cabinet) {
        [['body', f.body], ['paper', f.paper], ['ink', f.ink]].forEach(function (pair) {
          var m = cabMats[pair[0]];
          m.color.setHex(pair[1]); m.roughness = f.roughness; m.metalness = f.metalness; m.envMapIntensity = f.env;
        });
        // a look can ask for a ribbed surface on the body (the comb of a foil card): one small tiling normal map, fetched the first time it is asked for
        if (f.ribs && !ribTex && THREE.TextureLoader) {
          ribTex = new THREE.TextureLoader().load(ROOT + 'img/claw/foil-rib-normal.png');
          ribTex.wrapS = ribTex.wrapT = THREE.RepeatWrapping; ribTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        }
        var ribbed = f.ribs ? ribTex : null;
        if (cabMats.body.normalMap !== ribbed) { cabMats.body.normalMap = ribbed; cabMats.body.needsUpdate = true; }
        if (ribbed) { ribTex.repeat.set(f.ribs, f.ribs); cabMats.body.normalScale.set(f.ribDepth || 0.6, f.ribDepth || 0.6); }
        if (f.ornament && !ornaments[f.ornament]) loadOrnament(f.ornament);   // each ornament set is a file of its own, fetched the first time a look asks
        for (var name in ornaments) ornaments[name].visible = (name === f.ornament);
        if (f.sticker && !sticker) buildSticker();
        if (sticker) sticker.visible = !!f.sticker;
        // an ornament set's lit parts: black surfaces that emit the look's colours; the tier band is gold metal
        var lit = { neon_a: f.neonA, neon_b: f.neonB, glow: f.glow };
        for (var ln in lit) if (cabMats[ln]) {
          var lm = cabMats[ln];
          lm.color.setHex(0x000000); lm.emissive.setHex(lit[ln]); lm.emissiveIntensity = f.lit; lm.roughness = 0.4;
          // the tone curve pulls a bright saturated colour toward white; the tubes bypass it and stay cyan and pink
          if (lm.toneMapped !== false) { lm.toneMapped = false; lm.needsUpdate = true; }
        }
        // the plaque's type: lit in the same colours, gently, and never bloomed, so it reads as letters
        var type = { type_a: f.neonA, type_b: f.neonB, type_w: 0xf4f1ff };
        for (var tn in type) if (cabMats[tn]) {
          var tm = cabMats[tn];
          tm.color.setHex(0x000000); tm.emissive.setHex(type[tn]); tm.emissiveIntensity = 0.85; tm.roughness = 0.5;
          if (tm.toneMapped !== false) { tm.toneMapped = false; tm.needsUpdate = true; }
        }
        if (cabMats.gold) { cabMats.gold.color.setHex(f.gold); cabMats.gold.metalness = 1; cabMats.gold.roughness = 0.3; cabMats.gold.envMapIntensity = 1.2; }
        if (cabMats.foil_body) {   // the kit's panels: gloss-black lacquer, so every edge and face carries a piece of the room
          var fb = physical('foil_body');
          fb.color.setHex(0x0b0820); fb.roughness = 0.26; fb.envMapIntensity = 1.0; fb.clearcoat = 1; fb.clearcoatRoughness = 0.12;
        }
        if (cabMats.deco_wood) {   // the art deco kit: one shell, its panels in wood or in metal by look
          var dw = physical('deco_wood');   // varnish is a clear coat
          if (f.woodMap && !woodTex && THREE.TextureLoader) {   // the grain, baked in the kit's own UV layout; fetched only by a look that shows wood
            woodTex = new THREE.TextureLoader().load(ROOT + 'img/claw/deco-walnut.webp', function () { woodReady = true; tintGlass(); });
            woodTex.encoding = THREE.sRGBEncoding; woodTex.flipY = false; woodTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
          }
          var grain = (f.woodMap && woodReady) ? woodTex : null;   // until the image is here, and if it never comes, the wood is its flat colour
          if (dw.map !== grain) { dw.map = grain; dw.needsUpdate = true; }
          dw.color.setHex(grain ? 0xffffff : f.wood); dw.roughness = f.woodRough; dw.metalness = f.woodMetal; dw.envMapIntensity = f.woodEnv;
          dw.clearcoat = f.woodCoat; dw.clearcoatRoughness = 0.2;
          var dt = cabMats.deco_trim; dt.color.setHex(f.trim); dt.metalness = 1; dt.roughness = f.trimRough; dt.envMapIntensity = f.trimEnv;
          var dl = cabMats.deco_lamp;   // frosted glass, lit from inside
          dl.color.setHex(0x6b665c); dl.emissive.setHex(f.lamp); dl.emissiveIntensity = f.lampLit; dl.roughness = 0.6; dl.metalness = 0;
          cabMats.deco_dark.color.setHex(0x0b0b0b); cabMats.deco_dark.roughness = 0.45; cabMats.deco_dark.metalness = 0; cabMats.deco_dark.envMapIntensity = 0.6;
          var dk = cabMats.deco_knob; dk.color.setHex(f.knob); dk.roughness = 0.25; dk.metalness = 0; dk.envMapIntensity = 0.9;
        }
      }
      setPlate(plate);
    };

    scene.add(shell);
    var body = new THREE.Mesh(new THREE.BoxGeometry(S.W + 0.4, 1.4, S.D + 0.4), BODY);
    body.position.y = -0.7; shell.add(shadowed(body));
    var bodyEdges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(S.W + 0.4, 1.4, S.D + 0.4)), LINE);
    bodyEdges.position.y = -0.7; scene.add(bodyEdges);

    var door = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(1.5, 0.9)), LINE);
    door.position.set(S.chute.x, -0.6, S.D / 2 + 0.201); scene.add(door);

    var hole = new THREE.Mesh(new THREE.PlaneGeometry(S.chute.size, S.chute.size), HOLE);
    hole.rotation.x = -Math.PI / 2; hole.position.set(S.chute.x, 0.004, S.chute.z); scene.add(hole);
    var holeEdge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.PlaneGeometry(S.chute.size, S.chute.size)), new THREE.LineBasicMaterial({ color: 0xf1f1ef }));
    holeEdge.rotation.x = -Math.PI / 2; holeEdge.position.set(S.chute.x, 0.006, S.chute.z); scene.add(holeEdge);

    [-1, 1].forEach(function (s) {
      var rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, S.D + 0.2), STEEL);
      rail.position.set(s * (S.W / 2 + 0.06), S.gantryY, 0); scene.add(shadowed(rail));
    });
  })();

  var crossbar = new THREE.Mesh(new THREE.BoxGeometry(S.W + 0.2, 0.06, 0.06), STEEL);
  crossbar.position.y = S.gantryY; scene.add(shadowed(crossbar));
  var carriage = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.22, 0.42), STEEL);
  scene.add(shadowed(carriage));
  var cable = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 12), STEEL);
  scene.add(cable);

  /* ---------- claw ---------- */
  var clawGroup = new THREE.Group();
  scene.add(clawGroup);
  // enough segments that a highlight runs smooth along every curve
  clawGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.32, 48), STEEL));
  var cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 20), STEEL);
  cap.position.y = 0.2; clawGroup.add(cap);
  var prongs = [];
  (function buildProngs() {
    var curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.34, -0.45, 0),
      new THREE.Vector3(0.36, -0.95, 0), new THREE.Vector3(0, -1.2, 0));
    var tube = new THREE.TubeGeometry(curve, 48, 0.05, 20, false);
    for (var i = 0; i < 3; i++) {
      var yaw = new THREE.Group();
      yaw.rotation.y = i * Math.PI * 2 / 3;
      var pivot = new THREE.Group();
      pivot.position.set(0.24, -0.12, 0);
      pivot.add(new THREE.Mesh(tube, STEEL));
      var tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 16), STEEL);
      tip.position.set(0, -1.2, 0); pivot.add(tip);
      pivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 24, 16), STEEL));
      yaw.add(pivot); clawGroup.add(yaw);
      prongs.push(pivot);
    }
  })();
  shadowed(clawGroup);

  /* ---------- the modelled cabinet ----------
     Built in Blender (models/claw-cabinet.blend) to the same dimensions: a neutral shell with bevels and
     baked ambient occlusion, plus ornament nodes named deco_<set> that a look can ask for (Broadsheet's
     1930s art deco front is the first). models/optimize-glb.py splits the export: claw-cabinet.glb is the
     shell every visitor downloads; each ornament set is a file of its own, claw-deco-<set>.glb, fetched the
     first time a look asks for that set, so no look pays for another look's kit. Loaded when the r128
     GLTFLoader is on the page; until then, and if it fails, the procedural shell stands in. The claw,
     gantry, floor and prizes stay procedural. */
  var ROOT = document.documentElement.getAttribute('data-root') || '';
  // register a node tree's meshes: shadows, and its materials by name (a name already known is shared, so
  // the look tints one material and both files follow)
  function adopt(node, dressing) {
    node.traverse(function (o) {
      if (!o.isMesh) return;
      o.castShadow = !dressing; o.receiveShadow = true;
      var m = o.material; if (!m || !m.name) return;
      if (cabMats[m.name] && cabMats[m.name] !== m) o.material = cabMats[m.name]; else cabMats[m.name] = m;
    });
  }
  if (THREE.GLTFLoader) {
    new THREE.GLTFLoader().load(ROOT + 'models/claw-cabinet.glb', function (gltf) {
      cabinet = gltf.scene;
      // a node with several materials arrives as a group with one mesh per material
      gltf.scene.children.slice().forEach(function (n) {
        var isDeco = n.name.indexOf('deco_') === 0;
        if (isDeco) ornaments[n.name.slice(5)] = n;
        adopt(n, isDeco);
      });
      if (!cabMats.body || !cabMats.paper || !cabMats.ink) { cabinet = null; console.warn('Claw cabinet: unexpected materials'); return; }
      shell.visible = false;
      scene.add(cabinet);
      if (ornaments.foil) buildNeon();
      tintGlass();
      renderer.compile(scene, camera);   // the cabinet's shaders compile now, while the machine is still a scroll away
    }, undefined, function (e) { console.warn('Claw cabinet did not load:', e); });
  }
  var ribTex, woodTex, woodReady = false;
  // the clear coat needs the physical material; the files bring the standard one. Swapped once, wherever the model uses it
  function physical(name) {
    var m = cabMats[name];
    if (m.isMeshPhysicalMaterial) return m;
    var ph = new THREE.MeshPhysicalMaterial(); THREE.MeshStandardMaterial.prototype.copy.call(ph, m);
    ph.defines = { STANDARD: '', PHYSICAL: '' };
    cabinet.traverse(function (o) { if (o.isMesh && o.material === m) o.material = ph; });
    return (cabMats[name] = ph);
  }
  var ornamentState = {};   // per set: 'loading' or 'done'
  function loadOrnament(set) {
    if (ornamentState[set] || !cabinet || !THREE.GLTFLoader) return;
    ornamentState[set] = 'loading';
    new THREE.GLTFLoader().load(ROOT + 'models/claw-deco-' + set + '.glb', function (gltf) {
      ornamentState[set] = 'done';
      // ornament is dressing: it receives light but never throws shadows onto the playfield
      gltf.scene.children.slice().forEach(function (n) {
        if (n.name.indexOf('deco_') !== 0) return;
        ornaments[n.name.slice(5)] = n; adopt(n, true); n.visible = false; cabinet.add(n);
      });
      if (ornaments.foil && !neon) buildNeon();
      tintGlass();
      renderer.compile(scene, camera);
    }, undefined, function (e) { delete ornamentState[set]; console.warn('Claw ornament did not load:', e); });
  }


  /* ---------- holographic sticker ----------
     The marquee artwork as a printed collectible, in three layers: satin printed ink (the artwork, lit from
     behind like a marquee so it reads at any angle), holographic foil on the border, the pink accents and
     the clouds, and a clear glossy laminate over both. The foil never animates by itself: its colours come
     from the grating equation, driven by the view and by one light that follows the pointer and the claw.
     The data map (img/claw/sticker-lk-foil.webp): R foil strength (1 border and accents, 0.85 clouds,
     0.2 lettering, which gets a thin-film sheen only), G hex emboss weight (1 border, 0.5 clouds). */
  var sticker = null, foilLight = new THREE.Vector3(0.1, 0.45, 1), foilAim = { x: 0.1, y: 0.25 };
  stage.addEventListener('pointermove', function (e) {
    var r = stage.getBoundingClientRect();
    foilAim.x = ((e.clientX - r.left) / r.width) * 2 - 1; foilAim.y = 1 - ((e.clientY - r.top) / r.height) * 2;
  }, { passive: true });
  function buildSticker() {
    if (!cabinet || !THREE.TextureLoader) return;
    var loader = new THREE.TextureLoader(), aniso = renderer.capabilities.getMaxAnisotropy();
    var art = loader.load(ROOT + 'img/claw/sticker-lk.webp'); art.encoding = THREE.sRGBEncoding; art.anisotropy = aniso;
    var foil = loader.load(ROOT + 'img/claw/sticker-lk-foil.webp'); foil.anisotropy = aniso;   // linear data, see above
    var mat = new THREE.MeshPhysicalMaterial({ map: art, alphaTest: 0.5, metalness: 0, roughness: 0.65, clearcoat: 1, clearcoatRoughness: 0.14, envMapIntensity: 0.4 });   // the laminate mirrors the room only faintly, so the print stays sharp
    mat.extensions = { derivatives: true };
    // x: colour cycles per unit of grating phase, y: foil brightness, z: hex cells across the sticker's height, w: lettering sheen
    var foilK = new THREE.Vector4(1.2, 0.7, 34, 0.35);
    mat.onBeforeCompile = function (sh) {
      sh.uniforms.uFoilMap = { value: foil }; sh.uniforms.uLight = { value: foilLight }; sh.uniforms.uK = { value: foilK };
      mat.userData.shader = sh;
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', [
          '#include <common>',
          'uniform sampler2D uFoilMap; uniform vec3 uLight; uniform vec4 uK;',
          'float fHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }',
          '// the foil palette, art-directed rather than a full spectrum: cyan, violet, magenta, gold, round again',
          'vec3 fPal(float t){ t = fract(t) * 4.0; float i = floor(t), f = smoothstep(0.0, 1.0, fract(t));',
          '  vec3 c0 = vec3(0.0, 0.85, 1.0), c1 = vec3(0.42, 0.18, 1.0), c2 = vec3(1.0, 0.08, 0.72), c3 = vec3(1.0, 0.72, 0.12);',
          '  vec3 a = i < 1.0 ? c0 : i < 2.0 ? c1 : i < 3.0 ? c2 : c3; vec3 b = i < 1.0 ? c1 : i < 2.0 ? c2 : i < 3.0 ? c3 : c0;',
          '  return mix(a, b, f); }',
          '// smooth value noise: large soft patches, no pixel-scale detail',
          'float fNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);',
          '  return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), f.x), mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), f.x), f.y); }',
          '// a hex grid: x,y the cell centre, z the distance to the nearest cell edge (0.5 at the centre)',
          'vec3 fHex(vec2 p){ vec2 s = vec2(1.0, 1.7320508); vec2 h = 0.5 * s;',
          '  vec2 a = mod(p, s) - h, b = mod(p - h, s) - h; vec2 g = dot(a, a) < dot(b, b) ? a : b;',
          '  vec2 q = abs(g); float e = 0.5 - max(dot(q, normalize(s)), q.x); return vec3(p - g, e); }'
        ].join('\n'))
        .replace('#include <emissivemap_fragment>', [
          '#include <emissivemap_fragment>',
          'vec3 fk = texture2D(uFoilMap, vUv).rgb;',
          'float foilAmt = smoothstep(0.5, 0.8, fk.r);                 // border, accents, clouds',
          'float sheenAmt = fk.r * (1.0 - foilAmt);                     // the lettering',
          'vec2 sp = (vUv - 0.5) * vec2(6.85, 1.0);                      // sticker space, square units',
          'vec3 fV = normalize(vViewPosition); vec3 fL = normalize(uLight); vec3 fH = normalize(fL + fV);',
          '// the surface frame from the uv derivatives, so the grating follows the print however the plane sits',
          'vec3 dp1 = dFdx(-vViewPosition), dp2 = dFdy(-vViewPosition); vec2 du1 = dFdx(vUv), du2 = dFdy(vUv);',
          'vec3 fTu = normalize(dp1 * du2.y - dp2 * du1.y); vec3 fBu = normalize(cross(normal, fTu));',
          '// hex emboss: each cell turns its grating a little, the edges are pressed darker; faded out where cells get smaller than a few pixels',
          'vec3 hx = fHex(sp * uK.z); float hxFade = (1.0 - smoothstep(0.08, 0.2, fwidth(sp.y * uK.z))) * fk.g;',
          'float hxTurn = (fHash(hx.xy) - 0.5) * 0.35 * hxFade;',
          'float hxEdge = mix(1.0, smoothstep(0.02, 0.12, hx.z), hxFade * 0.6);',
          '// the foil is pressed in large patches, each with its own grating direction and pitch (smooth noise),',
          '// so neighbouring patches catch different colours and each one shifts as the light moves',
          'float gA = 6.2831853 * fNoise(sp * 0.9 + 1.7) + hxTurn; vec2 gd = vec2(cos(gA), sin(gA));',
          'float gPitch = 0.7 + 0.6 * fNoise(sp * 1.4 + 9.2);',
          'vec3 fT = gd.x * fTu + gd.y * fBu;',
          '// first-order grating equation: d (sin in + sin out) = wavelength; the phase picks the colour',
          'float fU = dot(fT, fL) + dot(fT, fV);',
          'vec3 foilCol = fPal(fU * uK.x * gPitch + 0.8 * fNoise(sp * 0.7 + 4.4));',
          'float fLobe = 0.45 + 0.55 * pow(max(dot(normal, fH), 0.0), 4.0);',
          '// thin film, the oil-slick sheen (what MeshPhysicalMaterial.iridescence does in later three.js): colour from the film path length',
          'float tf = 1.2 + 0.6 * dot(normal, fV) + 0.25 * fL.x + 0.15 * sp.x;',
          'vec3 film = 0.5 + 0.5 * cos(6.2831853 * (tf + vec3(0.0, 0.33, 0.67)));',
          'vec3 printInk = diffuseColor.rgb;',
          'float keepInk = (1.0 - fk.g) * 0.5 * foilAmt;                // the clouds keep half their print under the foil',
          'totalEmissiveRadiance += printInk * (1.0 - foilAmt + keepInk) * 0.5;                    // the print, backlit',
          'diffuseColor.rgb = mix(printInk, vec3(0.28), foilAmt * (1.0 - keepInk));               // silver stock under the foil',
          'metalnessFactor = foilAmt; roughnessFactor = mix(0.65, 0.3, foilAmt);',
          'totalEmissiveRadiance += foilAmt * foilCol * mix(film, vec3(1.0), 0.85) * fLobe * hxEdge * uK.y;',
          'totalEmissiveRadiance += sheenAmt * uK.w * film * pow(max(dot(normal, fH), 0.0), 3.0) * printInk;',
          '#ifdef CLEARCOAT',
          '  // the laminate: a few hairline scratches that only show in the highlight',
          '  float fSc = fHash(floor(vec2(vUv.x * 6165.0 + vUv.y * 140.0, vUv.y * 14.0)));',
          '  clearcoatNormal = normalize(clearcoatNormal + step(0.93, fSc) * vec3(0.05, 0.02, 0.0));',
          '#endif'
        ].join('\n'));
    };
    sticker = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 5.6 / 6.85), mat);
    sticker.position.set(0, 6.5, 3.08); sticker.renderOrder = 1;
    cabinet.add(sticker);
  }

  /* ---------- neon falloff ----------
     Emissive tubes light nothing on their own. For the foil ornament, each tube gets a point light that
     throws its colour onto the posts and floor, and an additive halo plane that fades out around it,
     the way a real tube blooms in the eye. Both take their colours from the look. */
  var neon = null;
  function haloTexture() {
    var c = document.createElement('canvas'); c.width = 128; c.height = 8;
    var x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.35, 'rgba(255,255,255,0.35)'); g.addColorStop(0.5, 'rgba(255,255,255,1)');
    g.addColorStop(0.65, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 8);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  function buildNeon() {
    var g = new THREE.Group(), lights = [], halos = [], tex = haloTexture();
    var hw = S.W / 2 + 0.1, hd = S.D / 2 + 0.1, len = S.H - 0.5, cy = S.H / 2 - 0.02;
    function halo(w, h, key) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
      m.userData.key = key; g.add(m); halos.push(m); return m;
    }
    function light(x, y, z, key, power) { var l = new THREE.PointLight(0xffffff, power, 9, 2); l.position.set(x, y, z); l.userData.key = key; g.add(l); lights.push(l); return l; }
    // the tubes: proud of the front posts, and on the outer sides of the back posts (as the model places them)
    [{ x: -hw, z: hd + 0.11, key: 'neonA' }, { x: hw, z: hd + 0.11, key: 'neonB' },
     { x: -(hw + 0.11), z: -hd, key: 'neonA' }, { x: hw + 0.11, z: -hd, key: 'neonB' }].forEach(function (t) {
      halo(1.4, len + 0.6, t.key).position.set(t.x, cy, t.z);
      // set back from the post, so its face takes the colour without blowing out to white
      light(t.x * 0.62, cy, t.z * 0.62, t.key, 0.55);
      light(t.x * 0.55, 0.5, t.z * 0.55 + 0.3, t.key, 0.45);  // and low, so the floor and prizes take the colour
    });
    // the bar under the header
    var bar = halo(0.8, S.W + 0.2, 'glow'); bar.position.set(0, S.H - 0.2, hd - 0.2); bar.userData.flat = true;
    light(0, S.H - 0.6, hd - 0.5, 'glow', 0.4);
    // the plaque: a rose rim glow behind the plate, and a light in front that throws rose up the header
    var sign = halo(1.5, S.W + 0.8, 'neonB'); sign.position.set(0, S.H + 0.08, hd + 0.04); sign.userData.flat = true;
    light(0, S.H + 0.2, hd + 0.9, 'neonB', 0.7);
    scene.add(g); neon = { group: g, lights: lights, halos: halos };
    aimHalos();
  }
  // the halos face the camera; it never moves between resizes, so once per resize is enough
  function aimHalos() {
    if (!neon) return;
    neon.halos.forEach(function (h) {
      if (h.userData.flat) { h.lookAt(camera.position); h.rotateZ(Math.PI / 2); }
      else h.lookAt(camera.position.x, h.position.y, camera.position.z);
    });
  }

  /* ---------- bloom ----------
     What the neon references are: a bright core and a wide soft falloff, done as a post-process. Only the lit
     parts bloom: the scene is rendered once more with everything else black, the Unreal bloom pass blurs that,
     and a final pass adds it over the normal frame. Needs js/postprocessing.js (three r128 examples). */
  var bloom = null;
  function buildBloom() {
    if (!THREE.EffectComposer || !THREE.UnrealBloomPass) return;
    var size = renderer.getDrawingBufferSize(new THREE.Vector2());
    var glow = new THREE.EffectComposer(renderer);
    glow.renderToScreen = false;
    glow.addPass(new THREE.RenderPass(scene, camera));
    var pass = new THREE.UnrealBloomPass(size, 1.1, 0.6, 0.0);
    glow.addPass(pass);
    var mix = new THREE.ShaderPass(new THREE.ShaderMaterial({
      uniforms: { baseTexture: { value: null }, bloomTexture: { value: glow.renderTarget2.texture } },
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'uniform sampler2D baseTexture; uniform sampler2D bloomTexture; varying vec2 vUv; void main() { gl_FragColor = texture2D(baseTexture, vUv) + texture2D(bloomTexture, vUv); }'
    }), 'baseTexture');
    mix.needsSwap = true;
    var base = new THREE.EffectComposer(renderer);
    base.addPass(new THREE.RenderPass(scene, camera));
    base.addPass(mix);
    // the frame is written to the targets in sRGB, as the renderer would write it to the screen
    [glow, base].forEach(function (c) { c.renderTarget1.texture.encoding = THREE.sRGBEncoding; c.renderTarget2.texture.encoding = THREE.sRGBEncoding; });
    bloom = { base: base, glow: glow, pass: pass, on: false, lit: [], dark: new THREE.MeshBasicMaterial({ color: 0x000000 }), swapped: [] };
  }
  // everything that is not lit goes black (or, if see-through, away) for the glow pass, and comes back after
  function darken() {
    scene.traverse(function (o) {
      if (o.isLine || o.isLineSegments) { if (o.visible) { o.visible = false; bloom.swapped.push([o, null]); } return; }
      if (!o.isMesh) return;
      var m = o.material;
      if (bloom.lit.indexOf(m) >= 0) return;
      if (m.transparent) { if (o.visible) { o.visible = false; bloom.swapped.push([o, null]); } return; }
      bloom.swapped.push([o, m]); o.material = bloom.dark;
    });
  }
  function restore() {
    bloom.swapped.forEach(function (p) { if (p[1]) p[0].material = p[1]; else p[0].visible = true; });
    bloom.swapped.length = 0;
  }
  var clearColor = new THREE.Color();
  // the 32-colour desktop (js/pixel-pass.js), switched on by a look's finish
  var pixelPass = THREE.PixelPass ? new THREE.PixelPass(renderer, { snapWhite: false }) : null, pixelOn = false;   // the tinted glass keeps its greys
  function render() {
    if (pixelOn && pixelPass) { pixelPass.render(scene, camera); return; }
    if (!bloom || !bloom.on) { renderer.render(scene, camera); return; }
    darken();
    renderer.getClearColor(clearColor); renderer.setClearColor(0x000000, 1);
    bloom.glow.render();
    renderer.setClearColor(clearColor, 1);
    restore();
    bloom.base.render();
  }

  /* ---------- the overlay passes ----------
     The 3D frame is captured as a video stream and fed to the shader library as a live texture, then
     redrawn by its Engraving effect in the stage's ink and paper colours. Only on WebGPU; elsewhere
     the plate palette alone carries the look. */
  var ink = null, inkShader = null, inkVideo = null, inkStarting = false;
  function stageInk() { var c = getComputedStyle(root); return { ink: c.color, paper: stageColor() }; }
  // the cut is counted in lines per canvas height; keep the pitch near 3px whatever the stage's size
  function inkLines() { return Math.round(Math.max(80, Math.min(220, stage.getBoundingClientRect().height / 3.2))); }
  var inkKind = '';
  // what each pass is: the engraving in the stage's ink and paper; the glow a bloom on the brightest tenth of the frame
  var PASSES = {
    engraving: function () { var c = stageInk(); return { type: 'Engraving', id: 'plate', props: { style: 'line', frequency: inkLines(), angle: 0, relief: 0.6, waviness: 0.25, contrast: 1.45, inkColor: c.ink, paperColor: c.paper } }; },
    glow: function () { return { type: 'Glow', id: 'plate', props: { intensity: 0.3, threshold: 0.9, size: 28 } }; }
  };
  function setPlate(on) {
    if (!on || !PASSES[on]) {
      if (ink) { ink.classList.remove('is-on'); if (inkShader) inkShader.pause(); if (inkVideo) inkVideo.pause(); }
      return;
    }
    if (inkShader && inkKind !== on) {   // a different pass: start over
      try { inkShader.destroy(); } catch (e) {}
      inkShader = null; if (ink && ink.parentNode) ink.parentNode.removeChild(ink); ink = null; inkVideo = null;
    }
    if (inkShader) {
      if (inkKind === 'engraving') { var c = stageInk(); inkShader.update('plate', { inkColor: c.ink, paperColor: c.paper }); }
      ink.classList.add('is-on'); if (inkVideo) inkVideo.play(); inkShader.resume();
      return;
    }
    inkKind = on;
    if (inkStarting || !('gpu' in navigator) || !canvas.captureStream || (navigator.connection && navigator.connection.saveData)) return;
    inkStarting = true;
    import(LIB).then(function (lib) {
      return Promise.resolve(lib.isWebGPUSupported()).then(function (ok) { if (!ok) throw new Error('no WebGPU'); return lib; });
    }).then(function (lib) {
      inkVideo = document.createElement('video');
      inkVideo.muted = true; inkVideo.playsInline = true;
      inkVideo.srcObject = canvas.captureStream();
      ink = document.createElement('canvas');
      ink.className = 'claw__ink'; ink.setAttribute('aria-hidden', 'true');
      var r = stage.getBoundingClientRect();
      ink.style.width = Math.round(r.width) + 'px'; ink.style.height = Math.round(r.height) + 'px';
      canvas.parentNode.insertBefore(ink, canvas.nextSibling);
      // a media component of our own: the library's video source only takes a URL, this one hands it the element
      var feed = { name: 'ClawFeed', boundingBoxDeclaration: { aspectRatio: null }, category: 'Textures', description: 'The claw machine, live', props: {},
        fragment: function (e) { return e.registerExternalTexture(function () { return (inkVideo && inkVideo.readyState >= 2 && inkVideo.videoWidth) ? inkVideo : null; }).sample(e.ctx.uv); } };
      var pass = PASSES[on](); pass.children = [{ type: 'ClawFeed', id: 'feed' }];
      return inkVideo.play().then(function () {
        return lib.createShader(ink, { components: [pass] }, { components: [feed], disableTelemetry: true, onError: function () { if (ink) ink.classList.remove('is-on'); } });
      });
    }).then(function (shader) {
      inkShader = shader; inkStarting = false;
      if (wantsPlate() === inkKind) ink.classList.add('is-on'); else { shader.pause(); inkVideo.pause(); }
    }).catch(function (e) { inkStarting = false; if (ink && ink.parentNode) ink.parentNode.removeChild(ink); ink = null; console.warn('Claw plate did not start:', e); });
  }
  tintGlass();

  /* ---------- prizes ---------- */
  function stadium(w, h) {
    var r = h / 2, s = new THREE.Shape();
    s.moveTo(-w / 2 + r, -r);
    s.lineTo(w / 2 - r, -r);
    s.absarc(w / 2 - r, 0, r, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(-w / 2 + r, r);
    s.absarc(-w / 2 + r, 0, r, Math.PI / 2, Math.PI * 1.5, false);
    return s;
  }
  function roundedRect(w, h, r) {
    var s = new THREE.Shape(), x = -w / 2, y = -h / 2;
    s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
    s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
    s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
    return s;
  }
  function flat(shape, depth, mat) {
    var g = new THREE.ExtrudeGeometry(shape, { depth: depth, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 3, curveSegments: 20 });
    g.rotateX(-Math.PI / 2); g.computeBoundingBox(); g.translate(0, -g.boundingBox.min.y, 0);
    var m = new THREE.Mesh(g, mat);
    m.userData.top = g.boundingBox.max.y - g.boundingBox.min.y;
    return m;
  }
  function bar(ax, az, bx, bz, w, h, y, mat) {
    var dx = bx - ax, dz = bz - az, L = Math.sqrt(dx * dx + dz * dz);
    var m = new THREE.Mesh(new THREE.BoxGeometry(L, h, w), mat);
    m.position.set((ax + bx) / 2, y, (az + bz) / 2);
    m.rotation.y = -Math.atan2(dz, dx);
    return m;
  }
  var builders = {
    toggle: function () {
      var g = new THREE.Group();
      var track = flat(stadium(1.3, 0.62), 0.16, WHITE); g.add(track);
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.235, 0.025, 10, 32), INK);
      ring.rotation.x = Math.PI / 2; ring.position.set(0.34, track.userData.top + 0.004, 0); g.add(ring);
      var knob = new THREE.Mesh(new THREE.CylinderGeometry(0.21, 0.21, 0.1, 28), WHITE);
      knob.position.set(0.34, track.userData.top + 0.05, 0); g.add(knob);
      return g;
    },
    pill: function () {
      var g = new THREE.Group();
      var body = flat(stadium(1.2, 0.5), 0.12, WHITE); g.add(body);
      var label = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.03, 0.07), INK);
      label.position.set(-0.08, body.userData.top + 0.012, 0); g.add(label);
      var dot = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.03, 14), INK);
      dot.position.set(0.36, body.userData.top + 0.012, 0); g.add(dot);
      return g;
    },
    checkbox: function () {
      var g = new THREE.Group();
      var box = flat(roundedRect(0.92, 0.92, 0.16), 0.14, WHITE); g.add(box);
      var y = box.userData.top + 0.027;
      g.add(bar(-0.3, -0.02, -0.08, 0.2, 0.09, 0.05, y, INK));
      g.add(bar(-0.11, 0.21, 0.32, -0.24, 0.09, 0.05, y, INK));
      return g;
    },
    radio: function () {
      var g = new THREE.Group();
      var ring = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.075, 12, 40), WHITE);
      ring.rotation.x = Math.PI / 2; ring.position.y = 0.075; g.add(ring);
      var dot = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 28), WHITE);
      dot.position.y = 0.06; g.add(dot);
      return g;
    },
    button: function () {
      var g = new THREE.Group();
      var body = flat(roundedRect(1.25, 0.56, 0.14), 0.16, WHITE); g.add(body);
      var label = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.03, 0.08), INK);
      label.position.set(0, body.userData.top + 0.012, 0); g.add(label);
      return g;
    },
    input: function () {
      var g = new THREE.Group();
      var frame = flat(roundedRect(1.45, 0.52, 0.1), 0.1, WHITE); g.add(frame);
      var field = flat(roundedRect(1.31, 0.38, 0.07), 0.04, INK);
      field.position.y = frame.userData.top - 0.02; g.add(field);
      var caret = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.03, 0.24), WHITE);
      caret.position.set(-0.52, frame.userData.top + 0.05, 0); g.add(caret);
      var text = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.03, 0.06), new THREE.MeshStandardMaterial({ color: 0x8a8a86, roughness: 0.6 }));
      text.position.set(-0.26, frame.userData.top + 0.05, 0); g.add(text);
      return g;
    }
  };

  var items = [], falling = [];
  function spawnItems() {
    items.forEach(function (it) { if (it.group.parent) it.group.parent.remove(it.group); });
    items = []; falling = [];
    // a pile, not a tile: loose slots with wide jitter, each piece tilted and sized on its own, every fourth one
    // resting on its neighbours, and a third in the second tone
    var xs = [-2.2, -0.75, 0.75, 2.2], zs = [-1.7, -0.55, 0.6, 1.7];
    var types = ['toggle', 'button', 'pill', 'input', 'radio', 'checkbox', 'button', 'toggle', 'input', 'pill', 'radio', 'checkbox', 'toggle', 'pill', 'checkbox'];
    var k = 0;
    zs.forEach(function (z) {
      xs.forEach(function (x) {
        if (x === -2.2 && z === 1.7) return;
        var type = types[k++ % types.length];
        var group = builders[type]();
        var pm = PRIZE[k % PRIZE.length];
        if (pm !== WHITE) group.traverse(function (o) { if (o.isMesh && o.material === WHITE) o.material = pm; });
        var stacked = k % 4 === 0;
        group.scale.setScalar(0.74 + Math.random() * 0.24);
        var rest = stacked ? 0.16 : 0;
        group.position.set(x + (Math.random() - 0.5) * 0.6, rest, z + (Math.random() - 0.5) * 0.5);
        var tilt = stacked ? 0.32 : 0.14;
        group.rotation.set((Math.random() - 0.5) * tilt, Math.random() * Math.PI * 2, (Math.random() - 0.5) * tilt);
        scene.add(shadowed(group));
        items.push({ group: group, type: type, state: 'floor', rest: rest });
      });
    });
    left = items.length;
    if (refillBtn) refillBtn.hidden = true;
    centrePiece(true);
  }
  // The claw's home is the middle, so the middle always holds a prize: an easy first catch. If it is empty, the
  // nearest piece on the floor hops over (at once when the pile is dealt, or under reduced motion).
  function centrePiece(now) {
    var best = null, bestD = Infinity;
    items.forEach(function (it) {
      if (it.state !== 'floor') return;
      var p = it.slide || it.group.position, d = Math.sqrt(p.x * p.x + p.z * p.z);
      if (d < bestD) { bestD = d; best = it; }
    });
    if (!best || bestD < 0.3) return;
    var tx = (Math.random() - 0.5) * 0.2, tz = (Math.random() - 0.5) * 0.2;
    if (now) { best.group.position.x = tx; best.group.position.z = tz; best.slide = null; }
    else best.slide = { x: tx, z: tz, d0: bestD };
  }

  /* ---------- game state ---------- */
  var claw = { x: 0, z: 0, y: S.topY, open: 1, held: null, grabDist: 0 };
  var state = 'idle', st = 0, closeChecked = false, slipChecked = false;
  var tries = 0, caught = 0, left = 0;
  var counts = { toggle: 0, pill: 0, checkbox: 0, radio: 0, button: 0, input: 0 };
  var keys = { left: false, right: false, up: false, down: false };
  var pad = { left: false, right: false, up: false, down: false };

  function go(s) { state = s; st = 0; closeChecked = false; slipChecked = false; dropBtn.disabled = (s !== 'idle'); if (s === 'return') centrePiece(reduced); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function inChute(x, z) { return Math.abs(x - S.chute.x) < S.chute.size / 2 && Math.abs(z - S.chute.z) < S.chute.size / 2; }

  function drop() {
    if (state !== 'idle' || left === 0) return;
    tries++;
    setStatus('Dropping…');
    go('drop');
  }

  var tmp = new THREE.Vector3(), cableTop = new THREE.Vector3(), cableDir = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
  function tryGrab() {
    var best = null, bestD = Infinity;
    items.forEach(function (it) {
      if (it.state !== 'floor') return;
      var dx = it.group.position.x - claw.x, dz = it.group.position.z - claw.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) { bestD = d; best = it; }
    });
    if (!best || bestD > S.grabRadius) { setStatus('Nothing in reach.'); return false; }
    var p = bestD < S.sureRadius ? 1 : clamp(1.4 - bestD / S.grabRadius, 0.45, 1);
    if (Math.random() > p) { setStatus('Just missed the ' + LABELS[best.type].toLowerCase() + '.'); return false; }
    best.group.getWorldPosition(tmp);
    clawGroup.add(best.group);
    best.group.position.copy(clawGroup.worldToLocal(tmp));   // the claw may be mid-swing
    best.state = 'held'; best.slide = null;
    claw.held = best; claw.grabDist = bestD;
    setStatus('Got a grip on the <b>' + LABELS[best.type].toLowerCase() + '</b>…');
    return true;
  }

  function releaseHeld(sink) {
    var it = claw.held; if (!it) return;
    it.group.getWorldPosition(tmp);
    scene.add(it.group);
    it.group.position.copy(tmp);
    it.state = 'falling';
    falling.push({ item: it, vy: 0, sink: sink });
    claw.held = null;
  }

  function collect(it) {
    scene.remove(it.group);
    items.splice(items.indexOf(it), 1);
    caught++; left--; counts[it.type]++;
    document.dispatchEvent(new CustomEvent('claw:caught', { detail: { type: it.type, label: LABELS[it.type].toLowerCase(), caught: caught } }));
    var slot = root.querySelector('.claw__slot[data-type="' + it.type + '"]');
    if (slot) {
      slot.setAttribute('data-empty', 'false');
      var n = slot.querySelector('.claw__n'); if (n) n.textContent = '×' + counts[it.type];
    }
    if (left === 0) {
      setStatus('<b>Machine empty.</b> You caught all 15.');
      dropBtn.disabled = true;
      // no Refill button on the homepage: the machine restocks itself
      if (refillBtn) refillBtn.hidden = false;
      else setTimeout(function () { spawnItems(); setStatus('Refilled. Ready.'); dropBtn.disabled = (state !== 'idle'); }, 1600);
    } else {
      setStatus('<b>' + LABELS[it.type] + '</b> collected. ' + left + ' left.');
    }
  }

  /* The claw hangs on its cable, so it swings: it lags when the carriage starts and whips past when it stops.
     A damped pendulum, driven by the carriage's change of speed. sway.x / sway.z are the claw's sideways
     offset from the carriage; the swing is faster on a short cable and slower on a long one, as in life.
     Toned down from the real thing: 40% of the push, and it settles in a few swings. The game still plays
     from the carriage's position, so the swing never changes what a drop can reach. */
  var sway = { x: 0, z: 0, vx: 0, vz: 0, px: 0, pz: 0, cvx: 0, cvz: 0 };
  var SWAY = { gravity: 40, push: 0.4, damp: 0.16, dampBusy: 0.4, max: 0.26 };   // max is the largest swing angle, in radians
  function swing(dt) {
    if (reduced || dt < 1e-4) { sway.px = claw.x; sway.pz = claw.z; return; }
    var lim = S.speed * 1.5;   // a drag can jump the carriage; cap the speed the pendulum feels
    var vx = clamp((claw.x - sway.px) / dt, -lim, lim), vz = clamp((claw.z - sway.pz) / dt, -lim, lim);
    sway.px = claw.x; sway.pz = claw.z;
    // the carriage's change of speed pushes the claw the other way
    sway.vx -= SWAY.push * (vx - sway.cvx); sway.vz -= SWAY.push * (vz - sway.cvz);
    sway.cvx = vx; sway.cvz = vz;
    var len = Math.max(0.6, S.gantryY - claw.y), w = Math.sqrt(SWAY.gravity / len);
    var z = (state === 'idle' || state === 'carry' || state === 'return') ? SWAY.damp : SWAY.dampBusy;   // it steadies while it drops and grips
    sway.vx += (-w * w * sway.x - 2 * z * w * sway.vx) * dt; sway.vz += (-w * w * sway.z - 2 * z * w * sway.vz) * dt;
    sway.x += sway.vx * dt; sway.z += sway.vz * dt;
    var m = SWAY.max * len, d = Math.sqrt(sway.x * sway.x + sway.z * sway.z);
    if (d > m) { sway.x *= m / d; sway.z *= m / d; }
  }

  function moveToward(tx, tz, dt) {
    var dx = tx - claw.x, dz = tz - claw.z, d = Math.sqrt(dx * dx + dz * dz);
    var step = S.speed * dt;
    if (d <= step) { claw.x = tx; claw.z = tz; return true; }
    claw.x += dx / d * step; claw.z += dz / d * step; return false;
  }

  function update(dt) {
    st += dt;
    switch (state) {
      case 'idle': {
        var mx = (keys.right || pad.right ? 1 : 0) - (keys.left || pad.left ? 1 : 0);
        var mz = (keys.down || pad.down ? 1 : 0) - (keys.up || pad.up ? 1 : 0);
        if (mx && mz) { mx *= 0.7071; mz *= 0.7071; }
        claw.x = clamp(claw.x + mx * S.speed * dt, -S.boundX, S.boundX);
        claw.z = clamp(claw.z + mz * S.speed * dt, -S.boundZ, S.boundZ);
        claw.open += (1 - claw.open) * Math.min(1, dt * 6);
        claw.y += (S.topY - claw.y) * Math.min(1, dt * 6);
        break;
      }
      case 'drop':
        claw.y = Math.max(S.grabY, claw.y - 3.8 * dt);
        if (claw.y <= S.grabY) go('close');
        break;
      case 'close':
        claw.open = Math.max(0.08, claw.open - 2.4 * dt);
        if (!closeChecked && claw.open <= 0.45) {
          closeChecked = true;
          if (tryGrab()) { claw.open = 0.45; go('lift'); return; }
        }
        if (claw.open <= 0.08 && st > 0.55) go('lift');
        break;
      case 'lift':
        claw.y = Math.min(S.topY, claw.y + 2.6 * dt);
        if (claw.held) {
          var g = claw.held.group;
          g.position.x += (0 - g.position.x) * Math.min(1, dt * 5);
          g.position.z += (0 - g.position.z) * Math.min(1, dt * 5);
          g.position.y += (-1.05 - g.position.y) * Math.min(1, dt * 5);
          if (!slipChecked && st > 0.45) {
            slipChecked = true;
            var slipP = claw.grabDist > 1.0 ? 0.1 : 0.0;   // only a grip at the edge of reach can slip
            if (Math.random() < slipP) {
              setStatus('It slipped out.');
              releaseHeld(inChute(claw.x, claw.z));
              claw.open = 0.9;
            }
          }
        }
        if (claw.y >= S.topY) go(claw.held ? 'carry' : 'return');
        break;
      case 'carry':
        if (moveToward(S.chute.x, S.chute.z, dt)) go('release');
        break;
      case 'release':
        claw.open = Math.min(1, claw.open + 2.5 * dt);
        if (claw.held && claw.open > 0.75) releaseHeld(true);
        if (st > 0.9) go('return');
        break;
      case 'return':
        claw.open += (1 - claw.open) * Math.min(1, dt * 4);
        if (moveToward(0, 0, dt)) { go('idle'); if (left > 0 && statusEl && !/collected|slipped|missed|Nothing/.test(statusEl.textContent)) setStatus('Ready.'); }
        break;
    }

    items.forEach(function (it) {   // a piece on its way to the middle: a short hop across the pile
      if (!it.slide || it.state !== 'floor') return;
      var g = it.group.position, dx = it.slide.x - g.x, dz = it.slide.z - g.z, d = Math.sqrt(dx * dx + dz * dz), step = 2.2 * dt;
      if (d <= step) { g.x = it.slide.x; g.z = it.slide.z; g.y = it.rest; it.slide = null; return; }
      g.x += dx / d * step; g.z += dz / d * step; g.y = it.rest + Math.sin(Math.PI * clamp(1 - d / it.slide.d0, 0, 1)) * 0.22;
    });
    for (var i = falling.length - 1; i >= 0; i--) {
      var f = falling[i];
      f.vy -= 14 * dt;
      f.item.group.position.y += f.vy * dt;
      if (f.sink) {
        if (f.item.group.position.y < -0.6) { falling.splice(i, 1); collect(f.item); }
      } else if (f.item.group.position.y <= f.item.rest) {
        f.item.group.position.y = f.item.rest; f.item.state = 'floor'; falling.splice(i, 1);
      }
    }

    swing(dt);
    // the claw hangs from the carriage: tilt it about that point, and run the cable to it
    var hang = S.gantryY - claw.y, tx = sway.x / hang, tz = sway.z / hang;
    clawGroup.position.set(claw.x + sway.x, S.gantryY - hang * Math.sqrt(Math.max(0, 1 - tx * tx - tz * tz)), claw.z + sway.z);
    clawGroup.rotation.set(-Math.asin(clamp(tz, -1, 1)), 0, Math.asin(clamp(tx, -1, 1)));
    var ang = claw.open * 0.5;
    if (state === 'idle' && !reduced) ang += Math.sin(st * 2.2) * 0.03;
    prongs.forEach(function (p) { p.rotation.z = ang; });
    crossbar.position.z = claw.z;
    carriage.position.set(claw.x, S.gantryY, claw.z);
    cableTop.set(claw.x, S.gantryY, claw.z);
    cableDir.set(0, 0.2, 0).applyEuler(clawGroup.rotation).add(clawGroup.position).sub(cableTop);   // from the carriage to the top of the claw's cap
    var len = cableDir.length();
    cable.scale.y = Math.max(0.01, len);
    cable.position.copy(cableTop).addScaledVector(cableDir, 0.5);
    cable.quaternion.setFromUnitVectors(UP, cableDir.multiplyScalar(-1 / Math.max(0.01, len)));
  }

  /* ---------- input ---------- */
  dropBtn.addEventListener('click', function () { drop(); stage.focus({ preventScroll: true }); });
  if (refillBtn) refillBtn.addEventListener('click', function () { spawnItems(); setStatus('Refilled. Ready.'); dropBtn.disabled = (state !== 'idle'); });

  Array.prototype.forEach.call(root.querySelectorAll('[data-claw-dir]'), function (b) {
    var dir = b.getAttribute('data-claw-dir');
    function hold(on) { pad[dir] = on; b.setAttribute('data-held', on ? 'true' : 'false'); }
    b.addEventListener('pointerdown', function (e) { e.preventDefault(); hold(true); try { b.setPointerCapture(e.pointerId); } catch (_) {} });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { b.addEventListener(ev, function () { hold(false); }); });
    b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
  });

  var keyMap = { ArrowLeft: 'left', a: 'left', ArrowRight: 'right', d: 'right', ArrowUp: 'up', w: 'up', ArrowDown: 'down', s: 'down' };
  stage.addEventListener('keydown', function (e) {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); drop(); return; }
    var k = keyMap[e.key]; if (k) { e.preventDefault(); keys[k] = true; }
  });
  stage.addEventListener('keyup', function (e) { var k = keyMap[e.key]; if (k) keys[k] = false; });
  stage.addEventListener('blur', function () { keys.left = keys.right = keys.up = keys.down = false; });

  var drag = null;
  canvas.addEventListener('pointerdown', function (e) {
    stage.focus({ preventScroll: true });
    if (state !== 'idle') return;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
    try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  });
  canvas.addEventListener('pointermove', function (e) {
    if (!drag || e.pointerId !== drag.id || state !== 'idle') return;
    var r = canvas.getBoundingClientRect();
    var k = (S.W / r.width) * 1.35;
    claw.x = clamp(claw.x + (e.clientX - drag.x) * k, -S.boundX, S.boundX);
    claw.z = clamp(claw.z + (e.clientY - drag.y) * k, -S.boundZ, S.boundZ);
    drag.x = e.clientX; drag.y = e.clientY;
  });
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { canvas.addEventListener(ev, function () { drag = null; }); });

  // the live components in the tray
  var sw = root.querySelector('.claw__switch');
  if (sw) sw.addEventListener('click', function () { sw.setAttribute('aria-checked', sw.getAttribute('aria-checked') === 'true' ? 'false' : 'true'); });
  var pl = root.querySelector('.claw__pill');
  if (pl) pl.addEventListener('click', function () { pl.setAttribute('aria-pressed', pl.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); });
  var bt = root.querySelector('.claw__btn'), btTimer = null;
  if (bt) bt.addEventListener('click', function () {
    bt.setAttribute('data-done', 'true'); bt.textContent = 'Done';
    clearTimeout(btTimer);
    btTimer = setTimeout(function () { bt.removeAttribute('data-done'); bt.textContent = 'Continue'; }, 1200);
  });
  var inp = root.querySelector('.claw__field');
  if (inp) inp.addEventListener('keydown', function (e) { e.stopPropagation(); });

  /* ---------- sizing / loop ---------- */
  function resize() {
    var r = stage.getBoundingClientRect();
    var w = Math.max(1, Math.round(r.width)), h = Math.max(1, Math.round(r.height));
    renderer.setSize(w, h, false);
    if (pixelPass) pixelPass.setSize(w, h);
    if (bloom) { bloom.base.setSize(w, h); bloom.glow.setSize(w, h); }
    if (ink) { ink.style.width = w + 'px'; ink.style.height = h + 'px'; if (inkShader) { inkShader.resize(w, h); if (inkKind === 'engraving') inkShader.update('plate', { frequency: inkLines() }); } }
    camera.aspect = w / h;
    var vf = THREE.MathUtils.degToRad(camera.fov);
    var hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    // fit the rotated cabinet: its half-width on screen at this yaw, and the taller of top frame and skirt from the target
    var ff = finish(); camTarget.y = ff.fitY || 2.05;   // a look with a taller or wider kit names its own frame
    var dist = Math.max((ff.fitW || 3.9) / Math.tan(hf / 2), (ff.fitH || 4.75) / Math.tan(vf / 2)) * 1.02;
    camera.position.copy(camTarget).addScaledVector(camDir, dist);
    camera.lookAt(camTarget);
    // on a wide stage a look can stand the machine left of centre, in the room its controls leave free (0.73: the
    // kit's width on screen, as a share of the stage's height)
    var slide = (ff.slide && w > h * 1.3) ? Math.round(ff.slide * (w - h * 0.73) / 2) : 0;
    if (slide) camera.setViewOffset(w, h, slide, 0, w, h); else if (camera.view) camera.clearViewOffset();
    camera.updateProjectionMatrix();
    aimHalos();
  }
  if (window.ResizeObserver) new ResizeObserver(resize).observe(stage); else window.addEventListener('resize', resize);
  resize();
  spawnItems();

  // only render while the machine is on screen
  var visible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) { visible = entries[0].isIntersecting; }, { threshold: 0.05 }).observe(root);
  }
  var clock = new THREE.Clock();
  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(0.05, clock.getDelta());
    if (!visible) return;
    update(dt);
    if (sticker) {   // the foil's light eases toward the pointer and leans with the claw; with neither moving it holds still
      var lx = foilAim.x * 0.9 + claw.x * 0.12, ly = 0.3 + foilAim.y * 0.6, k = Math.min(1, dt * 6);
      foilLight.x += (lx - foilLight.x) * k; foilLight.y += (ly - foilLight.y) * k;
    }
    render();
  }
  frame();
  }

  // Build the scene only when its stage is within three quarters of a screen, so a visitor who never
  // scrolls here pays nothing, and the shaders compile one scroll ahead of the viewer rather than at load.
  var begun = false;
  function begin() { if (begun) return; begun = true; start(); }
  if ('IntersectionObserver' in window) {
    var approach = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { approach.disconnect(); begin(); } }, { rootMargin: '75% 0px' });
    approach.observe(root);
  } else begin();
})();
