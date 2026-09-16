# RNGdle (a customizable copy)

A daily random-number game in one folder. Roll a number from 0 to 1,000,000, see which of 122 properties it
has (each one is a badge worth EP), and compete on a leaderboard. Everything is plain JavaScript with no build
step, and the parts you are most likely to change are ordinary data.

```
demos/rngdle/
  index.html        the page. Open it for the full game, add ?embed=1 for the compact version used on the projects page
  config.js         settings: title, number range, daily vs free mode, backend, colours
  badges.js         ← the badges. Add numbers, words and badges here
  numbers.js        helper functions (isPrime, findEquation, pokerHand, …) that badges use
  engine.js         analyse a number → badges, EP, rarity; random rolls; rarity estimation
  storage.js        saving rolls and profiles: local / demo / Firebase backends
  ui.js             draws the screens and handles clicks
  style.css         looks
  data/rarity.js    generated: the exact probability of every badge and the EP distribution
  tools/compute-rarity.js   regenerates data/rarity.js (node tools/compute-rarity.js, ~20 s)
```

## How it works, in one paragraph

`ui.js` asks `engine.js` for a random number, then calls `analyze(n)`. `analyze` builds a small context object
`x` describing the digits (`x.s` is the text, `x.d` the digit array, `x.counts[k]` how many times digit `k`
appears, and so on) and runs every badge's `test(x)` from `badges.js`. Each badge that fires is looked up in
`data/rarity.js` to find its **probability** `p` (the share of all 1,000,001 numbers that earn it), which turns
into **EP = 100 ÷ p**. The EPs are summed, and the total is compared against the EP of every possible roll to
give the roll a **rarity tier** and a "top X%" (or "bottom X%" for the weaker half). `storage.js` then saves the roll and answers questions like
"who rolled best today?" from whichever backend is configured. That is the whole game.

## Add a badge for one specific number

Open `badges.js`, find `EXACT_NUMBERS`, add a line:

```js
{ n: 24601, name: 'Prisoner', emoji: '⛓️', description: 'Who am I?' },
```

Reload. Done. The badge appears in the catalogue under "Exact Numbers" with the correct rarity (Mythic, since one
number in a million earns it) and EP (100,000,100).

## Add a calculator word or a constant

Same file. `CALCULATOR_WORDS` is a list of words the number can spell when a calculator is turned upside-down
(digits map to letters as `0→O 1→I 2→Z 3→E 4→h 5→S 6→g 7→L 8→B 9→G`, read backwards). Add `'hIgh'` and the
number 4614 earns it. `CONSTANTS` are famous decimals; a roll that matches the first three or more digits earns
the badge, so adding `{ digits: '1234567890', name: 'Counting', emoji: '🔢' }` makes 123, 1234, 12345 and 123456
all count.

## Add a badge with its own rule

Add an entry to the `BADGES` list. The helper `B(id, name, emoji, category, description, test)` builds it.
The `test` receives `x` and returns `false`, `true`, or an object with `highlight` (which digit positions to
light up) and `detail` (a short note shown under the badge). Clicking any badge chip or card opens a popover that
shows the badge's emoji, name, category, tier, EP, how many rolls earn it, and this same `description` and
`detail`, so there is nothing extra to write for the popover.

```js
B('digital-root-9', 'Root Nine', '🌱', 'Basic Physics', 'The digits keep adding up to 9.', function (x) {
  var r = x.n; while (r > 9) { r = String(r).split('').reduce(function (a, c) { return a + Number(c); }, 0); }
  return x.n > 0 && r === 9 && { detail: 'digital root 9' };
}),
```

Available on `x`: `n` (the number), `s` (its digits as text), `d` (digit array), `len`, `counts` (array of ten
counts), `sum`, `product`, `distinct`. Available helpers on `N` (see `numbers.js`): `isPrime`, `isSquare`,
`isCube`, `isPerfectPower`, `powerOf(base, n)`, `isFibonacci`, `isTriangular`, `isFactorial`, `isPronic`,
`isHarshad`, `isCatalan`, `isMersenne`, `isPerfectNumber`, `isTwinPrime`, `isEmirp`, `isAutomorphic`,
`isPalindrome(s)`, `isRepdigit(d)`, `longestRun(d)`, `longestStep(d, dir)`, `isMonotonic(d, dir)`,
`peakValley(d)`, `isZigzag(d)`, `arithmeticDigits(d)`, `geometricDigits(d)`, `pokerHand(counts)`,
`isStraight(d)`, `findScramble(d)`, `findNeighbors(d)`, `findEquation(s)`, `findCounting(s)`,
`calculatorText(s)`, `asTime(s)`, `halvesEqual(s)`, `allDigits(d, predicate)`. Categories are free text; add a
new one to `CATEGORIES` to give it a subtitle on the Badges page.

A new badge has no known probability yet. The first time the game loads it notices this and estimates every
badge's odds from 120,000 random rolls (a few seconds, once, cached in the browser). For exact numbers run:

```bash
cd demos/rngdle
node tools/compute-rarity.js      # prints a table of every badge with its probability, tier and EP, writes data/rarity.js
```

Commit the regenerated `data/rarity.js` with your badge.

## Settings (`config.js`)

| Setting | Meaning |
| --- | --- |
| `title`, `tagline` | Shown in the header and on the empty board. |
| `max` | Rolls are 0 … max. Changing it changes every probability; rerun the tool. |
| `mode` | `daily`: one counted roll per day, unlimited practice rolls. `free`: every roll counts. |
| `embedMode` | The mode used by `index.html?embed=1` (the projects-page version). |
| `epPerProbability` | EP = this ÷ probability. 100 means a 1% badge is worth 10,000 EP. |
| `backend` | `demo` (simulated other players), `local` (only you), `firebase` (real shared leaderboards). |
| `demoPlayers`, `leaderboardSize` | How many simulated players; how many rows to show. |
| `theme` | Accent colours for the dark theme (and `accentLight` / `accent2Light` for light). |

Rarity tiers live at the top of `engine.js` (`BADGE_TIERS` by probability, `ROLL_TIERS` by rank).

Roll tiers, from best to worst: Mythic (top 1%), Anomaly (top 1–5%), Epic (top 5–10%), Rare (top 10–25%),
Uncommon (top 25–50%), Common (bottom 50–25%), Bland (bottom 25–10%), Junk (bottom 10–1%), Trash (bottom 1%).
A saved roll's tier is recomputed from its EP whenever it is shown, so changing the table re-ranks old rolls too.

## Real shared leaderboards with Firebase (about 10 minutes, free)

The default `demo` backend fakes other players so the leaderboard looks alive. For a real one:

1. Go to [console.firebase.google.com](https://console.firebase.google.com), **Add project**, give it a name, turn Analytics off, create.
2. **Build → Realtime Database → Create database**, pick a location, start in **locked mode**, enable.
3. **Build → Authentication → Get started → Sign-in method → Anonymous → Enable**. Players are identified by an anonymous id, no sign-up.
4. Project settings (gear) → **Your apps → Web** (`</>`), register the app, and copy the `firebaseConfig` values into
   `config.js` → `firebase: { apiKey, authDomain, databaseURL, projectId, appId }`. The `databaseURL` is shown on the
   Realtime Database page (it ends in `firebasedatabase.app`).
5. Set `backend: 'firebase'` in `config.js`.
6. Realtime Database → **Rules**, paste this, **Publish**:

```json
{
  "rules": {
    "rolls": {
      ".read": true,
      "$day": {
        ".indexOn": ["ep"],
        "$uid": {
          ".write": "auth != null && auth.uid === $uid",
          ".validate": "newData.hasChildren(['name','n','ep','badges','ts']) && newData.child('n').isNumber() && newData.child('ep').isNumber() && newData.child('name').isString() && newData.child('name').val().length <= 24"
        }
      }
    },
    "players": {
      ".read": true,
      ".indexOn": ["lifetimeEp", "best/ep"],
      "$uid": { ".write": "auth != null && auth.uid === $uid" }
    }
  }
}
```

Data layout: `rolls/<YYYY-MM-DD>/<uid>` holds each player's counted roll for the day; `players/<uid>` holds name,
flair, tagline, lifetime EP, roll count and best roll. The rules let anyone read and let a player write only their
own entries. The EP value is still computed in the browser and trusted, which is fine for friends; a Cloud
Function could recompute it server-side if it ever matters.

## Embedding on the projects page

The project entry in `content/projects.js` uses
`embed: { type: "iframe", src: "demos/rngdle/index.html?embed=1" }`. The site adds `&theme=dark|light` to match
the page. Embed mode hides the navigation and the leaderboard, uses `embedMode` (free rolls by default), and shows
the roll, badges and your best/worst five, with a link to the full game.

## Two worked examples of adding a feature

**A streak counter on the profile.** In `ui.js`, inside `viewProfile`, compute it from the saved rolls and add a
stat tile:

```js
var days = {}; rs.forEach(function (r) { days[r.date] = 1; });
var streak = 0, d = new Date();
while (days[ST.dayKey(d)]) { streak++; d.setDate(d.getDate() - 1); }
// then add to the stats HTML:
'<div class="stat"><span class="k">Streak</span><div class="v">' + streak + ' days</div></div>'
```

**A "most badges" leaderboard tab.** Add `['badges', 'Most badges']` to the `ranges` list in `viewLeaderboard`;
in `storage.js` make each backend's `leaderboard` handle `range === 'badges'` by sorting entries with
`b.badges.length - a.badges.length`; in the table show `e.badges.length + ' badges'` where the number is shown.

## Where the numbers come from

`tools/compute-rarity.js` evaluates every badge for all 1,000,001 numbers, counts how many earn each badge, and
writes the counts, the probabilities, the EP quantiles (1,001 points of the sorted EP distribution) and the best
possible roll into `data/rarity.js`. `engine.js` reads that table. When a badge is missing from it (you added one),
`engine.estimate` samples random numbers in the browser instead and caches the estimate in localStorage until the
badge list changes again.
