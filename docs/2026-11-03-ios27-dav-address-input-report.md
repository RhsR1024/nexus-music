# iOS27 WebDAV fixture address input repair

2026-11-03. Latest run `41602015021` / `eaa891a` failed. Core group: 23 passed, 2 failed, 0 skipped. Both failures occurred before connection validation: XCTest typed `htp://127.0.0.1:18439/sync-dav/` and `htp://127.0.0.1:18439/backup-dav/`, while the exact expected values begin with `http://`. The log proves incorrect injected text; it does not identify an application WebDAV networking defect or justify changing URL validation.

The prior icon selection/restoration and applied-palette restart cases passed in this same cloud run. This closes those two old assertions for the actual included code, without closing physical-device, complete iOS27, signing, or other feature acceptance.

## Evidence

Compact artifact `13223733297`: 571,855 bytes; SHA-256 `25d825b8ce68d6a55adebb9d278fe45c9172db93d30ff6def0dd5436da8e52da`. ZIP CRC passed. Directly preserved on mounted/writable T7 at `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-03-ios27-41602015021-diagnostics/`. `compact/ui-summary.json` identifies both test failures; `compact/ui-catalog.log` lines 59713 and 59844 record the observed malformed values. Local hash/index receipt: `build/logs/ios27-41602015021-diagnostic-receipt.json`.

The 604,281,930-byte full diagnostics artifact has not been downloaded or inspected. No claim is made about its screenshots. Unresolved originals and exact compact ZIP remain retained.

## Repair

Only the two initial address entry operations in `SourceSettingsTests.swift` now use existing `replaceText`. It uses native selection interaction, types the entire value, dismisses the keyboard, and compares the actual field value. On mismatch it performs one bounded clear/retype, then asserts exact equality. It already serves the cloud directory and discovery link cases. This change preserves UI input, production URL validation, all authentication and sync/backup assertions; it does not inject application state or add unbounded retries. Whole-value input avoids the former per-character animation-idle waits.

No new Sollin collection, reverse conclusion, third-party code, application behavior, fixture endpoint, credential, or licensing change is introduced. This is an original test-harness repair, not a feature-completion increment.

Targeted Release tests, clean archive, T7 delivery and next cloud queue are recorded below after actual completion. Local simulator success will not be called iOS27 acceptance.

## Local targeted verification

`npm run check`: 997 passed / 0 failed. Release `SourceUITests-1793716226294.xcresult`: 2 passed / 0 failed / 0 skipped; `sourceUnchanged=true`, exit 0. Sync case: 241.759 seconds. Both sync conflict/restart/deletion and backup upload/readback/preview/restore/error/restart/removal assertions passed. Source digest `1e45f05ce7c1020034b9c2285e6b4ab316f7d88c915605c4220b5b3dc506dd01`. Run manifest SHA-256 `d893b5e4d2990426385f0d7ef1f4a0998311d256a1f1d0202b184ff2a2ffb6a1`; summary SHA-256 `af899b1cbab200c601c077c1ea38d28fd969325e8624ce9decb49b00d395caeb`.

Three 1290x2796 screenshots exported from this exact result to `build/ui-evidence/ios27-dav-input-20261103-r1`; all three manually inspected: conflict selection disabled before resolution, verified backup preview, and invalid-backup rejection preserving local data. Screenshot index SHA-256 `21bd7b71ee81404cbc18033e20ebc25d832f0ec634eec4fffa2bb1fe32bb8f78`. These are synthetic local service results, not a real private WebDAV service or iOS27 result.
