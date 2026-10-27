# 封面迟到响应回归的请求屏障

本批修正自动化回归的时序条件，并接入此前通过 V261020 获得的公开 MP3 原始字节。Release 回归 1/0/0 通过；应用的封面超时、状态机、布局和产品范围未改，不新增 Sollin 采集或 UI 完成状态。

## 证据与改动

| Evidence | Finding | Path |
| --- | --- | --- |
| CI40511643805 的 `ui-catalog.log`：蓝色点击约 475.17 秒、缺失曲目点击约 485.99 秒；原生 `fetchCover` 超时为 10000 毫秒 | 原测试在旧请求开始后再做 AX 查找和滚动，可能在切换前触发合法超时回退。这是日志支持的时序风险，不能单凭日志断言所有失败均由此造成 | 在请求开始前定位两个真实按钮及缺失曲目几何位置，随后使用该位置执行正常点击 |
| 新测试的 held HTTP 屏障与请求年龄断言 | 释放旧蓝色响应前，必须已经收到新曲目请求，且旧请求仍在 10 秒窗口内；不放宽原生超时或颜色断言 | 保留红色保持、迟到蓝色不能覆盖、缺失封面失败后清空，以及原有跨页/三色断言；记录 request/release/close 时间与年龄 |
| `NEXUS_UI_THEME_AUDIO` 与输入快照 | 可对同一受控状态回归使用真实录音，而非生成的静音/WAV 传输 | 仅允许单个封面主题测试、完整 MP3、指定 SHA-256、最多 30 MiB/1800 秒；`afinfo -r` 读取时长，声明 MP3 类型，绑定输入前后摘要 |
| R1 `ui-server-counts.json` 的最后一组 transition 事件及 XCTest 断言 | 新 missing 请求在旧 blue 请求开始后 3487 毫秒到达；旧 blue 在 4709 毫秒释放、4711 毫秒关闭，落在超时前；后续 missing 404 回退及原有断言均通过 | 该测量支持本次屏障路径有效，不据此宣布旧云端失败根因全部确认 |

音频为 `Shape of You - Ed Sheeran.mp3`，3740360 字节，SHA-256 `be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203`；本机 `afinfo -r` 估计时长 233.744 秒。各颜色角色共用这份录音；角色标题与封面是故障注入数据，不冒充真实曲目元数据或真实 Navidrome 服务。

## 复现

从仓库根执行，使用新建的一次性模拟器，避免既有应用缓存与个人数据。需要已有 Xcode/iOS 26.3 运行时和上述相同哈希的公开录音；不提供私人账号或音源凭据。

```bash
source scripts/environment.sh
nexus_cover_sim=$(xcrun simctl create 'Nexus Cover Regression' com.apple.CoreSimulator.SimDeviceType.iPhone-15-Pro-Max com.apple.CoreSimulator.SimRuntime.iOS-26-3)
xcrun simctl boot "$nexus_cover_sim"
xcrun simctl bootstatus "$nexus_cover_sim" -b
nexus_cover_run="build/cover-race-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$nexus_cover_run"
git diff --binary HEAD > "$nexus_cover_run/candidate.patch"
NEXUS_SIMULATOR_ID="$nexus_cover_sim" \
NEXUS_UI_RUN_DIR="$nexus_cover_run" \
NEXUS_UI_THEME_AUDIO='/Users/ningli/WorkSpace/NexusMusic/build/local-sort-live-20261025/Shape of You - Ed Sheeran.mp3' \
NEXUS_UI_THEME_AUDIO_SHA256=be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203 \
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testGlobalCoverThemeChangesAcrossPages
```

结果包及原始日志保留后，关闭并删除本次新建的模拟器；不要操作其他会话的设备。自动生成的合成封面截图不导出、不人工查看，也不用于 UI 质量验收。

## 验证边界

`npm run check` 665/665，`node --check scripts/test-ui.mjs` 与 diff 空白检查通过。Release 1/0/0，测试本体 570.314 秒，结果包总区间 802.384 秒；精确结果为 `build/SourceUITests-1793124405507.xcresult`，运行索引为 `build/cover-race-real-20261028-r1/`。

构建源码前后摘要均为 `903f7d0468915b86da60a0a32b4be12aabc6c680d728bb2517c3ab6af634b6dc`；音频输入前后不变。受控服务收到 18 次实际音频请求。本轮未导出、人工查看任何合成封面截图，自动状态断言不计 UI 验收。事件表也保留探针前已经超时关闭的一组请求，不把它们混入最后的受控切换测量。

新建的 `D9C3649F-A0EF-47AE-82CD-BC798CB64600` 仅供本轮使用，结果保留后已通过 `simctl` 关闭、删除；其他模拟器及真实验收设备未操作。未测量删除前的设备字节数，不宣称回收空间。原始结果、日志、输入录音和未解决云端故障材料保留。

本批只验证受控 HTTP 下的应用状态与真实 MP3 输入，不增加真实在线服务、完整 QQ 授权、真机、签名、动效或视觉对齐通过项。批次 8 的剩余能力和真实授权边界继续按现有计划推进。

## 交付

源码 `1d6239c3eeb367071d5153597537612365326381` 已正常提交并 push，`ls-remote` 核对完整 SHA 一致。[CI40559801315](https://github.com/RhsR1024/nexus-music/actions/runs/40559801315) pending；同工作流/分支的 CI40554716636 继续运行，核对为 1 运行 / 1 等待，未取消运行或重派旧版。云端终态继续独立核对。
