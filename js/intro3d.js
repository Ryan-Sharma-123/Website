/* 3D intro (Three.js, vendored in js/vendor/three.min.js).
   The open spike: a high toss, a full three-step approach, a huge jump, a slow-motion beat at the
   top, the swing, then the receiver's view as the ball flies straight at the camera and fills the
   screen before the home page appears. The hitter is styled after a short orange-haired #10 and
   the setter after a dark-haired #9; both are original low-poly figures.
   Timing lives in T (seconds), the real-time → scene-time map in TIME_MAP (slow motion, hit-stop),
   colours in COL. Falls back to intro.js when WebGL is not available. */
window.Intro3D = (function () {
  'use strict';
  var U = window.U;
  var T = {
    fadeIn: 0.35,
    passStart: 0.10, setContact: 1.30, setRelease: 1.42,     // the pass reaches the setter; the toss leaves
    runStart: 1.80, plant: 2.66, takeoff: 2.68, peak: 3.08, contact: 3.10,
    shotB: 1.80, shotC: 2.92,                                // real-time cuts
    cut: 3.72,                                               // real-time cut to the receiver's view
    flight: 1.05, fadeAt: 0.9, fadeDur: 0.75, end: 5.55
  };
  // real seconds → scene seconds. Slope 1 = normal speed, 0.22 = slow motion, 0 = freeze frame.
  var TIME_MAP = [[0, 0], [2.92, 2.92], [3.465, 3.04], [3.525, 3.10], [3.665, 3.10], [9.0, 8.435]];
  var COL = {
    skin: 0xf6d2b4, hairHitter: 0xf5822a, hairSetter: 0x171b2c, jersey: 0x1a1a21, kit: 0xf5822a, shorts: 0x15151b,
    shoe: 0xf2f3f7, shoeStripe: 0xe0452b, sole: 0x2a2a30, pad: 0x1a1a21, ink: 0x141827,
    irisHitter: 0x6b3d17, irisSetter: 0x223a6e, brow: 0xb85c14, browSetter: 0x1a1f33, mouth: 0x7a2a2a,
    bg: 0x0e1019, floor: '#12141f', grid: 'rgba(138,180,255,0.17)', lines: 'rgba(185,201,255,0.85)', court: 'rgba(138,180,255,0.05)',
    accent: 0x8ab4ff, accent2: 0xb9a6ff, dust: 0xc9d4ff
  };
  var NET_TOP = 2.24, PEAK_HIP = 1.96;
  var rad = Math.PI / 180;
  var S = { built: false, playing: false, seeking: false, raf: 0, start: 0, done: null, fading: false, lastBeat: -1, contactPt: null, handsPass: null, handsRelease: null, w: 0, h: 0 };
  var dom = {}, G = {};

  function supported() {
    if (!window.THREE) return false;
    try { var c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch (e) { return false; }
  }

  /* ---------- tween helpers ---------- */
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
    for (var k in a) o[k] = (typeof a[k] === 'number' && typeof b[k] === 'number') ? a[k] + (b[k] - a[k]) * u : (b[k] === undefined ? a[k] : (u < 0.5 ? a[k] : b[k]));
    for (var k2 in b) if (!(k2 in o)) o[k2] = b[k2];
    return o;
  }
  function poseTrack(t, keys) {
    if (t <= keys[0].t) return keys[0].p;
    for (var i = 1; i < keys.length; i++) if (t <= keys[i].t) return blend(keys[i - 1].p, keys[i].p, seg(t, keys[i - 1].t, keys[i].t, keys[i].e));
    return keys[keys.length - 1].p;
  }
  function v3(x, y, z) { return new THREE.Vector3(x, y, z); }
  function sceneTime(t) { return track(t, TIME_MAP); }

  /* ---------- rig ---------- */
  var HITTER = { number: '10', hair: 'spiky', hairColor: COL.hairHitter, iris: COL.irisHitter, brow: COL.brow, scale: 1.0, torso: 0.40, neck: 0.05, head: 0.135, upper: 0.27, fore: 0.25, thigh: 0.35, shin: 0.33 };
  var SETTER = { number: '9', hair: 'cap', hairColor: COL.hairSetter, iris: COL.irisSetter, brow: COL.browSetter, scale: 1.1, torso: 0.42, neck: 0.05, head: 0.13, upper: 0.28, fore: 0.26, thigh: 0.36, shin: 0.34 };

  function mat(color, opts) { return new THREE.MeshStandardMaterial(Object.assign({ color: color, roughness: 0.78, metalness: 0 }, opts || {})); }
  function capsule(r, len, material) { var m = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(0.01, len), 4, 12), material); m.castShadow = true; return m; }
  function limb(parent, r, len, material, at) {
    var g = new THREE.Group(); g.position.copy(at); parent.add(g);
    var m = capsule(r, len - r * 1.2, material); m.position.y = -len / 2; g.add(m);
    return g;
  }
  function numberTexture(text) {
    var c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d'); x.clearRect(0, 0, 128, 128);
    x.font = '700 82px "Space Grotesk", system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
    x.lineWidth = 10; x.strokeStyle = '#f5822a'; x.lineJoin = 'round'; x.strokeText(text, 64, 68);
    x.fillStyle = '#ffffff'; x.fillText(text, 64, 68);
    var t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
  }
  var HAIR_SPIKES = [ // direction (x forward, y up, z side), length
    [0.35, 1, 0.05, 0.19], [0.05, 1, 0.5, 0.2], [0.05, 1, -0.5, 0.2], [-0.4, 0.95, 0.15, 0.21], [-0.4, 0.95, -0.15, 0.21],
    [0.6, 0.8, 0.4, 0.17], [0.6, 0.8, -0.4, 0.17], [-0.75, 0.65, 0.5, 0.19], [-0.75, 0.65, -0.5, 0.19], [-0.95, 0.35, 0, 0.2],
    [-0.6, 0.5, 0.8, 0.16], [-0.6, 0.5, -0.8, 0.16], [0.2, 0.7, 0.85, 0.15], [0.2, 0.7, -0.85, 0.15], [-0.15, 1, 0, 0.23],
    [0.85, 0.35, 0.25, 0.15], [0.85, 0.35, -0.25, 0.15], [0.7, 0.2, 0.7, 0.13], [0.7, 0.2, -0.7, 0.13], [-0.35, 0.85, 0.55, 0.18], [-0.35, 0.85, -0.55, 0.18]
  ];
  function makeFigure(cfg) {
    var skin = mat(COL.skin), jersey = mat(COL.jersey, { roughness: 0.85 }), kit = mat(COL.kit), shorts = mat(COL.shorts, { roughness: 0.85 });
    var shoe = mat(COL.shoe, { roughness: 0.5 }), sole = mat(COL.sole), stripe = mat(COL.shoeStripe), pad = mat(COL.pad, { roughness: 0.9 }), hair = mat(cfg.hairColor, { roughness: 0.7 });
    var ink = mat(COL.ink), white = mat(0xffffff, { roughness: 0.3 }), iris = mat(cfg.iris, { roughness: 0.4 }), brow = mat(cfg.brow), mouth = mat(COL.mouth);
    var root = new THREE.Group(); root.scale.setScalar(cfg.scale);
    var torso = new THREE.Group(); root.add(torso);
    var body = capsule(0.15, cfg.torso - 0.2, jersey); body.position.y = cfg.torso * 0.52; body.scale.set(0.78, 1, 1.12); torso.add(body);
    [1, -1].forEach(function (s) { // orange side panels
      var b = new THREE.Mesh(new THREE.BoxGeometry(0.07, cfg.torso * 0.78, 0.03), kit); b.position.set(0.02, cfg.torso * 0.48, s * 0.17); b.castShadow = true; torso.add(b);
      var sl = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.1, 12), jersey); sl.rotation.x = Math.PI / 2; sl.position.set(0, cfg.torso - 0.03, s * 0.2); sl.castShadow = true; torso.add(sl);
      var band = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.025, 12), kit); band.rotation.x = Math.PI / 2; band.position.set(0, cfg.torso - 0.03, s * 0.245); torso.add(band);
    });
    var numMat = new THREE.MeshBasicMaterial({ map: numberTexture(cfg.number), transparent: true, depthWrite: false });
    var nf = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.17), numMat); nf.position.set(0.122, cfg.torso * 0.62, 0); nf.rotation.y = Math.PI / 2; torso.add(nf);
    var nb = new THREE.Mesh(new THREE.PlaneGeometry(0.19, 0.19), numMat); nb.position.set(-0.122, cfg.torso * 0.6, 0); nb.rotation.y = -Math.PI / 2; torso.add(nb);
    var sh = capsule(0.16, 0.06, shorts); sh.position.y = -0.03; sh.scale.set(0.85, 1, 1.1); root.add(sh);
    [1, -1].forEach(function (s) { var st = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.14, 0.025), kit); st.position.set(0.02, -0.04, s * 0.175); root.add(st); });
    // head
    var neck = new THREE.Group(); neck.position.y = cfg.torso + cfg.neck; torso.add(neck);
    var head = new THREE.Mesh(new THREE.SphereGeometry(cfg.head, 26, 20), skin); head.position.y = cfg.head * 0.92; head.castShadow = true; neck.add(head);
    var R = cfg.head;
    [1, -1].forEach(function (s) {
      var sc = new THREE.Mesh(new THREE.SphereGeometry(0.034, 14, 12), white); sc.scale.set(0.3, 1.05, 0.85); sc.position.set(R * 0.86, 0.012, s * R * 0.4); head.add(sc);
      var ir = new THREE.Mesh(new THREE.SphereGeometry(0.021, 12, 10), iris); ir.scale.set(0.3, 1, 0.85); ir.position.set(R * 0.93, 0.008, s * R * 0.4); head.add(ir);
      var pu = new THREE.Mesh(new THREE.SphereGeometry(0.01, 8, 8), ink); pu.scale.set(0.3, 1, 0.9); pu.position.set(R * 0.98, 0.01, s * R * 0.4); head.add(pu);
      var hl = new THREE.Mesh(new THREE.SphereGeometry(0.005, 6, 6), white); hl.position.set(R * 1.0, 0.024, s * R * 0.45); head.add(hl);
      var br = new THREE.Mesh(new THREE.BoxGeometry(0.016, 0.009, 0.055), brow); br.position.set(R * 0.9, 0.056, s * R * 0.4); br.rotation.x = s * (cfg.hair === 'spiky' ? 0.35 : -0.3); head.add(br);
    });
    var mo = new THREE.Mesh(new THREE.SphereGeometry(cfg.hair === 'spiky' ? 0.017 : 0.012, 10, 8), mouth); mo.scale.set(0.35, 1, 1.1); mo.position.set(R * 0.92, -0.058, 0); head.add(mo);
    if (cfg.hair === 'spiky') {
      var base = new THREE.Mesh(new THREE.SphereGeometry(R * 1.06, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.58), hair); base.position.set(-0.012, 0.012, 0); base.rotation.z = 0.15; base.castShadow = true; head.add(base);
      HAIR_SPIKES.forEach(function (d) {
        var dir = v3(d[0], d[1], d[2]).normalize();
        var g = new THREE.Group(); g.quaternion.setFromUnitVectors(v3(0, 1, 0), dir); head.add(g);
        var cone = new THREE.Mesh(new THREE.ConeGeometry(0.042, d[3], 7), hair); cone.position.y = R * 0.7 + d[3] / 2; cone.castShadow = true; g.add(cone);
      });
      [[0.75, -0.55, 0.3, 0.13], [0.8, -0.45, -0.2, 0.13], [0.7, -0.6, 0.02, 0.12], [0.65, -0.5, 0.55, 0.11]].forEach(function (d) { // fringe over the forehead
        var dir = v3(d[0], d[1], d[2]).normalize();
        var g = new THREE.Group(); g.quaternion.setFromUnitVectors(v3(0, 1, 0), dir); g.position.set(0.02, R * 0.72, 0); head.add(g);
        var cone = new THREE.Mesh(new THREE.ConeGeometry(0.03, d[3], 7), hair); cone.position.y = d[3] / 2 - 0.02; g.add(cone);
      });
    } else {
      var cap = new THREE.Mesh(new THREE.SphereGeometry(R * 1.1, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.6), hair);
      cap.position.set(-0.012, 0.014, 0); cap.rotation.z = 0.22; cap.castShadow = true; head.add(cap);
      var fringe = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.05, 0.19), hair); fringe.position.set(R * 0.9, R * 0.62, 0); fringe.rotation.z = -0.3; head.add(fringe);
      [[0.5, 0.35, 0.25], [0.55, 0.3, -0.2], [0.45, 0.45, 0.02]].forEach(function (d) {
        var dir = v3(d[0], -d[1], d[2]).normalize();
        var g = new THREE.Group(); g.quaternion.setFromUnitVectors(v3(0, 1, 0), dir); g.position.set(0.06, 0.09, 0); head.add(g);
        var cone = new THREE.Mesh(new THREE.ConeGeometry(0.028, 0.12, 8), hair); cone.position.y = 0.05; g.add(cone);
      });
    }
    // arms (+Z = the side nearest the camera = the hitting arm)
    var shoulderY = cfg.torso - 0.02;
    var armF = limb(torso, 0.05, cfg.upper, skin, v3(0, shoulderY, 0.19));
    var foreF = limb(armF, 0.045, cfg.fore, skin, v3(0, -cfg.upper, 0));
    var handF = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), skin); handF.position.y = -cfg.fore; handF.castShadow = true; foreF.add(handF);
    var armB = limb(torso, 0.05, cfg.upper, skin, v3(0, shoulderY, -0.19));
    var foreB = limb(armB, 0.045, cfg.fore, skin, v3(0, -cfg.upper, 0));
    var handB = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 12), skin); handB.position.y = -cfg.fore; handB.castShadow = true; foreB.add(handB);
    function leg(z) {
      var thigh = limb(root, 0.07, cfg.thigh, skin, v3(0, 0, z));
      var shin = limb(thigh, 0.06, cfg.shin, skin, v3(0, -cfg.thigh, 0));
      var knee = new THREE.Mesh(new THREE.SphereGeometry(0.078, 14, 12), pad); knee.position.set(0.01, -0.01, 0); knee.scale.set(1, 1.25, 1); knee.castShadow = true; shin.add(knee);
      var foot = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.075, 0.11), shoe); foot.position.set(0.06, -cfg.shin - 0.02, 0); foot.castShadow = true; shin.add(foot);
      var fs = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.03, 0.115), stripe); fs.position.set(0.05, -cfg.shin - 0.015, 0); shin.add(fs);
      var so = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.02, 0.115), sole); so.position.set(0.06, -cfg.shin - 0.06, 0); shin.add(so);
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
    f.neck.rotation.set(0, (p.look || 0) * rad, -p.tilt * rad);
    f.armF.rotation.set((p.abd1 || 0) * rad, 0, (p.ua1 + p.lean) * rad);
    f.foreF.rotation.z = (p.fa1 - p.ua1) * rad;
    f.armB.rotation.set(-(p.abd2 || 0) * rad, 0, (p.ua2 + p.lean) * rad);
    f.foreB.rotation.z = (p.fa2 - p.ua2) * rad;
    f.legF.rotation.z = p.th1 * rad; f.shinF.rotation.z = (p.sh1 - p.th1) * rad;
    f.legB.rotation.z = p.th2 * rad; f.shinB.rotation.z = (p.sh2 - p.th2) * rad;
  }

  /* ---------- choreography (metres; net at x = 0, the hitter's court is x < 0, the camera side is +z) ---------- */
  var PATH0 = { x: -4.0, z: 5.0 }, PATH_LEN = 3.2;
  var PD = { x: 0.891, z: -0.453 };           // approach direction (unit)
  var PN = { x: 0.453, z: 0.891 };            // perpendicular, toward the camera side
  var YAW = 26.9;                             // facing along the path
  function onPath(s) { return { x: PATH0.x + PD.x * s, z: PATH0.z + PD.z * s }; }
  function hitterDist(ts) {
    return track(ts, [[T.runStart, 0, 'lin'], [2.10, 0.45, 'inQ'], [2.32, 1.30, 'lin'], [2.50, 2.35, 'lin'], [T.plant, PATH_LEN, 'outQ'], [T.contact, PATH_LEN + 0.36, 'lin'], [3.8, PATH_LEN + 0.78, 'lin']]);
  }
  var READY = { lean: 10, tilt: -26, look: -8, twist: 0, ua1: 35, fa1: 75, ua2: 35, fa2: 75, abd1: 10, abd2: 10, th1: 18, sh1: -6, th2: -8, sh2: -10 };
  function runPose(ts) {
    var s = hitterDist(ts);
    var ph = s / 1.0 * Math.PI * 2;
    var sw = Math.sin(ph);
    var th1 = 38 * sw, th2 = -38 * sw;
    var sh1 = th1 - 22 - 38 * (1 - sw) / 2, sh2 = th2 - 22 - 38 * (1 + sw) / 2;
    var speed = seg(ts, T.runStart, T.runStart + 0.3, 'outQ');
    var back = seg(s, 2.15, 3.05, 'inOutQ');       // final stride: both arms swing back together
    var p = {
      lean: 8 + 12 * speed + 10 * back, tilt: -18 - 6 * back, look: 0, twist: 0,
      ua1: (28 - 55 * sw * speed) * (1 - back) + (-78) * back, fa1: (95 - 55 * sw * speed) * (1 - back) + (-62) * back,
      ua2: (28 + 55 * sw * speed) * (1 - back) + (-74) * back, fa2: (95 + 55 * sw * speed) * (1 - back) + (-60) * back,
      abd1: 10 + 6 * back, abd2: 10 + 6 * back,
      th1: th1 * (0.3 + 0.7 * speed), sh1: sh1 * (0.3 + 0.7 * speed) - 4, th2: th2 * (0.3 + 0.7 * speed), sh2: sh2 * (0.3 + 0.7 * speed) - 4
    };
    return blend(READY, p, seg(ts, T.runStart, T.runStart + 0.22, 'inOutQ'));
  }
  var hitterKeys = null;
  function hitterPose(ts) {
    var p, pos = onPath(hitterDist(ts));
    if (ts < T.plant) {
      p = ts < T.runStart ? blend(READY, { lean: READY.lean + 1, tilt: READY.tilt }, 0.5 + 0.5 * Math.sin(ts * 3)) : runPose(ts);
      p.x = pos.x; p.z = pos.z; p.y = groundY(HITTER, p); p.yaw = YAW; return p;
    }
    if (!hitterKeys) {
      var plant = { lean: 28, tilt: -20, look: -6, twist: 0, ua1: -80, fa1: -64, ua2: -76, fa2: -62, abd1: 14, abd2: 14, th1: 46, sh1: -32, th2: 40, sh2: -38 };
      hitterKeys = [
        { t: T.plant, p: plant },
        { t: 2.84, p: { lean: 4, tilt: -22, look: -6, twist: -4, ua1: 140, fa1: 165, ua2: 135, fa2: 160, abd1: 16, abd2: 16, th1: -12, sh1: -8, th2: -16, sh2: -18 }, e: 'outQ' },
        { t: 2.96, p: { lean: -8, tilt: -24, look: -4, twist: -14, ua1: 178, fa1: 205, ua2: 165, fa2: 185, abd1: 28, abd2: 22, th1: -18, sh1: -45, th2: -14, sh2: -50 }, e: 'inOutQ' },
        { t: 3.04, p: { lean: -18, tilt: -22, look: 0, twist: -30, ua1: 205, fa1: 300, ua2: 150, fa2: 130, abd1: 55, abd2: 18, th1: -30, sh1: -75, th2: -24, sh2: -80 }, e: 'inOutQ' },
        { t: T.contact, p: { lean: 16, tilt: -4, look: 4, twist: 18, ua1: 128, fa1: 128, ua2: 48, fa2: 30, abd1: 6, abd2: 12, th1: 28, sh1: -22, th2: 16, sh2: -34 }, e: 'inC' },
        { t: 3.34, p: { lean: 34, tilt: 10, look: 6, twist: 26, ua1: 30, fa1: 10, ua2: 30, fa2: 25, abd1: 10, abd2: 10, th1: 36, sh1: -14, th2: 26, sh2: -24 }, e: 'outQ' },
        { t: 3.7, p: { lean: 16, tilt: 0, look: 4, twist: 8, ua1: 25, fa1: 55, ua2: 25, fa2: 55, abd1: 10, abd2: 10, th1: 30, sh1: -28, th2: 24, sh2: -30 }, e: 'inOutQ' }
      ];
    }
    p = poseTrack(ts, hitterKeys);
    p.x = pos.x; p.z = pos.z;
    p.yaw = track(ts, [[T.takeoff, YAW, 'lin'], [T.contact, 12, 'inOutQ'], [3.5, 6, 'lin']]);
    var y0 = groundY(HITTER, hitterKeys[0].p);
    if (ts < T.takeoff) p.y = y0;
    else {
      var u = (ts - T.takeoff) / (T.peak - T.takeoff);
      if (u <= 1) p.y = y0 + (PEAK_HIP - y0) * (1 - (1 - u) * (1 - u));
      else { var d = u - 1; p.y = Math.max(y0 + 0.02, PEAK_HIP - (PEAK_HIP - y0) * d * d); }
    }
    return p;
  }
  var setterKeys = [
    { t: 0, p: { lean: 6, tilt: -22, look: 0, twist: 0, ua1: 60, fa1: 120, ua2: 60, fa2: 120, abd1: 18, abd2: 18, th1: 14, sh1: -4, th2: -6, sh2: -8, jump: 0 } },
    { t: 0.95, p: { lean: 6, tilt: -22, look: 0, twist: 0, ua1: 60, fa1: 120, ua2: 60, fa2: 120, abd1: 18, abd2: 18, th1: 14, sh1: -4, th2: -6, sh2: -8, jump: 0 }, e: 'lin' },
    { t: 1.10, p: { lean: 8, tilt: -20, look: 0, twist: 0, ua1: 125, fa1: 195, ua2: 122, fa2: 197, abd1: 22, abd2: 22, th1: 26, sh1: -12, th2: 10, sh2: -16, jump: 0 }, e: 'inOutQ' },
    { t: T.setContact, p: { lean: 2, tilt: -16, look: 0, twist: 0, ua1: 150, fa1: 206, ua2: 148, fa2: 208, abd1: 22, abd2: 22, th1: 6, sh1: 2, th2: -4, sh2: -2, jump: 0.16 }, e: 'outQ' },
    { t: 1.46, p: { lean: -2, tilt: -18, look: 0, twist: 0, ua1: 176, fa1: 186, ua2: 174, fa2: 184, abd1: 18, abd2: 18, th1: 2, sh1: 0, th2: -2, sh2: 0, jump: 0.24 }, e: 'outQ' },
    { t: 1.64, p: { lean: 4, tilt: -14, look: 0, twist: 0, ua1: 150, fa1: 160, ua2: 148, fa2: 158, abd1: 18, abd2: 18, th1: 16, sh1: -6, th2: -6, sh2: -8, jump: 0 }, e: 'inQ' },
    { t: 2.2, p: { lean: 4, tilt: -18, look: 10, twist: 8, ua1: 40, fa1: 70, ua2: 38, fa2: 68, abd1: 14, abd2: 14, th1: 8, sh1: 4, th2: -8, sh2: -6, jump: 0 }, e: 'outQ' },
    { t: 3.15, p: { lean: 4, tilt: -18, look: 12, twist: 8, ua1: 40, fa1: 70, ua2: 38, fa2: 68, abd1: 14, abd2: 14, th1: 8, sh1: 4, th2: -8, sh2: -6, jump: 0 }, e: 'lin' },
    { t: 3.5, p: { lean: 2, tilt: -8, look: 12, twist: 6, ua1: 175, fa1: 205, ua2: 45, fa2: 75, abd1: 30, abd2: 14, th1: 8, sh1: 4, th2: -8, sh2: -6, jump: 0 }, e: 'outQ' }
  ];
  function setterPose(ts) {
    var p = poseTrack(ts, setterKeys);
    p.x = -1.05; p.z = 0.2; p.yaw = -64;
    p.y = groundY(SETTER, p) + (p.jump || 0) + (ts < 1.0 ? 0.012 * Math.sin(ts * 4) : 0);
    return p;
  }
  function worldOf(obj, out) { G.scene.updateMatrixWorld(true); return obj.getWorldPosition(out || new THREE.Vector3()); }
  function setterHands(ts) {
    applyPose(G.setter, setterPose(ts));
    var a = worldOf(G.setter.handF), b = worldOf(G.setter.handB);
    return a.add(b).multiplyScalar(0.5).add(v3(0.01, 0.13, 0.03));
  }
  function hitterHand(ts) {
    var p = hitterPose(ts); applyPose(G.hitter, p);
    var h = worldOf(G.hitter.handF);
    var yaw = p.yaw * rad; // a little in front of the palm, along the facing direction
    return h.add(v3(Math.cos(yaw) * 0.07, 0.08, -Math.sin(yaw) * 0.07 + 0.02));
  }
  function bez(p0, p1, p2, u) { var a = p0.clone().lerp(p1, u), b = p1.clone().lerp(p2, u); return a.lerp(b, u); }
  function ballState(ts) {
    var C = T.contact;
    if (ts < T.passStart) return { pos: v3(-9, -1, 0), vis: false };
    if (ts < T.setContact) {
      var p2 = S.handsPass, p0 = v3(-3.6, 1.4, -2.9), p1 = v3((p0.x + p2.x) / 2 - 0.3, 4.6, (p0.z + p2.z) / 2);
      return { pos: bez(p0, p1, p2, seg(ts, T.passStart, T.setContact, 'lin')), vis: true };
    }
    if (ts < T.setRelease) return { pos: S.handsPass.clone().lerp(S.handsRelease, seg(ts, T.setContact, T.setRelease, 'outQ')), vis: true };
    if (ts <= C) {
      var a = S.handsRelease, b = S.contactPt;
      var ctrl = a.clone().lerp(b, 0.5); ctrl.y = (4 * 4.35 - a.y - b.y) / 2;
      return { pos: bez(a, ctrl, b, seg(ts, T.setRelease, C, 'lin')), vis: true };
    }
    return { pos: S.contactPt.clone(), vis: true };
  }

  /* ---------- textures ---------- */
  function floorTexture() {
    var size = 1024, m = size / 20;
    var c = document.createElement('canvas'); c.width = c.height = size; var x = c.getContext('2d');
    x.fillStyle = COL.floor; x.fillRect(0, 0, size, size);
    x.fillStyle = COL.court; x.fillRect(size / 2 - 9 * m, size / 2 - 4.5 * m, 18 * m, 9 * m);
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
      for (var pass = -1; pass <= 1; pass++) {
        x.beginPath();
        for (var i = 0; i <= 200; i++) {
          var u = i / 200 * Math.PI * 2, v = Math.atan(Math.tan(phi) * Math.sin(u - u0));
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
    var g = x.createRadialGradient(128, 128, 0, 128, 128, 128); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(220,232,255,0.9)'); g.addColorStop(1, 'rgba(138,180,255,0)');
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
    scene.fog = new THREE.Fog(COL.bg, 10, 32);

    scene.add(new THREE.HemisphereLight(0x9db4ff, 0x2a2c3a, 0.95));
    var key = new THREE.DirectionalLight(0xfff3e4, 2.1); key.position.set(3.5, 8, 6); key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024); key.shadow.camera.left = -8; key.shadow.camera.right = 8; key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
    key.shadow.camera.near = 1; key.shadow.camera.far = 30; key.shadow.bias = -0.0008; key.shadow.normalBias = 0.02; scene.add(key);
    var rim = new THREE.DirectionalLight(COL.accent2, 1.2); rim.position.set(-6, 5, -6); scene.add(rim);
    var cool = new THREE.PointLight(COL.accent, 16, 14, 2); cool.position.set(0, 3.2, -2.5); scene.add(cool);

    var floor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.92, metalness: 0 }));
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);
    var glow = new THREE.Mesh(new THREE.PlaneGeometry(40, 6), new THREE.MeshBasicMaterial({ color: COL.accent, transparent: true, opacity: 0.06, depthWrite: false }));
    glow.position.set(0, 0.6, -9.5); scene.add(glow);

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

    var n = 500, pos = new Float32Array(n * 3);
    for (var d = 0; d < n; d++) { pos[d * 3] = (Math.random() - 0.5) * 16; pos[d * 3 + 1] = Math.random() * 5; pos[d * 3 + 2] = (Math.random() - 0.5) * 14; }
    var dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    G.dust = new THREE.Points(dg, new THREE.PointsMaterial({ color: COL.dust, size: 0.05, map: dotTexture(), alphaTest: 0.2, transparent: true, opacity: 0.6, depthWrite: false })); scene.add(G.dust);

    G.hitter = makeFigure(HITTER); scene.add(G.hitter.root);
    G.setter = makeFigure(SETTER); scene.add(G.setter.root);
    G.ball = new THREE.Mesh(new THREE.SphereGeometry(0.105, 36, 24), new THREE.MeshStandardMaterial({ map: ballTexture(), roughness: 0.55 })); G.ball.castShadow = true; scene.add(G.ball);

    var streakMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
    G.streaks = [];
    for (var s = 0; s < 5; s++) { var st = new THREE.Mesh(new THREE.BoxGeometry(1, 0.012, 0.012), streakMat.clone()); st.visible = false; scene.add(st); G.streaks.push(st); }
    G.dustPuffs = [];
    var puffMat = new THREE.MeshBasicMaterial({ color: COL.dust, transparent: true, opacity: 0.5, depthWrite: false });
    for (var q = 0; q < 5; q++) { var pf = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), puffMat.clone()); pf.visible = false; scene.add(pf); G.dustPuffs.push(pf); }
    G.star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTexture(), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false })); G.star.visible = false; G.star.renderOrder = 10; scene.add(G.star);
    G.ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, side: THREE.DoubleSide, depthWrite: false, depthTest: false })); G.ring.visible = false; G.ring.renderOrder = 9; scene.add(G.ring);

    G.cams = [new THREE.PerspectiveCamera(46, 1, 0.05, 60), new THREE.PerspectiveCamera(46, 1, 0.05, 60), new THREE.PerspectiveCamera(44, 1, 0.05, 60), new THREE.PerspectiveCamera(56, 1, 0.03, 60)];

    // anchor points derived from the rig so hands, toss and contact always line up
    S.handsPass = setterHands(T.setContact);
    S.handsRelease = setterHands(T.setRelease);
    S.contactPt = hitterHand(T.contact);

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
      dom.rayData.push({ a: Math.random() * Math.PI * 2, len: 120 + Math.random() * 420, w: 1 + Math.random() * 3, off: Math.random(), op: 0.15 + Math.random() * 0.5 });
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
    var aspect = S.w / S.h, portrait = aspect < 1;
    var fovs = portrait ? [68, 70, 68, 78] : [46, 46, 44, 56];
    G.cams.forEach(function (c, i) { c.aspect = aspect; c.fov = fovs[i]; c.updateProjectionMatrix(); });
  }

  /* ---------- rendering ---------- */
  var tmpV = null;
  function hideFx() { G.star.visible = false; G.ring.visible = false; G.streaks.forEach(function (s) { s.visible = false; }); G.dustPuffs.forEach(function (p) { p.visible = false; }); }
  function renderCourt(ts, t) {
    var hp = hitterPose(ts), sp = setterPose(ts);
    applyPose(G.hitter, hp); applyPose(G.setter, sp);
    var b = ballState(ts);
    G.ball.visible = b.vis; G.ball.position.copy(b.pos);
    G.ball.rotation.set(ts * 2.2, 0, -ts * 6);
    // speed streaks behind the runner during the last strides
    var s = hitterDist(ts);
    var run = ts < T.plant + 0.05 ? seg(s, 0.6, 1.4, 'outQ') * (1 - seg(ts, T.plant - 0.05, T.plant + 0.05, 'lin')) : 0;
    G.streaks.forEach(function (st, i) {
      st.visible = run > 0.02;
      var len = 0.5 + i * 0.12 + Math.sin(ts * 31 + i * 2) * 0.18;
      var back = 0.45 + i * 0.06 + len / 2, side = (i - 2) * 0.09;
      st.position.set(hp.x - PD.x * back + PN.x * side, 0.95 + i * 0.13 + Math.sin(ts * 40 + i) * 0.02, hp.z - PD.z * back + PN.z * side);
      st.rotation.y = YAW * rad; st.scale.x = len; st.material.opacity = 0.35 * run;
    });
    var du = seg(ts, T.plant + 0.02, T.plant + 0.5, 'outC');
    G.dustPuffs.forEach(function (pf, i) {
      pf.visible = du > 0 && du < 1;
      var back = 0.15 + i * 0.12 + du * 0.35 * (i + 1) / 2, side = (i - 2) * 0.12;
      pf.position.set(hp.x - PD.x * back + PN.x * side, 0.06 + du * (0.12 + i * 0.06), hp.z - PD.z * back + PN.z * side);
      pf.scale.setScalar(0.6 + du * 2.2); pf.material.opacity = 0.5 * (1 - du);
    });
    var C = T.contact, imp = ts >= C;
    var sc = 0.25 + 1.0 * seg(ts, C, C + 0.1, 'outC');
    var starOp = imp ? 1 - seg(ts, C + 0.02, C + 0.3, 'inQ') : 0;
    G.star.visible = imp && starOp > 0; G.star.position.copy(S.contactPt); G.star.scale.setScalar(sc * 1.4); G.star.material.opacity = starOp; G.star.material.rotation = ts * 1.5;
    var ru = seg(ts, C, C + 0.32, 'outC');
    G.ring.visible = imp && ru < 1; G.ring.position.copy(S.contactPt); G.ring.scale.setScalar(0.08 + 1.4 * ru); G.ring.material.opacity = 0.8 * (1 - ru);
    return hp;
  }
  function renderShot(t) {
    var ts = sceneTime(t);
    var hp = renderCourt(ts, t);
    var cam, shake = 0;
    var imp = ts >= T.contact;
    if (imp) shake = (1 - seg(t, 3.525, 3.85, 'lin')) * 0.05;
    if (t < T.shotB) {                                   // A: wide, the toss goes up
      cam = G.cams[0];
      var pa = seg(t, 0, T.shotB, 'inOutQ');
      cam.position.set(-1.6 - 0.4 * pa, 2.7 - 0.2 * pa, 10.6 - 0.9 * pa);
      cam.lookAt(-2.3, 1.9 + 0.2 * pa, 2.8);
    } else if (t < T.shotC) {                            // B: low camera chasing the approach
      cam = G.cams[1];
      var lagPos = onPath(hitterDist(ts - 0.06));
      var camY = 0.75 + 0.35 * seg(ts, T.takeoff, T.peak, 'outQ');
      cam.position.set(lagPos.x - PD.x * 2.3 + PN.x * 1.05, camY, lagPos.z - PD.z * 2.3 + PN.z * 1.05);
      cam.lookAt(hp.x + PD.x * 0.6, hp.y + 0.45, hp.z + PD.z * 0.6);
    } else if (t < T.cut) {                              // C: from across the net, looking up as he rises
      cam = G.cams[2];
      var o = seg(t, T.shotC, T.cut, 'inOutQ');
      cam.position.set(1.9 - 0.6 * o + Math.sin(t * 120) * shake, 0.7 + 0.25 * o + Math.cos(t * 97) * shake, 5.3 - 0.9 * o);
      cam.lookAt(hp.x, hp.y + 0.35, hp.z + 0.55);
      cam.fov = (S.w / S.h < 1 ? 68 : 44) - 6 * seg(t, T.shotC, 3.465, 'inOutQ'); cam.updateProjectionMatrix();
    } else {                                             // D: the receiver's view; the ball comes at the camera
      cam = G.cams[3];
      hideFx();
      var t2 = t - T.cut;
      var camPos = v3(4.3, 1.0, 2.6);
      cam.position.copy(camPos).add(v3(Math.sin(t2 * 9) * 0.012, Math.cos(t2 * 7) * 0.01, 0));
      var u = clamp01(t2 / T.flight), e = u * u * (3 - 2 * u);
      var target = camPos.clone().add(v3(-0.02, 0.02, 0));
      var bpos = S.contactPt.clone().lerp(target, Math.min(0.94, e));
      G.ball.visible = true; G.ball.position.copy(bpos); G.ball.rotation.set(t2 * 6, 0, -t2 * 14);
      cam.lookAt(S.contactPt.x, S.contactPt.y - 0.3, S.contactPt.z);
      G.renderer.render(G.scene, cam);
      tmpV = tmpV || new THREE.Vector3();
      tmpV.copy(bpos).project(cam);
      var bx = (tmpV.x * 0.5 + 0.5) * 1600, by = (0.5 - tmpV.y * 0.5) * 900;
      var dist = bpos.distanceTo(cam.position), inner = Math.min(900, 40 + 80 / Math.max(0.05, dist));
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
      return;
    }
    G.ring.lookAt(cam.position);
    dom.rays.style.opacity = 0;
    G.renderer.render(G.scene, cam);
  }
  var BEATS_DEFAULT = ['Open toss', 'Approach', 'Spike'];
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
    var arr = G.dust.geometry.attributes.position.array;
    for (var i = 1; i < arr.length; i += 3) { arr[i] += 0.0006; if (arr[i] > 5) arr[i] = 0; }
    G.dust.geometry.attributes.position.needsUpdate = true;
    renderShot(t);
    G.renderer.domElement.style.opacity = seg(t, 0, T.fadeIn, 'outQ').toFixed(2);
    var C = 3.525; // real-time moment of contact
    var f1 = t >= C ? (t < C + 0.05 ? seg(t, C, C + 0.05, 'outQ') * 0.85 : 0.85 * (1 - seg(t, C + 0.05, C + 0.3, 'outQ'))) : 0;
    var hit = T.cut + T.fadeAt;
    var f2 = t >= hit - 0.03 ? (t < hit ? seg(t, hit - 0.03, hit, 'lin') : 1 - seg(t, hit, hit + 0.35, 'outQ')) : 0;
    var f3 = t >= T.cut - 0.02 && t < T.cut + 0.08 ? 0.35 * (1 - seg(t, T.cut, T.cut + 0.08, 'outQ')) : 0;
    dom.flash.style.opacity = Math.max(f1, f2 * 0.95, f3).toFixed(2);
    var ts = sceneTime(t);
    setBeat(ts < T.passStart + 0.3 ? -1 : ts < T.runStart + 0.15 ? 0 : ts < T.takeoff + 0.1 ? 1 : 2);
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
  /** Debug/preview: show the frame at real time t (seconds) and pause. */
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
  return { play: play, finish: finish, seek: seek, supported: supported, T: T, sceneTime: sceneTime };
})();
