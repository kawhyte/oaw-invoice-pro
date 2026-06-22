export type Currency = 'USD' | 'JMD'
export type ProjectStatus = 'discovery' | 'in_progress' | 'review' | 'complete'
export type InvoiceStatus = 'draft' | 'sent' | 'partial' | 'paid' | 'overdue'
export type PaymentStatus = 'pending' | 'paid'
export type DiscountType = 'none' | 'percentage' | 'fixed'

export const JOB_TYPES = [
  'Construction', 'Renovation', 'Plumbing', 'Electrical',
  'Landscaping', 'Painting', 'Roofing', 'General Contracting',
  'Design', 'Working Drawings', 'Measured Survey', 'Presentation',
  'Other',
] as const

export interface Client {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  company: string | null
  address: string | null
  currency: Currency | null
  country: string | null
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  client_id: string
  title: string
  description: string | null
  status: ProjectStatus
  job_type: string | null
  share_token: string
  show_financials_on_share: boolean
  location_address: string | null
  lat: number | null
  lng: number | null
  created_at: string
  updated_at: string
  clients?: Client
}

export interface ProjectNote {
  id: string
  project_id: string
  content: string
  created_at: string
}

export interface ProjectFile {
  id: string
  project_id: string
  name: string
  storage_path: string
  size_bytes: number | null
  uploaded_at: string
}

export interface InvoiceLineItem {
  id: string
  invoice_id: string
  description: string
  quantity: number
  unit_price: number
  amount: number
  sort_order: number
  /** Set on combined invoices to group items under a project section. */
  project_id: string | null
  /** Snapshot of the project title at billing time (for combined invoices). */
  section_title: string | null
}

export interface Invoice {
  id: string
  user_id: string
  /** NULL for combined (multi-project) invoices. */
  project_id: string | null
  /** Direct client link; populated for new invoices, NULL for legacy single-project ones. */
  client_id: string | null
  invoice_number: string
  currency: Currency
  subtotal: number
  discount_type: DiscountType
  discount_value: number
  gct_rate: number
  gct_amount: number
  additions_description: string | null
  additions_amount: number
  total: number
  amount_paid: number
  due_date: string | null
  status: InvoiceStatus
  notes: string | null
  created_at: string
  /** For combined invoices: { [project_id]: original draft invoice_number } — used to restore numbers on Separate. */
  source_meta?: Record<string, string> | null
  projects?: Project
  clients?: Client
  invoice_line_items?: InvoiceLineItem[]
}

export interface InvoicePayment {
  id: string
  invoice_id: string
  label: string
  amount: number
  due_date: string | null
  paid_date: string | null
  status: PaymentStatus
}

export interface BusinessSettings {
  id: string
  user_id: string
  business_name: string | null
  owner_name: string | null
  email: string | null
  phone: string | null
  address: string | null
  logo_url: string | null
  updated_at: string
}
