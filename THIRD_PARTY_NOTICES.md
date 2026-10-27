# Third-party references and adapted components

The project does not apply a single license to all reference projects or assets.

## QQ music web account protocol

`src/providers/qqAccountProfile.ts` adapts the cookie identity and official request contracts from Q-music Android commit `5db858f32695d10c5e9ef0f7037d586aef6a8c4b`, `src/core/musicAccount/{cookies,qqCredentials,requests,accountTransfer}.ts`. The official OAuth client ID and music-site redirect in `musicWebLogin.ts` and `NexusMusicAuthModule.swift` were checked against that commit's `login.ts`; NexusMusic uses the default desktop web presentation and adds an attempt-bound state check. NexusMusic uses its own TypeScript clients, Keychain account store and ephemeral iOS WebKit session; it does not import Android bridges, desktop pairing, dependencies or native patches. The adaptation limits this entry to QQ web identities, validates both response envelopes and discards playlist response content after the authorization check. QQ daily authorization is separate. Apache 2.0 is reproduced at `licenses/lx-apache-2.0.txt`.

Upstream NOTICE: Q-music Android, Copyright 2026 Nshpiter. This product is based on LX Music Mobile, https://github.com/lyswhut/lx-music-mobile. LX Music Mobile is Copyright lyswhut and its contributors and is distributed under the Apache License 2.0. Q-music Android retains the upstream license, attribution, project agreement, and disclaimer. Q-music Android is an independent derivative project. It is not an official LX Music release and is not endorsed or supported by the upstream author.

## QQ request signature

`src/providers/qqSignature.ts` adapts the QQ signature protocol algorithm from LX Music Mobile, reference fork wtfdelphia/lx-music-mobile, commit `6624ab58cbd2f5bda52ab8006912d3c60dc1f847`, file `src/utils/musicSdk/tx/utils/crypto.js`.

Source: https://github.com/wtfdelphia/lx-music-mobile/blob/6624ab58cbd2f5bda52ab8006912d3c60dc1f847/src/utils/musicSdk/tx/utils/crypto.js

The reference repository includes the Apache License 2.0, reproduced at `licenses/lx-apache-2.0.txt`. Its README usage statements remain applicable to that reference; this notice does not replace them. This adaptation uses an injected SHA1 implementation and its own Base64 routine rather than the original native crypto/Buffer dependencies. Other source files are original contract implementations unless noted separately.

## NetEase weapi encryption

`src/providers/neteaseCrypto.ts` adapts the weapi AES-CBC and raw-RSA scheme from Sollin-Music-Desktop at commit `c9d446f6ad3b7ea1aff64bd5ce290b6e7f9712a8`, file `src/services/neteaseCrypto.ts` (SHA-256 `5abc7db3853a0457124ed0cc74de1080f82d723fc42fe4e06ca9558f06d28bad`). The preset key, IV, base62 alphabet and NetEase public modulus were checked file-to-file; the RSA modulus was independently decoded from that reference PEM and compared with the native BigInt constant. The implementation here is a dependency-free TypeScript reimplementation cross-checked against `node:crypto`, not a copy of the reference's crypto-js/node-forge code. The reference repository's MIT license is reproduced at `licenses/sollin-mit.txt`.

## Temporary application icon

`assets/app-icon.png` and its copy in the iOS AppIcon asset catalog are size adaptations of the user-authorized Wayferar-Music icon at commit `8e47cdc701cdbb772577b2bf7abb699e285b0fa6`, `app/src/main/res/drawable-nodpi/ic_launcher.png`. This temporary reuse does not relicense the reference project or its other assets. See `docs/decisions/0022-temporary-app-icon.md`.

## QRC wire decoding

`modules/nexus-native/ios/ScriptUtilities.swift` contains an original Swift bit-permutation implementation of the QRC DES-EDE variant. The wire permutations, S-box values, key layout and fixed protocol key were checked against [wtfdelphia qrcDecode.js](https://github.com/wtfdelphia/lx-music-mobile/blob/6624ab58cbd2f5bda52ab8006912d3c60dc1f847/src/utils/musicSdk/tx/qrcDecode.js) and Q-1515 commit `547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a`, `src/utils/musicSdk/tx/qrc/`. The Apache 2.0 license above is retained for the referenced tables. The implementation does not import either JavaScript decoder, its dependencies, or reference music/lyric assets. The native utility test uses a synthetic text vector independently encoded with the pinned reference algorithm.

## Cupertino Icons font

`assets/fonts/CupertinoIcons.ttf` is the official `cupertino_icons` 2.0.0 package font, used to draw three appearance-segment glyphs (`circle_fill`, `layers_alt_fill`, `photo_fill`). The package declares the MIT license reproduced at `licenses/cupertino-icons-mit.txt`.
