import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Exporta os dados de uma tabela para um arquivo PDF.
 * @param {string} title - O título do documento PDF.
 * @param {Array<string>} headers - Os cabeçalhos das colunas da tabela.
 * @param {Array<Array<string>>} data - Os dados da tabela (array de arrays).
 */
export const exportToPdf = (title, headers, data) => {
  const doc = new jsPDF();

  doc.text(title, 14, 20);

  autoTable(doc, {
    startY: 30,
    head: [headers],
    body: data,
    theme: 'striped',
    headStyles: {
      fillColor: [183, 28, 28] // Cor primária --color-primary
    },
    styles: {
      font: 'helvetica',
      fontSize: 10
    },
  });

  // Gera um nome de arquivo a partir do título e da data atual
  const fileName = `${title.toLowerCase().replace(/ /g, '_')}_${new Date().toLocaleDateString('pt-BR').replace(/\//g, '-')}.pdf`;
  doc.save(fileName);
};
