# 音枢项目协作约定

## Sollin 逆向与对齐硬门禁（2026-10-17 用户明确要求）

- 后续所有 Sollin IPA/APK 逆向分析，以及基于其功能、UI、交互的对齐，必须使用 `reverse-skill`；先路由、后分析、再依据证据实施，禁止绕过或仅写“已读”。
- 包根为相邻 `../reverse-skill`（本机 `/Users/ningli/WorkSpace/reverse-skill`），项目安装入口 `.agents/skills/reverse-skill-router`；固定提交、工具缺口和复现见 `docs/REVERSE_SKILL_WORKFLOW.md`。
- 开工先亲读包根 `README_AI.md`、`RULES.md`、`docs/platforms/macos.md` 和 `skills/SKILL.md`/`MASTER-ROUTING.md`；运行平台原生 `master-route`，读取 PRIMARY，检查本机 `skills/tool-index.md/json`，用 `case-init`/`case-guard` 校验当前离线样本 scope。
- 执行 `source scripts/environment.sh` 后，`node scripts/sollin-reverse-gate.mjs ipa` 或 `apk` 必须通过；采纳该批结论前执行同命令加 `--review`，并确认该批功能的 Evidence→Finding→Path、workitems/timeline 已更新，不能用安装案例代替功能证据。
- skill 缺失、版本漂移、样本摘要不符、scope/工具或证据未就绪时，不得继续依赖该项证据的对齐；先修复门禁，独立构建/业务工作可继续。不伪造反编译、调用图、动态运行或真机结果。
- `work/`、工具索引、样本、解包、原始字符串/反编译输出只留本机忽略目录；仓库只留脱敏结论、固定来源和必要门禁。IPA优先、APK互补、截图辅助及音枢特有能力/许可/隐私边界不变。不得将包内模板扩展为私人服务探测、全局客户端配置或参考商业逻辑移植授权。

## Sollin UI 对齐硬门禁（2026-10-19 用户明确要求）

- **90% 是最低线，不是上限**：结构、像素、动效分别评分，以同尺寸参考截图/录屏“越接近越好”为验收方向，不因达到 90% 停止收敛。
- **截图是度量基准，IPA 只做常量/语义校验**：不得用“又反汇编出一个函数”代替视觉收敛；没有像素/动效证据的页面只能写“实施中”，不得记为完成或计入 UI 完成量。
- 每页/每状态改动前，在 `docs/SOLLIN_UI_ALIGNMENT.md` 记录 3x→pt 量测（间距、尺寸、圆角、字号、色值）；改动后用同逻辑尺寸截图跑 `scripts/visual-diff.mjs`（全局/区域 SSIM + 像素差 + 人工亲看），记录分数与偏差。无 diff 结果不得声称对齐。
- 视觉基础设施优先：设计令牌（`src/ui/tokens.ts` 的 spacing/radius/type/color）、Cupertino 细线图标层、原生材质/玻璃层。禁止继续叠加 Ionicons 混搭、散落 inline 数值或为凑像素伪造入口。
- 动效/手势独立验收：静态证据只提供常量；弹簧、连续手势、转场必须用真机录屏逐帧对齐。无录屏时只能声明“近似”，不能声明“一致”。
- 未通过 diff 的页面不进入“已对齐”清单；进度表按已通过 diff 的页数更新，不按布局是否接入更新。

- 开始工作前完整阅读根目录 HANDOFF.md 以及与任务相关的 docs 文档。架构、范围和交接等基础文档由主代理亲读。
- 用户已授权进入实施，按 docs/TASK_PLAN.md 和 docs/IMPLEMENTATION_PLAN.md 推进；LX优先，漫途导入后置。不能把参考能力、离线初始化或模拟器编译写成真实播放已完成。
- 用户最新明确指令优先于文档；范围变化时同步更新 HANDOFF.md、PRODUCT_SCOPE.md 和受影响的决策文档。
- 如果仓库根存在 `.codegraph/`，理解/定位代码前先用 CodeGraph；不存在则跳过，不自行建立索引。
- 重而广的检索/独立核验可委派子代理，只做探索，要求 file:line、符号和关键证据；角色 default、fork_turns=none。主代理负责基础文档、即将修改的代码、方案和最终验证。遵守运行环境实际并发限制。
- 对参考代码保留固定提交、来源与许可。未经检查，不整体复制多个项目的依赖或原生补丁；不为本项目随意宣告 MIT/Apache 许可覆盖所有参考资产。
- 原生音频处理不通过 React state 逐帧传递 PCM；歌词/动画不得用每帧全量 React 列表重渲染。
- 在线 provider、LX 脚本宿主、Navidrome client 与播放器分别建边界；一个权威队列和播放意图。
- 机密、Apple 签名材料、音源中的私人令牌、Navidrome 凭据和真实个人歌单不提交仓库。测试夹具使用去标识样本。
- Z 盘是当前 Windows 网络工作目录。Mac 的 node_modules、Pods、DerivedData、构建缓存和本地工具链在本机 SSD 上生成，不跨系统共享。
- 临时产物定期清理（2026-10-18 用户要求）：每阶段收尾及每天首次工作/跟进时检查目录占用和磁盘余量；用完并核验的重复诊断压缩包/解压/导出及时清理，临时文件默认7天、普通日志14天、已解决故障的完整结果包30天后轮换。保留最新两个有效阶段产物及摘要、未解决故障的必要原始证据和当前使用中的文件；reverse-skill样本、scope、Evidence及其哈希引用文件不按缓存删除。Xcode运行时不得清构建目录；可重建旧缓存需确认无使用者后清理，剩余空间不足30GB时优先处理。清理须先列清单/核对引用，留下小型回执（路径、字节、理由及保留证据），不得整目录盲删或把已清理附件仍写成当前可取。详见docs/BUILDING.md。
- 未确定原生工程管理方式前不要运行覆盖性 prebuild。自定义原生改动必须由已确定的工程或可重建插件保存。
- 检查按改动风险选择，文档只做链接/一致性校验；播放、导入、状态竞态等实现需要有意义的测试和真机验收。不得用成功打包代替实际播放或签名验收。

- 用户要求功能移植前详细比较本机 ReferenceProject 中的悦音、Q-1515、wtfdelphia、CyMusic及自有Wayferar-Music；按 docs/REFERENCE_COMPARISON.md 记录实现、维护、Android边界、许可和验收后再采纳。

- 用户已明确授权阶段验收后提交并push到RhsR1024/nexus-music。先验证、检查diff及私人资源排除，核对远程再正常push；认证失败保留本地提交并说明，不force push。

- 云端CI最新规则（2026-10-17）：同工作流/分支保留正在运行的构建，仅保留最新一个排队提交，使用 `queue: single` 与 `cancel-in-progress: false`。新提交自动替换旧pending，不手动重派旧版本、不取消运行中任务；每次push后核对实际队列至多运行1/排队1。此规则覆盖文档中历史“不取消排队/queue:max”约定；取消的旧运行不算通过，最新成功运行仅证明其实际包含的代码/测试。详见docs/GITHUB_ACTIONS.md。
