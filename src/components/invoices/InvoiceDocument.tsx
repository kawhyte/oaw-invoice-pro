import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { Invoice, InvoiceLineItem, BusinessSettings } from '@/types'

const S = StyleSheet.create({
  page: { padding: 48, fontSize: 10, color: '#111827', fontFamily: 'Helvetica' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 28 },
  logo: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#1d4ed8' },
  bizSub: { fontSize: 9, color: '#6b7280', marginTop: 2 },
  right: { alignItems: 'flex-end' },
  invLabel: { fontSize: 8, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 1 },
  invNum: { fontSize: 16, fontFamily: 'Helvetica-Bold', marginTop: 2 },
  invDate: { fontSize: 9, color: '#6b7280', marginTop: 3 },
  section: { flexDirection: 'row', marginBottom: 20, gap: 20 },
  col: { flex: 1 },
  fieldLabel: { fontSize: 8, color: '#6b7280', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
  fieldValue: { fontSize: 10 },
  divider: { borderBottomWidth: 1, borderBottomColor: '#e5e7eb', marginBottom: 14 },
  thRow: { flexDirection: 'row', backgroundColor: '#f3f4f6', padding: '6 6', marginBottom: 2 },
  tdRow: { flexDirection: 'row', padding: '8 6', borderBottomWidth: 1, borderBottomColor: '#f9fafb' },
  c1: { flex: 4, fontSize: 10 },
  c2: { flex: 1, fontSize: 10, textAlign: 'center' },
  c3: { flex: 2, fontSize: 10, textAlign: 'right' },
  c4: { flex: 2, fontSize: 10, textAlign: 'right' },
  th: { fontSize: 8, color: '#6b7280', fontFamily: 'Helvetica-Bold', textTransform: 'uppercase' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 5 },
  tLabel: { width: 130, fontSize: 10, color: '#374151', textAlign: 'right', marginRight: 14 },
  tValue: { width: 90, fontSize: 10, color: '#374151', textAlign: 'right' },
  grandLabel: { width: 130, fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right', marginRight: 14 },
  grandValue: { width: 90, fontSize: 12, fontFamily: 'Helvetica-Bold', textAlign: 'right' },
  owingLabel: { width: 130, fontSize: 11, color: '#d97706', textAlign: 'right', marginRight: 14 },
  owingValue: { width: 90, fontSize: 11, color: '#d97706', textAlign: 'right' },
  notes: { marginTop: 20, fontSize: 9, color: '#6b7280' },
  footer: { position: 'absolute', bottom: 36, left: 48, right: 48, borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 10 },
  footerText: { fontSize: 8, color: '#9ca3af', textAlign: 'center' },
  logoImg: { maxWidth: 140, maxHeight: 56, objectFit: 'contain' },
})

const STATUS_LABELS: Record<string, string> = { draft: 'DRAFT', sent: 'SENT', partial: 'PARTIALLY PAID', paid: 'PAID', overdue: 'OVERDUE' }
const fmt = (n: number, c: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const fmtShort = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

interface Props {
  invoice: Invoice & {
    projects: { title: string; job_type: string | null; location_address: string | null; clients: { name: string; email: string | null } | null } | null
    invoice_line_items: InvoiceLineItem[]
  }
  bizSettings?: BusinessSettings | null
}

export function InvoiceDocument({ invoice, bizSettings }: Props) {
  const client = invoice.projects?.clients
  const lineItems = [...(invoice.invoice_line_items ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const owing = invoice.total - invoice.amount_paid
  const discountAmount = invoice.discount_type === 'percentage'
    ? invoice.subtotal * (invoice.discount_value / 100)
    : invoice.discount_type === 'fixed' ? invoice.discount_value : 0

  return (
    <Document>
      <Page size="A4" style={S.page}>
        {/* Header */}
        <View style={S.row}>
          <View>
            {bizSettings?.logo_url
              ? <Image src={bizSettings.logo_url.split('?')[0]} style={S.logoImg} />
              : <Text style={S.logo}>{bizSettings?.business_name ?? 'OAW Invoice Pro'}</Text>
            }
            {bizSettings?.logo_url && bizSettings?.business_name && (
              <Text style={{ ...S.bizSub, marginTop: 4, fontFamily: 'Helvetica-Bold', fontSize: 11, color: '#111827' }}>
                {bizSettings.business_name}
              </Text>
            )}
            {bizSettings?.owner_name && <Text style={S.bizSub}>{bizSettings.owner_name}</Text>}
            {bizSettings?.phone && <Text style={S.bizSub}>{bizSettings.phone}</Text>}
            {bizSettings?.email && <Text style={S.bizSub}>{bizSettings.email}</Text>}
            {bizSettings?.address && <Text style={S.bizSub}>{bizSettings.address}</Text>}
          </View>
          <View style={S.right}>
            <Text style={S.invLabel}>Invoice</Text>
            <Text style={S.invNum}>{invoice.invoice_number}</Text>
            <Text style={S.invDate}>{fmtDate(invoice.created_at)}</Text>
            {invoice.due_date && <Text style={{ ...S.invDate, marginTop: 1 }}>Due: {fmtShort(invoice.due_date)}</Text>}
            <Text style={{ ...S.invDate, marginTop: 4, fontFamily: 'Helvetica-Bold', color: '#111827' }}>{STATUS_LABELS[invoice.status] ?? invoice.status.toUpperCase()}</Text>
          </View>
        </View>

        {/* Bill To + Job Info */}
        <View style={S.section}>
          <View style={S.col}>
            <Text style={S.fieldLabel}>Bill To</Text>
            <Text style={S.fieldValue}>{client?.name ?? '—'}</Text>
            {client?.email && <Text style={{ ...S.fieldValue, color: '#6b7280', marginTop: 2 }}>{client.email}</Text>}
          </View>
          <View style={S.col}>
            <Text style={S.fieldLabel}>Project</Text>
            <Text style={S.fieldValue}>{invoice.projects?.title ?? '—'}</Text>
            {invoice.projects?.job_type && <Text style={{ ...S.fieldValue, color: '#6b7280', marginTop: 2 }}>{invoice.projects.job_type}</Text>}
            {invoice.projects?.location_address && <Text style={{ ...S.fieldValue, color: '#6b7280', marginTop: 2 }}>{invoice.projects.location_address}</Text>}
          </View>
        </View>

        <View style={S.divider} />

        {/* Line Items */}
        <View style={S.thRow}>
          <Text style={{ ...S.c1, ...S.th }}>Description</Text>
          <Text style={{ ...S.c2, ...S.th }}>Qty</Text>
          <Text style={{ ...S.c3, ...S.th }}>Unit Price</Text>
          <Text style={{ ...S.c4, ...S.th }}>Amount</Text>
        </View>
        {lineItems.map((item, i) => (
          <View key={i} style={S.tdRow}>
            <Text style={S.c1}>{item.description}</Text>
            <Text style={S.c2}>{item.quantity}</Text>
            <Text style={S.c3}>{fmt(item.unit_price, invoice.currency)}</Text>
            <Text style={S.c4}>{fmt(item.amount, invoice.currency)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={{ marginTop: 14 }}>
          <View style={S.totalRow}><Text style={S.tLabel}>Subtotal</Text><Text style={S.tValue}>{fmt(invoice.subtotal, invoice.currency)}</Text></View>
          {discountAmount > 0 && (
            <View style={S.totalRow}>
              <Text style={S.tLabel}>Discount{invoice.discount_type === 'percentage' ? ` (${invoice.discount_value}%)` : ''}</Text>
              <Text style={S.tValue}>- {fmt(discountAmount, invoice.currency)}</Text>
            </View>
          )}
          {invoice.gct_rate > 0 && <View style={S.totalRow}><Text style={S.tLabel}>GCT (15%)</Text><Text style={S.tValue}>{fmt(invoice.gct_amount, invoice.currency)}</Text></View>}
          {invoice.additions_amount > 0 && (
            <View style={S.totalRow}>
              <Text style={S.tLabel}>{invoice.additions_description || 'Additions'}</Text>
              <Text style={S.tValue}>+ {fmt(invoice.additions_amount, invoice.currency)}</Text>
            </View>
          )}
          <View style={{ ...S.totalRow, marginTop: 8 }}><Text style={S.grandLabel}>Total</Text><Text style={S.grandValue}>{fmt(invoice.total, invoice.currency)}</Text></View>
          {invoice.amount_paid > 0 && <View style={S.totalRow}><Text style={{ ...S.tLabel, color: '#16a34a' }}>Paid</Text><Text style={{ ...S.tValue, color: '#16a34a' }}>{fmt(invoice.amount_paid, invoice.currency)}</Text></View>}
          {owing > 0 && <View style={S.totalRow}><Text style={S.owingLabel}>Amount Owing</Text><Text style={S.owingValue}>{fmt(owing, invoice.currency)}</Text></View>}
        </View>

        {invoice.notes && <Text style={S.notes}>Notes: {invoice.notes}</Text>}

        <View style={S.footer}><Text style={S.footerText}>Generated by OAW Invoice Pro</Text></View>
      </Page>
    </Document>
  )
}
