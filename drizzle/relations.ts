import { relations } from "drizzle-orm/relations";
import { invoices, project_deliverables, projects, clients, invoice_payments, project_files, project_notes, project_tasks, invoice_line_items } from "./schema";

export const project_deliverablesRelations = relations(project_deliverables, ({one}) => ({
	invoice: one(invoices, {
		fields: [project_deliverables.linked_invoice_id],
		references: [invoices.id]
	}),
	project: one(projects, {
		fields: [project_deliverables.project_id],
		references: [projects.id]
	}),
}));

export const invoicesRelations = relations(invoices, ({one, many}) => ({
	project_deliverables: many(project_deliverables),
	invoice_payments: many(invoice_payments),
	project_files: many(project_files),
	client: one(clients, {
		fields: [invoices.client_id],
		references: [clients.id]
	}),
	project: one(projects, {
		fields: [invoices.project_id],
		references: [projects.id]
	}),
	invoice_line_items: many(invoice_line_items),
}));

export const projectsRelations = relations(projects, ({one, many}) => ({
	project_deliverables: many(project_deliverables),
	client: one(clients, {
		fields: [projects.client_id],
		references: [clients.id]
	}),
	project_files: many(project_files),
	project_notes: many(project_notes),
	project_tasks: many(project_tasks),
	invoices: many(invoices),
	invoice_line_items: many(invoice_line_items),
}));

export const clientsRelations = relations(clients, ({many}) => ({
	projects: many(projects),
	invoices: many(invoices),
}));

export const invoice_paymentsRelations = relations(invoice_payments, ({one}) => ({
	invoice: one(invoices, {
		fields: [invoice_payments.invoice_id],
		references: [invoices.id]
	}),
}));

export const project_filesRelations = relations(project_files, ({one}) => ({
	invoice: one(invoices, {
		fields: [project_files.invoice_id],
		references: [invoices.id]
	}),
	project: one(projects, {
		fields: [project_files.project_id],
		references: [projects.id]
	}),
}));

export const project_notesRelations = relations(project_notes, ({one}) => ({
	project: one(projects, {
		fields: [project_notes.project_id],
		references: [projects.id]
	}),
}));

export const project_tasksRelations = relations(project_tasks, ({one}) => ({
	project: one(projects, {
		fields: [project_tasks.project_id],
		references: [projects.id]
	}),
}));

export const invoice_line_itemsRelations = relations(invoice_line_items, ({one}) => ({
	invoice: one(invoices, {
		fields: [invoice_line_items.invoice_id],
		references: [invoices.id]
	}),
	project: one(projects, {
		fields: [invoice_line_items.project_id],
		references: [projects.id]
	}),
}));