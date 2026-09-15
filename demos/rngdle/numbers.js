/* numbers.js — number-theory and digit-pattern helpers used by the badges.
   Pure functions, no browser APIs, so the same file runs in the browser and in Node (tools/compute-rarity.js).
   Everything takes either the number n or its digit string s / digit array d. */
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RNG_NUM = api;
})(typeof window !== 'undefined' ? window : globalThis, function () {
  'use strict';

  /* ---------- classic properties ---------- */
  function isPrime(n) {
    if (n < 2) return false;
    if (n < 4) return true;
    if (n % 2 === 0 || n % 3 === 0) return false;
    for (var i = 5; i * i <= n; i += 6) if (n % i === 0 || n % (i + 2) === 0) return false;
    return true;
  }
  function isSquare(n) { if (n < 0) return false; var r = Math.round(Math.sqrt(n)); return r * r === n; }
  function isCube(n) { var r = Math.round(Math.cbrt(n)); return r * r * r === n; }
  /** a^b with a >= 2, b >= 2. Returns { base, exp } or false. */
  function isPerfectPower(n) {
    if (n < 4) return false;
    for (var b = 20; b >= 2; b--) { // highest exponent first: 331776 reads as 24^4 rather than 576^2
      var a = Math.round(Math.pow(n, 1 / b));
      for (var c = a - 1; c <= a + 1; c++) if (c >= 2 && Math.pow(c, b) === n) return { base: c, exp: b };
    }
    return false;
  }
  /** Returns the exponent e if n = base^e with e >= 1, otherwise false. */
  function powerOf(base, n) {
    if (n < base) return false;
    var e = 0;
    while (n % base === 0) { n /= base; e++; }
    return n === 1 ? e : false;
  }
  function isFibonacci(n) { return isSquare(5 * n * n + 4) || isSquare(5 * n * n - 4); }
  function isTriangular(n) { return n > 0 && isSquare(8 * n + 1); }
  /** Returns k if n = k! (k >= 2), otherwise false. */
  function isFactorial(n) { var f = 1, k = 1; while (f < n) { k++; f *= k; } return f === n && k >= 2 ? k : false; }
  function isPronic(n) { var r = Math.floor(Math.sqrt(n)); return n > 0 && r * (r + 1) === n; }
  function isHarshad(n, digitSum) { return n > 0 && digitSum > 0 && n % digitSum === 0; }
  var CATALAN = [1, 1, 2, 5, 14, 42, 132, 429, 1430, 4862, 16796, 58786, 208012, 742900];
  function isCatalan(n) { return n > 1 && CATALAN.indexOf(n) >= 0; }
  function isMersenne(n) { return n >= 3 && powerOf(2, n + 1) !== false; }
  function isPerfectNumber(n) { return [6, 28, 496, 8128].indexOf(n) >= 0; }
  function isTwinPrime(n) { return isPrime(n) && (isPrime(n - 2) || isPrime(n + 2)); }
  function isEmirp(n) { if (!isPrime(n)) return false; var r = parseInt(String(n).split('').reverse().join(''), 10); return r !== n && isPrime(r); }
  function isAutomorphic(n) { var sq = String(n * n); return n > 1 && sq.slice(-String(n).length) === String(n); } // 25 → 625, 76 → 5776

  /* ---------- digits ---------- */
  function digitsOf(n) { return String(n).split('').map(Number); }
  function digitCounts(d) { var c = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0]; for (var i = 0; i < d.length; i++) c[d[i]]++; return c; }
  function sum(d) { var t = 0; for (var i = 0; i < d.length; i++) t += d[i]; return t; }
  function product(d) { var t = 1; for (var i = 0; i < d.length; i++) t *= d[i]; return t; }
  function isPalindrome(s) { return s.length > 1 && s === s.split('').reverse().join(''); }
  function isRepdigit(d) { if (d.length < 2) return false; for (var i = 1; i < d.length; i++) if (d[i] !== d[0]) return false; return true; }
  /** Longest run of the same digit: { digit, len, start }. */
  function longestRun(d) {
    var best = { digit: d[0], len: 1, start: 0 }, cur = 1;
    for (var i = 1; i < d.length; i++) {
      if (d[i] === d[i - 1]) { cur++; if (cur > best.len) best = { digit: d[i], len: cur, start: i - cur + 1 }; } else cur = 1;
    }
    return best;
  }
  /** Indices [start, start+k) where digits step by +1 (dir 1) or -1 (dir -1). Longest such run of length >= 2. */
  function longestStep(d, dir) {
    var best = { len: 1, start: 0 }, cur = 1;
    for (var i = 1; i < d.length; i++) {
      if (d[i] - d[i - 1] === dir) { cur++; if (cur > best.len) best = { len: cur, start: i - cur + 1 }; } else cur = 1;
    }
    return best;
  }
  function isMonotonic(d, dir) { if (d.length < 3) return false; for (var i = 1; i < d.length; i++) if ((d[i] - d[i - 1]) * dir <= 0) return false; return true; }
  /** 'peak' (rise then fall), 'valley' (fall then rise) or false; strict on both sides, at least one step each. Returns { type, at }. */
  function peakValley(d) {
    if (d.length < 3) return false;
    var i = 1;
    while (i < d.length && d[i] > d[i - 1]) i++;
    if (i > 1 && i < d.length) { var j = i; while (j < d.length && d[j] < d[j - 1]) j++; if (j === d.length) return { type: 'peak', at: i - 1 }; }
    i = 1;
    while (i < d.length && d[i] < d[i - 1]) i++;
    if (i > 1 && i < d.length) { var k = i; while (k < d.length && d[k] > d[k - 1]) k++; if (k === d.length) return { type: 'valley', at: i - 1 }; }
    return false;
  }
  function isZigzag(d) {
    if (d.length < 4) return false;
    for (var i = 1; i < d.length; i++) { var s = Math.sign(d[i] - d[i - 1]); if (s === 0) return false; if (i > 1 && s === Math.sign(d[i - 1] - d[i - 2])) return false; }
    return true;
  }
  function arithmeticDigits(d) { if (d.length < 3) return false; var diff = d[1] - d[0]; if (diff === 0) return false; for (var i = 2; i < d.length; i++) if (d[i] - d[i - 1] !== diff) return false; return diff; }
  function geometricDigits(d) { if (d.length < 3 || d[0] === 0) return false; if (d[1] % d[0] !== 0) return false; var r = d[1] / d[0]; if (r < 2) return false; for (var i = 2; i < d.length; i++) if (d[i] !== d[i - 1] * r) return false; return r; }
  /** Poker-style hand from the multiset of digit counts. */
  function pokerHand(counts) {
    var c = counts.filter(function (x) { return x > 0; }).sort(function (a, b) { return b - a; });
    if (c[0] === 6) return 'six-kind';
    if (c[0] === 5) return 'five-kind';
    if (c[0] === 4) return 'four-kind';
    if (c[0] === 3 && c[1] === 3) return 'two-triples';
    if (c[0] === 3 && c[1] === 2) return 'full-house';
    if (c[0] === 3) return 'three-kind';
    if (c[0] === 2 && c[1] === 2 && c[2] === 2) return 'three-pair';
    if (c[0] === 2 && c[1] === 2) return 'two-pair';
    if (c[0] === 2) return 'pair';
    return null;
  }
  /** All digits distinct and consecutive in value, any order (length >= 4). */
  function isStraight(d) {
    if (d.length < 4) return false;
    var s = d.slice().sort(function (a, b) { return a - b; });
    for (var i = 1; i < s.length; i++) if (s[i] - s[i - 1] !== 1) return false;
    return true;
  }
  /** Three adjacent digits that are consecutive values in any order (e.g. 3 2 4). Returns start index or -1. */
  function findScramble(d) {
    for (var i = 0; i + 2 < d.length; i++) {
      var t = [d[i], d[i + 1], d[i + 2]].sort(function (a, b) { return a - b; });
      if (t[1] - t[0] === 1 && t[2] - t[1] === 1 && !(d[i + 1] - d[i] === 1 && d[i + 2] - d[i + 1] === 1) && !(d[i] - d[i + 1] === 1 && d[i + 1] - d[i + 2] === 1)) return i;
    }
    return -1;
  }
  /** Adjacent digits whose values differ by exactly 1. Returns index or -1. */
  function findNeighbors(d) { for (var i = 1; i < d.length; i++) if (Math.abs(d[i] - d[i - 1]) === 1) return i - 1; return -1; }

  /* ---------- splits ---------- */
  function chunkOk(c) { return c.length === 1 || c[0] !== '0'; }
  /** Insert one of + − × ÷ and an = sign to make a true equation, e.g. 702347 → "70 − 23 = 47". Returns the string or false. */
  function findEquation(s) {
    var L = s.length;
    if (L < 3) return false;
    for (var i = 1; i < L - 1; i++) for (var j = i + 1; j < L; j++) {
      var A = s.slice(0, i), B = s.slice(i, j), C = s.slice(j);
      if (!chunkOk(A) || !chunkOk(B) || !chunkOk(C)) continue;
      var a = +A, b = +B, c = +C;
      if (a + b === c) return A + ' + ' + B + ' = ' + C;
      if (a - b === c) return A + ' − ' + B + ' = ' + C;
      if (a * b === c) return A + ' × ' + B + ' = ' + C;
      if (b !== 0 && a / b === c) return A + ' ÷ ' + B + ' = ' + C;
      if (b + c === a) return A + ' = ' + B + ' + ' + C;
      if (b - c === a) return A + ' = ' + B + ' − ' + C;
      if (b * c === a) return A + ' = ' + B + ' × ' + C;
      if (c !== 0 && b / c === a) return A + ' = ' + B + ' ÷ ' + C;
    }
    return false;
  }
  /** The digits are consecutive integers written together, e.g. 91011 → "9·10·11", 654 → "6·5·4". Returns the string or false. */
  function findCounting(s) {
    var L = s.length;
    for (var w = 1; w * 2 <= L; w++) {
      var first = s.slice(0, w);
      if (!chunkOk(first)) continue;
      for (var dir = 1; dir >= -1; dir -= 2) {
        var parts = [first], cur = +first, built = first;
        while (built.length < L) { cur += dir; if (cur < 0) break; var t = String(cur); parts.push(t); built += t; }
        if (built === s && parts.length >= 2) return parts.join('·');
      }
    }
    return false;
  }
  var CALC = { 0: 'O', 1: 'I', 2: 'Z', 3: 'E', 4: 'h', 5: 'S', 6: 'g', 7: 'L', 8: 'B', 9: 'G' };
  /** The number read upside-down on a calculator. */
  function calculatorText(s) { return s.split('').reverse().map(function (ch) { return CALC[ch]; }).join(''); }
  /** 3–4 digits as H:MM / HH:MM, 5–6 digits as H:MM:SS / HH:MM:SS. Returns the time string or false. */
  function asTime(s) {
    var L = s.length;
    if (L === 3 || L === 4) { var h = +s.slice(0, L - 2), m = +s.slice(L - 2); if (h <= 23 && m <= 59) return h + ':' + s.slice(L - 2); }
    if (L === 5 || L === 6) { var h2 = +s.slice(0, L - 4), m2 = +s.slice(L - 4, L - 2), sec = +s.slice(L - 2); if (h2 <= 23 && m2 <= 59 && sec <= 59) return h2 + ':' + s.slice(L - 4, L - 2) + ':' + s.slice(L - 2); }
    return false;
  }
  function halvesEqual(s) { var L = s.length; return L >= 2 && L % 2 === 0 && s.slice(0, L / 2) === s.slice(L / 2); }
  function allDigits(d, pred) { for (var i = 0; i < d.length; i++) if (!pred(d[i])) return false; return true; }

  return {
    isPrime: isPrime, isSquare: isSquare, isCube: isCube, isPerfectPower: isPerfectPower, powerOf: powerOf, isFibonacci: isFibonacci,
    isTriangular: isTriangular, isFactorial: isFactorial, isPronic: isPronic, isHarshad: isHarshad, isCatalan: isCatalan, isMersenne: isMersenne,
    isPerfectNumber: isPerfectNumber, isTwinPrime: isTwinPrime, isEmirp: isEmirp, isAutomorphic: isAutomorphic,
    digitsOf: digitsOf, digitCounts: digitCounts, sum: sum, product: product, isPalindrome: isPalindrome, isRepdigit: isRepdigit,
    longestRun: longestRun, longestStep: longestStep, isMonotonic: isMonotonic, peakValley: peakValley, isZigzag: isZigzag,
    arithmeticDigits: arithmeticDigits, geometricDigits: geometricDigits, pokerHand: pokerHand, isStraight: isStraight, findScramble: findScramble,
    findNeighbors: findNeighbors, findEquation: findEquation, findCounting: findCounting, calculatorText: calculatorText, asTime: asTime,
    halvesEqual: halvesEqual, allDigits: allDigits
  };
});
