import { NextResponse } from "next/server";
import { generateXhsPositioningWithOpenAI } from "@/lib/ai/xhs-generation";
import type { AccountPositioningInput } from "@/lib/core/types";

function assertBody(value: unknown): AccountPositioningInput {
  const body = value as Partial<AccountPositioningInput>;
  if (!body.projectId || !body.subjectArea || !body.audience || !body.differentiator || !body.tone) {
    throw new Error("projectId, subjectArea, audience, differentiator, and tone are required.");
  }
  return {
    projectId: body.projectId,
    subjectArea: body.subjectArea,
    audience: body.audience,
    differentiator: body.differentiator,
    tone: body.tone,
  };
}

export async function POST(request: Request) {
  try {
    const input = assertBody(await request.json());
    const positioning = await generateXhsPositioningWithOpenAI(input);

    return NextResponse.json({ positioning });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate account positioning." },
      { status: 500 }
    );
  }
}
