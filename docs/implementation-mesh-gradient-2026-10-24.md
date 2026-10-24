# AM 网格渐变背景与批量动作矩阵（2026-10-24）

本批按[决策0081](decisions/0081-am-mesh-gradient-background.md)落地批次0，并把批次1的多选/批量动作扩展到发现侧的歌单、榜单与专辑详情。功能口径沿[0079](decisions/0079-functional-spec-and-ui-quality.md)：功能逐项验收，UI按体验与质量收敛，不使用全局像素门槛。

## 来源与门禁

- 功能依据为[功能清单 §4/§5](SOLLIN_ANDROID_FEATURE_INVENTORY.md)与[状态契约](SOLLIN_ANDROID_STATE_CONTRACTS.md)已采集的可见能力；按[0080](decisions/0080-sollin-capability-capture-scope.md)不追加规格、性能或后台采集。
- 本轮未新增逆向证据：`sollin-reverse-gate.mjs ipa`/`apk` 及 `--review` 均 PASS（0 error / 0 warning），沿用 Q1–Q125 结论。安装与门禁通过不等于功能证据。
- 五参考固定 HEAD 未变（joy d6f1af7、Q 547ccfe、wtf 6624ab5、Cy bf0d469、自有 8e47cdc）。本批原创组合既有组件与 Apple 公共 API，未复制参考源码、依赖、原生补丁或资源。

## 实现

原生层（不逐帧经 React）：

- `MeshField`：3×3 网格点、种子化慢速漂移、1–3 色调色板校验与 HSL 软化、`gridStaysValid` 保证行/列不折叠。
- `MeshTimeline`：漂移时钟，仅在门控打开时累计时间；暂停保留相位，恢复不跳到墙钟；忽略非有限输入。
- `NexusMeshView`：iOS 18+ 用 SwiftUI `MeshGradient`（30fps `TimelineView`）；iOS 15–17 回退双色 `CAGradientLayer`；离窗、后台、减少动态效果时停表；`pending` 身份切换不替换已显示调色板。
- `NexusNativeModule` 注册 `Mesh` 视图，只接收 colors/identity/moving/pending/dark 离散属性。

React 层：

- `meshPalette`：优先 flow 三色，单色主色展开三连，非法输入返回空以关闭该层（取色失败/无封面/偏好关闭时回到主题渐变或纯模糊）。
- `AmbientMeshGradient` 复用 `useMotionGate`；`ArtworkBackdrop` 在非写真皮肤接入，位于封面模糊之上、可读性渐变之下。

批次1（选择与批量动作）：

- `selection.ts`：显式区分已加载集合、选择顺序与计数；收藏按选择顺序，队列插入按列表顺序。
- `BatchSelectionBar` / `Toast`：已选 N / 总数、全选、取消与动作面板。
- 搜索（已有）与发现详情（本批）：长按进入多选，点击切换，批量收藏/加歌单/下一首/下载；收藏与下一首提交后退出选择，加歌单保留面板，与状态契约一致。
- `library.addFavorites`：按选择顺序前插、已收藏不反向取消、批内去重；`queue.enqueueNextMany`：整块保持顺序落在当前曲之后、已有优先块之后。

## 验证

- `npm run check` 520/520（新增 selection 6 项、批量队列 1 项、批量收藏 1 项、meshPalette 1 项）。
- `npm run test:native` exit 0，`mesh-field tests passed`：调色板边界、网格不折叠（240 采样/120s 视界）、确定性与身份重播种、相位门控与非有限输入。
- 真实音源：模拟器容器内 `sources.v1` 为前批导入的 `resources/V261020` 全部 23 份脚本（未重导入、未编入 bundle）。`SourceUITests-1792859692162.xcresult` 为 1 通过/0 失败/0 跳过：公开搜索 “Shape of You” → 公开解析（128K 请求档位）→ AM 皮肤 → `ambient-mesh` 覆盖 430×932 → 暂停后网格保留且为 `ambient-mesh-still`。两张截图亲看：真实封面、真实播放进度、控制区无裁切；背景为封面取色的柔和网格。
- 不推断实际编码码率；音频可能命中既有缓存，不称每次冷下载。

## 未验边界

- iOS 15–17 回退只有代码路径，本机无对应运行时，未做实机/模拟器运行。
- 网格漂移的连续观感未用录屏逐帧验收；暂停停相位由原生单测覆盖，不等于录屏一致。
- 真机、Apple 签名、后台/锁屏播放未验。
- 发现详情批量下载在源不可用平台的行为、批量加歌单的多容器连续写入只有单测与搜索页真实链路支撑，未逐页真机复核。

## 后续

网格主色来自既有 flow 调色板，真实蓝色封面下仍会带入一块暖色；是否降低网格不透明度或只用主色属于重点页面精修项，等下一轮 UI 收敛评估，不在本批改判为缺陷。
