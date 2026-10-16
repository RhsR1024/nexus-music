# 音枢项目协作约定

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
- 未确定原生工程管理方式前不要运行覆盖性 prebuild。自定义原生改动必须由已确定的工程或可重建插件保存。
- 检查按改动风险选择，文档只做链接/一致性校验；播放、导入、状态竞态等实现需要有意义的测试和真机验收。不得用成功打包代替实际播放或签名验收。

- 用户要求功能移植前详细比较本机 ReferenceProject 中的悦音、Q-1515、wtfdelphia、CyMusic及自有Wayferar-Music；按 docs/REFERENCE_COMPARISON.md 记录实现、维护、Android边界、许可和验收后再采纳。

- 用户已明确授权阶段验收后提交并push到RhsR1024/nexus-music。先验证、检查diff及私人资源排除，核对远程再正常push；认证失败保留本地提交并说明，不force push。

- 云端CI最新规则（2026-10-17）：同工作流/分支保留正在运行的构建，仅保留最新一个排队提交，使用 `queue: single` 与 `cancel-in-progress: false`。新提交自动替换旧pending，不手动重派旧版本、不取消运行中任务；每次push后核对实际队列至多运行1/排队1。此规则覆盖文档中历史“不取消排队/queue:max”约定；取消的旧运行不算通过，最新成功运行仅证明其实际包含的代码/测试。详见docs/GITHUB_ACTIONS.md。
