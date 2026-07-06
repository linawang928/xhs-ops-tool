import { describe, expect, it } from "vitest";
import { scanCompliance } from "./compliance";

describe("compliance guard", () => {
  it("flags risky claims, off-platform traffic, and sensitive efficacy language", () => {
    const result = scanCompliance(
      "全网最低价，100%有效，7天瘦10斤，加微信领取根治敏感肌方案。"
    );

    expect(result.riskLevel).toBe("high");
    expect(result.issues.map((issue) => issue.category)).toEqual(
      expect.arrayContaining([
        "absolute_claim",
        "off_platform",
        "unrealistic_promise",
        "medical_or_finance",
      ])
    );
    expect(result.sanitizedText).not.toContain("全网最低");
    expect(result.sanitizedText).not.toContain("加微信");
    expect(result.sanitizedText).not.toContain("根治");
    expect(result.issues[0].suggestion.length).toBeGreaterThan(0);
  });

  it("merges project custom forbidden words into the scan", () => {
    const result = scanCompliance("这套方案适合懒人躺赚。", ["躺赚"]);

    expect(result.riskLevel).toBe("medium");
    expect(result.issues[0]).toMatchObject({
      term: "躺赚",
      category: "custom_forbidden",
    });
  });
});
