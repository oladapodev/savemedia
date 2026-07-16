# iMediaSave Mobile Downloader Design

**Status:** Approved
**Date:** 2026-07-15
**Product:** iMediaSave mobile app for Android and iOS

## [S1] Product goal

Build a minimal, intent-driven downloader that lets people save media in two ways:

1. Share a public link, photo, or video from another app to iMediaSave.
2. Open iMediaSave and tap Download to use a link from the clipboard.

The app should make the common path nearly automatic, continue eligible downloads in the background, notify the user when work finishes, save media to the device, and maintain private local history. It must work on Android and iOS without requiring an account.

## [S2] Scope and honest support promise

The first release supports public links from popular platforms handled by the iMediaSave wrapper API, plus compatible direct media URLs and photos or videos shared directly from another app.

Product copy must say **“popular platforms and compatible public links.”** It must not promise every website or imply that iMediaSave can bypass private accounts, authentication, deleted content, digital-rights controls, or provider restrictions.

The first release does not include accounts, cloud history, cross-device sync, social features, a desktop app, media editing, or a server-side push-notification system.

## [S3] Experience principles

- One primary action per state.
- Flat, quiet surfaces with strong type hierarchy and restrained color.
- Home is immediately useful; onboarding must not block the first download.
- Ask for clipboard, notification, photo, and storage access only when the user invokes the related feature.
- Use platform-native share sheets, notifications, safe areas, and accessibility behavior.
- Keep progress in a consistent location and make every background action visible and cancellable.
- Use concise, specific language for failures and recovery actions.
- Build screens from reusable components and semantic design tokens so visual changes do not require editing every route.

The layout follows current Apple tab-bar and progress guidance and current Android edge-to-edge, safe-area, and adaptive-navigation guidance.

## [S4] Information architecture

The app uses three persistent top-level tabs:

### Home

Home contains the current intent and one primary action. Its core states are:

- Ready: no clipboard URL has been read.
- Link detected: the user tapped Download and the app found a compatible URL.
- Preparing: the API is resolving available media.
- Choice required: more than one media item or materially different choices are available.
- Downloading: preview, determinate or indeterminate progress, file information, and Cancel.
- Complete: saved location with View and Share actions.
- Failed or paused: reason and recovery action.

Home never reads the clipboard merely because the app opened. The main button says **Paste & download** until a URL has been intentionally read, then changes to **Download**.

### History

History is a local visual library grouped by date. It supports opening an item, sharing it, viewing source information, retrying a failed item, selecting multiple records, and deleting records.

### Settings

Settings contains:

- Default quality: Balanced by default.
- Save location and media-library access.
- Smart auto-save toggle.
- Completion notification toggle.
- Cellular download preference.
- Temporary-file cleanup.
- Privacy, disclaimer, support, and app version.

A hidden incoming-share route handles content delivered by Android or iOS and returns users to the appropriate Home state.

## [S5] Sharing behavior

The system share target accepts:

- Plain-text public URLs.
- Direct image files.
- Direct video files.

Shared URLs use **smart auto-save**:

- Start automatically when one clear media result is available.
- Open a compact selection sheet when a post contains multiple media items or meaningful format choices.
- Use the Balanced quality preference unless the user changes it in Settings.
- Show a short Saving confirmation before the share surface closes.

Directly shared photos and videos bypass the processing API. After JavaScript receives the SDK-staged file, the app immediately checks its actual size and concrete signature/MIME match, imports it into app temporary storage, saves it to device storage, and records it in local history.

Task 8 uses Expo SDK 57's experimental incoming `expo-sharing` flow. On Android, Expo copies an incoming stream into the app cache before JavaScript can validate its size; on iOS, Expo's generated share flow copies media into the App Group before handing control to the main app target. Therefore Task 8 provides no pre-copy size protection and must not be described as doing so. JavaScript actual-size validation runs immediately after handoff and removes Expo staging files after success or rejection only when app-cache/App-Group ownership is known. Release acceptance for direct-file receiving remains conditional on physical-device validation and bounded native intake: Tasks 9 and 10 replace this experimental main-target handoff for production, with Task 10 supplying the production iOS extension. No custom native share module is part of Task 8.

## [S6] Paste and download behavior

When the user taps Paste & download:

1. Read the clipboard in direct response to the tap.
2. Extract and normalize the first compatible URL.
3. Detect a known platform where possible.
4. Request a preview from the public iMediaSave API.
5. Auto-select Balanced quality for one clear result.
6. Ask for a selection only when ambiguity materially affects the result.
7. Start the native download job and expose progress.
8. Save the completed media to Photos or Android MediaStore.
9. Write the final local history record and notify the user.

Balanced quality favors a reliable 720p or 1080p result when available instead of selecting the largest possible file. Exact format selection remains controlled by server capabilities and source availability.

## [S7] History, files, and deletion

History is local-only and stores download metadata, not a second full copy of every completed media file. Each record includes the source URL, normalized media identity, platform, thumbnail reference, filename, MIME type, size, status, timestamps, quality, and device asset reference.

Temporary files live in app-controlled storage and are removed after successful export. Interrupted resumable jobs retain only the data required to continue. Failed or abandoned temporary files are cleaned automatically.

Deleting from History always asks:

- **Remove from history** — preserve the device media.
- **Delete from device and history** — delete the device asset first, verify success, then remove the record.

For duplicates, the app shows **Already saved** with View and Download again actions. Smart auto-save must not create an unannounced duplicate.

## [S8] Technical architecture

The JavaScript application uses Expo, React Native, TypeScript, and Expo Router. It is built as an EAS development or release build because native share extensions and background services are not available in Expo Go.

The mobile code is divided into focused units:

- `app/`: routes, tabs, incoming-share route, and presentation states.
- `src/ui/`: semantic color, typography, spacing, radius, elevation, motion, and layout tokens; theme resolution; reusable primitives; and screen-layout components.
- `src/features/`: composed download, history, and settings components that contain feature presentation without owning navigation or infrastructure.
- `src/api/`: typed client for the public iMediaSave wrapper.
- `src/downloads/`: platform-neutral job model and download state machine.
- `src/share/`: incoming payload validation and normalization.
- `src/history/`: local SQLite repository and deletion coordination.
- `src/files/`: temporary files, media export, and cleanup.
- `src/notifications/`: permission timing and local progress/completion notices.
- `src/platform/`: narrow interfaces to Android and iOS native background implementations.

Routes must compose feature components rather than contain large style blocks or business logic. Components consume semantic values such as `surface`, `textMuted`, `space.md`, and `radius.card`; raw colors and repeated spacing values are not scattered across screens. A shared `Screen`, `Stack`, `Inline`, and `PageHeader` layout set owns safe-area, width, gap, and adaptive behavior. Light and dark themes share the same semantic contract, allowing later brand or layout changes to remain localized.

Android uses a share intent target and a native background worker or foreground download service. The foreground path shows a required progress notification while active and writes completed user media to MediaStore.

iOS uses a Share Extension, an App Group shared container, and background `URLSession`. The extension queues validated work into the shared container; the containing app and background session coordinate completion, media-library export, history, and local notification delivery.

The app calls only the public wrapper served by `web/` through `EXPO_PUBLIC_API_URL`. It never calls the private cobalt service directly.

## [S9] Download state model

Every job has one of these states:

`queued -> inspecting -> selection_required -> preparing -> downloading -> exporting -> complete`

Valid alternate states are:

- `queued`, `preparing`, or `downloading` to `paused_offline`.
- Any active state to `cancelled`.
- Any active state to `failed` with a typed reason and retryability flag.
- `paused_offline` back to the previous resumable state.
- `failed` back to `queued` when the user retries.

The state machine is the single source of truth for Home, History, notifications, and native job reconciliation.

## [S10] End-to-end data flow

For a public URL:

1. Paste or share intake produces a normalized URL.
2. The app creates a queued local job with a stable client identifier.
3. `POST /api/preview` returns available media and metadata.
4. Smart auto-save selects Balanced output or requests a user choice.
5. `POST /api/download` prepares the public download response.
6. The platform background layer downloads to temporary app or App Group storage.
7. The file layer validates the response and exports it to the device media library.
8. History records the final asset reference.
9. A local completion notification links to the History detail state.

For a directly shared file, intake begins at validation and device export; preview and download API calls are skipped.

## [S11] Errors and recovery

- Unsupported URL: explain that the source is not supported and preserve the URL for copying or retrying.
- Private, deleted, login-only, or protected media: state that access controls cannot be bypassed.
- Offline: queue or pause and resume when connectivity returns.
- Provider or API failure: retry once automatically, then show the typed failure and Retry.
- Interrupted transfer: resume when the platform and server support ranges; otherwise restart cleanly.
- Insufficient storage: stop before export and show required space when known.
- Photos or storage permission denied: keep the completed temporary file for a limited period and offer Save to Files or permission settings.
- Notifications denied: preserve all in-app status and completion behavior.
- Cancellation: stop native work, reconcile the job as cancelled, and remove partial files.
- Invalid direct file: immediately reject an unsupported signature/MIME match, inaccessible staged file, or unsafe actual size before app-owned import/export; SDK 57 may already have copied the source into Expo staging as described in [S5].

No failure may silently discard a completed file or claim that media was saved before device export succeeds.

## [S12] Privacy, trust, and accessibility

- No account is required.
- History and preferences stay on the device.
- Clipboard content is accessed only after the user taps the paste action.
- The server receives only URLs explicitly pasted or shared for processing and the data required to fulfill that request.
- The first-use notice says users should save only content they own or have permission to download.
- Privacy and disclaimer pages are reachable from Settings.
- All controls have screen-reader labels, logical focus order, minimum platform touch targets, and non-color status cues.
- Layout supports large text, reduced motion, light/dark appearance, device cutouts, safe areas, and Android edge-to-edge rendering.

## [S13] Verification strategy

- Unit tests cover URL normalization, known-platform detection, Balanced selection, duplicate identity, job transitions, retry policy, and deletion choices.
- API contract tests cover preview and download requests against the public wrapper schema.
- Component tests cover all Home states, History selection, Settings, permission timing, and failure recovery.
- Android integration tests cover `ACTION_SEND`, direct files, background execution, cancellation, notification behavior, and MediaStore export.
- iOS integration tests cover the Share Extension, App Group queue, background transfer, cancellation, notifications, and Photos export.
- End-to-end tests cover paste and share flows for representative supported platforms, direct files, ambiguity, duplicates, offline recovery, denied permissions, low storage, and process restart.
- Accessibility verification covers screen readers, large text, contrast, reduced motion, and touch targets.
- GitHub Actions runs deterministic checks; EAS produces Android and iOS builds for physical-device testing so a heavy local emulator is unnecessary.

## [S14] Delivery sequence

1. Add the semantic design system, reusable layout primitives, and Expo Router shell; then replace the setup screen with the approved component-based Home, History, and Settings screens.
2. Add the job state machine, local SQLite history, settings persistence, and deterministic tests.
3. Add clipboard-driven preview and download API integration.
4. Add temporary-file handling, device media export, notifications, cancellation, and recovery.
5. Add Android share intents and native background download execution.
6. Add the iOS Share Extension, App Group, and background session.
7. Run cross-platform physical-device validation and prepare store-facing privacy and permission copy.

Each sequence item must leave a testable application. Android and iOS native work may proceed independently after the shared JavaScript download contracts are stable.

## [S15] Acceptance criteria

- A user can paste a compatible public URL and save the resulting media with one intentional tap when no choice is required.
- A user can share a compatible URL, photo, or video to iMediaSave from another app.
- Unambiguous shared URLs start using Smart auto-save and Balanced quality.
- Eligible jobs continue through platform background execution and expose visible progress or queued state.
- The app reports completion only after the file is available in the intended device location.
- History survives app restarts without an account and supports the approved two-choice deletion flow.
- Duplicate, offline, permission-denied, cancellation, low-storage, private-content, and unsupported-source states have explicit outcomes.
- The app calls the public iMediaSave wrapper and never exposes private cobalt credentials or endpoints.
- Android and iOS release builds pass their native sharing, background, storage, notification, accessibility, and privacy checks.
- Route files contain navigation composition only; design tokens, primitives, layouts, and feature components can be changed independently and are covered by component tests.

## [S16] Primary platform references

- [Expo Sharing](https://docs.expo.dev/versions/latest/sdk/sharing/)
- [Apple Human Interface Guidelines: Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars)
- [Apple Human Interface Guidelines: Progress indicators](https://developer.apple.com/design/human-interface-guidelines/progress-indicators)
- [Apple background URL sessions for app extensions](https://developer.apple.com/documentation/Foundation/URLSessionConfiguration/sharedContainerIdentifier)
- [Android: Receive data from other apps](https://developer.android.com/training/sharing/receive)
- [Android: Background services](https://developer.android.com/develop/background-work/services)
- [Android: Shared media storage](https://developer.android.com/training/data-storage/shared/media)
- [Android: App anatomy](https://developer.android.com/design/ui/mobile/guides/layout-and-content/app-anatomy)
