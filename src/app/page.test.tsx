import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

async function renderHome(
  searchParams: Promise<Record<string, string | string[] | undefined>> = Promise.resolve({})
) {
  return render(await Home({ searchParams }));
}

function ensureLocalStorage() {
  const store = new Map<string, string>();
  Object.defineProperty(window, "localStorage", {
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
      removeItem: (key: string) => store.delete(key),
      clear: () => store.clear(),
    },
    configurable: true,
  });
}

beforeEach(() => {
  ensureLocalStorage();
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(window.navigator, "share");
  Reflect.deleteProperty(window.navigator, "canShare");
  window.localStorage?.clear();
  window.history.replaceState(null, "", "/");
});

describe("home dashboard", () => {
  it("renders the xhs operation workspaces without the scaffold content", async () => {
    await renderHome();

    expect(screen.getByRole("heading", { name: "小红书运营工作台" })).toBeInTheDocument();
    expect(screen.getByText("Account Positioning")).toBeInTheDocument();
    expect(screen.getByText("Project Settings")).toBeInTheDocument();
    expect(screen.getByText("Topic Lab")).toBeInTheDocument();
    expect(screen.getByText("Benchmark Lab")).toBeInTheDocument();
    expect(screen.getByText("Content Studio")).toBeInTheDocument();
    expect(screen.getByText("Compliance Guard")).toBeInTheDocument();
    expect(screen.getByText("Publish Queue")).toBeInTheDocument();
    expect(screen.getByText("筛选对标内容")).toBeInTheDocument();
    expect(screen.queryByText(/To get started/)).not.toBeInTheDocument();
  });

  it("shows OpenAI text and GPT Image provider readiness when the backend is configured", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        serverApiAvailable: true,
        hasOpenAIKey: true,
        textModel: "gpt-5.5",
        imageModel: "gpt-image-2",
        features: {
          structuredText: true,
          posterImage: true,
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await renderHome();

    expect(await screen.findByText("OpenAI 已连接")).toBeInTheDocument();
    expect(screen.getByText("Text gpt-5.5")).toBeInTheDocument();
    expect(screen.getByText("Image gpt-image-2")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/status/",
      expect.objectContaining({ method: "GET" })
    );
  });

  it("renders provider status from the server on the first screen", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    await renderHome();

    expect(screen.getByText("OpenAI 未配置")).toBeInTheDocument();
    expect(screen.getByText("Text gpt-5.5")).toBeInTheDocument();
    expect(screen.getByText("Image gpt-image-2")).toBeInTheDocument();
  });

  it("shows OpenAI connection settings on the first screen before switching generation modes", async () => {
    await renderHome();

    expect(screen.getByLabelText("OpenAI 连接方式")).toBeInTheDocument();
    expect(screen.getByLabelText("OpenAI API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("OpenAI Base URL")).toHaveValue("https://api.openai.com/v1");
    expect(screen.getByRole("button", { name: "保存 OpenAI 设置" })).toBeInTheDocument();
  });

  it("exposes positioning generation controls as explicit form controls", async () => {
    await renderHome();

    expect(screen.getByLabelText("生成模式")).toHaveAttribute("name", "generationMode");
    expect(screen.getByLabelText("生成模式")).toHaveAttribute("aria-label", "生成模式");
    expect(screen.getByLabelText("差异化承诺")).toHaveAttribute("aria-label", "差异化承诺");
    expect(
      within(screen.getByRole("form", { name: "账号定位生成" })).getByRole("button", {
        name: "生成定位方案",
      })
    ).toHaveAttribute("type", "submit");
  });

  it("saves project settings locally and applies custom forbidden words to compliance checks", async () => {
    const user = userEvent.setup();
    await renderHome();

    await user.clear(screen.getByLabelText("项目行业"));
    await user.type(screen.getByLabelText("项目行业"), "家居收纳");
    await user.clear(screen.getByLabelText("禁用词"));
    await user.type(screen.getByLabelText("禁用词"), "全网最低, 不踩坑");
    await user.click(screen.getByRole("button", { name: "保存设置" }));

    expect(screen.getByText("设置已保存")).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem("xhs-ops-project") ?? "{}")).toMatchObject({
      industry: "家居收纳",
      forbiddenWords: ["全网最低", "不踩坑"],
    });

    await user.clear(screen.getByLabelText("合规检测文本"));
    await user.type(screen.getByLabelText("合规检测文本"), "这个收纳方案不踩坑，适合租房党。");

    expect(screen.getByText("不踩坑")).toBeInTheDocument();
    expect(screen.getByText(/建议换成更克制/)).toBeInTheDocument();
  });

  it("loads saved project settings from localStorage", async () => {
    window.localStorage.setItem(
      "xhs-ops-project",
      JSON.stringify({
        id: "project-1",
        name: "租房收纳号",
        persona: "给租房党做低预算整理方案",
        industry: "家居收纳",
        tone: "清爽、具体、像朋友提醒",
        audience: "租房党和小户型新手",
        forbiddenWords: ["永不复乱"],
        brandColors: ["#2E6B5F", "#E85D75", "#F6C85F"],
      })
    );

    await renderHome();

    expect(await screen.findByDisplayValue("租房收纳号")).toBeInTheDocument();
    expect(screen.getByLabelText("项目行业")).toHaveValue("家居收纳");
    expect(screen.getByLabelText("禁用词")).toHaveValue("永不复乱");
  });

  it("autosaves and restores the active workspace after reload", async () => {
    const user = userEvent.setup();
    const view = await renderHome();

    await user.clear(screen.getByLabelText("笔记标题"));
    await user.type(screen.getByLabelText("笔记标题"), "租房收纳先做入口区");
    await user.clear(screen.getByLabelText("正文"));
    await user.type(screen.getByLabelText("正文"), "先把钥匙、快递和包的位置固定下来。");
    await user.clear(screen.getByLabelText("话题标签"));
    await user.type(screen.getByLabelText("话题标签"), "租房收纳, 入口区整理");
    await user.click(screen.getByRole("button", { name: "加入队列" }));

    const saved = JSON.parse(window.localStorage.getItem("xhs-ops-workspace") ?? "{}");
    expect(saved.draft.selectedTitle).toBe("租房收纳先做入口区");
    expect(saved.publishTask.status).toBe("queued");

    view.unmount();
    await renderHome();

    expect(screen.getByLabelText("笔记标题")).toHaveValue("租房收纳先做入口区");
    expect(screen.getByLabelText("正文")).toHaveValue("先把钥匙、快递和包的位置固定下来。");
    expect(screen.getByLabelText("话题标签")).toHaveValue("租房收纳, 入口区整理");
    expect(screen.getByText("queued")).toBeInTheDocument();
    expect(screen.getByText(/#租房收纳 #入口区整理/)).toBeInTheDocument();
  });

  it("exports and imports a complete workspace JSON backup", async () => {
    const user = userEvent.setup();
    await renderHome();

    await user.clear(screen.getByLabelText("笔记标题"));
    await user.type(screen.getByLabelText("笔记标题"), "租房收纳先做入口区");
    await user.click(screen.getByRole("button", { name: "导出工作区" }));

    const exported = screen.getByLabelText("工作区 JSON");
    expect((exported as HTMLTextAreaElement).value).toContain("租房收纳先做入口区");

    await user.clear(screen.getByLabelText("笔记标题"));
    await user.type(screen.getByLabelText("笔记标题"), "临时标题");
    await user.click(screen.getByRole("button", { name: "导入工作区" }));

    expect(screen.getByLabelText("笔记标题")).toHaveValue("租房收纳先做入口区");
    expect(screen.getAllByText("工作区已导入").length).toBeGreaterThan(0);
  });

  it("renders generated positioning from query params for no-js form submissions", async () => {
    await renderHome(
      Promise.resolve({
        subjectArea: "家居收纳",
        audience: "租房党和小户型新手",
        differentiator: "把空间改造拆成低预算、可复用的清单",
        tone: "实用、清爽、像朋友提醒",
      })
    );

    const positioningForm = screen.getByRole("form", { name: "账号定位生成" });
    expect(positioningForm).toHaveAttribute("method", "get");
    expect(positioningForm).not.toHaveAttribute("action");
    expect(screen.getByRole("button", { name: "生成定位" })).toHaveAttribute(
      "form",
      "positioning-form"
    );
    expect(screen.getByLabelText("账号主体区")).toHaveValue("家居收纳");
    expect(screen.getByLabelText("选题关键词")).toHaveValue("家居收纳");
    expect(screen.getAllByRole("heading", { name: "家居收纳自查室" }).length).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("heading", { name: "家居收纳痛点避坑清单：新手先看这 5 个细节" })
        .length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/租房党和小户型新手/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/低预算、可复用/).length).toBeGreaterThan(0);
  });

  it("hydrates generated positioning from browser query params on static pages", async () => {
    window.history.replaceState(
      null,
      "",
      "/?subjectArea=%E5%92%96%E5%95%A1%E5%85%A5%E9%97%A8&audience=%E6%83%B3%E5%9C%A8%E5%AE%B6%E5%86%B2%E5%92%96%E5%95%A1%E7%9A%84%E6%96%B0%E6%89%8B&differentiator=%E6%8A%8A%E5%99%A8%E5%85%B7%E9%80%89%E6%8B%A9%E5%92%8C%E5%86%B2%E7%85%AE%E5%8F%98%E9%87%8F%E6%8B%86%E6%88%90%E4%B8%8D%E6%B5%AA%E8%B4%B9%E9%92%B1%E7%9A%84%E6%AD%A5%E9%AA%A4&tone=%E8%BD%BB%E6%9D%BE%E3%80%81%E5%85%B7%E4%BD%93%E3%80%81%E6%9C%89%E4%B8%80%E7%82%B9%E4%B8%93%E4%B8%9A%E6%84%9F"
    );

    await renderHome();

    expect((await screen.findAllByRole("heading", { name: "咖啡入门自查室" })).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("账号主体区")).toHaveValue("咖啡入门");
    expect(screen.getByLabelText("选题关键词")).toHaveValue("咖啡入门");
    expect(screen.getAllByText(/在家冲咖啡的新手/).length).toBeGreaterThan(0);
  });

  it("keeps benchmark subject filters usable after generating a custom account positioning", async () => {
    const user = userEvent.setup();
    await renderHome();

    await user.clear(screen.getByLabelText("账号主体区"));
    await user.type(screen.getByLabelText("账号主体区"), "家居收纳");
    await user.clear(screen.getByLabelText("目标人群"));
    await user.type(screen.getByLabelText("目标人群"), "租房党和小户型新手");
    await user.clear(screen.getByLabelText("差异化承诺"));
    await user.type(screen.getByLabelText("差异化承诺"), "把空间改造拆成低预算、可复用的清单");
    await user.clear(screen.getByLabelText("账号语气"));
    await user.type(screen.getByLabelText("账号语气"), "实用、清爽、像朋友提醒");

    const generateButton = screen.getByRole("button", { name: "生成定位" });
    expect(generateButton).toHaveAttribute("type", "submit");
    expect(generateButton).toHaveAttribute("form", "positioning-form");

    await user.click(generateButton);

    expect(screen.getAllByRole("heading", { name: "家居收纳自查室" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/租房党和小户型新手/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/低预算、可复用/).length).toBeGreaterThan(0);

    const benchmarkSubjectSelect = screen.getByLabelText("主体区");
    expect(benchmarkSubjectSelect).toHaveValue("家居收纳");
    expect(screen.getByRole("option", { name: "家居收纳" })).toBeInTheDocument();
    expect(screen.getByLabelText("选题关键词")).toHaveValue("家居收纳");
    expect(
      screen.getAllByRole("heading", { name: "家居收纳痛点避坑清单：新手先看这 5 个细节" })
        .length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/家居收纳别急着下单/).length).toBeGreaterThan(0);
  });

  it("analyzes an account homepage and applies the inferred positioning to benchmark filters", async () => {
    const user = userEvent.setup();
    await renderHome();

    await user.clear(screen.getByLabelText("账号主页资料"));
    await user.type(
      screen.getByLabelText("账号主页资料"),
      "租房收纳小记\n给租房党和小户型新手做低预算收纳清单，不乱买柜子。\n租房收纳别急着买柜子，先看这 5 个死角\n入口区避坑清单"
    );
    await user.click(screen.getByRole("button", { name: "分析主页" }));

    expect(screen.getByText("主页诊断")).toBeInTheDocument();
    expect(screen.getAllByText("家居收纳").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/租房党/).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "应用到定位" }));

    expect(screen.getByLabelText("账号主体区")).toHaveValue("家居收纳");
    expect(screen.getByLabelText("主体区")).toHaveValue("家居收纳");
    expect(screen.getByRole("option", { name: "家居收纳" })).toBeInTheDocument();
  });

  it("renders homepage analysis from query params for no-js account analysis submissions", async () => {
    await renderHome(
      Promise.resolve({
        homepageText:
          "租房收纳小记\n给租房党和小户型新手做低预算收纳清单，不乱买柜子。\n租房收纳别急着买柜子，先看这 5 个死角\n入口区避坑清单",
      })
    );

    const homepageForm = screen.getByRole("form", { name: "账号主页分析" });
    expect(homepageForm).toHaveAttribute("method", "get");
    expect(homepageForm).not.toHaveAttribute("action");
    expect(screen.getByRole("button", { name: "分析主页" })).toHaveAttribute(
      "form",
      "homepage-analysis-form"
    );
    expect(screen.getByLabelText("账号主页资料")).toHaveValue(
      "租房收纳小记\n给租房党和小户型新手做低预算收纳清单，不乱买柜子。\n租房收纳别急着买柜子，先看这 5 个死角\n入口区避坑清单"
    );
    expect(screen.getAllByText("家居收纳").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("账号主体区")).toHaveValue("家居收纳");
    expect(screen.getByLabelText("主体区")).toHaveValue("家居收纳");
    expect(screen.getByText("租房收纳别急着买柜子，先看这 5 个死角")).toBeInTheDocument();
  });

  it("uses the OpenAI positioning endpoint when OpenAI generation mode is selected", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        positioning: {
          id: "positioning-ai-project-1",
          projectId: "project-1",
          subjectArea: "家居收纳",
          audience: "租房党和小户型新手",
          differentiator: "把空间改造拆成低预算、可复用的清单",
          tone: "实用、清爽、像朋友提醒",
          nameOptions: ["AI 收纳研究室", "小户型自查局", "租房收纳笔记"],
          bioOptions: ["给租房党的低预算收纳清单。"],
          selectedName: "AI 收纳研究室",
          selectedBio: "给租房党的低预算收纳清单。",
          positioningStatement: "面向租房党，用清爽实用的表达，把收纳改造成可执行清单。",
          contentPillars: ["低预算改造", "空间动线", "收纳避坑", "复盘清单"],
          benchmarkFilters: {
            subjectArea: "家居收纳",
            contentFormats: ["避坑清单", "流程模板", "测评对比", "全部"],
          },
          createdAt: "2026-07-07T00:00:00.000Z",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await renderHome();

    await user.selectOptions(screen.getByLabelText("生成模式"), "openai");
    await user.clear(screen.getByLabelText("账号主体区"));
    await user.type(screen.getByLabelText("账号主体区"), "家居收纳");
    await user.clear(screen.getByLabelText("目标人群"));
    await user.type(screen.getByLabelText("目标人群"), "租房党和小户型新手");
    await user.click(screen.getByRole("button", { name: "生成定位" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/positioning/",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("家居收纳"),
      })
    );
    expect(screen.getAllByRole("heading", { name: "AI 收纳研究室" }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("主体区")).toHaveValue("家居收纳");
  });

  it("uses OpenAI endpoints for topic search and draft generation in OpenAI mode", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/ai/topics/") {
        return {
          ok: true,
          json: async () => ({
            topics: [
              {
                id: "topic-ai-rent-storage-1",
                projectId: "project-1",
                keyword: "租房收纳",
                title: "租房收纳别急着买柜子，先看这 5 个死角",
                angle: "避坑清单",
                source: "manual-keyword",
                score: 92,
                status: "candidate",
                metrics: { likes: 4200, saves: 2600, comments: 188 },
                reasons: ["关键词贴合", "选题角度明确", "收藏权重高"],
              },
            ],
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          draft: {
            id: "draft-topic-ai-rent-storage-1",
            projectId: "project-1",
            topicId: "topic-ai-rent-storage-1",
            titleOptions: ["租房收纳别乱买，先做这 4 步"],
            selectedTitle: "租房收纳别乱买，先做这 4 步",
            body: "如果你每次整理完又很快复乱，先别急着买新柜子。",
            hashtags: ["租房收纳", "小户型"],
            assetCards: [],
            compliance: { riskLevel: "low", issues: [], sanitizedText: "ok" },
            createdAt: "2026-07-07T00:00:00.000Z",
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    await renderHome();

    await user.selectOptions(screen.getByLabelText("生成模式"), "openai");
    await user.clear(screen.getByLabelText("选题关键词"));
    await user.type(screen.getByLabelText("选题关键词"), "租房收纳");
    await user.click(screen.getByRole("button", { name: "检索" }));
    await user.click(await screen.findByRole("button", { name: /租房收纳别急着买柜子/ }));
    await user.click(screen.getByRole("button", { name: "生成" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/topics/",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("租房收纳"),
      })
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/draft/",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("topic-ai-rent-storage-1"),
      })
    );
    expect(await screen.findByText("租房收纳别乱买，先做这 4 步")).toBeInTheDocument();
  });

  it("imports hot topic rows into the topic pool and uses one for draft generation", async () => {
    const user = userEvent.setup();
    await renderHome();

    await user.clear(screen.getByLabelText("选题关键词"));
    await user.type(screen.getByLabelText("选题关键词"), "租房收纳");
    await user.clear(screen.getByLabelText("爆款数据导入"));
    await user.type(
      screen.getByLabelText("爆款数据导入"),
      "标题,点赞,收藏,评论,角度\n租房收纳入口区避坑清单,4200,2800,188,痛点清单"
    );
    await user.click(screen.getByRole("button", { name: "导入爆款数据" }));

    expect(screen.getByText("已导入 1 条爆款选题")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /租房收纳入口区避坑清单/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /租房收纳入口区避坑清单/ }));
    await user.click(screen.getByRole("button", { name: "生成" }));

    expect(screen.getByLabelText("笔记标题")).toHaveValue("租房收纳入口区避坑清单");
  });

  it("uses OpenAI to analyze benchmark notes in OpenAI mode", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/ai/benchmark/") {
        return {
          ok: true,
          json: async () => ({
            benchmark: {
              id: "bench-ai-1",
              projectId: "project-1",
              title: "租房收纳别急着买柜子，先看这 5 个死角",
              body: "租房入口区总是乱，先别买柜子。",
              author: "小户型整理局",
              importedAt: "2026-07-07T00:00:00.000Z",
              analysis: {
                openingHook: "先用冲动购买痛点抓住租房党。",
                structure: ["痛点开场", "步骤清单", "互动收尾"],
                tags: ["租房收纳", "小户型"],
                sellingPoints: ["入口区", "柜内死角", "低预算"],
                interactionCues: ["评论区补充你家最乱的位置"],
              },
            },
          }),
        };
      }

      return {
        ok: true,
        json: async () => ({
          serverApiAvailable: true,
          hasOpenAIKey: true,
          textModel: "gpt-5.5",
          imageModel: "gpt-image-2",
          features: { structuredText: true, posterImage: true },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    await renderHome();

    await user.selectOptions(screen.getByLabelText("生成模式"), "openai");
    await user.clear(screen.getByLabelText("对标笔记正文"));
    await user.type(screen.getByLabelText("对标笔记正文"), "租房入口区总是乱，先别买柜子。");
    await user.click(screen.getByRole("button", { name: "拆解" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/benchmark/",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("租房入口区总是乱"),
      })
    );
    expect(await screen.findByText("先用冲动购买痛点抓住租房党。")).toBeInTheDocument();
    expect(screen.getByText("OpenAI 已拆解对标内容")).toBeInTheDocument();
  });

  it("lets operators edit the draft and syncs compliance plus publish package", async () => {
    const user = userEvent.setup();
    await renderHome();

    await user.clear(screen.getByLabelText("笔记标题"));
    await user.type(screen.getByLabelText("笔记标题"), "租房收纳先做入口区");
    await user.clear(screen.getByLabelText("正文"));
    await user.type(screen.getByLabelText("正文"), "先把钥匙、快递和包的位置固定下来。");
    await user.clear(screen.getByLabelText("话题标签"));
    await user.type(screen.getByLabelText("话题标签"), "租房收纳, 入口区整理");

    expect(screen.getByLabelText("合规检测文本")).toHaveValue(
      "租房收纳先做入口区\n先把钥匙、快递和包的位置固定下来。"
    );
    expect(screen.getAllByText(/租房收纳先做入口区/).length).toBeGreaterThan(0);
    expect(screen.getByText(/#租房收纳 #入口区整理/)).toBeInTheDocument();
  });

  it("generates and previews OpenAI poster images for every draft card", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation(async (url: string, init?: RequestInit) => {
      if (url === "/api/ai/status/") {
        return {
          ok: true,
          json: async () => ({ serverApiAvailable: true, hasOpenAIKey: true }),
        };
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { cardId?: string };
      const callIndex = fetchMock.mock.calls.filter(([callUrl]) => callUrl === "/api/ai/poster/").length;
      return {
        ok: true,
        json: async () => ({
          image: {
            id: `poster-${callIndex}`,
            url: `data:image/png;base64,poster-base64-${callIndex}`,
            alt: `xhs poster ${callIndex}`,
            cardId: body.cardId,
            draftId: "draft-topic-ai",
            source: "openai",
            fileName: `xhs-ai-poster-${callIndex}.png`,
            mimeType: "image/png",
            width: 1024,
            height: 1536,
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);
    await renderHome();

    const cardCount = screen.getAllByLabelText(/卡片标题/).length;
    await user.selectOptions(screen.getByLabelText("生成模式"), "openai");
    await user.click(screen.getByRole("button", { name: "生成海报" }));

    await waitFor(() =>
      expect(fetchMock.mock.calls.filter(([url]) => url === "/api/ai/poster/")).toHaveLength(cardCount)
    );
    expect(await screen.findAllByRole("img", { name: /xhs poster/ })).toHaveLength(cardCount);
    expect(screen.getAllByText("xhs-ai-poster-1.png").length).toBeGreaterThan(0);
    expect(screen.getAllByText(`xhs-ai-poster-${cardCount}.png`).length).toBeGreaterThan(0);
  });

  it("saves browser OpenAI settings separately and keeps the API key out of workspace exports", async () => {
    const user = userEvent.setup();
    await renderHome();

    await user.selectOptions(screen.getByLabelText("生成模式"), "openai");
    await user.selectOptions(screen.getByLabelText("OpenAI 连接方式"), "browser");
    await user.clear(screen.getByLabelText("OpenAI API Key"));
    await user.type(screen.getByLabelText("OpenAI API Key"), "sk-browser-secret");
    await user.clear(screen.getByLabelText("OpenAI Base URL"));
    await user.type(screen.getByLabelText("OpenAI Base URL"), "https://api.openai.test/v1");
    await user.click(screen.getByRole("button", { name: "保存 OpenAI 设置" }));
    await user.click(screen.getByRole("button", { name: "导出工作区" }));

    expect(screen.getAllByText("浏览器直连已配置").length).toBeGreaterThan(0);
    expect(JSON.parse(window.localStorage.getItem("xhs-ops-openai-settings") ?? "{}")).toMatchObject({
      transport: "browser",
      apiKey: "sk-browser-secret",
      baseUrl: "https://api.openai.test/v1",
    });
    expect((screen.getByLabelText("工作区 JSON") as HTMLTextAreaElement).value).not.toContain(
      "sk-browser-secret"
    );
  });

  it("uses browser OpenAI settings for poster generation without calling the static API route", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation(async (url: string) => {
      if (url === "/api/ai/status/") {
        return {
          ok: false,
          json: async () => ({ error: "static preview" }),
        };
      }
      if (url === "https://api.openai.test/v1/images/generations") {
        return {
          ok: true,
          json: async () => ({
            data: [{ b64_json: "browser-poster-base64", revised_prompt: "browser xhs poster" }],
          }),
        };
      }
      throw new Error(`Unexpected fetch ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    await renderHome();

    const cardCount = screen.getAllByLabelText(/卡片标题/).length;
    await user.selectOptions(screen.getByLabelText("生成模式"), "openai");
    await user.selectOptions(screen.getByLabelText("OpenAI 连接方式"), "browser");
    await user.clear(screen.getByLabelText("OpenAI API Key"));
    await user.type(screen.getByLabelText("OpenAI API Key"), "sk-browser-secret");
    await user.clear(screen.getByLabelText("OpenAI Base URL"));
    await user.type(screen.getByLabelText("OpenAI Base URL"), "https://api.openai.test/v1");
    await user.click(screen.getByRole("button", { name: "保存 OpenAI 设置" }));
    await user.click(screen.getByRole("button", { name: "生成海报" }));

    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([url]) => url === "https://api.openai.test/v1/images/generations")
      ).toHaveLength(cardCount)
    );
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.test/v1/images/generations",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer sk-browser-secret" }),
        body: expect.stringContaining('"gpt-image-2"'),
      })
    );
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/api/ai/poster/",
      expect.objectContaining({ method: "POST" })
    );
    const browserPosters = await screen.findAllByRole("img", { name: "browser xhs poster" });
    expect(browserPosters).toHaveLength(cardCount);
    expect(browserPosters[0]).toHaveAttribute("src", "data:image/png;base64,browser-poster-base64");
  });

  it("generates downloadable template poster images in local mode", async () => {
    const user = userEvent.setup();
    await renderHome();

    await user.click(screen.getByRole("button", { name: "生成海报" }));

    const templatePosters = await screen.findAllByRole("img", { name: /模板海报/ });
    expect(templatePosters[0]).toHaveAttribute(
      "src",
      expect.stringMatching(/^data:image\/svg\+xml/)
    );
    expect(screen.getAllByRole("link", { name: "下载" })[0]).toHaveAttribute(
      "download",
      expect.stringContaining("xhs-poster-1")
    );
    expect(screen.getByText("素材清单")).toBeInTheDocument();
  });

  it("shares the publish package through the mobile Web Share API", async () => {
    const user = userEvent.setup();
    const shareMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "share", {
      value: shareMock,
      configurable: true,
    });
    await renderHome();

    await user.click(screen.getByRole("button", { name: "手机分享" }));

    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringContaining("敏感肌修护"),
        text: expect.stringContaining("#敏感肌"),
      })
    );
    expect(screen.getByRole("button", { name: "已唤起" })).toBeInTheDocument();
  });

  it("rewrites compliance issues with the local sanitized text", async () => {
    const user = userEvent.setup();
    await renderHome();

    await user.clear(screen.getByLabelText("合规检测文本"));
    await user.type(screen.getByLabelText("合规检测文本"), "全网最低，7天瘦10斤。");
    await user.click(screen.getByRole("button", { name: "合规改写" }));

    expect(screen.getByLabelText("合规检测文本")).toHaveValue("近期价格友好，记录阶段性变化。");
    expect(screen.getByText("本地规则已改写")).toBeInTheDocument();
  });

  it("uses OpenAI to rewrite compliance issues when OpenAI mode is selected", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        rewrittenText: "这个收纳方案对我来说更省心，适合先从入口区试起。",
        changeNotes: ["删除绝对化承诺"],
        compliance: { riskLevel: "low", issues: [], sanitizedText: "ok" },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await renderHome();

    await user.selectOptions(screen.getByLabelText("生成模式"), "openai");
    await user.clear(screen.getByLabelText("合规检测文本"));
    await user.type(screen.getByLabelText("合规检测文本"), "这个收纳方案不踩坑，全网最低。");
    await user.click(screen.getByRole("button", { name: "合规改写" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/compliance-rewrite/",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("不踩坑"),
      })
    );
    expect(await screen.findByDisplayValue("这个收纳方案对我来说更省心，适合先从入口区试起。")).toBeInTheDocument();
    expect(screen.getByText("OpenAI 已合规改写")).toBeInTheDocument();
  });

  it("creates a mobile publish card link from the publish queue", async () => {
    const user = userEvent.setup();
    const clipboardMock = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: clipboardMock },
      configurable: true,
    });
    window.history.replaceState(null, "", `${window.location.origin}/xhs-ops-tool/`);
    await renderHome();

    await user.click(screen.getByRole("button", { name: "生成海报" }));
    await user.click(screen.getByRole("button", { name: "生成手机卡" }));

    const link = screen.getByRole("link", { name: "打开手机卡" });
    expect(link).toHaveAttribute("href", expect.stringContaining("#publish-card="));
    expect(clipboardMock).toHaveBeenCalledWith(expect.stringContaining("#publish-card="));
    const copiedUrl = String(clipboardMock.mock.calls.at(-1)?.[0] ?? "");
    const encodedPayload = copiedUrl.split("#publish-card=")[1];
    const decodedPayload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
    expect(decodedPayload.assetPreviews.length).toBeGreaterThan(0);
    expect(decodedPayload.assetPreviews[0]).toMatchObject({
      fileName: expect.stringContaining("xhs-poster-1"),
      source: "template",
    });
    expect(screen.getByText("手机卡已生成")).toBeInTheDocument();
  });

  it("opens a mobile publish card from the URL hash", async () => {
    const user = userEvent.setup();
    const clipboardMock = vi.fn().mockResolvedValue(undefined);
    const shareMock = vi.fn().mockResolvedValue(undefined);
    const canShareMock = vi.fn().mockReturnValue(true);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText: clipboardMock },
      configurable: true,
    });
    Object.defineProperty(window.navigator, "share", {
      value: shareMock,
      configurable: true,
    });
    Object.defineProperty(window.navigator, "canShare", {
      value: canShareMock,
      configurable: true,
    });
    const posterUrl = "data:image/svg+xml;charset=utf-8,%3Csvg%3Eposter%3C%2Fsvg%3E";
    const payload = {
      version: 1,
      title: "租房收纳别乱买，先做这 4 步",
      body: "先看入口区，再看柜内空间。",
      hashtags: ["租房收纳", "小户型"],
      exportText: "租房收纳别乱买，先做这 4 步\n\n先看入口区，再看柜内空间。\n\n#租房收纳 #小户型",
      officialPublishUrl: "https://creator.xiaohongshu.com/publish/publish",
      xhsAppPublishUrl: "xhsdiscover://post",
      scheduledAt: "2026-07-07T12:30:00.000Z",
      checklist: ["确认素材已保存"],
      assetManifest: [{ fileName: "xhs-poster-1.svg", source: "template" }],
      assetPreviews: [
        {
          cardId: "card-1",
          fileName: "xhs-poster-1.svg",
          mimeType: "image/svg+xml",
          source: "template",
          description: "封面模板海报",
          url: posterUrl,
        },
      ],
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    window.history.replaceState(null, "", `/#publish-card=${encoded}`);

    await renderHome();

    expect(screen.getByRole("heading", { name: "手机发布卡" })).toBeInTheDocument();
    expect(screen.getByText("租房收纳别乱买，先做这 4 步")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "封面模板海报" })).toHaveAttribute("src", posterUrl);
    expect(screen.getByRole("link", { name: "下载素材" })).toHaveAttribute("download", "xhs-poster-1.svg");
    const copyAndOpen = screen.getByRole("link", { name: "复制并打开小红书" });
    expect(copyAndOpen).toHaveAttribute("href", "xhsdiscover://post");
    copyAndOpen.addEventListener("click", (event) => event.preventDefault(), { once: true });
    await user.click(copyAndOpen);
    expect(clipboardMock).toHaveBeenCalledWith(payload.exportText);
    await user.click(screen.getByRole("button", { name: "系统分享" }));
    expect(canShareMock).toHaveBeenCalledWith(expect.objectContaining({ files: expect.any(Array) }));
    expect(shareMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: payload.title,
        text: payload.exportText,
        files: expect.arrayContaining([expect.objectContaining({ name: "xhs-poster-1.svg" })]),
      })
    );
    expect(screen.getByRole("link", { name: "打开小红书" })).toHaveAttribute("href", "xhsdiscover://post");
    expect(screen.getByRole("link", { name: "网页发布" })).toHaveAttribute(
      "href",
      "https://creator.xiaohongshu.com/publish/publish"
    );
  });
});
