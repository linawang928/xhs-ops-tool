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

function parseDelimitedLine(line: string, delimiter: string) {
  if (!delimiter) return [line.trim()];

  const fields: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const nextChar = line[index + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === delimiter && !inQuotes) {
      fields.push(field.trim());
      field = "";
      continue;
    }

    field += char;
  }

  fields.push(field.trim());
  return fields;
}

function delimiterFor(line: string) {
  if (line.includes("\t")) return "\t";
  if (line.includes(",")) return ",";
  return "";
}

function normalizeHeader(header: string) {
  return header.trim().toLowerCase().replace(/[\s_-]+/g, "");
}

function headerKeyFor(header: string) {
  const normalized = normalizeHeader(header);
  const headerMap: Record<string, string[]> = {
    title: ["title", "topic", "note", "notetitle", "标题", "笔记标题", "对标标题", "选题"],
    author: ["author", "account", "creator", "作者", "博主", "账号"],
    subjectArea: ["subject", "subjectarea", "category", "domain", "主体区", "垂类", "行业", "类目"],
    contentFormat: ["format", "contentformat", "type", "内容形式", "形式", "类型"],
    audiencePain: ["pain", "audiencepain", "hook", "problem", "痛点", "人群痛点", "开场痛点"],
    likes: ["likes", "like", "点赞", "点赞数", "赞"],
    saves: ["saves", "save", "favorites", "收藏", "收藏数"],
    comments: ["comments", "comment", "评论", "评论数"],
    tags: ["tags", "tag", "hashtags", "标签", "话题", "话题标签"],
  };

  return Object.entries(headerMap).find(([, aliases]) => aliases.includes(normalized))?.[0];
}

function isHeaderRow(fields: string[]) {
  const keys = fields.map(headerKeyFor).filter((key): key is string => Boolean(key));
  return keys.includes("title") || keys.some((key) => ["author", "subjectArea", "contentFormat"].includes(key));
}

function fieldIndexMap(headers: string[]) {
  return headers.reduce<Record<string, number>>((map, header, index) => {
    const key = headerKeyFor(header);
    if (key && map[key] === undefined) {
      map[key] = index;
    }
    return map;
  }, {});
}

function valueAt(fields: string[], indexes: Record<string, number>, key: string, fallbackIndex: number) {
  const index = indexes[key] ?? fallbackIndex;
  return fields[index]?.trim() ?? "";
}

function parseMetric(value: string | undefined) {
  const raw = String(value ?? "").trim().replace(/,/g, "");
  const match = raw.match(/^(\d+(?:\.\d+)?)(w|万|k|千)?$/i);
  if (!match) return 0;

  const amount = Number(match[1]);
  const unit = match[2]?.toLowerCase();
  const multiplier = unit === "w" || unit === "万" ? 10000 : unit === "k" || unit === "千" ? 1000 : 1;

  return Math.max(0, Math.round(amount * multiplier));
}

function normalizeContentFormat(format: string, fallback: BenchmarkContentFormat): Exclude<BenchmarkContentFormat, "全部"> {
  const normalized = format.trim();
  if (normalized === "避坑清单" || /避坑|清单/.test(normalized)) return "避坑清单";
  if (normalized === "流程模板" || /流程|模板|步骤/.test(normalized)) return "流程模板";
  if (normalized === "测评对比" || /测评|对比|横评/.test(normalized)) return "测评对比";
  if (normalized === "路线合集" || /路线|合集|盘点/.test(normalized)) return "路线合集";
  return fallback === "全部" ? "避坑清单" : fallback;
}

function splitTags(value: string, subjectArea: string, title: string) {
  const tags = value
    .split(/[#|,，、/\s]+/)
    .map((tag) => tag.trim())
    .filter(Boolean);
  const fallbackTags = [subjectArea, ...Array.from(title.matchAll(/[\p{Script=Han}A-Za-z0-9]{2,}/gu), (match) => match[0]).slice(0, 2)];
  return Array.from(new Set(tags.length > 0 ? tags : fallbackTags)).slice(0, 6);
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

export function parseImportedBenchmarkCandidates(
  input: string,
  defaults: { projectId: string; subjectArea: string; contentFormat: BenchmarkContentFormat }
): BenchmarkCandidate[] {
  const rows = input
    .split(/\r?\n/)
    .map((row) => row.trim())
    .filter(Boolean);

  if (rows.length === 0) return [];

  const delimiter = delimiterFor(rows[0]);
  const firstFields = parseDelimitedLine(rows[0], delimiter);
  const hasHeader = isHeaderRow(firstFields);
  const indexes = hasHeader ? fieldIndexMap(firstFields) : {};
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const candidates: BenchmarkCandidate[] = [];

  dataRows.forEach((row, index) => {
    const rowDelimiter = delimiter || delimiterFor(row);
    const fields = parseDelimitedLine(row, rowDelimiter);
    const title = valueAt(fields, indexes, "title", 0);

    if (!title) return;

    const subjectArea = valueAt(fields, indexes, "subjectArea", 2) || defaults.subjectArea;
    const contentFormat = normalizeContentFormat(
      valueAt(fields, indexes, "contentFormat", 3),
      defaults.contentFormat
    );
    const audiencePain =
      valueAt(fields, indexes, "audiencePain", 4) || `${subjectArea}用户正在关注这个问题`;

    candidates.push({
      id: `bench-import-${slug(`${defaults.projectId}-${subjectArea}-${title}`)}-${index + 1}`,
      projectId: defaults.projectId,
      title,
      author: valueAt(fields, indexes, "author", 1) || "手动导入",
      subjectArea,
      contentFormat,
      audiencePain,
      tags: splitTags(valueAt(fields, indexes, "tags", 8), subjectArea, title),
      metrics: {
        likes: parseMetric(valueAt(fields, indexes, "likes", 5)),
        saves: parseMetric(valueAt(fields, indexes, "saves", 6)),
        comments: parseMetric(valueAt(fields, indexes, "comments", 7)),
      },
    });
  });

  return candidates.sort((a, b) => b.metrics.saves - a.metrics.saves || b.metrics.likes - a.metrics.likes);
}
