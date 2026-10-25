# 本地文件夹授权、扫描与过滤（批次5C）

批次5新增系统文件夹授权、包含子目录开关、文件夹视图、最小时长与目录屏蔽、显式重新扫描。保存规则保留当前列表，重扫才提交新索引；已复制的文件和播放/歌单引用保留，扫描根移除不删除设备原文件。当前556项检查、真实MP3原生契约与最终Release `SourceUITests-1792925051344`（1/0/0、3分10秒、8张实际附件亲看）通过；期间三轮App负证据（r4–r6）定位为原生present竞态、远程Files AX不可查询叠加sheet无回调消失、看门狗首版阈值与Files冷启动冲突，均已修复并记入本回执。

## 范围与证据

沿用Q125收口后的既有资料，未新增Sollin截图、性能/后台采集或反编译。原生master-route选择apk-reverse；APK gate及--review通过；动态case严格审核395E/101F/99P/3WI/117events、0错误0警告，过滤exFAT AppleDouble仅在review进程内进行，未改案例。scope/workitems/timeline沿既有离线case保留。

| Evidence | Finding | Path与采用边界 |
|---|---|---|
| E-844/E-846/E-848/E-938/E-940 | F-025：配置可保存、参考设备未实际过滤 | P-023：保存/重扫/结果分开验收；音枢实现有效过滤，不复刻异常 |
| E-1176–E-1200 | F-059：索引移除保留文件，重扫恢复 | P-057：用户隐藏与扫描排除分开，副本继续解析 |
| E-1252 | F-070相关清理观察 | 移除扫描根保存后仍保留列表，显式重扫才归零 |

本批原创代码，无新第三方依赖、商业逻辑或参考原生补丁；固定来源与许可边界沿[参考比较](REFERENCE_COMPARISON.md)。iOS由系统目录选择器授权，不搬用Android的外部存储权限。

## 实现与数据边界

- UIDocumentPicker只请求用户选定文件夹。书签留在原生Application Support的独立目录，标记不进入系统备份，并使用iOS文件保护；JS仅收到不透明目录ID与名称。失效目录需移除后重新添加，不探测其他私人目录。
- 扫描期间按书签打开授权范围，结束平衡关闭security-scoped access。跳过隐藏项、包与符号链接；有界遍历后复用原有AVFoundation导入、SHA256身份与App自有副本。真实相同内容可对应多个源文件夹位置，歌曲仍保持一个内容身份。
- SQLite localAudio.v1一次写入文件索引与扫描状态，保留旧记录兼容。目录来源只保存目录ID、根名称及相对位置，不放入Track.metadata或音乐库JSON备份。手动导入条目不随扫描根移除而消失。
- 手动索引隐藏与scanExcluded分离：重扫匹配项恢复用户隐藏，过滤/移根排除项不被“恢复已移除歌曲”绕过；在播/歌单仍通过包含保留记录的同一resolver解析。
- 原生枚举中断不提交新索引；个别文件读取失败保留其先前引用并报告数量。数据库失败不发布新状态，只清理本次新建且无旧记录的副本。书签维护失败不阻碍已拥有音频恢复，损坏书签原件隔离保留，可重新授权。
- 规则保存与应用分别可见；设置页使用滚动/键盘inset、44pt控件与现有令牌，打开时隔离背景AX焦点。目录路径按相对层次换行。

副本保留支持队列和歌单引用；扫描排除不等同物理文件清理。保留副本的进一步管理与回收属于后续数据管理工作，不能把当前扫描宣称为磁盘清理。大目录、第三方云盘、iPhone真机/签名/后台、连续动效及非MP3格式不在本批实测通过范围。

## 真实验证输入

两首完整公开MP3通过用户指定resources/V261020原始音源取得，与[六字段排序回执](2026-10-25_implementation-local-sort-report.md)相同原字节；不补造标签/封面/歌词。真实输入、URL、原始脚本及私有清单仅留本机忽略目录。

| 输入 | 字节 | SHA256 | 时长 |
|---|---:|---|---:|
| Shape of You - Ed Sheeran | 3,740,360 | `be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203` | 233.744秒 |
| Perfect - Ed Sheeran | 4,215,580 | `086eb96aef026bf336cf5884037a17b28f519b453c19547f3b29093f32ddda39` | 263.445秒 |

原生CLI将Shape放根目录、Perfect放Albums子目录，验证平层1/递归2/240秒阈值1/屏蔽Albums后1/屏蔽整根0/书签重读2/源文件消失后1；符号链接文件和目录均跳过，拥有副本逐一哈希相符。移除授权拒绝继续扫描；损坏书签隔离后重新授权成功。命令：

```bash
source scripts/environment.sh
xcrun swiftc -swift-version 5 modules/nexus-native/ios/LocalAudioFiles.swift \
  tests/native/LocalFoldersCLI.swift -framework AVFoundation -framework ImageIO \
  -framework UniformTypeIdentifiers -o build/tests/native-local-folders
# 使用新的输出目录；输入音频必须已由授权源真实取得。
build/tests/native-local-folders \
  'build/local-sort-live-20261025/Shape of You - Ed Sheeran.mp3' \
  'build/local-music-live-20261025/Perfect - Ed Sheeran.mp3' \
  "build/local-folder-native-replay-$(date +%s)"
```

原生首轮真实递归断言失败：在符号链接文件上调用skipDescendants会跳过后续真实目录，现仅跳过链接本身，文件/目录链接负例均通过。编译期assert的throwing autoclosure写法亦已修正；负证据留本机，不当通过计数。

## App验收进展

- r1 `SourceUITests-1792916614533`：取消/真实目录授权、自动递归扫描2首、文件夹根与Albums分组各1首、进入子目录实际Perfect通过；随后因XCTest将带testID的React滚动包装层当成ScrollView而停止。实际AX为Other，定位已修正。
- r2 `SourceUITests-1792917130300`：移根保存、显式扫描归零通过；系统Cancel实际为Other而非Button，已按实际AX修正查询。
- r3 `SourceUITests-1792917932826`（Release 1/0/0、2分11秒）：完整流程通过；取消现场、物理分组、240秒阈值、屏蔽Albums、移根归零、移根后副本PCM播放六张实际截图亲看通过，但未记终态即复核。
- r4 `1792918300867`（负证据）：取消后立刻再添加时，`pickAudioFolder` 在上一个picker关闭动画期间present静默失败，promise永久挂起；失败截图与控件树显示spinner存在且无任何picker元素。修复：原生present前轮询等待层级收起（上限20次×0.1秒后拒绝），delegate在init即设置。
- r5 `1792923306510`（负证据，屏幕录像亲看）：修复已进入二进制（字符串校验）仍在同位置失败。录像显示第二次picker已弹出且目录内容可见，但循环期间远程Files AX子树（`DOC.browsingRoot`标识与目录cell）不可查询，旧逻辑只在root/标题命中后才找"打开"，因而在AX缺失下反复点浏览造成目录视图/浏览根翻转；末尾sheet被系统自行撤下且无delegate回调，App冻结在spinner（真实用户同样会被卡住）。修复：原生新增看门狗，sheet消失且无回调时按取消收口；测试`chooseFolder`每轮优先确认sheet自身导航栏的"打开"（不依赖远程AX），并允许重开自愈。
- r6 `1792924440806`（负证据，屏幕录像亲看）：看门狗首版"未展示3秒即拒绝"与干净容器Files冷启动冲突——sheet实际展示约4秒，拒绝先于展示完成，产生孤儿sheet并使取消步骤断言失败（录像中错误消息先于sheet出现）。修复：未展示阈值放宽到20秒，拒绝时同步dismiss迟到孤儿。
- r7 `SourceUITests-1792925051344`（最终Release，1/0/0、3分10秒）：完整流程通过；8张实际附件亲看——真实系统picker现场、移除后重扫恢复隐藏索引、物理分组（根1首/Albums 1首）、240秒阈值仅留Perfect、屏蔽Albums仅留Shape、移根重扫归零、移根后副本继续PCM播放（00:03/04:23）、重启后"单独导入"分组存活。`npm run check` 556/556。

所有UI输入为上述真实音频；领域小型内存对象仅用于事务与失败注入，不作截图或播放验收。未使用安装成功或编译结果代替功能证据。
