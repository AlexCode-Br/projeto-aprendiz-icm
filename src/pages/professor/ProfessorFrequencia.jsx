import React, { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import CustomSelect from '../../components/CustomSelect';

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
                acc[aluno.id] = aluno.status || 'presente'; // 'presente' como padrão
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
            <h1 className="text-3xl font-bold text-text-default mb-6">Lançamento de Frequência</h1>

            {/* Filtros */}
            <div className="p-6 bg-surface rounded-lg shadow mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <CustomSelect
                        options={cursos}
                        value={selectedCurso}
                        onChange={setSelectedCurso}
                        placeholder="Selecione um curso..."
                    />
                    <input
                        type="date"
                        value={dataAula}
                        onChange={(e) => setDataAula(e.target.value)}
                        className="w-full px-3 py-2 border rounded-md bg-surface border-border focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>

            {/* Tabela de Frequência */}
            <div className="bg-surface rounded-lg shadow overflow-x-auto">
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
                                        <div className="flex items-center space-x-4">
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
                        className="px-8 py-3 text-white bg-primary rounded-md hover:bg-primary-dark disabled:opacity-50"
                    >
                        {loading ? 'Salvando...' : 'Salvar Frequência'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default ProfessorFrequencia;