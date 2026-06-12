export type Currency = 'USD' | 'JMD'
export type ProjectStatus = 'discovery' | 'in_progress' | 'review' | 'complete'
export type InvoiceStatus = 'unpaid' | 'partial' | 'paid' | 'overdue'
export type PaymentStatus = 'pending' | 'paid'

export interface Client {
  id: string
  user_id: string
  name: string
  email: string | null
  phone: string | null
  currency: Currency
  country: string
  created_at: string
}

export interface Project {
  id: string
  user_id: string
  client_id: string
  title: string
  description: string | null
  status: ProjectStatus
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

export interface Invoice {
  id: string
  user_id: string
  project_id: string
  invoice_number: string
  currency: Currency
  subtotal: number
  gct_rate: number
  gct_amount: number
  total: number
  status: InvoiceStatus
  notes: string | null
  created_at: string
  projects?: Project
  invoice_payments?: InvoicePayment[]
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
