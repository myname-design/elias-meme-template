# Elias Meme

一个可以自己部署的中文表情包 MCP 服务。你在支持自定义 MCP 的聊天客户端里说“找一张坏笑表情包”，客户端就能搜索图片，再通过 MCP Apps 组件展示图片。

**自定义图库优先、memecub 备用；无需 OpenAI API Key、memecub API Key 或作者的账号。** 服务只提供搜索和展示，不提供图片生成、上传、删除等工具。

> 不同 ChatGPT 账号、套餐、工作区策略、客户端版本对自定义 MCP 和 MCP Apps UI 的支持不同。能调用工具不等于能显示内嵌图片；本项目不承诺所有用户都能连接。浏览器自动化使用模拟宿主，尚未验证真实 ChatGPT 网页、iOS、Android 的展示效果。

## 1. 功能展示

模板默认不内置图片。连接服务后可以输入：

> 使用 Elias Meme 搜索“开心”，然后显示第一张结果。

空图库会回退 memecub，实际结果和免费额度以上游为准；无结果时应换词或稍后再试。添加自己有权公开使用的图片后，命中的自定义图库优先，不请求上游。支持 MCP Apps 的客户端显示图片卡片，点击 **ⓘ** 查看来源与版权；GIF 保留原始 URL。

| 工具 | 输入 | 输出与行为 |
| --- | --- | --- |
| `search_memes` | 必填 `query`（1–80 字符）；`limit` 为 1–10，默认 5；可选 `kind` 为 `meme` / `gif`；`commercial_only` 默认 false | 返回 `memes` 数组，包含 ID、图片 URL、标题、来源与许可。先筛选自定义图库，无命中才查询 memecub |
| `show_meme` | 必填搜索返回的 `id`，或已添加的自定义 ID | 返回 `structuredContent.meme`，并关联 MCP Apps 图片组件 |

多关键词用空格分隔，**全部匹配**才命中自定义图库；英文不区分大小写。例如为自己的图片配置“快乐”和“happy”后，可以查询“快乐 HAPPY”。`kind` 和 `commercial_only` 先筛选再返回；筛选后没有自定义结果也会回退 memecub。

## 2. 复制到自己的 GitHub 账号

准备自己的 GitHub 账号和 Render 账号。下面两种复制方式任选其一，均在你的账号下产生独立仓库；不会复制作者的 Render 服务、环境变量或账号密钥。

### 方式 A：Fork

1. 打开公开模板仓库 [myname-design/elias-meme-template](https://github.com/myname-design/elias-meme-template)。
2. 点击右上角 **Fork → Create a new fork**。
3. Owner 选择自己的账号，填写仓库名，点击 **Create fork**。
4. 后续编辑、部署都选自己的 `你的用户名/你的仓库名`。Fork 保留上游关系及提交历史，方便以后同步更新。

### 方式 B：Use this template

1. 在原仓库点击 **Use this template → Create a new repository**。
2. 选择自己的账号、仓库名及可见性；无需包含所有分支。
3. 点击创建。模板复制当前文件，新的仓库历史独立于原仓库。
4. 如果没有 **Use this template** 按钮，表示维护者尚未启用 Template repository，可先使用 Fork。原仓库公开前，仅获授权的人能访问，Fork 也可能受账号策略限制。

仓库中的 `package.json` 设置 `private: true` 仅用于防止误发布到 npm，不影响 GitHub 公开、Fork 或 Template。

## 3. 在 Render 部署自己的服务

无需在本机安装编程工具。以下操作会在**你自己的 Render 账号**中创建新服务，首次部署即使关闭自动部署也会运行。

### 使用 Blueprint（推荐）

1. 登录 Render，连接自己的 GitHub 账号，只授权需要部署的仓库。
2. 选择 **New + → Blueprint**，选刚复制的仓库及 `main` 分支。
3. Render 读取根目录的 [render.yaml](render.yaml)。确认只有一个 Web Service、Node 运行时、**Free** 计划，没有数据库或付费磁盘；服务名按需要设为可用名称。
4. 如果当前账号没有 Free 选项，停止创建并查看平台当时政策，不自动选择收费计划。
5. 确认配置后创建并等待状态变为 **Live**。日志里的类型错误或构建错误需要先解决，不能仅以仓库创建成功作为部署成功。

### 手动创建 Web Service

如果 Blueprint 入口不可用，选 **New + → Web Service**，连接自己的仓库，并填写：

| 配置项 | 值 |
| --- | --- |
| Branch / Runtime | `main` / Node |
| Build Command | `npm ci --include=dev && npm run build && npm prune --omit=dev` |
| Start Command | `npm start` |
| Health Check Path | `/healthz` |
| Instance Type | Free（若不可选则停止） |
| Auto-Deploy | Off / 关闭 |
| 环境变量 | `NODE_VERSION=24.22.1`、`NODE_ENV=production`、`HOST=0.0.0.0` |

`PORT` 和 `RENDER_EXTERNAL_URL` 由 Render 注入，不用复制作者的值。默认域名下通常不需要额外设置 `PUBLIC_ORIGIN`；使用自定义域名时再设置为自己的 HTTPS 域名。详见 [部署与 Docker 说明](docs/DEPLOYMENT.md)。

## 4. 获取 MCP 地址

1. 打开 Render 服务详情，复制平台分配的 HTTPS 地址，例如 `https://你的服务名.onrender.com`。
2. 浏览器打开这个地址加 `/healthz`，应看到 `{"status":"ok","service":"elias-meme","version":"0.1.0"}`。
3. MCP 地址就是 **该 HTTPS 地址加 `/mcp`**，例如 `https://你的服务名.onrender.com/mcp`。

不要把 `/healthz` 或 GitHub 仓库网址当成 MCP 地址。直接用浏览器打开 `/mcp` 得到 **405 是正常的**：本服务使用 Streamable HTTP `POST /mcp`，不支持旧版 GET/SSE 连接。

## 5. 在支持自定义 MCP 的 ChatGPT 客户端中连接

1. 先确认当前账号/工作区允许创建自定义 MCP 应用。设置中的入口可能叫“应用”“连接器”“开发者模式”或“创建应用”；名称和可用性以当前客户端为准。工作区管理员可能需要开放权限。
2. 在创建自定义 MCP 应用的入口填写名称（例如 Elias Meme）和上一步的 `/mcp` URL。
3. 传输选择 **Streamable HTTP**（如有此项）；认证选择 **No authentication / 无认证**。不填写 OAuth Client ID、Secret 或 API Key。
4. 完成连接后刷新工具列表，应看到 `search_memes`、`show_meme`。在对话中启用该应用，然后发送第 1 节的示例。
5. 能搜索但没有图片卡片时，确认客户端支持 **MCP Apps UI**，并查看第 9 节排错。如果没有自定义 MCP 入口，使用另一个明确支持该能力的客户端或等待账号开放，不能靠修改本项目保证兼容。

服务公开且无认证；知道地址的人可以调用。不要把私人图片、个人信息或密钥放入图库。

## 6. 添加、替换表情包，修改名称和关键词

数据在 [src/custom.ts](src/custom.ts) 的 `CUSTOM_MEMES` 数组中；图片在 [public/memes/](public/memes/)。在自己的 GitHub 仓库即可通过 **Add file → Upload files** 上传图片，点击文件的编辑按钮修改配置并提交。

1. 准备你拥有权利或获得再分发授权的 JPG/JPEG/PNG/GIF。文件名只用英文字母、数字、点、下划线、短横线，例如 `my-happy.png`，不要用空格、中文、子目录或 SVG。
2. 将文件上传到 `public/memes/`。
3. 在 `CUSTOM_MEMES = [...]` 内添加一个对象，与前一项用逗号隔开。下面是字段示例，需先上传同名图片：

```ts
{
  id: 'my-happy',                 // 唯一 ID，不与其他图片重复
  title: '我的开心表情',
  title_zh: '我的开心表情',        // 展示时优先使用；改名请一起改
  url: '/memes/my-happy.png',     // 与上传文件名大小写完全一致
  page_url: '',                   // 有原始 HTTPS 来源可填写，未知留空
  format: 'png',
  emotions: ['开心', '高兴'],
  keywords: ['快乐', 'happy'],
  tags: ['自制', '表情包'],
  source: '自己绘制',              // 按真实来源填写
  attribution: '你的署名',
  license: {
    code: 'custom',
    name: '仅供个人使用，其他用途需授权', // 示例：改为你实际授予的许可
    commercial_use: false,
    attribution_required: true,
  },
},
```

4. `title`、`title_zh`、`emotions`、`keywords`、`tags` 都参与搜索。新增同义词就往相应数组里添加字符串，不用改搜索函数。未知作者/来源不要编造；只有有权授予商用时才设置 `commercial_use: true`。
5. 替换已有图片时，建议用**新的文件名**上传并更新该项的 `url` / `format`，可保留原 `id`；静态图片有一天缓存，用新文件名可避免旧图缓存。原文件是否删除由你自行决定。
6. 提交后，在自己的 Render 服务中选择 **Manual Deploy → Deploy latest commit**。模板默认关闭自动部署，提交不会自动更新。重新搜索并展示，确认新图片及版权信息。

所有 `public/memes/` 中受支持的文件，即使没写进数组，也可能被通过 URL 直接访问。不要上传私人内容。

本模板不包含第三方角色截图或其他预装表情包。MIT 适用于代码和文档，用户上传图片的权利需单独确认，见 [第三方与素材许可](THIRD_PARTY_NOTICES.md)。

## 7. 测试两个 MCP 工具

空图库可在支持直接调用工具的客户端中传入以下 `tools/call` 参数（握手由客户端完成）：

```json
{"name":"search_memes","arguments":{"query":"开心","limit":1}}
```

若 `structuredContent.memes` 非空，将其中的真实 ID 传给 `show_meme`，不要把图片 URL 当作 ID。上游 ID 缓存一小时，重启或过期后需重新搜索；空结果不代表服务故障。真实搜索会消耗 memecub 匿名额度。

完成第 6 节的上传和配置并重新部署后，可搜索“我的开心表情”，再调用：

```json
{"name":"show_meme","arguments":{"id":"my-happy"}}
```

这里的 `my-happy` 只有在你添加该条目后才有效。未知 ID 应返回 `isError: true`，空查询应被拒绝。无需访问真实上游的验证见下一节：测试会临时生成纯色图片和自定义条目，结束后删除，不为生产图库添加默认图片。

## 8. 本地开发与环境变量（可选）

安装 Git 和 Node.js 24（已验证 24.22.1），把占位符换成自己的仓库后执行：

```sh
git clone https://github.com/YOUR_USERNAME/YOUR_REPOSITORY.git
cd YOUR_REPOSITORY
npm ci
npm run typecheck
npm run build
npm test
npx playwright install chromium
npm run test:ui
npm start
```

`npm test` 和 UI 测试读取构建后的 HTML，因此先执行 `npm run build`。默认测试使用模拟上游，不调用收费服务或真实 memecub。已安装系统 Chromium 时，可用 `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui`。

默认服务监听 `http://127.0.0.1:3000`。本地 `/healthz` 可访问，但自定义图片需要一个可达的 HTTPS 入口。仅把域名写进配置不会自动创建 DNS、证书或隧道；无 HTTPS 入口时，可先运行使用模拟入口的自动化测试。

复制 [.env.example](.env.example) 为 `.env`，按需编辑；应用**不会自动读取 .env**，构建后用 Node 的参数加载：

```sh
node --env-file=.env dist/src/index.js
```

| 变量 | 用途 |
| --- | --- |
| `PORT` | 监听端口，默认 3000；Render 使用平台注入值 |
| `HOST` | 默认 `127.0.0.1`；Render / Docker 设为 `0.0.0.0` |
| `PUBLIC_ORIGIN` | 自己实际可达的 HTTPS origin，例如 `https://memes.example.com`，不能带 `/mcp`、路径、查询参数或凭证；用于图片 URL、Host 校验与 UI CSP |
| `RENDER_EXTERNAL_URL` | Render 自动提供的 HTTPS origin；未设置 `PUBLIC_ORIGIN` 时作为回退 |
| `NODE_ENV` | 部署时设为 `production` |
| `NODE_VERSION` | Render 选择 Node 版本用，模板固定为 24.22.1；不由应用代码读取 |

`.env`、密钥、依赖和构建结果被忽略；只提交不含秘密的 `.env.example`。不要提交 Render/GitHub Token 或 npm 登录配置。

## 9. 常见问题

| 问题 | 处理方法 |
| --- | --- |
| 没有 Fork / Template 按钮 | 检查仓库是否已公开、是否启用 Template，以及账号策略；启用 Template 是仓库维护者操作 |
| 连接超时或第一次很慢 | Render Free 可能休眠；先检查 `/healthz` 并等待启动，再连接；不保证免费服务始终在线 |
| `/mcp` 在浏览器显示 405 | 浏览器使用 GET；本服务需要支持 Streamable HTTP POST 的 MCP 客户端 |
| `CUSTOM_ORIGIN_REQUIRED` 或公开监听启动失败 | 设置真实 HTTPS `PUBLIC_ORIGIN`；Render 默认域名可用系统 `RENDER_EXTERNAL_URL`；检查是否错误填了空字符串 |
| 图片 404 / 显示旧图 | 检查文件名大小写、路径、是否提交并重新部署；替换图片用新文件名避免一天缓存 |
| 工具可用但没有 UI / 图片被拦截 | 确认 MCP Apps 支持、HTTPS 图片可访问、域名配置正确；改域名后重新连接或刷新工具/资源缓存 |
| 搜不到新加的图 | 检查配置语法、所有关键词是否都匹配、`kind` 和商用筛选，以及 Render 是否部署最新提交 |
| `MEME_EXPIRED` | 先重新 `search_memes`，再用这次结果的 ID 展示；不能把 URL 当作 ID |
| 402 / 429 / `DAILY_BUDGET` / `UPSTREAM_COOLDOWN` | 上游额度或频率受限，按提示等待；不自动付费，也不要通过重启、扩实例或换出口绕过限额 |
| `UPSTREAM_INVALID` | 检查服务日志和上游可用性，可能是超时、网络错误或返回格式变化；不要关闭 TLS 校验 |
| HTTP 403 | 核对服务域名与 `PUBLIC_ORIGIN`；浏览器直连有 Origin 白名单，任意网页客户端并非都支持，不要改成放行所有来源 |
| `npm test` 找不到 `dist/ui/meme.html` | 先 `npm run build`；如果缺 Chromium，执行 `npx playwright install chromium` |

## 10. 免费额度、许可与参与贡献

项目仅使用 memecub 公开免密搜索。当前实现每进程滚动 24 小时最多尝试 20 次，相同搜索缓存 10 分钟、合并相同并发请求，未缓存搜索至少间隔 1 秒。平台可能让多个服务共享出口 IP，上游限制以 [memecub 最新说明](https://memecub.com/developers) 为准；重启不会重置上游额度。按单实例部署，公开服务的访问者共用额度。

项目代码和文档采用 **[MIT License](LICENSE)，Copyright (c) 2026 myname-design**。第三方依赖保留原许可证；UI 构建会生成并嵌入 `dist/ui/THIRD_PARTY_NOTICES.txt`。图片版权属于各自权利人，`commercial_use=false` 或来源未知不代表获得再分发许可。

- [贡献说明](CONTRIBUTING.md)
- [安全问题反馈](SECURITY.md)
- [模板验证报告](docs/TEMPLATE_REPORT.md)
- [部署与 Docker 说明](docs/DEPLOYMENT.md)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) / [MCP Apps](https://github.com/modelcontextprotocol/ext-apps)

公开模板仓库：https://github.com/myname-design/elias-meme-template 。本项目不提供共享部署，使用者需按教程在自己的账号部署；请勿导入私人仓库的旧历史或备份。
