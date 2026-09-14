/* App: hash router + views + chrome (tabs, dropdown menus, left pop-up rail). No framework. */
(function () {
  'use strict';
  var U = window.U, MD = window.MD;
  var SITE = window.SITE || {};
  var PROJECTS = (window.PROJECTS || []).slice();
  var POSTS = (window.POSTS || []).filter(function (p) { return !p.draft; });
  var ABOUT = window.ABOUT || {};
  var LIMITS = Object.assign({ projectWords: 200, blogWords: 1000 }, SITE.limits || {});
  var HOME = Object.assign({ showLatest: true, projectsLabel: 'Projects', blogLabel: 'Blog', aboutLabel: 'About me' }, SITE.home || {});

  PROJECTS.forEach(function (p) { if (!p.slug) p.slug = U.slugify(p.title); });
  POSTS.forEach(function (p) { if (!p.slug) p.slug = U.slugify(p.title); });
  ABOUT.sections = (ABOUT.sections || []).map(function (s) { if (!s.id) s.id = U.slugify(s.title); return s; });

  var esc = U.esc, $ = U.$, $$ = U.$$;
  var main = $('#main');
  var rail = $('#rail'), railTab = $('#rail-tab'), railPanel = $('#rail-panel'), railList = $('#rail-list');
  var currentView = null;      // name of the view currently rendered
  var pagerKeys = null;        // { prev, next } hrefs for keyboard navigation
  var ARROW = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ================= theme ================= */
  function applyAccent() {
    var t = SITE.theme || {};
    var root = document.documentElement.style;
    if (t.accent) root.setProperty('--accent', t.accent);
    if (t.accent2) root.setProperty('--accent-2', t.accent2);
  }
  function currentTheme() {
    return U.local.get('theme') || (SITE.theme && SITE.theme.default) || 'dark';
  }
  function applyTheme(name) {
    document.documentElement.setAttribute('data-theme', name);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', name === 'dark' ? '#070a14' : '#f4f5f9');
    document.dispatchEvent(new CustomEvent('themechange', { detail: name }));
  }
  function initTheme() {
    applyAccent();
    applyTheme(currentTheme());
    var btn = $('#theme-toggle');
    if (SITE.theme && SITE.theme.allowToggle === false) { btn.hidden = true; return; }
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      U.local.set('theme', next);
      applyTheme(next);
    });
  }

  /* ================= chrome ================= */
  function initChrome() {
    document.title = SITE.name || 'Personal site';
    var desc = document.querySelector('meta[name="description"]');
    if (desc) desc.setAttribute('content', SITE.tagline || '');
    $('#brand-label').innerHTML = esc(SITE.label || SITE.name || 'SITE') + '<span class="dot">.</span>';
    var av = $('#brand-avatar');
    if (SITE.avatar) av.src = SITE.avatar; else av.hidden = true;

    // dropdown menus
    $('#menu-projects').innerHTML = menuHtml(PROJECTS, '#/projects/', 'All projects', '#/projects', 'No projects yet');
    $('#menu-blog').innerHTML = menuHtml(POSTS, '#/blog/', 'All posts', '#/blog', 'No posts yet');

    $$('.menu-toggle').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault(); e.stopPropagation();
        var li = btn.closest('.has-menu');
        var open = !li.classList.contains('open');
        closeMenus();
        if (open) { li.classList.add('open'); btn.setAttribute('aria-expanded', 'true'); }
      });
    });
    document.addEventListener('click', function (e) {
      if (!e.target.closest('.has-menu')) closeMenus();
      if (!e.target.closest('.tabs') && !e.target.closest('#nav-toggle')) setNavOpen(false);
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { closeMenus(); setNavOpen(false); setRailOpen(false); }
    });

    $('#nav-toggle').addEventListener('click', function () { setNavOpen(!document.body.classList.contains('nav-open')); });
    $('#replay-intro').addEventListener('click', function () {
      var eng = introEngine();
      if (eng) { location.hash = '#/'; eng.play({ force: true }); }
    });
    if (SITE.introAnimation && SITE.introAnimation.mode === 'never') $('#replay-intro').hidden = true;

    // footer
    var year = new Date().getFullYear();
    var socials = (SITE.social || []).map(function (s) {
      var ext = /^https?:/.test(s.url) ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + esc(s.url) + '"' + ext + '>' + esc(s.label) + '</a>';
    }).join('');
    $('#footer').innerHTML = '<span>' + esc((SITE.footer || '').replace('{year}', year)) + '</span><span class="links">' + socials + '</span>';
  }
  function menuHtml(list, base, allLabel, allHref, emptyLabel) {
    if (!list.length) return '<div class="menu-empty">' + esc(emptyLabel) + '</div>';
    return list.map(function (item, i) {
      return '<a href="' + base + encodeURIComponent(item.slug) + '" role="menuitem" data-slug="' + esc(item.slug) + '">' +
        '<span class="n">' + U.pad2(i + 1) + '</span><span class="t">' + esc(item.title) + '</span><span class="arrow">' + ARROW + '</span></a>';
    }).join('') + '<a class="menu-all" href="' + allHref + '" role="menuitem"><span>' + esc(allLabel) + '</span><span class="arrow" style="opacity:1;transform:none">' + ARROW + '</span></a>';
  }
  function closeMenus() {
    $$('.has-menu.open').forEach(function (li) {
      li.classList.remove('open');
      var b = li.querySelector('.menu-toggle'); if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  function setNavOpen(open) {
    document.body.classList.toggle('nav-open', open);
    $('#nav-toggle').setAttribute('aria-expanded', open ? 'true' : 'false');
    if (!open) closeMenus();
  }
  function setActiveTab(name) {
    $$('.tabs a[data-nav]').forEach(function (a) { a.classList.toggle('active', a.dataset.nav === name); });
    $$('.menu a[data-slug]').forEach(function (a) { a.classList.remove('active'); });
  }
  function markMenuActive(kind, slug) {
    $$('#menu-' + kind + ' a[data-slug]').forEach(function (a) { a.classList.toggle('active', a.dataset.slug === slug); });
  }

  /* ================= left pop-up rail ================= */
  var railScrim = null, railPinned = false, railHoverTimer = 0;
  function initRail() {
    railScrim = document.createElement('div');
    railScrim.className = 'rail-scrim';
    document.body.appendChild(railScrim);
    railScrim.addEventListener('click', function () { setRailOpen(false); });
    railTab.addEventListener('click', function () {
      railPinned = !rail.classList.contains('open');
      setRailOpen(railPinned);
    });
    var canHover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
    if (canHover) {
      railTab.addEventListener('mouseenter', function () { clearTimeout(railHoverTimer); setRailOpen(true); });
      rail.addEventListener('mouseleave', function () {
        clearTimeout(railHoverTimer);
        railHoverTimer = setTimeout(function () { if (!railPinned) setRailOpen(false); }, 250);
      });
      rail.addEventListener('mouseenter', function () { clearTimeout(railHoverTimer); });
    }
    railList.addEventListener('click', function (e) {
      var a = e.target.closest('a');
      if (!a) return;
      if (a.dataset.scroll) { e.preventDefault(); scrollToSection(a.dataset.scroll); history.replaceState(null, '', a.getAttribute('href')); markRailActive(a.dataset.scroll); }
      railPinned = false;
      setRailOpen(false);
    });
  }
  function setRailOpen(open) {
    if (rail.hidden) open = false;
    rail.classList.toggle('open', open);
    railTab.setAttribute('aria-expanded', open ? 'true' : 'false');
    var mobile = window.matchMedia && window.matchMedia('(max-width: 760px)').matches;
    railScrim.classList.toggle('show', open && mobile);
    if (!open) railPinned = false;
  }
  /** items: [{ href, label, sub, id, scroll }] */
  function setRail(opts) {
    if (!opts) { rail.hidden = true; document.body.classList.remove('has-rail'); setRailOpen(false); return; }
    rail.hidden = false;
    setRailOpen(false);
    document.body.classList.add('has-rail');
    $('#rail-tab-label').textContent = opts.tabLabel || opts.title;
    $('#rail-kicker').textContent = opts.kicker || 'Jump to';
    $('#rail-title').textContent = opts.title;
    railList.className = 'rail-list' + (opts.serif ? ' serif' : '');
    railList.innerHTML = opts.items.map(function (it) {
      return '<li><a href="' + esc(it.href) + '"' + (it.scroll ? ' data-scroll="' + esc(it.scroll) + '"' : '') + ' data-id="' + esc(it.id || '') + '"' + (it.active ? ' class="active" aria-current="page"' : '') + '>' +
        '<span><span class="t">' + esc(it.label) + '</span>' + (it.sub ? '<span class="s">' + esc(it.sub) + '</span>' : '') + '</span></a></li>';
    }).join('');
  }
  function markRailActive(id) {
    $$('#rail-list a').forEach(function (a) { a.classList.toggle('active', a.dataset.id === id); });
  }

  /* ================= shared pieces ================= */
  function pagerHtml(list, idx, base, backHref, backLabel, serif) {
    var prev = idx > 0 ? list[idx - 1] : null;
    var next = idx < list.length - 1 ? list[idx + 1] : null;
    pagerKeys = { prev: prev ? base + encodeURIComponent(prev.slug) : null, next: next ? base + encodeURIComponent(next.slug) : null };
    return '<nav class="pager' + (serif ? ' serif' : '') + '" aria-label="Previous and next">' +
      '<a class="prev' + (prev ? '' : ' disabled') + '" href="' + (prev ? base + encodeURIComponent(prev.slug) : '#') + '"><span class="k">← Previous</span><span class="t">' + (prev ? esc(prev.title) : 'Start of list') + '</span></a>' +
      '<a class="btn return" href="' + backHref + '"><span class="arrow">↩</span>' + esc(backLabel) + '</a>' +
      '<a class="next' + (next ? '' : ' disabled') + '" href="' + (next ? base + encodeURIComponent(next.slug) : '#') + '"><span class="k">Next →</span><span class="t">' + (next ? esc(next.title) : 'End of list') + '</span></a>' +
      '</nav>';
  }
  function linksHtml(links) {
    if (!links || !links.length) return '';
    return '<ul class="link-list">' + links.map(function (l) {
      var ext = /^https?:/.test(l.url) ? ' target="_blank" rel="noopener"' : '';
      return '<li><a href="' + esc(l.url) + '"' + ext + '><span class="arrow">→</span>' + esc(l.label) + '</a></li>';
    }).join('') + '</ul>';
  }
  function chipsHtml(items, cls, hrefFn) {
    if (!items || !items.length) return '';
    return '<div class="chips">' + items.map(function (t) {
      return hrefFn ? '<a class="chip ' + cls + '" href="' + hrefFn(t) + '">' + esc(t) + '</a>' : '<span class="chip ' + cls + '">' + esc(t) + '</span>';
    }).join('') + '</div>';
  }
  function wordNote(text, limit, what) {
    var n = U.wordCount(text);
    var over = n > limit;
    if (over) console.warn('[content] ' + what + ' is ' + n + ' words; the limit is ' + limit + '.');
    return '<span class="word-note' + (over ? ' over' : '') + '">' + n + ' / ' + limit + ' words' + (over ? ' · over the limit' : '') + '</span>';
  }
  function embedHtml(embed, title) {
    if (!embed || !embed.type) {
      return '<div class="embed"><div style="position:absolute;inset:0;display:grid;place-items:center;color:var(--muted);font-family:var(--font-mono);font-size:.7rem;letter-spacing:.14em;text-transform:uppercase">No preview yet</div></div>' +
        '<div class="embed-bar"><span>Preview</span></div>';
    }
    var t = esc(title || 'Project preview');
    switch (embed.type) {
      case 'iframe':
        return '<div class="embed"><iframe src="' + esc(embed.src) + '" title="' + t + '" loading="lazy" allow="fullscreen; autoplay; gamepad"></iframe></div>' +
          '<div class="embed-bar"><span class="live">Live demo · interactive</span><a href="' + esc(embed.src) + '" target="_blank" rel="noopener">Open full size ↗</a></div>';
      case 'youtube':
        return '<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/' + esc(embed.id) + '" title="' + t + '" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div>' +
          '<div class="embed-bar"><span>Video · YouTube</span><a href="https://www.youtube.com/watch?v=' + esc(embed.id) + '" target="_blank" rel="noopener">Watch on YouTube ↗</a></div>';
      case 'video':
        return '<div class="embed"><video controls playsinline preload="metadata"' + (embed.poster ? ' poster="' + esc(embed.poster) + '"' : '') + ' src="' + esc(embed.src) + '"></video></div>' +
          '<div class="embed-bar"><span>Video</span><a href="' + esc(embed.src) + '" target="_blank" rel="noopener">Open video ↗</a></div>';
      case 'image':
      default:
        return '<div class="embed' + (embed.fit === 'contain' ? ' contain' : '') + '"><img src="' + esc(embed.src) + '" alt="' + esc(embed.alt || title || '') + '"></div>' +
          '<div class="embed-bar"><span>Image</span><a href="' + esc(embed.src) + '" target="_blank" rel="noopener">Open full size ↗</a></div>';
    }
  }
  function eyebrow(num, label) {
    return '<p class="eyebrow"><b>' + esc(num) + '</b><span>' + esc(label) + '</span></p>';
  }

  /* ================= views ================= */
  function viewHome() {
    var name = SITE.name || 'Your Name';
    var parts = name.split(' ');
    var big = parts.length > 1 ? esc(parts[0]) + '<br>' + esc(parts.slice(1).join(' ')) : esc(name);
    var interests = (SITE.interests || []).map(function (i) { return '<span><b>' + esc(i.icon || '') + '</b>' + esc(i.label) + '</span>'; }).join('');
    var latest = '';
    if (HOME.showLatest && (PROJECTS.length || POSTS.length)) {
      var fp = PROJECTS.filter(function (p) { return p.featured; })[0] || PROJECTS[0];
      var lp = POSTS[0];
      latest = '<section class="section-gap view">' + eyebrow('02', 'Latest') + '<div class="latest">' +
        (fp ? '<a class="card" href="#/projects/' + encodeURIComponent(fp.slug) + '"><span class="k">Featured project</span><span class="t">' + esc(fp.title) + '</span><span class="d">' + esc(fp.tagline || '') + '</span><span class="arrow">Open project →</span></a>' : '') +
        (lp ? '<a class="card serif" href="#/blog/' + encodeURIComponent(lp.slug) + '"><span class="k">Latest post · ' + esc(U.fmtDate(lp.date)) + '</span><span class="t">' + esc(lp.title) + '</span><span class="d">' + esc(lp.summary || '') + '</span><span class="arrow">Read post →</span></a>' : '') +
        '</div></section>';
    }
    return '<section class="hero view">' + eyebrow('01', 'Hello') +
      '<h1 class="hero-title">' + big + '<span class="dot">.</span></h1>' +
      (SITE.tagline ? '<p class="hero-tagline">' + esc(SITE.tagline) + '</p>' : '') +
      (SITE.intro ? '<div class="subcopy prose">' + MD.render(SITE.intro) + '</div>' : '') +
      '<div class="hero-actions">' +
      '<a class="btn btn-primary" href="#/projects">' + esc(HOME.projectsLabel) + '<span class="arrow">→</span></a>' +
      '<a class="btn" href="#/blog">' + esc(HOME.blogLabel) + '<span class="arrow">→</span></a>' +
      '<a class="btn" href="#/about">' + esc(HOME.aboutLabel) + '<span class="arrow">→</span></a>' +
      '</div>' +
      (interests ? '<div class="interests">' + interests + '</div>' : '') +
      '</section>' + latest;
  }

  function viewProjectsIndex() {
    var rows = PROJECTS.map(function (p, i) {
      return '<li><a class="row" href="#/projects/' + encodeURIComponent(p.slug) + '">' +
        '<span class="row-num">' + U.pad2(i + 1) + '</span>' +
        '<span class="row-title">' + esc(p.title) + (p.tagline ? '<span class="row-sub">' + esc(p.tagline) + '</span>' : '') + '</span>' +
        '<span class="row-meta"><span>' + esc(U.fmtDate(p.date)) + '</span><span>' + esc((p.tech || []).slice(0, 3).join(' · ')) + '</span></span>' +
        '<span class="row-arrow">' + ARROW + '</span></a></li>';
    }).join('');
    return '<section class="view">' + eyebrow('02', 'Projects') +
      '<h1 class="headline">Things I’ve built<span class="dot">.</span></h1>' +
      '<p class="subcopy">' + PROJECTS.length + ' project' + (PROJECTS.length === 1 ? '' : 's') + '. Click a title to open it; each project page has a live demo, video or image on the left and the story on the right.</p>' +
      (rows ? '<ol class="rows">' + rows + '</ol>' : '<p class="empty">No projects yet. Add one in <code>content/projects.js</code>.</p>') +
      '</section>';
  }

  function viewProject(slug) {
    var idx = PROJECTS.findIndex(function (p) { return p.slug === slug; });
    if (idx < 0) return null;
    var p = PROJECTS[idx];
    var body = p.descriptionHtml || MD.render(p.description || '');
    return '<article class="view">' + eyebrow('Project ' + U.pad2(idx + 1), '/ ' + U.pad2(PROJECTS.length) + (p.date ? ' · ' + U.fmtDate(p.date) : '')) +
      '<div class="detail">' +
      '<div class="detail-media">' + embedHtml(p.embed, p.title) + '</div>' +
      '<div class="detail-body">' +
      '<h1 class="title">' + esc(p.title) + '</h1>' +
      (p.tagline ? '<p class="tagline">' + esc(p.tagline) + '</p>' : '') +
      '<div class="prose">' + body + '</div>' +
      '<div class="detail-aside">' +
      (p.tech && p.tech.length ? '<div><span class="k word-note">Built with</span>' + chipsHtml(p.tech, 'tech') + '</div>' : '') +
      (p.links && p.links.length ? '<div><span class="k word-note">Links</span>' + linksHtml(p.links) + '</div>' : '') +
      wordNote(p.description || '', LIMITS.projectWords, 'Project "' + p.title + '" description') +
      '</div></div></div>' +
      pagerHtml(PROJECTS, idx, '#/projects/', '#/projects', 'All projects', false) +
      '</article>';
  }

  function allTags() {
    var counts = {};
    POSTS.forEach(function (p) { (p.tags || []).forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
    return Object.keys(counts).sort().map(function (t) { return { tag: t, n: counts[t] }; });
  }
  function viewBlogIndex(tag) {
    var list = tag ? POSTS.filter(function (p) { return (p.tags || []).indexOf(tag) >= 0; }) : POSTS;
    var tags = allTags();
    var filter = tags.length ? '<div class="filter-bar"><span class="k">Filter</span>' +
      '<a class="chip' + (tag ? '' : ' active') + '" href="#/blog">All · ' + POSTS.length + '</a>' +
      tags.map(function (t) { return '<a class="chip' + (t.tag === tag ? ' active' : '') + '" href="#/blog/tag/' + encodeURIComponent(t.tag) + '">' + esc(t.tag) + ' · ' + t.n + '</a>'; }).join('') + '</div>' : '';
    var rows = list.map(function (p) {
      var d = p.date ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(p.date) ? p.date + 'T12:00:00' : p.date) : null;
      var short = d && !isNaN(d) ? d.toLocaleDateString(undefined, { month: 'short', day: '2-digit' }) : '';
      return '<li><a class="row" href="#/blog/' + encodeURIComponent(p.slug) + '">' +
        '<span class="row-num">' + esc(short) + '</span>' +
        '<span class="row-title">' + esc(p.title) + (p.summary ? '<span class="row-sub">' + esc(p.summary) + '</span>' : '') + '</span>' +
        '<span class="row-meta"><span>' + esc(d && !isNaN(d) ? d.getFullYear() : '') + '</span><span>' + esc((p.tags || []).join(' · ')) + '</span></span>' +
        '<span class="row-arrow">' + ARROW + '</span></a></li>';
    }).join('');
    return '<section class="view">' + eyebrow('03', 'Blog' + (tag ? ' · ' + tag : '')) +
      '<h1 class="headline" style="font-family:var(--font-serif);font-weight:500;letter-spacing:-.01em">Notes, posts and<br>the occasional rant<span class="dot">.</span></h1>' +
      '<p class="subcopy" style="font-family:var(--font-serif);font-size:1.25rem">' + (tag ? list.length + ' post' + (list.length === 1 ? '' : 's') + ' tagged “' + esc(tag) + '”.' : 'Click a title to read. Tags filter the list.') + '</p>' +
      filter +
      (rows ? '<ol class="rows serif">' + rows + '</ol>' : '<p class="empty">Nothing here yet.</p>') +
      '</section>';
  }

  function viewPost(slug) {
    var idx = POSTS.findIndex(function (p) { return p.slug === slug; });
    if (idx < 0) return null;
    var p = POSTS[idx];
    var body = p.bodyHtml || MD.render(p.body || '');
    var img = p.image && p.image.src ? '<figure style="margin:0"><img class="post-image" src="' + esc(p.image.src) + '" alt="' + esc(p.image.alt || '') + '">' + (p.image.caption ? '<figcaption class="media-caption">' + esc(p.image.caption) + '</figcaption>' : '') + '</figure>' : '';
    return '<article class="view">' + eyebrow('Post ' + U.pad2(idx + 1), '/ ' + U.pad2(POSTS.length)) +
      '<div class="detail blog' + (img ? '' : ' no-image') + '">' +
      '<div class="detail-media">' + img +
      '<div class="meta-block">' +
      (p.date ? '<div><span class="k">Published</span><span class="v">' + esc(U.fmtDate(p.date)) + '</span></div>' : '') +
      (p.tags && p.tags.length ? '<div><span class="k">Tags</span>' + chipsHtml(p.tags, '', function (t) { return '#/blog/tag/' + encodeURIComponent(t); }) + '</div>' : '') +
      (p.links && p.links.length ? '<div><span class="k">Links</span>' + linksHtml(p.links) + '</div>' : '') +
      '<div>' + wordNote(p.body || '', LIMITS.blogWords, 'Post "' + p.title + '"') + '</div>' +
      '</div></div>' +
      '<div class="detail-body">' +
      '<h1 class="title">' + esc(p.title) + '</h1>' +
      (p.summary ? '<p class="tagline">' + esc(p.summary) + '</p>' : '') +
      '<div class="prose serif">' + body + '</div>' +
      '</div></div>' +
      pagerHtml(POSTS, idx, '#/blog/', '#/blog', 'All posts', true) +
      '</article>';
  }

  function viewAbout() {
    var facts = (ABOUT.facts || []).map(function (f) {
      var v = f.url ? '<a href="' + esc(f.url) + '"' + (/^https?:/.test(f.url) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(f.value) + '</a>' : esc(f.value);
      return '<div><span class="k">' + esc(f.label) + '</span><span class="v">' + v + '</span></div>';
    }).join('');
    var actions = (ABOUT.resumePdf ? '<a class="btn btn-primary" href="' + esc(ABOUT.resumePdf) + '" target="_blank" rel="noopener">Download résumé<span class="arrow">↓</span></a>' : '') +
      (SITE.social || []).map(function (s) { return '<a class="btn" href="' + esc(s.url) + '"' + (/^https?:/.test(s.url) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(s.label) + '<span class="arrow">↗</span></a>'; }).join('');
    var sections = ABOUT.sections.map(function (s, i) {
      var inner = '';
      if (s.items) {
        inner += '<div class="items">' + s.items.map(function (it) {
          var title = it.link && it.link.url ? '<a href="' + esc(it.link.url) + '"' + (/^https?:/.test(it.link.url) ? ' target="_blank" rel="noopener"' : '') + '>' + esc(it.title) + '</a>' : esc(it.title);
          return '<div class="item">' +
            '<div class="item-title">' + title + '</div>' +
            (it.subtitle ? '<div class="item-sub">' + esc(it.subtitle) + '</div>' : '<div></div>') +
            ((it.period || it.location) ? '<div class="item-period">' + esc(it.period || '') + (it.location ? '<small>' + esc(it.location) + '</small>' : '') + '</div>' : '') +
            (it.details && it.details.length ? '<ul>' + it.details.map(function (d) { return '<li>' + MD.inline(d) + '</li>'; }).join('') + '</ul>' : '') +
            (it.tags && it.tags.length ? chipsHtml(it.tags, 'tech') : '') +
            '</div>';
        }).join('') + '</div>';
      }
      if (s.groups) {
        inner += '<div class="skill-groups">' + s.groups.map(function (g) {
          return '<div class="skill-group"><span class="k">' + esc(g.name) + '</span>' + chipsHtml(g.items, '') + '</div>';
        }).join('') + '</div>';
      }
      if (s.text) inner += '<div class="prose">' + MD.render(s.text) + '</div>';
      return '<section class="resume-section" id="sec-' + esc(s.id) + '"><h2><span class="n">' + U.pad2(i + 1) + '</span>' + esc(s.title) + '</h2><div>' + inner + '</div></section>';
    }).join('');
    return '<section class="view" id="sec-top">' + eyebrow('04', 'About') +
      '<div class="about-hero">' +
      (ABOUT.photo ? '<img class="avatar-lg" src="' + esc(ABOUT.photo) + '" alt="Photo of ' + esc(ABOUT.name || SITE.name || '') + '">' : '') +
      '<div><h1 class="name">' + esc(ABOUT.name || SITE.name || '') + '</h1>' +
      (ABOUT.headline ? '<p class="role">' + esc(ABOUT.headline) + '</p>' : '') +
      (ABOUT.blurb ? '<div class="about-blurb prose">' + MD.render(ABOUT.blurb) + '</div>' : '') +
      (facts ? '<div class="facts">' + facts + '</div>' : '') +
      (actions ? '<div class="about-actions">' + actions + '</div>' : '') +
      '</div></div>' +
      (sections ? '<div class="resume">' + sections + '</div>' : '') +
      '</section>';
  }

  function viewCheck() {
    function row(kind, title, words, limit, issues) {
      var cls = words > limit ? 'bad' : (words > limit * 0.9 ? 'warn' : 'ok');
      return '<tr><td>' + esc(kind) + '</td><td>' + esc(title) + '</td><td class="' + cls + '">' + words + ' / ' + limit + '</td><td>' + (issues.length ? '<span class="warn">' + issues.map(esc).join('<br>') + '</span>' : '<span class="ok">OK</span>') + '</td></tr>';
    }
    var rows = [];
    var slugs = {};
    PROJECTS.forEach(function (p) {
      var issues = [];
      if (!p.title) issues.push('missing title');
      if (!p.embed || !p.embed.type) issues.push('no embed (iframe / image / video / youtube)');
      if (p.embed && p.embed.type !== 'youtube' && !p.embed.src) issues.push('embed has no src');
      if (p.embed && p.embed.type === 'youtube' && !p.embed.id) issues.push('youtube embed has no id');
      if (slugs['p:' + p.slug]) issues.push('duplicate slug'); slugs['p:' + p.slug] = 1;
      rows.push(row('Project', p.title || '(untitled)', U.wordCount(p.description || ''), LIMITS.projectWords, issues));
    });
    POSTS.forEach(function (p) {
      var issues = [];
      if (!p.title) issues.push('missing title');
      if (!p.date) issues.push('missing date');
      if (!p.tags || !p.tags.length) issues.push('no tags');
      if (slugs['b:' + p.slug]) issues.push('duplicate slug'); slugs['b:' + p.slug] = 1;
      rows.push(row('Post', p.title || '(untitled)', U.wordCount(p.body || ''), LIMITS.blogWords, issues));
    });
    return '<section class="view">' + eyebrow('00', 'Content check') +
      '<h1 class="headline">Content check<span class="dot">.</span></h1>' +
      '<p class="subcopy">Word counts against the limits in <code>content/site.js</code>, plus anything that looks missing.</p>' +
      '<table class="check-table"><thead><tr><th>Type</th><th>Title</th><th>Words</th><th>Issues</th></tr></thead><tbody>' + rows.join('') + '</tbody></table>' +
      '<p class="subcopy" style="margin-top:2rem">About page: ' + (ABOUT.photo ? 'photo set' : '<span class="warn">no photo</span>') + ' · ' + ABOUT.sections.length + ' résumé section' + (ABOUT.sections.length === 1 ? '' : 's') + ' · ' + (ABOUT.resumePdf ? 'résumé PDF linked' : 'no résumé PDF (optional)') + '</p>' +
      '</section>';
  }

  function viewNotFound() {
    return '<section class="view">' + eyebrow('404', 'Not found') +
      '<h1 class="headline">Nothing here<span class="dot">.</span></h1>' +
      '<p class="subcopy">That link does not point at anything (yet).</p>' +
      '<div class="hero-actions"><a class="btn btn-primary" href="#/">Home<span class="arrow">→</span></a><a class="btn" href="#/projects">Projects<span class="arrow">→</span></a><a class="btn" href="#/blog">Blog<span class="arrow">→</span></a></div></section>';
  }

  /* ================= router ================= */
  function scrollToSection(id) {
    var el = document.getElementById('sec-' + id);
    if (!el) return;
    if (id === 'top') { window.scrollTo({ top: 0, behavior: U.prefersReducedMotion() ? 'auto' : 'smooth' }); return; }
    el.scrollIntoView({ behavior: U.prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  }
  function scrollTop() { try { window.scrollTo({ top: 0, behavior: 'instant' }); } catch (e) { window.scrollTo(0, 0); } }

  function railForProjects(active) {
    return { tabLabel: 'Projects', kicker: 'Jump to', title: 'Projects',
      items: PROJECTS.map(function (p) { return { href: '#/projects/' + encodeURIComponent(p.slug), label: p.title, sub: (p.tech || []).slice(0, 2).join(' · '), id: p.slug, active: p.slug === active }; }) };
  }
  function railForBlog(active) {
    return { tabLabel: 'Posts', kicker: 'Jump to', title: 'Posts', serif: true,
      items: POSTS.map(function (p) { return { href: '#/blog/' + encodeURIComponent(p.slug), label: p.title, sub: U.fmtDate(p.date), id: p.slug, active: p.slug === active }; }) };
  }
  function railForAbout(active) {
    var items = [{ href: '#/about', label: 'Top', sub: 'Intro & picture', id: 'top', scroll: 'top', active: !active || active === 'top' }];
    ABOUT.sections.forEach(function (s) { items.push({ href: '#/about/' + encodeURIComponent(s.id), label: s.title, id: s.id, scroll: s.id, active: s.id === active }); });
    return { tabLabel: 'Sections', kicker: 'Jump to', title: 'About', items: items };
  }

  function render() {
    var route = U.parseHash(location.hash);
    var parts = route.parts;
    var head = parts[0] || '';
    var html = '', title = SITE.name || '', view = 'home', tab = 'home', railOpts = null;
    pagerKeys = null;
    closeMenus(); setNavOpen(false);

    if (!head) { html = viewHome(); }
    else if (head === 'projects') {
      tab = 'projects';
      if (parts[1]) { html = viewProject(parts[1]); view = 'project'; if (html) { title = PROJECTS.find(function (p) { return p.slug === parts[1]; }).title + ' · ' + title; markMenuActive('projects', parts[1]); } railOpts = railForProjects(parts[1]); }
      else { html = viewProjectsIndex(); view = 'projects'; title = 'Projects · ' + title; railOpts = railForProjects(null); }
    }
    else if (head === 'blog') {
      tab = 'blog';
      if (parts[1] === 'tag' && parts[2]) { html = viewBlogIndex(parts[2]); view = 'blog'; title = 'Blog · ' + parts[2] + ' · ' + title; railOpts = railForBlog(null); }
      else if (parts[1]) { html = viewPost(parts[1]); view = 'post'; if (html) { title = POSTS.find(function (p) { return p.slug === parts[1]; }).title + ' · ' + title; markMenuActive('blog', parts[1]); } railOpts = railForBlog(parts[1]); }
      else { html = viewBlogIndex(null); view = 'blog'; title = 'Blog · ' + title; railOpts = railForBlog(null); }
    }
    else if (head === 'about') {
      tab = 'about'; view = 'about'; title = 'About · ' + title;
      if (currentView === 'about') { // same page: just scroll to the section
        setRail(railForAbout(parts[1] || null)); markRailActive(parts[1] || 'top'); scrollToSection(parts[1] || 'top'); setActiveTab(tab); document.title = title; return;
      }
      html = viewAbout(); railOpts = railForAbout(parts[1] || null);
    }
    else if (head === 'check') { html = viewCheck(); view = 'check'; tab = ''; title = 'Content check · ' + title; }

    if (!html) { html = viewNotFound(); view = '404'; title = 'Not found · ' + title; tab = ''; railOpts = null; }

    main.innerHTML = html;
    currentView = view;
    document.title = title;
    setActiveTab(tab);
    setRail(railOpts);
    MD.typeset(main);
    if (view === 'about' && parts[1]) { setTimeout(function () { scrollToSection(parts[1]); }, 30); }
    else scrollTop();
  }

  // Keyboard: ← / → move between projects or posts on a detail page.
  document.addEventListener('keydown', function (e) {
    if (!pagerKeys || e.metaKey || e.ctrlKey || e.altKey) return;
    var tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || (e.target && e.target.isContentEditable)) return;
    if (e.key === 'ArrowLeft' && pagerKeys.prev) location.hash = pagerKeys.prev;
    if (e.key === 'ArrowRight' && pagerKeys.next) location.hash = pagerKeys.next;
  });

  /* ================= boot ================= */
  /** The intro renderer: 3D (Three.js) when available and enabled, otherwise the 2D SVG version. */
  function introEngine() {
    var ia = SITE.introAnimation || {};
    if (ia.style !== '2d' && window.Intro3D && window.Intro3D.supported()) return window.Intro3D;
    return window.Intro || null;
  }
  function boot() {
    initTheme();
    initChrome();
    initRail();
    if (window.Background && SITE.background && SITE.background.enabled !== false) {
      window.Background.start($('#bg'), SITE.background);
    }
    window.addEventListener('hashchange', render);
    render();
    // KaTeX loads after the first render (deferred); typeset again once it is ready.
    document.addEventListener('katex-ready', function () { MD.typeset(main); });

    // Intro: plays on the home page, once per session by default (see content/site.js).
    var ia = Object.assign({ mode: 'session', skippable: true }, SITE.introAnimation || {});
    var onHome = !U.parseHash(location.hash).parts.length;
    var seen = U.session.get('introSeen') === '1';
    var eng = introEngine();
    var should = eng && onHome && ia.mode !== 'never' && !(ia.mode === 'session' && seen) && !U.prefersReducedMotion();
    if (should) eng.play({});
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
})();
