import { NextResponse } from "next/server";
import { generateXhsDraftWithOpenAI } from "@/lib/ai/xhs-generation";
import type { BenchmarkNote, Project, TopicCandidate } from "@/lib/core/types";

interface DraftBody {
  project: Project;
  topic: TopicCandidate;
  benchmarks?: BenchmarkNote[];
}

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

export async function POST(request: Request) {
  try {
    const input = assertBody(await request.json());
    const draft = await generateXhsDraftWithOpenAI(input);

    return NextResponse.json({ draft });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate content draft." },
      { status: 500 }
    );
  }
}
