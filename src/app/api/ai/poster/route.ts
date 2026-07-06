import { NextResponse } from "next/server";
import { generatePosterImage } from "@/lib/ai/openai-provider";
import type { AssetCard, ContentDraft, Project } from "@/lib/core/types";

interface PosterBody {
  project: Project;
  draft: ContentDraft;
  cardId?: string;
}

function assertBody(value: unknown): PosterBody {
  const body = value as Partial<PosterBody>;
  if (!body.project?.id || !body.draft?.id || !body.draft?.assetCards?.length) {
    throw new Error("project and draft with assetCards are required.");
  }
  return {
    project: body.project,
    draft: body.draft,
    cardId: body.cardId,
  };
}

function selectCard(draft: ContentDraft, cardId?: string): AssetCard {
  return draft.assetCards.find((card) => card.id === cardId) ?? draft.assetCards[0];
}

function posterPrompt(project: Project, draft: ContentDraft, card: AssetCard) {
  return [
    "生成一张小红书图文封面海报，竖版 3:4，中文排版清晰，适合手机首屏。",
    `账号行业：${project.industry}`,
    `账号语气：${project.tone}`,
    `主标题：${card.title}`,
    `副标题：${card.subtitle}`,
    `要点：${card.bullets.join(" / ")}`,
    `笔记标题：${draft.selectedTitle}`,
    `品牌色：${project.brandColors.join(" / ")}`,
    "视觉要求：干净、明亮、有留白，卡片式信息层级，标题不要被裁切。",
    "合规要求：不使用绝对化承诺、夸张疗效、金融收益或站外导流表达。",
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const input = assertBody(await request.json());
    const card = selectCard(input.draft, input.cardId);
    const image = await generatePosterImage({
      prompt: posterPrompt(input.project, input.draft, card),
      aspectRatio: "3:4",
    });

    return NextResponse.json({
      image: {
        ...image,
        cardId: card.id,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate poster image." },
      { status: 500 }
    );
  }
}
