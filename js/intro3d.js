/* 3D intro (Three.js, vendored in js/vendor/three.min.js). Same quick-attack choreography as the 2D
   version in intro.js — setter receives a pass, the hitter is already in the air, a flat quick set,
   a spike — but rendered as a lit low-poly scene with a moving camera. After contact the camera cuts to
   the receiver's side of the net and the ball flies straight at it until it fills the screen and the
   home page appears. Falls back to intro.js automatically when WebGL is not available.
   Timing lives in T (seconds); colours in COL. */
window.Intro3D = (function () {
  'use strict';
  var U = window.U;
  var T = {
    fadeIn: 0.3, runStart: 0.35, runEnd: 1.30, plantEnd: 1.47, peak: 1.86,
    passStart: 0.15, setStart: 1.50, contact: 1.85, hitStop: 0.12, cut: 2.02,
    flight: 1.0,      // seconds for the ball to reach the camera after the cut
    fadeAt: 0.86, fadeDur: 0.75, end: 3.8
  };
  var COL = {
    skin: 0xf3c9a1, hairHitter: 0xff7a1a, hairSetter: 0x1c2340, jersey: 0x171c30, stripe: 0xff7a1a, shorts: 0x10152a,
    shoe: 0xe9ecf5, pad: 0xdfe3ee, ink: 0x141827, bg: 0x05070f, floor: '#0b1020', grid: 'rgba(255,122,26,0.16)', lines: 'rgba(255,178,107,0.85)'
  };
  var NET_TOP = 2.24, PEAK_HIP = 1.72;
  var rad = Math.PI / 180;
  var S = { built: false, playing: false, seeking: false, raf: 0, start: 0, done: null, fading: false, lastBeat: -1, contactPt: null, handsPt: null, w: 0, h: 0 };
  var dom = {}, G = {};

  function supported() {
    if (!window.THREE) return false;
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }

  /* ---------- tween helpers (same as intro.js) ---------- */
  function clamp01(v) { return v < 0 ? 0 : v > 1 ? 1 : v; }
  var EASE = {
    lin: function (u) { return u; }, inQ: function (u) { return u * u; }, outQ: function (u) { return 1 - (1 - u) * (1 - u); },
    inOutQ: function (u) { return u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2; },
    inC: function (u) { return u * u * u; }, outC: function (u) { return 1 - Math.pow(1 - u, 3); }
  };
  function seg(t, a, b, e) { return EASE[e || 'lin'](clamp01((t - a) / (b - a))); }
  function track(t, keys) {
    if (t <= keys[0][0]) return keys[0][1];
    for (var i = 1; i < keys.length; i++) if (t <= keys[i][0]) return keys[i - 1][1] + (keys[i][1] - keys[i - 1][1]) * seg(t, keys[i - 1][0], keys[i][0], keys[i][2]);
    return keys[keys.length - 1][1];
  }
  function blend(a, b, u) {
    var o = {};
    for (var k in a) o[k] = typeof a[k] === 'number' && typeof b[k] === 'number' ? a[k] + (b[k] - a[k]) * u : (u < 0.5 ? a[k] : b[k]);
    for (var k2 in b) if (!(k2 in o)) o[k2] = b[k2];
    return o;
  }
  function poseTrack(t, keys) {
    if (t <= keys[0].t) return keys[0].p;
    for (var i = 1; i < keys.length; i++) if (t <= keys[i].t) return blend(keys[i - 1].p, keys[i].p, seg(t, keys[i - 1].t, keys[i].t, keys[i].e));
    return keys[keys.length - 1].p;
  }
  function v3(x, y, z) { return new THREE.Vector3(x, y, z); }

  /* ---------- rig ---------- */
  var HITTER = { number: '10', hair: 'spiky', hairColor: COL.hairHitter, scale: 1.0, torso: 0.40, neck: 0.05, head: 0.13, upper: 0.27, fore: 0.25, thigh: 0.35, shin: 0.33 };
  var SETTER = { number: '9', hair: 'cap', hairColor: COL.hairSetter, scale: 1.1, torso: 0.42, neck: 0.05, head: 0.13, upper: 0.28, fore: 0.26, thigh: 0.36, shin: 0.34 };

  function mat(color, opts) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.78, metalness: 0 }, opts || {})); }
  function capsule(r, len, material) { var m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len), 4, 12), material); m.castShadow = true; return m; }
  function limb(parent, r, len, material, at) {
    var g = new THREE.Group(); g.position.copy(at); parent.add(g);
    var m = capsule(r, len - r * 1.2, material); m.position.y = -len / 2; g.add(m);
    return g;
  }
  function textTexture(text, size, color, font) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d'); x.clearRect(0, 0, 128, 128);
    x.fillStyle = color; x.font = font || ('700 ' + size + 'px "Space Grotesk", system-ui, sans-serif');
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(text, 64, 68);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function makeFigure(cfg) {
    var skin = mat(COL.skin), jersey = mat(COL.jersey), shorts = mat(COL.shorts), shoe = mat(COL.shoe), pad = mat(COL.pad, { roughness: 0.5 }), stripe = mat(COL.stripe), hair = mat(cfg.hairColor), ink = mat(COL.ink);
    var root = new THREE.Group(); root.scale.setScalar(cfg.scale);
    var torso = new THREE.Group(); root.add(torso);
    var body = capsule(0.15, cfg.torso - 0.2, jersey); body.position.y = cfg.torso * 0.52; body.scale.set(0.78, 1, 1.12); torso.add(body);
    [1, -1].forEach(function (s) {
      var b = new THREE.Mesh(new THREE.BoxGeometry(0.05, cfg.torso * 0.72, 0.02), stripe); b.position.set(0.03, cfg.torso * 0.5, s * 0.172); b.castShadow = true; torso.add(b);
    });
    var numMat = new THREE.MeshBasicMaterial({ map: textTexture(cfg.number, 86, '#ffffff'), transparent: true, depthWrite: false });
    var nf = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), numMat); nf.position.set(0.122, cfg.torso * 0.62, 0); nf.rotation.y = Math.PI / 2; torso.add(nf);
    var nb = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), numMat); nb.position.set(-0.122, cfg.torso * 0.62, 0); nb.rotation.y = -Math.PI / 2; torso.add(nb);
    var sh = capsule(0.16, 0.06, shorts); sh.position.y = -0.03; sh.scale.set(0.85, 1, 1.1); root.add(sh);
    // head
    var neck = new THREE.Group(); neck.position.y = cfg.torso + cfg.neck; torso.add(neck);
    var head = new THREE.Mesh(new THREE.SphereGeometry(cfg.head, 24, 18), skin); head.position.y = cfg.head * 0.92; head.castShadow = true; neck.add(head);
    [1, -1].forEach(function (s) { var e = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8), ink); e.position.set(cfg.head * 0.9, 0.012, s * 0.05); head.add(e); });
    if (cfg.hair === 'spiky') {
      var dirs = [[0.25, 1, 0], [0.55, 0.85, 0.35], [0.55, 0.85, -0.35], [0, 0.95, 0.55], [0, 0.95, -0.55], [-0.4, 0.9, 0.2], [-0.4, 0.9, -0.2], [-0.8, 0.55, 0.45], [-0.8, 0.55, -0.45], [-0.95, 0.2, 0], [0.75, 0.55, 0], [-0.55, 0.75, 0.6], [-0.55, 0.75, -0.6]];
      dirs.forEach(function (d, i) {
        var dir = v3(d[0], d[1], d[2]).normalize();
        var g = new THREE.Group(); g.quaternion.setFromUnitVectors(v3(0, 1, 0), dir); head.add(g);
        var h = 0.15 + (i % 3) * 0.03;
        var cone = new THREE.Mesh(new THREE.ConeGeometry(0.045, h, 8), hair); cone.position.y = cfg.head * 0.75 + h / 2; cone.castShadow = true; g.add(cone);
      });
      var base = new THREE.Mesh(new THREE.SphereGeometry(cfg.head * 1.04, 20, 14, 0, Math.PI * 2, 0, Math.PI * 0.5), hair); base.position.y = 0.01; head.add(base);
    } else {
      var cap = new THREE.Mesh(new THREE.SphereGeometry(cfg.head * 1.09, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.56), hair);
      cap.position.set(-0.012, 0.012, 0); cap.rotation.z = 0.28; cap.castShadow = true; head.add(cap);
      [[0.5, 0.35, 0.25], [0.55, 0.3, -0.2], [0.45, 0.45, 0.02]].forEach(function (d) {
        var dir = v3(d[0], -d[1], d[2]).normalize();
        var g = new THREE.Group(); g.quaternion.setFromUnitVectors(v3(0, 1, 0), dir); g.position.set(0.06, 0.09, 0); head.add(g);
        var cone = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.12, 8), hair); cone.position.y = 0.05; g.add(cone);
      });
    }
    // arms (front = +Z, the side nearest the camera = the hitting arm)
    var shoulderY = cfg.torso - 0.02;
    var armF = limb(torso, 0.05, cfg.upper, skin, v3(0, shoulderY, 0.19));
    var foreF = limb(armF, 0.045, cfg.fore, skin, v3(0, -cfg.upper, 0));
    var handF = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), skin); handF.position.y = -cfg.fore; handF.castShadow = true; foreF.add(handF);
    var armB = limb(torso, 0.05, cfg.upper, skin, v3(0, shoulderY, -0.19));
    var foreB = limb(armB, 0.045, cfg.fore, skin, v3(0, -cfg.upper, 0));
    var handB = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), skin); handB.position.y = -cfg.fore; handB.castShadow = true; foreB.add(handB);
    // legs
    function leg(z) {
      var thigh = limb(root, 0.07, cfg.thigh, skin, v3(0, 0, z));
      var shin = limb(thigh, 0.06, cfg.shin, skin, v3(0, -cfg.thigh, 0));
      var knee = new THREE.Mesh(new THREE.SphereGeometry(0.076, 14, 12), pad); knee.position.set(0.01, 0, 0); knee.castShadow = true; shin.add(knee);
      var foot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.08, 0.11), shoe); foot.position.set(0.06, -cfg.shin - 0.02, 0); foot.castShadow = true; shin.add(foot);
      return { thigh: thigh, shin: shin };
    }
    var lf = leg(0.085), lb = leg(-0.085);
    return { cfg: cfg, root: root, torso: torso, neck: neck, armF: armF, foreF: foreF, handF: handF, armB: armB, foreB: foreB, handB: handB, legF: lf.thigh, shinF: lf.shin, legB: lb.thigh, shinB: lb.shin };
  }
  function groundY(cfg, p) {
    var a = cfg.thigh * Math.cos(p.th1 * rad) + cfg.shin * Math.cos(p.sh1 * rad);
    var b = cfg.thigh * Math.cos(p.th2 * rad) + cfg.shin * Math.cos(p.sh2 * rad);
    return cfg.scale * Math.max(a, b) + 0.05;
  }
  function applyPose(f, p) {
    f.root.position.set(p.x, p.y, p.z || 0);
    f.root.rotation.y = (p.yaw || 0) * rad;
    f.torso.rotation.set(0, (p.twist || 0) * rad, -p.lean * rad);
    f.neck.rotation.z = -p.tilt * rad;
    f.armF.rotation.set((p.abd1 || 0) * rad, 0, (p.ua1 + p.lean) * rad);
    f.foreF.rotation.z = (p.fa1 - p.ua1) * rad;
    f.armB.rotation.set(-(p.abd2 || 0) * rad, 0, (p.ua2 + p.lean) * rad);
    f.foreB.rotation.z = (p.fa2 - p.ua2) * rad;
    f.legF.rotation.z = p.th1 * rad; f.shinF.rotation.z = (p.sh1 - p.th1) * rad;
    f.legB.rotation.z = p.th2 * rad; f.shinB.rotation.z = (p.sh2 - p.th2) * rad;
  }

  /* ---------- choreography (angles shared with intro.js; positions in metres, net at x = 0) ---------- */
  function runPose(ts) {
    var x = track(ts, [[T.runStart, -4.3, 'lin'], [T.runEnd, -1.08, 'inQ']]);
    var ph = (x + 4.3) / 0.55 * Math.PI * 2;
    var sw = Math.sin(ph);
    var th1 = 36 * sw, th2 = -36 * sw;
    var sh1 = th1 - 22 - 36 * (1 - sw) / 2, sh2 = th2 - 22 - 36 * (1 + sw) / 2;
    var speed = seg(ts, T.runStart, T.runStart + 0.25, 'outQ');
    return {
      x: x, lean: 6 + 12 * speed, tilt: -2, twist: 0,
      ua1: 25 - 50 * sw * speed, fa1: 95 - 50 * sw * speed, ua2: 25 + 50 * sw * speed, fa2: 95 + 50 * sw * speed, abd1: 8, abd2: 8,
      th1: th1 * (0.3 + 0.7 * speed), sh1: sh1 * (0.3 + 0.7 * speed) - 4, th2: th2 * (0.3 + 0.7 * speed), sh2: sh2 * (0.3 + 0.7 * speed) - 4
    };
  }
  var hitterKeys = null;
  function hitterPose(ts) {
    var p;
    if (ts < T.runEnd) { p = runPose(ts); p.y = groundY(HITTER, p); return p; }
    if (!hitterKeys) {
      hitterKeys = [
        { t: T.runEnd, p: runPose(T.runEnd) },
        { t: T.plantEnd, p: { lean: 30, tilt: -8, twist: 0, ua1: -60, fa1: -48, ua2: -55, fa2: -42, abd1: 12, abd2: 12, th1: 44, sh1: -30, th2: 36, sh2: -36 }, e: 'inOutQ' },
        { t: 1.60, p: { lean: 8, tilt: -12, twist: 0, ua1: 150, fa1: 168, ua2: 140, fa2: 158, abd1: 14, abd2: 14, th1: -14, sh1: -10, th2: -18, sh2: -22 }, e: 'outQ' },
        { t: 1.74, p: { lean: -12, tilt: -18, twist: -22, ua1: 200, fa1: 292, ua2: 165, fa2: 150, abd1: 48, abd2: 20, th1: -26, sh1: -72, th2: -20, sh2: -78 }, e: 'inOutQ' },
        { t: T.contact, p: { lean: 12, tilt: -8, twist: 14, ua1: 127, fa1: 127, ua2: 52, fa2: 36, abd1: 10, abd2: 14, th1: 24, sh1: -18, th2: 12, sh2: -32 }, e: 'inC' },
        { t: 2.10, p: { lean: 26, tilt: 6, twist: 20, ua1: 52, fa1: 30, ua2: 40, fa2: 28, abd1: 14, abd2: 14, th1: 32, sh1: -10, th2: 20, sh2: -22 }, e: 'outQ' },
        { t: 2.45, p: { lean: 14, tilt: 2, twist: 8, ua1: 30, fa1: 60, ua2: 25, fa2: 55, abd1: 10, abd2: 10, th1: 26, sh1: -30, th2: 20, sh2: -34 }, e: 'inOutQ' }
      ];
    }
    p = poseTrack(ts, hitterKeys);
    p.x = track(ts, [[T.runEnd, -1.08, 'lin'], [T.plantEnd, -1.0, 'outQ'], [T.peak, -0.84, 'lin'], [2.6, -0.62, 'lin']]);
    if (ts < T.plantEnd) p.y = groundY(HITTER, p);
    else {
      var y0 = groundY(HITTER, hitterKeys[1].p);
      var u = (ts - T.plantEnd) / (T.peak - T.plantEnd);
      if (u <= 1) p.y = y0 + (PEAK_HIP - y0) * (1 - (1 - u) * (1 - u));
      else { var d = u - 1; p.y = Math.max(y0 + 0.02, PEAK_HIP - (PEAK_HIP - y0) * d * d); }
    }
    return p;
  }
  var setterKeys = [
    { t: 0, p: { lean: 4, tilt: -6, ua1: 150, fa1: 206, ua2: 148, fa2: 208, abd1: 22, abd2: 22, th1: 8, sh1: 4, th2: -8, sh2: -6, jump: 0 } },
    { t: 1.20, p: { lean: 4, tilt: -6, ua1: 150, fa1: 206, ua2: 148, fa2: 208, abd1: 22, abd2: 22, th1: 8, sh1: 4, th2: -8, sh2: -6, jump: 0 }, e: 'lin' },
    { t: 1.42, p: { lean: 7, tilt: -16, ua1: 147, fa1: 210, ua2: 145, fa2: 212, abd1: 22, abd2: 22, th1: 24, sh1: -10, th2: 8, sh2: -14, jump: 0 }, e: 'inOutQ' },
    { t: T.setStart, p: { lean: 2, tilt: -14, ua1: 150, fa1: 206, ua2: 148, fa2: 208, abd1: 22, abd2: 22, th1: 4, sh1: 2, th2: -4, sh2: -2, jump: 0.14 }, e: 'outQ' },
    { t: 1.62, p: { lean: 0, tilt: -16, ua1: 170, fa1: 180, ua2: 168, fa2: 178, abd1: 18, abd2: 18, th1: 2, sh1: 0, th2: -2, sh2: 0, jump: 0.2 }, e: 'outQ' },
    { t: 1.80, p: { lean: 4, tilt: -12, ua1: 160, fa1: 168, ua2: 158, fa2: 165, abd1: 18, abd2: 18, th1: 16, sh1: -6, th2: -6, sh2: -8, jump: 0 }, e: 'inQ' },
    { t: 2.10, p: { lean: 4, tilt: -10, ua1: 118, fa1: 132, ua2: 116, fa2: 130, abd1: 14, abd2: 14, th1: 8, sh1: 4, th2: -8, sh2: -6, jump: 0 }, e: 'outQ' }
  ];
  function setterPose(ts) {
    var p = poseTrack(ts, setterKeys);
    p.x = track(ts, [[1.15, -2.12, 'lin'], [1.5, -2.0, 'inOutQ']]);
    p.z = 0.05; p.yaw = -14; // turned a touch toward the camera
    p.y = groundY(SETTER, p) + (p.jump || 0) + (ts < 1.2 ? 0.012 * Math.sin(ts * 4) : 0);
    return p;
  }
  function worldOf(obj, out) { G.scene.updateMatrixWorld(true); return obj.getWorldPosition(out || new THREE.Vector3()); }
  function setterHands(ts) {
    applyPose(G.setter, setterPose(ts));
    var a = worldOf(G.setter.handF), b = worldOf(G.setter.handB);
    return a.add(b).multiplyScalar(0.5).add(v3(0.02, 0.13, 0));
  }
  function hitterHand(ts) {
    applyPose(G.hitter, hitterPose(ts));
    return worldOf(G.hitter.handF).add(v3(0.06, 0.08, 0.02));
  }
  function bez(p0, p1, p2, u) {
    var a = p0.clone().lerp(p1, u), b = p1.clone().lerp(p2, u); return a.lerp(b, u);
  }
  function ballState(ts) {
    var C = T.contact;
    if (ts < T.passStart) return { pos: v3(-9, -1, 0), vis: false };
    if (ts < T.setStart) {
      var p2 = S.handsPt, p0 = v3(-7.5, 2.0, 1.4), p1 = v3(p2.x * 0.5 - 2.4, 4.6, 0.7);
      return { pos: bez(p0, p1, p2, seg(ts, T.passStart, T.setStart, 'lin')), vis: true };
    }
    if (ts <= C) {
      var a = S.handsPt, b = S.contactPt;
      var ctrl = a.clone().lerp(b, 0.5); ctrl.y = Math.max(a.y, b.y) + 0.28;
      return { pos: bez(a, ctrl, b, seg(ts, T.setStart, C, 'outQ')), vis: true };
    }
    return { pos: S.contactPt.clone(), vis: true };
  }

  /* ---------- textures ---------- */
  function floorTexture() {
    var size = 1024, m = size / 20; // 20 m x 20 m
    var c = document.createElement('canvas'); c.width = c.height = size; var x = c.getContext('2d');
    x.fillStyle = COL.floor; x.fillRect(0, 0, size, size);
    x.fillStyle = 'rgba(255,122,26,0.045)'; x.fillRect(size / 2 - 9 * m, size / 2 - 4.5 * m, 18 * m, 9 * m);
    x.strokeStyle = COL.grid; x.lineWidth = 1; x.beginPath();
    for (var i = 0; i <= 20; i++) { x.moveTo(i * m, 0); x.lineTo(i * m, size); x.moveTo(0, i * m); x.lineTo(size, i * m); }
    x.stroke();
    x.strokeStyle = COL.lines; x.lineWidth = 4; x.lineCap = 'round';
    x.strokeRect(size / 2 - 9 * m, size / 2 - 4.5 * m, 18 * m, 9 * m);
    x.beginPath();
    [0, 3, -3].forEach(function (k) { x.moveTo(size / 2 + k * m, size / 2 - 4.5 * m); x.lineTo(size / 2 + k * m, size / 2 + 4.5 * m); });
    x.stroke();
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
  }
  function ballTexture() {
    var W = 1024, H = 512;
    var c = document.createElement('canvas'); c.width = W; c.height = H; var x = c.getContext('2d');
    x.fillStyle = '#f7f2e8'; x.fillRect(0, 0, W, H);
    function band(u0, phi, color, width) {
      x.strokeStyle = color; x.lineWidth = width; x.lineJoin = 'round';
      for (var pass = -1; pass <= 1; pass++) { // repeat so the seam wraps
        x.beginPath();
        for (var i = 0; i <= 200; i++) {
          var u = i / 200 * Math.PI * 2;
          var v = Math.atan(Math.tan(phi) * Math.sin(u - u0));
          var px = (u / (Math.PI * 2) + pass) * W, py = (0.5 - v / Math.PI) * H;
          if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
        }
        x.stroke();
      }
    }
    var cols = ['#2f5fd0', '#ffd23f', '#2f5fd0'];
    for (var k = 0; k < 3; k++) { band(k * Math.PI * 2 / 3, 58 * rad, '#3a3a44', 82); band(k * Math.PI * 2 / 3, 58 * rad, cols[k], 70); }
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  function netTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 64; var x = c.getContext('2d');
    x.clearRect(0, 0, 64, 64); x.strokeStyle = 'rgba(235,240,255,0.7)'; x.lineWidth = 2.5;
    x.beginPath(); [0, 32].forEach(function (p) { x.moveTo(p + 1, 0); x.lineTo(p + 1, 64); x.moveTo(0, p + 1); x.lineTo(64, p + 1); }); x.stroke();
    var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(48, 5); return t;
  }
  function dotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 32; var x = c.getContext('2d');
    var g = x.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,0.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }
  function starTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 256; var x = c.getContext('2d');
    var g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,220,180,0.9)'); g.addColorStop(1, 'rgba(255,122,26,0)');
    x.fillStyle = g; x.fillRect(0, 0, 256, 256);
    x.fillStyle = '#fff'; x.beginPath();
    for (var k = 0; k < 16; k++) { var r = k % 2 ? 44 : 118, a = k * Math.PI / 8; x.lineTo(128 + Math.cos(a) * r, 128 + Math.sin(a) * r); }
    x.closePath(); x.fill();
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }

  /* ---------- scene ---------- */
  function build() {
    if (S.built) return;
    var root = dom.root = document.getElementById('intro');
    root.innerHTML = '';
    var renderer = G.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
    renderer.domElement.className = 'scene';
    root.appendChild(renderer.domElement);

    var scene = G.scene = new THREE.Scene();
    scene.background = new THREE.Color(COL.bg);
    scene.fog = new THREE.Fog(COL.bg, 9, 30);

    scene.add(new THREE.HemisphereLight(0x8ea2ff, 0x3a2412, 0.9));
    var key = new THREE.DirectionalLight(0xfff1dc, 2.2); key.position.set(3.5, 8, 6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
    key.shadow.camera.near = 1; key.shadow.camera.far = 30; key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02; scene.add(key);
    var rim = new THREE.DirectionalLight(0x6d8bd6, 1.1); rim.position.set(-6, 5, -6); scene.add(rim);
    var warm = new THREE.PointLight(0xff7a1a, 18, 14, 2); warm.position.set(0, 3.2, -2.5); scene.add(warm);

    var floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.92, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    // horizon glow strip behind the court
    var glow = new THREE.Mesh(new THREE.PlaneGeometry(40, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a, transparent: true, opacity: 0.08, depthWrite: false }));
    glow.position.set(0, 0.6, -9.5); glow.material.opacity = 0.06; scene.add(glow);

    // net
    var postMat = mat(0x4a5478, { roughness: 0.5, metalness: 0.3 });
    [4.95, -4.95].forEach(function (z) { var p = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, NET_TOP + 0.3, 12), postMat); p.position.set(0, (NET_TOP + 0.3) / 2, z); p.castShadow = true; scene.add(p); });
    var mesh = new THREE.Mesh(new THREE.PlaneGeometry(9.6, 1.0), new THREE.MeshBasicMaterial({ map: netTexture(), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    mesh.rotation.y = Math.PI / 2; mesh.position.set(0, NET_TOP - 0.5, 0); scene.add(mesh);
    var tapeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6, roughness: 0.6 });
    var tape = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 9.6), tapeMat); tape.position.set(0, NET_TOP, 0); tape.castShadow = true; scene.add(tape);
    var bottomTape = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.04, 9.6), tapeMat); bottomTape.position.set(0, NET_TOP - 1.0, 0); scene.add(bottomTape);
    var stripes = document.createElement('canvas'); stripes.width = 8; stripes.height = 64; var sx = stripes.getContext('2d');
    for (var i = 0; i < 8; i++) { sx.fillStyle = i % 2 ? '#ffffff' : '#ff4d4d'; sx.fillRect(0, i * 8, 8, 8); }
    var antTex = new THREE.CanvasTexture(stripes); antTex.colorSpace = THREE.SRGBColorSpace;
    [4.5, -4.5].forEach(function (z) { var a = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.8, 8), new THREE.MeshStandardMaterial({ map: antTex, roughness: 0.5 })); a.position.set(0, NET_TOP - 0.1, z); scene.add(a); });

    // dust
    var n = 500, pos = new Float32Array(n * 3);
    for (var d = 0; d < n; d++) { pos[d * 3] = (Math.random() - 0.5) * 16; pos[d * 3 + 1] = Math.random() * 5; pos[d * 3 + 2] = (Math.random() - 0.5) * 12; }
    var dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    G.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffc38a, size: 0.05, map: dotTexture(), alphaTest: 0.2, transparent: true, opacity: 0.6, depthWrite: false })); scene.add(G.dust);

    // figures + ball
    G.hitter = makeFigure(HITTER); scene.add(G.hitter.root);
    G.setter = makeFigure(SETTER); scene.add(G.setter.root);
    G.ball = new THREE.Mesh(new THREE.SphereGeometry(0.105, 36, 24), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.55 })); G.ball.castShadow = true; scene.add(G.ball);

    // effects
    var streakMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
    G.streaks = [];
    for (var s = 0; s < 5; s++) { var st = new THREE.Mesh(new THREE.BoxGeometry(1, 0.012, 0.012), streakMat); st.visible = false; scene.add(st); G.streaks.push(st); }
    G.dustPuffs = [];
    var puffMat = new THREE.MeshBasicMaterial({ color: 0xffb26b, transparent: true, opacity: 0.5, depthWrite: false });
    for (var q = 0; q < 5; q++) { var pf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), puffMat.clone()); pf.visible = false; scene.add(pf); G.dustPuffs.push(pf); }
    G.star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })); G.star.visible = false; G.star.renderOrder = 10; scene.add(G.star);
    G.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false, depthTest: false })); G.ring.visible = false; G.ring.renderOrder = 9; scene.add(G.ring);

    // cameras
    G.cam1 = new THREE.PerspectiveCamera(40, 1, 0.05, 60);
    G.cam2 = new THREE.PerspectiveCamera(56, 1, 0.03, 60);

    // anchor points derived from the rig so the ball, hands and contact always line up
    S.handsPt = setterHands(T.setStart);
    S.contactPt = hitterHand(T.contact);

    // overlay ui + speed lines
    var ui = dom.ui = document.createElement('div');
    ui.className = 'intro-ui';
    var site = window.SITE || {};
    ui.innerHTML = '<svg class="intro-rays" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true"></svg>' +
      '<div class="intro-label">' + U.esc(site.label || site.name || '') + '<span class="dot">.</span></div>' +
      '<div class="intro-beat" id="intro-beat"><b>01</b><span></span></div>';
    root.appendChild(ui);
    dom.rays = ui.querySelector('.intro-rays');
    dom.rayData = [];
    for (var r = 0; r < 60; r++) {
      var ang = Math.random() * Math.PI * 2;
      dom.rayData.push({ a: ang, len: 120 + Math.random() * 420, w: 1 + Math.random() * 3, off: Math.random(), op: 0.15 + Math.random() * 0.5 });
      var ln = document.createElementNS('http://www.w3.org/2000/svg', 'line'); ln.setAttribute('stroke', '#ffffff'); ln.setAttribute('stroke-linecap', 'round'); dom.rays.appendChild(ln);
    }
    dom.flash = document.createElement('div'); dom.flash.className = 'intro-flash'; root.appendChild(dom.flash);
    dom.beat = ui.querySelector('#intro-beat');
    var ia = site.introAnimation || {};
    if (ia.skippable !== false) {
      var skip = document.createElement('button'); skip.className = 'intro-skip'; skip.type = 'button';
      skip.innerHTML = 'Skip intro <span class="arrow">→</span>';
      skip.addEventListener('click', function () { finish(true); });
      ui.appendChild(skip);
    }
    document.addEventListener('keydown', function (e) { if ((S.playing || S.seeking) && (e.key === 'Escape' || e.key === ' ' || e.key === 'Enter') && ia.skippable !== false) finish(true); });
    window.addEventListener('resize', resize);
    resize();
    S.built = true;
  }
  function resize() {
    if (!G.renderer) return;
    S.w = window.innerWidth; S.h = window.innerHeight;
    G.renderer.setSize(S.w, S.h);
    var aspect = S.w / S.h;
    [G.cam1, G.cam2].forEach(function (c, i) { c.aspect = aspect; c.fov = aspect < 1 ? (i ? 78 : 66) : (i ? 56 : 40); c.updateProjectionMatrix(); });
  }

  /* ---------- rendering ---------- */
  var tmpV = null;
  function renderShot1(ts, tRaw) {
    var hp = hitterPose(ts), sp = setterPose(ts);
    applyPose(G.hitter, hp); applyPose(G.setter, sp);
    var b = ballState(ts);
    G.ball.visible = b.vis; G.ball.position.copy(b.pos);
    G.ball.rotation.set(ts * 2.2, 0, -ts * 9);
    // speed streaks behind the runner
    var run = ts > T.runStart + 0.15 && ts < T.runEnd + 0.05 ? seg(ts, T.runStart + 0.15, T.runStart + 0.4, 'outQ') * (1 - seg(ts, T.runEnd - 0.1, T.runEnd + 0.05, 'lin')) : 0;
    G.streaks.forEach(function (st, i) {
      st.visible = run > 0.02;
      var len = 0.5 + i * 0.12 + Math.sin(ts * 31 + i * 2) * 0.18;
      st.scale.x = len; st.position.set(hp.x - 0.45 - i * 0.06 - len / 2, 0.95 + i * 0.13 + Math.sin(ts * 40 + i) * 0.02, 0.18 - i * 0.09);
      st.material.opacity = 0.35 * run;
    });
    var du = seg(ts, T.runEnd + 0.02, T.runEnd + 0.5, 'outC');
    G.dustPuffs.forEach(function (pf, i) {
      pf.visible = du > 0 && du < 1;
      pf.position.set(hp.x - 0.15 - i * 0.12 - du * 0.35 * (i + 1) / 2, 0.06 + du * (0.12 + i * 0.06), (i - 2) * 0.12);
      var sc = 0.6 + du * 2.2; pf.scale.setScalar(sc); pf.material.opacity = 0.5 * (1 - du);
    });
    // impact
    var C = T.contact, imp = ts >= C;
    var s = 0.25 + 1.0 * seg(ts, C, C + 0.1, 'outC');
    var starOp = imp ? 1 - seg(ts, C + 0.02, C + 0.3, 'inQ') : 0;
    G.star.visible = imp && starOp > 0; G.star.position.copy(S.contactPt); G.star.scale.setScalar(s * 1.3); G.star.material.opacity = starOp; G.star.material.rotation = ts * 1.5;
    var ru = seg(ts, C, C + 0.32, 'outC');
    G.ring.visible = imp && ru < 1; G.ring.position.copy(S.contactPt); G.ring.scale.setScalar(0.08 + 1.4 * ru); G.ring.material.opacity = 0.8 * (1 - ru);
    // camera 1: dollies right with the approach, keeps the hitter framed
    var cx = track(ts, [[0, -4.4, 'lin'], [T.runEnd, -2.4, 'inOutQ'], [T.contact, -1.6, 'outQ']]);
    var cy = track(ts, [[0, 1.55, 'lin'], [T.plantEnd, 1.45, 'inOutQ'], [T.contact, 1.75, 'outQ']]);
    var cz = track(ts, [[0, 6.2, 'lin'], [T.contact, 5.2, 'inOutQ']]);
    var lx = track(ts, [[0, -3.2, 'lin'], [T.runEnd, -1.7, 'inOutQ'], [T.contact, -1.0, 'outQ']]);
    var ly = track(ts, [[0, 1.05, 'lin'], [T.plantEnd, 1.05, 'lin'], [T.contact, 1.65, 'outQ']]);
    var shake = imp ? (1 - seg(ts, C, C + 0.3, 'lin')) * 0.06 : 0;
    var cam = G.cam1;
    cam.position.set(cx + Math.sin(tRaw * 120) * shake, cy + Math.cos(tRaw * 97) * shake, cz);
    G.ring.lookAt(cam.position);
    cam.lookAt(lx, ly, 0);
    if (dom.rays) dom.rays.style.opacity = 0;
    G.renderer.render(G.scene, cam);
  }
  function renderShot2(t2, ts) {
    var hp = hitterPose(ts), sp = setterPose(ts);
    applyPose(G.hitter, hp); applyPose(G.setter, sp);
    G.star.visible = false; G.ring.visible = false; G.streaks.forEach(function (s) { s.visible = false; }); G.dustPuffs.forEach(function (p) { p.visible = false; });
    var cam = G.cam2;
    var camPos = v3(2.7, 1.05, 0.35);
    cam.position.copy(camPos).add(v3(Math.sin(t2 * 9) * 0.012, Math.cos(t2 * 7) * 0.01, 0));
    var u = clamp01(t2 / T.flight);
    var e = u * u * (3 - 2 * u); // smoothstep: leaves the hand fast, keeps coming
    var target = camPos.clone().add(v3(-0.02, 0.02, 0));
    var pos = S.contactPt.clone().lerp(target, Math.min(0.94, e));
    G.ball.visible = true; G.ball.position.copy(pos);
    G.ball.rotation.set(t2 * 6, 0, -t2 * 14);
    cam.lookAt(S.contactPt.x, S.contactPt.y - 0.25, S.contactPt.z);
    G.renderer.render(G.scene, cam);
    // anime focus lines converging on the ball
    tmpV = tmpV || new THREE.Vector3();
    tmpV.copy(pos).project(cam);
    var bx = (tmpV.x * 0.5 + 0.5) * 1600, by = (0.5 - tmpV.y * 0.5) * 900;
    var dist = pos.distanceTo(cam.position);
    var inner = Math.min(900, 40 + 80 / Math.max(0.05, dist));
    var lines = dom.rays.children;
    dom.rays.style.opacity = Math.min(1, t2 * 4) * (1 - seg(t2, T.fadeAt, T.fadeAt + 0.3, 'lin'));
    for (var i = 0; i < lines.length; i++) {
      var rd = dom.rayData[i];
      var r0 = inner + ((rd.off + t2 * 2.5) % 1) * 60, r1 = r0 + rd.len * (0.6 + 0.4 * Math.sin(t2 * 30 + i));
      lines[i].setAttribute('x1', bx + Math.cos(rd.a) * r0); lines[i].setAttribute('y1', by + Math.sin(rd.a) * r0);
      lines[i].setAttribute('x2', bx + Math.cos(rd.a) * r1); lines[i].setAttribute('y2', by + Math.sin(rd.a) * r1);
      lines[i].setAttribute('stroke-width', rd.w.toFixed(1));
      lines[i].setAttribute('stroke-opacity', (rd.op * (0.5 + 0.5 * Math.sin(t2 * 40 + i * 1.7))).toFixed(2));
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
    var ts = t < C ? t : (t < C + T.hitStop ? C : t - T.hitStop);
    // dust drift
    var arr = G.dust.geometry.attributes.position.array;
    for (var i = 1; i < arr.length; i += 3) { arr[i] += 0.0006; if (arr[i] > 5) arr[i] = 0; }
    G.dust.geometry.attributes.position.needsUpdate = true;
    if (t < T.cut) renderShot1(ts, t); else renderShot2(t - T.cut, ts);
    G.renderer.domElement.style.opacity = seg(t, 0, T.fadeIn, 'outQ').toFixed(2);
    var f1 = t >= C ? (t < C + 0.05 ? seg(t, C, C + 0.05, 'outQ') * 0.85 : 0.85 * (1 - seg(t, C + 0.05, C + 0.3, 'outQ'))) : 0;
    var hit = T.cut + T.fadeAt;
    var f2 = t >= hit - 0.03 ? (t < hit ? seg(t, hit - 0.03, hit, 'lin') : 1 - seg(t, hit, hit + 0.35, 'outQ')) : 0;
    dom.flash.style.opacity = Math.max(f1, f2 * 0.95).toFixed(2);
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
    try { build(); } catch (e) { console.warn('3D intro unavailable, using the 2D version.', e); if (window.Intro) window.Intro.play(opts); return; }
    if (S.playing) return;
    hitterKeys = null;
    S.playing = true; S.seeking = false; S.fading = false; S.lastBeat = -1; S.done = opts.onDone || null;
    dom.root.hidden = false; dom.root.classList.remove('fading');
    G.renderer.domElement.style.opacity = 0;
    document.body.classList.add('intro-active');
    window.scrollTo(0, 0);
    resize();
    S.start = performance.now();
    renderAt(0);
    S.raf = requestAnimationFrame(tick);
  }
  /** Debug/preview: show the frame at time t (seconds) and pause. */
  function seek(t) {
    build();
    cancelAnimationFrame(S.raf);
    S.playing = false; S.seeking = true; hitterKeys = null;
    dom.root.hidden = false; dom.root.classList.remove('fading');
    document.body.classList.add('intro-active');
    resize();
    renderAt(t);
    G.renderer.domElement.style.opacity = t < T.fadeIn ? seg(t, 0, T.fadeIn, 'outQ') : 1;
  }
  return { play: play, finish: finish, seek: seek, supported: supported, T: T };
})();
