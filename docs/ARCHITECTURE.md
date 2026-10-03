# Arquitetura do Projeto Aprendiz

## Visão geral

O sistema é uma aplicação web única, responsiva e orientada a três perfis: gestor, professor e aluno. O frontend React e a API executam no mesmo Cloudflare Worker. Autenticação, PostgreSQL e armazenamento privado permanecem no Supabase. A área do aluno está implementada e publicada; consulte `STUDENT_PORTAL.md`.

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
| `src/services/` | Cliente HTTP da aplicação; autenticação Supabase é executada exclusivamente pelo backend. |
| `src/utils/` | Exportações e transformações exclusivas do navegador. |
| `backend/routes/` | Endpoints HTTP separados por domínio. |
| `backend/database/` | Regras SQL puras compartilhadas por Node e Worker; registro das tabelas privadas. |
| `backend/*.mjs` | Inicialização, banco, segurança, e-mail, storage e infraestrutura da API. |
| `backend/migrations/` | Evolução idempotente do schema privado `projeto_aprendiz`. |
| `backend/test-support/` | Inicialização isolada do servidor para testes de integração. |
| `shared/` | Validações e regras puras usadas pelo frontend e backend. |
| `cloudflare/` | Adaptadores e operação específicos do runtime Cloudflare. |
| `public/` | Assets que precisam manter URL pública estável, inclusive em e-mails. |
| `docs/` | Arquitetura e políticas atuais; o Git guarda o histórico. |
| `scripts/` | Verificações de repositório, diagnóstico e smoke test de produção. |

## Limites de responsabilidade

- Páginas coordenam carregamento e estado, mas regras de negócio e validações reutilizáveis ficam em `shared/` ou no backend.
- Componentes não acessam o banco. O navegador usa `src/services/api.js` e a API valida novamente autenticação, autorização e dados recebidos.
- O browser nunca recebe chaves privadas nem acessa o schema do PostgreSQL diretamente.
- O login por senha passa pelo Worker: falhas são contabilizadas por IP e por e-mail no Durable Object, cinco falhas exigem Turnstile validado no servidor e vinte falhas do mesmo IP bloqueiam novas tentativas por quinze minutos. O navegador não recebe tokens do Supabase nem possui uma rota de troca que contorne esse controle.
- Gestores concluem uma segunda etapa com código de uso único enviado ao e-mail, válido por dez minutos e limitado a cinco tentativas. A sessão administrativa registra a conclusão do segundo fator, expira por inatividade e tem duração persistente máxima de sete dias.
- Após login bem-sucedido, gestores recebem um e-mail separado de novo dispositivo quando o navegador não é reconhecido. O código MFA não inclui esse alerta. `pa_device` é um cookie HttpOnly/SameSite=Strict, Secure em produção, com reconhecimento renovável de um ano; seu hash fica na tabela privada `manager_login_devices` e não concede autenticação nem dispensa MFA. Mudanças de IP ou User-Agent, sozinhas, não criam novo dispositivo. Sessão, registro e alerta na outbox são persistidos na mesma transação; o envio ocorre depois do commit, com retentativas duráveis, independentemente de preferências opcionais e sem push.
- O alerta apresenta somente horário em Brasília, sistema/navegador e localização aproximada (cidade/estado/país), com botão “Não fui eu” para revisar sessões e senha em Configurações. O IP permanece no registro de auditoria, sem aparecer no e-mail. A localização vem exclusivamente de `request.cf` no adaptador Cloudflare; cabeçalhos de geolocalização do cliente não são aceitos. Identificação do dispositivo reutiliza `shared/device-info.mjs` e é uma estimativa do User-Agent. Dados ausentes têm indicação explícita. Não há GPS ou serviço externo de geolocalização. Registros de reconhecimento expirados são removidos pela limpeza de segurança; o corpo do alerta segue a retenção existente da outbox (30 dias enviado, 90 dias com falha definitiva).
- Publicações, comentários, curtidas, suporte e testes de notificação possuem limites distribuídos por usuário e endereço de origem, aplicados na API independentemente da interface.
- Migrações são executadas antes da publicação. O Worker não cria ou altera tabelas durante requisições nem durante o agendamento.
- Cada navegador autorizado registra uma assinatura Web Push privada. A API envia o conteúdo cifrado com VAPID, remove endpoints expirados e mantém a chave privada exclusivamente no Worker.
- Preferências transacionais são compartilhadas entre e-mail e push; ativar ou desativar push é uma escolha independente para cada dispositivo. Interações do Mural são a exceção intencional: usam somente push, agrupado por turma, para evitar um e-mail por mensagem.
- Arquivos em `public/` são reservados a URLs estáveis; assets importados pelo código ficam em `src/assets/` e recebem hash do Vite.
- Migrações antigas não são removidas: bancos novos e existentes dependem da sequência completa.
- O professor cria as próprias ofertas a partir dos catálogos ativos de cursos e localidades e informa ao menos um horário. O gestor lista e pode excluir turmas, mas não cria nem edita ofertas. O curso é imutável após a criação; o professor responsável pode atualizar a igreja ou modalidade e a agenda. Horários usam `class_schedules` para recorrências semanais e `class_schedule_dates` para aulas em datas específicas, com detecção transacional de conflitos do professor.
- Testes ficam próximos ao backend porque exercitam os mesmos módulos e contratos sem uma segunda estrutura paralela.

## Banco e despacho HTTP

`backend/database.mjs` mantém a conexão Node, SQLite local e execução de migrações. `backend/worker-database.mjs` mantém conexão e transações no runtime Cloudflare. Ambos importam `backend/database/sql-compatibility.mjs` para converter parâmetros, qualificar o schema privado, normalizar resultados e tratar IDs. Esse módulo não depende de filesystem, SQLite ou cliente PostgreSQL.

O registro `applicationTables` inclui todas as tabelas das migrações. Uma regressão compara a sequência SQL com o registro compartilhado; uma tabela nova deve atualizar ambos. Isso previne divergências entre os runtimes, inclusive em desafios MFA. O Worker não contém inicializadores de DDL: PostgreSQL evolui somente por migrações; o bootstrap SQLite permanece restrito ao modo local.

`backend/routes/index.mjs` aplica a validação global de origem e IDs e encaminha pedidos aos módulos de domínio. Conta, sessões, preferências e push estão em `account.mjs`; fotos em `profile-photos.mjs`; períodos letivos em `school-years.mjs`. A separação preserva URLs, respostas e verificações de autorização.

## Área do aluno

- `student_accounts` estabelece uma relação explícita e única entre conta e cadastro acadêmico. Convites do gestor criam esse vínculo; coincidência de e-mail não concede acesso automaticamente.
- `/api/aluno/*` usa o aluno vinculado à sessão, nunca um identificador de aluno enviado pelo cliente. Rotas administrativas continuam bloqueadas para esse perfil, inclusive fotos e anexos de terceiros.
- A navegação do aluno reúne apenas Início e a cascata Meus cursos; Configurações concentra dados pessoais. Não existe página agregadora de cursos: cada item da cascata abre diretamente o curso. Horário e local ficam no cabeçalho; Mural, Arquivos, Informativos e frequência preservam o contexto da matrícula. Não há inscrição em cursos pelo aluno nem um Mural global separado.
- O painel do aluno pode consolidar indicadores gerais, mas dados acadêmicos são sempre contextualizados: frequência, avisos não lidos e próxima aula são calculados por matrícula e levam diretamente ao curso correspondente. Não existem telas gerais de calendário ou frequência que misturem cursos.
- Os menus “Meus cursos” e “Minhas turmas” carregam seus itens em cascata por APIs vinculadas à sessão. O cliente não envia identificadores de aluno ou professor para compor essa lista.
- Edição pessoal usa uma lista de campos permitidos. Alteração do e-mail de contato e login exige senha atual e confirmação do novo endereço, mantendo o anterior até a confirmação.
- Publicações acadêmicas têm público explícito em tabelas próprias. “Informativos e avisos” consulta somente publicações administrativas criadas por gestores; publicações do Mural da turma são excluídas desse fluxo. O gestor seleciona exclusivamente turmas ofertadas ao publicar; a API deriva o professor responsável e grava o mesmo público para os alunos matriculados. Em Informativos, `announcement_reads` serve somente ao estado pessoal novo/lido e às notificações, sem expor contagens ou nomes ao gestor. No Mural, o professor responsável pode consultar nome e horário de visualização dos alunos ativos, e a exigência de confirmação por publicação fica em `student_course_announcements`.
- O agendamento do Worker entrega Informativos da gestão e funciona como recuperação da outbox durável do Mural. Publicações, comentários e curtidas gravam destinatários em lote em `notification_outbox`; a entrega push ocorre fora da resposta HTTP, com lease, deduplicação, retentativa exponencial e concorrência limitada. Uma execução em segundo plano é disparada após a gravação e o cron de um minuto recupera itens pendentes. Mural é push-only para não transformar conversas em tempestade de e-mail; `wallPosts`, `wallComments` e `wallLikes` permanecem campos independentes na API por compatibilidade, mas as configurações de aluno e professor os salvam conjuntamente pelo seletor Atividades do mural. Preferências legadas mistas só são unificadas após escolha explícita. A chave idempotente é única por evento/destinatário e a tag visual é estável por turma para agrupar cartões no dispositivo.
- Novas tabelas permanecem no schema privado, com RLS habilitada e privilégios revogados para os papéis públicos do Supabase. A autorização por aluno ocorre na API que acessa o banco pelo Hyperdrive.

## Chat de suporte

Gestores e professores usam uma conversa contínua por professor nas URLs existentes de Suporte. A equipe gestora compartilha o histórico; cada professor só acessa a própria conversa. Gestores podem iniciar conversas com professores ativos, mesmo sem solicitações anteriores. Assunto, categoria e status saem da interface. Os endpoints legados de chamados permanecem compatíveis; `GET /api/suporte/conversas` e suas rotas de mensagens, leitura e anexos projetam os registros existentes de `support_tickets`, `support_messages` e `support_ticket_reads`, sem reescrever ou excluir o histórico.

O cliente consulta a versão compacta das conversas a cada dois segundos enquanto a página está visível e ao recuperar o foco. Recarrega o histórico apenas quando mensagens ou leituras mudam; não utiliza WebSocket nem botão de atualização. Envio tem identificador idempotente por autor, autorização e limite de ações na API. Um professor não pode enviar, visualizar ou marcar leitura de outra conversa. A leitura usa o maior ID efetivamente exibido, com corte monotônico por chamado; mensagens posteriores continuam não lidas. A página em segundo plano ou coberta por um modal não confirma leitura. A indicação azul significa visualização pelo outro lado da conversa; no caso da equipe gestora, por algum gestor. Não há presença online ou indicação de digitação simuladas.

`support_attachments`, criada pela migração `029_support_chat_attachments.sql`, guarda metadados privados e referência aos arquivos. Em produção, o backend usa o bucket privado `support-attachments`; no SQLite isolado de desenvolvimento, usa `data_url`. O frontend recebe somente URLs autenticadas da API. Download reaplica autorização e vínculo entre professor, mensagem e arquivo, sem URLs públicas ou assinadas; áudio e vídeo aceitam requisições Range. Imagens têm metadados removidos, documentos baixam como anexos e os tipos, extensões, conteúdo e tamanhos são validados no servidor. A preparação dos arquivos precede a transação; falhas e envios repetidos compensam os uploads sem vínculo. O endpoint legado de exclusão também limpa seus arquivos no Storage.

Uma mensagem aceita até cinco arquivos, somando 20 MB: fotos PNG/JPEG/WEBP até 5 MB, áudio e documentos até 10 MB, vídeos MP4/WEBM até 20 MB. Documentos incluem PDF, DOCX, XLSX, PPTX e TXT. Arquivo sem legenda e mensagem de um caractere são permitidos; texto vazio sem arquivo é rejeitado pela API. Gravação usa MediaRecorder em formato suportado pelo navegador, exige permissão de microfone, para em cinco minutos e libera o dispositivo ao parar, descartar ou sair da conversa. O áudio fica em revisão antes do envio. Emojis usam texto Unicode. As notificações continuam respeitando a preferência legada `newTicket`, apresentada como Mensagens do suporte.

## Comunidade da turma

As rotas `/api/turmas/:id` compartilham autorização exclusivamente entre o professor responsável e alunos com matrícula ativa no período vigente. O gestor não acessa, recebe notificações ou modera o Mural; sua comunicação permanece nos Informativos administrativos. O mural reutiliza anúncios e anexos privados existentes; curtidas e comentários ficam em `course_post_likes` e `course_post_comments`. `class_presentation.stream_mode` define `post_and_comment`, `comment_only` ou `teacher_only`; a API reaplica essa política em publicação, edição, comentários e reações, sem confiar nos botões ocultados pelo cliente. Alunos editam suas próprias publicações e removem seus comentários enquanto a política permite participação; o professor sempre modera exclusões na própria turma. Visualizações nominais continuam exclusivas do professor.

Fotos de autores de publicações e comentários são entregues por URLs vinculadas à turma e ao item, somente após validar a sessão, a matrícula ou responsabilidade pela turma e o vínculo atual do autor. O cliente usa `ProfileAvatar`; a cada cinco segundos consulta apenas a versão compacta do mural e recarrega o feed quando algo mudou, além de atualizar ao recuperar o foco. Comentários abertos também se atualizam com a página visível. Consultas nominais de visualização são exclusivas do professor. Publicações comuns registram visualização depois de permanecerem visíveis por 900 ms; publicações com confirmação exigida nunca são confirmadas automaticamente e dependem de ação explícita do aluno.

Informativos e publicações do Mural compartilham `RichTextEditor` no cliente e `sanitizeAnnouncementContent` na API. A formatação permitida limita-se a parágrafos, divisões, quebras, negrito, itálico, sublinhado, listas e links HTTPS com abertura isolada; comentários permanecem como texto simples.

`class_presentation` guarda endereço, imagem otimizada (máximo 1 MB), posição, zoom e política de participação. A imagem é entregue por endpoint autenticado com cache privado desabilitado. `ClassBanner` compartilha o enquadramento entre prévia, professor e aluno; `ClassSettingsModal` permite reenquadrar sem reenviar e configurar a participação no mural. Turmas ainda não configuradas pelo professor atual aparecem no fluxo inicial de configuração. As migrações PostgreSQL e o bootstrap SQLite local mantêm os modelos compatíveis, sem DDL em requisições do Worker.

## Compatibilidade de nomes

A interface usa o conceito de **Turmas**. Os arquivos ativos seguem esse nome (`pages/gestor/Turmas.jsx`, `pages/professor/ProfessorTurmas.jsx` e `components/TurmaCard.jsx`). A URL `/gestor/cursos` e o endpoint administrativo `/cursos` permanecem por compatibilidade: `GET` lista e `DELETE` exclui, enquanto criação e edição retornam bloqueio. A oferta do professor usa `/api/professores/me/turmas`.

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

`pnpm check` verifica higiene do repositório e links de documentação, executa ESLint, valida a sintaxe dos pontos de entrada, roda os testes e compila o frontend. `pnpm lint` cobre frontend, backend, regras compartilhadas e scripts. Mudanças de banco devem incluir migração e regressão; mudanças responsivas devem ser conferidas no mobile e no desktop.

`backend/test-support/server.mjs` usa SQLite e uma porta livre em loopback. Credenciais e integrações de produção herdadas são excluídas do subprocesso. A adoção começou pelos testes de conta, MFA e modelo acadêmico; os demais testes existentes ainda mantêm seus inicializadores locais. A suíte PostgreSQL exige `TEST_DATABASE_URL`, usa schema aleatório e desfaz todas as alterações por rollback. A CI provisiona PostgreSQL 16 temporário para essa verificação.

O repositório usa um único pacote: separar frontend e API em workspaces agora acrescentaria complexidade ao build integrado sem um consumidor independente. As decisões estão em [Decisões de arquitetura](decisions/README.md). O documento [Estado do projeto](../PROJECT_STATUS.md) contém apenas o estado atual; o registro anterior foi arquivado como documentação de releases.
