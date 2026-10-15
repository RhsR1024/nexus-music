# 0017：设备媒体库

2026-10-16，S6/F23。固定参考版本延续REFERENCE_COMPARISON。对悦音/Cy/Q/wtf的Swift/ObjC/TS/配置范围检索MPMediaQuery、MPMediaLibrary、ipod-library，未找到可直接采纳的实现，不推导整仓都无此能力。Cy文件导入只证明文件管线；Wayferar的Android媒体/文件权限与Sollin Electron目录扫描均不适用于iOS。使用本机SDK MediaPlayer头文件的公开API原创实现，不复制播放器或依赖。

- 仅用户点击后请求MPMediaLibrary授权，NSAppleMusicUsageDescription同步维护工程与app.json；拒绝/受限制时清空浏览快照并显示系统设置入口。
- device来源与文件local分离。UInt64 persistentID用十进制字符串跨桥；增加本机私有namespace，备份中的另一设备引用不能误播本机相同数字ID。元数据签名防止库变更后旧条目指向不同内容。
- 原生快照分页，有变更时失效；不在JS保存assetURL。每次播放重新按ID查询并检查授权、保护状态及本地assetURL；云端未下载/DRM明确降级，不尝试下载Apple Music或解密。
- ipod-library只在显式deviceMedia解析结果放行，仍使用唯一AVPlayer/队列。无设备音乐时不能声称真实媒体库播放已验收。
- 封面使用现有有界缩略图缓存，共享串行队列和清理代次；不额外引入无清理入口的缓存。未来Android替换授权/查询/URI接口，TS身份与分页状态可共享。
