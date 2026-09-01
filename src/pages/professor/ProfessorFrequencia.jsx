import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import FormSelect from '../../components/FormSelect';

const localToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

const attendanceOptions = [
    { value: 'presente', label: 'Presente', selected: 'border-success bg-success/10 text-success' },
    { value: 'ausente', label: 'Ausente', selected: 'border-danger bg-danger/10 text-danger' },
    { value: 'justificado', label: 'Justificada', selected: 'border-warning bg-warning/10 text-warning' },
];

const ProfessorFrequencia = () => {
    // --- Estados ---
    const [cursos, setCursos] = useState([]);
    const [selectedCurso, setSelectedCurso] = useState(null);
    const [dataAula, setDataAula] = useState(localToday());
    const [alunos, setAlunos] = useState([]);
    const [frequencias, setFrequencias] = useState({}); // { alunoId: 'presente' }
    const [loading, setLoading] = useState(false);
    const [loadingAlunos, setLoadingAlunos] = useState(false);
    const [chamadaRegistrada, setChamadaRegistrada] = useState(false);

    const { showToast } = useToast();

    // Carrega os cursos do professor logado
    useEffect(() => {
        const fetchCursos = async () => {
            try {
                const response = await api.get('/professores/meus-cursos'); // Rota específica do professor
                setCursos(response.data.map(c => {
                    const customLabel = c.label && c.label !== `${c.nome} — ${c.local}` ? ` — ${c.label}` : '';
                    const schedule = c.weekday ? ` · ${c.weekday}${c.start_time ? ` ${c.start_time}` : ''}` : '';
                    return { value: c.id, label: `${c.nome}${customLabel} · ${c.local}${schedule}` };
                }));
            } catch (error) {
                showToast('Erro ao carregar seus cursos.', 'error');
            }
        };
        fetchCursos();
    }, [showToast]);

    // Busca os alunos e suas frequências ao mudar o curso ou a data
    const fetchAlunosEFrequencia = useCallback(async () => {
        if (!selectedCurso || !dataAula) {
            setAlunos([]);
            return;
        }
        setLoadingAlunos(true);
        try {
            const params = { curso_id: selectedCurso.value, data: dataAula };
            const response = await api.get('/frequencia', { params });

            const loadedStudents = response.data.alunos || [];
            setAlunos(loadedStudents);
            setChamadaRegistrada(Boolean(response.data.registrada));

            // Preenche o estado de frequências com os dados recebidos
            const initialFrequencias = loadedStudents.reduce((acc, aluno) => {
                acc[aluno.id] = aluno.status || 'presente';
                return acc;
            }, {});
            setFrequencias(initialFrequencias);

        } catch (error) {
            showToast('Erro ao carregar alunos e frequências.', 'error');
            setAlunos([]);
            setChamadaRegistrada(false);
        } finally {
            setLoadingAlunos(false);
        }
    }, [selectedCurso, dataAula, showToast]);

    useEffect(() => {
        fetchAlunosEFrequencia();
    }, [fetchAlunosEFrequencia]);

    // --- Handlers ---
    const handleFrequenciaChange = (alunoId, status) => {
        setFrequencias(prev => ({ ...prev, [alunoId]: status }));
        setChamadaRegistrada(false);
    };

    const handleSalvarFrequencia = async () => {
        if (!selectedCurso || alunos.length === 0) {
            showToast('Selecione um curso e carregue os alunos primeiro.', 'warning');
            return;
        }

        const unrecorded = Object.values(frequencias).some(status => !status);
        if (unrecorded) {
            showToast('Por favor, preencha a frequência de todos os alunos.', 'warning');
            return;
        }

        setLoading(true);

        // Prepara os dados para a API
        const payload = {
            curso_id: selectedCurso.value,
            data_aula: dataAula,
            frequencias: Object.entries(frequencias).map(([aluno_id, status]) => ({
                aluno_id: parseInt(aluno_id, 10),
                status
            }))
        };

        try {
            await api.post('/frequencia', payload);
            showToast('Chamada salva com sucesso!', 'success');
            setChamadaRegistrada(true);
            window.dispatchEvent(new Event('attendance:updated'));
            await fetchAlunosEFrequencia();
        } catch (error) {
            showToast(error.response?.data?.message || 'Erro ao salvar a chamada.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="page-header"><div><h1 className="page-title">Chamada</h1><p className="page-description">Todos começam como presentes. Altere apenas ausências e justificativas antes de salvar.</p></div></div>

            {/* Filtros */}
            <section className="panel mb-6 p-4 sm:p-6" aria-label="Seleção da aula">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="curso-select" className="form-label">Turma</label>
                        <FormSelect
                            id="curso-select"
                            options={cursos}
                            value={selectedCurso?.value}
                            onChange={(e) => setSelectedCurso(cursos.find(c => String(c.value) === String(e.target.value)) || null)}
                            placeholder="Selecione uma turma..."
                        />
                    </div><label><span className="form-label">Data da aula</span><input
                        type="date"
                        value={dataAula}
                        max={localToday()}
                        onChange={(e) => setDataAula(e.target.value)}
                        className="form-control"
                    /></label>
                </div>
            </section>

            {alunos.length > 0 && !loadingAlunos && (
                <div className="mb-4 flex flex-wrap items-center gap-2" aria-live="polite">
                    {attendanceOptions.map(option => <span key={option.value} className={`rounded-full border px-3 py-1 text-xs font-semibold ${option.selected}`}>{option.label}: {Object.values(frequencias).filter(value => value === option.value).length}</span>)}
                    {chamadaRegistrada && <span className="rounded-full bg-success/10 px-3 py-1 text-xs font-semibold text-success">Chamada registrada</span>}
                </div>
            )}

            <div className="panel overflow-x-auto">
                 <table className="min-w-full divide-y divide-border">
                    <thead className="bg-surface">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Aluno</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-text-muted uppercase">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                       {loadingAlunos ? (
                            Array.from({ length: 5 }, (_, index) => <tr key={index}><td colSpan="2" className="px-6 py-4"><div className="skeleton h-11 rounded-lg" /></td></tr>)
                        ) : !selectedCurso ? (
                            <tr><td colSpan="2" className="text-center py-10 text-text-muted">Por favor, selecione um curso para começar.</td></tr>
                        ) : alunos.length > 0 ? (
                            alunos.map((aluno) => (
                                <tr key={aluno.id} className="hover:bg-border/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-default">{aluno.nome}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex min-w-max items-center gap-2" role="group" aria-label={`Frequência de ${aluno.nome}`}>
                                            {attendanceOptions.map((option) => (
                                                <button
                                                    type="button"
                                                    key={option.value}
                                                    onClick={() => handleFrequenciaChange(aluno.id, option.value)}
                                                    aria-pressed={frequencias[aluno.id] === option.value}
                                                    className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${frequencias[aluno.id] === option.value ? option.selected : 'border-border bg-surface text-text-muted hover:bg-surface-hover'}`}
                                                >
                                                    {option.label}
                                                </button>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                             <tr><td colSpan="2" className="px-6 py-12 text-center text-text-muted"><strong className="block text-text-default">Nenhum aluno nesta turma</strong><span className="mt-1 block text-sm">Peça ao gestor para conferir as matrículas do período selecionado.</span></td></tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Botão de Salvar */}
            {alunos.length > 0 && (
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleSalvarFrequencia}
                        disabled={loading}
                        className="btn btn-primary px-6"
                    >
                        {loading ? 'Salvando...' : 'Salvar chamada'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProfessorFrequencia;
