# Mac、Xcode 与 iOS 27 开发路径

日期：2026-10-14。当前未连接用户Mac/iPhone，没有执行任何环境升级、签名或安装。

## 已知与未核实

用户报告：2019年15寸Intel MacBook Pro，系统大约macOS15.7.4；iPhone15ProMax，iOS27.0。年份/尺寸/系统仍需实机核实。

Apple当前兼容名单包括2019年16寸MBP，但不包括2019年15寸。Xcode27当前要求macOSTahoe26.6或以上。因此不能预设这台15寸设备能按官方路径安装Xcode27。

官方资料：[Tahoe兼容名单](https://support.apple.com/en-la/122867)、[Xcode SDK与系统要求](https://developer.apple.com/xcode/system-requirements)。这些信息可能变化，后续实际检查时重新核对。

## 这不等于不能开发iOS27可运行的App

必须分开四个问题：

| 问题 | 判断 |
| --- | --- |
| 在旧Mac上写/维护代码 | 可以，按所选Node和编辑工具兼容性检查 |
| 用可安装Xcode编译所选依赖 | 需要验证RN/Expo/播放器/Pods最低工具链，不是仅看手机系统 |
| 旧SDK编译的IPA在iOS27安装和运行 | 普通功能通常可以向前运行，但本项目未验证；签名、依赖和系统变化仍可能影响 |
| 使用iOS27新API/匹配完整新SDK与调试 | 需要适当SDK与工具链；旧系统不自动具备这些能力 |

Xcode SDK、deployment target、设备运行系统与device support不是同一版本概念。不能因为最低iOS设为16/17就证明旧Xcode支持所有新依赖；也不能因为手机运行27就断言只有Xcode27才能生成任何可运行IPA。

SwiftUI/UIKit、Flutter和RN最终都需要Xcode构建iOS原生二进制。选择Flutter或降级RN并不能绕过Apple工具链。

## 第一步：只读盘点

在Mac终端执行并记录输出，不需要升级系统：

```sh
sw_vers
sysctl -n hw.model
uname -m
xcode-select -p
xcodebuild -version
xcrun --sdk iphoneos --show-sdk-version
git --version
node --version
```

某些命令未安装时失败是盘点结果，不要求立刻执行安装。确认完整Xcode而不是仅Command Line Tools；确认剩余磁盘、可用内存以及手机能否被工具识别。不要收集序列号或AppleID作为环境报告。

## 三种候选路径

### A：本机兼容工具链

选择本机官方支持的Xcode与可构建的依赖组合，先做Release最小包。验证IPA安装到iOS27、网络、脚本宿主、音频、锁屏；再验证device debugging。

优点：本地迭代直接。限制：参考CyMusic最新研究提交所用Xcode26.6/高版本依赖可能超出本机系统；不能直接复制锁文件后宣称可用。不要为追求本机运行任意降级所有依赖，应有固定版本验证记录。

### B：本机编辑 + 远程/云Mac构建

保持兼容现代依赖的macOS/Xcode，在远程CI或Mac构建unsignedIPA；下载后用自己的有效方式签名并安装到iPhone。

优点：无需先换电脑即可开始。限制：不等同本地实时调试，后台/耳机等只能在物理手机观察，诊断与每次IPA迭代会更慢。CI可构建不代表真实设备通过，也不能保证特定云服务永远免费。

只发布unsigned构建不要求CI持有AppleID/开发证书。若后续引入签名流水线，单独设计凭据保管，不把私钥和密码提交仓库。

### C：具备官方支持的新开发机

如果A不可行、B迭代成本无法接受，再考虑受支持AppleSiliconMac。不是当前开始方案工作的前置购买要求。不默认使用非官方系统升级补丁来解决工具链。

## Mac本地工作目录

Windows当前Z盘是网络映射。Mac请使用本地SSD的独立clone，例如：

```sh
mkdir -p "$HOME/Developer"
git clone https://github.com/RhsR1024/nexus-music.git "$HOME/Developer/nexus-music"
cd "$HOME/Developer/nexus-music"
```

当前仓库只有文档，不要期待npminstall或podinstall已有目标。应用工程建立后按最终记录安装工具；不共享Windowsnode_modules、Pods、派生缓存和正在使用的Git工作目录。

Windows网络盘的Git可能因SMBUID映射报ownership错误。本轮使用精确仓库路径的单次`git -c safe.directory=...`处理，没有关闭全局检查或设置通配符信任。Mac本地clone通常不需要此例外。

## 免费自签

免费PersonalTeam描述文件通常7天到期，并有安装数量/AppID等限制。SideStore/AltStore可减少手动刷新，但不保证永久无人维护。普通音乐后台能力不因自签天然不可用；特定entitlement/扩展需实际签名验证。

初期只要求普通主应用、音频后台与基本文件导入。小组件、AppGroup、推送等不作为未验证的免费账号保证；不为了继承参考工程把无用entitlement全部带入。

资料：[Apple免费账户约束](https://developer.apple.com/cn/help/account/basics/about-your-developer-account)、[SideStore当前前置条件](https://docs.sidestore.io/docs/installation/prerequisites)、[AltStore刷新](https://faq.altstore.io/altstore-classic/your-altstore)。

## 环境验收记录模板

| 项目 | 待填结果 |
| --- | --- |
| Mac具体型号/CPU/系统 | 未检查 |
| Xcode/SDK | 未检查 |
| Node/包管理器/Ruby/Pods | 尚未锁定 |
| 本机是否可构建候选依赖 | 未验证 |
| 是否使用远程构建 | 未选择 |
| IPA在目标手机安装/启动 | 未验证 |
| 实际播放/锁屏/下一首/耳机 | 未验证 |
| 免费签名刷新和数据保留 | 未验证 |

更新本表时保留版本和证据；不得因为机型支持表推测上述项目已通过。
