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

  /* ---------- section glide: we own the travel, not the browser's snap ----------
     Native snap covers the distance in ~200ms on a flat curve, which reads as a cut
     and leaves no time for the parallax layers to be seen. Here a wheel notch, a key
     or an in-page link hands the scroll to one long eased animation instead. Touch is
     left alone: native momentum already feels right and hijacking it does not. */
  function wireSectionGlide() {
    var main = document.querySelector(".snap");
    if (!main) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var sections = Array.prototype.slice.call(main.children);
    if (sections.length < 2) return;

    var animating = false;
    var settledAt = 0;
    var raf = 0;

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

    function glideTo(i) {
      i = Math.max(0, Math.min(sections.length - 1, i));
      var from = main.scrollTop;
      var to = sections[i].offsetTop;
      var dist = to - from;
      if (Math.abs(dist) < 2) return;

      /* one screen lands at ~950ms; longer jumps stretch, but not without limit */
      var screens = Math.abs(dist) / vh();
      var dur = Math.min(1500, 700 + screens * 260);

      cancelAnimationFrame(raf);
      animating = true;
      /* the browser would fight our writes while snap is armed */
      main.style.scrollSnapType = "none";

      var t0 = performance.now();
      raf = requestAnimationFrame(function step(now) {
        var t = Math.min(1, (now - t0) / dur);
        main.scrollTop = from + dist * ease(t);
        if (t < 1) {
          raf = requestAnimationFrame(step);
        } else {
          main.style.scrollSnapType = "";
          animating = false;
          settledAt = Date.now();
        }
      });
    }

    /* a section taller than the viewport keeps its own scroll until an edge is hit */
    function atEdge(sec, down) {
      if (sec.offsetHeight <= vh() + 4) return true;
      var top = main.scrollTop - sec.offsetTop;
      return down ? top + vh() >= sec.offsetHeight - 2 : top <= 2;
    }

    main.addEventListener("wheel", function (e) {
      if (e.ctrlKey || Math.abs(e.deltaY) < 4) return;
      var down = e.deltaY > 0;
      var i = indexNow();
      if (!animating && !atEdge(sections[i], down)) return; /* native scroll inside */

      e.preventDefault();
      /* swallow the tail of trackpad momentum instead of firing a second jump */
      if (animating || Date.now() - settledAt < 260) return;
      glideTo(i + (down ? 1 : -1));
    }, { passive: false });

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

    var FAR = 1.16;    /* image scale while the screen is away from centre */
    var NEAR = 1.06;   /* image scale once centred (stays > 1: no edge gaps) */
    var HOVER = 0.95;  /* inner layer, multiplies with the outer one */
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
        img: el.querySelector("img"),
        veil: sec.querySelector("[data-catveil]"),
        body: sec.querySelector(".cat__body"),
        title: sec.querySelector(".cat__title"),
        next: sec.querySelector(".cat__next"),
        key: ""
      });
    });
    if (!items.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var lastScroll = 0;

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
      lastScroll = Date.now();
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        ticking = false;
        paint();
      });
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);

    items.forEach(function (it) {
      if (!it.img) return;
      it.sec.addEventListener("mouseenter", function () {
        /* skip the mouseenter that scrolling fires under a still cursor */
        if (Date.now() - lastScroll < 250) return;
        it.img.style.transform = "scale(" + HOVER + ") translateZ(0)";
      });
      it.sec.addEventListener("mouseleave", function () {
        it.img.style.transform = "scale(1) translateZ(0)";
      });
    });

    paint();
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
  startFx();
})();
