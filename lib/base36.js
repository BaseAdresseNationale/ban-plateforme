const A_LOWER = 'a'.charCodeAt(0)

function base36IntToChar(n) {
  if (!Number.isInteger(n) || n < 0 || n >= 36) {
    throw new Error('param must be an integer between 0 and 35')
  }

  if (n < 10) {
    return n.toString()
  }

  return String.fromCodePoint(n - 10 + A_LOWER)
}

function base36IntToString(n) {
  if (!Number.isInteger(n) || n < 0 || n > Number.MAX_SAFE_INTEGER) {
    throw new Error('param must be a safe positive integer')
  }

  if (n === 0) {
    return '0'
  }

  let str = ''

  while (n > 0) {
    const mod = n % 36
    str = base36IntToChar(mod) + str
    n = n > mod ? (n - mod) / 36 : (n - mod)
  }

  return str
}

function generateBase36Part() {
  return base36IntToString(Number.parseInt(Math.random().toString().substr(2, 15), 10)).padStart(10, '0')
}

function generateBase36String(length = 10) {
  let result = ''

  while (result.length < length) {
    result += generateBase36Part().substr(2)
  }

  return result.slice(0, length)
}

module.exports = {base36IntToChar, base36IntToString, generateBase36Part, generateBase36String}
