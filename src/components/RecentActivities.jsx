import React from 'react';
import { Link } from 'react-router-dom';
import ProfileAvatar from './ProfileAvatar';
import { ArrowUpRight } from 'lucide-react';

const RecentActivities = ({ students = [], onSelectStudent }) => {
    return (
        <div className="panel p-4   md:p-6">
            <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold text-text-default">Últimas inscrições</h2><Link to="/gestor/alunos" className="icon-button" aria-label="Ver todos os alunos"><ArrowUpRight aria-hidden="true" /></Link></div>
            <ul className="mt-4 -mx-2 space-y-1">
                {students.map((student, index) => (
                    <li key={index}>
                        <button type="button" onClick={() => onSelectStudent(student.id)} aria-label={`Ver dados de ${student.nome}`} className="flex w-full items-center space-x-3 p-2 text-left rounded-lg hover:bg-surface-hover transition-colors duration-200">
                            <ProfileAvatar name={student.nome} src={student.foto_url} />
                            <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold text-sm text-text-default">{student.nome}</p>
                                <p className="truncate text-xs text-text-muted">{student.curso} · {student.local}</p>
                            </div>
                        </button>
                    </li>
                ))}
                {!students.length && <li className="p-5 text-sm text-text-muted text-center"><strong className="block text-text-default">Nenhuma inscrição recente</strong><span className="mt-1 block">Os novos alunos do período aparecerão aqui.</span></li>}
            </ul>
        </div>
    );
};

export default RecentActivities;
