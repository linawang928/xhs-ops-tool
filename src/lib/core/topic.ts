import type { Project, TopicCandidate } from "./types";

const now = "2026-07-06T00:00:00.000Z";

function idFor(prefix: string, value: string, index = 0) {
  return `${prefix}-${value.replace(/\s+/g, "-").toLowerCase()}-${index + 1}`;
}

export function scoreTopicCandidate(candidate: TopicCandidate): {
  score: number;
  reasons: string[];
} {
  const title = candidate.title;
  const keywordFit = title.includes(candidate.keyword) ? 28 : title.includes(candidate.keyword.slice(0, 2)) ? 18 : 8;
  const metrics = candidate.metrics;
  const engagementScore = Math.min(
    35,
    metrics.likes * 0.006 + metrics.saves * 0.012 + metrics.comments * 0.04
  );
  const saveRatio = metrics.likes > 0 ? metrics.saves / metrics.likes : 0;
  const angleScore = /清单|避坑|步骤|模板|对比|别乱|指南|痛点/.test(title + candidate.angle)
    ? 18
    : 10;
  const planningFit = candidate.status === "selected" ? 12 : 10;
  const score = Math.round(keywordFit + engagementScore + angleScore + planningFit);
  const reasons = [
    keywordFit >= 18 ? "关键词贴合" : "关键词弱相关",
    angleScore >= 18 ? "选题角度明确" : "角度需要收窄",
    saveRatio >= 0.4 || metrics.saves >= 500 ? "收藏权重高" : "互动数据一般",
    `评估时间 ${now.slice(0, 10)}`,
  ];

  return { score: Math.min(100, score), reasons };
}

export function rankTopicCandidates(candidates: TopicCandidate[]) {
  return candidates
    .map((candidate) => {
      const scored = scoreTopicCandidate(candidate);
      return { ...candidate, score: scored.score, reasons: scored.reasons };
    })
    .sort((a, b) => b.score - a.score);
}

export function generateTopicCandidates(keyword: string, project: Project): TopicCandidate[] {
  const cleanKeyword = keyword.trim();
  const templates = [
    {
      title: `${cleanKeyword}痛点避坑清单：新手先看这 5 个细节`,
      angle: "痛点清单",
      metrics: { likes: 3200, saves: 2200, comments: 168 },
    },
    {
      title: `${cleanKeyword}前后对比：哪些做法真的更适合${project.audience}`,
      angle: "对比验证",
      metrics: { likes: 2100, saves: 1200, comments: 96 },
    },
    {
      title: `${cleanKeyword}一周执行表：每天照着做不慌`,
      angle: "步骤模板",
      metrics: { likes: 1800, saves: 1500, comments: 74 },
    },
    {
      title: `${project.industry}新手别乱跟风，${cleanKeyword}先问自己 3 个问题`,
      angle: "反差提醒",
      metrics: { likes: 1300, saves: 760, comments: 58 },
    },
    {
      title: `${cleanKeyword}评论区高频问题汇总`,
      angle: "互动复盘",
      metrics: { likes: 980, saves: 520, comments: 121 },
    },
  ];

  return rankTopicCandidates(
    templates.map((template, index) => ({
      id: idFor("topic", cleanKeyword, index),
      projectId: project.id,
      keyword: cleanKeyword,
      title: template.title,
      angle: template.angle,
      source: "manual-keyword",
      score: 0,
      status: "candidate",
      metrics: template.metrics,
      reasons: [],
    }))
  );
}
