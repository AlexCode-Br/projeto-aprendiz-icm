import React from 'react';

const whatsappNumber = phone => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return '';
    return digits.startsWith('55') && digits.length > 11 ? digits : `55${digits}`;
};

export default function AtRiskStudentsTable({ students = [], loading = false, onRegisterContact }) {
    return (
        <section className="panel mt-6 overflow-hidden" aria-labelledby="risk-title">
            <div className="border-b border-border p-4 md:p-6">
                <h2 id="risk-title" className="text-lg font-semibold text-text-default">Alunos em risco</h2>
                <p className="mt-1 text-sm text-text-muted">Duas ou mais faltas consecutivas sem justificativa no período selecionado.</p>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-surface-muted text-xs uppercase text-text-muted"><tr><th className="px-6 py-3">Aluno</th><th className="px-6 py-3">Turma</th><th className="px-6 py-3 text-center">Faltas seguidas</th><th className="px-6 py-3">Contato</th><th className="px-6 py-3">Último acompanhamento</th><th className="px-6 py-3 text-right">Ação</th></tr></thead>
                    <tbody className="divide-y divide-border">
                        {loading ? Array.from({ length: 3 }, (_, index) => <tr key={index}><td colSpan="6" className="px-6 py-4"><div className="skeleton h-12 rounded-lg" /></td></tr>) : students.map(student => {
                            const phone = student.classe === 'Adolescente' && student.guardian_phone ? student.guardian_phone : student.telefone;
                            const whatsapp = whatsappNumber(phone);
                            return <tr key={student.id} className="hover:bg-surface-hover">
                                <td className="px-6 py-4"><strong className="block text-text-default">{student.nome}</strong><span className="text-xs text-text-muted">{student.igreja || 'Igreja não informada'}</span></td>
                                <td className="px-6 py-4">{student.turmas.map(item => <span key={item.id} className="block">{item.curso} · {item.local}</span>)}</td>
                                <td className="px-6 py-4 text-center"><span className="inline-flex min-w-8 justify-center rounded-full bg-danger/10 px-2.5 py-1 font-semibold text-danger">{student.faltasConsecutivas}</span></td>
                                <td className="px-6 py-4">{phone ? <div className="flex flex-col gap-1"><a href={`tel:${String(phone).replace(/[^+\d]/g, '')}`} className="font-medium text-primary hover:underline">{phone}</a><a href={`https://wa.me/${whatsapp}`} target="_blank" rel="noreferrer" className="text-xs text-text-muted hover:text-primary hover:underline">Abrir WhatsApp</a></div> : <span className="text-text-muted">Não informado</span>}</td>
                                <td className="px-6 py-4">{student.ultimoContato ? <><span className="block text-text-default">{new Date(student.ultimoContato.contactedAt).toLocaleDateString('pt-BR')}</span><span className="block max-w-64 truncate text-xs text-text-muted" title={student.ultimoContato.note}>{student.ultimoContato.note}</span></> : <span className="text-text-muted">Nenhum contato registrado</span>}</td>
                                <td className="px-6 py-4 text-right"><button type="button" onClick={() => onRegisterContact(student)} className="btn btn-secondary whitespace-nowrap">Registrar contato</button></td>
                            </tr>;
                        })}
                    </tbody>
                </table>
            </div>
            {!loading && students.length === 0 && <div className="px-6 py-12 text-center"><strong className="block text-text-default">Nenhum aluno em risco</strong><span className="mt-1 block text-sm text-text-muted">Quando houver duas faltas seguidas sem justificativa, o aluno aparecerá aqui.</span></div>}
        </section>
    );
}
