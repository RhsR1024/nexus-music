# 搜索跨主导航会话保留

J25 已补齐类型、平台和未提交草稿的会话保留。最终1022项类型/业务检查与三项正式Release搜索回归通过；咪咕真实公开专辑导入兼容回归和阶段交付仍在执行，不记完整J25或项目完成。

## 问题与实现

`App.tsx` 按主导航条件渲染搜索页，切换发现、音乐库或设置会卸载 `Search`。旧实现的类型与平台在重新挂载时回到歌曲/聚合，输入则从歌曲协调器初始化；专辑等非歌曲查询和未提交草稿因此丢失。已有结果协调器仍存活，但其状态与重新初始化的界面不一致。

当前应用根组件持有 `SearchSession` 的 `kind/query/platform`，搜索页通过部分更新写回同一会话。五类结果和分页继续由原协调器持有，返回时不发起检索；不新增结果副本、持久化记录或播放队列。详情、临时多选、弹窗仍按原卸载语义关闭。

Migu公开专辑导入回归中“跨主导航后输入必为空”的历史假设同时调整：初次为空时输入固定公开专辑名；后续已保留相同查询时复用，并继续严格检查最终完整查询和真实专辑结果。取消、创建、顺序/来源、重启持久化和删除业务断言保留。

## 验收方法

场景见[统一搜索规格](ui-spec/unified-search-2026-11-02.md#主导航会话保留验收2026-11-05)。复用正式 `testUnifiedSongAlbumArtistSearch`，保留原五类预览、详情、分页和音源清理，并增加：

- 歌曲第二页往返发现，检查类型对应输入、原查询、网易云选择、第二页和原播放身份。
- 专辑结果往返音乐库，检查类型、查询、平台、结果保持。
- 在原非空查询末尾追加未提交草稿，往返设置后检查草稿与既有结果同时保留；只删除后缀恢复原输入。
- 每次往返都确认中间主导航真正选中，再确认返回搜索；键盘存在时先在正式滚动容器拖动收起。
- 测试服务器以只读端点返回实际检索请求计数，往返前后必须相等且初始大于零；建议/热搜不混入提交检索计数。

清空输入仍按既有产品语义清除结果。本批草稿测试编辑非空查询，不以先清空再重输冒充保留原结果。

复现命令：

```bash
source scripts/environment.sh
NEXUS_UI_RUN_DIR=build/search-session-20261105-r5 \
  node scripts/test-ui.mjs \
  NexusMusicUITests/SourceSettingsTests/testUnifiedSongAlbumArtistSearch \
  NexusMusicUITests/SourceSettingsTests/testSearchHistoryAndStates \
  NexusMusicUITests/SourceSettingsTests/testUnifiedSearchAggregateFivePlatformMatrix
```

正式证据目录不得复用；命令中的本轮输出已用于运行，复现应换新目录。

## 已有检查与失败记录

- `build/search-session-check-20261105.log`：类型检查与1022/1022业务测试通过；Node语法、diff检查通过。
- r1 `SourceUITests-1793843924664` 在构建阶段主动中断，exit75、sourceUnchanged=true。检查发现初版辅助器会附带回车提交，不作为产品或UI验收。
- r2 `SourceUITests-1793844040478` 为0/1/0、124.307秒、sourceUnchanged=true。歌曲分页往返与播放身份、专辑提交查询往返已越过断言；草稿阶段请求计数7≠6失败。
- r2日志的两个底栏点击均为 `Computed hit point {-1, -1}`，没有证明中间设置页实际打开；同时替换整个字段会经过空输入语义。保留结果、日志与失败附件，不能把此轮计为草稿验收或直接定为产品重发缺陷。
- r3 `SourceUITests-1793844339059` 为0/1/0，失败于把带 `search-viewport` 标识的React Native容器限定查询为原生 `ScrollView`；键盘收起未执行，不计草稿通过。改用真实无障碍标识定位容器，不改变产品或断言。
- r4 `SourceUITests-1793844611849` 为2/1/0、sourceUnchanged=true。历史36.699秒、完整统一搜索172.304秒通过；草稿、平台、歌曲第二页、播放身份、实际主导航选中和请求计数检查均通过。五平台矩阵113.679秒在旧咪咕专辑夹具失败。整轮exit65，不将截图作为最终provenance ready证据。

扩大回归时发现五平台旧夹具的咪咕专辑ID仍是 `mg-aggregate-album`；11月3日已采纳的咪咕身份校验只接受数字官方ID，因此该预览被正确拒绝。夹具已修正为数字合成ID `9002001` 及普通专辑资源类型 `2003`，保留五平台全部预览、来源和播放断言；不放宽产品身份校验，也不以其他平台通过掩盖这一失败。

## 最终搜索证据

r5 `build/SourceUITests-1793845069668.xcresult` 为3通过/0失败/0跳过、exit0、sourceUnchanged=true，iPhone15ProMax / iOS26.3.1模拟器、Release。历史37.784秒、五平台歌曲/专辑/艺术家矩阵144.704秒、完整统一搜索及新增跨导航检查168.456秒通过。

source digest `b75f359e281bdebeeb425a38adaa23d2ef70f67c23c68a3355c564dabd14a58b`，安装bundle `2f4623406335354434e2d384bb5005e49eb4a9e11c10a8a2901bdec34d4d1a34`。服务端累计13次提交检索，所有受检查的主导航往返前后计数相等，未提交草稿未变为检索。该累计包含同轮其它测试，不能把13次全部归于单个查询。

13张1290×2796截图均provenance ready、failures为空；索引 `build/search-session-20261105-r5/screenshots/index.json` 的SHA-256为 `647c02aaccb30a2c0bbb3970a953a0285bebd2ed037bf6deadc9964557cf15b0`。已亲看五个关键态：歌曲第二页、专辑已提交查询、带未提交后缀的专辑草稿、末平台咪咕专辑/艺术家及统一页首屏。类型、平台、输入、原结果和底栏无重叠，歌曲“加载更多”位于当前视口下缘，可正常滚动；未宣称全部控件同帧可见。

草稿截图保留真实“建议暂不可用”反馈，同时原专辑结果仍在；五平台矩阵只覆盖歌曲/专辑/艺术家15项预览，咪咕歌单/MV错误态不计为对应真实能力通过。完整五类预览、既有详情和歌曲播放另由网易云统一搜索夹具覆盖，不冒充真实五平台逐页网络UI。

`build/search-session-final-check-20261105.log` 再次确认最终源码类型检查与1022/1022业务测试通过。本批无原生行为改动，采用正式Release编译与上述业务/UI回归验证。

Migu公开专辑兼容回归 `build/SourceUITests-1793845487858.xcresult` 为1/0/0、153.956秒、exit0、sourceUnchanged=true。取消导入不创建副本；第二次打开复用保留的咪咕专辑查询与结果；创建本地副本、重启后7首原始ID/顺序/咪咕身份/公开范围说明、删除及再次重启清理均通过。6张截图provenance ready并亲看关键导入说明与重启后列表；索引SHA-256 `04f555be78820b7f18cbd1bf6638de34d382cd244e9833ad99f640145c63930d`。同源digest仍为 `b75f359e…58b`，实际安装bundle `615f398a…23b`。

最终1025/1025检查在包含本地FM与同步修复后为 `build/search-session-all-fixes-check-r2-20261105.log`；提交前重复验证见 `build/search-session-prefinal-check-20261105.log`。

## 边界与后续

## 阶段证据归档

本批测试与失败链已复制到真实挂载T7的 `/Volumes/T7 Touch/NexusMusic/BuildArchive/2026-11-05-search-session-29f2057/`。清单与回执均为767份、154,976,735字节，逐文件SHA-256核验0差异；源原件保留、零删除、零迁移个人文件。恢复按 `inventory.json` 的相同相对路径执行。

产品提交 `130bcd91dc4a56d10473030138c6f114ed28a7fc` 已正常push并实核远端main一致。clean HEAD unsigned archive通过：manifest绑定该提交、`dirty=false`、工作区无变化，arm64 / iphoneos26.2 / 最低iOS15.1 / 设备族 `[1,2]` / 未签名。IPA为17,859,667字节，SHA-256 `cabe99f46fba19887090eaeb231cd03bd66be18bce37c65634f7ece402b9cc55`；151项archive/IPA普通文件逐字节、ZIP CRC、测试/私人夹具标记、签名材料排除和未签名状态均通过，回执 `build/search-session-clean-verification-20261105.json`。

clean源码tar为 `build/search-session-clean-source-130bcd9.tar`；clean交付阶段在T7 `2026-11-05-search-session-130bcd9/`，11份/38,597,919字节逐项SHA一致。收尾时无活动构建，内盘约65,237,553,152字节可用、T7约613,531,385,856字节可用；零删除、零迁移个人文件，回执 `build/search-session-closeout-20261105.json`。

推送后公共工作流为1运行/1排队：`41949520533/a328ee6` 继续运行，新 `41957090823/130bcd9` 等待串行执行；快照 `build/search-session-ci-after-push-20261105.json`。没有取消或重派旧版本。

## 边界与后续

本批来自自有应用的状态生命周期缺陷，没有新增Sollin分析、采集或商业逻辑采纳；不增加参考版像素/动效完成量。真实五平台逐页网络UI、实体机、VoiceOver、弱网/限流、签名、完整J25及全部F/J仍开放；云端新运行终态待实际结果。
