# 0046 主题与背景设置原生弹层

2026-10-18。依据[专项报告](../2026-10-18_reverse-sollin-theme-background-report.md) E020/F019/P019及E009共用模态链，采纳前严格review20E/19F/19P、7WI/33事件，零错误/警告。只调整现有主题与背景设置的呈现；调色器完整选项、默认值、参考几何和运行效果继续待核。

## 五参考比较

五个固定HEAD本批逐一核对；完整来源和许可见[参考比较](../REFERENCE_COMPARISON.md)。

| 固定参考 | 本批亲读实现与取舍 | 维护、Android及许可 |
| --- | --- | --- |
| 悦音d6f1af7 | src/core/config/theme.ts:9–33校验三态、缓存及180ms防抖；沿音枢原子偏好保存，不采用延迟写入 | Expo54接近基线；根MIT及资源边界保留，Android系统主题另验 |
| Q547ccfe | ImageBackground.tsx:52–96将图像绝对铺底并叠加子视图；沿音枢已有VisualSettings和原生图片处理 | RN0.73尺寸补丁不引入；仓库Apache2，该文件Meta MIT头单独保留；Android图片解码另验 |
| wtf6624ab5 | 同路径ImageBackground.tsx:52–96相同职责；不复制旧RN包装或预加载缓存 | 旧RN维护成本、Apache2与Meta MIT文件头分开；Android权限/背景另验 |
| Cybf0d469 | usePlayerBackground.tsx:20–115区分iOS背景/Android dominant、URI身份守卫、50项缓存与亮度约束 | 不引入Expo57/RNTP/image-colors；Apache2及原生模块许可分别处理；平台取色不能混同 |
| 自有Wayferar8e47cdc | HomeCardTheme.java:44–87保存/恢复旧背景、浅色前景与歌词配色边界；保留音枢各背景职责 | Android View/Drawable及车机恢复不搬到iOS；自有改动与第三方/反编译边界保留 |

## 实施与验收边界

复用现有SettingsScreen单一SheetModal，加入background角色、稳定ID、关闭/系统下滑、分类滚动与底层AX隔离；现有VisualSettings的Files导入/移除、原子偏好、图片回退和独立全局/播放动效保持。无新依赖、参考源码/资产或原生补丁。

测试须在关闭弹层后检查全局实际像素和底栏导航；弹层内检查设置值/真实Files导入和重启。最大辅助字号覆盖长内容滚动、显式/下滑关闭、重开与分类位置。业务检查、正式入口App专项、清洁unsigned归档及对应云端iOS27分别记录，真实服务/签名/手机另验。

已实施，348业务/类型通过；首轮四项通过后截图暴露大字号裁切/越界，修为minHeight预览、窄屏/大字纵排和44点触控。最终Files图片专项102.911秒通过；大字首轮查询父子同名失败保留，firstMatch限定后86.835秒通过，预览与控件几何/实际值修改恢复/关闭下滑/分类位置/重启断言保留，最终截图已亲看。清洁归档/push/云端iOS27及参考完整运行/真实服务/签名/手机继续。
