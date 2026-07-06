import { NextResponse } from "next/server";
import { analyzeXhsAccountHomepageWithOpenAI } from "@/lib/ai/xhs-generation";
import type { AccountHomepageInput, Project } from "@/lib/core/types";

function assertBody(value: unknown): { project: Project; profile: AccountHomepageInput } {
  const body = value as { project?: Project; profile?: Partial<AccountHomepageInput> };
  if (!body.project?.id || !body.profile) {
    throw new Error("project and profile are required.");
  }
  if (!body.profile.displayName || !body.profile.bio || !body.profile.recentNotesText) {
    throw new Error("profile.displayName, profile.bio, and profile.recentNotesText are required.");
  }

  return {
    project: body.project,
    profile: {
      projectId: body.profile.projectId ?? body.project.id,
      profileUrl: body.profile.profileUrl,
      displayName: body.profile.displayName,
      bio: body.profile.bio,
      recentNotesText: body.profile.recentNotesText,
    },
  };
}

export async function POST(request: Request) {
  try {
    const input = assertBody(await request.json());
    const payload = await analyzeXhsAccountHomepageWithOpenAI(input);

    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze account homepage." },
      { status: 500 }
    );
  }
}
