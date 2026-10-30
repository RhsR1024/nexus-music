# 2026-10-30 本地结果包轮换回执

执行前无Xcode构建/下载进程，专用模拟器已关闭。按BUILDING的临时产物7天及最新阶段保留规则，逐包复核成功计数、年龄、文档引用和文件树摘要后轮换下列历史成功包；摘要与逐文件哈希保留在忽略目录build/song-download-entry-20261030/retention。失败包、故障视频、当前增量缓存、最新真实音源阶段及全部reverse-skill材料均保留。

旧报告中的下列xcresult路径仅为历史运行标识，完整原包现已轮换，不能继续声称可直接读取；已导出的截图/规格未清理。

| 历史包 | 字节 | 通过 | 文件树SHA256 |
|---|---:|---:|---|
| `build/SourceUITests-1792558105795.xcresult` | 45600511 | 2 | `6b14e4ccad60ee60e1dfdceb4ead1331f8c24133a76d970b3749592e5149b321` |
| `build/SourceUITests-1792517659767.xcresult` | 45489180 | 1 | `b7bd5a4de7b485bf528695d718e08f243310ff005d7695f57a4489577025cb2c` |
| `build/SourceUITests-1792553034662.xcresult` | 44172888 | 2 | `1997aa72eacf225e940ff2ec10362fb3b2a61eaf15dfc2662131839f9fa15fbb` |
| `build/SourceUITests-1792555432345.xcresult` | 44079421 | 2 | `3690df8cca86fee52ecde48fe1dc1ac3be40fe24cd0f0dac902e7f4fff9fcca8` |
| `build/SourceUITests-1792511494373.xcresult` | 43698411 | 1 | `f74c2bb93ffe494eefb21cad1f2407b00a8c2fccd2ca8b9637b7107473447726` |
| `build/SourceUITests-1792507578198.xcresult` | 43335830 | 1 | `c904252d2c5398a716a6dfc8ddc2484ae92a33720695cd7dfdd559c1917858bc` |
| `build/SourceUITests-1792551604239.xcresult` | 43145512 | 1 | `f6bf64dddfa0721806b0e59729e608a65b0fc3e97308311511a85964905e4b27` |
| `build/SourceUITests-1792648258641.xcresult` | 42495458 | 1 | `c4c51e5e61ede17bbd27398965ce707ffea6955eaa671fe146adec4a0bb4fa52` |
| `build/SourceUITests-1792633728747.xcresult` | 42470549 | 1 | `ebefef5c246b831865d053b5f7c28a5a07c736d29fdfc3faa8bee37e4301d341` |
| `build/SourceUITests-1792649636130.xcresult` | 42439597 | 1 | `de8220123646bd3db10c9c65e9dd0ea59fa58aae4af9766a509e70b748f05586` |
| `build/SourceUITests-1792652840652.xcresult` | 41277029 | 1 | `fae816ba0659995900e649d189033355555aed0805f387e1ee2d3cf4f8d5a68a` |
| `build/SourceUITests-1792632698125.xcresult` | 40877684 | 1 | `097c21e081c0e0c2db26c7aecfbc18297408906dc5e16c8ad887715ef4a732ee` |
| `build/SourceUITests-1792651104030.xcresult` | 40799918 | 1 | `d322c506a45fca573b92f7c65522e5c7ded67874b08102fb2ba0dead900a6bc8` |
| `build/SourceUITests-1792625479045.xcresult` | 40748279 | 1 | `56826c8d0d64987fcf9c290e1e6aee1c2152c29add149198cb85173c812cefb3` |
| `build/SourceUITests-1792644030675.xcresult` | 40745232 | 1 | `e3255ffc5dc574fa25454db8050ce948bcc3d02f3250fbae4794984ceb04a3c9` |
| `build/SourceUITests-1792645071947.xcresult` | 40672227 | 1 | `8b2f13cd6e3330732566d4fbd5b2b1893b88cc8c7a769ae891c6e7a343459783` |
| `build/SourceUITests-1792646321230.xcresult` | 40643352 | 1 | `f3d2efc1a91f8bd10166de11578950998b46efa3eb2d95796e3c6a85f210ffb7` |
| `build/SourceUITests-1792680863864.xcresult` | 39665132 | 1 | `a2e51fd064debc31e4c6a54d0d4ee1cfd53a88fd36adbd7065609bd5c055dba6` |
| `build/SourceUITests-1792681893607.xcresult` | 39608835 | 1 | `33c181c5eb795309feb287a6b5f9cef3bdbb3e2cbd323d0af78188c4a323285c` |

另移除已损坏、无仓库路径引用且超过7天的临时下载`build/ci-38878989928/diagnostics.zip`，216154112字节，SHA256 `8c76555654aa616714589a264f84f56a9218829a2010755391bae492ab33f418`；无有效ZIP目录，不能作为原始证据。

合计轮换1018119157字节。未清理其他项目、系统工具链、原音频或外置SSD内容。
