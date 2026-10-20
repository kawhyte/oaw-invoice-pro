import type { PaymentMethod } from '@/types'

// Client-safe labels for payment methods (used by the payments panel and the receipt PDF).
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Cash', bank_transfer: 'Bank transfer', cheque: 'Cheque', card: 'Card', other: 'Other',
}
