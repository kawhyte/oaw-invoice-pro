export type Currency = "USD" | "JMD";
export type ProjectStatus = "discovery" | "in_progress" | "review" | "complete";
export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue";
export type PaymentStatus = "pending" | "paid";
export type DiscountType = "none" | "percentage" | "fixed";

export const JOB_TYPES = [
	"Working Drawings",
	"Measured Survey & Drawings",
	"Designing",
	"Renovation Drawings",
	"Electrical Drawings",
	"Plumbing Drawings",
	"Fire Drawings",
	"Other",
] as const;

// Relative difficulty of each job type (higher = harder = more of his bandwidth).
// Keyed by the JOB_TYPES label so it never touches stored job_type values.
export const JOB_TYPE_WEIGHTS: Record<string, number> = {
	"Working Drawings": 10,
	"Measured Survey & Drawings": 8,
	"Designing": 7,
	"Renovation Drawings": 6,
	"Electrical Drawings": 5,
	"Plumbing Drawings": 4,
	"Fire Drawings": 3,
	"Other": 2,
	// Legacy job-type values still stored on older projects, mapped onto the
	// current scale: Construction→Working Drawings, Design→Designing, Painting→Other.
	"Construction": 10,
	"Design": 7,
	"Painting": 2,
};

// How much of a project's full difficulty counts toward "current load" by phase.
// A project just being scoped or wrapping up consumes less active bandwidth.
export const STATUS_WEIGHT_FACTOR: Record<ProjectStatus, number> = {
	discovery: 0.5,
	in_progress: 1,
	review: 0.5,
	complete: 0,
};

export interface Client {
	id: string;
	user_id: string;
	name: string;
	email: string | null;
	phone: string | null;
	company: string | null;
	address: string | null;
	currency: Currency | null;
	country: string | null;
	created_at: string;
}

export interface Project {
	id: string;
	user_id: string;
	/** NULL for personal (clientless) projects. */
	client_id: string | null;
	title: string;
	description: string | null;
	status: ProjectStatus;
	job_type: string | null;
	/** True for the owner's own projects (not billed, no client). */
	is_personal: boolean;
	/** Optional total budget — used by the personal-project budget tracker. */
	budget: number | null;
	share_token: string;
	show_financials_on_share: boolean;
	location_address: string | null;
	lat: number | null;
	lng: number | null;
	created_at: string;
	updated_at: string;
	clients?: Client;
}

export interface ProjectTask {
	id: string;
	project_id: string;
	title: string;
	cost: number | null;
	due_date: string | null;
	completed: boolean;
	sort_order: number;
	created_at: string;
}

export interface ProjectNote {
	id: string;
	project_id: string;
	content: string;
	created_at: string;
}

export interface ProjectFile {
	id: string;
	project_id: string;
	invoice_id?: string | null;
	name: string;
	storage_path: string;
	size_bytes: number | null;
	is_client_visible: boolean;
	uploaded_at: string;
}

export interface ProjectDeliverable {
	id: string;
	project_id: string;
	name: string;
	storage_path: string;
	preview_paths: string[];
	zoom_paths: string[];
	page_count: number | null;
	size_bytes: number | null;
	linked_invoice_id: string | null;
	manual_unlock: boolean;
	created_at: string;
}

export interface InvoiceLineItem {
	id: string;
	invoice_id: string;
	description: string;
	quantity: number;
	unit_price: number;
	amount: number;
	sort_order: number;
	/** Set on combined invoices to group items under a project section. */
	project_id: string | null;
	/** Snapshot of the project title at billing time (for combined invoices). */
	section_title: string | null;
}

export interface Invoice {
	id: string;
	user_id: string;
	/** NULL for combined (multi-project) invoices. */
	project_id: string | null;
	/** Direct client link; populated for new invoices, NULL for legacy single-project ones. */
	client_id: string | null;
	invoice_number: string;
	currency: Currency;
	subtotal: number;
	discount_type: DiscountType;
	discount_value: number;
	gct_rate: number;
	gct_amount: number;
	additions_description: string | null;
	additions_amount: number;
	total: number;
	amount_paid: number;
	due_date: string | null;
	status: InvoiceStatus;
	notes: string | null;
	created_at: string;
	/** For combined invoices: { [project_id]: original draft invoice_number } — used to restore numbers on Separate. */
	source_meta?: Record<string, string> | null;
	projects?: Project;
	clients?: Client;
	invoice_line_items?: InvoiceLineItem[];
}

export interface InvoicePayment {
	id: string;
	invoice_id: string;
	label: string;
	amount: number;
	due_date: string | null;
	paid_date: string | null;
	status: PaymentStatus;
}

export interface BusinessSettings {
	id: string;
	user_id: string;
	business_name: string | null;
	owner_name: string | null;
	email: string | null;
	phone: string | null;
	address: string | null;
	logo_url: string | null;
	/** Max workload points before the owner is at full capacity. NULL = use default. */
	max_workload: number | null;
	updated_at: string;
}
