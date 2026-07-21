# Mobile Hero and Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a premium rounded orange Home hero and a consistent, accessible motion system across shared controls, screen sections, carousel navigation, and tab switching.

**Architecture:** Use React Native’s built-in `Animated` API behind focused UI primitives so motion policy stays centralized and native-build compatibility is unchanged. Home owns only composition, while Expo Router owns tab scene transitions and shared controls own press feedback.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, React Native Animated, Jest, Testing Library.

---

### Task 1: Shared motion primitives

**Covers:** [S2, S4, S5]

**Files:**
- Create: `mobile/src/ui/motion.tsx`
- Modify: `mobile/src/ui/tokens.ts`
- Modify: `mobile/src/ui/index.ts`
- Modify: `mobile/src/ui/button.tsx`
- Test: `mobile/src/ui/motion.test.tsx`

- [ ] **Step 1: Write failing tests for motion policy**

Test that reduced motion resolves durations to zero, standard motion uses 120–220ms durations, `MotionPressable` remains an accessible button, and `Reveal` renders its content without hiding it from accessibility.

- [ ] **Step 2: Verify the focused test fails**

Run: `node ../node_modules/jest/bin/jest.js --runInBand src/ui/motion.test.tsx`

Expected: FAIL because `motion.tsx` and its exports do not exist.

- [ ] **Step 3: Implement the shared primitives**

Add `useReducedMotion`, `resolveMotion`, `MotionPressable`, `Reveal`, and `AnimatedTabIcon`. Use `Animated.timing` with `useNativeDriver: true`, 0.98 press scale, 10-point entrance travel, and cleanup-safe preference listeners. Replace raw pressables in `Button` and `IconButton` with `MotionPressable`.

- [ ] **Step 4: Verify shared UI**

Run: `node ../node_modules/jest/bin/jest.js --runInBand src/ui/motion.test.tsx src/ui/ui.test.tsx`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/ui
git commit -m "feat(mobile): add accessible motion primitives"
```

### Task 2: Rounded layered Home hero

**Covers:** [S1, S2, S4, S5]

**Files:**
- Modify: `mobile/src/features/home/home.tsx`
- Modify: `mobile/src/features/home/home.test.tsx`
- Modify: `mobile/src/features/home/promo-carousel.tsx`
- Test: `mobile/src/features/home/promo-carousel.test.tsx`

- [ ] **Step 1: Write failing hero geometry tests**

Assert that the hero uses all four rounded corners, exposes a branded orange region and official logo tile, keeps the form on a white overlapping card, and retains the three icon-only benefit treatments and responsive form direction.

- [ ] **Step 2: Verify the Home tests fail**

Run: `node ../node_modules/jest/bin/jest.js --runInBand src/features/home/home.test.tsx`

Expected: FAIL against the current flat white header.

- [ ] **Step 3: Recompose and animate Home**

Build a rounded orange hero with centered logo/copy and a white overlap card. Wrap the hero, state card, benefits, promotion, guide, and disclaimer in `Reveal` with a maximum 40ms stagger. Keep the promotion ratio at 2:1 and animate only dot width/color and programmatic slide movement.

- [ ] **Step 4: Verify Home and carousel behavior**

Run: `node ../node_modules/jest/bin/jest.js --runInBand src/features/home/home.test.tsx src/features/home/promo-carousel.test.tsx`

Expected: PASS with existing clipboard, URL validation, and carousel accessibility behavior unchanged.

- [ ] **Step 5: Commit**

```bash
git add mobile/src/features/home
git commit -m "feat(mobile): rebuild rounded home hero"
```

### Task 3: Fluid floating tab navigation and final verification

**Covers:** [S2, S3, S4, S5]

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Modify: `mobile/src/ui/tabs.ts`
- Test: `mobile/src/ui/tabs.test.ts`
- Modify: `docs/compose/reports/mobile-ui-redesign.md`

- [ ] **Step 1: Write failing transition policy tests**

Add a pure `getTabMotion(reduceMotion)` policy and assert standard mode returns `shift` with a 220ms timing transition while reduced mode returns `none` and zero duration.

- [ ] **Step 2: Verify the navigation test fails**

Run: `node ../node_modules/jest/bin/jest.js --runInBand src/ui/tabs.test.ts`

Expected: FAIL because the transition policy does not exist.

- [ ] **Step 3: Implement floating navigation**

Use a rounded floating tab bar with light borders, no heavy elevation, stable labels, 44-point targets, `AnimatedTabIcon`, and the tested scene transition policy. Preserve keyboard hiding and automatic safe-area padding.

- [ ] **Step 4: Run complete verification**

Run:

```bash
node ../node_modules/jest/bin/jest.js --runInBand
node ../node_modules/typescript/bin/tsc --noEmit
```

Expected: all mobile suites and TypeScript pass. Then run `git diff --check` from the repository root and record exact evidence in the redesign report.

- [ ] **Step 5: Commit**

```bash
git add 'mobile/app/(tabs)/_layout.tsx' mobile/src/ui/tabs.ts mobile/src/ui/tabs.test.ts docs/compose/reports/mobile-ui-redesign.md
git commit -m "feat(mobile): add fluid tab navigation"
```
