CREATE TABLE `benchmark_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`source_url` text,
	`author` text,
	`metrics_json` text,
	`analysis_json` text NOT NULL,
	`imported_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `content_drafts` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`topic_id` text NOT NULL,
	`title_options_json` text NOT NULL,
	`selected_title` text NOT NULL,
	`body` text NOT NULL,
	`hashtags_json` text NOT NULL,
	`asset_cards_json` text NOT NULL,
	`compliance_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`topic_id`) REFERENCES `topic_candidates`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`persona` text NOT NULL,
	`industry` text NOT NULL,
	`tone` text NOT NULL,
	`audience` text NOT NULL,
	`forbidden_words_json` text NOT NULL,
	`brand_colors_json` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `publish_tasks` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`draft_id` text NOT NULL,
	`scheduled_at` text NOT NULL,
	`status` text NOT NULL,
	`publisher_mode` text NOT NULL,
	`official_publish_url` text NOT NULL,
	`checklist_json` text NOT NULL,
	`export_text` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`draft_id`) REFERENCES `content_drafts`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `topic_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`keyword` text NOT NULL,
	`title` text NOT NULL,
	`angle` text NOT NULL,
	`source` text NOT NULL,
	`score` integer NOT NULL,
	`status` text NOT NULL,
	`metrics_json` text NOT NULL,
	`reasons_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
