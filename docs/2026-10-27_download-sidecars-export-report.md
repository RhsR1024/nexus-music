# 2026-10-27 下载附加文件导出

批次6继续落实：iPhone已完成音频的显式用户副本可独立附加LRC、JPG和meta.json，沿用命名顺序与分隔符。三个选项默认关闭，设备内持久保存，旧可移植备份不覆盖设备文件策略。此处不是下载时托管侧车或Android公共目录实现。

## 依据与边界

沿用E830/E836→F023→P021，不新增Sollin采集。reverse-skill固定cab634bd855fc287f6e420c1f36fd1a6b9245960；亲读要求与PRIMARY、原生master-route、APK gate及采纳前`--review`通过。当前动态功能case严格哈希审核PASS：395 Evidence、101 Finding、99 Path、3 workitems、117 timeline，0错误/警告；不是安装案例，也不是全项目完成计数。日志为本机`build/download-sidecars-20261027-{route,gate,review}.log`及`...-case-review.json`。参考工程无新增代码、依赖或原生补丁采纳。

## 实现

先在离线索引锁内校验并复制原音频，锁外获取当前所选歌词来源和封面，最后调用系统多文件分享→存储到文件。稳定内部UUID、权威队列与播放意图保持。所选歌词或封面不可用则明确失败；取消准备不输出占位文件。关闭的附加项不触发对应获取。原文件扩展名取实际容器头。

LRC保留时间轴及已有译文/音译，不烘焙播放器偏移；内容上限1MiB。JPG从实际图片重新编码，最长边512、限制输入大小和像素量；512是音枢当前导出策略，不声称复现E838的平台尺寸设置。meta.json白名单含名称、专辑、时长与实际容器/字节数/MD5，不序列化origin、账号、请求URL、headers或metadata bag，上限64KiB。

原生入口只接受同一独立缓存目录中的1–4个常规非空文件，拒绝越界、重复、混合目录及非法类型。系统分享完成/取消后清理副本，原库内文件保留；进程被杀后的缓存孤儿不声称自动恢复或清理。

## 验证

- `npm run check`：633/633、typecheck通过，含八种附加项组合、缺失歌词、准备取消、默认/旧设置迁移、设备策略备份边界、LRC和元数据白名单；最终日志`build/download-sidecars-20261027-check-r4.log`。
- `bash scripts/test-native.sh`最终exit0，`build/download-sidecars-20261027-native-final.log`。
- 实际公开MP3与对应实际封面运行`tests/native/AudioExportCLI.swift`：四文件、512×512 JPEG、七组非法路径/文件集合拒绝、原输入SHA保持；`build/download-sidecars-native-real-20261027-r1/receipt.json`。封面输入SHA为08cebcf4451a338f6f062f4cb9594cb86f4605e8480cb42ec98e4fc489e0bd04。
- 当前源码真实MP3磁盘导出/取消回归通过：`build/download-sidecars-audio-regression-20261027-r2/receipt.json`，实际副本SHA、取消清理及原文件保持。
- 最终Release真实资料UI：`build/SourceUITests-1793065131851.xcresult`，1/0/0、133.326秒；`build/download-sidecars-live-20261027-r7/`，候选补丁、精确构建与sourceBefore/After绑定。源码digest为f185395045c42d8acc28b9383fd5e382df478d557c35da1d2b4c2b749bed0f33。三开关重启保留、元数据独立关闭/重开、正常滚动、四文件保存和两次连续系统取消均通过。

实际保存同前缀`Ed Sheeran__Shape of You`的mp3/lrc/jpg/meta.json四文件，系统文件在测试目录清理前按原字节归档；MP3 SHA为be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203。LRC由正式parser读得207个带时间戳行；实际JPG为512×512；元数据269字节，音频字节数与MD5实际校验。两个托管完成音频分别保持be80…及086eb96aef026bf336cf5884037a17b28f519b453c19547f3b29093f32ddda39，队列仍一项，详见`physical-verification.json`。沿用先前由V261020公开脚本/真实服务下载的曲目，不宣称本批重新播放或重新下载音频。

十张实际PNG逐张亲看，逐张`verifyCaptureEvidence` ready=true；索引和回执在`r7/screens/index.json`及`provenance-review.json`。006实际是系统呈现前的准备态，不作为分享弹层图；弹层由002、文件保存由003/005及物理文件证明。正常导航与正式组件，无合成截图验收；静态图不证明动效或同态Sollin像素对齐，不增加全量UI完成度。

R1、R3–R6为失败记录；R2仅旧直接文件选择器流程通过，不能代替最终实现。实际层级确认Cancel存在Other且不可点击，返回后还可能停在系统分享弹层。最终多文件采用与原单音频一致的系统分享流程，测试在实际弹层外区域正常关闭，未强点隐藏元素或取消产品断言。

R1及R3–R6终止后的五个缓存副本目录，经四文件哈希与保留归档逐一比对后清理，共19073900字节；最终缓存导出目录为0。回执`build/logs/cleanup-download-sidecars-20261027.json`和`...-final-20261027.json`，保留实际输出、失败诊断与当前构建。磁盘约9GiB余量，未清理使用中的构建目录或reverse原始证据。

## 未验证与后续

登记iPhone当前tunnel unavailable、开发者模式disabled、DDI不可用，本批未真机、签名或系统后台验收。本机模拟器iOS26.3.1真实资料验证不替代iOS27云端。独立平台下载音质、平台封面尺寸、持续目录授权、下载时托管侧车及Android仍开放，按批次6继续；不结束总实施目标。
