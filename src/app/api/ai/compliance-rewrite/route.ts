import { NextResponse } from "next/server";
import { generateStructuredText } from "@/lib/ai/openai-provider";
import { scanCompliance } from "@/lib/core/compliance";
import type { Project } from "@/lib/core/types";

interface ComplianceRewriteBody {
  project: Project;
  text: string;
}

interface AiComplianceRewriteResult {
  rewrittenText: string;
  changeNotes: string[];
}

const complianceRewriteSchema = {
  type: "object",
  additionalProperties: false,
  required: ["rewrittenText", "changeNotes"],
  properties: {
    rewrittenText: { type: "string" },
    changeNotes: {
      type: "array",
      minItems: 1,
      maxItems: 8,
      items: { type: "string" },
    },
  },
};

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

function systemPrompt() {
  return [
    "你是一位熟悉小红书社区表达和内容合规的资深运营编辑。",
    "任务是把待发布文案改成更克制、真实、可发布的版本。",
    "保留原有信息价值和口吻，不新增事实，不写绝对化承诺，不导流站外，不写医疗金融功效承诺。",
  ].join("\n");
}

function userPrompt(input: ComplianceRewriteBody) {
  const compliance = scanCompliance(input.text, input.project.forbiddenWords);
  return [
    `账号：${input.project.name}`,
    `行业：${input.project.industry}`,
    `人设：${input.project.persona}`,
    `语气：${input.project.tone}`,
    `项目禁用词：${input.project.forbiddenWords.join("、") || "无"}`,
    `当前风险等级：${compliance.riskLevel}`,
    `命中问题：${compliance.issues.map((issue) => `${issue.term}(${issue.category})`).join("、") || "无"}`,
    "请输出改写后的完整文案，以及改写说明。",
    "待改写文案：",
    input.text,
  ].join("\n");
}

export async function POST(request: Request) {
  try {
    const input = assertBody(await request.json());
    const localCompliance = scanCompliance(input.text, input.project.forbiddenWords);
    const ai = await generateStructuredText<AiComplianceRewriteResult>({
      systemPrompt: systemPrompt(),
      userPrompt: userPrompt(input),
      schemaName: "xhs_compliance_rewrite",
      schema: complianceRewriteSchema,
    });
    const aiText = ai.rewrittenText.trim() || localCompliance.sanitizedText;
    const aiCompliance = scanCompliance(aiText, input.project.forbiddenWords);
    const rewrittenText = aiCompliance.riskLevel === "low" ? aiText : aiCompliance.sanitizedText;
    const compliance = scanCompliance(rewrittenText, input.project.forbiddenWords);

    return NextResponse.json({
      rewrittenText,
      changeNotes: ai.changeNotes.filter(Boolean),
      compliance,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to rewrite compliant copy." },
      { status: 500 }
    );
  }
}
