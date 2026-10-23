# 4851 r12固定相位采集（实施前）

参考标签中心(570,1016)px、照片内半径203px；原924封面中心(462,462)px。用r45..180px、步15px，角步3°计算RGB最近邻均方误差，扫描旋转0..359°，最小159°（MSE1549.94），邻158°1569.53/160°1735.56。为粗相位估计±1°，不声称图像完全同内容；原始脚本/表留`build/vinyl-phase-measure-20261023/`。

本轮只固定孤立测试entry的recordPhase=159/360，正式Vinyl组件从可选VisualSamplingContext取得固定相位。正常App不提供context，仍保持原native旋转/暂停/前后台/降动效行为；不复制图片、不替换截图、不建截图专页。不改变播放器布局/颜色/门槛/遮罩，完整页面照常评分。实际播放与进度仍走真实合成控制器，故两次采集还需量化进度和其他噪声，不能预先宣称零差异。

计划两次独立Release采集，均用固定scene和正式组件。来源/构建/fixture/截图/工具哈希记录后按原r5量表重算，原r5/r9报告保留。若需最终改版遮罩须另行冻结并重评，不在本轮扩大。

## r12结果与r13实施前

r12a/b各Release1/0/0、sourceUnchanged=true，状态栏下3374640像素零差异（deck/progress/other均0），对比数据在`build/vinyl-phase-measure-20261023/repeatability.json`。两份原门禁盘面SSIM71.4806%、边缘0.3263仍失败；全屏86.55%、ΔE3.06，其余四区通过，控件92.99%。来源见各自run-manifest和report-01，未扩大遮罩。

代码几何审计：标签外框139.33pt带2pt边框，内部Cover仍139.33pt。正常Yoga边框布局使child从(2,2)起，图片中心相对外框中心偏(+2,+2)pt，且内可用空间仅135.33pt，右/下被裁切。此为代码推导、待像素验证，不冒充已恢复参考机制。r13仅将Cover设为label-4*s并使用对应圆半径，令内照片中心回到外框中心；标签外径、边框、相位159°与其余布局/材质保持。参考照片内半径203px=67.67pt，修后对应135.33pt直径。需新正式组件采集验证。

## r13结果

Release1/0/0、sourceUnchanged=true；盘面SSIM72.2216%，色差/边缘均过初始门槛，仅SSIM仍失败。全屏SSIM86.81%/ΔE2.96；原包含区控件92.99%，其余四关键区通过，覆盖/遮罩/门槛没有改变。亲看r13，封面在边框内居中，外标签与唱片不变；照片细节/色环仍不完全一致，不把粗159°称像素完全同态。保留修复，剩余前三项：沟槽纹理/反光径向、唱臂与底座材质及形状、候选全部锚点实测。正常导航与动效/真机独立待新批验收；不外推r11到本次来源。

固定相位消除了当前场景重复采集噪声，两个r12在状态栏下完全一致；这只验证该场景，不代表其他页面/所有时钟稳定。类型与业务507/507（r12源，日志`build/logs/check-vinyl-r12-20261023.log`），r13为单参数Cover内框修复并由Release正式组件验证。当前采样+内框修改尚未提交/归档，非阶段出口，不为微调重复归档。

- r12a：`/Users/ningli/WorkSpace/NexusMusic/build/SourceUITests-1792743350840.xcresult`，exitCode=0、sourceUnchanged=True；manifest SHA `cdab47170c6c02b7278ac1691a544f27858790d01360e5a4422d632807416fc1`，report SHA `9950a28723f7f189f1749191f99a39105b0e43c7b8be19a200e03c8774503587`。
- r12b：`/Users/ningli/WorkSpace/NexusMusic/build/SourceUITests-1792743533103.xcresult`，exitCode=0、sourceUnchanged=True；manifest SHA `a1b96ffc9152bfde546a4c10576246b78463d68836d7064230e3aa6c2200767d`，report SHA `816fad8cb42c3490e5df268ac383c5e73c4e7b759be67f2be631e782caaf4ed3`。
- r13：`/Users/ningli/WorkSpace/NexusMusic/build/SourceUITests-1792743828259.xcresult`，exitCode=0、sourceUnchanged=True；manifest SHA `09ab1e23daf336d8fa88057c41a72be2a3a65b16e3aad92c0518bf74bc257b23`，report SHA `0292714e25a1aa86be1cc7836c8fb4d5efb8b3795df848fe6fd0cf7e70152be2`。

## r14联合尺度量测与实施前

r13使用的照片半径203px是按2pt边框假定，未由参考照片边界独立确认。对参考照片内部r40..160px环、角步6°联合扫描源924图的有效半径180..215px及相位156..162°，最优半径192px/相位160°（RGB MSE146.67），邻193px175.41/194px197.07/191px216.46；相比旧203px/159°采样误差约1550，表明实际照片更小、色环更宽。结果与脚本在`build/vinyl-label-scale-20261023/`，这是图像映射估计，不冒充IPA机制。

r14本组修改：外标签直径139.33pt保持，内照片直径128pt（192px半径），边框由2pt改为(139.33-128)/2=5.665pt；测试固定相位159→160°。两参数为同一照片映射问题组联合校准，不能把收益拆分为独立参数贡献。色环色值、唱片/唱臂/沟槽与全部遮罩/门槛不变，新Release采集后评估。

## r14结果与保留理由

Release1/0/0、sourceUnchanged=True，精确xcresult `/Users/ningli/WorkSpace/NexusMusic/build/SourceUITests-1792744264627.xcresult`；manifest SHA `3ddf447f17469d3f446016568b380cbdbb2e2946faa2f6c3875e51b939b85e97`，report SHA `6d1772a3b3678429a4f58fe13248f7cf0aeeddd2b623df1db7c715c7da6f69d2`。盘面SSIM77.2963%（r13 72.2216%），全屏88.56%/ΔE2.72；照片内容SSIM72.65%（r13 43.72%），四控件关键区保持通过；deck仍仅SSIM未达初始门槛，未静态验收。亲看照片人物与文字尺度更接近参考，保留联合映射修复，不把两参数效果拆开宣称。

候选原始几何采样在`build/vinyl-label-scale-20261023/geometry-r14.txt`和`rows-r14.txt`。暗带/边缘拟合结果受圆角/阈值影响：record拟合中心(570,1014)、r448px，标签色边(572,1016)、r207px；这些是图像估计，不能直接替代所有冻结锚点或称几何通过。下一对同一算法重新测参考、核对真实边界后回填，而非按代码frame自证。

本轮为局部几何/采集修复，正式组件快速采集覆盖改动状态；正常八皮肤/前后台回归r11属于前批来源，不伪造新正常导航已跑。默认无采样provider时旋转effect走原路径，本轮没有改变其时间/意图。阶段出口仍需对应构建/云端，日常微调不重复归档；完整UI与动效/设备继续开放。

最终r14全量check507/507（含typecheck），日志`build/logs/check-vinyl-r14-20261023.log`，SHA `5cf4f7839db309f63472d7bfbdcc3d1f7762c8f7056dfdc6dd51417d37183fc1`。本轮按日常局部快验执行，不重复设备归档；上批清洁归档仅覆盖2c07e90，新云端仍待对应提交实跑。
