# Carlos Velasco — Portfolio

> Personal portfolio and evidence showcase built from scratch with vanilla HTML, CSS, and JavaScript.  
> Live at **[charlsmex24.github.io/portfolio](https://charlsmex24.github.io/portfolio)**

---

## About

This site is my personal engineering portfolio — a single-page application that documents my academic work, competition results, certifications, and ongoing projects. Everything here is real: no template, no framework, no boilerplate.

Built as both a public-facing portfolio and a proof of concept that a well-crafted static site can look and perform as well as any framework-based one.

---

## What's inside

| Section | Content |
|---|---|
| Hero | Name, current role, photo of the exoskeleton prototype |
| About | Short bio that lights up as you scroll, key facts |
| Work | Exoskeleton case study: sticky media that follows the steps (video, CAD, FEA, prototype) |
| Agent | The Mostla agent idea plus a live quote-verifier demo |
| More projects | VibeMap, QuestBody, Borregos website, clinic simulation (horizontal scroll) |
| Racing | Shell Eco-marathon 2025 results with certificates |
| Experience | Mostla, SHIELD, Borregos Racing, Tec de Monterrey |
| Skills | Skills by area and certifications with a preview viewer |
| Contact | Email (copy button), LinkedIn, GitHub, resume |

---

## Tech stack

- **HTML, CSS, JavaScript**, no build step
- **GSAP + ScrollTrigger** (cdnjs) for scroll animations and the pinned horizontal section
- **Lenis** (jsDelivr) for smooth scrolling
- Geist and Geist Mono (Google Fonts), Phosphor icons inlined as an SVG sprite
- Follows the OS light/dark setting and `prefers-reduced-motion` (fades only, no movement).
  Works without the CDNs as a static page.

---

## Highlights

-  Shell Eco-marathon Brazil 2025 — **2nd place**, 373.2 km/kWh (Prototype Battery-Electric)
-  Shell Eco-marathon Americas 2025 — **2nd place**, 196.8 mi/kWh
-  NVIDIA Deep Learning Institute — Fundamentals of Deep Learning
-  Chairless Chair — passive lower-limb exoskeleton, designed, simulated and printed at full scale (2026)

---

## Run locally

```bash
python -m http.server 8000
# then open http://localhost:8000
```

---

## Project structure

```
portfolio/
├── index.html
├── .gitignore
├── README.md
└── assets/
    ├── css/styles.css
    ├── js/main.js
    ├── images/
    │   ├── profile/
    │   ├── events/
    │   └── projects/
    ├── certificates/
    ├── documents/cv.pdf
    └── icons/favicon.ico
```

---

## Contact

**Carlos Velasco** · Mechatronics Engineering · ITESM Monterrey  
[vmcarlos024@gmail.com](mailto:vmcarlos024@gmail.com) · [LinkedIn](https://www.linkedin.com/in/carlos-velasco-moreno) · [GitHub](https://github.com/CharlsMex24)
