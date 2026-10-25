# 本地音频六字段双向排序（批次5B）

本地歌曲列表增加名称、时长、文件修改时间、添加时间、艺术家、专辑的正倒序，并保存字段和方向。筛选、分组内歌曲、长按选择及播放继续使用当前列表和同一权威播放器；不会因切换展示排序重排已存在的播放队列。文件夹视图、扫描根授权/规则和本地歌单详情多选仍属批次5余项。

## 范围、来源与证据

沿用用户授权的离线参考范围与Q125采集收口，原scope/workitems/timeline均在本机忽略case内。执行原生master-route，PRIMARY为apk-reverse；APK gate、--review、case-guard均通过。动态case以原review函数严格验证哈希，仅在内存过滤exFAT的AppleDouble文件：395E/101F/99P/3WI/117events，零错误零警告；未新增Sollin采集或反编译。本批为原创TS排序、偏好字段和Swift导入元数据扩展，没有采纳五参考的新代码、依赖或原生补丁；固定来源/许可边界继续见[参考比较](REFERENCE_COMPARISON.md)。

| Evidence | Finding | Path与采用边界 |
|---|---|---|
| E-706/E-710/E-712/E-714/E-742/E-744/E-745/E-746 | F015 / 结构化F-015 | P012 / P-012：六字段、方向与缺失标签保留 |
| E-788/E-790/E-792/E-794 | F019 / F-019 | P017 / P-017：修改时间同值按名称，倒序同时反转次级键 |
| E-932/E-934/E-936 | 同批添加与重启观察 | 添加时间同值保留导入次序，倒序反转；字段/方向重启保持。以功能规格中对应边界为准，不采用F015中对所有添加时间同值一概按名称的过度概括 |

## 数据与失败语义

- 新导入记录保存毫秒addedAt与可用的modifiedAt。modifiedAt在原生复制前读取文件选择器交付输入的时间；第三方FileProvider是否保留原设备mtime不保证。可选时间读取失败不阻碍有效音频导入。
- 旧localAudio.v1记录兼容，缺失时间不回填；两个方向均将未知排在已知后，界面提示。重复导入、隐藏/恢复及重启保留已有时间，删除后重新导入视为新的添加。
- 修改时间/时长/艺术家/专辑同值按名称次级排序；添加时间同值按导入索引。搜索沿用NFKC多词匹配，不改源记录顺序。
- 偏好写成功才发布新排序；失败保留原顺序并提示重试。输入日期越界/无效按既有导入事务回滚，不存路径、服务URL或私人令牌。

## 真实输入与复现

用户指定的resources/V261020原始脚本解析公开搜索结果，保存完整MP3，再由Files正常导入；没有改音频字节、补造ID3或封面。详细输入/脚本清单与URL只留忽略build目录。

| 公开输入 | 字节 | SHA256 | 实际音频 |
|---|---:|---|---|
| Shape of You - Ed Sheeran | 3,740,360 | `be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203` | MP3，立体声44100Hz，233.744秒 |
| Perfect - Ed Sheeran | 4,215,580 | `086eb96aef026bf336cf5884037a17b28f519b453c19547f3b29093f32ddda39` | MP3，立体声44100Hz，263.445秒 |

真实UI复现需先用授权脚本取得这两首音频；文件名按上表，音频本身不进仓库。用独立模拟器与未使用过的run目录执行：

```bash
source scripts/environment.sh
export NODE_OPTIONS= PYTHONPATH=
# 本机现有的独立模拟器与原字节输入；每次使用新目录。
NEXUS_SIMULATOR_ID=A8347A1F-0805-4731-B8CE-3FE48C156AC0 \
NEXUS_UI_RUN_DIR="build/local-sort-replay-$(date +%s)" \
NEXUS_UI_LOCAL_AUDIO="$PWD/build/local-sort-live-20261025/Shape of You - Ed Sheeran.mp3" \
NEXUS_UI_LOCAL_AUDIO_SECOND="$PWD/build/local-music-live-20261025/Perfect - Ed Sheeran.mp3" \
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLiveLocalSorting
```

该显式目标只向Files复制两首原字节音频，前后哈希写入manifest，不写合成输入，不启用截图专用入口。目标预期仅有这两首本地曲目；重复执行可沿用这两首，其他测试或个人库需使用独立模拟器。

## 验证与边界

类型和548项逻辑测试通过，包括六字段双向、同值方向、缺失时间、过滤、偏好迁移/重启/失败不发布、导入时间/重复/隐藏/恢复/非法时间回滚。Swift LocalFilesCLI用真实Perfect MP3通过导入/内容身份/修改时间/播放持有保护/暂存删除还原/reconcile/路径拒绝。领域测试中的小型内存样本只用于规则和失败注入，不作为截图或真实播放验收。

首轮SourceUITests-1792913481176在测试编译失败，0项执行：开工时已有的Files辅助函数误将NSRegularExpression传给Swift Regex API。保留其轮询/可见坐标回退逻辑，仅修正为Foundation matches接口，负证据保留。

第二轮Release SourceUITests-1792913810012，1/0/0、157.042秒，首次从空本地库导入两首真实歌曲并完成全流程。第三轮SourceUITests-1792914255244在重复导入时误匹配选择器背后的local-track行，1失败；Files行查询已排除本地列表标识，最终第四轮Release SourceUITests-1792914501755通过，1/0/0、106.473秒；源码与两首输入前后未变，四附件provenance均ready并亲看。此前编译与该定位失败都保留，不计通过。两首音频均无艺术家/专辑标签，现场验证缺失项保留和名称次级排序；不同标签的主键由六种互异预期排列的领域测试覆盖。

最终UI结果与截图来源记录于[质量场景](ui-spec/local-sort-live-2026-10-25.md)。本批未做iPhone真机、签名、后台、听感、全曲播放或动效录屏验收，不声明与Sollin内部实现/像素/动效一致。当前主分支此前云端40166507491在Navidrome长队列测试失败，不能称为云端通过。

## 构建绑定与工作树边界

正式入口index.ts，未启用在线合成夹具入口。以下仅为摘要，完整manifest/xcresult/附件/日志在本机忽略目录build/local-sort-live-20261025/r4及build/SourceUITests-1792914501755.xcresult。

- source digest SHA256：`f8eb9f78c80021240fd9bf52beaa5b4f18413b52ce706ce0eab92c527a8b2a91`。
- installed bundle digest SHA256：`0a4c6f16eb9924c4e6a76008b9dbedc2af7dc6d5e02202a1a634205d2b53277a`。
- xcresult Info.plist SHA256：`f39aa9602e4f0a6fd99a1882c829ac493de345148f52ba438b559799cfb18c2c`。
- run-manifest.json SHA256：`25dc0265bbaec699af42f548d54dca1c47163f517ee2a7c8bee3357fb7422a4c`。
- screenshots/index.json SHA256：`294e0a83422ccc9996d9ebe05904cb422931dcd08bcac57fe8e6fad5f0c09068`。
- scripts/test-ui.mjs SHA256：`fed7c46b7abe196ad257adfb26745790ca034af6dbcd47f6078e92382bc3f455`。
- UI场景规格 SHA256：`72eefd1936051ab54372e68d5978f2903aa52676999ee470eae1db1a1956a896`。

本地UI构建包含开工时已有的Files helper工作树补丁（轮询/坐标回退），本次修正其中一处API误用并保留在工作树，未混入本批提交；manifest记录了其完整源码哈希。本批提交新真实用例及排除选择器背后local-track行的定位修正。生产排序代码、真实音频输入与截图的来源已分别绑定，不能把该本地工作树测试称为clean HEAD构建。

收尾检查磁盘余量约25GiB；构建期间未清缓存或原始证据，保留当前DerivedData、有效阶段与未解决CI证据，回执build/logs/cleanup-local-sort-20261025.json。未进行文件整目录删除、采集迁移、force push或旧CI重派。
