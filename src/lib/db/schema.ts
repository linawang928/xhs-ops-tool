import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  persona: text("persona").notNull(),
  industry: text("industry").notNull(),
  tone: text("tone").notNull(),
  audience: text("audience").notNull(),
  forbiddenWordsJson: text("forbidden_words_json").notNull(),
  brandColorsJson: text("brand_colors_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const accountPositionings = sqliteTable("account_positionings", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  subjectArea: text("subject_area").notNull(),
  audience: text("audience").notNull(),
  differentiator: text("differentiator").notNull(),
  tone: text("tone").notNull(),
  nameOptionsJson: text("name_options_json").notNull(),
  bioOptionsJson: text("bio_options_json").notNull(),
  selectedName: text("selected_name").notNull(),
  selectedBio: text("selected_bio").notNull(),
  positioningStatement: text("positioning_statement").notNull(),
  contentPillarsJson: text("content_pillars_json").notNull(),
  benchmarkFiltersJson: text("benchmark_filters_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const benchmarkCandidates = sqliteTable("benchmark_candidates", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  author: text("author").notNull(),
  subjectArea: text("subject_area").notNull(),
  contentFormat: text("content_format").notNull(),
  audiencePain: text("audience_pain").notNull(),
  tagsJson: text("tags_json").notNull(),
  metricsJson: text("metrics_json").notNull(),
});

export const topicCandidates = sqliteTable("topic_candidates", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  keyword: text("keyword").notNull(),
  title: text("title").notNull(),
  angle: text("angle").notNull(),
  source: text("source").notNull(),
  score: integer("score").notNull(),
  status: text("status").notNull(),
  metricsJson: text("metrics_json").notNull(),
  reasonsJson: text("reasons_json").notNull(),
});

export const benchmarkNotes = sqliteTable("benchmark_notes", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  title: text("title").notNull(),
  body: text("body").notNull(),
  sourceUrl: text("source_url"),
  author: text("author"),
  metricsJson: text("metrics_json"),
  analysisJson: text("analysis_json").notNull(),
  importedAt: text("imported_at").notNull(),
});

export const contentDrafts = sqliteTable("content_drafts", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  topicId: text("topic_id").notNull().references(() => topicCandidates.id),
  titleOptionsJson: text("title_options_json").notNull(),
  selectedTitle: text("selected_title").notNull(),
  body: text("body").notNull(),
  hashtagsJson: text("hashtags_json").notNull(),
  assetCardsJson: text("asset_cards_json").notNull(),
  complianceJson: text("compliance_json").notNull(),
  createdAt: text("created_at").notNull(),
});

export const publishTasks = sqliteTable("publish_tasks", {
  id: text("id").primaryKey(),
  projectId: text("project_id").notNull().references(() => projects.id),
  draftId: text("draft_id").notNull().references(() => contentDrafts.id),
  scheduledAt: text("scheduled_at").notNull(),
  status: text("status").notNull(),
  publisherMode: text("publisher_mode").notNull(),
  officialPublishUrl: text("official_publish_url").notNull(),
  checklistJson: text("checklist_json").notNull(),
  exportText: text("export_text").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});
