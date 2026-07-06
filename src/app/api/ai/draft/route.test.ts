import { afterEach, describe, expect, it, vi } from "vitest";
import { demoBenchmark, demoProject, demoTopics } from "@/lib/sample-data";
import { POST } from "./route";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/ai/draft", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("generates a compliant XHS draft and card script from OpenAI output", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          output_text: JSON.stringify({
            titleOptions: ["租房收纳别乱买，先做这 4 步", "小户型收纳自查清单"],
            body: "如果你每次整理完又很快复乱，先别急着买新柜子。\n1. 先找高频动线\n2. 再处理台面堆积\n3. 最后固定复盘日\n收藏起来，下次照着检查。",
            hashtags: ["租房收纳", "小户型", "收纳避坑"],
            cardScripts: [
              {
                role: "cover",
                title: "租房收纳",
                subtitle: "先做这 4 步",
                bullets: ["不急着买柜子", "先看动线"],
              },
              {
                role: "steps",
                title: "执行顺序",
                subtitle: "每天 10 分钟",
                bullets: ["入口区", "台面", "衣柜"],
              },
            ],
          }),
        })
      )
    );

    const response = await POST(
      new Request("http://localhost:3000/api/ai/draft", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project: demoProject,
          topic: { ...demoTopics[0], keyword: "租房收纳" },
          benchmarks: [demoBenchmark],
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.draft.selectedTitle).toBe("租房收纳别乱买，先做这 4 步");
    expect(payload.draft.body).toContain("先找高频动线");
    expect(payload.draft.hashtags).toContain("租房收纳");
    expect(payload.draft.assetCards[0]).toMatchObject({
      role: "cover",
      title: "租房收纳",
      subtitle: "先做这 4 步",
    });
    expect(payload.draft.compliance.riskLevel).toBe("low");
  });
});
