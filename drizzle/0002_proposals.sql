CREATE TABLE "proposal_drawings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"name" text NOT NULL,
	"storage_path" text NOT NULL,
	"preview_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"zoom_paths" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"page_count" integer,
	"size_bytes" bigint,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"category" text,
	"description" text NOT NULL,
	"quantity" numeric DEFAULT 1 NOT NULL,
	"unit_price" numeric DEFAULT 0 NOT NULL,
	"amount" numeric DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposal_responses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"kind" text NOT NULL,
	"responder_name" text,
	"note" text,
	"ip_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposal_responses_kind_check" CHECK ("proposal_responses"."kind" in ('accept','changes'))
);
--> statement-breakpoint
CREATE TABLE "proposal_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"proposal_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"total" numeric NOT NULL,
	"sent_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "proposals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"proposal_number" text NOT NULL,
	"client_id" uuid,
	"recipient_name" text NOT NULL,
	"recipient_phone" text,
	"recipient_email" text,
	"title" text NOT NULL,
	"scope" text,
	"job_type" text,
	"location_address" text,
	"currency" text DEFAULT 'JMD' NOT NULL,
	"subtotal" numeric DEFAULT 0 NOT NULL,
	"discount_type" text DEFAULT 'none' NOT NULL,
	"discount_value" numeric DEFAULT 0 NOT NULL,
	"gct_rate" numeric DEFAULT 0 NOT NULL,
	"gct_amount" numeric DEFAULT 0 NOT NULL,
	"additions_description" text,
	"additions_amount" numeric DEFAULT 0 NOT NULL,
	"total" numeric DEFAULT 0 NOT NULL,
	"notes" text,
	"valid_until" date NOT NULL,
	"status" text DEFAULT 'draft' NOT NULL,
	"share_token" uuid DEFAULT gen_random_uuid() NOT NULL,
	"changes_requested_at" timestamp with time zone,
	"accepted_at" timestamp with time zone,
	"accepted_version" integer,
	"accepted_by_name" text,
	"converted_at" timestamp with time zone,
	"invoice_id" uuid,
	"project_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proposals_share_token_key" UNIQUE("share_token"),
	CONSTRAINT "proposals_status_check" CHECK ("proposals"."status" in ('draft','sent','revised','accepted','declined','converted'))
);
--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "proposal_id" uuid;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "agreed_amount" numeric;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "work_started_at" date;--> statement-breakpoint
ALTER TABLE "proposal_drawings" ADD CONSTRAINT "proposal_drawings_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_line_items" ADD CONSTRAINT "proposal_line_items_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_responses" ADD CONSTRAINT "proposal_responses_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposal_versions" ADD CONSTRAINT "proposal_versions_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "public"."clients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "proposal_drawings_proposal_id_idx" ON "proposal_drawings" USING btree ("proposal_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "proposal_line_items_proposal_id_idx" ON "proposal_line_items" USING btree ("proposal_id" uuid_ops);--> statement-breakpoint
CREATE INDEX "proposal_responses_proposal_created_idx" ON "proposal_responses" USING btree ("proposal_id" uuid_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE INDEX "proposal_responses_ip_created_idx" ON "proposal_responses" USING btree ("ip_hash" text_ops,"created_at" timestamptz_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "proposal_versions_proposal_version_uniq" ON "proposal_versions" USING btree ("proposal_id" uuid_ops,"version" int4_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "proposals_user_number_uniq" ON "proposals" USING btree ("user_id" uuid_ops,"proposal_number" text_ops);--> statement-breakpoint
CREATE INDEX "proposals_user_id_idx" ON "proposals" USING btree ("user_id" uuid_ops);--> statement-breakpoint
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_proposal_id_fkey" FOREIGN KEY ("proposal_id") REFERENCES "public"."proposals"("id") ON DELETE set null ON UPDATE no action;