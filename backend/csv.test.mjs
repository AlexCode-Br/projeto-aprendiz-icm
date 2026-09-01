import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCsv } from '../src/utils/csv.js';

test('CSV usa UTF-8, separador regional e protege fórmulas de planilha', () => {
  const csv = buildCsv(['Nome', 'Observação', 'Quantidade'], [
    ['Maria Silva', 'Texto com "aspas"; e quebra\nde linha', 3],
    ['=HYPERLINK("https://exemplo.test")', '+CMD', -2],
  ]);
  assert.ok(csv.startsWith('\uFEFF"Nome";"Observação";"Quantidade"\r\n'));
  assert.match(csv, /"Texto com ""aspas""; e quebra\nde linha"/);
  assert.match(csv, /"'=HYPERLINK/);
  assert.match(csv, /"'\+CMD"/);
  assert.match(csv, /;"-2"$/);
});

test('CSV rejeita linhas incompletas em vez de gerar colunas deslocadas', () => {
  assert.throws(() => buildCsv(['A', 'B'], [['somente A']]), /mesmo número de colunas/);
});
