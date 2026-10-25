/* The 32-colour desktop: the post pass the Windows 95 look puts every 3D scene through (the fortune
   ball, the claw, the poker peek). The scene is drawn at a fraction of the size into a target, then put
   on screen through a shader that snaps every block to a 32-colour palette after a 4 x 4 ordered dither:
   the gamut of the era, not a filter over a smooth render. Transparent blocks stay transparent, so a
   scene on a transparent canvas lets the page show through.
   The palette is the 16 VGA colours, the four Windows system colours, a dark-grey ramp (shading on dark
   surfaces), and a blue ramp (white type blending into navy in steps instead of jumping through the greys).
   Needs js/three.min.js (r128) loaded first.

   var pass = new THREE.PixelPass(renderer, { snapWhite: true });   // one per renderer; snapWhite (default on) sends light greys to white
   pass.setSize(cssWidth, cssHeight);          // on every resize
   pass.render(scene, camera);                 // in place of renderer.render(scene, camera) */
(function () {
  'use strict';
  if (typeof THREE === 'undefined') return;

  var PX = 2;   // one palette block per 2 CSS pixels: dense enough to read shapes and type, coarse enough to read as era pixels
  var PALETTE = [
    // the 16 VGA colours
    [0, 0, 0], [128, 0, 0], [0, 128, 0], [128, 128, 0], [0, 0, 128], [128, 0, 128], [0, 128, 128], [192, 192, 192],
    [128, 128, 128], [255, 0, 0], [0, 255, 0], [255, 255, 0], [0, 0, 255], [255, 0, 255], [0, 255, 255], [255, 255, 255],
    // the four Windows system colours: money green, sky blue, cream, medium grey
    [192, 220, 192], [166, 202, 240], [255, 251, 240], [160, 160, 164],
    // dark greys, for shading on dark surfaces
    [32, 32, 32], [64, 64, 64], [96, 96, 96], [224, 224, 224],
    // blues between navy and white, for white type on navy
    [0, 0, 64], [0, 0, 96], [0, 0, 160], [32, 32, 160], [64, 64, 192], [96, 96, 192], [128, 128, 224], [192, 192, 240]
  ].map(function (c) { return new THREE.Vector3(c[0] / 255, c[1] / 255, c[2] / 255); });

  var FRAGMENT = [
    'uniform sampler2D tDiffuse; uniform vec3 palette[32]; uniform float cell; uniform float snapWhite; varying vec2 vUv;',
    'float b2(vec2 p) { float x = mod(p.x, 2.0), y = mod(p.y, 2.0); return x * 2.0 + y * 3.0 - x * y * 4.0; }',
    'float bayer(vec2 p) { return (b2(p) * 4.0 + b2(floor(p / 2.0)) + 0.5) / 16.0; }',
    'void main() {',
    '  vec4 c = texture2D(tDiffuse, vUv);',
    '  if (c.a < 0.5) discard;',
    // the target holds linear light; the palette is in screen gamma
    '  vec3 s = pow(clamp(c.rgb, 0.0, 1.0), vec3(1.0 / 2.2));',
    // near-white takes no dither, so white type lands on white instead of breaking into the greys
    '  float amp = 0.24 * (1.0 - smoothstep(0.72, 0.9, dot(s, vec3(0.299, 0.587, 0.114))));',
    '  s = clamp(s + (bayer(floor(gl_FragCoord.xy / cell)) - 0.5) * amp, 0.0, 1.0);',
    // optional: a neutral lighter than mid goes to white, so small black-on-white print (the ball's eye) stays black on
    // white. Off for scenes whose light greys are surfaces (the claw's tinted glass), which keep the palette's greys.
    '  if (snapWhite > 0.5 && abs(s.r - s.g) < 0.06 && abs(s.g - s.b) < 0.06 && s.r > 0.55) { gl_FragColor = vec4(1.0); return; }',
    '  float best = 1e9; vec3 o = vec3(0.0);',
    '  for (int i = 0; i < 32; i++) { float d = distance(s, palette[i]); if (d < best) { best = d; o = palette[i]; } }',
    '  gl_FragColor = vec4(o, 1.0);',
    '}'
  ].join('\n');

  function PixelPass(renderer, opts) {
    this.renderer = renderer;
    this.px = (opts && opts.px) || PX;
    this.target = new THREE.WebGLRenderTarget(64, 64, { minFilter: THREE.NearestFilter, magFilter: THREE.NearestFilter, depthBuffer: true });
    this.material = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: this.target.texture }, palette: { value: PALETTE }, cell: { value: this.px }, snapWhite: { value: opts && opts.snapWhite === false ? 0 : 1 } },
      transparent: true, depthTest: false, depthWrite: false,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: FRAGMENT
    });
    this.quad = new THREE.Scene();
    this.quad.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.material));
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  PixelPass.prototype.setSize = function (w, h) {
    this.target.setSize(Math.max(1, Math.round(w / this.px)), Math.max(1, Math.round(h / this.px)));
    this.material.uniforms.cell.value = this.px * this.renderer.getPixelRatio();
  };
  PixelPass.prototype.render = function (scene, camera) {
    var r = this.renderer, prev = r.getRenderTarget();
    r.setRenderTarget(this.target); r.clear(); r.render(scene, camera);
    r.setRenderTarget(prev); r.render(this.quad, this.camera);
  };
  PixelPass.prototype.dispose = function () { this.target.dispose(); this.material.dispose(); };

  THREE.PixelPass = PixelPass;
})();
