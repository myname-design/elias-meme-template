# 贡献说明

欢迎通过 Issue 报告普通问题，通过 Pull Request 提交小范围修复和文档改进。安全漏洞不要发公开 Issue，见 [SECURITY.md](SECURITY.md)。

## 提交步骤

1. Fork 仓库，克隆自己的副本，从最新 `main` 创建分支。
2. 使用 Node.js 24，执行 `npm ci`。保持修改与问题相关，不随意改动已有素材。
3. 修改代码后依次执行：

   ```sh
   npm run typecheck
   npm run build
   npm test
   npx playwright install chromium
   npm run test:ui
   ```

4. 涉及部署或依赖时额外执行 `docker build -t elias-meme:check .`。不要求调用真实 memecub；默认测试模拟上游。
5. 检查 `git diff` 和 `git status`，确保没有 `.env`、密钥、构建结果或个人路径。GitHub 提交邮箱可在个人 Settings → Emails 开启隐私后使用 GitHub 提供的 noreply 地址。
6. 提交 PR，写明问题、修改效果、验证命令及未完成的验证；不要把模拟宿主测试描述为真实 ChatGPT 验证。

GitHub Actions 的 Validate Elias Meme 工作流只允许手动运行（Actions → Run workflow），不自动部署。不要为了测试创建付费服务或修改他人的线上部署。

## 图片与行为约束

- 只提交拥有权利或获得再分发授权的图片，记录真实来源、作者、许可和署名；检查图片内的信息及 EXIF，避免个人信息。
- 新条目遵循 README 的字段和文件名规则，使用唯一 ID。MIT 代码许可不替代图片授权。
- 保留自定义图库优先、筛选后无命中再回退 memecub 的顺序，不绕过上游额度。
- 保留 `search_memes` / `show_meme` 的只读边界、MCP Apps UI、图片白名单及来源版权信息。
- 代码和文档贡献按 MIT License 提交；第三方内容保留原许可，不将他人的素材重新标成 MIT。
