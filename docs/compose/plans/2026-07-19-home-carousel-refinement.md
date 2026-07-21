# Home Carousel Refinement Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/mobile-ui-redesign.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refine the iMediaSave Home screen with its supplied logo, a rounded branded header, neutral benefit tiles, and a lightweight auto-swiping promotional carousel built from the supplied Telegram banners.

**Architecture:** Keep `HomeScreen` responsible for page composition and move carousel timing, paging, and indicators into a focused `PromoCarousel` component. Store normalized local banner assets under `mobile/assets/promos/` and load them statically so Expo bundles them offline.

**Tech Stack:** React Native 0.86, Expo SDK 57, TypeScript, `FlatList`, Jest Expo, React Native Testing Library.

---

### Task 1: Normalize supplied brand assets

**Files:**
- Create: `mobile/assets/brand-logo.png`
- Create: `mobile/assets/promos/promo-1.jpg`
- Create: `mobile/assets/promos/promo-2.jpg`
- Create: `mobile/assets/promos/promo-3.jpg`
- Create: `mobile/assets/promos/promo-4.jpg`
- Create: `mobile/assets/promos/promo-5.jpg`

- [x] **Step 1: Inspect the supplied logo and five Telegram banners**

Confirm the source dimensions, white outer margins, rounded artwork bounds, and image ordering.

- [x] **Step 2: Produce clean project assets**

Preserve the artwork and text exactly, trim only empty white outer margins, normalize the five banners to a consistent wide canvas, and copy the supplied logo into the project with excess outer background removed.

- [x] **Step 3: Verify asset dimensions**

Run:

```bash
identify mobile/assets/brand-logo.png mobile/assets/promos/*
```

Expected: every file resolves, all promo images share one consistent aspect ratio, and no banner retains the source white frame.

### Task 2: Build the native promotional carousel

**Files:**
- Create: `mobile/src/features/home/promo-carousel.tsx`
- Create: `mobile/src/features/home/promo-carousel.test.tsx`

- [x] **Step 1: Write the carousel contract test**

Cover an accessible carousel label, all five bundled slides, and five pagination indicators with the first indicator selected initially.

- [x] **Step 2: Run the test and confirm it fails**

Run:

```bash
cd mobile && node ../node_modules/jest/bin/jest.js --runInBand src/features/home/promo-carousel.test.tsx
```

Expected: FAIL because `PromoCarousel` does not exist.

- [x] **Step 3: Implement `PromoCarousel`**

Use a horizontal paging-enabled `FlatList`, `useWindowDimensions`, a four-second interval, drag pause/resume, `scrollToIndex`, `onMomentumScrollEnd`, and accessible tappable dots. Use no animation or carousel dependency.

- [x] **Step 4: Run the carousel test**

Run the same Jest command. Expected: PASS.

### Task 3: Refine the Home header and benefit row

**Files:**
- Modify: `mobile/src/features/home/home.tsx`
- Modify: `mobile/src/features/home/home.test.tsx`

- [x] **Step 1: Update the Home contract test**

Require the supplied iMediaSave logo, rounded branded header, neutral benefit tiles, and promotional carousel while preserving Paste and Preview behavior.

- [x] **Step 2: Implement the approved composition**

Place the logo, title, subtitle, and download form inside one rounded orange header card. Give each benefit a neutral surface with only its icon glyph colored. Replace the static promo surface with `PromoCarousel`.

- [x] **Step 3: Verify Home and mobile types**

Run:

```bash
cd mobile && node ../node_modules/jest/bin/jest.js --runInBand src/features/home/home.test.tsx src/features/home/promo-carousel.test.tsx
cd .. && bun run --cwd mobile typecheck
```

Expected: both test suites and TypeScript pass.
