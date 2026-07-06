import { describe, expect, it } from "vitest";
import { generateDraftFromTopic } from "./content";
import type { BenchmarkNote, Project, TopicCandidate } from "./types";

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

const topic: TopicCandidate = {
  id: "topic-1",
  projectId: project.id,
  keyword: "敏感肌修护",
  title: "敏感肌屏障修护避坑清单",
  angle: "痛点清单",
  source: "manual-keyword",
  score: 91,
  status: "selected",
  metrics: { likes: 2600, saves: 1800, comments: 146 },
  reasons: ["收藏权重高", "痛点明确"],
};

const benchmark: BenchmarkNote = {
  id: "bench-1",
  projectId: project.id,
  title: "敏感肌修护别乱买，先看这 4 个成分",
  body: "脸颊反复泛红的时候，我最怕被一句话种草。",
  importedAt: "2026-07-06T10:00:00.000Z",
  analysis: {
    openingHook: "脸颊反复泛红的时候，我最怕被一句话种草。",
    structure: ["痛点开场", "步骤清单"],
    tags: ["敏感肌", "屏障修护"],
    sellingPoints: ["屏障脂质", "舒缓成分"],
    interactionCues: ["评论区互相避雷"],
  },
};

describe("content studio", () => {
  it("creates a complete xhs graphic-note draft from topic and benchmark context", () => {
    const draft = generateDraftFromTopic(topic, project, [benchmark]);

    expect(draft.titleOptions).toHaveLength(3);
    expect(draft.selectedTitle).toContain("敏感肌");
    expect(draft.body).toContain(project.persona);
    expect(draft.hashtags).toContain("敏感肌");
    expect(draft.hashtags.length).toBeLessThanOrEqual(8);
    expect(draft.assetCards).toHaveLength(5);
    expect(draft.assetCards[0]).toMatchObject({
      role: "cover",
      themeColor: project.brandColors[0],
    });
    expect(draft.compliance.riskLevel).toBe("low");
  });
});
