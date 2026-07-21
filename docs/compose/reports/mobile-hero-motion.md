---
feature: mobile-hero-motion
status: delivered
specs:
  - docs/compose/specs/2026-07-21-mobile-hero-motion-design.md
plans:
  - docs/compose/plans/2026-07-21-mobile-hero-motion.md
branch: agent/mobile-hero-motion
commits: 3341fa1..aeb3cf0
---

# Mobile Hero and Motion — Final Report

## What Was Built

The Home screen now uses a rounded orange hero that keeps the older iMediaSave visual identity while removing its crowding. The official logo sits in a centered white tile, the brand copy remains concise, and the white download form overlaps the hero as a clear primary action. Benefits stay visually light, promotion artwork keeps its stable 2:1 frame, and lower Home sections enter in a short coordinated sequence.

The app now shares one motion language across buttons, links, choice controls, thumbnail retry, settings rows, carousel pagination, tab icons, and tab scene changes. Motion is restrained to short scale, fade, rise, and shift transitions rather than continuous decoration.

## Architecture

`mobile/src/ui/motion.tsx` owns preference detection and the reusable `MotionPressable`, `Reveal`, and `AnimatedFocus` primitives. Durations and decorative distance live in `mobile/src/ui/tokens.ts`; shared controls consume the primitives without changing their public APIs. Home composition remains in `mobile/src/features/home/home.tsx`, while `mobile/src/ui/tabs.ts` provides a pure transition policy consumed by the Expo Router tab layout.

Reduced-motion and screen-reader settings are tracked independently and combined before resolving motion. Disabled motion resolves state duration and travel to zero. Standard interactions use 120ms press feedback and 220ms state transitions with the native animation driver.

### Design Decisions

We chose React Native’s built-in `Animated` API because it provides native-driver performance without adding another native module or requiring a new development-client dependency. We chose router-supported `shift` tab scenes because they communicate navigation direction with less visual weight than custom page choreography. We kept the tab bar in normal layout flow with rounded margins so it appears floating without obscuring list content.

## Usage

No configuration or migration is required. Run the app on a physical phone with the existing development build:

```bash
cd /home/dev/Desktop/savemedia
bun run dev:mobile
```

System reduced-motion or an active screen reader automatically removes decorative movement. The normal experience retains immediate control feedback and fluid tab switching.

## Verification

The complete mobile Jest run passed 42 suites and 355 tests. Mobile TypeScript passed with `tsc --noEmit`, and `git diff --check` passed. Test-first evidence covers motion policy, conservative preference loading, standard reveal entrance state, independent accessibility preferences, hero geometry, navigation transition selection, clipboard privacy, URL validation, progress actions, carousel controls, and existing settings/history behavior. Physical-device visual acceptance remains the release check for exact safe-area and animation feel.

## Journey Log

> Brief notes on what informed the final design. Not required reading.

- [pivot] A duplicate Bun install in the worktree was stopped because Node already resolves the repository’s existing dependency tree from the nested worktree path.
- [lesson] Animated Pressable normalizes accessibility-state fields, so tests should assert semantic fields rather than exact internal object shape.
- [lesson] Reduced-motion and screen-reader preferences must be tracked separately before combining them, or one event can accidentally override the other.

## Source Materials

| File | Role | Notes |
|------|------|-------|
| `docs/compose/specs/2026-07-21-mobile-hero-motion-design.md` | Approved design | Visual, motion, navigation, and accessibility contract |
| `docs/compose/plans/2026-07-21-mobile-hero-motion.md` | Implementation plan | Complete |
