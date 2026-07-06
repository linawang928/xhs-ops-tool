import { describe, expect, it } from "vitest";
import { demoDraft, demoProject } from "@/lib/sample-data";
import { createTemplatePosterAssets, renderAssetCardSvg } from "./poster-template";

describe("poster template generation", () => {
  it("renders an XHS 3:4 SVG poster from an asset card", () => {
    const svg = renderAssetCardSvg(demoDraft.assetCards[0], demoDraft, demoProject);

    expect(svg).toContain("<svg");
    expect(svg).toContain('viewBox="0 0 1080 1440"');
    expect(svg).toContain(demoDraft.assetCards[0].title);
    expect(svg).toContain(demoProject.brandColors[0]);
    expect(svg).not.toContain("<script");
  });

  it("creates downloadable data-url poster assets for all draft cards", () => {
    const posters = createTemplatePosterAssets(demoDraft, demoProject);

    expect(posters).toHaveLength(demoDraft.assetCards.length);
    expect(posters[0]).toMatchObject({
      cardId: demoDraft.assetCards[0].id,
      draftId: demoDraft.id,
      source: "template",
      mimeType: "image/svg+xml",
      width: 1080,
      height: 1440,
    });
    expect(posters[0].fileName).toContain("xhs-poster-1");
    expect(posters[0].url).toMatch(/^data:image\/svg\+xml;charset=utf-8,/);
  });
});
