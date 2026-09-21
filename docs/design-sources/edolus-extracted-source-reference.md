# Edolus extracted source reference

Status: approved cinematic reference source for selected Insight Hub workspaces only; not a universal shell.

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


## Application-use boundary

Edolus supplies cinematic scene mechanics, not the product's entire information architecture.

When adapted into Insight Hub:
- retain the working app's navigation, search, filters, selection, drill-down, comparison, refresh/reload, source links, saved state, route/deep-link behavior, and live data states
- do not force a functional workspace into a passive linear story
- use cinematic scene elements as operational controls or context where useful
- keep error, loading, stale-data, refreshed-data, empty, and selected states legible
- preserve keyboard/mouse/touch operability where the existing feature supports it

## Subject-specific media rule

Replace Edolus-specific visual assets with media native to the selected workspace, not with generic filler.

For Federal Agencies, appropriate replacement material includes real agency logos/marks where permitted, agency/facility/location photography where licensing permits, official-source imagery, maps, agency metadata, organizational relationships, current feed content, and navigable agency records. The page should still feel like a live agency intelligence tool that can be explored and refreshed, not a cinematic brochure.
