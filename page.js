/* The page's script: whole-pixel media sizes, clips that play only while seen and can be paused, pickers, wipes, the gallery,
   the menu, and the motion in design/motion.md. */
(function () {
  var root = document.documentElement;
  var $ = function (s, e) { return (e || document).querySelector(s); };
  var $$ = function (s, e) { return Array.prototype.slice.call((e || document).querySelectorAll(s)); };
  var IO = 'IntersectionObserver' in window;

  /* First, before anything that could fail: clips get their source and poster a screen and a half before they arrive. */
  function arm(v) {
    if (!v.dataset.src) return;
    if (v.dataset.poster) v.poster = v.dataset.poster;
    v.src = v.dataset.src;
    v.removeAttribute('data-src'); v.removeAttribute('data-poster');
  }
  var vids = $$('video[data-v]');
  var armer = IO ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { arm(e.target); armer.unobserve(e.target); } });
  }, { rootMargin: '150% 0px' }) : null;
  vids.forEach(function (v) { if (v.dataset.src) { if (armer) armer.observe(v); else arm(v); } });

  var still = !root.classList.contains('motion');
  var conn = navigator.connection, save = !!(conn && conn.saveData);
  var calm = still || save;      /* clips: poster and controls, no autoplay */
  if (save) root.classList.add('calm');
  function fail() { root.classList.remove('motion'); still = true; }
  try {
    var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
    var dpr = function () { return window.devicePixelRatio || 1; };
    var NAV = 56, BOX = 6, SET_GAP = 16;
    var phone = function () { return innerWidth <= 520; };
    var t0 = performance.now();

    /* The largest size that lands on whole device pixels, at a whole multiple of the art's width. */
    function multiple(room, native) {
      var d = dpr(), k = Math.floor(room * d / native);
      return k >= 1 ? k * native / d : room;
    }
    /* Half multiples: steps of half the art's width. */
    function half(room, native) {
      var d = dpr(), k = Math.floor(room * d / (native / 2));
      return k >= 1 ? k * native / 2 / d : room;
    }
    /* On phones the tiles' rule: sharp when that costs 14px a side or less, otherwise fill. */
    function snug(room, native) {
      var s = half(room, native || 256);
      s = (room - s) / 2 <= 14 ? s : room;
      return Math.max(s, Math.min(room, tileW));   /* never smaller than the tile below it */
    }
    var tileW = 0;
    function shapeOf(el) {
      var a = el.getAttribute('width') ? el : $('video,img', el);
      return a ? (+a.getAttribute('height') / +a.getAttribute('width')) : 9 / 16;
    }
    var dirty = 3;
    function fit() {
      /* tiles: media fills the tile. The padding gives up a few pixels when that lands on sharp pixels: art of 256 at a whole or half multiple. */
      $$('.tiles').forEach(function (g) {
        var one = g.firstElementChild;
        if (!one) return;
        var room = one.clientWidth, d = dpr(), sharp = Math.floor(room * d / 128) * 128 / d, pad = (room - sharp) / 2;
        g.style.setProperty('--tp', (pad <= 14 ? pad : 6) + 'px');
      });
      var tm = $('.tile .mv'); tileW = tm ? tm.getBoundingClientRect().width : 0;
      /* headline media sets its own width; the text takes the rest. A stacked headline's media simply fills the box. */
      $$('.hl:not(.stack):not(.pk)').forEach(function (h) {
        var cs = getComputedStyle(h), one = innerWidth < 900;
        var wall = h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        var room = one ? wall : wall - 280 - (parseFloat(cs.columnGap) || 32);
        var tall = innerHeight - NAV - parseFloat(cs.paddingTop) * 2 - 12;
        var f = $('.hl-m > .frame', h);
        if (f) {
          if (phone()) { f.style.setProperty('--mw', snug(wall, 256) + 'px'); return; }   /* to the box's edges, no border at the sides */
          /* both screens are tall, so they may also land on a half multiple rather than drop to the small size */
          var fr = shapeOf(f), fw = Math.min(room - BOX, one ? 1e5 : tall / fr), fd = dpr();
          f.style.setProperty('--mw', (fr > 1 ? Math.max(Math.floor(fw * fd / 128) * 128 / fd, 128) : multiple(fw, 256)) + 'px');
          return;
        }
        var s = $('.hl-m > .dual', h);
        if (s) {
          /* the two languages of a both-screens page: sharp, at a whole or half multiple, and they fit the screen with their labels */
          var per = phone() ? room - 12 : (room - SET_GAP) / 2, d = dpr();
          var w = Math.min(per - BOX, one ? 1e5 : (tall - 36) * 2 / 3), k = Math.floor(w * d / 128) * 128 / d;
          s.style.setProperty('--mw', Math.max(k, 128) + 'px');
        }
      });
      /* both screens side by side on a wide screen; the 2:3 file under bp-stack */
      $$('.hl.wide').forEach(function (h) {
        var cs = getComputedStyle(h), d = dpr();
        var wall = h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
        var ww = $('.ww', h), wn = $('.wn', h);
        if (innerWidth >= 900) {
          var room = wall - BOX, w1 = multiple(room, 520), w2 = half(room, 520);
          ww.style.setProperty('--mw', (w1 < w2 * .8 ? w2 : w1) + 'px');
        } else if (phone()) wn.style.setProperty('--mw', snug(wall, 256) + 'px');
        else wn.style.setProperty('--mw', Math.max(Math.floor((wall - BOX) * d / 128) * 128 / d, 128) + 'px');
      });
      /* pickers: one big clip, at the largest whole multiple that keeps the whole box on one screen; half multiples under bp-stack, edge to edge on phones */
      $$('.pick-f').forEach(function (f) {
        var base = +f.dataset.base || 256, pk = f.closest('.pick'), h = f.closest('.hl'), w;
        if (phone()) w = snug(pk.clientWidth, base);
        else if (innerWidth < 900) w = half(pk.clientWidth - BOX, base);
        else {
          var cs = getComputedStyle(h), side = h.classList.contains('side');
          var wall = h.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
          var text = side ? 0 : $('.hl-t', h).getBoundingClientRect().height + 16;
          var tall = innerHeight - NAV - parseFloat(cs.paddingTop) * 2 - $('.pick-m', pk).getBoundingClientRect().height - 12 - text - 24;
          var room = side ? wall - 280 - (parseFloat(cs.columnGap) || 32) : wall;
          w = multiple(Math.min(room - BOX, tall / shapeOf(f)), base);
        }
        f.style.setProperty('--mw', w + 'px');
      });
      /* the gallery: whole multiples, four and a bit on a desktop, so the next picture shows at the edge */
      var rail = $('.rail');
      if (rail) {
        var rw = rail.clientWidth - 8, g = 12, rt;
        if (innerWidth < 620) rt = multiple(clamp(rw * .78, 200, 320), 256);
        else { rt = multiple((rw - g * 3) / 3.3, 256); }
        rail.style.setProperty('--rc', rt + 'px');
        rail.style.setProperty('--rt', rt + 'px');
      }
      var tf = $('#title-frame');
      if (tf && window.OHG_size) window.OHG_size(tf.closest('.wrap').clientWidth);
      /* rises in one row start apart, by their place in the row */
      $$('.tiles').forEach(function (g) {
        var cols = getComputedStyle(g).gridTemplateColumns.split(' ').length;
        Array.prototype.forEach.call(g.children, function (c, i) { c.dataset.d = i % cols; });
      });
      dirty = 3; wake();
    }

    /* ---------- clips: play only while seen; one control pauses them all, a click pauses one */
    var hold = false;
    try { hold = sessionStorage.getItem('ohg-clips') === '0'; } catch (x) {}
    function play(v) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    function load(v) { arm(v); if (v.getAttribute('preload') === 'none') { v.setAttribute('preload', 'auto'); v.load(); } }
    function sync(v) {
      if (calm) return;
      if (v._pair) return syncPair(v._pair);
      if (v.dataset.vis === '1') {
        arm(v);
        if (hold || v.dataset.held) { if (!v.paused) v.pause(); return; }
        load(v); play(v);
      } else if (!v.paused) v.pause();
    }
    /* Original and Ahora restart together, so both show the same beat: the shorter holds on its last frame until both end. */
    function syncPair(p) {
      var on = (p.a.dataset.vis === '1' || p.b.dataset.vis === '1') && !hold && !p.held;
      if (!on) { clearTimeout(p.t); [p.a, p.b].forEach(function (v) { if (v.dataset.vis === '1') arm(v); if (!v.paused) v.pause(); }); return; }
      load(p.a); load(p.b);
      if (p.a.readyState < 3 || p.b.readyState < 3) return;          /* 'canplay' calls again */
      if (p.a.ended && p.b.ended) return restart(p);
      if (!p.a.ended && p.a.paused) play(p.a);
      if (!p.b.ended && p.b.paused) play(p.b);
    }
    function restart(p) {
      clearTimeout(p.t);
      p.t = setTimeout(function () {
        if (hold || p.held || (p.a.dataset.vis !== '1' && p.b.dataset.vis !== '1')) return;
        p.a.currentTime = 0; p.b.currentTime = 0; play(p.a); play(p.b);
      }, 400);
    }
    if (!calm) $$('.cmp:not(.dual)').forEach(function (set) {
      var vs = $$('video', set);
      if (vs.length !== 2) return;
      var p = { a: vs[0], b: vs[1] };
      vs.forEach(function (v) {
        v.loop = false; v._pair = p;
        v.addEventListener('canplay', function () { syncPair(p); });
        v.addEventListener('ended', function () { if (p.a.ended && p.b.ended) restart(p); });
      });
    });
    var io = IO ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.dataset.vis = e.isIntersecting ? '1' : '0'; sync(e.target); });
    }, { rootMargin: '10% 0px' }) : null;
    vids.forEach(function (v) {
      if (calm) {
        /* no autoplay: the first frame and the controls. In a comparison one button runs both sides. */
        if (!v.closest('.wipe')) v.controls = true;
        return;
      }
      if (io) io.observe(v); else { v.dataset.vis = '1'; sync(v); }
      if (!v.closest('.wipe')) v.addEventListener('click', function () {
        if (v._pair) { v._pair.held = !v._pair.held; syncPair(v._pair); return; }
        if (v.dataset.held) v.removeAttribute('data-held'); else v.dataset.held = '1';
        sync(v);
      });
    });
    var tog = $('#clips-toggle');
    function setHold(h) {
      hold = h;
      try { sessionStorage.setItem('ohg-clips', h ? '0' : '1'); } catch (x) {}
      tog.textContent = h ? 'Reproducir clips' : 'Pausar clips';
      vids.forEach(function (v) { if (!v._pair) sync(v); });
      $$('.cmp:not(.dual)').forEach(function (s) { var v = $('video', s); if (v && v._pair) syncPair(v._pair); });
    }
    if (tog && !calm) { tog.addEventListener('click', function () { setHold(!hold); }); if (hold) setHold(true); }

    /* ---------- wipes: rest at 50%, and the visitor moves them */
    var hintIO = !still && IO ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { hintIO.unobserve(e.target); if (e.target._hint) e.target._hint(); } });
    }, { threshold: .6 }) : null;
    $$('[data-wipe]').forEach(function (w) {
      var r = $('.wipe-r', w), touched = false, sx = 0, sy = 0, drag = false, down = false, moved = false;
      var pv = 50;
      function setP(p) {
        p = clamp(p, 0, 100); pv = p;
        w.style.setProperty('--p', p + '%');
        w.classList.toggle('no-r', p > 92); w.classList.toggle('no-l', p < 8);
      }
      function fromX(x) { var b = w.getBoundingClientRect(); var p = Math.round((x - b.left) / b.width * 100); r.value = p; setP(p); }
      r.addEventListener('input', function () {
        /* a finger that may be starting a vertical swipe doesn't move the bar: a tap or a sideways drag does */
        if (down && !drag) { r.value = Math.round(pv); return; }
        touched = true; setP(+r.value);
      });
      r.addEventListener('pointerdown', function (e) {
        touched = true; down = true; moved = false; drag = e.pointerType !== 'touch'; sx = e.clientX; sy = e.clientY;
        if (drag) { e.preventDefault(); r.focus({ preventScroll: true }); fromX(e.clientX); try { r.setPointerCapture(e.pointerId); } catch (x) {} }
      });
      r.addEventListener('pointermove', function (e) {
        if (!down) return;
        if (Math.abs(e.clientX - sx) > 10 || Math.abs(e.clientY - sy) > 10) moved = true;
        if (!drag && Math.abs(e.clientX - sx) > 6 && Math.abs(e.clientX - sx) > Math.abs(e.clientY - sy)) drag = true;
        if (drag) fromX(e.clientX);
      });
      r.addEventListener('pointerup', function (e) { if (down && !drag && !moved) fromX(e.clientX); down = drag = false; });   /* a tap, not a swipe */
      r.addEventListener('pointercancel', function () { down = drag = false; });
      setP(50);
      /* the first time it's 60% in view: 50 to 72 and back over 900ms, once, to show it moves */
      w._hint = function () {
        if (touched) return;
        var s = performance.now();
        (function go(t) {
          if (touched) return;
          var u = clamp((t - s) / 900, 0, 1), x = u < .5 ? u * 2 : 2 - u * 2, e = x * x * (3 - 2 * x), p = 50 + 22 * e;
          setP(p); r.value = Math.round(p);
          if (u < 1) requestAnimationFrame(go);
        })(s);
      };
      if (hintIO) hintIO.observe(w);
      var A = $('.a video', w), B = $('.b video', w);
      if (A && B) {
        /* the two sides are the same moment: keep them together */
        A.addEventListener('timeupdate', function () { if (!A.paused && B.readyState >= 2 && Math.abs(A.currentTime - B.currentTime) > .12) B.currentTime = A.currentTime; });
        if (calm) {
          /* with reduced motion, one button plays both sides */
          var b = document.createElement('button');
          b.type = 'button'; b.className = 'btn s wipe-play'; b.textContent = 'Reproducir';
          b.addEventListener('click', function () {
            arm(A); arm(B);
            if (A.paused) { B.currentTime = A.currentTime; play(A); play(B); b.textContent = 'Pausar'; }
            else { A.pause(); B.pause(); b.textContent = 'Reproducir'; }
          });
          w.appendChild(b);
        }
      }
    });

    /* ---------- pickers: one big clip and a game-style menu; the swap is instant */
    $$('.pick').forEach(function (pk) {
      var btns = $$('.pick-m button', pk);
      btns.forEach(function (b) {
        b.addEventListener('click', function () {
          if (b.getAttribute('aria-pressed') === 'true') return;
          btns.forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
          var srcs = b.dataset.s.split('|'), labs = b.dataset.l.split('|'), vs = $$('video', pk);
          vs.forEach(function (v, i) {
            if (!srcs[i]) return;
            v.removeAttribute('data-src'); v.removeAttribute('data-poster');
            v.poster = srcs[i].replace(/\.mp4$/, '.png');
            v.src = srcs[i];
            v.setAttribute('aria-label', labs[i]);
            if (v._pair) v._pair.held = false; else v.removeAttribute('data-held');
          });
          var n = $('.mm-n', pk), c = $('.mm-c', pk);
          if (n) n.textContent = b.textContent;
          if (c) c.textContent = b.dataset.c || '';
          vs.forEach(function (v) { if (!v._pair) sync(v); });
          if (vs[0] && vs[0]._pair) syncPair(vs[0]._pair);
        });
      });
    });

    /* ---------- gallery: arrows with a count, touch and keyboard. The count names the pictures fully on screen. */
    var railEl = $('.rail');
    if (railEl) {
      var rcols = $$('.rcol', railEl), rprev = $('#rail-prev'), rnext = $('#rail-next'), rcount = $('#rail-count');
      var total = rcols.length ? +rcols[rcols.length - 1].dataset.b : 0;
      var railMark = function () {
        var box = railEl.getBoundingClientRect(), a0 = null, b0 = null;
        rcols.forEach(function (c) {
          var r = c.getBoundingClientRect();
          if (r.left >= box.left - 2 && r.right <= box.right + 2) { if (a0 === null) a0 = +c.dataset.a; b0 = +c.dataset.b; }
        });
        if (a0 !== null) rcount.textContent = (a0 === b0 ? a0 : a0 + '-' + b0) + ' de ' + total;
        var atStart = railEl.scrollLeft <= 2, atEnd = railEl.scrollLeft + railEl.clientWidth >= railEl.scrollWidth - 2;
        if (atStart && document.activeElement === rprev) rnext.focus();
        if (atEnd && document.activeElement === rnext) rprev.focus();
        rprev.disabled = atStart;
        rnext.disabled = atEnd;
      };
      var step = function (s) {
        var c = rcols[0].getBoundingClientRect().width + 12;
        var n = Math.max(1, Math.floor((railEl.clientWidth + 12) / c));
        railEl.scrollBy({ left: s * n * c, behavior: still ? 'auto' : 'smooth' });
      };
      rprev.addEventListener('click', function () { step(-1); });
      rnext.addEventListener('click', function () { step(1); });
      railEl.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowRight') { e.preventDefault(); step(1); }
        if (e.key === 'ArrowLeft') { e.preventDefault(); step(-1); }
      });
      var railT = 0;
      railEl.addEventListener('scroll', function () { cancelAnimationFrame(railT); railT = requestAnimationFrame(railMark); }, { passive: true });
      addEventListener('load', railMark);
      addEventListener('resize', function () { setTimeout(railMark, 160); });
      railMark();
    }
    /* the lightbox: a native dialog, so focus stays inside, Esc closes it and focus returns to the same picture */
    var lb = $('#lb');
    if (lb && lb.showModal) {
      var lbi = $('img', lb), lbp = $('p', lb), last = null;
      var vt = function (fn, closing) {
        if (still || !document.startViewTransition) { fn(); lbi.style.viewTransitionName = ''; if (last) $('img', last).style.viewTransitionName = ''; return null; }
        root.classList.toggle('vt-close', !!closing);
        var t = document.startViewTransition(fn);
        t.finished.then(function () { root.classList.remove('vt-close'); lbi.style.viewTransitionName = ''; if (last) $('img', last).style.viewTransitionName = ''; }, function () {});
        return t;
      };
      var closeLb = function () {
        if (!lb.open) return;
        var ti = last && $('img', last);
        if (ti) lbi.style.viewTransitionName = 'shot';
        vt(function () { lbi.style.viewTransitionName = ''; if (ti) ti.style.viewTransitionName = 'shot'; lb.close(); }, true);
      };
      $$('.rcol button').forEach(function (b) {
        b.addEventListener('click', function () {
          last = b; var i = $('img', b);
          lbi.src = i.getAttribute('src'); lbi.alt = i.alt; lbp.textContent = i.alt;
          var d = dpr(), n = +i.getAttribute('width') || 256, h = +i.getAttribute('height') || 192;
          var k = Math.max(1, Math.floor(Math.min((innerWidth - 32) / n, (innerHeight - 140) / h) * d) / d);
          lbi.style.width = n * k + 'px'; lbi.style.height = h * k + 'px';
          i.style.viewTransitionName = 'shot';
          vt(function () { i.style.viewTransitionName = ''; lbi.style.viewTransitionName = 'shot'; lb.showModal(); });
        });
      });
      lb.addEventListener('click', closeLb);
      lb.addEventListener('cancel', function (e) { e.preventDefault(); closeLb(); });
      lb.addEventListener('close', function () { lbi.removeAttribute('src'); });
    }

    /* ---------- collapsed sets: closed until asked for; once open, the newest open, or all */
    var ca = $('#log-all');
    if (ca) ca.addEventListener('click', function () {
      var d = $$('.ver'), open = ca.dataset.open === '1';
      d.forEach(function (x) { x.open = !open; });
      if (open) d[0].open = true;
      ca.dataset.open = open ? '0' : '1';
      ca.textContent = open ? 'Abrir todas' : 'Cerrar todas';
      measure();
    });
    $$('.ver').forEach(function (d) { d.addEventListener('toggle', function () { measure(); }); });
    $$('details[data-collapse]').forEach(function (box) {
      var sum = $('summary', box), closed = sum.textContent;
      if (box.open) sum.textContent = sum.dataset.open;
      box.addEventListener('toggle', function () {
        sum.textContent = box.open ? sum.dataset.open : closed;
        measure();
        if (box._prog) { box._prog = false; return; }
        /* closing with the list above the screen: come back to its start, so the page doesn't seem to jump */
        if (!box.open && box.getBoundingClientRect().top < NAV) jump(box.dataset.back === 'self' ? box : box.closest('section'), false);
      });
    });
    /* a long brief list: all of it on a wide screen, six under bp-stack; the fixes list: open on a wide screen, closed under bp-stack */
    var wideMQ = matchMedia('(min-width:900px)');
    function briefs() {
      $$('.also-more,.fix-box').forEach(function (d) {
        var want = wideMQ.matches;
        if (d.open !== want) { d._prog = true; d.open = want; }
      });
    }
    briefs();
    if (wideMQ.addEventListener) wideMQ.addEventListener('change', briefs);

    /* ---------- menu: the section in view, and jumps that land right, take focus and can go back */
    var links = $$('.nav a.l'), secs = [], docH = 1, navEl = $('.nav');
    function measure() {
      dirty = 3;
      secs = links.map(function (a) {
        var s = document.getElementById(a.getAttribute('href').slice(1));
        return { a: a, s: s, y: s ? s.getBoundingClientRect().top + scrollY : 1e9 };
      });
      docH = Math.max(1, root.scrollHeight - innerHeight);
      wake();
    }
    var current = null;
    function mark() {
      var y = scrollY + NAV + 40, at = null;
      secs.forEach(function (x) { if (x.y <= y) at = x; });
      if (scrollY + innerHeight >= root.scrollHeight - 6) at = secs[secs.length - 1];
      if (at !== current) {
        links.forEach(function (a) { a.removeAttribute('aria-current'); });
        if (at) {
          at.a.setAttribute('aria-current', 'true');
          var ul = at.a.closest('ul');
          if (ul && ul.scrollWidth > ul.clientWidth) { var r = at.a.parentNode; ul.scrollLeft = r.offsetLeft - ul.offsetLeft - (ul.clientWidth - r.offsetWidth) / 2; }
        }
        current = at;
      }
      navEl.style.setProperty('--pg', clamp(scrollY / docH, 0, 1).toFixed(4));
    }
    var anim = 0, cur = scrollY, lastT = -1;
    function jump(el, smooth) {
      measure();
      var to = Math.max(0, el.getBoundingClientRect().top + scrollY - (el.id === 'top' ? 0 : el.classList.contains('hl') || el.classList.contains('gallery') ? NAV + 8 : NAV)), from = scrollY;
      if (still || smooth === false || Math.abs(to - from) < 2) { anim++; scrollTo(0, to); return; }
      var v = innerHeight, d = to - from, long = Math.abs(d) > 2 * v;
      if (long) {
        /* cut to just short of the target, then glide: always short, and it shows which way you went */
        from = to - (d > 0 ? 1 : -1) * .6 * v;
        scrollTo(0, from); cur = from; lastT = -1;
      }
      var t0 = performance.now(), dur = long ? 420 : clamp(Math.abs(d) * .12, 380, 900), id = ++anim;
      (function go(t) {
        if (id !== anim) return;
        var u = clamp((t - t0) / dur, 0, 1), e = long ? 1 - Math.pow(1 - u, 3) : u < .5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
        scrollTo(0, from + (to - from) * e);
        if (u < 1) requestAnimationFrame(go);
      })(t0);
    }
    function focusOn(el) {
      if (!el.hasAttribute('tabindex')) el.setAttribute('tabindex', '-1');
      el.focus({ preventScroll: true });
    }
    addEventListener('wheel', function () { anim++; }, { passive: true });
    addEventListener('touchstart', function () { anim++; }, { passive: true });
    $$('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var el = document.getElementById(a.getAttribute('href').slice(1));
        if (!el) return;
        e.preventDefault();
        try { history.replaceState({ y: scrollY }, ''); if (location.hash !== a.getAttribute('href')) history.pushState(null, '', a.getAttribute('href')); } catch (x) {}
        jump(el);
        focusOn(el);
      });
    });
    /* Back after a jump returns to where you were, and a forum link with a hash still lands right */
    addEventListener('popstate', function (e) {
      if (e.state && typeof e.state.y === 'number') { anim++; scrollTo(0, e.state.y); return; }
      var el = document.getElementById(location.hash.slice(1) || 'top');
      if (el) jump(el, false);
    });
    addEventListener('load', function () {
      if (location.hash.length > 1) {
        var el = document.getElementById(location.hash.slice(1));
        if (el) setTimeout(function () { fit(); jump(el, false); }, 60);
      }
    });

    /* ---------- land: numbers count up, the bar opens, chart bars grow, once, when 60% visible. The HTML holds the final values. */
    function count(el, delay) {
      var txt = el.textContent, m = txt.match(/^(\d+)(?:,(\d+))?/);
      if (!m) return;
      var end = parseFloat(m[1] + '.' + (m[2] || '0')), dec = m[2] ? m[2].length : 0, rest = txt.slice(m[0].length);
      el.style.minWidth = el.getBoundingClientRect().width + 'px';
      el.textContent = '';
      var shown = document.createElement('span'), real = document.createElement('span');
      shown.setAttribute('aria-hidden', 'true'); real.className = 'vh'; real.textContent = txt;
      el.appendChild(shown); el.appendChild(real);
      var fmt = function (x) { return x.toFixed(dec).replace('.', ',') + rest; };
      shown.textContent = fmt(0);
      el._go = function () {
        setTimeout(function () {
          var s = performance.now();
          (function go(t) {
            var u = clamp((t - s) / 700, 0, 1);
            shown.textContent = fmt(end * (1 - Math.pow(1 - u, 3)));
            if (u < 1) requestAnimationFrame(go);
          })(s);
        }, delay || 0);
      };
    }
    if (!still && IO) {
      var landIO = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          landIO.unobserve(e.target);
          if (e.target._go) e.target._go(); else e.target.classList.add('land');
        });
      }, { threshold: .6 });
      $$('.stats b').forEach(function (b) { count(b, Math.max(0, 600 - (performance.now() - t0) - 0)); landIO.observe(b); });
      $$('.st .n').forEach(function (n) { count(n, 0); landIO.observe(n); });
      $$('.hbar, .bars').forEach(function (c) {
        $$(':scope > div', c).forEach(function (d, k) { d.style.setProperty('--k', k); });
        landIO.observe(c);
      });
    }

    /* ---------- scroll-tied motion: only with class motion */
    var rises = $$('.rise'), slides = $$('.slide'), writes = $$('.write');
    var running = false;
    function wake() { if (!running && !still) { running = true; requestAnimationFrame(frame); } }
    fit();
    measure();
    if (window.ResizeObserver) new ResizeObserver(function () { measure(); }).observe(document.body);
    addEventListener('load', function () { fit(); measure(); });
    var fitTimer;
    addEventListener('resize', function () { clearTimeout(fitTimer); fitTimer = setTimeout(function () { fit(); measure(); }, 120); });
    if (still) { mark(); addEventListener('scroll', mark, { passive: true }); return; }

    function frame() {
      var t = scrollY; cur += (t - cur) * .22; if (Math.abs(t - cur) < .4) cur = t;
      if (t === lastT && cur === t && dirty <= 0) { running = false; settle(); return; }   /* asleep until the next scroll or resize */
      lastT = t; dirty--;
      mark();
      var v = innerHeight, lag = t - cur;   /* scroll values ease toward the target, so a mouse wheel doesn't jump */
      /* rise: over the first 10% of the screen, items in a row 16px of scroll apart */
      for (var i = 0; i < rises.length; i++) {
        var el = rises[i], r2 = el.getBoundingClientRect();
        if (r2.top > v + 80 || r2.bottom < -200) continue;
        if (el._set) { if (r2.top > v) el._set = 0; else continue; }
        var q = clamp((v - r2.top - lag - (+el.dataset.d || 0) * 16) / (v * .1), 0, 1);
        if (el._q === q) continue;
        el._q = q;
        el.style.setProperty('--o', q.toFixed(3));
        el.style.setProperty('--y', ((1 - q) * 20).toFixed(1) + 'px');
        el.style.setProperty('--s', (.965 + .035 * q).toFixed(4));
        el.style.willChange = q === 1 ? 'auto' : '';
      }
      /* slide: a headline comes in from the side its media is on, over the same range */
      for (var j = 0; j < slides.length; j++) {
        var sl = slides[j], r3 = sl.getBoundingClientRect();
        if (r3.top > v + 80 || r3.bottom < -200) continue;
        if (sl._set) { if (r3.top > v) sl._set = 0; else continue; }
        var s = clamp((v - r3.top - lag) / (v * .1), 0, 1);
        if (sl._q === s) continue;
        sl._q = s;
        var es = 1 - (1 - s) * (1 - s);
        sl.style.setProperty('--x', ((+sl.dataset.dir || 1) * (1 - es) * 48).toFixed(1) + 'px');
        sl.style.setProperty('--o', es.toFixed(3));
        sl.style.willChange = s === 1 ? 'auto' : '';
      }
      /* write: section titles in 16 steps, done before they reach the middle of the screen */
      for (var k = 0; k < writes.length; k++) {
        var wr = writes[k], r4 = wr.getBoundingClientRect();
        if (r4.top > v + 80 || r4.bottom < -400) continue;
        if (wr._set) { if (r4.top > v) wr._set = 0; else continue; }
        var w = Math.floor(clamp((v - r4.top - lag) / (v * .12), 0, 1) * 16) / 16;
        if (wr._w !== w) { wr._w = w; wr.style.setProperty('--w', w); }
      }
      requestAnimationFrame(frame);
    }
    /* settle: when the scroll stops, anything part-way finishes, so nothing stays half-faded */
    function settle() {
      var v = innerHeight, any = [];
      rises.concat(slides).forEach(function (el) {
        if (el._q >= 1 || el._set) return;
        var r = el.getBoundingClientRect();
        if (r.bottom <= 0 || r.top > v) return;
        el.classList.add('settle'); el._q = 1; el._set = 1;
        el.style.setProperty('--o', 1); el.style.setProperty('--y', '0px'); el.style.setProperty('--s', 1); el.style.setProperty('--x', '0px');
        el.style.willChange = 'auto';
        any.push(el);
      });
      writes.forEach(function (wr) {
        var r = wr.getBoundingClientRect();
        if (!(wr._w >= 1) && r.bottom > 0 && r.top < v + 24) { wr._w = 1; wr._set = 1; wr.style.setProperty('--w', 1); }   /* + 24: a title inside an item still settling sits a little low */
      });
      if (any.length) setTimeout(function () { any.forEach(function (el) { el.classList.remove('settle'); }); settle(); }, 220);   /* once more, after the items have moved into place */
    }
    var settleT;
    addEventListener('scroll', function () { wake(); clearTimeout(settleT); settleT = setTimeout(settle, 140); }, { passive: true });
    if ('onscrollend' in window) addEventListener('scrollend', function () { clearTimeout(settleT); settle(); });
    wake();
  } catch (e) { fail(); if (window.console) console.error(e); }
})();
