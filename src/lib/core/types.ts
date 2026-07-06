export type TopicSource = "manual-keyword" | "manual-import" | "xhs-login" | "third-party";

export type TopicStatus = "candidate" | "selected" | "archived";

export type RiskLevel = "low" | "medium" | "high";

export type ComplianceCategory =
  | "absolute_claim"
  | "off_platform"
  | "unrealistic_promise"
  | "medical_or_finance"
  | "custom_forbidden";

export type PublishTaskStatus = "ready" | "queued" | "published" | "blocked";

export type BenchmarkContentFormat = "避坑清单" | "流程模板" | "路线合集" | "测评对比" | "全部";

export interface AccountPositioningInput {
  projectId: string;
  subjectArea: string;
  audience: string;
  differentiator: string;
  tone: string;
}

export interface AccountPositioning {
  id: string;
  projectId: string;
  subjectArea: string;
  audience: string;
  differentiator: string;
  tone: string;
  nameOptions: string[];
  bioOptions: string[];
  selectedName: string;
  selectedBio: string;
  positioningStatement: string;
  contentPillars: string[];
  benchmarkFilters: {
    subjectArea: string;
    contentFormats: BenchmarkContentFormat[];
  };
  createdAt: string;
}

export interface Project {
  id: string;
  name: string;
  persona: string;
  industry: string;
  tone: string;
  audience: string;
  forbiddenWords: string[];
  brandColors: string[];
}

export interface EngagementMetrics {
  likes: number;
  saves: number;
  comments: number;
}

export interface TopicCandidate {
  id: string;
  projectId: string;
  keyword: string;
  title: string;
  angle: string;
  source: TopicSource;
  score: number;
  status: TopicStatus;
  metrics: EngagementMetrics;
  reasons: string[];
}

export interface BenchmarkAnalysis {
  openingHook: string;
  structure: string[];
  tags: string[];
  sellingPoints: string[];
  interactionCues: string[];
}

export interface BenchmarkNote {
  id: string;
  projectId: string;
  title: string;
  body: string;
  sourceUrl?: string;
  author?: string;
  metrics?: EngagementMetrics;
  importedAt: string;
  analysis: BenchmarkAnalysis;
}

export interface RawBenchmarkNote {
  id: string;
  projectId: string;
  title: string;
  body: string;
  sourceUrl?: string;
  author?: string;
  metrics?: EngagementMetrics;
  importedAt: string;
}

export interface BenchmarkCandidate {
  id: string;
  projectId: string;
  title: string;
  author: string;
  subjectArea: string;
  contentFormat: Exclude<BenchmarkContentFormat, "全部">;
  audiencePain: string;
  tags: string[];
  metrics: EngagementMetrics;
}

export interface ScoredBenchmarkCandidate extends BenchmarkCandidate {
  matchScore: number;
  matchReasons: string[];
}

export interface ComplianceIssue {
  term: string;
  category: ComplianceCategory;
  severity: Exclude<RiskLevel, "low">;
  suggestion: string;
  index: number;
}

export interface ComplianceResult {
  riskLevel: RiskLevel;
  issues: ComplianceIssue[];
  sanitizedText: string;
}

export interface AssetCard {
  id: string;
  draftId: string;
  role: "cover" | "problem" | "steps" | "checklist" | "summary";
  title: string;
  subtitle: string;
  bullets: string[];
  themeColor: string;
}

export interface ContentDraft {
  id: string;
  projectId: string;
  topicId: string;
  titleOptions: string[];
  selectedTitle: string;
  body: string;
  hashtags: string[];
  assetCards: AssetCard[];
  compliance: ComplianceResult;
  createdAt: string;
}

export interface PublishTask {
  id: string;
  projectId: string;
  draftId: string;
  scheduledAt: string;
  status: PublishTaskStatus;
  publisherMode: "manual";
  officialPublishUrl: string;
  checklist: string[];
  exportText: string;
  createdAt: string;
  updatedAt: string;
}
