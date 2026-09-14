/* A small Markdown renderer. Supports: headings (#..####), paragraphs, **bold**, *italic*, ~~strike~~,
   `code`, ```fenced code```, [links](url), ![images](src), unordered (-, *) and ordered (1.) lists,
   > blockquotes, --- rules, and leaves $...$ / $$...$$ alone so KaTeX (if loaded) can render math.
   Raw HTML is escaped. If you want raw HTML, use `bodyHtml` / `descriptionHtml` in the content files. */
window.MD = (function () {
  'use strict';
  var esc = window.U.esc;
  var Z = String.fromCharCode(0); // sentinel used to protect code / math while styling runs
  var CODE_RE = new RegExp(Z + 'C(\\d+)' + Z, 'g');
  var MATH_RE = new RegExp(Z + 'M(\\d+)' + Z, 'g');

  function inline(text) {
    var codes = [];
    var maths = [];
    text = text.replace(/`([^`]+)`/g, function (_, c) { codes.push('<code>' + esc(c) + '</code>'); return Z + 'C' + (codes.length - 1) + Z; });
    text = text.replace(/\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$/g, function (m) { maths.push(esc(m)); return Z + 'M' + (maths.length - 1) + Z; });
    text = esc(text);
    text = text.replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (_, alt, src, title) {
      return '<img src="' + src + '" alt="' + alt + '"' + (title ? ' title="' + title + '"' : '') + ' loading="lazy">';
    });
    text = text.replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)/g, function (_, label, href, title) {
      var ext = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener"' : '';
      return '<a href="' + href + '"' + (title ? ' title="' + title + '"' : '') + ext + '>' + label + '</a>';
    });
    text = text.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/(^|[^*\w])\*([^*\n]+)\*(?!\w)/g, '$1<em>$2</em>');
    text = text.replace(/~~([^~]+)~~/g, '<del>$1</del>');
    text = text.replace(CODE_RE, function (_, i) { return codes[+i]; });
    text = text.replace(MATH_RE, function (_, i) { return maths[+i]; });
    return text;
  }

  function render(src) {
    if (src == null) return '';
    var lines = String(src).replace(/\r\n?/g, '\n').split('\n');
    var out = [];
    var para = [];
    var list = null; // { type: 'ul'|'ol', items: [] }
    var quote = [];

    function flushPara() {
      if (para.length) { out.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; }
    }
    function flushList() {
      if (list) {
        out.push('<' + list.type + '>' + list.items.map(function (i) { return '<li>' + inline(i) + '</li>'; }).join('') + '</' + list.type + '>');
        list = null;
      }
    }
    function flushQuote() {
      if (quote.length) { out.push('<blockquote>' + render(quote.join('\n')) + '</blockquote>'); quote = []; }
    }
    function flushAll() { flushPara(); flushList(); flushQuote(); }

    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];

      var fence = line.match(/^```(\w*)\s*$/);
      if (fence) {
        flushAll();
        var buf = [];
        i++;
        while (i < lines.length && !/^```\s*$/.test(lines[i])) { buf.push(lines[i]); i++; }
        out.push('<pre><code' + (fence[1] ? ' class="lang-' + esc(fence[1]) + '"' : '') + '>' + esc(buf.join('\n')) + '</code></pre>');
        continue;
      }
      if (/^\$\$\s*$/.test(line)) {
        flushAll();
        var mbuf = [];
        i++;
        while (i < lines.length && !/^\$\$\s*$/.test(lines[i])) { mbuf.push(lines[i]); i++; }
        out.push('<div class="math-block">$$' + esc(mbuf.join('\n')) + '$$</div>');
        continue;
      }
      if (/^\s*$/.test(line)) { flushAll(); continue; }

      var h = line.match(/^(#{1,4})\s+(.*)$/);
      if (h) { flushAll(); var lvl = h[1].length + 1; out.push('<h' + lvl + '>' + inline(h[2].trim()) + '</h' + lvl + '>'); continue; }

      if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) { flushAll(); out.push('<hr>'); continue; }

      var q = line.match(/^>\s?(.*)$/);
      if (q) { flushPara(); flushList(); quote.push(q[1]); continue; }
      else if (quote.length) { flushQuote(); }

      var ul = line.match(/^\s*[-*+]\s+(.*)$/);
      var ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
      if (ul || ol) {
        flushPara();
        var type = ul ? 'ul' : 'ol';
        if (!list || list.type !== type) { flushList(); list = { type: type, items: [] }; }
        list.items.push((ul || ol)[1]);
        continue;
      }
      if (list && /^\s{2,}\S/.test(line)) { list.items[list.items.length - 1] += ' ' + line.trim(); continue; }
      if (list) flushList();

      para.push(line.trim());
    }
    flushAll();
    return out.join('\n');
  }

  /** Render math inside `root` if KaTeX auto-render is present. Safe to call when it is not. */
  function typeset(root) {
    if (typeof window.renderMathInElement === 'function' && root) {
      try {
        window.renderMathInElement(root, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '$', right: '$', display: false }
          ],
          throwOnError: false
        });
      } catch (e) { /* leave the raw TeX visible */ }
    }
  }

  return { render: render, inline: inline, typeset: typeset };
})();
