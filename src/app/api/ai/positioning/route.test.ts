import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const requestBody = {
  projectId: "project-1",
  subjectArea: "家居收纳",
  audience: "租房党和小户型新手",
  differentiator: "把空间改造拆成低预算、可复用的清单",
  tone: "实用、清爽、像朋友提醒",
};

function makeRequest(body = requestBody) {
  return new Request("http://localhost:3000/api/ai/positioning", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/ai/positioning", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("generates account positioning through OpenAI and normalizes it for the UI", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse({
          output_text: JSON.stringify({
            nameOptions: ["小屋有序感", "租房收纳局", "小户型自查室"],
            bioOptions: ["租房党低预算收纳自查，每周给你一张可照做清单。"],
            positioningStatement: "面向租房党，用清爽实用的表达，把收纳改造成可执行清单。",
            contentPillars: ["低预算改造", "空间动线", "收纳避坑", "复盘清单"],
          }),
        })
      )
    );

    const response = await POST(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.positioning).toMatchObject({
      projectId: "project-1",
      subjectArea: "家居收纳",
      audience: "租房党和小户型新手",
      selectedName: "小屋有序感",
      selectedBio: "租房党低预算收纳自查，每周给你一张可照做清单。",
      benchmarkFilters: {
        subjectArea: "家居收纳",
      },
    });
    expect(payload.positioning.nameOptions).toHaveLength(3);
    expect(payload.positioning.contentPillars).toContain("收纳避坑");
  });

  it("returns a helpful configuration error when the API key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = await POST(makeRequest());
    const payload = await response.json();

    expect(response.status).toBe(500);
    expect(payload.error).toContain("OPENAI_API_KEY");
  });
});
