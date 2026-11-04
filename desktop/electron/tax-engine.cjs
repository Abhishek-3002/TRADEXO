const VALID_MODES = new Set(['none', 'exclusive', 'inclusive'])

function money(value, label) {
  const n = Number(value)
  if (!Number.isFinite(n) || n < 0) throw new Error(label + ' must be a non-negative number.')
  return Math.round((n + Number.EPSILON) * 100)
}

function roundPaise(value) {
  return Math.round(value + Number.EPSILON)
}

function calculateLineTax({ quantity, unitPrice, taxRate = 0, taxMode = 'none', supplyType = 'intra' }) {
  const qty = Number(quantity)
  const rate = Number(taxRate)
  if (!Number.isFinite(qty) || qty <= 0) throw new Error('Quantity must be greater than zero.')
  if (!Number.isFinite(rate) || rate < 0 || rate > 100) throw new Error('GST rate must be between 0 and 100.')
  if (!VALID_MODES.has(taxMode)) throw new Error('Tax mode must be none, exclusive or inclusive.')
  if (!['intra', 'inter'].includes(supplyType)) throw new Error('Supply type must be intra or inter-state.')
  if (taxMode === 'none' && rate !== 0) throw new Error('A GST rate cannot be used when tax mode is none.')

  const unitPaise = money(unitPrice, 'Unit price')
  const enteredPaise = roundPaise(unitPaise * qty)
  let taxablePaise = enteredPaise
  let taxPaise = 0
  if (taxMode === 'exclusive') {
    taxPaise = roundPaise(enteredPaise * rate / 100)
  } else if (taxMode === 'inclusive' && rate > 0) {
    taxablePaise = roundPaise(enteredPaise * 100 / (100 + rate))
    taxPaise = enteredPaise - taxablePaise
  }
  const cgstPaise = supplyType === 'intra' ? Math.floor(taxPaise / 2) : 0
  const sgstPaise = supplyType === 'intra' ? taxPaise - cgstPaise : 0
  const igstPaise = supplyType === 'inter' ? taxPaise : 0
  const totalPaise = taxablePaise + taxPaise
  const asRupees = paise => Number((paise / 100).toFixed(2))
  return Object.freeze({
    quantity: qty,
    tax_rate: rate,
    tax_mode: taxMode,
    supply_type: supplyType,
    taxable_value: asRupees(taxablePaise),
    cgst: asRupees(cgstPaise),
    sgst: asRupees(sgstPaise),
    igst: asRupees(igstPaise),
    total_tax: asRupees(taxPaise),
    total: asRupees(totalPaise)
  })
}

function calculateDocumentTax(lines) {
  if (!Array.isArray(lines) || lines.length < 1 || lines.length > 500) {
    throw new Error('Add between 1 and 500 taxable lines.')
  }
  const calculated = lines.map(calculateLineTax)
  const sum = key => Number(calculated.reduce((total, line) => total + Math.round(line[key] * 100), 0) / 100).toFixed(2)
  return Object.freeze({
    lines: calculated,
    taxable_value: Number(sum('taxable_value')),
    cgst: Number(sum('cgst')),
    sgst: Number(sum('sgst')),
    igst: Number(sum('igst')),
    total_tax: Number(sum('total_tax')),
    total: Number(sum('total'))
  })
}

module.exports = { calculateLineTax, calculateDocumentTax }
