import React, { useState, useMemo } from 'react';
import FormSelect from './FormSelect';
import { EyeIcon } from './icons/index.jsx';
import Pagination from './Pagination';

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

    return (
        <div className="panel mt-6 overflow-hidden">
            <div className="p-4 md:p-5 border-b border-border">
                <h3 className="text-lg font-semibold text-text-default">Alunos com Baixa Frequência (&lt;75%)</h3>
            </div>

            <div className="p-4 md:px-5 border-b border-border bg-surface">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="search-low-frequency" className="form-label">Pesquisar por aluno</label>
                        <input
                            type="search"
                            id="search-low-frequency"
                            placeholder="Nome do aluno..."
                            className="form-control"
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    <div>
                        <label htmlFor="low-frequency-course" className="form-label">Filtrar por curso</label>
                        <FormSelect
                            id="low-frequency-course"
                            value={selectedCourse}
                            onChange={(e) => { setSelectedCourse(e.target.value); setCurrentPage(1); }}
                            options={allCourses}
                            placeholder="Todos os Cursos"
                        />
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="table-base">
                    <thead>
                        <tr>
                            <th scope="col">Curso</th>
                            <th scope="col">Aluno</th>
                            <th scope="col">Frequência</th>
                            <th scope="col" className="text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {paginatedData.length > 0 ? paginatedData.map(student => (
                            <tr key={student.contato} className="border-t border-border hover:bg-surface-hover transition-colors">
                                <td>{student.curso.join(', ')}</td>
                                <td className="font-medium text-text-default">{student.nome}</td>
                                <td><span className="badge badge-danger">{student.frequencia}%</span></td>
                                <td className="text-right">
                                    <button
                                        type="button"
                                        aria-label={`Visualizar ${student.nome}`}
                                        className="icon-btn"
                                        title="Visualizar Aluno"
                                        onClick={() => onSelectStudent(student)}
                                    >
                                        <EyeIcon className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        )) : (
                            <tr><td colSpan="4" className="text-center py-10 text-text-muted">Nenhum aluno encontrado.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={filteredData.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
            />
        </div>
    );
};

export default LowFrequencyTable;
