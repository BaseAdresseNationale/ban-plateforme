const {slugify, beautifyUppercased} = require('./string')

describe('Test util/string.js', () => {
  it('slugify()', () => {
    expect(slugify('Rue du Maréchal Joffre')).toBe('rue-du-marechal-joffre')
    expect(slugify('Place de l’Âtre')).toBe('place-de-l-atre')
    expect(slugify('Avenue  Guillaume d\'Orange  ')).toBe('avenue-guillaume-d-orange')
  })

  it('beautifyUppercased()', () => {
    expect(beautifyUppercased('Impasse Louis XVI')).toBe('Impasse Louis XVI')
    expect(beautifyUppercased('impasse louis xvi')).toBe('impasse louis xvi')
    expect(beautifyUppercased('IMPASSE LOUIS XVI')).toBe('Impasse Louis XVI')
    expect(beautifyUppercased('RUE DES PEUPLIERS')).toBe('Rue des Peupliers')
  })
})
