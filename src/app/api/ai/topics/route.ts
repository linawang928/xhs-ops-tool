import { NextResponse } from "next/server";
import { rankTopicCandidates } from "@/lib/core/topic";
import type { Project, TopicCandidate } from "@/lib/core/types";
import { generateStructuredText } from "@/lib/ai/openai-provider";

interface TopicsBody {
  keyword: string;
  project: Project;
}

interface AiTopicResult {
  topics: Array<{
    title: string;
    angle: string;
  }>;
}

const topicsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["topics"],
  properties: {
    topics: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "angle"],
        properties: {
          title: { type: "string" },
          angle: { type: "string" },
        },
      },
    },
  },
};

function assertBody(value: unknown): TopicsBody {
  const body = value as Partial<TopicsBody>;
  if (!body.keyword || !body.project?.id || !body.project?.industry || !body.project?.audience) {
    throw new Error("keyword and project are required.");
  }
  return {
    keyword: body.keyword,
    project: body.project,
  };
}

function candidateId(keyword: string, index: number) {
  return `topic-ai-${keyword.trim().replace(/\s+/g, "-").toLowerCase()}-${index + 1}`;
}

function estimatedMetrics(index: number) {
  const presets = [
    { likes: 4200, saves: 2600, comments: 188 },
    { likes: 3200, saves: 2100, comments: 132 },
    { likes: 2500, saves: 1700, comments: 96 },
    { likes: 1800, saves: 1200, comments: 74 },
    { likes: 1300, saves: 820, comments: 58 },
  ];
  return presets[index] ?? { likes: 980, saves: 520, comments: 42 };
}

function toCandidates(ai: AiTopicResult, keyword: string, project: Project): TopicCandidate[] {
  return rankTopicCandidates(
    ai.topics.filter((topic) => topic.title && topic.angle).map((topic, index) => ({
      id: candidateId(keyword, index),
      projectId: project.id,
      keyword,
      title: topic.title,
      angle: topic.angle,
      source: "manual-keyword",
      score: 0,
      status: "candidate",
      metrics: estimatedMetrics(index),
      reasons: [],
    }))
  );
}

function systemPrompt() {
  return [
    "你是一位有十多年经验的小红书运营师，擅长爆款选题检索和选题池规划。",
    "选题要可发布、可拆解、能被收藏，不要写夸张承诺或站外导流。",
  ].join("\n");
}

function userPrompt(input: TopicsBody) {
  return [
    `关键词：${input.keyword}`,
    `行业：${input.project.industry}`,
    `目标人群：${input.project.audience}`,
    `账号语气：${input.project.tone}`,
    "请生成 5-8 个小红书候选选题，每个包含标题和角度。",
    "标题优先使用避坑清单、流程模板、测评对比、评论区问题复盘等容易收藏的形式。",
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const input = assertBody(await request.json());
    const ai = await generateStructuredText<AiTopicResult>({
      systemPrompt: systemPrompt(),
      userPrompt: userPrompt(input),
      schemaName: "xhs_topic_candidates",
      schema: topicsSchema,
    });

    return NextResponse.json({
      topics: toCandidates(ai, input.keyword.trim(), input.project),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate topic candidates." },
      { status: 500 }
    );
  }
}
