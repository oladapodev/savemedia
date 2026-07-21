# Mobile Responsive Polish Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/mobile-ui-redesign.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the mobile surfaces around the stronger reference hero while eliminating narrow-phone overflow, oversized promotional UI, heavy icons, and weak empty states.

**Architecture:** Fix sizing at shared UI boundaries first, then compose screens from responsive primitives instead of fixed horizontal rows. Preserve screen behavior and public props while replacing the icon renderer with explicitly imported Lucide outline icons and introducing reusable segmented-choice and empty-state components.

**Tech Stack:** React Native 0.86, Expo SDK 57, TypeScript, Lucide React Native, react-native-svg, Jest Expo, React Native Testing Library.

---

### Task 1: Responsive UI primitives and outline icon system

**Files:**
- Modify: `mobile/package.json`
- Modify: `bun.lock`
- Modify: `mobile/src/ui/icon.tsx`
- Modify: `mobile/src/ui/button.tsx`
- Modify: `mobile/src/ui/layout.tsx`
- Create: `mobile/src/ui/choice-bar.tsx`
- Create: `mobile/src/ui/empty-state.tsx`
- Modify: `mobile/src/ui/index.ts`
- Modify: `mobile/src/ui/ui.test.tsx`

- [x] **Step 1: Write failing responsive primitive tests**

Add tests requiring buttons to shrink within their parent, a three-option full-width choice bar, Lucide outline icon rendering, and an outlined empty state with optional action.

- [x] **Step 2: Run the UI tests and verify the new contracts fail**

Run `cd mobile && node ../node_modules/jest/bin/jest.js --runInBand src/ui/ui.test.tsx` and confirm failures are caused by missing responsive primitives.

- [x] **Step 3: Install and implement the primitives**

Install Expo-compatible `react-native-svg` plus `lucide-react-native`. Import each Lucide icon explicitly, keep the existing `IconName` API, set a consistent 1.8 outline stroke, make buttons shrink safely, add `ChoiceBar`, and build an outline-only `EmptyState` illustration.

- [x] **Step 4: Run UI tests and TypeScript**

Run the focused UI test and `bun run --cwd mobile typecheck`; both must pass.

### Task 2: Reference hero and compact promotional carousel

**Files:**
- Modify: `mobile/src/features/home/home.tsx`
- Modify: `mobile/src/features/home/home.test.tsx`
- Modify: `mobile/src/features/home/promo-carousel.tsx`
- Modify: `mobile/src/features/home/promo-carousel.test.tsx`
- Modify: `mobile/assets/promos/promo-1.jpg`
- Modify: `mobile/assets/promos/promo-2.jpg`
- Modify: `mobile/assets/promos/promo-3.jpg`
- Modify: `mobile/assets/promos/promo-4.jpg`
- Modify: `mobile/assets/promos/promo-5.jpg`

- [x] **Step 1: Write failing Home and carousel regression tests**

Require a full-width orange hero, compact input/action layout that can stack below 360px, no promotional title, no baked white banner corners, and a carousel whose viewport follows its measured parent width.

- [x] **Step 2: Run focused tests and confirm the old composition fails**

Run both Home suites and verify failures point to the rounded floating hero, promotional heading, and fixed horizontal form.

- [x] **Step 3: Implement the reference composition**

Use an edge-to-edge orange hero with centered logo and white inner form, responsive narrow-phone form layout, a compact benefit strip, and a title-free banner carousel. Keep swipe, auto-advance, reduced-motion behavior, and accessible pagination while reducing visible control height.

- [x] **Step 4: Remove white image corners and verify dimensions**

Flood-fill only edge-connected near-white corner pixels to black, preserve all artwork and text, then verify every banner remains `1200x600`.

- [x] **Step 5: Run focused tests and TypeScript**

All Home/carousel tests and TypeScript must pass.

### Task 3: Responsive settings, actions, and empty states

**Files:**
- Modify: `mobile/src/features/settings/settings.tsx`
- Modify: `mobile/src/features/settings/row.tsx`
- Modify: `mobile/src/features/settings/settings.test.tsx`
- Modify: `mobile/src/features/downloads/downloads.tsx`
- Modify: `mobile/src/features/downloads/downloads.test.tsx`
- Modify: `mobile/src/features/history/history.tsx`
- Modify: `mobile/src/features/history/history.test.tsx`
- Modify: `mobile/src/features/media/detail.tsx`
- Modify: `mobile/src/features/media/detail.test.tsx`

- [x] **Step 1: Write failing narrow-layout and empty-state tests**

Require Theme and Quality controls to occupy their own full-width row, Downloads and History to use the outlined reusable empty state, and paired media actions to switch to a vertical layout on narrow screens.

- [x] **Step 2: Run focused tests and confirm current fixed rows fail**

Run the Settings, Downloads, History, and Media Detail suites and confirm failures represent the overflow and empty-state regressions.

- [x] **Step 3: Implement responsive screen composition**

Use `ChoiceBar` below setting labels, `EmptyState` for zero-result screens, and measured/window-width responsive action stacks. Preserve all callbacks, labels, themes, and accessibility roles.

- [x] **Step 4: Verify the complete responsive slice**

Run all changed suites, TypeScript, `git diff --check`, and inspect the Home, Settings, Downloads, History, and Media Detail layout contracts at 320px and 390px widths.
