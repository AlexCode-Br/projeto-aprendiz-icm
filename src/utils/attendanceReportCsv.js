import { buildCsv } from './csv.js';

const formatDate = value => {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

const frequencyText = value => Number.isFinite(value) ? `${value}%` : 'Sem chamadas';

const classTitle = course => {
  const label = String(course.turma || '').trim().replace(/[‐‑‒–—―]/g, '-');
  const name = String(course.curso || '').trim();
  if (!label) return name;
  return label.toLocaleLowerCase('pt-BR').startsWith(name.toLocaleLowerCase('pt-BR')) ? label : `${name} - ${label}`;
};

const scheduleText = schedules => {
  if (!schedules?.length) return 'Horário a definir';
  const weekdays = {
    domingo: 'Domingo', segunda: 'Segunda-feira', terca: 'Terça-feira', quarta: 'Quarta-feira',
    quinta: 'Quinta-feira', sexta: 'Sexta-feira', sabado: 'Sábado',
  };
  return schedules
    .map(item => `${weekdays[item.weekday] || item.weekday} às ${String(item.start_time || '').slice(0, 5)}`)
    .join(' | ');
};

const attendanceMark = (student, callId) => ({
  presente: 'P',
  ausente: 'F',
  justificado: 'J',
})[(student.frequencias || []).find(item => Number(item.chamadaId) === Number(callId))?.status] || '-';

const reportPeriodText = report => {
  const filters = report.metadata?.filtros || {};
  if (!filters.dataInicio && !filters.dataFim) return 'Todo o período letivo';
  return `${filters.dataInicio ? formatDate(filters.dataInicio) : 'Início do período'} a ${filters.dataFim ? formatDate(filters.dataFim) : 'Hoje'}`;
};

const reportFileName = report => {
  const filters = report.metadata?.filtros || {};
  const period = filters.dataInicio || filters.dataFim
    ? `${filters.dataInicio || 'inicio'}_a_${filters.dataFim || 'hoje'}`
    : 'todo_periodo';
  return `relatorio_frequencia_${period}_${new Date().toISOString().slice(0, 10)}.csv`;
};

export function buildAttendanceReportCsv(report) {
  const classes = Array.isArray(report?.turmas) ? report.turmas : [];
  const callDates = [...new Set(classes.flatMap(course => (course.chamadas || []).map(call => String(call.data).slice(0, 10))))]
    .filter(Boolean)
    .sort((left, right) => left.localeCompare(right));

  const headers = [
    'Tipo de registro',
    'Professor',
    'Período letivo',
    'Período das chamadas',
    'Curso',
    'Turma',
    'Igreja ou modalidade',
    'Horários',
    'Aluno',
    ...callDates.map(formatDate),
    'Chamadas',
    'Presenças',
    'Faltas',
    'Justificadas',
    'Sem registro',
    'Frequência',
  ];

  const professor = report.metadata?.professor?.nome || 'Professor';
  const academicPeriod = report.metadata?.periodoLetivo?.nome || 'Atual';
  const period = reportPeriodText(report);
  const rows = [];

  classes.forEach(course => {
    const callsByDate = new Map((course.chamadas || []).map(call => [String(call.data).slice(0, 10), call]));
    const shared = [
      professor,
      academicPeriod,
      period,
      course.curso || '',
      classTitle(course),
      course.local || '',
      scheduleText(course.horarios),
    ];

    (course.alunos || []).forEach(student => {
      const marks = callDates.map(date => {
        const call = callsByDate.get(date);
        return call ? attendanceMark(student, call.id) : '';
      });
      rows.push([
        'Aluno',
        ...shared,
        student.nome || '',
        ...marks,
        student.chamadas ?? 0,
        student.presentes ?? 0,
        student.ausentes ?? 0,
        student.justificados ?? 0,
        student.naoRegistrados ?? 0,
        frequencyText(student.frequencia),
      ]);
    });

    const summary = course.resumo || {};
    const totalWithoutRecord = (course.alunos || []).reduce((total, student) => total + (student.naoRegistrados ?? 0), 0);
    const dateTotals = callDates.map(date => {
      const call = callsByDate.get(date);
      if (!call) return '';
      const withoutRecord = Math.max((summary.alunos ?? 0) - (call.registros ?? 0), 0);
      return `${call.presentes ?? 0} P | ${call.ausentes ?? 0} F | ${call.justificados ?? 0} J | ${withoutRecord} -`;
    });
    rows.push([
      'Resumo da turma',
      ...shared,
      'TOTAL DA TURMA',
      ...dateTotals,
      summary.chamadas ?? 0,
      summary.presentes ?? 0,
      summary.ausentes ?? 0,
      summary.justificados ?? 0,
      summary.naoRegistrados ?? totalWithoutRecord,
      frequencyText(summary.frequencia),
    ]);
  });

  return {
    headers,
    rows,
    text: buildCsv(headers, rows),
    fileName: reportFileName(report),
    callDates,
    period,
    legend: 'P = presente | F = falta | J = justificada | - = sem registro',
  };
}
