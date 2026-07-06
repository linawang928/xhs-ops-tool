import { describe, expect, it } from "vitest";
import { demoDraft, demoPublishTask } from "@/lib/sample-data";
import type { GeneratedPosterAsset } from "./types";
import {
  XHS_APP_PUBLISH_URL,
  createMobilePublishCardPayload,
  createMobilePublishCardUrl,
  decodeMobilePublishCardHash,
} from "./publish-card";

describe("mobile publish card", () => {
  it("encodes a publish package into a shareable hash URL", () => {
    const payload = createMobilePublishCardPayload(demoPublishTask, demoDraft);
    const url = createMobilePublishCardUrl(payload, {
      origin: "https://linawang928.github.io",
      pathname: "/xhs-ops-tool/",
    });

    expect(payload).toMatchObject({
      version: 1,
      title: demoDraft.selectedTitle,
      exportText: demoPublishTask.exportText,
      officialPublishUrl: demoPublishTask.officialPublishUrl,
      xhsAppPublishUrl: XHS_APP_PUBLISH_URL,
    });
    expect(url).toMatch(/^https:\/\/linawang928\.github\.io\/xhs-ops-tool\/#publish-card=/);

    const decoded = decodeMobilePublishCardHash(url.split("#")[1]);
    expect(decoded).toMatchObject({
      title: demoDraft.selectedTitle,
      hashtags: demoDraft.hashtags,
      exportText: demoPublishTask.exportText,
    });
  });

  it("embeds lightweight poster previews and omits oversized image data", () => {
    const lightweightPoster: GeneratedPosterAsset = {
      id: "template-card-1",
      cardId: demoDraft.assetCards[0].id,
      draftId: demoDraft.id,
      source: "template",
      url: "data:image/svg+xml;charset=utf-8,%3Csvg%3Eposter%3C%2Fsvg%3E",
      alt: "封面模板海报",
      fileName: "xhs-poster-1.svg",
      mimeType: "image/svg+xml",
      width: 1080,
      height: 1440,
    };
    const oversizedPoster: GeneratedPosterAsset = {
      ...lightweightPoster,
      id: "openai-card-1",
      source: "openai",
      url: `data:image/png;base64,${"x".repeat(160_000)}`,
      alt: "GPT 海报",
      fileName: "xhs-ai-poster-1.png",
      mimeType: "image/png",
    };

    const payload = createMobilePublishCardPayload(demoPublishTask, demoDraft, [
      lightweightPoster,
      oversizedPoster,
    ]);

    expect(payload.assetPreviews).toEqual([
      {
        cardId: lightweightPoster.cardId,
        fileName: "xhs-poster-1.svg",
        mimeType: "image/svg+xml",
        source: "template",
        description: "封面模板海报",
        url: lightweightPoster.url,
      },
    ]);
  });
});
