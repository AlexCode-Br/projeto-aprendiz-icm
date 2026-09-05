import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSE_SUGGESTIONS, CHURCH_SUGGESTIONS, catalogKey, catalogSuggestions, courseIconKind } from '../shared/catalog-options.mjs';
import { catalogNameError } from '../shared/validation.mjs';

test('sugestões permanentes contêm todos os nomes do catálogo da prévia, sem dados pessoais', () => {
  assert.deepEqual(new Set(COURSE_SUGGESTIONS), new Set(['Violão I', 'Teclado', 'Bateria', 'Canto Coral', 'Violino', 'Flauta Transversal', 'Saxofone', 'Contrabaixo', 'Violão II', 'Teoria Musical']));
  assert.deepEqual(new Set(CHURCH_SUGGESTIONS), new Set(['Pituba', 'Brotas', 'Lauro de Freitas', 'Guarani', 'Boca do Rio', 'Alto de Coutos', 'EAD', 'Remoto']));
  for (const name of [...COURSE_SUGGESTIONS, ...CHURCH_SUGGESTIONS]) assert.equal(catalogNameError(name), '');
  assert.equal(catalogNameError('Clarinete'), '');
  assert.equal(catalogNameError('Mirantes de Periperi'), '');
});

test('sugestões identificam cadastros existentes sem duplicar acentos, caixa ou espaços', () => {
  const options = catalogSuggestions('cursos', [{ nome: ' VIOLAO   I ' }]);
  assert.equal(options.find(option => option.value === 'Violão I').isDisabled, true);
  assert.equal(options.find(option => option.value === 'Violão II').isDisabled, false);
  assert.equal(catalogSuggestions('locais', [{ nome: ' pituba ' }]).find(option => option.value === 'Pituba').isDisabled, true);
  assert.equal(catalogKey('  Teoria  MUSICAL '), 'teoria musical');
  assert.equal(catalogSuggestions('cursos').length, 10);
});

test('ícones diferenciam todos os tipos da prévia e reconhecem nomes personalizados', () => {
  const families = COURSE_SUGGESTIONS.map(courseIconKind);
  assert.equal(families.includes('music'), false);
  assert.equal(new Set(families).size, 9); // Violão I e II são o mesmo instrumento.
  assert.equal(courseIconKind('Violão avançado'), 'guitar');
  assert.equal(courseIconKind('Gaita'), 'harmonica');
  assert.equal(courseIconKind('Contrabaixo elétrico'), 'bass');
  assert.equal(courseIconKind('Clarinete'), 'music');
  assert.equal(courseIconKind(null), 'music');
});
