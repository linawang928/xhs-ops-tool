import { NextResponse } from "next/server";
import { generateStructuredText } from "@/lib/ai/openai-provider";
import { scanCompliance } from "@/lib/core/compliance";
import { generateDraftFromTopic } from "@/lib/core/content";
import type { AssetCard, BenchmarkNote, Project, TopicCandidate } from "@/lib/core/types";

interface DraftBody {
  project: Project;
  topic: TopicCandidate;
  benchmarks?: BenchmarkNote[];
}

interface AiDraftResult {
  titleOptions: string[];
  body: string;
  hashtags: string[];
  cardScripts: Array<{
    role: AssetCard["role"];
    title: string;
    subtitle: string;
    bullets: string[];
  }>;
}

const draftSchema = {
  type: "object",
  additionalProperties: false,
  required: ["titleOptions", "body", "hashtags", "cardScripts"],
  properties: {
    titleOptions: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
    },
    body: { type: "string" },
    hashtags: {
      type: "array",
      minItems: 3,
      maxItems: 10,
      items: { type: "string" },
    },
    cardScripts: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["role", "title", "subtitle", "bullets"],
        properties: {
          role: { type: "string", enum: ["cover", "problem", "steps", "checklist", "summary"] },
          title: { type: "string" },
          subtitle: { type: "string" },
          bullets: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: { type: "string" },
          },
        },
      },
    },
  },
};

function assertBody(value: unknown): DraftBody {
  const body = value as Partial<DraftBody>;
  if (!body.project?.id || !body.topic?.id || !body.topic?.keyword) {
    throw new Error("project and topic are required.");
  }
  return {
    project: body.project,
    topic: body.topic,
    benchmarks: body.benchmarks ?? [],
  };
}

function systemPrompt() {
  return [
    "你是一位有十多年经验的小红书运营师，擅长图文笔记脚本、标题和封面卡片策划。",
    "输出要像真实小红书创作者写的：具体、克制、可执行，有收藏价值。",
    "避免绝对化承诺、医疗金融承诺、站外导流和虚假效果。",
  ].join("\n");
}

function userPrompt(input: DraftBody) {
  const benchmark = input.benchmarks?.[0];
  return [
    `账号：${input.project.name}`,
    `人设：${input.project.persona}`,
    `行业：${input.project.industry}`,
    `受众：${input.project.audience}`,
    `语气：${input.project.tone}`,
    `选题标题：${input.topic.title}`,
    `关键词：${input.topic.keyword}`,
    benchmark ? `对标开头：${benchmark.analysis.openingHook}` : "对标开头：暂无",
    benchmark ? `对标结构：${benchmark.analysis.structure.join(" / ")}` : "对标结构：暂无",
    "请生成：2-5 个标题、完整正文、3-10 个话题、2-6 张图文卡片脚本。",
    "正文使用换行分段，适合直接复制到小红书；卡片脚本要能用于生成封面/正文海报。",
  ].join("\n");
}

function mergeAssetCards(localCards: AssetCard[], aiCards: AiDraftResult["cardScripts"]): AssetCard[] {
  return localCards.map((card, index) => {
    const aiCard = aiCards[index] ?? aiCards.find((item) => item.role === card.role);
    if (!aiCard) return card;
    return {
      ...card,
      role: aiCard.role,
      title: aiCard.title,
      subtitle: aiCard.subtitle,
      bullets: aiCard.bullets,
    };
  });
}

export async function POST(request: Request) {
  try {
    const input = assertBody(await request.json());
    const localDraft = generateDraftFromTopic(input.topic, input.project, input.benchmarks);
    const ai = await generateStructuredText<AiDraftResult>({
      systemPrompt: systemPrompt(),
      userPrompt: userPrompt(input),
      schemaName: "xhs_content_draft",
      schema: draftSchema,
    });
    const titleOptions = ai.titleOptions.filter(Boolean);
    const selectedTitle = titleOptions[0] ?? localDraft.selectedTitle;
    const body = ai.body || localDraft.body;

    return NextResponse.json({
      draft: {
        ...localDraft,
        titleOptions: titleOptions.length > 0 ? titleOptions : localDraft.titleOptions,
        selectedTitle,
        body,
        hashtags: ai.hashtags.filter(Boolean).map((tag) => tag.replace(/^#/, "")),
        assetCards: mergeAssetCards(localDraft.assetCards, ai.cardScripts),
        compliance: scanCompliance(`${selectedTitle}\n${body}`, input.project.forbiddenWords),
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate content draft." },
      { status: 500 }
    );
  }
}
