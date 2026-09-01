import React from 'react';
import { Link } from 'react-router-dom';

const RecentActivities = ({ students = [] }) => {
    return (
        <div className="panel p-4   md:p-6">
            <h3 className="text-lg font-semibold text-text-default">Últimas Inscrições</h3>
            <ul className="mt-4 -mx-2 space-y-1">
                {students.map((student, index) => (
                    <li key={index}>
                        <Link to="/gestor/alunos" className="flex items-center space-x-3 p-2 rounded-lg hover:bg-surface-hover transition-colors transition-colors duration-200">
                            <img
                                className="w-10 h-10 rounded-full"
                                src={`https://placehold.co/100x100/b71c1c/FFFFFF?text=${student.nome.charAt(0)}`}
                                alt="Avatar"
                            />
                            <div>
                                <p className="font-semibold text-sm text-text-default">{student.nome}</p>
                                <p className="text-xs text-text-muted">{student.curso} · {student.local}</p>
                            </div>
                        </Link>
                    </li>
                ))}
                {!students.length && <li className="p-5 text-sm text-text-muted text-center"><strong className="block text-text-default">Nenhuma inscrição recente</strong><span className="mt-1 block">Os novos alunos do período aparecerão aqui.</span></li>}
            </ul>
        </div>
    );
};

export default RecentActivities;
