import assert from 'node:assert/strict';
import test from 'node:test';
import { buildCsv } from '../src/utils/csv.js';
import { buildAttendanceReportCsv } from '../src/utils/attendanceReportCsv.js';

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

test('CSV de frequência monta uma folha de chamada por aluno e por data', () => {
  const report = {
    metadata: {
      professor: { nome: 'Marina Oliveira' },
      periodoLetivo: { nome: '2026.2' },
      filtros: { dataInicio: '', dataFim: '' },
    },
    turmas: [{
      id: 7,
      curso: 'Flauta Transversal',
      turma: 'Flauta Transversal - Turma A',
      local: 'Pituba',
      horarios: [{ weekday: 'sabado', start_time: '09:00:00' }],
      resumo: { alunos: 2, chamadas: 2, presentes: 2, ausentes: 1, justificados: 1, frequencia: 75 },
      chamadas: [
        { id: 12, data: '2026-08-08', registros: 2, presentes: 1, ausentes: 0, justificados: 1 },
        { id: 11, data: '2026-08-01', registros: 2, presentes: 1, ausentes: 1, justificados: 0 },
      ],
      alunos: [
        {
          id: 1, nome: 'Ana Souza', chamadas: 2, presentes: 2, ausentes: 0, justificados: 0,
          naoRegistrados: 0, frequencia: 100,
          frequencias: [{ chamadaId: 11, status: 'presente' }, { chamadaId: 12, status: 'presente' }],
        },
        {
          id: 2, nome: 'Bruno Lima', chamadas: 2, presentes: 0, ausentes: 1, justificados: 1,
          naoRegistrados: 0, frequencia: 50,
          frequencias: [{ chamadaId: 11, status: 'ausente' }, { chamadaId: 12, status: 'justificado' }],
        },
      ],
    }],
  };

  const result = buildAttendanceReportCsv(report);
  assert.equal(result.period, 'Todo o período letivo');
  assert.deepEqual(result.headers.slice(9, 11), ['01/08/2026', '08/08/2026']);
  assert.equal(result.rows.length, 3);
  assert.equal(result.rows[0][9], 'P');
  assert.equal(result.rows[1][9], 'F');
  assert.equal(result.rows[1][10], 'J');
  assert.equal(result.rows[2][0], 'Resumo da turma');
  assert.equal(result.rows[2][9], '1 P | 1 F | 0 J | 0 -');
  assert.ok(result.rows.every(row => row.length === result.headers.length));
  assert.match(result.text, /"Todo o período letivo"/);
  assert.doesNotMatch(result.text, /"'-"/);
  assert.match(result.fileName, /^relatorio_frequencia_todo_periodo_\d{4}-\d{2}-\d{2}\.csv$/);
});
