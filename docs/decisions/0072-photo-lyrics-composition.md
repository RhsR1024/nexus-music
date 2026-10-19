# 0072 写真歌词主体与操作区生命周期

2026-10-19。先完成reverse-skill R2/mobile-reverse、固定offline scope、IPA gate及严格review（41E/40F/40P，零错误/警告），再实施。新增E041→F040→P040检查1946原始指令、165BL、172池引用，说明见[写真证据报告](../2026-10-19_reverse-sollin-photo-actions-report.md)。五秒显示期、操作续时、退出取消、隐藏指针门禁和纵向主图遮罩有静态依据；参考完整手势、精确物理布局和运行效果仍未证明。截图4868/4869仅补充构图，不复制私人图像或文字。

## 参考比较与采纳边界

| 固定参考 | 本批亲读 | 实现和维护判断 | Android与许可边界 |
|---|---|---|---|
| 悦音 d6f1af7f911e84babce56cd07297b44cfe46eed9 | LyricsView.tsx154–182 | FlatList/当前行/测量职责可借鉴，音枢复用自身虚拟歌词列表 | RN可迁移思路；根MIT/README限制和资产许可冲突沿原记录，不复制 |
| Q-1515 547ccfe63ea5b8f734e6842c3b4c3b1225bbf39a | Vertical/Pic.tsx15–61 | 图片与窗口尺寸/页面出现分离；旧导航生命周期不引入 | 原RN Android背景不是UIKit遮罩验证；Apache2/逐文件许可沿原记录 |
| wtfdelphia 6624ab58cbd2f5bda52ab8006912d3c60dc1f847 | Vertical/Pic.tsx15–61 | 同源封面持有逻辑，只借职责，不添加旧依赖 | Apache2/文件头分别保留原边界，无补丁移植 |
| CyMusic bf0d4694acb52973bcd594d31b3c61f655e166cb | usePlayerBackground.tsx74–120 | 过期结果丢弃和有界缓存；复用音枢既有cover服务 | Apache2/RNTP独立，不导入图片依赖或原生播放器 |
| 自有Wayferar 8e47cdc701cdbb772577b2bf7abb699e285b0fa6 | StageLyricLayout.java18–82 | 宽度与Unicode保持启发大字阅读；无需迁入Java排版 | 自有代码与第三方边界分开，不能视为iOS验收 |

本批原创：写真独立主体，图片顶部铺满并渐隐至歌词背景，歌曲动作行、可滚动歌词和底部操作区分离。主图作为前景图保持清晰；既有背板继续应用模糊/深浅设置，用户写真优先、失效回封面、纯色偏好保留。静态UIKit layer mask承载既有RN图片，不新增图片加载/解码依赖，不逐帧桥接PCM或列表。TS呈现未来Android可复用，原生遮罩与实际触摸必须另验Android。

操作区初始隐藏，有明确可访问切换按钮；隐藏时不参与触摸和AX。显示后五秒收起，交互重置、拖动期间不收起，曲目/后台/被覆盖/退出清理。小屏、横屏和大字优先保留歌曲控制与歌词阅读；只借参考构图比例，实际布局由本窗口预算决定。播放、收藏、切歌、循环和队列复用唯一controller/原曲收藏；保留歌词来源、LX/Navidrome/WebDAV、诊断/PCM/EQ/样式菜单。实际验证、clean archive与iOS27分别记实；本文件不是验收通过记录。

首轮完整App118.538秒在真实像素渐隐断言失败，录像确认Fabric finalize会清根layer.mask（RCTViewComponentView.mm1065）；ExpoFabricViewObjC.mm119–137先super后OnViewDidUpdateProps。最终在该钩子、layout和trait更新恢复mask，保留RN子视图原有父子/卸载契约。高亮图片的文字对比层继续受playerDarkness控制；前景清晰指无模糊，不指取消深浅偏好。首轮操作窗81.762秒/大字128.040秒通过但未解决视觉问题，不列为最终视觉验收。

最终手机三项3/0/0（78.470/122.324/311.934秒），iPad窗口旋转113.592秒1/0/0，完整原生CLI/395业务类型通过；手机五张及iPad两张必要PNG亲看，独立PNG169/90采样通过。手机结果先于仅iPad夹具关闭等待补修，产品代码未变；所有首次失败/旧操作通过但视觉不合格结果保留。真实服务/签名/真机、不同图片宽高比/坏图与精确参考动态仍待；不将上述局部验收解释为全部31图或全计划完成。

0302b24清洁SDK26.2 unsigned归档/CRC/正式入口/私人签名资源排除通过，IPA SHA256 a5abb0015f7398ba98a1fc34211551af34cef9b5ac8765d75fa95f321e75ab14；正常push和远程main已实核。对应新iOS27运行[39179554648](https://github.com/RhsR1024/nexus-music/actions/runs/39179554648)已in_progress，1运行/0排队；其终态及真实服务/签名/真机仍待。
