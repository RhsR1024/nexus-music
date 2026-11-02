# 合成授权网易云私人FM纵向场景（2026-11-03）

## 场景

正式库页“平台推荐 → 私人FM”在合成网易云账号和 Keychain 会话下，通过正式 `AccountFmClient`/`AccountFmStation` 和唯一权威播放队列运行。内容、接口与音频均为合成，账号只用于确定性端到端验证。

## 状态与锚点

1. 首次播放：FM 1 标题、128k 实际请求、进度从 `00:00` 前进，并显示原生“实时音频频谱”。
2. 低水位：当前 FM 3、暂停按钮、队列 `3/6`；挂起请求不改变播放意图或在途数量。
3. 去重追加：队列为唯一的 FM 1–6，当前 `3/6`；重复的 FM 3、FM 5 不再增加条目。
4. 终止隔离：FM 5 后终止再重启，队列仍 `5/6`，第 7 首不存在。
5. 空批次：正式空态可见，切回播放页仍显示 FM 5。
6. 失败重试：正式错误态可见，播放页仍显示 FM 5；随后账号和测试音源可清理。

## 证据

- `build/SourceUITests-1793646248544.xcresult`
- `build/logs/account-fm-station-20261103-r8/run-manifest.json`
- `build/logs/account-fm-station-20261103-r8/screenshots/index.json`
- 6 张 1290×2796 PNG，provenance `ready=true`，逐张人工检查。

本场景不新增Sollin像素对齐、动效等价或项目完成声明；它验证已有平台推荐/FM UI 在合成授权下的正式纵向行为。
