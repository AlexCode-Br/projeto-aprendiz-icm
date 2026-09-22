import test from 'node:test';
import assert from 'node:assert/strict';
import { COURSE_SUGGESTIONS, SALVADOR_CHURCHES, CHURCH_SUGGESTIONS, STUDENT_CHURCH_SUGGESTIONS, catalogKey, catalogSuggestions, churchName, courseIconKind } from '../shared/catalog-options.mjs';
import { catalogNameError } from '../shared/validation.mjs';

test('sugestões permanentes contêm todos os nomes do catálogo da prévia, sem dados pessoais', () => {
  assert.deepEqual(new Set(COURSE_SUGGESTIONS), new Set(['Violão I', 'Teclado', 'Bateria', 'Canto Coral', 'Violino', 'Flauta Transversal', 'Saxofone', 'Contrabaixo', 'Violão II', 'Teoria Musical']));
  assert.deepEqual(SALVADOR_CHURCHES, [
    'Alto da Terezinha', 'Alto de Coutos', 'Bairro Novo', 'Boca do Rio', 'Brotas',
    'Campinas de Pirajá', 'Cidade Baixa', 'Cidade Nova', 'Fazenda Coutos', 'Fazenda Grande',
    'Garcia', 'Guarani', 'IAPI', 'Itaigara', 'Itapuã I', 'Itapuã II', 'Itapuã III',
    'Jardim Terra Nova', 'Jardim Valéria', 'Lobato', 'Luiz Anselmo', 'Mirantes de Periperi',
    'Pero Vaz', 'Pituba', 'São Cristóvão', 'São Marcos', 'Vista Alegre',
  ]);
  assert.deepEqual(new Set(CHURCH_SUGGESTIONS), new Set([...SALVADOR_CHURCHES, 'Lauro de Freitas', 'EAD']));
  assert.equal(CHURCH_SUGGESTIONS.includes('Remoto'), false);
  assert.deepEqual(new Set(STUDENT_CHURCH_SUGGESTIONS), new Set([...SALVADOR_CHURCHES, 'Lauro de Freitas']));
  assert.equal(STUDENT_CHURCH_SUGGESTIONS.some(name => ['EAD', 'Remoto'].includes(name)), false);
  for (const name of [...COURSE_SUGGESTIONS, ...CHURCH_SUGGESTIONS]) assert.equal(catalogNameError(name), '');
  assert.equal(catalogNameError('Clarinete'), '');
  assert.equal(catalogNameError('Mirantes de Periperi'), '');
});

test('nome da localidade não exibe a sigla da igreja', () => {
  assert.equal(churchName(' ICM Jardim Valéria '), 'Jardim Valéria');
  assert.equal(churchName('ICM - Pituba'), 'Pituba');
  assert.equal(churchName('IAPI'), 'IAPI');
  assert.equal(churchName('São Marcos'), 'São Marcos');
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
