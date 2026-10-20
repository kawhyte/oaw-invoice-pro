import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import type { BusinessSettings, PaymentMethod } from '@/types'

import { SERIF, SANS, MONO, DARK, BRONZE, BRONZE_TINT, LIME, W, MUT, LINE } from '@/components/pdf/brand'
import { PAYMENT_METHOD_LABELS } from '@/lib/paymentMethods'

// Payment receipt PDF — same Atelier look as the invoice (header band, bronze
// accents), one page: who paid, how much, when and how, and where the
// invoice stands after this payment.

const S = StyleSheet.create({
  page: { fontSize: 10, color: '#374151', fontFamily: SANS },

  header: {
    backgroundColor: DARK, borderBottomWidth: 3, borderBottomColor: BRONZE,
    paddingTop: 30, paddingBottom: 26, paddingLeft: 48, paddingRight: 48,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  hTitle: { fontSize: 34, fontFamily: SERIF, fontWeight: 'bold', color: W, letterSpacing: 2 },
  hNumber: { fontSize: 10, fontFamily: MONO, color: W, opacity: 0.75, marginTop: 6 },
  hRight: { alignItems: 'flex-end' },
  hLogo: { maxWidth: 110, maxHeight: 44, objectFit: 'contain', marginBottom: 4 },
  hBiz: { fontSize: 11, fontFamily: SANS, fontWeight: 600, color: W, marginBottom: 2 },
  hSub: { fontSize: 8, color: W, opacity: 0.65, marginTop: 2 },

  infoRow: {
    paddingTop: 22, paddingBottom: 18, paddingLeft: 48, paddingRight: 48,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  label: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  clientName: { fontSize: 14, fontFamily: SERIF, fontWeight: 'bold', color: DARK, marginBottom: 2 },
  clientSub: { fontSize: 9, color: MUT, marginTop: 2 },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 4 },
  mLabel: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, width: 88, textAlign: 'right', marginRight: 12 },
  mValue: { fontSize: 9, fontFamily: MONO, fontWeight: 500, color: DARK, width: 115, textAlign: 'right' },

  divider: { marginLeft: 48, marginRight: 48, borderBottomWidth: 1, borderBottomColor: LINE, marginBottom: 18 },

  // The amount received — the point of the document.
  amountBand: {
    marginLeft: 48, marginRight: 48, backgroundColor: BRONZE_TINT,
    paddingTop: 18, paddingBottom: 18, paddingLeft: 18, paddingRight: 18,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  },
  amountLabel: { fontSize: 12, fontFamily: SERIF, fontWeight: 'bold', color: BRONZE },
  amountValue: { fontSize: 20, fontFamily: MONO, fontWeight: 500, color: BRONZE },
  detailRow: { marginLeft: 48, marginRight: 48, flexDirection: 'row', backgroundColor: LIME, paddingTop: 10, paddingBottom: 10, paddingLeft: 18, paddingRight: 18 },
  detailCell: { flex: 1 },
  detailValue: { fontSize: 10, color: DARK },

  totalsWrap: { paddingLeft: 48, paddingRight: 48, marginTop: 22 },
  tLine: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 3, paddingBottom: 3 },
  tLabel: { width: 150, fontSize: 9, color: MUT, textAlign: 'right', marginRight: 14 },
  tValue: { width: 120, fontSize: 9, fontFamily: MONO, color: '#374151', textAlign: 'right' },
  tStrong: { fontWeight: 500, color: DARK },

  paidStamp: { marginTop: 10, marginLeft: 48, marginRight: 48, flexDirection: 'row', justifyContent: 'flex-end' },
  paidStampText: { fontSize: 10, fontFamily: SANS, fontWeight: 600, color: '#16a34a', letterSpacing: 1 },

  thankWrap: { paddingLeft: 48, paddingRight: 48, marginTop: 28 },
  thankText: { fontSize: 14, fontFamily: SERIF, fontWeight: 'bold', color: DARK, marginBottom: 4 },
  notesLabel: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 3 },
  notesText: { fontSize: 9, color: MUT },

  footer: { position: 'absolute', bottom: 28, left: 48, right: 48, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8 },
  footerText: { fontSize: 7.5, color: '#9ca3af', textAlign: 'center' },
})

const fmt = (n: number, c: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n)
/** Date-only (YYYY-MM-DD) → "October 19, 2026", read at noon UTC so no timezone shifts the day. */
const fmtDay = (d: string) => new Date(`${d}T12:00:00Z`).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

export interface ReceiptData {
  receipt_number: string
  amount: number
  paid_on: string
  method: PaymentMethod | null
  note: string | null
  currency: string
  invoice_number: string
  invoice_total: number
  /** Everything received on this invoice up to and including this payment. */
  paid_to_date: number
  client: { name: string; email: string | null } | null
  /** Project title, or "Combined — N projects". */
  for_label: string | null
}

export function ReceiptDocument({ r, bizSettings }: { r: ReceiptData; bizSettings?: BusinessSettings | null }) {
  const balance = Math.max(0, Math.round((r.invoice_total - r.paid_to_date) * 100) / 100)
  const contactLines = [bizSettings?.owner_name, bizSettings?.phone, bizSettings?.email, bizSettings?.address].filter(Boolean) as string[]

  return (
    <Document title={`Receipt ${r.receipt_number}`}>
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <View>
            <Text style={S.hTitle}>RECEIPT</Text>
            <Text style={S.hNumber}>{r.receipt_number}</Text>
          </View>
          <View style={S.hRight}>
            {bizSettings?.logo_url
              ? <Image src={bizSettings.logo_url} style={S.hLogo} />
              : <Text style={S.hBiz}>{bizSettings?.business_name ?? 'OW Studio'}</Text>}
            {bizSettings?.logo_url && bizSettings?.business_name && <Text style={S.hBiz}>{bizSettings.business_name}</Text>}
            {contactLines.map((line, i) => <Text key={i} style={S.hSub}>{line}</Text>)}
          </View>
        </View>

        <View style={S.infoRow}>
          <View>
            <Text style={S.label}>Received From</Text>
            <Text style={S.clientName}>{r.client?.name ?? '—'}</Text>
            {r.client?.email && <Text style={S.clientSub}>{r.client.email}</Text>}
            {r.for_label && <Text style={S.clientSub}>{r.for_label}</Text>}
          </View>
          <View>
            <View style={S.metaRow}>
              <Text style={S.mLabel}>Receipt No</Text>
              <Text style={S.mValue}>{r.receipt_number}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.mLabel}>For Invoice</Text>
              <Text style={S.mValue}>{r.invoice_number}</Text>
            </View>
            <View style={S.metaRow}>
              <Text style={S.mLabel}>Date Paid</Text>
              <Text style={S.mValue}>{fmtDay(r.paid_on)}</Text>
            </View>
          </View>
        </View>

        <View style={S.divider} />

        <View style={S.amountBand}>
          <Text style={S.amountLabel}>Amount Received</Text>
          <Text style={S.amountValue}>{fmt(r.amount, r.currency)}</Text>
        </View>
        <View style={S.detailRow}>
          <View style={S.detailCell}>
            <Text style={S.label}>Payment Method</Text>
            <Text style={S.detailValue}>{r.method ? PAYMENT_METHOD_LABELS[r.method] : '—'}</Text>
          </View>
          <View style={S.detailCell}>
            <Text style={S.label}>Date</Text>
            <Text style={S.detailValue}>{fmtDay(r.paid_on)}</Text>
          </View>
        </View>

        <View style={S.totalsWrap}>
          <View style={S.tLine}>
            <Text style={S.tLabel}>Invoice {r.invoice_number} total</Text>
            <Text style={S.tValue}>{fmt(r.invoice_total, r.currency)}</Text>
          </View>
          <View style={S.tLine}>
            <Text style={S.tLabel}>Paid to date</Text>
            <Text style={S.tValue}>{fmt(r.paid_to_date, r.currency)}</Text>
          </View>
          <View style={S.tLine}>
            <Text style={{ ...S.tLabel, ...S.tStrong }}>Balance owing</Text>
            <Text style={{ ...S.tValue, ...S.tStrong }}>{fmt(balance, r.currency)}</Text>
          </View>
        </View>
        {balance === 0 && (
          <View style={S.paidStamp}><Text style={S.paidStampText}>PAID IN FULL</Text></View>
        )}

        <View style={S.thankWrap}>
          <Text style={S.thankText}>Thank you for your payment!</Text>
          {r.note && (
            <View>
              <Text style={S.notesLabel}>Note</Text>
              <Text style={S.notesText}>{r.note}</Text>
            </View>
          )}
        </View>

        <View style={S.footer}>
          <Text style={S.footerText}>Generated by OW Studio</Text>
        </View>
      </Page>
    </Document>
  )
}
