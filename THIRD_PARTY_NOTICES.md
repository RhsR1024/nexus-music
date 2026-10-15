# Third-party references and adapted components

The project does not apply a single license to all reference projects or assets.

## QQ request signature

`src/providers/qqSignature.ts` adapts the QQ signature protocol algorithm from LX Music Mobile, reference fork wtfdelphia/lx-music-mobile, commit `6624ab58cbd2f5bda52ab8006912d3c60dc1f847`, file `src/utils/musicSdk/tx/utils/crypto.js`.

Source: https://github.com/wtfdelphia/lx-music-mobile/blob/6624ab58cbd2f5bda52ab8006912d3c60dc1f847/src/utils/musicSdk/tx/utils/crypto.js

The reference repository includes the Apache License 2.0, reproduced at `licenses/lx-apache-2.0.txt`. Its README usage statements remain applicable to that reference; this notice does not replace them. This adaptation uses an injected SHA1 implementation and its own Base64 routine rather than the original native crypto/Buffer dependencies. Other source files are original contract implementations unless noted separately.
