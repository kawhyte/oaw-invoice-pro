CREATE TABLE "payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"receipt_number" text,
	"amount" numeric NOT NULL,
	"paid_on" date NOT NULL,
	"method" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "payments_amount_positive" CHECK ("payments"."amount" > 0)
);
--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "payments_invoice_id_idx" ON "payments" USING btree ("invoice_id" uuid_ops);--> statement-breakpoint
CREATE UNIQUE INDEX "payments_user_receipt_uniq" ON "payments" USING btree ("user_id" uuid_ops,"receipt_number" text_ops);--> statement-breakpoint
-- Backfill: each invoice's existing amount_paid becomes one "earlier payments"
-- row (no receipt number — its real dates/methods were never recorded), so
-- amount_paid = SUM(payments.amount) holds from day one.
INSERT INTO "payments" ("user_id", "invoice_id", "amount", "paid_on", "note")
SELECT "user_id", "id", "amount_paid",
       COALESCE(("created_at" AT TIME ZONE 'America/Jamaica')::date, CURRENT_DATE),
       'Recorded before payment history'
FROM "invoices"
WHERE "amount_paid" > 0;
