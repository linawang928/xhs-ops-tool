import { NextResponse } from "next/server";
import { rewriteXhsComplianceWithOpenAI } from "@/lib/ai/xhs-generation";
import type { Project } from "@/lib/core/types";

interface ComplianceRewriteBody {
  project: Project;
  text: string;
}

function assertBody(value: unknown): ComplianceRewriteBody {
  const body = value as Partial<ComplianceRewriteBody>;
  if (!body.project?.id || typeof body.text !== "string" || !body.text.trim()) {
    throw new Error("project and text are required.");
  }
  return {
    project: body.project,
    text: body.text,
  };
}

export async function POST(request: Request) {
  try {
    const input = assertBody(await request.json());
    const payload = await rewriteXhsComplianceWithOpenAI(input);

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rewrite compliant copy." },
      { status: 500 }
    );
  }
}
