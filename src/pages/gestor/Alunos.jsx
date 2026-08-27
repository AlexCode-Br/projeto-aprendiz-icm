import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { useToast } from '../../contexts/ToastContext';
import Pagination from '../../components/Pagination';
import AlunoFormModal from '../../components/AlunoFormModal';
import ConfirmationModal from '../../components/ConfirmationModal';
import {
  PlusIcon,
  SearchIcon,
  PencilIcon,
  TrashIcon,
  EyeIcon,
} from '../../components/icons/index.jsx';

const Alunos = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [alunos, setAlunos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalAlunos, setTotalAlunos] = useState(0);
  const itemsPerPage = 15;
  const [offerings, setOfferings] = useState([]);
  const [churches, setChurches] = useState([]);

  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [selectedAluno, setSelectedAluno] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');

  const fetchAlunos = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api.get('/alunos', {
        params: { page: currentPage, limit: itemsPerPage, search: searchTerm },
      });
      setAlunos(r.data.alunos);
      setTotalAlunos(r.data.total);
      setError(null);
    } catch {
      setError('Não foi possível carregar os alunos.');
      showToast('Erro ao carregar alunos.', 'error');
    } finally {
      setLoading(false);
    }
  }, [currentPage, itemsPerPage, searchTerm, showToast]);

  useEffect(() => {
    const t = setTimeout(fetchAlunos, 300);
    return () => clearTimeout(t);
  }, [fetchAlunos]);

  useEffect(() => {
    api.get('/cursos').then(r => {
      setOfferings(r.data.cursos.filter(c => c.status === 'Ativo'));
      setChurches(r.data.locais || []);
    }).catch(() => { setOfferings([]); setChurches([]); });
  }, []);

  const handleSaveAluno = async (formData, alunoId) => {
    try {
      if (alunoId) {
        await api.put(`/alunos/${alunoId}`, formData);
        showToast('Aluno atualizado com sucesso!', 'success');
      } else {
        await api.post('/alunos', formData);
        showToast('Aluno adicionado com sucesso!', 'success');
      }
      setIsFormModalOpen(false);
      setSelectedAluno(null);
      await fetchAlunos();
    } catch (err) {
      showToast(err.response?.data?.message || 'Erro ao salvar aluno.', 'error');
    }
  };

  const handleDeleteAluno = async () => {
    if (!selectedAluno) return;
    try {
      await api.delete(`/alunos/${selectedAluno.id}`);
      showToast('Aluno excluído com sucesso!', 'success');
      fetchAlunos();
    } catch {
      showToast('Erro ao excluir aluno.', 'error');
    } finally {
      setIsConfirmModalOpen(false);
      setSelectedAluno(null);
    }
  };

  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="space-y-4">
      {/* ── Page header ─────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="page-title">Alunos</h1>
          <p className="page-description">
            {!loading && <>{totalAlunos} aluno{totalAlunos !== 1 ? 's' : ''} cadastrado{totalAlunos !== 1 ? 's' : ''}</>}
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setSelectedAluno(null); setIsFormModalOpen(true); }}
          className="btn btn-primary shrink-0"
        >
          <PlusIcon className="w-4 h-4" aria-hidden="true" />
          Novo Aluno
        </button>
      </div>

      {/* ── Search bar ──────────────────────────────────────────────────────── */}
      <div className="relative max-w-sm">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" aria-hidden="true" />
        <input
          id="student-search"
          type="search"
          placeholder="Buscar por nome ou e-mail…"
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
                <th style={{ width: '15%' }}>Telefone</th>
                <th className="text-right" style={{ width: '15%' }}>Ações</th>
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
                      {searchTerm ? 'Nenhum aluno corresponde à busca.' : 'Nenhum aluno cadastrado ainda.'}
                    </p>
                    <p className="text-xs text-text-muted">
                      {searchTerm
                        ? <button type="button" className="text-primary hover:underline" onClick={() => setSearchTerm('')}>Limpar filtro</button>
                        : 'Clique em "Novo Aluno" para começar.'}
                    </p>
                  </td>
                </tr>
              ) : alunos.map((aluno) => (
                <tr
                  key={aluno.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/gestor/alunos/${aluno.id}`)}
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
                  <td className="text-text-muted text-sm">{aluno.telefone || '—'}</td>
                  <td>
                    <div
                      className="flex items-center justify-end gap-1"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        aria-label={`Ver perfil de ${aluno.nome}`}
                        onClick={() => navigate(`/gestor/alunos/${aluno.id}`)}
                        className="icon-btn"
                        title="Ver perfil"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Editar ${aluno.nome}`}
                        onClick={() => { setSelectedAluno(aluno); setIsFormModalOpen(true); }}
                        className="icon-btn"
                        title="Editar"
                      >
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Excluir ${aluno.nome}`}
                        onClick={() => { setSelectedAluno(aluno); setIsConfirmModalOpen(true); }}
                        className="icon-btn icon-btn-danger"
                        title="Excluir"
                      >
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
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
                onClick={() => navigate(`/gestor/alunos/${aluno.id}`)}
              >
                <p className="text-sm font-medium text-text-default truncate">{aluno.nome}</p>
                <p className="text-xs text-text-muted truncate">{aluno.email}</p>
              </button>
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  aria-label={`Editar ${aluno.nome}`}
                  onClick={() => { setSelectedAluno(aluno); setIsFormModalOpen(true); }}
                  className="icon-btn"
                >
                  <PencilIcon className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  aria-label={`Excluir ${aluno.nome}`}
                  onClick={() => { setSelectedAluno(aluno); setIsConfirmModalOpen(true); }}
                  className="icon-btn icon-btn-danger"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Pagination ──────────────────────────────────────────────────────── */}
      <Pagination
        currentPage={currentPage}
        totalItems={totalAlunos}
        itemsPerPage={itemsPerPage}
        onPageChange={setCurrentPage}
      />

      {/* ── Modals ──────────────────────────────────────────────────────────── */}
      <AlunoFormModal
        isOpen={isFormModalOpen}
        onClose={() => { setIsFormModalOpen(false); setSelectedAluno(null); }}
        onSave={handleSaveAluno}
        aluno={selectedAluno}
        offerings={offerings}
        churches={churches}
      />
      <ConfirmationModal
        isOpen={isConfirmModalOpen}
        onClose={() => { setIsConfirmModalOpen(false); setSelectedAluno(null); }}
        onConfirm={handleDeleteAluno}
        title="Excluir Aluno"
        message={`Tem certeza que deseja excluir "${selectedAluno?.nome}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
      />
    </div>
  );
};

export default Alunos;
