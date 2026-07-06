import { scanCompliance } from "./compliance";
import type { AssetCard, BenchmarkNote, ContentDraft, Project, TopicCandidate } from "./types";

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function deriveHashtags(topic: TopicCandidate, project: Project, benchmarks: BenchmarkNote[]) {
  const benchmarkTags = benchmarks.flatMap((benchmark) => benchmark.analysis.tags);
  const keywordTags = [
    topic.keyword.includes("敏感肌") ? "敏感肌" : topic.keyword,
    topic.keyword.replace(/\s+/g, ""),
    project.industry,
    "小红书运营",
    "避坑清单",
  ];

  return unique([...benchmarkTags, ...keywordTags]).slice(0, 8);
}

function createCards(draftId: string, topic: TopicCandidate, project: Project): AssetCard[] {
  const [primary = "#E85D75", secondary = "#2E6B5F", accent = "#F6C85F"] = project.brandColors;
  const cardData: Omit<AssetCard, "id" | "draftId">[] = [
    {
      role: "cover",
      title: topic.keyword,
      subtitle: "先避开这 4 个坑",
      bullets: [topic.angle, "适合收藏自查"],
      themeColor: primary,
    },
    {
      role: "problem",
      title: "常见误区",
      subtitle: "别被一句话种草",
      bullets: ["先确认自己的场景", "再看成分和预算"],
      themeColor: secondary,
    },
    {
      role: "steps",
      title: "执行顺序",
      subtitle: "从低风险动作开始",
      bullets: ["记录当前状态", "小范围测试", "每周复盘"],
      themeColor: accent,
    },
    {
      role: "checklist",
      title: "发布前自查",
      subtitle: "减少违规和误导",
      bullets: ["不写绝对化承诺", "不引导站外交易", "保留个人体验边界"],
      themeColor: secondary,
    },
    {
      role: "summary",
      title: "评论区互动",
      subtitle: "把问题变成下一篇选题",
      bullets: ["邀请补充踩坑", "收集高频问题"],
      themeColor: primary,
    },
  ];

  return cardData.map((card, index) => ({
    ...card,
    id: `${draftId}-card-${index + 1}`,
    draftId,
  }));
}

export function generateDraftFromTopic(
  topic: TopicCandidate,
  project: Project,
  benchmarks: BenchmarkNote[] = []
): ContentDraft {
  const draftId = `draft-${topic.id}`;
  const titleOptions = [
    topic.title,
    `${topic.keyword}别急着下单，先看这份自查表`,
    `${project.audience}的${topic.keyword}温和路线`,
  ];
  const selectedTitle = titleOptions[0];
  const referenceHook =
    benchmarks[0]?.analysis.openingHook ?? "如果你也在反复纠结，可以先把问题拆小。";
  const sellingPoints = benchmarks[0]?.analysis.sellingPoints ?? ["先看需求", "再看执行成本"];
  const body = [
    referenceHook,
    `这篇会用「${project.persona}」的方式，把「${topic.keyword}」拆成可以直接照着检查的步骤。`,
    `1. 先确认你的真实场景：${project.audience}最容易被泛泛种草带偏。`,
    `2. 再看关键判断：${sellingPoints.slice(0, 2).join("、")}。`,
    "3. 最后给自己留一个观察周期，不因为单次体验就立刻放大结论。",
    "可以先收藏，发布前我也会把评论区高频问题整理成下一篇。",
  ].join("\n");
  const compliance = scanCompliance(`${selectedTitle}\n${body}`, project.forbiddenWords);

  return {
    id: draftId,
    projectId: project.id,
    topicId: topic.id,
    titleOptions,
    selectedTitle,
    body,
    hashtags: deriveHashtags(topic, project, benchmarks),
    assetCards: createCards(draftId, topic, project),
    compliance,
    createdAt: "2026-07-06T10:00:00.000Z",
  };
}
