function parseNumero(numero) {
  if (numero) {
    return Number.parseInt(numero, 10)
  }
}

module.exports = {parseNumero}
