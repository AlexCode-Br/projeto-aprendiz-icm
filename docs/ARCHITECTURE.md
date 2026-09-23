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
- Preferências transacionais são compartilhadas entre e-mail e push; ativar ou desativar push é uma escolha independente para cada dispositivo. Interações do Mural são a exceção intencional: usam somente push, agrupado por turma, para evitar um e-mail por mensagem.
- Arquivos em `public/` são reservados a URLs estáveis; assets importados pelo código ficam em `src/assets/` e recebem hash do Vite.
- Migrações antigas não são removidas: bancos novos e existentes dependem da sequência completa.
- Horários de turmas usam `class_schedules` para recorrências semanais e `class_schedule_dates` para aulas em datas específicas. Somente o professor responsável os modifica; gestor e aluno têm consultas autorizadas, limitadas às matrículas do aluno no segundo caso.
- Testes ficam próximos ao backend porque exercitam os mesmos módulos e contratos sem uma segunda estrutura paralela.

## Área do aluno

- `student_accounts` estabelece uma relação explícita e única entre conta e cadastro acadêmico. Convites do gestor criam esse vínculo; coincidência de e-mail não concede acesso automaticamente.
- `/api/aluno/*` usa o aluno vinculado à sessão, nunca um identificador de aluno enviado pelo cliente. Rotas administrativas continuam bloqueadas para esse perfil, inclusive fotos e anexos de terceiros.
- A navegação do aluno reúne apenas Início e Meus cursos; Configurações concentra dados pessoais. Cada curso possui abas separadas para o Mural do professor e os Informativos do gestor destinados à turma, além de aulas e frequência. Não há inscrição em cursos pelo aluno nem um Mural global separado.
- Os menus “Meus cursos” e “Minhas turmas” carregam seus itens em cascata por APIs vinculadas à sessão. O cliente não envia identificadores de aluno ou professor para compor essa lista.
- Edição pessoal usa uma lista de campos permitidos. Alteração do e-mail de contato e login exige senha atual e confirmação do novo endereço, mantendo o anterior até a confirmação.
- Publicações acadêmicas têm público explícito em tabelas próprias. “Informativos e avisos” consulta somente publicações administrativas criadas por gestores; publicações do Mural da turma são excluídas desse fluxo. O gestor seleciona exclusivamente turmas ofertadas ao publicar; a API deriva o professor responsável e grava o mesmo público para os alunos matriculados. Em Informativos, `announcement_reads` serve somente ao estado pessoal novo/lido e às notificações, sem expor contagens ou nomes ao gestor. No Mural, o professor responsável pode consultar nome e horário de visualização dos alunos ativos, e a exigência de confirmação por publicação fica em `student_course_announcements`.
- O agendamento do Worker entrega Informativos da gestão e funciona como recuperação da outbox durável do Mural. Publicações, comentários e curtidas gravam destinatários em lote em `notification_outbox`; a entrega push ocorre fora da resposta HTTP, com lease, deduplicação, retentativa exponencial e concorrência limitada. Uma execução em segundo plano é disparada após a gravação e o cron de um minuto recupera itens pendentes. Mural é push-only para não transformar conversas em tempestade de e-mail; `wallPosts`, `wallComments` e `wallLikes` permanecem preferências independentes. A chave idempotente é única por evento/destinatário e a tag visual é estável por turma para agrupar cartões no dispositivo.
- Novas tabelas permanecem no schema privado, com RLS habilitada e privilégios revogados para os papéis públicos do Supabase. A autorização por aluno ocorre na API que acessa o banco pelo Hyperdrive.

## Comunidade da turma

As rotas `/api/turmas/:id` compartilham autorização por professor responsável ou matrícula ativa no período vigente. O gestor ativo pode consultar qualquer mural ativo exclusivamente para acompanhamento e abertura de notificações, sem publicar, comentar, reagir, editar ou excluir. O mural reutiliza anúncios e anexos privados existentes; curtidas e comentários ficam em `course_post_likes` e `course_post_comments`. `class_presentation.stream_mode` define `post_and_comment`, `comment_only` ou `teacher_only`; a API reaplica essa política em publicação, edição, comentários e reações, sem confiar nos botões ocultados pelo cliente. Alunos editam suas próprias publicações e removem seus comentários enquanto a política permite participação; o professor sempre modera exclusões na própria turma. Visualizações nominais continuam exclusivas do professor.

Fotos de autores de publicações e comentários são entregues por URLs vinculadas à turma e ao item, somente após validar a sessão, a matrícula ou responsabilidade pela turma e o vínculo atual do autor. O cliente usa `ProfileAvatar`; a cada cinco segundos consulta apenas a versão compacta do mural e recarrega o feed quando algo mudou, além de atualizar ao recuperar o foco. Comentários abertos também se atualizam com a página visível. Consultas nominais de visualização são exclusivas do professor. Publicações comuns registram visualização depois de permanecerem visíveis por 900 ms; publicações com confirmação exigida nunca são confirmadas automaticamente e dependem de ação explícita do aluno.

`class_presentation` guarda endereço, imagem otimizada (máximo 1 MB), posição, zoom e política de participação. A imagem é entregue por endpoint autenticado com cache privado desabilitado. `ClassBanner` compartilha o enquadramento entre prévia, professor e aluno; `ClassSettingsModal` permite reenquadrar sem reenviar e configurar a participação no mural. Turmas ainda não configuradas pelo professor atual aparecem no fluxo inicial de configuração. As migrações 023 e 024 e o bootstrap idempotente mantêm SQLite local e PostgreSQL compatíveis.

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

