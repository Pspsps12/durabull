ALTER TABLE "alert_event" ADD COLUMN "dedupe_key" text;
--> statement-breakpoint
CREATE UNIQUE INDEX "alert_event_rule_dedupe_key_idx"
  ON "alert_event" ("alert_rule_id", "dedupe_key");
--> statement-breakpoint
CREATE TABLE "linear_integration" (
  "id" uuid PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "organization_id" text NOT NULL,
  "encrypted_access_token" text NOT NULL,
  "encrypted_refresh_token" text NOT NULL,
  "token_type" text DEFAULT 'Bearer' NOT NULL,
  "scopes" text NOT NULL,
  "access_token_expires_at" timestamp with time zone NOT NULL,
  "linear_organization_name" text,
  "validation_status" text DEFAULT 'unknown' NOT NULL,
  "default_team_id" text,
  "default_project_id" text,
  "default_label_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "default_assignee_id" text,
  "default_state_id" text,
  "default_priority" integer,
  "last_validated_at" timestamp with time zone,
  CONSTRAINT "linear_integration_organization_id_unique" UNIQUE("organization_id"),
  CONSTRAINT "linear_integration_organization_id_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE "linear_oauth_state" (
  "id" uuid PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "organization_id" text NOT NULL,
  "user_id" text NOT NULL,
  "state_hash" text NOT NULL,
  "redirect_uri" text NOT NULL,
  "expires_at" timestamp with time zone NOT NULL,
  CONSTRAINT "linear_oauth_state_state_hash_unique" UNIQUE("state_hash"),
  CONSTRAINT "linear_oauth_state_organization_id_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "linear_oauth_state_expires_at_idx" ON "linear_oauth_state" ("expires_at");
--> statement-breakpoint
CREATE TABLE "alert_delivery" (
  "id" uuid PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "alert_event_id" uuid NOT NULL,
  "organization_id" text NOT NULL,
  "channel_type" text NOT NULL,
  "target" text NOT NULL,
  "status" text DEFAULT 'pending' NOT NULL,
  "attempt_count" integer DEFAULT 0 NOT NULL,
  "next_retry_at" timestamp with time zone,
  "claimed_at" timestamp with time zone,
  "last_error" text,
  "provider_metadata" jsonb DEFAULT '{}'::jsonb,
  "external_id" text,
  "external_identifier" text,
  "external_url" text,
  CONSTRAINT "alert_delivery_alert_event_id_alert_event_id_fk"
    FOREIGN KEY ("alert_event_id") REFERENCES "alert_event"("id") ON DELETE cascade,
  CONSTRAINT "alert_delivery_organization_id_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "alert_delivery_event_id_idx" ON "alert_delivery" ("alert_event_id");
--> statement-breakpoint
CREATE INDEX "alert_delivery_org_status_retry_idx"
  ON "alert_delivery" ("organization_id", "status", "next_retry_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "alert_delivery_event_channel_target_idx"
  ON "alert_delivery" ("alert_event_id", "channel_type", "target");
--> statement-breakpoint
CREATE TABLE "linear_job_issue" (
  "id" uuid PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "organization_id" text NOT NULL,
  "connection_id" uuid NOT NULL,
  "queue_name" text NOT NULL,
  "job_id" text NOT NULL,
  "alert_event_id" uuid NOT NULL,
  "linear_issue_id" text NOT NULL,
  "linear_issue_identifier" text NOT NULL,
  "linear_issue_url" text NOT NULL,
  CONSTRAINT "linear_job_issue_organization_id_organization_id_fk"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE cascade,
  CONSTRAINT "linear_job_issue_connection_id_redis_connection_id_fk"
    FOREIGN KEY ("connection_id") REFERENCES "redis_connection"("id") ON DELETE cascade,
  CONSTRAINT "linear_job_issue_alert_event_id_alert_event_id_fk"
    FOREIGN KEY ("alert_event_id") REFERENCES "alert_event"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "linear_job_issue_alert_event_id_idx" ON "linear_job_issue" ("alert_event_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "linear_job_issue_job_unique_idx"
  ON "linear_job_issue" ("organization_id", "connection_id", "queue_name", "job_id");
--> statement-breakpoint
CREATE TABLE "linear_job_issue_event" (
  "id" uuid PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "linear_job_issue_id" uuid NOT NULL,
  "alert_event_id" uuid NOT NULL,
  CONSTRAINT "linear_job_issue_event_linear_job_issue_id_fk"
    FOREIGN KEY ("linear_job_issue_id") REFERENCES "linear_job_issue"("id") ON DELETE cascade,
  CONSTRAINT "linear_job_issue_event_alert_event_id_fk"
    FOREIGN KEY ("alert_event_id") REFERENCES "alert_event"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "linear_job_issue_event_alert_event_id_idx"
  ON "linear_job_issue_event" ("alert_event_id");
--> statement-breakpoint
CREATE UNIQUE INDEX "linear_job_issue_event_unique_idx"
  ON "linear_job_issue_event" ("linear_job_issue_id", "alert_event_id");
