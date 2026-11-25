ALTER TABLE "project_deliverables" ADD COLUMN "detail_pages" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "project_deliverables" ADD COLUMN "review_level" text DEFAULT 'basic' NOT NULL;--> statement-breakpoint
ALTER TABLE "project_deliverables" ADD COLUMN "review_expires_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "project_deliverables" ADD COLUMN "allow_sample_download" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "project_deliverables" ADD CONSTRAINT "project_deliverables_review_level_check" CHECK (review_level = ANY (ARRAY['basic'::text, 'detail'::text]));