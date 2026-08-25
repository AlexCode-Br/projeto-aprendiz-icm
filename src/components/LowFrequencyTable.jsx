import React, { useState, useMemo } from 'react';

const LowFrequencyTable = ({ students = [], onSelectStudent }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCourse, setSelectedCourse] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    const allCourses = useMemo(() => [...new Set(students.flatMap(s => s.curso))].sort(), [students]);

    const filteredData = useMemo(() => {
        return students.filter(student => {
            const matchesSearch = student.nome.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesCourse = selectedCourse === '' || student.curso.includes(selectedCourse);
            return matchesSearch && matchesCourse;
        });
    }, [students, searchTerm, selectedCourse]);

    const paginatedData = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredData.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredData, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);

    return (
        <div className="panel mt-6 overflow-hidden fade-in-up delay-700">
            <div className="p-4 md:p-6"><h3 className="text-lg font-semibold text-text-default">Alunos com Baixa Frequência (&lt;75%)</h3></div>
            
            <div className="p-4 md:px-6 border-y border-border bg-gray-50 dark:bg-surface/30">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="search-low-frequency" className="form-label">Pesquisar por aluno</label>
                        <input 
                            type="text" 
                            id="search-low-frequency" 
                            placeholder="Nome do aluno..." 
                            className="form-control"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div>
                        <label htmlFor="low-frequency-course" className="form-label">Filtrar por curso</label>
                         <select 
                            id="low-frequency-course"
                            className="form-control"
                            value={selectedCourse}
                            onChange={(e) => { setSelectedCourse(e.target.value); setCurrentPage(1); }}
                         >
                            <option value="">Todos os Cursos</option>
                            {allCourses.map(course => <option key={course} value={course}>{course}</option>)}
                         </select>
                    </div>
                </div>
            </div>
            
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left text-text-default">
                    <thead className="bg-gray-50 dark:bg-surface/30 text-xs uppercase text-text-muted">
                        <tr>
                            <th scope="col" className="px-6 py-3 whitespace-nowrap">Curso</th>
                            <th scope="col" className="px-6 py-3 whitespace-nowrap">Aluno</th>
                            <th scope="col" className="px-6 py-3 whitespace-nowrap">Frequência</th>
                            <th scope="col" className="px-6 py-3 text-center whitespace-nowrap">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.length > 0 ? paginatedData.map(student => (
                            <tr key={student.contato} className="border-b border-border hover:bg-gray-50 dark:hover:bg-gray-50/10 transition-colors duration-200">
                                <td className="px-6 py-4 font-medium">{student.curso.join(', ')}</td>
                                <td className="px-6 py-4">{student.nome}</td>
                                <td className="px-6 py-4"><span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-danger text-text-inverse">{student.frequencia}%</span></td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center space-x-2">
                                        <button 
                                            type="button"
                                            aria-label={`Visualizar ${student.nome}`}
                                            className="icon-button text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-500/20"
                                            title="Visualizar Aluno"
                                            onClick={() => onSelectStudent(student)}
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="4" className="text-center py-10 text-text-muted">Nenhum aluno encontrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
             <div className="flex flex-col gap-4 border-t border-border p-4 sm:flex-row sm:items-center sm:justify-between">
                {totalPages > 1 && (
                    <>
                        <div className="flex-1 text-sm text-text-muted">
                            Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredData.length)} a {Math.min(currentPage * itemsPerPage, filteredData.length)} de {filteredData.length} resultados
                        </div>
                        <div className="flex items-center space-x-1">
                            <button 
                                type="button"
                                aria-label="Página anterior"
                                className="icon-button min-h-10 min-w-10 disabled:text-gray-400 disabled:cursor-not-allowed"
                                onClick={() => setCurrentPage(p => p - 1)}
                                disabled={currentPage === 1}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7"></path></svg>
                            </button>
                            {[...Array(totalPages).keys()].map(i => (
                               <button 
                                    type="button"
                                    aria-label={`Página ${i + 1}`}
                                    aria-current={currentPage === i + 1 ? 'page' : undefined}
                                    key={i + 1}
                                    className={`min-h-10 min-w-10 rounded-md px-3 py-1 ${currentPage === i + 1 ? 'bg-primary text-white' : 'hover:bg-gray-100 dark:hover:bg-gray-50/10'}`}
                                    onClick={() => setCurrentPage(i + 1)}
                                >
                                    {i + 1}
                                </button>
                            ))}
                            <button 
                                type="button"
                                aria-label="Próxima página"
                                className="icon-button min-h-10 min-w-10 disabled:text-gray-400 disabled:cursor-not-allowed"
                                onClick={() => setCurrentPage(p => p + 1)}
                                disabled={currentPage === totalPages}
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default LowFrequencyTable;
