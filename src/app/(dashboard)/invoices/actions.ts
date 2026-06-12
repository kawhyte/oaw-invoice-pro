'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { InvoiceStatus, DiscountType } from '@/types'

function calcTotal(
  subtotal: number,
  discountType: DiscountType,
  discountValue: number,
  gctRate: number,
  additionsAmount: number
) {
  const discount = discountType === 'percentage'
    ? subtotal * (discountValue / 100)
    : discountType === 'fixed' ? discountValue : 0
  const afterDiscount = subtotal - discount
  const gct = afterDiscount * gctRate
  return {
    discountAmount: discount,
    gctAmount: gct,
    total: afterDiscount + gct + additionsAmount,
  }
}

function calcStatus(amountPaid: number, total: number, dueDate: string | null, wasSent: boolean): InvoiceStatus {
  if (total > 0 && amountPaid >= total) return 'paid'
  const today = new Date().toISOString().split('T')[0]
  if (dueDate && dueDate < today) return 'overdue'
  if (amountPaid > 0) return 'partial'
  if (wasSent) return 'sent'
  return 'draft'
}

export async function createInvoiceAction(formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(3, '0')}`

  const lineItems = JSON.parse(formData.get('line_items') as string) as { description: string; quantity: number; unit_price: number }[]
  const currency = formData.get('currency') as string
  const discountType = (formData.get('discount_type') as DiscountType) || 'none'
  const discountValue = parseFloat(formData.get('discount_value') as string) || 0
  const gctRate = formData.get('use_gct') === 'true' ? 0.15 : 0
  const additionsAmount = parseFloat(formData.get('additions_amount') as string) || 0
  const amountPaid = parseFloat(formData.get('amount_paid') as string) || 0
  const dueDate = (formData.get('due_date') as string) || null

  const subtotal = lineItems.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)
  const { discountAmount, gctAmount, total } = calcTotal(subtotal, discountType, discountValue, gctRate, additionsAmount)
  const status = calcStatus(amountPaid, total, dueDate, false)

  const { data: invoice, error } = await supabase.from('invoices').insert({
    user_id: user.id,
    project_id: formData.get('project_id') as string,
    invoice_number: invoiceNumber,
    currency,
    subtotal,
    discount_type: discountType,
    discount_value: discountValue,
    gct_rate: gctRate,
    gct_amount: gctAmount,
    additions_description: (formData.get('additions_description') as string) || null,
    additions_amount: additionsAmount,
    total,
    amount_paid: amountPaid,
    due_date: dueDate,
    status,
    notes: (formData.get('notes') as string) || null,
  }).select().single()

  if (error || !invoice) throw new Error('Failed to create invoice')

  if (lineItems.length > 0) {
    await supabase.from('invoice_line_items').insert(
      lineItems.map((item, i) => ({
        invoice_id: invoice.id,
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unit_price,
        amount: item.quantity * item.unit_price,
        sort_order: i,
      }))
    )
  }

  revalidatePath('/invoices')
  return invoice.id
}

export async function updateAmountPaidAction(invoiceId: string, amountPaid: number) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { data: invoice } = await supabase.from('invoices').select('total, due_date, status').eq('id', invoiceId).eq('user_id', user.id).single()
  if (!invoice) throw new Error('Not found')

  const wasSent = invoice.status === 'sent'
  const status = calcStatus(amountPaid, invoice.total, invoice.due_date, wasSent)

  await supabase.from('invoices').update({ amount_paid: amountPaid, status }).eq('id', invoiceId).eq('user_id', user.id)
  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
}

export async function markSentAction(invoiceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await supabase.from('invoices').update({ status: 'sent' }).eq('id', invoiceId).eq('user_id', user.id).eq('status', 'draft')
  revalidatePath(`/invoices/${invoiceId}`)
  revalidatePath('/invoices')
}

export async function deleteInvoiceAction(id: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await supabase.from('invoices').delete().eq('id', id).eq('user_id', user.id)
  revalidatePath('/invoices')
}

export async function markPaymentPaidAction(paymentId: string, invoiceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await supabase
    .from('invoice_payments')
    .update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] })
    .eq('id', paymentId)
  revalidatePath(`/invoices/${invoiceId}`)
}

export async function markPaymentUnpaidAction(paymentId: string, invoiceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await supabase
    .from('invoice_payments')
    .update({ status: 'pending', paid_date: null })
    .eq('id', paymentId)
  revalidatePath(`/invoices/${invoiceId}`)
}
