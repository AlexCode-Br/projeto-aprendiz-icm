const wait = value => new Promise(resolve => setTimeout(() => resolve({ data: value }), 150));

let alunos = [
  ['João Pereira','joao.pereira@email.com','(11) 98821-1040','Violão I'],
  ['Maria Clara','maria.clara@email.com','(11) 97732-2151','Canto Coral'],
  ['Pedro Almeida','pedro.almeida@email.com','(11) 96643-3262','Bateria'],
  ['Ana Beatriz','ana.beatriz@email.com','(11) 95554-4373','Teclado'],
  ['Lucas Guimarães','lucas.guimaraes@email.com','(11) 94465-5484','Violino'],
  ['Gabriela Santos','gabriela.santos@email.com','(11) 93376-6595','Flauta Transversal'],
  ['Rafael Souza','rafael.souza@email.com','(11) 92287-7606','Contrabaixo'],
  ['Juliana Costa','juliana.costa@email.com','(11) 91198-8717','Teoria Musical'],
  ['Ricardo Alves','ricardo.alves@email.com','(11) 90019-9828','Violão II'],
  ['Camila Rocha','camila.rocha@email.com','(11) 98920-0939','Saxofone'],
  ['Bruno Lima','bruno.lima@email.com','(11) 97831-1050','Bateria'],
  ['Larissa Melo','larissa.melo@email.com','(11) 96742-2161','Canto Coral'],
].map((a, index) => ({
  id: index + 1, nome: a[0], email: a[1], telefone: a[2],
  created_at: new Date(2026, 7, 24 - index).toISOString(),
  cursos: [{ id: (index % 4) + 1, nome: a[3] }], foto_url: '',
}));

const cursos = [
  { id: 1, nome: 'Violão I' }, { id: 2, nome: 'Canto Coral' },
  { id: 3, nome: 'Bateria' }, { id: 4, nome: 'Teclado' },
];

const informativos = [
  { id: 1, tipo: 'Urgente', titulo: 'Reunião pedagógica', conteudo: 'A reunião mensal será realizada na sexta-feira, às 18h.', data_publicacao: '2026-08-24T12:00:00Z' },
  { id: 2, tipo: 'Evento', titulo: 'Recital de primavera', conteudo: 'As inscrições para apresentações estão abertas até 5 de setembro.', data_publicacao: '2026-08-20T12:00:00Z' },
  { id: 3, tipo: 'Comunicado', titulo: 'Atualização do calendário', conteudo: 'O calendário de aulas e reposições do próximo mês já está disponível.', data_publicacao: '2026-08-17T12:00:00Z' },
  { id: 4, tipo: 'Comunicado', titulo: 'Novos materiais didáticos', conteudo: 'Os materiais complementares foram adicionados à biblioteca.', data_publicacao: '2026-08-12T12:00:00Z' },
];

let tickets = [
  { id: 1042, assunto: 'Ajuste na lista de chamada', mensagem: 'Um aluno novo ainda não aparece na turma de Violão I.', status: 'Aberto', data_abertura: '2026-08-23T14:30:00Z' },
  { id: 1031, assunto: 'Projetor da sala 3', mensagem: 'O projetor está com a imagem oscilando.', status: 'Em andamento', data_abertura: '2026-08-18T09:15:00Z' },
  { id: 998, assunto: 'Material de teoria musical', mensagem: 'Solicitação de novas cópias das apostilas.', status: 'Fechado', data_abertura: '2026-08-02T10:00:00Z' },
];

const bodyData = body => body instanceof FormData ? Object.fromEntries(body.entries()) : (body || {});

const api = {
  defaults: { headers: {} },
  async get(url, config = {}) {
    const path = url.split('?')[0];
    if (path === '/api/auth/me') return wait({ id: 'demo-gestor', nome: 'Admin Regional', email: 'admin@icm.org.br', role: 'gestor' });
    if (path === '/alunos' || path === '/professores/meus-alunos') {
      const { page = 1, limit = 10, search = '' } = config.params || {};
      const filtered = alunos.filter(a => `${a.nome} ${a.email}`.toLowerCase().includes(String(search).toLowerCase()));
      return wait({ alunos: filtered.slice((page - 1) * limit, page * limit), total: filtered.length });
    }
    if (path === '/api/professores/me/alunos') return wait({ alunos });
    if (path === '/professores/meus-cursos') return wait(cursos);
    if (path === '/frequencia') return wait(alunos.slice(0, 8).map((a, i) => ({ id: a.id, nome: a.nome, status: i === 3 ? 'ausente' : 'presente' })));
    if (path === '/api/informativos') return wait([...informativos]);
    if (path === '/api/suporte') return wait([...tickets]);
    return wait({});
  },
  async post(url, body) {
    const data = bodyData(body);
    if (url === '/api/auth/login') return wait({ token: 'demo-token', user: { id: 'demo-gestor', nome: 'Admin Regional', email: data.email || 'admin@icm.org.br', role: 'gestor' } });
    if (url === '/alunos') {
      const novo = { id: Date.now(), nome: data.nome || 'Novo Aluno', email: data.email || 'aluno@email.com', telefone: data.telefone || '(11) 90000-0000', cursos: [], foto_url: '', created_at: new Date().toISOString() };
      alunos = [novo, ...alunos]; return wait(novo);
    }
    if (url === '/frequencia') return wait({ success: true });
    if (url === '/api/suporte') {
      const ticket = { id: Date.now(), assunto: data.assunto, mensagem: data.mensagem, status: 'Aberto', data_abertura: new Date().toISOString() };
      tickets = [ticket, ...tickets]; return wait(ticket);
    }
    if (/\/api\/suporte\/\d+\/responder/.test(url)) return wait({ success: true });
    if (url === '/api/relatorios/gerar') return wait('Projeto Aprendiz - Relatório demonstrativo\nDados gerados localmente para visualização.');
    return wait({ success: true });
  },
  async put(url, body) {
    if (/^\/alunos\//.test(url)) {
      const id = Number(url.split('/').pop()); const data = bodyData(body);
      alunos = alunos.map(a => a.id === id ? { ...a, ...data } : a); return wait({ success: true });
    }
    if (/\/api\/suporte\/\d+\/fechar/.test(url)) {
      const id = Number(url.split('/')[3]); tickets = tickets.map(t => t.id === id ? { ...t, status: 'Fechado' } : t); return wait({ success: true });
    }
    return wait({ success: true });
  },
  async delete(url) {
    const id = Number(url.split('/').pop()); alunos = alunos.filter(a => a.id !== id); return wait({ success: true });
  },
};

export default api;
