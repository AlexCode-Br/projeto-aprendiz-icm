import React, { useEffect, useState } from 'react';
import { TriangleAlert } from 'lucide-react';
import Modal from './Modal';

export default function AccountDeletionModal({ isOpen, onClose, email, onConfirm, loading = false, studentAccount = false }) {
    const [confirmation, setConfirmation] = useState('');
    useEffect(() => { if (isOpen) setConfirmation(''); }, [isOpen]);
    const matches = confirmation.trim().toLowerCase() === String(email || '').trim().toLowerCase();

    return <Modal isOpen={isOpen} onClose={onClose} title="Excluir conta" footer={<button type="button" onClick={() => onConfirm(confirmation)} disabled={!matches || loading} className="btn btn-danger w-full disabled:opacity-50">{loading ? 'Excluindo conta…' : 'Excluir minha conta permanentemente'}</button>}>
        <div className="space-y-5">
            <div className="flex gap-3 rounded-xl border border-danger/20 bg-danger/5 p-4 text-sm leading-6 text-text-muted">
                <TriangleAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-danger" />
                <p>{studentAccount ? 'Esta ação exclui sua conta de acesso, encerra as sessões e desativa as notificações. O cadastro acadêmico e a foto permanecem sob responsabilidade da gestão. Procure o gestor para solicitar a remoção desses dados.' : 'Esta ação remove seus dados pessoais, encerra todas as sessões e desativa as notificações. Os registros acadêmicos e de auditoria serão preservados de forma anônima.'}</p>
            </div>
            <label className="block text-sm font-medium text-text-default" htmlFor="account-delete-confirmation">Digite <strong>{email}</strong> para confirmar<input id="account-delete-confirmation" type="email" autoComplete="off" value={confirmation} onChange={event => setConfirmation(event.target.value)} className="form-control mt-2" /></label>
        </div>
    </Modal>;
}
