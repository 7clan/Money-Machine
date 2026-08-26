# Task D-ANIM-PROOF — Animation Proof Builder

## Task
Build a 10–15s ANIMATION PROOF for TEST D "GLOW HOUR" proving that layered
vector character animation (via Remotion) fixes the VLM "slideshow" verdict (B)
that the Ken Burns-on-stills pilot received.

## Outcome
**VLM VERDICT: A (animated)** — first letter of the verdict response.
Full verdict saved at `data/benchmark/test-d/animation-proof-vlm-verdict.json`.

> "A — The scene features two characters—a green lantern-like figure and a
> yellow mushroom-like figure—that clearly move across the frames. The green
> character remains relatively stationary while the yellow mushroom enters
> from the left, moves toward the center, and then exits to the right,
> demonstrating intentional animation rather than a static slideshow."

## Deliverables
| Artifact | Path |
|---|---|
| Final video (12.05s, 1920x1080, 30fps, H.264, 8.5MB) | `data/videos/test-d-animation-proof.mp4` |
| Contact sheet (6 frames @ 1/3/5/7/9/11s) | `data/benchmark/test-d/animation-proof-contact-sheet.jpg` |
| Sampled frames | `data/benchmark/test-d/proof-frames/f_{1,3,5,7,9,11}s.jpg` |
| VLM verdict record | `data/benchmark/test-d/animation-proof-vlm-verdict.json` |
| GLOW HOUR scene background | `public/test-d/scene-01.png` (1344x768, generated) |
| Animation primitives (reusable) | `src/video/animation/characterMotion.ts` |
| Vector characters (reusable) | `src/video/animation/GlowHourCharacters.tsx` |
| Composition | `src/video/compositions/AnimatedSceneProof.tsx` |
| Composition registration | `src/video/Root.tsx` → id `animation-proof` |
| Render script | `render-animation-proof.ts` |
| Background generator | `generate-test-d-bg.ts` |

## Important environment note
The TEST D assets referenced in the briefing did **not exist** in this
environment (`data/assets/test-d/`, `data/audio/test-d/`,
`data/pipeline-state/test-d-series-bible.json`, `public/test-d/`,
`data/videos/test-d-glow-hour-720p.mp4` — all missing; possibly being produced
by a parallel agent). The proof is therefore **self-sufficient**: it generates
its own GLOW HOUR background into `public/test-d/scene-01.png`. When the real
TEST D scene images land in `public/test-d/`, the composition's
`backgroundPath` prop can be pointed at any of them without code changes.

## Architecture — layered character animation
Since existing scene images cannot be segmented into layers, the proof layers
simple vector characters OVER the scene background:

- **Pip** — cream mushroom kid (amber cap, blush, blinking eyes), x=300
- **Bramble** — green lantern creature (brass dome, glowing chest window,
  speech arcs), x=700, taller
- **Dot** — tiny red LED firefly (strobing core, motion trail), x=550, floating

### Animation primitives (`characterMotion.ts`, pure functions of frame)
`springEnter` (bouncy overshoot arrive) · `popIn` (snappy squash pop) ·
`idleBob` (breathing sine) · `glowPulse` (brightness oscillation) ·
`eyeOpenness` (blink with per-character seed) · `surpriseShake` (decaying
side-to-side) · `hop` (parabolic arc, repeatable) · `speakingGlow`
(word-rhythm brightness + envelope ramps) · `exitSlide` (easeIn accelerate-out) ·
`seededRandom` / `moteDrift` (deterministic firefly paths, no Math.random).

### 12s timeline (360 frames @ 30fps)
- 0–2s: empty dusk scene, breathing ambient glow, 14 drifting firefly motes,
  Bramble ignites/grows from the ground at f22 (lamp-lighting motion)
- 2–4s: Pip spring-enters from left (overshoot skid) with 3 decaying bounce
  hops + landing squash-and-stretch
- 4–6s: Bramble SPEAKS — glow brightens on word rhythm, speech arcs emanate,
  leans forward; Pip listens (head tilt, widened eyes)
- 6–8s: Dot pops in (f182) with scale pop + trail; Pip does surprise shake
  (f186) then 3 excited hops; Dot bobs excitedly, LED core strobes
- 8–10s: group moment — all three glow-pulse in sync + synchronized bob,
  scene flash, motes brighten
- 10–12s: Pip exits right accelerating (f300, leans forward, parting hop);
  Dot follows with trail (f316); Bramble dims to 45%

### Render performance notes
- No CSS `filter: blur()` — all glows are radial-gradient discs (cheap in
  headless Chrome on this 2-core box)
- 360 frames rendered in **81s (~4.4 fps)** in ONE chunk (12s ≪ 43s crash
  ceiling), `chromiumOptions.enableMultiProcessOnLinux: true`
- Z.ai image generation requires sizes that are multiples of 32 (512–2880px):
  `1440x720` is INVALID (720 not multiple of 32) → used `1344x768`

## Verification
- Render probe: H.264 1920x1080 30fps, 12.05s duration, 8.51MB
- All 6 sampled frames have unique MD5s (no repeated/static frames)
- VLM frame inspection at 7s correctly identified all three characters,
  their positions, the caption, and no broken shapes
- VLM contact-sheet verdict: **A = animated**
- `bun run lint`: 0 errors
- `src/video/*` is not imported by any Next.js route (Remotion-only); dev.log
  warnings about `@remotion/compositor-*` are pre-existing webpack warnings
  from the v3 engine and unrelated to this task

## Handoff notes for the next agent (D full-pilot rerender)
1. Composition id `animation-proof` is registered in `src/video/Root.tsx`;
   render via `bun run render-animation-proof.ts`
2. To swap backgrounds: pass `backgroundPath` prop (must live under `public/`,
   reference via Remotion `staticFile()` — Chrome Headless Shell blocks `file://`)
3. The characters + primitives are fully reusable — extend `GlowHourCharacters.tsx`
   poses (e.g. walk cycle, arm gestures) rather than forking
4. For the 58s pilot: chunk renders at ≤43s per chunk (crash ceiling) and
   consider 720p for iteration speed; the proof rendered 1080p at ~4.4fps
5. `data/benchmark/test-d/` is the canonical TEST D benchmark artifacts dir
