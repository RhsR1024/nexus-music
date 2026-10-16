# Third-party references and adapted components

The project does not apply a single license to all reference projects or assets.

## QQ request signature

`src/providers/qqSignature.ts` adapts the QQ signature protocol algorithm from LX Music Mobile, reference fork wtfdelphia/lx-music-mobile, commit `6624ab58cbd2f5bda52ab8006912d3c60dc1f847`, file `src/utils/musicSdk/tx/utils/crypto.js`.

Source: https://github.com/wtfdelphia/lx-music-mobile/blob/6624ab58cbd2f5bda52ab8006912d3c60dc1f847/src/utils/musicSdk/tx/utils/crypto.js

The reference repository includes the Apache License 2.0, reproduced at `licenses/lx-apache-2.0.txt`. Its README usage statements remain applicable to that reference; this notice does not replace them. This adaptation uses an injected SHA1 implementation and its own Base64 routine rather than the original native crypto/Buffer dependencies. Other source files are original contract implementations unless noted separately.

## Temporary application icon

`assets/app-icon.png` and its copy in the iOS AppIcon asset catalog are size adaptations of the user-authorized Wayferar-Music icon at commit `8e47cdc701cdbb772577b2bf7abb699e285b0fa6`, `app/src/main/res/drawable-nodpi/ic_launcher.png`. This temporary reuse does not relicense the reference project or its other assets. See `docs/decisions/0022-temporary-app-icon.md`.

## QRC wire decoding

`modules/nexus-native/ios/ScriptUtilities.swift` contains an original Swift bit-permutation implementation of the QRC DES-EDE variant. The wire permutations, S-box values, key layout and fixed protocol key were checked against [wtfdelphia qrcDecode.js](https://github.com/wtfdelphia/lx-music-mobile/blob/6624ab58cbd2f5bda52ab8006912d3c60dc1f847/src/utils/musicSdk/tx/qrcDecode.js) and Q-1515 commit `547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a`, `src/utils/musicSdk/tx/qrc/`. The Apache 2.0 license above is retained for the referenced tables. The implementation does not import either JavaScript decoder, its dependencies, or reference music/lyric assets. The native utility test uses a synthetic text vector independently encoded with the pinned reference algorithm.
