# 小红书运营工具 MVP

面向个人和小团队的本地 Web 工作台，覆盖小红书图文运营的第一版闭环：

- Topic Lab：关键词生成候选选题、评分、入池
- Account Positioning：根据主体区、人群、差异化承诺生成账号名、简介、定位语和内容支柱
- Benchmark Lab：导入对标笔记正文并拆解结构、标签、卖点和互动钩子
- Benchmark Filter：根据账号主体区和内容形式筛选对标内容
- Content Studio：基于选题和对标上下文生成标题、正文、话题和模板卡片脚本
- Compliance Guard：检测极限词、导流词、虚假承诺、医疗/金融敏感表达和项目禁用词
- Publish Queue：生成半自动发布包、发布清单、排期和官方发布入口

## 本地运行

```bash
pnpm install
pnpm dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 常用脚本

```bash
pnpm test
pnpm lint
pnpm build
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
