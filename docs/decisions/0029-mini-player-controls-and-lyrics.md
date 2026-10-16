# 0029 迷你播放器按钮与歌词预览

日期：2026-10-16，F18/F26/F27、J40/J49 既有范围增量，不另建播放器或业务队列。

## 五参考与采纳

固定提交、来源和许可沿 REFERENCE_COMPARISON；以下均亲读，不复制源码、图片或依赖。

| 参考 | 证据 | 采纳 / 维护与 Android 边界 |
| --- | --- | --- |
| 悦音 d6f1af7 | src/components/common/MiniPlayer.tsx:41–104、153–177，按曲目取消歌词与单行预览 | 采用按身份取消和少量文本；不用其独立歌词接口/Slider/BlurView，继续音枢选择层、偏移及原子偏好 |
| Q 547ccfe | src/components/player/PlayerBar/index.tsx:15–39，components/ControlBtn.tsx:12–72 | 固定播放/下一首、横屏上一首；音枢最多四个用户选定按钮且保留播放暂停，不移植旧导航/超时模块 |
| wtf 6624ab | 同路径 PlayerBar/ControlBtn，固定控件及键盘隐藏策略 | 保留单一播放意图，不因解析中把暂停替换为不可操作的加载图；不带入旧 RN 原生补丁 |
| Cy bf0d46 | src/components/FloatingPlayer.tsx:31–118、PlayerControls.tsx:33–57 | 参考业务意图/解析态与独立进度；不复制 RNTP、Reanimated、Haptics、Expo Image 或第二当前曲状态 |
| Wayferar 8e47cdc | app/src/main/res/layout/view_main_mini_player.xml:3–104，固定318dp/标题副标题/进度/52dp播放槽 | 参考可达控制和文字层级；不用 Android 布局、全局窗口或 Activity 重建，iOS 自适应换行和44pt触控区域 |

Sollin c9d446f 的 src/components/MiniPlayer.tsx:20–111 提供共享会话与两行歌词/无词回退的补充参考；Electron 窗口置顶/关闭/DOM/localStorage 不移植。TS 配置、预览取消与当前行算法可共享 Android；iOS 字体、模糊和原生播放适配继续独立。

## 状态和交互

- 按钮从上一首、播放暂停、下一首、本地收藏、队列中选择，最多四个，播放暂停保留；可排序、重启持久化并单独恢复默认。非法/重复配置和失败写入保留原设置，串行操作不覆盖音量/EQ等偏好。
- mini 只调用既有控制器、LibraryStore 和 QueueView；解析时仍可暂停。小屏允许按钮组换行，底栏按实际高度调整内容区，标题和44pt按钮不互相遮挡。
- 歌词预览默认关闭，主动开启后复用 LyricSelection、实际录音身份和既有单曲/全局偏移。只展示当前一行或普通文本回退；换曲、选择变化和关闭时取消，迟到结果不能显示旧歌。完整播放页打开时不另挂 mini 歌词请求，不用逐帧 React 列表或第二歌词选择仓储。
- 收藏保持原曲身份，歌词使用实际录音；配置、预览和队列打开不能隐式播放、换曲或修改播放位置。

## 验证门槛

旧偏好迁移、非法/五个按钮拒绝、串行增删排序/失败原子性与重启；歌词取消/迟到/失败/实际录音版本、偏移及前奏/结束。实际 App 合成实音暂停后配置/四按钮/收藏/队列/歌词/重启回归、本地清洁 IPA 与新云端分别记录；大字/小屏/VoiceOver和手机后台仍实测，不以代码或打包代替。
