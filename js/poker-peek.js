/* Poker case teaser on the homepage: two cards face down on dark glass. Drag them up (or
   press Enter) to peek, the way a player looks at a hand; press the chip stack and lift to
   riffle it. 70 mm lens, mouse parallax clamped to +-80 px. Needs js/three.min.js (r128) and
   js/Reflector.js (three r128 examples) loaded first. All artwork is drawn on canvas at load. */
(function () {
  'use strict';
  const stage = document.querySelector('.peek');
  if (!stage) return;
  const pin = stage;
  const canvas = stage.querySelector('.peek__canvas');
  const hasGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  if (typeof THREE === 'undefined' || !hasGL) { stage.classList.add('is-flat'); return; }

  const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const DISPLAY = '"Unbounded","Arial Black","Helvetica Neue",Arial,sans-serif';
  const WHITE = '#f4f4f4', BLACK = '#0d0d0d';

  // ---------- card artwork (canvas) ----------
  const CW = 1024, CH = 1434, R = 56;            // 63.5 x 88.9 mm, 3.5 mm corners
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath(); ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
  }
  function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  function drawBack(c) {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, CW, CH);
    roundRect(ctx, 0, 0, CW, CH, R); ctx.fillStyle = WHITE; ctx.fill();
    // black field with a thin white margin
    const m = 30;
    ctx.save(); roundRect(ctx, m, m, CW - 2 * m, CH - 2 * m, R - 18); ctx.clip();
    ctx.fillStyle = BLACK; ctx.fillRect(0, 0, CW, CH);
    // fine scan lines
    ctx.fillStyle = 'rgba(244,244,244,.07)';
    for (let y = m; y < CH - m; y += 6) ctx.fillRect(m, y, CW - 2 * m, 1.5);
    // oversized wordmark, cropped by the field
    ctx.fillStyle = WHITE; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 560px ' + DISPLAY;
    ctx.fillText('LK', CW / 2, CH / 2 + 10);
    // hollow echo behind it, offset up-left
    ctx.strokeStyle = 'rgba(244,244,244,.28)'; ctx.lineWidth = 3;
    ctx.strokeText('LK', CW / 2 - 26, CH / 2 - 42);
    // keyline
    ctx.strokeStyle = WHITE; ctx.lineWidth = 3;
    roundRect(ctx, m + 22, m + 22, CW - 2 * m - 44, CH - 2 * m - 44, R - 36); ctx.stroke();
    // small caps, top and bottom, outside the keyline
    ctx.fillStyle = WHITE; ctx.font = '800 22px ' + DISPLAY; ctx.textAlign = 'left';
    ctx.fillText('L U I Z   K I M   \u2014   L O N D O N', m + 44, m + 70);
    ctx.save(); ctx.translate(CW - m - 44, CH - m - 70); ctx.rotate(Math.PI);
    ctx.fillText('L U I Z   K I M   \u2014   L O N D O N', 0, 0); ctx.restore();
    // corner ticks
    ctx.lineWidth = 3; ctx.strokeStyle = WHITE;
    const tick = (x, y, dx, dy) => { ctx.beginPath(); ctx.moveTo(x, y + dy * 60); ctx.lineTo(x, y); ctx.lineTo(x + dx * 60, y); ctx.stroke(); };
    tick(m + 44, m + 104, 1, 1); tick(CW - m - 44, m + 104, -1, 1);
    tick(m + 44, CH - m - 104, 1, -1); tick(CW - m - 44, CH - m - 104, -1, -1);
    ctx.restore();
  }

  function spade(ctx, cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy - s * 0.5);
    ctx.bezierCurveTo(cx - s * 0.08, cy - s * 0.3, cx - s * 0.5, cy - s * 0.12, cx - s * 0.5, cy + s * 0.08);
    ctx.bezierCurveTo(cx - s * 0.5, cy + s * 0.3, cx - s * 0.2, cy + s * 0.34, cx - s * 0.05, cy + s * 0.14);
    ctx.quadraticCurveTo(cx - s * 0.06, cy + s * 0.36, cx - s * 0.22, cy + s * 0.5);
    ctx.lineTo(cx + s * 0.22, cy + s * 0.5);
    ctx.quadraticCurveTo(cx + s * 0.06, cy + s * 0.36, cx + s * 0.05, cy + s * 0.14);
    ctx.bezierCurveTo(cx + s * 0.2, cy + s * 0.34, cx + s * 0.5, cy + s * 0.3, cx + s * 0.5, cy + s * 0.08);
    ctx.bezierCurveTo(cx + s * 0.5, cy - s * 0.12, cx + s * 0.08, cy - s * 0.3, cx, cy - s * 0.5);
    ctx.closePath(); ctx.fill();
  }
  function club(ctx, cx, cy, s) {
    const r = s * 0.2;
    ctx.beginPath(); ctx.arc(cx, cy - s * 0.26, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx - s * 0.22, cy + s * 0.06, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + s * 0.22, cy + s * 0.06, r, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.2); ctx.lineTo(cx - s * 0.14, cy + s * 0.12); ctx.lineTo(cx + s * 0.14, cy + s * 0.12); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(cx - s * 0.06, cy + s * 0.08);
    ctx.quadraticCurveTo(cx - s * 0.06, cy + s * 0.36, cx - s * 0.22, cy + s * 0.5);
    ctx.lineTo(cx + s * 0.22, cy + s * 0.5);
    ctx.quadraticCurveTo(cx + s * 0.06, cy + s * 0.36, cx + s * 0.06, cy + s * 0.08);
    ctx.closePath(); ctx.fill();
  }
  function drawFace(c, rank, suit) {
    const ctx = c.getContext('2d');
    const pip = suit === 'club' ? club : spade;
    ctx.clearRect(0, 0, CW, CH);
    roundRect(ctx, 0, 0, CW, CH, R); ctx.fillStyle = WHITE; ctx.fill();
    ctx.fillStyle = BLACK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // standard two-corner index: top-left upright, bottom-right rotated
    const idx = (x, y, rot) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.font = '900 150px ' + DISPLAY; ctx.fillText(rank, 0, 0);
      pip(ctx, 0, 124, 96);
      ctx.restore();
    };
    idx(116, 124, 0); idx(CW - 116, CH - 124, Math.PI);
    pip(ctx, CW / 2, CH / 2 - 6, 470);
    ctx.font = '800 20px ' + DISPLAY; ctx.fillStyle = 'rgba(13,13,13,.55)';
    ctx.save(); ctx.translate(CW - 60, CH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('L K', 0, 0); ctx.restore();
  }
  // ---------- noise / felt ----------
  function noiseCanvas(size, base, spread) {
    const c = mkCanvas(size, size), ctx = c.getContext('2d');
    const img = ctx.createImageData(size, size), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (Math.random() - 0.5) * spread;
      d[i] = base[0] + n; d[i + 1] = base[1] + n; d[i + 2] = base[2] + n; d[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    return c;
  }
  function chipTextures(base, stripe) {
    const side = mkCanvas(512, 64), s = side.getContext('2d');
    s.fillStyle = base; s.fillRect(0, 0, 512, 64);
    s.fillStyle = stripe;
    for (let i = 0; i < 8; i++) s.fillRect(i * 64 + 18, 0, 28, 64);
    const top = mkCanvas(256, 256), t = top.getContext('2d');
    t.fillStyle = base; t.beginPath(); t.arc(128, 128, 128, 0, Math.PI * 2); t.fill();
    t.fillStyle = stripe;
    for (let i = 0; i < 8; i++) {
      t.beginPath(); t.arc(128, 128, 128, i * Math.PI / 4 - 0.19, i * Math.PI / 4 + 0.19); t.arc(128, 128, 96, i * Math.PI / 4 + 0.19, i * Math.PI / 4 - 0.19, true); t.closePath(); t.fill();
    }
    t.strokeStyle = stripe; t.globalAlpha = 0.35; t.lineWidth = 2; t.beginPath(); t.arc(128, 128, 84, 0, Math.PI * 2); t.stroke();
    t.globalAlpha = 1; t.fillStyle = stripe; t.font = '900 50px ' + DISPLAY; t.textAlign = 'center'; t.textBaseline = 'middle'; t.fillText('LK', 128, 132);
    return { side, top };
  }

  // ---------- scene ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  // the horizon and fog take the stage colour the page paints behind the table; read it, never assume it
  const stageColor = () => { const c = getComputedStyle(stage).backgroundColor; return (c && !c.startsWith('rgba(0, 0, 0, 0)')) ? c : '#1c1c1c'; /* fallback */ };
  scene.background = new THREE.Color().setStyle(stageColor());
  scene.fog = new THREE.Fog(scene.background.clone(), 42, 120);
  document.addEventListener('theme:change', () => { scene.background.setStyle(stageColor()); scene.fog.color.copy(scene.background); });

  // 70 mm lens on 35 mm gauge; fov is derived from it on every resize
  const camera = new THREE.PerspectiveCamera(30, 1, 1, 400);
  camera.filmGauge = 35;
  const CAM_BASE = new THREE.Vector3(0, 27, 44);
  const LOOK = new THREE.Vector3(0, 0.6, 0.5);
  let camDist = CAM_BASE.distanceTo(LOOK);

  // lights
  scene.add(new THREE.HemisphereLight(0x9a9a9a, 0x141414, 0.38));
  const key = new THREE.SpotLight(0xffffff, 1.6, 0, 0.55, 0.65, 1);
  key.position.set(-18, 56, 22); key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 20; key.shadow.camera.far = 110;
  key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
  scene.add(key, key.target);
  const fill = new THREE.PointLight(0xdcdcdc, 0.26, 0, 2); fill.position.set(30, 18, 42); scene.add(fill);
  const under = new THREE.PointLight(0xffffff, 0.38, 0, 2); under.position.set(2, 8, 26); scene.add(under);
  const rim = new THREE.DirectionalLight(0xbfbfbf, 0.3); rim.position.set(0, 14, -40); scene.add(rim);

  // table: dark glass. A planar mirror (THREE.Reflector, three r128 examples, vendored as js/Reflector.js)
  // held down to a smoked-glass strength, a shadow catcher so the cards and chips still ground, and an
  // additive glossy sheet that carries only the key light's specular streak. Without the helper the table
  // is a plain dark slab.
  const TABLE = new THREE.PlaneGeometry(240, 240);
  if (typeof THREE.Reflector === 'function') {
    const smoked = {
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null } },
      vertexShader: THREE.Reflector.ReflectorShader.vertexShader,
      fragmentShader: `
        uniform vec3 color; uniform sampler2D tDiffuse; varying vec4 vUv;
        void main() {
          vec3 base = texture2DProj(tDiffuse, vUv).rgb;
          // the mirror pass writes linear values: bring them to screen gamma, then hold the reflection down
          gl_FragColor = vec4(pow(base, vec3(1.0 / 2.2)) * color, 1.0);
        }`
    };
    const res = matchMedia('(pointer: coarse)').matches ? 512 : 1024;
    const mirror = new THREE.Reflector(TABLE, { shader: smoked, color: 0x4a4a4a, textureWidth: res, textureHeight: res, clipBias: 0.003 });
    mirror.rotation.x = -Math.PI / 2; scene.add(mirror);
  } else {
    const slab = new THREE.Mesh(TABLE, new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.3, metalness: 0.1 }));
    slab.rotation.x = -Math.PI / 2; slab.receiveShadow = true; scene.add(slab);
  }
  const shadows = new THREE.Mesh(TABLE, new THREE.ShadowMaterial({ opacity: 0.45 }));
  shadows.rotation.x = -Math.PI / 2; shadows.position.y = 0.01; shadows.receiveShadow = true; scene.add(shadows);
  const sheen = new THREE.Mesh(TABLE, new THREE.MeshPhysicalMaterial({ color: 0x000000, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, roughness: 0.32, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.22 }));
  sheen.rotation.x = -Math.PI / 2; sheen.position.y = 0.02; scene.add(sheen);
  // the rail keeps a fine grain
  const feltBump = new THREE.CanvasTexture(noiseCanvas(256, [128, 128, 128], 110));
  feltBump.wrapS = feltBump.wrapT = THREE.RepeatWrapping; feltBump.repeat.set(40, 40);

  // betting line, a faint etch in the glass just in front of the cards
  const line = new THREE.Mesh(new THREE.RingGeometry(56, 56.16, 220, 1, 0, Math.PI * 2),
    new THREE.MeshBasicMaterial({ color: 0xf4f4f4, transparent: true, opacity: 0.22, depthWrite: false }));
  line.rotation.x = -Math.PI / 2; line.position.set(0, 0.03, 66); scene.add(line);

  // padded rail at the bottom of the frame
  const railBump = feltBump;
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 140, 56, 1),
    new THREE.MeshStandardMaterial({ color: 0x0f0f0f, roughness: 0.42, metalness: 0.05, bumpMap: railBump, bumpScale: 0.006 }));
  rail.rotation.z = Math.PI / 2; rail.position.set(0, 1.1, 15); rail.castShadow = true; rail.receiveShadow = true; scene.add(rail);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(140, 0.5, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x8c8c8c, roughness: 0.35, metalness: 0.7 }));
  trim.position.set(0, 0.2, 11.4); trim.receiveShadow = true; scene.add(trim);

  // chips
  function chipStack(n, base, stripe, x, z, rot) {
    const tex = chipTextures(base, stripe);
    const side = new THREE.CanvasTexture(tex.side); side.wrapS = THREE.RepeatWrapping; side.repeat.set(1, 1); side.encoding = THREE.sRGBEncoding;
    const top = new THREE.CanvasTexture(tex.top); top.encoding = THREE.sRGBEncoding;
    const mSide = new THREE.MeshStandardMaterial({ map: side, roughness: 0.45, metalness: 0.05 });
    const mTop = new THREE.MeshStandardMaterial({ map: top, roughness: 0.4, metalness: 0.05 });
    const g = new THREE.CylinderGeometry(1.95, 1.95, 0.33, 48);
    const group = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(g, [mSide, mTop, mTop]);
      m.position.set((Math.random() - 0.5) * 0.12, 0.165 + i * 0.33, (Math.random() - 0.5) * 0.12);
      m.rotation.y = rot + i * 0.37; m.castShadow = true; m.receiveShadow = true; group.add(m);
    }
    group.position.set(x, 0, z); scene.add(group); return group;
  }
  // one stack of seven, the one the hand riffles
  const stack = chipStack(7, '#0d0d0d', '#f4f4f4', 8.4, 5.6, 2.0);
  const chips = stack.children.slice();   // bottom first
  chips.forEach(m => { m.userData.rest = m.position.clone(); m.userData.restRot = m.rotation.y; });

  // cards
  const CARD_W = 6.35, CARD_H = 8.89, CARD_T = 0.045;
  const backCanvas = mkCanvas(CW, CH), faceA = mkCanvas(CW, CH), faceK = mkCanvas(CW, CH);
  drawBack(backCanvas); drawFace(faceA, 'A', 'spade'); drawFace(faceK, 'A', 'club');
  const backTex = new THREE.CanvasTexture(backCanvas); backTex.encoding = THREE.sRGBEncoding; backTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const faceTexA = new THREE.CanvasTexture(faceA); faceTexA.encoding = THREE.sRGBEncoding; faceTexA.anisotropy = backTex.anisotropy;
  const faceTexK = new THREE.CanvasTexture(faceK); faceTexK.encoding = THREE.sRGBEncoding; faceTexK.anisotropy = backTex.anisotropy;
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.85 });
  const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.5, metalness: 0, alphaTest: 0.5 });
  function faceMat(t) { return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0, alphaTest: 0.5 }); }

  // Card geometry: two subdivided planes (back +z, face -z) whose rounded corners are
  // alpha-clipped by the texture, plus a thin rim that follows the rounded outline, so
  // nothing square sticks out past the corners when the card bends.
  function cardGeometry(w, h, t, r, segX, segY, cornerSeg) {
    const pos = [], uv = [], idx = [], groups = [];
    const plane = (zs) => {
      const start = pos.length / 3, i0 = idx.length;
      for (let j = 0; j <= segY; j++) for (let i = 0; i <= segX; i++) {
        pos.push((i / segX - 0.5) * w, (0.5 - j / segY) * h, zs * t / 2);
        uv.push(zs > 0 ? i / segX : 1 - i / segX, 1 - j / segY);
      }
      for (let j = 0; j < segY; j++) for (let i = 0; i < segX; i++) {
        const a = start + j * (segX + 1) + i, b = a + 1, c = a + segX + 1, d = c + 1;
        if (zs > 0) idx.push(a, c, b, b, c, d); else idx.push(a, b, c, b, d, c);
      }
      return [i0, idx.length - i0];
    };
    const g1 = plane(1), g2 = plane(-1);
    // outline of the rounded rectangle, counter-clockwise seen from +z
    const outline = [];
    const corners = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, Math.PI / 2], [-w / 2 + r, -h / 2 + r, Math.PI], [w / 2 - r, -h / 2 + r, Math.PI * 1.5]];
    for (const [cx, cy, a0] of corners) for (let k = 0; k <= cornerSeg; k++) {
      const a = a0 + (k / cornerSeg) * Math.PI / 2;
      outline.push([cx + r * Math.cos(a) * 0.985, cy + r * Math.sin(a) * 0.985]);
    }
    const start = pos.length / 3, i0 = idx.length, n = outline.length;
    for (const [x, y] of outline) { pos.push(x, y, t / 2, x, y, -t / 2); uv.push(0.5, 0.5, 0.5, 0.5); }
    for (let k = 0; k < n; k++) {
      const a = start + 2 * k, b = a + 1, c = start + 2 * ((k + 1) % n), d = c + 1;
      idx.push(a, b, c, b, d, c);
    }
    groups.push([g1[0], g1[1], 0], [g2[0], g2[1], 1], [i0, idx.length - i0, 2]);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    for (const [st, ct, mi] of groups) g.addGroup(st, ct, mi);
    g.computeVertexNormals();
    return g;
  }
  const CARD_R = 0.35;   // 3.5 mm corners, matches the texture clip
  function makeCard(face) {
    const g = cardGeometry(CARD_W, CARD_H, CARD_T, CARD_R, 8, 40, 7);
    const mesh = new THREE.Mesh(g, [backMat, faceMat(face), edgeMat]);
    mesh.userData.orig = g.attributes.position.array.slice();
    mesh.castShadow = true; mesh.receiveShadow = true;
    // rounded-corner shadow: the depth pass clips with the same alpha
    mesh.customDepthMaterial = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, map: backTex, alphaTest: 0.5 });
    return mesh;
  }
  // hinge on the far edge (local +y); the near edge lifts and curls toward the camera.
  const TWIST = 0.42, STEPS = 24;
  function bendCard(card, theta) {
    const orig = card.userData.orig, attr = card.geometry.attributes.position, a = attr.array;
    for (let i = 0; i < a.length; i += 3) {
      const x = orig[i], y = orig[i + 1], z = orig[i + 2];
      const u = CARD_H / 2 - y;
      const thMax = theta * (1 - TWIST + TWIST * (0.5 - x / CARD_W));
      if (thMax < 1e-4 || u <= 0) { a[i] = x; a[i + 1] = y; a[i + 2] = z; continue; }
      const du = u / STEPS; let py = CARD_H / 2, pz = 0, phi = 0;
      for (let k = 0; k < STEPS; k++) {
        phi = thMax * Math.pow(((k + 0.5) * du) / CARD_H, 1.25);
        py -= du * Math.cos(phi); pz += du * Math.sin(phi);
      }
      phi = thMax * Math.pow(u / CARD_H, 1.25);
      a[i] = x; a[i + 1] = py + z * Math.sin(phi); a[i + 2] = pz + z * Math.cos(phi);
    }
    attr.needsUpdate = true;
    card.geometry.computeVertexNormals();
  }

  const hand = new THREE.Group();
  const cardA = makeCard(faceTexA); cardA.rotation.set(-Math.PI / 2, 0, 0.06); cardA.position.set(-0.55, CARD_T / 2 + 0.002, 0);
  const cardK = makeCard(faceTexK); cardK.rotation.set(-Math.PI / 2, 0, -0.13); cardK.position.set(1.55, CARD_T * 1.5 + 0.006, 0.15);
  hand.add(cardA, cardK); hand.position.set(-0.4, 0, 0); scene.add(hand);

  // redraw the artwork once the display face has loaded
  if (document.fonts && document.fonts.load) {
    Promise.all([document.fonts.load('900 100px "Unbounded"'), document.fonts.load('800 20px "Unbounded"')]).then(() => {
      drawBack(backCanvas); drawFace(faceA, 'A', 'spade'); drawFace(faceK, 'A', 'club');
      backTex.needsUpdate = faceTexA.needsUpdate = faceTexK.needsUpdate = true; dirty = true;
    }).catch(() => {});
  }

  // ---------- sizing ----------
  let W = 1, H = 1;
  function resize() {
    W = pin.clientWidth || 1; H = pin.clientHeight || 1;
    renderer.setSize(W, H, false);
    camera.aspect = W / H;
    camera.setFocalLength(70);               // 70 mm look at any aspect
    const dolly = Math.min(1, Math.max(0.7, camera.aspect / 1.6));   // move in on narrow boxes
    // a portrait box crops the sides, so the stack comes forward and in, below the hand
    if (camera.aspect < 1.2) stack.position.set(4.8, 0, 7.6); else stack.position.set(8.4, 0, 5.6);
    camBase.copy(LOOK).add(CAM_BASE.clone().sub(LOOK).multiplyScalar(dolly));
    camDist = camBase.distanceTo(LOOK);
    camera.position.copy(camBase); camera.lookAt(LOOK);
    camera.updateProjectionMatrix();
    dirty = true; placeHits();
  }
  const camBase = CAM_BASE.clone();
  addEventListener('resize', resize, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);

  // ---------- parallax (mouse only, clamped to +-80 px at the card plane) ----------
  const PARALLAX_MAX = 80;
  let pxTarget = 0, px = 0;
  if (matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', e => {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      const n = (e.clientX / (innerWidth || 1) - 0.5) * 2;
      pxTarget = Math.max(-PARALLAX_MAX, Math.min(PARALLAX_MAX, n * PARALLAX_MAX));
    }, { passive: true });
    document.addEventListener('pointerleave', () => { pxTarget = 0; });
  }

  // ---------- hit patches: the hand and the chip stack, projected to the screen ----------
  // Only these two patches take the touch (touch-action: none in CSS), so the page still scrolls
  // everywhere else over the table. They are placed again after every render, so parallax keeps them true.
  const hitCards = stage.querySelector('.peek__hit--cards'), hitChips = stage.querySelector('.peek__hit--chips'), cue = stage.querySelector('.peek__cue');
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const clamp01 = v => Math.min(1, Math.max(0, v));
  const v3 = new THREE.Vector3();
  function project(x, y, z) { v3.set(x, y, z).project(camera); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; }
  function bounds(points, pad) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
  }
  function place(el, b) { el.style.left = b.x + 'px'; el.style.top = b.y + 'px'; el.style.width = b.w + 'px'; el.style.height = b.h + 'px'; }
  function placeHits() {
    if (!hitCards || !hitChips) return;
    camera.updateMatrixWorld(true); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const hx = hand.position.x, hz = hand.position.z;
    const xl = hx - CARD_W * 0.8, xr = hx + CARD_W * 1.15, zf = hz - CARD_H * 0.6, zn = hz + CARD_H * 0.62;
    const cards = bounds([project(xl, 0, zf), project(xr, 0, zf), project(xl, 0, zn), project(xr, 0, zn), project(xl, CARD_H * 0.4, hz), project(xr, CARD_H * 0.4, hz)], 14);
    place(hitCards, cards);
    const sp = stack.position, top = 7 * 0.33 + 6 * 0.55 + 0.6;
    place(hitChips, bounds([project(sp.x - 2.6, 0, sp.z - 2.4), project(sp.x + 2.6, 0, sp.z - 2.4), project(sp.x - 2.6, 0, sp.z + 2.4), project(sp.x + 2.6, 0, sp.z + 2.4), project(sp.x - 3.2, top, sp.z), project(sp.x + 3.2, top, sp.z)], 12));
    if (cue) { const [cx, cy] = project(hx + CARD_W * 0.25, 0, zf); cue.style.left = cx + 'px'; cue.style.top = (cy - 46) + 'px'; }
  }

  // ---------- interaction ----------
  // Cards: press and drag up to peek; let go and they settle back. Enter or Space peeks from the keyboard.
  // Chips: press the stack and lift; the halves riffle apart and clack back bottom-first on release.
  let dragPeek = null, keyPeek = false, dragLift = 0;
  const chipS = chips.map(() => 0), chipV = chips.map(() => 0), chipHold = chips.map(() => 0);
  function touched() { stage.classList.add('is-touched'); }
  function grab(el, onMove, onEnd) {
    if (!el) return;
    el.addEventListener('pointerdown', e => {
      if (e.button) return;
      e.preventDefault(); touched();
      const id = e.pointerId, y0 = e.clientY, ends = ['pointerup', 'pointercancel', 'lostpointercapture'];
      try { el.setPointerCapture(id); } catch (_) {}
      const move = ev => { if (ev.pointerId === id) onMove(y0 - ev.clientY); };
      const end = ev => {
        if (ev.pointerId !== id) return;
        el.removeEventListener('pointermove', move); ends.forEach(n => el.removeEventListener(n, end));
        onEnd();
      };
      el.addEventListener('pointermove', move); ends.forEach(n => el.addEventListener(n, end));
      onMove(0);
    });
  }
  grab(hitCards, dy => { dragPeek = clamp01(dy / 140); dirty = true; }, () => { dragPeek = null; dirty = true; });
  grab(hitChips, dy => { dragLift = clamp01(dy / 110); dirty = true; }, () => {
    dragLift = 0; const now = performance.now(); chips.forEach((_, i) => { chipHold[i] = now + i * 40; }); dirty = true;
  });
  stage.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); touched(); keyPeek = !keyPeek; dirty = true; } });

  function updateChips(dt, now) {
    let moving = false;
    for (let i = 0; i < chips.length; i++) {
      const m = chips[i], rest = m.userData.rest;
      const target = now < chipHold[i] ? chipS[i] : dragLift;
      if (REDUCED) { chipV[i] = 0; chipS[i] = target; }
      else {
        chipV[i] += ((target - chipS[i]) * 170 - chipV[i] * 13) * dt;
        chipS[i] += chipV[i] * dt;
        if (chipS[i] < 0) { chipS[i] = 0; chipV[i] *= -0.3; }   // the clack
      }
      const s = chipS[i], side = i % 2 ? 1 : -1, fan = Math.min(1, i / 2);
      m.position.set(rest.x + s * side * 0.9 * fan, rest.y + s * i * 0.55, rest.z + s * side * 0.25 * fan);
      m.rotation.y = m.userData.restRot + s * 0.4 * i;
      if (Math.abs(chipV[i]) > 0.02 || Math.abs(target - s) > 0.003) moving = true;
    }
    return moving;
  }

  // ---------- frame loop ----------
  let dirty = true, visible = true, lastTheta = -1, lastPx = 0, peek = 0, lastT = performance.now();
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) dirty = true; }, { threshold: 0 });
  io.observe(pin);

  function frame(t) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, Math.max(0.001, (t - lastT) / 1000)); lastT = t;
    if (!visible) return;
    const time = t * 0.001;

    // the peek follows the drag closely, eases back down on release, toggles from the keyboard
    const want = dragPeek !== null ? dragPeek : (keyPeek ? 1 : 0);
    let next = REDUCED ? want : peek + (want - peek) * (1 - Math.exp(-dt * (dragPeek !== null ? 24 : 8)));
    if (Math.abs(want - next) < 1e-3) next = want;
    if (next !== peek) { peek = next; dirty = true; }
    const c = ease(peek);
    let theta = c * 1.5;                      // up to ~86 deg
    if (!REDUCED && c > 0.01) theta += c * (0.012 * Math.sin(time * 7.1) + 0.008 * Math.sin(time * 11.3 + 1.7));
    if (Math.abs(theta - lastTheta) > 1e-4) {
      bendCard(cardA, theta); bendCard(cardK, theta * 1.04);
      hand.position.z = c * 1.1;
      lastTheta = theta; dirty = true;
    }

    if (updateChips(dt, t)) dirty = true;

    // parallax
    px += (pxTarget - px) * (REDUCED ? 1 : 0.085);
    if (Math.abs(px - lastPx) > 0.02) {
      const vfov = THREE.MathUtils.degToRad(camera.fov);
      const worldPerPx = (2 * camDist * Math.tan(vfov / 2)) / H;
      camera.position.x = camBase.x + px * worldPerPx;
      lastPx = px; dirty = true;
    }

    if (dirty) { renderer.render(scene, camera); placeHits(); dirty = false; }
  }
  resize();
  bendCard(cardA, 0); bendCard(cardK, 0);
  requestAnimationFrame(frame);
})();
