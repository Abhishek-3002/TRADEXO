const crypto = require('node:crypto')
const { promisify } = require('node:util')
const scrypt = promisify(crypto.scrypt)

function isValidPin(pin) {
  return typeof pin === 'string' && /^\\d{6,12}$/.test(pin)
}

async function hashPin(pin, salt) {
  if (!isValidPin(pin)) throw new TypeError('PIN must contain 6 to 12 digits.')
  if (typeof salt !== 'string' || !/^[a-f0-9]{32}$/.test(salt)) throw new TypeError('PIN salt is invalid.')
  return scrypt(pin, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })
}

async function verifyPin(pin, salt, expectedHex) {
  if (!isValidPin(pin) || typeof expectedHex !== 'string' || !/^[a-f0-9]{128}$/.test(expectedHex)) return false
  const actual = await hashPin(pin, salt)
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}


function createRecoveryCode() {
  return crypto.randomBytes(32).toString('base64url')
}

function hashRecoveryCode(code, salt) {
  if (typeof code !== 'string' || !/^[A-Za-z0-9_-]{43}$/.test(code)) throw new TypeError('Recovery code is invalid.')
  if (typeof salt !== 'string' || !/^[a-f0-9]{32}$/.test(salt)) throw new TypeError('Recovery salt is invalid.')
  return crypto.createHash('sha256').update(salt).update(':').update(code).digest('hex')
}

function verifyRecoveryCode(code, salt, expectedHex) {
  if (typeof expectedHex !== 'string' || !/^[a-f0-9]{64}$/.test(expectedHex)) return false
  let actual
  try { actual = Buffer.from(hashRecoveryCode(code, salt), 'hex') } catch { return false }
  const expected = Buffer.from(expectedHex, 'hex')
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected)
}

module.exports = { isValidPin, hashPin, verifyPin, createRecoveryCode, hashRecoveryCode, verifyRecoveryCode }

