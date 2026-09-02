import React from 'react';

const DynamicReportTable = ({ columns, data, loading }) => {
    if (loading) {
        return <div className="space-y-3 p-6" role="status" aria-label="Carregando dados do relatório">{[1,2,3,4].map(item=><div key={item} className="skeleton h-11 rounded-lg"/>)}</div>;
    }

    if (!data || data.length === 0) {
        return <div className="p-8 text-center text-text-muted"><strong className="block text-text-default">Nenhum dado para exibir</strong><span className="mt-1 block text-sm">Ajuste os filtros e gere um novo relatório.</span></div>;
    }

    return (
        <div className="table-scroll" tabIndex={0} role="region" aria-label="Resultados">
            <table className="data-table min-w-full divide-y divide-border">
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
