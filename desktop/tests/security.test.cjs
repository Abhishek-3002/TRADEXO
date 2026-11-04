const test = require('node:test')
const assert = require('node:assert/strict')
const crypto = require('node:crypto')
const { isValidPin, hashPin, verifyPin } = require('../electron/security.cjs')

test('PIN policy accepts only 6 to 12 decimal digits', () => {
  for (const pin of ['123456', '012345678901']) assert.equal(isValidPin(pin), true)
  for (const pin of ['', '12345', '1234567890123', '12ab56', '１２３４５６', null, 123456]) {
    assert.equal(isValidPin(pin), false)
  }
})

test('PIN hash verifies correct PIN and rejects incorrect PIN', async () => {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = (await hashPin('483920', salt)).toString('hex')
  assert.equal(hash.length, 128)
  assert.equal(await verifyPin('483920', salt, hash), true)
  assert.equal(await verifyPin('483921', salt, hash), false)
  assert.equal(await verifyPin('48392', salt, hash), false)
})

test('same PIN produces different hashes with independent salts', async () => {
  const saltA = crypto.randomBytes(16).toString('hex')
  const saltB = crypto.randomBytes(16).toString('hex')
  const hashA = await hashPin('483920', saltA)
  const hashB = await hashPin('483920', saltB)
  assert.notDeepEqual(hashA, hashB)
  assert.equal(await verifyPin('483920', saltB, hashA.toString('hex')), false)
})

test('hashing rejects malformed PIN and salt inputs', async () => {
  await assert.rejects(hashPin('12345', crypto.randomBytes(16).toString('hex')), /PIN/)
  await assert.rejects(hashPin('123456', 'bad-salt'), /salt/)
})
