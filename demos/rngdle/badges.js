/* badges.js — every badge the game can award. THIS IS THE FILE TO EDIT to add numbers and badges.

   Three ways to add things, easiest first:
     1. EXACT_NUMBERS  — one specific number gets a badge. Add a line.
     2. CALCULATOR_WORDS / CONSTANTS — add a word or a decimal to the lists.
     3. BADGES         — a badge with its own test function (see the examples; `x` holds the digits ready-made).

   A test returns false (no badge), true (badge), or an object { highlight: [digit positions], detail: "text" }
   to light up digits and show a note under the badge. Probabilities and EP are worked out for you:
   run `node tools/compute-rarity.js` for exact values, or just reload — missing values are estimated in the browser. */
(function (root, factory) {
  var N = (typeof module !== 'undefined' && module.exports) ? require('./numbers.js') : root.RNG_NUM;
  var api = factory(N);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.RNG_BADGES = api;
})(typeof window !== 'undefined' ? window : globalThis, function (N) {
  'use strict';

  /* ================= 1. EXACT NUMBERS =================
     Add a line: { n: <number>, name, emoji, description }. Each one becomes a badge in "Exact Numbers". */
  var EXACT_NUMBERS = [
    { n: 0, name: 'The Void', emoji: '🕳️', description: 'Zero. Nothing. The universe shrugged.' },
    { n: 1, name: 'One', emoji: '1️⃣', description: 'The loneliest number.' },
    { n: 2, name: 'Two', emoji: '2️⃣', description: 'The only even prime.' },
    { n: 7, name: 'Seven', emoji: '7️⃣', description: 'The luckiest single digit.' },
    { n: 11, name: 'Snake Eyes', emoji: '🐍', description: 'Two ones on the dice.' },
    { n: 21, name: 'Blackjack', emoji: '🃏', description: 'Twenty-one. Stand.' },
    { n: 42, name: 'The Answer', emoji: '🌌', description: 'To life, the universe and everything.' },
    { n: 66, name: 'Boxcars', emoji: '🎲', description: 'Double six on the dice.' },
    { n: 69, name: 'Nice', emoji: '😏', description: 'Nice.' },
    { n: 100, name: 'Century', emoji: '💯', description: 'Exactly one hundred.' },
    { n: 112, name: 'Emergency (EU)', emoji: '🚑', description: 'The European emergency number.' },
    { n: 404, name: 'Not Found', emoji: '🚫', description: 'The number could not be found.' },
    { n: 420, name: 'Blaze', emoji: '🌿', description: 'Four twenty.' },
    { n: 666, name: 'Devilish', emoji: '😈', description: 'Six six six.' },
    { n: 777, name: 'Jackpot', emoji: '🎰', description: 'Triple seven. The machine pays out.' },
    { n: 911, name: 'Emergency (US)', emoji: '🚨', description: 'The North American emergency number.' },
    { n: 999, name: 'Emergency (UK)', emoji: '🚒', description: 'The UK emergency number.' },
    { n: 1111, name: 'Make a Wish', emoji: '🌠', description: '11:11. Wish quickly.' },
    { n: 1337, name: 'Leet', emoji: '🧑‍💻', description: '1337 5p34k.' },
    { n: 8008, name: 'Calculator Classic', emoji: '🧮', description: "Every kid's first calculator word." },
    { n: 12345, name: 'Luggage Combination', emoji: '🧳', description: 'The kind of combination an idiot would have on his luggage.' },
    { n: 65536, name: 'Sixteen Bits', emoji: '🧠', description: '2 to the 16. Beloved by programmers.' },
    { n: 80085, name: 'Calculator Legend', emoji: '🧮', description: 'The other calculator classic.' },
    { n: 86400, name: 'One Day', emoji: '⏳', description: 'Seconds in a day.' },
    { n: 99999, name: 'Almost', emoji: '😩', description: 'One short of a hundred thousand.' },
    { n: 100000, name: 'Hundred K', emoji: '💸', description: 'Exactly one hundred thousand.' },
    { n: 123456, name: 'Counting Up', emoji: '🔢', description: 'One two three four five six.' },
    { n: 654321, name: 'Countdown', emoji: '🚀', description: 'Six five four three two one. Liftoff.' },
    { n: 299792, name: 'Speed of Light', emoji: '💡', description: '299,792 km/s.' },
    { n: 602214, name: 'Avogadro', emoji: '🧪', description: '6.02214 × 10²³.' },
    { n: 999999, name: 'Maxed Out', emoji: '🔝', description: 'The biggest six-digit number.' },
    { n: 1000000, name: 'Millionaire', emoji: '💰', description: 'One in a million. Literally.' }
  ];

  /* ================= 2. LISTS ================= */
  // Words the number spells when read upside-down on a calculator (0→O 1→I 2→Z 3→E 4→h 5→S 6→g 7→L 8→B 9→G).
  var CALCULATOR_WORDS = ['hELL', 'gOOgLE', 'LOOSE', 'ShOES', 'hOLE', 'ShOE', 'LESS', 'BILL', 'BOOB', 'BOSS', 'SELL', 'EggS', 'BEE', 'LOL', 'LOG', 'LEg',
    'ShELL', 'BOOBS', 'ELSE', 'gOOSE', 'hOSE', 'OIL', 'ILL', 'SOS', 'BOSSES', 'gOBBLE', 'gIggLE', 'hEEL', 'ISLE', 'LIES', 'BIBLE', 'OBOE', 'gEESE', 'SIZE',
    'SIEgE', 'SLOB', 'gLOBE', 'hIgh', 'SLEIgh', 'hOBBIES', 'BLESS', 'gIggLES', 'ZOO', 'ZOOS', 'BELL', 'BELLS', 'hEELS', 'SEE', 'gEE', 'LEgO', 'gOB', 'BOO', 'hOh'];
  // Famous decimals. A roll matching the first 3+ digits earns the badge (314 → Pi, 31415 → Pi, 314159 → Pi).
  var CONSTANTS = [
    { digits: '3141592653', name: 'Pi', emoji: '🥧' },
    { digits: '2718281828', name: "Euler's Number", emoji: '📈' },
    { digits: '1618033988', name: 'Golden Ratio', emoji: '🐚' },
    { digits: '1414213562', name: 'Root Two', emoji: '📐' },
    { digits: '1732050807', name: 'Root Three', emoji: '📐' },
    { digits: '6931471805', name: 'Log of Two', emoji: '🪵' },
    { digits: '5772156649', name: 'Euler–Mascheroni', emoji: '🧮' },
    { digits: '6674300000', name: 'Big G', emoji: '🪐' }
  ];
  var ELEMENTS = ['', 'Hydrogen', 'Helium', 'Lithium', 'Beryllium', 'Boron', 'Carbon', 'Nitrogen', 'Oxygen', 'Fluorine'];

  /* ================= 3. BADGES WITH TESTS =================
     x = { n, s, d, len, counts, sum, product, distinct }
       n: the number       s: its digits as text ("702347")     d: digit array [7,0,2,3,4,7]
       len: digit count    counts[k]: how many times digit k appears    sum/product of digits    distinct: number of different digits */
  function all(x) { var a = []; for (var i = 0; i < x.len; i++) a.push(i); return a; }
  function range(start, len) { var a = []; for (var i = 0; i < len; i++) a.push(start + i); return a; }
  function B(id, name, emoji, category, description, test) { return { id: id, name: name, emoji: emoji, category: category, description: description, test: test }; }

  var BADGES = [
    /* --- Basic Physics --- */
    B('even', 'Even', '🔵', 'Basic Physics', 'Divisible by 2.', function (x) { return x.n % 2 === 0; }),
    B('odd', 'Odd', '🦄', 'Basic Physics', 'Not divisible by 2.', function (x) { return x.n % 2 === 1; }),
    B('prime', 'Prime', '💎', 'Basic Physics', 'Divisible only by 1 and itself.', function (x) { return N.isPrime(x.n) && { highlight: all(x) }; }),
    B('digit-sum-prime', 'Prime Sum', '➕', 'Basic Physics', 'The digits add up to a prime.', function (x) { return N.isPrime(x.sum) && { detail: 'digits sum to ' + x.sum }; }),
    B('harshad', 'Harshad', '🧾', 'Basic Physics', 'Divisible by the sum of its own digits.', function (x) { return x.len > 1 && N.isHarshad(x.n, x.sum) && { detail: x.n + ' ÷ ' + x.sum + ' = ' + (x.n / x.sum) }; }),
    B('div7', 'Seventh', '🍀', 'Lucky Sevens', 'Divisible by 7.', function (x) { return x.n > 0 && x.n % 7 === 0 && { detail: '7 × ' + (x.n / 7) }; }),

    /* --- Deep Space --- */
    B('square', 'Perfect Square', '⬛', 'Deep Space', 'A whole number times itself.', function (x) { return x.n > 1 && N.isSquare(x.n) && { detail: Math.sqrt(x.n) + '²' }; }),
    B('cube', 'Perfect Cube', '🧊', 'Deep Space', 'A whole number cubed.', function (x) { return x.n > 1 && N.isCube(x.n) && { detail: Math.round(Math.cbrt(x.n)) + '³' }; }),
    B('power', 'Perfect Power', '🔺', 'Deep Space', 'a to the b, with b at least 2.', function (x) { var r = N.isPerfectPower(x.n); return r && { detail: r.base + '^' + r.exp }; }),
    B('pow2', 'Power of Two', '💾', 'Deep Space', '2 to the something.', function (x) { var e = N.powerOf(2, x.n); return e && { detail: '2^' + e }; }),
    B('pow10', 'Power of Ten', '🔟', 'Deep Space', '10 to the something.', function (x) { var e = N.powerOf(10, x.n); return e && { detail: '10^' + e }; }),
    B('triangular', 'Triangular', '📐', 'Deep Space', 'A count of dots that makes a triangle: 1, 3, 6, 10, 15…', function (x) { return N.isTriangular(x.n); }),
    B('fibonacci', 'Fibonacci', '🐚', 'Deep Space', 'Appears in the Fibonacci sequence.', function (x) { return x.n > 1 && N.isFibonacci(x.n); }),
    B('factorial', 'Factorial', '❗', 'Deep Space', 'k! for some k.', function (x) { var k = N.isFactorial(x.n); return k && { detail: k + '!' }; }),
    B('pronic', 'Pronic', '🧮', 'Deep Space', 'k × (k + 1).', function (x) { return N.isPronic(x.n) && { detail: Math.floor(Math.sqrt(x.n)) + ' × ' + (Math.floor(Math.sqrt(x.n)) + 1) }; }),
    B('catalan', 'Catalan', '🌰', 'Deep Space', 'A Catalan number.', function (x) { return N.isCatalan(x.n); }),
    B('mersenne', 'Mersenne', '🧬', 'Deep Space', 'One less than a power of two.', function (x) { return N.isMersenne(x.n) && { detail: '2^' + N.powerOf(2, x.n + 1) + ' − 1' }; }),
    B('perfect', 'Perfect Number', '✨', 'Deep Space', 'Equals the sum of its divisors: 6, 28, 496, 8128.', function (x) { return N.isPerfectNumber(x.n); }),
    B('twin-prime', 'Twin Prime', '👯', 'Deep Space', 'A prime with another prime two away.', function (x) { return N.isTwinPrime(x.n); }),
    B('emirp', 'Emirp', '🔁', 'Deep Space', 'A prime whose reversal is a different prime.', function (x) { return N.isEmirp(x.n) && { detail: x.s.split('').reverse().join('') + ' is prime too' }; }),
    B('automorphic', 'Automorphic', '♻️', 'Deep Space', 'Its square ends in itself.', function (x) { return N.isAutomorphic(x.n) && { detail: x.n + '² = ' + (x.n * x.n) }; }),

    /* --- Sacred Geometry --- */
    B('palindrome', 'Palindrome', '🪞', 'Sacred Geometry', 'Reads the same forwards and backwards.', function (x) { return N.isPalindrome(x.s) && { highlight: all(x) }; }),
    B('echo', 'Echo', '📣', 'Sacred Geometry', 'The second half repeats the first.', function (x) { return x.len >= 4 && N.halvesEqual(x.s) && { highlight: all(x) }; }),
    B('ascending', 'Ascending', '📈', 'Sacred Geometry', 'Every digit is bigger than the last.', function (x) { return N.isMonotonic(x.d, 1) && { highlight: all(x) }; }),
    B('descending', 'Descending', '📉', 'Sacred Geometry', 'Every digit is smaller than the last.', function (x) { return N.isMonotonic(x.d, -1) && { highlight: all(x) }; }),
    B('peak', 'Peak', '⛰️', 'Sacred Geometry', 'Digits climb to a summit and then fall.', function (x) { var r = N.peakValley(x.d); return r && r.type === 'peak' && { highlight: [r.at] }; }),
    B('valley', 'Valley', '🏜️', 'Sacred Geometry', 'Digits descend to a trough and then ascend.', function (x) { var r = N.peakValley(x.d); return r && r.type === 'valley' && { highlight: [r.at] }; }),
    B('zigzag', 'Zigzag', '⚡', 'Sacred Geometry', 'Up, down, up, down…', function (x) { return N.isZigzag(x.d) && { highlight: all(x) }; }),
    B('arithmetic', 'Arithmetic', '➖', 'Sacred Geometry', 'The digits go up or down by the same step every time.', function (x) { var d = N.arithmeticDigits(x.d); return d && { detail: 'step ' + (d > 0 ? '+' : '') + d, highlight: all(x) }; }),
    B('geometric', 'Geometric', '✖️', 'Sacred Geometry', 'Each digit is the previous one times the same number.', function (x) { var r = N.geometricDigits(x.d); return r && { detail: '× ' + r, highlight: all(x) }; }),
    B('binary', 'Binary', '💻', 'Sacred Geometry', 'Only zeros and ones.', function (x) { return x.len >= 3 && N.allDigits(x.d, function (k) { return k < 2; }) && { detail: '= ' + parseInt(x.s, 2) + ' in binary' }; }),
    B('all-even', 'All Even Digits', '🟦', 'Sacred Geometry', 'Every digit is even.', function (x) { return x.len >= 3 && N.allDigits(x.d, function (k) { return k % 2 === 0; }); }),
    B('all-odd', 'All Odd Digits', '🟪', 'Sacred Geometry', 'Every digit is odd.', function (x) { return x.len >= 3 && N.allDigits(x.d, function (k) { return k % 2 === 1; }); }),
    B('bookends', 'Bookends', '📚', 'Sacred Geometry', 'The first and last digits match.', function (x) { return x.len >= 2 && x.d[0] === x.d[x.len - 1] && { highlight: [0, x.len - 1] }; }),
    B('neighbors', 'Neighbors', '🏘️', 'Sacred Geometry', 'Two digits next to each other differ by exactly one.', function (x) { var i = N.findNeighbors(x.d); return i >= 0 && { highlight: [i, i + 1] }; }),
    B('all-different', 'All Different', '🌈', 'Sacred Geometry', 'Five or more digits, no repeats.', function (x) { return x.len >= 5 && x.distinct === x.len; }),
    B('equation', 'Equation', '🟰', 'Sacred Geometry', 'Insert one of + − × ÷ and an equals sign to make a true equation.', function (x) { var e = N.findEquation(x.s); return e && { detail: e }; }),
    B('seq3', 'Sequence (3)', '🔢', 'Sacred Geometry', 'Three consecutive digits in a row, like 2 3 4.', function (x) { var r = N.longestStep(x.d, 1); return r.len >= 3 && { highlight: range(r.start, 3) }; }),
    B('seq4', 'Sequence (4)', '🔢', 'Sacred Geometry', 'Four consecutive digits in a row.', function (x) { var r = N.longestStep(x.d, 1); return r.len >= 4 && { highlight: range(r.start, 4) }; }),
    B('seq5', 'Sequence (5)', '🔢', 'Sacred Geometry', 'Five consecutive digits in a row.', function (x) { var r = N.longestStep(x.d, 1); return r.len >= 5 && { highlight: range(r.start, 5) }; }),
    B('seq6', 'Staircase', '🪜', 'Sacred Geometry', 'Six consecutive digits in a row.', function (x) { var r = N.longestStep(x.d, 1); return r.len >= 6 && { highlight: all(x) }; }),
    B('down3', 'Countdown (3)', '⏬', 'Sacred Geometry', 'Three digits stepping down, like 5 4 3.', function (x) { var r = N.longestStep(x.d, -1); return r.len >= 3 && { highlight: range(r.start, 3) }; }),
    B('down4', 'Countdown (4)', '⏬', 'Sacred Geometry', 'Four digits stepping down.', function (x) { var r = N.longestStep(x.d, -1); return r.len >= 4 && { highlight: range(r.start, 4) }; }),
    B('scramble', 'Mini Scramble', '🧩', 'Sacred Geometry', 'Three neighbouring digits that are consecutive values, out of order.', function (x) { var i = N.findScramble(x.d); return i >= 0 && { highlight: range(i, 3) }; }),

    /* --- The Casino --- */
    B('pair', 'Pair', '👯', 'The Casino', 'Two matching digits.', function (x) { return N.pokerHand(x.counts) === 'pair'; }),
    B('two-pair', 'Two Pair', '👯‍♀️', 'The Casino', 'Two different pairs.', function (x) { return N.pokerHand(x.counts) === 'two-pair'; }),
    B('three-pair', 'Three Pair', '🎎', 'The Casino', 'Three different pairs.', function (x) { return N.pokerHand(x.counts) === 'three-pair'; }),
    B('three-kind', 'Three of a Kind', '🎳', 'The Casino', 'Three matching digits.', function (x) { return N.pokerHand(x.counts) === 'three-kind'; }),
    B('full-house', 'Full House', '🏠', 'The Casino', 'Three of one digit and two of another.', function (x) { return N.pokerHand(x.counts) === 'full-house'; }),
    B('two-triples', 'Two Triples', '🎰', 'The Casino', 'Three of one digit and three of another.', function (x) { return N.pokerHand(x.counts) === 'two-triples'; }),
    B('four-kind', 'Four of a Kind', '🧱', 'The Casino', 'Four matching digits.', function (x) { return N.pokerHand(x.counts) === 'four-kind'; }),
    B('five-kind', 'Five of a Kind', '🖐️', 'The Casino', 'Five matching digits.', function (x) { return N.pokerHand(x.counts) === 'five-kind'; }),
    B('straight', 'Straight', '🃏', 'The Casino', 'Four or more different digits that form a run, in any order.', function (x) { return N.isStraight(x.d) && { highlight: all(x) }; }),

    /* --- Lucky Sevens --- */
    B('lucky7', 'Lucky Seven', '🍀', 'Lucky Sevens', 'Contains a 7.', function (x) { return x.counts[7] > 0; }),
    B('double7', 'Double Seven', '🍀🍀', 'Lucky Sevens', 'Contains 77.', function (x) { var i = x.s.indexOf('77'); return i >= 0 && { highlight: [i, i + 1] }; }),
    B('triple7', 'Triple Seven', '🎰', 'Lucky Sevens', 'Contains 777.', function (x) { var i = x.s.indexOf('777'); return i >= 0 && { highlight: range(i, 3) }; }),
    B('quad7', 'Quad Seven', '🎇', 'Lucky Sevens', 'Contains 7777.', function (x) { var i = x.s.indexOf('7777'); return i >= 0 && { highlight: range(i, 4) }; }),
    B('sum7', 'Sum of Seven', '🎯', 'Lucky Sevens', 'The digits add up to 7.', function (x) { return x.sum === 7; }),

    /* --- The Void --- */
    B('hollow', 'Hollow', '🕳️', 'The Void', 'Contains a zero.', function (x) { return x.counts[0] > 0; }),
    B('ghost', 'Ghost', '👻', 'The Void', 'Contains exactly one zero.', function (x) { return x.counts[0] === 1 && { highlight: [x.s.indexOf('0')] }; }),
    B('swiss', 'Swiss Cheese', '🧀', 'The Void', 'Two or more zeros.', function (x) { return x.counts[0] >= 2; }),
    B('round', 'Round', '⭕', 'The Void', 'Ends in a zero.', function (x) { return x.n > 0 && x.n % 10 === 0; }),
    B('round100', 'Very Round', '⭕⭕', 'The Void', 'Ends in two zeros.', function (x) { return x.n > 0 && x.n % 100 === 0; }),
    B('round1000', 'Thousand', '🎈', 'The Void', 'Ends in three zeros.', function (x) { return x.n > 0 && x.n % 1000 === 0; }),

    /* --- Flatliners --- */
    B('double', 'Double', '🥈', 'Flatliners', 'Two of the same digit in a row.', function (x) { var r = N.longestRun(x.d); return r.len >= 2 && { highlight: range(r.start, 2) }; }),
    B('triple', 'Triple', '🥉', 'Flatliners', 'Three of the same digit in a row.', function (x) { var r = N.longestRun(x.d); return r.len >= 3 && { highlight: range(r.start, 3) }; }),
    B('quad', 'Quad', '🧱', 'Flatliners', 'Four of the same digit in a row.', function (x) { var r = N.longestRun(x.d); return r.len >= 4 && { highlight: range(r.start, 4) }; }),
    B('quint', 'Quint', '🖐️', 'Flatliners', 'Five of the same digit in a row.', function (x) { var r = N.longestRun(x.d); return r.len >= 5 && { highlight: range(r.start, 5) }; }),
    B('flatline', 'Flatline', '📏', 'Flatliners', 'Every digit is the same.', function (x) { return N.isRepdigit(x.d) && { highlight: all(x) }; }),

    /* --- Digit Counts --- */
    B('len1', 'Single Digit', '☝️', 'Digit Counts', 'Just one digit.', function (x) { return x.len === 1; }),
    B('len2', 'Two Digits', '✌️', 'Digit Counts', 'Exactly two digits.', function (x) { return x.len === 2; }),
    B('len3', 'Three Digits', '🤟', 'Digit Counts', 'Exactly three digits.', function (x) { return x.len === 3; }),
    B('len4', 'Four Digits', '🖖', 'Digit Counts', 'Exactly four digits.', function (x) { return x.len === 4; }),
    B('len5', 'Five Digits', '🖐️', 'Digit Counts', 'Exactly five digits.', function (x) { return x.len === 5; }),
    B('len6', 'Six Digits', '🐝', 'Digit Counts', 'Exactly six digits.', function (x) { return x.len === 6; }),
    B('len7', 'Seven Digits', '🎯', 'Digit Counts', 'Seven digits. There is only one.', function (x) { return x.len === 7; }),

    /* --- On the Clock --- */
    B('clock', 'Tells Time', '🕰️', 'On the Clock', 'Reads as a valid time on a 24-hour clock.', function (x) { var t = (x.len === 3 || x.len === 4) && N.asTime(x.s); return t && { detail: t }; }),
    B('timestamp', 'Timestamp', '⏱️', 'On the Clock', 'Reads as hours, minutes and seconds.', function (x) { var t = (x.len === 5 || x.len === 6) && N.asTime(x.s); return t && { detail: t }; }),

    /* --- Counting --- */
    B('counting', 'Counting', '🧮', 'Counting', 'Consecutive numbers written one after another, like 9·10·11.', function (x) { var c = x.len >= 3 && N.findCounting(x.s); return c && { detail: c, highlight: all(x) }; }),

    /* --- Calculator Words --- */
    B('calc-word', 'Calculator Word', '🔠', 'Calculator Words', 'Spells a word when the calculator is turned upside-down.', function (x) { var w = N.calculatorText(x.s); return x.len >= 3 && CALCULATOR_WORDS.indexOf(w) >= 0 && { detail: w, highlight: all(x) }; }),

    /* --- Mathematical Constants --- */
    B('constant', 'Famous Decimal', '🔬', 'Mathematical Constants', 'The first digits of a famous constant.', function (x) {
      if (x.len < 3) return false;
      for (var i = 0; i < CONSTANTS.length; i++) if (CONSTANTS[i].digits.indexOf(x.s) === 0) return { detail: CONSTANTS[i].emoji + ' ' + CONSTANTS[i].name + ' (' + x.len + ' digits)', highlight: all(x) };
      return false;
    })
  ];

  // Periodic table: exactly one of a digit (1–9) is the element with that atomic number.
  for (var k = 1; k <= 9; k++) (function (k) {
    BADGES.push(B('element-' + k, ELEMENTS[k] + ' (' + k + ')', '⚛️', 'Periodic Table', 'Contains exactly one "' + k + '".', function (x) { return x.counts[k] === 1 && { highlight: [x.s.indexOf(String(k))] }; }));
  })(k);
  // Exact numbers become badges too.
  EXACT_NUMBERS.forEach(function (e) {
    BADGES.push(B('exact-' + e.n, e.name, e.emoji, 'Exact Numbers', e.description, function (x) { return x.n === e.n && { highlight: all(x) }; }));
  });

  var CATEGORIES = {
    'Basic Physics': 'Fundamental number properties',
    'Deep Space': 'Powers, sequences and famous families',
    'Sacred Geometry': 'Patterns and symmetry in the digits',
    'The Casino': 'Poker hands and lucky rolls',
    'Lucky Sevens': 'The luckiest digit',
    'The Void': 'Zero-related badges',
    'Flatliners': 'Repeated digits',
    'Periodic Table': 'Exactly one of a digit',
    'Digit Counts': 'How long the number is',
    'On the Clock': 'Numbers that tell time',
    'Counting': 'Consecutive numbers written together',
    'Calculator Words': 'Numbers that spell words upside-down',
    'Mathematical Constants': 'Famous decimals',
    'Exact Numbers': 'One specific number each'
  };

  return { BADGES: BADGES, CATEGORIES: CATEGORIES, EXACT_NUMBERS: EXACT_NUMBERS, CALCULATOR_WORDS: CALCULATOR_WORDS, CONSTANTS: CONSTANTS };
});
