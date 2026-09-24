# Carlos Velasco, portfolio

Live at **[charlsmex24.github.io/portfolio](https://charlsmex24.github.io/portfolio)**

Plain HTML, CSS and JavaScript with no build step, hosted on GitHub Pages. Built with Claude Code as an AI
pair programmer: I set the direction and the content, checked every fact and reviewed every screen.

## What's inside

| Part | How it works |
|---|---|
| Intro | First visit only. Real loading percentage, then the robot assembles from a point cloud of its own vertices and stands up. |
| Hero | A Unitree Go2 (MuJoCo Menagerie model) in three.js. Its feet stay planted while its body turns toward the cursor; each leg is solved with analytic inverse kinematics every frame (`assets/js/go2-kinematics.js`). Click and it waves. |
| Anatomy | Pinned scroll scene: the camera orbits and the robot comes apart, with callouts for five disciplines. |
| Projects | A sphere of project cards you can drag (with inertia); click a card to open that project. |
| Mostla agent | A quote verifier demo: only answers whose quote really appears in the source get through. |
| Ask my portfolio | A grounded Claude agent. A Cloudflare Worker (`agent/`) sends Claude a knowledge base about me with citations on, then checks every quote before showing it. Explained in [`docs/agente.md`](docs/agente.md). |
| Exoskeleton | A brush that reveals the real prototype under its line drawing. |
| Ending | My portrait as points that assemble when you arrive and move out of the cursor's way. |

## Stack

- three.js 0.186 (importmap from jsDelivr), GSAP + ScrollTrigger, Lenis
- Archivo (Google Fonts)
- Agent: Cloudflare Worker + Anthropic SDK (`claude-opus-5`, Citations, prompt caching)
- Respects `prefers-reduced-motion` (fades only, no pinning or scroll-driven motion) and works without WebGL

## Run locally

```bash
python -m http.server 8770
```

Agent (optional, answers offline without an API key):

```bash
cd agent && npm install && npm run dev
```

Tests (verifier, offline search, leg kinematics):

```bash
cd agent && npm test
```

## Credits

- Unitree Go2 model: [MuJoCo Menagerie](https://github.com/google-deepmind/mujoco_menagerie/tree/main/unitree_go2), BSD-3-Clause, © Unitree Robotics (`assets/models/LICENSE-unitree-go2.txt`)
- Ideas taken from: [behfar.dev](https://behfar.dev) (portrait as points), [bleibtgleich.dev](https://bleibtgleich.dev) (reveal brush, project sphere)

## Contact

[vmcarlos024@gmail.com](mailto:vmcarlos024@gmail.com) · [LinkedIn](https://www.linkedin.com/in/carlos-velasco-moreno) · [GitHub](https://github.com/CharlsMex24)
