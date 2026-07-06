import { describe, expect, it } from "vitest";
import { analyzeAccountHomepage } from "./account-homepage";

describe("account homepage analysis", () => {
  it("infers positioning and benchmark filters from a pasted xhs profile", () => {
    const analysis = analyzeAccountHomepage({
      projectId: "project-1",
      profileUrl: "https://www.xiaohongshu.com/user/profile/mock",
      displayName: "租房收纳小记",
      bio: "给租房党和小户型新手做低预算收纳清单，不乱买柜子。",
      recentNotesText:
        "租房收纳别急着买柜子，先看这 5 个死角\n小户型入口区避坑清单\n每天 10 分钟整理流程，评论区很多人问预算怎么控",
    });

    expect(analysis.inferredSubjectArea).toBe("家居收纳");
    expect(analysis.inferredAudience).toContain("租房党");
    expect(analysis.valuePromise).toContain("低预算");
    expect(analysis.contentPillars).toEqual(
      expect.arrayContaining(["空间痛点避坑", "低预算清单"])
    );
    expect(analysis.benchmarkFilters.subjectArea).toBe("家居收纳");
    expect(analysis.benchmarkFilters.contentFormats).toContain("避坑清单");
    expect(analysis.profileHealthScore).toBeGreaterThanOrEqual(70);
    expect(analysis.nextActions.join(" ")).toContain("对标");
  });
});
