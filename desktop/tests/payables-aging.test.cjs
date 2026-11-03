const test = require('node:test')
const assert = require('node:assert/strict')
const { summarizePayables } = require('../electron/payables-aging.cjs')

test('groups outstanding posted supplier bills by bill-date aging buckets', () => {
  const report = summarizePayables([
    { status: 'posted', bill_date: '2026-11-04', total_amount: 100, paid_amount: 25 },
    { status: 'posted', bill_date: '2026-10-20', total_amount: 200, paid_amount: 0 },
    { status: 'posted', bill_date: '2026-09-10', total_amount: 300, paid_amount: 100 },
    { status: 'posted', bill_date: '2026-08-15', total_amount: 400, paid_amount: 0 },
    { status: 'posted', bill_date: '2026-01-01', total_amount: 500, paid_amount: 500 },
    { status: 'draft', bill_date: '2026-01-01', total_amount: 600, paid_amount: 0 }
  ], '2026-11-04')
  assert.equal(report.bill_count, 4)
  assert.equal(report.outstanding_total, 875)
  assert.deepEqual(report.buckets, { current:75, days_1_30:200, days_31_60:200, days_61_90:400, days_over_90:0 })
})

test('uses due date when supplied and validates payment totals and as-of dates', () => {
  const report = summarizePayables([{ status:'posted',bill_date:'2026-11-01',due_date:'2026-09-01',total_amount:50,paid_amount:10 }], '2026-11-04')
  assert.equal(report.buckets.days_61_90, 40)
  assert.throws(() => summarizePayables([{ total_amount:10,paid_amount:11,bill_date:'2026-11-01' }], '2026-11-04'), /cannot exceed/)
  assert.throws(() => summarizePayables([], '2026-02-30'), /valid YYYY-MM-DD/)
})
