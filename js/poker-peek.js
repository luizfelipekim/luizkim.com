/* Poker case teaser on the homepage: two cards face down on dark glass. Drag them up (or
   press Enter) to peek, the way a player looks at a hand; take chips off the stack and set
   them down in piles. 30 mm lens fitted to the box; the mouse leans the camera a few degrees
   round the hand. Needs js/three.min.js (r128) and js/Reflector.js (three r128 examples)
   loaded first. All artwork is drawn on canvas at load. */
(function () {
  'use strict';
  const stage = document.querySelector('.peek');
  if (!stage) return;
  const pin = stage;
  const canvas = stage.querySelector('.peek__canvas');
  const hasGL = (() => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; } })();
  if (typeof THREE === 'undefined' || !hasGL) { stage.classList.add('is-flat'); return; }

  function start() {

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
    press: ['900 100px "Playfair Display"', '400 20px "Source Serif 4"', 'italic 400 30px "Source Serif 4"']
  };
  // the theme stylesheet names the look on <html> as --look (manual, press, win95, foil); charcoal names none
  const look = () => getComputedStyle(document.documentElement).getPropertyValue('--look').trim() || 'default';
  const ART = { win95: 'img/poker/back-beach.png', foil: 'img/poker/back-foil.jpg', foilBump: 'img/poker/back-foil-bump.jpg', walnut: 'img/claw/deco-walnut.webp' };
  const images = {};
  function image(key) {
    const im = images[key];
    if (im) return im.complete && im.naturalWidth ? im : null;
    const n = new Image(); n.decoding = 'async'; n.onload = () => redrawAll(); n.src = (document.documentElement.getAttribute('data-root') || '') + ART[key]; images[key] = n;
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

  // Broadsheet: an engraved card. Cream newsprint, a border band of walnut veneer between rules, the
  // nameplate LK in the Playfair black, a line of small capitals with hairlines, as a masthead.
  const CREAM = '#faf8f4', INK = '#1a1715';
  // The border is the walnut of the claw machine's cabinet (js/claw-machine.js), so the deck belongs to that cabinet:
  // the cabinet's own grain image, inlaid as four strips of veneer with the grain running along each side and a mitre
  // at each corner. One clean panel of the image is used ([x, y, width, length], the grain running down it); each
  // side takes its own strip of it, laid end to end and turned over at each join so the grain runs on unbroken.
  // WALNUT is the wood as the cabinet shows it under its varnish: the band's colour until the image is in (and if
  // it never comes), and the lift that brings the bare grain up to it.
  const WALNUT = '#6b4a33', PANEL = [14, 96, 232, 214], GRAIN = 2.4;   // GRAIN: how much larger than in the image the grain is laid
  function veneer(ctx, x, y, w, h, band) {
    const im = image('walnut');
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, w, h); ctx.rect(x + band, y + band, w - 2 * band, h - 2 * band); ctx.clip('evenodd');
    ctx.fillStyle = WALNUT; ctx.fillRect(x, y, w, h);
    if (im) {
      const cut = band / GRAIN;   // the width of image a strip takes
      const lay = () => [[x, y], [x + w, y], [x + w, y + h], [x, y + h]].forEach(([ox, oy], i) => {
        const L = i % 2 ? h : w, tiles = i % 2 ? 3 : 2, len = L / tiles, sx = PANEL[0] + 8 + i * ((PANEL[2] - cut - 16) / 3);
        ctx.save(); ctx.translate(ox, oy); ctx.rotate(i * Math.PI / 2);   // the side runs along x from its corner, the card's middle is down
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(L, 0); ctx.lineTo(L - band, band); ctx.lineTo(band, band); ctx.closePath(); ctx.clip();
        for (let k = 0; k < tiles; k++) {
          ctx.save(); ctx.translate((k + (k % 2)) * len, band); ctx.rotate(-Math.PI / 2); if (k % 2) ctx.scale(1, -1);
          ctx.drawImage(im, sx, PANEL[1], cut, PANEL[3], 0, 0, band, len + 1); ctx.restore();
        }
        ctx.restore();
      });
      lay();
      // at the band's size on the table the grain would thin to a flat brown: laid over itself it keeps its dark lines
      ctx.globalCompositeOperation = 'overlay'; ctx.globalAlpha = 0.45; lay();
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = 0.36; ctx.fillStyle = WALNUT; ctx.fillRect(x, y, w, h);
      ctx.globalCompositeOperation = 'source-over';
    }
    // the mitres: a hairline where two strips meet
    ctx.globalAlpha = 0.5; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath();
    [[x, y, 1, 1], [x + w, y, -1, 1], [x + w, y + h, -1, -1], [x, y + h, 1, -1]].forEach(([cx, cy, dx, dy]) => { ctx.moveTo(cx, cy); ctx.lineTo(cx + dx * band, cy + dy * band); });
    ctx.stroke();
    ctx.restore();
  }
  function drawBackPress(c) {
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, CW, CH);
    roundRect(ctx, 0, 0, CW, CH, R); ctx.fillStyle = CREAM; ctx.fill();
    const m = 40, w = CW - 2 * m, h = CH - 2 * m, band = 54;
    // the border: rule, walnut band, rule
    veneer(ctx, m, m, w, h, band);
    ctx.strokeStyle = INK; ctx.lineWidth = 3; ctx.strokeRect(m, m, w, h);
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
  function pixelate(c, f, fy) {
    const small = mkCanvas(Math.round(c.width / f), Math.round(c.height / (fy || f))), s = small.getContext('2d');
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
  // is set in, and the finish; the capping chip may differ (the hazard red one, the gold one), and so
  // may the two at the foot of the stack (low) and the two under the cap (high). Broadsheet has none here: it deals
  // its own tile (see dominoChips).
  const CHIPS = {
    default: { base: '#0d0d0d', stripe: '#f4f4f4', mark: '#f4f4f4', font: '900 50px ' + DISPLAY, rough: 0.45, metal: 0.05 },
    manual: { base: PAPER, stripe: CARBON, mark: CARBON, font: ARCHIVO + '58px ' + ARCHIVO_F, rough: 0.92, metal: 0,
      cap: { base: HAZARD, stripe: PAPER, mark: PAPER } },
    win95: { base: '#ff0000', stripe: '#ffffff', mark: '#ffffff', font: '900 50px ' + DISPLAY, rough: 1, metal: 0, pixel: 8 },
    foil: { base: '#140b3a', stripe: '#9a6bff', mark: '#ffcf3a', font: '900 50px ' + DISPLAY, rough: 0.28, metal: 0.35,
      low: { stripe: '#00b4ff' }, high: { stripe: '#ff1fb4' }, cap: { base: '#140b3a', stripe: '#ffcf3a', mark: '#ffcf3a' } }   // dark lacquer, the inlays running cyan, violet, magenta up the stack to the one gold chip
  };
  // The wall art is drawn on a 512 x 64 grid and stretched across a canvas SIDE_X times as wide: the wall runs
  // about 37 times its height round the chip, and at 512 texels the stripes' edges were magnified to a blur.
  const SIDE_X = 4;
  function chipTextures(pal, side, top) {
    const s = side.getContext('2d');
    s.setTransform(SIDE_X, 0, 0, 1, 0, 0);
    s.clearRect(0, 0, 512, 64);
    s.fillStyle = pal.base; s.fillRect(0, 0, 512, 64);
    s.fillStyle = pal.stripe;
    for (let i = 0; i < 8; i++) s.fillRect(i * 64 + 18, 0, 28, 64);
    s.setTransform(1, 0, 0, 1, 0, 0);
    const t = top.getContext('2d');
    t.clearRect(0, 0, 256, 256);
    t.fillStyle = pal.base; t.beginPath(); t.arc(128, 128, 128, 0, Math.PI * 2); t.fill();
    t.fillStyle = pal.stripe;
    for (let i = 0; i < 8; i++) {
      t.beginPath(); t.arc(128, 128, 128, i * Math.PI / 4 - 0.19, i * Math.PI / 4 + 0.19); t.arc(128, 128, 96, i * Math.PI / 4 + 0.19, i * Math.PI / 4 - 0.19, true); t.closePath(); t.fill();
    }
    t.strokeStyle = pal.stripe; t.globalAlpha = 0.35; t.lineWidth = 2; t.beginPath(); t.arc(128, 128, 84, 0, Math.PI * 2); t.stroke();
    t.globalAlpha = 1; t.fillStyle = pal.mark; t.font = pal.font; t.textAlign = 'center'; t.textBaseline = 'middle'; t.fillText('LK', 128, 132);
    if (pal.pixel) { pixelate(side, pal.pixel / 2 * SIDE_X, pal.pixel / 2); pixelate(top, pal.pixel / 2); }   // the same blocks as before the wider wall
  }

  // ---------- scene ----------
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  // if the GPU drops the context, the baked environments are gone with it: stop and show the flat hand
  let lost = false;
  canvas.addEventListener('webglcontextlost', () => { lost = true; stage.classList.add('is-flat'); }, false);
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
  // The framing: where the camera stands and looks, where the hand and the chip stack lie (in a wide box, and in a
  // tall one, which crops the sides), and the margins the fit keeps round them: [sides, bottom, top] in clip space.
  // Every look takes the first; a look names another in RIGS when its light asks for one. The arcade's subject is
  // the foil: the camera stands a little higher so the backs open up, the hand sits just left of centre in the
  // pool, and the stack goes behind and to the right, where the two rims edge it and it never stands over the cards.
  const FRAMES = {
    default: { cam: [0, 27, 44], look: [0, 0.6, 0.5], hand: [-0.4, 0], stack: [8.4, 5.6], stackTall: [4.8, 7.6], fit: [0.9, -0.66, 0.9], pad: [0.85, 1.2] },
    // the first, drawn in a little: the stack a step back, so the cards are the larger thing. rail: how far up the frame
    // the padded rail comes, so it is the same band at the foot of a wide box and of a tall one
    studio: { cam: [0, 27, 44], look: [0, 0.6, 0.5], hand: [-0.6, 0.2], stack: [8.5, 3.2], stackTall: [4.8, 7.6], fit: [0.9, -0.62, 0.9], pad: [0.72, 1.0], rail: 0.045 },
    paper: { cam: [0, 27, 44], look: [0, 0.6, 0.5], hand: [-0.6, 0.2], stack: [8.5, 3.2], stackTall: [4.8, 7.6], fit: [0.9, -0.66, 0.9], pad: [0.72, 1.0] },
    arcade: { cam: [0, 30, 42], look: [0, 0.6, 0.3], hand: [-1.5, 0.6], stack: [8.0, -3.4], stackTall: [3.6, -8.6], fit: [0.94, -0.66, 0.95], pad: [0.64, 0.74], bet: 0.7, centre: true }   // bet: how far up the frame the neon betting line crosses it; centre: the group sits midway between the bottom and top margins
  };
  let FRAME = FRAMES.default;
  const CAM_BASE = new THREE.Vector3().fromArray(FRAME.cam);
  const LOOK = new THREE.Vector3().fromArray(FRAME.look);

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
  // Charcoal, a dark grey studio, the claw machine's own (js/claw-machine.js): neutral light, a shade warmer from
  //   the front than from behind. One spot on the hand and its pool on the glass, a cool rim from the back left
  //   and a warm one from the back right, a table of black glass that mirrors two soft lights far off and fades
  //   into the stage's grey. Nothing shines from straight behind: its streak on the glass would veil the cards.
  // Manual, a copy desk under a skylight: flat overcast daylight from straight above, a wide cone, one
  //   soft-edged shadow, no film curve and no gloss, print as print.
  // Press, paper and ink: the page is the light. The table is the page itself, unlit and even; the hand stands in
  //   a pool of ink shadow, which sets the pale cards off from the pale paper; one hard light from above and a
  //   little behind cuts short, clean shadows at the foot of each thing and edges the tops.
  // Win95, Solitaire: no light at all, a flat green with a stamped shadow.
  // Foil, an arcade hall with the lights down: light comes in pools, never evenly. One narrow spot on the hand,
  //   a cyan rim from the back left and a magenta one from the back right, a table of black gloss that mirrors
  //   the hall's screens and tubes far off and fades into the dark, and nothing bright behind and above, where
  //   the flat cards look: the foil makes its own colour and a pale light there would only veil it.
  // key: [colour, intensity, penumbra, angle, position], keyTo: where it aims; fill: [colour, intensity, position];
  // rimAt: where the rim comes from; mirror: the smoke in the glass; gloss: the glass as black lacquer, see the
  // mirror's shader; sheen: the key's streak on the glass, where a look changes it; rail: false takes the padded rail away; fog: [near, far];
  // pool: what lies on the table round the hand, [colour, strength, width, depth, right of the hand, in front of it, ink]:
  // a pool of light added to dark glass or, with ink, a wash of shadow laid on paper; neon: the hall's lights, and
  // softs: the studio's, which the glass reflects; bevel: the chips' edges cut back; domino: the chips as ivory tiles, see dominoChips; frame: the look's own framing, see FRAMES;
  // room: the image-based environment (built once per look, see roomEnv); env: how much of it the materials take.
  const RIGS = {
    default: { hemi: [0xc8ccd4, 0x0c0c0c, 0.14], key: [0xfff4e6, 1.5, 1, 0.3, [-7, 44, 16]], keyTo: [2, 0, 1.2], fill: [0xfff0e0, 1.0, [40, 8, -12]], under: [0xffffff, 0.2], rim: [0xdfe8ff, 1.3], rimAt: [-40, 10, -14],
      table: 'glass', mirror: 0xffffff, gloss: [0.22, 0.9, 14, 64], glassBase: 0.62, sheen: [0x000000, 0.5, 0.22, 0], pool: [0x5c5c5c, 1, 36, 25, 2.6, 0.8], softs: true, bevel: true, fog: [90, 220], tone: true, exposure: 1.05, shadow: 0.5, room: 'studio', env: 0.8, frame: 'studio' },
    manual: { hemi: [0xffffff, 0xd8d3c8, 1.0], key: [0xffffff, 0.85, 0.3, 0.95, [2, 72, 8]], fill: [0xffffff, 0.06], under: [0xffffff, 0], rim: [0xffffff, 0], table: 'flat', fog: [60, 160], tone: false, exposure: 1, shadow: 0.4, room: 'overcast', env: 0.35 },
    press: { hemi: [0xfff6e8, 0xe9e2d4, 0.62], key: [0xfff6e8, 0.4, 0.3, 0.3, [-10, 58, -12]], keyTo: [2, 0, 1], fill: [0xfff6e8, 0], under: [0xfff6e8, 0.1], rim: [0xfff6e8, 0.2], rimAt: [-30, 22, -24],
      table: 'flat', pool: [0x1a1715, 0.32, 21, 13.5, 3.4, 0.6, true], bevel: true, domino: true, fog: [60, 160], tone: false, exposure: 1, shadow: 0.42, room: 'pressroom', env: 0.5, frame: 'paper' },
    win95: { hemi: [0xffffff, 0xffffff, 1.0], key: [0xffffff, 0.55, 0.65, 0.55, [-18, 56, 22]], fill: [0xffffff, 0], under: [0xffffff, 0], rim: [0xffffff, 0], table: 'felt', fog: [60, 160], tone: false, exposure: 1, shadow: 0.3, room: null, env: 0 },
    foil: { hemi: [0x6a5cff, 0x0a0619, 0.07], key: [0xf3ecff, 1.5, 1, 0.21, [-7, 44, 15]], keyTo: [0.4, 0, -0.4], fill: [0xff00c0, 2.8, [40, 7, -10]], under: [0xcfc4ff, 0.26], rim: [0x00c8ff, 2.4], rimAt: [-40, 9, -12],
      table: 'glass', mirror: 0xffffff, gloss: [0.16, 0.95, 62, 112], sheen: [0x000000, 0.5, 0.2, 0], rail: false, fog: [80, 190], tone: true, exposure: 1.0, shadow: 0.6, pool: [0x3626b8, 1, 30, 20, 1.2, -0.6], room: 'arcade', env: 1, neon: true, bevel: true, frame: 'arcade' }
  };
  function setLight(l, c, i, pen) { l.color.setHex(c); l.intensity = i; if (pen !== undefined) l.penumbra = pen; }
  // the rooms: small lit boxes rendered once into a prefiltered environment (PMREM), the vendored three has
  // no HDR loader and the page needs no download for this. Each lamp is a plane facing the centre:
  // [width, height, x, y, z, colour, gain]. Built on first use, kept for the tab.
  const ROOMS = {
    // the dark grey studio, as the claw machine's atelier but placed for a table: strip lights stand low in front,
    // where the chips' sides and the rail look; an edge line each side, cool on the left and warm on the right, as
    // the rims come; one strip and a dim wash back and high for the flat tops, kept low so the card backs stay black
    studio: { bg: 0x050505, lamps: [
      [0.8, 9, -9, -2.5, 7, 0xffffff, 7], [0.8, 9, -4.2, -3.5, 9.8, 0xffffff, 5], [0.8, 9, 1.2, -3.5, 10.5, 0xffffff, 7], [0.8, 9, 6.5, -3, 8.6, 0xffffff, 3.5],
      [12, 2.5, -3, -8, 6.5, 0xffffff, 0.3],                                        // the floor in front, a dim bounce
      [0.5, 9, -10.5, 1, -3, 0xdfe8ff, 4.5], [0.5, 9, 10.5, 0, -2, 0xfff0e0, 5],   // an edge line, left and right
      [9, 1.2, -4.5, 8.5, -8.5, 0xffffff, 1.8], [8, 5, -5, 5, -9, 0xffffff, 0.3],  // back left, high
      [5, 3, 1, 10.5, 3, 0xffffff, 2.2]                                             // overhead softbox: the line along the rail
    ] },
    overcast: { bg: 0xe6e3dc, lamps: [[24, 24, 0, 10, 0, 0xffffff, 1.25], [24, 6, 0, -8, 0, 0xcfcac0, 0.9]] },
    // Broadsheet's room, as the claw machine's pressroom: a grey room lit by windows the colour of the page, and the
    // page itself below, which sends its light back up into the foot of everything that stands on it
    // The sources stand where the gloss dominoes look, in a room dark enough to set them off: a chip's round edge,
    // turned to the camera, mirrors a light bank over the front of the table as a line along it; its flat top mirrors
    // the back wall a third of the way up, where three windows stand with dark piers between them, so a sheen lies
    // across part of the face and moves as the camera leans; the walls of a groove catch the same windows. blur: how
    // sharp the room is kept (the other rooms take the usual softening).
    pressroom: { bg: 0x171614, blur: 0.015, lamps: [
      [5, 7, -6.5, 3, 8.5, 0xfff6e8, 5],          // window, front left
      [16, 5, 0, 9.3, 3.7, 0xfff6e8, 6],          // light bank, overhead and to the front
      [24, 24, 0, -9, 0, 0xf2ede2, 0.7],          // the page below
      [7, 7, 8, -3.5, -7.5, 0x4d4a43, 1],         // back right, low: the right sides stay the shade side
      [4.5, 3.9, -2.7, 7.1, -8.0, 0xfff6e8, 1.4], [3.0, 3.9, 1.6, 7.1, -8.3, 0xfff6e8, 1.4], [2.7, 3.9, 4.8, 7.1, -6.9, 0xfff6e8, 1.4]   // windows along the back
    ] },
    // a dark arcade hall, the claw machine's own room (js/claw-machine.js). A gloss face mirrors one part of it: the chips'
    // sides see low and to their own side, the rail sees front and overhead, the flat tops see back and high. Screens
    // of other machines and tube runs are placed there; back and high stays almost dark, so nothing veils the foil.
    arcade: { bg: 0x030208, lamps: [
      [11, 4, -3, -4, 9, 0x42308a, 1],                                             // front, low: a violet wash, so a face toward the camera is never plain black
      [1.8, 1.3, -9, -2.5, 3, 0x00c8ff, 5], [1.8, 1.3, -8, -4, -4, 0x0a50ff, 5],  // screens, left: cyan and blue
      [1.8, 1.3, 9, -2.5, 2, 0xff00c0, 5], [1.8, 1.3, 8, -4, -5, 0xffb020, 4],    // screens, right: magenta and amber
      [0.3, 12, -10, -5, 0, 0x00c8ff, 5.5], [0.3, 12, 10, -5, -1, 0xff00c0, 5.5], // floor tubes down each side
      [13, 0.3, 0, -5.5, 8, 0x8a5cff, 5],                                          // floor tube, front, violet
      [14, 0.3, 0, 9, 5, 0xc9b8ff, 6],                                             // ceiling tube, front: the line along the rail
      [1.6, 1.6, -5, 8, -7, 0xdcd4ff, 7],                                          // one ceiling can, back left: the glint on the chips' faces
      [0.4, 6, -10, 3, -6, 0x00c8ff, 3.2], [0.4, 6, 10, 3, -5, 0xff00c0, 3.2]     // an edge line at each back corner
    ] }
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
    const t = g.fromScene(s, r.blur || 0.04).texture; g.dispose();
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
    // uGloss, for a look that asks (gloss in RIGS): the glass as black lacquer. x, y: how much it mirrors seen from
    // above and at a grazing angle (a gloss surface mirrors more the flatter you look along it, so the far hall
    // burns and the near table stays black); z, w: where it starts to fade into the stage colour and where it is gone.
    // uBase: the table under the glass, as a share of the stage colour, where it is not black (glassBase in RIGS).
    const smoked = {
      uniforms: { color: { value: null }, tDiffuse: { value: null }, textureMatrix: { value: null }, uGloss: { value: new THREE.Vector4(0, 0, 0, 0) }, uStage: { value: new THREE.Color(0x000000) }, uBase: { value: 0 } },
      vertexShader: `
        uniform mat4 textureMatrix; varying vec4 vUv; varying vec3 vWorld;
        void main() {
          vUv = textureMatrix * vec4(position, 1.0);
          vWorld = (modelMatrix * vec4(position, 1.0)).xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 color; uniform sampler2D tDiffuse; uniform vec4 uGloss; uniform vec3 uStage; uniform float uBase; varying vec4 vUv; varying vec3 vWorld;
        void main() {
          vec3 base = texture2DProj(tDiffuse, vUv).rgb;
          // the mirror pass writes linear values: bring them to screen gamma, then hold the reflection down
          vec3 c = pow(base, vec3(1.0 / 2.2)) * color;
          if (uGloss.y > 0.0) {
            // lacquer mirrors what is there, no brighter: the lift above would turn the dark hall to a grey haze
            float graze = 1.0 - normalize(cameraPosition - vWorld).y;
            c = base * color * mix(uGloss.x, uGloss.y, graze * graze * graze) + uStage * uBase;
            c = mix(c, uStage, smoothstep(uGloss.z, uGloss.w, length(vWorld.xz)));
          }
          gl_FragColor = vec4(c, 1.0);
        }`
    };
    const res = matchMedia('(pointer: coarse)').matches ? 512 : 1024;
    const mirror = new THREE.Reflector(TABLE, { shader: smoked, color: 0x4a4a4a, textureWidth: res, textureHeight: res, clipBias: 0.003 });
    mirror.rotation.x = -Math.PI / 2; scene.add(mirror); glass.push(mirror); glass.mirror = mirror;
  } else {
    const slab = new THREE.Mesh(TABLE, new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.3, metalness: 0.1 }));
    slab.rotation.x = -Math.PI / 2; slab.receiveShadow = true; scene.add(slab); glass.push(slab);
  }
  // the unlit table (Solitaire's green, the manual's paper, the broadsheet's page): one flat colour, no reflection; the shadow catcher above it still grounds the cards
  const felt = new THREE.Mesh(TABLE, new THREE.MeshBasicMaterial({ color: 0x008000 }));
  felt.rotation.x = -Math.PI / 2; felt.visible = false; scene.add(felt);
  const shadows = new THREE.Mesh(TABLE, new THREE.ShadowMaterial({ opacity: 0.45 }));
  shadows.rotation.x = -Math.PI / 2; shadows.position.y = 0.01; shadows.receiveShadow = true; scene.add(shadows);
  const sheen = new THREE.Mesh(TABLE, new THREE.MeshPhysicalMaterial({ color: 0x000000, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, roughness: 0.32, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.22 }));
  sheen.rotation.x = -Math.PI / 2; sheen.position.y = 0.02; scene.add(sheen); glass.push(sheen);
  // the rail keeps a fine grain
  const feltBump = new THREE.CanvasTexture(noiseCanvas(256, [128, 128, 128], 110));
  feltBump.wrapS = feltBump.wrapT = THREE.RepeatWrapping; feltBump.repeat.set(40, 40);

  // the hall behind the table (the foil look alone): the screens of other machines and a few tube runs, far off
  // and out of focus, unlit and unfogged so they burn. The camera looks down at the table and never at them: they
  // are there for the glass to mirror, cyan to the left and magenta to the right, as the two rims come.
  // Each is a flat card with a soft-edged glow drawn on it, so it needs no blur pass.
  const neon = new THREE.Group(); neon.visible = false; scene.add(neon);
  const glowTex = (() => {
    const c = mkCanvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,0.55)'); g.addColorStop(0.6, 'rgba(255,255,255,0.12)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  // a light far out of focus: an even disc with a soft rim
  const discTex = (() => {
    const c = mkCanvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,0.8)'); g.addColorStop(0.62, 'rgba(255,255,255,0.9)'); g.addColorStop(0.8, 'rgba(255,255,255,0.3)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  function glow(w, h, x, y, z, hex, gain, map) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: hex, map: map || glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false }));
    m.material.color.multiplyScalar(gain); m.position.set(x, y, z); neon.add(m); return m;
  }
  // [width, height, x, y, z, colour, gain]: three wide washes, then the lights
  [[170, 80, -100, 26, -150, 0x00a8ff, 0.5], [170, 80, 104, 24, -150, 0xff00c0, 0.5], [100, 50, 6, 44, -160, 0x5a2bff, 0.35]].forEach(g => glow(...g));
  [[17, 17, -116, 20, -140, 0x00c8ff, 0.8], [11, 11, -66, 31, -145, 0x00c8ff, 0.65], [9, 9, -36, 15, -150, 0x0a6cff, 0.75], [6, 6, -88, 46, -150, 0x9a6bff, 0.6], [7, 7, -146, 40, -150, 0x00c8ff, 0.5],
    [17, 17, 112, 22, -140, 0xff00c0, 0.8], [11, 11, 60, 34, -145, 0xff1fb4, 0.65], [8, 8, 32, 14, -150, 0xffb020, 0.6], [6, 6, 86, 48, -150, 0x9a6bff, 0.6], [7, 7, 148, 38, -150, 0xff00c0, 0.5],
    [5, 5, -6, 27, -155, 0x5a2bff, 0.7], [4, 4, 12, 56, -155, 0x00c8ff, 0.4]
  ].forEach(g => glow(...g, discTex));
  // the table's own light: the betting line as a neon inlay in the glass, cyan at one end and magenta at the other,
  // an arc across the table beyond the hand, where a player pushes chips over it. Two bands on an arc of the etched
  // line's radius (56, its nearest point at the group's origin, the ends curving away): a thin tube, burning paler
  // than its colour as a lit tube does, and a wide soft halo round it in the colour itself.
  const bet = new THREE.Group(); bet.position.y = 0.03; neon.add(bet);
  [[0.17, 1, [0, 0.2, 0.8, 1], ['#3fd6ff', '#9468ff', '#ff45d2']], [2.6, 0.55, [0, 0.5, 0.5, 1], ['#00c8ff', '#7a3cff', '#ff00c0']]].forEach(([width, gain, fall, hue]) => {
    const c = mkCanvas(256, 32), x = c.getContext('2d'), g = x.createLinearGradient(0, 0, 256, 0);
    g.addColorStop(0.3, hue[0]); g.addColorStop(0.5, hue[1]); g.addColorStop(0.7, hue[2]);
    x.fillStyle = g; x.fillRect(0, 0, 256, 32);
    const f = x.createLinearGradient(0, 0, 0, 32);   // across the band: dark at the edges, clear where it burns
    f.addColorStop(fall[0], 'rgba(0,0,0,1)'); f.addColorStop(fall[1], 'rgba(0,0,0,0)'); f.addColorStop(fall[2], 'rgba(0,0,0,0)'); f.addColorStop(fall[3], 'rgba(0,0,0,1)');
    x.fillStyle = f; x.fillRect(0, 0, 256, 32);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const R = 56, HALF = 0.42, N = 72, pos = [], uv = [], idx = [];
    for (let i = 0; i <= N; i++) {
      const a = (i / N * 2 - 1) * HALF;
      [R - width / 2, R + width / 2].forEach((r, k) => { pos.push(r * Math.sin(a), 0, r * Math.cos(a) - R); uv.push(i / N, k); });
      if (i < N) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx);
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: t, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide }));
    m.material.color.multiplyScalar(gain); bet.add(m);
  });
  // the studio's own lights (the default look alone): two soft lights far behind the table, cool to the left and
  // warm to the right, as its rims come. Like the hall, they are there for the glass to mirror, and they stay dim.
  const softs = new THREE.Group(); softs.visible = false; scene.add(softs);
  [[44, 44, -92, 30, -150, 0xdfe8ff, 0.2], [38, 38, 100, 27, -150, 0xfff0e0, 0.16]].forEach(g => softs.add(glow(...g)));
  // the pool the key spot leaves on the table: black gloss has nothing to scatter light with, so the pool is laid
  // in under the shadow catcher, and the hand's shadow still falls across it. On paper the same patch is a wash of
  // ink, a pool of shadow for pale things to stand in. Each look gives its own (pool in RIGS).
  let POOL = null;
  const washTex = (() => {   // ink soaks evenly and ends softly: full to near half way out, then gone
    const c = mkCanvas(128, 128), x = c.getContext('2d'), g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.42, 'rgba(255,255,255,0.92)'); g.addColorStop(0.72, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
  })();
  const pool = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x3626b8, map: glowTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
  pool.rotation.x = -Math.PI / 2; pool.position.y = 0.005; pool.renderOrder = -1; pool.visible = false; scene.add(pool);   // drawn first of the see-through layers: the shadow catcher above it writes depth

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
    const sideC = mkCanvas(512 * SIDE_X, 64), topC = mkCanvas(256, 256);
    // the wall is seen edge-on, so without anisotropic filtering its mipmaps smear the stripes
    const side = new THREE.CanvasTexture(sideC); side.wrapS = THREE.RepeatWrapping; side.encoding = THREE.sRGBEncoding; side.anisotropy = renderer.capabilities.getMaxAnisotropy();
    const top = new THREE.CanvasTexture(topC); top.encoding = THREE.sRGBEncoding; top.anisotropy = side.anisotropy;
    const mSide = new THREE.MeshStandardMaterial({ map: side, roughness: 0.45, metalness: 0.05 });
    const mTop = new THREE.MeshStandardMaterial({ map: top, roughness: 0.4, metalness: 0.05 });
    return { sideC, topC, side, top, mats: [mSide, mTop, mTop] };
  }
  const chipMain = chipSet(), chipCap = chipSet(), chipLow = chipSet(), chipHigh = chipSet();
  function drawChips() {
    const l = look();
    if ((RIGS[l] || RIGS.default).domino) return;   // the look's own tile is on the stack: this art would not be seen
    const pal = CHIPS[l] || CHIPS.default;
    [[chipMain, {}], [chipCap, pal.cap], [chipLow, pal.low], [chipHigh, pal.high]].forEach(([set, own]) => chipTextures(Object.assign({}, pal, own || {}), set.sideC, set.topC));
    [chipMain, chipCap, chipLow, chipHigh].forEach(set => {
      set.side.needsUpdate = set.top.needsUpdate = true;
      set.mats.forEach(m => { m.roughness = pal.rough; m.metalness = pal.metal; });
    });
  }
  const chipPlain = new THREE.CylinderGeometry(1.95, 1.95, 0.33, 48);
  // the same chip with its two edges cut back, so each edge has a face of its own to catch a light (a look asks with
  // bevel in RIGS). Groups and mapping follow the cylinder's: the wall with both bevels, then the top, then the bottom.
  const chipBevel = (() => {
    const r = 1.95, h = 0.33, b = 0.045, seg = 64, pos = [], nor = [], uv = [], idx = [], k = Math.SQRT1_2, g = new THREE.BufferGeometry();
    const band = (r0, y0, r1, y1, nr, ny) => {   // a ring of faces between two heights, one normal across it
      const s = pos.length / 3;
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
        pos.push(r0 * sx, y0, r0 * cz, r1 * sx, y1, r1 * cz); nor.push(nr * sx, ny, nr * cz, nr * sx, ny, nr * cz); uv.push(i / seg, 0, i / seg, 1);
        if (i < seg) idx.push(s + 2 * i, s + 2 * i + 2, s + 2 * i + 1, s + 2 * i + 1, s + 2 * i + 2, s + 2 * i + 3);
      }
    };
    const cap = (y, up) => {
      const s = pos.length / 3; pos.push(0, y, 0); nor.push(0, up, 0); uv.push(0.5, 0.5);
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a), q = (r - b) / r;
        pos.push((r - b) * sx, y, (r - b) * cz); nor.push(0, up, 0); uv.push(0.5 + 0.5 * q * cz, 0.5 + 0.5 * q * sx * up);
        if (i < seg) { if (up > 0) idx.push(s, s + 1 + i, s + 2 + i); else idx.push(s, s + 2 + i, s + 1 + i); }
      }
    };
    band(r - b, -h / 2, r, -h / 2 + b, k, -k); band(r, -h / 2 + b, r, h / 2 - b, 1, 0); band(r, h / 2 - b, r - b, h / 2, k, k);
    const wall = idx.length; cap(h / 2, 1); const top = idx.length - wall; cap(-h / 2, -1);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx); g.addGroup(0, wall, 0); g.addGroup(wall, top, 1); g.addGroup(wall + top, idx.length - wall - top, 2);
    return g;
  })();
  // Broadsheet's chips are ivory dominoes: thick gloss resin with soft round edges, the marks cut into it and filled
  // with ink. A debossed groove from one drawing: draw(ctx, w, h) paints the groove in black on white; done() is
  // handed the ink map, a normal map of the groove's rounded walls, and a roughness map that keeps the groove's floor
  // matte under the gloss and, in its red, takes the clear coat off the ink (a coat left there, even a thin one, turns
  // the stage light into white specks on the black). wall: how far the walls round off, in texels; depth: how steep
  // they stand; foot: over how many rows at the bottom the piece's own foot is shaded, where it meets what it stands on.
  // The cutting is handed back as short steps and not done at once: a look change must not hold the page (see defer).
  function grooveSteps(w, h, draw, wall, depth, foot, done) {
    const n = w * h, r = Math.max(1, wall | 0), ht = new Float32Array(n), sum = new Float32Array(Math.max(w, h) + 1), BAND = 128;
    let ink, nor, rgh;
    // a box blur each way round the walls, two times over (the canvas filter is not there in every Safari)
    const blur = (count, len, step, stride) => {
      for (let j = 0; j < count; j++) {
        const o = j * stride;
        for (let i = 0; i < len; i++) sum[i + 1] = sum[i] + ht[o + i * step];
        for (let i = 0; i < len; i++) { const a = Math.max(0, i - r), b = Math.min(len - 1, i + r); ht[o + i * step] = (sum[b + 1] - sum[a]) / (b - a + 1); }
      }
    };
    const soften = () => { blur(h, w, 1, w); blur(w, h, w, 1); };
    const rows = y0 => () => {
      for (let y = y0, y1 = Math.min(h, y0 + BAND); y < y1; y++) {
        const up = y > 0 ? w : 0, down = y < h - 1 ? w : 0, sh = foot && y + 0.5 > h - foot ? 0.6 * (y + 0.5 - h + foot) / foot : 0;
        for (let x = 0, j = y * w, k = (h - 1 - y) * w * 4; x < w; x++, j++, k += 4) {   // the picture's top row is the texture's last
          const hv = ht[j], fl = Math.min(1, Math.max(0, (0.42 - hv) / 0.14));   // the ink lies on the floor and stops short of the walls, which stay the body's colour and show the cut
          const v = (1 - fl * 0.9) * (0.6 + 0.4 * hv) * (1 - sh);                // multiplies the body's colour; the walls darken as they go down
          ink[k] = 255 * v + 38 * sh; ink[k + 1] = 252 * v + 30 * sh; ink[k + 2] = 247 * v + 22 * sh; ink[k + 3] = 255;
          const dx = (ht[j + (x < w - 1 ? 1 : 0)] - ht[j - (x > 0 ? 1 : 0)]) * depth, dy = (ht[j + down] - ht[j - up]) * depth, l = 0.5 / Math.sqrt(dx * dx + dy * dy + 1);
          nor[k] = (0.5 - dx * l) * 255; nor[k + 1] = (0.5 + dy * l) * 255; nor[k + 2] = (0.5 + l) * 255; nor[k + 3] = 255;
          rgh[k] = 255 * (1 - fl); rgh[k + 1] = 255 * (0.22 + fl * 0.5); rgh[k + 2] = 0; rgh[k + 3] = 255;   // green: the roughness (the material's own is 1 with this map); red: the clear coat, none on the ink
        }
      }
    };
    const steps = [() => {
      const c = mkCanvas(w, h), x = c.getContext('2d', { willReadFrequently: true });
      x.fillStyle = '#fff'; x.fillRect(0, 0, w, h); x.fillStyle = x.strokeStyle = '#000'; draw(x, w, h);
      const src = x.getImageData(0, 0, w, h).data;
      for (let i = 0; i < n; i++) ht[i] = src[i * 4] / 255;                 // 1: the surface, 0: the groove's floor
      ink = new Uint8Array(n * 4); nor = new Uint8Array(n * 4); rgh = new Uint8Array(n * 4);
    }, soften, soften];
    for (let y = 0; y < h; y += BAND) steps.push(rows(y));
    steps.push(() => {
      const tex = d => {
        const t = new THREE.DataTexture(d, w, h, THREE.RGBAFormat); t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy(); t.needsUpdate = true; return t;
      };
      const map = tex(ink); map.encoding = THREE.sRGBEncoding;
      done({ map, normalMap: tex(nor), roughnessMap: tex(rgh) });
    });
    return steps;
  }
  // work that can wait: each step is a task of its own, so the page draws and answers between two of them
  const waiting = [];
  let stepping = false;
  function step() { try { waiting.shift()(); } finally { if (waiting.length) setTimeout(step, 0); else stepping = false; } }
  function defer(steps) { waiting.push(...steps); if (!stepping && waiting.length) { stepping = true; setTimeout(step, 0); } }
  // The tile itself, built the first time the look is dealt. The chip's size is the plain chip's, so the hand cuts
  // and piles it the same; each edge is a quarter round, for a highlight to run along. The top face has a ring and the
  // nameplate LK cut in, and eight notches at the edge; each notch runs on over the edge and down the wall, where it
  // breaks the highlight. The wall's art is one notch, repeated eight times round.
  // The shape and the ivory are there at once; the grooves are cut in the moments after (the wall's first, then the
  // face's, which waits a short while for the nameplate's type face). Until then each map is a flat stand-in of one
  // texel, so the material is compiled once and a groove's arrival is only a new picture.
  let domino = null;
  function dominoChips() {
    if (domino) return domino;
    const r = 1.95, h = 0.33, b = 0.13, seg = 96, arc = 7, pos = [], nor = [], uv = [], idx = [], geo = new THREE.BufferGeometry();
    // the wall in profile, foot to head: the lower round, the flat, the upper round; v runs with the distance along it
    const prof = [], run = Math.PI * b + h - 2 * b;
    for (let k = 0; k <= arc; k++) { const a = k / arc * Math.PI / 2; prof.push([r - b + b * Math.sin(a), -h / 2 + b - b * Math.cos(a), Math.sin(a), -Math.cos(a), a * b / run]); }
    for (let k = 0; k <= arc; k++) { const a = k / arc * Math.PI / 2; prof.push([r - b + b * Math.cos(a), h / 2 - b + b * Math.sin(a), Math.cos(a), Math.sin(a), 1 - (Math.PI / 2 - a) * b / run]); }
    for (let i = 0; i <= seg; i++) {
      const a = i / seg * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
      prof.forEach(([pr, py, nr, ny, v]) => { pos.push(pr * sx, py, pr * cz); nor.push(nr * sx, ny, nr * cz); uv.push(i / seg, v); });
    }
    const P = prof.length;
    for (let i = 0; i < seg; i++) for (let k = 0; k < P - 1; k++) { const a0 = i * P + k, a1 = a0 + P; idx.push(a0, a1, a0 + 1, a0 + 1, a1, a1 + 1); }
    const cap = (y, up) => {
      const s = pos.length / 3, q = (r - b) / r; pos.push(0, y, 0); nor.push(0, up, 0); uv.push(0.5, 0.5);
      for (let i = 0; i <= seg; i++) {
        const a = i / seg * Math.PI * 2, sx = Math.sin(a), cz = Math.cos(a);
        pos.push((r - b) * sx, y, (r - b) * cz); nor.push(0, up, 0); uv.push(0.5 + 0.5 * q * cz, 0.5 + 0.5 * q * sx * up);
        if (i < seg) { if (up > 0) idx.push(s, s + 1 + i, s + 2 + i); else idx.push(s, s + 2 + i, s + 1 + i); }
      }
    };
    const wall = idx.length; cap(h / 2, 1); const top = idx.length - wall; cap(-h / 2, -1);
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); geo.setAttribute('uv2', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.addGroup(0, wall, 0); geo.addGroup(wall, top, 1); geo.addGroup(wall + top, idx.length - wall - top, 2);
    const flat = (r, g, b) => { const t = new THREE.DataTexture(new Uint8Array([r, g, b, 255]), 1, 1, THREE.RGBAFormat); t.needsUpdate = true; return t; };
    const plain = { map: flat(255, 255, 255), normalMap: flat(128, 128, 255), roughnessMap: flat(255, 56, 0) }; plain.map.encoding = THREE.sRGBEncoding;
    const cut = (m, g) => {   // the gloss stops at the groove, and the ink map's dark floor also shades it from the room
      if (m.map && m.map !== plain.map) [m.map, m.normalMap, m.roughnessMap].forEach(t => t.dispose());
      m.map = m.aoMap = g.map; m.normalMap = m.clearcoatNormalMap = g.normalMap; m.roughnessMap = m.clearcoatMap = g.roughnessMap;
    };
    // The look has no film curve, and its room is bright: the body's colour is held far under ivory, and the room's
    // light, taken in full, brings it up to ivory on the screen. A highlight is a share of that same light, so the
    // lower the colour, the further the highlight stands above the body; a pale colour would burn out to flat white.
    const body = () => { const m = new THREE.MeshPhysicalMaterial({ color: 0x34322d, roughness: 1, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05 }); cut(m, plain); return m; };
    const side = body(), face = body();
    // the wall's art is stretched round the chip and squeezed over its height, and the renderer weighs a normal map by
    // that: the scale puts the notch's walls back to the slope they were drawn with
    side.normalScale.set(4, 1); side.clearcoatNormalScale.set(4, 1);
    // one notch, the full height of the wall: as wide, and its walls as round, as the face's notch is where the two meet at the edge
    defer(grooveSteps(256, 64, (x, w, hh) => { x.fillRect(w / 2 - 26, 0, 52, hh); }, 7, 4, 28, g => {
      [g.map, g.normalMap, g.roughnessMap].forEach(t => { t.wrapS = THREE.RepeatWrapping; t.repeat.set(8, 1); });
      cut(side, g); dirty = true;
    }));
    const probe = mkCanvas(4, 4).getContext('2d'), mark = '900 154px ' + PLAYFAIR;
    const art = (x, s) => {
      const c = s / 2;
      x.lineCap = x.lineJoin = 'round';
      x.lineWidth = s * 0.065; x.beginPath(); x.arc(c, c, s * 0.33, 0, Math.PI * 2); x.stroke();
      x.lineWidth = s * 0.075;
      for (let i = 0; i < 8; i++) { const a = (i + 0.5) * Math.PI / 4, ca = Math.cos(a), sa = Math.sin(a); x.beginPath(); x.moveTo(c + ca * s * 0.425, c + sa * s * 0.425); x.lineTo(c + ca * s * 0.53, c + sa * s * 0.53); x.stroke(); }
      x.font = mark; x.textAlign = 'center'; x.textBaseline = 'middle'; x.lineWidth = s * 0.012;
      x.fillText('LK', c, c + s * 0.016); x.strokeText('LK', c, c + s * 0.016);   // the stroke fattens the hairlines to a width a cutter could make
    };
    domino = { geo, mats: [side, face, face], set: 0, ready: false, busy: false,
      // The top face is cut once the nameplate's type face is in, or after a short wait without it; and once more only
      // if the face arrives after that. The mark's set width tells which face the canvas would draw with.
      paint() {
        if (!this.ready || this.busy) return;
        probe.font = mark; const set = probe.measureText('LK').width;
        if (this.set === set) return;
        this.set = set; this.busy = true;
        defer(grooveSteps(512, 512, art, 5, 4, 0, g => { cut(face, g); this.busy = false; dirty = true; this.paint(); }));
      } };
    const go = () => { domino.ready = true; domino.paint(); };
    if (document.fonts && document.fonts.load) Promise.race([document.fonts.load(mark), new Promise(ok => setTimeout(ok, 300))]).then(go, go); else go();
    take(side, 3.8); take(face, 3.8);
    return domino;
  }
  function chipStack(n, x, z, rot) {
    const g = chipPlain;
    const group = new THREE.Group();
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(g, (i === n - 1 ? chipCap : i < 2 ? chipLow : i > n - 4 ? chipHigh : chipMain).mats);
      m.position.set((Math.random() - 0.5) * 0.12, 0.165 + i * 0.33, (Math.random() - 0.5) * 0.12);
      m.rotation.y = rot + i * 0.37; m.castShadow = true; m.receiveShadow = true; m.userData.mats = m.material; group.add(m);
    }
    group.position.set(x, 0, z); scene.add(group); return group;
  }
  // one stack of seven, the one the hand plays with
  drawChips();
  const stack = chipStack(7, 8.4, 5.6, 2.0);
  const chips = stack.children.slice();   // bottom first

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

  // Foil: the same pressed holographic foil as the claw's marquee sticker (js/claw-machine.js). The stock is
  // near black with the folds as relief; over it the foil is pressed in large soft patches, each with its own
  // grating direction and pitch, and the grating equation picks the colour from one palette (cyan, violet,
  // magenta, gold). The colour answers the view (the card lifting, the camera's lean) and one light that
  // follows the pointer and the page's scroll; it never moves by itself. The dark print is masked out by its own darkness.
  const bumpCanvas = mkCanvas(BW, BH); drawBump(bumpCanvas);
  const bumpTex = new THREE.CanvasTexture(bumpCanvas);
  const foilMat = new THREE.MeshStandardMaterial({ map: backTex, bumpMap: bumpTex, bumpScale: 0.025, roughness: 0.3, metalness: 0.55, alphaTest: 0.5 });
  foilMat.extensions = { derivatives: true };
  const foilLight = new THREE.Vector3(0.1, 0.45, 1), foilAim = { x: 0.1, y: 0.25, s: 0 };   // s: the stage's place in the window, see the frame loop
  const foilK = new THREE.Vector4(0.42, 1.2, 1.9, 0);   // x: colour cycles per unit of grating phase (low: the cards lie almost edge-on to the eye, where the phase runs fast), y: foil brightness, z: patches across the card
  foilMat.onBeforeCompile = shader => {
    shader.uniforms.uFoilLight = { value: foilLight }; shader.uniforms.uFoilK = { value: foilK };
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform vec3 uFoilLight; uniform vec4 uFoilK; vec3 fFoilOut = vec3(0.0);
      float fHash(vec2 p){ p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
      float fNoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * f * (f * (f * 6.0 - 15.0) + 10.0);
        return mix(mix(fHash(i), fHash(i + vec2(1.0, 0.0)), f.x), mix(fHash(i + vec2(0.0, 1.0)), fHash(i + vec2(1.0, 1.0)), f.x), f.y); }
      vec3 fPal(float t){ t = fract(t) * 4.0; float i = floor(t), f = smoothstep(0.0, 1.0, fract(t));
        vec3 c0 = vec3(0.0, 0.85, 1.0), c1 = vec3(0.42, 0.18, 1.0), c2 = vec3(1.0, 0.08, 0.72), c3 = vec3(1.0, 0.72, 0.12);
        vec3 a = i < 1.0 ? c0 : i < 2.0 ? c1 : i < 3.0 ? c2 : c3; vec3 b = i < 1.0 ? c1 : i < 2.0 ? c2 : i < 3.0 ? c3 : c0;
        return mix(a, b, smoothstep(0.12, 0.88, f)); }`)   // each colour holds for a stretch, so a patch is one colour and not a blend of two
      .replace('#include <shadowmap_pars_fragment>', '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      {
        float fold = texture2D(bumpMap, vUv).r;
        float foil = smoothstep(0.03, 0.12, dot(diffuseColor.rgb, vec3(0.3, 0.59, 0.11)));   // everything but the dark print
        vec2 sp = (vUv - 0.5) * vec2(1.0, 1.4) * uFoilK.z;            // card space, square units
        vec3 fV = normalize(vViewPosition); vec3 fL = normalize(uFoilLight); vec3 fH = normalize(fL + fV);
        // the surface frame from the uv derivatives, so the grating bends with the card
        vec3 dp1 = dFdx(-vViewPosition), dp2 = dFdy(-vViewPosition); vec2 du1 = dFdx(vUv), du2 = dFdy(vUv);
        vec3 fTu = normalize(dp1 * du2.y - dp2 * du1.y); vec3 fBu = normalize(cross(normal, fTu));
        // each patch has its own grating direction and pitch (smooth, so the colour comes in broad patches, never in rings)
        float gA = 6.2831853 * fNoise(sp + 1.7); vec2 gd = vec2(cos(gA), sin(gA));
        float gPitch = 0.7 + 0.6 * fNoise(sp * 1.5 + 9.2);
        vec3 fT = gd.x * fTu + gd.y * fBu;
        float fU = dot(fT, fL) + dot(fT, fV);                           // first-order grating equation: the phase picks the colour
        vec3 foilCol = fPal(fU * uFoilK.x * gPitch + 0.8 * fNoise(sp * 0.8 + 4.4));
        float fLobe = 0.45 + 0.55 * pow(max(dot(normal, fH), 0.0), 4.0);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.035) * (0.6 + 0.8 * fold), foil);    // near-black stock under the foil: the spot is strong here, and any pale stock would lift every colour toward white
        fFoilOut = foil * foilCol * fLobe * (0.75 + 0.5 * fold) * uFoilK.y;
        fFoilOut /= max(1.0, max(fFoilOut.r, max(fFoilOut.g, fFoilOut.b)));                       // held under white as a whole colour: a channel cut off alone would turn the gold yellow
      }`)
      // the foil's colour goes in after the tone curve, as the neon does: the film curve pulls a bright cyan or magenta toward white
      .replace('#include <tonemapping_fragment>', `#include <tonemapping_fragment>
      gl_FragColor.rgb += fFoilOut * (0.5 + 0.5 * getShadowMask());`);   // foil in a shadow has less light to split: a chip held over the cards, or one card over the other, still shades it
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
    if (domino) domino.paint();
    backTex.needsUpdate = faceTexA.needsUpdate = faceTexK.needsUpdate = bumpTex.needsUpdate = true; dirty = cast = true;
  }
  // the materials that take the room (the foil fuller than the rest, the paper backs and faces lightly)
  const take = (m, gain) => { m.userData.envGain = gain; lit.push(m); };
  take(foilMat, 0.35); take(backMat, 0.6); take(backFlat, 0.3); take(edgeMat, 0.4);
  take(sheen.material, 1); take(rail.material, 0.36); take(trim.material, 1); take(cardA.material[1], 0.5); take(cardK.material[1], 0.5);
  [chipMain, chipCap, chipLow, chipHigh].forEach(set => set.mats.forEach(m => take(m, 0.8)));
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
    const chipMats = chipMain.mats.concat(chipCap.mats, chipLow.mats, chipHigh.mats);
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
    FRAME = FRAMES[rig.frame] || FRAMES.default;
    // the table
    // glass: the mirror and its rail. felt / flat: an unlit slab in the stage's colour (Solitaire green, the manual's paper, the broadsheet's page)
    glass.forEach(o => { o.visible = rig.table === 'glass'; }); felt.visible = rig.table === 'felt' || rig.table === 'flat';
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
    key.target.position.fromArray(rig.keyTo || [0, 0, 0]); rim.position.fromArray(rig.rimAt || [0, 14, -40]);
    setLight(fill, rig.fill[0], rig.fill[1]); fill.position.fromArray(rig.fill[2] || [30, 18, 42]);
    neon.visible = !!rig.neon;
    setLight(under, rig.under[0], rig.under[1]); setLight(rim, rig.rim[0], rig.rim[1]);
    // the glass takes the look's smoke, the horizon its fog
    if (glass.mirror && rig.mirror !== undefined) {
      const u = glass.mirror.material.uniforms;
      u.color.value.setHex(rig.mirror); u.uGloss.value.fromArray(rig.gloss || [0, 0, 0, 0]); u.uStage.value.copy(scene.background); u.uBase.value = rig.glassBase || 0;
    }
    // the key's streak on the glass: [colour, opacity, roughness, how much of the room it takes]; the dark glass as it was, unless the look says
    const sh = rig.sheen || [0x000000, 0.55, 0.32, 1];
    sheen.material.color.setHex(sh[0]); sheen.material.opacity = sh[1]; sheen.material.roughness = sh[2]; sheen.material.userData.envGain = sh[3];
    // the arcade's table has no padded rail and no etched line: a neon line beyond the hand, and the dark
    if (rig.rail === false) rail.visible = trim.visible = line.visible = false;
    const tile = rig.domino ? dominoChips() : null;   // the look's own chip: its shape and its material
    chips.forEach(m => { m.geometry = tile ? tile.geo : rig.bevel ? chipBevel : chipPlain; m.material = tile ? tile.mats : m.userData.mats; });
    POOL = rig.pool || null; pool.visible = !!POOL; softs.visible = !!rig.softs;
    if (POOL) { pool.material.color.setHex(POOL[0]); pool.material.opacity = POOL[1]; pool.material.blending = POOL[6] ? THREE.NormalBlending : THREE.AdditiveBlending; pool.material.map = POOL[6] ? washTex : glowTex; }
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
      [chipMain, chipCap, chipLow, chipHigh].forEach(set => set.mats.forEach(m => { m.needsUpdate = true; }));   // and the chips' own, which are off the stack while the dominoes are on it
    }
    // the deck
    const back = l === 'foil' ? foilMat : (solitaire || paper) ? backFlat : backMat;
    [cardA, cardK].forEach(c => { c.material[0] = back; c.material[1].roughness = solitaire ? 1 : paper ? 0.9 : 0.55; });
    edgeMat.color.set({ win95: 0xffffff, manual: 0xe6e3dc, press: 0xf3f0ea }[l] || 0xf4f4f4);
    redrawAll();
    // the look's own type arrives with its stylesheet: draw again once it is in
    if (FONTS[l] && document.fonts && document.fonts.load) Promise.all(FONTS[l].map(f => document.fonts.load(f))).then(redrawAll).catch(() => {});
    resize();   // the look may frame the table its own way
  }
  document.addEventListener('theme:change', applyLook);

  // ---------- sizing ----------
  // The frame is fitted, not fixed: from the 70 mm base view the camera dollies out along its own axis
  // until the hand (at full lift) and the whole chip stack sit inside the box with a margin above the
  // rail, and the look point slides sideways so the group sits centred. The mouse leans the camera about this.
  let W = 1, H = 1;
  const camBase = CAM_BASE.clone(), lookAt = LOOK.clone(), fitV = new THREE.Vector3();
  function framePoints() {
    const hx = FRAME.hand[0], hz = FRAME.hand[1], sp = stack.position, top = 7 * 0.33 + 0.5;
    const [pl, pr] = FRAME.pad;
    return [
      [hx - CARD_W * pl, 0, hz - CARD_H * 0.55], [hx + CARD_W * pr, 0, hz - CARD_H * 0.55],
      [hx - CARD_W * pl, 0, hz + CARD_H * 0.62], [hx + CARD_W * pr, 0, hz + CARD_H * 0.62],
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
    // a portrait box crops the sides, so the stack comes in: forward and below the hand, or behind it, as the frame says
    const at = camera.aspect < 1.2 ? FRAME.stackTall : FRAME.stack;
    if (stack.position.x !== at[0] || stack.position.z !== at[1]) dealChips();   // a new place for the stack: the piles go back to one
    stack.position.set(at[0], 0, at[1]); hand.position.x = FRAME.hand[0]; hand.position.z = FRAME.hand[1] + ease(peek) * 1.1;
    CAM_BASE.fromArray(FRAME.cam); LOOK.fromArray(FRAME.look);
    if (POOL) { pool.position.set(FRAME.hand[0] + POOL[4], 0.005, FRAME.hand[1] + POOL[5]); pool.scale.set(POOL[2], POOL[3], 1); }
    const pts = framePoints(), half = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
    let dolly = 0.3, shift = 0, slide = 0;   // start close and back off only as far as the fit needs
    const [fx, fb, ft] = FRAME.fit, rise = CAM_BASE.y / CAM_BASE.distanceTo(LOOK);
    for (let i = 0; i < 64; i++) {
      lookAt.set(LOOK.x + shift, LOOK.y, LOOK.z + slide);
      camBase.copy(lookAt).add(CAM_BASE.clone().sub(LOOK).multiplyScalar(dolly));
      camera.position.copy(camBase); camera.lookAt(lookAt); camera.updateMatrixWorld(true);
      let x0 = 1, x1 = -1, y0 = 1, y1 = -1;
      for (const [x, y, z] of pts) {
        fitV.set(x, y, z).project(camera);
        x0 = Math.min(x0, fitV.x); x1 = Math.max(x1, fitV.x); y0 = Math.min(y0, fitV.y); y1 = Math.max(y1, fitV.y);
      }
      const cx = (x0 + x1) / 2, cy = FRAME.centre ? (y0 + y1) / 2 - (fb + ft) / 2 : 0;
      // centred, only the group's size can be over; otherwise each margin is held as the group lies
      const over = FRAME.centre ? (x1 - x0 > 2 * fx || y1 - y0 > ft - fb) : (x0 < -fx || x1 > fx || y0 < fb || y1 > ft);
      if (!over && Math.abs(cx) < 0.01 && Math.abs(cy) < 0.01) break;
      shift += cx * camBase.distanceTo(lookAt) * half * camera.aspect;
      slide -= cy * camBase.distanceTo(lookAt) * half / rise;   // along the table, a step counts for less on screen by the camera's slope
      if (over && dolly < 1.8) dolly *= 1.03;
    }
    // the loop may leave the base one step ahead of the camera: settle on the base
    lookAt.set(LOOK.x + shift, LOOK.y, LOOK.z + slide);
    camBase.copy(lookAt).add(CAM_BASE.clone().sub(LOOK).multiplyScalar(dolly));
    camera.position.copy(camBase); camera.lookAt(lookAt); camera.updateMatrixWorld(true);
    // the rail, with its trim and the line etched before it: where it always was, or where the frame asks
    let railZ = 15;
    if (FRAME.rail) { const dir = fitV.set(0, -1 + 2 * FRAME.rail, 0.5).unproject(camera).sub(camBase).normalize(); railZ = camBase.z + dir.z * (1.6 - camBase.y) / dir.y + 3.3; }   // the sight line at that height meets the rail's far shoulder
    rail.position.z = railZ; trim.position.z = railZ - 3.6; line.position.z = railZ + 51;
    // the neon betting line: its nearest point crosses at the same height of the frame in any box
    if (FRAME.bet) {
      const dir = fitV.set(0, -1 + 2 * FRAME.bet, 0.5).unproject(camera).sub(camBase).normalize();
      bet.position.set(lookAt.x, 0.03, camBase.z - dir.z * camBase.y / dir.y);
    }
    aim(); camera.updateMatrixWorld(true);   // the lean is kept across a resize
    tidyChips();
    dirty = cast = true; placeHits();
  }
  addEventListener('resize', resize, { passive: true });
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);

  // ---------- parallax (mouse only): the camera leans round the hand ----------
  // The pointer's place in the window turns the camera a few degrees about the point it looks at, to the side and
  // up and down, and the camera keeps looking there: the hand holds its place while the chips, the reflections in
  // the glass and the foil's colour shift against it. Each axis is a critically damped spring stepped by its exact
  // solution, so a move starts and ends gently and takes the same time at 60 Hz, at 120 Hz or across a dropped frame.
  const POSES = [[0, 0]];   // every lean the camera may come to: at rest, and the four corners of its reach where the mouse leans it
  const LEAN = [0.105, 0.05], LEAN_RATE = 9;   // radians to each side, radians up and down; the spring's frequency, per second
  const lean = [{ x: 0, v: 0, to: 0 }, { x: 0, v: 0, to: 0 }];
  if (!REDUCED && matchMedia('(pointer: fine)').matches) {
    addEventListener('pointermove', e => {
      if ((e.pointerType && e.pointerType !== 'mouse') || hold || dragPeek !== null) return;   // with the cards or chips in the hand the table holds still
      lean[0].to = (e.clientX / (innerWidth || 1) * 2 - 1) * LEAN[0];
      lean[1].to = (1 - e.clientY / (innerHeight || 1) * 2) * LEAN[1];
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { lean[0].to = lean[1].to = 0; });
    POSES.push([LEAN[0], LEAN[1]], [LEAN[0], -LEAN[1]], [-LEAN[0], LEAN[1]], [-LEAN[0], -LEAN[1]]);
  }
  function spring(s, dt) {   // true while it moved
    const d = s.x - s.to;
    if (Math.abs(d) < 2e-5 && Math.abs(s.v) < 2e-4) { const was = s.x; s.x = s.to; s.v = 0; return was !== s.to; }
    const e = Math.exp(-LEAN_RATE * dt), k = (s.v + LEAN_RATE * d) * dt;
    s.x = s.to + (d + k) * e; s.v = (s.v - LEAN_RATE * k) * e;
    return true;
  }
  const leanV = new THREE.Vector3(), SIDE = new THREE.Vector3(1, 0, 0), UP = new THREE.Vector3(0, 1, 0);
  function aim(turn = lean[0].x, tip = lean[1].x) {   // the camera on its arc round the look point, looking at it
    leanV.copy(camBase).sub(lookAt).applyAxisAngle(SIDE, -tip).applyAxisAngle(UP, turn);
    camera.position.copy(lookAt).add(leanV); camera.lookAt(lookAt);
  }

  // the foil's light follows the pointer over the page (any pointer: a touch moves it too), and the page as it
  // scrolls: the stage's place in the window swings the light, so the foil turns as the table goes by; see foilMat
  let scrolled = true;
  addEventListener('pointermove', e => {
    foilAim.x = (e.clientX / (innerWidth || 1)) * 2 - 1; foilAim.y = 1 - (e.clientY / (innerHeight || 1)) * 2;
  }, { passive: true });
  addEventListener('scroll', () => { scrolled = true; }, { passive: true });

  // ---------- hit patches: the hand and each pile of chips, projected to the screen ----------
  // Only these patches take the touch (touch-action: none in CSS), so the page still scrolls everywhere else
  // over the table. They are placed again after every render, so the camera's lean and the chips' moves keep them true.
  const hitCards = stage.querySelector('.peek__hit--cards'), hitChips = stage.querySelector('.peek__hit--chips'), cue = stage.querySelector('.peek__cue');
  const chipHits = hitChips ? [hitChips] : [];
  const ease = t => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v)), clamp01 = v => clamp(v, 0, 1);
  const v3 = new THREE.Vector3();
  function project(x, y, z) { v3.set(x, y, z).project(camera); return [(v3.x + 1) / 2 * W, (1 - v3.y) / 2 * H]; }
  // the point of the plane at height y that lies under a place on the stage
  function tableAt(sx, sy, y) {
    v3.set(sx / W * 2 - 1, 1 - sy / H * 2, 0.5).unproject(camera).sub(camera.position);
    const t = (y - camera.position.y) / Math.min(v3.y, -1e-3);
    return [camera.position.x + v3.x * t, camera.position.z + v3.z * t];
  }
  function bounds(points, pad) {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of points) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    return { x: x0 - pad, y: y0 - pad, w: x1 - x0 + 2 * pad, h: y1 - y0 + 2 * pad };
  }
  const boxes = new Map();
  function place(el, b) {
    const was = boxes.get(el);   // a style write costs a layout: only when the patch has moved
    if (was && Math.abs(was.x - b.x) < 0.5 && Math.abs(was.y - b.y) < 0.5 && Math.abs(was.w - b.w) < 0.5 && Math.abs(was.h - b.h) < 0.5) return;
    boxes.set(el, b); el.style.left = b.x + 'px'; el.style.top = b.y + 'px'; el.style.width = b.w + 'px'; el.style.height = b.h + 'px';
  }
  function placeHits() {
    if (!hitCards || !hitChips) return;
    camera.updateMatrixWorld(true); camera.matrixWorldInverse.copy(camera.matrixWorld).invert();
    const hx = hand.position.x, hz = hand.position.z;
    const xl = hx - CARD_W * 0.8, xr = hx + CARD_W * 1.15, zf = hz - CARD_H * 0.6, zn = hz + CARD_H * 0.62;
    const cards = bounds([project(xl, 0, zf), project(xr, 0, zf), project(xl, 0, zn), project(xr, 0, zn), project(xl, CARD_H * 0.4, hz), project(xr, CARD_H * 0.4, hz)], 14);
    place(hitCards, cards);
    const ps = piles();
    while (chipHits.length < ps.length) { const el = hitChips.cloneNode(false); stage.insertBefore(el, hitChips.nextSibling); bindChips(el); chipHits.push(el); }
    chipHits.forEach((el, i) => {
      const off = i >= ps.length && !(hold && hold.el === el);   // the patch a drag began on stays until the drag ends
      if (el.hidden !== off) el.hidden = off;
      if (i < ps.length) place(el, pileBox(ps[i]));
    });
    if (cue) { const [cx, cy] = project(hx + CARD_W * 0.25, 0, zf); cue.style.left = cx + 'px'; cue.style.top = (cy - 46) + 'px'; }
  }

  // ---------- interaction ----------
  // Cards: press and drag up to peek; let go and they settle back. Enter or Space peeks from the keyboard.
  let dragPeek = null, keyPeek = false;
  function touched() { stage.classList.add('is-touched'); }
  let peekId = null;   // the one pointer that holds the cards: a second finger on them is ignored, and only this one lets them go
  if (hitCards) {
    let y0 = 0;
    hitCards.addEventListener('pointerdown', e => {
      if (e.button || peekId !== null) return;
      e.preventDefault(); touched();
      peekId = e.pointerId; y0 = e.clientY; dragPeek = 0; dirty = true;
      try { hitCards.setPointerCapture(peekId); } catch (_) {}
    });
    hitCards.addEventListener('pointermove', e => { if (e.pointerId === peekId) { dragPeek = clamp01((y0 - e.clientY) / 140); dirty = true; } });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => hitCards.addEventListener(n, e => { if (e.pointerId === peekId) { peekId = null; dragPeek = null; dirty = true; } }));
  }
  stage.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); touched(); keyPeek = !keyPeek; dirty = true; } });

  // Chips: there to be played with, the way a player's hands never leave the stack. Press a pile and the chips from
  // that level up come away in the hand: the foot of a pile takes all of it, its top face one chip. They follow the
  // pointer over the table, and where they are let go they drop: back on their pile, onto another one, or as a new
  // pile beside it. Under a mouse the pile shows the cut before the press. A pile is the chips that share a centre
  // (sx, sz, in the stack's own space); lv is a chip's level in it. mode 0: at rest, 1: in the hand, 2: dropping.
  const CHIP_R = 1.95, CHIP_H = 0.33, LIFT = 0.55, HOVER = 0.13, GRAVITY = 150, REACH = 15;
  const bits = chips.map((m, i) => ({ m, sx: 0, sz: 0, lv: i, jx: m.position.x, jz: m.position.z, mode: 0, wait: 0, vy: 0, up: 0 }));
  chips.forEach(m => { m.rotation.order = 'XZY'; });   // the chip's own turn first, then any lean, whichever way the chip is turned
  let hold = null, hover = null;
  function dealChips() {   // one stack again, in its first order
    bits.forEach((b, i) => { b.sx = b.sz = 0; b.lv = i; b.mode = 0; b.up = b.vy = 0; b.m.position.set(b.jx, CHIP_H / 2 + i * CHIP_H, b.jz); b.m.rotation.x = b.m.rotation.z = 0; });
    hold = hover = null;
  }
  function piles() {   // the chips on the table, pile by pile, bottom first
    const out = [];
    for (const b of bits) {
      if (b.mode === 1) continue;
      let p = out.find(q => q.x === b.sx && q.z === b.sz);
      if (!p) out.push(p = { x: b.sx, z: b.sz, bits: [] });
      p.bits.push(b);
    }
    out.forEach(p => p.bits.sort((a, b) => a.lv - b.lv));
    return out;
  }
  function boxAt(px, pz, top) {   // a pile of a given height at a place on the table, as it lies on the screen: with a margin, and never a smaller target than a fingertip
    const x = stack.position.x + px, z = stack.position.z + pz, r = CHIP_R;
    const b = bounds([project(x - r, 0, z), project(x + r, 0, z), project(x, 0, z + r), project(x - r, top, z), project(x + r, top, z), project(x, top, z - r)], 10);
    if (b.w < 48) { b.x -= (48 - b.w) / 2; b.w = 48; }
    if (b.h < 48) { b.y -= (48 - b.h) / 2; b.h = 48; }
    return b;
  }
  const pileBox = p => boxAt(p.x, p.z, p.bits.length * CHIP_H);
  // A pile stands in view when its whole patch lies on the stage, above the rail where there is one, at every lean the
  // camera may come to. over() measures how far a pile at a place is out: [sideways, up or down] in pixels, 0 when in.
  function see(turn, tip) { aim(turn, tip); camera.updateMatrixWorld(true); camera.matrixWorldInverse.copy(camera.matrixWorld).invert(); }
  function over(px, pz, top) {
    let l = 0, r = 0, u = 0, d = 0;
    for (const [turn, tip] of POSES) {
      see(turn, tip);
      const b = boxAt(px, pz, top), foot = rail.visible ? Math.min(H, project(lookAt.x, 4.5, rail.position.z)[1] + 10) : H;   // the rail's crest hides the table behind it
      l = Math.max(l, -b.x); r = Math.max(r, b.x + b.w - W); u = Math.max(u, -b.y); d = Math.max(d, b.y + b.h - foot);
    }
    see();
    return [l - r, u - d, Math.max(l, r, u, d)];
  }
  const seen = (px, pz, top) => over(px, pz, top)[2] < 0.5;
  // the nearest place to one on the table where a pile of that height stands in view
  function intoView(px, pz, top) {
    for (let i = 0; i < 6; i++) {
      const [dx, dy, out] = over(px, pz, top);
      if (out < 0.5) break;
      const c = project(stack.position.x + px, 0, stack.position.z + pz), at = tableAt(c[0] + dx * 1.02, c[1] + dy * 1.02, 0);
      px = at[0] - stack.position.x; pz = at[1] - stack.position.z;
    }
    return [px, pz];
  }
  // the cards' place on the table, with room for a chip's edge, in the stack's own space: [left, right, far, near]
  function cardsBox() {
    const m = CHIP_R + 0.3, hx = FRAME.hand[0] - stack.position.x, hz = FRAME.hand[1] - stack.position.z;
    return [hx - CARD_W * 0.62 - m, hx + CARD_W * 0.82 + m, hz - CARD_H * 0.54 - m, hz + CARD_H * 0.56 + m];
  }
  // a pile can stand at a place: in view, off the cards, clear of the other piles
  function free(px, pz, top, others) {
    const box = cardsBox();
    if (px > box[0] + 1e-3 && px < box[1] - 1e-3 && pz > box[2] + 1e-3 && pz < box[3] - 1e-3) return false;
    for (const p of others) if (Math.hypot(px - p.x, pz - p.z) < CHIP_R * 2 + 0.19) return false;
    return seen(px, pz, top);
  }
  // after the frame changes (a resize, a new look): a pile left outside the view comes to the nearest free place in it, or back onto the stack's own place
  function tidyChips() {
    for (const p of piles()) {
      const top = p.bits.length * CHIP_H;
      if ((p.x === 0 && p.z === 0) || seen(p.x, p.z, top)) continue;
      const others = piles().filter(q => q.x !== p.x || q.z !== p.z), home = others.find(q => q.x === 0 && q.z === 0);
      let [x, z] = intoView(p.x, p.z, top), base = 0;
      if (!free(x, z, top, others)) { x = z = 0; base = home ? home.bits.length : 0; }
      p.bits.forEach((b, k) => { b.sx = x; b.sz = z; b.lv = base + k; b.mode = 0; b.up = b.vy = 0; b.m.position.set(x + b.jx, CHIP_H / 2 + b.lv * CHIP_H, z + b.jz); b.m.rotation.x = b.m.rotation.z = 0; });
    }
  }
  // The pile under a place on the stage, and the cut: the level the pointer is on (that chip and all above it come
  // away); on the top face, the top chip alone. The sight line is tried against each pile as a cylinder a little
  // fatter than the chips, nearest first, so a pile in front wins over one behind it; a press in the margin of a
  // patch goes to the pile whose patch it is nearest the middle of.
  function pileAt(sx, sy) {
    const o = camera.position, d = v3.set(sx / W * 2 - 1, 1 - sy / H * 2, 0.5).unproject(camera).sub(o), r = CHIP_R * 1.12;
    const a = d.x * d.x + d.z * d.z;
    let best = null, near = Infinity;
    for (const p of piles()) {
      const cx = stack.position.x + p.x - o.x, cz = stack.position.z + p.z - o.z, top = p.bits.length * CHIP_H;
      const tTop = (top - o.y) / d.y, ex = d.x * tTop - cx, ez = d.z * tTop - cz;
      if (ex * ex + ez * ez <= r * r) { if (tTop < near) { near = tTop; best = { pile: p, cut: p.bits.length - 1 }; } continue; }   // on the top face
      const b = d.x * cx + d.z * cz, disc = b * b - a * (cx * cx + cz * cz - r * r);
      if (disc < 0) continue;
      const t = (b - Math.sqrt(disc)) / a, y = o.y + d.y * t;
      if (y >= 0 && y <= top && t < near) { near = t; best = { pile: p, cut: clamp(Math.floor(y / CHIP_H), 0, p.bits.length - 1) }; }
    }
    if (best) return best;
    near = Infinity;
    for (const p of piles()) {
      const b = pileBox(p), m = Math.hypot(sx - b.x - b.w / 2, sy - b.y - b.h / 2);
      if (sx >= b.x && sx <= b.x + b.w && sy >= b.y && sy <= b.y + b.h && m < near) { near = m; best = { pile: p, cut: sy > b.y + b.h / 2 ? 0 : Math.min(p.bits.length - 1, Math.ceil(p.bits.length / 2)) }; }   // low in the margin: the whole pile; high: its top half, and never fewer than one chip
    }
    return best;
  }
  function stagePoint(e) { const r = stage.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
  function bindChips(el) {
    el.addEventListener('pointerdown', e => {
      if (e.button || hold) return;
      const [sx, sy] = stagePoint(e), on = pileAt(sx, sy);
      if (!on) return;
      e.preventDefault(); touched();
      const taken = on.pile.bits.slice(on.cut), lead = taken[0].m.position, at = tableAt(sx, sy, lead.y);
      taken.forEach(b => { b.mode = 1; b.up = 0; });
      // the chip stays under the pointer where it was taken: the offset from the sight line is kept
      hold = { id: e.pointerId, el, bits: taken, sx, sy, y: lead.y, ox: stack.position.x + lead.x - at[0], oz: stack.position.z + lead.z - at[1], from: on.pile };
      hover = null; dirty = true;
      try { el.setPointerCapture(e.pointerId); } catch (_) {}
    });
    el.addEventListener('pointermove', e => {
      if (hold) { if (e.pointerId === hold.id) { [hold.sx, hold.sy] = stagePoint(e); dirty = true; } return; }
      if (e.pointerType !== 'mouse') return;
      const [sx, sy] = stagePoint(e), on = pileAt(sx, sy);
      hover = on ? { x: on.pile.x, z: on.pile.z, cut: on.cut } : null; dirty = true;
    });
    el.addEventListener('pointerleave', () => { if (hover) { hover = null; dirty = true; } });
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(n => el.addEventListener(n, e => { if (hold && e.pointerId === hold.id) drop(); }));
  }
  if (hitChips) bindChips(hitChips);
  // how near the chips may come: a little in front of the hand, and short of the rail's foot
  const nearest = () => Math.min(FRAME.hand[1] + 7.6, rail.visible ? rail.position.z - 3.4 - CHIP_R - 0.2 : Infinity);
  function drop() {
    const h = hold, sp = stack.position, lead = h.bits[0].m.position, ps = piles();
    hold = null; dirty = true;
    try { h.el.releasePointerCapture(h.id); } catch (_) {}
    let x = lead.x, z = lead.z, onto = null;
    for (const p of ps) if (Math.hypot(p.x - x, p.z - z) < CHIP_R * 1.3) onto = p;   // near enough to a pile: onto it
    const tall = h.bits.length * CHIP_H;
    if (!onto) {
      // a pile of its own, stood clear of the other piles and off the cards
      const gap = CHIP_R * 2 + 0.2, box = cardsBox();
      for (let n = 0; n < 4; n++) {
        for (const p of ps) {
          const dx = x - p.x, dz = z - p.z, d = Math.hypot(dx, dz);
          if (d < gap) { x = d > 1e-3 ? p.x + dx * gap / d : p.x + gap; z = d > 1e-3 ? p.z + dz * gap / d : p.z; }
        }
        if (x > box[0] && x < box[1] && z > box[2] && z < box[3]) {
          const out = [x - box[0], box[1] - x, z - box[2], box[3] > nearest() - sp.z ? Infinity : box[3] - z], i = out.indexOf(Math.min(...out));
          if (i === 0) x = box[0]; else if (i === 1) x = box[1]; else if (i === 2) z = box[2]; else z = box[3];
        }
      }
      [x, z] = intoView(x, z, tall);
    }
    // no room there (a narrow frame has little table beside the cards), or the pile would stand out of view: the chips go back where they came from
    if (onto ? !seen(onto.x, onto.z, onto.bits.length * CHIP_H + tall) : !free(x, z, tall, ps)) {
      x = h.from.x; z = h.from.z; onto = ps.find(p => p.x === x && p.z === z) || null;
    }
    const base = onto ? onto.bits.length : 0;
    h.bits.forEach((b, k) => { b.sx = onto ? onto.x : x; b.sz = onto ? onto.z : z; b.lv = base + k; b.mode = 2; b.wait = k * 0.028; b.vy = 0; });   // bottom first: the pile lands as a riffle
  }
  function updateChips(dt) {
    let moving = false;
    const sp = stack.position, glide = REDUCED ? 1 : 1 - Math.exp(-dt * 20);
    if (hold) {
      const lead = hold.bits[0].m.position;
      // held clear of whatever pile is under the hand
      let floor = 0;
      for (const p of piles()) if (Math.hypot(p.x - lead.x, p.z - lead.z) < CHIP_R * 2) floor = Math.max(floor, p.bits.length * CHIP_H);
      hold.y += (floor + LIFT + CHIP_H / 2 - hold.y) * glide;
      // the hand: the pointer's sight line down to the height the chips are held at; then the chips themselves are kept
      // on the table and in view, as they are held and as they would stand if let go here
      const at = tableAt(clamp(hold.sx, 0, W), clamp(hold.sy, 0, H), hold.y);
      const [x, z] = intoView(clamp(at[0] + hold.ox, FRAME.hand[0] - REACH, FRAME.hand[0] + REACH) - sp.x, clamp(at[1] + hold.oz, FRAME.hand[1] - REACH, nearest()) - sp.z, hold.y + hold.bits.length * CHIP_H);
      hold.bits.forEach((b, k) => {
        const p = b.m.position, r = b.m.rotation, under = k && !REDUCED ? hold.bits[k - 1].m.position : null;
        if (!under) { p.set(x, hold.y + k * CHIP_H, z); r.x = r.z = 0; return; }
        // each chip trails the one under it a little, so a pile carried fast leans back and rights itself
        const f = 1 - Math.exp(-dt * 40);
        let dx = p.x + (under.x - p.x) * f - under.x, dz = p.z + (under.z - p.z) * f - under.z;
        const d = Math.hypot(dx, dz); if (d > 0.28) { dx *= 0.28 / d; dz *= 0.28 / d; }
        p.set(under.x + dx, hold.y + k * CHIP_H, under.z + dz); r.z = -dx * 0.3; r.x = dz * 0.3;
      });
      moving = true;
    }
    for (const b of bits) {
      const p = b.m.position, r = b.m.rotation, restY = CHIP_H / 2 + b.lv * CHIP_H;
      if (b.mode === 2) {
        moving = true;
        const tx = b.sx + b.jx, tz = b.sz + b.jz, f = REDUCED ? 1 : 1 - Math.exp(-dt * 30);
        p.x += (tx - p.x) * f; p.z += (tz - p.z) * f; r.x *= 1 - f; r.z *= 1 - f;
        if (!REDUCED) {
          if (b.wait > 0) { b.wait -= dt; continue; }
          if (Math.hypot(tx - p.x, tz - p.z) > 0.3) continue;     // over its place first, then down
          b.vy -= GRAVITY * dt; p.y += b.vy * dt;
          if (p.y > restY) continue;
          if (b.vy < -9) { p.y = restY; b.vy *= -0.3; continue; }   // the clack: one short hop off a real drop
        }
        b.mode = 0; b.vy = 0; p.set(tx, restY, tz); r.x = r.z = 0;
      } else if (b.mode === 0) {
        const want = hover && hover.x === b.sx && hover.z === b.sz && b.lv >= hover.cut ? HOVER : 0;
        if (Math.abs(want - b.up) > 1e-3) { b.up += (want - b.up) * glide; moving = true; } else b.up = want;
        p.y = restY + b.up;
      }
    }
    return moving;
  }

  // ---------- frame loop ----------
  // dirty: something on screen changed, draw; cast: something that throws a shadow moved, so the shadow map is drawn again too
  let dirty = true, cast = true, visible = true, lastTheta = -1, peek = 0, lastT = performance.now();
  renderer.shadowMap.autoUpdate = false;
  const io = new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible) dirty = true; }, { threshold: 0 });
  io.observe(pin);

  function frame(t) {
    if (lost) return;
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
      hand.position.z = FRAME.hand[1] + c * 1.1;
      lastTheta = theta; dirty = cast = true;
    }

    if (updateChips(dt)) dirty = cast = true;

    // parallax
    const turned = spring(lean[0], dt), tipped = spring(lean[1], dt);
    if (turned || tipped) { aim(); dirty = true; }

    // the foil's light eases toward the pointer and the scroll; with both still, it holds still
    if (cardA.material[0] === foilMat) {
      if (scrolled) { const r = stage.getBoundingClientRect(); foilAim.s = clamp((r.top + r.height / 2) / (innerHeight || 1) * 2 - 1, -1.5, 1.5); scrolled = false; }
      const lx = foilAim.x * 0.9 + foilAim.s * 0.5, ly = 0.3 + foilAim.y * 0.6 - foilAim.s * 0.7, k = REDUCED ? 1 : 1 - Math.exp(-dt * 6);
      if (Math.abs(lx - foilLight.x) + Math.abs(ly - foilLight.y) > 2e-3) { foilLight.x += (lx - foilLight.x) * k; foilLight.y += (ly - foilLight.y) * k; dirty = true; }
    }

    if (dirty) {
      if (cast) { renderer.shadowMap.needsUpdate = true; cast = false; }
      if (pixelOn) renderSolitaire(); else renderer.render(scene, camera);
      placeHits(); dirty = false;
    }
  }
  applyLook();
  bendCard(cardA, 0); bendCard(cardK, 0);
  requestAnimationFrame(frame);
  }

  // Build the scene only when its stage is within three quarters of a screen, so a visitor who never
  // scrolls here pays nothing, and the shaders compile one scroll ahead of the viewer rather than at load.
  var begun = false;
  function begin() { if (begun) return; begun = true; start(); }
  if ('IntersectionObserver' in window) {
    var approach = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { approach.disconnect(); begin(); } }, { rootMargin: '75% 0px' });
    approach.observe(stage);
  } else begin();
})();
