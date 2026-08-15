(function () {
  "use strict";

  var ACCENT = "221,57,102";

  /* The strips scroll sideways and the page scrolls down, and one trackpad gesture is
     rarely purely one or the other. This records when a sideways gesture was last
     served so the vertical pager can stand aside while a strip is being explored. */
  var lastSideways = 0;

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
    /* a full-screen composited layer at 4% opacity: real cost on a phone GPU,
       and at that pixel density essentially invisible */
    if (window.matchMedia("(pointer: coarse)").matches) return;
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

    /* Native mandatory snapping was tried on touch and does two things badly here.
       A section taller than the screen has only one snap point, its top, so the
       browser keeps pulling back and the portfolio becomes hard to read. And its
       landing is abrupt, where every other transition on this site is a long eased
       travel. So the page keeps its own system on every device, and the guards below
       are what keep it from fighting a finger. */
    var coarse = window.matchMedia("(pointer: coarse)").matches;
    main.style.scrollSnapType = "none";

    /* A section taller than the screen is a document, not a slide: it is marked so the
       stylesheet stops offering it as a snap target. Without this the no-JS fallback,
       and any browser that keeps mandatory snapping, drags the reader back to its top. */
    function markTall() {
      sections.forEach(function (sec) {
        sec.classList.toggle("screen--tall", !paged(sec));
      });
    }
    markTall();
    window.addEventListener("resize", markTall);
    window.addEventListener("load", markTall);


    var animating = false;
    var raf = 0;
    var idle = 0;

    function vh() { return main.clientHeight || 1; }

    /* easeInOutCubic: leaves rest gently, arrives without a hard stop */
    function ease(t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    }

    /* easeOutCubic: fastest at the very start. What a release needs, because the
       finger was already moving and any ease-in would stop the page dead before
       starting it again, which is seen as a jump rather than a continuation. */
    function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

    /* One answer to "which screen is this", used by everything. The pager used to ask
       which screen sat at the middle of the viewport while the snap asked which one
       contained the scroll position, and near the foot of a category the two disagreed:
       the drag was let go as free scrolling and the landing then claimed it as a
       category and pulled it back up. */
    function indexAt(y) {
      for (var i = sections.length - 1; i >= 0; i--) {
        if (y >= sections[i].offsetTop - 1) return i;
      }
      return 0;
    }

    function indexNow() { return indexAt(main.scrollTop + 2); }

    function glideY(to, dur, curve) {
      var shape = curve || ease;
      var from = main.scrollTop;
      var dist = to - from;
      if (Math.abs(dist) < 2) return;

      cancelAnimationFrame(raf);
      animating = true;
      glideTarget = to;

      var t0 = performance.now();
      raf = requestAnimationFrame(function step(now) {
        var t = Math.min(1, (now - t0) / dur);
        main.scrollTop = from + dist * shape(t);
        if (t < 1) {
          raf = requestAnimationFrame(step);
        } else {
          animating = false;
          glideTarget = null;
          flush();
        }
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
      veil.classList.add("is-on");

      setTimeout(function () {
        main.scrollTop = sections[i].offsetTop;
        /* give the scroll-driven layers a beat to repaint at the new position,
           so the reveal shows the destination settled, not mid-adjustment */
        setTimeout(function () {
          veil.classList.remove("is-on");
          setTimeout(function () { animating = false; }, 460);
        }, 90);
      }, 340);
    }

    /* Where a gesture from screen i should land. Coming back up from part way into a
       screen means aligning it first, not skipping to the one before: after free
       scrolling up out of the portfolio you sit inside the last category, and asking
       to go up meant leaping a whole screen past the one you were looking at. */
    function targetFrom(i, down, fromTop) {
      /* measured from where the gesture began: by the time it counts, the browser may
         already have scrolled a few pixels of its own, and judging alignment then
         would call an aligned screen misaligned and send you back to it */
      var offset = fromTop - sections[i].offsetTop;
      var aligned = Math.abs(offset) < 8;
      if (down) return i + 1;
      return aligned ? i - 1 : i;
    }

    function flush() {
      if (!queued) return;
      var dir = queued;
      queued = 0;
      var i = indexNow();
      if (!paged(sections[i])) return;
      spent = true;
      glideTo(targetFrom(i, dir > 0, main.scrollTop));
    }

    function glideTo(i) {
      i = Math.max(0, Math.min(sections.length - 1, i));
      var dist = Math.abs(sections[i].offsetTop - main.scrollTop);
      if (dist > vh() * 1.6) return cutTo(i);
      glideY(sections[i].offsetTop, landingTime(main.scrollTop, dist));
    }

    /* Only the opening screen and the categories are stepped through. Everything from
       the portfolio down is read: the work grid, the text about her, the contact
       details. Those scroll like any other page and nothing ever repositions them.
       Stated as a rule about which screens they are, not about whether they happen to
       fit the viewport, so it holds however long the copy or the grid becomes. */
    function paged(sec) {
      return !!sec && (sec.id === "home" || sec.classList.contains("cat"));
    }

    /* every position a screen is allowed to come to rest at */
    function restPoints() {
      var pts = [];
      sections.forEach(function (sec, i) {
        /* the screen after the last category is a valid destination to land on,
           it is simply not one you get pulled back to afterwards */
        if (paged(sec) || paged(sections[i - 1])) pts.push(sec.offsetTop);
      });
      return pts;
    }

    /* ---- when a screen is allowed to claim you ----
       Snapping from wherever you stopped treats every pause as a mistake, which is
       what makes it feel strict. Instead the gesture is projected forward by its own
       speed and the question is where it was *heading*: a decisive flick completes,
       a small nudge is left alone. Nothing is ever pulled more than one screen. */
    var PROJECT = 0.18;    /* seconds of travel a throw is credited with */
    var CALM_ZONE = 0.18;  /* screens: how near a standstill has to be to be claimed */
    var FLICK_ZONE = 0.27; /* screens: extra reach a fast gesture earns */
    var REACH = 1.05;      /* screens: never haul someone past their neighbour */

    var scrollV = 0;       /* px/s, smoothed */
    var touching = false;
    var lastResize = 0;

    function sectionAt(y) { return sections[indexAt(y)]; }

    function restFor(y, v) {
      var h = vh();
      var max = main.scrollHeight - h;
      if (y <= 1 || y >= max - 1) return null;

      var aim = y + v * PROJECT;

      /* A screen that fits the viewport is never left half shown: whichever side the
         gesture was heading for wins, and the page always comes to rest on one of
         them. A section taller than the viewport is different, because stopping part
         way through it is how you read it, so there the window stays narrow and
         widens only with speed. */
      var sec = sectionAt(y);
      if (!paged(sec)) return null;
      var zone = h * 0.51;

      var best = null, bestD = Infinity;
      restPoints().forEach(function (pt) {
        if (Math.abs(pt - y) > h * REACH) return;
        var d = Math.abs(pt - aim);
        if (d < bestD) { bestD = d; best = pt; }
      });
      if (best === null || Math.abs(best - y) < 3 || bestD > zone) return null;
      return best;
    }

    /* Leaving the hero is also the logo's flight, and the mark is tied to the scroll
       position itself: however fast the page moves, that is how fast it flies. So the
       landing that ends that screen is given roughly twice the time of the others,
       which lets the flight play out instead of being compressed into the snap. */
    function onHero(y) { return y < vh() * 1.02; }

    function landingTime(y, d) {
      var slow = onHero(y);
      return Math.min(slow ? 1600 : 1150,
                      (slow ? 820 : 520) + (d / vh()) * (slow ? 980 : 820));
    }

    /* the touch path has no chase to fold into, so it lands on its own glide,
       timed to sit in the same weight class as the wheel */
    function settle() {
      if (animating || touching) return;
      /* a phone hiding its address bar resizes every screen: the rest points move
         underneath us, and settling on them then reads as the page moving by itself */
      if (Date.now() - lastResize < 400) return;

      var pt = restFor(main.scrollTop, scrollV);
      if (pt === null) return;
      var d = Math.abs(pt - main.scrollTop);
      /* a finger has already carried most of the distance, so the landing is the
         shorter, softer end of the same curve the wheel uses */
      glideY(pt, landingTime(main.scrollTop, d) * (coarse ? 0.8 : 1));
    }

    /* a section taller than the viewport keeps its own scroll until an edge is hit */
    function atEdge(sec, down) {
      if (sec.offsetHeight <= vh() + 4) return true;
      var top = main.scrollTop - sec.offsetTop;
      return down ? top + vh() >= sec.offsetHeight - 2 : top <= 2;
    }

    /* the wheel and the finger are never intercepted; we only take over once the
       scroll has been still for a moment, which is also after touch momentum ends */
    var vY = main.scrollTop, vT = performance.now();

    main.addEventListener("scroll", function () {
      var now = performance.now();
      var y = main.scrollTop;
      var dt = Math.max(8, now - vT) / 1000;
      scrollV += (((y - vY) / dt) - scrollV) * 0.35;
      vY = y; vT = now;

      if (animating) return;
      clearTimeout(idle);
      /* momentum on a phone stutters before it stops; waiting longer keeps the settle
         from firing into a gesture that has not actually finished */
      idle = setTimeout(settle, touching ? 260 : 160);
    }, { passive: true });

    window.addEventListener("resize", function () { lastResize = Date.now(); });

    /* ---- the wheel pages ----
       Travelling freely and then looking for somewhere to land is what produced both
       failures: momentum worth 1.4 screens made the screen after next the nearest one,
       and momentum worth 0.6 fell back to where it started. So the decision is taken
       before anything moves. One gesture is one screen, in the direction it was going,
       and the page arrives exactly on it.

       A section taller than the viewport is exempt while it still has room: reading
       the portfolio is ordinary scrolling until an edge is reached. */
    var GESTURE_GAP = 140;  /* ms of quiet that separates one gesture from the next */
    /* Deltas arrive in CSS pixels, so on a 2x screen they are half the raw figure the
       hardware reports; these are sized for what actually turns up. */
    var NOTCH = 40;         /* px in one event: only a wheel click arrives this way */
    var SWIPE = 55;         /* px a trackpad gesture must total before it counts */
    var SUSTAINED = 7;      /* px in one step: below this the pad is coasting, not driven */

    var gesture = 0;
    var lastWheelAt = 0;
    var lastDir = 0;
    var startIdx = 0;       /* the screen the gesture began on */
    var gestureTop = 0;     /* and the scroll position it began at */
    var glideTarget = null; /* where a travel in progress is headed */
    var queued = 0;         /* one more step, asked for while the page was travelling */
    var qGesture = 0;       /* driven movement counted since the last screen was taken */
    var spent = false;      /* this gesture has already moved a screen */

    main.addEventListener("wheel", function (e) {
      if (document.body.classList.contains("is-menu")) return;
      if (e.ctrlKey) return;                                /* pinch zoom */
      /* The two are deliberately asymmetric. A strip only claims a stroke that is
         clearly sideways, at 1.6 to 1; the page claims anything merely downward. That
         leaves no gesture belonging to neither, which would feel like a dead spot. */
      if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;

      var now = performance.now();
      /* and briefly after a strip has genuinely been scrubbed, nothing moves the page:
         exploring a category should not cost you the category */
      if (now - lastSideways < 220) { gesture = 0; return; }

      var d = e.deltaY;
      if (e.deltaMode === 1) d *= 16;        /* lines */
      else if (e.deltaMode === 2) d *= vh(); /* pages */
      var down = d > 0;
      var dir = down ? 1 : -1;

      /* A gesture ends when the pad goes quiet, and also the moment the hand reverses.
         Without the second test, scrolling down and immediately back up was swallowed:
         the downward stroke leaves momentum arriving for up to a second, the gesture
         never went quiet, and the upward stroke was treated as more of the same one,
         which had already been spent. That is the scroll refusing to go back up. */
      if (now - lastWheelAt > GESTURE_GAP || dir !== lastDir) {
        gesture = 0;
        qGesture = 0;
        spent = false;
        /* Taken once, at the start. Below the threshold the browser is still scrolling
           its few pixels, which can carry the position over a boundary before the
           gesture counts: reading the screen at that moment answers for where those
           pixels left us, not for where the hand began, and the page moved two. */
        startIdx = indexNow();
        gestureTop = main.scrollTop;
      }
      lastWheelAt = now;
      lastDir = dir;

      var i = startIdx;
      var sec = sections[i];

      if (!paged(sec)) {
        /* Ordinary scrolling, all the way through and out the other side. Paging at
           the edge meant the stroke that brought you to the foot of the portfolio
           carried straight on into the next screen; leaving it to the browser means
           you arrive, and stay, until you ask to move again. */
        spent = true;
        return;
      }

      /* On a screen that pages, the browser never scrolls: every stroke is either
         answered by one clean travel or by nothing at all. Letting it move a few
         pixels first, while the gesture was still being judged, put a small native
         jump in front of the animation, which is seen as a stutter. */
      e.preventDefault();

      var mag = Math.abs(d);

      /* Once a stroke has been answered, what follows is either the pad coasting or a
         hand that has not stopped. By the clock they are identical, so the test is
         whether the movement is still being driven: momentum decays within a few
         frames, while a hand keeps delivering full-sized steps. Only steps that are
         still substantial count towards another screen, and they have to add up to a
         whole gesture again. Counting everything moved two screens for one flick;
         counting nothing left a long scroll stuck after the first. */
      if (spent) {
        if (mag >= SUSTAINED) {
          qGesture += mag;
          if (qGesture >= SWIPE) {
            qGesture = 0;
            if (animating) queued = dir;
            else glideTo(targetFrom(indexNow(), down, main.scrollTop));
          }
        }
        return;
      }

      /* Two devices, two thresholds. A mouse wheel delivers one large jolt and must
         page on that alone. A trackpad delivers a stream of small ones, where a light
         brush against the pad can add up to a jolt's worth without being a gesture at
         all, so it has to travel further before it counts.

         The figures matter more than they look: deltas arrive in CSS pixels, so on a
         2x screen they are half what the hardware reports. Sized for the raw numbers,
         the threshold was never reached by an ordinary stroke, and since nothing else
         may scroll here either, the page simply refused to move. Sized too close to
         one, a gentle flick lands either side of it and the page answers only
         sometimes, which is worse. Measured strokes come to roughly 70 to 90, so this
         sits clear below them and still well above an accidental brush. */
      gesture += mag;
      if (mag < NOTCH && gesture < SWIPE) return;

      spent = true;

      /* a new stroke that arrives while the page is still travelling waits its turn
         rather than being lost, which is what made a long scroll stop after one */
      if (animating) queued = dir;
      else glideTo(targetFrom(i, down, gestureTop));
    }, { passive: false });

    /* ---- the finger pages too ----
       Left to the browser, a flick crosses a screen in a couple of hundred milliseconds
       and the page arrives wherever momentum ran out. Two things follow: the movement
       between categories is never the same twice, and the logo's flight, which is tied
       to the scroll position, is compressed into whatever time the flick took.

       So a drag on a full-height screen is followed one to one, and the release is
       finished by the same eased travel the wheel uses. The mark still flies with the
       scroll, exactly as before, but the scroll now has a known duration.

       A section taller than the screen is left entirely to the browser: reading is
       ordinary scrolling, and momentum belongs there. */
    var TAKE = 0.16;   /* screens dragged before a release completes rather than returns */
    var FLICK = 420;   /* px/s that completes it regardless of distance */

    var dragging = false, axis = "", fromIndex = 0;
    var startY = 0, startX = 0, startTop = 0, lastY = 0, lastT = 0, flickV = 0;

    main.addEventListener("touchstart", function (e) {
      touching = true;

      /* Touching down during a travel takes control, but the screen you are on is the
         one it was going to, not the one it happens to be passing. Reading the position
         mid-flight put you back in the category being left, and a small drag then
         aligned you to it: arriving at the portfolio and nudging threw you back up. */
      var heading = animating ? glideTarget : null;
      if (animating) { cancelAnimationFrame(raf); animating = false; glideTarget = null; }
      if (e.touches.length > 1) { dragging = false; return; }

      fromIndex = indexAt((heading === null ? main.scrollTop : heading) + 2);
      if (!paged(sections[fromIndex])) { dragging = false; return; }

      dragging = true;
      axis = "";
      startY = lastY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      startTop = main.scrollTop;
      lastT = performance.now();
      flickV = 0;
    }, { passive: true });

    main.addEventListener("touchmove", function (e) {
      if (!dragging || e.touches.length > 1) return;
      var y = e.touches[0].clientY;
      var x = e.touches[0].clientX;

      /* the first movement decides who the gesture belongs to: sideways is the strip's */
      if (!axis) {
        var dx = Math.abs(x - startX), dy = Math.abs(y - startY);
        if (dx < 6 && dy < 6) return;
        axis = dy > dx ? "y" : "x";
        if (axis === "x") { dragging = false; return; }
      }

      e.preventDefault();
      var now = performance.now();
      var dt = Math.max(8, now - lastT) / 1000;
      flickV = (lastY - y) / dt;
      lastY = y;
      lastT = now;
      main.scrollTop = startTop + (startY - y);
    }, { passive: false });

    function release() {
      touching = false;
      if (!dragging) return;
      dragging = false;

      var travelled = main.scrollTop - startTop;
      var far = Math.abs(travelled) > vh() * TAKE;
      var fast = Math.abs(flickV) > FLICK;
      var forward = travelled > 0;
      var go = (far || fast) && Math.abs(travelled) > 4;

      var i = go ? targetFrom(fromIndex, forward, startTop) : fromIndex;
      i = Math.max(0, Math.min(sections.length - 1, i));
      var to = sections[i].offsetTop;
      var left = Math.abs(to - main.scrollTop);
      if (left < 2) return;

      /* The duration is chosen so the animation opens at roughly the speed the finger
         had: for this curve the starting rate is three times distance over duration,
         so solving for the finger's speed makes the hand-over invisible. */
      var cap = landingTime(main.scrollTop, left) * 0.8;
      var natural = Math.abs(flickV) > 60
        ? Math.abs(3 * left / flickV) * 1000
        : cap;

      glideY(to, Math.max(380, Math.min(cap, natural)), easeOut);
    }

    main.addEventListener("touchend", release, { passive: true });
    main.addEventListener("touchcancel", release, { passive: true });

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
    var coarseStrips = window.matchMedia("(pointer: coarse)").matches;
    var DRIFT = 22;      /* px/s the row moves when nothing else is happening */
    var PUSH = 0.85;     /* how hard vertical scroll velocity shoves it sideways */
    var MAX_SKEW = 3;    /* deg: the lean that sells the momentum */
    /* A skewed layer cannot simply be shifted by the compositor, it has to be redrawn,
       and these tracks are thousands of pixels wide. Worth it on a desktop GPU, not on
       a phone, where it was the difference between gliding and stuttering. */
    var lean = !window.matchMedia("(pointer: coarse)").matches;

    /* A phone cannot hold a track this wide. Thirteen full-height pieces repeated for
       the loop came to twenty thousand CSS pixels, which at a phone's pixel ratio is
       far past the size a GPU will keep as one texture: it gets cut into tiles and
       redrawn as it moves, which is exactly what small repeated stutters look like.
       On a narrow screen the strip therefore carries fewer distinct pieces. Since one
       piece nearly fills the glass, the shorter loop is not something you can see. */
    function budgetFor(nodes) {
      if (!window.matchMedia("(pointer: coarse)").matches) return nodes;

      var h = window.innerHeight || 1;
      var budget = 3600;   /* CSS px per set; the loop repeats sooner, memory stays sane */
      var kept = [], run = 0;

      for (var i = 0; i < nodes.length; i++) {
        var im = nodes[i].tagName === "IMG" ? nodes[i] : nodes[i].querySelector("img");
        /* the build writes the real dimensions, so the rendered width is known before
           anything is laid out: full height times the piece's own proportions */
        var iw = im && parseFloat(im.getAttribute("width")) || 1;
        var ih = im && parseFloat(im.getAttribute("height")) || 1;
        run += h * (iw / ih);
        kept.push(nodes[i]);
        if (run > budget && kept.length >= 3) break;
      }
      return kept;
    }

    var rows = strips.map(function (el, i) {
      var sec = el.closest("section");
      /* the photos are whatever the markup lists: no links, nothing to click through.
         Each source is cloned whole, so the <picture> element the build emits keeps
         its AVIF and WebP ladders instead of being flattened back to one src. */
      var srcs = budgetFor(Array.prototype.slice.call(el.children)).map(function (node) {
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
        r.top = r.sec ? r.sec.offsetTop : 0;
        r.h = r.sec ? r.sec.offsetHeight : 0;
      });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("load", measure);

    if (reduce) return; /* the row stays where it is, still readable and clickable */

    /* Which rows are worth moving is decided from the numbers, not from an observer:
       a track left running off screen is still composited on every frame, and these
       are thousands of pixels wide. A desktop pre-warms the neighbour, a phone does
       not: there, only what you are actually looking at moves. */
    var MARGIN = coarseStrips ? 0 : 0.5;

    function visible(r, y, h) {
      var top = r.top - y;
      return top < h * (1 + MARGIN) && top + r.h > -h * MARGIN;
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
        /* A trackpad always leaks a little sideways movement into a vertical stroke.
           Merely being larger than the vertical component was enough to claim the
           gesture, and claiming it also blocked the page from moving for a moment:
           with the pointer resting over a strip, which is where it sits when the hand
           is not on the mouse, that read as the scroll sticking. The same 1.6 to 1
           the page demands in the other direction is demanded here. */
        var sideways = Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.6;
        var dx = sideways ? e.deltaX : (e.shiftKey ? e.deltaY : 0);
        if (!dx) return;
        if (e.deltaMode === 1) dx *= 16;                 /* lines */
        else if (e.deltaMode === 2) dx *= window.innerWidth; /* pages */
        e.preventDefault();
        e.stopPropagation(); /* or the page would read shift+wheel as its own scroll */
        lastSideways = performance.now();
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

      var skew = lean ? Math.max(-MAX_SKEW, Math.min(MAX_SKEW, vel * 0.005)) : 0;

      var y = scroller ? scroller.scrollTop : 0;
      var vh = scroller ? scroller.clientHeight : window.innerHeight;

      rows.forEach(function (r) {
        if (!r.half || !visible(r, y, vh)) return;

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

        r.track.style.transform = lean
          ? "translate3d(" + r.x.toFixed(2) + "px,0,0) skewX(" + skew.toFixed(2) + "deg)"
          : "translate3d(" + r.x.toFixed(2) + "px,0,0)";
      });

      requestAnimationFrame(frame);
    })(lastT);
  }

  /* ---------- cursor-reactive particle background ---------- */
  function startFx() {
    var c = document.getElementById("fx");
    if (!c || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    /* it reacts to a pointer, and a touch screen has none: on a phone this was seventy
       particles and a full-screen gradient redrawn every frame for no visible reason */
    if (window.matchMedia("(pointer: coarse)").matches) { c.style.display = "none"; return; }
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
