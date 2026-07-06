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

本地 OpenAI 模式通过 Next.js API Route 调用服务端环境变量，不会把 API Key 发送到浏览器或落库。

1. 在 `.env.local` 填入 `OPENAI_API_KEY`。
2. 默认文本模型为 `OPENAI_TEXT_MODEL=gpt-5.5`。
3. 默认图片模型为 `OPENAI_IMAGE_MODEL=gpt-image-2`。
4. 启动 `pnpm dev` 后，在页面顶部把“生成模式”切到 `OpenAI GPT`。

可用的 OpenAI 功能：

- 账号定位：调用 `/api/ai/positioning`
- 爆款选题：调用 `/api/ai/topics`
- 图文文案：调用 `/api/ai/draft`
- 海报图：调用 `/api/ai/poster`，使用 `gpt-image-2` 和 `output_format=png`，返回浏览器可预览、可下载的 data URL

没有 API Key 时也可以点击“生成海报”，系统会使用本地 SVG 模板为每张卡片生成 3:4 海报，并同步到发布包的素材清单。

GitHub Pages 只能托管静态页面，不能保存 API Key 或执行服务端 GPT 调用。真实 GPT 生成请用本地 `pnpm dev`，线上 Pages 版本保留工作台界面和本地模板 fallback。

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
