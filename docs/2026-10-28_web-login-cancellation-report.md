# 网页登录保存阶段的取消边界

本批修复网易云/QQ 网页登录在保存阶段过早成功、取消不能传入账号存储的问题。资料验证、协调器身份哈希和账号保存归入同一授权尝试，保存完成后才发布成功。**这些持久化竞态由受控异步测试验证，不等于真实账号授权或真实 Keychain 故障验收**。

## 证据与实现

| Evidence | Finding | Path |
| --- | --- | --- |
| 修改前 `baseline-races.log`：原9项通过，新增11项失败 | 流程在资料返回后结束 waiting；外部身份哈希、存储内部哈希和写入均在授权流程之外。保存失败也可能留下 succeeded 状态 | 将身份哈希与 `MusicAccounts.save` 放入原授权 launcher，共用其控制器 |
| `targeted.log`：38/38 | 两平台在身份哈希、存储哈希、秘密写入、元数据写入等待点取消，都回滚旧账号/秘密；替换尝试只保存最新结果，保存失败脱敏并进入 failed | 把同一 AbortSignal 传入已实现的可取消账号存储；不再独立维护重复的代次计数 |
| `check.log`：688/688 | 既有账号、酷狗及其他业务检查通过 | 不改变 Cookie 子集、资料协议、身份格式、能力声明或播放器/队列边界 |

正式按钮在整个授权尝试期间保持可取消；原生窗口的按尝试 ID 清理和迟到结果隔离保留。成功只在存储提交后发布，取消/替换通过原 MusicAuthFlow 清理同一控制器。错误不透传存储异常或私人会话内容。

本批为音枢自己的流程修复，未采纳新的 Sollin 结论、接口或 UI 常量。沿用固定来源和已有脱敏资料，APK `--review` 仅核对既有安装 case 前置条件，不作为功能证据；不新增 Sollin 采集。

## 正常入口回归

真实音频库上下文的 Release 回归 1/0/0、78.831 秒通过：`build/SourceUITests-1793147695374.xcresult`，索引 `build/web-login-cancel-live-20261028-r1/`。正常设置入口、QQ 官方空表单、取消/重开/重启和网易云入口通过，沿用已有[场景](ui-spec/qq-web-login-live-2026-10-28.md)，没有制作持久化成功或私人账号截图。

五张实际 PNG 均来源校验 ready 并亲看；源码前后摘要均为 `d6e0524e83fcf9e466228a6a14d5c66ad0307486024a381b4f673c5bcd3b6846`，输入不变，19条记录与两份原音频摘要保持。专用模拟器已关闭、数据保留。真实网页按钮的既有字形问题仍未修复，不增加账号UI或动效完成量。

测试使用 V261020 此前取得的公开 Shape of You 原始 MP3，并检查原两份音频和19条记录；不重新测试私人账号、不读个人歌单。保存阶段真实端到端、完整账号授权/会话失效、真机签名及 QQ 网页字形兼容仍未验收，不能用匿名入口或桩响应代替。

## 复验

仓库根先执行 `source scripts/environment.sh`，然后：

```bash
node --experimental-strip-types --test tests/music-web-login.test.ts tests/music-accounts.test.ts tests/kugou-login.test.mjs
npm run check
```

正常入口必须使用专用真实音频模拟器及全新输出目录：

```bash
NEXUS_SIMULATOR_ID=A8347A1F-0805-4731-B8CE-3FE48C156AC0 \
NEXUS_UI_RUN_DIR=build/web-login-cancel-live-20261028-r1 \
NEXUS_UI_LOCAL_AUDIO='/Users/ningli/WorkSpace/NexusMusic/build/local-sort-live-20261025/Shape of You - Ed Sheeran.mp3' \
node scripts/test-ui.mjs NexusMusicUITests/SourceSettingsTests/testLiveQQWebLogin
```

复跑时更换输出目录，不覆盖 manifest；截图、构建与输入哈希按既有工作流绑定。没有新的布局或材质改动，不增加 Sollin 静态/动效完成量。
