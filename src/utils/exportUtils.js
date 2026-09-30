const projectLogoUrl = new URL('../assets/projeto-aprendiz-logo.png', import.meta.url).href;
let pdfModulesPromise;

const loadPdfModules = () => {
  pdfModulesPromise ||= Promise.all([import('jspdf'), import('jspdf-autotable')])
    .then(([pdfModule, tableModule]) => ({ jsPDF: pdfModule.jsPDF, autoTable: tableModule.default }));
  return pdfModulesPromise;
};

const COLORS = {
  primary: [183, 28, 28],
  primaryDark: [127, 29, 29],
  text: [31, 41, 55],
  muted: [107, 114, 128],
  border: [222, 224, 228],
  surface: [247, 247, 248],
  success: [22, 101, 52],
};

const formatDate = value => {
  if (!value) return '';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}/${month}/${year}` : String(value);
};

const formatGeneratedAt = value => new globalThis.Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: 'America/Sao_Paulo',
}).format(value ? new Date(value) : new Date());

const frequencyLabel = value => Number.isFinite(value) ? `${value}%` : 'Sem chamadas';
const attendanceMark = status => ({ presente: 'P', ausente: 'F', justificado: 'J' })[status] || '-';
const chunksOf = (items, size) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, (index + 1) * size));
const pdfText = value => String(value ?? '').replace(/[‐‑‒–—―]/g, '-');
const classTitle = course => {
  const label = pdfText(course.turma).trim();
  const name = pdfText(course.curso).trim();
  if (!label) return name;
  return label.toLocaleLowerCase('pt-BR').startsWith(name.toLocaleLowerCase('pt-BR')) ? label : `${name} - ${label}`;
};

const readImageAsDataUrl = async url => {
  try {
    const response = await fetch(url);
    if (!response.ok) return '';
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch {
    return '';
  }
};

const addContainedImage = (doc, dataUrl, x, y, maxWidth, maxHeight) => {
  if (!dataUrl) return false;
  try {
    const properties = doc.getImageProperties(dataUrl);
    const ratio = properties.width / properties.height;
    const width = Math.min(maxWidth, maxHeight * ratio);
    const height = width / ratio;
    doc.addImage(dataUrl, 'PNG', x, y + (maxHeight - height) / 2, width, height, undefined, 'FAST');
    return true;
  } catch {
    return false;
  }
};

const scheduleLabel = schedules => {
  if (!Array.isArray(schedules) || !schedules.length) return 'Horário a definir';
  const weekdays = {
    domingo: 'Domingo', segunda: 'Segunda-feira', terca: 'Terça-feira', quarta: 'Quarta-feira',
    quinta: 'Quinta-feira', sexta: 'Sexta-feira', sabado: 'Sábado',
  };
  return schedules.map(item => `${weekdays[item.weekday] || item.weekday} às ${String(item.start_time || '').slice(0, 5)}`).join(' | ');
};

/** Monta o relatório completo de frequência com os recursos visuais já carregados. */
const buildAttendanceReportPdf = (report, { departmentLogo = '', projectLogo = '' } = {}, { jsPDF, autoTable }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;
  const contentWidth = pageWidth - margin * 2;
  const bottomLimit = pageHeight - 20;
  doc.setProperties({
    title: 'Relatório de frequência - Projeto Aprendiz',
    subject: 'Frequência das turmas do professor',
    author: 'Projeto Aprendiz',
    creator: 'Projeto Aprendiz',
  });

  const drawFirstPageHeader = () => {
    doc.setDrawColor(...COLORS.primary);
    doc.setLineWidth(1.2);
    doc.line(0, 0.8, pageWidth, 0.8);
    const leftLogo = addContainedImage(doc, departmentLogo, margin, 8, 45, 16);
    const rightLogo = addContainedImage(doc, projectLogo, pageWidth - margin - 43, 6, 43, 19);
    if (!leftLogo) {
      doc.setTextColor(...COLORS.primaryDark);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.text('DEPARTAMENTO DE LOUVOR', margin, 17);
    }
    if (!rightLogo) {
      doc.setTextColor(...COLORS.primary);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.text('PROJETO APRENDIZ', pageWidth - margin, 17, { align: 'right' });
    }
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.35);
    doc.line(margin, 31, pageWidth - margin, 31);
  };

  drawFirstPageHeader();
  doc.setTextColor(...COLORS.text);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Relatório de frequência', margin, 43);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.muted);
  doc.text('Acompanhamento das chamadas e da participação dos alunos', margin, 49);

  const metadata = report?.metadata || {};
  const reportSummary = report?.resumo || {};
  const filter = metadata.filtros || {};
  const periodText = filter.dataInicio || filter.dataFim
    ? `${filter.dataInicio ? formatDate(filter.dataInicio) : 'início do período'} a ${filter.dataFim ? formatDate(filter.dataFim) : 'hoje'}`
    : 'Todo o período letivo';

  doc.setFillColor(...COLORS.surface);
  doc.roundedRect(margin, 55, contentWidth, 23, 2.5, 2.5, 'F');
  doc.setFontSize(8);
  doc.setTextColor(...COLORS.muted);
  doc.text('PROFESSOR', margin + 5, 62);
  doc.text('PERÍODO DO RELATÓRIO', margin + 69, 62);
  doc.text('PERÍODO LETIVO', margin + 128, 62);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9.5);
  doc.setTextColor(...COLORS.text);
  doc.text(pdfText(metadata.professor?.nome || 'Professor'), margin + 5, 69, { maxWidth: 58 });
  doc.text(periodText, margin + 69, 69, { maxWidth: 54 });
  doc.text(pdfText(metadata.periodoLetivo?.nome || 'Atual'), margin + 128, 69, { maxWidth: 48 });

  const metrics = [
    ['TURMAS', reportSummary.turmas ?? 0],
    ['ALUNOS', reportSummary.alunos ?? 0],
    ['CHAMADAS', reportSummary.chamadas ?? 0],
    ['FREQUÊNCIA GERAL', frequencyLabel(reportSummary.frequencia)],
  ];
  const cardGap = 3;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  metrics.forEach(([label, value], index) => {
    const x = margin + index * (cardWidth + cardGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(...COLORS.border);
    doc.roundedRect(x, 84, cardWidth, 20, 2.5, 2.5, 'FD');
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...COLORS.muted);
    doc.text(label, x + 4, 91);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...(index === 3 && Number.isFinite(reportSummary.frequencia) ? COLORS.success : COLORS.text));
    doc.text(String(value), x + 4, 99);
  });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(...COLORS.muted);
  doc.text('A frequência considera presenças e ausências justificadas como participação.', margin, 111);

  let cursorY = 119;
  const ensureSpace = height => {
    if (cursorY + height <= bottomLimit) return;
    doc.addPage();
    cursorY = 19;
  };

  const classes = Array.isArray(report?.turmas) ? report.turmas : [];
  if (!classes.length) {
    doc.setFillColor(...COLORS.surface);
    doc.roundedRect(margin, cursorY, contentWidth, 34, 3, 3, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...COLORS.text);
    doc.text('Nenhuma turma encontrada', margin + 6, cursorY + 12);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...COLORS.muted);
    doc.text('Revise os filtros selecionados ou confirme o vínculo das turmas com o professor.', margin + 6, cursorY + 21, { maxWidth: contentWidth - 12 });
  }

  classes.forEach((course, classIndex) => {
    ensureSpace(42);
    doc.setFillColor(...COLORS.surface);
    doc.roundedRect(margin, cursorY, contentWidth, 27, 2.5, 2.5, 'F');
    doc.setFillColor(...COLORS.primary);
    doc.roundedRect(margin, cursorY, 2.2, 27, 1.1, 1.1, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(...COLORS.text);
    doc.text(classTitle(course), margin + 6, cursorY + 8, { maxWidth: 105 });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...COLORS.muted);
    doc.text(`${pdfText(course.local || 'Local a definir')} | ${pdfText(scheduleLabel(course.horarios))}`, margin + 6, cursorY + 15, { maxWidth: 112 });
    doc.text(`${course.resumo?.alunos ?? 0} aluno(s) | ${course.resumo?.chamadas ?? 0} chamada(s)`, margin + 6, cursorY + 22);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('FREQUÊNCIA DA TURMA', pageWidth - margin - 5, cursorY + 9, { align: 'right' });
    doc.setFontSize(15);
    doc.setTextColor(...(Number.isFinite(course.resumo?.frequencia) ? COLORS.success : COLORS.muted));
    doc.text(frequencyLabel(course.resumo?.frequencia), pageWidth - margin - 5, cursorY + 19, { align: 'right' });
    cursorY += 33;

    const students = Array.isArray(course.alunos) ? course.alunos : [];
    const calls = Array.isArray(course.chamadas) ? [...course.chamadas].sort((left, right) => String(left.data).localeCompare(String(right.data))) : [];
    if (students.length && calls.length) {
      ensureSpace(34);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(...COLORS.text);
      doc.text('Mapa de chamadas por aluno', margin, cursorY);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.2);
      doc.setTextColor(...COLORS.muted);
      doc.text('P = presente | F = falta | J = justificada | - = sem registro', margin, cursorY + 5);
      cursorY += 9;

      const studentAttendance = new Map(students.map(student => [student.id, new Map((student.frequencias || []).map(item => [Number(item.chamadaId), item.status]))]));
      const callChunks = chunksOf(calls, 7);
      callChunks.forEach((chunk, chunkIndex) => {
        ensureSpace(Math.min(230, 8 + (students.length + 1) * 6));
        if (callChunks.length > 1) {
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(7.5);
          doc.setTextColor(...COLORS.muted);
          doc.text(`Datas ${chunkIndex + 1} de ${callChunks.length}`, margin, cursorY);
          cursorY += 3;
        }
        const dateColumnWidth = Math.min(16, (contentWidth - 58 - 24) / chunk.length);
        const frequencyColumnIndex = chunk.length + 1;
        const columnStyles = { 0: { cellWidth: contentWidth - dateColumnWidth * chunk.length - 24 }, [frequencyColumnIndex]: { cellWidth: 24, halign: 'center', fontStyle: 'bold' } };
        chunk.forEach((_, index) => { columnStyles[index + 1] = { cellWidth: dateColumnWidth, halign: 'center', fontStyle: 'bold' }; });
        autoTable(doc, {
          startY: cursorY,
          margin: { left: margin, right: margin, top: 18, bottom: 20 },
          head: [['Aluno', ...chunk.map(call => formatDate(call.data).slice(0, 5)), 'Freq.']],
          body: students.map(student => [
            pdfText(student.nome),
            ...chunk.map(call => attendanceMark(studentAttendance.get(student.id)?.get(call.id))),
            frequencyLabel(student.frequencia),
          ]),
          theme: 'grid',
          styles: { font: 'helvetica', fontSize: 8, textColor: COLORS.text, lineColor: COLORS.border, lineWidth: 0.2, cellPadding: 1.9, valign: 'middle' },
          headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.2, halign: 'center' },
          alternateRowStyles: { fillColor: COLORS.surface },
          columnStyles,
          didParseCell: data => {
            if (data.section !== 'body') return;
            if (data.column.index === frequencyColumnIndex) {
              const numeric = Number.parseInt(String(data.cell.raw), 10);
              data.cell.styles.textColor = !Number.isFinite(numeric) ? COLORS.muted : numeric < 75 ? COLORS.primary : COLORS.success;
              return;
            }
            if (data.column.index < 1 || data.column.index > chunk.length) return;
            if (data.cell.raw === 'P') data.cell.styles.textColor = COLORS.success;
            else if (data.cell.raw === 'F') data.cell.styles.textColor = COLORS.primary;
            else if (data.cell.raw === 'J') data.cell.styles.textColor = [146, 86, 0];
            else data.cell.styles.textColor = COLORS.muted;
          },
        });
        cursorY = doc.lastAutoTable.finalY + 5;
      });
    }

    ensureSpace(28);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.text);
    doc.text('Resumo individual', margin, cursorY);
    cursorY += 4;
    if (students.length) {
      autoTable(doc, {
        startY: cursorY,
        margin: { left: margin, right: margin, top: 18, bottom: 20 },
        head: [['Aluno', 'Chamadas', 'Pres.', 'Faltas', 'Justif.', 'Frequência']],
        body: students.map(student => [pdfText(student.nome), String(student.chamadas), String(student.presentes), String(student.ausentes), String(student.justificados), frequencyLabel(student.frequencia)]),
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.2, textColor: COLORS.text, lineColor: COLORS.border, lineWidth: 0.2, cellPadding: 2.4, valign: 'middle' },
        headStyles: { fillColor: COLORS.primary, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: COLORS.surface },
        columnStyles: {
          0: { cellWidth: 69 }, 1: { cellWidth: 22, halign: 'center' }, 2: { cellWidth: 20, halign: 'center' },
          3: { cellWidth: 20, halign: 'center' }, 4: { cellWidth: 20, halign: 'center' }, 5: { cellWidth: 31, halign: 'center', fontStyle: 'bold' },
        },
        didParseCell: data => {
          if (data.section !== 'body' || data.column.index !== 5) return;
          const numeric = Number.parseInt(String(data.cell.raw), 10);
          if (Number.isFinite(numeric) && numeric < 75) data.cell.styles.textColor = COLORS.primary;
          else if (Number.isFinite(numeric)) data.cell.styles.textColor = COLORS.success;
        },
      });
      cursorY = doc.lastAutoTable.finalY + 7;
    } else {
      doc.setFillColor(...COLORS.surface);
      doc.roundedRect(margin, cursorY, contentWidth, 15, 2, 2, 'F');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(...COLORS.muted);
      doc.text('Esta turma ainda não possui alunos ativos.', margin + 5, cursorY + 9.5);
      cursorY += 22;
    }

    ensureSpace(30);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...COLORS.text);
    doc.text('Chamadas realizadas', margin, cursorY);
    cursorY += 4;
    if (calls.length) {
      autoTable(doc, {
        startY: cursorY,
        margin: { left: margin, right: margin, top: 18, bottom: 20 },
        head: [['Data', 'Registros', 'Presentes', 'Faltas', 'Justificadas']],
        body: calls.map(call => [formatDate(call.data), String(call.registros), String(call.presentes), String(call.ausentes), String(call.justificados)]),
        theme: 'grid',
        styles: { font: 'helvetica', fontSize: 8.2, textColor: COLORS.text, lineColor: COLORS.border, lineWidth: 0.2, cellPadding: 2.35, halign: 'center' },
        headStyles: { fillColor: [75, 85, 99], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
        alternateRowStyles: { fillColor: COLORS.surface },
        columnStyles: { 0: { cellWidth: 46 }, 1: { cellWidth: 34 }, 2: { cellWidth: 34 }, 3: { cellWidth: 34 }, 4: { cellWidth: 34 } },
      });
      cursorY = doc.lastAutoTable.finalY + 9;
    } else {
      doc.setFillColor(255, 248, 235);
      doc.setDrawColor(245, 190, 92);
      doc.roundedRect(margin, cursorY, contentWidth, 16, 2, 2, 'FD');
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(120, 72, 0);
      doc.text('Nenhuma chamada foi registrada para esta turma no período selecionado.', margin + 5, cursorY + 10);
      cursorY += 23;
    }

    if (classIndex < classes.length - 1) {
      ensureSpace(9);
      doc.setDrawColor(...COLORS.border);
      doc.line(margin, cursorY, pageWidth - margin, cursorY);
      cursorY += 9;
    }
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    if (page > 1) {
      doc.setDrawColor(...COLORS.primary);
      doc.setLineWidth(0.8);
      doc.line(0, 0.8, pageWidth, 0.8);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(...COLORS.primaryDark);
      doc.text('PROJETO APRENDIZ - RELATÓRIO DE FREQUÊNCIA', margin, 10);
    }
    doc.setDrawColor(...COLORS.border);
    doc.setLineWidth(0.25);
    doc.line(margin, pageHeight - 14, pageWidth - margin, pageHeight - 14);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.2);
    doc.setTextColor(...COLORS.muted);
    doc.text(`Gerado em ${formatGeneratedAt(metadata.geradoEm)} | Uso interno`, margin, pageHeight - 8.5);
    doc.text(`Página ${page} de ${pageCount}`, pageWidth - margin, pageHeight - 8.5, { align: 'right' });
  }

  return {
    blob: doc.output('blob'),
    arrayBuffer: doc.output('arraybuffer'),
    fileName: `relatorio_frequencia_${new Date().toISOString().slice(0, 10)}.pdf`,
  };
};

/** Carrega as identidades visuais e prepara o Blob usado na prévia/download do navegador. */
export const createAttendanceReportPdf = async report => {
  const [{ jsPDF, autoTable }, departmentLogo, projectLogo] = await Promise.all([
    loadPdfModules(),
    readImageAsDataUrl('/departamento-louvor-logo.png'),
    readImageAsDataUrl(projectLogoUrl),
  ]);
  return buildAttendanceReportPdf(report, { departmentLogo, projectLogo }, { jsPDF, autoTable });
};
