CREATE TABLE `account_positionings` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`subject_area` text NOT NULL,
	`audience` text NOT NULL,
	`differentiator` text NOT NULL,
	`tone` text NOT NULL,
	`name_options_json` text NOT NULL,
	`bio_options_json` text NOT NULL,
	`selected_name` text NOT NULL,
	`selected_bio` text NOT NULL,
	`positioning_statement` text NOT NULL,
	`content_pillars_json` text NOT NULL,
	`benchmark_filters_json` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `benchmark_candidates` (
	`id` text PRIMARY KEY NOT NULL,
	`project_id` text NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`subject_area` text NOT NULL,
	`content_format` text NOT NULL,
	`audience_pain` text NOT NULL,
	`tags_json` text NOT NULL,
	`metrics_json` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE no action
);
