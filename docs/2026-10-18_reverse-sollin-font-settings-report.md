# Sollin 字体角色与歌词显示模态边界

2026-10-18，普通移动逆向，flavor=null。只采纳现有能力的呈现与角色边界，完整参考选项/默认值/运行未恢复。

## 范围与复现

reverse-skill固定cab634bd855fc287f6e420c1f36fd1a6b9245960；原生master-route输出ipa-lyric-settings/route-scope.md，PRIMARY mobile-reverse。复用已授权本机离线scope，case-guard和项目门禁通过，无目标网络或App运行。IPA SHA256 c2ee2deba236ef1b9e097e1d8cdc0b816137aa57cf85d4c8e2811dae9924bc07；成员App.framework/App SHA256 640c6112584c017b45141a038f7aa975224c8b540ef1aaec1f40939a6aa5c84d。arm64本批VA对应slice偏移，FAT原文件另加0x4000。

索引Python3.12.14及cstool5.0.3限定解码，Blutter0039efb1/Dart3.12.2的NO_CODE_ANALYSIS骨架只归属地址。notes/lyric-settings-probe.py与lyric-settings-evidence.py分别解码及独立核对原始BL、ADD/LDR池偏移、2057条指令原始字节和分配头/模式字段；不可变收据拒绝覆盖。原始样本/输出/字符串仅留忽略work目录，未复制进产品。

## Evidence→Finding→Path

E019 evidence/lyric-settings-evidence.json，SHA256 8d08b38a78b4e6aa34cf47f690b3605af6ce1baaa9b5c6c644f3c0a188683090，观察02:57:22。F018 info/design、candidate/high；P018沿现有入口→区分角色/显示模态→音枢原创控件→独立验收。采纳前严格review19E/18F/18P、7WI/31事件，零错误/警告。

| 原始位置 | 确认与边界 |
| --- | --- |
| 0x3a5324、0x3a5e0c→0x330370 | 两包装直接调用E009已验证的共用模态；display工厂pool47ff0为独立Sheet，font工厂pool48058进入0x3a5e28 |
| 0x3a5dd4、0x3a5e3c/4c | 模式从闭包字段传入分配class4670的widget field0xf，不只是名称相似 |
| 0x4628a8/b0、0x464188/18c | build和选择均读取field0xf；选择分支分别调用0x4634d8歌词setter及0x4633a8全局setter |
| 0x462a14/20、0x462a74/80 | 原始ADD/LDR地址计算对应全局/歌词标签与继承/覆盖说明；不能将说明当作运行或保存失败语义 |
| 0x469f10→0x469960 | 显示设置更新闭包调用自身notifier；完整字段默认值/范围/选项继续待核 |

原始scope/workitems/timeline和E019留本机work/sollin-ipa；timeline31记录本批静态核验。没有推断内置字体可用性、完整繁简/字重等选项或参考有效恢复值。

```mermaid
flowchart LR
  A[原始模式字段与BL] --> B[全局或歌词字体角色]
  C[独立显示包装] --> D[歌词显示设置]
  B --> E[原创单一原生Sheet]
  D --> E
  E --> F[原子字体与偏好仓储]
  F --> G[本地及对应云端独立验收]
```

## 原创实施与验收

五参考实现、维护/Android/许可和取舍见[0045](decisions/0045-font-display-settings-sheets.md)。本批保留字体导入/删除/回退、歌词继承/系统/自定义、全部现有显示样式、唯一播放控制器与八布局；没有新依赖/参考资产移植。348业务/类型检查通过；正式入口`SourceUITests-1792263616441.xcresult`三项通过、零失败/跳过：最大辅助字号/三角色/关闭下滑/分类滚动73.984秒，字体真实Files导入/全局与歌词继承系统选择/居中模糊重启/八布局实音PCM/播放器内角色入口/删除回退344.580秒，分组导航与草稿/滚动保留109.934秒。已亲看三种大字Sheet与导入原创三角字体截图；大字长内容仍需滚动，关闭与操作可达。本轮鉴权8次成功、0失败，无新stream请求，允许既有临时音频缓存，不能称本次冷下载。未修改原生音频/脚本后端，无新依赖；清洁归档/push/对应iOS27继续，真实服务/签名/手机及完整参考运行等价仍待。使用docs-generator报告结构和diagram-generator生成关系图；本机render_diagram.py已运行，因缺mmdc返回明确错误，未安装工具。图保留可编辑Mermaid源码，未声称已生成渲染产物。
