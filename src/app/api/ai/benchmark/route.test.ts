import { describe, expect, it, vi } from "vitest";
import { demoProject, demoRawBenchmark } from "@/lib/sample-data";
import { POST } from "./route";

describe("POST /api/ai/benchmark", () => {
  it("analyzes a benchmark note through OpenAI and returns a normalized benchmark", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          output_text: JSON.stringify({
            title: "敏感肌修护别乱买，先看这 4 个成分",
            openingHook: "先把反复泛红放进具体场景。",
            structure: ["痛点开场", "步骤清单", "互动收尾"],
            tags: ["敏感肌", "屏障修护", "护肤避坑"],
            sellingPoints: ["屏障脂质", "舒缓成分", "使用频率"],
            interactionCues: ["评论区互相避雷"],
          }),
        }),
      })
    );

    const response = await POST(
      new Request("http://localhost:3000/api/ai/benchmark", {
        method: "POST",
        body: JSON.stringify({
          project: demoProject,
          note: demoRawBenchmark,
        }),
      })
    );

    const payload = await response.json();
    expect(response.status).toBe(200);
    expect(payload.benchmark).toMatchObject({
      id: demoRawBenchmark.id,
      title: "敏感肌修护别乱买，先看这 4 个成分",
      analysis: {
        openingHook: "先把反复泛红放进具体场景。",
        structure: ["痛点开场", "步骤清单", "互动收尾"],
        tags: ["敏感肌", "屏障修护", "护肤避坑"],
        sellingPoints: ["屏障脂质", "舒缓成分", "使用频率"],
        interactionCues: ["评论区互相避雷"],
      },
    });
  });
});
