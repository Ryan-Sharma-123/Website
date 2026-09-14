/* ============================================================
   PROJECTS — add a new object to this array to add a project.
   Order matters: the first item is shown first. Newest at top
   is a good rule.

   Fields:
     slug        URL id, e.g. #/projects/game-of-life. Letters, numbers, dashes.
     title       Project name.
     tagline     One line under the title.
     date        "YYYY-MM-DD" (shown as a small label).
     tech        Array of technologies (shown as chips).
     embed       What is shown on the left (see the four kinds below).
     description Markdown, up to 200 words.
     links       Array of { label, url } — repo, demo, write-up, etc.
     featured    true/false — featured projects are shown first on the home page.

   Embed kinds:
     { type: "iframe",  src: "demos/my-demo/index.html", title: "My demo" }   // interactive
     { type: "image",   src: "assets/images/thing.png", alt: "…" }           // picture / GIF
     { type: "video",   src: "assets/videos/thing.mp4", poster: "…" }        // local video
     { type: "youtube", id: "VIDEO_ID" }                                      // YouTube
   See README.md for how to get a C++ / Python / Java project running inside an iframe.
   ============================================================ */
window.PROJECTS = [
  {
    slug: "game-of-life",
    title: "Conway's Game of Life",
    tagline: "A cellular automaton you can poke at. Click cells, hit play, watch gliders go.",
    date: "2025-06-12",
    tech: ["C++", "WebAssembly", "Canvas"],
    embed: { type: "iframe", src: "demos/game-of-life/index.html", title: "Game of Life demo" },
    description: `
Life is a zero-player game: you set the board, then the rules do the rest.
Every generation, each cell looks at its eight neighbours. A live cell with two or three
live neighbours survives; a dead cell with exactly three comes alive; everything else dies.

I first wrote this in **C++** as a terminal toy, then compiled the simulation core to
WebAssembly so the same code could run in a browser. The version embedded here is the
JavaScript port used for the demo, but the update rule is byte-for-byte the same.

**Things to try:** draw a glider (the classic five-cell shape), press *Random* and watch
the chaos settle into still lifes and oscillators, or turn the speed all the way up.
`,
    links: [
      { label: "Source on GitHub", url: "https://github.com/Ryan-Sharma-123" },
      { label: "Open demo in a new tab", url: "demos/game-of-life/index.html" }
    ],
    featured: true
  },
  {
    slug: "sorting-visualizer",
    title: "Sorting Visualizer",
    tagline: "Bubble, insertion, merge and quick sort, drawn one comparison at a time.",
    date: "2025-03-02",
    tech: ["Python", "Algorithms", "Canvas"],
    embed: { type: "iframe", src: "demos/sorting/index.html", title: "Sorting visualizer demo" },
    description: `
I kept forgetting *why* quicksort is fast in practice and mergesort is safe in theory,
so I built something that shows it instead of telling it.

Each bar is a number. Comparisons light up orange, writes light up blue, and the sort
runs as a generator so the browser can draw a frame between steps. The original was a
**Python** script with matplotlib; this is the same idea rewritten for the page.

Try shuffling a nearly-sorted array and running insertion sort, then quick sort. The
difference is the whole point.
`,
    links: [
      { label: "Source on GitHub", url: "https://github.com/Ryan-Sharma-123" }
    ],
    featured: true
  },
  {
    slug: "volleyball-stat-tracker",
    title: "Volleyball Stat Tracker",
    tagline: "A small Java app for tracking kills, digs and errors during a set.",
    date: "2024-11-20",
    tech: ["Java", "JavaFX", "SQLite"],
    embed: { type: "image", src: "assets/images/placeholder-project.svg", alt: "Screenshot placeholder for the stat tracker" },
    description: `
Our team was tracking stats on paper and losing the paper. This is a desktop app with a
big-button interface designed to be used from the bench between rallies: tap a player,
tap an action, done.

It stores everything in a local SQLite database and exports a per-set summary as CSV.
The "hitting efficiency" view was the most requested feature: kills minus errors over
total attempts, updated live.

Replace this image with a real screenshot or a short screen recording (see README).
`,
    links: [
      { label: "Source on GitHub", url: "https://github.com/Ryan-Sharma-123" }
    ],
    featured: false
  }
];
