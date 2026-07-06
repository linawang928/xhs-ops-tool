import { describe, expect, it } from "vitest";
import { generateTopicCandidates, rankTopicCandidates } from "./topic";
import type { Project } from "./types";

const project: Project = {
  id: "project-1",
  name: "轻量护肤账号",
  persona: "像朋友一样给新手做护肤决策辅助",
  industry: "护肤",
  tone: "真诚、克制、有细节",
  audience: "25-35 岁的成分护肤新手",
  forbiddenWords: ["全网最低", "根治"],
  brandColors: ["#E85D75", "#2E6B5F", "#F6C85F"],
};

describe("topic lab", () => {
  it("generates scored topic candidates from a keyword and project context", () => {
    const candidates = generateTopicCandidates("敏感肌修护", project);

    expect(candidates).toHaveLength(5);
    expect(candidates[0]).toMatchObject({
      keyword: "敏感肌修护",
      source: "manual-keyword",
      status: "candidate",
    });
    expect(candidates[0].score).toBeGreaterThanOrEqual(80);
    expect(candidates[0].angle).toContain("痛点");
    expect(candidates.every((candidate) => candidate.projectId === project.id)).toBe(true);
  });

  it("ranks manually imported candidates by engagement and keyword fit", () => {
    const ranked = rankTopicCandidates([
      {
        id: "low",
        projectId: project.id,
        keyword: "敏感肌",
        title: "我的护肤空瓶记录",
        angle: "经验分享",
        source: "manual-import",
        score: 0,
        status: "candidate",
        metrics: { likes: 110, saves: 40, comments: 8 },
        reasons: [],
      },
      {
        id: "high",
        projectId: project.id,
        keyword: "敏感肌",
        title: "敏感肌屏障修护避坑清单",
        angle: "痛点清单",
        source: "manual-import",
        score: 0,
        status: "candidate",
        metrics: { likes: 2600, saves: 1800, comments: 146 },
        reasons: [],
      },
    ]);

    expect(ranked[0].id).toBe("high");
    expect(ranked[0].score).toBeGreaterThan(ranked[1].score);
    expect(ranked[0].reasons).toContain("收藏权重高");
  });
});
