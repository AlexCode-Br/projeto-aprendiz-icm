# Arquitetura do Projeto Aprendiz

## Visão geral

O sistema é uma aplicação web única, responsiva e orientada a três perfis: gestor, professor e aluno. O frontend React e a API executam no mesmo Cloudflare Worker. Autenticação, PostgreSQL e armazenamento privado permanecem no Supabase. A área do aluno está implementada localmente, com publicação pendente; consulte `STUDENT_PORTAL.md`.

```text
Navegador
  ├─ Service worker (instalação, Web Push e cache público do shell)
  └─ Cloudflare Worker
       ├─ assets do frontend React
       ├─ API HTTP e regras de autorização
       ├─ Durable Object para limite de autenticação
       └─ Hyperdrive → PostgreSQL do Supabase
                         ├─ Auth
                         ├─ assinaturas Web Push privadas
                         └─ Storage privado
```

## Estrutura canônica

| Caminho | Responsabilidade |
|---|---|
| `src/pages/` | Composição das telas por perfil e rota. |
| `src/components/` | Componentes reutilizáveis, modais, formulários e apresentação. |
| `src/contexts/` | Sessão do usuário e notificações da interface. |
| `src/services/` | Clientes HTTP e integração pública com Supabase Auth. |
| `src/utils/` | Exportações e transformações exclusivas do navegador. |
| `backend/routes/` | Endpoints HTTP separados por domínio. |
| `backend/*.mjs` | Inicialização, banco, segurança, e-mail, storage e infraestrutura da API. |
| `backend/migrations/` | Evolução idempotente do schema privado `projeto_aprendiz`. |
| `shared/` | Validações e regras puras usadas pelo frontend e backend. |
| `cloudflare/` | Adaptadores e operação específicos do runtime Cloudflare. |
| `public/` | Assets que precisam manter URL pública estável, inclusive em e-mails. |
| `docs/` | Arquitetura e políticas atuais; o Git guarda o histórico. |

## Limites de responsabilidade

- Páginas coordenam carregamento e estado, mas regras de negócio e validações reutilizáveis ficam em `shared/` ou no backend.
- Componentes não acessam o banco. O navegador usa `src/services/api.js` e a API valida novamente autenticação, autorização e dados recebidos.
- O browser nunca recebe chaves privadas nem acessa o schema do PostgreSQL diretamente.
- Cada navegador autorizado registra uma assinatura Web Push privada. A API envia o conteúdo cifrado com VAPID, remove endpoints expirados e mantém a chave privada exclusivamente no Worker.
- As preferências de notificação são compartilhadas entre e-mail e push; ativar ou desativar push é uma escolha independente para cada dispositivo.
- Arquivos em `public/` são reservados a URLs estáveis; assets importados pelo código ficam em `src/assets/` e recebem hash do Vite.
- Migrações antigas não são removidas: bancos novos e existentes dependem da sequência completa.
- Horários de turmas usam `class_schedules` para recorrências semanais e `class_schedule_dates` para aulas em datas específicas. Somente o professor responsável os modifica; gestor e aluno têm consultas autorizadas, limitadas às matrículas do aluno no segundo caso.
- Testes ficam próximos ao backend porque exercitam os mesmos módulos e contratos sem uma segunda estrutura paralela.

## Área do aluno

- `student_accounts` estabelece uma relação explícita e única entre conta e cadastro acadêmico. Convites do gestor criam esse vínculo; coincidência de e-mail não concede acesso automaticamente.
- `/api/aluno/*` usa o aluno vinculado à sessão, nunca um identificador de aluno enviado pelo cliente. Rotas administrativas continuam bloqueadas para esse perfil, inclusive fotos e anexos de terceiros.
- A navegação reúne Início, Meus cursos e Mural; Configurações concentra dados pessoais. Cada curso possui uma página com mural, aulas e frequência. Não há inscrição em cursos pelo aluno.
- Edição pessoal usa uma lista de campos permitidos. Alteração do e-mail de contato e login exige senha atual e confirmação do novo endereço, mantendo o anterior até a confirmação.
- Publicações acadêmicas têm público explícito em tabelas próprias. “Informativos e avisos” consulta somente publicações administrativas criadas por gestores; publicações do Mural da turma são excluídas desse fluxo. Professores gerenciam o mural somente de suas próprias turmas e podem consultar apenas nome e horário de visualização dos alunos ativos nelas; gestores selecionam o público de alunos. A confirmação de leitura reutiliza `announcement_reads` e a exigência por publicação fica em `student_course_announcements`.
- O agendamento do Worker entrega notificações com leases e tentativas limitadas. A preferência de comunicados e a autorização por dispositivo continuam sendo respeitadas. O conteúdo da notificação não expõe dados acadêmicos.
- Novas tabelas permanecem no schema privado, com RLS habilitada e privilégios revogados para os papéis públicos do Supabase. A autorização por aluno ocorre na API que acessa o banco pelo Hyperdrive.

## Compatibilidade de nomes

A interface usa o conceito de **Turmas**. Os arquivos ativos seguem esse nome (`pages/gestor/Turmas.jsx`, `components/TurmaModal.jsx` e `components/TurmaCard.jsx`). A URL `/gestor/cursos` e os endpoints `/cursos` permanecem temporariamente por compatibilidade com favoritos, clientes existentes e contratos do backend.

## Arquivos gerados

Os caminhos abaixo são regeneráveis e não pertencem ao código-fonte:

- `node_modules/`
- `dist/`
- `cloudflare/build/`
- `.wrangler/`
- `backend/data/`
- `.env` e `.dev.vars`
- relatórios, bancos e capturas produzidos em testes locais

## Qualidade

`pnpm check` verifica a sintaxe do backend, executa a suíte automatizada e compila o frontend. `pnpm lint` cobre o repositório com ESLint. Mudanças de banco devem incluir migração e regressão; mudanças responsivas devem ser conferidas no mobile e no desktop.

