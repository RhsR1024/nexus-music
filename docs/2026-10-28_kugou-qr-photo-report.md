# 酷狗二维码保存到照片

F30同机路径的准备环节：在正式账号页取得官方二维码后，用户可点击“保存二维码到照片”，再自行在本机酷狗扫一扫的相册中识别。未实际安装/操作酷狗或完成扫码，不记完整同机登录通过。保留现有另一台设备扫码路径，平台token仍只进Keychain，不进入图片、备份、LX或播放器。

## Evidence → Finding → Path

| Evidence | Finding | Path |
|---|---|---|
| 固定Q-music Android 5db858f，docs/music-accounts.md及三归属文件逐字节一致 | 同机可使用二维码图片在酷狗相册识别；不是直接证明iOS API/原生补丁可复制 | 自写iOS PhotoKit与正式保存按钮，不移植Android存储/权限/依赖 |
| Apple PhotoKit隐私指南及NSPhotoLibraryAddUsageDescription | 只新增照片应请求addOnly及对应目的描述 | NexusFiles新保存方法、Info.plist/app.json仅添加用途说明，不申请相册读取/相机权限 |
| 764类型/业务检查含6项照片状态/竞态及5项后台交接测试 | 无有效QR不能保存，重复点击锁、旧代次撤销与提交后成功边界、固定错误状态 | KugouQrPhoto绑定当前QR；Native在实际PhotoKit提交完成后才成功 |
| 原生路由/APK前提/--review与既有功能案例严格复审 | 395E/101F/99P不新增结论 | 不补采Sollin，不把安装或新Photos功能称逆向证据 |

Apple依据：[照片隐私指南](https://developer.apple.com/documentation/photokit/delivering-an-enhanced-privacy-experience-in-your-photos-app)、[添加照片目的描述](https://developer.apple.com/documentation/bundleresources/information-property-list/nsphotolibraryaddusagedescription)。官方Markdown在web工具内容类型不支持后以本机HTTP只读取得，保留本机build/kugou-qr-photo-20261028/apple-photos.md；不依赖第三方转载。参考Q-music只采用既有同机操作说明，源码/许可收据在同目录reference-check.json。

## 行为与权限

不在展示QR或启动App时申请照片权限，只有点击保存才申请。Native仅接受有界单帧PNG/32–1024px、合法操作UUID和两分钟内期限，不读文件路径/相册或发网络。权限等待期间取消、失效或真正进入后台阻止尚未提交的写入；权限弹窗的短暂inactive保留QR，回到active后才提交。保存正在进行时拒绝重复请求。PhotoKit提交后的用户副本不因取消扫码而删除，完成结果仍真实返回；若当前QR已变化，明确提示已存图可能失效。照片副本由系统照片及用户自己的照片同步设置管理，不是音枢会话备份。

未知底层错误只映射固定状态，不显示图片、nonce、原始NSError或用户照片信息。只请求addOnly，未新增NSPhotoLibraryUsageDescription；代码没有相册枚举、照片读取或自动打开其他App。原生实现位于既有NexusFilesModule.swift，由已有工程保存，未运行覆盖性prebuild或导入依赖。

成功保存且当前二维码仍有效时，明确开启同机切换：保留原期限和代次，后台停止新轮询，已在途响应等待前台后再处理；过期、退出账号页或显式取消仍终止。未保存的后台取消行为不变，不自动打开酷狗。已在前台开始的账号保存仍遵守既有存储边界，不宣称可回滚已提交结果。

## 实际资料与未验范围

编码前[场景登记](ui-spec/kugou-qr-photo-live-2026-10-28.md)。真实音频使用V261020来源公开Shape of You完整233.744秒MP3，SHA256 be80e8647e530f86a3ffe3e558772d1378596fb878a682071bb36369d5a63203；真实官方QR、系统权限弹窗、拒绝/允许与照片写入独立验收，不使用合成二维码截图。

R1拒绝专项：SourceUITests-1793188641051.xcresult，1通过/0失败，75.588秒；实际系统弹窗为添加照片且目的说明正确，拒绝后显示未保存，QR保持、取消/重启不产生账号。原有照片6张、自建前缀QR为0，拒绝后数量均不变。R2允许专项SourceUITests-1793189014336.xcresult失败：测试未匹配实际中文“允许”按钮，未提交Photos写入；原生/产品源码未为此放宽，修正测试中文/英文按钮匹配并补系统请求添加语义断言，最终轮另记。R3允许专项SourceUITests-1793189248705.xcresult失败：预期首次权限弹窗未出现，运行早期另有系统中断被处理；随后只读核对自建QR前缀确实新增1张423×423 PNG，但不计专项通过。新增首次弹窗/按钮缺失即退出的测试保护；最终轮前终止应用并重置仅添加权限。R1/R2/R3保留为中间证据，不冒充最终同源候选。

实际同机酷狗扫一扫识别/确认、账号持久化、物理iPhone权限/相册差异、真实存储故障/低空间和签名/动效仍未验。没有私人凭据或个人歌单，不报F30或全项目完成百分比。

## 最终同源验收

| 运行 | 精确结果 | 实际结果 |
|---|---|---|
| R5允许 | SourceUITests-1793190106810.xcresult | 1通过/0失败，77.707秒；实际添加照片弹窗、同意、已保存、Home后activate返回仍保留同一QR、取消/重启无账号 |
| R6拒绝 | SourceUITests-1793190295260.xcresult | 1通过/0失败，74.624秒；实际拒绝后未保存且QR仍在、取消/重启无账号 |

两轮源码digest均为62bec45a5c34b53d02cb4217a3896c32a9f12429e5ad051fcef426e97b3151b1，源码前后/current、candidate patch、外部输入、安装包/JS/原生来源校验保持；13张真实截图均ready并亲看。两轮19条记录数量保持，仅queue.cursor.v1/library.v1/playbackStats.v1随真实播放更新，两原音频SHA保持。结果、来源、实际照片与只读TCC摘要位于各自本机build/kugou-qr-photo-{save,denied}-live-20261028-r{5,6}/；不提交QR原图或原始系统资料。

R5开始8张照片/自建QR2张，结束9/3；自建新增PNG实际423×423、1036字节，并亲看确认完整二维码。TCC仅kTCCServicePhotosAdd=2，无Photos读取授权行。R6开始/结束均9/3，addOnly拒绝值0，无读取授权行。不枚举/打开其他原有照片。R3/R4生成的自建QA副本保留在本机模拟器，取消登录不删除用户副本。

R4已实际写入PNG，但后台测试使用launch()明确终止旧进程，导致QR不存在而失败（66.116秒）；改为activate()复测，仅修测试，不把重启误作前后台切换。R1–R4均为中间记录，不代替最终候选。

新增照片路径为音枢自身能力，没有同态Sollin照片基准，不编造visual-lab相似度；正式240pt QR/44pt点击区域、按钮/保存状态完整可见。长卡片底部状态需正常滚动；小屏、动态字体/VoiceOver、动效及真实外部App扫描仍待独立验收。

`npm run test:native`全套退出0，原生播放/脚本/存储/网络等回归通过；既有Swift Sendable警告保留，不把受控原生样本作为真实音源UI证据。Info.plist语法、新增文档链接及diff空白检查通过。磁盘审计剩余约4.5GiB，当前缓存及证据保留；旧诊断ZIP缺有效目录，不能证明完整副本，未盲删，回执build/logs/cleanup-20261028-kugou-qr-photo-audit.json。
