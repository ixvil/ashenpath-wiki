/* Ashen Path wiki — navigation drawer, instant search, random page, spoiler gate. No dependencies. */
(function () {
  'use strict';
  var doc = document, body = doc.body, html = doc.documentElement;
  var LANG = body.getAttribute('data-lang') || 'en';
  var UI = {
    ru: {all: 'Все результаты', none: 'Ничего не найдено', spoiler: 'спойлер'},
    en: {all: 'All results', none: 'Nothing found', spoiler: 'spoiler'}
  }[LANG];

  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  /* ---- drawer */
  var burger = doc.querySelector('.burger'), scrim = doc.querySelector('.scrim');
  function setNav(open) {
    body.classList.toggle('nav-open', open);
    if (burger) burger.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (scrim) scrim.hidden = !open;
  }
  if (burger) burger.addEventListener('click', function () { setNav(!body.classList.contains('nav-open')); });
  if (scrim) scrim.addEventListener('click', function () { setNav(false); });
  doc.addEventListener('keydown', function (e) { if (e.key === 'Escape') setNav(false); });
  var cur = doc.querySelector('.side a.cur');
  if (cur && cur.scrollIntoView) { var side = doc.getElementById('side'); if (side) side.scrollTop = Math.max(0, cur.offsetTop - 160); }

  /* ---- spoiler gate */
  Array.prototype.forEach.call(doc.querySelectorAll('[data-spoil-ok]'), function (b) {
    b.addEventListener('click', function () { store('ashenwiki.spoilers', '1'); html.classList.add('spoil-ok'); });
  });

  /* ---- search index (lazy) */
  var INDEX = null, waiting = [];
  function withIndex(cb) {
    if (INDEX) return cb(INDEX);
    waiting.push(cb);
    if (waiting.length > 1) return;
    var s = doc.createElement('script');
    s.src = 'search.js';
    s.onload = function () { INDEX = window.ASHEN_INDEX || []; waiting.splice(0).forEach(function (f) { f(INDEX); }); };
    doc.head.appendChild(s);
  }
  function norm(s) { return (s || '').toLowerCase().replace(/ё/g, 'е'); }
  function escH(s) { return String(s).replace(/[&<>"]/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]; }); }
  function search(q, idx) {
    var terms = norm(q).split(/\s+/).filter(Boolean);
    if (!terms.length) return [];
    var res = [];
    idx.forEach(function (p) {
      var t = norm(p.t), a = norm(p.a), s = norm(p.s), b = norm(p.b), score = 0, ok = true;
      terms.forEach(function (w) {
        var sc = 0;
        if (t.indexOf(w) === 0) sc = 60; else if (t.indexOf(' ' + w) >= 0) sc = 45; else if (t.indexOf(w) >= 0) sc = 35;
        else if (a.indexOf(w) >= 0) sc = 28; else if (s.indexOf(w) >= 0) sc = 14;
        else if (b.indexOf(w) >= 0) sc = 4 + Math.min(6, b.split(w).length - 1);
        if (!sc) ok = false; score += sc;
      });
      if (ok) { if (p.g) score -= 10; res.push({p: p, score: score}); }
    });
    res.sort(function (x, y) { return y.score - x.score || x.p.t.localeCompare(y.p.t); });
    return res.map(function (r) { return r.p; });
  }
  function snippet(p, q) {
    if (p.sp) return '[' + UI.spoiler + '] ' + (p.s || '');
    var w = norm(q).split(/\s+/).filter(Boolean)[0] || '', b = p.b || '', i = norm(b).indexOf(w);
    if (!w || i < 0 || norm(p.s).indexOf(w) >= 0) return p.s || b.slice(0, 140);
    var st = Math.max(0, i - 60);
    return (st ? '…' : '') + b.slice(st, i + 100) + '…';
  }
  function mark(text, q) {
    var out = escH(text);
    norm(q).split(/\s+/).filter(function (w) { return w.length > 1; }).forEach(function (w) {
      try { out = out.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/е/g, '[её]') + ')', 'gi'), '<mark>$1</mark>'); } catch (e) {}
    });
    return out;
  }

  /* ---- instant dropdown */
  var form = doc.querySelector('.top .search'), input = form && form.querySelector('input'), box = form && form.querySelector('.sr');
  var sel = -1;
  function render(q) {
    withIndex(function (idx) {
      if (input.value !== q) return;
      var r = search(q, idx).slice(0, 8);
      if (!q.trim()) { box.hidden = true; return; }
      var h = r.map(function (p) {
        return '<a href="' + p.id + '.html"><span class="cat">' + escH(p.c || '') + '</span><b>' + mark(p.t, q) + '</b><small>' + mark(snippet(p, q), q) + '</small></a>';
      }).join('');
      h += r.length ? '<a class="all" href="search.html?q=' + encodeURIComponent(q) + '">' + UI.all + ' →</a>' : '<a class="all" href="search.html?q=' + encodeURIComponent(q) + '">' + UI.none + '</a>';
      box.innerHTML = h; box.hidden = false; sel = -1;
    });
  }
  if (input) {
    input.addEventListener('focus', function () { withIndex(function () {}); });
    input.addEventListener('input', function () { render(input.value); });
    input.addEventListener('keydown', function (e) {
      var items = box.querySelectorAll('a');
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!items.length) return;
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
        Array.prototype.forEach.call(items, function (a, i) { a.classList.toggle('on', i === sel); });
      } else if (e.key === 'Enter' && sel >= 0 && items[sel]) { e.preventDefault(); location.href = items[sel].getAttribute('href'); }
      else if (e.key === 'Escape') { box.hidden = true; }
    });
    doc.addEventListener('click', function (e) { if (!form.contains(e.target)) box.hidden = true; });
  }

  /* ---- search results page */
  var results = doc.getElementById('results');
  if (results) {
    var q = (new URLSearchParams(location.search).get('q') || '').trim();
    var big = doc.querySelector('.search.big input');
    if (big) big.value = q;
    if (input) input.value = q;
    if (q) withIndex(function (idx) {
      var r = search(q, idx);
      var h = '<p class="count">' + escH(results.getAttribute('data-count').replace('{n}', r.length)) + '</p>';
      if (!r.length) h = '<p>' + escH(results.getAttribute('data-empty')) + '</p>';
      h += r.map(function (p) {
        return '<div class="r"><a href="' + p.id + '.html"' + (p.sp ? ' class="sp"' : '') + '>' + mark(p.t, q) + '</a><span class="c">' + escH(p.c || '') + '</span><p>' + mark(snippet(p, q), q) + '</p></div>';
      }).join('');
      results.innerHTML = h;
    });
  }

  /* ---- random page */
  function goRandom() {
    withIndex(function (idx) {
      var pool = idx.filter(function (p) { return !p.g && !p.sp && p.id !== 'index' && p.id !== body.getAttribute('data-page'); });
      if (pool.length) location.href = pool[Math.floor(Math.random() * pool.length)].id + '.html';
    });
  }
  Array.prototype.forEach.call(doc.querySelectorAll('[data-random]'), function (a) {
    a.addEventListener('click', function (e) { e.preventDefault(); goRandom(); });
  });
  if (doc.getElementById('random-go')) goRandom();

  /* ---- front page: rotate featured article daily, pick random "did you know" facts */
  var feat = doc.querySelector('[data-rotate]');
  if (feat) {
    var fs = feat.querySelectorAll('.feat');
    if (fs.length > 1) {
      var day = Math.floor(Date.now() / 864e5) % fs.length;
      Array.prototype.forEach.call(fs, function (f, i) { f.hidden = i !== day; });
    }
  }
  var dyk = doc.querySelector('[data-pick]');
  if (dyk) {
    var lis = Array.prototype.slice.call(dyk.children), n = +dyk.getAttribute('data-pick');
    for (var i = lis.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = lis[i]; lis[i] = lis[j]; lis[j] = t; }
    lis.forEach(function (li, k) { li.hidden = k >= n; dyk.appendChild(li); });
  }
})();
