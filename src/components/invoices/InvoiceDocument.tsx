import path from 'path'
import { Document, Page, Text, View, StyleSheet, Image, Font } from '@react-pdf/renderer'
import { discountAmountFor } from '@/lib/invoiceCalc'
import type { Invoice, InvoiceLineItem, BusinessSettings } from '@/types'

// ── Brand fonts (server-only; InvoiceDocument renders in the nodejs PDF route) ──
const FONT_DIR = path.join(process.cwd(), 'public', 'fonts')
const SERIF = 'LibreCaslon'
const SANS = 'Hanken'
const MONO = 'JetBrainsMono'

Font.register({
  family: SERIF,
  fonts: [
    { src: path.join(FONT_DIR, 'LibreCaslonText-Regular.ttf') },
    { src: path.join(FONT_DIR, 'LibreCaslonText-Bold.ttf'), fontWeight: 'bold' },
    { src: path.join(FONT_DIR, 'LibreCaslonText-Italic.ttf'), fontStyle: 'italic' },
  ],
})
Font.register({
  family: SANS,
  fonts: [
    { src: path.join(FONT_DIR, 'HankenGrotesk-Regular.ttf') },
    { src: path.join(FONT_DIR, 'HankenGrotesk-SemiBold.ttf'), fontWeight: 600 },
  ],
})
Font.register({
  family: MONO,
  fonts: [
    { src: path.join(FONT_DIR, 'JetBrainsMono-Regular.ttf') },
    { src: path.join(FONT_DIR, 'JetBrainsMono-Medium.ttf'), fontWeight: 500 },
  ],
})
// Keep long descriptions from being hyphenated mid-word.
Font.registerHyphenationCallback(word => [word])

// ── Atelier palette ──
const DARK = '#1a1c1e'        // charcoal — header band
const BRONZE = '#715a3e'      // brand accent
const BRONZE_TINT = '#f5ede4' // soft bronze — amount-owing band
const LIME = '#f8f9fa'        // limestone — alt rows / section headers
const W = '#ffffff'
const MUT = '#6b7280'
const LINE = '#e5e7eb'

const S = StyleSheet.create({
  page: { fontSize: 10, color: '#374151', fontFamily: SANS },

  // ── Header ──
  header: {
    backgroundColor: DARK, borderBottomWidth: 3, borderBottomColor: BRONZE,
    paddingTop: 30, paddingBottom: 26, paddingLeft: 48, paddingRight: 48,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  hTitle: { fontSize: 34, fontFamily: SERIF, fontWeight: 'bold', color: W, letterSpacing: 2 },
  hRight: { alignItems: 'flex-end' },
  hLogo: { maxWidth: 110, maxHeight: 44, objectFit: 'contain', marginBottom: 4 },
  hBiz: { fontSize: 11, fontFamily: SANS, fontWeight: 600, color: W, marginBottom: 2 },
  hSub: { fontSize: 8, color: W, opacity: 0.65, marginTop: 2 },

  // ── Info row (bill-to / total-due) ──
  infoRow: {
    paddingTop: 22, paddingBottom: 18, paddingLeft: 48, paddingRight: 48,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  billLabel: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  clientName: { fontSize: 14, fontFamily: SERIF, fontWeight: 'bold', color: DARK, marginBottom: 2 },
  clientSub: { fontSize: 9, color: MUT, marginTop: 2 },

  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 4 },
  mLabel: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, width: 88, textAlign: 'right', marginRight: 12 },
  mValue: { fontSize: 9, fontFamily: MONO, fontWeight: 500, color: DARK, width: 115, textAlign: 'right' },

  // ── Divider ──
  divider: { marginLeft: 48, marginRight: 48, borderBottomWidth: 1, borderBottomColor: LINE, marginBottom: 16 },

  // ── Line items table ──
  tableWrap: { paddingLeft: 48, paddingRight: 48 },
  thRow: {
    flexDirection: 'row', backgroundColor: BRONZE,
    paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10,
  },
  tdRow: {
    flexDirection: 'row',
    paddingTop: 9, paddingBottom: 9, paddingLeft: 10, paddingRight: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  tdRowAlt: {
    flexDirection: 'row', backgroundColor: LIME,
    paddingTop: 9, paddingBottom: 9, paddingLeft: 10, paddingRight: 10,
    borderBottomWidth: 1, borderBottomColor: '#f0f0f0',
  },
  c1: { flex: 4 },
  cPrice: { flex: 2, textAlign: 'right' },
  cQty: { flex: 1, textAlign: 'center' },
  cTotal: { flex: 2, textAlign: 'right' },
  th: { fontSize: 8, color: W, fontFamily: SANS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { fontSize: 9, color: '#374151' },
  tdNum: { fontSize: 9, color: '#374151', fontFamily: MONO },

  // ── Combined-invoice project sections ──
  sectionRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: LIME, paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10,
    borderBottomWidth: 1, borderBottomColor: '#e0e0e3',
  },
  sectionTitle: { fontSize: 9, fontFamily: SERIF, fontWeight: 'bold', color: BRONZE, textTransform: 'uppercase', letterSpacing: 0.5 },
  subtotalRow: {
    flexDirection: 'row', justifyContent: 'flex-end',
    paddingTop: 5, paddingBottom: 7, paddingLeft: 10, paddingRight: 10,
  },
  subtotalLabel: { fontSize: 8, color: MUT, marginRight: 14 },
  subtotalValue: { fontSize: 9, fontFamily: MONO, fontWeight: 500, color: DARK },

  // ── Totals ──
  totalsWrap: { paddingLeft: 48, paddingRight: 48, marginTop: 4 },
  tLine: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 3, paddingBottom: 3 },
  tLabel: { width: 130, fontSize: 9, color: MUT, textAlign: 'right', marginRight: 14 },
  tValue: { width: 110, fontSize: 9, fontFamily: MONO, color: '#374151', textAlign: 'right' },

  grandBand: {
    marginTop: 8, marginLeft: 48, marginRight: 48, backgroundColor: BRONZE_TINT,
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: 11, paddingBottom: 11, paddingLeft: 14, paddingRight: 14,
  },
  grandLabel: { fontSize: 11, fontFamily: SERIF, fontWeight: 'bold', color: BRONZE },
  grandValue: { fontSize: 11, fontFamily: MONO, fontWeight: 500, color: BRONZE },

  // ── Thank you / notes ──
  thankWrap: { paddingLeft: 48, paddingRight: 48, marginTop: 28 },
  thankText: { fontSize: 14, fontFamily: SERIF, fontWeight: 'bold', color: DARK, marginBottom: 4 },
  notesLabel: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 3 },
  notesText: { fontSize: 9, color: MUT },

  // ── Footer ──
  footer: { position: 'absolute', bottom: 28, left: 48, right: 48, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8 },
  footerText: { fontSize: 7.5, color: '#9ca3af', textAlign: 'center' },
})

const STATUS_LABELS: Record<string, string> = { draft: 'DRAFT', sent: 'SENT', partial: 'PARTIALLY PAID', paid: 'PAID', overdue: 'OVERDUE' }
const STATUS_COLORS: Record<string, string> = { draft: MUT, sent: '#3b82f6', partial: BRONZE, paid: '#16a34a', overdue: '#dc2626' }

const fmt = (n: number, c: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n)
const fmtDate = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
const fmtShort = (d: string) => new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

interface Props {
  invoice: Invoice & {
    projects: { title: string; job_type: string | null; location_address: string | null; clients: { name: string; email: string | null } | null } | null
    clients?: { name: string; email: string | null } | null
    invoice_line_items: InvoiceLineItem[]
  }
  bizSettings?: BusinessSettings | null
}

export function InvoiceDocument({ invoice, bizSettings }: Props) {
  // Combined invoices link the client directly; single-project ones via the project.
  const client = invoice.clients ?? invoice.projects?.clients
  const lineItems = [...(invoice.invoice_line_items ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const isCombined = lineItems.some(li => li.project_id)
  // Build per-project sections (preserving first-seen order) for combined invoices.
  const sections: { title: string; items: InvoiceLineItem[]; subtotal: number }[] = []
  if (isCombined) {
    for (const li of lineItems) {
      const title = li.section_title || 'Project'
      let sec = sections.find(s => s.title === title)
      if (!sec) { sec = { title, items: [], subtotal: 0 }; sections.push(sec) }
      sec.items.push(li)
      sec.subtotal += li.amount
    }
  }
  const owing = invoice.total - invoice.amount_paid
  const discountAmount = discountAmountFor(invoice.subtotal, invoice.discount_type, invoice.discount_value)
  const statusColor = STATUS_COLORS[invoice.status] ?? MUT

  const contactLines = [bizSettings?.owner_name, bizSettings?.phone, bizSettings?.email, bizSettings?.address].filter(Boolean) as string[]

  return (
    <Document>
      <Page size="A4" style={S.page}>

        {/* ── Header ── */}
        <View style={S.header}>
          <Text style={S.hTitle}>INVOICE</Text>
          <View style={S.hRight}>
            {bizSettings?.logo_url
              ? <Image src={bizSettings.logo_url.split('?')[0]} style={S.hLogo} />
              : <Text style={S.hBiz}>{bizSettings?.business_name ?? 'OW Studio'}</Text>
            }
            {bizSettings?.logo_url && bizSettings?.business_name && (
              <Text style={S.hBiz}>{bizSettings.business_name}</Text>
            )}
            {contactLines.map((line, i) => <Text key={i} style={S.hSub}>{line}</Text>)}
          </View>
        </View>

        {/* ── Info Row ── */}
        <View style={S.infoRow}>
          <View>
            <Text style={S.billLabel}>Invoice To</Text>
            <Text style={S.clientName}>{client?.name ?? '—'}</Text>
            {client?.email && <Text style={S.clientSub}>{client.email}</Text>}
            {isCombined ? (
              <Text style={S.clientSub}>Combined — {sections.length} projects</Text>
            ) : (
              <>
                {invoice.projects?.location_address && <Text style={S.clientSub}>{invoice.projects.location_address}</Text>}
                {invoice.projects?.job_type && <Text style={S.clientSub}>{invoice.projects.job_type}</Text>}
              </>
            )}
          </View>
          <View>
            <View style={S.metaRow}>
              <Text style={S.mLabel}>Invoice No</Text>
              <Text style={S.mValue}>{invoice.invoice_number}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.mLabel}>Invoice Date</Text>
              <Text style={S.mValue}>{fmtDate(invoice.created_at)}</Text>
            </View>
            {invoice.due_date && (
              <View style={S.metaRow}>
                <Text style={S.mLabel}>Due Date</Text>
                <Text style={S.mValue}>{fmtShort(invoice.due_date)}</Text>
              </View>
            )}
            <View style={{ ...S.metaRow, marginTop: 6 }}>
              <Text style={{ ...S.mValue, color: statusColor }}>
                {STATUS_LABELS[invoice.status] ?? invoice.status.toUpperCase()}
              </Text>
            </View>
          </View>
        </View>

        <View style={S.divider} />

        {/* ── Line Items ── */}
        <View style={S.tableWrap}>
          <View style={S.thRow}>
            <Text style={{ ...S.c1, ...S.th }}>Item Description</Text>
            <Text style={{ ...S.cPrice, ...S.th }}>Price</Text>
            <Text style={{ ...S.cQty, ...S.th }}>Qty</Text>
            <Text style={{ ...S.cTotal, ...S.th }}>Total</Text>
          </View>
          {isCombined
            ? sections.map((sec, si) => (
                <View key={si} wrap={false}>
                  <View style={S.sectionRow}>
                    <Text style={S.sectionTitle}>{sec.title}</Text>
                  </View>
                  {sec.items.map((item, i) => (
                    <View key={item.id} style={i % 2 === 0 ? S.tdRow : S.tdRowAlt}>
                      <Text style={{ ...S.c1, ...S.td }}>{item.description}</Text>
                      <Text style={{ ...S.cPrice, ...S.tdNum }}>{fmt(item.unit_price, invoice.currency)}</Text>
                      <Text style={{ ...S.cQty, ...S.tdNum }}>{item.quantity}</Text>
                      <Text style={{ ...S.cTotal, ...S.tdNum }}>{fmt(item.amount, invoice.currency)}</Text>
                    </View>
                  ))}
                  <View style={S.subtotalRow}>
                    <Text style={S.subtotalLabel}>{sec.title} subtotal</Text>
                    <Text style={S.subtotalValue}>{fmt(sec.subtotal, invoice.currency)}</Text>
                  </View>
                </View>
              ))
            : lineItems.map((item, i) => (
                <View key={i} style={i % 2 === 0 ? S.tdRow : S.tdRowAlt}>
                  <Text style={{ ...S.c1, ...S.td }}>{item.description}</Text>
                  <Text style={{ ...S.cPrice, ...S.tdNum }}>{fmt(item.unit_price, invoice.currency)}</Text>
                  <Text style={{ ...S.cQty, ...S.tdNum }}>{item.quantity}</Text>
                  <Text style={{ ...S.cTotal, ...S.tdNum }}>{fmt(item.amount, invoice.currency)}</Text>
                </View>
              ))}
        </View>

        {/* ── Totals ── */}
        <View style={S.totalsWrap}>
          <View style={S.tLine}>
            <Text style={S.tLabel}>Sub Total</Text>
            <Text style={S.tValue}>{fmt(invoice.subtotal, invoice.currency)}</Text>
          </View>
          {discountAmount > 0 && (
            <View style={S.tLine}>
              <Text style={S.tLabel}>Discount{invoice.discount_type === 'percentage' ? ` (${invoice.discount_value}%)` : ''}</Text>
              <Text style={S.tValue}>- {fmt(discountAmount, invoice.currency)}</Text>
            </View>
          )}
          {invoice.gct_rate > 0 && (
            <View style={S.tLine}>
              <Text style={S.tLabel}>GCT (15%)</Text>
              <Text style={S.tValue}>{fmt(invoice.gct_amount, invoice.currency)}</Text>
            </View>
          )}
          {invoice.additions_amount > 0 && (
            <View style={S.tLine}>
              <Text style={S.tLabel}>{invoice.additions_description || 'Additions'}</Text>
              <Text style={S.tValue}>+ {fmt(invoice.additions_amount, invoice.currency)}</Text>
            </View>
          )}
          <View style={S.tLine}>
            <Text style={S.tLabel}>Total</Text>
            <Text style={S.tValue}>{fmt(invoice.total, invoice.currency)}</Text>
          </View>
          {invoice.amount_paid > 0 && (
            <View style={S.tLine}>
              <Text style={{ ...S.tLabel, color: '#16a34a' }}>Paid</Text>
              <Text style={{ ...S.tValue, color: '#16a34a' }}>{fmt(invoice.amount_paid, invoice.currency)}</Text>
            </View>
          )}
        </View>

        {/* Amount Owing band — only shown when balance remains */}
        {owing > 0 && (
          <View style={S.grandBand}>
            <Text style={S.grandLabel}>Amount Owing</Text>
            <Text style={S.grandValue}>{fmt(owing, invoice.currency)}</Text>
          </View>
        )}

        {/* ── Thank You + Notes ── */}
        <View style={S.thankWrap}>
          <Text style={S.thankText}>Thank you for your business!</Text>
          {invoice.notes && (
            <View>
              <Text style={S.notesLabel}>Notes</Text>
              <Text style={S.notesText}>{invoice.notes}</Text>
            </View>
          )}
        </View>

        {/* ── Footer ── */}
        <View style={S.footer}>
          <Text style={S.footerText}>Generated by OW Studio</Text>
        </View>

      </Page>
    </Document>
  )
}
