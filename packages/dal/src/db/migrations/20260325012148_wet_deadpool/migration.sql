ALTER TABLE "alert_rule" ADD COLUMN "queue_filter_mode" text;--> statement-breakpoint
ALTER TABLE "alert_rule" ADD COLUMN "filter_queue_names" jsonb DEFAULT '[]';