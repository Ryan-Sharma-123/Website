/* storage.js — where rolls, profiles and leaderboards live. Three backends with the same interface:
     local    : this browser only (localStorage)
     demo     : local + simulated other players, so leaderboards look alive without any setup
     firebase : shared across everyone, using a free Firebase Realtime Database (see README)
   Every method returns a Promise so the UI does not care which one is active. */
(function (root) {
  'use strict';
  var KEY = 'rngdle.v1';

  /* ---------- small helpers ---------- */
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); }
  function daysAgo(k) { var d = new Date(); d.setDate(d.getDate() - k); return dayKey(d); }
  function lastDays(n) { var a = []; for (var i = 0; i < n; i++) a.push(daysAgo(i)); return a; }
  function load() { try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch (e) { return {}; } }
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode: play without saving */ } }
  function uid() { var a = 'abcdefghijklmnopqrstuvwxyz0123456789', s = ''; for (var i = 0; i < 10; i++) s += a[Math.floor(Math.random() * 36)]; return s; }
  function bestOf(entries) { var best = null; entries.forEach(function (e) { if (!best || e.ep > best.ep) best = e; }); return best; }
  function sortDesc(list) { return list.sort(function (a, b) { return b.ep - a.ep || a.ts - b.ts; }); }

  /* ---------- local: this browser ---------- */
  function LocalBackend() {
    var state = load();
    if (!state.profile) { state.profile = { id: uid(), name: 'You', flair: '', tagline: '', createdAt: Date.now() }; }
    if (!state.rolls) state.rolls = [];
    save(state);
    this.kind = 'local';
    this.profile = function () { return state.profile; };
    this.rolls = function () { return state.rolls.slice(); };
    this.saveProfile = function (p) { state.profile = Object.assign(state.profile, p); save(state); return Promise.resolve(state.profile); };
    this.submitRoll = function (record) { state.rolls.push(record); save(state); return Promise.resolve(record); };
    this.myEntries = function (days) {
      var set = days ? {} : null; if (days) days.forEach(function (d) { set[d] = 1; });
      return state.rolls.filter(function (r) { return !set || set[r.date]; }).map(function (r) {
        return { id: state.profile.id, name: state.profile.name, flair: state.profile.flair, tagline: state.profile.tagline, n: r.n, ep: r.ep, badges: r.badges, date: r.date, ts: r.ts, rolls: state.rolls.length, lifetimeEp: lifetime(), me: true };
      });
    };
    function lifetime() { return state.rolls.reduce(function (t, r) { return t + r.ep; }, 0); }
    this.lifetimeEp = lifetime;
    this.todayBest = function (day) { return Promise.resolve(bestOf(this.myEntries([day]))); };
    this.rollsToday = function (day) { return Promise.resolve(state.rolls.filter(function (r) { return r.date === day; }).length); };
    this.leaderboard = function (range, limit) {
      var mine = this.myEntries(range === 'today' ? [dayKey()] : range === 'week' ? lastDays(7) : null);
      var entry = bestOf(mine);
      if (range === 'lifetime' && state.rolls.length) entry = Object.assign({}, mine[0] || {}, { ep: lifetime(), n: null });
      if (range === 'badges') { var mostB = bestOf(mine.map(function (e) { return Object.assign({}, e, { ep: (e.badges || []).length }); })); entry = mostB && mine.filter(function (e) { return e.n === mostB.n && e.date === mostB.date; })[0]; }
      return Promise.resolve(entry ? [entry] : []);
    };
    this.reset = function () { state = { profile: state.profile, rolls: [] }; save(state); };
  }

  /* ---------- demo: local + simulated players ---------- */
  var BOT_NAMES = ['kageyama_sets', 'spike_owl', 'zero_division', 'lofi_larry', 'primehunter', 'glider_gun', 'midnight_toss', 'tanaka_senpai', 'digit_diver', 'sigma_sum',
    'quiet_libero', 'noya_rolling', 'bishop_pair', 'mod_squad', 'palin_dromedary', 'seven_seas', 'gaussian_blur', 'en_passant', 'freak_quick', 'nishinoya_dive',
    'entropy_enjoyer', 'bit_flipper', 'court_vision', 'monotone_max', 'zugzwang', 'ace_serve', 'lucky_lucy', 'harshad_h', 'block_party', 'the_rolling_stone',
    'dp_notes', 'backrow_ben', 'fibonacci_fan', 'tsukki_block', 'set_and_forget', 'chip_tune', 'valley_girl', 'euler_id', 'openspike', 'net_zero'];
  var BOT_FLAIRS = ['🏐', '🏀', '♞', '🎮', '✦', '∑', '🍀', '💎', '🎰', '🐝', '', '', '', '🔥', '🧊', '🌙', '⚡', '🐚', '🧠', '🥧'];
  var BOT_TAGLINES = ['gaze into them', 'growth', 'intricately lucky!!', 'almost seven', 'is this golden?', 'found my sky', 'echo again again again', 'perfect power play',
    'holy first high peak', 'up', 'climbing endlessly', 'quick attack enjoyer', 'e4 best by test', 'divide by zero', '', '', '', '', 'one roll one dream', 'math is cool'];
  function seeded(str) { // small deterministic PRNG from a string
    var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () { h += 0x6D2B79F5; var t = Math.imul(h ^ (h >>> 15), 1 | h); t ^= t + Math.imul(t ^ (t >>> 7), 61 | t); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function DemoBackend(cfg, analyzeFn) {
    var local = new LocalBackend();
    var n = cfg.demoPlayers || 40, max = cfg.max;
    var cache = {};
    function bots() {
      var list = [];
      for (var i = 0; i < n; i++) {
        var r = seeded('bot-' + i);
        list.push({ id: 'bot-' + i, name: BOT_NAMES[i % BOT_NAMES.length] + (i >= BOT_NAMES.length ? i : ''), flair: BOT_FLAIRS[Math.floor(r() * BOT_FLAIRS.length)], tagline: BOT_TAGLINES[Math.floor(r() * BOT_TAGLINES.length)], activity: 0.55 + r() * 0.45 });
      }
      return list;
    }
    function botRoll(bot, day) {
      var key = bot.id + ':' + day;
      if (cache[key] !== undefined) return cache[key];
      var r = seeded(key);
      if (r() > bot.activity) { cache[key] = null; return null; } // some bots skip days
      var num = Math.floor(r() * (max + 1));
      var a = analyzeFn(num);
      cache[key] = { id: bot.id, name: bot.name, flair: bot.flair, tagline: bot.tagline, n: num, ep: a.ep, badges: a.badges.map(function (b) { return b.id; }), date: day, ts: Date.parse(day + 'T12:00:00') + Math.floor(r() * 36000000) };
      return cache[key];
    }
    function botEntries(days) {
      var out = [];
      bots().forEach(function (b) { days.forEach(function (d) { var e = botRoll(b, d); if (e) out.push(e); }); });
      return out;
    }
    function perPlayerBest(entries) {
      var best = {}; entries.forEach(function (e) { if (!best[e.id] || e.ep > best[e.id].ep) best[e.id] = e; });
      return Object.keys(best).map(function (k) { return best[k]; });
    }
    this.kind = 'demo';
    this.profile = local.profile; this.rolls = local.rolls; this.saveProfile = local.saveProfile; this.submitRoll = local.submitRoll; this.lifetimeEp = local.lifetimeEp; this.reset = local.reset;
    this.todayBest = function (day) { return Promise.resolve(bestOf(botEntries([day]).concat(local.myEntries([day])))); };
    this.rollsToday = function (day) { return local.rollsToday(day).then(function (mine) { return mine + botEntries([day]).length + 1200 + Math.floor(seeded('count' + day)() * 900); }); };
    this.leaderboard = function (range, limit) {
      var days = range === 'today' ? [dayKey()] : range === 'week' ? lastDays(7) : lastDays(30);
      var entries = botEntries(days).concat(local.myEntries(range === 'lifetime' || range === 'all' ? null : days));
      if (range === 'lifetime') {
        var sums = {};
        entries.forEach(function (e) { if (!sums[e.id]) sums[e.id] = Object.assign({}, e, { ep: 0, n: null, rolls: 0 }); sums[e.id].ep += e.ep; sums[e.id].rolls++; });
        return Promise.resolve(sortDesc(Object.keys(sums).map(function (k) { return sums[k]; })).slice(0, limit));
      }
      if (range === 'badges') return Promise.resolve(perPlayerBest(entries).sort(function (a, b) { return (b.badges || []).length - (a.badges || []).length || b.ep - a.ep; }).slice(0, limit));
      return Promise.resolve(sortDesc(perPlayerBest(entries)).slice(0, limit));
    };
  }

  /* ---------- firebase: shared for real ---------- */
  function FirebaseBackend(cfg) {
    var local = new LocalBackend();   // still keeps your own rolls offline
    var db = null, me = null, ready;
    var self = this;
    this.kind = 'firebase';
    function loadScript(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = function () { rej(new Error('Could not load ' + src)); }; document.head.appendChild(s); }); }
    ready = (function () {
      var v = '10.12.5', base = 'https://www.gstatic.com/firebasejs/' + v + '/';
      return loadScript(base + 'firebase-app-compat.js').then(function () { return loadScript(base + 'firebase-auth-compat.js'); }).then(function () { return loadScript(base + 'firebase-database-compat.js'); })
        .then(function () {
          root.firebase.initializeApp(cfg.firebase);
          db = root.firebase.database();
          return root.firebase.auth().signInAnonymously();
        }).then(function (cred) {
          me = cred.user.uid;
          var p = local.profile(); p.id = me;
          return db.ref('players/' + me).once('value');
        }).then(function (snap) {
          var v2 = snap.val(); if (v2) local.saveProfile({ name: v2.name || 'You', flair: v2.flair || '', tagline: v2.tagline || '' });
          return db.ref('players/' + me).update({ name: local.profile().name, flair: local.profile().flair || '', tagline: local.profile().tagline || '' });
        });
    })();
    this.ready = ready;
    this.profile = local.profile; this.rolls = local.rolls; this.lifetimeEp = local.lifetimeEp; this.reset = local.reset;
    this.saveProfile = function (p) { local.saveProfile(p); return ready.then(function () { return db.ref('players/' + me).update({ name: p.name, flair: p.flair || '', tagline: p.tagline || '' }); }).then(function () { return local.profile(); }); };
    this.submitRoll = function (record) {
      local.submitRoll(record);
      var prof = local.profile();
      return ready.then(function () {
        var entry = { name: prof.name, flair: prof.flair || '', tagline: prof.tagline || '', n: record.n, ep: record.ep, badges: record.badges, ts: root.firebase.database.ServerValue.TIMESTAMP };
        var ops = [db.ref('rolls/' + record.date + '/' + me).set(entry)];
        ops.push(db.ref('players/' + me).transaction(function (cur) {
          cur = cur || {};
          cur.name = prof.name; cur.flair = prof.flair || ''; cur.tagline = prof.tagline || '';
          cur.lifetimeEp = (cur.lifetimeEp || 0) + record.ep; cur.rolls = (cur.rolls || 0) + 1;
          if (!cur.best || record.ep > cur.best.ep) cur.best = { n: record.n, ep: record.ep, badges: record.badges, date: record.date };
          return cur;
        }));
        return Promise.all(ops);
      }).then(function () { return record; });
    };
    function toEntries(obj, extra) {
      var out = []; Object.keys(obj || {}).forEach(function (k) { var v = obj[k]; out.push(Object.assign({ id: k, name: v.name, flair: v.flair, tagline: v.tagline, n: v.n, ep: v.ep || 0, badges: v.badges || [], ts: v.ts || 0, me: k === me }, extra ? extra(v) : {})); });
      return out;
    }
    this.todayBest = function (day) { return ready.then(function () { return db.ref('rolls/' + day).orderByChild('ep').limitToLast(1).once('value'); }).then(function (s) { var e = toEntries(s.val()); e.forEach(function (x) { x.date = day; }); return e[0] || null; }); };
    this.rollsToday = function (day) { return ready.then(function () { return db.ref('rolls/' + day).once('value'); }).then(function (s) { return s.numChildren(); }); };
    this.leaderboard = function (range, limit) {
      return ready.then(function () {
        if (range === 'today') return db.ref('rolls/' + dayKey()).orderByChild('ep').limitToLast(limit).once('value').then(function (s) { return sortDesc(toEntries(s.val())).map(function (e) { e.date = dayKey(); return e; }); });
        if (range === 'week') return Promise.all(lastDays(7).map(function (d) { return db.ref('rolls/' + d).orderByChild('ep').limitToLast(limit).once('value').then(function (s) { return toEntries(s.val()).map(function (e) { e.date = d; return e; }); }); }))
          .then(function (lists) { var all = [].concat.apply([], lists), best = {}; all.forEach(function (e) { if (!best[e.id] || e.ep > best[e.id].ep) best[e.id] = e; }); return sortDesc(Object.keys(best).map(function (k) { return best[k]; })).slice(0, limit); });
        if (range === 'lifetime') return db.ref('players').orderByChild('lifetimeEp').limitToLast(limit).once('value').then(function (s) { return sortDesc(toEntries(s.val(), function (v) { return { ep: v.lifetimeEp || 0, n: null, rolls: v.rolls || 0 }; })).slice(0, limit); });
        if (range === 'badges') return db.ref('players').orderByChild('best/ep').limitToLast(500).once('value').then(function (s) { return toEntries(s.val(), function (v) { var b = v.best || {}; return { n: b.n, ep: b.ep || 0, badges: b.badges || [], date: b.date, rolls: v.rolls || 0 }; }).sort(function (a, b) { return b.badges.length - a.badges.length || b.ep - a.ep; }).slice(0, limit); });
        return db.ref('players').orderByChild('best/ep').limitToLast(limit).once('value').then(function (s) { return sortDesc(toEntries(s.val(), function (v) { var b = v.best || {}; return { n: b.n, ep: b.ep || 0, badges: b.badges || [], date: b.date, rolls: v.rolls || 0 }; })).slice(0, limit); });
      });
    };
  }

  function create(cfg, analyzeFn) {
    if (cfg.backend === 'firebase' && cfg.firebase && cfg.firebase.databaseURL) return new FirebaseBackend(cfg);
    if (cfg.backend === 'local') return new LocalBackend();
    return new DemoBackend(cfg, analyzeFn);
  }
  root.RNG_STORAGE = { create: create, dayKey: dayKey, lastDays: lastDays, LocalBackend: LocalBackend, DemoBackend: DemoBackend, FirebaseBackend: FirebaseBackend };
})(window);
