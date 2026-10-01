import React, { useCallback, useEffect, useState } from 'react';
import ClassSettingsModal from './ClassSettingsModal';
import ProfessorClassModal from './ProfessorClassModal';
import api from '../services/api';

export default function TeacherClassSetup() {
  const [state, setState] = useState({ items: [], needsOffering: false });
  const [open, setOpen] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get('/api/turmas/configuracao-pendente');
      setState({ items: data.items || [], needsOffering: Boolean(data.needsOffering) });
      return data;
    } catch {
      return null;
    }
  }, []);

  useEffect(() => {
    void refresh();
    window.addEventListener('class-presentation:updated', refresh);
    window.addEventListener('classes:updated', refresh);
    return () => {
      window.removeEventListener('class-presentation:updated', refresh);
      window.removeEventListener('classes:updated', refresh);
    };
  }, [refresh]);

  if (state.needsOffering) return <>
    {!open && <div className="alert-warning mb-5"><strong className="block">Configure sua primeira turma</strong><p className="mt-1 text-sm">Escolha o curso, a igreja ou modalidade e os dias e horários das aulas.</p><button className="btn btn-secondary mt-3" onClick={() => setOpen(true)}>Criar minha turma</button></div>}
    {open && <ProfessorClassModal onClose={() => setOpen(false)} onSaved={async () => { window.dispatchEvent(new Event('classes:updated')); await refresh(); setOpen(true); }} />}
  </>;

  if (!state.items.length) return null;
  return <>
    {!open && <div className="alert-warning mb-5"><p>Finalize o banner, o mapa e as permissões do mural da sua turma.</p><button className="btn btn-secondary mt-2" onClick={() => setOpen(true)}>Continuar configuração</button></div>}
    {open && <ClassSettingsModal key={state.items[0].id} course={state.items[0]} onClose={() => setOpen(false)} onSaved={async () => { setState(current => ({ ...current, items: current.items.slice(1) })); window.dispatchEvent(new Event('class-presentation:updated')); }} />}
  </>;
}
