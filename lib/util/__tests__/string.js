const test = require('ava')
const {slugify, beautifyUppercased} = require('../string')

test('slugify()', t => {
  t.is(slugify('Rue du Maréchal Joffre'), 'rue-du-marechal-joffre')
  t.is(slugify('Place de l’Âtre'), 'place-de-l-atre')
  t.is(slugify('Avenue  Guillaume d\'Orange  '), 'avenue-guillaume-d-orange')
})

test('beautifyUppercased()', t => {
  t.is(beautifyUppercased('Impasse Louis XVI'), 'Impasse Louis XVI')
  t.is(beautifyUppercased('impasse louis xvi'), 'impasse louis xvi')
  t.is(beautifyUppercased('IMPASSE LOUIS XVI'), 'Impasse Louis XVI')
  t.is(beautifyUppercased('RUE DES PEUPLIERS'), 'Rue des Peupliers')
})
