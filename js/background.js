/* Ambient background: a perspective court grid low on the screen, slow drifting dust,
   and faint symbols from the things this site is about (math, code, gaming, anime, ball sports).
   Tuned to stay quiet: everything is drawn at very low opacity. Settings live in content/site.js. */
window.Background = (function () {
  'use strict';
  var canvas, ctx, W = 0, H = 0, dpr = 1, cfg = {}, items = [], dust = [], raf = 0, running = false, last = 0;
  var colors = { text: '#e6e9f5', accent: '#8ab4ff', accent2: '#b9a6ff', dark: true };
  var reduced = window.U && window.U.prefersReducedMotion();
  var pointer = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

  var GLYPHS = ['∑', '∫', 'π', '√', 'λ', '∞', '∂', '∇', '∀', '∃',
    'x²', 'f(x)', 'O(n)', 'ℕ', 'ℝ', '{ }', '</>', '=>', '::', '0x1F', 'if', 'fn', '++',
    '✦', '★', '♪', 'カ', 'タ', '♠', '▲', '■', '●',
    '♞', '♜', '♚', '♝', 'e4', 'Nf3'];
  var SHAPES = ['volleyball', 'volleyball', 'basketball', 'controller', 'net'];

  function readColors() {
    var cs = getComputedStyle(document.documentElement);
    colors.text = cs.getPropertyValue('--text').trim() || colors.text;
    colors.accent = cs.getPropertyValue('--accent').trim() || colors.accent;
    colors.accent2 = cs.getPropertyValue('--accent-2').trim() || colors.accent2;
    colors.dark = document.documentElement.getAttribute('data-theme') !== 'light';
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function makeItems() {
    items = []; dust = [];
    var k = Math.max(0.2, Math.min(3, +cfg.intensity || 1));
    if (cfg.glyphs !== false) {
      var n = Math.round(20 * k * Math.min(1.4, W / 1000));
      for (var i = 0; i < n; i++) {
        var shape = Math.random() < 0.28 ? SHAPES[Math.floor(Math.random() * SHAPES.length)] : null;
        items.push({
          shape: shape,
          glyph: shape ? null : GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
          x: Math.random() * W, y: Math.random() * H,
          size: shape ? rnd(16, 30) : rnd(15, 34),
          vx: rnd(-4, 4), vy: rnd(-7, -2),
          rot: rnd(0, Math.PI * 2), vr: rnd(-0.12, 0.12),
          a: rnd(0.05, 0.13), depth: rnd(0.3, 1),
          accent: Math.random() < 0.3
        });
      }
    }
    if (cfg.particles !== false) {
      var m = Math.round(90 * k * Math.min(1.5, W / 1000));
      for (var j = 0; j < m; j++) {
        dust.push({ x: Math.random() * W, y: Math.random() * H, r: rnd(0.6, 1.8), vy: rnd(-9, -3), vx: rnd(-2, 2), a: rnd(0.12, 0.45), tw: rnd(0, 6.28), accent: Math.random() < 0.25 });
      }
    }
  }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    makeItems();
    if (reduced) draw(0);
  }

  /* --- little drawings --- */
  function volleyball(r) {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.95, -r * 0.3); ctx.quadraticCurveTo(0, -r * 0.1, r * 0.55, r * 0.83); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.45, -r * 0.9); ctx.quadraticCurveTo(r * 0.15, -r * 0.15, r * 0.98, r * 0.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r * 0.85, r * 0.5); ctx.quadraticCurveTo(-r * 0.2, r * 0.05, r * 0.1, -r * 0.99); ctx.stroke();
  }
  function basketball(r) {
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.moveTo(0, -r); ctx.lineTo(0, r); ctx.stroke();
    ctx.beginPath(); ctx.arc(-r * 1.25, 0, r * 0.95, -Math.PI * 0.42, Math.PI * 0.42); ctx.stroke();
    ctx.beginPath(); ctx.arc(r * 1.25, 0, r * 0.95, Math.PI * 0.58, Math.PI * 1.42); ctx.stroke();
  }
  function controller(r) {
    var w = r * 1.6, h = r * 0.95;
    ctx.beginPath();
    ctx.moveTo(-w * 0.55, -h * 0.5); ctx.lineTo(w * 0.55, -h * 0.5);
    ctx.quadraticCurveTo(w * 0.9, -h * 0.5, w * 0.95, h * 0.2);
    ctx.quadraticCurveTo(w, h * 0.75, w * 0.6, h * 0.6); ctx.lineTo(w * 0.35, h * 0.15); ctx.lineTo(-w * 0.35, h * 0.15);
    ctx.lineTo(-w * 0.6, h * 0.6); ctx.quadraticCurveTo(-w, h * 0.75, -w * 0.95, h * 0.2);
    ctx.quadraticCurveTo(-w * 0.9, -h * 0.5, -w * 0.55, -h * 0.5); ctx.closePath(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-w * 0.55, -h * 0.15); ctx.lineTo(-w * 0.25, -h * 0.15); ctx.moveTo(-w * 0.4, -h * 0.35); ctx.lineTo(-w * 0.4, h * 0.05); ctx.stroke();
    ctx.beginPath(); ctx.arc(w * 0.32, -h * 0.25, r * 0.09, 0, 6.28); ctx.arc(w * 0.5, -h * 0.05, r * 0.09, 0, 6.28); ctx.stroke();
  }
  function net(r) {
    ctx.beginPath(); ctx.rect(-r, -r * 0.5, r * 2, r); ctx.stroke();
    ctx.beginPath();
    for (var i = 1; i < 4; i++) { ctx.moveTo(-r + i * r / 2, -r * 0.5); ctx.lineTo(-r + i * r / 2, r * 0.5); }
    ctx.moveTo(-r, 0); ctx.lineTo(r, 0); ctx.stroke();
  }

  function drawGrid(t) {
    var horizon = H * 0.72;
    var vpx = W * 0.5 + (pointer.x - 0.5) * 40;
    var alpha = colors.dark ? 0.16 : 0.12;
    ctx.save();
    ctx.lineWidth = 1;
    // fade toward the horizon
    var grad = ctx.createLinearGradient(0, horizon, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.25, hexA(colors.accent, alpha * 0.5));
    grad.addColorStop(1, hexA(colors.accent, alpha));
    ctx.strokeStyle = grad;
    ctx.beginPath();
    var cols = 18;
    for (var i = -cols; i <= cols; i++) {
      var x = vpx + i * (W * 0.16);
      ctx.moveTo(vpx + (x - vpx) * 0.02, horizon);
      ctx.lineTo(x, H + 40);
    }
    // horizontal lines, spaced by perspective, slowly scrolling toward the viewer
    var rows = 14, phase = reduced ? 0 : (t * 0.00004) % 1;
    for (var j = 0; j < rows; j++) {
      var u = ((j + phase) / rows);
      var y = horizon + (H - horizon) * (u * u);
      ctx.moveTo(0, y); ctx.lineTo(W, y);
    }
    ctx.stroke();
    // a brighter "net" line near the middle of the floor
    ctx.strokeStyle = hexA(colors.accent, alpha * 0.9);
    ctx.beginPath(); var ny = horizon + (H - horizon) * 0.3; ctx.moveTo(0, ny); ctx.lineTo(W, ny); ctx.stroke();
    // soft glow at the horizon
    var glow = ctx.createRadialGradient(vpx, horizon, 0, vpx, horizon, W * 0.55);
    glow.addColorStop(0, hexA(colors.accent, colors.dark ? 0.10 : 0.07));
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  function hexA(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(h, 16);
    if (isNaN(n)) return 'rgba(138,180,255,' + a + ')';
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }

  function draw(t) {
    ctx.clearRect(0, 0, W, H);
    pointer.x += (pointer.tx - pointer.x) * 0.04; pointer.y += (pointer.ty - pointer.y) * 0.04;
    if (cfg.grid !== false) drawGrid(t);
    var px = (pointer.x - 0.5) * 30, py = (pointer.y - 0.5) * 20;
    // dust
    for (var i = 0; i < dust.length; i++) {
      var d = dust[i];
      var tw = 0.65 + 0.35 * Math.sin(t * 0.0015 + d.tw);
      ctx.fillStyle = hexA(d.accent ? colors.accent : colors.text, d.a * tw * (colors.dark ? 1 : 0.7));
      ctx.beginPath(); ctx.arc(d.x + px * 0.3, d.y + py * 0.3, d.r, 0, 6.28); ctx.fill();
    }
    // glyphs / shapes
    ctx.lineWidth = 1.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (var j = 0; j < items.length; j++) {
      var it = items[j];
      var c = it.accent ? colors.accent : (colors.dark ? colors.text : '#10141f');
      var a = it.a * (colors.dark ? 1 : 0.8);
      ctx.save();
      ctx.translate(it.x + px * it.depth, it.y + py * it.depth);
      ctx.rotate(it.rot);
      ctx.strokeStyle = hexA(c, a); ctx.fillStyle = hexA(c, a);
      if (it.shape === 'volleyball') volleyball(it.size * 0.55);
      else if (it.shape === 'basketball') basketball(it.size * 0.55);
      else if (it.shape === 'controller') controller(it.size * 0.7);
      else if (it.shape === 'net') net(it.size * 0.7);
      else { ctx.font = '500 ' + it.size + 'px "Space Mono", ui-monospace, monospace'; ctx.fillText(it.glyph, 0, 0); }
      ctx.restore();
    }
  }

  function step(t) {
    if (!running) return;
    var dt = Math.min(0.05, (t - last) / 1000 || 0.016); last = t;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt;
      if (it.y < -60) { it.y = H + 40; it.x = Math.random() * W; }
      if (it.x < -60) it.x = W + 40; else if (it.x > W + 60) it.x = -40;
    }
    for (var j = 0; j < dust.length; j++) {
      var d = dust[j];
      d.x += d.vx * dt; d.y += d.vy * dt;
      if (d.y < -5) { d.y = H + 5; d.x = Math.random() * W; }
      if (d.x < -5) d.x = W + 5; else if (d.x > W + 5) d.x = -5;
    }
    draw(t);
    raf = requestAnimationFrame(step);
  }

  function play() { if (running || reduced) return; running = true; last = performance.now(); raf = requestAnimationFrame(step); }
  function pause() { running = false; cancelAnimationFrame(raf); }

  function start(el, config) {
    canvas = el; cfg = config || {};
    if (!canvas || !canvas.getContext) return;
    ctx = canvas.getContext('2d');
    readColors();
    resize();
    window.addEventListener('resize', resize);
    document.addEventListener('themechange', function () { readColors(); if (reduced) draw(0); });
    document.addEventListener('visibilitychange', function () { document.hidden ? pause() : play(); });
    window.addEventListener('pointermove', function (e) { pointer.tx = e.clientX / W; pointer.ty = e.clientY / H; }, { passive: true });
    if (reduced) draw(0); else play();
  }

  return { start: start, play: play, pause: pause };
})();
