/* engine.js — turns a number into badges, EP and a rarity.
   analyze(n) runs every badge test, looks up each badge's probability, converts it to EP
   (EP = epPerProbability / probability, so a 1-in-1000 badge is worth 100,000 EP when epPerProbability is 100),
   sums the EP and ranks the roll against every possible roll. Runs in the browser and in Node. */
(function (root, factory) {
  var isNode = typeof module !== 'undefined' && module.exports;
  var N = isNode ? require('./numbers.js') : root.RNG_NUM;
  var B = isNode ? require('./badges.js') : root.RNG_BADGES;
  var api = factory(N, B);
  if (isNode) module.exports = api;
  root.RNG_ENGINE = api;
})(typeof window !== 'undefined' ? window : globalThis, function (N, B) {
  'use strict';

  // Badge rarity by probability of a random roll earning it.
  var BADGE_TIERS = [
    { id: 'mythic', name: 'Mythic', max: 0.00001, blurb: 'fewer than 1 in 100,000 rolls' },
    { id: 'anomaly', name: 'Anomaly', max: 0.0001, blurb: '1 in 10,000 to 1 in 100,000' },
    { id: 'epic', name: 'Epic', max: 0.001, blurb: '1 in 1,000 to 1 in 10,000' },
    { id: 'rare', name: 'Rare', max: 0.01, blurb: '1 in 100 to 1 in 1,000' },
    { id: 'uncommon', name: 'Uncommon', max: 0.1, blurb: '1% to 10% of rolls' },
    { id: 'common', name: 'Common', max: 1.01, blurb: 'more than 10% of rolls' }
  ];
  // Roll rarity by how the roll's total EP ranks against every possible roll (top share).
  var ROLL_TIERS = [
    { id: 'mythic', name: 'Mythic', top: 0.01 },
    { id: 'anomaly', name: 'Anomaly', top: 0.05 },
    { id: 'epic', name: 'Epic', top: 0.10 },
    { id: 'rare', name: 'Rare', top: 0.25 },
    { id: 'uncommon', name: 'Uncommon', top: 0.50 },
    { id: 'common', name: 'Common', top: 0.99 },
    { id: 'trash', name: 'Trash', top: 1.01 }
  ];

  function context(n) {
    var s = String(n), d = N.digitsOf(n), counts = N.digitCounts(d);
    var distinct = 0; for (var i = 0; i < 10; i++) if (counts[i]) distinct++;
    return { n: n, s: s, d: d, len: s.length, counts: counts, sum: N.sum(d), product: N.product(d), distinct: distinct };
  }
  /** Which badges fire for n (no EP yet). Each hit: { badge, detail, highlight }. */
  function hits(n) {
    var x = context(n), out = [];
    for (var i = 0; i < B.BADGES.length; i++) {
      var b = B.BADGES[i], r;
      try { r = b.test(x); } catch (e) { r = false; }
      if (!r) continue;
      out.push({ badge: b, detail: (r && r.detail) || '', highlight: (r && r.highlight) || [] });
    }
    return out;
  }
  function badgeTier(p) { for (var i = 0; i < BADGE_TIERS.length; i++) if (p <= BADGE_TIERS[i].max) return BADGE_TIERS[i]; return BADGE_TIERS[BADGE_TIERS.length - 1]; }
  function rollTier(topShare) { for (var i = 0; i < ROLL_TIERS.length; i++) if (topShare <= ROLL_TIERS[i].top) return ROLL_TIERS[i]; return ROLL_TIERS[ROLL_TIERS.length - 1]; }
  function epFor(p, cfg) { return p > 0 ? Math.round((cfg.epPerProbability || 100) / p) : 0; }
  /** Share of all rolls with EP >= ep, from the sorted quantile table (1001 values). 0.13 means "top 13%". */
  function topShare(ep, quantiles) {
    if (!quantiles || !quantiles.length) return 0.5;
    var lo = 0, hi = quantiles.length - 1;
    while (lo < hi) { var mid = (lo + hi) >> 1; if (quantiles[mid] < ep) lo = mid + 1; else hi = mid; }
    // lo = first index whose value >= ep → fraction below ≈ lo/(len-1)
    var below = lo / (quantiles.length - 1);
    return Math.max(1 / 1000000, Math.min(1, 1 - below + 1 / (quantiles.length - 1)));
  }

  /** Full analysis of a roll. rarity = { p: {id: probability}, quantiles: [...] } (data/rarity.js or an estimate). */
  function analyze(n, rarity, cfg) {
    cfg = cfg || {}; rarity = rarity || { p: {}, quantiles: [] };
    var list = hits(n).map(function (h) {
      var p = rarity.p[h.badge.id];
      var known = typeof p === 'number' && p > 0;
      return { id: h.badge.id, name: h.badge.name, emoji: h.badge.emoji, category: h.badge.category, description: h.badge.description,
        detail: h.detail, highlight: h.highlight, p: known ? p : null, ep: known ? epFor(p, cfg) : 0, tier: known ? badgeTier(p) : null };
    });
    list.sort(function (a, b) { return b.ep - a.ep; });
    var ep = list.reduce(function (t, b) { return t + b.ep; }, 0);
    var share = topShare(ep, rarity.quantiles);
    return { n: n, s: String(n), badges: list, ep: ep, topShare: share, tier: rollTier(share) };
  }

  function randomInt(max) {
    var span = max + 1;
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      var a = new Uint32Array(1), limit = Math.floor(4294967296 / span) * span, v;
      do { crypto.getRandomValues(a); v = a[0]; } while (v >= limit);
      return v % span;
    }
    return Math.floor(Math.random() * span);
  }

  /** True when the rarity table is missing a badge (you added one and did not rerun the tool). */
  function isStale(rarity, max, cfg) {
    if (!rarity || !rarity.p || !rarity.quantiles || rarity.quantiles.length < 100) return true;
    if (rarity.max !== max || (rarity.epPerProbability || 100) !== (cfg.epPerProbability || 100)) return true;
    for (var i = 0; i < B.BADGES.length; i++) if (typeof rarity.p[B.BADGES[i].id] !== 'number') return true;
    return false;
  }
  /** Monte-Carlo estimate of every badge's probability and the EP quantiles, in chunks so the page stays responsive.
      onDone(rarity). Good enough for play; tools/compute-rarity.js gives exact numbers. */
  function estimate(max, cfg, samples, onProgress, onDone) {
    samples = samples || 120000;
    var counts = {}, i = 0, chunk = 4000, epsList = [];
    B.BADGES.forEach(function (b) { counts[b.id] = 0; });
    var seen = []; // badge id lists per sample, so EP can be computed once probabilities are known
    function step() {
      var end = Math.min(samples, i + chunk);
      for (; i < end; i++) {
        var ids = hits(randomInt(max)).map(function (h) { return h.badge.id; });
        ids.forEach(function (id) { counts[id]++; });
        seen.push(ids);
      }
      if (onProgress) onProgress(i / samples);
      if (i < samples) { setTimeout(step, 0); return; }
      var p = {};
      B.BADGES.forEach(function (b) { p[b.id] = counts[b.id] > 0 ? counts[b.id] / samples : 1 / (max + 1); });
      for (var k = 0; k < seen.length; k++) { var t = 0; for (var j = 0; j < seen[k].length; j++) t += epFor(p[seen[k][j]], cfg); epsList.push(t); }
      epsList.sort(function (a, b) { return a - b; });
      var q = []; for (var m = 0; m <= 1000; m++) q.push(epsList[Math.min(epsList.length - 1, Math.floor(m / 1000 * (epsList.length - 1)))]);
      onDone({ max: max, epPerProbability: cfg.epPerProbability || 100, estimated: true, samples: samples, p: p, quantiles: q });
    }
    step();
  }

  return { analyze: analyze, hits: hits, context: context, badgeTier: badgeTier, rollTier: rollTier, topShare: topShare, epFor: epFor, randomInt: randomInt, isStale: isStale, estimate: estimate, BADGE_TIERS: BADGE_TIERS, ROLL_TIERS: ROLL_TIERS };
});
