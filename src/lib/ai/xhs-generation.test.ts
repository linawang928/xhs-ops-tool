import { describe, expect, it, vi } from "vitest";
import { demoBenchmark, demoDraft, demoProject, demoRawBenchmark, demoTopics } from "@/lib/sample-data";
import {
  analyzeXhsBenchmarkWithOpenAI,
  generateXhsDraftWithOpenAI,
  generateXhsPosterWithOpenAI,
  generateXhsTopicsWithOpenAI,
} from "./xhs-generation";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

describe("xhs OpenAI generation helpers", () => {
  it("generates ranked XHS topics through the configured OpenAI-compatible endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        output_text: JSON.stringify({
          topics: [
            {
              title: "租房收纳别急着买柜子，先看这 5 个死角",
              angle: "避坑清单",
            },
            {
              title: "小户型入口区 10 分钟复位流程",
              angle: "流程模板",
            },
            {
              title: "同价位收纳盒怎么选：3 个维度对比",
              angle: "测评对比",
            },
          ],
        }),
      })
    );

    const topics = await generateXhsTopicsWithOpenAI({
      keyword: "租房收纳",
      project: demoProject,
      settings: {
        apiKey: "sk-browser",
        baseUrl: "https://api.openai.test/v1",
        textModel: "gpt-5.5",
      },
      fetcher,
    });

    expect(topics[0]).toMatchObject({
      keyword: "租房收纳",
      title: "租房收纳别急着买柜子，先看这 5 个死角",
      angle: "避坑清单",
      status: "candidate",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.test/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ authorization: "Bearer sk-browser" }),
        body: expect.stringContaining('"model":"gpt-5.5"'),
      })
    );
  });

  it("generates a compliant XHS draft and card scripts through OpenAI", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        output_text: JSON.stringify({
          titleOptions: ["租房收纳别乱买，先做这 4 步", "小户型入口区复位清单"],
          body: "如果你每次整理完又很快复乱，先别急着买新柜子。\n先看入口区，再看柜内空间。",
          hashtags: ["租房收纳", "小户型", "收纳清单"],
          cardScripts: [
            {
              role: "cover",
              title: "别急着买柜子",
              subtitle: "先排查入口区",
              bullets: ["钥匙固定", "快递暂存", "包有落点"],
            },
            {
              role: "steps",
              title: "4 步复位",
              subtitle: "每天 3 分钟",
              bullets: ["先清空", "再分区", "最后贴标签"],
            },
          ],
        }),
      })
    );

    const draft = await generateXhsDraftWithOpenAI({
      project: demoProject,
      topic: demoTopics[0],
      benchmarks: [demoBenchmark],
      settings: {
        apiKey: "sk-browser",
        baseUrl: "https://api.openai.test/v1",
        textModel: "gpt-5.5",
      },
      fetcher,
    });

    expect(draft.selectedTitle).toBe("租房收纳别乱买，先做这 4 步");
    expect(draft.body).toContain("先看入口区");
    expect(draft.hashtags).toEqual(["租房收纳", "小户型", "收纳清单"]);
    expect(draft.assetCards[0]).toMatchObject({
      role: "cover",
      title: "别急着买柜子",
    });
    expect(draft.compliance.riskLevel).toBe("low");
  });

  it("analyzes benchmark notes through OpenAI and preserves the imported note metadata", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        output_text: JSON.stringify({
          title: "租房收纳别急着买柜子，先看这 5 个死角",
          openingHook: "一开头先拦住冲动购买的人群。",
          structure: ["痛点开场", "步骤清单", "互动收尾"],
          tags: ["租房收纳", "小户型", "收纳避坑"],
          sellingPoints: ["先看入口区", "再看柜内死角", "最后看预算"],
          interactionCues: ["评论区补充你家最乱的位置"],
        }),
      })
    );

    const benchmark = await analyzeXhsBenchmarkWithOpenAI({
      project: demoProject,
      note: {
        ...demoRawBenchmark,
        id: "bench-ai-rent-storage",
        title: "租房收纳别急着买柜子，先看这 5 个死角",
      },
      settings: {
        apiKey: "sk-browser",
        baseUrl: "https://api.openai.test/v1",
        textModel: "gpt-5.5",
      },
      fetcher,
    });

    expect(benchmark).toMatchObject({
      id: "bench-ai-rent-storage",
      projectId: demoProject.id,
      title: "租房收纳别急着买柜子，先看这 5 个死角",
      analysis: {
        openingHook: "一开头先拦住冲动购买的人群。",
        structure: ["痛点开场", "步骤清单", "互动收尾"],
        tags: ["租房收纳", "小户型", "收纳避坑"],
        sellingPoints: ["先看入口区", "再看柜内死角", "最后看预算"],
        interactionCues: ["评论区补充你家最乱的位置"],
      },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.test/v1/responses",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("xhs_benchmark_analysis"),
      })
    );
  });

  it("generates a GPT Image poster asset for the selected draft card", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "poster-base64", revised_prompt: "clean xhs poster" }],
      })
    );

    const image = await generateXhsPosterWithOpenAI({
      project: demoProject,
      draft: demoDraft,
      cardId: demoDraft.assetCards[0].id,
      settings: {
        apiKey: "sk-browser",
        baseUrl: "https://api.openai.test/v1",
        imageModel: "gpt-image-2",
      },
      fetcher,
    });

    expect(image).toMatchObject({
      url: "data:image/png;base64,poster-base64",
      alt: "clean xhs poster",
      source: "openai",
      fileName: "xhs-ai-poster-1.png",
      mimeType: "image/png",
      width: 1024,
      height: 1536,
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.test/v1/images/generations",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"model":"gpt-image-2"'),
      })
    );
  });
});
