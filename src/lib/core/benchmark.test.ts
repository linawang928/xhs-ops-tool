import { describe, expect, it } from "vitest";
import { analyzeBenchmarkNote } from "./benchmark";

describe("benchmark lab", () => {
  it("extracts hook, structure, tags, selling points, and interaction cues", () => {
    const note = analyzeBenchmarkNote({
      id: "note-1",
      projectId: "project-1",
      sourceUrl: "https://www.xiaohongshu.com/explore/mock",
      title: "敏感肌修护别乱买，先看这 4 个成分",
      author: "成分笔记",
      body: "脸颊反复泛红的时候，我最怕被一句话种草。\n1. 先看屏障脂质\n2. 再看舒缓成分\n3. 最后看使用频率\n你们最近还踩过哪些坑？评论区互相避雷。\n#敏感肌 #屏障修护 #护肤避坑",
      metrics: { likes: 3200, saves: 2100, comments: 188 },
      importedAt: "2026-07-06T10:00:00.000Z",
    });

    expect(note.analysis.openingHook).toBe("脸颊反复泛红的时候，我最怕被一句话种草。");
    expect(note.analysis.structure).toContain("痛点开场");
    expect(note.analysis.structure).toContain("步骤清单");
    expect(note.analysis.tags).toEqual(["敏感肌", "屏障修护", "护肤避坑"]);
    expect(note.analysis.sellingPoints).toContain("屏障脂质");
    expect(note.analysis.interactionCues).toContain("评论区互相避雷");
  });
});
