const test = require('ava')
const {slugify} = require('../string')

test('slugify()', t => {
  t.is(slugify('Rue du Maréchal Joffre'), 'rue-du-marechal-joffre')
  t.is(slugify('Place de l’Âtre'), 'place-de-l-atre')
  t.is(slugify('Avenue  Guillaume d\'Orange  '), 'avenue-guillaume-d-orange')
})
