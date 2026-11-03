const test = require('node:test')
const assert = require('node:assert/strict')
const { allocateReceipt, allocateSupplierPayment, summarizeReceivables } = require('../electron/payment-allocation.cjs')

test('partial receipt calculates remaining balance', () => {
  assert.deepEqual(allocateReceipt({ invoiceTotal: 1000, previousReceipts: [{ amount: 200 }], receiptAmount: 300 }), {
    invoice_total: 1000, previously_received: 200, receipt_amount: 300,
    total_received: 500, outstanding: 500, status: 'part_paid'
  })
})

test('final receipt marks invoice paid', () => {
  const result = allocateReceipt({ invoiceTotal: 1000, previousReceipts: [{ amount: 700 }], receiptAmount: 300 })
  assert.equal(result.outstanding, 0)
  assert.equal(result.status, 'paid')
})

test('supplier payments track payable balance', () => {
  const result = allocateSupplierPayment({ billTotal: 2500, previousPayments: [{ amount: 500 }], paymentAmount: 1000 })
  assert.deepEqual(result, { bill_total: 2500, previously_paid: 500, payment_amount: 1000, total_paid: 1500, outstanding: 1000, status: 'part_paid' })
})

test('rejects overpayment and invalid amounts', () => {
  assert.throws(() => allocateReceipt({ invoiceTotal: 100, receiptAmount: 101 }))
  assert.throws(() => allocateReceipt({ invoiceTotal: 100, previousReceipts: [{ amount: 101 }], receiptAmount: 1 }))
  assert.throws(() => allocateReceipt({ invoiceTotal: 100, receiptAmount: 0 }))
  assert.throws(() => allocateReceipt({ invoiceTotal: -1, receiptAmount: 1 }))
})

test('receivables summary aggregates invoice balances', () => {
  assert.deepEqual(summarizeReceivables([
    { total_amount: 1000, received_amount: 250 },
    { total_amount: 500, received_amount: 500 }
  ]), { invoice_count: 2, invoiced: 1500, received: 750, outstanding: 750 })
})
