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
    { icon: "🏐", label: "Volleyball" }
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
    accent: "#ff7a1a",    // primary accent (volleyball orange)
    accent2: "#6d8bd6"    // secondary accent (setter blue)
  },

  // The volleyball spike intro.
  introAnimation: {
    mode: "session",      // "session" = once per browser session, "always" = every visit, "never" = off
    style: "3d",          // "3d" (Three.js scene) or "2d" (flat SVG version; also the automatic fallback without WebGL)
    skippable: true,      // show the SKIP button
    beats: ["Approach", "Quick set", "Spike"] // the three labels shown bottom-left during the animation
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
