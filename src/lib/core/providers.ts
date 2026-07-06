import type { ContentDraft, Project, RawBenchmarkNote, TopicCandidate } from "./types";

export interface SourceProvider {
  search(keyword: string, project: Project): Promise<TopicCandidate[]>;
  importNote(urlOrText: string, projectId: string): Promise<RawBenchmarkNote>;
}

export interface LLMProvider {
  generateDraft(input: {
    project: Project;
    topic: TopicCandidate;
    benchmarkIds: string[];
  }): Promise<ContentDraft>;
}

export interface ImageProvider {
  generateImage(input: {
    prompt: string;
    aspectRatio: "3:4" | "1:1";
    style: "template-card" | "ai-generated";
  }): Promise<{ url: string; alt: string }>;
}

export interface PublisherAdapter {
  prepare(draft: ContentDraft, project: Project, scheduledAt: string): Promise<unknown>;
}
