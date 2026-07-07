import { generatePosterImage, generateStructuredText } from "@/lib/ai/openai-provider";
import { generateAccountPositioning } from "@/lib/core/account";
import {
  analyzeAccountHomepage,
  buildPositioningInputFromHomepage,
} from "@/lib/core/account-homepage";
import { analyzeBenchmarkNote } from "@/lib/core/benchmark";
import { scanCompliance } from "@/lib/core/compliance";
import { generateDraftFromTopic } from "@/lib/core/content";
import { rankTopicCandidates } from "@/lib/core/topic";
import type {
  AccountHomepageAnalysis,
  AccountHomepageInput,
  AccountPositioning,
  AccountPositioningInput,
  AssetCard,
  BenchmarkContentFormat,
  BenchmarkNote,
  ContentDraft,
  GeneratedPosterAsset,
  Project,
  RawBenchmarkNote,
  TopicCandidate,
} from "@/lib/core/types";

type Fetcher = typeof fetch;

export interface OpenAiGenerationSettings {
  apiKey?: string;
  baseUrl?: string;
  textModel?: string;
  imageModel?: string;
}

interface OpenAiCallInput {
  settings?: OpenAiGenerationSettings;
  fetcher?: Fetcher;
}

interface AiPositioningResult {
  nameOptions: string[];
  bioOptions: string[];
  positioningStatement: string;
  contentPillars: string[];
}

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

interface AiTopicResult {
  topics: Array<{
    title: string;
    angle: string;
  }>;
}

interface AiDraftResult {
  titleOptions: string[];
  body: string;
  hashtags: string[];
  cardScripts: Array<{
    role: AssetCard["role"];
    title: string;
    subtitle: string;
    bullets: string[];
  }>;
}

interface AiBenchmarkAnalysisResult {
  title: string;
  openingHook: string;
  structure: string[];
  tags: string[];
  sellingPoints: string[];
  interactionCues: string[];
}

interface AiComplianceRewriteResult {
  rewrittenText: string;
  changeNotes: string[];
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

const topicsSchema = {
  type: "object",
  additionalProperties: false,
  required: ["topics"],
  properties: {
    topics: {
      type: "array",
      minItems: 3,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "angle"],
        properties: {
          title: { type: "string" },
          angle: { type: "string" },
        },
      },
    },
  },
};

const draftSchema = {
  type: "object",
  additionalProperties: false,
  required: ["titleOptions", "body", "hashtags", "cardScripts"],
  properties: {
    titleOptions: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" },
    },
    body: { type: "string" },
    hashtags: {
      type: "array",
      minItems: 3,
      maxItems: 10,
      items: { type: "string" },
    },
    cardScripts: {
      type: "array",
      minItems: 2,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["role", "title", "subtitle", "bullets"],
        properties: {
          role: { type: "string", enum: ["cover", "problem", "steps", "checklist", "summary"] },
          title: { type: "string" },
          subtitle: { type: "string" },
          bullets: {
            type: "array",
            minItems: 1,
            maxItems: 5,
            items: { type: "string" },
          },
        },
      },
    },
  },
};

const benchmarkAnalysisSchema = {
  type: "object",
  additionalProperties: false,
  required: ["title", "openingHook", "structure", "tags", "sellingPoints", "interactionCues"],
  properties: {
    title: { type: "string" },
    openingHook: { type: "string" },
    structure: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: { type: "string" },
    },
    tags: {
      type: "array",
      minItems: 1,
      maxItems: 10,
      items: { type: "string" },
    },
    sellingPoints: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: { type: "string" },
    },
    interactionCues: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string" },
    },
  },
};

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

function textGenerationInput(input: OpenAiCallInput) {
  return {
    apiKey: input.settings?.apiKey,
    baseUrl: input.settings?.baseUrl,
    model: input.settings?.textModel,
    fetcher: input.fetcher,
  };
}

function imageGenerationInput(input: OpenAiCallInput) {
  return {
    apiKey: input.settings?.apiKey,
    baseUrl: input.settings?.baseUrl,
    model: input.settings?.imageModel,
    fetcher: input.fetcher,
  };
}

function compactList(values: string[]) {
  return values.map((value) => value.trim()).filter(Boolean);
}

function positioningSystemPrompt() {
  return [
    "你是一位有十多年经验的小红书运营师，熟悉账号定位、内容选题、合规表达和商业转化边界。",
    "生成结果必须真实可用，适合个人或小团队的小红书账号。",
    "避免医疗、金融、绝对化承诺，不写站外导流。",
  ].join("\n");
}

function positioningUserPrompt(input: AccountPositioningInput) {
  return [
    `账号主体区：${input.subjectArea}`,
    `目标人群：${input.audience}`,
    `差异化承诺：${input.differentiator}`,
    `账号语气：${input.tone}`,
    "请输出：3-5 个推荐账号名、1-3 个简介、1 条定位语、4-6 个内容支柱。",
    "账号名要像真实小红书账号，不要带引号，不要像公司名称。",
  ].join("\n");
}

export async function generateXhsPositioningWithOpenAI(
  input: AccountPositioningInput & OpenAiCallInput
): Promise<AccountPositioning> {
  const localPositioning = generateAccountPositioning(input);
  const ai = await generateStructuredText<AiPositioningResult>({
    ...textGenerationInput(input),
    systemPrompt: positioningSystemPrompt(),
    userPrompt: positioningUserPrompt(input),
    schemaName: "xhs_account_positioning",
    schema: positioningSchema,
  });
  const nameOptions = compactList(ai.nameOptions);
  const bioOptions = compactList(ai.bioOptions);
  const contentPillars = compactList(ai.contentPillars);

  return {
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
  };
}

function accountAnalysisSystemPrompt() {
  return [
    "你是一位有十多年经验的小红书运营师，擅长从账号主页、简介、近期笔记标题中判断账号定位。",
    "输出必须服务于后续小红书运营动作：账号定位、对标筛选、选题池、合规表达。",
    "避免医疗、金融、绝对化承诺，不鼓励站外导流。",
  ].join("\n");
}

function accountAnalysisUserPrompt(project: Project, profile: AccountHomepageInput) {
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
  const contentPillars = compactList(ai.contentPillars);
  const strengths = compactList(ai.strengths);
  const risks = compactList(ai.risks);
  const opportunities = compactList(ai.opportunities);
  const nextActions = compactList(ai.nextActions);
  const formats = detectContentFormats(
    `${contentPillars.join(" ")} ${nextActions.join(" ")} ${opportunities.join(" ")}`
  );

  return {
    ...local,
    inferredSubjectArea: subjectArea,
    inferredAudience: ai.inferredAudience || local.inferredAudience,
    valuePromise: ai.valuePromise || local.valuePromise,
    toneKeywords: compactList(ai.toneKeywords),
    contentPillars,
    benchmarkFilters: {
      subjectArea,
      contentFormats: formats,
    },
    strengths,
    risks,
    opportunities,
    nextActions,
  };
}

export async function analyzeXhsAccountHomepageWithOpenAI(input: {
  project: Project;
  profile: AccountHomepageInput;
} & OpenAiCallInput): Promise<{
  analysis: AccountHomepageAnalysis;
  positioningInput: AccountPositioningInput;
}> {
  const local = analyzeAccountHomepage(input.profile);
  const ai = await generateStructuredText<AiAccountAnalysisResult>({
    ...textGenerationInput(input),
    systemPrompt: accountAnalysisSystemPrompt(),
    userPrompt: accountAnalysisUserPrompt(input.project, input.profile),
    schemaName: "xhs_account_homepage_analysis",
    schema: accountAnalysisSchema,
  });
  const analysis = mergeAnalysis(local, ai);

  return {
    analysis,
    positioningInput: buildPositioningInputFromHomepage(analysis),
  };
}

function topicsSystemPrompt() {
  return [
    "你是一位有十多年经验的小红书运营师，擅长爆款选题检索和选题池规划。",
    "选题要可发布、可拆解、能被收藏，不要写夸张承诺或站外导流。",
  ].join("\n");
}

function topicsUserPrompt(input: { keyword: string; project: Project }) {
  return [
    `关键词：${input.keyword}`,
    `行业：${input.project.industry}`,
    `目标人群：${input.project.audience}`,
    `账号语气：${input.project.tone}`,
    "请生成 5-8 个小红书候选选题，每个包含标题和角度。",
    "标题优先使用避坑清单、流程模板、测评对比、评论区问题复盘等容易收藏的形式。",
  ].join("\n");
}

function candidateId(keyword: string, index: number) {
  return `topic-ai-${keyword.trim().replace(/\s+/g, "-").toLowerCase()}-${index + 1}`;
}

function estimatedMetrics(index: number) {
  const presets = [
    { likes: 4200, saves: 2600, comments: 188 },
    { likes: 3200, saves: 2100, comments: 132 },
    { likes: 2500, saves: 1700, comments: 96 },
    { likes: 1800, saves: 1200, comments: 74 },
    { likes: 1300, saves: 820, comments: 58 },
  ];
  return presets[index] ?? { likes: 980, saves: 520, comments: 42 };
}

function toCandidates(ai: AiTopicResult, keyword: string, project: Project): TopicCandidate[] {
  return rankTopicCandidates(
    ai.topics.filter((topic) => topic.title && topic.angle).map((topic, index) => ({
      id: candidateId(keyword, index),
      projectId: project.id,
      keyword,
      title: topic.title,
      angle: topic.angle,
      source: "manual-keyword",
      score: 0,
      status: "candidate",
      metrics: estimatedMetrics(index),
      reasons: [],
    }))
  );
}

export async function generateXhsTopicsWithOpenAI(input: {
  keyword: string;
  project: Project;
} & OpenAiCallInput): Promise<TopicCandidate[]> {
  const keyword = input.keyword.trim();
  const ai = await generateStructuredText<AiTopicResult>({
    ...textGenerationInput(input),
    systemPrompt: topicsSystemPrompt(),
    userPrompt: topicsUserPrompt({ keyword, project: input.project }),
    schemaName: "xhs_topic_candidates",
    schema: topicsSchema,
  });

  return toCandidates(ai, keyword, input.project);
}

function draftSystemPrompt() {
  return [
    "你是一位有十多年经验的小红书运营师，擅长图文笔记脚本、标题和封面卡片策划。",
    "输出要像真实小红书创作者写的：具体、克制、可执行，有收藏价值。",
    "避免绝对化承诺、医疗金融承诺、站外导流和虚假效果。",
  ].join("\n");
}

function draftUserPrompt(input: { project: Project; topic: TopicCandidate; benchmarks?: BenchmarkNote[] }) {
  const benchmark = input.benchmarks?.[0];
  return [
    `账号：${input.project.name}`,
    `人设：${input.project.persona}`,
    `行业：${input.project.industry}`,
    `受众：${input.project.audience}`,
    `语气：${input.project.tone}`,
    `选题标题：${input.topic.title}`,
    `关键词：${input.topic.keyword}`,
    benchmark ? `对标开头：${benchmark.analysis.openingHook}` : "对标开头：暂无",
    benchmark ? `对标结构：${benchmark.analysis.structure.join(" / ")}` : "对标结构：暂无",
    "请生成：2-5 个标题、完整正文、3-10 个话题、2-6 张图文卡片脚本。",
    "正文使用换行分段，适合直接复制到小红书；卡片脚本要能用于生成封面/正文海报。",
  ].join("\n");
}

function mergeAssetCards(localCards: AssetCard[], aiCards: AiDraftResult["cardScripts"]): AssetCard[] {
  return localCards.map((card, index) => {
    const aiCard = aiCards[index] ?? aiCards.find((item) => item.role === card.role);
    if (!aiCard) return card;
    return {
      ...card,
      role: aiCard.role,
      title: aiCard.title,
      subtitle: aiCard.subtitle,
      bullets: aiCard.bullets,
    };
  });
}

export async function generateXhsDraftWithOpenAI(input: {
  project: Project;
  topic: TopicCandidate;
  benchmarks?: BenchmarkNote[];
} & OpenAiCallInput): Promise<ContentDraft> {
  const localDraft = generateDraftFromTopic(input.topic, input.project, input.benchmarks);
  const ai = await generateStructuredText<AiDraftResult>({
    ...textGenerationInput(input),
    systemPrompt: draftSystemPrompt(),
    userPrompt: draftUserPrompt(input),
    schemaName: "xhs_content_draft",
    schema: draftSchema,
  });
  const titleOptions = compactList(ai.titleOptions);
  const selectedTitle = titleOptions[0] ?? localDraft.selectedTitle;
  const body = ai.body || localDraft.body;

  return {
    ...localDraft,
    titleOptions: titleOptions.length > 0 ? titleOptions : localDraft.titleOptions,
    selectedTitle,
    body,
    hashtags: compactList(ai.hashtags).map((tag) => tag.replace(/^#/, "")),
    assetCards: mergeAssetCards(localDraft.assetCards, ai.cardScripts),
    compliance: scanCompliance(`${selectedTitle}\n${body}`, input.project.forbiddenWords),
  };
}

function benchmarkSystemPrompt() {
  return [
    "你是一位有十多年经验的小红书运营师，擅长拆解对标笔记结构。",
    "请只基于用户提供的对标笔记文本分析，不新增不存在的事实。",
    "输出要服务后续图文生产：标题模式、开头钩子、正文结构、卖点、互动钩子和标签。",
    "避免医疗、金融、绝对化承诺，不鼓励站外导流。",
  ].join("\n");
}

function benchmarkUserPrompt(input: { project: Project; note: RawBenchmarkNote }) {
  return [
    `账号行业：${input.project.industry}`,
    `目标人群：${input.project.audience}`,
    `账号语气：${input.project.tone}`,
    `对标标题：${input.note.title}`,
    `作者：${input.note.author ?? "未知"}`,
    `互动数据：点赞 ${input.note.metrics?.likes ?? 0} / 收藏 ${input.note.metrics?.saves ?? 0} / 评论 ${
      input.note.metrics?.comments ?? 0
    }`,
    "对标正文：",
    input.note.body,
    "请拆解标题、开头钩子、结构、标签、卖点和互动钩子。",
  ].join("\n");
}

export async function analyzeXhsBenchmarkWithOpenAI(input: {
  project: Project;
  note: RawBenchmarkNote;
} & OpenAiCallInput): Promise<BenchmarkNote> {
  const localBenchmark = analyzeBenchmarkNote(input.note);
  const ai = await generateStructuredText<AiBenchmarkAnalysisResult>({
    ...textGenerationInput(input),
    systemPrompt: benchmarkSystemPrompt(),
    userPrompt: benchmarkUserPrompt(input),
    schemaName: "xhs_benchmark_analysis",
    schema: benchmarkAnalysisSchema,
  });

  return {
    ...localBenchmark,
    title: ai.title.trim() || localBenchmark.title,
    analysis: {
      openingHook: ai.openingHook.trim() || localBenchmark.analysis.openingHook,
      structure: compactList(ai.structure),
      tags: compactList(ai.tags).map((tag) => tag.replace(/^#/, "")),
      sellingPoints: compactList(ai.sellingPoints),
      interactionCues: compactList(ai.interactionCues),
    },
  };
}

function complianceSystemPrompt() {
  return [
    "你是一位熟悉小红书社区表达和内容合规的资深运营编辑。",
    "任务是把待发布文案改成更克制、真实、可发布的版本。",
    "保留原有信息价值和口吻，不新增事实，不写绝对化承诺，不导流站外，不写医疗金融功效承诺。",
  ].join("\n");
}

function complianceUserPrompt(input: { project: Project; text: string }) {
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

export async function rewriteXhsComplianceWithOpenAI(input: {
  project: Project;
  text: string;
} & OpenAiCallInput): Promise<{
  rewrittenText: string;
  changeNotes: string[];
  compliance: ReturnType<typeof scanCompliance>;
}> {
  const localCompliance = scanCompliance(input.text, input.project.forbiddenWords);
  const ai = await generateStructuredText<AiComplianceRewriteResult>({
    ...textGenerationInput(input),
    systemPrompt: complianceSystemPrompt(),
    userPrompt: complianceUserPrompt(input),
    schemaName: "xhs_compliance_rewrite",
    schema: complianceRewriteSchema,
  });
  const aiText = ai.rewrittenText.trim() || localCompliance.sanitizedText;
  const aiCompliance = scanCompliance(aiText, input.project.forbiddenWords);
  const rewrittenText = aiCompliance.riskLevel === "low" ? aiText : aiCompliance.sanitizedText;
  const compliance = scanCompliance(rewrittenText, input.project.forbiddenWords);

  return {
    rewrittenText,
    changeNotes: compactList(ai.changeNotes),
    compliance,
  };
}

function selectCard(draft: ContentDraft, cardId?: string): AssetCard {
  return draft.assetCards.find((card) => card.id === cardId) ?? draft.assetCards[0];
}

function cardIndex(draft: ContentDraft, card: AssetCard) {
  const index = draft.assetCards.findIndex((item) => item.id === card.id);
  return index >= 0 ? index + 1 : 1;
}

export function buildXhsPosterPrompt(project: Project, draft: ContentDraft, card: AssetCard) {
  return [
    "生成一张小红书图文封面海报，竖版 3:4，中文排版清晰，适合手机首屏。",
    `账号行业：${project.industry}`,
    `账号语气：${project.tone}`,
    `主标题：${card.title}`,
    `副标题：${card.subtitle}`,
    `要点：${card.bullets.join(" / ")}`,
    `笔记标题：${draft.selectedTitle}`,
    `品牌色：${project.brandColors.join(" / ")}`,
    "视觉要求：干净、明亮、有留白，卡片式信息层级，标题不要被裁切。",
    "合规要求：不使用绝对化承诺、夸张疗效、金融收益或站外导流表达。",
  ].join("\n");
}

export async function generateXhsPosterWithOpenAI(input: {
  project: Project;
  draft: ContentDraft;
  cardId?: string;
  promptOverride?: string;
} & OpenAiCallInput): Promise<GeneratedPosterAsset> {
  const card = selectCard(input.draft, input.cardId);
  const prompt = input.promptOverride?.trim() || buildXhsPosterPrompt(input.project, input.draft, card);
  const image = await generatePosterImage({
    ...imageGenerationInput(input),
    prompt,
    aspectRatio: "3:4",
  });

  return {
    id: `openai-${card.id}`,
    ...image,
    cardId: card.id,
    draftId: input.draft.id,
    source: "openai",
    fileName: `xhs-ai-poster-${cardIndex(input.draft, card)}.png`,
    mimeType: "image/png",
    width: 1024,
    height: 1536,
  };
}
