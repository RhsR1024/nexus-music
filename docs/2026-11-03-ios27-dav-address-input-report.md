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

## Clean packaging and retention

Backup case duration: 200.666 seconds. Installed bundle digest `c1efc65076518e0540a072bfe6b874f37a1c5e62b227b63fc265ab5449c814ac`; fixture SHA-256 `7c31caa26cccfedd122c3e577f75842865ca40b39169d1250f97bd91c1f89f46`. The full selected suite has 2 passed / 0 failed / 0 skipped.

An initial archive at `cccb9e6` observed a newly written companion report and correctly recorded `dirty=true` with that one documentation path. Its manifest and IPA hashes are retained in `build/logs/ios27-dav-input-first-archive-receipt.json`; it is not counted as a clean delivery. After companion documentation commit `49111c5`, a new archive was built from clean HEAD.

Clean product-source commit `49111c5770b9236c128e8ed0497b3edd54a1b17c`: manifest `dirty=false`, `workingTreeChanges=[]`, arm64 / iphoneos26.2 / minimum iOS15.1 / families [1,2], unsigned. IPA 17,845,010 bytes, SHA-256 `3e74a70f6eb97257147308b38ec068cf538bc0efc581c228297d87f24e0fec63`; manifest SHA-256 `e1d780542e21a4b0fa5d3d4ed9bdc5392874fd5860338671b6156d7ad3f970bf`. Independent verifier passed all 178 ZIP entries/CRC, 151 archive-to-IPA byte comparisons, native/JS production markers, and test/private/signing exclusions. Verification receipt SHA-256 `27748085ca3ec110b7b8dae97cc99970a868e85b8c44cb992a78f8bafe8c9d06`; final archive log SHA-256 `61a0cc65a88d250625660f40f61db03d5099e2b499d889b6bc713df83f1d75bb`.

T7 clean stage `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-03-ios27-dav-input-49111c5`: 246 mapped files / 108,989,334 bytes, zero mismatch, SHA256SUMS recheck PASS. Transfer receipt SHA-256 `35eab53c9bf82311f9a048977c5b0fb1b39d0d6a208df8393b74c66d5315a559`; SHA256SUMS SHA-256 `e3a04fa9043128e91c20e92cff6dd0436b6c93d62933a36a60d4e77734065da1`. Exact IPA/archive, test result, three screenshots, source/patch and original logs preserved. Companion initial report is retained in source history; this section supersedes its initial decision to reuse the earlier IPA.

Storage closeout: internal free 74,860,228,608 bytes; T7 free 616,768,339,968 bytes, no active xcodebuild. build 9,888,968 KiB / work 405,808 KiB. No deletion or personal-file migration was needed. Current incremental caches, latest two valid stages, unresolved originals and reverse-skill evidence remain protected. Cleanup receipt SHA-256 `4ed6b2965f0bdb0215fe0a2bd893fb786bad30fefa020eefae1294874bdfbf23`. Final documentation and remote/queue snapshots are retained in a separate hashed T7 supplement.

Next cloud run must validate this change on iOS27; local SDK26.2 simulation and unsigned packaging do not close that requirement. Private services, physical-device, signing and all remaining project functionality remain open.
