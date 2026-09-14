/* Small shared helpers. Everything hangs off window.U so the plain <script> files can share it. */
window.U = (function () {
  'use strict';

  /** Escape text for safe insertion into HTML. */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** Count words the way a human would (whitespace separated tokens). Markdown syntax is stripped first. */
  function wordCount(s) {
    var text = String(s || '')
      .replace(/```[\s\S]*?```/g, ' ')      // code blocks
      .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ') // images
      .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // links -> label
      .replace(/[#>*_`~-]+/g, ' ');
    var m = text.trim().match(/\S+/g);
    return m ? m.length : 0;
  }

  function slugify(s) {
    return String(s || '')
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/[\s_-]+/g, '-');
  }

  /** "2025-03-14" -> "Mar 14, 2025". Anything unparsable is returned unchanged. */
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? iso + 'T12:00:00' : iso);
    if (isNaN(d.getTime())) return String(iso);
    return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  }

  function pad2(n) { return String(n).padStart(2, '0'); }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function lerp(a, b, t) { return a + (b - a) * t; }

  /** Parse a hash like "#/blog/tag/math" into { parts: ['blog','tag','math'], path: '/blog/tag/math' }. */
  function parseHash(hash) {
    var h = (hash || '').replace(/^#/, '');
    if (!h.startsWith('/')) h = '/' + h;
    var parts = h.split('/').filter(Boolean).map(function (p) { try { return decodeURIComponent(p); } catch (e) { return p; } });
    return { path: h, parts: parts };
  }

  /** Build an element from an HTML string (first element). */
  function html(str) {
    var t = document.createElement('template');
    t.innerHTML = str.trim();
    return t.content.firstElementChild;
  }

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  /** sessionStorage / localStorage wrappers that never throw (private mode, file://, etc.). */
  function store(kind) {
    return {
      get: function (k) { try { return window[kind].getItem(k); } catch (e) { return null; } },
      set: function (k, v) { try { window[kind].setItem(k, v); } catch (e) { /* ignore */ } },
      del: function (k) { try { window[kind].removeItem(k); } catch (e) { /* ignore */ } }
    };
  }

  function prefersReducedMotion() {
    return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  return {
    esc: esc, wordCount: wordCount, slugify: slugify, fmtDate: fmtDate, pad2: pad2,
    clamp: clamp, lerp: lerp, parseHash: parseHash, html: html, $: $, $$: $$,
    session: store('sessionStorage'), local: store('localStorage'),
    prefersReducedMotion: prefersReducedMotion
  };
})();
