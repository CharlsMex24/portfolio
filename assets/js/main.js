/* ══════════════════════════════════════════════════════════════════════
   Carlos Velasco — Portfolio · main.js
   Vanilla JS, no dependencies. Powers: particle canvas, hero window cards,
   typewriter, animated counters, scroll reveal, portfolio filter, 3D tilt,
   certificate modal viewer, and mobile nav.
   ══════════════════════════════════════════════════════════════════════ */

/* ── PARTICLE CANVAS (hero background network) ─────────────────────────── */
(function () {
  const canvas = document.getElementById("hero-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let W, H, particles;
  const mouse = { x: -9999, y: -9999 };
  const COLORS = [
    "rgba(139,92,246,",
    "rgba(59,130,246,",
    "rgba(34,211,238,",
    "rgba(99,102,241,",
  ];
  const N = 180,
    CONNECT = 175,
    MOUSE_R = 130;

  function resize() {
    W = canvas.width = canvas.offsetWidth || window.innerWidth;
    H = canvas.height = canvas.offsetHeight || window.innerHeight;
  }
  function mk() {
    const c = COLORS[Math.floor(Math.random() * COLORS.length)];
    return {
      x: Math.random() * W,
      y: Math.random() * H,
      vx: (Math.random() - 0.5) * 0.75,
      vy: (Math.random() - 0.5) * 0.75,
      r: Math.random() * 2 + 0.9,
      c,
    };
  }
  function init() {
    resize();
    particles = Array.from({ length: N }, mk);
  }
  function draw() {
    ctx.clearRect(0, 0, W, H);
    particles.forEach((p) => {
      const dx = p.x - mouse.x,
        dy = p.y - mouse.y,
        d = Math.sqrt(dx * dx + dy * dy);
      if (d < MOUSE_R) {
        const f = ((MOUSE_R - d) / MOUSE_R) * 0.016;
        p.vx += dx * f;
        p.vy += dy * f;
      }
      p.vx *= 0.995;
      p.vy *= 0.995;
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0) p.x = W;
      if (p.x > W) p.x = 0;
      if (p.y < 0) p.y = H;
      if (p.y > H) p.y = 0;
    });
    for (let i = 0; i < particles.length; i++)
      for (let j = i + 1; j < particles.length; j++) {
        const a = particles[i],
          b = particles[j],
          dx = a.x - b.x,
          dy = a.y - b.y,
          d = Math.sqrt(dx * dx + dy * dy);
        if (d < CONNECT) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = a.c + (1 - d / CONNECT) * 0.85 + ")";
          ctx.lineWidth = 1.3;
          ctx.stroke();
        }
      }
    particles.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.c + ".8)";
      ctx.shadowBlur = 7;
      ctx.shadowColor = p.c + ".5)";
      ctx.fill();
      ctx.shadowBlur = 0;
    });
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", resize);
  const hero = document.getElementById("home");
  if (hero) {
    hero.addEventListener("mousemove", (e) => {
      const r = canvas.getBoundingClientRect();
      mouse.x = e.clientX - r.left;
      mouse.y = e.clientY - r.top;
    });
    hero.addEventListener("mouseleave", () => {
      mouse.x = -9999;
      mouse.y = -9999;
    });
  }
  init();
  draw();
})();

/* ── HERO WINDOW CARDS FLY-IN ──────────────────────────────────────────── */
(function () {
  const delays = { winShell: 500, winCode: 750, winExo: 1000 };
  Object.entries(delays).forEach(([id, ms]) => {
    const el = document.getElementById(id);
    if (!el) return;
    setTimeout(() => el.classList.add("win-in"), ms);
  });
})();

/* ── SCROLL PROGRESS BAR ───────────────────────────────────────────────── */
window.addEventListener("scroll", () => {
  const bar = document.getElementById("spbar");
  if (!bar) return;
  const max = document.body.scrollHeight - window.innerHeight;
  bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + "%";
});

/* ── MOBILE NAV (exposed globally for inline onclick) ──────────────────── */
function toggleNav() {
  const nav = document.getElementById("navLinks");
  if (nav) nav.classList.toggle("open");
}
function closeNav() {
  const nav = document.getElementById("navLinks");
  if (nav) nav.classList.remove("open");
}

/* ── TYPEWRITER ────────────────────────────────────────────────────────── */
(function () {
  const tw = document.getElementById("tw");
  if (!tw) return;
  const phrases = [
    "Mechatronics Engineering",
    "AI & Robotics",
    "Chairless Chair Builder",
    "Energy-Efficient Systems",
  ];
  let pi = 0,
    ci = 0,
    del = false;
  function type() {
    const w = phrases[pi];
    if (!del) {
      tw.textContent = w.slice(0, ++ci);
      if (ci === w.length) {
        del = true;
        setTimeout(type, 1900);
        return;
      }
    } else {
      tw.textContent = w.slice(0, --ci);
      if (ci === 0) {
        del = false;
        pi = (pi + 1) % phrases.length;
      }
    }
    setTimeout(type, del ? 50 : 95);
  }
  setTimeout(type, 1200);
})();

/* ── ANIMATED COUNTERS ─────────────────────────────────────────────────── */
function animCount(el) {
  const t = parseInt(el.dataset.count, 10);
  if (isNaN(t)) return;
  if (el.dataset.done) return;
  el.dataset.done = "1";
  let c = 0;
  const step = Math.max(1, Math.ceil(t / 60));
  (function tick() {
    c = Math.min(c + step, t);
    el.textContent = c;
    if (c < t) requestAnimationFrame(tick);
  })();
}

/* ── SCROLL REVEAL (+ counters + progress bars) ────────────────────────── */
(function () {
  if (!("IntersectionObserver" in window)) {
    document.querySelectorAll(".reveal").forEach((el) => el.classList.add("visible"));
    document.querySelectorAll("[data-count]").forEach(animCount);
    return;
  }
  const ro = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        e.target.classList.add("visible");
        e.target.querySelectorAll("[data-count]").forEach(animCount);
        e.target.querySelectorAll(".wip-fill").forEach((b) => {
          b.style.width = b.dataset.pct + "%";
        });
        ro.unobserve(e.target);
      });
    },
    { threshold: 0.1, rootMargin: "0px 0px -50px 0px" },
  );
  document.querySelectorAll(".reveal").forEach((el) => ro.observe(el));

  const heroObs = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) e.target.querySelectorAll("[data-count]").forEach(animCount);
      });
    },
    { threshold: 0.5 },
  );
  document.querySelectorAll(".hero-stats").forEach((el) => heroObs.observe(el));
})();

/* ── PORTFOLIO FILTER ──────────────────────────────────────────────────── */
document.querySelectorAll(".flt").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".flt").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const f = btn.dataset.f;
    document.querySelectorAll(".pcard").forEach((c) => {
      c.style.display = f === "all" || c.dataset.cat === f ? "" : "none";
    });
  });
});

/* ── 3D TILT on project cards ──────────────────────────────────────────── */
document.querySelectorAll(".pcard").forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const r = card.getBoundingClientRect();
    const cx = e.clientX - r.left,
      cy = e.clientY - r.top;
    const rx = (cy / r.height - 0.5) * -6;
    const ry = (cx / r.width - 0.5) * 6;
    card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateY(-4px)`;
  });
  card.addEventListener("mouseleave", () => {
    card.style.transform = "";
  });
});

/* ── CERTIFICATE / PROJECT MODAL (global for inline onclick) ───────────── */
function openModal(src, cap) {
  const modal = document.getElementById("certModal");
  const content = document.getElementById("modalContent");
  const capEl = document.getElementById("modalCap");
  if (!modal || !content) return;

  const isPdf = /\.pdf(\?|$)/i.test(src);
  content.innerHTML = isPdf
    ? `<iframe src="${src}" title="${cap || "Document"}" loading="lazy"
         style="width:100%;height:78vh;border:0;display:block;background:#fff"></iframe>`
    : `<img src="${src}" alt="${cap || "Certificate"}"
         style="max-width:100%;max-height:80vh;display:block;margin:0 auto" />`;
  if (capEl) capEl.textContent = cap || "";

  modal.classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeModal() {
  const modal = document.getElementById("certModal");
  if (!modal) return;
  modal.classList.remove("open");
  document.body.style.overflow = "";
  const content = document.getElementById("modalContent");
  if (content) content.innerHTML = "";
}

/* Close the modal on overlay click or Escape. */
(function () {
  const modal = document.getElementById("certModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) closeModal();
    });
  }
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });
})();

