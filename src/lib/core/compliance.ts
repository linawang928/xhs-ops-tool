import type { ComplianceCategory, ComplianceIssue, ComplianceResult } from "./types";

interface ComplianceRule {
  term: string;
  category: ComplianceCategory;
  severity: "medium" | "high";
  suggestion: string;
  replacement: string;
}

const baseRules: ComplianceRule[] = [
  {
    term: "全网最低",
    category: "absolute_claim",
    severity: "medium",
    suggestion: "改为价格友好的相对表达，避免绝对化承诺。",
    replacement: "近期价格友好",
  },
  {
    term: "100%有效",
    category: "absolute_claim",
    severity: "medium",
    suggestion: "改为个人体验或适用条件表达。",
    replacement: "对我有帮助",
  },
  {
    term: "加微信",
    category: "off_platform",
    severity: "high",
    suggestion: "不要引导站外联系方式，可改为站内评论或收藏。",
    replacement: "在评论区交流",
  },
  {
    term: "7天瘦10斤",
    category: "unrealistic_promise",
    severity: "high",
    suggestion: "删除快速结果承诺，改成过程记录或经验分享。",
    replacement: "记录阶段性变化",
  },
  {
    term: "根治",
    category: "medical_or_finance",
    severity: "high",
    suggestion: "避免医疗化承诺，改为舒缓、改善体验等低风险表达。",
    replacement: "帮助舒缓",
  },
  {
    term: "稳赚",
    category: "medical_or_finance",
    severity: "high",
    suggestion: "避免金融收益承诺。",
    replacement: "需要自行评估风险",
  },
];

function collectRules(customForbiddenWords: string[]) {
  const customRules: ComplianceRule[] = customForbiddenWords.map((term) => ({
    term,
    category: "custom_forbidden",
    severity: "medium",
    suggestion: `该词在当前项目禁用词中，建议换成更克制的表达。`,
    replacement: "更稳妥的表达",
  }));

  return [...customRules, ...baseRules];
}

export function scanCompliance(text: string, customForbiddenWords: string[] = []): ComplianceResult {
  const issues: ComplianceIssue[] = [];
  let sanitizedText = text;

  for (const rule of collectRules(customForbiddenWords)) {
    let searchIndex = text.indexOf(rule.term);
    while (searchIndex >= 0) {
      issues.push({
        term: rule.term,
        category: rule.category,
        severity: rule.severity,
        suggestion: rule.suggestion,
        index: searchIndex,
      });
      searchIndex = text.indexOf(rule.term, searchIndex + rule.term.length);
    }

    sanitizedText = sanitizedText.split(rule.term).join(rule.replacement);
  }

  const riskLevel = issues.some((issue) => issue.severity === "high")
    ? "high"
    : issues.length > 0
      ? "medium"
      : "low";

  return {
    riskLevel,
    issues: issues.sort((a, b) => a.index - b.index),
    sanitizedText,
  };
}
