const { amountInPaise } = require('./payment-allocation.cjs')

function validDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      Number.isNaN(Date.parse(value + 'T00:00:00Z')) ||
      new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) {
    throw new Error(label + ' must be a valid YYYY-MM-DD date.')
  }
  return value
}

function summarizeAging(invoices, asOfDate) {
  validDate(asOfDate, 'As-of date')
  if (!Array.isArray(invoices)) throw new Error('Invoices must be a list.')
  const buckets = { current: 0, days_1_30: 0, days_31_60: 0, days_61_90: 0, days_over_90: 0 }
  let outstandingTotal = 0
  for (const invoice of invoices) {
    const total = amountInPaise(invoice.total_amount, 'Invoice total')
    const received = amountInPaise(invoice.received_amount ?? 0, 'Received amount')
    if (received > total) throw new Error('Received amount cannot exceed invoice total.')
    const outstanding = total - received
    if (outstanding === 0) continue
    const dueDate = validDate(invoice.due_date || invoice.invoice_date, 'Due date')
    const daysLate = Math.floor((Date.parse(asOfDate + 'T00:00:00Z') - Date.parse(dueDate + 'T00:00:00Z')) / 86400000)
    const bucket = daysLate <= 0 ? 'current' : daysLate <= 30 ? 'days_1_30' : daysLate <= 60 ? 'days_31_60' : daysLate <= 90 ? 'days_61_90' : 'days_over_90'
    buckets[bucket] += outstanding
    outstandingTotal += outstanding
  }
  const rupees = value => Number((value / 100).toFixed(2))
  return Object.freeze({
    as_of_date: asOfDate,
    outstanding_total: rupees(outstandingTotal),
    buckets: Object.freeze(Object.fromEntries(Object.entries(buckets).map(([key, value]) => [key, rupees(value)])))
  })
}

module.exports = { summarizeAging }
