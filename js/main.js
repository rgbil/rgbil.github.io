(function () {
  "use strict";

  var ACCENT = "221,57,102";

  /* ---------- portfolio grid ---------- */
  function buildGrid() {
    var grid = document.getElementById("work-grid");
    if (!grid || !window.WORKS) return;
    var SIZES = "(max-width: 560px) 92vw, (max-width: 900px) 46vw, 30vw";

    function media(w) {
      var img = '<img src="' + w.img + '" alt="' + w.title + '" loading="lazy" ' +
                'decoding="async" sizes="' + SIZES + '"' +
                (w.w ? ' width="' + w.w + '" height="' + w.h + '"' : '') + ' />';
      if (!w.avif) return img;
      return '<picture>' +
               '<source type="image/avif" srcset="' + w.avif + '" sizes="' + SIZES + '">' +
               '<source type="image/webp" srcset="' + w.webp + '" sizes="' + SIZES + '">' +
               img +
             '</picture>';
    }

    /* the card leads to our own page for the project, not off to Behance */
    /* A row that ends in a single orphan reads as a mistake; these counts avoid it. */
    var n = window.WORKS.length;
    grid.style.setProperty("--cols",
      n <= 2 ? n : (n === 4 ? 2 : (n <= 6 ? 3 : (n % 4 === 0 ? 4 : 3))));

    grid.innerHTML = window.WORKS.map(function (w) {
      var url = w.url || w.href;
      var external = !w.url;
      return '<a class="card" href="' + url + '" data-url="' + url + '"' +
               (external ? ' target="_blank" rel="noopener"' : '') + '>' +
               '<div class="card__media">' + media(w) + '</div>' +
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


  /* ---------- work cover morph ----------
     A cross-document view transition can only pair two elements if they carry the
     same view-transition-name at snapshot time. The project page names its cover
     statically; here the name is moved onto whichever tile is involved, on the way
     out and again on the way back. Unsupported browsers just navigate. */
  function wireWorkTransitions() {
    var grid = document.getElementById("work-grid");
    if (!grid || !("startViewTransition" in document)) return;

    var KEY = "rgbil:from";

    function tag(card) {
      grid.querySelectorAll(".card__media").forEach(function (m) {
        m.style.viewTransitionName = "";
      });
      var media = card && card.querySelector(".card__media");
      if (media) media.style.viewTransitionName = "work-cover";
    }

    grid.addEventListener("click", function (e) {
      var card = e.target.closest && e.target.closest(".card");
      if (!card || card.target === "_blank") return;
      tag(card);
      try { sessionStorage.setItem(KEY, card.dataset.url || ""); } catch (err) { /* private mode */ }
    });

    window.addEventListener("pagereveal", function () {
      var from = "";
      try { from = sessionStorage.getItem(KEY) || ""; } catch (err) { return; }
      if (!from) return;
      tag(grid.querySelector('.card[data-url="' + from + '"]'));
    });
  }

  /* ---------- cursor ---------- */
  function wireCursor() {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var cur = document.createElement("div");
    cur.className = "cursor is-out";
    cur.setAttribute("aria-hidden", "true");
    cur.innerHTML = '<span class="cursor__dot"></span><span class="cursor__tag">DRAG</span>';
    document.body.appendChild(cur);

    var tx = window.innerWidth / 2, ty = window.innerHeight / 2;
    var x = tx, y = ty;

    document.addEventListener("pointermove", function (e) {
      if (e.pointerType !== "mouse") return;
      tx = e.clientX;
      ty = e.clientY;
      cur.classList.remove("is-out");

      /* what is underneath decides the shape */
      var t = e.target;
      var drag = t.closest && t.closest("[data-strip]");
      var link = t.closest && t.closest("a, button");
      cur.classList.toggle("is-drag", !!drag);
      cur.classList.toggle("is-link", !!link && !drag);
    }, { passive: true });

    document.addEventListener("pointerleave", function () { cur.classList.add("is-out"); });
    window.addEventListener("blur", function () { cur.classList.add("is-out"); });

    /* the ring trails rather than tracks: the lag is the whole character of it */
    (function follow() {
      x += (tx - x) * 0.19;
      y += (ty - y) * 0.19;
      cur.style.transform = "translate3d(" + x.toFixed(1) + "px," + y.toFixed(1) + "px,0)";
      requestAnimationFrame(follow);
    })();
  }

  /* ---------- film grain ---------- */
  function addGrain() {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    var g = document.createElement("div");
    g.className = "grain";
    g.setAttribute("aria-hidden", "true");
    document.body.appendChild(g);
  }

  /* ---------- sideways gestures belong to the page ----------
     A trackpad swipe left or right is a back/forward gesture by default, and the
     browser decides that at the very start of the movement. Nothing here scrolls
     sideways except the strips, which handle it themselves, so the gesture is refused
     document-wide rather than per element. */
  function blockHistoryGestures() {
    document.addEventListener("wheel", function (e) {
      if (e.ctrlKey) return; /* pinch zoom */
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) e.preventDefault();
    }, { passive: false });
  }

  /* ---------- mobile menu ---------- */
  function wireMenu() {
    var burger = document.querySelector(".burger");
    var menu = document.getElementById("menu");
    if (!burger || !menu) return;

    var open = false;

    function set(next) {
      if (next === open) return;
      open = next;
      burger.classList.toggle("is-open", open);
      menu.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      menu.setAttribute("aria-hidden", open ? "false" : "true");
      /* the scroll handlers stand down while the panel is up */
      document.body.classList.toggle("is-menu", open);
      if (!open) burger.focus();
    }

    burger.addEventListener("click", function () { set(!open); });

    /* a link both closes the panel and lets the usual glide take the click */
    menu.addEventListener("click", function (e) {
      if (e.target.closest("a")) set(false);
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && open) set(false);
    });

    /* a menu built for narrow screens has no business staying open on a wide one */
    window.addEventListener("resize", function () {
      if (open && window.innerWidth > 760) set(false);
    });
  }

  /* ---------- the logo travels from the hero into the nav ----------
     Not a reveal: a copy of the hero mark is flown to the nav slot on a curve tied
     to how far the hero has been scrolled, shrinking and tilting through the middle,
     and handed over to the real nav logo once the two sit on the same pixels. */
  function wireNavLogo() {
    var navLogo = document.querySelector(".nav__logo");
    var heroLogo = document.querySelector(".hero__logo");
    var hero = document.getElementById("home");
    var scroller = document.querySelector(".snap");
    if (!navLogo || !hero || !scroller) return;

    var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    /* no travel without motion: fall back to appearing once the hero is behind you */
    if (reduce || !heroLogo) {
      if (!window.IntersectionObserver) { navLogo.classList.add("is-in"); return; }
      new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          navLogo.classList.toggle("is-in", !(e.isIntersecting && e.intersectionRatio >= 0.5));
        });
      }, { root: scroller, threshold: [0.5] }).observe(hero);
      return;
    }

    /* clone whatever the hero holds, so this works for the inline mark and for a
       raster fallback alike. Note className is read-only on SVG elements: it has to
       be set as an attribute or the copy silently keeps the hero's styling. */
    var ghost = heroLogo.cloneNode(true);
    ghost.setAttribute("class", "logo-ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.removeAttribute("id");
    document.body.appendChild(ghost);
    heroLogo.style.opacity = "0"; /* the ghost is what you see from now on */

    /* the flight is described centre to centre: the mark never chases the page up,
       it simply crosses from where the hero holds it to where the nav holds it */
    var hcx = 0, hcy = 0, hw = 1, hh = 1, k = 1, ncx = 0, ncy = 0;

    function measure() {
      var h = heroLogo.getBoundingClientRect();
      hw = h.width || 1;
      hh = h.height || 1;
      hcx = h.left + hw / 2;
      hcy = h.top + scroller.scrollTop + hh / 2; /* where it rests on the hero */
      ghost.style.width = hw + "px";
      ghost.style.height = hh + "px";

      navLogo.classList.add("is-measuring");
      var n = navLogo.getBoundingClientRect();
      navLogo.classList.remove("is-measuring");
      ncx = n.left + n.width / 2;
      ncy = n.top + n.height / 2;
      k = (n.width || 1) / hw;
    }

    /* position leaves and lands softly; size drops away early, so the mark reads as
       receding into the distance before it docks, instead of sliding at one rate */
    function easeInOut(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }
    function smoothstep(t) { return t * t * (3 - 2 * t); }

    /* The swap may only happen once the two marks are the same size in the same
       place: measured on the scroll, by 0.94 they agree to a fraction of a pixel.
       Earlier than that and you see both at once, offset and tilted. */
    var HANDOVER = 0.94;
    var TILT_END = 0.8; /* upright well before the swap, for the same reason */
    var FOLLOW = 0.62;  /* how much of the scroll the mark rides before docking */

    /* the copy clears out in sequence, bottom line first, each drifting up as it goes */
    var fades = [
      { el: document.querySelector(".hero__scroll"), from: 0.00, to: 0.22, lift: 26 },
      { el: document.querySelector(".hero__role"), from: 0.05, to: 0.32, lift: 34 },
      { el: document.querySelector(".hero__name"), from: 0.10, to: 0.44, lift: 44 }
    ].filter(function (f) { return f.el; });

    function paint() {
      var vh = scroller.clientHeight || 1;
      var y = scroller.scrollTop;
      var p = Math.min(1, Math.max(0, y / vh));
      var pos = easeInOut(p);
      var s = 1 + easeOut(p) * (k - 1);

      /* it rides most of the scroll like the rest of the hero, and is drawn out of
         that ride into the nav slot: moving with the page is what makes it feel alive,
         the pull is what stops it leaving the screen */
      var from = hcy - y * FOLLOW;
      var cx = hcx + pos * (ncx - hcx);
      var cy = from + pos * (ncy - from);
      /* the box is placed so its centre lands on the path; scale and tilt pivot there */
      var tx = cx - hw / 2;
      var ty = cy - hh / 2;

      var tp = Math.min(1, p / TILT_END);
      var tilt = tp * (1 - tp) * 4 * 8; /* peaks mid-flight, flat by the approach */

      /* once upright, drop the 3D functions entirely: a 0deg rotation still puts the
         layer through the perspective rasteriser and lands it a hair off the flat one */
      ghost.style.transform =
        "translate3d(" + tx.toFixed(2) + "px," + ty.toFixed(2) + "px,0) " +
        (tilt > 0.05 ? "perspective(900px) rotateX(" + tilt.toFixed(2) + "deg) " : "") +
        "scale(" + s.toFixed(4) + ")";

      var hand = p <= HANDOVER ? 0 : (p - HANDOVER) / (1 - HANDOVER);
      ghost.style.opacity = 1 - hand;
      navLogo.style.opacity = hand;
      navLogo.classList.toggle("is-in", hand > 0.9);

      fades.forEach(function (f) {
        var t = (p - f.from) / (f.to - f.from);
        t = smoothstep(Math.min(1, Math.max(0, t)));
        f.el.style.opacity = (1 - t).toFixed(3);
        f.el.style.transform = "translate3d(0," + (-t * f.lift).toFixed(1) + "px,0)";
        f.el.style.pointerEvents = t > 0.95 ? "none" : "";
      });
    }

    var ticking = false;
    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { ticking = false; paint(); });
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", function () { measure(); paint(); });
    window.addEventListener("load", function () { measure(); paint(); });
    measure();
    paint();
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
      coasting = false; /* the glide owns the scroll while it runs */

      var t0 = performance.now();
      raf = requestAnimationFrame(function step(now) {
        var t = Math.min(1, (now - t0) / dur);
        main.scrollTop = from + dist * ease(t);
        if (t < 1) raf = requestAnimationFrame(step);
        else animating = false;
      });
    }

    /* Long jumps are not scrolled. Racing past five screens to reach the sixth reads
       as noise, not as travel, so the screen is taken to black, the page is moved
       while nothing is visible, and the destination is revealed. */
    var veil = document.createElement("div");
    veil.className = "page-veil";
    veil.setAttribute("aria-hidden", "true");
    document.body.appendChild(veil);

    function cutTo(i) {
      cancelAnimationFrame(raf);
      animating = true;
      coasting = false;
      veil.classList.add("is-on");

      setTimeout(function () {
        main.scrollTop = sections[i].offsetTop;
        current = target = main.scrollTop;
        /* give the scroll-driven layers a beat to repaint at the new position,
           so the reveal shows the destination settled, not mid-adjustment */
        setTimeout(function () {
          veil.classList.remove("is-on");
          setTimeout(function () { animating = false; }, 460);
        }, 90);
      }, 340);
    }

    function glideTo(i) {
      i = Math.max(0, Math.min(sections.length - 1, i));
      var dist = Math.abs(sections[i].offsetTop - main.scrollTop);
      if (dist > vh() * 1.6) return cutTo(i);
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

    /* How close to a screen you must already be for it to claim you. A screen is one
       viewport tall, so anything up to half a screen away has a nearest edge: pulling
       from that far means every single stop gets corrected, which is what makes the
       page feel like it is arguing with you. A quarter leaves the middle ground free. */
    var SNAP_ZONE = 0.25;

    /* the rest point worth going to from y, or null to leave the reader alone */
    function nearestRest(y) {
      var max = main.scrollHeight - vh();
      if (y <= 1 || y >= max - 1) return null;

      var best = null, bestD = Infinity;
      restPoints().forEach(function (pt) {
        var d = Math.abs(pt - y);
        if (d < bestD) { bestD = d; best = pt; }
      });
      if (best === null || bestD < 2 || bestD > vh() * SNAP_ZONE) return null;
      return best;
    }

    /* the touch path has no chase to fold into, so it lands on its own glide,
       timed to sit in the same weight class as the wheel */
    function settle() {
      if (animating || coasting) return;
      var pt = nearestRest(main.scrollTop);
      if (pt === null) return;
      var d = Math.abs(pt - main.scrollTop);
      glideY(pt, Math.min(880, 400 + (d / vh()) * 620));
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
      if (animating || coasting) return; /* the chase lands itself */
      clearTimeout(idle);
      idle = setTimeout(settle, 140);
    }, { passive: true });

    /* ---- weighted wheel ----
       The wheel no longer writes the scroll position, it writes a target the page
       chases. That gives the page mass: it takes up speed, it carries on a little
       after the fingers stop, and a violent flick cannot throw it across the site,
       because the distance it may cover in one frame is capped outright. */
    var target = main.scrollTop;
    var current = target;
    var coasting = false;
    var lastFrame = performance.now();

    var GRIP = 0.09;      /* share of the remaining distance taken per frame */
    var AIM_GRIP = 0.11;  /* a touch firmer once it is landing on a screen */
    var STEP = 0.85;      /* a notch travels slightly less than the browser's own */
    var TOP_SPEED = 1.7;  /* screens per second, the hard ceiling */
    var QUEUE = 1.2;      /* screens that may be banked up ahead at any moment */
    var QUIET = 110;      /* ms of stillness that means the gesture is over */

    var lastWheelAt = 0;
    var aimed = false;

    main.addEventListener("wheel", function (e) {
      if (document.body.classList.contains("is-menu")) return;
      if (e.ctrlKey) return;                              /* pinch zoom */
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return; /* sideways gesture */
      e.preventDefault();

      /* a wheel mid-glide is the user overriding us */
      if (animating) { cancelAnimationFrame(raf); animating = false; }

      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;        /* lines */
      else if (e.deltaMode === 2) d *= vh(); /* pages */

      if (!coasting) { current = main.scrollTop; target = current; coasting = true; }
      lastWheelAt = performance.now();
      aimed = false;

      var max = main.scrollHeight - vh();
      target = Math.max(0, Math.min(max, target + d * STEP));
      /* momentum keeps firing events long after the flick: refuse to bank it all */
      var cap = vh() * QUEUE;
      target = Math.max(current - cap, Math.min(current + cap, target));

      clearTimeout(idle);
    }, { passive: false });

    (function chase(now) {
      var dt = Math.min(0.05, (now - lastFrame) / 1000);
      lastFrame = now;

      if (coasting && !animating) {
        /* the moment the gesture goes quiet, the screen edge becomes the target the
           page is already chasing: the snap is the same motion finishing, not a
           second animation with its own curve stapled onto the end */
        if (!aimed && now - lastWheelAt > QUIET) {
          var rest = nearestRest(current);
          if (rest !== null) target = rest;
          aimed = true;
        }

        var grip = aimed ? AIM_GRIP : GRIP;
        var step = (target - current) * (1 - Math.pow(1 - grip, dt * 60));
        var limit = vh() * TOP_SPEED * dt;
        if (step > limit) step = limit; else if (step < -limit) step = -limit;
        current += step;

        if (Math.abs(target - current) < 0.5) {
          current = target;
          coasting = false;
        }
        main.scrollTop = current;
      }
      requestAnimationFrame(chase);
    })(lastFrame);
    /* a finger owns the scroll outright: drop both the glide and the wheel chase */
    main.addEventListener("touchstart", function () {
      coasting = false;
      if (!animating) return;
      cancelAnimationFrame(raf);
      animating = false;
    }, { passive: true });

    var KEYS = {
      ArrowDown: 1, PageDown: 1, " ": 1, Spacebar: 1,
      ArrowUp: -1, PageUp: -1
    };
    window.addEventListener("keydown", function (e) {
      if (document.body.classList.contains("is-menu")) return;
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

    /* Anchored at 1: centred means the picture is shown whole, and every other position
       is larger, never smaller. Below 1 would open blank bars while a screen passes;
       above 1 at rest would shave the top and bottom of what you are looking at. */
    var FAR = 1.1;     /* band scale while the screen is away from centre */
    var NEAR = 1.0;    /* band scale once centred: nothing cropped */
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
        label: sec.querySelector(".cat__label"),
        title: sec.querySelector(".cat__title"),
        next: sec.querySelector(".cat__next"),
        key: ""
      });
    });
    if (!items.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    function smoothstep(t) { return t * t * (3 - 2 * t); }

    /* geometry is cached rather than read per frame: the strip loop writes transforms
       every frame, so a getBoundingClientRect() here would force a synchronous layout
       on each one, which is what makes the motion stutter */
    function measure() {
      items.forEach(function (it) {
        it.top = it.sec.offsetTop;
        it.h = it.sec.offsetHeight;
      });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);

    function paint() {
      var vh = scroller.clientHeight || 1;
      var centre = vh / 2;
      var y = scroller.scrollTop;
      items.forEach(function (it) {
        var top = it.top - y;
        if (top + it.h < -vh * 0.6 || top > vh * 1.6) return;

        /* signed distance from centre: 0 centred, +1 a screen below, -1 above */
        var p = ((top + it.h / 2) - centre) / vh;
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
        /* Driven per line rather than on the block: a transform or an opacity on the
           parent would isolate blending inside it, and the label could not invert
           against the photograph at all. */
        if (it.label) {
          it.label.style.transform = "translate3d(0," + shift + "px,0)";
          it.label.style.opacity = fade;
        }
        if (it.title) {
          it.title.style.transform = "translate3d(0," + (shift + titleShift) + "px,0)";
          it.title.style.opacity = fade;
        }
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

    /* How many times the set is repeated. Three is plenty for four A4 slots, but a
       category with one or two photos would leave the far side of a wide screen empty
       after a wrap, so the count is derived from the actual width instead of assumed. */
    function copiesFor(n) {
      var slot = window.innerHeight * 0.7071; /* a conservative guess: A4 at full height */
      var set = Math.max(1, n) * slot;
      /* two is enough as soon as one set already outruns the screen, which is what
         keeps a thirteen-piece category from building forty tiles it never shows */
      return Math.max(2, Math.ceil((2 * window.innerWidth) / set) + 1);
    }
    var DRIFT = 22;      /* px/s the row moves when nothing else is happening */
    var PUSH = 0.85;     /* how hard vertical scroll velocity shoves it sideways */
    var MAX_SKEW = 3;    /* deg: the lean that sells the momentum */

    var rows = strips.map(function (el, i) {
      var sec = el.closest("section");
      /* the photos are whatever the markup lists: no links, nothing to click through.
         Each source is cloned whole, so the <picture> element the build emits keeps
         its AVIF and WebP ladders instead of being flattened back to one src. */
      var srcs = Array.prototype.map.call(el.children, function (node) {
        return node.outerHTML;
      });
      if (!srcs.length) return null;

      var copies = copiesFor(srcs.length);
      var html = "";
      for (var c = 0; c < copies; c++) {
        html += srcs.map(function (node) {
          return '<div class="tile" aria-hidden="true">' + node + "</div>";
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
        push: 0,   /* px/s from a throw or a sideways gesture, decaying */
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

    /* ---- hand control: drag, throw, and sideways gestures ---- */
    var MAX_PUSH = 3600;  /* px/s: past this the photographs stop being readable */

    rows.forEach(function (r) {
      var lastX = 0, lastT = 0;

      r.el.addEventListener("pointerdown", function (e) {
        if (e.button) return;
        r.dragging = true;
        r.moved = 0;
        r.push = 0;
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
        /* averaged, not instantaneous: one twitchy sample at the moment of release
           would otherwise decide the whole throw */
        r.push += ((dx / dt) - r.push) * 0.35;
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
        if (r.push > MAX_PUSH) r.push = MAX_PUSH;
        else if (r.push < -MAX_PUSH) r.push = -MAX_PUSH;
      }
      r.el.addEventListener("pointerup", release);
      r.el.addEventListener("pointercancel", release);

      /* A sideways trackpad swipe, a horizontal wheel, or shift+wheel scrubs the row.
         It feeds the same velocity the throw does, so the row carries on and eases
         out rather than stopping dead with the fingers. The page keeps every purely
         vertical gesture: those are never touched here. */
      r.el.addEventListener("wheel", function (e) {
        var sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY);
        var dx = sideways ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
        if (!dx) return;
        if (e.deltaMode === 1) dx *= 16;                 /* lines */
        else if (e.deltaMode === 2) dx *= window.innerWidth; /* pages */
        e.preventDefault();
        e.stopPropagation(); /* or the page would read shift+wheel as its own scroll */
        r.push -= dx * 8.5;
        if (r.push > MAX_PUSH) r.push = MAX_PUSH;
        else if (r.push < -MAX_PUSH) r.push = -MAX_PUSH;
      }, { passive: false });
    });

    /* ---- one loop drives every row ---- */
    var lastT = performance.now();
    var lastY = scroller ? scroller.scrollTop : 0;
    var vel = 0;

    (function frame(now) {
      var dt = Math.min(0.05, (now - lastT) / 1000);
      lastT = now;

      /* nothing to animate behind an opaque panel */
      if (document.body.classList.contains("is-menu")) {
        requestAnimationFrame(frame);
        return;
      }

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
          r.x += (DRIFT * r.dir + vel * PUSH * r.dir + r.push) * dt;
          /* a long coast, so a flick reads as weight rather than a nudge */
          r.push *= Math.pow(0.971, dt * 60);
          if (Math.abs(r.push) < 2) r.push = 0;
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

  blockHistoryGestures();
  buildGrid();
  wireWorkTransitions();
  wireHoverGroups();
  addGrain();
  wireCursor();
  wireMenu();
  wireSectionGlide();
  wireNavLogo();
  wireCategoryImages();
  wireCategoryStrips();
  startFx();
})();
