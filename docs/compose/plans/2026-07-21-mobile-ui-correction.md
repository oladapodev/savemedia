# Mobile UI Correction Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/mobile-ui-redesign.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repair the collapsed mobile layout and deliver a restrained, responsive interface with reliable media previews across Home, Downloads, History, Media Detail, and Settings.

**Architecture:** Correct the shared layout primitives first so scroll content keeps intrinsic height, then simplify each feature screen around a single visual hierarchy. Route remote thumbnail URLs through the public iMediaSave wrapper, model thumbnail loading explicitly, and use stable JavaScript tabs where consistent labels and insets are required.

**Tech Stack:** Expo SDK 57, React Native 0.86, Expo Router, TypeScript, Jest, Testing Library, TanStack Start wrapper routes.

---

### Task 1: Restore intrinsic scroll layout

**Covers:** S3, S8, S12, S15

**Files:**
- Modify: `mobile/src/ui/layout.tsx`
- Modify: `mobile/src/ui/button.tsx`
- Test: `mobile/src/ui/ui.test.tsx`

- [ ] Add a failing primitive-style test proving scroll content, stacks, surfaces, and buttons do not opt into vertical shrinking by default.
- [ ] Run `bun run --cwd mobile test -- src/ui/ui.test.tsx` and confirm the new assertions fail on `flexShrink: 1`.
- [ ] Remove global shrink from vertical primitives and the scroll content container; retain only explicit horizontal shrink where text safety needs it.
- [ ] Re-run the focused test and mobile typecheck.

### Task 2: Stabilize navigation and safe areas

**Covers:** S3, S4, S8, S12

**Files:**
- Modify: `mobile/app/(tabs)/_layout.tsx`
- Modify: `mobile/src/ui/layout.tsx`
- Test: `mobile/src/downloads/routes.test.tsx`

- [ ] Add a failing route-shell test for four visible one-word tab labels and one bottom-inset owner.
- [ ] Replace alpha native tabs with Expo Router JavaScript tabs configured with visible labels, compact height, platform-safe padding, and lightweight icons.
- [ ] Ensure `Screen` does not double-apply the tab navigator's bottom inset.
- [ ] Re-run route and layout tests.

### Task 3: Recompose Home and promotions

**Covers:** S3, S4, S6, S12, S15

**Files:**
- Modify: `mobile/src/features/home/home.tsx`
- Modify: `mobile/src/features/home/promo-carousel.tsx`
- Modify: `mobile/src/features/home/home.test.tsx`
- Modify: `mobile/src/features/home/promo-carousel.test.tsx`

- [ ] Add failing tests for a compact header, validating/inspecting button states, lightweight benefit row, explicit carousel height, and readable numbered steps.
- [ ] Replace the oversized hero with a compact rounded brand header and one clear download card.
- [ ] Track inspection loading, reject obviously invalid URLs locally, disable duplicate submissions, and surface preview failures next to the form.
- [ ] Give the carousel a measured 2:1 viewport with stable height, image fallback, accessible paging, and no collapsing parent.
- [ ] Re-run Home and carousel tests.

### Task 4: Make preview thumbnails reliable

**Covers:** S6, S7, S10, S11, S15

**Files:**
- Modify: `web/src/routes/api.preview.ts`
- Create: `web/src/routes/api.thumbnail.ts`
- Modify: `web/src/routeTree.gen.ts`
- Modify: `mobile/src/api/client.ts`
- Modify: `mobile/src/downloads/context.tsx`
- Modify: `mobile/src/features/media/detail.tsx`
- Test: `mobile/src/api/client.test.ts`
- Test: `mobile/src/features/media/detail.test.tsx`
- Test: `web/src/lib/siteTrustSeo.test.ts`

- [ ] Add failing tests for tolerant provider media types, wrapper-owned thumbnail URLs, and loading/error fallback states.
- [ ] Normalize oEmbed/OG media types instead of rejecting provider-specific values.
- [ ] Add an allowlisted wrapper thumbnail endpoint that fetches only HTTP(S) image URLs returned by preview providers, validates response MIME, and streams with bounded caching.
- [ ] Return the wrapper thumbnail URL from preview and render loading, success, and failure states in Media Detail.
- [ ] Re-run API and detail tests.

### Task 5: Restore visual media lists

**Covers:** S4, S7, S12, S15

**Files:**
- Modify: `mobile/src/downloads/context.tsx`
- Modify: `mobile/src/features/downloads/downloads.tsx`
- Modify: `mobile/src/features/history/history.tsx`
- Modify: `mobile/src/features/history/item.tsx`
- Modify: `mobile/src/features/history/history.test.tsx`
- Modify: `mobile/src/downloads/routes.test.tsx`

- [ ] Add failing tests that History and Downloads render thumbnails when present and stable placeholders otherwise.
- [ ] Carry thumbnail URLs into active-download models and render compact 64px media rows rather than nested full cards.
- [ ] Render actual history thumbnails with error fallback, concise metadata, and lightweight trailing actions.
- [ ] Keep selection and destructive actions explicit without changing download behavior.
- [ ] Re-run focused feature tests.

### Task 6: Simplify Settings

**Covers:** S3, S4, S12, S15

**Files:**
- Modify: `mobile/src/features/settings/settings.tsx`
- Modify: `mobile/src/features/settings/row.tsx`
- Modify: `mobile/src/ui/choice-bar.tsx`
- Modify: `mobile/app/(tabs)/settings.tsx`
- Modify: `mobile/src/features/settings/settings.test.tsx`

- [ ] Add failing tests for non-overlapping intrinsic rows, compact choice controls, omitted unavailable actions, and grouped section boundaries.
- [ ] Move Theme and Quality into clear standalone preference blocks, keep ordinary settings as compact rows, and remove placeholder `Unavailable` values.
- [ ] Use one section surface with separators, consistent row heights, and no nested full-width card controls.
- [ ] Re-run Settings tests at normal and large font-scale layouts.

### Task 7: Verification and delivery

**Covers:** S13, S15

**Files:**
- Modify: `docs/compose/reports/mobile-ui-redesign.md`

- [ ] Run all mobile Jest suites and TypeScript.
- [ ] Run web tests and TypeScript.
- [ ] Run Expo public config validation and `git diff --check`.
- [ ] Verify Home and Settings at compact phone dimensions in light and dark mode; confirm scroll height, carousel art, tab labels, and preview fallback behavior.
- [ ] Update the report with actual evidence, commit in focused units, and push to PR #7.
