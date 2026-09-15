(function(){
  "use strict";

  /* ========================================================================
     Lenis — smooth scrolling
     Wraps native scroll input (wheel/touch/keys) with eased motion instead
     of jumping straight to the target offset. It still moves the real
     document scroll position under the hood, so everything elsewhere in
     this file that reads scroll position — the sticky nav, IntersectionObserver
     reveals, the rail tracking and parallax in the "Why SocialWox" section —
     keeps working unchanged; Lenis only changes how getting there feels.
     Skipped entirely for reduced-motion users, who get instant native
     scrolling with no eased animation.
     ======================================================================== */
  if(typeof Lenis !== 'undefined' && !window.matchMedia('(prefers-reduced-motion: reduce)').matches){
    var lenis = new Lenis({
      duration: 1.1,
      smoothWheel: true,
      anchors: true,
      autoRaf: true
    });
    window.__lenis = lenis;
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

  // Scroll reveal
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

  // Hero load-in sequence (single orchestrated moment)
  window.addEventListener('DOMContentLoaded', function(){
    document.querySelectorAll('.reveal-word span').forEach(function(span, i){
      span.style.transform = 'translateY(110%)';
      span.style.transition = 'transform .9s ' + (0.15 + i * 0.12) + 's cubic-bezier(.16,.8,.24,1)';
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){
          span.style.transform = 'translateY(0)';
        });
      });
    });
    document.querySelectorAll('.hero .reveal-line, .hero .reveal-fade').forEach(function(el, i){
      el.style.transitionDelay = (0.5 + i * 0.1) + 's';
      requestAnimationFrame(function(){
        requestAnimationFrame(function(){ el.classList.add('is-visible'); });
      });
    });
  });

  /* ========================================================================
     "Why SocialWox" — split layout: card reveal + scroll-tracking rail
     Cards fade/slide into place once, permanently, as they enter a
     reading band (so already-seen cards never flicker back out). The
     same observer toggles which rail label is "active" on the sticky
     left column — since that's a genuine two-way toggle, the highlight
     visibly tracks up and down the rail as the user scrolls in either
     direction, without any duplicate observer needed.
     ======================================================================== */
  (function(){
    var cards = Array.prototype.slice.call(document.querySelectorAll('.why__card'));
    var railItems = Array.prototype.slice.call(document.querySelectorAll('.why__rail-item'));
    if(!cards.length) return;

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if(reduceMotion || !('IntersectionObserver' in window)){
      cards.forEach(function(c){ c.classList.add('is-visible'); });
      if(railItems[0]) railItems[0].classList.add('is-active');
      return;
    }

    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        var idx = cards.indexOf(entry.target);
        if(entry.isIntersecting){
          entry.target.classList.add('is-visible');
          if(railItems[idx]) railItems[idx].classList.add('is-active');
        } else if(railItems[idx]){
          railItems[idx].classList.remove('is-active');
        }
      });
    }, { threshold: 0.2, rootMargin: '-15% 0px -35% 0px' });

    cards.forEach(function(c){ io.observe(c); });
  })();

  /* Subtle parallax on the oversized numerals — a few pixels of vertical
     drift keyed to each numeral's own position in the viewport, only
     while the section is actually on screen. Gated behind an
     IntersectionObserver so the scroll listener doesn't run (and cost
     anything) for the rest of the page. */
  (function(){
    var section = document.querySelector('.why');
    if(!section) return;
    var nums = Array.prototype.slice.call(section.querySelectorAll('.why__card-num'));
    if(!nums.length) return;
    if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    var ticking = false;
    function update(){
      var vh = window.innerHeight;
      nums.forEach(function(el){
        var rect = el.getBoundingClientRect();
        var center = rect.top + rect.height / 2;
        var offset = (center - vh / 2) / vh;
        var y = Math.max(-14, Math.min(14, offset * -26));
        el.style.transform = 'translateY(' + y.toFixed(1) + 'px)';
      });
      ticking = false;
    }
    function onScroll(){
      if(!ticking){
        ticking = true;
        requestAnimationFrame(update);
      }
    }

    if('IntersectionObserver' in window){
      var io2 = new IntersectionObserver(function(entries){
        entries.forEach(function(entry){
          if(entry.isIntersecting){
            window.addEventListener('scroll', onScroll, { passive:true });
            update();
          } else {
            window.removeEventListener('scroll', onScroll);
          }
        });
      }, { threshold: 0 });
      io2.observe(section);
    } else {
      window.addEventListener('scroll', onScroll, { passive:true });
      update();
    }
  })();

  /* ========================================================================
     SELECTED WORK — horizontal rotating showcase
     The three cards rotate continuously left-to-right on their own clock,
     completely decoupled from scrolling — the user can scroll past, into,
     or away from this section at any speed and the rotation keeps going
     underneath, uninterrupted. Position is advanced by elapsed time each
     animation frame (not by scroll events), which is what makes it smooth:
     scroll events fire at an inconsistent rate and were the source of the
     old choppiness, whereas a rAF loop paced by real elapsed time advances
     in perfectly even steps regardless of frame rate.
     ======================================================================== */
  (function(){
    var pin = document.getElementById('showcasePin');
    var stage = document.getElementById('showcaseStage');
    var track = document.getElementById('showcaseTrack');
    if(!pin || !stage || !track) return;

    var slides = Array.prototype.slice.call(track.querySelectorAll('.showcase-slide'));
    var N = slides.length;
    if(!N) return;

    var numEl = document.getElementById('showcaseNum');
    var nameEl = document.getElementById('showcaseName');
    var metaEl = document.getElementById('showcaseMeta');
    var dots = Array.prototype.slice.call(pin.querySelectorAll('.showcase-dot'));

    var spacing = 420;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var SECONDS_PER_SLIDE = 4.5; // time to glide from one slide to the next
    var speed = 1 / SECONDS_PER_SLIDE; // position units advanced per second
    var position = 0;
    var lastTime = null;
    var rafId = null;
    var running = false;

    function measure(){
      spacing = Math.min(window.innerWidth * 0.36, 430);
    }

    // Shortest signed distance from slide index i to the continuous
    // position, wrapped into (-N/2, N/2] so it always takes the nearest path.
    function wrappedDelta(i, position){
      var d = (i - position) % N;
      if(d < 0) d += N;
      if(d > N / 2) d -= N;
      return d;
    }

    function render(position){
      var nearest = ((Math.round(position) % N) + N) % N;

      slides.forEach(function(slide, i){
        var d = wrappedDelta(i, position);
        var absD = Math.abs(d);
        var scale = Math.max(1 - absD * 0.42, 0.46);
        var opacity = Math.max(1 - absD * 0.62, 0.16);
        var rotateY = Math.max(Math.min(-d * 9, 16), -16);
        var x = d * spacing;

        // Only transform/opacity are touched every frame — both are
        // compositor-only properties the browser can animate without
        // repainting. Sharpness (blur) is handled separately, as a CSS
        // class + transition, so it doesn't force a repaint every frame.
        slide.style.transform = 'translate3d(calc(-50% + ' + x.toFixed(1) + 'px), -50%, 0) scale(' + scale.toFixed(3) + ') rotateY(' + rotateY.toFixed(1) + 'deg)';
        slide.style.opacity = opacity.toFixed(2);
        slide.style.zIndex = String(Math.round((1 - absD) * 10) + 5);
        slide.classList.toggle('is-focused', i === nearest);
      });

      var focused = slides[nearest];
      if(focused && numEl && nameEl && metaEl){
        var ds = focused.dataset;
        numEl.textContent = String(nearest + 1).padStart(2, '0');
        nameEl.textContent = ds.name || '';
        metaEl.textContent = (ds.industry || '') + ' — Web design / Development';
      }
      dots.forEach(function(dot, i){ dot.classList.toggle('is-active', i === nearest); });
    }

    function tick(now){
      if(lastTime === null) lastTime = now;
      var dt = (now - lastTime) / 1000;
      lastTime = now;
      dt = Math.min(dt, 0.1); // guard against a huge jump after a throttled/backgrounded tab
      position += speed * dt;
      if(position >= N) position -= N;
      render(position);
      rafId = requestAnimationFrame(tick);
    }

    function start(){
      if(running) return;
      running = true;
      lastTime = null;
      rafId = requestAnimationFrame(tick);
    }

    function stop(){
      running = false;
      if(rafId) cancelAnimationFrame(rafId);
      rafId = null;
    }

    measure();
    window.addEventListener('resize', measure);

    if(reduceMotion){
      // Present the first slide as focus, statically, for reduced-motion users.
      render(0);
    } else {
      start();

      // Pause the loop only while the showcase is scrolled off-screen, purely
      // to save cycles on something nobody can see — this never blocks or
      // slows down the user's scrolling itself.
      if('IntersectionObserver' in window){
        var io = new IntersectionObserver(function(entries){
          entries.forEach(function(entry){
            if(entry.isIntersecting) start(); else stop();
          });
        }, { threshold: 0.05 });
        io.observe(stage);
      }
    }
  })();
})();
