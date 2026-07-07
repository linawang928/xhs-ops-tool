"use client";

import {
  CalendarDays,
  Check,
  ClipboardCheck,
  Compass,
  ExternalLink,
  Filter,
  FileText,
  Image as ImageIcon,
  Layers3,
  Search,
  Share2,
  ShieldCheck,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import NextImage from "next/image";
import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { AiProviderStatusPayload } from "@/lib/ai/status";
import {
  analyzeXhsAccountHomepageWithOpenAI,
  analyzeXhsBenchmarkWithOpenAI,
  buildXhsPosterPrompt,
  generateXhsDraftWithOpenAI,
  generateXhsPositioningWithOpenAI,
  generateXhsPosterWithOpenAI,
  generateXhsTopicsWithOpenAI,
  rewriteXhsComplianceWithOpenAI,
  type OpenAiGenerationSettings,
} from "@/lib/ai/xhs-generation";
import {
  filterBenchmarkCandidates,
  generateAccountPositioning,
  parseImportedBenchmarkCandidates,
} from "@/lib/core/account";
import {
  analyzeAccountHomepage,
  buildPositioningInputFromHomepage,
} from "@/lib/core/account-homepage";
import { analyzeBenchmarkNote } from "@/lib/core/benchmark";
import { scanCompliance } from "@/lib/core/compliance";
import { generateDraftFromTopic } from "@/lib/core/content";
import { createTemplatePosterAssets } from "@/lib/core/poster-template";
import {
  createMobilePublishCardPayload,
  createMobilePublishCardUrl,
  decodeMobilePublishCardHash,
  type MobilePublishCardAssetPreview,
  type MobilePublishCardPayload,
} from "@/lib/core/publish-card";
import {
  createPublishPackageMarkdown,
  prepareManualPublishPackage,
  transitionPublishTask,
} from "@/lib/core/publish";
import { generateTopicCandidates, parseImportedTopicRows } from "@/lib/core/topic";
import type {
  AccountHomepageAnalysis,
  AccountHomepageInput,
  AccountPositioning,
  AccountPositioningInput,
  BenchmarkContentFormat,
  BenchmarkCandidate,
  BenchmarkNote,
  ContentDraft,
  GeneratedPosterAsset,
  PublishTask,
  Project,
  RawBenchmarkNote,
  ScoredBenchmarkCandidate,
  TopicCandidate,
} from "@/lib/core/types";
import {
  demoBenchmark,
  demoBenchmarkCandidates,
  demoDraft,
  demoProject,
  demoPublishTask,
  demoRawBenchmark,
  demoTopics,
} from "@/lib/sample-data";

type GenerationMode = "local" | "openai";
type AiTransport = "server" | "browser";

interface XhsOpsAppProps {
  initialPositioningInput?: AccountPositioningInput;
  initialHomepageText?: string;
  initialProviderStatus?: AiProviderStatusPayload;
}

const demoHomepageText = [
  "护肤自查室",
  "给25-35 岁的成分护肤新手做护肤决策辅助，把复杂成分翻译成能执行的日常判断。",
  "敏感肌修护别乱买，先看这 4 个成分",
  "油敏肌早八护肤流程，3 分钟出门",
  "同价位修护精华怎么选：3 个维度对比",
].join("\n");

const workspaceNav = [
  { label: "Settings", icon: SlidersHorizontal },
  { label: "Positioning", icon: Compass },
  { label: "Topic", icon: Search },
  { label: "Benchmark", icon: Layers3 },
  { label: "Studio", icon: FileText },
  { label: "Guard", icon: ShieldCheck },
  { label: "Queue", icon: CalendarDays },
];

const PROJECT_STORAGE_KEY = "xhs-ops-project";
const WORKSPACE_STORAGE_KEY = "xhs-ops-workspace";
const OPENAI_SETTINGS_STORAGE_KEY = "xhs-ops-openai-settings";
const WORKSPACE_EXPORT_VERSION = 1;
const DEFAULT_OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEFAULT_OPENAI_TEXT_MODEL = "gpt-5.5";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2";

type ProjectFormState = {
  name: string;
  persona: string;
  industry: string;
  tone: string;
  audience: string;
  forbiddenWords: string;
  brandColors: string;
};

type OpenAiSettingsFormState = {
  transport: AiTransport;
  apiKey: string;
  baseUrl: string;
  textModel: string;
  imageModel: string;
};

interface PositioningWorkspace {
  keyword: string;
  topics: TopicCandidate[];
  benchmark: BenchmarkNote;
  draft: ContentDraft;
  publishTask: PublishTask;
}

interface StoredWorkspaceSnapshot extends PositioningWorkspace {
  version: typeof WORKSPACE_EXPORT_VERSION;
  savedAt: string;
  generationMode: GenerationMode;
  project: Project;
  projectForm: ProjectFormState;
  subjectArea: string;
  accountAudience: string;
  differentiator: string;
  accountTone: string;
  accountPositioning: AccountPositioning;
  rawHomepageText: string;
  homepageAnalysis: AccountHomepageAnalysis | null;
  benchmarkSubjectArea: string;
  benchmarkFormat: BenchmarkContentFormat;
  rawBenchmarkCandidateImportText?: string;
  customBenchmarkCandidates?: BenchmarkCandidate[];
  rawTopicImportText?: string;
  selectedTopicId: string;
  rawBenchmarkText: string;
  draftHashtagInput: string;
  scanText: string;
  posterImages: GeneratedPosterAsset[];
  posterPromptOverrides?: Record<string, string>;
}

type ProviderStatus =
  | {
      kind: "checking";
      label: string;
      detail: string;
      textModel: string;
      imageModel: string;
    }
  | {
      kind: "ready";
      label: string;
      detail: string;
      textModel: string;
      imageModel: string;
    }
  | {
      kind: "missing-key";
      label: string;
      detail: string;
      textModel: string;
      imageModel: string;
    }
  | {
      kind: "static";
      label: string;
      detail: string;
      textModel: string;
      imageModel: string;
    };

const defaultProviderStatus: ProviderStatus = {
  kind: "checking",
  label: "检测 OpenAI",
  detail: "正在检查本地 Next API 后端和 GPT Image 2 配置。",
  textModel: "Text 检测中",
  imageModel: "Image 检测中",
};

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error ?? `Request failed with HTTP ${response.status}`);
  }
  return payload as T;
}

function providerStatusFromPayload(payload: Partial<AiProviderStatusPayload>): ProviderStatus {
  const textModel = payload.textModel ?? DEFAULT_OPENAI_TEXT_MODEL;
  const imageModel = payload.imageModel ?? DEFAULT_OPENAI_IMAGE_MODEL;

  if (payload.serverApiAvailable && payload.hasOpenAIKey) {
    return {
      kind: "ready",
      label: "OpenAI 已连接",
      detail: "本地后端已配置 OPENAI_API_KEY，文案与海报可走 OpenAI API。",
      textModel: `Text ${textModel}`,
      imageModel: `Image ${imageModel}`,
    };
  }

  return {
    kind: "missing-key",
    label: "OpenAI 未配置",
    detail: "在 .env.local 设置 OPENAI_API_KEY 后重启 pnpm dev，即可调用 GPT 文案和 GPT Image 2。",
    textModel: `Text ${textModel}`,
    imageModel: `Image ${imageModel}`,
  };
}

async function fetchProviderStatus(): Promise<ProviderStatus> {
  const response = await fetch("/api/ai/status/", {
    method: "GET",
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(`Provider status failed with HTTP ${response.status}`);
  }

  return providerStatusFromPayload((await response.json()) as Partial<AiProviderStatusPayload>);
}

function parseHomepageText(rawText: string, projectId: string): AccountHomepageInput {
  const lines = rawText
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    projectId,
    displayName: lines[0] ?? "未命名账号",
    bio: lines[1] ?? lines[0] ?? "未填写简介",
    recentNotesText: lines.slice(2).join("\n") || lines.join("\n") || "未提供近期笔记",
  };
}

function projectToForm(project: Project): ProjectFormState {
  return {
    name: project.name,
    persona: project.persona,
    industry: project.industry,
    tone: project.tone,
    audience: project.audience,
    forbiddenWords: project.forbiddenWords.join(", "),
    brandColors: project.brandColors.join(", "),
  };
}

function splitList(value: string) {
  return value
    .split(/[,，\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitHashtags(value: string) {
  return value
    .split(/[#,\s，、\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseBrandColors(value: string) {
  const colors = splitList(value).filter((color) => /^#[0-9a-f]{6}$/i.test(color));
  return colors.length > 0 ? colors.slice(0, 5) : demoProject.brandColors;
}

function projectFromForm(form: ProjectFormState, previous: Project): Project {
  return {
    id: previous.id,
    name: form.name.trim() || previous.name,
    persona: form.persona.trim() || previous.persona,
    industry: form.industry.trim() || previous.industry,
    tone: form.tone.trim() || previous.tone,
    audience: form.audience.trim() || previous.audience,
    forbiddenWords: splitList(form.forbiddenWords),
    brandColors: parseBrandColors(form.brandColors),
  };
}

function defaultOpenAiSettings(): OpenAiSettingsFormState {
  return {
    transport: "server",
    apiKey: "",
    baseUrl: DEFAULT_OPENAI_BASE_URL,
    textModel: DEFAULT_OPENAI_TEXT_MODEL,
    imageModel: DEFAULT_OPENAI_IMAGE_MODEL,
  };
}

function normalizeOpenAiSettings(settings: OpenAiSettingsFormState): OpenAiSettingsFormState {
  return {
    transport: settings.transport,
    apiKey: settings.apiKey.trim(),
    baseUrl: settings.baseUrl.trim().replace(/\/$/, "") || DEFAULT_OPENAI_BASE_URL,
    textModel: settings.textModel.trim() || DEFAULT_OPENAI_TEXT_MODEL,
    imageModel: settings.imageModel.trim() || DEFAULT_OPENAI_IMAGE_MODEL,
  };
}

function toOpenAiGenerationSettings(settings: OpenAiSettingsFormState): OpenAiGenerationSettings {
  const normalized = normalizeOpenAiSettings(settings);
  return {
    apiKey: normalized.apiKey,
    baseUrl: normalized.baseUrl,
    textModel: normalized.textModel,
    imageModel: normalized.imageModel,
  };
}

function isProject(value: unknown): value is Project {
  const project = value as Partial<Project>;
  return Boolean(
    project &&
      typeof project.id === "string" &&
      typeof project.name === "string" &&
      typeof project.persona === "string" &&
      typeof project.industry === "string" &&
      typeof project.tone === "string" &&
      typeof project.audience === "string" &&
      Array.isArray(project.forbiddenWords) &&
      Array.isArray(project.brandColors)
  );
}

function isOpenAiSettings(value: unknown): value is OpenAiSettingsFormState {
  const settings = value as Partial<OpenAiSettingsFormState>;
  return Boolean(
    settings &&
      (settings.transport === "server" || settings.transport === "browser") &&
      typeof settings.apiKey === "string" &&
      typeof settings.baseUrl === "string" &&
      typeof settings.textModel === "string" &&
      typeof settings.imageModel === "string"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === "string");
}

function isBenchmarkFormat(value: unknown): value is BenchmarkContentFormat {
  return ["避坑清单", "流程模板", "路线合集", "测评对比", "全部"].includes(String(value));
}

function isProjectForm(value: unknown): value is ProjectFormState {
  const form = value as Partial<ProjectFormState>;
  return Boolean(
    form &&
      typeof form.name === "string" &&
      typeof form.persona === "string" &&
      typeof form.industry === "string" &&
      typeof form.tone === "string" &&
      typeof form.audience === "string" &&
      typeof form.forbiddenWords === "string" &&
      typeof form.brandColors === "string"
  );
}

function isAccountPositioning(value: unknown): value is AccountPositioning {
  const positioning = value as Partial<AccountPositioning>;
  return Boolean(
    positioning &&
      typeof positioning.id === "string" &&
      typeof positioning.projectId === "string" &&
      typeof positioning.subjectArea === "string" &&
      typeof positioning.audience === "string" &&
      typeof positioning.differentiator === "string" &&
      typeof positioning.tone === "string" &&
      isStringArray(positioning.nameOptions) &&
      isStringArray(positioning.bioOptions) &&
      typeof positioning.selectedName === "string" &&
      typeof positioning.selectedBio === "string" &&
      typeof positioning.positioningStatement === "string" &&
      isStringArray(positioning.contentPillars) &&
      isRecord(positioning.benchmarkFilters) &&
      typeof positioning.benchmarkFilters.subjectArea === "string" &&
      Array.isArray(positioning.benchmarkFilters.contentFormats)
  );
}

function isTopicCandidate(value: unknown): value is TopicCandidate {
  const topic = value as Partial<TopicCandidate>;
  return Boolean(
    topic &&
      typeof topic.id === "string" &&
      typeof topic.projectId === "string" &&
      typeof topic.keyword === "string" &&
      typeof topic.title === "string" &&
      typeof topic.angle === "string" &&
      typeof topic.score === "number" &&
      Array.isArray(topic.reasons)
  );
}

function isBenchmarkNote(value: unknown): value is BenchmarkNote {
  const note = value as Partial<BenchmarkNote>;
  return Boolean(
    note &&
      typeof note.id === "string" &&
      typeof note.projectId === "string" &&
      typeof note.title === "string" &&
      typeof note.body === "string" &&
      isRecord(note.analysis) &&
      typeof note.analysis.openingHook === "string" &&
      Array.isArray(note.analysis.structure) &&
      Array.isArray(note.analysis.tags)
  );
}

function isBenchmarkCandidate(value: unknown): value is BenchmarkCandidate {
  const candidate = value as Partial<BenchmarkCandidate>;
  return Boolean(
    candidate &&
      typeof candidate.id === "string" &&
      typeof candidate.projectId === "string" &&
      typeof candidate.title === "string" &&
      typeof candidate.author === "string" &&
      typeof candidate.subjectArea === "string" &&
      typeof candidate.contentFormat === "string" &&
      typeof candidate.audiencePain === "string" &&
      isStringArray(candidate.tags) &&
      isRecord(candidate.metrics) &&
      typeof candidate.metrics.likes === "number" &&
      typeof candidate.metrics.saves === "number" &&
      typeof candidate.metrics.comments === "number"
  );
}

function isContentDraft(value: unknown): value is ContentDraft {
  const draft = value as Partial<ContentDraft>;
  return Boolean(
    draft &&
      typeof draft.id === "string" &&
      typeof draft.projectId === "string" &&
      typeof draft.topicId === "string" &&
      isStringArray(draft.titleOptions) &&
      typeof draft.selectedTitle === "string" &&
      typeof draft.body === "string" &&
      isStringArray(draft.hashtags) &&
      Array.isArray(draft.assetCards)
  );
}

function isPublishTask(value: unknown): value is PublishTask {
  const task = value as Partial<PublishTask>;
  return Boolean(
    task &&
      typeof task.id === "string" &&
      typeof task.projectId === "string" &&
      typeof task.draftId === "string" &&
      typeof task.scheduledAt === "string" &&
      typeof task.status === "string" &&
      typeof task.exportText === "string" &&
      Array.isArray(task.checklist) &&
      Array.isArray(task.assetManifest)
  );
}

function isWorkspaceSnapshot(value: unknown): value is StoredWorkspaceSnapshot {
  const workspace = value as Partial<StoredWorkspaceSnapshot>;
  return Boolean(
    workspace &&
      workspace.version === WORKSPACE_EXPORT_VERSION &&
      typeof workspace.savedAt === "string" &&
      (workspace.generationMode === "local" || workspace.generationMode === "openai") &&
      isProject(workspace.project) &&
      isProjectForm(workspace.projectForm) &&
      typeof workspace.subjectArea === "string" &&
      typeof workspace.accountAudience === "string" &&
      typeof workspace.differentiator === "string" &&
      typeof workspace.accountTone === "string" &&
      isAccountPositioning(workspace.accountPositioning) &&
      typeof workspace.rawHomepageText === "string" &&
      typeof workspace.benchmarkSubjectArea === "string" &&
      isBenchmarkFormat(workspace.benchmarkFormat) &&
      (workspace.rawBenchmarkCandidateImportText === undefined ||
        typeof workspace.rawBenchmarkCandidateImportText === "string") &&
      (workspace.customBenchmarkCandidates === undefined ||
        (Array.isArray(workspace.customBenchmarkCandidates) &&
          workspace.customBenchmarkCandidates.every(isBenchmarkCandidate))) &&
      typeof workspace.keyword === "string" &&
      Array.isArray(workspace.topics) &&
      workspace.topics.every(isTopicCandidate) &&
      typeof workspace.selectedTopicId === "string" &&
      typeof workspace.rawBenchmarkText === "string" &&
      isBenchmarkNote(workspace.benchmark) &&
      isContentDraft(workspace.draft) &&
      typeof workspace.draftHashtagInput === "string" &&
      typeof workspace.scanText === "string" &&
      isPublishTask(workspace.publishTask) &&
      Array.isArray(workspace.posterImages) &&
      (workspace.posterPromptOverrides === undefined ||
        isStringRecord(workspace.posterPromptOverrides))
  );
}

function readStoredProject() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(PROJECT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isProject(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredProject(project: Project) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(PROJECT_STORAGE_KEY, JSON.stringify(project));
}

function readStoredOpenAiSettings() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(OPENAI_SETTINGS_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isOpenAiSettings(parsed) ? normalizeOpenAiSettings(parsed) : null;
  } catch {
    return null;
  }
}

function writeStoredOpenAiSettings(settings: OpenAiSettingsFormState) {
  if (typeof window === "undefined" || !window.localStorage) return;
  window.localStorage.setItem(
    OPENAI_SETTINGS_STORAGE_KEY,
    JSON.stringify(normalizeOpenAiSettings(settings))
  );
}

function readStoredWorkspace() {
  if (typeof window === "undefined" || !window.localStorage) return null;
  try {
    const raw = window.localStorage.getItem(WORKSPACE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as unknown;
    return isWorkspaceSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredWorkspace(workspace: StoredWorkspaceSnapshot) {
  if (typeof window === "undefined" || !window.localStorage) return;
  try {
    window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(workspace));
  } catch {
    const slimWorkspace = {
      ...workspace,
      posterImages: [],
      publishTask: {
        ...workspace.publishTask,
        assetManifest: workspace.publishTask.assetManifest,
      },
    };
    try {
      window.localStorage.setItem(WORKSPACE_STORAGE_KEY, JSON.stringify(slimWorkspace));
    } catch {
      // Ignore storage quota failures; manual export still works from the current session.
    }
  }
}

function projectFromPositioning(positioning: AccountPositioning, baseProject: Project): Project {
  return {
    ...baseProject,
    persona: positioning.selectedBio || baseProject.persona,
    industry: positioning.subjectArea,
    tone: positioning.tone,
    audience: positioning.audience,
  };
}

function benchmarkFromCandidate(candidate: ScoredBenchmarkCandidate): BenchmarkNote {
  const body = [
    `${candidate.audiencePain}，这类开场适合先把用户拉进具体场景。`,
    `1. 拆标题：${candidate.title}`,
    `2. 拆主体：${candidate.contentFormat} / ${candidate.subjectArea}`,
    "3. 拆互动：用评论区问题继续追选题",
    `#${candidate.tags.join(" #")}`,
  ].join("\n");

  return analyzeBenchmarkNote({
    id: candidate.id,
    projectId: candidate.projectId,
    title: candidate.title,
    author: candidate.author,
    body,
    metrics: candidate.metrics,
    importedAt: new Date().toISOString(),
  });
}

function fallbackBenchmarkFromPositioning(positioning: AccountPositioning): BenchmarkNote {
  const body = [
    `${positioning.audience}最容易卡在第一步，需要先把问题放回具体使用场景。`,
    `1. 拆主体：${positioning.subjectArea}`,
    `2. 拆卖点：${positioning.differentiator}`,
    "3. 拆互动：把评论区高频问题整理成下一篇选题",
    `#${positioning.subjectArea} #避坑清单 #流程模板`,
  ].join("\n");

  return analyzeBenchmarkNote({
    id: `bench-${positioning.id}`,
    projectId: positioning.projectId,
    title: `${positioning.subjectArea}账号定位参考拆解`,
    author: "本地模板",
    body,
    metrics: { likes: 0, saves: 0, comments: 0 },
    importedAt: new Date().toISOString(),
  });
}

function workspaceFromPositioning(
  positioning: AccountPositioning,
  project: Project
): PositioningWorkspace {
  const keyword = positioning.subjectArea;
  const topics = generateTopicCandidates(keyword, project);
  const candidate = filterBenchmarkCandidates(demoBenchmarkCandidates, positioning, {
    subjectArea: positioning.benchmarkFilters.subjectArea,
    contentFormat: "全部",
  })[0];
  const benchmark = candidate
    ? benchmarkFromCandidate(candidate)
    : fallbackBenchmarkFromPositioning(positioning);
  const draft = generateDraftFromTopic(topics[0], project, [benchmark]);
  const publishTask = prepareManualPublishPackage(
    draft,
    project,
    "2026-07-07T12:30:00.000Z"
  );

  return {
    keyword,
    topics,
    benchmark,
    draft,
    publishTask,
  };
}

function readMobilePublishCardFromLocation() {
  if (typeof window === "undefined") return null;
  return decodeMobilePublishCardHash(window.location.hash);
}

function readPositioningInputFromLocation(projectId: string): AccountPositioningInput | undefined {
  if (typeof window === "undefined") return undefined;
  const params = new URLSearchParams(window.location.search);
  const subjectArea = params.get("subjectArea")?.trim();
  const audience = params.get("audience")?.trim();
  const differentiator = params.get("differentiator")?.trim();
  const tone = params.get("tone")?.trim();

  if (!subjectArea || !audience || !differentiator || !tone) {
    return undefined;
  }

  return {
    projectId,
    subjectArea,
    audience,
    differentiator,
    tone,
  };
}

function readHomepageTextFromLocation() {
  if (typeof window === "undefined") return undefined;
  return new URLSearchParams(window.location.search).get("homepageText")?.trim() || undefined;
}

function currentMobileCardUrlParts() {
  if (typeof window === "undefined") {
    return {
      origin: "",
      pathname: "/",
    };
  }

  return {
    origin: window.location.origin,
    pathname: window.location.pathname || "/",
  };
}

function providerStatusClass(kind: ProviderStatus["kind"]) {
  if (kind === "ready") return "bg-[#E4F1E8] text-[#214F45]";
  if (kind === "missing-key") return "bg-[#FFF3C9] text-[#74530C]";
  if (kind === "static") return "bg-[#FBE3E8] text-[#9D2633]";
  return "bg-[#F8F3E7] text-[#6D6A61]";
}

function posterAssetsToManifest(assets: GeneratedPosterAsset[]): PublishTask["assetManifest"] {
  return assets.map((asset) => ({
    cardId: asset.cardId,
    fileName: asset.fileName,
    mimeType: asset.mimeType,
    source: asset.source,
    description: asset.alt,
  }));
}

async function posterAssetToFile(asset: GeneratedPosterAsset) {
  const response = await fetch(asset.url);
  const blob = await response.blob();
  return new File([blob], asset.fileName, { type: asset.mimeType });
}

async function mobileAssetPreviewToFile(asset: MobilePublishCardAssetPreview) {
  const response = await fetch(asset.url);
  const blob = await response.blob();
  return new File([blob], asset.fileName, { type: asset.mimeType });
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-l border-[#2E6B5F]/30 px-4">
      <div className="text-xs font-medium uppercase text-[#6D6A61]">{label}</div>
      <div className="mt-1 truncate text-xl font-semibold text-[#1F2723]">{value}</div>
    </div>
  );
}

function SectionHeader({
  title,
  icon: Icon,
  aside,
}: {
  title: string;
  icon: typeof Search;
  aside?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-[#D8D2C1] pb-4 md:flex-row md:items-center md:justify-between">
      <div className="flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-md bg-[#1F2723] text-[#F8F3E7]">
          <Icon size={20} />
        </span>
        <h2 className="text-2xl font-semibold text-[#1F2723]">{title}</h2>
      </div>
      {aside}
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color =
    score >= 85
      ? "border-[#2E6B5F] bg-[#E4F1E8] text-[#214F45]"
      : score >= 70
        ? "border-[#F6C85F] bg-[#FFF3C9] text-[#74530C]"
        : "border-[#D8D2C1] bg-white text-[#6D6A61]";

  return (
    <span className={`inline-flex h-8 items-center rounded-md border px-2 text-sm font-semibold ${color}`}>
      {score}
    </span>
  );
}

function RiskBadge({ level }: { level: "low" | "medium" | "high" }) {
  const labels = {
    low: "低风险",
    medium: "需改写",
    high: "高风险",
  };
  const color = {
    low: "bg-[#E4F1E8] text-[#214F45]",
    medium: "bg-[#FFF3C9] text-[#74530C]",
    high: "bg-[#FBE2E3] text-[#9D2633]",
  }[level];

  return <span className={`rounded-md px-2.5 py-1 text-sm font-semibold ${color}`}>{labels[level]}</span>;
}

function MobilePublishCardView({ payload }: { payload: MobilePublishCardPayload }) {
  const [copiedCard, setCopiedCard] = useState(false);
  const [sharedCard, setSharedCard] = useState(false);

  async function handleCopyCardText() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(payload.exportText);
    }
    setCopiedCard(true);
  }

  async function handleShareCardText() {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      try {
        const previewFiles =
          payload.assetPreviews.length > 0
            ? await Promise.all(payload.assetPreviews.slice(0, 4).map(mobileAssetPreviewToFile))
            : [];
        if (previewFiles.length > 0 && nav.canShare?.({ files: previewFiles })) {
          await nav.share({
            title: payload.title,
            text: payload.exportText,
            files: previewFiles,
          });
          setSharedCard(true);
          return;
        }
      } catch {
        // Fall back to text-only sharing when a browser cannot materialize data-url files.
      }

      await navigator.share({
        title: payload.title,
        text: payload.exportText,
      });
      setSharedCard(true);
      return;
    }
    await handleCopyCardText();
  }

  return (
    <main className="min-h-screen bg-[#F8F3E7] px-4 py-6 text-[#1F2723]">
      <div className="mx-auto grid max-w-xl gap-4">
        <section className="rounded-lg border border-[#D8D2C1] bg-white p-5">
          <p className="text-sm font-semibold uppercase text-[#E85D75]">XHS Mobile Publish</p>
          <h1 className="mt-2 text-2xl font-semibold">手机发布卡</h1>
          <h2 className="mt-5 text-xl font-semibold leading-8">{payload.title}</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {payload.hashtags.map((tag) => (
              <span key={tag} className="rounded-md bg-[#FFF3C9] px-2 py-1 text-xs text-[#74530C]">
                #{tag}
              </span>
            ))}
          </div>
          <pre className="mt-5 max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-[#1F2723] p-4 text-sm leading-6 text-[#FCFAF3]">
            {payload.exportText}
          </pre>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#2E6B5F] bg-white px-3 text-sm font-semibold text-[#214F45]"
              type="button"
              onClick={handleCopyCardText}
            >
              <ClipboardCheck size={16} />
              {copiedCard ? "已复制" : "复制文案"}
            </button>
            <button
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-[#E85D75] bg-white px-3 text-sm font-semibold text-[#9D2633]"
              type="button"
              onClick={handleShareCardText}
            >
              <Share2 size={16} />
              {sharedCard ? "已分享" : "系统分享"}
            </button>
            <a
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#2E6B5F] px-3 text-sm font-semibold text-white"
              href={payload.xhsAppPublishUrl}
              onClick={() => {
                void handleCopyCardText();
              }}
            >
              <ClipboardCheck size={16} />
              复制并打开小红书
            </a>
            <a
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#E85D75] px-3 text-sm font-semibold text-white"
              href={payload.xhsAppPublishUrl}
            >
              <Smartphone size={16} />
              打开小红书
            </a>
            <a
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#1F2723] px-3 text-sm font-semibold text-white"
              href={payload.officialPublishUrl}
              target="_blank"
              rel="noreferrer"
            >
              <ExternalLink size={16} />
              网页发布
            </a>
          </div>
        </section>

        {payload.assetPreviews.length > 0 && (
          <section className="rounded-lg border border-[#D8D2C1] bg-white p-5">
            <p className="text-xs font-semibold uppercase text-[#6D6A61]">素材预览</p>
            <div className="mt-3 grid gap-3">
              {payload.assetPreviews.map((asset) => (
                <div key={`${asset.cardId}-${asset.fileName}`} className="grid gap-2">
                  <NextImage
                    src={asset.url}
                    alt={asset.description}
                    width={1080}
                    height={1440}
                    unoptimized
                    className="aspect-[3/4] w-full rounded-md border border-[#D8D2C1] object-cover"
                  />
                  <div className="flex items-center justify-between gap-2 text-xs text-[#6D6A61]">
                    <span className="min-w-0 truncate">{asset.fileName}</span>
                    <a
                      className="inline-flex h-8 items-center rounded-md border border-[#D8D2C1] bg-[#FCFAF3] px-2 font-semibold text-[#214F45]"
                      href={asset.url}
                      download={asset.fileName}
                    >
                      下载素材
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="rounded-lg border border-[#D8D2C1] bg-white p-5">
          <p className="text-xs font-semibold uppercase text-[#6D6A61]">素材清单</p>
          <div className="mt-3 grid gap-2">
            {payload.assetManifest.length > 0 ? (
              payload.assetManifest.map((asset) => (
                <div
                  key={`${asset.cardId}-${asset.fileName}`}
                  className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-[#F8F3E7] p-3 text-sm"
                >
                  <span className="min-w-0 truncate">{asset.fileName}</span>
                  <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs text-[#6D6A61]">
                    {asset.source === "openai" ? "GPT" : "模板"}
                  </span>
                </div>
              ))
            ) : (
              <div className="rounded-md bg-[#F8F3E7] p-3 text-sm text-[#6D6A61]">暂无素材</div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

export function XhsOpsApp({
  initialPositioningInput,
  initialHomepageText,
  initialProviderStatus,
}: XhsOpsAppProps = {}) {
  const storedProjectAtRender = readStoredProject();
  const browserHomepageTextAtRender = initialHomepageText ?? readHomepageTextFromLocation();
  const browserPositioningInputAtRender =
    initialPositioningInput ?? readPositioningInputFromLocation((storedProjectAtRender ?? demoProject).id);
  const shouldLoadStoredWorkspace = !browserPositioningInputAtRender && !browserHomepageTextAtRender;
  const storedWorkspaceAtRender = shouldLoadStoredWorkspace ? readStoredWorkspace() : null;
  const storedOpenAiSettingsAtRender = readStoredOpenAiSettings();
  const initialProject = storedWorkspaceAtRender?.project ?? storedProjectAtRender ?? demoProject;
  const initialHomepageAnalysis = storedWorkspaceAtRender?.homepageAnalysis ?? (browserHomepageTextAtRender
    ? analyzeAccountHomepage(parseHomepageText(browserHomepageTextAtRender, initialProject.id))
    : null);
  const derivedPositioningInput =
    browserPositioningInputAtRender ??
    (initialHomepageAnalysis ? buildPositioningInputFromHomepage(initialHomepageAnalysis) : undefined);
  const initialPositioning =
    storedWorkspaceAtRender?.accountPositioning ??
    (derivedPositioningInput
      ? generateAccountPositioning(derivedPositioningInput)
      : generateAccountPositioning({
          projectId: initialProject.id,
          subjectArea: initialProject.industry,
          audience: initialProject.audience,
          differentiator: "把复杂信息翻译成能执行的日常判断",
          tone: initialProject.tone,
        }));
  const hasInitialPositioningOverride = Boolean(derivedPositioningInput);
  const initialWorkflowProject = storedWorkspaceAtRender?.project ?? (hasInitialPositioningOverride
    ? projectFromPositioning(initialPositioning, initialProject)
    : initialProject);
  const initialWorkspace = storedWorkspaceAtRender
    ? {
        keyword: storedWorkspaceAtRender.keyword,
        topics: storedWorkspaceAtRender.topics,
        benchmark: storedWorkspaceAtRender.benchmark,
        draft: storedWorkspaceAtRender.draft,
        publishTask: storedWorkspaceAtRender.publishTask,
      }
    : hasInitialPositioningOverride
      ? workspaceFromPositioning(initialPositioning, initialWorkflowProject)
      : {
          keyword: "敏感肌修护",
          topics: demoTopics,
          benchmark: demoBenchmark,
          draft: demoDraft,
          publishTask: demoPublishTask,
        };
  const initialAiStatus = storedWorkspaceAtRender
    ? "工作区已恢复"
    : initialHomepageAnalysis
      ? "本地模板已分析主页"
      : browserPositioningInputAtRender
        ? "本地模板已生成"
        : "本地模板模式";
  const [generationMode, setGenerationMode] = useState<GenerationMode>(
    storedWorkspaceAtRender?.generationMode ?? "local"
  );
  const [aiStatus, setAiStatus] = useState(initialAiStatus);
  const [openAiSettings, setOpenAiSettings] = useState<OpenAiSettingsFormState>(
    storedOpenAiSettingsAtRender ?? defaultOpenAiSettings()
  );
  const [openAiSettingsStatus, setOpenAiSettingsStatus] = useState(
    storedOpenAiSettingsAtRender?.transport === "browser" && storedOpenAiSettingsAtRender.apiKey
      ? "浏览器直连已配置"
      : "服务器后端优先"
  );
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>(
    initialProviderStatus ? providerStatusFromPayload(initialProviderStatus) : defaultProviderStatus
  );
  const [project, setProject] = useState<Project>(initialWorkflowProject);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(
    () => storedWorkspaceAtRender?.projectForm ?? projectToForm(initialWorkflowProject)
  );
  const [settingsStatus, setSettingsStatus] = useState(
    storedWorkspaceAtRender ? "已恢复工作区" : storedProjectAtRender ? "已加载本地设置" : "使用默认设置"
  );
  const [workspaceJson, setWorkspaceJson] = useState("");
  const [workspaceStatus, setWorkspaceStatus] = useState(
    storedWorkspaceAtRender ? "自动保存已恢复" : "自动保存开启"
  );
  const [isGeneratingPositioning, setIsGeneratingPositioning] = useState(false);
  const [isAnalyzingHomepage, setIsAnalyzingHomepage] = useState(false);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [isAnalyzingBenchmark, setIsAnalyzingBenchmark] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [regeneratingPosterCardId, setRegeneratingPosterCardId] = useState<string | null>(null);
  const [isRewritingCompliance, setIsRewritingCompliance] = useState(false);
  const [posterImages, setPosterImages] = useState<GeneratedPosterAsset[]>(
    storedWorkspaceAtRender?.posterImages ?? []
  );
  const [posterPromptOverrides, setPosterPromptOverrides] = useState<Record<string, string>>(
    storedWorkspaceAtRender?.posterPromptOverrides ?? {}
  );
  const [subjectArea, setSubjectArea] = useState(storedWorkspaceAtRender?.subjectArea ?? initialPositioning.subjectArea);
  const [accountAudience, setAccountAudience] = useState(
    storedWorkspaceAtRender?.accountAudience ?? initialPositioning.audience
  );
  const [differentiator, setDifferentiator] = useState(
    storedWorkspaceAtRender?.differentiator ?? initialPositioning.differentiator
  );
  const [accountTone, setAccountTone] = useState(storedWorkspaceAtRender?.accountTone ?? initialPositioning.tone);
  const [accountPositioning, setAccountPositioning] =
    useState<AccountPositioning>(initialPositioning);
  const [rawHomepageText, setRawHomepageText] = useState(
    storedWorkspaceAtRender?.rawHomepageText ?? browserHomepageTextAtRender ?? demoHomepageText
  );
  const [homepageAnalysis, setHomepageAnalysis] =
    useState<AccountHomepageAnalysis | null>(initialHomepageAnalysis);
  const [benchmarkSubjectArea, setBenchmarkSubjectArea] = useState(
    storedWorkspaceAtRender?.benchmarkSubjectArea ?? initialPositioning.benchmarkFilters.subjectArea
  );
  const [benchmarkFormat, setBenchmarkFormat] = useState<BenchmarkContentFormat>(
    storedWorkspaceAtRender?.benchmarkFormat ?? "全部"
  );
  const [rawBenchmarkCandidateImportText, setRawBenchmarkCandidateImportText] = useState(
    storedWorkspaceAtRender?.rawBenchmarkCandidateImportText ?? ""
  );
  const [customBenchmarkCandidates, setCustomBenchmarkCandidates] = useState<BenchmarkCandidate[]>(
    storedWorkspaceAtRender?.customBenchmarkCandidates ?? []
  );
  const [keyword, setKeyword] = useState(initialWorkspace.keyword);
  const [topics, setTopics] = useState<TopicCandidate[]>(initialWorkspace.topics);
  const [rawTopicImportText, setRawTopicImportText] = useState(
    storedWorkspaceAtRender?.rawTopicImportText ?? ""
  );
  const [selectedTopicId, setSelectedTopicId] = useState(
    storedWorkspaceAtRender?.selectedTopicId ?? initialWorkspace.topics[0].id
  );
  const [rawBenchmarkText, setRawBenchmarkText] = useState(
    storedWorkspaceAtRender?.rawBenchmarkText ?? initialWorkspace.benchmark.body
  );
  const [benchmark, setBenchmark] = useState<BenchmarkNote>(initialWorkspace.benchmark);
  const [draft, setDraft] = useState<ContentDraft>(initialWorkspace.draft);
  const [draftHashtagInput, setDraftHashtagInput] = useState(
    storedWorkspaceAtRender?.draftHashtagInput ?? initialWorkspace.draft.hashtags.join(", ")
  );
  const [scanText, setScanText] = useState(
    storedWorkspaceAtRender?.scanText ?? `${initialWorkspace.draft.selectedTitle}\n${initialWorkspace.draft.body}`
  );
  const [publishTask, setPublishTask] = useState<PublishTask>(initialWorkspace.publishTask);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);
  const [mobilePublishCardPayload] = useState<MobilePublishCardPayload | null>(() =>
    readMobilePublishCardFromLocation()
  );
  const [mobilePublishCardUrl, setMobilePublishCardUrl] = useState("");
  const [mobileCardStatus, setMobileCardStatus] = useState("");
  const publishPackageMarkdown = useMemo(
    () => createPublishPackageMarkdown(publishTask, draft, project),
    [draft, project, publishTask]
  );
  const publishPackageDownloadHref = useMemo(
    () => `data:text/markdown;charset=utf-8,${encodeURIComponent(publishPackageMarkdown)}`,
    [publishPackageMarkdown]
  );

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? topics[0],
    [selectedTopicId, topics]
  );
  const compliance = useMemo(
    () => scanCompliance(scanText, project.forbiddenWords),
    [project.forbiddenWords, scanText]
  );
  const allBenchmarkCandidates = useMemo(() => {
    const customKeys = new Set(
      customBenchmarkCandidates.map((candidate) => `${candidate.subjectArea}::${candidate.title}`)
    );
    return [
      ...customBenchmarkCandidates,
      ...demoBenchmarkCandidates.filter(
        (candidate) => !customKeys.has(`${candidate.subjectArea}::${candidate.title}`)
      ),
    ];
  }, [customBenchmarkCandidates]);
  const subjectAreaOptions = useMemo(
    () =>
      Array.from(
        new Set([
          accountPositioning.subjectArea,
          ...allBenchmarkCandidates.map((candidate) => candidate.subjectArea),
        ])
      ),
    [accountPositioning.subjectArea, allBenchmarkCandidates]
  );
  const contentFormatOptions = useMemo<BenchmarkContentFormat[]>(
    () => [
      "全部",
      ...Array.from(new Set(allBenchmarkCandidates.map((candidate) => candidate.contentFormat))),
    ],
    [allBenchmarkCandidates]
  );
  const filteredBenchmarkCandidates = useMemo(
    () =>
      filterBenchmarkCandidates(allBenchmarkCandidates, accountPositioning, {
        subjectArea: benchmarkSubjectArea,
        contentFormat: benchmarkFormat,
      }),
    [accountPositioning, allBenchmarkCandidates, benchmarkFormat, benchmarkSubjectArea]
  );
  const normalizedOpenAiSettings = useMemo(
    () => normalizeOpenAiSettings(openAiSettings),
    [openAiSettings]
  );
  const activeProviderStatus: ProviderStatus =
    generationMode === "openai" && normalizedOpenAiSettings.transport === "browser"
      ? {
          kind: normalizedOpenAiSettings.apiKey ? "ready" : "missing-key",
          label: normalizedOpenAiSettings.apiKey ? "浏览器直连已配置" : "浏览器直连未配置",
          detail: normalizedOpenAiSettings.apiKey
            ? "当前 OpenAI 操作会用浏览器端设置或自定义代理发起请求。"
            : "填写并保存 OpenAI API Key 后，可在静态页面中调用 GPT 和图片模型。",
          textModel: `Text ${normalizedOpenAiSettings.textModel}`,
          imageModel: `Image ${normalizedOpenAiSettings.imageModel}`,
        }
      : providerStatus;

  const createWorkspaceSnapshot = useCallback((): StoredWorkspaceSnapshot => {
    return {
      version: WORKSPACE_EXPORT_VERSION,
      savedAt: new Date().toISOString(),
      generationMode,
      project,
      projectForm,
      subjectArea,
      accountAudience,
      differentiator,
      accountTone,
      accountPositioning,
      rawHomepageText,
      homepageAnalysis,
      benchmarkSubjectArea,
      benchmarkFormat,
      rawBenchmarkCandidateImportText,
      customBenchmarkCandidates,
      keyword,
      topics,
      rawTopicImportText,
      selectedTopicId,
      rawBenchmarkText,
      benchmark,
      draft,
      draftHashtagInput,
      scanText,
      publishTask,
      posterImages,
      posterPromptOverrides,
    };
  }, [
    accountAudience,
    accountPositioning,
    accountTone,
    benchmark,
    benchmarkFormat,
    benchmarkSubjectArea,
    customBenchmarkCandidates,
    differentiator,
    draft,
    draftHashtagInput,
    generationMode,
    homepageAnalysis,
    keyword,
    posterImages,
    posterPromptOverrides,
    project,
    projectForm,
    publishTask,
    rawBenchmarkCandidateImportText,
    rawBenchmarkText,
    rawHomepageText,
    rawTopicImportText,
    scanText,
    selectedTopicId,
    subjectArea,
    topics,
  ]);

  function applyWorkspaceSnapshot(snapshot: StoredWorkspaceSnapshot, status: string) {
    setGenerationMode(snapshot.generationMode);
    setProject(snapshot.project);
    setProjectForm(snapshot.projectForm);
    setSubjectArea(snapshot.subjectArea);
    setAccountAudience(snapshot.accountAudience);
    setDifferentiator(snapshot.differentiator);
    setAccountTone(snapshot.accountTone);
    setAccountPositioning(snapshot.accountPositioning);
    setRawHomepageText(snapshot.rawHomepageText);
    setHomepageAnalysis(snapshot.homepageAnalysis);
    setBenchmarkSubjectArea(snapshot.benchmarkSubjectArea);
    setBenchmarkFormat(snapshot.benchmarkFormat);
    setRawBenchmarkCandidateImportText(snapshot.rawBenchmarkCandidateImportText ?? "");
    setCustomBenchmarkCandidates(snapshot.customBenchmarkCandidates ?? []);
    setKeyword(snapshot.keyword);
    setTopics(snapshot.topics);
    setRawTopicImportText(snapshot.rawTopicImportText ?? "");
    setSelectedTopicId(snapshot.selectedTopicId);
    setRawBenchmarkText(snapshot.rawBenchmarkText);
    setBenchmark(snapshot.benchmark);
    setDraft(snapshot.draft);
    setDraftHashtagInput(snapshot.draftHashtagInput);
    setScanText(snapshot.scanText);
    setPublishTask(snapshot.publishTask);
    setPosterImages(snapshot.posterImages);
    setPosterPromptOverrides(snapshot.posterPromptOverrides ?? {});
    setCopied(false);
    setShared(false);
    setMobilePublishCardUrl("");
    setMobileCardStatus("");
    setSettingsStatus(status);
    setWorkspaceStatus(status);
    setAiStatus(status);
    writeStoredProject(snapshot.project);
    writeStoredWorkspace(snapshot);
  }

  async function handleExportWorkspace() {
    const json = JSON.stringify(createWorkspaceSnapshot(), null, 2);
    setWorkspaceJson(json);
    setWorkspaceStatus("工作区已导出");
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(json);
    }
  }

  function handleImportWorkspace() {
    try {
      const parsed = JSON.parse(workspaceJson) as unknown;
      if (!isWorkspaceSnapshot(parsed)) {
        throw new Error("工作区 JSON 格式不匹配");
      }
      applyWorkspaceSnapshot(parsed, "工作区已导入");
    } catch (error) {
      setWorkspaceStatus(error instanceof Error ? `导入失败：${error.message}` : "导入失败");
    }
  }

  useEffect(() => {
    let isMounted = true;

    fetchProviderStatus()
      .then((status) => {
        if (isMounted) {
          setProviderStatus(status);
        }
      })
      .catch(() => {
        if (isMounted) {
          setProviderStatus({
            kind: "static",
            label: "静态预览",
            detail: "当前页面没有可用的 Next API 后端；OpenAI/GPT Image 2 请在本地 pnpm dev 中使用。",
            textModel: "Text 本地模板",
            imageModel: "Image 模板海报",
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (mobilePublishCardPayload) return;
    writeStoredWorkspace(createWorkspaceSnapshot());
  }, [createWorkspaceSnapshot, mobilePublishCardPayload]);

  function applyPositioning(nextPositioning: AccountPositioning) {
    const nextProject = projectFromPositioning(nextPositioning, project);
    const nextWorkspace = workspaceFromPositioning(nextPositioning, nextProject);

    setProject(nextProject);
    setProjectForm(projectToForm(nextProject));
    setSettingsStatus("定位已同步到项目设置");
    setSubjectArea(nextPositioning.subjectArea);
    setAccountAudience(nextPositioning.audience);
    setDifferentiator(nextPositioning.differentiator);
    setAccountTone(nextPositioning.tone);
    setAccountPositioning(nextPositioning);
    setBenchmarkSubjectArea(nextPositioning.benchmarkFilters.subjectArea);
    setBenchmarkFormat("全部");
    setKeyword(nextWorkspace.keyword);
    setTopics(nextWorkspace.topics);
    setRawTopicImportText("");
    setSelectedTopicId(nextWorkspace.topics[0].id);
    setRawBenchmarkText(nextWorkspace.benchmark.body);
    setBenchmark(nextWorkspace.benchmark);
    setDraft(nextWorkspace.draft);
    setDraftHashtagInput(nextWorkspace.draft.hashtags.join(", "));
    setScanText(`${nextWorkspace.draft.selectedTitle}\n${nextWorkspace.draft.body}`);
    setPublishTask(nextWorkspace.publishTask);
    setPosterImages([]);
    setPosterPromptOverrides({});
    setCopied(false);
    setShared(false);
    setMobilePublishCardUrl("");
    setMobileCardStatus("");
  }

  function syncPosterAssets(nextAssets: GeneratedPosterAsset[]) {
    setPosterImages(nextAssets);
    setPublishTask((task) => ({
      ...task,
      assetManifest: posterAssetsToManifest(nextAssets),
      updatedAt: new Date().toISOString(),
    }));
  }

  function mergePosterAsset(nextAsset: GeneratedPosterAsset) {
    const nextAssets = posterImages.some((asset) => asset.cardId === nextAsset.cardId)
      ? posterImages.map((asset) => (asset.cardId === nextAsset.cardId ? nextAsset : asset))
      : [...posterImages, nextAsset];
    const cardOrder = new Map(draft.assetCards.map((card, index) => [card.id, index]));

    return nextAssets.sort(
      (left, right) =>
        (cardOrder.get(left.cardId) ?? Number.MAX_SAFE_INTEGER) -
        (cardOrder.get(right.cardId) ?? Number.MAX_SAFE_INTEGER)
    );
  }

  function posterPromptForCard(card: ContentDraft["assetCards"][number]) {
    return posterPromptOverrides[card.id] ?? buildXhsPosterPrompt(project, draft, card);
  }

  function posterPromptForCardId(cardId?: string) {
    const card = draft.assetCards.find((item) => item.id === cardId) ?? draft.assetCards[0];
    return card ? posterPromptForCard(card) : undefined;
  }

  function handlePosterPromptChange(cardId: string, value: string) {
    setPosterPromptOverrides((prompts) => ({
      ...prompts,
      [cardId]: value,
    }));
  }

  function handlePosterPromptReset(cardId: string) {
    setPosterPromptOverrides((prompts) => {
      const nextPrompts = { ...prompts };
      delete nextPrompts[cardId];
      return nextPrompts;
    });
  }

  function templatePosterForCard(cardId: string) {
    return (
      createTemplatePosterAssets(draft, project).find((asset) => asset.cardId === cardId) ??
      createTemplatePosterAssets(draft, project)[0]
    );
  }

  function syncDraftState(nextDraft: ContentDraft, options: { clearPosters?: boolean } = {}) {
    const nextDraftWithCompliance = {
      ...nextDraft,
      compliance: scanCompliance(`${nextDraft.selectedTitle}\n${nextDraft.body}`, project.forbiddenWords),
    };
    const nextPosterImages = options.clearPosters ? [] : posterImages;

    setDraft(nextDraftWithCompliance);
    setScanText(`${nextDraftWithCompliance.selectedTitle}\n${nextDraftWithCompliance.body}`);
    setPublishTask((task) => {
      const nextTask = prepareManualPublishPackage(
        nextDraftWithCompliance,
        project,
        task.scheduledAt,
        nextPosterImages
      );

      return {
        ...nextTask,
        status: task.status === "published" ? "ready" : task.status,
        createdAt: task.createdAt,
        updatedAt: new Date().toISOString(),
      };
    });
    if (options.clearPosters) {
      setPosterImages([]);
    }
    setCopied(false);
    setShared(false);
    setMobilePublishCardUrl("");
    setMobileCardStatus("");
  }

  function handleDraftTitleChange(value: string) {
    const nextTitleOptions = value.trim()
      ? [value, ...draft.titleOptions.filter((title) => title !== value)].slice(0, 5)
      : draft.titleOptions;

    syncDraftState({
      ...draft,
      selectedTitle: value,
      titleOptions: nextTitleOptions,
    });
  }

  function handleSelectDraftTitle(title: string) {
    syncDraftState({
      ...draft,
      selectedTitle: title,
    });
  }

  function handleDraftBodyChange(value: string) {
    syncDraftState({
      ...draft,
      body: value,
    });
  }

  function handleDraftHashtagsChange(value: string) {
    setDraftHashtagInput(value);
    syncDraftState({
      ...draft,
      hashtags: splitHashtags(value),
    });
  }

  function handleAssetCardChange(
    cardId: string,
    patch: Partial<ContentDraft["assetCards"][number]>
  ) {
    syncDraftState(
      {
        ...draft,
        assetCards: draft.assetCards.map((card) =>
          card.id === cardId
            ? {
                ...card,
                ...patch,
              }
            : card
        ),
      },
      { clearPosters: true }
    );
  }

  function handleAssetCardBulletsChange(cardId: string, value: string) {
    handleAssetCardChange(cardId, {
      bullets: value
        .split(/\n+/)
        .map((item) => item.trim())
        .filter(Boolean),
    });
  }

  function handleProjectFormChange(field: keyof ProjectFormState, value: string) {
    setProjectForm((form) => ({
      ...form,
      [field]: value,
    }));
    setSettingsStatus("设置未保存");
  }

  function handleSaveProjectSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextProject = projectFromForm(projectForm, project);
    setProject(nextProject);
    setProjectForm(projectToForm(nextProject));
    setSubjectArea((current) => (current === project.industry ? nextProject.industry : current));
    setAccountAudience((current) => (current === project.audience ? nextProject.audience : current));
    setAccountTone((current) => (current === project.tone ? nextProject.tone : current));
    writeStoredProject(nextProject);
    setSettingsStatus("设置已保存");
    setAiStatus("项目设置已更新");
  }

  function handleOpenAiSettingsChange(field: keyof OpenAiSettingsFormState, value: string) {
    setOpenAiSettings((settings) => ({
      ...settings,
      [field]: field === "transport" ? (value as AiTransport) : value,
    }));
    setOpenAiSettingsStatus("OpenAI 设置未保存");
  }

  function handleSaveOpenAiSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeOpenAiSettings(openAiSettings);
    setOpenAiSettings(normalized);
    writeStoredOpenAiSettings(normalized);
    setOpenAiSettingsStatus(
      normalized.transport === "browser" && normalized.apiKey
        ? "浏览器直连已配置"
        : "服务器后端优先"
    );
    setAiStatus(normalized.transport === "browser" ? "OpenAI 浏览器直连模式" : "OpenAI 后端模式");
  }

  function currentOpenAiSettings() {
    const normalized = normalizeOpenAiSettings(openAiSettings);
    if (normalized.transport === "browser" && !normalized.apiKey) {
      throw new Error("请先填写 OpenAI API Key");
    }
    return toOpenAiGenerationSettings(normalized);
  }

  function shouldUseBrowserOpenAi() {
    return generationMode === "openai" && openAiSettings.transport === "browser";
  }

  async function handleGeneratePositioning() {
    const input = {
      projectId: project.id,
      subjectArea,
      audience: accountAudience,
      differentiator,
      tone: accountTone,
    };

    if (generationMode === "local") {
      applyPositioning(generateAccountPositioning(input));
      setAiStatus("本地模板已生成");
      return;
    }

    setIsGeneratingPositioning(true);
    setAiStatus("OpenAI 正在生成定位");
    try {
      if (shouldUseBrowserOpenAi()) {
        const positioning = await generateXhsPositioningWithOpenAI({
          ...input,
          settings: currentOpenAiSettings(),
        });
        applyPositioning(positioning);
        setAiStatus("浏览器 OpenAI 已生成定位");
      } else {
        const payload = await postJson<{ positioning: AccountPositioning }>("/api/ai/positioning/", input);
        applyPositioning(payload.positioning);
        setAiStatus("OpenAI 已生成定位");
      }
    } catch (error) {
      applyPositioning(generateAccountPositioning(input));
      setAiStatus(error instanceof Error ? `OpenAI 不可用：${error.message}` : "OpenAI 不可用");
    } finally {
      setIsGeneratingPositioning(false);
    }
  }

  async function handlePositioningSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleGeneratePositioning();
  }

  async function handleAnalyzeHomepage() {
    const profile = parseHomepageText(rawHomepageText, project.id);

    if (generationMode === "local") {
      setHomepageAnalysis(analyzeAccountHomepage(profile));
      setAiStatus("本地模板已分析主页");
      return;
    }

    setIsAnalyzingHomepage(true);
    setAiStatus("OpenAI 正在分析主页");
    try {
      if (shouldUseBrowserOpenAi()) {
        const payload = await analyzeXhsAccountHomepageWithOpenAI({
          project,
          profile,
          settings: currentOpenAiSettings(),
        });
        setHomepageAnalysis(payload.analysis);
        setAiStatus("浏览器 OpenAI 已分析主页");
      } else {
        const payload = await postJson<{
          analysis: AccountHomepageAnalysis;
          positioningInput: AccountPositioningInput;
        }>("/api/ai/account-analysis/", {
          project,
          profile,
        });
        setHomepageAnalysis(payload.analysis);
        setAiStatus("OpenAI 已分析主页");
      }
    } catch (error) {
      setHomepageAnalysis(analyzeAccountHomepage(profile));
      setAiStatus(error instanceof Error ? `OpenAI 不可用：${error.message}` : "OpenAI 不可用");
    } finally {
      setIsAnalyzingHomepage(false);
    }
  }

  async function handleHomepageSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await handleAnalyzeHomepage();
  }

  function handleApplyHomepageAnalysis() {
    if (!homepageAnalysis) return;
      const input = buildPositioningInputFromHomepage(homepageAnalysis);
    setSubjectArea(input.subjectArea);
    setAccountAudience(input.audience);
    setDifferentiator(input.differentiator);
    setAccountTone(input.tone);
    applyPositioning(generateAccountPositioning(input));
    setAiStatus("主页分析已应用到定位");
  }

  async function handleGenerateTopics() {
    if (generationMode === "local") {
      const nextTopics = generateTopicCandidates(keyword, project);
      setTopics(nextTopics);
      setSelectedTopicId(nextTopics[0].id);
      setAiStatus("本地模板已生成选题");
      return;
    }

    setIsGeneratingTopics(true);
    setAiStatus("OpenAI 正在检索选题");
    try {
      const generatedTopics = shouldUseBrowserOpenAi()
        ? await generateXhsTopicsWithOpenAI({
            keyword,
            project,
            settings: currentOpenAiSettings(),
          })
        : (
            await postJson<{ topics: TopicCandidate[] }>("/api/ai/topics/", {
              keyword,
              project,
            })
          ).topics;
      const nextTopics = generatedTopics.length > 0 ? generatedTopics : generateTopicCandidates(keyword, project);
      setTopics(nextTopics);
      setSelectedTopicId(nextTopics[0].id);
      setAiStatus(shouldUseBrowserOpenAi() ? "浏览器 OpenAI 已生成选题" : "OpenAI 已生成选题");
    } catch (error) {
      const nextTopics = generateTopicCandidates(keyword, project);
      setTopics(nextTopics);
      setSelectedTopicId(nextTopics[0].id);
      setAiStatus(error instanceof Error ? `OpenAI 不可用：${error.message}` : "OpenAI 不可用");
    } finally {
      setIsGeneratingTopics(false);
    }
  }

  function handleImportTopics() {
    const importedTopics = parseImportedTopicRows(rawTopicImportText, project, keyword);

    if (importedTopics.length === 0) {
      setAiStatus("没有可导入的爆款数据");
      return;
    }

    const importedTitles = new Set(importedTopics.map((topic) => topic.title.trim()));
    setTopics((currentTopics) => [
      ...importedTopics,
      ...currentTopics.filter((topic) => !importedTitles.has(topic.title.trim())),
    ]);
    setSelectedTopicId(importedTopics[0].id);
    if (!keyword.trim()) {
      setKeyword(importedTopics[0].keyword);
    }
    setAiStatus(`已导入 ${importedTopics.length} 条爆款选题`);
  }

  function handleImportBenchmarkCandidates() {
    const importedCandidates = parseImportedBenchmarkCandidates(rawBenchmarkCandidateImportText, {
      projectId: project.id,
      subjectArea: benchmarkSubjectArea || accountPositioning.subjectArea,
      contentFormat: benchmarkFormat,
    });

    if (importedCandidates.length === 0) {
      setAiStatus("没有可导入的对标候选");
      return;
    }

    const importedKeys = new Set(
      importedCandidates.map((candidate) => `${candidate.subjectArea}::${candidate.title}`)
    );
    setCustomBenchmarkCandidates((currentCandidates) => [
      ...importedCandidates,
      ...currentCandidates.filter(
        (candidate) => !importedKeys.has(`${candidate.subjectArea}::${candidate.title}`)
      ),
    ]);
    setBenchmarkSubjectArea(importedCandidates[0].subjectArea);
    setBenchmarkFormat("全部");
    setAiStatus(`已导入 ${importedCandidates.length} 条对标候选`);
  }

  function currentRawBenchmarkNote(): RawBenchmarkNote {
    return {
      ...demoRawBenchmark,
      id: `bench-${Date.now()}`,
      projectId: project.id,
      title: benchmark.title || demoRawBenchmark.title,
      body: rawBenchmarkText,
      importedAt: new Date().toISOString(),
    };
  }

  async function handleAnalyzeBenchmark() {
    const note = currentRawBenchmarkNote();

    if (generationMode === "local") {
      setBenchmark(analyzeBenchmarkNote(note));
      setAiStatus("本地模板已拆解对标内容");
      return;
    }

    setIsAnalyzingBenchmark(true);
    setAiStatus("OpenAI 正在拆解对标内容");
    try {
      const nextBenchmark = shouldUseBrowserOpenAi()
        ? await analyzeXhsBenchmarkWithOpenAI({
            project,
            note,
            settings: currentOpenAiSettings(),
          })
        : (
            await postJson<{ benchmark: BenchmarkNote }>("/api/ai/benchmark/", {
              project,
              note,
            })
          ).benchmark;
      setBenchmark(nextBenchmark);
      setRawBenchmarkText(nextBenchmark.body);
      setAiStatus(shouldUseBrowserOpenAi() ? "浏览器 OpenAI 已拆解对标内容" : "OpenAI 已拆解对标内容");
    } catch (error) {
      setBenchmark(analyzeBenchmarkNote(note));
      setAiStatus(error instanceof Error ? `OpenAI 不可用：${error.message}` : "OpenAI 不可用");
    } finally {
      setIsAnalyzingBenchmark(false);
    }
  }

  function handleUseBenchmarkCandidate(candidateId: string) {
    const candidate = filteredBenchmarkCandidates.find((item) => item.id === candidateId);
    if (!candidate) return;

    const nextBenchmark = benchmarkFromCandidate(candidate);
    setRawBenchmarkText(nextBenchmark.body);
    setBenchmark(nextBenchmark);
  }

  async function handleGenerateDraft() {
    let nextDraft = generateDraftFromTopic(selectedTopic, project, [benchmark]);

    if (generationMode === "openai") {
      setIsGeneratingDraft(true);
      setAiStatus("OpenAI 正在生成文案");
      try {
        if (shouldUseBrowserOpenAi()) {
          nextDraft = await generateXhsDraftWithOpenAI({
            project,
            topic: selectedTopic,
            benchmarks: [benchmark],
            settings: currentOpenAiSettings(),
          });
          setAiStatus("浏览器 OpenAI 已生成文案");
        } else {
          const payload = await postJson<{ draft: ContentDraft }>("/api/ai/draft/", {
            project,
            topic: selectedTopic,
            benchmarks: [benchmark],
          });
          nextDraft = payload.draft;
          setAiStatus("OpenAI 已生成文案");
        }
      } catch (error) {
        setAiStatus(error instanceof Error ? `OpenAI 不可用：${error.message}` : "OpenAI 不可用");
      } finally {
        setIsGeneratingDraft(false);
      }
    } else {
      setAiStatus("本地模板已生成文案");
    }

    const nextTask = prepareManualPublishPackage(
      nextDraft,
      project,
      "2026-07-07T12:30:00.000Z"
    );
    setDraft(nextDraft);
    setDraftHashtagInput(nextDraft.hashtags.join(", "));
    setPosterImages([]);
    setPosterPromptOverrides({});
    setScanText(`${nextDraft.selectedTitle}\n${nextDraft.body}`);
    setPublishTask(nextTask);
    setCopied(false);
    setShared(false);
    setMobilePublishCardUrl("");
    setMobileCardStatus("");
  }

  async function handleGeneratePoster() {
    if (generationMode !== "openai") {
      const templatePosters = createTemplatePosterAssets(draft, project);
      syncPosterAssets(templatePosters);
      setAiStatus("本地模板已生成海报");
      return;
    }

    setIsGeneratingPoster(true);
    setAiStatus("OpenAI 正在生成整组海报");
    try {
      const useBrowserOpenAi = shouldUseBrowserOpenAi();
      const settings = useBrowserOpenAi ? currentOpenAiSettings() : undefined;
      const cardIds = draft.assetCards.length > 0 ? draft.assetCards.map((card) => card.id) : [undefined];
      const images = await Promise.all(
        cardIds.map(async (cardId) => {
          const promptOverride = posterPromptForCardId(cardId);

          return useBrowserOpenAi
            ? generateXhsPosterWithOpenAI({
                project,
                draft,
                cardId,
                promptOverride,
                settings,
              })
            : (
                await postJson<{ image: GeneratedPosterAsset }>("/api/ai/poster/", {
                  project,
                  draft,
                  cardId,
                  promptOverride,
                })
              ).image;
        })
      );

      syncPosterAssets(images);
      setAiStatus(
        useBrowserOpenAi
          ? `浏览器 OpenAI 已生成 ${images.length} 张海报`
          : `OpenAI 已生成 ${images.length} 张海报`
      );
    } catch (error) {
      const templatePosters = createTemplatePosterAssets(draft, project);
      syncPosterAssets(templatePosters);
      setAiStatus(
        error instanceof Error
          ? `OpenAI 图片不可用：${error.message}，已生成模板海报`
          : "OpenAI 图片不可用，已生成模板海报"
      );
    } finally {
      setIsGeneratingPoster(false);
    }
  }

  async function handleRegeneratePosterCard(cardId: string) {
    const cardNumber = Math.max(
      1,
      draft.assetCards.findIndex((card) => card.id === cardId) + 1
    );

    if (generationMode !== "openai") {
      const templatePoster = templatePosterForCard(cardId);
      syncPosterAssets(mergePosterAsset(templatePoster));
      setAiStatus(`本地模板已重生成第 ${cardNumber} 张海报`);
      return;
    }

    setRegeneratingPosterCardId(cardId);
    setAiStatus(`OpenAI 正在重生成第 ${cardNumber} 张海报`);
    try {
      const useBrowserOpenAi = shouldUseBrowserOpenAi();
      const settings = useBrowserOpenAi ? currentOpenAiSettings() : undefined;
      const promptOverride = posterPromptForCardId(cardId);
      const image = useBrowserOpenAi
        ? await generateXhsPosterWithOpenAI({
            project,
            draft,
            cardId,
            promptOverride,
            settings,
          })
        : (
            await postJson<{ image: GeneratedPosterAsset }>("/api/ai/poster/", {
              project,
              draft,
              cardId,
              promptOverride,
            })
          ).image;

      syncPosterAssets(mergePosterAsset(image));
      setAiStatus(
        useBrowserOpenAi
          ? `浏览器 OpenAI 已重生成第 ${cardNumber} 张海报`
          : `OpenAI 已重生成第 ${cardNumber} 张海报`
      );
    } catch (error) {
      const templatePoster = templatePosterForCard(cardId);
      syncPosterAssets(mergePosterAsset(templatePoster));
      setAiStatus(
        error instanceof Error
          ? `OpenAI 图片不可用：${error.message}，已重生成第 ${cardNumber} 张模板海报`
          : `OpenAI 图片不可用，已重生成第 ${cardNumber} 张模板海报`
      );
    } finally {
      setRegeneratingPosterCardId(null);
    }
  }

  async function handleRewriteCompliance() {
    if (generationMode === "local") {
      setScanText(compliance.sanitizedText);
      setAiStatus("本地规则已改写");
      return;
    }

    setIsRewritingCompliance(true);
    setAiStatus("OpenAI 正在合规改写");
    try {
      const payload = shouldUseBrowserOpenAi()
        ? await rewriteXhsComplianceWithOpenAI({
            project,
            text: scanText,
            settings: currentOpenAiSettings(),
          })
        : await postJson<{
            rewrittenText: string;
            changeNotes: string[];
          }>("/api/ai/compliance-rewrite/", {
            project,
            text: scanText,
          });
      setScanText(payload.rewrittenText);
      setAiStatus(shouldUseBrowserOpenAi() ? "浏览器 OpenAI 已合规改写" : "OpenAI 已合规改写");
    } catch (error) {
      setScanText(compliance.sanitizedText);
      setAiStatus(error instanceof Error ? `OpenAI 不可用：${error.message}` : "OpenAI 不可用");
    } finally {
      setIsRewritingCompliance(false);
    }
  }

  function handleQueueTask() {
    setPublishTask((task) => transitionPublishTask(task, task.status === "ready" ? "queued" : "published"));
  }

  async function handleCopyPackage() {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(publishTask.exportText);
    }
    setCopied(true);
  }

  async function handleSharePackage() {
    const title = publishTask.exportText.split("\n")[0] ?? draft.selectedTitle;
    if (typeof navigator !== "undefined" && "share" in navigator) {
      const nav = navigator as Navigator & {
        canShare?: (data: ShareData) => boolean;
      };
      const posterFiles =
        posterImages.length > 0 ? await Promise.all(posterImages.slice(0, 4).map(posterAssetToFile)) : [];
      if (posterFiles.length > 0 && nav.canShare?.({ files: posterFiles })) {
        await nav.share({
          title,
          text: publishTask.exportText,
          files: posterFiles,
        });
        setShared(true);
        return;
      }

      await nav.share({
        title,
        text: publishTask.exportText,
      });
      setShared(true);
      return;
    }

    await handleCopyPackage();
  }

  async function handleCreateMobilePublishCard() {
    const payload = createMobilePublishCardPayload(publishTask, draft, posterImages);
    const url = createMobilePublishCardUrl(payload, currentMobileCardUrlParts());
    setMobilePublishCardUrl(url);
    setMobileCardStatus("手机卡已生成");

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      await navigator.clipboard.writeText(url);
    }
  }

  if (mobilePublishCardPayload) {
    return <MobilePublishCardView payload={mobilePublishCardPayload} />;
  }

  return (
    <main className="min-h-screen bg-[#F8F3E7] text-[#1F2723]">
      <header className="border-b border-[#D8D2C1] bg-[#FCFAF3]">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 md:px-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-[#E85D75]">XHS Ops MVP</p>
              <h1 className="mt-2 text-3xl font-semibold text-[#1F2723] md:text-4xl">
                小红书运营工作台
              </h1>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Account" value={accountPositioning.selectedName} />
              <Stat label="Subject" value={accountPositioning.subjectArea} />
              <Stat label="Topics" value={String(topics.length)} />
              <Stat label="Risk" value={compliance.riskLevel === "low" ? "低" : "待处理"} />
            </div>
          </div>
          <nav className="flex gap-2 overflow-x-auto pb-1" aria-label="Workspace">
            {workspaceNav.map(({ label, icon: Icon }) => (
              <a
                key={label}
                href={`#${label.toLowerCase()}`}
                className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-[#D8D2C1] bg-white px-3 text-sm font-medium text-[#3B403C] hover:border-[#2E6B5F]"
              >
                <Icon size={16} />
                {label}
              </a>
            ))}
          </nav>
          <div className="flex flex-col gap-3 rounded-md border border-[#D8D2C1] bg-white p-3 sm:flex-row sm:items-center sm:justify-between">
            <label className="flex min-w-0 flex-col gap-1 text-xs font-semibold uppercase text-[#6D6A61] sm:w-64">
              生成模式
              <select
                aria-label="生成模式"
                className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm font-medium normal-case text-[#1F2723] outline-none focus:border-[#2E6B5F]"
                name="generationMode"
                value={generationMode}
                onChange={(event) => {
                  const nextMode = event.target.value as GenerationMode;
                  setGenerationMode(nextMode);
                  setAiStatus(nextMode === "openai" ? "OpenAI 模式" : "本地模板模式");
                }}
              >
                <option value="local">本地模板</option>
                <option value="openai">OpenAI GPT</option>
              </select>
            </label>
            <div className="min-w-0 rounded-md bg-[#F8F3E7] px-3 py-2 text-sm font-medium text-[#3B403C]">
              {aiStatus}
            </div>
          </div>
          <form
            aria-label="OpenAI 设置"
            className="grid gap-3 rounded-md border border-[#D8D2C1] bg-white p-3 lg:grid-cols-[180px_minmax(220px,1fr)_minmax(220px,1fr)_140px_150px_auto]"
            onSubmit={handleSaveOpenAiSettings}
          >
              <label className="grid gap-1 text-xs font-semibold uppercase text-[#6D6A61]">
                OpenAI 连接方式
                <select
                  aria-label="OpenAI 连接方式"
                  className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm font-medium normal-case text-[#1F2723] outline-none focus:border-[#2E6B5F]"
                  value={openAiSettings.transport}
                  onChange={(event) => handleOpenAiSettingsChange("transport", event.target.value)}
                >
                  <option value="server">服务器后端</option>
                  <option value="browser">浏览器直连/代理</option>
                </select>
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase text-[#6D6A61]">
                OpenAI API Key
                <input
                  aria-label="OpenAI API Key"
                  autoComplete="off"
                  className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm font-medium normal-case text-[#1F2723] outline-none focus:border-[#2E6B5F] disabled:bg-[#F8F3E7] disabled:text-[#6D6A61]"
                  disabled={openAiSettings.transport !== "browser"}
                  type="password"
                  value={openAiSettings.apiKey}
                  onChange={(event) => handleOpenAiSettingsChange("apiKey", event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase text-[#6D6A61]">
                OpenAI Base URL
                <input
                  aria-label="OpenAI Base URL"
                  className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm font-medium normal-case text-[#1F2723] outline-none focus:border-[#2E6B5F] disabled:bg-[#F8F3E7] disabled:text-[#6D6A61]"
                  disabled={openAiSettings.transport !== "browser"}
                  value={openAiSettings.baseUrl}
                  onChange={(event) => handleOpenAiSettingsChange("baseUrl", event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase text-[#6D6A61]">
                文案模型
                <input
                  aria-label="文案模型"
                  className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm font-medium normal-case text-[#1F2723] outline-none focus:border-[#2E6B5F]"
                  value={openAiSettings.textModel}
                  onChange={(event) => handleOpenAiSettingsChange("textModel", event.target.value)}
                />
              </label>
              <label className="grid gap-1 text-xs font-semibold uppercase text-[#6D6A61]">
                图片模型
                <input
                  aria-label="图片模型"
                  className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm font-medium normal-case text-[#1F2723] outline-none focus:border-[#2E6B5F]"
                  value={openAiSettings.imageModel}
                  onChange={(event) => handleOpenAiSettingsChange("imageModel", event.target.value)}
                />
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-xs font-semibold uppercase text-[#6D6A61]">OpenAI 状态</span>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#2E6B5F] px-3 text-sm font-semibold text-white"
                  type="submit"
                >
                  <Check size={16} />
                  保存 OpenAI 设置
                </button>
                <span className="text-xs font-medium text-[#6D6A61]">{openAiSettingsStatus}</span>
              </div>
          </form>
          <div className="grid gap-3 rounded-md border border-[#D8D2C1] bg-white p-3 lg:grid-cols-[minmax(0,1fr)_minmax(280px,420px)]">
            <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase text-[#6D6A61]">Workspace Backup</p>
                <p className="mt-1 text-sm font-medium text-[#3B403C]">{workspaceStatus}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md border border-[#2E6B5F] bg-white px-3 text-sm font-semibold text-[#214F45]"
                  onClick={handleExportWorkspace}
                  type="button"
                >
                  <ClipboardCheck size={16} />
                  导出工作区
                </button>
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#2E6B5F] px-3 text-sm font-semibold text-white"
                  onClick={handleImportWorkspace}
                  type="button"
                >
                  <Upload size={16} />
                  导入工作区
                </button>
              </div>
            </div>
            <label className="grid gap-1 text-xs font-semibold uppercase text-[#6D6A61]">
              工作区 JSON
              <textarea
                aria-label="工作区 JSON"
                className="min-h-20 rounded-md border border-[#CFC7B5] bg-[#FCFAF3] px-3 py-2 text-xs leading-5 text-[#3B403C] outline-none focus:border-[#2E6B5F]"
                value={workspaceJson}
                onChange={(event) => {
                  setWorkspaceJson(event.target.value);
                  setWorkspaceStatus("工作区 JSON 待导入");
                }}
              />
            </label>
          </div>
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 md:px-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-10">
          <section id="settings" className="scroll-mt-8">
            <SectionHeader
              title="Project Settings"
              icon={SlidersHorizontal}
              aside={
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1F2723] px-3 text-sm font-semibold text-white"
                  form="project-settings-form"
                  type="submit"
                >
                  <Check size={16} />
                  保存设置
                </button>
              }
            />
            <form
              id="project-settings-form"
              aria-label="项目设置"
              onSubmit={handleSaveProjectSettings}
              className="rounded-lg border border-[#D8D2C1] bg-white p-5"
            >
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-medium text-[#3B403C]">
                  项目名称
                  <input
                    className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm outline-none focus:border-[#2E6B5F]"
                    value={projectForm.name}
                    onChange={(event) => handleProjectFormChange("name", event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-[#3B403C]">
                  项目行业
                  <input
                    className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm outline-none focus:border-[#2E6B5F]"
                    value={projectForm.industry}
                    onChange={(event) => handleProjectFormChange("industry", event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-[#3B403C]">
                  目标受众
                  <input
                    className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm outline-none focus:border-[#2E6B5F]"
                    value={projectForm.audience}
                    onChange={(event) => handleProjectFormChange("audience", event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-[#3B403C]">
                  品牌语气
                  <input
                    className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm outline-none focus:border-[#2E6B5F]"
                    value={projectForm.tone}
                    onChange={(event) => handleProjectFormChange("tone", event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-[#3B403C] md:col-span-2">
                  账号人设
                  <textarea
                    className="min-h-20 rounded-md border border-[#CFC7B5] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#2E6B5F]"
                    value={projectForm.persona}
                    onChange={(event) => handleProjectFormChange("persona", event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-[#3B403C]">
                  禁用词
                  <textarea
                    className="min-h-20 rounded-md border border-[#CFC7B5] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#2E6B5F]"
                    value={projectForm.forbiddenWords}
                    onChange={(event) => handleProjectFormChange("forbiddenWords", event.target.value)}
                  />
                </label>
                <label className="grid gap-1 text-sm font-medium text-[#3B403C]">
                  品牌色
                  <textarea
                    className="min-h-20 rounded-md border border-[#CFC7B5] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#2E6B5F]"
                    value={projectForm.brandColors}
                    onChange={(event) => handleProjectFormChange("brandColors", event.target.value)}
                  />
                </label>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <span className="rounded-md bg-[#F8F3E7] px-3 py-1.5 text-sm font-medium text-[#3B403C]">
                  {settingsStatus}
                </span>
                {project.brandColors.map((color) => (
                  <span
                    key={color}
                    className="size-8 rounded-md border border-black/10"
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </form>
          </section>

          <section id="positioning" className="scroll-mt-8">
            <SectionHeader
              title="Account Positioning"
              icon={Compass}
              aside={
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#2E6B5F] px-3 text-sm font-semibold text-white"
                  form="positioning-form"
                  onClick={(event) => {
                    event.preventDefault();
                    void handleGeneratePositioning();
                  }}
                  type="submit"
                  disabled={isGeneratingPositioning}
                >
                  <Sparkles size={16} />
                  生成定位
                </button>
              }
            />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
              <form
                id="positioning-form"
                aria-label="账号定位生成"
                method="get"
                onSubmit={handlePositioningSubmit}
                className="rounded-lg border border-[#D8D2C1] bg-white p-4"
              >
                <div className="grid gap-3">
                  <label className="grid gap-1 text-sm font-medium text-[#3B403C]">
                    账号主体区
                    <input
                      className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm outline-none focus:border-[#2E6B5F]"
                      name="subjectArea"
                      required
                      value={subjectArea}
                      onChange={(event) => setSubjectArea(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-[#3B403C]">
                    目标人群
                    <input
                      className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm outline-none focus:border-[#2E6B5F]"
                      name="audience"
                      required
                      value={accountAudience}
                      onChange={(event) => setAccountAudience(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-[#3B403C]">
                    差异化承诺
                    <textarea
                      aria-label="差异化承诺"
                      className="min-h-20 rounded-md border border-[#CFC7B5] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#2E6B5F]"
                      name="differentiator"
                      required
                      value={differentiator}
                      onChange={(event) => setDifferentiator(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-1 text-sm font-medium text-[#3B403C]">
                    账号语气
                    <input
                      className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm outline-none focus:border-[#2E6B5F]"
                      name="tone"
                      required
                      value={accountTone}
                      onChange={(event) => setAccountTone(event.target.value)}
                    />
                  </label>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#2E6B5F] px-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#9AA89F]"
                    disabled={isGeneratingPositioning}
                    onClick={(event) => {
                      event.preventDefault();
                      void handleGeneratePositioning();
                    }}
                    type="submit"
                  >
                    <Sparkles size={16} />
                    生成定位方案
                  </button>
                </div>
              </form>

              <div className="grid gap-4">
                <div className="rounded-lg border border-[#D8D2C1] bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase text-[#6D6A61]">推荐账号名</p>
                      <h3 className="mt-2 text-2xl font-semibold">{accountPositioning.selectedName}</h3>
                    </div>
                    <Target className="text-[#E85D75]" size={24} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {accountPositioning.nameOptions.map((name) => (
                      <span key={name} className="rounded-md bg-[#F8F3E7] px-2.5 py-1 text-sm text-[#3B403C]">
                        {name}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                  <div className="rounded-lg border border-[#D8D2C1] bg-white p-5">
                    <p className="text-xs font-semibold uppercase text-[#6D6A61]">账号简介</p>
                    <p className="mt-3 text-sm leading-6 text-[#2F352F]">{accountPositioning.selectedBio}</p>
                  </div>
                  <div className="rounded-lg border border-[#D8D2C1] bg-white p-5">
                    <p className="text-xs font-semibold uppercase text-[#6D6A61]">定位语</p>
                    <p className="mt-3 text-sm leading-6 text-[#2F352F]">
                      {accountPositioning.positioningStatement}
                    </p>
                  </div>
                </div>
                <div className="rounded-lg border border-[#D8D2C1] bg-white p-5">
                  <p className="text-xs font-semibold uppercase text-[#6D6A61]">内容支柱</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {accountPositioning.contentPillars.map((pillar) => (
                      <span key={pillar} className="rounded-md bg-[#E4F1E8] px-2.5 py-1 text-sm text-[#214F45]">
                        {pillar}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
              <form
                id="homepage-analysis-form"
                aria-label="账号主页分析"
                method="get"
                onSubmit={handleHomepageSubmit}
                className="rounded-lg border border-[#D8D2C1] bg-white p-4"
              >
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase text-[#6D6A61]">Homepage Analyzer</p>
                    <h3 className="mt-1 text-lg font-semibold text-[#1F2723]">账号主页分析</h3>
                  </div>
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1F2723] px-3 text-sm font-semibold text-white disabled:opacity-60"
                    form="homepage-analysis-form"
                    type="submit"
                    disabled={isAnalyzingHomepage}
                  >
                    <Search size={16} />
                    分析主页
                  </button>
                </div>
                <label className="mt-4 grid gap-1 text-sm font-medium text-[#3B403C]">
                  账号主页资料
                  <textarea
                    className="min-h-40 rounded-md border border-[#CFC7B5] bg-white px-3 py-2 text-sm leading-6 outline-none focus:border-[#2E6B5F]"
                    name="homepageText"
                    required
                    value={rawHomepageText}
                    onChange={(event) => setRawHomepageText(event.target.value)}
                  />
                </label>
              </form>

              <div className="rounded-lg border border-[#D8D2C1] bg-white p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase text-[#6D6A61]">主页诊断</p>
                    <h3 className="mt-1 text-xl font-semibold">
                      {homepageAnalysis?.inferredSubjectArea ?? "等待分析"}
                    </h3>
                  </div>
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#2E6B5F] bg-white px-3 text-sm font-semibold text-[#214F45] disabled:opacity-50"
                    onClick={handleApplyHomepageAnalysis}
                    type="button"
                    disabled={!homepageAnalysis}
                  >
                    <Check size={16} />
                    应用到定位
                  </button>
                </div>

                {homepageAnalysis ? (
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div className="rounded-md bg-[#F8F3E7] p-3">
                      <p className="text-xs font-semibold uppercase text-[#6D6A61]">人群</p>
                      <p className="mt-1 text-sm font-medium">{homepageAnalysis.inferredAudience}</p>
                    </div>
                    <div className="rounded-md bg-[#F8F3E7] p-3">
                      <p className="text-xs font-semibold uppercase text-[#6D6A61]">主页健康度</p>
                      <p className="mt-1 text-sm font-medium">{homepageAnalysis.profileHealthScore}/100</p>
                    </div>
                    <div className="rounded-md bg-[#F8F3E7] p-3 md:col-span-2">
                      <p className="text-xs font-semibold uppercase text-[#6D6A61]">差异化价值</p>
                      <p className="mt-1 text-sm leading-6">{homepageAnalysis.valuePromise}</p>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs font-semibold uppercase text-[#6D6A61]">内容支柱</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {homepageAnalysis.contentPillars.map((pillar) => (
                          <span key={pillar} className="rounded-md bg-[#E4F1E8] px-2.5 py-1 text-sm text-[#214F45]">
                            {pillar}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="md:col-span-2">
                      <p className="text-xs font-semibold uppercase text-[#6D6A61]">下一步</p>
                      <ul className="mt-2 grid gap-2 text-sm leading-6 text-[#3B403C]">
                        {homepageAnalysis.nextActions.map((action) => (
                          <li key={action} className="rounded-md border border-[#D8D2C1] px-3 py-2">
                            {action}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="mt-4 rounded-md bg-[#F8F3E7] p-3 text-sm leading-6 text-[#6D6A61]">
                    粘贴账号名称、简介和近期笔记标题后，可以判断主体区、人群、内容支柱和下一步对标筛选方向。
                  </p>
                )}
              </div>
            </div>
          </section>

          <section id="topic" className="scroll-mt-8">
            <SectionHeader
              title="Topic Lab"
              icon={Search}
              aside={
                <div className="flex w-full gap-2 md:w-auto">
                  <input
                    className="h-10 min-w-0 flex-1 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm outline-none focus:border-[#2E6B5F] md:w-64"
                    value={keyword}
                    onChange={(event) => setKeyword(event.target.value)}
                    aria-label="选题关键词"
                  />
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-[#2E6B5F] px-3 text-sm font-semibold text-white"
                    onClick={handleGenerateTopics}
                    type="button"
                    disabled={isGeneratingTopics}
                  >
                    <Search size={16} />
                    检索
                  </button>
                </div>
              }
            />
            <div className="mb-4 grid gap-3 rounded-lg border border-[#D8D2C1] bg-white p-4 lg:grid-cols-[minmax(0,1fr)_180px]">
              <label className="grid gap-2 text-xs font-semibold uppercase text-[#6D6A61]">
                爆款数据导入
                <textarea
                  className="min-h-28 rounded-md border border-[#CFC7B5] bg-[#FCFAF3] p-3 text-sm font-normal normal-case leading-6 text-[#1F2723] outline-none focus:border-[#2E6B5F]"
                  value={rawTopicImportText}
                  onChange={(event) => setRawTopicImportText(event.target.value)}
                  placeholder={"标题,点赞,收藏,评论,角度\n租房收纳入口区避坑清单,4200,2800,188,痛点清单"}
                  aria-label="爆款数据导入"
                />
              </label>
              <div className="flex flex-col justify-end gap-3">
                <div className="rounded-md bg-[#F8F3E7] px-3 py-2 text-xs leading-5 text-[#6D6A61]">
                  CSV / TSV / 一行一个标题
                </div>
                <button
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1F2723] px-3 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={handleImportTopics}
                  type="button"
                  disabled={!rawTopicImportText.trim()}
                >
                  <Upload size={16} />
                  导入爆款数据
                </button>
              </div>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              {topics.map((topic) => (
                <button
                  key={topic.id}
                  type="button"
                  onClick={() => setSelectedTopicId(topic.id)}
                  className={`rounded-lg border bg-white p-4 text-left shadow-sm transition ${
                    topic.id === selectedTopicId
                      ? "border-[#2E6B5F] ring-2 ring-[#2E6B5F]/20"
                      : "border-[#D8D2C1] hover:border-[#E85D75]"
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase text-[#E85D75]">{topic.angle}</p>
                      <h3 className="mt-2 text-base font-semibold leading-6 text-[#1F2723]">{topic.title}</h3>
                    </div>
                    <ScoreBadge score={topic.score} />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {topic.reasons.slice(0, 3).map((reason) => (
                      <span key={reason} className="rounded-md bg-[#F8F3E7] px-2 py-1 text-xs text-[#6D6A61]">
                        {reason}
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section id="benchmark" className="scroll-mt-8">
            <SectionHeader
              title="Benchmark Lab"
              icon={Layers3}
              aside={
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1F2723] px-3 text-sm font-semibold text-white disabled:opacity-60"
                  onClick={handleAnalyzeBenchmark}
                  type="button"
                  disabled={isAnalyzingBenchmark}
                >
                  <Upload size={16} />
                  拆解
                </button>
              }
            />
            <div className="mb-5 rounded-lg border border-[#D8D2C1] bg-white p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <Filter size={18} className="text-[#2E6B5F]" />
                    <h3 className="text-lg font-semibold">筛选对标内容</h3>
                  </div>
                  <p className="mt-1 text-sm leading-6 text-[#6D6A61]">
                    下一步先按账号主体区筛选，再挑内容形式，避免拿泛爆款做对标。
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <label className="grid gap-1 text-xs font-semibold uppercase text-[#6D6A61]">
                    主体区
                    <select
                      className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm font-medium normal-case text-[#1F2723] outline-none focus:border-[#2E6B5F]"
                      value={benchmarkSubjectArea}
                      onChange={(event) => setBenchmarkSubjectArea(event.target.value)}
                    >
                      {subjectAreaOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-xs font-semibold uppercase text-[#6D6A61]">
                    内容形式
                    <select
                      className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm font-medium normal-case text-[#1F2723] outline-none focus:border-[#2E6B5F]"
                      value={benchmarkFormat}
                      onChange={(event) => setBenchmarkFormat(event.target.value as BenchmarkContentFormat)}
                    >
                      {contentFormatOptions.map((option) => (
                        <option key={option} value={option}>
                          {option}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-4 grid gap-3 border-t border-[#D8D2C1] pt-4 lg:grid-cols-[minmax(0,1fr)_180px]">
                <label className="grid gap-2 text-xs font-semibold uppercase text-[#6D6A61]">
                  对标候选导入
                  <textarea
                    className="min-h-28 rounded-md border border-[#CFC7B5] bg-[#FCFAF3] p-3 text-sm font-normal normal-case leading-6 text-[#1F2723] outline-none focus:border-[#2E6B5F]"
                    value={rawBenchmarkCandidateImportText}
                    onChange={(event) => setRawBenchmarkCandidateImportText(event.target.value)}
                    placeholder={
                      "标题,作者,主体区,内容形式,痛点,点赞,收藏,评论,标签\n咖啡新手手冲避坑清单,手冲记录员,咖啡入门,避坑清单,新手总买错器具和豆子,4800,3100,220,咖啡入门|手冲|避坑"
                    }
                    aria-label="对标候选导入"
                  />
                </label>
                <div className="flex flex-col justify-end gap-3">
                  <div className="rounded-md bg-[#F8F3E7] px-3 py-2 text-xs leading-5 text-[#6D6A61]">
                    已导入 {customBenchmarkCandidates.length} 条
                  </div>
                  <button
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1F2723] px-3 text-sm font-semibold text-white disabled:opacity-60"
                    onClick={handleImportBenchmarkCandidates}
                    type="button"
                    disabled={!rawBenchmarkCandidateImportText.trim()}
                  >
                    <Upload size={16} />
                    导入对标候选
                  </button>
                </div>
              </div>
              <div className="mt-4 grid gap-3 xl:grid-cols-3">
                {filteredBenchmarkCandidates.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-[#CFC7B5] bg-[#FCFAF3] p-4 text-sm leading-6 text-[#6D6A61] xl:col-span-3">
                    当前主体区还没有候选对标内容。可以先切换到已有主体区，或把同领域笔记粘贴到下方再拆解。
                  </div>
                ) : (
                  filteredBenchmarkCandidates.map((candidate) => (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => handleUseBenchmarkCandidate(candidate.id)}
                      className="rounded-lg border border-[#D8D2C1] bg-[#FCFAF3] p-4 text-left transition hover:border-[#2E6B5F]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-[#E85D75]">
                            {candidate.subjectArea} / {candidate.contentFormat}
                          </p>
                          <h4 className="mt-2 text-sm font-semibold leading-6 text-[#1F2723]">
                            {candidate.title}
                          </h4>
                        </div>
                        <ScoreBadge score={candidate.matchScore} />
                      </div>
                      <p className="mt-3 text-xs leading-5 text-[#6D6A61]">{candidate.audiencePain}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {candidate.matchReasons.map((reason) => (
                          <span key={reason} className="rounded bg-white px-2 py-1 text-xs text-[#214F45]">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
              <textarea
                className="min-h-48 rounded-lg border border-[#D8D2C1] bg-white p-4 text-sm leading-6 outline-none focus:border-[#2E6B5F]"
                value={rawBenchmarkText}
                onChange={(event) => setRawBenchmarkText(event.target.value)}
                aria-label="对标笔记正文"
              />
              <div className="grid gap-3">
                <div className="rounded-lg border border-[#D8D2C1] bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-[#6D6A61]">Hook</p>
                  <p className="mt-2 text-sm leading-6">{benchmark.analysis.openingHook}</p>
                </div>
                <div className="rounded-lg border border-[#D8D2C1] bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-[#6D6A61]">Structure</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {benchmark.analysis.structure.map((item) => (
                      <span key={item} className="rounded-md bg-[#E4F1E8] px-2 py-1 text-xs text-[#214F45]">
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="rounded-lg border border-[#D8D2C1] bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-[#6D6A61]">Tags</p>
                  <p className="mt-2 text-sm text-[#3B403C]">{benchmark.analysis.tags.join(" / ")}</p>
                </div>
              </div>
            </div>
          </section>

          <section id="studio" className="scroll-mt-8">
            <SectionHeader
              title="Content Studio"
              icon={FileText}
              aside={
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-[#E85D75] px-3 text-sm font-semibold text-white disabled:opacity-60"
                    onClick={handleGenerateDraft}
                    type="button"
                    disabled={isGeneratingDraft}
                  >
                    <Sparkles size={16} />
                    生成
                  </button>
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1F2723] px-3 text-sm font-semibold text-white disabled:opacity-60"
                    onClick={handleGeneratePoster}
                    type="button"
                    disabled={isGeneratingPoster}
                  >
                    <ImageIcon size={16} />
                    生成海报
                  </button>
                </div>
              }
            />
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
              <article className="rounded-lg border border-[#D8D2C1] bg-white p-5">
                <div className="flex flex-wrap gap-2">
                  {draft.titleOptions.map((title) => (
                    <button
                      key={title}
                      className={`rounded-md px-2.5 py-1 text-left text-sm ${
                        title === draft.selectedTitle
                          ? "bg-[#1F2723] text-white"
                          : "bg-[#F8F3E7] text-[#6D6A61]"
                      }`}
                      onClick={() => handleSelectDraftTitle(title)}
                      type="button"
                    >
                      {title}
                    </button>
                  ))}
                </div>
                <div className="mt-5 grid gap-4">
                  <label className="grid gap-1.5 text-sm font-medium text-[#3B403C]">
                    笔记标题
                    <input
                      aria-label="笔记标题"
                      className="h-11 rounded-md border border-[#D8D2C1] bg-[#FCFAF3] px-3 text-sm outline-none focus:border-[#2E6B5F]"
                      value={draft.selectedTitle}
                      onChange={(event) => handleDraftTitleChange(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-[#3B403C]">
                    正文
                    <textarea
                      aria-label="正文"
                      className="min-h-64 rounded-md border border-[#D8D2C1] bg-[#FCFAF3] p-3 text-sm leading-6 outline-none focus:border-[#2E6B5F]"
                      value={draft.body}
                      onChange={(event) => handleDraftBodyChange(event.target.value)}
                    />
                  </label>
                  <label className="grid gap-1.5 text-sm font-medium text-[#3B403C]">
                    话题标签
                    <input
                      aria-label="话题标签"
                      className="h-11 rounded-md border border-[#D8D2C1] bg-[#FCFAF3] px-3 text-sm outline-none focus:border-[#2E6B5F]"
                      value={draftHashtagInput}
                      onChange={(event) => handleDraftHashtagsChange(event.target.value)}
                    />
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {draft.hashtags.map((tag) => (
                    <span key={tag} className="rounded-md bg-[#FFF3C9] px-2 py-1 text-xs text-[#74530C]">
                      #{tag}
                    </span>
                  ))}
                </div>
              </article>
              <div className="grid gap-3">
                {posterImages.length > 0 && (
                  <div className="rounded-lg border border-[#D8D2C1] bg-white p-3">
                    <p className="mb-3 text-xs font-semibold uppercase text-[#6D6A61]">Poster Preview</p>
                    <div className="grid gap-3">
                      {posterImages.map((poster) => {
                        const fileName = poster.fileName ?? `${poster.cardId}.png`;
                        return (
                        <div key={poster.id ?? `${poster.cardId}-${poster.url.slice(-12)}`} className="grid gap-2">
                        <NextImage
                          src={poster.url}
                          alt={poster.alt}
                          width={poster.width ?? 1024}
                          height={poster.height ?? 1536}
                          unoptimized
                          className="aspect-[3/4] w-full rounded-md border border-[#D8D2C1] object-cover"
                        />
                        <div className="flex items-center justify-between gap-2 text-xs text-[#6D6A61]">
                          <span>{fileName}</span>
                          <a
                            className="inline-flex h-8 items-center rounded-md border border-[#D8D2C1] bg-[#FCFAF3] px-2 font-semibold text-[#214F45]"
                            href={poster.url}
                            download={fileName}
                          >
                            下载
                          </a>
                        </div>
                        </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {draft.assetCards.map((card, cardIndex) => (
                  <div
                    key={card.id}
                    className="rounded-lg border border-[#D8D2C1] bg-white p-3"
                    style={{ borderLeftColor: card.themeColor, borderLeftWidth: 6 }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase text-[#6D6A61]">{card.role}</p>
                        <div className="mt-2 grid gap-2">
                          <label className="grid gap-1 text-xs font-medium text-[#6D6A61]">
                            卡片标题 {cardIndex + 1}
                            <input
                              aria-label={`卡片标题 ${cardIndex + 1}`}
                              className="h-9 rounded-md border border-[#D8D2C1] bg-[#FCFAF3] px-2 text-sm font-semibold text-[#1F2723] outline-none focus:border-[#2E6B5F]"
                              value={card.title}
                              onChange={(event) =>
                                handleAssetCardChange(card.id, { title: event.target.value })
                              }
                            />
                          </label>
                          <label className="grid gap-1 text-xs font-medium text-[#6D6A61]">
                            卡片副标题 {cardIndex + 1}
                            <input
                              aria-label={`卡片副标题 ${cardIndex + 1}`}
                              className="h-9 rounded-md border border-[#D8D2C1] bg-[#FCFAF3] px-2 text-sm text-[#3B403C] outline-none focus:border-[#2E6B5F]"
                              value={card.subtitle}
                              onChange={(event) =>
                                handleAssetCardChange(card.id, { subtitle: event.target.value })
                              }
                            />
                          </label>
                        </div>
                      </div>
                      <ImageIcon size={18} color={card.themeColor} />
                    </div>
                    <label className="mt-3 grid gap-1 text-xs font-medium text-[#6D6A61]">
                      卡片要点 {cardIndex + 1}
                      <textarea
                        aria-label={`卡片要点 ${cardIndex + 1}`}
                        className="min-h-24 rounded-md border border-[#D8D2C1] bg-[#FCFAF3] p-2 text-sm leading-5 text-[#3B403C] outline-none focus:border-[#2E6B5F]"
                        value={card.bullets.join("\n")}
                        onChange={(event) => handleAssetCardBulletsChange(card.id, event.target.value)}
                      />
                    </label>
                    <div className="mt-3 grid gap-2">
                      <label className="grid gap-1 text-xs font-medium text-[#6D6A61]">
                        海报提示词 {cardIndex + 1}
                        <textarea
                          aria-label={`海报提示词 ${cardIndex + 1}`}
                          className="min-h-36 rounded-md border border-[#D8D2C1] bg-[#FCFAF3] p-2 text-sm leading-5 text-[#3B403C] outline-none focus:border-[#2E6B5F]"
                          value={posterPromptForCard(card)}
                          onChange={(event) => handlePosterPromptChange(card.id, event.target.value)}
                        />
                      </label>
                      <div className="flex flex-wrap justify-end gap-2">
                        <button
                          className="inline-flex h-8 items-center rounded-md border border-[#D8D2C1] bg-white px-2 text-xs font-semibold text-[#214F45] disabled:opacity-50"
                          type="button"
                          disabled={posterPromptOverrides[card.id] === undefined}
                          onClick={() => handlePosterPromptReset(card.id)}
                        >
                          重置提示词
                        </button>
                        <button
                          className="inline-flex h-8 items-center gap-1 rounded-md bg-[#1F2723] px-2 text-xs font-semibold text-white disabled:opacity-50"
                          type="button"
                          disabled={isGeneratingPoster || regeneratingPosterCardId !== null}
                          onClick={() => handleRegeneratePosterCard(card.id)}
                        >
                          <ImageIcon size={14} />
                          重生成本张 {cardIndex + 1}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="guard" className="scroll-mt-8">
            <SectionHeader
              title="Compliance Guard"
              icon={ShieldCheck}
              aside={
                <div className="flex flex-wrap items-center gap-2">
                  <RiskBadge level={compliance.riskLevel} />
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1F2723] px-3 text-sm font-semibold text-white disabled:opacity-60"
                    onClick={handleRewriteCompliance}
                    type="button"
                    disabled={isRewritingCompliance}
                  >
                    <Sparkles size={16} />
                    合规改写
                  </button>
                </div>
              }
            />
            <div className="grid gap-4 lg:grid-cols-2">
              <textarea
                className="min-h-56 rounded-lg border border-[#D8D2C1] bg-white p-4 text-sm leading-6 outline-none focus:border-[#2E6B5F]"
                value={scanText}
                onChange={(event) => setScanText(event.target.value)}
                aria-label="合规检测文本"
              />
              <div className="grid gap-3">
                {compliance.issues.length === 0 ? (
                  <div className="rounded-lg border border-[#2E6B5F]/30 bg-[#E4F1E8] p-4 text-sm text-[#214F45]">
                    未命中当前规则库。
                  </div>
                ) : (
                  compliance.issues.map((issue) => (
                    <div
                      key={`${issue.term}-${issue.category}-${issue.index}`}
                      className="rounded-lg border border-[#D8D2C1] bg-white p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold">{issue.term}</p>
                          <p className="mt-1 text-xs uppercase text-[#6D6A61]">{issue.category}</p>
                        </div>
                        <RiskBadge level={issue.severity} />
                      </div>
                      <p className="mt-3 text-sm leading-6 text-[#3B403C]">{issue.suggestion}</p>
                    </div>
                  ))
                )}
                <div className="rounded-lg border border-[#D8D2C1] bg-white p-4">
                  <p className="text-xs font-semibold uppercase text-[#6D6A61]">Sanitized</p>
                  <p className="mt-2 whitespace-pre-line text-sm leading-6 text-[#3B403C]">
                    {compliance.sanitizedText}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section id="queue" className="scroll-mt-8">
            <SectionHeader
              title="Publish Queue"
              icon={CalendarDays}
              aside={
                <div className="flex flex-wrap gap-2">
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#E85D75] bg-white px-3 text-sm font-semibold text-[#9D2633]"
                    onClick={handleSharePackage}
                    type="button"
                  >
                    <Share2 size={16} />
                    {shared ? "已唤起" : "手机分享"}
                  </button>
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#1F2723] bg-white px-3 text-sm font-semibold text-[#1F2723]"
                    onClick={handleCreateMobilePublishCard}
                    type="button"
                  >
                    <Smartphone size={16} />
                    生成手机卡
                  </button>
                  <button
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#2E6B5F] bg-white px-3 text-sm font-semibold text-[#214F45]"
                    onClick={handleCopyPackage}
                    type="button"
                  >
                    <ClipboardCheck size={16} />
                    {copied ? "已复制" : "复制包"}
                  </button>
                  <a
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#1F2723] bg-white px-3 text-sm font-semibold text-[#1F2723]"
                    href={publishPackageDownloadHref}
                    download="xhs-publish-package.md"
                  >
                    <FileText size={16} />
                    下载发布包
                  </a>
                  <a
                    className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1F2723] px-3 text-sm font-semibold text-white"
                    href={publishTask.officialPublishUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <ExternalLink size={16} />
                    发布入口
                  </a>
                </div>
              }
            />
            <div className="grid gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
              <div className="rounded-lg border border-[#D8D2C1] bg-white p-5">
                <p className="text-xs font-semibold uppercase text-[#6D6A61]">Status</p>
                <p className="mt-2 text-2xl font-semibold capitalize">{publishTask.status}</p>
                <p className="mt-4 text-sm text-[#6D6A61]">{publishTask.scheduledAt.replace("T", " ").slice(0, 16)}</p>
                <button
                  className="mt-5 inline-flex h-10 items-center gap-2 rounded-md bg-[#2E6B5F] px-3 text-sm font-semibold text-white disabled:opacity-50"
                  onClick={handleQueueTask}
                  type="button"
                  disabled={publishTask.status === "published"}
                >
                  <Check size={16} />
                  {publishTask.status === "ready" ? "加入队列" : "标记发布"}
                </button>
                {mobilePublishCardUrl && (
                  <div className="mt-5 grid gap-2 rounded-lg border border-[#D8D2C1] bg-[#FCFAF3] p-3">
                    <p className="text-sm font-semibold text-[#214F45]">{mobileCardStatus}</p>
                    <a
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[#1F2723] px-3 text-sm font-semibold text-white"
                      href={mobilePublishCardUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink size={16} />
                      打开手机卡
                    </a>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-[#D8D2C1] bg-white p-5">
                <div className="grid gap-3 md:grid-cols-2">
                  {publishTask.checklist.map((item) => (
                    <label key={item} className="flex min-w-0 items-start gap-3 rounded-md bg-[#F8F3E7] p-3 text-sm">
                      <input type="checkbox" className="mt-1 size-4 accent-[#2E6B5F]" />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
                <pre className="mt-5 max-h-72 overflow-auto whitespace-pre-wrap rounded-md bg-[#1F2723] p-4 text-xs leading-5 text-[#FCFAF3]">
                  {publishTask.exportText}
                </pre>
                {publishTask.assetManifest.length > 0 && (
                  <div className="mt-5 rounded-lg border border-[#D8D2C1] bg-white p-4">
                    <p className="text-xs font-semibold uppercase text-[#6D6A61]">素材清单</p>
                    <div className="mt-3 grid gap-2">
                      {publishTask.assetManifest.map((asset) => (
                        <div
                          key={`${asset.cardId}-${asset.fileName}`}
                          className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-[#F8F3E7] p-3 text-sm"
                        >
                          <span className="min-w-0 truncate">{asset.fileName}</span>
                          <span className="shrink-0 rounded-md bg-white px-2 py-1 text-xs text-[#6D6A61]">
                            {asset.source === "openai" ? "GPT" : "模板"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-lg border border-[#D8D2C1] bg-white p-5">
            <p className="text-xs font-semibold uppercase text-[#6D6A61]">Account Brief</p>
            <h2 className="mt-2 text-xl font-semibold">{accountPositioning.selectedName}</h2>
            <p className="mt-2 text-sm leading-6 text-[#3B403C]">{accountPositioning.selectedBio}</p>
            <dl className="mt-4 grid gap-3 text-sm">
              <div>
                <dt className="text-[#6D6A61]">主体区</dt>
                <dd className="font-medium">{accountPositioning.subjectArea}</dd>
              </div>
              <div>
                <dt className="text-[#6D6A61]">受众</dt>
                <dd className="font-medium">{accountPositioning.audience}</dd>
              </div>
              <div>
                <dt className="text-[#6D6A61]">语气</dt>
                <dd className="font-medium">{accountPositioning.tone}</dd>
              </div>
            </dl>
            <div className="mt-4 flex gap-2">
              {project.brandColors.map((color) => (
                <span
                  key={color}
                  className="size-8 rounded-md border border-black/10"
                  style={{ backgroundColor: color }}
                  aria-label={color}
                />
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[#D8D2C1] bg-white p-5">
            <p className="text-xs font-semibold uppercase text-[#6D6A61]">Provider Slots</p>
            <div className="mt-4 grid gap-2 text-sm">
              <div className={`rounded-md px-3 py-2 ${providerStatusClass(activeProviderStatus.kind)}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{activeProviderStatus.label}</span>
                  <span className="text-xs font-semibold uppercase">GPT</span>
                </div>
                <p className="mt-1 text-xs leading-5">{activeProviderStatus.detail}</p>
              </div>
              <div className="flex items-center justify-between rounded-md bg-[#F8F3E7] px-3 py-2">
                <span>SourceProvider</span>
                <span className="font-semibold text-[#214F45]">Manual</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-[#F8F3E7] px-3 py-2">
                <span>LLMProvider</span>
                <span className="font-semibold text-[#74530C]">{activeProviderStatus.textModel}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-[#F8F3E7] px-3 py-2">
                <span>ImageProvider</span>
                <span className="font-semibold text-[#74530C]">{activeProviderStatus.imageModel}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-[#F8F3E7] px-3 py-2">
                <span>PublisherAdapter</span>
                <span className="font-semibold text-[#214F45]">Manual</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}
