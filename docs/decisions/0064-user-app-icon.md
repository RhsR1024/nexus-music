# 0064 使用用户提供的音枢图标

2026-10-18用户明确要求替换图标，取代[0022临时漫途图标](0022-temporary-app-icon.md)。仅使用本次用户提供的红底白色音符/星环图，不引入图像生成或其他参考资产，不对其原创性/权利来源作额外声明。

输入为1254×1254无alpha PNG，SHA256 `1ca283a623ed8e010ef43ad432a2c10cc27706734fad833832d7a4bf0cfd476c`。去除16像素外侧边距，裁切框(16,16,1238,1238)，仅将每行红色主体边缘之外的白边/预制圆角用邻近红色延展；内部白色图案保留。Lanczos缩放为1024×1024 RGB不透明PNG，由iOS系统施加圆角。处理后主体与系统裁切预览已亲看。

`assets/app-icon.png`与维护中的`ios/app/Images.xcassets/AppIcon.appiconset/App-Icon-1024x1024@1x.png`字节相同，SHA256 `779d8668a6a2dc4c6a64334eb7b0e4607356c897d25ff8580da6fcf4f3d0768d`。app.json继续指向该配置资产，无prebuild、原生工程覆盖或新依赖。Android adaptive icon未验收。最终资源编译和归档以[构建记录](../BUILD_STATUS.md)实际回执为准。

2026-10-18最终补验：Release构建已安装到既有iPhone模拟器，SpringBoard新红色图标显示正确、无外侧白边或安装进度遮罩；截图`build/user-icon-springboard-final.png`已亲看。此为模拟器桌面图标验证，非手机/签名验收。
