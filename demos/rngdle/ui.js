/* ui.js — draws the game and reacts to clicks. Reads config.js, uses engine.js for the maths and storage.js for saving.
   Views: play (the roll), leaderboard, badges (the catalogue), profile, about. index.html?embed=1 shows only "play" in a compact layout. */
(function () {
  'use strict';
  var CFG = window.RNGDLE_CONFIG, E = window.RNG_ENGINE, B = window.RNG_BADGES, ST = window.RNG_STORAGE;
  var params = new URLSearchParams(location.search);
  var EMBED = params.get('embed') === '1';
  var MODE = EMBED ? (CFG.embedMode || 'free') : (CFG.mode || 'daily');
  var S = { rarity: null, backend: null, view: params.get('view') || 'play', result: null, practice: false, lbRange: 'today', busy: false, lb: null, best: null, rollsToday: null };
  var $top = document.getElementById('top'), $main = document.getElementById('main'), $toast = document.getElementById('toast');

  /* ---------- theme & accent ---------- */
  var theme = params.get('theme') || (function () { try { return localStorage.getItem('rngdle.theme'); } catch (e) { return null; } })() || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  function applyTheme(t) { theme = t; document.documentElement.setAttribute('data-theme', t); try { localStorage.setItem('rngdle.theme', t); } catch (e) { /* ignore */ } }
  applyTheme(theme);
  if (CFG.theme) { if (CFG.theme.accent) document.documentElement.style.setProperty('--accent', theme === 'dark' ? CFG.theme.accent : (CFG.theme.accentLight || '')); if (CFG.theme.accent2) document.documentElement.style.setProperty('--accent-2', theme === 'dark' ? CFG.theme.accent2 : (CFG.theme.accent2Light || '')); }
  if (EMBED) document.body.classList.add('embed');
  document.title = CFG.title || 'RNGdle';

  /* ---------- helpers ---------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function fmt(n) { return (n || 0).toLocaleString(); }
  function pct(share) { var p = share * 100; return p < 1 ? 'top ' + p.toFixed(1).replace(/\.0$/, '') + '%' : p >= 99 ? 'bottom 1%' : 'top ' + Math.round(p) + '%'; }
  function toast(msg) { $toast.textContent = msg; $toast.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(function () { $toast.classList.remove('show'); }, 1800); }
  function el(html) { var t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
  function tierHtml(tier, share) { return tier ? '<span class="tierpill tier-' + tier.id + '"><span class="t">' + esc(tier.name) + '</span>' + (share != null ? '<span class="pct">' + pct(share) + '</span>' : '') + '</span>' : ''; }
  function badgeById(id) { for (var i = 0; i < B.BADGES.length; i++) if (B.BADGES[i].id === id) return B.BADGES[i]; return null; }
  function analyzeStored(r) { return E.analyze(r.n, S.rarity, CFG); }
  function countedRolls() { return S.backend.rolls(); }
  function todayRoll() { var d = ST.dayKey(); var rs = countedRolls(); for (var i = rs.length - 1; i >= 0; i--) if (rs[i].date === d) return rs[i]; return null; }
  function canCount() { return MODE === 'free' || !todayRoll(); }
  function nextMidnight() { var d = new Date(); d.setHours(24, 0, 0, 0); return d; }
  function hms(ms) { var s = Math.max(0, Math.floor(ms / 1000)); return Math.floor(s / 3600) + 'h ' + String(Math.floor(s / 60) % 60).padStart(2, '0') + 'm ' + String(s % 60).padStart(2, '0') + 's'; }
  function earnedSet() { var set = {}; countedRolls().forEach(function (r) { (r.badges || []).forEach(function (id) { set[id] = 1; }); }); return set; }
  function chipHtml(b, i, src) { return '<button type="button" class="chip tier-' + (b.tier ? b.tier.id : 'common') + '" style="animation-delay:' + (i * 55) + 'ms" data-badge="' + esc(b.id) + '" data-src="' + (src || 'def') + '" title="' + esc(b.description) + '"><span>' + esc(b.emoji) + '</span><span class="name">' + esc(b.name) + '</span><span class="epv">+' + fmt(b.ep) + '</span></button>'; }

  /* ---------- header ---------- */
  function renderTop() {
    var title = esc(CFG.title || 'RNGdle');
    if (EMBED) {
      $top.innerHTML = '<a class="brand" href="index.html" target="_blank" rel="noopener">' + title + '<span class="dot">.</span></a>' +
        '<nav class="nav"><a href="index.html" target="_blank" rel="noopener">Full game ↗</a></nav>';
      return;
    }
    var views = [['play', 'Play'], ['leaderboard', 'Leaderboard'], ['badges', 'Badges'], ['profile', 'Profile'], ['about', 'About']];
    $top.innerHTML = '<a class="brand" href="index.html">' + title + '<span class="dot">.</span></a>' +
      '<nav class="nav">' + views.map(function (v) { return '<button type="button" data-view="' + v[0] + '"' + (S.view === v[0] ? ' class="active"' : '') + '>' + v[1] + '</button>'; }).join('') + '</nav>' +
      '<button class="icon-btn" id="theme-btn" type="button" title="Light / dark"><svg class="icon-sun" viewBox="0 0 24 24" width="18" height="18"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg><svg class="icon-moon" viewBox="0 0 24 24" width="18" height="18"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button>';
    $top.querySelectorAll('[data-view]').forEach(function (b) { b.addEventListener('click', function () { S.view = b.dataset.view; render(); }); });
    $top.querySelector('#theme-btn').addEventListener('click', function () { applyTheme(theme === 'dark' ? 'light' : 'dark'); });
  }

  /* ---------- play view ---------- */
  function tilesHtml(digits, cls) {
    return '<div class="tiles' + (cls ? ' ' + cls : '') + '" id="tiles">' + digits.map(function (d) { return '<span class="tile' + (d === '?' ? ' empty' : '') + '">' + d + '</span>'; }).join('') + '</div>';
  }
  function viewPlay() {
    var counted = todayRoll();
    if (!S.result && counted) { S.result = analyzeStored(counted); S.practice = false; }
    var digits = S.result ? S.result.s.split('') : ['?', '?', '?', '?', '?', '?'];
    var canRoll = canCount();
    var label = MODE === 'free' ? 'Roll' : canRoll ? "Roll today's number" : 'Practice roll';
    var html = '<section class="card"><div class="stage">' +
      tilesHtml(digits, S.result ? 'tier-' + S.result.tier.id : '') +
      (S.result ? '' : '<p class="tagline">' + esc(CFG.tagline || '') + '</p>') +
      '<div class="row" style="justify-content:center"><button class="roll-btn' + (canRoll ? '' : ' practice') + '" id="roll-btn" type="button">' + label + '</button></div>' +
      (MODE === 'daily' && !canRoll ? '<div class="countdown">Next counted roll in <b id="countdown"></b></div>' : '') +
      (MODE === 'daily' && canRoll && !EMBED ? '<div class="note">One counted roll per day. Practice rolls are free but do not count.</div>' : '') +
      '<div class="result" id="result"></div>' +
      '</div></section>' +
      (EMBED ? '' : '<section class="card" id="today-best"><h2>Today’s best roll</h2><div class="muted small">Loading…</div></section>') +
      '<section class="two">' + listsHtml() + '</section>' +
      (EMBED ? '<p class="foot">' + esc(CFG.title || 'RNGdle') + ' · <a href="index.html" target="_blank" rel="noopener">leaderboards, badges &amp; profile ↗</a></p>' : '');
    $main.innerHTML = html;
    document.getElementById('roll-btn').addEventListener('click', function () { doRoll(canCount()); });
    if (S.result) renderResult(false);
    tickCountdown();
    if (!EMBED) loadTodayBest();
  }
  function listsHtml() {
    var rs = countedRolls().slice();
    if (!rs.length) return '<section class="card"><h2>Your best 5</h2><div class="empty">No counted rolls yet.</div></section><section class="card"><h2>Your worst 5</h2><div class="empty">Roll to find out.</div></section>';
    var best = rs.slice().sort(function (a, b) { return b.ep - a.ep; }).slice(0, 5);
    var worst = rs.slice().sort(function (a, b) { return a.ep - b.ep; }).slice(0, 5);
    function li(list) { return '<div class="list">' + list.map(function (r, i) { return '<div class="li"><span class="rk">' + (i + 1) + '</span><span><span class="num">' + fmt(r.n) + '</span> <span class="tt tier-' + esc(r.tier) + '">' + esc(r.tier) + '</span></span><span class="ep2">' + fmt(r.ep) + ' EP</span></div>'; }).join('') + '</div>'; }
    return '<section class="card"><h2>Your best 5</h2>' + li(best) + '</section><section class="card"><h2>Your worst 5</h2>' + li(worst) + '</section>';
  }
  function renderResult(animate) {
    var a = S.result, box = document.getElementById('result');
    if (!a || !box) return;
    var chips = a.badges.map(function (b, i) { return chipHtml(b, i, 'roll'); }).join('');
    box.innerHTML = tierHtml(a.tier, a.topShare) +
      '<div class="ep" id="ep">' + (animate ? '0' : fmt(a.ep)) + '<small>EP</small></div>' +
      (S.practice ? '<div class="note">Practice roll — not saved, not on the leaderboard.</div>' : '') +
      '<div class="chips">' + (chips || '<span class="note">No badges. It happens.</span>') + '</div>' +
      '<div class="actions"><button class="btn" id="share-btn" type="button">Share</button>' + (EMBED ? '' : '<button class="btn" id="detail-btn" type="button">' + (S.showDetail ? 'Hide breakdown' : 'Badge breakdown') + '</button>') + '</div>' +
      (!EMBED && S.showDetail ? '<div class="breakdown" id="breakdown">' + a.badges.map(bcardHtml).join('') + '</div>' : '');
    document.getElementById('share-btn').addEventListener('click', share);
    var db = document.getElementById('detail-btn'); if (db) db.addEventListener('click', function () { S.showDetail = !S.showDetail; renderResult(false); });
    box.querySelectorAll('.bcard').forEach(function (c) {
      var idx = (c.dataset.hl || '').split(',').filter(Boolean).map(Number);
      c.addEventListener('mouseenter', function () { hot(idx, true); }); c.addEventListener('mouseleave', function () { hot(idx, false); });
    });
    if (animate) countUp(document.getElementById('ep'), a.ep);
  }
  function bcardHtml(b, i) {
    var digits = S.result.s.split('');
    return '<div class="bcard" data-hl="' + b.highlight.join(',') + '" data-badge="' + esc(b.id) + '" data-src="roll" role="button" tabindex="0" style="animation-delay:' + (i * 60) + 'ms"><div class="bhead"><span class="emoji">' + esc(b.emoji) + '</span><span class="name">' + esc(b.name) + '</span>' +
      (b.tier ? '<span class="tier tier-' + b.tier.id + '">' + esc(b.tier.name) + '</span>' : '') + '<span class="bep">+' + fmt(b.ep) + ' EP</span></div>' +
      '<div class="bdesc">' + esc(b.description) + '</div>' +
      '<div class="bdigits">' + digits.map(function (d, j) { return '<span' + (b.highlight.indexOf(j) >= 0 ? ' class="on"' : '') + '>' + d + '</span>'; }).join('') + (b.detail ? '<span class="detail' + (b.detail.length > 14 ? ' long' : '') + '">' + esc(b.detail) + '</span>' : '') + '</div></div>';
  }
  function hot(idx, on) { var tiles = document.querySelectorAll('#tiles .tile'); idx.forEach(function (i) { if (tiles[i]) tiles[i].classList.toggle('hot', on); }); }
  function countUp(elm, to) {
    var start = performance.now(), dur = 900;
    (function tick(now) { var u = Math.min(1, (now - start) / dur), e = 1 - Math.pow(1 - u, 3); elm.firstChild.nodeValue = fmt(Math.round(to * e)); if (u < 1) requestAnimationFrame(tick); })(start);
  }
  function tickCountdown() {
    var c = document.getElementById('countdown'); if (!c) return;
    c.textContent = hms(nextMidnight() - Date.now());
    clearTimeout(tickCountdown.t); tickCountdown.t = setTimeout(tickCountdown, 1000);
  }
  function share() {
    var a = S.result; if (!a) return;
    var text = (CFG.title || 'RNGdle') + ' · ' + fmt(a.n) + ' · ' + a.tier.name.toUpperCase() + ' (' + pct(a.topShare) + ') · ' + fmt(a.ep) + ' EP\n' + a.badges.slice(0, 8).map(function (b) { return b.emoji + ' ' + b.name; }).join(' · ') + (a.badges.length > 8 ? ' +' + (a.badges.length - 8) + ' more' : '');
    var done = function () { toast('Copied to clipboard'); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, function () { window.prompt('Copy your roll:', text); });
    else window.prompt('Copy your roll:', text);
  }

  /* ---------- the roll ---------- */
  function doRoll(counted) {
    if (S.busy) return;
    S.busy = true;
    var n = E.randomInt(CFG.max), a = E.analyze(n, S.rarity, CFG);
    var digits = a.s.split(''), tilesBox = document.getElementById('tiles'), btn = document.getElementById('roll-btn');
    btn.disabled = true;
    document.getElementById('result').innerHTML = '';
    var q = document.querySelector('.tagline'); if (q) q.remove();
    tilesBox.className = 'tiles';
    tilesBox.innerHTML = digits.map(function () { return '<span class="tile spin">0</span>'; }).join('');
    var tiles = tilesBox.querySelectorAll('.tile');
    var spins = 0, spinTimer = setInterval(function () {
      tiles.forEach(function (t) { if (t.classList.contains('spin')) t.textContent = Math.floor(Math.random() * 10); });
      spins++;
    }, 60);
    var reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(function () {
      var i = 0;
      (function reveal() {
        if (i >= tiles.length) { clearInterval(spinTimer); return finish(); }
        tiles[i].classList.remove('spin'); tiles[i].classList.add('reveal'); tiles[i].textContent = digits[i]; i++;
        setTimeout(reveal, reduced ? 0 : 150);
      })();
    }, reduced ? 0 : 1100);
    function finish() {
      tilesBox.classList.add('tier-' + a.tier.id);
      S.result = a; S.practice = !counted; S.showDetail = false;
      renderResult(true);
      if (counted) {
        var record = { n: n, ep: a.ep, tier: a.tier.id, topShare: a.topShare, badges: a.badges.map(function (b) { return b.id; }), date: ST.dayKey(), ts: Date.now() };
        S.backend.submitRoll(record).catch(function () { toast('Saved locally; shared leaderboard unreachable'); });
        var two = document.querySelector('.two'); if (two) two.outerHTML = '<section class="two">' + listsHtml() + '</section>';
        if (!EMBED) loadTodayBest();
      }
      btn.disabled = false;
      if (MODE === 'daily' && !canCount()) { btn.textContent = 'Practice roll'; btn.classList.add('practice'); if (!document.getElementById('countdown')) { btn.parentNode.insertAdjacentHTML('afterend', '<div class="countdown">Next counted roll in <b id="countdown"></b></div>'); tickCountdown(); } var note = document.querySelector('.stage > .note'); if (note) note.remove(); }
      S.busy = false;
    }
  }

  /* ---------- today's best ---------- */
  function loadTodayBest() {
    var box = document.getElementById('today-best'); if (!box) return;
    var day = ST.dayKey();
    Promise.all([S.backend.todayBest(day), S.backend.rollsToday(day)]).then(function (res) {
      var e = res[0], count = res[1];
      if (!e) { box.innerHTML = '<h2>Today’s best roll</h2><div class="empty">Nobody has rolled yet today. Be first.</div>'; return; }
      var a = E.analyze(e.n, S.rarity, CFG);
      S.bestAnalysis = a;
      box.innerHTML = '<h2>Today’s best roll</h2><div class="best-card"><span class="num">' + fmt(e.n) + '</span><span class="by">rolled by <b>' + esc(e.name) + (e.flair ? ' ' + esc(e.flair) : '') + '</b>' + (e.me ? ' (you!)' : '') + '</span>' +
        tierHtml(a.tier, a.topShare) + '<div class="chips">' + a.badges.slice(0, 7).map(function (b, i) { return chipHtml(b, i, 'best'); }).join('') + (a.badges.length > 7 ? '<span class="note">+' + (a.badges.length - 7) + ' more</span>' : '') + '</div>' +
        '<span class="ep">' + fmt(e.ep) + '<small>EP</small></span><span class="note">' + fmt(count) + ' rolls today' + (S.backend.kind === 'demo' ? ' · other players are simulated' : '') + '</span></div>';
    }).catch(function () { box.innerHTML = '<h2>Today’s best roll</h2><div class="empty">Leaderboard unavailable right now.</div>'; });
  }

  /* ---------- leaderboard ---------- */
  function viewLeaderboard() {
    var ranges = [['today', 'Today'], ['week', 'This week'], ['all', 'All-time'], ['lifetime', 'Lifetime EP'], ['badges', 'Most badges']];
    $main.innerHTML = '<section class="card"><h2>Leaderboard</h2><div class="tabs">' + ranges.map(function (r) { return '<button type="button" data-range="' + r[0] + '"' + (S.lbRange === r[0] ? ' class="active"' : '') + '>' + r[1] + '</button>'; }).join('') + '</div><div id="lb" class="muted small">Loading…</div>' +
      (S.backend.kind === 'demo' ? '<p class="note" style="margin-top:.8rem">Other players are simulated (config.js → backend: "demo"). Connect Firebase for a real shared board.</p>' : '') + '</section>';
    $main.querySelectorAll('[data-range]').forEach(function (b) { b.addEventListener('click', function () { S.lbRange = b.dataset.range; viewLeaderboard(); }); });
    S.backend.leaderboard(S.lbRange, CFG.leaderboardSize || 50).then(function (list) {
      var box = document.getElementById('lb'); if (!box) return;
      if (!list.length) { box.innerHTML = '<div class="empty">Nothing here yet.</div>'; return; }
      var medals = ['🥇', '🥈', '🥉'];
      box.className = 'tablewrap';
      box.innerHTML = '<table><thead><tr><th>#</th><th>Player</th><th>' + (S.lbRange === 'lifetime' ? 'Rolls' : S.lbRange === 'badges' ? 'Badges' : 'Number') + '</th><th>EP</th></tr></thead><tbody>' + list.map(function (e, i) {
        var t = e.n != null ? E.rollTier(E.topShare(e.ep, S.rarity.quantiles)) : null;
        return '<tr' + (e.me ? ' class="me"' : '') + '><td class="mono">' + (medals[i] || '#' + (i + 1)) + '</td><td><b>' + esc(e.name) + '</b>' + (e.flair ? '<span class="flair">' + esc(e.flair) + '</span>' : '') + (e.tagline ? '<span class="tag">' + esc(e.tagline) + '</span>' : '') + '</td>' +
          '<td class="num">' + (S.lbRange === 'badges' ? (e.badges || []).length + ' badges · ' + fmt(e.n) : e.n != null ? fmt(e.n) + (t ? ' <span class="tt tier-' + t.id + '" style="font-size:.58rem;letter-spacing:.1em;text-transform:uppercase">' + t.name + '</span>' : '') : fmt(e.rolls) + ' rolls') + '</td><td class="epc">' + fmt(e.ep) + ' EP</td></tr>';
      }).join('') + '</tbody></table>';
    }).catch(function () { var box = document.getElementById('lb'); if (box) box.innerHTML = '<div class="empty">Could not load the leaderboard.</div>'; });
  }

  /* ---------- badges catalogue ---------- */
  function viewBadges() {
    var earned = earnedSet(), total = 0, have = 0;
    var cats = {};
    B.BADGES.forEach(function (b) { var p = S.rarity.p[b.id]; if (!(p > 0)) return; total++; if (earned[b.id]) have++; (cats[b.category] = cats[b.category] || []).push(b); });
    var html = '<section class="card"><h2>Badge catalogue</h2><p class="muted small">You have earned <b>' + have + '</b> of <b>' + total + '</b> badges. Rarity is the share of all ' + fmt(CFG.max + 1) + ' possible rolls that earn the badge; EP is ' + (CFG.epPerProbability || 100) + ' ÷ that share.</p><div class="catalogue">' +
      Object.keys(cats).map(function (c) {
        var list = cats[c].slice().sort(function (a, b) { return S.rarity.p[a.id] - S.rarity.p[b.id]; });
        return '<div class="cat"><h3>' + esc(c) + '</h3><p class="cd">' + esc(B.CATEGORIES[c] || '') + '</p><div class="grid">' + list.map(function (b) {
          var p = S.rarity.p[b.id], t = E.badgeTier(p);
          return '<button type="button" class="bmini' + (earned[b.id] ? ' earned' : '') + '" data-badge="' + esc(b.id) + '" data-src="def" title="' + esc(b.description) + '"><span class="e">' + esc(b.emoji) + '</span><span><span class="n">' + esc(b.name) + (earned[b.id] ? ' ✓' : '') + '</span><br><span class="d">' + esc(b.description) + '</span></span><span class="r tier-' + t.id + '">' + t.name + '<b>' + fmt(E.epFor(p, CFG)) + ' EP</b></span></button>';
        }).join('') + '</div></div>';
      }).join('') + '</div></section>';
    $main.innerHTML = html;
  }

  /* ---------- profile ---------- */
  function viewProfile() {
    var p = S.backend.profile(), rs = countedRolls(), earned = Object.keys(earnedSet()).length;
    var days = {}; rs.forEach(function (r) { days[r.date] = 1; });   // a set of dates with a roll
    var streak = 0, d = new Date();
    while (days[ST.dayKey(d)]) { streak++; d.setDate(d.getDate() - 1); }  // walk back day by day

    var best = rs.slice().sort(function (a, b) { return b.ep - a.ep; })[0];
    $main.innerHTML = '<section class="card"><h2>Profile</h2><div class="stack">' +
      '<div class="two"><div class="field"><label for="p-name">Name</label><input id="p-name" maxlength="24" value="' + esc(p.name) + '"></div><div class="field"><label for="p-flair">Flair (an emoji or two)</label><input id="p-flair" maxlength="8" value="' + esc(p.flair || '') + '"></div></div>' +
      '<div class="field"><label for="p-tag">Tagline</label><input id="p-tag" maxlength="60" value="' + esc(p.tagline || '') + '" placeholder="shown on the leaderboard"></div>' +
      '<div class="row"><button class="btn primary" id="p-save" type="button">Save</button><span class="note">' + (S.backend.kind === 'firebase' ? 'Shared with everyone on the leaderboard.' : 'Stored in this browser.') + '</span></div></div></section>' +
      '<section class="card"><h2>Stats</h2><div class="stats"><div class="stat"><span class="k">Counted rolls</span><div class="v">' + fmt(rs.length) + '</div></div><div class="stat"><span class="k">Lifetime EP</span><div class="v">' + fmt(S.backend.lifetimeEp()) + '</div></div><div class="stat"><span class="k">Best roll</span><div class="v">' + (best ? fmt(best.n) : '—') + '</div></div><div class="stat"><span class="k">Badges earned</span><div class="v">' + earned + '</div></div><div class="stat"><span class="k">Streak</span><div class="v">' + streak + ' day' + (streak === 1 ? '' : 's') + '</div></div></div></section>' +
      '<section class="two">' + listsHtml() + '</section>' +
      '<section class="card"><h2>History</h2>' + (rs.length ? '<div class="tablewrap"><table><thead><tr><th>Date</th><th>Number</th><th>Rarity</th><th>EP</th></tr></thead><tbody>' + rs.slice().reverse().slice(0, 30).map(function (r) { return '<tr><td class="mono small">' + esc(r.date) + '</td><td class="num">' + fmt(r.n) + '</td><td><span class="tt tier-' + esc(r.tier) + '">' + esc(r.tier) + '</span></td><td class="epc">' + fmt(r.ep) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<div class="empty">No counted rolls yet.</div>') +
      '<div class="row" style="margin-top:.8rem"><button class="btn" id="p-reset" type="button">Reset my rolls</button></div></section>';
    document.getElementById('p-save').addEventListener('click', function () {
      S.backend.saveProfile({ name: document.getElementById('p-name').value.trim() || 'You', flair: document.getElementById('p-flair').value.trim(), tagline: document.getElementById('p-tag').value.trim() }).then(function () { toast('Profile saved'); }, function () { toast('Saved locally only'); });
    });
    document.getElementById('p-reset').addEventListener('click', function () { if (confirm('Delete all your rolls in this browser?')) { S.backend.reset(); S.result = null; toast('Rolls cleared'); viewProfile(); } });
  }

  /* ---------- about ---------- */
  function viewAbout() {
    $main.innerHTML = '<section class="card"><h2>What is ' + esc(CFG.title || 'RNGdle') + '?</h2><div class="stack small">' +
      '<p>A daily random number game. Each day you get one roll: a whole number from 0 to ' + fmt(CFG.max) + '. The number is analysed for patterns and properties; every one it has earns a badge and EP (entropy points). Rarer properties are worth more.</p>' +
      '<p><b>Badge rarity</b> is the share of all possible rolls that earn the badge, and EP is ' + (CFG.epPerProbability || 100) + ' divided by that share, so a badge that 1% of rolls earn is worth ' + fmt((CFG.epPerProbability || 100) * 100) + ' EP.</p>' +
      '<div class="tablewrap"><table><thead><tr><th>Badge tier</th><th>Share of rolls</th></tr></thead><tbody>' + E.BADGE_TIERS.map(function (t) { return '<tr><td class="tt tier-' + t.id + '">' + t.name + '</td><td class="small">' + t.blurb + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p><b>Roll rarity</b> ranks your total EP against every possible roll:</p>' +
      '<div class="tablewrap"><table><thead><tr><th>Roll tier</th><th>Rank</th></tr></thead><tbody>' + E.ROLL_TIERS.map(function (t, i) { var prev = i ? E.ROLL_TIERS[i - 1].top : 0; return '<tr><td class="tt tier-' + t.id + '">' + t.name + '</td><td class="small">' + (t.id === 'trash' ? 'bottom 1%' : 'top ' + Math.round(prev * 100) + '–' + Math.round(t.top * 100) + '%') + '</td></tr>'; }).join('') + '</tbody></table></div>' +
      '<p class="muted">' + B.BADGES.length + ' badges. Median roll: ' + fmt(S.rarity.quantiles[500]) + ' EP. Best possible roll: ' + (S.rarity.bestRoll ? fmt(S.rarity.bestRoll.n) + ' (' + fmt(S.rarity.bestRoll.ep) + ' EP)' : '—') + '.' + (S.rarity.estimated ? ' Rarities are estimated from ' + fmt(S.rarity.samples) + ' samples; run tools/compute-rarity.js for exact values.' : '') + '</p>' +
      '</div></section>';
  }

  /* ---------- badge popover: click any badge chip or card to read about it ---------- */
  var pop = null;
  function ensurePop() {
    if (pop) return pop;
    var back = document.createElement('div'); back.className = 'pop-back'; back.id = 'pop-back';
    back.innerHTML = '<div class="pop" role="dialog" aria-modal="true" aria-labelledby="pop-title" id="pop"></div>';
    document.body.appendChild(back);
    back.addEventListener('click', function (e) { if (e.target === back) closePop(); });
    pop = back;
    return pop;
  }
  function probText(p) {
    if (!(p > 0)) return 'no roll earns it';
    return p >= 0.01 ? (p * 100).toFixed(p >= 0.1 ? 0 : 1) + '% of rolls' : '1 in ' + fmt(Math.round(1 / p)) + ' rolls';
  }
  /** id = badge id; src = 'roll' (current roll), 'best' (today's best roll) or 'def' (just the definition). */
  function showBadge(id, src) {
    var def = badgeById(id); if (!def) return;
    var fromRoll = null, digits = null;
    if (src === 'roll' && S.result) { fromRoll = S.result.badges.filter(function (b) { return b.id === id; })[0]; digits = S.result.s.split(''); }
    if (src === 'best' && S.bestAnalysis) { fromRoll = S.bestAnalysis.badges.filter(function (b) { return b.id === id; })[0]; digits = S.bestAnalysis.s.split(''); }
    var p = S.rarity.p[id], tier = p > 0 ? E.badgeTier(p) : null, ep = E.epFor(p || 0, CFG);
    var earned = !!earnedSet()[id];
    var box = ensurePop().querySelector('#pop');
    box.innerHTML = '<div class="pop-head"><span class="pop-emoji">' + esc(def.emoji) + '</span><div><div class="pop-title" id="pop-title">' + esc(def.name) + '</div><div class="pop-cat">' + esc(def.category) + '</div></div><button type="button" class="pop-x" id="pop-x" aria-label="Close">×</button></div>' +
      '<div class="pop-row">' + (tier ? '<span class="tierpill tier-' + tier.id + '"><span class="t">' + tier.name + '</span></span>' : '') + '<span class="pop-ep">+' + fmt(ep) + ' EP</span><span class="pop-p">' + probText(p) + '</span></div>' +
      '<p class="pop-desc">' + esc(def.description) + '</p>' +
      (fromRoll && digits ? '<div class="bdigits">' + digits.map(function (d, j) { return '<span' + (fromRoll.highlight.indexOf(j) >= 0 ? ' class="on"' : '') + '>' + d + '</span>'; }).join('') + (fromRoll.detail ? '<span class="detail long">' + esc(fromRoll.detail) + '</span>' : '') + '</div>' : '') +
      '<div class="pop-foot">' + (earned ? '✓ In your collection' : 'Not in your collection yet') + '</div>';
    ensurePop().classList.add('show');
    var x = document.getElementById('pop-x'); x.addEventListener('click', closePop); x.focus();
  }
  function closePop() { if (pop) pop.classList.remove('show'); }
  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-badge]');
    if (t) { e.preventDefault(); showBadge(t.dataset.badge, t.dataset.src); }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') closePop();
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.bcard[data-badge]')) { e.preventDefault(); showBadge(e.target.dataset.badge, e.target.dataset.src); }
  });

  /* ---------- boot ---------- */
  function render() {
    renderTop();
    if (EMBED || S.view === 'play') viewPlay();
    else if (S.view === 'leaderboard') viewLeaderboard();
    else if (S.view === 'badges') viewBadges();
    else if (S.view === 'profile') viewProfile();
    else viewAbout();
  }
  function rarityKey() { var ids = B.BADGES.map(function (b) { return b.id; }).join('|'), h = 5381; for (var i = 0; i < ids.length; i++) h = ((h << 5) + h + ids.charCodeAt(i)) | 0; return 'rngdle.rarity.' + CFG.max + '.' + (CFG.epPerProbability || 100) + '.' + h; }
  function loadRarity(cb) {
    var r = window.RNG_RARITY;
    if (r && !E.isStale(r, CFG.max, CFG)) return cb(r);
    try { var c = JSON.parse(localStorage.getItem(rarityKey())); if (c && !E.isStale(c, CFG.max, CFG)) return cb(c); } catch (e) { /* ignore */ }
    $main.innerHTML = '<section class="card center"><h2>Calibrating badge rarity…</h2><p class="muted small">A badge changed, so the odds are being estimated. This happens once. For exact numbers run <code>node tools/compute-rarity.js</code>.</p><div class="progress" style="margin:0 auto"><i id="prog" style="width:0%"></i></div></section>';
    E.estimate(CFG.max, CFG, 120000, function (u) { var p = document.getElementById('prog'); if (p) p.style.width = (u * 100).toFixed(0) + '%'; }, function (res) { try { localStorage.setItem(rarityKey(), JSON.stringify(res)); } catch (e) { /* ignore */ } cb(res); });
  }
  renderTop();
  loadRarity(function (r) {
    S.rarity = r;
    S.backend = ST.create(CFG, function (n) { return E.analyze(n, r, CFG); });
    if (S.backend.ready) S.backend.ready.catch(function () { toast('Shared leaderboard unavailable; playing offline'); });
    render();
  });
})();
