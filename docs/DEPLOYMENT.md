# 部署参数与 Docker

零基础 Render 操作见 [README](../README.md#3-在-render-部署自己的服务)。使用自己的 Fork/Template 仓库和自己的 Render 账号，无需原作者账号、API Key、OAuth Secret 或部署密钥。此文档不会自动创建或更新线上服务。

## Render

根目录 [render.yaml](../render.yaml) 只声明一个 Free Node Web Service，未绑定仓库 URL、原作者服务 ID、自定义域名、数据库或磁盘。创建 Blueprint 时选择自己的仓库。若服务名被占用，使用可用名称及平台实际分配的 URL。

| 项目 | 值 |
| --- | --- |
| 仓库 / 分支 | 你复制后的仓库 / `main` |
| Runtime / Plan | Node / Free；如没有 Free 则停止，不自动选付费计划 |
| Build | `npm ci --include=dev && npm run build && npm prune --omit=dev` |
| Start | `npm start` |
| Health | `/healthz` |
| Auto deploy | Off |
| 环境 | `NODE_VERSION=24.22.1`、`NODE_ENV=production`、`HOST=0.0.0.0` |
| PORT | Render 注入的值 |
| 公网地址 | 默认使用 Render 注入的 `RENDER_EXTERNAL_URL`；自定义域名用 `PUBLIC_ORIGIN=https://实际域名` |

`PUBLIC_ORIGIN` 优先于 `RENDER_EXTERNAL_URL`，不能带路径、凭证、查询串或片段。不要填作者的地址，也不要填 `/mcp`；错误 origin 会影响 Host 校验、图片 URL 和 UI CSP。`.env.example` 是本地示例，不需要在 Render 上传 `.env`。

应用 Blueprint 会触发首次部署，即使 `autoDeploy: false`。后续代码修改需在自己的 Render 面板手动部署最新提交。不要把模板套用到已有的无关生产服务。

Free 服务可能休眠，冷启动可能使 MCP 连接超时；当前免费额度和可用性以 Render 为准。项目按单实例内存缓存设计，重启后 memecub 选择缓存丢失，但上游额度不会重置。

## Docker

安装并启动 Docker，在仓库根目录运行：

```sh
docker build -t elias-meme:local .
docker run --rm --name elias-meme-local \
  -p 127.0.0.1:3000:3000 \
  -e PUBLIC_ORIGIN=https://memes.example.com \
  elias-meme:local
```

将 `https://memes.example.com` 换成自己的 HTTPS origin。这只是运行参数，**不会创建证书、域名或 HTTPS 代理**；本机检查可另开终端访问 `http://127.0.0.1:3000/healthz`。公开服务需由你控制的 HTTPS 反向代理或平台转发到容器 3000 端口，并保留正确的 Host。不要直接向公网开放无 TLS 的 3000 端口作为 ChatGPT 入口。

镜像使用 Node 24、多阶段构建、非 root 用户及 `/healthz` 健康检查；包含 `public/memes/`、编译服务、内联 UI 和许可声明。修改图库后重新构建镜像再重建容器。停止上述临时容器可在另一终端运行 `docker stop elias-meme-local`。

如果企业网络代理导致 `SELF_SIGNED_CERT_IN_CHAIN`，应向运行环境配置受信任 CA，或用临时 Dockerfile 通过 BuildKit secret 挂载 CA。不要关闭 TLS 校验，不要把公司 CA/私人凭证提交到模板中。本次 Docker 实测范围见 [模板验证报告](TEMPLATE_REPORT.md)。

## 连接与验收

- 健康检查：`https://实际域名/healthz` 返回 `status: ok`。
- MCP URL：`https://实际域名/mcp`；传输 Streamable HTTP；认证 No authentication。
- 工具发现应恰有 `search_memes`、`show_meme`；默认空图库搜“开心”会回退 memecub；添加自己的图片后再用配置的关键词和 ID 验证自定义展示。
- 图片静态地址应为同一 HTTPS origin 下 `/memes/文件名`，返回正确图片类型；点击 UI 的 ⓘ 应能展开来源与版权。
- 如需真实备用搜索，使用未命中自定义图库的词，会消耗 memecub 匿名额度；默认测试全部模拟上游。
- `/mcp` 的 GET/DELETE 返回 405 属正常行为。服务无会话，不支持旧版 SSE 客户端。

实际 ChatGPT 可用性取决于账号、管理员策略、版本和 MCP Apps 支持。必须在目标客户端分别确认工具调用、图片展示、GIF 动画及来源展开；模拟宿主测试不能代替这些验收。无认证公网服务不适合私人图库，也不提供账号隔离。
