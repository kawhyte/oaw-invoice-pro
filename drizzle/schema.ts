import { pgTable, unique, uuid, text, numeric, timestamp, index, foreignKey, jsonb, integer, bigint, boolean, date, check, uniqueIndex } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const business_settings = pgTable("business_settings", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	business_name: text(),
	owner_name: text(),
	email: text(),
	phone: text(),
	address: text(),
	logo_url: text(),
	max_workload: numeric(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	unique("business_settings_user_id_key").on(table.user_id),
]);

export const project_deliverables = pgTable("project_deliverables", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	project_id: uuid().notNull(),
	name: text().notNull(),
	storage_path: text().notNull(),
	preview_paths: jsonb().default([]).notNull(),
	page_count: integer(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	size_bytes: bigint({ mode: "number" }),
	linked_invoice_id: uuid(),
	manual_unlock: boolean().default(false).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	zoom_paths: jsonb().default([]).notNull(),
}, (table) => [
	index("project_deliverables_invoice_id_idx").using("btree", table.linked_invoice_id.asc().nullsLast().op("uuid_ops")),
	index("project_deliverables_project_id_idx").using("btree", table.project_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.linked_invoice_id],
			foreignColumns: [invoices.id],
			name: "project_deliverables_linked_invoice_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "project_deliverables_project_id_fkey"
		}).onDelete("cascade"),
]);

export const projects = pgTable("projects", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	client_id: uuid(),
	title: text().notNull(),
	description: text(),
	status: text().default('discovery').notNull(),
	share_token: uuid().defaultRandom().notNull(),
	show_financials_on_share: boolean().default(false),
	location_address: text(),
	lat: numeric(),
	lng: numeric(),
	job_type: text(),
	is_personal: boolean().default(false).notNull(),
	budget: numeric(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	updated_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	foreignKey({
			columns: [table.client_id],
			foreignColumns: [clients.id],
			name: "projects_client_id_fkey"
		}).onDelete("set null"),
	unique("projects_share_token_key").on(table.share_token),
]);

export const clients = pgTable("clients", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	name: text().notNull(),
	email: text(),
	phone: text(),
	currency: text(),
	country: text(),
	company: text(),
	address: text(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
});

export const invoice_payments = pgTable("invoice_payments", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	invoice_id: uuid().notNull(),
	label: text().notNull(),
	amount: numeric().default('0').notNull(),
	due_date: date(),
	paid_date: date(),
	status: text().default('unpaid').notNull(),
}, (table) => [
	foreignKey({
			columns: [table.invoice_id],
			foreignColumns: [invoices.id],
			name: "invoice_payments_invoice_id_fkey"
		}).onDelete("cascade"),
]);

export const keep_alive = pgTable("keep_alive", {
	id: integer().default(1).primaryKey().notNull(),
	pinged_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	check("keep_alive_singleton", sql`id = 1`),
]);

export const project_files = pgTable("project_files", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	project_id: uuid().notNull(),
	invoice_id: uuid(),
	name: text().notNull(),
	storage_path: text().notNull(),
	// You can use { mode: "bigint" } if numbers are exceeding js number limitations
	size_bytes: bigint({ mode: "number" }),
	uploaded_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
	is_client_visible: boolean().default(true).notNull(),
}, (table) => [
	index("idx_project_files_project_id").using("btree", table.project_id.asc().nullsLast().op("uuid_ops")),
	index("project_files_invoice_id_idx").using("btree", table.invoice_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.invoice_id],
			foreignColumns: [invoices.id],
			name: "project_files_invoice_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "project_files_project_id_fkey"
		}).onDelete("cascade"),
]);

export const project_notes = pgTable("project_notes", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	project_id: uuid().notNull(),
	content: text().notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_project_notes_project_id").using("btree", table.project_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "project_notes_project_id_fkey"
		}).onDelete("cascade"),
]);

export const project_tasks = pgTable("project_tasks", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	project_id: uuid().notNull(),
	title: text().notNull(),
	cost: numeric(),
	due_date: date(),
	completed: boolean().default(false).notNull(),
	sort_order: integer().default(0).notNull(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("project_tasks_project_id_idx").using("btree", table.project_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "project_tasks_project_id_fkey"
		}).onDelete("cascade"),
]);

export const invoices = pgTable("invoices", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	user_id: uuid().notNull(),
	project_id: uuid(),
	client_id: uuid(),
	invoice_number: text().notNull(),
	currency: text().default('JMD').notNull(),
	subtotal: numeric().default('0').notNull(),
	gct_rate: numeric(),
	gct_amount: numeric(),
	total: numeric().default('0').notNull(),
	status: text().default('draft').notNull(),
	notes: text(),
	due_date: date(),
	discount_type: text().default('none').notNull(),
	discount_value: numeric().default('0').notNull(),
	additions_description: text(),
	additions_amount: numeric().default('0').notNull(),
	amount_paid: numeric().default('0').notNull(),
	source_meta: jsonb(),
	created_at: timestamp({ withTimezone: true, mode: 'string' }).defaultNow(),
}, (table) => [
	index("idx_invoices_project_id").using("btree", table.project_id.asc().nullsLast().op("uuid_ops")),
	index("idx_invoices_user_id").using("btree", table.user_id.asc().nullsLast().op("uuid_ops")),
	index("invoices_client_id_idx").using("btree", table.client_id.asc().nullsLast().op("uuid_ops")),
	uniqueIndex("invoices_user_number_uniq").using("btree", table.user_id.asc().nullsLast().op("text_ops"), table.invoice_number.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.client_id],
			foreignColumns: [clients.id],
			name: "invoices_client_id_fkey"
		}).onDelete("set null"),
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "invoices_project_id_fkey"
		}).onDelete("set null"),
]);

export const invoice_line_items = pgTable("invoice_line_items", {
	id: uuid().defaultRandom().primaryKey().notNull(),
	invoice_id: uuid().notNull(),
	description: text().notNull(),
	quantity: numeric().default('1').notNull(),
	unit_price: numeric().default('0').notNull(),
	amount: numeric().default('0').notNull(),
	sort_order: integer().default(0).notNull(),
	project_id: uuid(),
	section_title: text(),
}, (table) => [
	index("invoice_line_items_project_id_idx").using("btree", table.project_id.asc().nullsLast().op("uuid_ops")),
	foreignKey({
			columns: [table.invoice_id],
			foreignColumns: [invoices.id],
			name: "invoice_line_items_invoice_id_fkey"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.project_id],
			foreignColumns: [projects.id],
			name: "invoice_line_items_project_id_fkey"
		}).onDelete("set null"),
]);
