/* Page behaviour that is not 3D: smooth scroll, reveals, counters, the quote verifier demo,
   the certificate viewer and copy-email. */

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export function initUI({ reduce }) {
  const hasGsap = Boolean(window.gsap && window.ScrollTrigger);
  window.__motionReady = true;
  if (!hasGsap) document.documentElement.classList.remove('js-motion');
  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  let lenis = null;
  if (hasGsap && !reduce && window.Lenis) {
    lenis = new Lenis({ lerp: 0.1, anchors: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((t) => lenis.raf(t * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  if (hasGsap) {
    // Text rises and sharpens; images settle from a slight zoom. Same system, different expression.
    ScrollTrigger.batch('[data-reveal]', {
      start: 'top 88%',
      once: true,
      onEnter: (els) => gsap.fromTo(els,
        { opacity: 0, y: reduce ? 0 : 22, filter: reduce ? 'none' : 'blur(6px)' },
        { opacity: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out', stagger: 0.06, clearProps: 'filter' }),
    });
    ScrollTrigger.batch('[data-reveal-img]', {
      start: 'top 90%',
      once: true,
      onEnter: (els) => gsap.fromTo(els,
        { opacity: 0, scale: reduce ? 1 : 1.04 },
        { opacity: 1, scale: 1, duration: 1.2, ease: 'power2.out', stagger: 0.08 }),
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
          v: target, duration: 1.6, ease: 'power3.out',
          onUpdate: () => { el.textContent = counter.v.toFixed(decimals); },
        }),
      });
    });

    document.fonts?.ready.then(() => ScrollTrigger.refresh());
    window.addEventListener('load', () => ScrollTrigger.refresh());
  }

  initVerifier(reduce);
  initViewer(lenis);
  initCopy();
  return { lenis, hasGsap };
}

function initVerifier(reduce) {
  const source = $('#sourceText');
  const run = $('#runVerifier');
  if (!source || !run) return;
  const normalize = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim();
  const escapeHtml = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const raw = source.textContent.replace(/\s+/g, ' ').trim();
  const haystack = raw.toLowerCase();
  // [start, end] of the quote inside the source, or null. Exact match; only case and spacing are forgiven.
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

  const input = $('#ownQuote');
  const result = $('#ownResult');
  input?.addEventListener('input', () => {
    const typed = normalize(input.value);
    own = locate(typed);
    if (typed.length < 3) setVerdict(result, '', '');
    else setVerdict(result, own ? 'ok' : 'bad', own ? 'In source' : 'Not in source');
    paint();
  });
}

function initViewer(lenis) {
  const viewer = $('#viewer');
  if (!viewer) return;
  $$('[data-cert]').forEach((b) => b.addEventListener('click', () => {
    const name = b.dataset.cert;
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
}

function initCopy() {
  const copy = $('#copyMail');
  if (!copy) return;
  copy.addEventListener('click', async () => {
    const label = $('span', copy);
    try {
      await navigator.clipboard.writeText(copy.dataset.mail);
      label.textContent = 'Copied';
    } catch {
      label.textContent = 'Copy failed';
    }
    setTimeout(() => { label.textContent = 'Copy email'; }, 2000);
  });
}
