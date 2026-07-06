import type { Project, TopicCandidate } from "./types";

const now = "2026-07-06T00:00:00.000Z";

function idFor(prefix: string, value: string, index = 0) {
  return `${prefix}-${value.replace(/\s+/g, "-").toLowerCase()}-${index + 1}`;
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
    title: ["title", "topic", "note", "notetitle", "标题", "笔记标题", "选题", "选题标题"],
    keyword: ["keyword", "keywords", "关键词", "关键字"],
    likes: ["likes", "like", "liked", "点赞", "点赞数", "赞"],
    saves: ["saves", "save", "saved", "favorites", "收藏", "收藏数"],
    comments: ["comments", "comment", "评论", "评论数"],
    angle: ["angle", "contentangle", "角度", "选题角度", "内容角度"],
    tags: ["tags", "tag", "hashtags", "标签", "话题", "话题标签"],
  };

  return Object.entries(headerMap).find(([, aliases]) => aliases.includes(normalized))?.[0];
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

function isHeaderRow(fields: string[]) {
  const keys = fields.map(headerKeyFor).filter((key): key is string => Boolean(key));
  return keys.includes("title") || keys.some((key) => ["likes", "saves", "comments", "angle"].includes(key));
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

export function scoreTopicCandidate(candidate: TopicCandidate): {
  score: number;
  reasons: string[];
} {
  const title = candidate.title;
  const keywordFit = title.includes(candidate.keyword) ? 28 : title.includes(candidate.keyword.slice(0, 2)) ? 18 : 8;
  const metrics = candidate.metrics;
  const engagementScore = Math.min(
    35,
    metrics.likes * 0.006 + metrics.saves * 0.012 + metrics.comments * 0.04
  );
  const saveRatio = metrics.likes > 0 ? metrics.saves / metrics.likes : 0;
  const angleScore = /清单|避坑|步骤|模板|对比|别乱|指南|痛点/.test(title + candidate.angle)
    ? 18
    : 10;
  const planningFit = candidate.status === "selected" ? 12 : 10;
  const score = Math.round(keywordFit + engagementScore + angleScore + planningFit);
  const reasons = [
    keywordFit >= 18 ? "关键词贴合" : "关键词弱相关",
    angleScore >= 18 ? "选题角度明确" : "角度需要收窄",
    saveRatio >= 0.4 || metrics.saves >= 500 ? "收藏权重高" : "互动数据一般",
    `评估时间 ${now.slice(0, 10)}`,
  ];

  return { score: Math.min(100, score), reasons };
}

export function rankTopicCandidates(candidates: TopicCandidate[]) {
  return candidates
    .map((candidate) => {
      const scored = scoreTopicCandidate(candidate);
      return { ...candidate, score: scored.score, reasons: scored.reasons };
    })
    .sort((a, b) => b.score - a.score);
}

export function parseImportedTopicRows(input: string, project: Project, fallbackKeyword: string): TopicCandidate[] {
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
  const cleanFallbackKeyword = fallbackKeyword.trim() || project.industry;
  const candidates: TopicCandidate[] = [];

  dataRows.forEach((row, index) => {
    const rowDelimiter = delimiter || delimiterFor(row);
    const fields = parseDelimitedLine(row, rowDelimiter);
    const title = valueAt(fields, indexes, "title", 0);
    const keyword = valueAt(fields, indexes, "keyword", -1) || cleanFallbackKeyword;
    const angle = valueAt(fields, indexes, "angle", 4) || "手动导入";

    if (!title) return;

    candidates.push({
      id: idFor("topic-import", `${project.id}-${keyword}-${title}`, index),
      projectId: project.id,
      keyword,
      title,
      angle,
      source: "manual-import",
      score: 0,
      status: "candidate",
      metrics: {
        likes: parseMetric(valueAt(fields, indexes, "likes", 1)),
        saves: parseMetric(valueAt(fields, indexes, "saves", 2)),
        comments: parseMetric(valueAt(fields, indexes, "comments", 3)),
      },
      reasons: [],
    });
  });

  return rankTopicCandidates(candidates);
}

export function generateTopicCandidates(keyword: string, project: Project): TopicCandidate[] {
  const cleanKeyword = keyword.trim();
  const templates = [
    {
      title: `${cleanKeyword}痛点避坑清单：新手先看这 5 个细节`,
      angle: "痛点清单",
      metrics: { likes: 3200, saves: 2200, comments: 168 },
    },
    {
      title: `${cleanKeyword}前后对比：哪些做法真的更适合${project.audience}`,
      angle: "对比验证",
      metrics: { likes: 2100, saves: 1200, comments: 96 },
    },
    {
      title: `${cleanKeyword}一周执行表：每天照着做不慌`,
      angle: "步骤模板",
      metrics: { likes: 1800, saves: 1500, comments: 74 },
    },
    {
      title: `${project.industry}新手别乱跟风，${cleanKeyword}先问自己 3 个问题`,
      angle: "反差提醒",
      metrics: { likes: 1300, saves: 760, comments: 58 },
    },
    {
      title: `${cleanKeyword}评论区高频问题汇总`,
      angle: "互动复盘",
      metrics: { likes: 980, saves: 520, comments: 121 },
    },
  ];

  return rankTopicCandidates(
    templates.map((template, index) => ({
      id: idFor("topic", cleanKeyword, index),
      projectId: project.id,
      keyword: cleanKeyword,
      title: template.title,
      angle: template.angle,
      source: "manual-keyword",
      score: 0,
      status: "candidate",
      metrics: template.metrics,
      reasons: [],
    }))
  );
}
