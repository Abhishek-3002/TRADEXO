const MAX_AMOUNT = 1_000_000_000_000

function amountInPaise(value, label = 'Amount') {
  const amount = Number(value)
  if (!Number.isFinite(amount) || amount < 0 || amount > MAX_AMOUNT) {
    throw new Error(label + ' must be a valid non-negative amount.')
  }
  return Math.round((amount + Number.EPSILON) * 100)
}

function allocateReceipt({ invoiceTotal, previousReceipts = [], receiptAmount }) {
  const total = amountInPaise(invoiceTotal, 'Invoice total')
  if (!Array.isArray(previousReceipts)) throw new Error('Previous receipts must be a list.')
  const received = previousReceipts.reduce((sum, item) => sum + amountInPaise(item.amount, 'Previous receipt'), 0)
  if (received > total) throw new Error('Previous receipts exceed the invoice total.')
  const payment = amountInPaise(receiptAmount, 'Receipt amount')
  if (payment <= 0) throw new Error('Receipt amount must be greater than zero.')
  if (received + payment > total) throw new Error('Receipt exceeds the outstanding invoice balance.')
  const outstanding = total - received - payment
  return Object.freeze({
    invoice_total: Number((total / 100).toFixed(2)),
    previously_received: Number((received / 100).toFixed(2)),
    receipt_amount: Number((payment / 100).toFixed(2)),
    total_received: Number(((received + payment) / 100).toFixed(2)),
    outstanding: Number((outstanding / 100).toFixed(2)),
    status: outstanding === 0 ? 'paid' : (received + payment > 0 ? 'part_paid' : 'unpaid')
  })
}

function allocateSupplierPayment({ billTotal, previousPayments = [], paymentAmount }) {
  const result = allocateReceipt({ invoiceTotal: billTotal, previousReceipts: previousPayments, receiptAmount: paymentAmount })
  return Object.freeze({
    bill_total: result.invoice_total,
    previously_paid: result.previously_received,
    payment_amount: result.receipt_amount,
    total_paid: result.total_received,
    outstanding: result.outstanding,
    status: result.status === 'paid' ? 'paid' : 'part_paid'
  })
}

function summarizeReceivables(invoices) {
  if (!Array.isArray(invoices)) throw new Error('Invoices must be a list.')
  const summary = invoices.reduce((result, invoice) => {
    const total = amountInPaise(invoice.total_amount, 'Invoice total')
    const received = amountInPaise(invoice.received_amount ?? 0, 'Received amount')
    if (received > total) throw new Error('Received amount cannot exceed invoice total.')
    summary.invoice_count += 1
    summary.invoiced += total
    summary.received += received
    summary.outstanding += total - received
    return summary
  }, { invoice_count: 0, invoiced: 0, received: 0, outstanding: 0 })
  return Object.fromEntries(Object.entries(summary).map(([key, value]) => [key, key === 'invoice_count' ? value : Number((value / 100).toFixed(2))]))
}

module.exports = { amountInPaise, allocateReceipt, allocateSupplierPayment, summarizeReceivables }
