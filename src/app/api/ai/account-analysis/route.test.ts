import { afterEach, describe, expect, it, vi } from "vitest";
import { demoProject } from "@/lib/sample-data";
import { POST } from "./route";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/ai/account-analysis", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("generates account homepage analysis through OpenAI and keeps workflow filters", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        output_text: JSON.stringify({
          inferredSubjectArea: "家居收纳",
          inferredAudience: "租房党和小户型新手",
          valuePromise: "把低预算收纳拆成能照做的空间清单",
          toneKeywords: ["清爽", "实用", "像朋友提醒"],
          contentPillars: ["空间痛点避坑", "低预算清单", "复盘改造", "评论区答疑"],
          strengths: ["人群清楚", "收藏价值强"],
          risks: ["需要避免夸大改造效果"],
          opportunities: ["可以做租房动线系列"],
          nextActions: ["先按家居收纳筛选对标内容", "优先拆解避坑清单"],
        }),
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost:3000/api/ai/account-analysis", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project: demoProject,
          profile: {
            projectId: demoProject.id,
            displayName: "租房收纳小记",
            bio: "给租房党做低预算收纳清单。",
            recentNotesText: "租房收纳避坑清单\n小户型整理流程",
          },
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.openai.com/v1/responses",
      expect.objectContaining({ method: "POST" })
    );
    expect(payload.analysis).toMatchObject({
      inferredSubjectArea: "家居收纳",
      inferredAudience: "租房党和小户型新手",
      benchmarkFilters: {
        subjectArea: "家居收纳",
      },
    });
    expect(payload.analysis.benchmarkFilters.contentFormats).toContain("避坑清单");
    expect(payload.positioningInput).toMatchObject({
      subjectArea: "家居收纳",
      audience: "租房党和小户型新手",
    });
  });
});
