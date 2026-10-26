# 2026-10-26 批次7E：重启后暂停媒体时间轴

上一批真实MP3的重启截图出现0:08 / 总时长0:00，重新播放才回到3:53。本批在显示层使用已有曲目时长作为原生尚未加载时的回退；原生回报优先，匹配录音使用匹配曲目元数据，无匹配时长不冒用原曲时长。线性、经典详情和环形进度统一显示已保存位置与合理进度范围。

控制器的duration、cursor、intent、队列与原生load/seek没有改写。仅元数据不会启用定位，仍要求ready/token及正的原生时长；当前曲目切换不复用旧时长，过期拖动预览不覆盖新条目。原生实际时长与定位边界保持权威，未预加载/自动播放，也未增加每帧React PCM处理。

## 验证

- `npm run check` **606/606**，新增5项：冷恢复显示而不prepare/seek、原生时长覆盖及实际定位范围、匹配录音时长/未知、切歌不沿用旧游标、非有限数据/进度边界。
- 正式Release `SourceUITests-1793016207715.xcresult` **1通过/0失败/0跳过、164.240秒**，iOS26.3/A834 iPhone15ProMax430×932pt；使用既有V261020公开完整 `Shape of You - Ed Sheeran.mp3`，3,740,360字节，SHA256 `be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203`，正常文件导入/真实PCM播放后暂停。
- 首次重启经典显示00:08 / 03:53，进度与暂停前一致；正常设置导航切换AM/声波核，显示0:08和−3:45，线性及环形无障碍值均有总时长3:53、定位禁用；无自动播放。显式播放后真实wave-spectrum-bars出现、线性/环形定位启用；再次暂停/重启经典00:13 / 03:53，位置保持。
- SQLite队列仍1条，当前条目与游标一致，cursor13.000079219秒；实际曲目durationMs233743.67346938775。统计仅2次/14171.242211974459毫秒，无冷打开/换皮肤额外计次；两份owned音频SHA均与输入一致。统计/队列快照与文件回执留 `build/restored-timeline-live-20261026-r1/actual-state-receipt.json`。
- 5张正式全屏附件来源通过并逐张亲看：经典两次重启、AM/声波核冷暂停及显式播放后暂停；时间与进度不再归零，无新增遮罩/假素材。暂无歌词、未知艺术家和占位封面是实际输入缺少标签/封面的产品回退，不是注入数据。默认system/rose，现代播放器沿自身深色材质；没有颜色/像素分数或动效一致结论。

测试用例首轮完整通过。首次本机汇总脚本误用了旧系统Python的removesuffix，改用已固定的缓存Python后只读汇总通过；不把这个脚本兼容错误写成产品/XCTest失败。

## 来源

修复依据是本项目上一批真实输入的失败显示证据，不宣称重新采集或推导Sollin时长实现。按项目继续运行原生APK路由及gate `--review`，既有动态case严格verify-hashes：395E/101F/99P/3WI/117事件、0错误/警告，无新增Sollin结论/素材。

目录 `build/restored-timeline-live-20261026-r1/` 保存manifest、完整candidate.patch、input/installed-bundle快照、5附件index和provenance receipt；源码/真实输入采集中不变，核对时当前源码digest及补丁SHA一致。起点 `10525071f51f2f43de5958d85a457b00171530a1` 加本批dirty，新增源文件已intent-to-add进入补丁。后续文档不改变该App源码。

| 项目 | SHA256 |
| --- | --- |
| 源码digest | `cbb1f93d05e65f4db5a5b6b12d1863c7b3696422b1414b16de73263a67a5da81` |
| candidate.patch | `59fd30f5f978b4abe4ee6fb598afabc7b97f8580143fee0283fd0a2c2d945ebd` |
| installed bundle digest | `bc4001fc60b907bd5310ba27f7d9c92263d3958ef184ba90376aa89b8126a163` |
| main.jsbundle | `b81c124f3667f9c4c1221b9c667fc2a5f5347146bf9d55dd6329791782e46e07` |
| manifest | `02702cd8fcec4525e7d38d70abc9dcb38d542792c157d921527b6c5adffa25b5` |
| screenshot index | `028bbf1a520ff947ccf7d156dca0648bddce22ca40d4473014612e88183a8d94` |
| harness | `6b8ab841b609426b8cc0052cffd57875d84c053a922230c52bc6504217bb5ed4` |

## 真实截图回归测量

额外执行visual-lab，使用上一批真实同曲目8秒已加载后暂停的001作基准、本轮005冷暂停作候选；同顶部页面/同输入/同默认主题，原生准备状态有意不同，不是Sollin截图。全屏含状态栏、无遮罩，timeline(50,1920,1190,240)和cover-title(170,350,950,1220)为预声明检查区，结果来源绑定通过；整屏SSIM99.85%、平均ΔE00 0.06，两个区域均SSIM1/ΔE00 0。亲看并排图，封面、标题、进度/时间、播放及工具行位置无意外改变；状态栏19:46/20:06不同。该数字只说明本项目两次实际页面的显示稳定性，不作Sollin相似度或全播放器完成率。

输出 `build/restored-timeline-visual-regression-20261026-r1/` 保留规格/截图SHA、工具哈希、报告、叠加和差分。报告SHA256 `6b8877176b8d4ccdb32b599ad83b6fafdef836fd01e1729ff59d60d71fe8bdaf`；规格SHA256 `108eadc80375fdbb8f53e60d9a181082cf16c449c6d0faf20a1006307c22c7bb`。

## 保留边界

本轮实际App覆盖经典/AM/声波核；其余皮肤虽共享线性组件，未据此声称已逐页新验。不同匹配版本时长覆盖主要由业务测试支撑，不声称跨源真实版本矩阵已验。完全没有元数据/原生时长时仍未知；不编造时长。未验手机/签名、横屏/大字本轮矩阵、连续手势/录屏和完整VoiceOver真机操作。旧0:00负证据保留，标记已由本轮同真实输入修正，不改写历史通过。

推送前复核CI40311163694/9e7d5bc仍运行核心App组、checks已成功；40318327868/4f8abab待排队。它们均不覆盖本批。推送后再核对single队列，不取消运行任务。

自用A834关闭，其他模拟器未动；收尾磁盘检查约12GiB，不在Xcode运行中清缓存，没有删除仍被引用的阶段/失败证据。后续继续按批次7外观、批次8账号及批次6真实provider/系统后台缺口核对，总目标不因本次修复结束。

## 交付与云端

功能 `e7448fcd5750f9f49bae4e650e74856a971b97ef` 已正常提交/push，远端main精确一致，随后工作树干净。推送后[40321395897](https://github.com/RhsR1024/nexus-music/actions/runs/40321395897) 为本批唯一pending，[40311163694](https://github.com/RhsR1024/nexus-music/actions/runs/40311163694) 仍in_progress；旧40318327868/4f8abab按single规则自动cancelled，不把取消算通过。保留运行中任务，未手动重派或取消。当前606本机检查和实际音频Release场景已通过，云端最新功能提交尚无终态。交接补充为文档-only，按规则只检查链接/一致性/diff。

阶段保留/占用回执 `build/restored-timeline-20261026-retention.json`：复核DerivedData约1.1GB、logs约839MB及已引用视觉/失败证据；无xcodebuild运行、无证据充分的可删过期项，未盲删他会话/模拟器数据。
