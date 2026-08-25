import React from 'react';

const DynamicReportTable = ({ columns, data, loading }) => {
    if (loading) {
        return <div className="p-6 text-center text-text-muted">Carregando dados do relatório...</div>;
    }

    if (!data || data.length === 0) {
        return <div className="p-6 text-center text-text-muted">Nenhum dado para exibir. Por favor, ajuste os filtros e gere um novo relatório.</div>;
    }

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border">
                <thead className="bg-surface">
                    <tr>
                        {columns.map((col) => (
                            <th key={col.accessor} scope="col" className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase tracking-wider">
                                {col.header}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {data.map((row, rowIndex) => (
                        <tr key={rowIndex} className="hover:bg-border/50">
                            {columns.map((col) => (
                                <td key={col.accessor} className="px-6 py-4 whitespace-nowrap text-sm text-text-default">
                                    {row[col.accessor] !== null && row[col.accessor] !== undefined ? String(row[col.accessor]) : 'N/A'}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
};

export default DynamicReportTable;