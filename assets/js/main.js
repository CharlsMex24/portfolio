/* Carlos Velasco, portfolio
   GSAP + ScrollTrigger for scroll work, Lenis for smooth scrolling.
   Everything degrades: no CDN means a static page, reduced motion means no animation. */
(() => {
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];

  const html = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
  const motion = hasGsap && !reduce;
  window.__motionReady = true;
  if (!hasGsap) html.classList.remove('js-motion');
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  // ---------- Smooth scroll
  let lenis = null;
  if (motion && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // ---------- Nav: mobile menu, hide on scroll down, current section
  const nav = $('#nav');
  const toggle = $('#navToggle');
  const setMenu = (open) => {
    nav.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', open);
    toggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
    $('use', toggle).setAttribute('href', open ? '#i-x' : '#i-menu');
  };
  toggle.addEventListener('click', () => setMenu(!nav.classList.contains('is-open')));
  $$('#navLinks a').forEach((a) => a.addEventListener('click', () => setMenu(false)));

  // ---------- Horizontal project pan. Created first so later triggers account for its pin.
  if (motion) {
    const more = $('.more');
    const track = $('#moreTrack');
    gsap.matchMedia().add('(min-width: 1024px)', () => {
      more.classList.add('more--pinned');
      const distance = () => track.scrollWidth - html.clientWidth;
      gsap.to(track, {
        x: () => -distance(),
        ease: 'none',
        scrollTrigger: {
          trigger: '.more__pin',
          start: 'top top',
          end: () => '+=' + distance(),
          pin: true,
          scrub: 1,
          invalidateOnRefresh: true,
        },
      });
      return () => more.classList.remove('more--pinned');
    });
  }

  if (hasGsap) {
    ScrollTrigger.create({
      start: 0,
      end: 'max',
      onUpdate(self) {
        const y = self.scroll();
        nav.classList.toggle('is-scrolled', y > 10);
        nav.classList.toggle('is-hidden', self.direction === 1 && y > 320 && !nav.classList.contains('is-open'));
      },
    });

    $$('#navLinks a').forEach((a) => {
      ScrollTrigger.create({
        trigger: a.getAttribute('href'),
        endTrigger: a.dataset.until || a.getAttribute('href'),
        start: 'top 50%',
        end: 'bottom 50%',
        onToggle: (self) => (self.isActive ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')),
      });
    });
  }

  // ---------- Text splitting
  function splitWords(el, masked) {
    const words = el.textContent.trim().split(/\s+/);
    el.textContent = '';
    return words.map((word, i) => {
      const inner = document.createElement('span');
      inner.textContent = word;
      if (masked) {
        const outer = document.createElement('span');
        outer.className = 'w';
        outer.append(inner);
        el.append(outer);
      } else {
        el.append(inner);
      }
      if (i < words.length - 1) el.append(' ');
      return inner;
    });
  }

  // ---------- Entrance and scroll animations
  if (motion) {
    // Hero
    gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.15 })
      .fromTo('[data-reveal-clip]', { clipPath: 'inset(100% 0% 0% 0%)' }, { clipPath: 'inset(0% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut' }, 0)
      .fromTo('.hero__frame img', { scale: 1.3 }, { scale: 1, duration: 1.8 }, 0)
      .fromTo('.hero__name .line > span', { yPercent: 110, y: 0 }, { yPercent: 0, duration: 1.2, stagger: 0.09 }, 0.35)
      .fromTo('[data-hero]', { opacity: 0, y: 16 }, { opacity: 1, y: 0, duration: 1, stagger: 0.08 }, 0.7);

    // Parallax photos
    $$('[data-parallax]').forEach((img) => {
      const amount = Number(img.dataset.parallax);
      gsap.fromTo(img, { yPercent: -amount }, {
        yPercent: amount,
        ease: 'none',
        scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
      });
    });

    // Section headings rise word by word
    $$('[data-split-words]').forEach((h) => {
      h.setAttribute('aria-label', h.textContent.trim());
      const words = splitWords(h, true);
      words.forEach((w) => w.parentElement.setAttribute('aria-hidden', 'true'));
      gsap.fromTo(words, { yPercent: 110 }, {
        yPercent: 0,
        duration: 1.1,
        ease: 'expo.out',
        stagger: 0.06,
        scrollTrigger: { trigger: h, start: 'top 88%', once: true },
      });
    });

    // The big email line
    $$('[data-split-lines]').forEach((el) => {
      if (el.closest('.hero')) return;
      gsap.fromTo($$('.line > span', el), { yPercent: 110, y: 0 }, {
        yPercent: 0,
        duration: 1.2,
        ease: 'expo.out',
        scrollTrigger: { trigger: el, start: 'top 92%', once: true },
      });
    });

    // Skills marquee: runs the way you scroll, faster when you scroll faster
    const marquee = $('#marquee');
    marquee.append(...[...marquee.children].map((n) => n.cloneNode(true)));
    const loop = gsap.to(marquee, { xPercent: -50, duration: 40, ease: 'none', repeat: -1 });
    loop.totalTime(loop.duration() * 500).pause(); // room to run backwards; plays once on screen
    ScrollTrigger.create({
      trigger: '.marquee',
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
      onUpdate: (self) => {
        const boost = Math.min(Math.abs(self.getVelocity()) / 500, 4);
        gsap.to(loop, { timeScale: self.direction * (1 + boost), duration: 0.4, overwrite: true });
      },
    });

    // Certificate preview that follows the cursor
    const peek = $('#certPeek');
    if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
      gsap.set(peek, { xPercent: -50, yPercent: -50, scale: 0.85 });
      const xTo = gsap.quickTo(peek, 'x', { duration: 0.5, ease: 'power3' });
      const yTo = gsap.quickTo(peek, 'y', { duration: 0.5, ease: 'power3' });
      const list = $('#certs');
      list.addEventListener('pointermove', (e) => { xTo(e.clientX + 170); yTo(e.clientY); });
      list.addEventListener('pointerleave', () => gsap.to(peek, { opacity: 0, scale: 0.85, duration: 0.3 }));
      $$('button', list).forEach((b) => b.addEventListener('pointerenter', () => {
        peek.src = b.dataset.img;
        gsap.to(peek, { opacity: 1, scale: 1, duration: 0.35, ease: 'power3.out' });
      }));
      list.addEventListener('pointerenter', () => $$('button', list).forEach((b) => { new Image().src = b.dataset.img; }), { once: true });
    }
  } else if (hasGsap) {
    // Reduced motion: the hero fades in without moving
    gsap.to('.hero__name, [data-reveal-clip], [data-hero]', { opacity: 1, duration: 0.9, stagger: 0.12, delay: 0.1 });
  }

  // Fades, counters and the reading highlight run in both modes: nothing here travels across the screen
  if (hasGsap) {
    const statement = $('[data-scrub-words]');
    gsap.fromTo(splitWords(statement, false), { opacity: 0.16 }, {
      opacity: 1,
      stagger: 0.05,
      ease: 'none',
      scrollTrigger: { trigger: statement, start: 'top 80%', end: 'bottom 55%', scrub: true },
    });

    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%',
      once: true,
      onEnter: (els) => gsap.fromTo(els, { opacity: 0, y: motion ? 28 : 0 }, { opacity: 1, y: 0, duration: 1, ease: 'expo.out', stagger: 0.08 }),
    });

    $$('[data-count]').forEach((el) => {
      const target = parseFloat(el.dataset.count);
      const decimals = (el.dataset.count.split('.')[1] || '').length;
      const counter = { v: 0 };
      el.textContent = (0).toFixed(decimals);
      ScrollTrigger.create({
        trigger: el,
        start: 'top 88%',
        once: true,
        onEnter: () => gsap.to(counter, {
          v: target,
          duration: 1.8,
          ease: 'power3.out',
          onUpdate: () => { el.textContent = counter.v.toFixed(decimals); },
        }),
      });
    });
  }

  // ---------- Exoskeleton case study: the step in view picks the picture
  const video = $('.case__media video');
  if (reduce && video) video.controls = true;
  if (hasGsap) {
    const media = $$('[data-step-media]');
    const steps = $$('[data-step]');
    const playIfShown = () => {
      if (!reduce && media[0].classList.contains('is-active')) video.play().catch(() => {});
      else video.pause();
    };
    const show = (i) => {
      media.forEach((m) => m.classList.toggle('is-active', Number(m.dataset.stepMedia) === i));
      steps.forEach((s) => s.classList.toggle('is-active', Number(s.dataset.step) === i));
      playIfShown();
    };
    $('.case').classList.add('case--live');
    gsap.matchMedia().add({ narrow: '(max-width: 900px)', wide: '(min-width: 901px)' }, (ctx) => {
      const at = ctx.conditions.narrow ? '75%' : '55%';
      steps.forEach((s, i) => ScrollTrigger.create({
        trigger: s,
        start: `top ${at}`,
        end: `bottom ${at}`,
        onToggle: (self) => self.isActive && show(i),
      }));
    });
    ScrollTrigger.create({
      trigger: '.case__body',
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => (self.isActive ? playIfShown() : video.pause()),
    });

    // Positions depend on fonts and images
    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  // ---------- Quote verifier demo
  const normalize = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  const source = $('#sourceText');
  const raw = source.textContent.replace(/\s+/g, ' ').trim();
  const haystack = raw.toLowerCase();
  // [start, end] of the quote inside the source, or null. Exact match, only case and spacing are forgiven.
  const locate = (quote) => {
    const q = normalize(quote);
    const at = q.length >= 3 ? haystack.indexOf(q) : -1;
    return at < 0 ? null : [at, at + q.length];
  };

  let accepted = [];
  let own = null;
  const paint = () => {
    const ranges = [...accepted, ...(own ? [own] : [])].sort((a, b) => a[0] - b[0]);
    const merged = [];
    for (const r of ranges) {
      const last = merged[merged.length - 1];
      if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
      else merged.push([...r]);
    }
    let out = '';
    let pos = 0;
    for (const [s, e] of merged) {
      out += escapeHtml(raw.slice(pos, s)) + '<mark>' + escapeHtml(raw.slice(s, e)) + '</mark>';
      pos = e;
    }
    source.innerHTML = out + escapeHtml(raw.slice(pos));
  };

  const setVerdict = (el, state, text) => {
    el.className = 'verdict' + (state ? ' is-' + state : '');
    el.textContent = text;
  };

  const run = $('#runVerifier');
  run.addEventListener('click', async () => {
    run.disabled = true;
    accepted = [];
    paint();
    const items = $$('#claims li');
    items.forEach((li) => { li.classList.remove('is-rejected'); setVerdict($('.verdict', li), '', ''); });
    for (const li of items) {
      const verdict = $('.verdict', li);
      setVerdict(verdict, 'checking', 'Checking');
      await wait(reduce ? 0 : 420);
      const hit = locate(li.dataset.quote);
      li.classList.toggle('is-rejected', !hit);
      setVerdict(verdict, hit ? 'ok' : 'bad', hit ? 'Accepted' : 'Not in source');
      if (hit) { accepted.push(hit); paint(); }
    }
    run.textContent = 'Run again';
    run.disabled = false;
  });

  const ownInput = $('#ownQuote');
  const ownResult = $('#ownResult');
  ownInput.addEventListener('input', () => {
    const typed = normalize(ownInput.value);
    own = locate(typed);
    if (typed.length < 3) setVerdict(ownResult, '', '');
    else setVerdict(ownResult, own ? 'ok' : 'bad', own ? 'In source' : 'Not in source');
    paint();
  });

  // ---------- Certificate viewer
  const viewer = $('#viewer');
  $$('#certs button').forEach((b) => b.addEventListener('click', () => {
    const name = $('.certs__name', b).textContent;
    $('#viewerTitle').textContent = name;
    $('#viewerImg').src = b.dataset.img;
    $('#viewerImg').alt = 'Certificate: ' + name;
    $('#viewerPdf').href = b.dataset.pdf;
    viewer.showModal();
    lenis?.stop();
  }));
  $('#viewerClose').addEventListener('click', () => viewer.close());
  viewer.addEventListener('click', (e) => { if (e.target === viewer) viewer.close(); });
  viewer.addEventListener('close', () => lenis?.start());

  // ---------- Copy email
  const copy = $('#copyMail');
  copy.addEventListener('click', async () => {
    const label = $('span', copy);
    const icon = $('use', copy);
    try {
      await navigator.clipboard.writeText(copy.dataset.mail);
      label.textContent = 'Copied';
      icon.setAttribute('href', '#i-check');
    } catch {
      label.textContent = 'Copy failed';
    }
    setTimeout(() => { label.textContent = 'Copy'; icon.setAttribute('href', '#i-copy'); }, 2000);
  });
})();
