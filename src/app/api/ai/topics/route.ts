import { NextResponse } from "next/server";
import { generateXhsTopicsWithOpenAI } from "@/lib/ai/xhs-generation";
import type { Project } from "@/lib/core/types";

interface TopicsBody {
  keyword: string;
  project: Project;
}

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

export async function POST(request: Request) {
  try {
    const input = assertBody(await request.json());
    const topics = await generateXhsTopicsWithOpenAI(input);

    return NextResponse.json({ topics });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate topic candidates." },
      { status: 500 }
    );
  }
}
