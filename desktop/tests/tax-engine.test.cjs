const test = require('node:test')
const assert = require('node:assert/strict')
const { calculateLineTax, calculateDocumentTax } = require('../electron/tax-engine.cjs')

test('exclusive intra-state GST splits tax into CGST and SGST', () => {
  assert.deepEqual(calculateLineTax({ quantity: 2, unitPrice: 100, taxRate: 18, taxMode: 'exclusive', supplyType: 'intra' }), {
    quantity: 2, tax_rate: 18, tax_mode: 'exclusive', supply_type: 'intra',
    taxable_value: 200, cgst: 18, sgst: 18, igst: 0, total_tax: 36, total: 236
  })
})

test('exclusive inter-state GST applies IGST only', () => {
  const result = calculateLineTax({ quantity: 1, unitPrice: 100, taxRate: 18, taxMode: 'exclusive', supplyType: 'inter' })
  assert.equal(result.igst, 18)
  assert.equal(result.cgst + result.sgst, 0)
  assert.equal(result.total, 118)
})

test('inclusive GST extracts tax from entered price', () => {
  const result = calculateLineTax({ quantity: 1, unitPrice: 118, taxRate: 18, taxMode: 'inclusive', supplyType: 'intra' })
  assert.equal(result.taxable_value, 100)
  assert.equal(result.total_tax, 18)
  assert.equal(result.total, 118)
})

test('rounding remains in paise and allocates odd paise to SGST', () => {
  const result = calculateLineTax({ quantity: 1, unitPrice: 0.05, taxRate: 5, taxMode: 'exclusive', supplyType: 'intra' })
  assert.equal(result.total_tax, 0)
  assert.equal(result.total, 0.05)
})

test('document totals sum rounded line amounts', () => {
  const result = calculateDocumentTax([
    { quantity: 1, unitPrice: 100, taxRate: 5, taxMode: 'exclusive', supplyType: 'intra' },
    { quantity: 1, unitPrice: 200, taxRate: 12, taxMode: 'exclusive', supplyType: 'inter' }
  ])
  assert.equal(result.taxable_value, 300)
  assert.equal(result.cgst, 2.5)
  assert.equal(result.sgst, 2.5)
  assert.equal(result.igst, 24)
  assert.equal(result.total, 329)
})

test('rejects invalid rates, modes, supply types and tax-with-none', () => {
  assert.throws(() => calculateLineTax({ quantity: 1, unitPrice: 100, taxRate: 101, taxMode: 'exclusive', supplyType: 'intra' }))
  assert.throws(() => calculateLineTax({ quantity: 1, unitPrice: 100, taxRate: 5, taxMode: 'none', supplyType: 'intra' }))
  assert.throws(() => calculateLineTax({ quantity: 1, unitPrice: 100, taxRate: 5, taxMode: 'exclusive', supplyType: 'other' }))
})

test('document rejects empty or excessive line arrays', () => {
  assert.throws(() => calculateDocumentTax([]))
  assert.throws(() => calculateDocumentTax(new Array(501).fill({ quantity: 1, unitPrice: 1 })))
})
