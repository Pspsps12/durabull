CREATE TABLE "redis_discovered_queue" (
	"id" uuid PRIMARY KEY,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"connection_id" uuid NOT NULL,
	"name" text NOT NULL,
	"state" text DEFAULT 'pending' NOT NULL,
	"last_discovered_at" timestamp with time zone,
	CONSTRAINT "redis_discovered_queue_state_check" CHECK ("state" IN ('pending', 'confirmed'))
);
--> statement-breakpoint
ALTER TABLE "redis_discovered_queue" ADD CONSTRAINT "redis_discovered_queue_connection_id_redis_connection_id_fkey" FOREIGN KEY ("connection_id") REFERENCES "redis_connection"("id") ON DELETE CASCADE;
--> statement-breakpoint
CREATE UNIQUE INDEX "redis_discovered_queue_connection_id_name_idx" ON "redis_discovered_queue" USING btree ("connection_id","name");
--> statement-breakpoint
CREATE INDEX "redis_discovered_queue_connection_id_state_idx" ON "redis_discovered_queue" USING btree ("connection_id","state");
