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

  /* ---------- category images: zoom out on entering view, extra on hover ---------- */
  function wireCategoryImages() {
    var scroller = document.querySelector(".snap");
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var img = e.target.querySelector("[data-catimg]");
        if (!img) return;
        img.dataset.inview = e.isIntersecting ? "1" : "0";
        img.style.transform = e.isIntersecting ? "scale(1)" : "scale(1.14)";
      });
    }, { root: scroller, threshold: 0.55 });

    document.querySelectorAll("[data-catimg]").forEach(function (img) {
      var sec = img.closest("section");
      if (!sec) return;
      io.observe(sec);
      sec.addEventListener("mouseenter", function () {
        img.style.transform = "scale(0.965)";
      });
      sec.addEventListener("mouseleave", function () {
        img.style.transform = img.dataset.inview === "0" ? "scale(1.14)" : "scale(1)";
      });
    });
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
  wireCategoryImages();
  startFx();
})();
