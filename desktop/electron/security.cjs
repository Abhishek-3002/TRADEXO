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

module.exports = { isValidPin, hashPin, verifyPin }
