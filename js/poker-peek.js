/* Poker case teaser on the homepage: two cards face down on dark glass. Drag them up (or
   press Enter) to peek, the way a player looks at a hand; press the chip stack and lift to
   riffle it. 30 mm lens fitted to the box, mouse parallax clamped to +-80 px. Needs js/three.min.js (r128) and
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

  // The deck follows the site theme: every look deals its own back, its own chips, and its own light.
  // Charcoal: the LK back on dark glass. Brutalist ("manual"): a machine-manual card on unbleached
  // paper. Broadsheet ("press"): an engraved card on newsprint. Windows 95 ("win95"): Solitaire, a
  // pixel beach on a white card over flat green. Esports ("foil"): holographic foil. The two
  // image-based backs load the first time their theme is seen; the LK back stands in until then.
  // Each look's type comes from its theme's own faces, loaded by the theme stylesheet. Which look a theme
  // deals is the theme's own call: its stylesheet sets --look on <html>, and this script never reads the theme name.
  const ARCHIVO = 'condensed 900 ', ARCHIVO_F = '"Archivo","Helvetica Neue",Arial,sans-serif';
  const MONO = '"IBM Plex Mono",ui-monospace,Menlo,monospace';
  const PLAYFAIR = '"Playfair Display",Georgia,"Times New Roman",serif';
  const SERIF = '"Source Serif 4",Georgia,"Times New Roman",serif';
  const FONTS = {
    manual: ['condensed 900 100px "Archivo"', '500 20px "IBM Plex Mono"'],
    press: ['900 100px "Playfair Display"', '400 20px "Source Serif 4"']
  };
  // the theme stylesheet names the look on <html> as --look (manual, press, win95, foil); charcoal names none
  const look = () => getComputedStyle(document.documentElement).getPropertyValue('--look').trim() || 'default';
  const ART = { win95: 'img/poker/back-beach.png', foil: 'img/poker/back-foil.jpg', foilBump: 'img/poker/back-foil-bump.jpg' };
  const images = {};
  function image(key) {
    const im = images[key];
    if (im) return im.complete && im.naturalWidth ? im : null;
    const n = new Image(); n.decoding = 'async'; n.onload = () => redrawAll(); n.src = ART[key]; images[key] = n;
    return null;
  }

  function drawBack(c) {
    const l = look();
    if (l === 'win95') return drawBackWin95(c);
    if (l === 'foil') return drawBackFoil(c);
    if (l === 'manual') return drawBackManual(c);
    if (l === 'press') return drawBackPress(c);
    drawBackLK(c);
  }

  // Brutalist: a page of the machine manual. Unbleached paper, carbon rules boxing every zone,
  // stencil-mono labels like a crate marking, the LK stacked in condensed capitals, one hazard red block.
  const PAPER = '#efede7', CARBON = '#0c0c0c', HAZARD = '#c4161c';
  function drawBackManual(c) {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, CW, CH);
    roundRect(ctx, 0, 0, CW, CH, R); ctx.fillStyle = PAPER; ctx.fill();
    const m = 44, w = CW - 2 * m, h = CH - 2 * m;
    ctx.strokeStyle = CARBON; ctx.fillStyle = CARBON; ctx.lineWidth = 8;
    ctx.strokeRect(m, m, w, h);
    // the grid: a header band, the figure, a footer of fields
    const top = m + 96, bot = CH - m - 150;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(m, top); ctx.lineTo(CW - m, top); ctx.moveTo(m, bot); ctx.lineTo(CW - m, bot); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(CW / 2, bot); ctx.lineTo(CW / 2, CH - m); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(m + w * 0.62, m); ctx.lineTo(m + w * 0.62, top); ctx.stroke();
    // header: part number, the hazard block on the right
    ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
    ctx.font = '500 26px ' + MONO;
    ctx.fillText('LK-001  \u00b7  CARD, BACK', m + 28, m + 48);
    ctx.fillStyle = HAZARD; ctx.fillRect(m + w * 0.62 + 4, m + 4, w * 0.38 - 4, 96 - 8);
    ctx.save(); ctx.beginPath(); ctx.rect(m + w * 0.62 + 4, m + 4, w * 0.38 - 4, 88); ctx.clip();
    ctx.strokeStyle = PAPER; ctx.lineWidth = 10;
    for (let x = -120; x < w * 0.4 + 120; x += 44) { ctx.beginPath(); ctx.moveTo(m + w * 0.62 + x, m + 100); ctx.lineTo(m + w * 0.62 + x + 90, m); ctx.stroke(); }
    ctx.restore();
    // the figure: L over K, stacked capitals, condensed and heavy
    ctx.fillStyle = CARBON; ctx.textAlign = 'center';
    ctx.font = ARCHIVO + '640px ' + ARCHIVO_F;
    ctx.fillText('L', CW / 2, top + (bot - top) * 0.30);
    ctx.fillText('K', CW / 2, top + (bot - top) * 0.72);
    ctx.font = '500 22px ' + MONO; ctx.textAlign = 'left';
    ctx.fillText('FIG. 1', m + 28, top + 34);
    ctx.textAlign = 'right'; ctx.fillText('63.5 \u00d7 88.9 MM', CW - m - 28, top + 34);
    // footer fields
    ctx.textAlign = 'left'; ctx.font = '500 20px ' + MONO;
    ctx.fillText('MAKER', m + 28, bot + 36); ctx.fillText('ORIGIN', CW / 2 + 28, bot + 36);
    ctx.font = ARCHIVO + '44px ' + ARCHIVO_F;
    ctx.fillText('LUIZ KIM', m + 28, bot + 96); ctx.fillText('LONDON', CW / 2 + 28, bot + 96);
    ctx.font = '500 20px ' + MONO; ctx.fillText('\u00ae', CW - m - 52, bot + 36);
  }

  // Broadsheet: an engraved card. Cream newsprint, a hatched border band between rules, the
  // nameplate LK in the Playfair black, a line of small capitals with hairlines, as a masthead.
  const CREAM = '#faf8f4', INK = '#1a1715';
  function hatch(ctx, x, y, w, h, step, alpha, both) {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    ctx.strokeStyle = INK; ctx.globalAlpha = alpha; ctx.lineWidth = 1.2;
    for (let d = -h; d < w + h; d += step) { ctx.beginPath(); ctx.moveTo(x + d, y); ctx.lineTo(x + d + h, y + h); ctx.stroke(); }
    if (both) for (let d = -h; d < w + h; d += step) { ctx.beginPath(); ctx.moveTo(x + d + h, y); ctx.lineTo(x + d, y + h); ctx.stroke(); }
    ctx.restore();
  }
  function drawBackPress(c) {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, CW, CH);
    roundRect(ctx, 0, 0, CW, CH, R); ctx.fillStyle = CREAM; ctx.fill();
    const m = 40, w = CW - 2 * m, h = CH - 2 * m, band = 54;
    // the border: rule, hatched band, rule; cross-hatched in the corners
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(m, m, w, h);
    hatch(ctx, m, m, w, band, 7, 0.55, false); hatch(ctx, m, CH - m - band, w, band, 7, 0.55, false);
    hatch(ctx, m, m + band, band, h - 2 * band, 7, 0.55, false); hatch(ctx, CW - m - band, m + band, band, h - 2 * band, 7, 0.55, false);
    [[m, m], [CW - m - band, m], [m, CH - m - band], [CW - m - band, CH - m - band]].forEach(([x, y]) => hatch(ctx, x, y, band, band, 7, 0.5, true));
    ctx.lineWidth = 1.5; ctx.strokeRect(m + band, m + band, w - 2 * band, h - 2 * band);
    // the masthead: nameplate over a double rule, small capitals under
    const cx = CW / 2, cy = CH / 2;
    // a fine sunburst of hairlines behind the plate
    ctx.save(); ctx.strokeStyle = INK; ctx.globalAlpha = 0.28; ctx.lineWidth = 1;
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 36) {
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * 250, cy - 40 + Math.sin(a) * 250); ctx.lineTo(cx + Math.cos(a) * 330, cy - 40 + Math.sin(a) * 330); ctx.stroke();
    }
    ctx.restore();
    ctx.fillStyle = INK; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '900 400px ' + PLAYFAIR;
    ctx.fillText('LK', cx, cy - 40);
    ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(cx - 300, cy + 190); ctx.lineTo(cx + 300, cy + 190); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 300, cy + 200); ctx.lineTo(cx + 300, cy + 200); ctx.stroke();
    ctx.font = '600 24px -apple-system,"Segoe UI",Helvetica,Arial,sans-serif';
    ctx.fillText('L U I Z   K I M   \u00b7   L O N D O N', cx, cy + 244);
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(cx - 300, cy - 290); ctx.lineTo(cx + 300, cy - 290); ctx.stroke();
    ctx.font = 'italic 400 30px ' + SERIF;
    ctx.fillText('Est. London', cx, cy - 330);
  }

  // Windows Solitaire: a white card with a black hairline; the art is scaled by a whole number so every
  // pixel stays square, inside the one-pixel black border the 95 decks had.
  const PX = 9, AW = 100 * PX, AH = 141 * PX, AX = (CW - AW) / 2, AY = (CH - AH) / 2;
  function drawBackWin95(c) {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, CW, CH);
    roundRect(ctx, 0, 0, CW, CH, R); ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.lineWidth = 8; ctx.strokeStyle = '#000000'; roundRect(ctx, 4, 4, CW - 8, CH - 8, R - 4); ctx.stroke();
    ctx.fillStyle = '#000000'; ctx.fillRect(AX - PX, AY - PX, AW + 2 * PX, AH + 2 * PX);
    const im = image('win95');
    if (im) { ctx.imageSmoothingEnabled = false; ctx.drawImage(im, AX, AY, AW, AH); ctx.imageSmoothingEnabled = true; }
    else { ctx.fillStyle = '#00aaff'; ctx.fillRect(AX, AY, AW, AH); }   // the sky, until the art arrives
  }

  // Holographic foil: dark indigo print (keyline, LK, the caps) on pale foil stock. The rainbow is not
  // in the picture; the material makes it from the view angle and the relief, so it moves with the card.
  function drawBackFoil(c) {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, CW, CH);
    roundRect(ctx, 0, 0, CW, CH, R); ctx.fillStyle = '#d9d7e4'; ctx.fill();
    const im = image('foil');
    if (im) { ctx.save(); roundRect(ctx, 0, 0, CW, CH, R); ctx.clip(); ctx.drawImage(im, 0, 0, CW, CH); ctx.restore(); }
    foilPrint(ctx, '#120a2c', 1);
  }
  function foilPrint(ctx, ink, alpha) {
    const m = 30;
    ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = ink; ctx.fillStyle = ink;
    ctx.lineWidth = 3; roundRect(ctx, m + 22, m + 22, CW - 2 * m - 44, CH - 2 * m - 44, R - 36); ctx.stroke();
    ctx.lineWidth = 1.5; roundRect(ctx, m + 38, m + 38, CW - 2 * m - 76, CH - 2 * m - 76, R - 46); ctx.stroke();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.font = '900 300px ' + DISPLAY;
    ctx.fillText('LK', CW / 2, CH / 2 + 6);
    ctx.font = '800 22px ' + DISPLAY; ctx.textAlign = 'left';
    ctx.fillText('L U I Z   K I M   —   L O N D O N', m + 64, m + 94);
    ctx.save(); ctx.translate(CW - m - 64, CH - m - 94); ctx.rotate(Math.PI); ctx.fillText('L U I Z   K I M   —   L O N D O N', 0, 0); ctx.restore();
    ctx.restore();
  }
  // the relief: the foil's folds, with the print pressed into them (darker is lower)
  const BW = 512, BH = 748;
  function drawBump(c) {
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#808080'; ctx.fillRect(0, 0, BW, BH);
    const im = look() === 'foil' ? image('foilBump') : null;   // fetched only once the foil is dealt
    if (im) ctx.drawImage(im, 0, 0, BW, BH);
    ctx.save(); ctx.scale(BW / CW, BH / CH); foilPrint(ctx, '#000000', 0.45); ctx.restore();
  }

  // Solitaire drew at 71 x 96; the faces go down to the same kind of grid and back up, square pixels
  function pixelate(c, f) {
    const small = mkCanvas(Math.round(c.width / f), Math.round(c.height / f)), s = small.getContext('2d');
    s.drawImage(c, 0, 0, small.width, small.height);
    const ctx = c.getContext('2d'); ctx.clearRect(0, 0, c.width, c.height);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(small, 0, 0, c.width, c.height); ctx.imageSmoothingEnabled = true;
  }

  function drawBackLK(c) {
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
    const l = look(), solitaire = l === 'win95';
    const stock = { win95: '#ffffff', manual: PAPER, press: CREAM }[l] || WHITE;
    const inkOf = { win95: '#000000', manual: CARBON, press: INK }[l] || BLACK;
    const rankFont = l === 'manual' ? ARCHIVO + '150px ' + ARCHIVO_F : l === 'press' ? '900 150px ' + PLAYFAIR : '900 150px ' + DISPLAY;
    roundRect(ctx, 0, 0, CW, CH, R); ctx.fillStyle = stock; ctx.fill();
    if (solitaire) { ctx.lineWidth = 8; ctx.strokeStyle = '#000000'; roundRect(ctx, 4, 4, CW - 8, CH - 8, R - 4); ctx.stroke(); }
    if (l === 'manual') { ctx.lineWidth = 8; ctx.strokeStyle = CARBON; ctx.strokeRect(44, 44, CW - 88, CH - 88); }
    if (l === 'press') { ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.strokeRect(40, 40, CW - 80, CH - 80); ctx.lineWidth = 1.5; ctx.strokeRect(52, 52, CW - 104, CH - 104); }
    ctx.fillStyle = inkOf; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    // standard two-corner index: top-left upright, bottom-right rotated
    const idx = (x, y, rot) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.font = rankFont; ctx.fillText(rank, 0, 0);
      pip(ctx, 0, 124, 96);
      ctx.restore();
    };
    idx(116, 124, 0); idx(CW - 116, CH - 124, Math.PI);
    pip(ctx, CW / 2, CH / 2 - 6, 470);
    ctx.font = '800 20px ' + DISPLAY; ctx.fillStyle = 'rgba(13,13,13,.55)';
    ctx.save(); ctx.translate(CW - 60, CH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText('L K', 0, 0); ctx.restore();
    if (solitaire) pixelate(c, 8);
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
  // The chips match the deck. Each look names a base, a stripe and a mark colour, the face the mark
  // is set in, and the finish; the capping chip may differ (the hazard red one, the gold one).
  const CHIPS = {
    default: { base: '#0d0d0d', stripe: '#f4f4f4', mark: '#f4f4f4', font: '900 50px ' + DISPLAY, rough: 0.45, metal: 0.05 },
    manual: { base: PAPER, stripe: CARBON, mark: CARBON, font: ARCHIVO + '58px ' + ARCHIVO_F, rough: 0.92, metal: 0,
      cap: { base: HAZARD, stripe: PAPER, mark: PAPER } },
    press: { base: CREAM, stripe: INK, mark: INK, font: '900 54px ' + PLAYFAIR, rough: 0.88, metal: 0, hatched: true },
    win95: { base: '#ff0000', stripe: '#ffffff', mark: '#ffffff', font: '900 50px ' + DISPLAY, rough: 1, metal: 0, pixel: 8 },
    foil: { base: '#1d1247', stripe: '#b7a2ff', mark: '#ffcf3a', font: '900 50px ' + DISPLAY, rough: 0.3, metal: 0.35,
      cap: { base: '#1d1247', stripe: '#ffcf3a', mark: '#ffcf3a' } }
  };
  function chipTextures(pal, side, top) {
    const s = side.getContext('2d');
    s.clearRect(0, 0, 512, 64);
    s.fillStyle = pal.base; s.fillRect(0, 0, 512, 64);
    s.fillStyle = pal.stripe;
    for (let i = 0; i < 8; i++) s.fillRect(i * 64 + 18, 0, 28, 64);
    const t = top.getContext('2d');
    t.clearRect(0, 0, 256, 256);
    t.fillStyle = pal.base; t.beginPath(); t.arc(128, 128, 128, 0, Math.PI * 2); t.fill();
    if (pal.hatched) { t.save(); t.beginPath(); t.arc(128, 128, 128, 0, Math.PI * 2); t.clip(); hatch(t, 0, 0, 256, 256, 5, 0.3, false); t.restore(); }
    t.fillStyle = pal.stripe;
    for (let i = 0; i < 8; i++) {
      t.beginPath(); t.arc(128, 128, 128, i * Math.PI / 4 - 0.19, i * Math.PI / 4 + 0.19); t.arc(128, 128, 96, i * Math.PI / 4 + 0.19, i * Math.PI / 4 - 0.19, true); t.closePath(); t.fill();
    }
    t.strokeStyle = pal.stripe; t.globalAlpha = pal.hatched ? 0.9 : 0.35; t.lineWidth = 2; t.beginPath(); t.arc(128, 128, 84, 0, Math.PI * 2); t.stroke();
    t.globalAlpha = 1; t.fillStyle = pal.mark; t.font = pal.font; t.textAlign = 'center'; t.textBaseline = 'middle'; t.fillText('LK', 128, 132);
    if (pal.pixel) { pixelate(side, pal.pixel / 2); pixelate(top, pal.pixel / 2); }
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

  // lights: one fixed rig (hemisphere, key spot, fill, under, rim), so a look change never recompiles
  // a material; each look sets the colours and intensities, where the key hangs and how wide it opens,
  // the smoke in the glass, the fog, and the room the scene sits in (an image-based environment, see RIGS).
  const hemi = new THREE.HemisphereLight(0x9a9a9a, 0x141414, 0.38); scene.add(hemi);
  const key = new THREE.SpotLight(0xffffff, 1.6, 0, 0.55, 0.65, 1);
  key.position.set(-18, 56, 22); key.target.position.set(0, 0, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 20; key.shadow.camera.far = 110;
  key.shadow.bias = -0.0003; key.shadow.normalBias = 0.008;
  scene.add(key, key.target);
  const fill = new THREE.PointLight(0xdcdcdc, 0.26, 0, 2); fill.position.set(30, 18, 42); scene.add(fill);
  const under = new THREE.PointLight(0xffffff, 0.38, 0, 2); under.position.set(2, 8, 26); scene.add(under);
  const rim = new THREE.DirectionalLight(0xbfbfbf, 0.3); rim.position.set(0, 14, -40); scene.add(rim);
  // The light sets the mood, and the table carries it. Each look is a place:
  // Charcoal, a card room after hours: a tall white softbox on each side of the table, nothing overhead,
  //   the rest of the room black, so the glass holds two long streaks and the chips take a hard edge each side.
  // Manual, a copy desk under a skylight: flat overcast daylight from straight above, a wide cone, one
  //   soft-edged shadow, no film curve and no gloss, print as print.
  // Press, a reading lamp late: one warm bulb low from the upper left, a tight cone that pools on the
  //   paper and lets the edges of the slab fall into shade, warm bounce off the desk, long shadows.
  // Win95, Solitaire: no light at all, a flat green with a stamped shadow.
  // Foil, the arena: a low violet key, cyan and rose rims, the glass smoked indigo, fog that swallows the
  //   horizon close, and a room lit by thin colour strips alone, no softbox, for the foil and the gilt to catch.
  // key: [colour, intensity, penumbra, angle, position]; fill: [colour, intensity, position]; mirror: the smoke
  // in the glass; fog: [near, far]; neon: the arena's tubes, which the glass reflects;
  // room: the image-based environment (built once per look, see roomEnv); env: how much of it the materials take.
  const RIGS = {
    default: { hemi: [0x9a9a9a, 0x101010, 0.3], key: [0xffffff, 1.55, 0.7, 0.5, [-46, 36, 16]], fill: [0xffffff, 0.75, [46, 34, 16]], under: [0xffffff, 0.22], rim: [0xaab6c4, 0.3], table: 'glass', mirror: 0x4a4a4a, fog: [42, 120], tone: true, exposure: 1.05, shadow: 0.5, room: 'cardroom', env: 0.7 },
    manual: { hemi: [0xffffff, 0xd8d3c8, 1.0], key: [0xffffff, 0.85, 0.3, 0.95, [2, 72, 8]], fill: [0xffffff, 0.06], under: [0xffffff, 0], rim: [0xffffff, 0], table: 'flat', fog: [60, 160], tone: false, exposure: 1, shadow: 0.4, room: 'overcast', env: 0.35 },
    press: { hemi: [0xfff3e2, 0xcbbfa8, 0.42], key: [0xffcf92, 1.75, 0.9, 0.33, [-30, 38, 20]], fill: [0xffe6c8, 0.14], under: [0xffdcb0, 0.1], rim: [0xffffff, 0], table: 'matte', fog: [48, 130], tone: true, exposure: 1.18, shadow: 0.34, room: 'lamp', env: 0.6 },
    win95: { hemi: [0xffffff, 0xffffff, 1.0], key: [0xffffff, 0.55, 0.65, 0.55, [-18, 56, 22]], fill: [0xffffff, 0], under: [0xffffff, 0], rim: [0xffffff, 0], table: 'felt', fog: [60, 160], tone: false, exposure: 1, shadow: 0.3, room: null, env: 0 },
    foil: { hemi: [0x8fe4ff, 0x2a1a66, 0.24], key: [0xc3b4ff, 0.55, 0.9, 0.5, [-12, 50, 28]], fill: [0xff9df0, 0.3], under: [0x8fe4ff, 0.2], rim: [0x8fe4ff, 0.6], table: 'glass', mirror: 0x6a5aa0, fog: [34, 96], tone: true, exposure: 1.0, shadow: 0.55, room: 'arena', env: 0.9, neon: true }
  };
  function setLight(l, c, i, pen) { l.color.setHex(c); l.intensity = i; if (pen !== undefined) l.penumbra = pen; }
  // the rooms: small lit boxes rendered once into a prefiltered environment (PMREM), the vendored three has
  // no HDR loader and the page needs no download for this. Each lamp is a plane facing the centre:
  // [width, height, x, y, z, colour, gain]. Built on first use, kept for the tab.
  const ROOMS = {
    cardroom: { bg: 0x070707, lamps: [[4, 14, -11, 4, 2, 0xffffff, 3.4], [4, 14, 11, 4, 2, 0xffffff, 3.4], [10, 2, 0, 1, -10, 0x5a5a5a, 0.8]] },
    overcast: { bg: 0xe6e3dc, lamps: [[24, 24, 0, 10, 0, 0xffffff, 1.25], [24, 6, 0, -8, 0, 0xcfcac0, 0.9]] },
    lamp: { bg: 0x241c12, lamps: [[5, 5, -8, 7, 4, 0xffd29a, 5.5], [14, 6, 4, -2, 6, 0xd9c7a6, 1.0], [8, 3, 0, 4, -9, 0x6a5840, 0.8], [3, 8, 9, 3, 0, 0x8a7458, 0.6]] },
    arena: { bg: 0x0e0a20, lamps: [[16, 0.5, 0, 8, 3, 0x6fd8f4, 2.6], [16, 0.5, 0, 6.5, -4, 0xe88ad8, 2.4], [0.5, 12, -10, 3, 2, 0xe88ad8, 2.0], [0.5, 12, 10, 3, -1, 0x6fd8f4, 2.0], [14, 0.5, 0, 2, -10, 0xb9a6ff, 1.6]] }   // strip lights, no softbox
  };
  const envs = {};
  function roomEnv(name) {
    if (!name || !ROOMS[name]) return null;
    if (envs[name]) return envs[name];
    const r = ROOMS[name], s = new THREE.Scene(); s.background = new THREE.Color(r.bg);
    r.lamps.forEach(([w, h, x, y, z, hex, gain]) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide }));
      m.material.color.multiplyScalar(gain); m.position.set(x, y, z); m.lookAt(0, 0, 0); s.add(m);
    });
    const g = new THREE.PMREMGenerator(renderer);
    const t = g.fromScene(s, 0.04).texture; g.dispose();
    s.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    return (envs[name] = t);
  }
  // everything that takes the room: set per look so a paper look stays matte while the arena blazes
  const lit = [];

  // table: dark glass. A planar mirror (THREE.Reflector, three r128 examples, vendored as js/Reflector.js)
  // held down to a smoked-glass strength, a shadow catcher so the cards and chips still ground, and an
  // additive glossy sheet that carries only the key light's specular streak. Without the helper the table
  // is a plain dark slab.
  const TABLE = new THREE.PlaneGeometry(240, 240);
  const glass = [];   // everything that is the glass table, hidden under Solitaire
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
    mirror.rotation.x = -Math.PI / 2; scene.add(mirror); glass.push(mirror); glass.mirror = mirror;
  } else {
    const slab = new THREE.Mesh(TABLE, new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.3, metalness: 0.1 }));
    slab.rotation.x = -Math.PI / 2; slab.receiveShadow = true; scene.add(slab); glass.push(slab);
  }
  // the unlit table (Solitaire's green, the manual's paper): one flat colour, no reflection; the shadow catcher above it still grounds the cards
  const felt = new THREE.Mesh(TABLE, new THREE.MeshBasicMaterial({ color: 0x008000 }));
  felt.rotation.x = -Math.PI / 2; felt.visible = false; scene.add(felt);
  // the paper looks: a matte slab in the stage's own colour, with a fine grain, no reflection
  const matte = new THREE.Mesh(TABLE, new THREE.MeshStandardMaterial({ color: 0xe4e1d9, roughness: 0.96, metalness: 0 }));
  matte.rotation.x = -Math.PI / 2; matte.visible = false; matte.receiveShadow = true; scene.add(matte);
  const shadows = new THREE.Mesh(TABLE, new THREE.ShadowMaterial({ opacity: 0.45 }));
  shadows.rotation.x = -Math.PI / 2; shadows.position.y = 0.01; shadows.receiveShadow = true; scene.add(shadows);
  const sheen = new THREE.Mesh(TABLE, new THREE.MeshPhysicalMaterial({ color: 0x000000, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, roughness: 0.32, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.22 }));
  sheen.rotation.x = -Math.PI / 2; sheen.position.y = 0.02; scene.add(sheen); glass.push(sheen);
  // the rail keeps a fine grain
  const feltBump = new THREE.CanvasTexture(noiseCanvas(256, [128, 128, 128], 110));
  feltBump.wrapS = feltBump.wrapT = THREE.RepeatWrapping; feltBump.repeat.set(40, 40);
  matte.material.bumpMap = feltBump; matte.material.bumpScale = 0.012;

  // the arena's neon: tubes across the back of the table and up each side, unlit and unfogged so they burn,
  // put there for the glass to reflect; shown by the foil look alone
  const neon = new THREE.Group(); neon.visible = false; scene.add(neon);
  function tube(len, x, y, z, ry, hex) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, len, 10, 1), new THREE.MeshBasicMaterial({ color: hex, fog: false }));
    m.rotation.z = Math.PI / 2; m.rotation.y = ry; m.position.set(x, y, z); neon.add(m); return m;
  }
  tube(140, 0, 4.5, -44, 0, 0x6fd8f4); tube(140, 0, 8, -45, 0, 0xe88ad8); tube(140, 0, 11.5, -46, 0, 0xb9a6ff);   // three lines across the back
  tube(80, -60, 8, -4, Math.PI / 2, 0xe88ad8); tube(80, 60, 8, -4, Math.PI / 2, 0x6fd8f4);                     // one up each side

  // betting line, a faint etch in the glass just in front of the cards
  const line = new THREE.Mesh(new THREE.RingGeometry(56, 56.16, 220, 1, 0, Math.PI * 2),
    new THREE.MeshBasicMaterial({ color: 0xf4f4f4, transparent: true, opacity: 0.22, depthWrite: false }));
  line.rotation.x = -Math.PI / 2; line.position.set(0, 0.03, 66); scene.add(line); glass.push(line);

  // padded rail at the bottom of the frame
  const railBump = feltBump;
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 140, 56, 1),
    new THREE.MeshStandardMaterial({ color: 0x0f0f0f, roughness: 0.42, metalness: 0.05, bumpMap: railBump, bumpScale: 0.006 }));
  rail.rotation.z = Math.PI / 2; rail.position.set(0, 1.1, 15); rail.castShadow = true; rail.receiveShadow = true; scene.add(rail); glass.push(rail);
  const trim = new THREE.Mesh(new THREE.BoxGeometry(140, 0.5, 1.2),
    new THREE.MeshStandardMaterial({ color: 0x8c8c8c, roughness: 0.35, metalness: 0.7 }));
  trim.position.set(0, 0.2, 11.4); trim.receiveShadow = true; scene.add(trim); glass.push(trim);

  // chips
  // two sets of chip art (the stack, and its capping chip), repainted in place when the look changes
  function chipSet() {
    const sideC = mkCanvas(512, 64), topC = mkCanvas(256, 256);
    const side = new THREE.CanvasTexture(sideC); side.wrapS = THREE.RepeatWrapping; side.encoding = THREE.sRGBEncoding;
    const top = new THREE.CanvasTexture(topC); top.encoding = THREE.sRGBEncoding;
    const mSide = new THREE.MeshStandardMaterial({ map: side, roughness: 0.45, metalness: 0.05 });
    const mTop = new THREE.MeshStandardMaterial({ map: top, roughness: 0.4, metalness: 0.05 });
    return { sideC, topC, side, top, mats: [mSide, mTop, mTop] };
  }
  const chipMain = chipSet(), chipCap = chipSet();
  function drawChips() {
    const pal = CHIPS[look()] || CHIPS.default, cap = Object.assign({}, pal, pal.cap || {});
    chipTextures(pal, chipMain.sideC, chipMain.topC); chipTextures(cap, chipCap.sideC, chipCap.topC);
    [chipMain, chipCap].forEach(set => {
      set.side.needsUpdate = set.top.needsUpdate = true;
      set.mats.forEach(m => { m.roughness = pal.rough; m.metalness = pal.metal; });
    });
  }
  function chipStack(n, x, z, rot) {
    const g = new THREE.CylinderGeometry(1.95, 1.95, 0.33, 48);
    const group = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(g, (i === n - 1 ? chipCap : chipMain).mats);
      m.position.set((Math.random() - 0.5) * 0.12, 0.165 + i * 0.33, (Math.random() - 0.5) * 0.12);
      m.rotation.y = rot + i * 0.37; m.castShadow = true; m.receiveShadow = true; group.add(m);
    }
    group.position.set(x, 0, z); scene.add(group); return group;
  }
  // one stack of seven, the one the hand riffles
  drawChips();
  const stack = chipStack(7, 8.4, 5.6, 2.0);
  const chips = stack.children.slice();   // bottom first
  chips.forEach(m => { m.userData.rest = m.position.clone(); m.userData.restRot = m.rotation.y; });

  // cards
  const CARD_W = 6.35, CARD_H = 8.89, CARD_T = 0.12;   // a 1.2 mm stock at this scale, so the edge reads and the card grounds
  const backCanvas = mkCanvas(CW, CH), faceA = mkCanvas(CW, CH), faceK = mkCanvas(CW, CH);
  drawBack(backCanvas); drawFace(faceA, 'A', 'spade'); drawFace(faceK, 'A', 'club');
  const backTex = new THREE.CanvasTexture(backCanvas); backTex.encoding = THREE.sRGBEncoding; backTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  const faceTexA = new THREE.CanvasTexture(faceA); faceTexA.encoding = THREE.sRGBEncoding; faceTexA.anisotropy = backTex.anisotropy;
  const faceTexK = new THREE.CanvasTexture(faceK); faceTexK.encoding = THREE.sRGBEncoding; faceTexK.anisotropy = backTex.anisotropy;
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xf4f4f4, roughness: 0.85 });
  const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.5, metalness: 0, alphaTest: 0.5 });
  const backFlat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 1, metalness: 0, alphaTest: 0.5 });   // Solitaire: no gloss
  function faceMat(t) { return new THREE.MeshStandardMaterial({ map: t, roughness: 0.55, metalness: 0, alphaTest: 0.5 }); }

  // Foil: a metal with the folds as relief and a thin-film colour laid over the diffuse term. The hue
  // turns with the angle between the eye and the (bumped) surface and slides along the folds, so it
  // travels when the card lifts and when the camera drifts on parallax. The dark print is masked out
  // by its own darkness. The arena room (RIGS.foil) gives the silver something to reflect.
  const bumpCanvas = mkCanvas(BW, BH); drawBump(bumpCanvas);
  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  const foilMat = new THREE.MeshStandardMaterial({ map: backTex, bumpMap: bumpTex, bumpScale: 0.025, roughness: 0.3, metalness: 0.55, alphaTest: 0.5 });
  foilMat.onBeforeCompile = shader => {
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float facing = 1.0 - clamp(dot(normalize(vViewPosition), normal), 0.0, 1.0);
        float fold = texture2D(bumpMap, vUv).r;
        float t = facing * 1.6 + fold * 1.1 + vUv.y * 0.35 - vUv.x * 0.2;
        vec3 iris = 0.5 + 0.5 * cos(6.2832 * (t + vec3(0.0, 0.33, 0.67)));
        float foil = smoothstep(0.22, 0.6, dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)));
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * (0.45 + 0.85 * iris), foil);
        totalEmissiveRadiance += iris * foil * (0.07 + 0.25 * facing * facing);
      }`);
  };
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
    Promise.all([document.fonts.load('900 100px "Unbounded"'), document.fonts.load('800 20px "Unbounded"')]).then(redrawAll).catch(() => {});
  }
  function redrawAll() {
    drawBack(backCanvas); drawFace(faceA, 'A', 'spade'); drawFace(faceK, 'A', 'club'); drawBump(bumpCanvas); drawChips();
    backTex.needsUpdate = faceTexA.needsUpdate = faceTexK.needsUpdate = bumpTex.needsUpdate = true; dirty = true;
  }
  // the materials that take the room (the foil fuller than the rest, the paper backs and faces lightly)
  const take = (m, gain) => { m.userData.envGain = gain; lit.push(m); };
  take(foilMat, 0.8); take(backMat, 0.6); take(backFlat, 0.3); take(edgeMat, 0.4); take(matte.material, 0.5);
  take(sheen.material, 1); take(rail.material, 0.8); take(trim.material, 1); take(cardA.material[1], 0.5); take(cardK.material[1], 0.5);
  [chipMain, chipCap].forEach(set => set.mats.forEach(m => take(m, 0.8)));
  // deal the deck the theme asks for: artwork, materials, and the table under them
  let currentLook = null;
  // the 32-colour desktop (js/pixel-pass.js): Solitaire's table, cards and chips drawn through the 95 palette
  const pixelPass = THREE.PixelPass ? new THREE.PixelPass(renderer) : null;
  let pixelOn = false;
  // Solitaire through the palette, with the cards left out of it: their art is already drawn as pixels, and a
  // second pass only muddies it. The table, chips and shadows go through the pass with the cards invisible but
  // still casting; then the cards are drawn on top at full resolution, the chips writing depth only, so a chip
  // in front of a card still hides it.
  function renderSolitaire() {
    const cardMats = [cardA, cardK].reduce((all, c) => all.concat(c.material), []);
    const chipMats = chipMain.mats.concat(chipCap.mats);
    cardMats.forEach(m => { m.colorWrite = false; m.depthWrite = false; });
    pixelPass.render(scene, camera);
    cardMats.forEach(m => { m.colorWrite = true; m.depthWrite = true; });
    const hidden = scene.children.filter(o => o !== hand && o !== stack && !o.isLight && o.visible);
    hidden.forEach(o => { o.visible = false; });
    chipMats.forEach(m => { m.colorWrite = false; });
    const bg = scene.background, autoClear = renderer.autoClear, autoShadow = renderer.shadowMap.autoUpdate;
    scene.background = null; renderer.autoClear = false; renderer.shadowMap.autoUpdate = false;   // keep the pass's shadow map
    renderer.clearDepth(); renderer.render(scene, camera);
    scene.background = bg; renderer.autoClear = autoClear; renderer.shadowMap.autoUpdate = autoShadow;
    chipMats.forEach(m => { m.colorWrite = true; });
    hidden.forEach(o => { o.visible = true; });
  }
  function applyLook() {
    const l = look();
    if (l === currentLook) return;
    currentLook = l;
    const solitaire = l === 'win95', paper = l === 'manual' || l === 'press';
    pixelOn = solitaire && !!pixelPass;
    const rig = RIGS[l] || RIGS.default;
    // the table
    // glass: the mirror and its rail. matte: a lit paper slab. felt / flat: an unlit slab in the stage's colour (Solitaire green, the manual's paper)
    glass.forEach(o => { o.visible = rig.table === 'glass'; }); felt.visible = rig.table === 'felt' || rig.table === 'flat'; matte.visible = rig.table === 'matte';
    if (rig.table === 'matte') matte.material.color.setStyle(stageColor());
    if (felt.visible) felt.material.color.setStyle(stageColor());
    // the palette pass reads the scene as linear light: the stage colour goes in linear, so Solitaire's green comes
    // out as the palette's own 008000 instead of a dither between two greens
    if (pixelOn) {
      felt.material.color.convertSRGBToLinear();
      scene.background.setStyle(stageColor()).convertSRGBToLinear(); scene.fog.color.copy(scene.background);
    }
    shadows.material.opacity = rig.shadow;
    // the light
    setLight(hemi, rig.hemi[0], rig.hemi[2]); hemi.groundColor.setHex(rig.hemi[1]);
    setLight(key, rig.key[0], rig.key[1], rig.key[2]); key.angle = rig.key[3]; key.position.fromArray(rig.key[4]);
    setLight(fill, rig.fill[0], rig.fill[1]); fill.position.fromArray(rig.fill[2] || [30, 18, 42]);
    neon.visible = !!rig.neon;
    setLight(under, rig.under[0], rig.under[1]); setLight(rim, rig.rim[0], rig.rim[1]);
    // the glass takes the look's smoke, the horizon its fog
    if (glass.mirror && rig.mirror !== undefined) glass.mirror.material.uniforms.color.value.setHex(rig.mirror);
    scene.fog.near = rig.fog[0]; scene.fog.far = rig.fog[1];
    // the room: every standard material reflects it and takes its light; the flat looks have none
    scene.environment = roomEnv(rig.room);
    lit.forEach(m => { m.envMapIntensity = rig.env * m.userData.envGain; });
    // the film: the flat looks (Solitaire, the manual) take no curve, so their colours come out exact
    const tone = rig.tone ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    renderer.toneMappingExposure = rig.exposure;
    if (renderer.toneMapping !== tone) {
      renderer.toneMapping = tone;
      scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
    }
    // the deck
    const back = l === 'foil' ? foilMat : (solitaire || paper) ? backFlat : backMat;
    [cardA, cardK].forEach(c => { c.material[0] = back; c.material[1].roughness = solitaire ? 1 : paper ? 0.9 : 0.55; });
    edgeMat.color.set({ win95: 0xffffff, manual: 0xe6e3dc, press: 0xf3f0ea }[l] || 0xf4f4f4);
    redrawAll();
    // the look's own type arrives with its stylesheet: draw again once it is in
    if (FONTS[l] && document.fonts && document.fonts.load) Promise.all(FONTS[l].map(f => document.fonts.load(f))).then(redrawAll).catch(() => {});
  }
  document.addEventListener('theme:change', applyLook);

  // ---------- sizing ----------
  // The frame is fitted, not fixed: from the 70 mm base view the camera dollies out along its own axis
  // until the hand (at full lift) and the whole chip stack sit inside the box with a margin above the
  // rail, and the look point slides sideways so the group sits centred. Parallax moves relative to this.
  let W = 1, H = 1;
  const camBase = CAM_BASE.clone(), lookAt = LOOK.clone(), fitV = new THREE.Vector3();
  function framePoints() {
    const hx = hand.position.x, hz = hand.position.z, sp = stack.position, top = 7 * 0.33 + 0.5;
    return [
      [hx - CARD_W * 0.85, 0, hz - CARD_H * 0.55], [hx + CARD_W * 1.2, 0, hz - CARD_H * 0.55],
      [hx - CARD_W * 0.85, 0, hz + CARD_H * 0.62], [hx + CARD_W * 1.2, 0, hz + CARD_H * 0.62],
      [hx - CARD_W * 0.5, CARD_H * 0.92, hz], [hx + CARD_W * 1.1, CARD_H * 0.92, hz],   // the hand up
      [sp.x - 2.5, 0, sp.z + 2.5], [sp.x + 2.5, 0, sp.z + 2.5], [sp.x + 2.5, top, sp.z - 2.5], [sp.x - 2.5, top, sp.z - 2.5]
    ];
  }
  function resize() {
    W = pin.clientWidth || 1; H = pin.clientHeight || 1;
    renderer.setSize(W, H, false);
    if (pixelPass) pixelPass.setSize(W, H);
    camera.aspect = W / H;
    camera.setFocalLength(30);               // 30 mm: wide, close, the table falls away in perspective
    camera.updateProjectionMatrix();
    // a portrait box crops the sides, so the stack comes forward and in, below the hand
    if (camera.aspect < 1.2) stack.position.set(4.8, 0, 7.6); else stack.position.set(8.4, 0, 5.6);
    const pts = framePoints(), half = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    let dolly = 0.3, shift = 0;              // start close and back off only as far as the fit needs
    for (let i = 0; i < 48; i++) {
      lookAt.set(LOOK.x + shift, LOOK.y, LOOK.z);
      camBase.copy(lookAt).add(CAM_BASE.clone().sub(LOOK).multiplyScalar(dolly));
      camera.position.copy(camBase); camera.lookAt(lookAt); camera.updateMatrixWorld(true);
      let x0 = 1, x1 = -1, y0 = 1, y1 = -1;
      for (const [x, y, z] of pts) {
        fitV.set(x, y, z).project(camera);
        x0 = Math.min(x0, fitV.x); x1 = Math.max(x1, fitV.x); y0 = Math.min(y0, fitV.y); y1 = Math.max(y1, fitV.y);
      }
      const cx = (x0 + x1) / 2;
      const over = x0 < -0.9 || x1 > 0.9 || y0 < -0.66 || y1 > 0.9;
      if (!over && Math.abs(cx) < 0.01) break;
      shift += cx * camBase.distanceTo(lookAt) * half * camera.aspect;
      if (over && dolly < 1.8) dolly *= 1.03;
    }
    // the loop may leave the base one step ahead of the camera: settle on the base
    lookAt.set(LOOK.x + shift, LOOK.y, LOOK.z);
    camBase.copy(lookAt).add(CAM_BASE.clone().sub(LOOK).multiplyScalar(dolly));
    camera.position.copy(camBase); camera.lookAt(lookAt); camera.updateMatrixWorld(true);
    camDist = camBase.distanceTo(lookAt);
    dirty = true; placeHits();
  }
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

    if (dirty) { if (pixelOn) renderSolitaire(); else renderer.render(scene, camera); placeHits(); dirty = false; }
  }
  applyLook();
  resize();
  bendCard(cardA, 0); bendCard(cardK, 0);
  requestAnimationFrame(frame);
})();
