import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'
import type { Invoice, InvoicePayment } from '@/types'

const S = StyleSheet.create({
  page: { padding: 48, fontSize: 10, color: '#111827', fontFamily: 'Helvetica' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  logo: { fontSize: 20, fontFamily: 'Helvetica-Bold', color: '#1d4ed8' },
  right: { alignItems: 'flex-end' },
  invLabel: { fontSize: 9, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 },
  invNum: { fontSize: 18, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  invDate: { fontSize: 9, color: '#6b7280', marginTop: 4 },
  section: { flexDirection: 'row', marginBottom: 24, gap: 24 },
  col: { flex: 1 },
  fieldLabel: { fontSize: 8, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  fieldValue: { fontSize: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginBottom: 16 },
  thRow: { flexDirection: 'row', backgroundColor: '#f3f4f6', padding: '7 6', marginBottom: 2 },
  tdRow: { flexDirection: 'row', padding: '9 6', borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  c1: { flex: 3, fontSize: 10 },
  c2: { flex: 2, fontSize: 10, textAlign: 'right' },
  c3: { flex: 2, fontSize: 10, textAlign: 'right' },
  c4: { flex: 2, fontSize: 10, textAlign: 'right' },
  th: { fontSize: 8, color: '#6b7280', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 6 },
  tLabel: { width: 120, fontSize: 10, color: '#374151', textAlign: 'right', marginRight: 16 },
  tValue: { width: 80, fontSize: 10, color: '#374151', textAlign: 'right' },
  grandLabel: { width: 120, fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginRight: 16 },
  grandValue: { width: 80, fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  notes: { marginTop: 24, fontSize: 9, color: '#6b7280' },
  footer: { position: 'absolute', bottom: 36, left: 48, right: 48, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 10 },
  footerText: { fontSize: 8, color: '#9ca3af', textAlign: 'center' },
})

const STATUS_LABELS: Record<string, string> = { unpaid: 'UNPAID', partial: 'PARTIALLY PAID', paid: 'PAID', overdue: 'OVERDUE' }

interface Props {
  invoice: Invoice & {
    projects: { title: string; clients: { name: string; email: string | null } | null } | null
    invoice_payments: InvoicePayment[]
  }
}

const fmt = (n: number, c: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const fmtShort = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

export function InvoiceDocument({ invoice }: Props) {
  const client = invoice.projects?.clients
  const payments = invoice.invoice_payments ?? []

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.row}>
          <Text style={S.logo}>OAW Invoice Pro</Text>
          <View style={S.right}>
            <Text style={S.invLabel}>Invoice</Text>
            <Text style={S.invNum}>{invoice.invoice_number}</Text>
            <Text style={S.invDate}>{fmtDate(invoice.created_at)}</Text>
          </View>
        </View>

        {/* Bill To */}
        <View style={S.section}>
          <View style={S.col}>
            <Text style={S.fieldLabel}>Bill To</Text>
            <Text style={S.fieldValue}>{client?.name ?? '—'}</Text>
            {client?.email && <Text style={{ ...S.fieldValue, color: '#6b7280', marginTop: 2 }}>{client.email}</Text>}
          </View>
          <View style={S.col}>
            <Text style={S.fieldLabel}>Project</Text>
            <Text style={S.fieldValue}>{invoice.projects?.title ?? '—'}</Text>
          </View>
          <View style={{ ...S.col, alignItems: 'flex-end' }}>
            <Text style={S.fieldLabel}>Status</Text>
            <Text style={S.fieldValue}>{STATUS_LABELS[invoice.status] ?? invoice.status.toUpperCase()}</Text>
          </View>
        </View>

        <View style={S.divider} />

        {/* Table */}
        <View style={S.thRow}>
          <Text style={{ ...S.c1, ...S.th }}>Description</Text>
          <Text style={{ ...S.c2, ...S.th }}>Amount</Text>
          <Text style={{ ...S.c3, ...S.th }}>Due Date</Text>
          <Text style={{ ...S.c4, ...S.th }}>Status</Text>
        </View>
        {payments.map((p, i) => (
          <View key={i} style={S.tdRow}>
            <Text style={S.c1}>{p.label}</Text>
            <Text style={S.c2}>{fmt(p.amount, invoice.currency)}</Text>
            <Text style={S.c3}>{p.due_date ? fmtShort(p.due_date) : '—'}</Text>
            <Text style={S.c4}>{p.status === 'paid' ? '✓ Paid' : 'Pending'}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={{ marginTop: 16 }}>
          <View style={S.totalRow}>
            <Text style={S.tLabel}>Subtotal</Text>
            <Text style={S.tValue}>{fmt(invoice.subtotal, invoice.currency)}</Text>
          </View>
          {invoice.gct_rate > 0 && (
            <View style={S.totalRow}>
              <Text style={S.tLabel}>GCT (15%)</Text>
              <Text style={S.tValue}>{fmt(invoice.gct_amount, invoice.currency)}</Text>
            </View>
          )}
          <View style={{ ...S.totalRow, marginTop: 8 }}>
            <Text style={S.grandLabel}>Total</Text>
            <Text style={S.grandValue}>{fmt(invoice.total, invoice.currency)}</Text>
          </View>
        </View>

        {invoice.notes && (
          <Text style={S.notes}>Notes: {invoice.notes}</Text>
        )}

        <View style={S.footer}>
          <Text style={S.footerText}>Generated by OAW Invoice Pro</Text>
        </View>
      </Page>
    </Document>
  )
}
