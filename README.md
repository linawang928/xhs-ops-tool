# 小红书运营工具 MVP

面向个人和小团队的本地 Web 工作台，覆盖小红书图文运营的第一版闭环：

- Topic Lab：关键词生成候选选题、评分、入池
- Account Positioning：根据主体区、人群、差异化承诺生成账号名、简介、定位语和内容支柱
- Benchmark Lab：导入对标笔记正文并拆解结构、标签、卖点和互动钩子
- Benchmark Filter：根据账号主体区和内容形式筛选对标内容
- Content Studio：基于选题和对标上下文生成标题、正文、话题和模板卡片脚本
- Poster Studio：本地生成 3:4 SVG 模板海报；OpenAI 模式调用 GPT Image 2 生成 PNG 海报
- Compliance Guard：检测极限词、导流词、虚假承诺、医疗/金融敏感表达和项目禁用词
- Publish Queue：生成半自动发布包、素材清单、移动端分享、排期和官方发布入口

## 本地运行

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## OpenAI 生成配置

页面顶部把“生成模式”切到 `OpenAI GPT` 后，可以选择两种连接方式。

### 服务器后端

本地 `pnpm dev` 或未来托管到支持 Next.js API Route 的平台时，建议使用服务器后端模式。API Key 只放在服务端环境变量里，不会进入浏览器或工作区导出文件。

1. 在 `.env.local` 填入 `OPENAI_API_KEY`。
2. 默认文本模型为 `OPENAI_TEXT_MODEL=gpt-5.5`。
3. 默认图片模型为 `OPENAI_IMAGE_MODEL=gpt-image-2`。
4. 启动 `pnpm dev` 后，在页面顶部把“OpenAI 连接方式”设为 `服务器后端`。

右侧 `Provider Slots` 会显示当前后端是否检测到 `OPENAI_API_KEY`，以及文本模型和 GPT Image 2 图片模型是否可用。

### 浏览器直连/代理

GitHub Pages 是静态站，不能执行 Next.js API Route。个人可信环境下，可以在页面顶部把“OpenAI 连接方式”设为 `浏览器直连/代理`，填写：

- `OpenAI API Key`
- `OpenAI Base URL`
- `文案模型`
- `图片模型`

这些设置只保存在当前浏览器的 `localStorage` 里，不会写入工作区 JSON 导出。多人或公开生产环境仍建议使用服务器后端模式，避免在浏览器里暴露 API Key。

可用的 OpenAI 功能：

- 账号定位：生成账号名、简介、定位语、内容支柱
- 爆款选题：生成候选选题、角度和评分理由
- 图文文案：生成标题、正文、话题和卡片脚本
- 主页分析：从账号主页资料推断主体区、人群和对标筛选条件
- 合规改写：保留信息价值，改成更克制的发布表达
- 海报图：使用 `gpt-image-2` 和 `output_format=png` 生成浏览器可预览、可下载的 3:4 PNG

服务器后端模式会走 `/api/ai/*` 路由；浏览器直连/代理模式会复用同一套生成提示词和结构化 schema，直接请求配置的 OpenAI Base URL。

没有 API Key 或请求失败时也可以点击“生成海报”，系统会使用本地 SVG 模板为每张卡片生成 3:4 海报，并同步到发布包的素材清单。

## 常用脚本

```bash
pnpm test
pnpm lint
pnpm build
GITHUB_PAGES=true pnpm build
pnpm db:generate
```

## 技术栈

- Next.js App Router + TypeScript
- Tailwind CSS
- Drizzle ORM + SQLite schema
- sql.js 本地 SQLite 运行层
- Vitest + Testing Library

## 模块边界

- `src/lib/core/*`：账号定位、对标筛选、选题评分、对标拆解、内容生成、合规检测、发布状态流转
- `src/lib/core/providers.ts`：`SourceProvider`、`LLMProvider`、`ImageProvider`、`PublisherAdapter` 扩展接口
- `src/lib/db/schema.ts`：Drizzle SQLite 表结构
- `src/components/xhs-ops-app.tsx`：五个工作区的本地交互界面

## 安全边界

第一版只实现半自动发布辅助，不绕过登录、验证码或平台风控。发布前必须人工复核内容、图片顺序、敏感表达和发布账号。
