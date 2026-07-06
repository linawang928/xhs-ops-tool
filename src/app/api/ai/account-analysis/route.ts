import { NextResponse } from "next/server";
import { generateStructuredText } from "@/lib/ai/openai-provider";
import {
  analyzeAccountHomepage,
  buildPositioningInputFromHomepage,
} from "@/lib/core/account-homepage";
import type {
  AccountHomepageAnalysis,
  AccountHomepageInput,
  BenchmarkContentFormat,
  Project,
} from "@/lib/core/types";

interface AiAccountAnalysisResult {
  inferredSubjectArea: string;
  inferredAudience: string;
  valuePromise: string;
  toneKeywords: string[];
  contentPillars: string[];
  strengths: string[];
  risks: string[];
  opportunities: string[];
  nextActions: string[];
}

const accountAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "inferredSubjectArea",
    "inferredAudience",
    "valuePromise",
    "toneKeywords",
    "contentPillars",
    "strengths",
    "risks",
    "opportunities",
    "nextActions",
  ],
  properties: {
    inferredSubjectArea: { type: "string" },
    inferredAudience: { type: "string" },
    valuePromise: { type: "string" },
    toneKeywords: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
    },
    contentPillars: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: { type: "string" },
    },
    strengths: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
    },
    risks: {
      type: "array",
      minItems: 1,
      maxItems: 4,
      items: { type: "string" },
    },
    opportunities: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
    },
    nextActions: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
    },
  },
};

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

function systemPrompt() {
  return [
    "你是一位有十多年经验的小红书运营师，擅长从账号主页、简介、近期笔记标题中判断账号定位。",
    "输出必须服务于后续小红书运营动作：账号定位、对标筛选、选题池、合规表达。",
    "避免医疗、金融、绝对化承诺，不鼓励站外导流。",
  ].join("\n");
}

function userPrompt(project: Project, profile: AccountHomepageInput) {
  return [
    `项目名称：${project.name}`,
    `项目行业：${project.industry}`,
    `目标人群：${project.audience}`,
    `账号链接：${profile.profileUrl ?? "未提供"}`,
    `账号名称：${profile.displayName}`,
    `账号简介：${profile.bio}`,
    `近期笔记/主页资料：${profile.recentNotesText}`,
    "请诊断：主体区、人群、差异化价值、语气关键词、内容支柱、优势、风险、机会和下一步运营动作。",
    "下一步动作里必须包含如何筛选对标内容。",
  ].join("\n");
}

function detectContentFormats(text: string): BenchmarkContentFormat[] {
  const formats: BenchmarkContentFormat[] = [];
  if (/避坑|清单|别急着|不乱买/.test(text)) formats.push("避坑清单");
  if (/流程|步骤|每天|计划/.test(text)) formats.push("流程模板");
  if (/对比|测评|怎么选/.test(text)) formats.push("测评对比");
  if (/路线|合集|地图/.test(text)) formats.push("路线合集");
  return formats.length > 0 ? formats : ["全部"];
}

function mergeAnalysis(
  local: AccountHomepageAnalysis,
  ai: AiAccountAnalysisResult
): AccountHomepageAnalysis {
  const subjectArea = ai.inferredSubjectArea || local.inferredSubjectArea;
  const formats = detectContentFormats(
    `${ai.contentPillars.join(" ")} ${ai.nextActions.join(" ")} ${ai.opportunities.join(" ")}`
  );

  return {
    ...local,
    inferredSubjectArea: subjectArea,
    inferredAudience: ai.inferredAudience || local.inferredAudience,
    valuePromise: ai.valuePromise || local.valuePromise,
    toneKeywords: ai.toneKeywords.filter(Boolean),
    contentPillars: ai.contentPillars.filter(Boolean),
    benchmarkFilters: {
      subjectArea,
      contentFormats: formats,
    },
    strengths: ai.strengths.filter(Boolean),
    risks: ai.risks.filter(Boolean),
    opportunities: ai.opportunities.filter(Boolean),
    nextActions: ai.nextActions.filter(Boolean),
  };
}

export async function POST(request: Request) {
  try {
    const { project, profile } = assertBody(await request.json());
    const local = analyzeAccountHomepage(profile);
    const ai = await generateStructuredText<AiAccountAnalysisResult>({
      systemPrompt: systemPrompt(),
      userPrompt: userPrompt(project, profile),
      schemaName: "xhs_account_homepage_analysis",
      schema: accountAnalysisSchema,
    });
    const analysis = mergeAnalysis(local, ai);

    return NextResponse.json({
      analysis,
      positioningInput: buildPositioningInputFromHomepage(analysis),
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to analyze account homepage." },
      { status: 500 }
    );
  }
}
