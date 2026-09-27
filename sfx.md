# Audio, Transitions & Visual Effects for CoCI

Add SFX + ambient BGM to event actions, screen transition effects, and visual polish (glowing, floating, particle effects) across all three screens.

## Current State

The app has 3 screens driven by `useProjectionHud`:
- **Menu** → [RecipeMenu.tsx](file:///c:/Users/Rangga Saputra/Documents/Pro_Trial/frontend/src/components/hud/RecipeMenu.tsx) — recipe carousel
- **Ingredient Check** → [IngredientCheck.tsx](file:///c:/Users/Rangga Saputra/Documents/Pro_Trial/frontend/src/components/hud/IngredientCheck.tsx) — ingredient checklist + camera
- **Cooking** → [RecipeHud.tsx](file:///c:/Users/Rangga Saputra/Documents/Pro_Trial/frontend/src/components/hud/RecipeHud.tsx) — step-by-step cooking UI

The app already uses `framer-motion` for animations. No audio system exists yet. No screen-to-screen transition effects. Visual effects are basic (some subtle glows on the stove rings).

---

## Proposed Changes

### 1. Audio System — SFX & BGM

#### [NEW] [useSoundEngine.ts](file:///c:/Users/Rangga Saputra/Documents/Pro_Trial/frontend/src/hooks/useSoundEngine.ts)

A custom hook wrapping the **Web Audio API** for zero-dependency audio playback. No npm packages needed.

**Sound Effects (SFX)** — short audio cues triggered on events:
| Event | Sound Style | Trigger Location |
|---|---|---|
| Carousel swipe (next/prev recipe) | Soft whoosh/tick | `RecipeMenu` card transition |
| Recipe selected (START COOKING) | Confirmation chime | `RecipeMenu.onInitialize` |
| Ingredient checked | Checkbox pop | `IngredientCheck.toggleIngredient` |
| All ingredients matched | Success fanfare | `IngredientCheck` when `itemsRemaining === 0` |
| Step advance (next) | Forward swoosh | `RecipeHud.onNextStep` |
| Step back (previous) | Reverse swoosh | `RecipeHud.onPreviousStep` |
| Timer start/stop | Click/beep | `RecipeHud` timer controls |
| Mode transition | Whoosh/portal | Screen changes in `ProjectionHud` |
| Gesture recognized | Subtle ping | `GestureStatusRail` on new action |
| Error/disconnect | Warning tone | WebSocket disconnect |

**Background Music (BGM)** — loopable ambient tracks:
- Ambient lo-fi/kitchen vibe track for menu screen
- Subtle cooking ambiance for cooking mode
- Volume auto-ducks when SFX plays
- Global mute toggle in the UI

**Audio files**: Procedurally generated via Web Audio API oscillators + filters (no external MP3 files needed). This keeps the app self-contained and avoids asset licensing.

> [!IMPORTANT]
> **Decision needed**: Would you prefer procedurally generated audio (synthesized bleeps, chimes — futuristic/sci-fi feel matching the HUD aesthetic) or should I source royalty-free MP3/WAV files and bundle them as static assets in `frontend/public/audio/`?

---

### 2. Screen Transition Effects

#### [MODIFY] [ProjectionHud.tsx](file:///c:/Users/Rangga Saputra/Documents/Pro_Trial/frontend/src/components/hud/ProjectionHud.tsx)

Wrap mode switches in `AnimatePresence` with coordinated enter/exit animations:

| Transition | Effect |
|---|---|
| Menu → Ingredient Check | Cards scale down + blur, new screen slides up with fade-in |
| Ingredient Check → Cooking | Radial wipe from center (like a camera aperture opening) |
| Any → Menu (back) | Current screen slides down + fades, menu fades in from behind |
| Mode switch overlay | Brief flash/pulse at the border edges during transition |

Implementation: `framer-motion`'s `AnimatePresence` with `mode="wait"`, custom `variants`, and a shared layout transition.

---

### 3. Visual Effects — Glow, Float & Particle

#### [NEW] [effects/GlowPulse.tsx](file:///c:/Users/Rangga Saputra/Documents/Pro_Trial/frontend/src/components/effects/GlowPulse.tsx)

Reusable glow wrapper that adds a pulsing neon glow around any element. Configurable color, intensity, and pulse speed.

#### [NEW] [effects/FloatingElement.tsx](file:///c:/Users/Rangga Saputra/Documents/Pro_Trial/frontend/src/components/effects/FloatingElement.tsx)

Wrapper that applies a gentle floating/bobbing animation (translateY oscillation + subtle rotation). For decorative elements, icons, status indicators.

#### [NEW] [effects/ParticleField.tsx](file:///c:/Users/Rangga Saputra/Documents/Pro_Trial/frontend/src/components/effects/ParticleField.tsx)

Ambient particle/sparkle overlay for background atmosphere. Configurable density, color palette, and drift direction. Based on the existing `ParticleField` concept in WelcomeMenu but more versatile.

#### [NEW] [effects/ScanlineOverlay.tsx](file:///c:/Users/Rangga Saputra/Documents/Pro_Trial/frontend/src/components/effects/ScanlineOverlay.tsx)

Subtle CRT/holographic scanline effect overlay. Reinforces the sci-fi projection HUD aesthetic. Very subtle opacity (~3-5%) to avoid distraction.

#### Where effects are applied:

| Screen | Effect | Target |
|---|---|---|
| **RecipeMenu** | `GlowPulse` | Active card border, dot indicator |
| **RecipeMenu** | `FloatingElement` | WebSocket status chip, background ambient orbs |
| **RecipeMenu** | `ParticleField` | Full-screen background (sparse, slow drift) |
| **IngredientCheck** | `GlowPulse` | Camera zone brackets, "START COOKING" button |
| **IngredientCheck** | `FloatingElement` | Scanner icon placeholder, detected items |
| **IngredientCheck** | Checkbox burst | Mini particle burst on ingredient check |
| **Cooking (RecipeHud)** | `GlowPulse` | Stove rings, active timer ring, NEXT button |
| **Cooking (RecipeHud)** | `FloatingElement` | Timer ring labels, stove center label |
| **Cooking (RecipeHud)** | `ScanlineOverlay` | Full-screen overlay (subtle) |
| **All Screens** | `GlowPulse` | Gesture status rail on new action |

---

### 4. What the Application Currently Lacks (Bonus Polish)

Beyond audio and effects, here are gaps I noticed during review:

| Gap | Suggestion | Priority |
|---|---|---|
| **No haptic/tactile feedback on gesture** | Flash the screen edge briefly when a gesture is recognized (edge pulse effect) | High |
| **No completion/celebration screen** | When all steps are done, show a "COMPLETE" celebration with confetti particles and a success sound | Medium |
| **Step progress has no animated transition** | Step text should animate in/out (slide + fade) when changing steps, not just swap | High |
| **Timer rings feel static** | Add a subtle glow pulse synchronized to the timer tick (1s heartbeat) | Medium |
| **No ambient motion in RecipeMenu background** | The `#0C0C0F` background is dead flat — add slow-moving gradient blobs or a subtle particle field | Medium |
| **Ingredient checkbox has no micro-animation** | Toggle should scale-bounce + color morph on check, plus the burst particle mentioned above | High |
| **No toast/notification for WebSocket reconnect** | Show a brief animated toast when connection drops/recovers | Low |
| **GestureStatusRail has no entry/exit per action** | Each gesture action text should animate individually (scale pop), not just appear | Medium |

---

## Open Questions

> [!IMPORTANT]
> **Audio approach**: Synthesized via Web Audio API (sci-fi bleeps, fully self-contained) vs. bundled audio files (more natural/realistic sounds, larger bundle)?  
> I recommend **synthesized** to match the futuristic HUD aesthetic and avoid file management.

> [!IMPORTANT]
> **BGM intensity**: Should background music play in all screens, or only in the Menu and Cooking screens? Ingredient check could stay silent for focus.

> [!NOTE]
> **Performance budget**: The particle/glow effects will use CSS animations + `framer-motion` (GPU-accelerated `transform`/`opacity` only). No canvas or WebGL needed. Electron should handle this fine.

---

## File Summary

### New Files
| File | Purpose |
|---|---|
| `frontend/src/hooks/useSoundEngine.ts` | Audio engine hook (SFX + BGM) |
| `frontend/src/components/effects/GlowPulse.tsx` | Pulsing glow wrapper |
| `frontend/src/components/effects/FloatingElement.tsx` | Floating/bobbing animation |
| `frontend/src/components/effects/ParticleField.tsx` | Background particle overlay |
| `frontend/src/components/effects/ScanlineOverlay.tsx` | Holographic scanline overlay |
| `frontend/src/components/effects/EdgePulse.tsx` | Screen-edge flash on gesture recognition |
| `frontend/src/components/effects/CheckBurst.tsx` | Mini particle burst for checkboxes |

### Modified Files
| File | Changes |
|---|---|
| `frontend/src/components/hud/ProjectionHud.tsx` | Add `AnimatePresence` transitions, wire `useSoundEngine`, add edge pulse |
| `frontend/src/components/hud/RecipeMenu.tsx` | Add SFX on swipe/select, `ParticleField` bg, `GlowPulse` on active card |
| `frontend/src/components/hud/IngredientCheck.tsx` | Add SFX on check/complete, glow on camera zone, checkbox burst |
| `frontend/src/components/hud/RecipeHud.tsx` | Add SFX on step/timer, glow on stove, floating labels, scanline |
| `frontend/src/components/hud/GestureStatusRail.tsx` | Add SFX ping on action, scale-pop animation |
| `frontend/src/hooks/useProjectionHud.ts` | No structural changes — effects are UI-layer only |

---

## Verification Plan

### Automated Tests
```powershell
cd frontend
npm run build
npm run lint
```

### Manual Verification
- Run `npm run electron:dev` and navigate through all 3 screens
- Verify SFX plays on each listed event
- Verify BGM starts/stops on mode transitions
- Verify glow, float, and particle effects render on correct elements
- Verify screen transitions animate smoothly (no flicker/jump)
- Verify no performance degradation (smooth 60fps on Electron)
