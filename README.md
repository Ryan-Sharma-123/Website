# Personal website

A hand-built personal site: **projects** with embedded demos, a **blog** in Garamond, an **about / résumé** page,
a volleyball **intro animation**, and a quiet themed background. No framework, no build step — one folder of
HTML, CSS and JavaScript that you can edit with any text editor and host for free on GitHub Pages.

```
index.html          the page shell (you rarely touch this)
content/            ← everything you edit lives here
  site.js           name, tagline, links, theme, intro + background settings
  projects.js       the projects list
  blog.js           the blog posts
  about.js          the about page + résumé
assets/images/      your pictures (profile photo, screenshots, post images)
demos/              small interactive demos that get embedded on project pages
css/, js/           the site's code (js/vendor/ holds Three.js for the 3D intro)
```

## Run it locally

Double-clicking `index.html` works for most things. For iframes/demos to behave exactly like the live site,
serve the folder instead:

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

## Put it online (GitHub Pages)

1. Push this repository to GitHub.
2. Repository **Settings → Pages → Build and deployment → Source: Deploy from a branch**, pick your branch and the `/ (root)` folder.
3. A minute later the site is live at `https://<user>.github.io/<repo>/`.

All paths in the site are relative, so it also works from a subfolder or a custom domain.

## Add a project

Open `content/projects.js` and add an object to the `PROJECTS` array (newest at the top):

```js
{
  slug: "my-raytracer",                       // becomes #/projects/my-raytracer
  title: "Tiny Raytracer",
  tagline: "One weekend, one .ppm file, many spheres.",
  date: "2025-09-01",
  tech: ["C++", "Math"],
  embed: { type: "image", src: "assets/images/raytracer.png", alt: "Render of three spheres" },
  description: `Markdown goes here. Up to **200 words**.`,
  links: [{ label: "Source", url: "https://github.com/you/raytracer" }],
  featured: true
}
```

The project page shows the embed on the left and the title/description on the right, with
**previous / next / back** buttons at the bottom (← and → keys work too) and the **pop-up tab on the left**
listing every project. The **Projects** tab in the top bar is a dropdown of all project titles.

### The four embed types

| `embed.type` | What it shows | Example |
| --- | --- | --- |
| `iframe`  | An interactive page (a demo, a game, a WebAssembly build) | `{ type: "iframe", src: "demos/game-of-life/index.html" }` |
| `image`   | A picture or GIF | `{ type: "image", src: "assets/images/shot.png", alt: "…" }` |
| `video`   | A local video file | `{ type: "video", src: "assets/videos/demo.mp4", poster: "assets/images/poster.jpg" }` |
| `youtube` | A YouTube video | `{ type: "youtube", id: "dQw4w9WgXcQ" }` |

### Getting a C++ / Python / Java project into an iframe

The embed is just a web page in a folder under `demos/`, so anything that can run in a browser works:

- **C++ → WebAssembly with Emscripten.** `emcc main.cpp -O2 -o demos/my-project/index.html` produces an
  `index.html` + `.js` + `.wasm` you can point an `iframe` embed at. SDL2/OpenGL projects work too
  (`-s USE_SDL=2`). Emscripten's own HTML shell is ugly; copy the `<canvas>` and script tag into a page styled
  like `demos/game-of-life/index.html`.
- **Python → Pyodide / PyScript.** Put your script in a page that loads Pyodide and runs it in the browser.
  Fine for algorithms, simulations and matplotlib figures; not for heavy native dependencies.
- **Java → CheerpJ** can run compiled `.jar` files in the browser, or convert the core logic to a small JS/TS
  version for the demo (the two demos in `demos/` are exactly that: JS ports of a C++ and a Python toy).
- **Anything else:** host it somewhere that gives you a URL (Replit, Hugging Face Spaces, itch.io, your own
  server) and use `{ type: "iframe", src: "https://…" }`, or record a short screen capture and use `video`.

Both bundled demos (`demos/game-of-life/`, `demos/sorting/`) are single self-contained HTML files — copy one as a
starting point.

## Add a blog post

Open `content/blog.js` and add an object to `POSTS` (newest first):

```js
{
  slug: "why-i-like-quick-attacks",
  title: "Why I like quick attacks",
  date: "2025-09-14",
  tags: ["volleyball", "math"],
  summary: "One line for the list page.",
  image: { src: "assets/images/quick.jpg", alt: "…", caption: "Optional caption" }, // optional — delete for no image
  links: [{ label: "Related video", url: "https://…" }],                             // optional
  body: `Markdown, up to **1000 words**. Inline math like $E = mc^2$ works too.`
}
```

Posts are set in **EB Garamond**. The blog list shows only titles (with a one-line summary) and a tag filter;
click a title to read. Each post has previous / next / back navigation and the pop-up tab on the left.

Markdown supported: `# headings`, paragraphs, `**bold**`, `*italic*`, `` `code` ``, fenced code blocks,
links, images, `-` and `1.` lists, `>` quotes, `---` rules, and `$…$` / `$$…$$` math (rendered by KaTeX,
loaded from a CDN in `index.html`; delete those three lines if you do not want it).

## Edit the about page / résumé

Everything is in `content/about.js`: photo, headline, blurb, quick facts, an optional `resumePdf` link, and a
list of `sections`. Each section shows up as a block on the page **and** as an entry in the pop-up tab on the
left, so adding a section is one edit. A section can hold `items` (jobs, schools, awards), `groups` (skills as
chips) or free `text`.

## Customise the look

- **Colours:** `theme.accent` / `theme.accent2` in `content/site.js`, or the tokens at the top of `css/styles.css`.
  Dark is the default; the sun/moon button toggles a light theme (set `allowToggle: false` to hide it).
- **Fonts:** loaded from Google Fonts in `index.html` (Space Grotesk, DM Sans, Space Mono, EB Garamond).
  Swap the `<link>` and the `--font-*` variables in `css/styles.css`.
- **Background:** `background` in `content/site.js` turns the particles, symbols and court grid on/off and sets the intensity.
- **Intro:** `introAnimation.mode` is `"session"` (once per browser session), `"always"` or `"never"`, and
  `introAnimation.style` is `"3d"` (a Three.js scene, `js/intro3d.js`) or `"2d"` (the flat SVG version, `js/intro.js`,
  which is also the automatic fallback when WebGL is unavailable). Timing lives in the `T` object at the top of each
  file; colours in `COL`. The ↻ button in the top bar replays it. The intro is skipped automatically for visitors who
  prefer reduced motion. Three.js is vendored in `js/vendor/` (MIT licence), so nothing is loaded from a CDN for it.

## Check your content

Open `#/check` (e.g. `http://localhost:8000/#/check`) for a table of word counts against the limits
(200 for project descriptions, 1000 for posts — change them in `content/site.js`) and anything that looks missing.
Over-limit text still renders; the page and the browser console just warn you.

## Keyboard

`←` / `→` previous and next project or post · `Esc` closes menus, the pop-up tab and the intro · `Space` / `Enter` skip the intro.
