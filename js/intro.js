/* Intro: a quick attack. The setter receives a pass, the hitter is already in the air,
   a fast flat set, a spike, and the ball flies at the camera until it fills the screen and
   the home page appears behind it. Everything is an SVG drawn here and moved with a timeline.

   The characters are original, stylised figures (an orange-haired short hitter and a
   dark-haired setter) — a nod to the classic anime quick, not a copy of anyone's design.
   All timing constants live in T below (seconds). */
window.Intro = (function () {
  'use strict';
  var U = window.U;
  var NS = 'http://www.w3.org/2000/svg';
  var VW = 1600, VH = 900, FLOOR = 700, NET_X = 850;

  var T = {
    fadeIn: 0.25,    // scene fades in
    runStart: 0.35,  // hitter starts the approach
    runEnd: 1.30,    // last step
    plantEnd: 1.47,  // feet planted, crouched → takeoff
    peak: 1.86,      // top of the jump
    passStart: 0.15, // pass enters from the left
    setStart: 1.50,  // setter touches the ball
    contact: 1.85,   // hand meets ball
    hitStop: 0.12,   // freeze frame on impact (anime "hit stop")
    cut: 2.02,       // cut to the ball-cam shot
    grow: 1.15,      // seconds for the ball to fill the screen
    fadeAt: 0.86,    // seconds after the cut when the overlay starts fading
    fadeDur: 0.75,
    end: 3.75
  };
  var COL = {
    skin: '#f3c9a1', skinShade: '#d8a878', hairHitter: '#ff7a1a', hairSetter: '#1c2340',
    jersey: '#171c30', stripe: '#ff7a1a', shorts: '#10152a', shoe: '#e9ecf5', pad: '#dfe3ee', ink: '#141827',
    ballBase: '#f7f2e8', ballBlue: '#2f5fd0', ballYellow: '#ffd23f', seam: '#3a3a44'
  };

  var dom = {};
  var S = { built: false, playing: false, seeking: false, raf: 0, start: 0, done: null, fading: false, lastBeat: -1 };

  /* ---------- tiny math / tween helpers ---------- */
  var rad = Math.PI / 180;
  function D(deg) { return [Math.sin(deg * rad), Math.cos(deg * rad)]; } // "from straight down, positive = forward"
  function add(a, b) { return [a[0] + b[0], a[1] + b[1]]; }
  function mul(a, k) { return [a[0] * k, a[1] * k]; }
  function mix2(a, b, u) { return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u]; }
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  var EASE = {
    lin: function (u) { return u; },
    inQ: function (u) { return u * u; },
    outQ: function (u) { return 1 - (1 - u) * (1 - u); },
    inOutQ: function (u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; },
    inC: function (u) { return u * u * u; },
    outC: function (u) { return 1 - Math.pow(1 - u, 3); }
  };
  function seg(t, a, b, e) { return EASE[e || 'lin'](clamp01((t - a) / (b - a))); }
  /** keys: [[time, value, easeIntoThisKey], ...] */
  function track(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) {
      if (t <= keys[i][0]) {
        var u = seg(t, keys[i - 1][0], keys[i][0], keys[i][2]);
        return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * u;
      }
    }
    return keys[keys.length - 1][1];
  }
  /** keys: [{ t, p: {pose}, e }] -> interpolated pose */
  function poseTrack(t, keys) {
    if (t <= keys[0].t) return keys[0].p;
    for (var i = 1; i < keys.length; i++) {
      if (t <= keys[i].t) return blend(keys[i - 1].p, keys[i].p, seg(t, keys[i - 1].t, keys[i].t, keys[i].e));
    }
    return keys[keys.length - 1].p;
  }
  function blend(a, b, u) {
    var o = {};
    for (var k in a) o[k] = (typeof a[k] === 'number' && typeof b[k] === 'number') ? a[k] + (b[k] - a[k]) * u : (b[k] === undefined ? a[k] : (u < 0.5 ? a[k] : b[k]));
    for (var k2 in b) if (!(k2 in o)) o[k2] = b[k2];
    return o;
  }
  function bez(p0, p1, p2, u) { var a = mix2(p0, p1, u), b = mix2(p1, p2, u); return mix2(a, b, u); }

  /* ---------- svg helpers ---------- */
  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function line(parent, color, w, extra) { return el('line', Object.assign({ stroke: color, 'stroke-width': w, 'stroke-linecap': 'round' }, extra || {}), parent); }
  function setLine(l, a, b) { l.setAttribute('x1', a[0]); l.setAttribute('y1', a[1]); l.setAttribute('x2', b[0]); l.setAttribute('y2', b[1]); }
  function setCircle(c, p) { c.setAttribute('cx', p[0]); c.setAttribute('cy', p[1]); }
  function pts(list) { return list.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }

  /* ---------- figures ---------- */
  function makeFigure(parent, cfg) {
    var g = el('g', {}, parent);
    var P = {};
    // back limbs
    P.armBu = line(g, cfg.skinShade, 12); P.armBf = line(g, cfg.skinShade, 11);
    P.legBt = line(g, cfg.skinShade, 16); P.legBs = line(g, cfg.skinShade, 14);
    P.shortsB = line(g, cfg.shorts, 24); P.padB = el('circle', { r: 8, fill: cfg.pad, opacity: .85 }, g); P.shoeB = line(g, '#c9cedb', 12);
    // torso
    P.torso = el('path', { fill: cfg.jersey, stroke: cfg.jersey, 'stroke-width': 16, 'stroke-linejoin': 'round' }, g);
    P.stripe = line(g, cfg.stripe, 5);
    P.num = el('text', { fill: '#ffffff', 'font-family': '"Space Grotesk", system-ui, sans-serif', 'font-weight': '700', 'font-size': 24, 'text-anchor': 'middle', 'dominant-baseline': 'middle', opacity: .92 }, g);
    P.num.textContent = cfg.number;
    // front leg
    P.legFt = line(g, cfg.skin, 17); P.legFs = line(g, cfg.skin, 15);
    P.shortsF = line(g, cfg.shorts, 26); P.padF = el('circle', { r: 9, fill: cfg.pad }, g); P.shoeF = line(g, cfg.shoe, 13);
    // head
    P.head = el('g', {}, g);
    el('circle', { r: cfg.head, fill: cfg.skin }, P.head);
    el('path', { d: cfg.hairPath, fill: cfg.hair }, P.head);
    el('ellipse', { cx: cfg.head * 0.5, cy: -1, rx: 2.6, ry: 4.2, fill: COL.ink }, P.head);
    el('path', { d: 'M' + (cfg.head * 0.28) + ',-12 L' + (cfg.head * 0.74) + ',-8', stroke: COL.ink, 'stroke-width': 3, 'stroke-linecap': 'round' }, P.head);
    // front arm (the hitting arm)
    P.armFu = line(g, cfg.skin, 13); P.armFf = line(g, cfg.skin, 12);
    P.hand = el('circle', { r: 7.5, fill: cfg.skin }, g);
    return { cfg: cfg, g: g, P: P };
  }

  /** Forward kinematics in the figure's local frame (hip at 0,0; facing +x). */
  function fk(c, p) {
    var lean = p.lean || 0, tilt = p.tilt || 0;
    var sh = mul(D(180 - lean), c.torso);
    var nk = add(sh, mul(D(180 - lean - tilt), c.neck));
    var hc = add(nk, mul(D(180 - lean - tilt), c.head));
    var shB = add(sh, [-5, 3]);
    var eB = add(shB, mul(D(p.ua2), c.upper)), hB = add(eB, mul(D(p.fa2), c.fore));
    var eF = add(sh, mul(D(p.ua1), c.upper)), hF = add(eF, mul(D(p.fa1), c.fore));
    var hipB = [-4, 1], hipF = [3, 0];
    var kB = add(hipB, mul(D(p.th2), c.thigh)), aB = add(kB, mul(D(p.sh2), c.shin));
    var kF = add(hipF, mul(D(p.th1), c.thigh)), aF = add(kF, mul(D(p.sh1), c.shin));
    return { sh: sh, hc: hc, shB: shB, eB: eB, hB: hB, eF: eF, hF: hF, hipB: hipB, hipF: hipF, kB: kB, aB: aB, kF: kF, aF: aF, lean: lean, tilt: tilt };
  }
  function toWorld(pose, fx, pt) { return [pose.x + fx * pt[0], pose.y + pt[1]]; }

  function poseFigure(f, p) {
    var c = f.cfg, P = f.P, fx = c.facing;
    var k = fk(c, p);
    f.g.setAttribute('transform', 'translate(' + p.x.toFixed(1) + ',' + p.y.toFixed(1) + ') scale(' + fx + ',1)');
    setLine(P.armBu, k.shB, k.eB); setLine(P.armBf, k.eB, k.hB);
    setLine(P.legBt, k.hipB, k.kB); setLine(P.legBs, k.kB, k.aB);
    setLine(P.shortsB, k.hipB, mix2(k.hipB, k.kB, 0.55)); setCircle(P.padB, k.kB);
    setLine(P.shoeB, add(k.aB, [0, 3]), add(add(k.aB, [0, 3]), mul(D(p.sh2 + 90), 20)));
    var perp = [Math.cos(k.lean * rad), Math.sin(k.lean * rad)];
    var sw = c.shoulderW, hw = c.hipW;
    var t1 = add(k.sh, mul(perp, sw)), t2 = add(k.sh, mul(perp, -sw)), t3 = mul(perp, -hw), t4 = mul(perp, hw);
    P.torso.setAttribute('d', 'M' + pts([t1, t2, t3, t4]).replace(/ /g, ' L') + ' Z');
    setLine(P.stripe, add(k.sh, mul(perp, sw - 1)), mul(perp, hw - 1));
    var m = mix2(k.sh, [0, 0], 0.45);
    P.num.setAttribute('transform', 'translate(' + m[0].toFixed(1) + ',' + m[1].toFixed(1) + ') rotate(' + k.lean.toFixed(1) + ') scale(' + fx + ',1)');
    setLine(P.legFt, k.hipF, k.kF); setLine(P.legFs, k.kF, k.aF);
    setLine(P.shortsF, k.hipF, mix2(k.hipF, k.kF, 0.55)); setCircle(P.padF, k.kF);
    setLine(P.shoeF, add(k.aF, [0, 3]), add(add(k.aF, [0, 3]), mul(D(p.sh1 + 90), 21)));
    P.head.setAttribute('transform', 'translate(' + k.hc[0].toFixed(1) + ',' + k.hc[1].toFixed(1) + ') rotate(' + (k.lean + k.tilt).toFixed(1) + ')');
    setLine(P.armFu, k.sh, k.eF); setLine(P.armFf, k.eF, k.hF);
    setCircle(P.hand, k.hF);
    return k;
  }

  var HITTER = {
    facing: 1, number: '10', hair: COL.hairHitter, skin: COL.skin, skinShade: COL.skinShade, jersey: COL.jersey, stripe: COL.stripe, shorts: COL.shorts, shoe: COL.shoe, pad: COL.pad,
    torso: 86, neck: 9, head: 23, upper: 56, fore: 52, thigh: 66, shin: 64, shoulderW: 21, hipW: 15,
    // spiky hair, drawn for a right-facing head (mirrored automatically when facing left)
    hairPath: 'M17,-15 L30,-33 L15,-29 L19,-53 L4,-31 L-2,-57 L-9,-30 L-23,-52 L-19,-25 L-40,-36 L-26,-15 L-42,-8 L-27,-1 L-25,10 L-15,6 Q-2,-9 12,-6 L18,-10 Z'
  };
  var SETTER = {
    facing: 1, number: '9', hair: COL.hairSetter, skin: COL.skin, skinShade: COL.skinShade, jersey: COL.jersey, stripe: COL.stripe, shorts: COL.shorts, shoe: COL.shoe, pad: COL.pad,
    torso: 96, neck: 10, head: 24, upper: 60, fore: 56, thigh: 74, shin: 72, shoulderW: 22, hipW: 16,
    hairPath: 'M23,-6 L28,-24 Q22,-42 0,-44 Q-28,-44 -32,-16 Q-34,2 -24,14 L-19,-2 Q-10,-13 4,-11 L13,-4 Z'
  };

  /* ---------- choreography ---------- */
  function runPose(ts) {
    var x = track(ts, [[T.runStart, 100, 'lin'], [T.runEnd, 662, 'inQ']]);
    var ph = (x - 100) / 92 * Math.PI * 2;
    var sw = Math.sin(ph);
    var th1 = 36 * sw, th2 = -36 * sw;
    var sh1 = th1 - 22 - 36 * (1 - sw) / 2, sh2 = th2 - 22 - 36 * (1 + sw) / 2;
    var speed = seg(ts, T.runStart, T.runStart + 0.25, 'outQ');
    return {
      x: x, y: 580 + 6 * Math.sin(ph * 2) - 4 * speed, lean: 6 + 12 * speed, tilt: -2,
      ua1: 25 - 50 * sw * speed, fa1: 95 - 50 * sw * speed, ua2: 25 + 50 * sw * speed, fa2: 95 + 50 * sw * speed,
      th1: th1 * (0.3 + 0.7 * speed), sh1: sh1 * (0.3 + 0.7 * speed) - 4, th2: th2 * (0.3 + 0.7 * speed), sh2: sh2 * (0.3 + 0.7 * speed) - 4
    };
  }
  var hitterKeys = null;
  function hitterPose(ts) {
    if (ts < T.runEnd) return runPose(ts);
    if (!hitterKeys) {
      hitterKeys = [
        { t: T.runEnd, p: runPose(T.runEnd) },
        { t: T.plantEnd, p: { lean: 30, tilt: -8, ua1: -60, fa1: -48, ua2: -55, fa2: -42, th1: 44, sh1: -30, th2: 36, sh2: -36 }, e: 'inOutQ' },
        { t: 1.60, p: { lean: 8, tilt: -12, ua1: 150, fa1: 168, ua2: 140, fa2: 158, th1: -14, sh1: -10, th2: -18, sh2: -22 }, e: 'outQ' },
        { t: 1.74, p: { lean: -12, tilt: -18, ua1: 204, fa1: 292, ua2: 168, fa2: 152, th1: -26, sh1: -72, th2: -20, sh2: -78 }, e: 'inOutQ' },
        { t: T.contact, p: { lean: 12, tilt: -8, ua1: 127, fa1: 127, ua2: 52, fa2: 36, th1: 24, sh1: -18, th2: 12, sh2: -32 }, e: 'inC' },
        { t: 2.08, p: { lean: 24, tilt: 6, ua1: 58, fa1: 36, ua2: 40, fa2: 28, th1: 32, sh1: -10, th2: 20, sh2: -22 }, e: 'outQ' }
      ];
    }
    var p = poseTrack(ts, hitterKeys);
    p.x = track(ts, [[T.runEnd, 662, 'lin'], [T.plantEnd, 674, 'outQ'], [T.peak, 702, 'lin'], [2.3, 724, 'lin']]);
    if (ts < T.plantEnd) p.y = track(ts, [[T.runEnd, 576, 'lin'], [T.plantEnd, 592, 'outQ']]);
    else {
      var u = (ts - T.plantEnd) / (T.peak - T.plantEnd);
      p.y = 592 - 180 * (1 - (1 - u) * (1 - u)); // parabola: fast off the floor, slows at the top
    }
    return p;
  }
  var setterKeys = [
    { t: 0, p: { lean: 4, tilt: -6, ua1: 150, fa1: 206, ua2: 148, fa2: 208, th1: 8, sh1: 4, th2: -8, sh2: -6, y: 551 } },
    { t: 1.20, p: { lean: 4, tilt: -6, ua1: 150, fa1: 206, ua2: 148, fa2: 208, th1: 8, sh1: 4, th2: -8, sh2: -6, y: 551 }, e: 'lin' },
    { t: 1.42, p: { lean: 7, tilt: -16, ua1: 147, fa1: 210, ua2: 145, fa2: 212, th1: 24, sh1: -10, th2: 8, sh2: -14, y: 562 }, e: 'inOutQ' },
    { t: T.setStart, p: { lean: 2, tilt: -14, ua1: 150, fa1: 206, ua2: 148, fa2: 208, th1: 4, sh1: 2, th2: -4, sh2: -2, y: 524 }, e: 'outQ' },
    { t: 1.62, p: { lean: 0, tilt: -16, ua1: 170, fa1: 180, ua2: 168, fa2: 178, th1: 2, sh1: 0, th2: -2, sh2: 0, y: 514 }, e: 'outQ' },
    { t: 1.80, p: { lean: 4, tilt: -12, ua1: 160, fa1: 168, ua2: 158, fa2: 165, th1: 16, sh1: -6, th2: -6, sh2: -8, y: 556 }, e: 'inQ' },
    { t: 2.10, p: { lean: 4, tilt: -10, ua1: 118, fa1: 132, ua2: 116, fa2: 130, th1: 8, sh1: 4, th2: -8, sh2: -6, y: 551 }, e: 'outQ' }
  ];
  function setterPose(ts) {
    var p = poseTrack(ts, setterKeys);
    p.x = track(ts, [[1.15, 480, 'lin'], [1.5, 494, 'inOutQ']]);
    if (ts < 1.2) p.y += 3 * Math.sin(ts * 4);
    return p;
  }
  // World-space ball anchors are derived from the poses so hands and ball always line up.
  function setterHands(ts) {
    var p = setterPose(ts), k = fk(SETTER, p);
    var mid = mix2(k.hF, k.hB, 0.5);
    return toWorld(p, SETTER.facing, add(mid, [4, -24]));
  }
  function hitterHand(ts) {
    var p = hitterPose(ts), k = fk(HITTER, p);
    return toWorld(p, HITTER.facing, add(k.hF, [9, -13]));
  }

  function ballState(ts) {
    var C = T.contact;
    if (ts < T.passStart) return { x: -80, y: -80, rot: 0, vis: false };
    if (ts < T.setStart) {
      var p2 = setterHands(T.setStart);
      var p0 = [30, -70], p1 = [p2[0] * 0.55 + 20, -90];
      var u = seg(ts, T.passStart, T.setStart, 'lin');
      var pt = bez(p0, p1, p2, u);
      return { x: pt[0], y: pt[1], rot: 260 * ts, vis: true };
    }
    if (ts <= C) {
      var a = setterHands(T.setStart), b = hitterHand(C);
      var ctrl = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 46];
      var v = seg(ts, T.setStart, C, 'outQ');
      var q = bez(a, ctrl, b, v);
      return { x: q[0], y: q[1], rot: 260 * ts, vis: true };
    }
    var e = hitterHand(C);
    return { x: e[0] + (ts - C) * 30, y: e[1] - (ts - C) * 10, rot: 260 * ts, vis: true };
  }

  /* ---------- scene construction ---------- */
  function makeBall(parent, id) {
    var g = el('g', {}, parent);
    var clipId = 'ballclip-' + id;
    var defs = el('defs', {}, g);
    var cp = el('clipPath', { id: clipId }, defs);
    el('circle', { r: 18, cx: 0, cy: 0 }, cp);
    el('circle', { r: 18, fill: COL.ballBase }, g);
    var panels = el('g', { 'clip-path': 'url(#' + clipId + ')', fill: 'none', 'stroke-linecap': 'round' }, g);
    var band = 'M-22,-9 Q0,5 22,-9';
    el('path', { d: band, stroke: COL.ballBlue, 'stroke-width': 9 }, panels);
    el('path', { d: band, stroke: COL.ballYellow, 'stroke-width': 9, transform: 'rotate(120)' }, panels);
    el('path', { d: band, stroke: COL.ballBlue, 'stroke-width': 9, transform: 'rotate(240)' }, panels);
    el('path', { d: 'M-22,-9 Q0,5 22,-9 M-22,-9 Q0,5 22,-9', stroke: COL.seam, 'stroke-width': 1.2, opacity: .5, transform: 'rotate(60)' }, panels);
    el('circle', { r: 18, fill: 'none', stroke: '#c9c2b4', 'stroke-width': 1.2 }, g);
    return g;
  }

  function build() {
    if (S.built) return;
    S.built = true;
    var root = dom.root = document.getElementById('intro');
    root.innerHTML = '';
    var svg = dom.svg = el('svg', { class: 'scene', viewBox: '0 0 ' + VW + ' ' + VH, preserveAspectRatio: 'xMidYMid slice', 'aria-hidden': 'true' }, root);
    var defs = el('defs', {}, svg);
    var sky = el('linearGradient', { id: 'in-sky', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: 0, 'stop-color': '#0e1019' }, sky); el('stop', { offset: 0.72, 'stop-color': '#151a33' }, sky); el('stop', { offset: 1, 'stop-color': '#1c1b3d' }, sky);
    var glow = el('radialGradient', { id: 'in-glow', cx: 0.5, cy: 1, r: 0.8 }, defs);
    el('stop', { offset: 0, 'stop-color': '#8ab4ff', 'stop-opacity': 0.26 }, glow); el('stop', { offset: 1, 'stop-color': '#8ab4ff', 'stop-opacity': 0 }, glow);
    var mesh = el('pattern', { id: 'in-mesh', width: 9, height: 9, patternUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M9,0H0V9', fill: 'none', stroke: '#ffffff', 'stroke-opacity': 0.45, 'stroke-width': 1 }, mesh);
    var blur = el('filter', { id: 'in-blur', x: '-50%', y: '-50%', width: '200%', height: '200%' }, defs);
    el('feGaussianBlur', { stdDeviation: 6 }, blur);
    var vig = el('radialGradient', { id: 'in-vig', cx: 0.5, cy: 0.5, r: 0.75 }, defs);
    el('stop', { offset: 0.55, 'stop-color': '#000', 'stop-opacity': 0 }, vig); el('stop', { offset: 1, 'stop-color': '#000', 'stop-opacity': 0.7 }, vig);
    var speed = el('radialGradient', { id: 'in-speed', cx: 0.5, cy: 0.5, r: 0.5 }, defs);
    el('stop', { offset: 0.15, 'stop-color': '#fff', 'stop-opacity': 0 }, speed); el('stop', { offset: 1, 'stop-color': '#fff', 'stop-opacity': 0.9 }, speed);

    /* --- shot 1: side view --- */
    var s1 = dom.shot1 = el('g', {}, svg);
    el('rect', { width: VW, height: VH, fill: 'url(#in-sky)' }, s1);
    el('rect', { width: VW, height: VH, fill: 'url(#in-glow)' }, s1);
    // floor grid (perspective) + court lines
    var floor = el('g', { stroke: '#8ab4ff', 'stroke-opacity': 0.16, fill: 'none' }, s1);
    var horizon = 640;
    for (var i = -14; i <= 14; i++) {
      var x = NET_X + i * 240;
      el('line', { x1: NET_X + (x - NET_X) * 0.06, y1: horizon, x2: x, y2: VH + 20 }, floor);
    }
    for (var j = 0; j <= 9; j++) { var u = j / 9; var y = horizon + (VH - horizon) * u * u; el('line', { x1: 0, y1: y, x2: VW, y2: y, 'stroke-opacity': 0.08 + 0.12 * u }, floor); }
    el('line', { x1: 0, y1: FLOOR, x2: VW, y2: FLOOR, stroke: '#b9c9ff', 'stroke-opacity': 0.55, 'stroke-width': 2 }, s1);
    el('line', { x1: 0, y1: 668, x2: VW, y2: 668, stroke: '#b9c9ff', 'stroke-opacity': 0.25, 'stroke-width': 1.5 }, s1);
    [NET_X, NET_X - 525, NET_X + 525].forEach(function (cx, idx) {
      el('line', { x1: cx, y1: FLOOR, x2: cx + 45, y2: 668, stroke: '#b9c9ff', 'stroke-opacity': idx ? 0.3 : 0.5, 'stroke-width': idx ? 1.5 : 2 }, s1);
    });
    // net (three-quarter view: near post at NET_X, far post a little behind)
    var net = el('g', {}, s1);
    el('polygon', { points: NET_X + ',300 ' + (NET_X + 45) + ',312 ' + (NET_X + 45) + ',401 ' + NET_X + ',400', fill: 'url(#in-mesh)', stroke: '#ffffff', 'stroke-opacity': 0.35 }, net);
    el('line', { x1: NET_X, y1: 300, x2: NET_X + 45, y2: 312, stroke: '#ffffff', 'stroke-width': 5, 'stroke-linecap': 'round' }, net);
    el('line', { x1: NET_X + 45, y1: 312, x2: NET_X + 45, y2: 668, stroke: '#3a4260', 'stroke-width': 7, 'stroke-linecap': 'round' }, net);
    el('line', { x1: NET_X, y1: 300, x2: NET_X, y2: FLOOR, stroke: '#4a5478', 'stroke-width': 9, 'stroke-linecap': 'round' }, net);
    el('line', { x1: NET_X, y1: 300, x2: NET_X, y2: 218, stroke: '#ffffff', 'stroke-width': 4, 'stroke-linecap': 'round' }, net);
    for (var b = 0; b < 4; b++) el('line', { x1: NET_X, y1: 300 - b * 20 - 10, x2: NET_X, y2: 300 - b * 20 - 20, stroke: '#ff4d4d', 'stroke-width': 4 }, net);
    // speed lines behind the runner
    dom.speedLines = el('g', { stroke: '#ffffff', 'stroke-width': 3, 'stroke-linecap': 'round', opacity: 0 }, s1);
    for (var sl = 0; sl < 5; sl++) el('line', {}, dom.speedLines);
    // dust at the plant
    dom.dust = el('g', { fill: '#b9c9ff', opacity: 0 }, s1);
    for (var dd = 0; dd < 4; dd++) el('circle', { r: 6 }, dom.dust);
    // figures
    dom.setter = makeFigure(s1, SETTER);
    dom.ball1 = makeBall(s1, 'a');
    dom.hitter = makeFigure(s1, HITTER);
    // impact
    dom.ring = el('circle', { fill: 'none', stroke: '#ffffff', 'stroke-width': 4, opacity: 0 }, s1);
    var starPts = [];
    for (var k = 0; k < 16; k++) { var r = k % 2 ? 0.42 : 1, a = k * Math.PI / 8; starPts.push([Math.cos(a) * r, Math.sin(a) * r]); }
    dom.starGlow = el('polygon', { points: pts(starPts), fill: '#b9c9ff', filter: 'url(#in-blur)', opacity: 0 }, s1);
    dom.star = el('polygon', { points: pts(starPts), fill: '#ffffff', opacity: 0 }, s1);
    el('rect', { width: VW, height: VH, fill: 'url(#in-vig)', 'pointer-events': 'none' }, s1);

    /* --- shot 2: ball cam --- */
    var s2 = dom.shot2 = el('g', { opacity: 0 }, svg);
    el('rect', { width: VW, height: VH, fill: '#0e1019' }, s2);
    dom.rays = el('g', { stroke: '#ffffff', 'stroke-linecap': 'round' }, s2);
    dom.rayData = [];
    for (var rr = 0; rr < 56; rr++) {
      var ang = Math.random() * Math.PI * 2;
      dom.rayData.push({ a: ang, len: 120 + Math.random() * 380, w: 1 + Math.random() * 3, off: Math.random(), op: 0.15 + Math.random() * 0.5 });
      el('line', { 'stroke-width': 2 }, dom.rays);
    }
    dom.ghost2 = makeBall(s2, 'g2'); dom.ghost2.setAttribute('opacity', 0.16);
    dom.ghost1 = makeBall(s2, 'g1'); dom.ghost1.setAttribute('opacity', 0.32);
    dom.ball2 = makeBall(s2, 'b');
    el('rect', { width: VW, height: VH, fill: 'url(#in-vig)' }, s2);

    /* --- overlay UI --- */
    var ui = dom.ui = document.createElement('div');
    ui.className = 'intro-ui';
    var site = window.SITE || {};
    ui.innerHTML = '<div class="intro-label">' + U.esc(site.label || site.name || '') + '<span class="dot">.</span></div>' +
      '<div class="intro-beat" id="intro-beat"><b>01</b><span></span></div>';
    root.appendChild(ui);
    dom.flash = document.createElement('div'); dom.flash.className = 'intro-flash'; root.appendChild(dom.flash);
    dom.beat = ui.querySelector('#intro-beat');
    var ia = site.introAnimation || {};
    if (ia.skippable !== false) {
      var skip = document.createElement('button');
      skip.className = 'intro-skip'; skip.type = 'button';
      skip.innerHTML = 'Skip intro <span class="arrow">→</span>';
      skip.addEventListener('click', function () { finish(true); });
      ui.appendChild(skip);
    }
    document.addEventListener('keydown', function (e) { if (S.playing && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') && ia.skippable !== false) finish(true); });
  }

  /* ---------- rendering a frame ---------- */
  function renderShot1(ts) {
    var hp = hitterPose(ts), sp = setterPose(ts);
    poseFigure(dom.hitter, hp);
    poseFigure(dom.setter, sp);
    var b = ballState(ts);
    dom.ball1.setAttribute('transform', 'translate(' + b.x.toFixed(1) + ',' + b.y.toFixed(1) + ') rotate(' + (b.rot % 360).toFixed(1) + ')');
    dom.ball1.setAttribute('opacity', b.vis ? 1 : 0);
    // speed lines during the approach
    var run = ts > T.runStart + 0.15 && ts < T.runEnd + 0.05 ? seg(ts, T.runStart + 0.15, T.runStart + 0.4, 'outQ') * (1 - seg(ts, T.runEnd - 0.1, T.runEnd + 0.05, 'lin')) : 0;
    dom.speedLines.setAttribute('opacity', (0.35 * run).toFixed(2));
    var lines = dom.speedLines.children;
    for (var i = 0; i < lines.length; i++) {
      var y = hp.y - 60 + i * 28 + Math.sin(ts * 40 + i) * 3, len = 90 + i * 25 + Math.sin(ts * 31 + i * 2) * 30;
      setLine(lines[i], [hp.x - 60 - i * 8, y], [hp.x - 60 - i * 8 - len, y]);
    }
    // dust on the plant
    var du = seg(ts, T.runEnd + 0.02, T.runEnd + 0.5, 'outC');
    dom.dust.setAttribute('opacity', (du > 0 && du < 1 ? 0.5 * (1 - du) : 0).toFixed(2));
    var dots = dom.dust.children;
    for (var d = 0; d < dots.length; d++) {
      dots[d].setAttribute('cx', hp.x - 20 - d * 22 - du * 60 * (d + 1) / 2);
      dots[d].setAttribute('cy', FLOOR - 4 - du * (20 + d * 10));
      dots[d].setAttribute('r', 4 + du * 10);
    }
    // impact star + ring at contact
    var C = T.contact;
    var imp = ts >= C ? 1 : 0;
    var e = hitterHand(C);
    var s = 0.4 + 1.1 * seg(ts, C, C + 0.1, 'outC');
    var starOp = imp ? 1 - seg(ts, C + 0.02, C + 0.28, 'inQ') : 0;
    var tf = 'translate(' + e[0].toFixed(1) + ',' + e[1].toFixed(1) + ') rotate(' + (ts * 90).toFixed(1) + ') scale(' + (s * 60).toFixed(1) + ')';
    dom.star.setAttribute('transform', tf); dom.star.setAttribute('opacity', starOp.toFixed(2));
    dom.starGlow.setAttribute('transform', tf); dom.starGlow.setAttribute('opacity', (starOp * 0.9).toFixed(2));
    var ru = seg(ts, C, C + 0.32, 'outC');
    setCircle(dom.ring, e); dom.ring.setAttribute('r', (8 + 150 * ru).toFixed(1)); dom.ring.setAttribute('opacity', imp ? (0.8 * (1 - ru)).toFixed(2) : 0);
    // shake after contact
    var shake = imp ? (1 - seg(ts, C, C + 0.3, 'lin')) * 9 : 0;
    var sx = Math.sin(ts * 120) * shake, sy = Math.cos(ts * 97) * shake;
    dom.shot1.setAttribute('transform', 'translate(' + sx.toFixed(1) + ',' + sy.toFixed(1) + ')');
  }
  function renderShot2(t2) {
    var u = clamp01(t2 / T.grow);
    var r = 26 + 1320 * u * u * u;               // accelerating toward the camera
    var cx = VW / 2 + 60 * Math.sin(u * 2.2), cy = VH / 2 - 40 + 80 * u;
    var rot = 640 * u;
    var scale = r / 18;
    dom.ball2.setAttribute('transform', 'translate(' + cx.toFixed(1) + ',' + cy.toFixed(1) + ') rotate(' + rot.toFixed(1) + ') scale(' + scale.toFixed(3) + ')');
    dom.ghost1.setAttribute('transform', 'translate(' + (cx - 10).toFixed(1) + ',' + (cy + 6).toFixed(1) + ') rotate(' + (rot - 25).toFixed(1) + ') scale(' + (scale * 0.86).toFixed(3) + ')');
    dom.ghost2.setAttribute('transform', 'translate(' + (cx - 18).toFixed(1) + ',' + (cy + 12).toFixed(1) + ') rotate(' + (rot - 50).toFixed(1) + ') scale(' + (scale * 0.74).toFixed(3) + ')');
    var lines = dom.rays.children;
    for (var i = 0; i < lines.length; i++) {
      var rd = dom.rayData[i];
      var inner = 80 + r * 0.9 + ((rd.off + t2 * 2.5) % 1) * 60;
      var outer = inner + rd.len * (0.6 + 0.4 * Math.sin(t2 * 30 + i));
      setLine(lines[i], [VW / 2 + Math.cos(rd.a) * inner, VH / 2 + Math.sin(rd.a) * inner], [VW / 2 + Math.cos(rd.a) * outer, VH / 2 + Math.sin(rd.a) * outer]);
      lines[i].setAttribute('stroke-width', rd.w.toFixed(1));
      lines[i].setAttribute('stroke-opacity', (rd.op * (0.5 + 0.5 * Math.sin(t2 * 40 + i * 1.7)) * (1 - u * 0.5)).toFixed(2));
    }
  }

  var BEATS_DEFAULT = ['Approach', 'Quick set', 'Spike'];
  function setBeat(idx) {
    if (idx === S.lastBeat) return;
    S.lastBeat = idx;
    var beats = (window.SITE && window.SITE.introAnimation && window.SITE.introAnimation.beats) || BEATS_DEFAULT;
    if (idx < 0 || !beats[idx]) { dom.beat.classList.remove('show'); return; }
    dom.beat.querySelector('b').textContent = U.pad2(idx + 1);
    dom.beat.querySelector('span').textContent = beats[idx];
    dom.beat.classList.add('show');
  }

  function renderAt(t) {
    var C = T.contact;
    var ts = t < C ? t : (t < C + T.hitStop ? C : t - T.hitStop); // scene time with the freeze frame
    var cutting = t >= T.cut;
    dom.shot1.style.display = cutting ? 'none' : '';
    dom.shot2.setAttribute('opacity', cutting ? 1 : 0);
    if (!cutting) renderShot1(ts); else renderShot2(t - T.cut);
    dom.svg.style.opacity = seg(t, 0, T.fadeIn, 'outQ').toFixed(2);
    // white flash on contact, and a short one on the cut
    var f1 = t >= C ? (t < C + 0.05 ? seg(t, C, C + 0.05, 'outQ') * 0.85 : 0.85 * (1 - seg(t, C + 0.05, C + 0.3, 'outQ'))) : 0;
    var f2 = t >= T.cut - 0.04 ? (t < T.cut ? seg(t, T.cut - 0.04, T.cut, 'lin') : 1 - seg(t, T.cut, T.cut + 0.12, 'outQ')) : 0;
    dom.flash.style.opacity = Math.max(f1, f2).toFixed(2);
    setBeat(ts < T.runStart ? -1 : ts < T.setStart - 0.05 ? 0 : ts < C ? 1 : 2);
  }

  /* ---------- playback ---------- */
  function tick(now) {
    if (!S.playing) return;
    var t = (now - S.start) / 1000;
    renderAt(t);
    if (t >= T.cut + T.fadeAt && !S.fading) startFade();
    if (t >= T.end) { finish(false); return; }
    S.raf = requestAnimationFrame(tick);
  }
  function startFade() {
    S.fading = true;
    dom.root.classList.add('fading');
    var main = document.getElementById('main');
    if (main) {
      main.classList.remove('reveal'); void main.offsetWidth; main.classList.add('reveal');
      main.addEventListener('animationend', function h() { main.classList.remove('reveal'); main.removeEventListener('animationend', h); });
    }
  }
  function finish(skipped) {
    if (!S.playing && !S.seeking) return;
    S.playing = false; S.seeking = false;
    cancelAnimationFrame(S.raf);
    U.session.set('introSeen', '1');
    var root = dom.root;
    if (skipped) {
      root.classList.add('fading');
      var main = document.getElementById('main');
      if (main) { main.classList.remove('reveal'); void main.offsetWidth; main.classList.add('reveal'); }
    }
    document.body.classList.remove('intro-active');
    setTimeout(function () { root.hidden = true; root.classList.remove('fading'); if (S.done) S.done(); }, skipped ? 420 : 50);
  }
  function play(opts) {
    opts = opts || {};
    build();
    if (S.playing) return;
    hitterKeys = null;
    S.playing = true; S.seeking = false; S.fading = false; S.lastBeat = -1; S.done = opts.onDone || null;
    dom.root.hidden = false;
    dom.root.classList.remove('fading');
    dom.svg.style.opacity = 0;
    document.body.classList.add('intro-active');
    window.scrollTo(0, 0);
    S.start = performance.now();
    renderAt(0);
    S.raf = requestAnimationFrame(tick);
  }
  /** Debug/preview: show the frame at time t (seconds) and pause. */
  function seek(t) {
    build();
    cancelAnimationFrame(S.raf);
    S.playing = false; S.seeking = true;
    hitterKeys = null;
    dom.root.hidden = false; dom.root.classList.remove('fading'); dom.svg.style.opacity = 1;
    document.body.classList.add('intro-active');
    renderAt(t);
    dom.svg.style.opacity = t < T.fadeIn ? seg(t, 0, T.fadeIn, 'outQ') : 1;
  }

  return { play: play, finish: finish, seek: seek, T: T };
})();
