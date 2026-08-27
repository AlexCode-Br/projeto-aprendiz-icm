import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import FormSelect from '../../components/FormSelect';

const ProfessorFrequencia = () => {
    // --- Estados ---
    const [cursos, setCursos] = useState([]);
    const [selectedCurso, setSelectedCurso] = useState(null);
    const [dataAula, setDataAula] = useState(new Date().toISOString().split('T')[0]);
    const [alunos, setAlunos] = useState([]);
    const [frequencias, setFrequencias] = useState({}); // { alunoId: 'presente' }
    const [loading, setLoading] = useState(false);
    const [loadingAlunos, setLoadingAlunos] = useState(false);

    const { showToast } = useToast();

    // Carrega os cursos do professor logado
    useEffect(() => {
        const fetchCursos = async () => {
            try {
                const response = await api.get('/professores/meus-cursos'); // Rota específica do professor
                setCursos(response.data.map(c => ({ value: c.id, label: c.nome })));
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

            setAlunos(response.data);

            // Preenche o estado de frequências com os dados recebidos
            const initialFrequencias = response.data.reduce((acc, aluno) => {
                acc[aluno.id] = aluno.status || ''; // Sem padrão
                return acc;
            }, {});
            setFrequencias(initialFrequencias);

        } catch (error) {
            showToast('Erro ao carregar alunos e frequências.', 'error');
            setAlunos([]);
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
            showToast('Frequência salva com sucesso!', 'success');
            // Re-busca os dados para garantir que a UI esteja atualizada
            fetchAlunosEFrequencia();
        } catch (error) {
            showToast('Erro ao salvar frequência.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div>
            <div className="page-header"><div><h1 className="page-title">Lançamento de frequência</h1><p className="page-description">Selecione a turma e a data da aula para registrar a presença dos alunos.</p></div></div>

            {/* Filtros */}
            <section className="panel mb-6 p-4 sm:p-6" aria-label="Seleção da aula">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="curso-select" className="form-label">Curso</label>
                        <FormSelect
                            id="curso-select"
                            options={cursos}
                            value={selectedCurso?.value}
                            onChange={(e) => setSelectedCurso(cursos.find(c => String(c.value) === String(e.target.value)) || null)}
                            placeholder="Selecione um curso..."
                        />
                    </div><label><span className="form-label">Data da aula</span><input
                        type="date"
                        value={dataAula}
                        onChange={(e) => setDataAula(e.target.value)}
                        className="form-control"
                    /></label>
                </div>
            </section>

            {/* Tabela de Frequência */}
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
                            <tr><td colSpan="2" className="text-center py-4">Carregando alunos...</td></tr>
                        ) : !selectedCurso ? (
                            <tr><td colSpan="2" className="text-center py-10 text-text-muted">Por favor, selecione um curso para começar.</td></tr>
                        ) : alunos.length > 0 ? (
                            alunos.map((aluno) => (
                                <tr key={aluno.id} className="hover:bg-border/50">
                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-text-default">{aluno.nome}</td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                            {['presente', 'ausente', 'justificado'].map((status) => (
                                                <label key={status} className="flex items-center space-x-2 cursor-pointer">
                                                    <input
                                                        type="radio"
                                                        name={`frequencia-${aluno.id}`}
                                                        value={status}
                                                        checked={frequencias[aluno.id] === status}
                                                        onChange={() => handleFrequenciaChange(aluno.id, status)}
                                                        className="form-radio h-4 w-4 text-primary"
                                                    />
                                                    <span className="text-sm capitalize">{status}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </td>
                                </tr>
                            ))
                        ) : (
                             <tr><td colSpan="2" className="text-center py-10 text-text-muted">Nenhum aluno encontrado para este curso.</td></tr>
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
                        {loading ? 'Salvando...' : 'Salvar Frequência'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProfessorFrequencia;
