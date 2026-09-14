/* ============================================================
   SITE SETTINGS — edit freely. This file is plain JavaScript,
   so keep the commas and quotes and you cannot go wrong.
   ============================================================ */
window.SITE = {
  // Your name, shown in the hero and the browser tab.
  name: "Ryan Sharma",
  // Small label in the top-left corner (keep it short). A "." is drawn in orange after it.
  label: "RYAN SHARMA",
  // One line under your name on the home page.
  tagline: "Student. Builder. Chronic over-thinker of small problems.",
  // A short paragraph for the home page (Markdown allowed).
  intro: "I write C++ and Python, occasionally Java, and spend the rest of my time on math problems, volleyball courts, basketball courts, games and anime. This site collects the things I make and the things I think about.",
  // Picture used in the top-left corner. Replace with your own file in assets/images/.
  avatar: "assets/images/profile.svg",

  // Little interest chips shown on the home page. Icons are just text (emoji or symbols).
  interests: [
    { icon: "∑", label: "Math" },
    { icon: "</>", label: "Code" },
    { icon: "🎮", label: "Gaming" },
    { icon: "✦", label: "Anime" },
    { icon: "🏀", label: "Basketball" },
    { icon: "🏐", label: "Volleyball" },
    { icon: "♞", label: "Chess" }
  ],

  // Links shown in the footer and on the About page.
  social: [
    { label: "GitHub", url: "https://github.com/Ryan-Sharma-123" },
    { label: "Email", url: "mailto:itz.ryansharma@gmail.com" }
  ],

  // Footer text. {year} is replaced with the current year.
  footer: "© {year} Ryan Sharma. Built by hand with HTML, CSS and JavaScript.",

  theme: {
    default: "dark",      // "dark" or "light"
    allowToggle: true,    // show the sun/moon button
    accent: "#8ab4ff",        // primary accent on the dark theme (soft sky blue)
    accent2: "#b9a6ff",       // secondary accent on the dark theme (lavender)
    accentLight: "#3a6fe3",   // the same two roles on the light theme (darker, for contrast)
    accent2Light: "#7a5fd0"
  },

  // "You're the 42nd person to visit this website." on the home page. Each browser gets a number
  // the first time it visits and keeps it. Counts are stored by a free public counter service
  // (abacus.jasoncameron.dev); pick a namespace nobody else is likely to use.
  visitorCounter: {
    enabled: true,
    endpoint: "https://abacus.jasoncameron.dev",
    namespace: "ryan-sharma-123-website",
    key: "visitors",
    template: "You're the {n} person to visit this website."
  },

  // Music button in the top-right corner. "youtube" stations play a YouTube video or 24/7 stream
  // (the id is the part of the address after watch?v=); "synth" stations are generated in the
  // browser and need no internet.
  music: {
    enabled: true,
    volume: 0.6,
    stations: [
      { name: "Lofi Girl · beats to relax/study to", type: "youtube", id: "jfKfPfyJRdk" },
      { name: "Lofi Girl · beats to sleep/chill to", type: "youtube", id: "rUxyKA_-grg" },
      { name: "Chillhop · jazzy & lofi beats", type: "youtube", id: "5yx6BWlEVcY" },
      { name: "Built-in lofi (generated, works offline)", type: "synth", preset: "lofi" },
      { name: "Built-in 8-bit (generated)", type: "synth", preset: "chip" }
    ]
  },

  // The volleyball spike intro.
  introAnimation: {
    mode: "session",      // "session" = once per browser session, "always" = every visit, "never" = off
    style: "3d",          // "3d" (Three.js scene) or "2d" (flat SVG version; also the automatic fallback without WebGL)
    skippable: true,      // show the SKIP button
    beats: ["Open toss", "Approach", "Spike"] // the three labels shown bottom-left during the animation
  },

  // Ambient background.
  background: {
    enabled: true,
    particles: true,      // slow drifting dust / stars
    glyphs: true,         // faint math / code / gaming / sports symbols
    grid: true,           // perspective court grid at the bottom
    intensity: 1          // 0.5 = calmer, 1.5 = busier
  },

  // Word limits (used by the #/check page and console warnings).
  limits: { projectWords: 200, blogWords: 1000 },

  home: {
    showLatest: true,     // show the latest project + latest post on the home page
    projectsLabel: "Projects",
    blogLabel: "Blog",
    aboutLabel: "About me"
  }
};
