import { afterEach, describe, expect, it, vi } from "vitest";
import { GET } from "./route";

describe("GET /api/ai/status", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports server OpenAI readiness without exposing secrets", async () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test-secret");
    vi.stubEnv("OPENAI_TEXT_MODEL", "gpt-5.5");
    vi.stubEnv("OPENAI_IMAGE_MODEL", "gpt-image-2");

    const response = await GET();
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({
      serverApiAvailable: true,
      hasOpenAIKey: true,
      textModel: "gpt-5.5",
      imageModel: "gpt-image-2",
      features: {
        structuredText: true,
        posterImage: true,
      },
    });
    expect(JSON.stringify(payload)).not.toContain("sk-test-secret");
  });

  it("marks GPT features unavailable when the OpenAI key is missing", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");

    const response = await GET();
    const payload = await response.json();

    expect(payload.hasOpenAIKey).toBe(false);
    expect(payload.features.structuredText).toBe(false);
    expect(payload.features.posterImage).toBe(false);
  });
});
