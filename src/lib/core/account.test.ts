import { describe, expect, it } from "vitest";
import { filterBenchmarkCandidates, generateAccountPositioning } from "./account";
import type { BenchmarkCandidate } from "./types";

const benchmarkCandidates: BenchmarkCandidate[] = [
  {
    id: "bench-skincare-1",
    projectId: "project-1",
    title: "敏感肌修护别乱买，先看这 4 个成分",
    author: "成分笔记",
    subjectArea: "护肤",
    contentFormat: "避坑清单",
    audiencePain: "敏感肌新手不知道怎么判断屏障状态",
    tags: ["敏感肌", "屏障修护", "护肤避坑"],
    metrics: { likes: 3200, saves: 2100, comments: 188 },
  },
  {
    id: "bench-skincare-2",
    projectId: "project-1",
    title: "油敏肌早八护肤流程，3 分钟出门",
    author: "早八研究所",
    subjectArea: "护肤",
    contentFormat: "流程模板",
    audiencePain: "通勤前时间少但又怕泛红",
    tags: ["油敏肌", "早八", "护肤流程"],
    metrics: { likes: 2400, saves: 1600, comments: 132 },
  },
  {
    id: "bench-local-1",
    projectId: "project-1",
    title: "周末上海咖啡路线，三家都适合拍照",
    author: "城市散步",
    subjectArea: "本地生活",
    contentFormat: "路线合集",
    audiencePain: "周末不知道去哪玩",
    tags: ["上海探店", "咖啡", "周末"],
    metrics: { likes: 4600, saves: 900, comments: 90 },
  },
];

describe("account positioning", () => {
  it("generates account name, bio, and positioning options from subject inputs", () => {
    const positioning = generateAccountPositioning({
      projectId: "project-1",
      subjectArea: "护肤",
      audience: "25-35 岁的成分护肤新手",
      differentiator: "把复杂成分翻译成能执行的日常判断",
      tone: "真诚、克制、有细节",
    });

    expect(positioning.subjectArea).toBe("护肤");
    expect(positioning.nameOptions).toHaveLength(3);
    expect(positioning.bioOptions).toHaveLength(3);
    expect(positioning.positioningStatement).toContain("25-35 岁的成分护肤新手");
    expect(positioning.positioningStatement).toContain("把复杂成分翻译成能执行的日常判断");
    expect(positioning.contentPillars).toEqual(
      expect.arrayContaining(["痛点避坑", "流程模板", "评论区问题复盘"])
    );
  });

  it("filters benchmark candidates by account subject area and content format", () => {
    const positioning = generateAccountPositioning({
      projectId: "project-1",
      subjectArea: "护肤",
      audience: "25-35 岁的成分护肤新手",
      differentiator: "把复杂成分翻译成能执行的日常判断",
      tone: "真诚、克制、有细节",
    });

    const filtered = filterBenchmarkCandidates(benchmarkCandidates, positioning, {
      subjectArea: "护肤",
      contentFormat: "避坑清单",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({
      id: "bench-skincare-1",
      subjectArea: "护肤",
      contentFormat: "避坑清单",
    });
    expect(filtered[0].matchScore).toBeGreaterThanOrEqual(85);
    expect(filtered[0].matchReasons).toContain("主体区一致");
  });

  it("keeps all content formats when only subject area is selected", () => {
    const positioning = generateAccountPositioning({
      projectId: "project-1",
      subjectArea: "护肤",
      audience: "25-35 岁的成分护肤新手",
      differentiator: "把复杂成分翻译成能执行的日常判断",
      tone: "真诚、克制、有细节",
    });

    const filtered = filterBenchmarkCandidates(benchmarkCandidates, positioning, {
      subjectArea: "护肤",
      contentFormat: "全部",
    });

    expect(filtered.map((candidate) => candidate.id)).toEqual([
      "bench-skincare-1",
      "bench-skincare-2",
    ]);
    expect(filtered.every((candidate) => candidate.subjectArea === "护肤")).toBe(true);
  });
});
