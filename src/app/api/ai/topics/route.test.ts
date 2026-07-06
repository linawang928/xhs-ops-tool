import { afterEach, describe, expect, it, vi } from "vitest";
import { demoProject } from "@/lib/sample-data";
import { POST } from "./route";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/ai/topics", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("generates scored topic candidates from OpenAI output", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          output_text: JSON.stringify({
            topics: [
              {
                title: "租房收纳别急着买柜子，先看这 5 个死角",
                angle: "避坑清单",
              },
              {
                title: "小户型一周整理路线：每天 10 分钟",
                angle: "流程模板",
              },
            ],
          }),
        })
      )
    );

    const response = await POST(
      new Request("http://localhost:3000/api/ai/topics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ keyword: "租房收纳", project: demoProject }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.topics).toHaveLength(2);
    expect(payload.topics[0]).toMatchObject({
      keyword: "租房收纳",
      title: "租房收纳别急着买柜子，先看这 5 个死角",
      source: "manual-keyword",
      status: "candidate",
    });
    expect(payload.topics[0].score).toBeGreaterThan(0);
    expect(payload.topics[0].reasons).toContain("选题角度明确");
  });
});
