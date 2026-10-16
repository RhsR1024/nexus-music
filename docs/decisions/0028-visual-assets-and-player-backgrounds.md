# 0028 本机外观图片与播放背景

日期：2026-10-16，S3/F25–27/J45–50增量。保留一个播放器；图片设置不得调用播放、换队列或修改歌曲来源。

## 五参考与采纳

固定提交沿REFERENCE_COMPARISON，不引入参考图片或依赖。

| 项目 | 亲读证据 | 结论/维护与Android边界 |
| --- | --- | --- |
| 悦音d6f1af7 | src/core/config/theme.ts:1–40，themeModeCache/180ms保存 | 只参考外观状态职责，音枢保留串行原子PreferenceStore，不采用吞掉失败的保存；未发现独立写真资产仓储，不推断已有 |
| Q547ccfe | src/theme/themes/createThemes.js:15–19等bg-image/position/size | 参考主题背景字段，不复制其打包背景、主题生成器或Android路径；原创本机内容地址资产 |
| wtf6624ab | src/components/common/ImageBackground.tsx:52–93，src/screens/Home/Views/Setting/settings/Theme/IsDynamicBg.tsx | 参考图片与子内容分层/动态开关；不复制Meta派生组件，使用已依赖RN Image/Animated；两端手势与图像解码分别验证 |
| Cybf0d46 | src/hooks/usePlayerBackground.tsx:1–122，50项有界缓存、过期图片保护/白色控件亮度约束 | 采纳有界/身份保护原则，原生ImageIO小缩略图取色；不引入react-native-image-colors及新版RNTP/Expo |
| Wayferar8e47cdc | docs/SETTINGS_POLISH.md:9–23，HomeCardTheme浅深色文字/背景边界 | 参考可读性和主题不改用户歌词颜色，Android Activity重建/画布不移植iOS |

Sollin c9d446f补充：PlayerBackdrop/ttmlLyrics与uiStore分离外观/歌词；桌面WebGL/DOM/任意磁盘路径不移植。iOS图片处理原创CoreGraphics/ImageIO；将来Android需对应受限解码器，不宣称本批已支持。

## 资产/状态与错误边界

- 用户从系统Files选择主题背景或写真；复制后再解码，最大20MiB/单边32768/总像素1亿，缩略图最长1920，重新编码为JPEG以去除EXIF/定位等原始元数据。不是联网歌手写真库，不上传用户图片。
- visualAssets.v1保存两个槽位的内容SHA256标识/显示名/尺寸；不持久化临时容器路径。原生按ID解析专用目录，拒绝符号链接/路径穿越。新图文件先原子写，SQLite发布成功才清旧资产；失败保持旧槽位/设置，启动回收未引用文件。图片不混入音乐库JSON备份。
- 主题图片/透明度与写真分开；图片删除/缺失明确回退既有背景。封面取色、背景模糊/暗度/动效开关及封面圆角在同一PreferenceStore原子保存，旧偏好使用默认值，坏范围拒绝。
- 取色仅在图片变化时用有界原生缩略图采样；本地缓存/迟到封面按身份验证。动态背景只用原生Animated变换，暂停/缓冲/后台/减少动态效果停止，无React逐帧图片或歌词列表更新。
- 主界面保留语义色和覆盖层，播放背景始终确保白色控制/歌词可读；设置页提供即时预览，导入/删除/失败与重启通过真实Files/App流程验收。

## 验证

图片格式/超限/坏图/符号链接/元数据剥离/缩略尺寸/取色原生契约；两槽共享文件/替换失败/重启与清理/过期结果业务检查；实际Files导入与两皮肤/暂停/重启回归，本地IPA与云端iOS27。真机耗电/帧率/大字保留实测门槛，不由编译成功替代。
