'use server'
import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import type { InvoiceStatus } from '@/types'

function calcStatus(payments: { status: string; due_date: string | null }[]): InvoiceStatus {
  if (!payments.length) return 'unpaid'
  const paid = payments.filter(p => p.status === 'paid').length
  if (paid === payments.length) return 'paid'
  if (paid > 0) return 'partial'
  const today = new Date().toISOString().split('T')[0]
  if (payments.some(p => p.status === 'pending' && p.due_date && p.due_date < today)) return 'overdue'
  return 'unpaid'
}

export async function createInvoiceAction(formData: FormData): Promise<string> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')

  const { count } = await supabase.from('invoices').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  const invoiceNumber = `INV-${String((count ?? 0) + 1).padStart(3, '0')}`

  const currency = formData.get('currency') as string
  const useGct = formData.get('use_gct') === 'true'
  const stages = JSON.parse(formData.get('payment_stages') as string) as { label: string; amount: number; due_date: string }[]
  const subtotal = stages.reduce((sum, s) => sum + s.amount, 0)
  const gctRate = useGct ? 0.15 : 0
  const gctAmount = subtotal * gctRate
  const total = subtotal + gctAmount

  const { data: invoice, error } = await supabase.from('invoices').insert({
    user_id: user.id,
    project_id: formData.get('project_id') as string,
    invoice_number: invoiceNumber,
    currency,
    subtotal,
    gct_rate: gctRate,
    gct_amount: gctAmount,
    total,
    status: 'unpaid',
    notes: (formData.get('notes') as string) || null,
  }).select().single()

  if (error || !invoice) throw new Error('Failed to create invoice')

  await supabase.from('invoice_payments').insert(
    stages.map(s => ({
      invoice_id: invoice.id,
      label: s.label,
      amount: s.amount,
      due_date: s.due_date || null,
      status: 'pending',
    }))
  )

  revalidatePath('/invoices')
  return invoice.id
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
  await supabase.from('invoice_payments').update({ status: 'paid', paid_date: new Date().toISOString().split('T')[0] }).eq('id', paymentId)
  const { data: payments } = await supabase.from('invoice_payments').select('status, due_date').eq('invoice_id', invoiceId)
  await supabase.from('invoices').update({ status: calcStatus(payments ?? []) }).eq('id', invoiceId).eq('user_id', user.id)
  revalidatePath(`/invoices/${invoiceId}`)
}

export async function markPaymentUnpaidAction(paymentId: string, invoiceId: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthorized')
  await supabase.from('invoice_payments').update({ status: 'pending', paid_date: null }).eq('id', paymentId)
  const { data: payments } = await supabase.from('invoice_payments').select('status, due_date').eq('invoice_id', invoiceId)
  await supabase.from('invoices').update({ status: calcStatus(payments ?? []) }).eq('id', invoiceId).eq('user_id', user.id)
  revalidatePath(`/invoices/${invoiceId}`)
}
