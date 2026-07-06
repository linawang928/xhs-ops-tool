import type {
  AccountPositioning,
  AccountPositioningInput,
  BenchmarkCandidate,
  BenchmarkContentFormat,
  ScoredBenchmarkCandidate,
} from "./types";

function slug(value: string) {
  return value.trim().replace(/\s+/g, "-").toLowerCase();
}

function conciseSubject(subjectArea: string) {
  return subjectArea.replace(/[｜|].*$/, "").trim();
}

export function generateAccountPositioning(input: AccountPositioningInput): AccountPositioning {
  const subject = conciseSubject(input.subjectArea);
  const subjectSuffix = subject.length <= 4 ? subject : subject.slice(0, 4);
  const nameOptions = [
    `${subjectSuffix}自查室`,
    `${subjectSuffix}慢慢懂`,
    `${subjectSuffix}避坑笔记`,
  ];
  const bioOptions = [
    `给${input.audience}的${subject}决策辅助。${input.differentiator}。`,
    `${input.tone}地聊${subject}，把复杂问题拆成能执行的小步骤。`,
    `不催买、不夸大，只帮${input.audience}少踩坑、会判断。`,
  ];

  return {
    id: `positioning-${slug(subject)}-${input.projectId}`,
    projectId: input.projectId,
    subjectArea: subject,
    audience: input.audience,
    differentiator: input.differentiator,
    tone: input.tone,
    nameOptions,
    bioOptions,
    selectedName: nameOptions[0],
    selectedBio: bioOptions[0],
    positioningStatement: `面向${input.audience}，用${input.tone}的表达，${input.differentiator}，让用户在${subject}场景里更快做出稳妥选择。`,
    contentPillars: ["痛点避坑", "流程模板", "评论区问题复盘", "低风险清单"],
    benchmarkFilters: {
      subjectArea: subject,
      contentFormats: ["避坑清单", "流程模板", "测评对比", "全部"],
    },
    createdAt: "2026-07-06T10:00:00.000Z",
  };
}

function scoreBenchmarkCandidate(
  candidate: BenchmarkCandidate,
  positioning: AccountPositioning,
  subjectArea: string,
  contentFormat: BenchmarkContentFormat
) {
  const reasons: string[] = [];
  let score = 0;

  if (candidate.subjectArea === subjectArea) {
    score += 45;
    reasons.push("主体区一致");
  }

  if (contentFormat === "全部" || candidate.contentFormat === contentFormat) {
    score += contentFormat === "全部" ? 20 : 28;
    reasons.push(contentFormat === "全部" ? "内容形式可参考" : "内容形式匹配");
  }

  const audienceTokens = positioning.audience.split(/[，、\s-]+/).filter((token) => token.length >= 2);
  const painText = `${candidate.audiencePain} ${candidate.title} ${candidate.tags.join(" ")}`;
  const audienceFit = audienceTokens.some((token) => painText.includes(token));
  if (audienceFit || /新手|小白|通勤|早八|敏感/.test(painText)) {
    score += 17;
    reasons.push("人群痛点接近");
  }

  if (candidate.metrics.saves >= 1000) {
    score += 12;
    reasons.push("收藏数据可拆解");
  }

  return {
    score: Math.min(100, score),
    reasons,
  };
}

export function filterBenchmarkCandidates(
  candidates: BenchmarkCandidate[],
  positioning: AccountPositioning,
  filters: { subjectArea: string; contentFormat: BenchmarkContentFormat }
): ScoredBenchmarkCandidate[] {
  return candidates
    .filter((candidate) => candidate.subjectArea === filters.subjectArea)
    .filter((candidate) => filters.contentFormat === "全部" || candidate.contentFormat === filters.contentFormat)
    .map((candidate) => {
      const scored = scoreBenchmarkCandidate(
        candidate,
        positioning,
        filters.subjectArea,
        filters.contentFormat
      );
      return {
        ...candidate,
        matchScore: scored.score,
        matchReasons: scored.reasons,
      };
    })
    .sort((a, b) => b.matchScore - a.matchScore || b.metrics.saves - a.metrics.saves);
}
