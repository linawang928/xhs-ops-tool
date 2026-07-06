import type { BenchmarkNote, RawBenchmarkNote } from "./types";

function linesOf(text: string) {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function extractTags(text: string) {
  return Array.from(text.matchAll(/#([\p{Script=Han}A-Za-z0-9_-]+)/gu), (match) => match[1]);
}

function extractStructure(title: string, body: string) {
  const structure = new Set<string>();
  const lines = linesOf(body);

  if (lines[0]?.length > 8) structure.add("痛点开场");
  if (/别乱|避坑|先看|别买/.test(title)) structure.add("反差标题");
  if (lines.some((line) => /^\d+[\.、]/.test(line))) structure.add("步骤清单");
  if (/评论区|你们|收藏|自查/.test(body)) structure.add("互动收尾");

  return Array.from(structure);
}

function extractSellingPoints(body: string) {
  const points = linesOf(body)
    .filter((line) => /^\d+[\.、]/.test(line))
    .map((line) =>
      line
        .replace(/^\d+[\.、]\s*/, "")
        .replace(/^(先|再|最后)?看/, "")
        .replace(/^(先|再|最后)?/, "")
        .trim()
    )
    .filter(Boolean);

  return points.length > 0 ? points : ["标题承诺明确", "结构便于收藏"];
}

function extractInteractionCues(body: string) {
  return body
    .split(/[。！？\n]/)
    .map((part) => part.trim())
    .filter((part) => /评论区|收藏|你们|留言|互相/.test(part));
}

export function analyzeBenchmarkNote(note: RawBenchmarkNote): BenchmarkNote {
  const lines = linesOf(note.body);

  return {
    ...note,
    analysis: {
      openingHook: lines[0] ?? note.title,
      structure: extractStructure(note.title, note.body),
      tags: extractTags(note.body),
      sellingPoints: extractSellingPoints(note.body),
      interactionCues: extractInteractionCues(note.body),
    },
  };
}
