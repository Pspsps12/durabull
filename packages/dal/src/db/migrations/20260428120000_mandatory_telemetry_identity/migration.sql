CREATE TABLE "telemetry_installation" (
	"id" text PRIMARY KEY,
	"anonymous_instance_id" uuid NOT NULL UNIQUE,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
