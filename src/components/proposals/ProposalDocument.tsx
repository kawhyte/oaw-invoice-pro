import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer'
import { SERIF, SANS, MONO, DARK, BRONZE, BRONZE_TINT, LIME, W, MUT, LINE } from '@/components/pdf/brand'
import { groupByCategory } from '@/lib/proposals'
import type { BusinessSettings, ProposalSnapshot } from '@/types'

// Same Atelier layout as InvoiceDocument, for a proposal version snapshot.

const S = StyleSheet.create({
  page: { fontSize: 10, color: '#374151', fontFamily: SANS, paddingBottom: 60 },
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

  infoRow: {
    paddingTop: 22, paddingBottom: 18, paddingLeft: 48, paddingRight: 48,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
  },
  billLabel: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 },
  clientName: { fontSize: 14, fontFamily: SERIF, fontWeight: 'bold', color: DARK, marginBottom: 2 },
  clientSub: { fontSize: 9, color: MUT, marginTop: 2, maxWidth: 220 },
  metaRow: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', marginBottom: 4 },
  mLabel: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, width: 88, textAlign: 'right', marginRight: 12 },
  mValue: { fontSize: 9, fontFamily: MONO, fontWeight: 500, color: DARK, width: 115, textAlign: 'right' },

  divider: { marginLeft: 48, marginRight: 48, borderBottomWidth: 1, borderBottomColor: LINE, marginBottom: 16 },

  scopeWrap: { paddingLeft: 48, paddingRight: 48, marginBottom: 16 },
  scopeTitle: { fontSize: 13, fontFamily: SERIF, fontWeight: 'bold', color: DARK, marginBottom: 6 },
  scopeText: { fontSize: 9, color: '#374151', lineHeight: 1.5 },

  tableWrap: { paddingLeft: 48, paddingRight: 48 },
  thRow: { flexDirection: 'row', backgroundColor: BRONZE, paddingTop: 8, paddingBottom: 8, paddingLeft: 10, paddingRight: 10 },
  tdRow: { flexDirection: 'row', paddingTop: 9, paddingBottom: 9, paddingLeft: 10, paddingRight: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  tdRowAlt: { flexDirection: 'row', backgroundColor: LIME, paddingTop: 9, paddingBottom: 9, paddingLeft: 10, paddingRight: 10, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  c1: { flex: 4 },
  cPrice: { flex: 2, textAlign: 'right' },
  cQty: { flex: 1, textAlign: 'center' },
  cTotal: { flex: 2, textAlign: 'right' },
  th: { fontSize: 8, color: W, fontFamily: SANS, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5 },
  td: { fontSize: 9, color: '#374151' },
  tdNum: { fontSize: 9, color: '#374151', fontFamily: MONO },
  sectionRow: {
    flexDirection: 'row', backgroundColor: LIME, paddingTop: 6, paddingBottom: 6, paddingLeft: 10, paddingRight: 10,
    borderBottomWidth: 1, borderBottomColor: '#e0e0e3',
  },
  sectionTitle: { fontSize: 9, fontFamily: SERIF, fontWeight: 'bold', color: BRONZE, textTransform: 'uppercase', letterSpacing: 0.5 },

  totalsWrap: { paddingLeft: 48, paddingRight: 48, marginTop: 4 },
  tLine: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 3, paddingBottom: 3 },
  tLabel: { width: 130, fontSize: 9, color: MUT, textAlign: 'right', marginRight: 14 },
  tValue: { width: 110, fontSize: 9, fontFamily: MONO, color: '#374151', textAlign: 'right' },
  grandBand: {
    marginTop: 8, marginLeft: 48, marginRight: 48, backgroundColor: BRONZE_TINT,
    flexDirection: 'row', justifyContent: 'space-between', paddingTop: 11, paddingBottom: 11, paddingLeft: 14, paddingRight: 14,
  },
  grandLabel: { fontSize: 11, fontFamily: SERIF, fontWeight: 'bold', color: BRONZE },
  grandValue: { fontSize: 11, fontFamily: MONO, fontWeight: 500, color: BRONZE },

  notesWrap: { paddingLeft: 48, paddingRight: 48, marginTop: 24 },
  validText: { fontSize: 11, fontFamily: SERIF, fontWeight: 'bold', color: DARK, marginBottom: 4 },
  notesLabel: { fontSize: 8, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 10, marginBottom: 3 },
  notesText: { fontSize: 9, color: MUT },

  footer: { position: 'absolute', bottom: 28, left: 48, right: 48, borderTopWidth: 1, borderTopColor: LINE, paddingTop: 8 },
  footerText: { fontSize: 7.5, color: '#9ca3af', textAlign: 'center' },
})

const fmt = (n: number, c: string) => new Intl.NumberFormat('en-US', { style: 'currency', currency: c }).format(n)
// Date-only strings parse as UTC midnight; format in UTC so Jamaica never shows the day before.
const fmtDate = (d: string) => new Date(d.length === 10 ? `${d}T12:00:00Z` : d)
  .toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'America/Jamaica' })

interface Props {
  snapshot: ProposalSnapshot
  number: string
  /** null = never sent (owner's draft preview). */
  version: number | null
  /** ISO timestamp the version was sent, or now for a draft. */
  date: string
  validUntil: string
  recipientPhone?: string | null
  recipientEmail?: string | null
  bizSettings?: BusinessSettings | null
}

export function ProposalDocument({ snapshot, number, version, date, validUntil, recipientPhone, recipientEmail, bizSettings }: Props) {
  const c = snapshot.currency
  const groups = groupByCategory(snapshot.items ?? [])
  const showGroups = groups.length > 1 || (groups[0]?.category ?? null) !== null
  const contactLines = [bizSettings?.owner_name, bizSettings?.phone, bizSettings?.email, bizSettings?.address].filter(Boolean) as string[]

  return (
    <Document>
      <Page size="A4" style={S.page}>
        <View style={S.header}>
          <Text style={S.hTitle}>PROPOSAL</Text>
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
            <Text style={S.billLabel}>Prepared For</Text>
            <Text style={S.clientName}>{snapshot.recipient_name}</Text>
            {recipientEmail && <Text style={S.clientSub}>{recipientEmail}</Text>}
            {recipientPhone && <Text style={S.clientSub}>{recipientPhone}</Text>}
            {snapshot.location_address && <Text style={S.clientSub}>{snapshot.location_address}</Text>}
            {snapshot.job_type && <Text style={S.clientSub}>{snapshot.job_type}</Text>}
          </View>
          <View>
            <View style={S.metaRow}><Text style={S.mLabel}>Proposal No</Text><Text style={S.mValue}>{number}</Text></View>
            <View style={S.metaRow}><Text style={S.mLabel}>Version</Text><Text style={S.mValue}>{version ? `v${version}` : 'DRAFT'}</Text></View>
            <View style={S.metaRow}><Text style={S.mLabel}>Date</Text><Text style={S.mValue}>{fmtDate(date)}</Text></View>
            <View style={S.metaRow}><Text style={S.mLabel}>Valid Until</Text><Text style={S.mValue}>{fmtDate(validUntil)}</Text></View>
          </View>
        </View>

        <View style={S.divider} />

        <View style={S.scopeWrap}>
          <Text style={S.scopeTitle}>{snapshot.title}</Text>
          {snapshot.scope && <Text style={S.scopeText}>{snapshot.scope}</Text>}
        </View>

        <View style={S.tableWrap}>
          <View style={S.thRow}>
            <Text style={{ ...S.c1, ...S.th }}>Item Description</Text>
            <Text style={{ ...S.cPrice, ...S.th }}>Price</Text>
            <Text style={{ ...S.cQty, ...S.th }}>Qty</Text>
            <Text style={{ ...S.cTotal, ...S.th }}>Total</Text>
          </View>
          {groups.map((g, gi) => (
            <View key={gi} wrap={false}>
              {showGroups && <View style={S.sectionRow}><Text style={S.sectionTitle}>{g.label}</Text></View>}
              {g.items.map((item, i) => (
                <View key={i} style={i % 2 === 0 ? S.tdRow : S.tdRowAlt}>
                  <Text style={{ ...S.c1, ...S.td }}>{item.description}</Text>
                  <Text style={{ ...S.cPrice, ...S.tdNum }}>{fmt(item.unit_price, c)}</Text>
                  <Text style={{ ...S.cQty, ...S.tdNum }}>{item.quantity}</Text>
                  <Text style={{ ...S.cTotal, ...S.tdNum }}>{fmt(item.amount, c)}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>

        <View style={S.totalsWrap}>
          <View style={S.tLine}><Text style={S.tLabel}>Sub Total</Text><Text style={S.tValue}>{fmt(snapshot.subtotal, c)}</Text></View>
          {snapshot.discount_amount > 0 && (
            <View style={S.tLine}>
              <Text style={S.tLabel}>Discount{snapshot.discount_type === 'percentage' ? ` (${snapshot.discount_value}%)` : ''}</Text>
              <Text style={S.tValue}>- {fmt(snapshot.discount_amount, c)}</Text>
            </View>
          )}
          {snapshot.gct_rate > 0 && (
            <View style={S.tLine}><Text style={S.tLabel}>GCT (15%)</Text><Text style={S.tValue}>{fmt(snapshot.gct_amount, c)}</Text></View>
          )}
          {snapshot.additions_amount > 0 && (
            <View style={S.tLine}><Text style={S.tLabel}>{snapshot.additions_description || 'Additions'}</Text><Text style={S.tValue}>+ {fmt(snapshot.additions_amount, c)}</Text></View>
          )}
        </View>
        <View style={S.grandBand}>
          <Text style={S.grandLabel}>Proposed Total</Text>
          <Text style={S.grandValue}>{fmt(snapshot.total, c)}</Text>
        </View>

        <View style={S.notesWrap}>
          <Text style={S.validText}>This proposal is valid until {fmtDate(validUntil)}.</Text>
          {snapshot.notes && (
            <View>
              <Text style={S.notesLabel}>Notes</Text>
              <Text style={S.notesText}>{snapshot.notes}</Text>
            </View>
          )}
        </View>

        <View style={S.footer} fixed>
          <Text style={S.footerText}>{number}{version ? ` · v${version}` : ''} · Generated by OW Studio</Text>
        </View>
      </Page>
    </Document>
  )
}
