--> statement-breakpoint
CREATE TABLE "adapter"."provider_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"project_id" text NOT NULL,
	"provider_code" text NOT NULL,
	"credentials" text NOT NULL,
	"webhook_secret" text,
	"key_version" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"rotated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "provider_credentials_project_provider_idx" ON "adapter"."provider_credentials" USING btree ("project_id","provider_code");