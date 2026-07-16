# IMediaSaveDownload

`IMediaSaveDownload` is the Expo SDK 57 local Android/iOS module used by the existing
`BackgroundDownloads` port. Expo autolinking discovers it from `mobile/modules`.
JavaScript treats the module as optional so Jest and unsupported runtimes can use the
active-runtime Expo FileSystem fallback. Release Android/iOS builds use the native module.

## Download contract

- `enqueue({ id, url, filename, mimeType })` schedules unique work named
  `imediasave-download-{id}` with `ExistingWorkPolicy.KEEP` and a connected-network
  constraint.
- `cancel(id)` cancels that unique work.
- `list()` reconstructs durable WorkManager state, including filename, media type,
  MIME type, progress, final file URI and size, or failure code.
- `onDownloadEvent` invalidates the existing controller, which performs idempotent
  reconciliation and owns MediaLibrary export/history completion.

The worker accepts HTTPS only, validates every redirect as HTTPS, applies connection
and read timeouts, caps output at 512 MiB, requires a non-empty concrete supported
image/video/audio MIME and matching signature, and writes a `.part` file in app cache before
same-directory rename finalization. Cancellation and failures delete partial output.
Progress is persisted in WorkManager `Data` and shown through a data-sync foreground
notification with a WorkManager cancel action.

The public wrapper returns a validated concrete `mimeType` for direct and picker items.
The mobile client passes it unchanged; legacy wrapper responses may infer only from a
supported filename or URL extension. Wildcards and `application/octet-stream` never
reach native enqueue. Audio quality uses concrete MP3 (`audio/mpeg`) by default, with
validated MP3, M4A, Ogg, and WAV signatures supported by the worker and file adapter.

## Android incoming share contract

Release Android does not use the Expo Sharing receiver. The config plugin adds only
`ACTION_SEND` filters for text/image/video and `ACTION_SEND_MULTIPLE` filters for
image/video while Task 8's Expo Sharing extension remains enabled on iOS.

Native intake rejects unsupported actions and MIME types, inaccessible or unknown-size
items, more than 10 items, any item over 512 MiB, aggregate metadata over 1 GiB,
duplicates, size changes during copy, empty streams, and signature mismatches. Metadata
is validated before copying. Each stream is then copied with a hard 512 MiB byte ceiling
to `cache/imediasave-shares/{batchId}`; any batch failure removes all partial copies.
Accepted or rejected batches are durably queued in app-private preferences and exposed
through `listSharedPayloads()` / `consumeSharedPayloads(id)`. The platform adapter feeds
that queue into the existing `/share` route and controller; it never calls cobalt or any
private API.

Native queue files carry `sourceOwnership: native-share-queue`. Import, selection, and
failure paths never delete those source files directly. Only a successful durable
`consumeSharedPayloads(id)` queue update removes them. Concurrent consume calls share one
in-flight operation and persistence failures remain retryable. An Android intent is marked
processed only after its batch is committed; identity-based in-flight protection prevents
duplicates while allowing persistence or coroutine-cancellation retry.

## iOS background and share contract

iOS uses one App Group-backed background URL session per job. Native records are written
atomically in `group.com.imediasave.app`, restored after relaunch, and exposed through the
same list/event contract as Android. HTTPS redirects, concrete MIME types, signatures,
non-empty output, and the 512 MiB item ceiling are enforced before JavaScript exports a
completed app-owned file to Photos and records it in local history.

The production Share Extension accepts one URL/text item or up to 10 compatible images or
videos. It performs bounded copies into the App Group, verifies concrete signatures, writes
one atomic queue record, and completes the extension request without launching the containing
app. The main app consumes that native queue through `listSharedPayloads()` and removes source
files only after durable queue consumption succeeds.

## Native proof status

The TypeScript contract, config plugins, public Expo config, autolinking discovery, and
JavaScript integration tests are verified locally. Per the constrained-machine policy,
Expo prebuild, Gradle, Xcode, emulator, and native builds were not run. CI/EAS must still run:

```sh
bunx expo prebuild --platform android --clean
cd android
./gradlew :imediasave-download:testDebugUnitTest :imediasave-download:lintDebug
```

Structural JVM/Robolectric sources cover scheduler KEEP/cancel wiring, real worker execution
through `TestListenableWorkerBuilder`, progress/cleanup, redirect and size failures, intent
retry gating, and resolver-backed share copy/consume. Swift XCTest sources cover stable
background identifiers, App Group configuration, atomic persistence, idempotent completion,
relaunch restoration policy, and cancellation cleanup. Until CI/EAS executes them,
Kotlin/Swift compilation, merged native projects, notification cancellation, and
physical-device share grants remain pending.
