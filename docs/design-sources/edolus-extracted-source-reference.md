# Edolus extracted source reference

Status: approved cinematic reference source.

## Confirmed runtime architecture

- Full-viewport PlayCanvas application canvas.
- PlayCanvas runtime identifies itself as 2.21.4 in the captured DOM.
- WebGL 2 rendering path is active.
- GSAP is present and drives loading/title/CTA motion.
- Scene loading, shader warm-up, preload progress, band-opening reveal, blurred title transitions, and CTA construction are all implemented as explicit runtime behavior rather than inferred styling.
- The capture includes loaded JS/CSS source text, computed DOM/layout, runtime VFX searches, animation state, WebGL state, browser-state output, resource/network inventory, and VFX asset inventory.

## Approved reuse

Use the captured implementation as the canonical Edolus reference for:
- full-screen scene composition
- motion timing and easing
- camera/scene progression
- preload and reveal choreography
- data/particle-flow treatment
- shader/effect behavior
- spatial layering
- typography hierarchy and placement
- interaction grammar
- sparse overlay controls
- transition logic
- responsive canvas behavior

Do not infer these behaviors from screenshots when the extraction contains exact source/runtime evidence.

## Excluded assets/content

Do not reuse:
- Edolus brand identity or copy
- AI-specific subject matter
- proprietary photographs/rendered picture assets
- Edolus logos
- identifiable branded 3D/media assets

Replace those with Insight Hub data and licensed/open scientific, geographic, occupational, legal, medical, federal, standards, or defense visuals.

## Implementation note

The captured canvas PNG may appear black because the Edolus PlayCanvas configuration uses preserveDrawingBuffer=false. Treat the runtime/source captures as authoritative; do not interpret a blank canvas export as evidence that the 3D scene failed to load.
