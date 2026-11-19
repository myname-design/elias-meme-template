# 第三方依赖与素材许可

根目录 [LICENSE](LICENSE) 中的 MIT License 适用于本项目代码及文档，不替代下列内容的原有权利和许可。

## 依赖

第三方依赖（包括 MCP SDK、MCP Apps SDK、Express、Zod 及其传递依赖）保留各自包中的 LICENSE、版权和声明。依赖版本由 `package-lock.json` 锁定；npm 安装不会移除这些文件。

`scripts/build.ts` 保留打包脚本的法律注释，收集参与 UI 打包的包许可证，输出 `dist/ui/THIRD_PARTY_NOTICES.txt` 并将全文嵌入 `dist/ui/meme.html`。Docker 运行镜像保留生产依赖的许可证、UI 声明、本项目 LICENSE 和本文件。再次分发构建产物时请一并保留。

## 表情包素材

生产图库默认为空，没有附带第三方角色截图。用户添加的图片需有上传、展示及再分发权，并填写真实来源、作者、许可和署名；代码的 MIT License 不自动授予这些图片的权利。

memecub 图片仅以远程搜索结果提供，保留上游许可与来源，不作为模板文件打包。公开可访问不等于公共领域。

测试用纯色 JPEG/PNG 由程序生成；极小 GIF 仅用于格式测试，不含角色图像。`tests/fixtures.ts` 的作者、链接及许可字段均为模拟数据，不是任何真实图片的授权证明。自定义测试条目仅在测试进程中安装，临时文件在结束后清理。
