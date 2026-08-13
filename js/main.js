(function () {
  "use strict";

  var ACCENT = "221,57,102";

  /* ---------- portfolio grid ---------- */
  function buildGrid() {
    var grid = document.getElementById("work-grid");
    if (!grid || !window.WORKS) return;
    grid.innerHTML = window.WORKS.map(function (w) {
      return '<a class="card" href="' + w.href + '" target="_blank" rel="noopener">' +
               '<div class="card__media"><img src="' + w.img + '" alt="' + w.title + '" loading="lazy" /></div>' +
               '<div class="card__meta"><span>' + w.title + '</span>' +
               '<span class="card__cat">' + w.category + '</span></div>' +
             '</a>';
    }).join("");
  }

  /* ---------- hover: focused item zooms in, siblings push back ---------- */
  function wireHoverGroups() {
    document.querySelectorAll("[data-hgroup]").forEach(function (group) {
      var grid = group.dataset.hgroup === "grid";
      var up = grid ? 1.045 : 1.14;
      var down = grid ? 0.975 : 0.9;
      var items = Array.prototype.slice.call(group.children);
      items.forEach(function (item) {
        item.addEventListener("mouseenter", function () {
          items.forEach(function (o) {
            o.style.transform = "scale(" + (o === item ? up : down) + ")";
            o.style.opacity = o === item ? "1" : "0.4";
          });
        });
        item.addEventListener("mouseleave", function () {
          items.forEach(function (o) {
            o.style.transform = "scale(1)";
            o.style.opacity = "1";
          });
        });
      });
    });
  }

  /* ---------- section travel ----------
     Two different jobs. A click on an arrow or a nav link is a deliberate jump, so it
     gets the long eased glide. Plain scrolling stays the user's own: native snap is
     switched off so nothing is yanked mid-gesture and the parallax layers track the
     wheel directly; once the gesture stops, a short glide settles onto the nearest
     screen instead of the browser's hard snap. */
  function wireSectionGlide() {
    var main = document.querySelector(".snap");
    if (!main) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var sections = Array.prototype.slice.call(main.children);
    if (sections.length < 2) return;

    /* ours now: the CSS rule stays as the no-JS fallback */
    main.style.scrollSnapType = "none";

    var animating = false;
    var raf = 0;
    var idle = 0;

    function vh() { return main.clientHeight || 1; }

    /* easeInOutCubic: leaves rest gently, arrives without a hard stop */
    function ease(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    function indexNow() {
      var probe = main.scrollTop + vh() * 0.5;
      for (var i = sections.length - 1; i >= 0; i--) {
        if (probe >= sections[i].offsetTop) return i;
      }
      return 0;
    }

    function glideY(to, dur) {
      var from = main.scrollTop;
      var dist = to - from;
      if (Math.abs(dist) < 2) return;

      cancelAnimationFrame(raf);
      animating = true;

      var t0 = performance.now();
      raf = requestAnimationFrame(function step(now) {
        var t = Math.min(1, (now - t0) / dur);
        main.scrollTop = from + dist * ease(t);
        if (t < 1) raf = requestAnimationFrame(step);
        else animating = false;
      });
    }

    function glideTo(i) {
      i = Math.max(0, Math.min(sections.length - 1, i));
      var dist = Math.abs(sections[i].offsetTop - main.scrollTop);
      /* one screen lands at ~950ms; longer jumps stretch, but not without limit */
      glideY(sections[i].offsetTop, Math.min(1500, 700 + (dist / vh()) * 260));
    }

    /* every position a screen is allowed to come to rest at */
    function restPoints() {
      var pts = [];
      sections.forEach(function (sec) {
        pts.push(sec.offsetTop);
        /* a tall screen may also rest with its foot on the viewport */
        if (sec.offsetHeight > vh() + 4) {
          pts.push(sec.offsetTop + sec.offsetHeight - vh());
        }
      });
      return pts;
    }

    /* called once the gesture has stopped: ease onto the nearest rest point */
    function settle() {
      if (animating) return;
      var y = main.scrollTop;
      var max = main.scrollHeight - vh();
      if (y <= 1 || y >= max - 1) return;

      var best = null, bestD = Infinity;
      restPoints().forEach(function (pt) {
        var d = Math.abs(pt - y);
        if (d < bestD) { bestD = d; best = pt; }
      });
      /* more than half a screen away means the reader is mid-section: leave them be */
      if (best === null || bestD < 2 || bestD > vh() * 0.5) return;

      glideY(best, Math.min(620, 280 + (bestD / vh()) * 520));
    }

    /* a section taller than the viewport keeps its own scroll until an edge is hit */
    function atEdge(sec, down) {
      if (sec.offsetHeight <= vh() + 4) return true;
      var top = main.scrollTop - sec.offsetTop;
      return down ? top + vh() >= sec.offsetHeight - 2 : top <= 2;
    }

    /* the wheel and the finger are never intercepted; we only take over once the
       scroll has been still for a moment, which is also after touch momentum ends */
    main.addEventListener("scroll", function () {
      if (animating) return;
      clearTimeout(idle);
      idle = setTimeout(settle, 140);
    }, { passive: true });

    /* a drag on the scrollbar or a wheel mid-glide is the user overriding us */
    main.addEventListener("wheel", function () {
      if (!animating) return;
      cancelAnimationFrame(raf);
      animating = false;
    }, { passive: true });
    main.addEventListener("touchstart", function () {
      if (!animating) return;
      cancelAnimationFrame(raf);
      animating = false;
    }, { passive: true });

    var KEYS = {
      ArrowDown: 1, PageDown: 1, " ": 1, Spacebar: 1,
      ArrowUp: -1, PageUp: -1
    };
    window.addEventListener("keydown", function (e) {
      var dir = KEYS[e.key];
      var tag = (e.target.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea") return;
      if (e.key === "Home") { e.preventDefault(); return glideTo(0); }
      if (e.key === "End") { e.preventDefault(); return glideTo(sections.length - 1); }
      if (!dir) return;
      var i = indexNow();
      if (!atEdge(sections[i], dir > 0)) return;
      e.preventDefault();
      if (!animating) glideTo(i + dir);
    });

    /* nav, hero "scroll", and the category arrows all travel on the same curve */
    document.addEventListener("click", function (e) {
      var link = e.target.closest ? e.target.closest('a[href^="#"]') : null;
      if (!link) return;
      var id = link.getAttribute("href").slice(1);
      if (!id) return;
      var target = document.getElementById(id);
      if (!target) return;
      var i = sections.indexOf(target);
      if (i < 0) return;
      e.preventDefault();
      glideTo(i);
      if (history.replaceState) history.replaceState(null, "", "#" + id);
    });
  }

  /* ---------- category screens: every layer moves off the same scroll position ---------- */
  function wireCategoryImages() {
    var scroller = document.querySelector(".snap");
    if (!scroller) return;

    var FAR = 1.16;    /* band scale while the screen is away from centre */
    var NEAR = 1.06;   /* band scale once centred (stays > 1: no edge gaps) */
    var LABEL_LAG = 46;  /* px the copy trails the scroll: the parallax depth */
    var TITLE_LAG = 40;  /* the headline trails further still */
    var VEIL = 0.6;      /* how far the screen sinks into black off-centre */
    var FADE = 0.72;     /* share of a screen's travel the fade is spread over */

    var items = [];
    document.querySelectorAll("[data-catimg]").forEach(function (el) {
      var sec = el.closest("section");
      if (!sec) return;
      items.push({
        sec: sec,
        layer: el,
        veil: sec.querySelector("[data-catveil]"),
        body: sec.querySelector(".cat__body"),
        title: sec.querySelector(".cat__title"),
        next: sec.querySelector(".cat__next"),
        key: ""
      });
    });
    if (!items.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function smoothstep(t) { return t * t * (3 - 2 * t); }

    function paint() {
      var vh = window.innerHeight || 1;
      var centre = vh / 2;
      items.forEach(function (it) {
        var r = it.sec.getBoundingClientRect();
        if (r.bottom < -vh * 0.6 || r.top > vh * 1.6) return;

        /* signed distance from centre: 0 centred, +1 a screen below, -1 above */
        var p = ((r.top + r.height / 2) - centre) / vh;
        if (p > 1) p = 1; else if (p < -1) p = -1;
        var d = Math.abs(p);
        var eased = smoothstep(d);

        /* the copy lags behind the scroll, the headline more than the label,
           so the screen reads as layers at different depths rather than one plane */
        var shift = Math.round(p * LABEL_LAG * 10) / 10;
        var titleShift = Math.round(p * TITLE_LAG * 10) / 10;

        /* fade finishes before the screen is fully gone, so the copy is never
           half-legible over the neighbouring image */
        var f = Math.min(1, d / FADE);
        var fade = Math.round((1 - smoothstep(f)) * 100) / 100;

        var scale = Math.round((NEAR + (FAR - NEAR) * eased) * 1000) / 1000;
        var veil = Math.round(eased * VEIL * 100) / 100;

        var key = scale + "|" + shift + "|" + titleShift + "|" + fade + "|" + veil;
        if (key === it.key) return;
        it.key = key;

        it.layer.style.transform = "scale(" + scale + ") translateZ(0)";
        if (it.veil) it.veil.style.opacity = veil;
        if (it.body) {
          it.body.style.transform = "translate3d(0," + shift + "px,0)";
          it.body.style.opacity = fade;
        }
        if (it.title) it.title.style.transform = "translate3d(0," + titleShift + "px,0)";
        if (it.next) it.next.style.opacity = fade;
      });
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        paint();
      });
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    paint();
  }

  /* ---------- category strip: an endless row of four, coupled to the scroll ----------
     The row is never idle scenery: it drifts on its own, but the speed it actually
     travels at is the vertical scroll velocity pushed sideways, and it leans into
     that push. Dragging hands the row to the pointer and lets it coast out. */
  function wireCategoryStrips() {
    var strips = Array.prototype.slice.call(document.querySelectorAll("[data-strip]"));
    if (!strips.length) return;

    var scroller = document.querySelector(".snap");
    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    var COPIES = 3;      /* enough width that a wrap is never visible */
    var DRIFT = 22;      /* px/s the row moves when nothing else is happening */
    var PUSH = 0.85;     /* how hard vertical scroll velocity shoves it sideways */
    var MAX_SKEW = 3;    /* deg: the lean that sells the momentum */

    var rows = strips.map(function (el, i) {
      var sec = el.closest("section");
      /* the photos are whatever the markup lists: no links, nothing to click through */
      var srcs = Array.prototype.map.call(el.querySelectorAll("img"), function (im) {
        return im.getAttribute("src");
      });
      if (!srcs.length) return null;

      var html = "";
      for (var c = 0; c < COPIES; c++) {
        html += srcs.map(function (src) {
          return '<div class="tile" aria-hidden="true">' +
                   '<img src="' + src + '" alt="" draggable="false" />' +
                 '</div>';
        }).join("");
      }
      el.innerHTML = '<div class="strip__track">' + html + "</div>";

      return {
        el: el,
        sec: sec,
        track: el.firstChild,
        count: srcs.length,
        dir: i % 2 === 0 ? -1 : 1, /* alternate, so the screens are not a pattern */
        x: 0,
        half: 0,
        seen: true,
        dragging: false,
        dragV: 0,
        moved: 0
      };
    }).filter(Boolean);
    if (!rows.length) return;

    /* the wrap distance is the exact offset of the second copy's first tile:
       deriving it from scrollWidth would be off by a gap and the seam would jitter */
    function measure() {
      rows.forEach(function (r) {
        var tiles = r.track.children;
        r.half = tiles.length > r.count
          ? tiles[r.count].offsetLeft - tiles[0].offsetLeft
          : 0;
      });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);

    if (reduce) return; /* the row stays where it is, still readable and clickable */

    /* skip the work for screens that are nowhere near the viewport */
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          rows.forEach(function (r) { if (r.sec === e.target) r.seen = e.isIntersecting; });
        });
      }, { root: scroller, rootMargin: "50% 0px" });
      rows.forEach(function (r) { if (r.sec) io.observe(r.sec); });
    }

    /* ---- drag to scrub ---- */
    rows.forEach(function (r) {
      var lastX = 0, lastT = 0;

      r.el.addEventListener("pointerdown", function (e) {
        if (e.button) return;
        r.dragging = true;
        r.moved = 0;
        r.dragV = 0;
        lastX = e.clientX;
        lastT = performance.now();
        r.el.classList.add("is-dragging");
        r.el.setPointerCapture(e.pointerId);
      });

      r.el.addEventListener("pointermove", function (e) {
        if (!r.dragging) return;
        var now = performance.now();
        var dx = e.clientX - lastX;
        var dt = Math.max(16, now - lastT) / 1000;
        r.x += dx;
        r.moved += Math.abs(dx);
        r.dragV = dx / dt;
        lastX = e.clientX;
        lastT = now;
      });

      function release(e) {
        if (!r.dragging) return;
        r.dragging = false;
        r.el.classList.remove("is-dragging");
        if (e.pointerId !== undefined && r.el.releasePointerCapture) {
          try { r.el.releasePointerCapture(e.pointerId); } catch (err) { /* already gone */ }
        }
      }
      r.el.addEventListener("pointerup", release);
      r.el.addEventListener("pointercancel", release);
    });

    /* ---- one loop drives every row ---- */
    var lastT = performance.now();
    var lastY = scroller ? scroller.scrollTop : 0;
    var vel = 0;

    (function frame(now) {
      var dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      /* read the scroll before writing any transform, so nothing forces a layout */
      var y = scroller ? scroller.scrollTop : window.pageYOffset;
      var raw = dt > 0 ? (y - lastY) / dt : 0;
      lastY = y;
      vel += (raw - vel) * 0.12; /* smoothed: the lean should not twitch */

      var skew = Math.max(-MAX_SKEW, Math.min(MAX_SKEW, vel * 0.005));

      rows.forEach(function (r) {
        if (!r.seen || !r.half) return;

        if (r.dragging) {
          /* the pointer already moved x directly */
        } else {
          r.x += (DRIFT * r.dir + vel * PUSH * r.dir + r.dragV) * dt;
          r.dragV *= Math.pow(0.94, dt * 60); /* coast out after a throw */
          if (Math.abs(r.dragV) < 1) r.dragV = 0;
        }

        /* keep x inside one copy's width: the wrap is invisible */
        r.x = r.x % r.half;
        if (r.x > 0) r.x -= r.half;

        r.track.style.transform =
          "translate3d(" + r.x.toFixed(2) + "px,0,0) skewX(" + skew.toFixed(2) + "deg)";
      });

      requestAnimationFrame(frame);
    })(lastT);
  }

  /* ---------- cursor-reactive particle background ---------- */
  function startFx() {
    var c = document.getElementById("fx");
    if (!c || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var ctx = c.getContext("2d");
    var w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);

    function resize() {
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    var dots = [];
    for (var i = 0; i < 70; i++) {
      dots.push({
        x: Math.random(), y: Math.random(),
        vx: (Math.random() - 0.5) * 0.00018,
        vy: (Math.random() - 0.5) * 0.00018,
        r: 0.6 + Math.random() * 1.1
      });
    }

    var p = { x: -999, y: -999 }, m = { x: -999, y: -999 }, R = 190;
    window.addEventListener("pointermove", function (e) {
      m.x = e.clientX; m.y = e.clientY;
    }, { passive: true });

    (function tick() {
      ctx.clearRect(0, 0, w, h);
      p.x += (m.x - p.x) * 0.07;
      p.y += (m.y - p.y) * 0.07;

      if (p.x > -100) {
        var g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, 260);
        g.addColorStop(0, "rgba(" + ACCENT + ",0.13)");
        g.addColorStop(1, "rgba(" + ACCENT + ",0)");
        ctx.fillStyle = g;
        ctx.fillRect(p.x - 260, p.y - 260, 520, 520);
      }

      dots.forEach(function (d) {
        d.x += d.vx; d.y += d.vy;
        if (d.x < 0 || d.x > 1) d.vx *= -1;
        if (d.y < 0 || d.y > 1) d.vy *= -1;
        var x = d.x * w, y = d.y * h;
        var near = Math.max(0, 1 - Math.hypot(x - p.x, y - p.y) / R);

        ctx.beginPath();
        ctx.arc(x, y, d.r * (1 + near * 1.2), 0, Math.PI * 2);
        ctx.fillStyle = near > 0
          ? "rgba(" + ACCENT + "," + (0.12 + near * 0.75) + ")"
          : "rgba(255,255,255,0.1)";
        ctx.fill();

        if (near > 0) {
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(p.x, p.y);
          ctx.strokeStyle = "rgba(" + ACCENT + "," + near * 0.22 + ")";
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      });

      requestAnimationFrame(tick);
    })();
  }

  buildGrid();
  wireHoverGroups();
  wireSectionGlide();
  wireCategoryImages();
  wireCategoryStrips();
  startFx();
})();
