import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import Home from "./page";

async function renderHome(
  searchParams: Promise<Record<string, string | string[] | undefined>> = Promise.resolve({})
) {
  render(await Home({ searchParams }));
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

  it("generates and previews an OpenAI poster image", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        image: {
          url: "data:image/png;base64,poster-base64",
          alt: "xhs cover poster",
          cardId: "draft-topic-ai-card-1",
        },
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await renderHome();

    await user.selectOptions(screen.getByLabelText("生成模式"), "openai");
    await user.click(screen.getByRole("button", { name: "生成海报" }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/ai/poster/",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("assetCards"),
      })
    );
    expect(await screen.findByRole("img", { name: "xhs cover poster" })).toHaveAttribute(
      "src",
      "data:image/png;base64,poster-base64"
    );
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

    await user.click(screen.getByRole("button", { name: "生成手机卡" }));

    const link = screen.getByRole("link", { name: "打开手机卡" });
    expect(link).toHaveAttribute("href", expect.stringContaining("#publish-card="));
    expect(clipboardMock).toHaveBeenCalledWith(expect.stringContaining("#publish-card="));
    expect(screen.getByText("手机卡已生成")).toBeInTheDocument();
  });

  it("opens a mobile publish card from the URL hash", async () => {
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
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    window.history.replaceState(null, "", `/#publish-card=${encoded}`);

    await renderHome();

    expect(screen.getByRole("heading", { name: "手机发布卡" })).toBeInTheDocument();
    expect(screen.getByText("租房收纳别乱买，先做这 4 步")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "打开小红书" })).toHaveAttribute("href", "xhsdiscover://post");
    expect(screen.getByRole("link", { name: "网页发布" })).toHaveAttribute(
      "href",
      "https://creator.xiaohongshu.com/publish/publish"
    );
  });
});
