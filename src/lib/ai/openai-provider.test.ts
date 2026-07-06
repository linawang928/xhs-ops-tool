import { describe, expect, it, vi } from "vitest";
import { generatePosterImage, generateStructuredText } from "./openai-provider";

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

describe("openai provider", () => {
  it("sends structured text requests to the Responses API without exposing the API key", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        output_text: JSON.stringify({ title: "租房收纳避坑清单", tags: ["租房", "收纳"] }),
      })
    );

    const result = await generateStructuredText<{ title: string; tags: string[] }>({
      apiKey: "sk-test",
      model: "gpt-5.5",
      baseUrl: "https://api.openai.test/v1",
      fetcher,
      systemPrompt: "你是小红书运营专家。",
      userPrompt: "生成一个标题和标签。",
      schemaName: "xhs_topic",
      schema: {
        type: "object",
        additionalProperties: false,
        required: ["title", "tags"],
        properties: {
          title: { type: "string" },
          tags: { type: "array", items: { type: "string" } },
        },
      },
    });

    expect(result).toEqual({ title: "租房收纳避坑清单", tags: ["租房", "收纳"] });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.test/v1/responses",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          authorization: "Bearer sk-test",
          "content-type": "application/json",
        }),
      })
    );
    expect(JSON.stringify(result)).not.toContain("sk-test");
  });

  it("requires an API key before making text requests", async () => {
    const fetcher = vi.fn();

    await expect(
      generateStructuredText({
        apiKey: "",
        fetcher,
        systemPrompt: "系统提示",
        userPrompt: "用户提示",
        schemaName: "empty",
        schema: { type: "object", additionalProperties: false, properties: {} },
      })
    ).rejects.toThrow("OPENAI_API_KEY");

    expect(fetcher).not.toHaveBeenCalled();
  });

  it("generates poster images with GPT Image and returns a browser-ready data URL", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      jsonResponse({
        data: [{ b64_json: "iVBORw0KGgo=", revised_prompt: "clean poster" }],
      })
    );

    const image = await generatePosterImage({
      apiKey: "sk-test",
      model: "gpt-image-2",
      baseUrl: "https://api.openai.test/v1",
      fetcher,
      prompt: "生成小红书封面海报",
      aspectRatio: "3:4",
    });

    expect(image).toEqual({
      url: "data:image/png;base64,iVBORw0KGgo=",
      alt: "clean poster",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.openai.test/v1/images/generations",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining('"model":"gpt-image-2"'),
      })
    );
    const body = JSON.parse(String(fetcher.mock.calls[0][1].body));
    expect(body).toMatchObject({
      model: "gpt-image-2",
      prompt: "生成小红书封面海报",
      size: "1024x1536",
      output_format: "png",
    });
    expect(body).not.toHaveProperty("response_format");
  });
});
