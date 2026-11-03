const test = require('node:test')
const assert = require('node:assert/strict')
const { summarizeAging } = require('../electron/receivables-aging.cjs')

test('groups outstanding invoices into aging buckets', () => {
  const result = summarizeAging([
    { total_amount: 100, received_amount: 20, due_date: '2026-11-04' },
    { total_amount: 200, received_amount: 0, due_date: '2026-10-20' },
    { total_amount: 300, received_amount: 100, due_date: '2026-08-20' },
    { total_amount: 400, received_amount: 0, due_date: '2026-07-01' },
    { total_amount: 500, received_amount: 0, due_date: '2026-05-01' }
  ], '2026-11-04')
  assert.deepEqual(result, {
    as_of_date: '2026-11-04',
    outstanding_total: 1380,
    buckets: { current: 80, days_1_30: 200, days_31_60: 200, days_61_90: 200, days_over_90: 900 }
  })
})

test('uses invoice date if no due date and rejects invalid dates', () => {
  assert.equal(summarizeAging([{ total_amount: 10, invoice_date: '2026-11-01' }], '2026-11-04').buckets.days_1_30, 10)
  assert.throws(() => summarizeAging([], '2026-02-30'))
  assert.throws(() => summarizeAging([{ total_amount: 10, received_amount: 11, due_date: '2026-11-01' }], '2026-11-04'))
})
