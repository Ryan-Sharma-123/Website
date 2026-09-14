/* ============================================================
   BLOG POSTS — add a new object to this array to add a post.
   Newest first is a good rule (the list is shown in this order).

   Fields:
     slug     URL id, e.g. #/blog/quick-attack-timing
     title    Post title.
     date     "YYYY-MM-DD"
     tags     Array of tags. Clicking a tag filters the blog list.
     summary  One line shown under the title in the list.
     image    OPTIONAL. { src, alt, caption } — shown on the left of the post. Leave out for no image.
     links    OPTIONAL. Array of { label, url } shown under the post details.
     body     Markdown, up to 1000 words. $...$ and $$...$$ render as math if KaTeX is loaded.
     draft    OPTIONAL. true hides the post from the site.
   ============================================================ */
window.POSTS = [
  {
    slug: "quick-attack-timing",
    title: "The math of a quick attack",
    date: "2025-08-21",
    tags: ["volleyball", "math"],
    summary: "Why the first tempo works: a hitter, a setter, and about 0.4 seconds.",
    image: { src: "assets/images/placeholder-post.svg", alt: "Illustration placeholder", caption: "Replace this with a photo or diagram, or delete the image field entirely." },
    links: [
      { label: "A very good explanation of tempo", url: "https://en.wikipedia.org/wiki/Volleyball" }
    ],
    body: `
The quick attack is the play that made me fall in love with volleyball. The hitter is
already in the air before the setter touches the ball. The set travels maybe a metre.
The block never gets its hands up. It looks like magic, and like most magic it is
mostly timing.

## The numbers

Say the setter pushes the ball with a speed of $v$ at an angle $\\theta$ toward a point
$d$ metres away. The flight time is roughly

$$
t = \\frac{d}{v \\cos\\theta}
$$

For a first-tempo set, $d \\approx 1$ m and $v \\approx 4$ m/s, so $t$ is around a quarter
of a second. A hitter's arm swing, from cocked to contact, takes about the same. That
means the hitter has to *start* the swing before the ball leaves the setter's hands.
Nobody is reacting. Both players are running the same script.

## Why it is hard

- The approach has to end at the same spot every time, or the setter is aiming at a moving target.
- The setter has to deliver the same ball from bad passes and good ones.
- Trust: the hitter swings at empty air and believes the ball will be there.

## What I actually learned

The play looks like it is about the hitter. It is really about the setter's consistency
and the hitter's discipline. Which, now that I write it down, is also how most team
software projects go.
`
  },
  {
    slug: "dp-notes",
    title: "Dynamic programming, finally explained to myself",
    date: "2025-05-09",
    tags: ["coding", "math", "notes"],
    summary: "Overlapping subproblems, optimal substructure, and the one question I ask now.",
    body: `
Every explanation of dynamic programming I read started with Fibonacci and ended with
me still not knowing how to *find* the subproblem in a new question. Here is the version
that eventually worked for me.

## The one question

> What is the smallest piece of information I need to carry forward so that the rest
> of the problem does not care about the past?

That piece of information is the state. Everything else is bookkeeping.

## An example

Longest increasing subsequence. The naive state is "which elements have I picked so
far", which is exponential. But the future only cares about *the last element picked*,
because that is the only thing that constrains the next choice. So the state collapses
to one index, and the recurrence is

\`\`\`cpp
for (int i = 0; i < n; i++) {
    dp[i] = 1;
    for (int j = 0; j < i; j++)
        if (a[j] < a[i]) dp[i] = max(dp[i], dp[j] + 1);
}
\`\`\`

Quadratic, and honest. The $O(n \\log n)$ version is the same idea plus a binary search.

## Checklist

1. What decision am I making at each step?
2. What does the future need to know about the past?
3. Can I order the states so that dependencies are already solved?

If the answer to (2) is "everything", it is probably not a DP problem.
`
  },
  {
    slug: "building-this-site",
    title: "Building this site",
    date: "2025-02-14",
    tags: ["coding", "meta"],
    summary: "No framework, no build step, one folder. Here is how it fits together.",
    links: [
      { label: "The repository", url: "https://github.com/Ryan-Sharma-123/Website" }
    ],
    body: `
I wanted a site I could edit from any laptop with a text editor, so there is no build
step. Every page is rendered from three content files: \`content/projects.js\`,
\`content/blog.js\` and \`content/about.js\`. Adding a post is adding an object to a list.

The projects page embeds live demos in an iframe. For C++ that means compiling with
Emscripten to WebAssembly; for Python, running it under Pyodide; and for anything that
does not want to live in a browser, a screen recording does the job.

The intro animation is an SVG drawn by hand and moved with a few hundred lines of
JavaScript: a setter, a hitter, a quick set, and a ball that flies at the camera. It
plays once per session and there is always a skip button, because it is *my* site
but it is *your* time.
`
  }
];
