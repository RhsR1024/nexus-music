# 0065 暂停背景用实际像素基线验收

2026-10-18，A04/A10。修正测试对静止场景的错误假设，不改变背景算法、色板、种子、停止语义或播放行为，也不新增参考运行结论。本批不是新的Sollin目标分析，报告flavor=null。

原断言要求深色重启后暂停画面的14个边缘点同时出现红、绿、蓝主色。已有E031/E032对应的是双色基底和四个局部柔光，不能推出这个要求。新验收保留当前合成夹具播放时的三色检查；暂停状态改为保存稳定的实际像素基线，验证深色重启与恢复浅色分别重建同一场景。同时直接解码截图PNG，消除UIImage包装缺少CGImage时的空采样。

## 证据、结论与处理

沿[逆向工作流](../REVERSE_SKILL_WORKFLOW.md)，新路由master-route-20261018-182947为R2/mobile-reverse；既有离线scope/case-guard与33E/32F/32P严格review通过，没有重新case-init或扩大权限。E032的862原始指令、7BL/10池加载与20向量独立重放通过；沿既有E026–E032，不声称取得新参考App运行或新调用关系。当前工作是音枢自有实现和验收规则的核查。

| 证据 | 结论 | 实施路径 |
| --- | --- | --- |
| E031/E032及[0056](0056-seeded-ambient-rotation.md)、[0058](0058-native-ambient-color-composition.md)；原生base索引0/1，四灯索引0/1/2/0，有限支持椭圆 | 第三色可以不覆盖固定边缘点，不能将三色输入等同于任何静止几何都有三种边缘主色 | 用合法种子的独立几何反例校验假设，再针对同一身份/色板/尺寸/主题/time=0验证实际恢复 |
| 本地1792317751597失败PNG71C94B03：14点opaque但只有红/蓝主色；同期测试返回空数组 | 图像内容确实未满足旧断言；空采样不是全部原因。没有证明参考或音枢发生色板丢失 | 保留原失败与PNG，不将其改写为通过；直接读取PNG，并替换未由算法保证的静止主色断言 |
| geometry-57独立数值反例与新增native单测 | 14点都在第三色柔光支持范围外，足以证伪普遍保证；不是失败PNG实际identity的复现 | 反例固定向量留测试，避免以后把所有静止边缘三主色重新当成数学要求 |
| PNG编码/解码六像素往返与坏数据拒绝 | 可以从截图编码数据取得明确CGImage，空数据不能冒充稳定场景 | ImageIO解码后按物理像素和明确sRGB RGBA8采样，解码失败明确失败 |

## 几何反例

合法输入identity=`geometry-57`、430×932、time=0，色序为红/蓝/绿；独立Python计算并由Swift单测核对。整体旋转角1.4213604993442501，第三柔光中心(209.112532,991.360492)、宽高(1101.866219,623.235801)。对左右6点、纵向20%至80%的原14点逆旋转并除1.12，归一椭圆半径为：

```text
1.3074 2.4284 1.2211 2.3695 1.1492 2.3195 1.0945
2.2789 1.0597 2.2482 1.0468 2.2278 1.0566 2.2180
```

全部大于1，该柔光在这些位置alpha为0。底层和其余灯只有红/蓝，中性主题覆盖层不能生成绿主色。这是测试假设的反例，不把它当作实际失败样本identity或全部历史失败的根因。

## 新验收

- 当前合成夹具在音乐库、发现和深色播放态仍用原14点、opaque、2/6通道差及20秒检查三种实际主色。仅作为该夹具的实际观察，不推广为所有种子的保证。
- 先通过实际mini操作暂停并等待原生停止，读取14个opaque像素并再次读取确认稳定，再保存浅色/深色各自基线。不能拿播放末帧当基线：现有stop会归零elapsed，恢复对应time=0。
- 深色暂停后重启，要求14个RGBA数组与深色基线完全相同；再切浅色，要求与先前浅色暂停基线完全相同。继续要求明显明暗差、暂停稳定、原生场景挂载和原全部PCM/异步封面/两场过渡/生命周期/独立开关/凭据清理。
- PNG直接解码，坐标按屏幕scale换算到物理像素，不依赖App AX裁剪或UIImage.cgImage；初始稳定样本要求30通道，空数组不能相等即通过。

不调低颜色门槛，不用挑选种子或强改背景保证旧断言通过。生产代码和原生场景没有变化；此为验收语义修正，不增加功能进度。原有静止态三主色断言已经替换，历史“保留全部断言”的表述不能被误读为本轮未改验收规则。

## 验证与复现

387业务/类型通过；PNG往返/坏数据与几何反例独立native通过。初轮几何单测因局部变量third重名编译失败，修为thirdRect及显式Double循环后，以新输出文件native-ambient-geometry编译并执行通过；没有把首轮旧二进制输出当新测试通过。正式完整App、对应新云端与本地归档结果沿[构建记录](../BUILD_STATUS.md)逐批记录，未通过前不声称修复验收完成。

```bash
source scripts/environment.sh
python3 build/verify-color-composition-evidence.py
node scripts/sollin-reverse-gate.mjs ipa --review
xcrun swiftc -swift-version 5 ios/NexusMusicUITests/BackgroundPixels.swift tests/native/BackgroundPixelTests.swift -framework CoreGraphics -framework ImageIO -o build/tests/native-background-pixels
build/tests/native-background-pixels
xcrun swiftc -swift-version 5 modules/nexus-native/ios/AmbientScene.swift modules/nexus-native/ios/AmbientTransition.swift tests/native/AmbientSceneTests.swift -framework CoreGraphics -o build/tests/native-ambient-geometry
build/tests/native-ambient-geometry
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testGlobalCoverThemeChangesAcrossPages
```

独立失败附件导出现在在finally中删除本次mkdtemp staging，原始xcresult和有界PNG/文本/manifest仍保留。已以1792317751597实际失败结果验证49066680字节保留输出、临时目录清空及原始结果存在；无全局清理或活动构建缓存删除。

## 首轮完整App及清理屏障

1792319723943以480.111秒失败，0通过/1失败/0跳过。深色暂停重启14点完全相同、恢复浅色与原浅色基线相同，以及原播放/PCM/异步/三色均已执行；仅最终删除合成连接后立即断言mini不存在失败。Navidrome移除链需先等待Keychain和数据库持久化，原测试在确认按钮后约0.25秒即查询，未等待成功消息。

保存日志/summary/counts为ui-background-baseline-cleanup-failed-*，原始结果与独立失败附件均保留。失败后只读查询确认fixture-theme账号为0、队列与cursor的currentId均null，重开后无mini的实际截图已亲看；这支持补完成屏障，不宣称取得失败瞬间的全部内部状态。沿既有功能验收等待“连接与凭据已移除”再限时等待mini消失，最后原XCTAssertFalse仍保留；完整复测继续，首轮不改写为通过。

## 最终本地结果

1792320461405最终467.221秒，1通过/0失败/0跳过。深色/浅色两组14个opaqueRGBA恢复均精确匹配，完成消息/mini消失屏障与原断言通过；原PCM/生命周期/独立开关/异步/三色流程保留。独立Pillow对四张实际PNG重读同14点，也确认两组完全相同；深浅截图已亲看。59帧过渡视频有7个中间色帧，红阈值穿越0.528333秒；16合成鉴权/0失败、无新stream，使用既有缓存，不是冷下载/真实服务。原始结果/小型选取PNG收据保留，临时完整导出已删除。清洁归档/push和新iOS27另行记录，原失败不计成功。
