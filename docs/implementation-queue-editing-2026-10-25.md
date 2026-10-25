# 队列编辑与解析健壮性（批次3，2026-10-25）

本批按 IMPLEMENTATION_PLAN 批次顺序落地批次3的队列编辑与播放链路健壮性：[功能清单 §5 播放器与队列](SOLLIN_ANDROID_FEATURE_INVENTORY.md)的队列编辑行、队列锁定边界、解析失败跳进（E-1272 参考行为）与音质降级用户可见提示。歌词与全屏播放器主体（倍速/偏移/睡眠定时含"播完当前再停"/多皮肤）已在此前阶段交付，本批未重复改动。功能口径沿[0079](decisions/0079-functional-spec-and-ui-quality.md)。

## 来源与门禁

- 功能依据为已采集的可见能力（E-772–E-786、E-862/E-864、E-918–E-968、E-1272、E-1225）；按[0080](decisions/0080-sollin-capability-capture-scope.md)不追加采集。
- `master-route` 路由 APK（R1 apk-reverse）；`sollin-reverse-gate.mjs ipa`/`apk` 及 `--review` 均 PASS（本会话实跑）；未新增逆向证据。
- 均为音枢既有组件与域逻辑的原创扩展，未复制参考源码。

## 实现

- `src/domain/queue.ts`：新增 `removeAfter`——"清除当前之后"保留截至当前的序列并清理越界优先块；当前为末位或未知 id 为无操作。
- `src/playback/controller.ts`：状态新增 `queueLocked`；`setQueueLocked` 切换；`play()` 内部以 entries 引用变化判定"外部重建"——仅重建重置锁定，自然前进（`advance` 保持同一 entries 引用）与队列内选曲保持锁定（E-862/E-918 边界）。新增 `setResolveFailureHandler`：解析失败且播放意图存在时交由会话决策跳进。
- `src/playback/nativeSession.ts`：解析失败自动跳进沿既有 repeat/shuffle 前进路径（优先块优先于 shuffle），连续失败上限15次后停止并显示错误；任一曲目成功进入 ready 即重置计数。单曲队列/到队尾无后续则直接显示错误（E-115 语义）。
- `src/ui/QueueView.tsx`：头部显示 当前序号/总数（`· n/total`）；新增 定位当前（FlatList scrollToIndex + 失败回退 offset）、锁定开关（switch；锁定时隐藏逐行 移除/上移/下移/拖动 控件并提示，行点击播放保留）、清除当前之后（按钮含待清除计数，末位禁用）；逐行新增可见 上移/下移 按钮（端点禁用），拖动与无障碍增减保留；清空确认、分享、顺序/随机/单曲不变。
- `src/ui/Player.tsx`：解析实际档位低于偏好时，三处档位文案追加"已降级为 X"提示（多源回退可见性，E-1225 的降级横幅语义以轻量文案实现）。

## 验证

- `npm run check` 533/533（新增 removeAfter 1项；控制器跳进3项：前进跳过/单曲报错/上限熔断；锁定语义1项：前进与队内选曲保持、重建重置）。
- 真实音源UI验收：`testLiveQueueEditing` `SourceUITests-1792887949518.xcresult` 1通过/0失败/0跳过——用 `resources/V261020` 真实源+真实公开搜索建队后，在经典播放页打开队列面板验证 序号/总数（`· 1/30`）、锁定隐藏逐行编辑（移除/拖动消失+提示出现+关闭锁图标）、解锁恢复、清除当前之后（按钮归零 `（0 首）`、头部 `· 1/1`）；先暂停以中止在途解析，避免自动跳进扰动断言。3张截图导出 `build/ui-screenshots-queue-editing-20261025` 并亲看。
- 既有取色主题专项随批次2搜索页收敛同步修正（非播放器全屏发现入口已不存在，保留队列模态所有权与根层运动断言）。

## 未验边界

- 锁定开关的可访问性开关态、定位按钮滚动效果未做专项录屏；跳进的连续观感未录屏逐帧。
- iOS 27 真机/签名/后台未验；CI 云端对 1401657 的既有失败已本地复现为批次2耦合测试问题并修复，云端复验待 push 后确认。
- 降级提示仅文案级，无横幅动效。
