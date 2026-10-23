# 4851 r8 极坐标材质（实施前）

参考与r5/r7同一3x归一图，中心(570,1016)px。以r270..375px（90..125pt）和角度±2°取亮度均值，避开封面与唱臂；角度从右顺时针。脚本与原始表在`build/measure-4851-polar-20261023/`。参考80/100/110/120/130/150/180°分别9.29/25.34/53.29/46.70/28.22/17.00/10.47；r5约10–11；r7在100..160°约43–46，证实线性带过宽。

本轮使用Core Animation conic渐变加radial遮罩，参考峰值110°，按从上顺时针转换为200°/360≈.556；径向仅唱片环面有效。此为截图驱动的材质近似，不是IPA运行结论。新增Expo原生视图通过现有NexusNative注册，静态layer只在布局更新，原生无时钟、无PCM/每帧React数据；唱片旋转/封面/权威队列保持。底色与r5一致。

五关键区/遮罩/颜色块/门槛沿用r5，先验证新增原生视图方向与渲染，再比较指标。不根据结果扩遮罩、改参考或降低门槛。正式导航、动效/真机仍待；结果未出前不计完成。

r8 Release1/0/0；角向峰值正确但110°环面均值15.45（参考53.29）。r9只将radial locations从误用半对角线的[0,.3394,.4243,.5869,.6718,1]改为圆半径比例[0,.48,.6,.83,.95,1]；角向/颜色/其他几何不变，用实际渲染复核。r8盘面SSIM69.119%、ΔE5.349，未通过。

## r8/r9实测

- r8：/Users/ningli/WorkSpace/NexusMusic/build/SourceUITests-1792740331442.xcresult；exitCode=0、sourceUnchanged=True；manifest SHA `2c1e3d2d6c242f82a3a6629bcc955210265d8f3b2953ebf62a64c50b4c211fd1`，report SHA `847ac944deae6b2617e71697613576a6ea29e3325b055af54ad19a34ee28b4b3`。
- r9：/Users/ningli/WorkSpace/NexusMusic/build/SourceUITests-1792740522695.xcresult；exitCode=0、sourceUnchanged=True；manifest SHA `466daa9c6a0f2f0ae93538ed559947ec7d2c09d80434e43182b14a41e7c1f069`，report SHA `54bd21c1977f22a12e752c9beae6bd0eeaa5cc8282d1ab273e3d700bf97f322e`。

两次Release各1/0/0。r9角向100/110/120/130/140°分别23.21/48.68/42.29/25.59/16.93，参考25.34/53.29/46.70/28.22/17.13，方向/宽度比r7改善。亲看全图：左下局部反光出现，但沟槽细节、唱臂管/卡座/基座差异仍明显。r9盘面SSIM69.767%、ΔE5.326、边缘0.2561；r5为69.425%/5.159/0.2624，属于指标混合、盘面未通过。全屏85.96%/3.65，可比区89.48%/2.63；其余四关键区通过、控件92.99%，覆盖和门槛未变。条件估算90.11%不是实际相似度，也不用于验收。

修复归档.tsx误入类型检查后，check499/499（含类型），日志`build/logs/check-vinyl-r8b-20261023.log`。`npm run test:native`完整通过，日志`build/logs/native-vinyl-r9-20261023.log`；原生视图经Release实际编译/渲染，但通用native测试不验证conic外观。没有新增库或复制参考资产。

当前保留r9供集成核验，未提交产品代码。下一跑testZNavidromePlaybackAndCredentials正常导航/八皮肤/播放回归；再补候选锚点和反光独立重采/径向/沟槽细节。动效仅近似，真机、签名、云端与真实服务独立待验，静态仍2/5，全部parse范围继续。

## 正式导航首验失败与r10修复前

`build/SourceUITests-1792740744529.xcresult` 的testZNavidromePlaybackAndCredentials在377.884秒失败：Swift1632要求停放唱头与后配重完整可见，后配重在暂停时越过画布上沿10pt（jointY56、top-66）。保留断言，不把参考播放态上沿裁切外推为暂停态允许裁切。

r10只为counterweight添加随现有tonearm值插值的局部translateY：暂停+10pt、播放0pt；不改变播放态几何和反光，原native driver/降低动效处理复用。改动前量测：暂停top=-10pt，修后预期top=0pt；唱头不动。需正式导航复验，不以先前r9播放截图验收暂停态。

度量审计：锚点文档声称标签封面被排除，但冻结JSON controlMasks=[]，实际critical deck覆盖排除率0。原门禁保留不动，额外诊断只使用文档既有内容区：r5/r9 SSIM76.456%/76.819%，仍失败。诊断在`build/ui-4851-r{5,9}-diagnostic-masks-20261023/`，不得作为正式验收。下一先同相位重采或规格升版并补封面几何/相位独立验收，再解释材质趋势。

## r10正式导航结果与r11断言校正

r10 `build/SourceUITests-1792741332798.xcresult` 388.306秒失败，已通过原暂停态完整落框断言，但停在旧needle.frame.width>parkedWidth+15；当前tonearm是1×1pt旋转枢轴包装，宽度不能代表实际唱头位移。r11保留20pt实际唱头左移要求，用cartridge.frame.midX作为等待依据，暂停仍要求唱头回原x/y各1pt；不降低位移容差、不改播放行为。

参考IMG_4851的播放态后配重被盘面上沿裁切。原“播放态完整落框”断言与该参考冲突，r11明确改为可见交集非空且至少半个配重高度可见，暂停态完整落框要求保留。此为基于参考的状态契约修订，不能称为原断言通过；旧失败与截图保留。录屏动效仍未验收。

通用歌词预算已独立提交并通过507检查，r11正式App将同时包含该预算及当前未提交UI增量，结果按manifest记录，不回填r9来源。

## r11正式导航通过

`build/SourceUITests-1792741979250.xcresult`，testZNavidromePlaybackAndCredentials **1通过/0失败/0跳过**，Release/iOS26.3.1模拟器；manifest exitCode0、sourceUnchanged=true，SHA `827db096a69f42423d2cb75d3c143fbbf7185bb244a0c4e19d649b36a59700ea`，resultInfo SHA `e0e576b82d13cc7f3536a04532e5258d6f924eacc747836a31c07a6e8b2397c6`。截图导出在`build/vinyl-r11-navigation-20261023/screenshots`，亲看engaged合成三色封面、针臂与操作区可见；不同素材不得用于参考配色评分。

正常入口经过八皮肤、队列、歌词、暂停/播放、唱头实际位移、旋转像素变化、前后台恢复、设置恢复与合成PCM播放，保留上述状态契约修订及负证据。该测试也包含已提交通用歌词预算，但不等于超限歌词真实服务或真机验收。507全量检查与此前native完整通过。固定静态仍2/5，当前增量可交付但不声明4851静态完成；剩余为封面相位复现/规格口径、候选锚点、沟槽/唱臂材质和录屏/设备。

本轮准备提交当前黑胶布局/字体/图标/纸面色与原生静态反光增量及正式组件场景；没有复制样本代码、图片或私人内容。提交后做清洁unsigned设备归档与production entry验证，再正常push；构建和云端结果独立回写。
