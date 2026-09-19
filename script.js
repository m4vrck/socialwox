(function(){
  "use strict";

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ========================================================================
     Lenis — smooth scrolling
     Wraps native scroll input (wheel/touch/keys) with eased motion instead
     of jumping straight to the target offset. It still moves the real
     document scroll position under the hood, so everything elsewhere in
     this file that reads scroll position keeps working unchanged — Lenis
     only changes how getting there feels. Skipped for reduced-motion users.
     ======================================================================== */
  var hasGsap = typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined';

  if(typeof Lenis !== 'undefined' && !reduceMotion){
    var lenis = new Lenis({
      duration: 1.6,
      smoothWheel: true,
      wheelMultiplier: 0.55,
      touchMultiplier: 1,
      anchors: true,
      // When GSAP/ScrollTrigger are present, they drive Lenis's raf loop and
      // get notified on every scroll tick (below) — running Lenis's own
      // autoRaf loop alongside that would double up and desync the pin.
      autoRaf: !hasGsap,
      virtualScroll: function(e){
        if(typeof window.__whyScrollFilter === 'function'){
          return window.__whyScrollFilter(e);
        }
        return true;
      }
    });
    window.__lenis = lenis;

    if(hasGsap){
      gsap.registerPlugin(ScrollTrigger);
      lenis.on('scroll', ScrollTrigger.update);
      gsap.ticker.add(function(time){ lenis.raf(time * 1000); });
      gsap.ticker.lagSmoothing(0);
    }
  } else if(hasGsap){
    gsap.registerPlugin(ScrollTrigger);
  }

  // Global safety net: re-measure every ScrollTrigger (pins, scrubs) once
  // web fonts finish loading, since a font swap can reflow section heights
  // without firing a resize event — without this, pinned start/end points
  // (the Why SocialWox experience in particular) can drift stale.
  if(hasGsap && document.fonts && document.fonts.ready){
    document.fonts.ready.then(function(){ ScrollTrigger.refresh(); });
  }

  // Mobile nav toggle
  var nav = document.getElementById('nav');
  var toggle = document.getElementById('navToggle');
  if(toggle){
    toggle.addEventListener('click', function(){
      var open = nav.classList.toggle('is-open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    document.querySelectorAll('.nav__mobile a').forEach(function(a){
      a.addEventListener('click', function(){
        nav.classList.remove('is-open');
        toggle.setAttribute('aria-expanded', 'false');
      });
    });
  }

  // Scroll reveal (general, below-the-fold sections)
  var targets = document.querySelectorAll('.reveal-fade, .reveal-line');
  if(reduceMotion || !('IntersectionObserver' in window)){
    targets.forEach(function(el){ el.classList.add('is-visible'); });
  } else {
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });
    targets.forEach(function(el){ io.observe(el); });
  }

  /* ========================================================================
     INTRO — the logo travels from centered/full-screen to its header slot;
     nav chrome and hero build in around it, all driven by one scrubbed
     GSAP timeline. The logo's start position is computed from its actual
     measured header layout (a FLIP: read the end state, invert it into a
     transform, then animate that transform to zero) — not fixed
     coordinates, so it holds up across screen sizes and font loads.
     No spinner, no percentage: the "loading" IS the scroll.

     Nothing here fights a flash-of-unhidden-content: the elements this
     module reveals are already hidden by CSS the instant page paint
     starts (see the .js-intro rules in style.css, set by a synchronous
     <script> at the top of <head> — before this file has even loaded,
     let alone run), including a CSS approximation of the logo's own
     centered/scaled starting transform. gsap.set() below overwrites that
     CSS approximation with the pixel-exact, freshly-measured version —
     since the two already agree visually, that handoff is invisible.
     Falls back to the plain, fully-visible nav+hero for reduced motion
     (or if GSAP itself failed to load) by removing .js-intro again,
     which restores every one of those CSS rules to normal.
     ======================================================================== */
  (function(){
    var pin = document.getElementById('introPin');
    var stage = document.getElementById('introStage');
    var logoImg = document.getElementById('navLogoImg');
    var navBg = document.getElementById('navBg');
    var navLeft = document.querySelector('.nav__group--left');
    var navRight = document.querySelector('.nav__group--right');
    var navToggleBtn = document.getElementById('navToggle');
    var heroBg = document.getElementById('heroBg');
    var heroFrame = document.getElementById('heroFrame');
    var heroEyebrow = document.getElementById('heroEyebrow');
    var heroWords = document.querySelectorAll('#heroHeadline .reveal-word span');
    var heroSub = document.getElementById('heroSub');
    var heroCta = document.getElementById('heroCta');
    if(!pin || !stage || !logoImg) return;

    if(!hasGsap || reduceMotion){
      // No pin, no transform, and — crucially — drop .js-intro so the
      // CSS rules that pre-hid the nav/hero/logo-transform for a clean
      // first paint let go again. Without this, a reduced-motion visitor
      // (or a dropped GSAP CDN request) would be left looking at a
      // permanently centered logo and a permanently invisible nav/hero,
      // since nothing else in this fallback branch would ever reveal them.
      document.documentElement.classList.remove('js-intro');
      stage.style.height = 'auto';
      stage.style.overflow = 'visible';
      return;
    }

    var st = null;

    function computeLogoStart(){
      // Clear any transform a *previous* build() left in place before
      // measuring. getBoundingClientRect() reports the element's current,
      // on-screen (i.e. already-transformed) box — on a rebuild (resize,
      // font load) the logo is almost always still mid-transform from the
      // last build, so measuring without resetting first would compute
      // the new start position relative to a moving target instead of the
      // logo's true resting position in the header.
      gsap.set(logoImg, { x: 0, y: 0, scale: 1 });
      var endRect = logoImg.getBoundingClientRect();
      var endCenterX = endRect.left + endRect.width / 2;
      var endCenterY = endRect.top + endRect.height / 2;
      var vw = window.innerWidth, vh = window.innerHeight;
      var targetWidth = Math.min(vw * 0.52, 440);
      var scale = endRect.width > 0 ? targetWidth / endRect.width : 1;
      return {
        x: vw / 2 - endCenterX,
        y: vh / 2 - endCenterY,
        scale: scale
      };
    }

    function build(){
      if(st){ st.kill(); }

      var start = computeLogoStart();
      var tl = gsap.timeline({ paused: true });

      // ====================================================================
      // PHASE 1: LOGO FLIGHT & HEADER DOCKING (t = 0.00 -> 0.85)
      // The logo smoothly glides from screen center into the header slot.
      // All hero text elements remain strictly hidden.
      // Nav chrome fades in as the logo reaches the header.
      // ====================================================================
      gsap.set(logoImg, { x: start.x, y: start.y, scale: start.scale, transformOrigin: '50% 50%' });
      tl.to(logoImg, { x: 0, y: 0, scale: 1, duration: 0.85, ease: 'power2.inOut' }, 0.0);

      // Nav chrome reveals as logo docks
      gsap.set(navBg, { opacity: 0 });
      tl.to(navBg, { opacity: 1, duration: 0.28, ease: 'sine.out' }, 0.58);

      gsap.set([navLeft, navRight, navToggleBtn], { opacity: 0, y: -10 });
      tl.to([navLeft, navRight, navToggleBtn], { opacity: 1, y: 0, duration: 0.24, stagger: 0.04, ease: 'sine.out' }, 0.62);

      // Ambient backdrop texture and frame ease in softly toward the end of logo travel
      gsap.set(heroBg, { opacity: 0, scale: 1.14, clipPath: 'inset(0% 0 100% 0)' });
      tl.to(heroBg, { opacity: 1, scale: 1, clipPath: 'inset(0% 0 0% 0)', duration: 0.5, ease: 'sine.out' }, 0.45);

      gsap.set(heroFrame, { opacity: 0 });
      tl.to(heroFrame, { opacity: 1, duration: 0.32, ease: 'sine.out' }, 0.65);

      // ====================================================================
      // TRANSITION BEAT: SETTLING PAUSE (t = 0.85 -> 1.05)
      // Dedicated hold where the logo sits docked in the header.
      // Hero text remains completely hidden to give breathing room.
      // ====================================================================

      // ====================================================================
      // PHASE 2: SEQUENTIAL HERO TEXT REVEAL (t = 1.05 -> 2.15)
      // Elements reveal gradually in a clear visual hierarchy:
      // Eyebrow -> Headline words -> Subtitle & CTAs -> Scroll indicator
      // ====================================================================

      // 1. Eyebrow
      gsap.set(heroEyebrow, { opacity: 0, y: 16 });
      tl.to(heroEyebrow, { opacity: 1, y: 0, duration: 0.26, ease: 'sine.out' }, 1.05);

      // 2. Headline words ("Digital experiences, engineered.")
      gsap.set(heroWords, { yPercent: 110, y: 0 });
      heroWords.forEach(function(span, i){
        tl.to(span, { yPercent: 0, duration: 0.28, ease: 'sine.out' }, 1.20 + i * 0.10);
      });

      // 3. Subtitle & CTA buttons
      gsap.set([heroSub, heroCta], { opacity: 0, y: 22 });
      tl.to([heroSub, heroCta], { opacity: 1, y: 0, duration: 0.32, stagger: 0.08, ease: 'sine.out' }, 1.58);

      // ====================================================================
      // HERO RESTING HOLD (t = 1.98 -> 2.65)
      // The fully assembled hero (eyebrow, headline, subtitle, CTAs)
      // remains completely still and readable so the user can take in the
      // complete hero state before continuing into the next section.
      // ====================================================================
      tl.to({}, { duration: 0.65 }, 1.98);

      // Total timeline spans ~2.65 units. Runway provides comfortable, spacious scroll pacing.
      var runway = Math.max(window.innerHeight * 3.4, 1200);

      st = ScrollTrigger.create({
        trigger: pin,
        start: 'top top',
        end: '+=' + runway,
        pin: stage,
        scrub: 0.6,
        animation: tl,
        // refreshPriority forces THIS pin to resolve its own position/pin-
        // spacing before ScrollTrigger calculates anything below it in the
        // document (Approach's recede, and — critically — the Why SocialWox
        // pin further down). Without it, every later section's computed
        // trigger position ended up short by this pin's own runway distance
        // (~2.3 vh), because this is a "pin a child (#introStage), trigger
        // off its taller parent (#introPin)" pin — a pattern ScrollTrigger
        // doesn't reliably resequence on its own before measuring later
        // triggers, even on a full refresh(). The visible symptom was Why
        // SocialWox pinning and starting its animation while the page was
        // still showing the "Since day one" section, nowhere near Approach
        // — i.e. exactly this pin's own runway's worth of scroll too early
        // — and, as a downstream consequence, unpinning that same amount
        // too early at the other end (a stretch of plain, unpinned final-
        // scene content before the CTA section, reading as dead space /
        // a duplicate of the last scene). See the Why SocialWox pin further
        // down for the matching effect on that end of the page.
        refreshPriority: 10,
        // Explicit safety net, independent of the scrubbed tween's own
        // internal state: the moment scroll passes the end of the intro
        // (onLeave — fires once, going forward), or if a rebuild happens
        // while the page is already scrolled past it (checked right
        // below), force every revealed element to its final visible
        // state directly. Belt-and-suspenders against exactly the "fully
        // scrolled through but the hero text still isn't there" failure
        // mode — whatever the cause, this guarantees the end state is
        // correct rather than trusting the tween got there on its own.
        onLeave: forceReveal
      });
      if(st.progress >= 0.999){ forceReveal(); }
    }

    function forceReveal(){
      gsap.set(logoImg, { x: 0, y: 0, scale: 1 });
      gsap.set(navBg, { opacity: 1 });
      gsap.set([navLeft, navRight, navToggleBtn], { opacity: 1, y: 0 });
      gsap.set(heroBg, { opacity: 1, scale: 1, clipPath: 'inset(0% 0 0% 0)' });
      gsap.set(heroFrame, { opacity: 1 });
      gsap.set(heroEyebrow, { opacity: 1, y: 0 });
      gsap.set(heroWords, { yPercent: 0, y: 0 });
      gsap.set([heroSub, heroCta], { opacity: 1, y: 0 });
    }

    build();

    // Rebuilt (not just refreshed) on resize, since the logo's start
    // transform is computed from measured pixels that a viewport or
    // font-load change can invalidate. If the page is already scrolled
    // past the intro when this fires (most likely candidate for a stray
    // font-load rebuild — see below), forceReveal() inside build() covers
    // the moment right after rebuilding; this isn't just a resize
    // concern.
    var resizeTimer = null;
    window.addEventListener('resize', function(){
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(build, 200);
    });
    if(document.fonts && document.fonts.ready){
      document.fonts.ready.then(function(){
        // Skip the rebuild entirely once the user has scrolled past the
        // intro — there's nothing left for it to correct at that point,
        // and rebuilding would mean re-hiding already-revealed elements
        // for the instant between that reset and forceReveal() catching
        // it back up. Simpler to just not touch it.
        if(st && st.progress < 0.999){ build(); }
      });
    }
  })();

  /* ========================================================================
     Approach → Why SocialWox — entry bridge.
     A light, scrub-tied recede on the Approach section as it scrolls
     toward the top of the viewport, so the page visibly "winds down"
     that section right before the pinned experience takes over, instead
     of a hard cut from a normal-flow section straight into a pin.
     ======================================================================== */
  (function(){
    var approachSection = document.getElementById('approach');
    if(!approachSection || !hasGsap || reduceMotion) return;
    gsap.to(approachSection, {
      opacity: 0.32, y: -26, scale: 0.985, filter: 'blur(1.5px)',
      ease: 'none',
      scrollTrigger: {
        trigger: approachSection,
        start: 'bottom 85%',
        end: 'bottom top',
        scrub: true
      }
    });
  })();

  /* ========================================================================
     "Why SocialWox" — pinned, scroll-scrubbed cinematic sequence.
     One GSAP timeline is bound to a ScrollTrigger that pins #whyStage
     directly and scrubs the timeline 1:1 with scroll position.

     The timeline's own position units ARE viewport-heights of scroll —
     not an abstract 0–1 proportion. RUNWAY_VH (see the ScrollTrigger.create
     call below) is simply set equal to the timeline's own total duration
     (TL_END, computed from the STAGES table), so one "unit" you write in a
     tl.to()'s position always costs exactly one vh of real scrolling. That
     makes the readability budget legible and directly tunable: to give a
     scene more reading time, add vh to its hold — nothing needs rescaling.
     Total runway is kept deliberately modest (see STAGES) so the section
     asks for a normal amount of scrolling — smoothness comes from gentle
     `sine` easing and restrained travel distances per element, not from
     spending extra scroll distance on every transition.

     Every scene follows ENTER → HOLD → EXIT:
       - ENTER and EXIT are deliberately slow, roughly a quarter of each
         scene's vh budget apiece — long enough that the eye can actually
         watch a scene arrive or transform away, not just notice it
         happened. Where one scene hands off into the next (Stage 3's
         zoom, Stage 6's wipe), the incoming element's tween starts before
         the outgoing one fully finishes, so it reads as one continuous
         transformation rather than a disappear-then-appear cut.
       - HOLD is a genuine gap with no tween running — the scene's last
         state simply persists — so roughly half of each scene's vh
         budget is spent completely still and readable, not animating.
     Scenes are sequential (the next one's enter begins only once the
     previous one's exit is essentially done), so only one message
     dominates the screen at a time, matching how someone actually reads
     while scrolling: settle on a message, sit with it, only then move on.

     Because RUNWAY_VH is derived from TL_END rather than hand-picked, the
     pin can never release into empty leftover scroll — the section's
     scroll distance ends exactly when the last scene finishes settling.

     Stage 1 fades/scales in from nothing (rather than snapping to full
     intensity the instant the pin engages) to match the Approach recede
     above; Stage 7 fades the ambient background down as it settles, so
     the pin releases into the CTA section (which fades up on its own via
     the sitewide .reveal-fade observer) without a jarring style switch.
     Falls back to a plain stacked reveal — no pin, no timeline — for
     narrow screens and prefers-reduced-motion (matching the CSS fallback).
     ======================================================================== */
  (function(){
    var exp = document.getElementById('whyExp');
    var stage = document.getElementById('whyStage');
    if(!exp || !stage) return;

    // Reduced motion: fall back to accessible static reveal
    if(!hasGsap || reduceMotion){
      var scenes = Array.prototype.slice.call(stage.querySelectorAll('.ws'));
      scenes.forEach(function(s){ s.classList.add('is-shown'); });
      return;
    }

    var bg = stage.querySelector('.why-exp__bg');
    var grid = stage.querySelector('.why-exp__grid');
    var field = document.getElementById('whyField');
    var lockup = document.getElementById('whyLockup');

    var introA = document.getElementById('wsIntroA');
    var introB = document.getElementById('wsIntroB');
    var introGhost = stage.querySelector('.ws__intro-ghost');

    var good = document.getElementById('wsGood');
    var bad = document.getElementById('wsBad');
    var badSpans = Array.prototype.slice.call(bad.querySelectorAll('span'));
    var problemSub = document.getElementById('wsProblemSub');

    var shiftLabel = document.getElementById('wsShiftLabel');
    var shiftFrame = document.getElementById('wsShiftFrame');
    var shiftHeadline = document.getElementById('wsShiftHeadline');

    var values = Array.prototype.slice.call(stage.querySelectorAll('.ws__value'));

    var proofLabel = document.getElementById('wsProofLabel');
    var proofs = Array.prototype.slice.call(stage.querySelectorAll('.ws__proof'));

    var diffA = document.getElementById('wsDiffA');
    var diffB = document.getElementById('wsDiffB');
    var compare = document.getElementById('wsCompare');
    var after = document.getElementById('wsAfter');

    var finalScene = stage.querySelector('.ws__final');

    var st = null;
    var mm = gsap.matchMedia();

    /* ========================================================================
       DESKTOP (min-width: 761px) — Full cinematic sequence
       ======================================================================== */
    mm.add('(min-width: 761px)', function(){
      var STAGES = [
        { start: 0,    end: 3 },
        { start: 3,    end: 6.5 },
        { start: 6.5,  end: 11 },
        { start: 11,   end: 17 },
        { start: 17,   end: 21 },
        { start: 21,   end: 25 },
        { start: 25,   end: 28 }
      ];
      var TL_END = STAGES[STAGES.length - 1].end;

      var tl = gsap.timeline({ paused: true });

      /* Ambient background/grid */
      gsap.set(bg, { opacity: 0, xPercent: 0, yPercent: 0, scale: 1.14 });
      gsap.set(grid, { opacity: 0, xPercent: 0, yPercent: 0 });
      tl.to(bg, { opacity: 0.45, duration: 0.8, ease: 'sine.out' }, 0);
      tl.to(grid, { opacity: 0.6, duration: 1, ease: 'sine.out' }, 0.1);
      tl.to(bg, { xPercent: -4, yPercent: 3, scale: 1.22, duration: TL_END, ease: 'none' }, 0);
      tl.to(grid, { xPercent: 7, yPercent: -5, duration: TL_END, ease: 'none' }, 0);
      tl.to([bg, grid], { opacity: 0, duration: 1.2, ease: 'sine.in' }, TL_END - 1.3);

      /* Stage 1 — intro */
      gsap.set(introA, { opacity: 0, y: 18 });
      gsap.set(introB, { opacity: 0, y: 18, scale: 0.96 });
      gsap.set(introGhost, { opacity: 0, scale: 0.9 });
      gsap.set(lockup, { opacity: 0 });
      tl.to(introGhost, { opacity: 0.05, scale: 1, duration: 0.6, ease: 'sine.out' }, 0);
      tl.to(introA, { opacity: 1, y: 0, duration: 0.7, ease: 'sine.out' }, 0.15);
      tl.to(introB, { opacity: 1, y: 0, scale: 1, duration: 0.75, ease: 'sine.out' }, 0.35);
      tl.to(introA, { y: -60, opacity: 0, duration: 0.55, ease: 'sine.inOut' }, 1.9);
      tl.to(introB, { scale: 0.16, x: '-34vw', y: '-32vh', opacity: 0, duration: 0.75, ease: 'sine.inOut' }, 1.9);
      tl.to(introGhost, { opacity: 0, scale: 1.15, duration: 0.55, ease: 'none' }, 1.9);
      tl.to(lockup, { opacity: 1, duration: 0.6, ease: 'sine.out' }, 2.3);

      /* Stage 2 — the problem */
      gsap.set(good, { xPercent: -60, opacity: 0 });
      gsap.set(bad, { xPercent: 60, opacity: 0 });
      gsap.set(badSpans, { x: 0, y: 0, rotate: 0 });
      gsap.set(problemSub, { opacity: 0, y: 14 });
      tl.to(good, { xPercent: 0, opacity: 1, duration: 0.8, ease: 'sine.out' }, 3);
      tl.to(bad, { xPercent: 0, opacity: 1, duration: 0.8, ease: 'sine.out' }, 3.2);
      tl.to(problemSub, { opacity: 1, y: 0, duration: 0.5, ease: 'sine.out' }, 3.9);
      tl.to(problemSub, { opacity: 0, duration: 0.3 }, 5.7);
      badSpans.forEach(function(el, i){
        var off = (i - 1);
        tl.to(el, { x: off * 34, y: off * 12, rotate: off * 3, duration: 0.5, ease: 'sine.out' }, 5.7);
      });
      tl.to(good, { y: '-40vh', opacity: 0, duration: 0.5, ease: 'sine.in' }, 6.0);
      tl.to(bad, { y: '40vh', opacity: 0, duration: 0.5, ease: 'sine.in' }, 6.0);

      /* Stage 3 — the shift */
      gsap.set(shiftLabel, { opacity: 0, y: 10 });
      gsap.set(shiftFrame, { scale: 0.4, y: '14vh', opacity: 0, rotate: -4, transformOrigin: '50% 50%' });
      gsap.set(shiftHeadline, { opacity: 0, y: 18 });
      tl.to(shiftLabel, { opacity: 1, y: 0, duration: 0.5, ease: 'sine.out' }, 6.5);
      tl.to(shiftFrame, { scale: 1, y: 0, opacity: 1, rotate: 0, duration: 1.0, ease: 'sine.out' }, 6.6);
      tl.to(shiftLabel, { opacity: 0, duration: 0.3 }, 8.6);
      tl.to(shiftFrame, { scale: 1.9, rotate: 1.5, opacity: 0.3, filter: 'blur(2px)', duration: 1.1, ease: 'sine.inOut' }, 8.7);
      tl.to(shiftHeadline, { opacity: 1, y: 0, duration: 0.8, ease: 'sine.out' }, 9.3);
      tl.to(shiftHeadline, { opacity: 0, y: -18, duration: 0.4, ease: 'sine.in' }, 10.6);
      tl.to(shiftFrame, { opacity: 0, scale: 2.1, duration: 0.4, ease: 'sine.in' }, 10.6);

      /* Stage 4 — values */
      var vStart = 11, span = 1.5;
      values.forEach(function(el, i){
        var t0 = vStart + i * span;
        var dir = i % 2 === 0 ? '-16vw' : '16vw';
        var back = i % 2 === 0 ? '16vw' : '-16vw';
        gsap.set(el, { opacity: 0, scale: 0.82, x: dir, rotate: i % 2 === 0 ? -3 : 3 });
        tl.to(el, { opacity: 1, scale: 1, x: 0, rotate: 0, duration: 0.6, ease: 'sine.out' }, t0);
        tl.to(el, { opacity: 0, scale: 1.16, x: back, rotate: i % 2 === 0 ? 3 : -3, duration: 0.6, ease: 'sine.in' }, t0 + 0.9);
      });

      /* Stage 5 — proof */
      var pStart = 17;
      gsap.set(proofLabel, { opacity: 0, y: 10 });
      tl.to(proofLabel, { opacity: 1, y: 0, duration: 0.5, ease: 'sine.out' }, pStart);
      tl.to(proofLabel, { opacity: 0, duration: 0.3 }, 18.0);
      var itemStart = 17.9, itemSpan = 0.5;
      var moves = [
        { xPercent: -90, yPercent: -36, rotate: -5, scale: 0.85 },
        { xPercent: -30, yPercent: 42,  rotate: 0,  scale: 0.7  },
        { xPercent: 36,  yPercent: -36, rotate: 5,  scale: 0.85 }
      ];
      proofs.forEach(function(el, i){
        var t0 = itemStart + i * itemSpan;
        var m = moves[i % moves.length];
        gsap.set(el, { xPercent: -50 + m.xPercent, yPercent: -50 + m.yPercent, rotate: m.rotate, scale: m.scale, opacity: 0 });
        tl.to(el, { xPercent: -50, yPercent: -50, rotate: 0, scale: 1, opacity: 1, duration: 0.6, ease: 'sine.out' }, t0);
      });
      tl.to(proofs, { opacity: 0, scale: 0.78, y: '-=30', duration: 0.4, ease: 'sine.in', stagger: 0.1 }, 20.4);

      /* Stage 6 — difference */
      gsap.set(diffA, { opacity: 0, y: 14 });
      gsap.set(diffB, { opacity: 0, y: 14 });
      gsap.set(compare, { opacity: 0, scale: 0.94 });
      gsap.set(after, { clipPath: 'inset(0 100% 0 0)' });
      tl.to(diffA, { opacity: 1, y: 0, duration: 0.7, ease: 'sine.out' }, 21);
      tl.to(diffA, { opacity: 0, y: -14, duration: 0.4, ease: 'sine.in' }, 22.3);
      tl.to(compare, { opacity: 1, scale: 1, duration: 0.5, ease: 'sine.out' }, 22.3);
      tl.to(after, { clipPath: 'inset(0 0% 0 0)', duration: 0.8, ease: 'sine.inOut' }, 22.5);
      tl.to(diffB, { opacity: 1, y: 0, duration: 0.7, ease: 'sine.out' }, 23.3);
      tl.to([diffB, compare], { opacity: 0, y: -16, duration: 0.4, ease: 'sine.in' }, 24.6);
      tl.to(lockup, { opacity: 0, duration: 0.4 }, 24.6);

      /* Stage 7 — final statement */
      gsap.set(finalScene, { opacity: 0, y: 18, scale: 1.03 });
      tl.to(finalScene, { opacity: 1, y: 0, scale: 1, duration: 0.9, ease: 'sine.out' }, 25);
      tl.to(finalScene, { opacity: 0.85, y: -4, duration: 0.7, ease: 'sine.in' }, 27.3);

      var RUNWAY_VH = TL_END;
      st = ScrollTrigger.create({
        trigger: stage,
        start: 'top top',
        end: function(){ return '+=' + Math.round(window.innerHeight * RUNWAY_VH); },
        pin: true,
        invalidateOnRefresh: true,
        scrub: true,
        animation: tl,
        onToggle: function(self){
          var l = window.__lenis;
          if(l && l.options){
            l.options.duration = self.isActive ? 0.8 : 1.6;
          }
        },
        onUpdate: function(self){
          velocity = self.getVelocity();
        }
      });

      return function(){
        if(st) st.kill();
        tl.kill();
      };
    });

    /* ========================================================================
       MOBILE (max-width: 760px) — Dedicated, responsive cinematic sequence
       ======================================================================== */
    mm.add('(max-width: 760px)', function(){
      var tl = gsap.timeline({ paused: true });

      /* Ambient background/grid */
      gsap.set(bg, { opacity: 0, xPercent: 0, yPercent: 0, scale: 1.1 });
      gsap.set(grid, { opacity: 0, xPercent: 0, yPercent: 0 });
      tl.to(bg, { opacity: 0.35, duration: 0.8, ease: 'sine.out' }, 0);
      tl.to(grid, { opacity: 0.5, duration: 1, ease: 'sine.out' }, 0.1);
      tl.to(bg, { xPercent: -2, yPercent: 2, scale: 1.18, duration: 26, ease: 'none' }, 0);
      tl.to(grid, { xPercent: 4, yPercent: -3, duration: 26, ease: 'none' }, 0);
      tl.to([bg, grid], { opacity: 0, duration: 1.2, ease: 'sine.in' }, 24.8);

      /* Stage 1 — Intro (0–3vh) */
      gsap.set(introA, { opacity: 0, y: 14 });
      gsap.set(introB, { opacity: 0, y: 14, scale: 0.96 });
      gsap.set(introGhost, { opacity: 0, scale: 0.9 });
      gsap.set(lockup, { opacity: 0 });
      tl.to(introGhost, { opacity: 0.04, scale: 1, duration: 0.6, ease: 'sine.out' }, 0);
      tl.to(introA, { opacity: 1, y: 0, duration: 0.7, ease: 'sine.out' }, 0.15);
      tl.to(introB, { opacity: 1, y: 0, scale: 1, duration: 0.75, ease: 'sine.out' }, 0.35);
      // HOLD 1.1–1.9
      tl.to(introA, { y: -40, opacity: 0, duration: 0.55, ease: 'sine.inOut' }, 1.9);
      tl.to(introB, { scale: 0.25, x: '-28vw', y: '-28vh', opacity: 0, duration: 0.75, ease: 'sine.inOut' }, 1.9);
      tl.to(introGhost, { opacity: 0, scale: 1.1, duration: 0.55, ease: 'none' }, 1.9);
      tl.to(lockup, { opacity: 1, duration: 0.6, ease: 'sine.out' }, 2.3);

      /* Stage 2 — The Problem (3–6.5vh) */
      gsap.set(good, { xPercent: -40, opacity: 0 });
      gsap.set(bad, { xPercent: 40, opacity: 0 });
      gsap.set(badSpans, { x: 0, y: 0, rotate: 0 });
      gsap.set(problemSub, { opacity: 0, y: 12 });
      tl.to(good, { xPercent: 0, opacity: 1, duration: 0.8, ease: 'sine.out' }, 3);
      tl.to(bad, { xPercent: 0, opacity: 1, duration: 0.8, ease: 'sine.out' }, 3.2);
      tl.to(problemSub, { opacity: 1, y: 0, duration: 0.5, ease: 'sine.out' }, 3.9);
      // HOLD 4.4–5.7
      tl.to(problemSub, { opacity: 0, duration: 0.3 }, 5.7);
      badSpans.forEach(function(el, i){
        var off = (i - 1);
        tl.to(el, { x: off * 16, y: off * 8, rotate: off * 2, duration: 0.5, ease: 'sine.out' }, 5.7);
      });
      tl.to(good, { y: '-30vh', opacity: 0, duration: 0.5, ease: 'sine.in' }, 6.0);
      tl.to(bad, { y: '30vh', opacity: 0, duration: 0.5, ease: 'sine.in' }, 6.0);

      /* Stage 3 — The Shift (6.5–10.5vh) */
      gsap.set(shiftLabel, { opacity: 0, y: 10 });
      gsap.set(shiftFrame, { scale: 0.65, y: '8vh', opacity: 0, rotate: -2, transformOrigin: '50% 50%' });
      gsap.set(shiftHeadline, { opacity: 0, y: 14 });
      tl.to(shiftLabel, { opacity: 1, y: 0, duration: 0.5, ease: 'sine.out' }, 6.5);
      tl.to(shiftFrame, { scale: 1, y: 0, opacity: 1, rotate: 0, duration: 0.9, ease: 'sine.out' }, 6.6);
      // HOLD 7.5–8.5
      tl.to(shiftLabel, { opacity: 0, duration: 0.3 }, 8.5);
      tl.to(shiftFrame, { scale: 1.35, rotate: 1, opacity: 0.22, filter: 'blur(2px)', duration: 0.9, ease: 'sine.inOut' }, 8.6);
      tl.to(shiftHeadline, { opacity: 1, y: 0, duration: 0.7, ease: 'sine.out' }, 9.0);
      // HOLD 9.7–10.1
      tl.to(shiftHeadline, { opacity: 0, y: -14, duration: 0.4, ease: 'sine.in' }, 10.1);
      tl.to(shiftFrame, { opacity: 0, scale: 1.45, duration: 0.4, ease: 'sine.in' }, 10.1);

      /* Stage 4 — Values (10.5–16.5vh) */
      var mValuesStart = 10.5, mValSpan = 1.5;
      values.forEach(function(el, i){
        var t0 = mValuesStart + i * mValSpan;
        var dir = i % 2 === 0 ? '-12vw' : '12vw';
        var back = i % 2 === 0 ? '12vw' : '-12vw';
        gsap.set(el, { opacity: 0, scale: 0.88, x: dir });
        tl.to(el, { opacity: 1, scale: 1, x: 0, duration: 0.5, ease: 'sine.out' }, t0);
        // HOLD: t0+0.5 → t0+1.0
        tl.to(el, { opacity: 0, scale: 1.08, x: back, duration: 0.5, ease: 'sine.in' }, t0 + 1.0);
      });

      /* Stage 5 — Proof: 3 Shipped Projects (16.5–20.0vh) */
      gsap.set(proofLabel, { opacity: 0, y: 8 });
      tl.to(proofLabel, { opacity: 1, y: 0, duration: 0.4, ease: 'sine.out' }, 16.5);
      tl.to(proofLabel, { opacity: 0, duration: 0.3 }, 17.3);

      var pBase = 16.9, pSpan = 1.0;
      proofs.forEach(function(el, i){
        var t0 = pBase + i * pSpan;
        gsap.set(el, { xPercent: -50, yPercent: -50, y: 20, scale: 0.94, opacity: 0 });
        tl.to(el, { opacity: 1, y: 0, scale: 1, duration: 0.4, ease: 'sine.out' }, t0);
        // HOLD: t0+0.4 → t0+0.65
        tl.to(el, { opacity: 0, y: -18, scale: 1.04, duration: 0.35, ease: 'sine.in' }, t0 + 0.65);
      });

      /* Stage 6 — Difference (20.0–23.5vh) */
      gsap.set(diffA, { opacity: 0, y: 12 });
      gsap.set(diffB, { opacity: 0, y: 12 });
      gsap.set(compare, { opacity: 0, scale: 0.94 });
      gsap.set(after, { clipPath: 'inset(0 100% 0 0)' });
      tl.to(diffA, { opacity: 1, y: 0, duration: 0.6, ease: 'sine.out' }, 20.0);
      // HOLD 20.6–21.0
      tl.to(diffA, { opacity: 0, y: -10, duration: 0.3, ease: 'sine.in' }, 21.0);
      tl.to(compare, { opacity: 1, scale: 1, duration: 0.4, ease: 'sine.out' }, 21.0);
      tl.to(after, { clipPath: 'inset(0 0% 0 0)', duration: 0.8, ease: 'sine.inOut' }, 21.2);
      tl.to(diffB, { opacity: 1, y: 0, duration: 0.6, ease: 'sine.out' }, 21.8);
      // HOLD 22.4–22.9
      tl.to([diffB, compare], { opacity: 0, y: -12, duration: 0.4, ease: 'sine.in' }, 22.9);
      tl.to(lockup, { opacity: 0, duration: 0.4 }, 22.9);

      /* Stage 7 — Final Statement (23.5–26vh) */
      gsap.set(finalScene, { opacity: 0, y: 16, scale: 1.02 });
      tl.to(finalScene, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'sine.out' }, 23.5);
      // HOLD 24.3–25.4
      tl.to(finalScene, { opacity: 0.8, y: -4, duration: 0.6, ease: 'sine.in' }, 25.4);

      var RUNWAY_VH = 26;
      st = ScrollTrigger.create({
        trigger: stage,
        start: 'top top',
        end: function(){ return '+=' + Math.round(window.innerHeight * RUNWAY_VH); },
        pin: true,
        invalidateOnRefresh: true,
        scrub: true,
        animation: tl,
        onToggle: function(self){
          var l = window.__lenis;
          if(l && l.options){
            l.options.duration = self.isActive ? 0.8 : 1.6;
          }
        },
        onUpdate: function(self){
          velocity = self.getVelocity();
        }
      });

      return function(){
        if(st) st.kill();
        tl.kill();
      };
    });

    /* ========================================================================
       Why SocialWox Scroll Momentum Resistance & Readability Protection
       Scoped specifically to this section:
       1. Soft-knee non-linear delta damping absorbs aggressive flick gestures.
       2. Momentum lead cap limits how far targetScroll can pull ahead of current
          rendered scroll (max ~0.55vh), mathematically preventing any single
          flick or swipe from skipping multiple scenes.
       3. Unconstrained boundary escape guarantees smooth entry and exit into
          the preceding Approach section and the subsequent Contact section.
       ======================================================================== */
    window.__whyScrollFilter = function(e){
      // On mobile viewports or touch devices, allow natural touch scrolling
      if(window.matchMedia('(max-width:760px)').matches || window.matchMedia('(pointer:coarse)').matches){
        return true;
      }
      var l = window.__lenis;
      if(!l || !st || typeof st.start === 'undefined') return true;

      var current = l.scroll;
      var start = st.start;
      var end = st.end;

      // Only engage when inside Why Socialwox (or right on the boundary scrolling inward)
      var isInside = (current >= start && current <= end);
      if(!isInside){
        var enteringDown = (current >= start - 80 && current < start && e.deltaY > 0);
        var enteringUp = (current <= end + 80 && current > end && e.deltaY < 0);
        if(!enteringDown && !enteringUp){
          return true; // Completely outside: 100% normal un-damped scrolling
        }
      }

      // Boundary escape: allow uninhibited exit upward or downward
      if(current <= start && e.deltaY < 0) return true;
      if(current >= end && e.deltaY > 0) return true;

      var rawDelta = e.deltaY;
      var sign = Math.sign(rawDelta);
      var absDelta = Math.abs(rawDelta);
      if(absDelta === 0) return true;

      // 1. Non-linear velocity damping:
      // Normal/gentle scroll has a solid, tactile resistance.
      // High-speed bursts undergo strong soft-knee compression.
      var damped;
      var threshold = 35;
      if(absDelta <= threshold){
        damped = absDelta * 0.42;
      } else {
        var excess = absDelta - threshold;
        damped = threshold * 0.42 + Math.pow(excess, 0.52) * 1.9;
      }
      // Hard cap per scroll event: never more than 75px inside Why Socialwox
      damped = Math.min(damped, 75);
      var scaledDelta = sign * damped;

      // 2. Momentum lead cap:
      // Prevents rapid consecutive wheel events from building up a huge queue.
      // Caps the distance between targetScroll and actual current scroll.
      var maxLead = Math.min(window.innerHeight * 0.55, 450);

      // If existing targetScroll had already drifted too far ahead, reel it back in
      if(l.targetScroll - current > maxLead){
        l.targetScroll = current + maxLead;
      } else if(current - l.targetScroll > maxLead){
        l.targetScroll = current - maxLead;
      }

      var projectedTarget = l.targetScroll + scaledDelta;
      var lead = projectedTarget - current;
      if(lead > maxLead){
        scaledDelta = Math.max(0, (current + maxLead) - l.targetScroll);
      } else if(lead < -maxLead){
        scaledDelta = Math.min(0, (current - maxLead) - l.targetScroll);
      }

      e.deltaY = scaledDelta;
      e.deltaX = 0;
      return true;
    };

    /* -- Scroll physics: a light, self-decaying blur tied to scroll
          velocity — fast scrolling feels energetic, slow scrolling stays
          crisp and controlled. Never touches layout, only .why-exp__field's
          filter, so it can't fight the timeline's own transforms. -- */
    var velocity = 0, currentBlur = 0;
    gsap.ticker.add(function(){
      if(!st || !st.isActive) { if(currentBlur > 0.05){ currentBlur *= 0.8; field.style.filter = 'blur(' + currentBlur.toFixed(2) + 'px)'; } else if(field.style.filter !== 'none'){ field.style.filter = 'none'; } return; }
      if(window.matchMedia('(max-width:760px)').matches || window.matchMedia('(pointer:coarse)').matches){
        if(field.style.filter !== 'none') field.style.filter = 'none';
        return;
      }
      var target = Math.min(Math.abs(velocity) / 4500, 1) * 4.5;
      currentBlur += (target - currentBlur) * 0.18;
      field.style.filter = currentBlur > 0.05 ? 'blur(' + currentBlur.toFixed(2) + 'px)' : 'none';
      velocity *= 0.85;
    });

    /* -- Subtle pointer parallax: the whole composition tilts a few
          degrees toward the cursor. Desktop pointer only; scroll remains
          the primary and only necessary interaction. -- */
    if(window.matchMedia('(pointer:fine)').matches){
      gsap.set(stage, { perspective: 1400 });
      var tiltX = gsap.quickTo(field, 'rotateX', { duration: 0.7, ease: 'power3' });
      var tiltY = gsap.quickTo(field, 'rotateY', { duration: 0.7, ease: 'power3' });
      stage.addEventListener('mousemove', function(e){
        var r = stage.getBoundingClientRect();
        var nx = (e.clientX - r.left) / r.width - 0.5;
        var ny = (e.clientY - r.top) / r.height - 0.5;
        tiltY(nx * 4);
        tiltX(ny * -3);
      });
      stage.addEventListener('mouseleave', function(){ tiltX(0); tiltY(0); });
    }
  })();
})();
