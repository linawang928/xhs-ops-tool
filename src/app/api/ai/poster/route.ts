import { NextResponse } from "next/server";
import { generateXhsPosterWithOpenAI } from "@/lib/ai/xhs-generation";
import type { ContentDraft, Project } from "@/lib/core/types";

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

export async function POST(request: Request) {
  try {
    const input = assertBody(await request.json());
    const image = await generateXhsPosterWithOpenAI(input);

    return NextResponse.json({ image });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate poster image." },
      { status: 500 }
    );
  }
}
