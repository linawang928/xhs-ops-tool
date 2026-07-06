import { NextResponse } from "next/server";
import { analyzeXhsBenchmarkWithOpenAI } from "@/lib/ai/xhs-generation";
import type { Project, RawBenchmarkNote } from "@/lib/core/types";

interface BenchmarkBody {
  project: Project;
  note: RawBenchmarkNote;
}

function assertBody(value: unknown): BenchmarkBody {
  const body = value as Partial<BenchmarkBody>;
  if (!body.project?.id || !body.note?.id || !body.note.body?.trim()) {
    throw new Error("project and benchmark note are required.");
  }
  return {
    project: body.project,
    note: body.note,
  };
}

export async function POST(request: Request) {
  try {
    const input = assertBody(await request.json());
    const benchmark = await analyzeXhsBenchmarkWithOpenAI(input);

    return NextResponse.json({ benchmark });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze benchmark note." },
      { status: 500 }
    );
  }
}
