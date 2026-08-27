import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Pagination from '../../components/Pagination';
import { EyeIcon, SearchIcon } from '../../components/icons/index.jsx';

const ProfessorAlunos = () => {
    const navigate = useNavigate();
    const { showToast } = useToast();

    const [alunos, setAlunos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const [currentPage, setCurrentPage] = useState(1);
    const [totalAlunos, setTotalAlunos] = useState(0);
    const [itemsPerPage] = useState(15);
    const [searchTerm, setSearchTerm] = useState('');

    const fetchAlunos = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/professores/meus-alunos', {
                params: { page: currentPage, limit: itemsPerPage, search: searchTerm }
            });
            setAlunos(response.data.alunos);
            setTotalAlunos(response.data.total);
            setError(null);
        } catch (err) {
            setError("Não foi possível carregar os alunos.");
            showToast("Erro ao carregar seus alunos.", 'error');
        } finally {
            setLoading(false);
        }
    }, [currentPage, itemsPerPage, searchTerm, showToast]);

    useEffect(() => {
        const t = setTimeout(fetchAlunos, 300);
        return () => clearTimeout(t);
    }, [fetchAlunos]);

    const handleSearch = (e) => {
        setSearchTerm(e.target.value);
        setCurrentPage(1);
    };

    return (
        <div className="space-y-4">
            {/* ── Page header ─────────────────────────────────────────────────────── */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1 className="page-title">Meus Alunos</h1>
                    <p className="page-description">
                        {!loading && <>{totalAlunos} aluno{totalAlunos !== 1 ? 's' : ''} em suas turmas</>}
                    </p>
                </div>
            </div>

            {/* ── Search bar ──────────────────────────────────────────────────────── */}
            <div className="relative max-w-sm">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" aria-hidden="true" />
                <input
                    id="professor-student-search"
                    type="search"
                    placeholder="Buscar aluno por nome ou e-mail…"
                    value={searchTerm}
                    onChange={handleSearch}
                    className="form-control pl-9"
                    aria-label="Buscar aluno"
                />
                {searchTerm && (
                    <button
                        type="button"
                        aria-label="Limpar busca"
                        onClick={() => { setSearchTerm(''); setCurrentPage(1); }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 icon-btn w-6 h-6"
                    >
                        <span aria-hidden="true" className="text-xs">×</span>
                    </button>
                )}
            </div>

            {/* ── Table ───────────────────────────────────────────────────────────── */}
            <div className="panel overflow-hidden">
                {/* Desktop table */}
                <div className="overflow-x-auto hidden sm:block">
                    <table className="table-base">
                        <thead>
                            <tr>
                                <th style={{ width: '40%' }}>Aluno</th>
                                <th style={{ width: '30%' }}>Contato</th>
                                <th style={{ width: '20%' }}>Turmas</th>
                                <th className="text-right" style={{ width: '10%' }}>Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i}>
                                        <td colSpan={4}>
                                            <div className="h-8 rounded bg-surface-hover animate-pulse" />
                                        </td>
                                    </tr>
                                ))
                            ) : error ? (
                                <tr>
                                    <td colSpan={4} className="py-10 text-center text-sm text-danger">{error}</td>
                                </tr>
                            ) : alunos.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center">
                                        <p className="text-sm font-medium text-text-default mb-1">
                                            {searchTerm ? 'Nenhum aluno corresponde à busca.' : 'Nenhum aluno em suas turmas ainda.'}
                                        </p>
                                        {searchTerm && (
                                            <button type="button" className="text-xs text-primary hover:underline" onClick={() => setSearchTerm('')}>Limpar filtro</button>
                                        )}
                                    </td>
                                </tr>
                            ) : alunos.map((aluno) => (
                                <tr
                                    key={aluno.id}
                                    className="cursor-pointer"
                                    onClick={() => navigate(`/professor/alunos/${aluno.id}`)}
                                >
                                    <td>
                                        <div className="flex items-center gap-3">
                                            <img
                                                className="h-8 w-8 rounded-full object-cover flex-shrink-0 bg-surface-hover"
                                                src={aluno.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(aluno.nome)}&size=64&background=b71c1c&color=fff&bold=true`}
                                                alt=""
                                                aria-hidden="true"
                                            />
                                            <span className="text-sm font-medium text-text-default">{aluno.nome}</span>
                                        </div>
                                    </td>
                                    <td className="text-text-muted text-sm">{aluno.email}</td>
                                    <td className="text-text-muted text-sm">{aluno.cursos?.map(c => c.nome).join(', ') || '—'}</td>
                                    <td className="text-right">
                                        <button
                                            type="button"
                                            aria-label={`Ver perfil de ${aluno.nome}`}
                                            onClick={(e) => { e.stopPropagation(); navigate(`/professor/alunos/${aluno.id}`); }}
                                            className="icon-btn"
                                            title="Ver perfil"
                                        >
                                            <EyeIcon className="w-4 h-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Mobile card list */}
                <div className="sm:hidden divide-y divide-border">
                    {loading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="p-4">
                                <div className="h-4 w-2/3 rounded bg-surface-hover animate-pulse mb-2" />
                                <div className="h-3 w-1/2 rounded bg-surface-hover animate-pulse" />
                            </div>
                        ))
                    ) : alunos.map((aluno) => (
                        <div key={aluno.id} className="flex items-center gap-3 p-4">
                            <img
                                className="h-10 w-10 rounded-full object-cover flex-shrink-0 bg-surface-hover"
                                src={aluno.foto_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(aluno.nome)}&size=80&background=b71c1c&color=fff&bold=true`}
                                alt=""
                                aria-hidden="true"
                            />
                            <button
                                type="button"
                                className="min-w-0 flex-1 text-left"
                                onClick={() => navigate(`/professor/alunos/${aluno.id}`)}
                            >
                                <p className="text-sm font-medium text-text-default truncate">{aluno.nome}</p>
                                <p className="text-xs text-text-muted truncate">{aluno.cursos?.map(c => c.nome).join(', ') || aluno.email}</p>
                            </button>
                            <div className="flex items-center shrink-0">
                                <button
                                    type="button"
                                    aria-label={`Ver perfil de ${aluno.nome}`}
                                    onClick={() => navigate(`/professor/alunos/${aluno.id}`)}
                                    className="icon-btn"
                                >
                                    <EyeIcon className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <Pagination
                currentPage={currentPage}
                totalItems={totalAlunos}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
            />
        </div>
    );
};

export default ProfessorAlunos;
