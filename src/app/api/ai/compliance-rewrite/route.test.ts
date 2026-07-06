import { afterEach, describe, expect, it, vi } from "vitest";
import { demoProject } from "@/lib/sample-data";
import { POST } from "./route";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/ai/compliance-rewrite", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rewrites risky copy into a compliant publish-ready version", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          output_text: JSON.stringify({
            rewrittenText: "这个收纳方案对我来说更省心，适合先从入口区试起。",
            changeNotes: ["删除绝对化承诺", "改成个人体验表达"],
          }),
        })
      )
    );

    const response = await POST(
      new Request("http://localhost:3000/api/ai/compliance-rewrite", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project: { ...demoProject, forbiddenWords: ["不踩坑"] },
          text: "这个收纳方案不踩坑，全网最低。",
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.rewrittenText).toBe("这个收纳方案对我来说更省心，适合先从入口区试起。");
    expect(payload.compliance.riskLevel).toBe("low");
    expect(payload.changeNotes).toContain("删除绝对化承诺");
  });
});
