/* Design-system case study teaser on the homepage: a claw machine filled with the
   system's foundational components (toggle, pill, checkbox, radio, button, text input).
   Drag the glass or hold the pad to steer, press Drop, and each catch lights up a live
   component in the tray. Needs js/three.min.js (r128) loaded first.
   A look can ask for the machine as an engraved plate (Broadsheet sets --claw-plate on .claw): the
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

  var S = {
    W: 6, D: 5, H: 6.2,
    topY: 5.2, grabY: 1.05, gantryY: 6.2,
    boundX: 2.5, boundZ: 2.0,
    speed: 3.2,
    chute: { x: -2.1, z: 1.7, size: 1.3 },
    grabRadius: 0.95
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
  document.addEventListener('theme:change', function () { renderer.setClearColor(new THREE.Color().setStyle(stageColor()), 1); tintGlass(); });
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
  scene.add(new THREE.HemisphereLight(0xffffff, 0x3a3a3a, 0.5));
  var key = new THREE.DirectionalLight(0xffffff, 1.1); key.position.set(2, 10, 3); scene.add(key);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6;
  key.shadow.camera.left = key.shadow.camera.bottom = -4.5; key.shadow.camera.right = key.shadow.camera.top = 4.5;
  key.shadow.camera.near = 2; key.shadow.camera.far = 25;
  key.shadow.bias = -0.0008; key.shadow.normalBias = 0.03;
  var fill = new THREE.DirectionalLight(0xffffff, 0.4); fill.position.set(-6, 3, 6); scene.add(fill);
  // everything solid casts and receives; the glass and the lines are left out
  function shadowed(obj) { obj.traverse(function (o) { if (o.isMesh && !o.material.transparent) { o.castShadow = true; o.receiveShadow = true; } }); return obj; }

  // a softbox environment, built from a few lit planes and prefiltered once: metal gets reflections, glass a sheen,
  // and the prizes a soft top-down gradient. PMREMGenerator is in r128 core; RoomEnvironment is not.
  (function buildEnvironment() {
    var pm = new THREE.PMREMGenerator(renderer), es = new THREE.Scene();
    es.background = new THREE.Color(0x2a2a2a);
    function strip(w, h, x, y, z, rx, ry, tone) {
      var m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: tone }));
      m.position.set(x, y, z); m.rotation.set(rx, ry, 0); es.add(m);
    }
    strip(8, 3, 0, 6, 0, Math.PI / 2, 0, 0xffffff);        // overhead softbox
    strip(2, 6, -6, 3, 0, 0, Math.PI / 2, 0xb0b0b0);       // side strip, left
    strip(2, 6, 6, 3, 0, 0, -Math.PI / 2, 0x707070);       // dimmer strip, right
    strip(12, 12, 0, -3, 0, -Math.PI / 2, 0, 0x101010);    // dark floor
    scene.environment = pm.fromScene(es, 0.04).texture;
    pm.dispose();
  })();

  var WHITE = new THREE.MeshStandardMaterial({ color: 0xdedbd4, roughness: 0.55 });   // headroom: the tone curve brings it back to white
  var BONE = new THREE.MeshStandardMaterial({ color: 0xb8b4ac, roughness: 0.6 });     // a second tone for a third of the prizes, so the pile has depth
  var INK = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.5 });
  var STEEL = new THREE.MeshStandardMaterial({ color: 0xdedbd4, roughness: 0.35, metalness: 0.15 });
  var FLOOR = new THREE.MeshStandardMaterial({ color: 0x262626, roughness: 0.95 });
  var BODY = new THREE.MeshStandardMaterial({ color: 0x202020, roughness: 0.9 });
  var LINE = new THREE.LineBasicMaterial({ color: 0x4a4a46 });
  /* ---------- finishes ----------
     One neutral cabinet, dressed per look. Each look names the colours of the procedural parts (floor,
     chute, steel, prizes) and of the model's three materials (body, paper, ink), the surface (roughness,
     metalness, how much of the environment shows), the glass, and which ornament set of the model to show.
     Looks are keyed by --look, which each theme stylesheet sets on <html>; they inherit from the default
     (charcoal) and override what they need. The plate (engraving pass) is a separate
     flag the theme sets in CSS, so a look can be dressed without being engraved. */
  var FINISH = {
    default:    { floor: 0x262626, hole: 0x0e0e0e, steel: 0xdedbd4, white: 0xdedbd4, bone: 0xb8b4ac,
                  body: 0x202020, paper: 0xdedbd4, ink: 0x141414, roughness: 0.8, metalness: 0, env: 0.6, steelEnv: 1, glass: 0.16, ornament: null },
    manual:     { body: 0x2b2a27, paper: 0xe4e1d9, ink: 0x0c0c0c, roughness: 1, env: 0.25, glass: 0.12 },              // unpainted, no sheen
    win95:      { body: 0xc0c0c0, paper: 0xffffff, ink: 0x000000, floor: 0x808080, roughness: 0.95, env: 0, steelEnv: 0.3, glass: 0.1 }, // flat grey chrome
    press:      { floor: 0x4a4540, hole: 0x0a0a0a, body: 0x0a0a0a, paper: 0xdedbd4, ink: 0x0c0c0c,                     // near-black cabinet, paper trim, the deco front on
                  roughness: 0.85, env: 0.2, glass: 0.14, ornament: 'broadsheet' },
    foil:       { body: 0x2a1c6e, paper: 0xe8e2ff, ink: 0x12083a, steel: 0xf4f1ff, floor: 0x1a1040, roughness: 0.35, metalness: 0.6, env: 1.2, glass: 0.2 }
  };
  // the theme stylesheet names the look on <html> as --look (manual, press, win95, foil); charcoal names none
  function look() { return getComputedStyle(document.documentElement).getPropertyValue('--look').trim() || 'default'; }
  function finish() { var f = Object.assign({}, FINISH.default); Object.assign(f, FINISH[look()] || {}); return f; }
  var plate = false;
  var shell = new THREE.Group();  // the procedural cabinet: plinth, posts, frame; stands in until the modelled one loads
  var cabinet = null, cabMats = {}, ornaments = {}; // the modelled cabinet (models/claw-cabinet.glb), its body / paper / ink materials, its ornament nodes by name
  function wantsPlate() { return getComputedStyle(root).getPropertyValue('--claw-plate').trim() !== ''; }

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
      BODY.color.setHex(f.body); FLOOR.color.setHex(f.floor); HOLE.color.setHex(f.hole); STEEL.color.setHex(f.steel); WHITE.color.setHex(f.white); BONE.color.setHex(f.bone);
      STEEL.envMapIntensity = f.steelEnv;
      inner.material.opacity = plate ? 0.1 : (light ? 0.42 : 0.08);
      GLASS.opacity = f.glass;
      LINE.color.setHex(light ? 0x1c1c1c : 0x4a4a46);
      // the clear colour is not tone mapped; on the plate it is pure white so the engraving leaves it as clean paper
      renderer.setClearColor(plate ? new THREE.Color(0xffffff) : new THREE.Color().setStyle(stageColor()), 1);
      if (cabinet) {
        [['body', f.body], ['paper', f.paper], ['ink', f.ink]].forEach(function (pair) {
          var m = cabMats[pair[0]];
          m.color.setHex(pair[1]); m.roughness = f.roughness; m.metalness = f.metalness; m.envMapIntensity = f.env;
        });
        for (var name in ornaments) ornaments[name].visible = (name === f.ornament);
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
  var cable = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 1, 8), STEEL);
  scene.add(cable);

  /* ---------- claw ---------- */
  var clawGroup = new THREE.Group();
  scene.add(clawGroup);
  clawGroup.add(new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.3, 0.32, 24), STEEL));
  var cap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), STEEL);
  cap.position.y = 0.2; clawGroup.add(cap);
  var prongs = [];
  (function buildProngs() {
    var curve = new THREE.CubicBezierCurve3(
      new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.34, -0.45, 0),
      new THREE.Vector3(0.36, -0.95, 0), new THREE.Vector3(0, -1.2, 0));
    var tube = new THREE.TubeGeometry(curve, 14, 0.05, 8, false);
    for (var i = 0; i < 3; i++) {
      var yaw = new THREE.Group();
      yaw.rotation.y = i * Math.PI * 2 / 3;
      var pivot = new THREE.Group();
      pivot.position.set(0.24, -0.12, 0);
      pivot.add(new THREE.Mesh(tube, STEEL));
      var tip = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), STEEL);
      tip.position.set(0, -1.2, 0); pivot.add(tip);
      pivot.add(new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), STEEL));
      yaw.add(pivot); clawGroup.add(yaw);
      prongs.push(pivot);
    }
  })();
  shadowed(clawGroup);

  /* ---------- the modelled cabinet ----------
     Built in Blender (models/claw-cabinet.blend) to the same dimensions: a neutral shell with bevels and
     baked ambient occlusion, plus ornament nodes named deco_<set> that a look can ask for (Broadsheet's
     1930s art deco front is the first). Loaded when the r128 GLTFLoader is on the page; until then, and if
     it fails, the procedural shell stands in. The claw, gantry, floor and prizes stay procedural. */
  if (THREE.GLTFLoader) {
    new THREE.GLTFLoader().load((document.documentElement.getAttribute('data-root') || '') + 'models/claw-cabinet.glb', function (gltf) {
      cabinet = gltf.scene;
      cabinet.traverse(function (o) {
        // a node with several materials arrives as a group with one mesh per material; only the top-level node is the ornament
        if (o.parent === gltf.scene && o.name.indexOf('deco_') === 0) ornaments[o.name.slice(5)] = o;
        if (!o.isMesh) return;
        // ornament is dressing: it receives light but never throws shadows onto the playfield
        var dressing = o.name.indexOf('deco_') === 0 || (o.parent && o.parent.name.indexOf('deco_') === 0);
        o.castShadow = !dressing; o.receiveShadow = true;
        var m = o.material; if (m && m.name) cabMats[m.name] = m;
      });
      if (!cabMats.body || !cabMats.paper || !cabMats.ink) { cabinet = null; console.warn('Claw cabinet: unexpected materials'); return; }
      shell.visible = false;
      scene.add(cabinet);
      tintGlass();
    }, undefined, function (e) { console.warn('Claw cabinet did not load:', e); });
  }

  /* ---------- the engraved plate ----------
     The 3D frame is captured as a video stream and fed to the shader library as a live texture, then
     redrawn by its Engraving effect in the stage's ink and paper colours. Only on WebGPU; elsewhere
     the plate palette alone carries the look. */
  var ink = null, inkShader = null, inkVideo = null, inkStarting = false;
  function stageInk() { var c = getComputedStyle(root); return { ink: c.color, paper: stageColor() }; }
  // the cut is counted in lines per canvas height; keep the pitch near 3px whatever the stage's size
  function inkLines() { return Math.round(Math.max(80, Math.min(220, stage.getBoundingClientRect().height / 3.2))); }
  function setPlate(on) {
    if (!on) {
      if (ink) { ink.classList.remove('is-on'); if (inkShader) inkShader.pause(); if (inkVideo) inkVideo.pause(); }
      return;
    }
    if (inkShader) {
      var c = stageInk();
      inkShader.update('plate', { inkColor: c.ink, paperColor: c.paper });
      ink.classList.add('is-on'); if (inkVideo) inkVideo.play(); inkShader.resume();
      return;
    }
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
      var c = stageInk();
      return inkVideo.play().then(function () {
        return lib.createShader(ink, { components: [
          { type: 'Engraving', id: 'plate', props: { style: 'line', frequency: inkLines(), angle: 0, relief: 0.6, waviness: 0.25, contrast: 1.45, inkColor: c.ink, paperColor: c.paper },
            children: [{ type: 'ClawFeed', id: 'feed' }] }
        ] }, { components: [feed], disableTelemetry: true, onError: function () { if (ink) ink.classList.remove('is-on'); } });
      });
    }).then(function (shader) {
      inkShader = shader; inkStarting = false;
      if (wantsPlate()) ink.classList.add('is-on'); else { shader.pause(); inkVideo.pause(); }
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
        if (k % 3 === 0) group.traverse(function (o) { if (o.isMesh && o.material === WHITE) o.material = BONE; });
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
  }

  /* ---------- game state ---------- */
  var claw = { x: 0, z: 0, y: S.topY, open: 1, held: null, grabDist: 0 };
  var state = 'idle', st = 0, closeChecked = false, slipChecked = false;
  var tries = 0, caught = 0, left = 0;
  var counts = { toggle: 0, pill: 0, checkbox: 0, radio: 0, button: 0, input: 0 };
  var keys = { left: false, right: false, up: false, down: false };
  var pad = { left: false, right: false, up: false, down: false };

  function go(s) { state = s; st = 0; closeChecked = false; slipChecked = false; dropBtn.disabled = (s !== 'idle'); }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function inChute(x, z) { return Math.abs(x - S.chute.x) < S.chute.size / 2 && Math.abs(z - S.chute.z) < S.chute.size / 2; }

  function drop() {
    if (state !== 'idle' || left === 0) return;
    tries++;
    setStatus('Dropping…');
    go('drop');
  }

  var tmp = new THREE.Vector3();
  function tryGrab() {
    var best = null, bestD = Infinity;
    items.forEach(function (it) {
      if (it.state !== 'floor') return;
      var dx = it.group.position.x - claw.x, dz = it.group.position.z - claw.z;
      var d = Math.sqrt(dx * dx + dz * dz);
      if (d < bestD) { bestD = d; best = it; }
    });
    if (!best || bestD > S.grabRadius) { setStatus('Nothing in reach.'); return false; }
    var p = bestD < 0.45 ? 1 : clamp(1.25 - bestD / S.grabRadius, 0.2, 1);
    if (Math.random() > p) { setStatus('Just missed the ' + LABELS[best.type].toLowerCase() + '.'); return false; }
    best.group.getWorldPosition(tmp);
    clawGroup.add(best.group);
    best.group.position.set(tmp.x - claw.x, tmp.y - claw.y, tmp.z - claw.z);
    best.state = 'held';
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
            var slipP = claw.grabDist > 0.6 ? 0.22 : 0.0;
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

    clawGroup.position.set(claw.x, claw.y, claw.z);
    var ang = claw.open * 0.5;
    if (state === 'idle' && !reduced) ang += Math.sin(st * 2.2) * 0.03;
    prongs.forEach(function (p) { p.rotation.z = ang; });
    crossbar.position.z = claw.z;
    carriage.position.set(claw.x, S.gantryY, claw.z);
    var len = S.gantryY - claw.y - 0.2;
    cable.scale.y = Math.max(0.01, len);
    cable.position.set(claw.x, claw.y + 0.2 + len / 2, claw.z);
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
    if (ink) { ink.style.width = w + 'px'; ink.style.height = h + 'px'; if (inkShader) { inkShader.resize(w, h); inkShader.update('plate', { frequency: inkLines() }); } }
    camera.aspect = w / h;
    var vf = THREE.MathUtils.degToRad(camera.fov);
    var hf = 2 * Math.atan(Math.tan(vf / 2) * camera.aspect);
    // fit the rotated cabinet: its half-width on screen at this yaw, and the taller of top frame and skirt from the target
    var dist = Math.max(3.9 / Math.tan(hf / 2), 4.75 / Math.tan(vf / 2)) * 1.02;
    camera.position.copy(camTarget).addScaledVector(camDir, dist);
    camera.lookAt(camTarget);
    camera.updateProjectionMatrix();
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
    renderer.render(scene, camera);
  }
  frame();
})();
