const { amountInPaise } = require('./payment-allocation.cjs')

function validDate(value, label) {
  if (typeof value !== 'string' || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(value) ||
      Number.isNaN(Date.parse(value + 'T00:00:00Z')) ||
      new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
    throw new Error(label + ' must be a valid YYYY-MM-DD date.')
  }
  return value
}

function summarizePayables(bills, asOfDate) {
  validDate(asOfDate, 'As-of date')
  if (!Array.isArray(bills)) throw new Error('Purchase bills must be a list.')
  const buckets = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_over_90: 0 }
  let outstandingTotal = 0
  let openBillCount = 0
  for (const bill of bills) {
    if (bill.status && bill.status !== 'posted') continue
    const total = amountInPaise(bill.total_amount, 'Purchase bill total')
    const paid = amountInPaise(bill.paid_amount ?? 0, 'Supplier payments')
    if (paid > total) throw new Error('Supplier payments cannot exceed purchase bill total.')
    const outstanding = total - paid
    if (outstanding === 0) continue
    const billDate = validDate(bill.due_date || bill.bill_date, 'Bill date')
    const daysLate = Math.floor((Date.parse(asOfDate + 'T00:00:00Z') - Date.parse(billDate + 'T00:00:00Z')) / 86400000)
    const bucket = daysLate <= 0 ? 'current' : daysLate <= 30 ? 'days_1_30' : daysLate <= 60 ? 'days_31_60' : daysLate <= 90 ? 'days_61_90' : 'days_over_90'
    buckets[bucket] += outstanding
    outstandingTotal += outstanding
    openBillCount += 1
  }
  const rupees = value => Number((value / 100).toFixed(2))
  return Object.freeze({
    as_of_date: asOfDate,
    bill_count: openBillCount,
    outstanding_total: rupees(outstandingTotal),
    buckets: Object.freeze(Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, rupees(value)])))
  })
}

module.exports = { summarizePayables }
