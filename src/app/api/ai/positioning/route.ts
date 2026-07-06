import { NextResponse } from "next/server";
import { generateAccountPositioning } from "@/lib/core/account";
import type { AccountPositioningInput, BenchmarkContentFormat } from "@/lib/core/types";
import { generateStructuredText } from "@/lib/ai/openai-provider";

interface AiPositioningResult {
  nameOptions: string[];
  bioOptions: string[];
  positioningStatement: string;
  contentPillars: string[];
}

const positioningSchema = {
  type: "object",
  additionalProperties: false,
  required: ["nameOptions", "bioOptions", "positioningStatement", "contentPillars"],
  properties: {
    nameOptions: {
      type: "array",
      minItems: 3,
      maxItems: 5,
      items: { type: "string" },
    },
    bioOptions: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: { type: "string" },
    },
    positioningStatement: { type: "string" },
    contentPillars: {
      type: "array",
      minItems: 4,
      maxItems: 6,
      items: { type: "string" },
    },
  },
};

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

function systemPrompt() {
  return [
    "你是一位有十多年经验的小红书运营师，熟悉账号定位、内容选题、合规表达和商业转化边界。",
    "生成结果必须真实可用，适合个人或小团队的小红书账号。",
    "避免医疗、金融、绝对化承诺，不写站外导流。",
  ].join("\n");
}

function userPrompt(input: AccountPositioningInput) {
  return [
    `账号主体区：${input.subjectArea}`,
    `目标人群：${input.audience}`,
    `差异化承诺：${input.differentiator}`,
    `账号语气：${input.tone}`,
    "请输出：3-5 个推荐账号名、1-3 个简介、1 条定位语、4-6 个内容支柱。",
    "账号名要像真实小红书账号，不要带引号，不要像公司名称。",
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const input = assertBody(await request.json());
    const localPositioning = generateAccountPositioning(input);
    const ai = await generateStructuredText<AiPositioningResult>({
      systemPrompt: systemPrompt(),
      userPrompt: userPrompt(input),
      schemaName: "xhs_account_positioning",
      schema: positioningSchema,
    });

    const nameOptions = ai.nameOptions.filter(Boolean);
    const bioOptions = ai.bioOptions.filter(Boolean);
    const contentPillars = ai.contentPillars.filter(Boolean);

    return NextResponse.json({
      positioning: {
        ...localPositioning,
        nameOptions: nameOptions.length > 0 ? nameOptions : localPositioning.nameOptions,
        bioOptions: bioOptions.length > 0 ? bioOptions : localPositioning.bioOptions,
        selectedName: nameOptions[0] ?? localPositioning.selectedName,
        selectedBio: bioOptions[0] ?? localPositioning.selectedBio,
        positioningStatement: ai.positioningStatement || localPositioning.positioningStatement,
        contentPillars: contentPillars.length > 0 ? contentPillars : localPositioning.contentPillars,
        benchmarkFilters: {
          subjectArea: localPositioning.subjectArea,
          contentFormats: ["避坑清单", "流程模板", "测评对比", "全部"] satisfies BenchmarkContentFormat[],
        },
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to generate account positioning." },
      { status: 500 }
    );
  }
}
