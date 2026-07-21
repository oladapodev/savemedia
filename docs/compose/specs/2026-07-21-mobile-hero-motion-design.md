# Mobile Hero and Motion Design

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/mobile-hero-motion.md)

## [S1] Visual direction

The Home screen will return to the older orange-led composition without restoring its crowding. A rounded orange hero will contain a centered official logo tile, concise white brand copy, and a white link form that overlaps the hero’s lower edge. Benefits remain unfilled and lightweight, with color applied only to their icons.

## [S2] Motion language

Motion must make state changes legible rather than decorate every pixel. Shared press feedback uses a subtle 0.98 scale for 120ms. Page and hero sections use one short fade-and-rise sequence, with no per-item delay above 40ms and no interaction animation above 240ms. Progress remains linear. All motion uses React Native’s built-in `Animated` API and native driver, avoiding another native dependency.

## [S3] Navigation

The bottom navigation becomes a floating rounded surface with clear labels and a restrained orange active treatment. Tab scenes use the router’s supported `shift` transition at 220ms. Tab icons animate only when focus changes, and press targets remain at least 44 points.

## [S4] Accessibility and resilience

Reduced-motion and screen-reader preferences disable decorative entrance, focus, carousel, and scene motion while keeping controls immediate. Layout must remain intrinsic and responsive on narrow phones, large text, light mode, and dark mode. Existing download behavior, clipboard privacy, and testable accessibility names remain unchanged.

## [S5] Verification

Unit tests cover motion preference selection, hero geometry, navigation transition selection, and existing Home behavior. The complete mobile Jest and TypeScript checks must pass. Final visual acceptance is performed in an iMediaSave development build on a physical phone.
