# Task D-PILOT — GLOW HOUR Animated Pilot (50s composition + render)

## Task
Create a Remotion composition for the GLOW HOUR animated pilot (50s / 1500
frames @ 30fps, 1920x1080, no audio), render it, and prove via VLM contact
sheet that it reads as intentional animation (A) rather than a slideshow (B).

## Outcome
**VLM VERDICT: A (animated)** — first letter of the verdict response.
Full record saved at `data/benchmark/test-d/pilot-animated-vlm-verdict.json`.

> "The video features two main characters: a green lantern-like robot and a
> small orange mushroom creature. Across the sampled frames, the mushroom
> character clearly moves from the left side of the screen to the right, and
> a red glowing orb appears and shifts position in the background. These
> changes in character location and the introduction of new elements
> indicate intentional animation rather than a static slideshow."

## Deliverables
| Artifact | Path |
|---|---|
| Final video (50.09s, 1920x1080, 30fps, H.264, 8.88MB) | `data/videos/test-d-pilot-animated.mp4` |
| Render chunks (2 × 750 frames, resumable) | `data/videos/pilot-chunks/pilot-chunk-{1,2}.mp4` |
| Contact sheet (6 frames @ 2/10/20/30/40/48s, 2400x900) | `data/benchmark/test-d/pilot-animated-contact-sheet.jpg` |
| Sampled frames | `data/benchmark/test-d/pilot-frames/frame-{01..06}.jpg` |
| VLM verdict record | `data/benchmark/test-d/pilot-animated-vlm-verdict.json` |
| Pilot composition | `src/video/compositions/AnimatedPilotComposition.tsx` |
| Composition registration | `src/video/Root.tsx` → id `animated-pilot` |
| Render script | `render-pilot.ts` |
| VLM verdict script | `tmp-scripts/vlm-verdict-pilot.ts` |

Reused unchanged from D-ANIM-PROOF: `src/video/animation/characterMotion.ts`
(primitives) and `src/video/animation/GlowHourCharacters.tsx` (Pip / Bramble /
Dot vector characters).

## Composition design (1500 frames, 4 acts)
Background is pure CSS (no image asset): dusk sky gradient, 22 seeded
twinkling stars, breathing moon halo, warm light pool on the ground, ambient
lamp halo behind Bramble, group-moment radial flashes, vignette, 14 drifting
motes, GLOW HOUR caption (fade in f10-30, out f1425-1465), 0.5s opening
fade-in, fade-to-black f1440-1497.

- **ACT 1 (0-12s, f0-360) — Bramble alone**: sprouts at f20 (spring), lamp
  flickers on f45-75 via 7-keyframe ignition curve + persistent jitter, idle
  bob/blink/glow breathing, slow look-around sway, two 26px hops (f200, f300),
  call-out speech with arcs f270-330 (calling into the dark).
- **ACT 2 (12-25s, f360-750) — Pip arrives**: spring-enters from left at f390
  (3 decaying bounce hops 80/44/20px, squash-stretch at every landing), then
  shuffles +55px closer (f444-496, easeInOut). Bramble SPEAKS f440-620
  (word-rhythm glow, speech arcs, lean-in tilt, open mouth); Pip listens
  (tilt 6°, widened eyes, two nod bursts f500-586); Pip replies f630-720
  (5 × 36px hops, mouth flap on sin rhythm).
- **ACT 3 (25-38s, f750-1140) — Dot joins**: Dot popIn at f780 (squash pop +
  trail); Pip surprise-shake f786 (decaying ±13px) then 5 excited 44px hops
  f810-870; Dot excited-hover (f780-880) blends into a wide lissajous flight
  between Pip and Bramble (x ±230px, y ±110px; blend f860-900); synchronized
  group glow-pulse f930-1140 (sin 0.42 rad/f + synced bob + scene flash +
  brighter motes).
- **ACT 4 (38-50s, f1140-1500) — settle**: Pip one last slow 30px hop f1160;
  Dot eases (easeInOut f1140-1260) from its flight position down to a hover
  spot at (715, 700) with ramped-in hover bob; gentle group glow-pulse
  f1260-1470 (sin 0.16 rad/f, soft bob); fade to black f1440-1497.

Continuity across the render chunk boundary (f750) is free: every motion is a
pure function of the absolute frame number.

## Render path (render-pilot.ts)
- Bundle once (`src/video/index.ts`), `selectComposition('animated-pilot')`,
  assert 1500 frames / 30fps / 1920x1080.
- Render 2 chunks with `renderMedia({ frameRange })`: [0,749] and [750,1499]
  (25s each — 50s single render exceeds the ~43s crash ceiling on this box).
- Resume support: chunks >500KB already on disk are skipped.
- Concat via ffmpeg concat demuxer `-c copy` (libx264 re-encode fallback),
  then assert final duration 49.5-51s.
- Performance: chunk 1 = 132s, chunk 2 = 138s (~5.7fps per chunk — faster
  than the 12s proof's ~4.4fps because the background is pure CSS gradients,
  no image decode). Output has a silent AAC track (Remotion default mux).

## Verification
- ffprobe: H.264 1920x1080 30fps, 50.09s, 8.88MB.
- 6 frames @ 2/10/20/30/40/48s → all unique MD5s (no static repeats).
- VLM contact-sheet verdict: **A = animated** (correctly identified Bramble,
  Pip, and Dot + their motion).
- `bun run lint`: 0 errors.
- `tsc`: no new errors (Root.tsx FC-type errors on the Documentary/Tutorial
  compositions are pre-existing — verified pre-existing via git stash).
- dev.log: only pre-existing `@remotion/*` webpack warnings from the v3
  engine; `src/video/*` is not imported by any Next.js route.
- NOTE: `data/audio/test-d/` TTS clips mentioned in the briefing do not exist
  in this environment; pilot rendered without audio as specified.

## Handoff notes
1. Render any future edit: `bun run render-pilot.ts` (chunks are cached —
   delete `data/videos/pilot-chunks/*.mp4` to force full re-render).
2. Audio can be muxed later with ffmpeg (`-i video -i audio -c copy`) or by
   adding `<Audio>` to the composition; speaking timings (brambleSpeak
   f440-620, pipReply f630-720, brambleCall f270-330) are the natural TTS
   attachment points.
3. All beats are in the `T` constant table at the top of
   AnimatedPilotComposition.tsx — retime acts by editing those frame numbers.
4. Chunked render + pure-function-of-frame timelines is the template for any
   composition >43s.
