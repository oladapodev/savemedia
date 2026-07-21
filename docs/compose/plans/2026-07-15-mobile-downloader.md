# Mobile Downloader Implementation Plan

> [!NOTE]
> This document may not reflect the current implementation.
> See the final report for up-to-date state:
> [Final Report](../reports/mobile-ui-redesign.md)

> **For agentic workers:** REQUIRED SUB-SKILL: Use compose:subagent (recommended) or compose:execute to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the approved component-based iMediaSave downloader for Android and iOS with paste/share intake, balanced downloads, device saving, local history, notifications, and native background execution.

**Architecture:** Expo Router route files remain thin and compose feature screens. A semantic design system owns visual decisions; a platform-neutral job state machine owns behavior; typed ports isolate the public API, SQLite, files, notifications, Android WorkManager, and iOS background URL sessions.

**Tech Stack:** Expo SDK 57, React Native 0.86, React 19.2, TypeScript 6, Expo Router, Expo Sharing, Expo SQLite, Expo FileSystem, Expo MediaLibrary, Expo Notifications, Jest Expo, React Native Testing Library, local Expo modules, WorkManager, Swift URLSession, EAS Build.

---

## File map

```text
mobile/
├── app/
│   ├── _layout.tsx              # providers and root stack
│   ├── +native-intent.ts        # incoming share/deep-link rewrite
│   ├── share.tsx                # hidden incoming-share route
│   └── (tabs)/
│       ├── _layout.tsx          # Home, History, Settings tabs
│       ├── index.tsx            # thin Home route
│       ├── history.tsx          # thin History route
│       └── settings.tsx         # thin Settings route
├── src/
│   ├── ui/                      # theme, tokens, primitives, layouts, icons
│   ├── features/                # composed Home, History, Settings UI
│   ├── api/                     # public wrapper client and DTOs
│   ├── downloads/               # jobs, reducer, quality, controller
│   ├── share/                   # incoming payload normalization
│   ├── history/                 # SQLite migration and repository
│   ├── files/                   # export and temporary-file policy
│   ├── notifications/           # local notification adapter
│   └── platform/                # native background port and adapter
├── modules/imediasave-download/ # local Expo native module
├── plugins/                     # native config plugins
├── jest.config.js
├── jest.setup.ts
└── package.json
```

Route files may import feature screens and navigation configuration only. Feature components may import `src/ui` and feature-facing hooks, but may not call fetch, SQLite, FileSystem, notifications, or native modules directly.

### Task 1: Install the supported Expo toolchain and test harness

**Covers:** [S8, S13, S14]

**Files:**
- Modify: `mobile/package.json`
- Modify: `mobile/app.json`
- Modify: `mobile/tsconfig.json`
- Modify: `package.json`
- Modify: `scripts/check-workspace.ts`
- Create: `mobile/jest.config.js`
- Create: `mobile/jest.setup.ts`
- Create: `mobile/src/test/smoke.test.ts`
- Modify: `bun.lock`

- [ ] **Step 1: Write a failing mobile test command contract**

Add assertions to `scripts/check-workspace.ts` requiring `mobile/package.json` to expose `test: "node ../node_modules/jest/bin/jest.js --runInBand"`, use `main: "expo-router/entry"`, and expose root `test:mobile`. Run:

```bash
bun run check:workspace
```

Expected: FAIL because the current mobile package still uses `expo/AppEntry` and has no test script.

- [ ] **Step 2: Install SDK-matched runtime and test packages**

Run from `mobile/`:

```bash
bunx expo install expo-router expo-dev-client expo-clipboard expo-sharing expo-sqlite expo-file-system expo-media-library expo-notifications expo-network expo-symbols react-native-safe-area-context react-native-screens
bunx expo install jest-expo jest @types/jest @testing-library/react-native --dev
```

Expected: Expo resolves SDK 57-compatible versions and updates `mobile/package.json` plus `bun.lock`.

- [ ] **Step 3: Configure Jest for Bun's hoisted workspace**

Create `mobile/jest.config.js`:

```js
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  transformIgnorePatterns: [
    'node_modules/(?!((.bun/)?(jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|expo-router|@react-navigation/.*|react-navigation|react-native-safe-area-context))',
  ],
};
```

Create `mobile/jest.setup.ts`:

```ts
import { cleanup } from '@testing-library/react-native';

afterEach(cleanup);
```

Set the mobile scripts to:

```json
{
  "test": "node ../node_modules/jest/bin/jest.js --runInBand",
  "test:watch": "node ../node_modules/jest/bin/jest.js --watch",
  "typecheck": "tsc --noEmit"
}
```

Set `main` to `expo-router/entry`, include `"types": ["jest"]` in the mobile TypeScript compiler options, and include `app/**/*.ts`, `app/**/*.tsx`, `src/**/*.ts`, `src/**/*.tsx`, and `expo-env.d.ts`.

The explicit Node invocation is required because Jest Expo 29 mutates Node's module metadata during startup and fails under Bun's runtime before any test is loaded.

- [ ] **Step 4: Configure Expo Router and native plugins**

Add these app plugins while retaining the existing bundle identifiers:

```json
{
  "plugins": [
    "expo-router",
    ["expo-media-library", { "photosPermission": "Allow iMediaSave to show your saved media.", "savePhotosPermission": "Allow iMediaSave to save downloaded media." }],
    ["expo-notifications", { "defaultChannel": "downloads" }]
  ]
}
```

Set the development EAS profile to `"developmentClient": true`. Add root `test:mobile` as `bun run --cwd mobile test` and include it in the deterministic root `test` script. Update the workspace checker to match those exact commands.

- [ ] **Step 5: Prove the harness works**

Create `mobile/src/test/smoke.test.ts`:

```ts
describe('mobile test harness', () => {
  it('runs under jest-expo', () => {
    expect(2 + 2).toBe(4);
  });
});
```

Run:

```bash
bun run test:mobile
bun run check:workspace
bun run mobile:doctor
```

Expected: one Jest test passes, workspace validation succeeds, and Expo Doctor reports all checks passed.

- [ ] **Step 6: Commit the toolchain slice**

```bash
git add mobile/package.json mobile/app.json mobile/eas.json mobile/tsconfig.json mobile/jest.config.js mobile/jest.setup.ts mobile/src/test/smoke.test.ts package.json scripts/check-workspace.ts bun.lock
git commit -m "build(mobile): add app test toolchain"
```

### Task 2: Build the semantic design system and route shell

**Covers:** [S3, S4, S8, S12, S15]

**Files:**
- Delete: `mobile/App.tsx`
- Create: `mobile/src/ui/tokens.ts`
- Create: `mobile/src/ui/theme.tsx`
- Create: `mobile/src/ui/text.tsx`
- Create: `mobile/src/ui/layout.tsx`
- Create: `mobile/src/ui/button.tsx`
- Create: `mobile/src/ui/icon.tsx`
- Create: `mobile/src/ui/index.ts`
- Create: `mobile/src/ui/ui.test.tsx`
- Create: `mobile/app/_layout.tsx`
- Create: `mobile/app/(tabs)/_layout.tsx`

- [ ] **Step 1: Write failing semantic-token and primitive tests**

Create `mobile/src/ui/ui.test.tsx` with these behaviors:

```tsx
import { render, screen } from '@testing-library/react-native';
import { AppThemeProvider, Button, Screen, Text } from '.';
import { darkTheme, lightTheme, space } from './tokens';

test('themes expose the same semantic color keys', () => {
  expect(Object.keys(darkTheme).sort()).toEqual(Object.keys(lightTheme).sort());
  expect(space.md).toBeGreaterThan(space.sm);
});

test('primary button exposes an accessible role and label', () => {
  render(
    <AppThemeProvider mode="light">
      <Button label="Download" onPress={() => undefined} />
    </AppThemeProvider>,
  );
  expect(screen.getByRole('button', { name: 'Download' })).toBeTruthy();
});

test('screen composes semantic text without route-owned styles', () => {
  render(
    <AppThemeProvider mode="light">
      <Screen><Text variant="title">History</Text></Screen>
    </AppThemeProvider>,
  );
  expect(screen.getByText('History')).toBeTruthy();
});
```

Run `bun run --cwd mobile test -- src/ui/ui.test.tsx`.

Expected: FAIL because `src/ui` does not exist.

- [ ] **Step 2: Define semantic tokens with no component-specific colors**

Create tokens with this public shape:

```ts
export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32, xxl: 48 } as const;
export const radius = { control: 14, card: 18, sheet: 24, round: 999 } as const;
export const type = {
  display: { fontSize: 32, lineHeight: 36, fontWeight: '700' as const },
  title: { fontSize: 24, lineHeight: 29, fontWeight: '700' as const },
  body: { fontSize: 16, lineHeight: 24, fontWeight: '400' as const },
  label: { fontSize: 13, lineHeight: 18, fontWeight: '600' as const },
  caption: { fontSize: 12, lineHeight: 17, fontWeight: '400' as const },
} as const;

export const lightTheme = {
  canvas: '#F7F8F6', surface: '#FFFFFF', surfaceMuted: '#ECEFEB',
  text: '#172019', textMuted: '#667068', border: '#DDE2DC',
  accent: '#397B52', accentText: '#FFFFFF', danger: '#B3261E',
  success: '#397B52', warning: '#8A5A00', overlay: 'rgba(23,32,25,0.48)',
} as const;

export const darkTheme: Record<keyof typeof lightTheme, string> = {
  canvas: '#101411', surface: '#171D18', surfaceMuted: '#222A24',
  text: '#F2F5F1', textMuted: '#A8B2AA', border: '#303A32',
  accent: '#74C58D', accentText: '#0E2616', danger: '#FFB4AB',
  success: '#74C58D', warning: '#F2C36B', overlay: 'rgba(0,0,0,0.62)',
};
```

- [ ] **Step 3: Implement theme, typography, layout, button, and icon adapters**

`AppThemeProvider` resolves system/light/dark mode and exposes only semantic colors. `Text` accepts `display | title | body | label | caption`. `Screen` owns `SafeAreaView`, canvas color, horizontal padding, scroll behavior, and a readable max width. `Stack` and `Inline` own gaps. `Button` supports `primary | secondary | danger` and loading/disabled states. `Icon` wraps `expo-symbols` so feature code never carries platform-specific symbol names.

Export only the public components and hooks from `src/ui/index.ts`:

```ts
export { AppThemeProvider, useTheme } from './theme';
export { Text } from './text';
export { Screen, Stack, Inline, Surface, Divider } from './layout';
export { Button, IconButton } from './button';
export { Icon } from './icon';
export { radius, space, type } from './tokens';
```

- [ ] **Step 4: Add thin Router providers and native tabs**

The root layout wraps the Stack with `AppThemeProvider`, `SafeAreaProvider`, and the history database provider. The tab layout declares only Home, History, and Settings with stable labels and cross-platform symbols; the hidden Share route stays outside the tab group. Do not put screen styles or download logic in either layout.

- [ ] **Step 5: Verify the design-system boundary**

Run:

```bash
bun run --cwd mobile test -- src/ui/ui.test.tsx
bun run --cwd mobile typecheck
```

Expected: all UI tests and TypeScript pass.

- [ ] **Step 6: Commit the design-system slice**

```bash
git add mobile/app mobile/src/ui mobile/package.json mobile/tsconfig.json mobile/App.tsx
git commit -m "feat(mobile): add semantic design system"
```

### Task 3: Compose the approved static feature screens

**Covers:** [S1, S2, S3, S4, S12, S15]

**Files:**
- Create: `mobile/src/features/home/home.tsx`
- Create: `mobile/src/features/home/download-card.tsx`
- Create: `mobile/src/features/home/home.test.tsx`
- Create: `mobile/src/features/history/history.tsx`
- Create: `mobile/src/features/history/item.tsx`
- Create: `mobile/src/features/history/history.test.tsx`
- Create: `mobile/src/features/settings/settings.tsx`
- Create: `mobile/src/features/settings/row.tsx`
- Create: `mobile/src/features/settings/settings.test.tsx`
- Create: `mobile/app/(tabs)/index.tsx`
- Create: `mobile/app/(tabs)/history.tsx`
- Create: `mobile/app/(tabs)/settings.tsx`

- [ ] **Step 1: Write failing screen-contract tests**

Tests must assert accessible content rather than snapshots:

```tsx
test('home presents one primary paste action', () => {
  render(<TestApp><HomeScreen model={readyHomeModel} /></TestApp>);
  expect(screen.getByRole('button', { name: 'Paste & download' })).toBeTruthy();
  expect(screen.getByText('popular platforms and compatible public links')).toBeTruthy();
});

test('history explains local storage and exposes selection', () => {
  render(<TestApp><HistoryScreen items={[]} /></TestApp>);
  expect(screen.getByText('Stored only on this device')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Select downloads' })).toBeTruthy();
});

test('settings exposes balanced quality and privacy links', () => {
  render(<TestApp><SettingsScreen settings={defaultSettings} /></TestApp>);
  expect(screen.getByText('Balanced')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Privacy policy' })).toBeTruthy();
});
```

Expected: FAIL because feature screens do not exist.

- [ ] **Step 2: Build feature components only from `src/ui`**

Home composes `PageHeader`, `DownloadCard`, `ProgressCard`, and `StatusNotice`. History composes `HistoryGrid`, `HistoryItem`, `SelectionBar`, and `EmptyHistory`. Settings composes section labels and `SettingRow`. Route files export the relevant feature component and contain no `StyleSheet.create`, raw colors, fetch calls, or persistence calls.

- [ ] **Step 3: Add responsive and accessibility behavior**

Use one-column phone layout, a two-column History grid at compact widths, and a centered max-width pane on tablets. Every icon-only action gets an accessibility label; status uses icon plus text; progress announces percentage without rapid repeated announcements; reduced-motion mode disables decorative transitions.

- [ ] **Step 4: Verify screens and commit**

```bash
bun run --cwd mobile test -- src/features
bun run --cwd mobile typecheck
git add mobile/app mobile/src/features
git commit -m "feat(mobile): compose downloader screens"
```

Expected: all feature tests and TypeScript pass.

### Task 4: Implement the job state machine and quality policy

**Covers:** [S5, S6, S7, S9, S11]

**Files:**
- Create: `mobile/src/downloads/types.ts`
- Create: `mobile/src/downloads/reducer.ts`
- Create: `mobile/src/downloads/quality.ts`
- Create: `mobile/src/downloads/reducer.test.ts`
- Create: `mobile/src/downloads/quality.test.ts`

- [ ] **Step 1: Write failing transition and quality tests**

Cover the exact state graph from the spec:

```ts
test('moves an unambiguous job from preview to preparing', () => {
  const next = reduceJob(inspectingJob, { type: 'PREVIEW_READY', preview: oneVideo });
  expect(next.status).toBe('preparing');
  expect(next.selection?.quality).toBe('balanced');
});

test('requires selection for a multi-item result', () => {
  expect(reduceJob(inspectingJob, { type: 'PREVIEW_READY', preview: carousel }).status)
    .toBe('selection_required');
});

test('never marks a job complete before export succeeds', () => {
  expect(() => reduceJob(downloadingJob, { type: 'COMPLETE' })).toThrow();
});

test('balanced chooses 1080 then 720 before larger or smaller files', () => {
  expect(selectBalanced([quality2160, quality720, quality1080])).toEqual(quality1080);
});
```

Expected: FAIL because the reducer and policy do not exist.

- [ ] **Step 2: Define stable domain types**

Use a discriminated `DownloadJob` union with statuses `queued`, `inspecting`, `selection_required`, `preparing`, `downloading`, `paused_offline`, `exporting`, `complete`, `failed`, and `cancelled`. Define typed failure reasons: `unsupported`, `private`, `not_found`, `offline`, `provider`, `storage`, `permission`, `invalid_file`, and `unknown`.

- [ ] **Step 3: Implement the reducer and Balanced selector**

The reducer is pure and rejects illegal transitions. Balanced chooses a reliable 1080p result first, then 720p, then the nearest lower video result; it never silently selects audio-only or the largest available file. Multi-item picker responses always require selection.

- [ ] **Step 4: Verify and commit**

```bash
bun run --cwd mobile test -- src/downloads
git add mobile/src/downloads
git commit -m "feat(mobile): add download job model"
```

### Task 5: Add typed API, URL, clipboard, and controller boundaries

**Covers:** [S2, S5, S6, S9, S10, S11, S15]

**Files:**
- Create: `mobile/src/api/types.ts`
- Create: `mobile/src/api/client.ts`
- Create: `mobile/src/api/client.test.ts`
- Create: `mobile/src/share/url.ts`
- Create: `mobile/src/share/url.test.ts`
- Create: `mobile/src/downloads/ports.ts`
- Create: `mobile/src/downloads/controller.ts`
- Create: `mobile/src/downloads/controller.test.ts`

- [ ] **Step 1: Write failing URL and API contract tests**

Use an injected `fetch` implementation and assert exact wrapper paths:

```ts
test('preview posts a normalized URL to the public wrapper', async () => {
  const fetcher = jest.fn().mockResolvedValue(jsonResponse({ success: true, platform: 'instagram', url: reelUrl, title: 'Reel', type: 'video' }));
  await createApi({ baseUrl: 'https://app.example', fetcher }).preview(reelUrl);
  expect(fetcher).toHaveBeenCalledWith('https://app.example/api/preview', expect.objectContaining({ method: 'POST' }));
});

test('download maps picker responses without losing item identity', async () => {
  const result = await apiWithResponse({ success: true, platform: 'instagram', multiple: true, items: [{ url: mediaUrl, type: 'video', filename: 'clip-1' }] }).download(reelUrl, '720');
  expect(result.kind).toBe('picker');
});

test('normalization rejects non-http schemes', () => {
  expect(normalizeSharedUrl('file:///private/item')).toBeNull();
});
```

- [ ] **Step 2: Implement DTO validation and safe errors**

`createApi({ baseUrl, fetcher })` strips trailing slashes, posts JSON to `/api/preview` and `/api/download`, validates success/error/picker shapes, converts non-2xx responses into typed failures, and never accepts a private cobalt URL. Keep DTOs aligned with the existing TanStack route responses.

- [ ] **Step 3: Define injected ports and controller**

```ts
export interface DownloadPorts {
  api: MediaApi;
  history: HistoryRepo;
  background: BackgroundDownloads;
  files: MediaFiles;
  notifications: DownloadNotifications;
  now(): number;
  id(): string;
}
```

The controller owns paste/share orchestration, duplicate checks, one automatic provider retry, reducer dispatch, cancellation, and reconciliation. Clipboard access stays in the Home action adapter and passes only the resulting text into the controller.

- [ ] **Step 4: Verify and commit**

```bash
bun run --cwd mobile test -- src/api src/share src/downloads/controller.test.ts
git add mobile/src/api mobile/src/share mobile/src/downloads
git commit -m "feat(mobile): connect public media API"
```

### Task 6: Persist settings and local history in SQLite

**Covers:** [S7, S10, S11, S12, S15]

**Files:**
- Create: `mobile/src/history/schema.ts`
- Create: `mobile/src/history/db.tsx`
- Create: `mobile/src/history/repo.ts`
- Create: `mobile/src/history/repo.test.ts`
- Create: `mobile/src/history/delete.ts`
- Create: `mobile/src/history/delete.test.ts`
- Create: `mobile/src/settings/repo.ts`
- Create: `mobile/src/settings/repo.test.ts`

- [ ] **Step 1: Write failing repository and deletion tests**

Use an in-memory repository contract test plus a migration test. Assert that normalized media identity prevents silent duplicates, history survives repository recreation, default quality is `balanced`, and device deletion happens before record deletion.

```ts
test('preserves history when device deletion fails', async () => {
  const removeRecord = jest.fn();
  const result = await deleteDownload(item, 'device-and-history', {
    deleteAsset: async () => { throw new Error('denied'); },
    removeRecord,
  });
  expect(result.kind).toBe('permission_error');
  expect(removeRecord).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Create versioned SQLite migrations**

Create `jobs`, `history`, and `settings` tables, enable WAL and foreign keys, and store status-specific data as explicit columns plus a versioned JSON metadata field. Migrations run inside an exclusive transaction and record schema version.

- [ ] **Step 3: Implement repository interfaces and provider**

The root Router layout wraps routes in `SQLiteProvider`. Repositories expose typed methods; screens consume hooks backed by repositories and never contain SQL. Settings defaults are Balanced, smart auto-save on, alerts on, cellular allowed, and system color mode.

- [ ] **Step 4: Verify and commit**

```bash
bun run --cwd mobile test -- src/history src/settings
bun run --cwd mobile typecheck
git add mobile/app/_layout.tsx mobile/src/history mobile/src/settings
git commit -m "feat(mobile): persist local download history"
```

### Task 7: Add files, export, notifications, and Home integration

**Covers:** [S1, S5, S6, S7, S10, S11, S12, S15]

**Files:**
- Create: `mobile/src/files/media.ts`
- Create: `mobile/src/files/media.test.ts`
- Create: `mobile/src/notifications/downloads.ts`
- Create: `mobile/src/notifications/downloads.test.ts`
- Create: `mobile/src/downloads/context.tsx`
- Modify: `mobile/src/features/home/home.tsx`
- Modify: `mobile/src/features/history/history.tsx`
- Modify: `mobile/src/features/settings/settings.tsx`

- [ ] **Step 1: Write failing orchestration tests**

Assert that completion is emitted only after MediaLibrary export returns an asset ID, denied media permission retains the temporary file, notification denial does not fail the job, cancellation deletes partial files, and History receives the final asset reference.

- [ ] **Step 2: Implement native adapters behind ports**

Use Expo FileSystem for active-runtime downloads and temporary-file inspection, MediaLibrary for final export, Notifications for download channels and completion alerts, and Network for online/offline changes. Keep all Expo imports in adapter files so controller tests remain native-free.

- [ ] **Step 3: Connect feature screens through `DownloadProvider`**

`DownloadProvider` exposes serializable view models and intent functions: `pasteAndDownload`, `chooseMedia`, `cancel`, `retry`, `deleteHistory`, and `updateSettings`. Feature components render those models but do not inspect repository or API internals.

- [ ] **Step 4: Verify and commit**

```bash
bun run --cwd mobile test
bun run --cwd mobile typecheck
git add mobile/src
git commit -m "feat(mobile): save downloads to device"
```

### Task 8: Receive links and files through Expo Sharing

**Covers:** [S5, S10, S11, S15]

**Files:**
- Modify: `mobile/app.json`
- Create: `mobile/app/+native-intent.ts`
- Create: `mobile/app/share.tsx`
- Create: `mobile/src/share/incoming.ts`
- Create: `mobile/src/share/incoming.test.ts`

- [ ] **Step 1: Write failing incoming-payload tests**

Test one public URL, direct image, direct video, unsupported MIME type, inaccessible file, multiple items, and duplicate media. URLs enter the API flow; direct files enter validation/export without API calls.

- [ ] **Step 2: Configure the Expo Sharing plugin**

Enable iOS and Android. Accept `text/plain`, `image/*`, and `video/*`; set the iOS extension bundle to `com.imediasave.app.ShareExtension` and App Group to `group.com.imediasave.app`. Configure activation rules for one URL/text item or a bounded set of images/videos.

- [ ] **Step 3: Route incoming native intents**

`+native-intent.ts` recognizes only the `expo-sharing` host and rewrites it to `/share`. The Share route reads `useIncomingShare`, validates payloads, calls the controller once, displays the compact Saving state, clears consumed payloads, and redirects to Home or selection-required state.

- [ ] **Step 4: Verify config generation and commit**

```bash
bun run --cwd mobile test -- src/share
bunx expo config --type public --json
bun run mobile:doctor
git add mobile/app.json mobile/app/+native-intent.ts mobile/app/share.tsx mobile/src/share
git commit -m "feat(mobile): receive shared media"
```

Expected: tests pass and generated Expo config contains the router and sharing plugins without exposing secrets.

**Task 8 implementation limitation:** Expo SDK 57 incoming sharing is experimental and performs its own copy before JavaScript receives the payload. Android copies incoming streams into the app cache, while iOS copies media into the configured App Group and uses a generated main-target handoff. Task 8 cannot enforce a byte limit before that SDK copy and must not claim pre-copy protection. Its JavaScript boundary instead validates the copied file's actual size and concrete signature immediately, and cleans SDK staging on every recorded success or rejection only when app-cache/App-Group ownership is known. Direct-file receiving is conditionally accepted for development/physical-device validation only; the bounded native intake work associated with Tasks 9 and 10 replaces this path for release, and Task 10 adds the production iOS extension. Task 8 adds no custom native module.

### Task 9: Implement the Android background download module

**Covers:** [S5, S8, S9, S10, S11, S13, S15]

**Files:**
- Create: `mobile/modules/imediasave-download/expo-module.config.json`
- Create: `mobile/modules/imediasave-download/src/index.ts`
- Create: `mobile/modules/imediasave-download/src/types.ts`
- Create: `mobile/modules/imediasave-download/android/src/main/java/com/imediasave/download/DownloadModule.kt`
- Create: `mobile/modules/imediasave-download/android/src/main/java/com/imediasave/download/DownloadWorker.kt`
- Create: `mobile/modules/imediasave-download/android/src/main/AndroidManifest.xml`
- Create: `mobile/modules/imediasave-download/android/src/test/java/com/imediasave/download/DownloadWorkerTest.kt`
- Create: `mobile/plugins/withDownloadModule.ts`
- Modify: `mobile/app.json`
- Modify: `mobile/src/platform/background.ts`

- [ ] **Step 1: Define and test the native module contract**

The TypeScript contract is fixed before Kotlin work:

```ts
export type NativeJobEvent = {
  id: string;
  status: 'queued' | 'downloading' | 'paused' | 'complete' | 'failed' | 'cancelled';
  bytesWritten?: number;
  totalBytes?: number;
  fileUri?: string;
  errorCode?: string;
};

export interface NativeDownloads {
  enqueue(input: { id: string; url: string; filename: string; mimeType: string }): Promise<void>;
  cancel(id: string): Promise<void>;
  list(): Promise<NativeJobEvent[]>;
  addListener(listener: (event: NativeJobEvent) => void): () => void;
}
```

Controller contract tests must prove reconciliation is idempotent after process restart.

- [ ] **Step 2: Implement WorkManager with foreground progress**

`DownloadWorker` validates HTTPS URLs, writes into an app-owned temporary file, calls `setForeground` before transfer, updates determinate progress, supports cancellation, verifies non-empty content and allowed MIME types, and returns the final URI. Unique work name is `imediasave-download-{id}` with KEEP policy to prevent duplicate execution.

- [ ] **Step 3: Add Android permissions and notification channel through the config plugin**

Add `INTERNET`, `POST_NOTIFICATIONS`, `FOREGROUND_SERVICE`, and `FOREGROUND_SERVICE_DATA_SYNC`; declare the WorkManager service type without exporting it. Do not request broad read-media permissions for files created by iMediaSave.

- [ ] **Step 4: Run native proof in EAS/CI and commit**

```bash
bunx expo prebuild --platform android --clean
cd android && ./gradlew testDebugUnitTest lintDebug
```

Expected: Kotlin unit tests and Android lint pass. Run this in CI or EAS when the local machine cannot support Gradle comfortably.

```bash
git add mobile/modules mobile/plugins mobile/app.json mobile/src/platform
git commit -m "feat(mobile): add Android background downloads"
```

### Task 10: Implement the iOS Share Extension and background session

**Covers:** [S5, S8, S9, S10, S11, S13, S15]

**Files:**
- Create: `mobile/modules/imediasave-download/ios/DownloadModule.swift`
- Create: `mobile/modules/imediasave-download/ios/BackgroundDownloads.swift`
- Create: `mobile/modules/imediasave-download/ios/DownloadModule.podspec`
- Create: `mobile/extensions/share/ShareViewController.swift`
- Create: `mobile/extensions/share/Info.plist`
- Create: `mobile/plugins/withShareExtension.ts`
- Create: `mobile/modules/imediasave-download/ios/DownloadModuleTests.swift`
- Modify: `mobile/app.json`
- Modify: `mobile/src/platform/background.ts`

- [ ] **Step 1: Write shared-container and reconciliation tests**

The Swift tests assert that each background session identifier includes the job ID, `sharedContainerIdentifier` equals `group.com.imediasave.app`, queued records are written atomically, duplicate completion callbacks do not duplicate history, and cancelled jobs remove partial files.

- [ ] **Step 2: Implement background URLSession in the containing app module**

Use a background `URLSessionConfiguration`, the shared App Group container, one stable identifier per job, delegate progress events, persisted native job metadata, cancellation, and relaunch reconciliation. A download is native-complete only when the file exists in the shared container; JavaScript still owns media export and final product completion.

- [ ] **Step 3: Implement the compact Share Extension**

The extension accepts text URLs, images, and videos, validates the activation payload, writes a queued record into the App Group, starts eligible background URL work, displays Saving or a specific rejection, and completes the extension request. It must not use the unsupported technique of launching the containing app merely to process a share.

- [ ] **Step 4: Configure EAS extension credentials and entitlements**

The config plugin creates the target and declares `com.apple.security.application-groups` for both app and extension. Add `extra.eas.build.experimental.ios.appExtensions` with target `ShareExtension`, bundle identifier `com.imediasave.app.ShareExtension`, and the same App Group entitlement.

- [ ] **Step 5: Run EAS iOS proof and commit**

```bash
bunx expo config --type introspect
eas build --platform ios --profile development
```

Expected: EAS provisions the App Group and extension target and produces an installable development build. Run extension, URL, direct-file, background completion, cancellation, and Photos export checks on a physical iPhone.

```bash
git add mobile/extensions mobile/modules mobile/plugins mobile/app.json mobile/src/platform
git commit -m "feat(mobile): add iOS background sharing"
```

### Task 11: Complete legal, accessibility, CI, and acceptance verification

**Covers:** [S2, S3, S11, S12, S13, S14, S15, S16]

**Files:**
- Create: `mobile/app/privacy.tsx`
- Create: `mobile/app/disclaimer.tsx`
- Create: `mobile/src/features/legal/notice.tsx`
- Create: `mobile/maestro/paste-download.yml`
- Create: `mobile/maestro/history-delete.yml`
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `docs/compose/specs/2026-07-15-mobile-downloader-design.md`

- [ ] **Step 1: Write failing legal and accessibility component tests**

Assert Settings links to Privacy and Disclaimer, first download presents the ownership notice once, every icon action has a label, download states include non-color text, and large text does not hide the primary action.

- [ ] **Step 2: Add concise mobile legal screens and first-use notice**

Reuse the approved website policy meaning while adapting copy for local history, clipboard-on-tap, shared URLs, temporary files, notifications, device media access, no account, no tracking, and authorized-use responsibilities. Do not claim universal platform support.

- [ ] **Step 3: Add deterministic CI and cloud device flows**

CI runs workspace validation, mobile Jest, mobile TypeScript, Expo Doctor, Android native tests when native files are generated, and config introspection. Maestro flows cover paste/download, selection-required, cancellation, History deletion choices, and Settings persistence. EAS handles heavy Android/iOS builds.

- [ ] **Step 4: Run the full verification matrix**

```bash
bun run check
bun run mobile:doctor
bunx expo config --type public --json
git diff --check
```

Then verify development builds on one physical Android device and one physical iPhone:

- paste supported URL;
- share supported URL;
- share direct image and video;
- multi-item selection;
- duplicate detection;
- offline pause/resume;
- process restart reconciliation;
- notification denied;
- media permission denied;
- cancellation;
- insufficient storage;
- remove history only;
- delete device and history;
- screen reader, large text, reduced motion, light and dark modes.

Expected: deterministic checks pass and every physical-device case records pass/fail evidence.

- [ ] **Step 5: Mark the spec implemented and commit**

Change the spec status to `Implemented` only after the full acceptance matrix passes.

```bash
git add .github/workflows/ci.yml README.md AGENTS.md mobile docs/compose/specs/2026-07-15-mobile-downloader-design.md
git commit -m "test(mobile): verify downloader release"
```
