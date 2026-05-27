CREATE TABLE "oauth_application" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "name" text NOT NULL,
  "icon" text,
  "metadata" text,
  "client_id" text NOT NULL,
  "client_secret" text,
  "redirect_urls" text NOT NULL,
  "type" text NOT NULL,
  "disabled" boolean DEFAULT false NOT NULL,
  "user_id" text,
  CONSTRAINT "oauth_application_client_id_unique" UNIQUE("client_id"),
  CONSTRAINT "oauth_application_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "oauth_application_user_id_idx" ON "oauth_application" ("user_id");
--> statement-breakpoint
CREATE TABLE "oauth_access_token" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "access_token" text NOT NULL,
  "refresh_token" text NOT NULL,
  "access_token_expires_at" timestamp with time zone NOT NULL,
  "refresh_token_expires_at" timestamp with time zone NOT NULL,
  "client_id" text NOT NULL,
  "user_id" text,
  "scopes" text NOT NULL,
  "resource" text,
  CONSTRAINT "oauth_access_token_access_token_unique" UNIQUE("access_token"),
  CONSTRAINT "oauth_access_token_refresh_token_unique" UNIQUE("refresh_token"),
  CONSTRAINT "oauth_access_token_client_id_oauth_application_client_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "oauth_application"("client_id") ON DELETE cascade,
  CONSTRAINT "oauth_access_token_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "oauth_access_token_client_id_idx" ON "oauth_access_token" ("client_id");
--> statement-breakpoint
CREATE INDEX "oauth_access_token_user_id_idx" ON "oauth_access_token" ("user_id");
--> statement-breakpoint
CREATE TABLE "oauth_consent" (
  "id" text PRIMARY KEY NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  "client_id" text NOT NULL,
  "user_id" text NOT NULL,
  "scopes" text NOT NULL,
  "consent_given" boolean NOT NULL,
  CONSTRAINT "oauth_consent_client_id_oauth_application_client_id_fk"
    FOREIGN KEY ("client_id") REFERENCES "oauth_application"("client_id") ON DELETE cascade,
  CONSTRAINT "oauth_consent_user_id_user_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX "oauth_consent_client_id_idx" ON "oauth_consent" ("client_id");
--> statement-breakpoint
CREATE INDEX "oauth_consent_user_id_idx" ON "oauth_consent" ("user_id");
