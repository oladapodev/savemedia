# Mobile acceptance

The JavaScript suites and generated-config checks are deterministic. Native release
acceptance is completed on installed development builds because iMediaSave uses custom
WorkManager, background URL session, and Share Extension code that Expo Go cannot load.

## Automated checks

Run the lightweight checks locally:

```bash
bun run test:mobile
bun run --cwd mobile typecheck
bun run mobile:doctor
cd mobile && bunx expo config --type public --json
```

GitHub Actions additionally prebuilds Android and runs the generated Gradle unit tests and
lint. EAS produces installable Android and iOS development builds; heavy native builds do
not need to run on the local computer.

## Maestro flows

Install a current Maestro release and an iMediaSave development build. The staging flows
require public test media that you own or have permission to download:

```bash
TEST_MEDIA_URL='https://example.test/authorized-media' \
TEST_SELECTION_URL='https://example.test/authorized-multi-item-media' \
maestro test mobile/maestro
```

`settings-persistence.yml` is local-only and deterministic. The staging flows require a
reachable iMediaSave wrapper API and fixture links supported by that deployment.

## Physical-device release matrix

Record the build URL/ID, device model, OS version, date, result, and evidence for each row.
Do not mark the mobile design spec Implemented until both platform columns pass.

| Scenario | Android | iPhone |
| --- | --- | --- |
| Paste a supported public URL | Pending | Pending |
| Share a supported public URL | Pending | Pending |
| Share a direct image | Pending | Pending |
| Share a direct video | Pending | Pending |
| Choose from multiple shared items | Pending | Pending |
| Detect an existing download | Pending | Pending |
| Pause offline and resume online | Pending | Pending |
| Reconcile after process restart | Pending | Pending |
| Continue an eligible background transfer | Pending | Pending |
| Complete with notifications denied | Pending | Pending |
| Recover from media-library permission denial | Pending | Pending |
| Cancel and remove partial data | Pending | Pending |
| Fail cleanly with insufficient storage | Pending | Pending |
| Remove history only | Pending | Pending |
| Delete device media and history | Pending | Pending |
| Screen reader labels and announcements | Pending | Pending |
| Large text keeps primary actions reachable | Pending | Pending |
| Reduced motion, light mode, and dark mode | Pending | Pending |

Direct-file intake must also verify the configured item/byte bounds, unsupported MIME and
signature rejection, temporary-file cleanup, App Group isolation on iOS, and app-owned
cache isolation on Android.
