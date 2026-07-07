import { afterEach, describe, expect, it, vi } from "vitest";
import { demoDraft, demoProject } from "@/lib/sample-data";
import { POST } from "./route";

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/ai/poster", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("generates a poster image data URL from the selected draft card", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "poster-base64", revised_prompt: "xhs cover poster" }],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost:3000/api/ai/poster", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project: demoProject,
          draft: demoDraft,
          cardId: demoDraft.assetCards[0].id,
        }),
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.image).toMatchObject({
      id: `openai-${demoDraft.assetCards[0].id}`,
      url: "data:image/png;base64,poster-base64",
      alt: "xhs cover poster",
      cardId: demoDraft.assetCards[0].id,
      draftId: demoDraft.id,
      source: "openai",
      fileName: "xhs-ai-poster-1.png",
      mimeType: "image/png",
      width: 1024,
      height: 1536,
    });
    expect(fetchMock.mock.calls[0][1].body).toContain("小红书图文封面");
    expect(fetchMock.mock.calls[0][1].body).toContain(demoDraft.assetCards[0].title);
  });

  it("passes an operator-edited prompt to GPT Image generation", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "poster-base64", revised_prompt: "custom xhs poster" }],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(
      new Request("http://localhost:3000/api/ai/poster", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          project: demoProject,
          draft: demoDraft,
          cardId: demoDraft.assetCards[0].id,
          promptOverride: "竖版高质感海报，保留大标题，背景用浅绿色纹理",
        }),
      })
    );

    expect(response.status).toBe(200);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0][1].body ?? "{}")) as {
      prompt: string;
    };
    expect(requestBody.prompt).toBe("竖版高质感海报，保留大标题，背景用浅绿色纹理");
    expect(requestBody.prompt).not.toContain("小红书图文封面");
  });
});
