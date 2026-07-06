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
  Sparkles,
  Target,
  Upload,
} from "lucide-react";
import NextImage from "next/image";
import { useMemo, useState, type FormEvent } from "react";
import { filterBenchmarkCandidates, generateAccountPositioning } from "@/lib/core/account";
import { analyzeBenchmarkNote } from "@/lib/core/benchmark";
import { scanCompliance } from "@/lib/core/compliance";
import { generateDraftFromTopic } from "@/lib/core/content";
import { prepareManualPublishPackage, transitionPublishTask } from "@/lib/core/publish";
import { generateTopicCandidates } from "@/lib/core/topic";
import type {
  AccountPositioning,
  AccountPositioningInput,
  BenchmarkContentFormat,
  BenchmarkNote,
  ContentDraft,
  PublishTask,
  TopicCandidate,
} from "@/lib/core/types";
import {
  demoAccountPositioning,
  demoBenchmark,
  demoBenchmarkCandidates,
  demoDraft,
  demoProject,
  demoPublishTask,
  demoRawBenchmark,
  demoTopics,
} from "@/lib/sample-data";

type GenerationMode = "local" | "openai";

interface GeneratedPoster {
  url: string;
  alt: string;
  cardId: string;
}

interface XhsOpsAppProps {
  initialPositioningInput?: AccountPositioningInput;
}

const workspaceNav = [
  { label: "Positioning", icon: Compass },
  { label: "Topic", icon: Search },
  { label: "Benchmark", icon: Layers3 },
  { label: "Studio", icon: FileText },
  { label: "Guard", icon: ShieldCheck },
  { label: "Queue", icon: CalendarDays },
];

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

export function XhsOpsApp({ initialPositioningInput }: XhsOpsAppProps = {}) {
  const initialPositioning = initialPositioningInput
    ? generateAccountPositioning(initialPositioningInput)
    : demoAccountPositioning;
  const initialAiStatus = initialPositioningInput ? "本地模板已生成" : "本地模板模式";
  const [generationMode, setGenerationMode] = useState<GenerationMode>("local");
  const [aiStatus, setAiStatus] = useState(initialAiStatus);
  const [isGeneratingPositioning, setIsGeneratingPositioning] = useState(false);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);
  const [isGeneratingPoster, setIsGeneratingPoster] = useState(false);
  const [posterImages, setPosterImages] = useState<GeneratedPoster[]>([]);
  const [subjectArea, setSubjectArea] = useState(initialPositioning.subjectArea);
  const [accountAudience, setAccountAudience] = useState(initialPositioning.audience);
  const [differentiator, setDifferentiator] = useState(initialPositioning.differentiator);
  const [accountTone, setAccountTone] = useState(initialPositioning.tone);
  const [accountPositioning, setAccountPositioning] =
    useState<AccountPositioning>(initialPositioning);
  const [benchmarkSubjectArea, setBenchmarkSubjectArea] = useState(
    initialPositioning.benchmarkFilters.subjectArea
  );
  const [benchmarkFormat, setBenchmarkFormat] = useState<BenchmarkContentFormat>("全部");
  const [keyword, setKeyword] = useState("敏感肌修护");
  const [topics, setTopics] = useState<TopicCandidate[]>(demoTopics);
  const [selectedTopicId, setSelectedTopicId] = useState(demoTopics[0].id);
  const [rawBenchmarkText, setRawBenchmarkText] = useState(demoRawBenchmark.body);
  const [benchmark, setBenchmark] = useState<BenchmarkNote>(demoBenchmark);
  const [draft, setDraft] = useState<ContentDraft>(demoDraft);
  const [scanText, setScanText] = useState(`${demoDraft.selectedTitle}\n${demoDraft.body}`);
  const [publishTask, setPublishTask] = useState<PublishTask>(demoPublishTask);
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  const selectedTopic = useMemo(
    () => topics.find((topic) => topic.id === selectedTopicId) ?? topics[0],
    [selectedTopicId, topics]
  );
  const compliance = useMemo(
    () => scanCompliance(scanText, demoProject.forbiddenWords),
    [scanText]
  );
  const subjectAreaOptions = useMemo(
    () =>
      Array.from(
        new Set([
          accountPositioning.subjectArea,
          ...demoBenchmarkCandidates.map((candidate) => candidate.subjectArea),
        ])
      ),
    [accountPositioning.subjectArea]
  );
  const contentFormatOptions = useMemo<BenchmarkContentFormat[]>(
    () => [
      "全部",
      ...Array.from(new Set(demoBenchmarkCandidates.map((candidate) => candidate.contentFormat))),
    ],
    []
  );
  const filteredBenchmarkCandidates = useMemo(
    () =>
      filterBenchmarkCandidates(demoBenchmarkCandidates, accountPositioning, {
        subjectArea: benchmarkSubjectArea,
        contentFormat: benchmarkFormat,
      }),
    [accountPositioning, benchmarkFormat, benchmarkSubjectArea]
  );

  function applyPositioning(nextPositioning: AccountPositioning) {
    setAccountPositioning(nextPositioning);
    setBenchmarkSubjectArea(nextPositioning.benchmarkFilters.subjectArea);
    setBenchmarkFormat("全部");
  }

  async function handleGeneratePositioning() {
    const input = {
      projectId: demoProject.id,
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
      const payload = await postJson<{ positioning: AccountPositioning }>("/api/ai/positioning/", input);
      applyPositioning(payload.positioning);
      setAiStatus("OpenAI 已生成定位");
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

  async function handleGenerateTopics() {
    if (generationMode === "local") {
      const nextTopics = generateTopicCandidates(keyword, demoProject);
      setTopics(nextTopics);
      setSelectedTopicId(nextTopics[0].id);
      setAiStatus("本地模板已生成选题");
      return;
    }

    setIsGeneratingTopics(true);
    setAiStatus("OpenAI 正在检索选题");
    try {
      const payload = await postJson<{ topics: TopicCandidate[] }>("/api/ai/topics/", {
        keyword,
        project: demoProject,
      });
      const nextTopics = payload.topics.length > 0 ? payload.topics : generateTopicCandidates(keyword, demoProject);
      setTopics(nextTopics);
      setSelectedTopicId(nextTopics[0].id);
      setAiStatus("OpenAI 已生成选题");
    } catch (error) {
      const nextTopics = generateTopicCandidates(keyword, demoProject);
      setTopics(nextTopics);
      setSelectedTopicId(nextTopics[0].id);
      setAiStatus(error instanceof Error ? `OpenAI 不可用：${error.message}` : "OpenAI 不可用");
    } finally {
      setIsGeneratingTopics(false);
    }
  }

  function handleAnalyzeBenchmark() {
    setBenchmark(
      analyzeBenchmarkNote({
        ...demoRawBenchmark,
        id: `bench-${Date.now()}`,
        body: rawBenchmarkText,
        importedAt: new Date().toISOString(),
      })
    );
  }

  function handleUseBenchmarkCandidate(candidateId: string) {
    const candidate = filteredBenchmarkCandidates.find((item) => item.id === candidateId);
    if (!candidate) return;

    const body = [
      `${candidate.audiencePain}，这类开场适合先把用户拉进具体场景。`,
      `1. 拆标题：${candidate.title}`,
      `2. 拆主体：${candidate.contentFormat} / ${candidate.subjectArea}`,
      `3. 拆互动：用评论区问题继续追选题`,
      `#${candidate.tags.join(" #")}`,
    ].join("\n");
    setRawBenchmarkText(body);
    setBenchmark(
      analyzeBenchmarkNote({
        id: candidate.id,
        projectId: candidate.projectId,
        title: candidate.title,
        author: candidate.author,
        body,
        metrics: candidate.metrics,
        importedAt: new Date().toISOString(),
      })
    );
  }

  async function handleGenerateDraft() {
    let nextDraft = generateDraftFromTopic(selectedTopic, demoProject, [benchmark]);

    if (generationMode === "openai") {
      setIsGeneratingDraft(true);
      setAiStatus("OpenAI 正在生成文案");
      try {
        const payload = await postJson<{ draft: ContentDraft }>("/api/ai/draft/", {
          project: demoProject,
          topic: selectedTopic,
          benchmarks: [benchmark],
        });
        nextDraft = payload.draft;
        setAiStatus("OpenAI 已生成文案");
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
      demoProject,
      "2026-07-07T12:30:00.000Z"
    );
    setDraft(nextDraft);
    setPosterImages([]);
    setScanText(`${nextDraft.selectedTitle}\n${nextDraft.body}`);
    setPublishTask(nextTask);
    setCopied(false);
    setShared(false);
  }

  async function handleGeneratePoster() {
    if (generationMode !== "openai") {
      setAiStatus("生成海报需要 OpenAI 模式");
      return;
    }

    setIsGeneratingPoster(true);
    setAiStatus("OpenAI 正在生成海报");
    try {
      const payload = await postJson<{ image: GeneratedPoster }>("/api/ai/poster/", {
        project: demoProject,
        draft,
        cardId: draft.assetCards[0]?.id,
      });
      setPosterImages((images) => [payload.image, ...images].slice(0, 4));
      setAiStatus("OpenAI 已生成海报");
    } catch (error) {
      setAiStatus(error instanceof Error ? `OpenAI 图片不可用：${error.message}` : "OpenAI 图片不可用");
    } finally {
      setIsGeneratingPoster(false);
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
      await navigator.share({
        title,
        text: publishTask.exportText,
      });
      setShared(true);
      return;
    }

    await handleCopyPackage();
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
                className="h-10 rounded-md border border-[#CFC7B5] bg-white px-3 text-sm font-medium normal-case text-[#1F2723] outline-none focus:border-[#2E6B5F]"
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
        </div>
      </header>

      <div className="mx-auto grid w-full max-w-7xl gap-8 px-4 py-8 md:px-8 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-10">
          <section id="positioning" className="scroll-mt-8">
            <SectionHeader
              title="Account Positioning"
              icon={Compass}
              aside={
                <button
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#2E6B5F] px-3 text-sm font-semibold text-white"
                  form="positioning-form"
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
                action="/"
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
                  className="inline-flex h-10 items-center gap-2 rounded-md bg-[#1F2723] px-3 text-sm font-semibold text-white"
                  onClick={handleAnalyzeBenchmark}
                  type="button"
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
                    <span
                      key={title}
                      className={`rounded-md px-2.5 py-1 text-sm ${
                        title === draft.selectedTitle
                          ? "bg-[#1F2723] text-white"
                          : "bg-[#F8F3E7] text-[#6D6A61]"
                      }`}
                    >
                      {title}
                    </span>
                  ))}
                </div>
                <div className="mt-5 whitespace-pre-line text-sm leading-7 text-[#2F352F]">{draft.body}</div>
                <div className="mt-5 flex flex-wrap gap-2">
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
                      {posterImages.map((poster) => (
                        <NextImage
                          key={`${poster.cardId}-${poster.url.slice(-12)}`}
                          src={poster.url}
                          alt={poster.alt}
                          width={512}
                          height={768}
                          unoptimized
                          className="aspect-[3/4] w-full rounded-md border border-[#D8D2C1] object-cover"
                        />
                      ))}
                    </div>
                  </div>
                )}
                {draft.assetCards.map((card) => (
                  <div
                    key={card.id}
                    className="rounded-lg border border-[#D8D2C1] bg-white p-3"
                    style={{ borderLeftColor: card.themeColor, borderLeftWidth: 6 }}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-semibold uppercase text-[#6D6A61]">{card.role}</p>
                        <h3 className="mt-1 text-base font-semibold">{card.title}</h3>
                        <p className="text-sm text-[#6D6A61]">{card.subtitle}</p>
                      </div>
                      <ImageIcon size={18} color={card.themeColor} />
                    </div>
                    <div className="mt-3 grid gap-1">
                      {card.bullets.map((bullet) => (
                        <div key={bullet} className="text-sm text-[#3B403C]">
                          {bullet}
                        </div>
                      ))}
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
              aside={<RiskBadge level={compliance.riskLevel} />}
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
                    <div key={`${issue.term}-${issue.index}`} className="rounded-lg border border-[#D8D2C1] bg-white p-4">
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
                    className="inline-flex h-10 items-center gap-2 rounded-md border border-[#2E6B5F] bg-white px-3 text-sm font-semibold text-[#214F45]"
                    onClick={handleCopyPackage}
                    type="button"
                  >
                    <ClipboardCheck size={16} />
                    {copied ? "已复制" : "复制包"}
                  </button>
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
              {demoProject.brandColors.map((color) => (
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
              <div className="flex items-center justify-between rounded-md bg-[#F8F3E7] px-3 py-2">
                <span>SourceProvider</span>
                <span className="font-semibold text-[#214F45]">Manual</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-[#F8F3E7] px-3 py-2">
                <span>LLMProvider</span>
                <span className="font-semibold text-[#74530C]">Local stub</span>
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
