# Estado do Projeto Aprendiz

Atualizado em 23 de setembro de 2026 (America/Sao_Paulo).

Este arquivo é o ponto de retomada para novas tarefas no Codex. Leia-o antes de alterar o projeto e atualize-o depois de mudanças relevantes ou de um deploy.

## Ponto de retomada

### Mural participativo, apresentação e notificações da turma — publicado

- Página selecionada da turma usa `CourseRoom` compartilhado entre professor e aluno: banner, navegação horizontal Mural/Aulas/Arquivos/Informações, coluna lateral com próxima aula e local, e compositor de publicação direto no mural. No aluno, Informativos da gestão e Frequência permanecem separados. Arquivos são consultados em grupos paginados de publicações. A referência visual não amplia permissões para dados/fotos de colegas nem cria um chat privado ou em tempo real.

- Alunos matriculados podem publicar textos, fotos/anexos, curtir e comentar no mural da turma. Editam somente as próprias publicações; professor pode excluir conteúdo e comentários da própria turma. Informativos administrativos continuam separados.
- O professor escolhe por turma entre participação completa, somente comentários/reações ou mural somente leitura para alunos. A restrição é aplicada na API a publicações, edições, comentários e curtidas. O compositor do professor oferece categoria, destaque e confirmação de leitura sem abrir outro modal.
- Publicações comuns registram visualização após permanecerem visíveis por 900 ms; itens que exigem confirmação continuam dependendo do botão explícito do aluno. Comentários carregam a página mais recente primeiro, as curtidas respondem de forma otimista e o feed verifica uma versão compacta a cada cinco segundos, recarregando apenas quando há mudança.
- Notificações do Mural funcionam por evento: nova publicação e comentário avisam os demais alunos ativos da turma, o professor responsável e todos os gestores ativos; curtida avisa somente o autor da publicação, seja aluno ou professor. O autor da ação nunca recebe o próprio aviso. Preferências independentes (`wallPosts`, `wallComments` e `wallLikes`) controlam o push do aplicativo; mensagens do mural não geram e-mail. O clique abre diretamente a turma no perfil correto. O gestor possui acesso administrativo somente leitura ao mural pela página Turmas. Informativos da gestão continuam em fluxo e preferência separados, sem duplicar avisos do Mural.
- Configuração inicial das turmas do professor solicita local e banner opcionais e pode ser reaberta depois. Sem imagem, o cabeçalho usa fundo vermelho. Ao escolher uma imagem, abre editor de recorte com arrasto, zoom, pinça de dois dedos e teclado; só aplica ao confirmar. A fonte otimizada é preservada para reenquadramentos posteriores pelo botão Ajustar recorte da imagem.
- O card de configuração mostra os dias/horários existentes e permite ajustá-los pelo formulário compartilhado, preservando ajustes do banner. O usuário optou por colar o link compartilhado do Google Maps, dispensando Google Cloud: o servidor valida o domínio/protocolo, armazena em `class_presentation.address` e devolve `mapsUrl`; o aluno vê o botão para abrir o local. Nenhum redirecionamento é seguido pelo servidor.
- Migrações `023_course_community.sql` e `024_course_wall_permissions.sql` adicionam apresentação, política de participação, curtidas e comentários em tabelas privadas com RLS. A API confere vínculo ativo para cada acesso, inclusive à imagem do banner; não há novas tabelas públicas.
- Validação local: `pnpm lint` e `pnpm check` aprovados (92 testes: 91 executados com sucesso e uma regressão PostgreSQL opcional não executada), incluindo notificações por perfil, preferências, exclusão do autor da ação e as três políticas do mural. Fluxos desktop e mobile (390 × 844) conferidos visualmente em banco isolado. Publicado em 23/09/2026 na versão Cloudflare `09c0bd1b-79eb-4201-9882-fa3f89b802c2`.

### Área do aluno e mural — publicados

- Implementada a área do aluno com navegação reduzida: Início e Meus cursos; dados pessoais em Configurações. O Mural permanece acessível somente dentro do curso correspondente.
- Os informativos por turma evoluíram para o **Mural da turma**: o professor cria, edita e exclui publicações categorizadas, anexa imagens/PDFs, fixa conteúdo e pode exigir confirmação de leitura. O aluno vê somente o mural das próprias matrículas e confirma explicitamente quando solicitado. A migração `022_course_wall.sql` guarda essa exigência sem abrir acesso direto às tabelas.
- Meus cursos lista matrículas e abre detalhes com abas separadas para Mural do professor e Informativos da gestão, além de calendário e frequência exclusivamente do aluno. Professor publica avisos na ação de sua turma; gestor define as turmas destinatárias em Informativos.
- Aluno pode editar nome, foto e dados pessoais; nunca matrícula, curso ou chamada. E-mail de acesso/contato só muda após senha atual e confirmação enviada ao novo endereço.
- Contas vinculadas explicitamente por convite do gestor, permissões de API e arquivos restritas, migração `020_student_portal.sql` e rotina agendada de notificações incluídas.
- O catálogo local passou a incluir as 27 igrejas de Salvador fornecidas pelo site de inscrição, reutilizadas nos formulários de turmas, alunos, professores e configurações do aluno. Localidades existentes foram preservadas, e EAD continua restrito à modalidade de turma.
- Publicação realizada em 22/09/2026. O Worker inicializa de forma idempotente as tabelas privadas, o contrato do mural e o catálogo necessários à área do aluno. Fluxos reais de convite, troca de e-mail, Storage e push ainda devem ser acompanhados com contas controladas. Ver detalhes em `docs/STUDENT_PORTAL.md`.

- Repositório: `AlexCode-Br/projeto-aprendiz-aprimorado`
- Branch de trabalho: `codex/melhorias-projeto-aprendiz`
- Último commit da aplicação publicado em produção: `0c70808` (alterações atuais publicadas a partir da árvore de trabalho; commit ainda pendente)
- Produção: `https://aprendizicm.com.br`
- Hospedagem: Cloudflare Workers; o Render não faz mais parte deste projeto.
- Worker: `aprendiz-staging`
- Versão Cloudflare verificada: `09c0bd1b-79eb-4201-9882-fa3f89b802c2`
- Banco, autenticação e armazenamento: Supabase; a API acessa o PostgreSQL por Cloudflare Hyperdrive.
- Estado atual: produção saudável, reorganização do código-fonte publicada e endpoint `/api/health` respondendo com banco PostgreSQL conectado.

## Decisões consolidadas

- “Meus alunos” do professor exibe frequência no lugar dos contatos, cinco alunos por página e filtros de curso, turma, igreja do aluno e classe. Contatos permanecem em “Dados do aluno”. A frequência considera registros das matrículas ativas nas turmas do próprio professor e período letivo, respeita os filtros de curso/turma e inclui justificativas; ausência de registros aparece como “Sem chamadas”. Alteração validada localmente, ainda não publicada.
- O dashboard do professor não exibe mais “Últimos alunos adicionados”. “Próximas aulas” permite consultar qualquer data, mantendo horários semanais e datas específicas por turma; datas específicas são armazenadas separadamente para não alterar a recorrência semanal.
- “Informativos e avisos” exibe exclusivamente publicações do gestor e não mistura conteúdo do Mural da turma. No mural, a listagem das publicações fica separada do formulário de criação/edição, e o professor responsável vê nome e horário dos alunos da própria turma que visualizaram cada item. Alteração publicada em 22/09/2026.
- A área do aluno não possui uma página independente de Mural: as publicações do professor e os informativos do gestor aparecem em abas distintas dentro de cada curso matriculado. Ao criar ou editar um informativo, o gestor escolhe somente uma ou mais turmas ofertadas; o sistema deriva o professor responsável e o público de alunos sem permitir seleção individual de professores. Alteração publicada em 22/09/2026.
- A sidebar exibe em cascata somente as turmas do professor autenticado sob “Minhas turmas” e somente os cursos matriculados do aluno sob “Meus cursos”. Os atalhos do aluno abrem os detalhes do curso; os do professor posicionam a respectiva turma na tela de gerenciamento. Alteração publicada em 22/09/2026.
- A opção genérica “Ver todas” foi removida das cascatas e cada item abre exclusivamente todas as informações da turma ou curso selecionado. Alteração publicada em 22/09/2026.
- O mural exibe fotos de perfil em publicações, comentários e no campo de criação, com acesso às imagens limitado aos membros ativos da turma. Publicações e interações usam verificação compacta de versão a cada cinco segundos com a aba visível ou ao retornar a ela. Alteração validada localmente; ainda não publicada.
- O professor controla a participação dos alunos no mural por turma (publicar/comentar/reagir, comentar/reagir ou somente visualizar). Publicações comuns geram leitura por visibilidade; confirmações obrigatórias permanecem explícitas. Regras e preservação da configuração foram cobertas por testes de API. Alteração validada localmente; ainda não publicada.
- Informativos administrativos não exibem mais contagem ou lista de leitores ao gestor. O estado de leitura permanece privado para cada professor ou aluno controlar itens novos e para o sistema gerenciar notificações; as confirmações visíveis do Mural da turma continuam separadas. Alteração validada localmente; ainda não publicada.
- Publicações e comentários do Mural notificam o grupo da turma, incluindo o professor e gestores, com exclusão do autor da ação; curtidas notificam somente o dono da publicação. As três categorias podem ser desligadas separadamente em Configurações. Alteração validada localmente; ainda não publicada.
- Teste em massa reproduzível em `pnpm test:mass`: 5 professores, 25 alunos, 5 turmas, 60 chamadas, 71 publicações, 230 comentários, 300 curtidas, 29 anexos, 10 informativos, 2.526 eventos de notificação e 1.084 requisições, sem erro HTTP inesperado. Os dois P1 foram corrigidos: chamadas salvas preservam o elenco histórico e o Mural usa outbox assíncrona em lote, push agrupado por turma e nenhuma notificação por e-mail. Vinte comentários simultâneos na turma de 25 ficaram em p95 de 96,93 ms; a verificação leve do mural em concorrência 30 atingiu 1.366,71 req/s. Paginação de Informativos, consultas de leitores restritas ao professor e índices compostos também foram incluídos. Relatório em `docs/MASS_TEST_2026-09-23.md`. Alterações ainda não publicadas; nenhuma carga foi aplicada à produção.

- A logo da página de login é estática; a animação experimental foi retirada por solicitação do usuário em 17/09/2026 (alteração local ainda não publicada).

- A antiga página “Cursos e igrejas” tornou-se “Turmas” e mostra somente as turmas ofertadas.
- Cada turma combina curso, igreja ou modalidade EAD e professor. `EAD` substitui definitivamente `Remoto`.
- O curso ofertado é definido na criação da turma e não pode ser alterado depois; na edição, o gestor modifica somente igreja/localidade e professor.
- Excluir uma turma remove seus vínculos, mas nunca exclui o cadastro do aluno.
- Igrejas de alunos e professores usam sugestões completas e também aceitam valores personalizados; EAD não é igreja principal. A sigla denominacional `ICM` não integra o nome do local e é removida de dados antigos e de novas entradas.
- Horários aceitam múltiplos dias e horários semanais e detectam conflitos entre turmas do mesmo professor.
- A frequência pertence à turma e ao aluno; relatórios PDF e CSV funcionam como folha de chamada por data e período.
- Cards mobile de alunos, professores e turmas usam layout compacto e menu vertical de três pontos quando há ações.
- A seção “Alunos por turma” da visão geral usa um ranking horizontal compacto, ordena por mais ou menos alunos e navega em páginas de até seis turmas.
- A seção “Últimas inscrições” representa matrículas reais, ordenadas por `enrollments.enrolled_at`, navega em páginas de até cinco registros e filtra por recentes, hoje, ontem ou semana no fuso da aplicação.
- A listagem do gestor mostra igreja e classe dos alunos; nome e foto abrem os demais dados, e até 100 alunos podem ser selecionados para matrícula ou anonimização em lote com operação transacional.
- A matrícula em lote ignora alunos que já estão na turma, informa separadamente quantos foram realmente adicionados e não repete o e-mail ao professor quando nenhuma matrícula nova foi criada.
- A listagem de professores exibe professor, cursos e acesso; igreja deixou de ser coluna, e nome/foto abrem “Dados do professor”, mantendo somente editar, reenviar convite e excluir nas ações.
- Detalhes de aluno e professor destacam foto e nome e organizam contatos e vínculos em uma grade compacta.
- Modais usam o `X` do cabeçalho como saída. Botões `Cancelar`, `Fechar` ou `Voltar` foram removidos quando executavam exatamente a mesma ação; cancelamentos de subações independentes permanecem.
- Fotos de perfil usam carregamento assíncrono, fallback imediato por inicial e cache no cliente.
- Fotos ampliadas usam uma visualização global circular sem botão de fechar: clique ou toque fora e `Esc` encerram a visualização, e o gesto de pinça permite zoom no mobile.
- Ao cadastrar um aluno, vinculá-lo a uma nova turma ou removê-lo de uma turma pela edição, o professor responsável recebe um e-mail com o curso, a identificação da turma e o local; edições sem mudança de matrícula não repetem o aviso.
- O remetente oficial é `naoresponda@aprendizicm.com.br`; os e-mails usam as marcas do Departamento de Louvor e do Projeto Aprendiz.
- O cabeçalho exibe somente o nome da página atual, no desktop e no mobile.
- O frontend é instalável como PWA em desktop, Android e iPhone; o service worker armazena somente o shell estático e nunca respostas da API ou dados privados. O Worker garante a tabela de inscrições push de forma idempotente na primeira requisição de cada isolamento.
- Notificações Web Push reutilizam as preferências dos avisos por e-mail, exigem consentimento explícito por dispositivo, cifram o conteúdo com VAPID e removem assinaturas expiradas. No iPhone, a ativação é oferecida somente no web app instalado na Tela de Início.
- Os ícones instaláveis usam a marca do Projeto Aprendiz em fundo vermelho; o Service Worker usa uma versão monocromática da marca como badge da notificação para melhor contraste na barra do dispositivo.
- O clique em uma notificação abre ou foca o app na rota correspondente ao aviso: alunos, suporte, turmas ou configurações, conforme o perfil do usuário.
- Sessões sem “Permanecer conectado” usam cookie de sessão, não restauram uma sessão Supabase ausente e não mantêm notificações push ativas; ao abrir o app sem sessão, notificações pendentes e o indicador local são limpos.
- Sessões com “Permanecer conectado” podem ser restauradas pelo cookie seguro do aplicativo mesmo se o Android ainda não tiver disponibilizado o estado local do Supabase ao reabrir o PWA.
- O PWA inicia em `/` e a rota `/login` redireciona usuários já autenticados ao painel; o identificador instalado continua `/login` para preservar a atualização de instalações existentes.
- O Service Worker usa um ícone grande transparente para evitar o fallback de inicial do navegador em notificações Android/One UI, mantendo apenas a identidade do app.
- O shell do aplicativo e os modais acompanham a altura real do viewport visual e a área segura inferior; isso preserva a rolagem completa em todas as páginas quando o PWA abre por notificação, retorna do segundo plano ou muda de orientação.
- Configurações da conta usa cartões responsivos e recolhíveis para perfil, segurança, notificações, dispositivos e exclusão; a foto continua sendo salva automaticamente e o nome mantém confirmação explícita.
- A troca de senha em Configurações envia um link seguro de recuperação sem exibir o endereço de e-mail nessa seção nem solicitar ou manipular a senha atual dentro da página autenticada.
- Preferências de notificação são salvas automaticamente a cada alteração e incluem “Comunicados do sistema”, desativado por padrão.
- “Dispositivos conectados” lista assinaturas Web Push reais, identifica sistema e navegador, destaca o dispositivo atual e permite remover autorizações antigas sem expor endpoints secretos.
- A exclusão da conta exige a digitação do e-mail, revoga sessões e notificações e anonimiza dados pessoais sem apagar registros acadêmicos ou auditorias; a última conta ativa de gestor é protegida contra exclusão.
- As listas de turmas, alunos, professores, informativos e chamados do gestor exibem cinco registros por página, com navegação compacta por setas após a aplicação das buscas e filtros.

## Organização do código-fonte

- A revisão comparativa da área do professor está em `docs/REVISAO_AREA_PROFESSOR.md`. Os achados e propostas de padronização estão documentados; ainda não foram implementados.

- A arquitetura e a responsabilidade dos diretórios estão em `docs/ARCHITECTURE.md`.
- A cópia local canônica deve ficar em `C:\Users\alexa\Documents\Codex\2026-08-25\v\projeto-aprendiz`.
- Cópias antigas, rollbacks manuais e artefatos de QA foram removidos; recupere versões anteriores pelo Git.
- `node_modules/`, `dist/`, `cloudflare/build/`, `.wrangler/` e bancos locais são regeneráveis e permanecem ignorados.
- Não versione `.env`, tokens, cookies, chaves do Supabase, chaves do Resend ou credenciais da Cloudflare.
- O arquivo `wrangler.jsonc` é a fonte de verdade da infraestrutura pública.

## Validação e deploy

Antes de publicar:

```bash
pnpm check
git diff --check
git status --short
```

Validação local em 23/09/2026: 94 testes, sendo 93 executados com sucesso e uma regressão PostgreSQL opcional ignorada porque `TEST_DATABASE_URL` não está definida. `pnpm lint`, build React, empacotamento do Worker e o teste em massa (`pnpm test:mass`) passaram. O cenário de carga usou banco temporário isolado e não escreveu em produção.

Fluxo de publicação:

```bash
git add -- <arquivos da alteração>
git commit -m "Descrição objetiva"
git push origin codex/melhorias-projeto-aprendiz
pnpm run cloudflare:deploy
```

Depois do deploy, confirme:

- o `Current Version ID` informado pelo Wrangler;
- resposta HTTP 200 do domínio principal;
- presença do bundle atual no HTML;
- resposta HTTP 200 de `/api/health` e banco `postgres`.

Registre neste arquivo o novo commit, a versão Cloudflare, as decisões permanentes e qualquer pendência real.

### Publicação — 22/09/2026

- Cascatas simplificadas e visualização exclusiva da turma selecionada publicadas no commit `0c70808`.
- Versão Cloudflare verificada: `3622f94f-e079-437a-a15d-91ee92ea2fa4`; `/login`, bundle principal e bundle de Minhas turmas retornaram HTTP 200, `/api/health` confirmou PostgreSQL, `/api/auth/me` retornou HTTP 401 sem sessão e `www` redirecionou com HTTP 308 para a raiz.
- Informativos da gestão integrados às turmas do aluno, seleção administrativa restrita a turmas e menus em cascata publicados no commit `f12eaa3`.
- Versão Cloudflare verificada: `a0969403-7e98-474b-9c06-020284518db1`; `/login` e o bundle principal retornaram HTTP 200, `/api/health` confirmou PostgreSQL, `/api/auth/me` retornou HTTP 401 sem sessão e `www` redirecionou com HTTP 308 para a raiz.
- Separação entre Informativos e Mural da turma, formulário independente e identificação dos alunos que visualizaram cada publicação entregues no commit `27f5d8a`.
- Versão Cloudflare verificada: `9d796ad0-34ed-4fc7-a46a-567ebcb903f3`; raiz e bundle do mural retornaram HTTP 200, `/api/health` confirmou PostgreSQL, `/api/auth/me` retornou HTTP 401 sem sessão e `www` redirecionou com HTTP 308 para a raiz.
- Área completa do aluno, catálogo de igrejas, confirmação segura de e-mail e mural das turmas publicados no commit `6e3ae3c`.
- O mural permite ao professor publicar, editar, excluir, anexar arquivos, fixar conteúdo e solicitar confirmação de leitura; o aluno acessa somente as próprias turmas.
- Cron de notificações ativado a cada cinco minutos e tabelas privadas inicializadas com RLS e privilégios públicos revogados.
- Versão Cloudflare verificada: `9c923683-398d-4fd6-9967-57a11eaea570`.
- Validação pós-publicação: `/login` e `/api/health` retornaram HTTP 200, o banco respondeu `postgres`, `/api/auth/me` retornou HTTP 401 sem sessão, o bundle principal retornou HTTP 200 e `www` redirecionou com HTTP 308 para a raiz.

### Publicação — 09/09/2026

- Correção de rolagem do PWA após abertura por notificação publicada no commit `6deef72`.
- Versão Cloudflare verificada: `f9c65336-a45a-436d-a5da-5399fc28d49f`.
- Validação pós-publicação: `/login`, `/api/health` e o ícone transparente retornaram HTTP 200; `/api/auth/me` retornou HTTP 401 sem sessão, conforme esperado.
- Restauração de “Permanecer conectado” ao reabrir o PWA publicada no commit `d5667cd`.
- Versão Cloudflare verificada: `f245021d-47ae-4191-955f-9e665814fbfb`; `/login` e `/api/health` retornaram HTTP 200, banco PostgreSQL conectado e `/api/auth/me` retornou HTTP 401 sem sessão, conforme esperado.
- Entrada do PWA corrigida no commit `1bde7ce`: início em `/`, redirecionamento de usuários autenticados que ainda abram `/login` e shell atualizado para v8.
- Versão Cloudflare verificada: `8db3b9c6-2fc7-4843-ad60-c5468c5c90da`; raiz, `/login` e `/api/health` retornaram HTTP 200, e manifesto, bundle atual e Service Worker v8 foram confirmados em produção.
- Redesenho de Configurações da conta publicado no commit `818c5d8`, com perfil, segurança, preferências, dispositivos de notificações e exclusão protegida da conta.
- Versão Cloudflare verificada: `cdc85a3e-37cd-424d-bac5-2e727a8df2af`; raiz e `/login` retornaram HTTP 200, `/api/health` confirmou PostgreSQL, `/api/auth/me` retornou HTTP 401 sem sessão, o bundle de Configurações retornou HTTP 200 e `www` redirecionou com HTTP 308 para a raiz.
- Ajustes de Configurações e grade 2×2 dos indicadores do dashboard no mobile publicados nos commits `62af901` e `1571dc1`.
- Versão Cloudflare verificada: `141b76ef-15cb-4419-a63a-686a9729efb8`; raiz e `/login` retornaram HTTP 200, `/api/health` confirmou PostgreSQL, `/api/auth/me` retornou HTTP 401 sem sessão, os bundles atuais de Dashboard e Configurações retornaram HTTP 200 e `www` redirecionou com HTTP 308 para a raiz.
- Perfil das Configurações restaurado e recarregamento da foto durante a digitação do nome corrigido no commit `ef0c945`.
- Versão Cloudflare verificada: `96d26e60-c965-4287-8879-ebc0820a504a`; raiz e `/login` retornaram HTTP 200, `/api/health` confirmou PostgreSQL, `/api/auth/me` retornou HTTP 401 sem sessão, os bundles de Configurações e foto de perfil retornaram HTTP 200 e `www` redirecionou com HTTP 308 para a raiz.
- Perfil compacto das Configurações restaurado conforme o modelo aprovado no commit `5041597`, preservando a correção que evita recarregar a foto durante a digitação do nome.
- Versão Cloudflare verificada: `821b512e-c86a-43d2-b368-52fb088ff963`; raiz e `/login` retornaram HTTP 200, `/api/health` confirmou PostgreSQL, `/api/auth/me` retornou HTTP 401 sem sessão, o bundle atual de Configurações retornou HTTP 200 e `www` redirecionou com HTTP 308 para a raiz.
- Paginação de cinco registros nas listas de turmas, alunos, professores, informativos e suporte publicada no commit `ca2239a`.
- Versão Cloudflare verificada: `8982f9c3-0b2d-46cc-bc48-5957bb59dabb`; raiz, `/login` e o bundle principal retornaram HTTP 200, `/api/health` confirmou PostgreSQL, `/api/auth/me` retornou HTTP 401 sem sessão e `www` redirecionou com HTTP 308 para a raiz.
- Logo estática restaurada no login e revisão comparativa da área do professor registrada no commit `95d1331`.
- Versão Cloudflare verificada: `90a466a9-4037-4e4f-8c58-c7acba3d6ea0`; `/login` e `/api/health` retornaram HTTP 200, o banco respondeu `postgres`, `/api/auth/me` retornou HTTP 401 sem sessão e `www` respondeu HTTP 308 para a raiz.
- Lista “Meus alunos” do professor atualizada no commit `41a1561`, com frequência, filtros, paginação de cinco registros e contatos preservados no modal.
- Versão Cloudflare verificada: `6542f056-b7d5-4964-aa4f-5bc672683bcd`; `/login` e `/api/health` retornaram HTTP 200, o banco respondeu `postgres`, `/api/auth/me` retornou HTTP 401 sem sessão e `www` respondeu HTTP 308 para a raiz.
- Agenda personalizada do dashboard do professor publicada no commit `750e139`, com remoção do card de alunos recentes, seleção de data e aulas específicas.
- Versão Cloudflare verificada: `02b7c3ec-ac41-428b-8ee5-d57493e651f8`; `/login` e `/api/health` retornaram HTTP 200, o banco respondeu `postgres` e `/api/auth/me` retornou HTTP 401 sem sessão.
- Hotfix `aae5493` passou a garantir de forma idempotente a tabela de datas específicas no Worker, corrigindo o erro inicial do dashboard em produção.
- Versão Cloudflare verificada: `87567d82-4d8d-4366-8c8c-abc7f28887f8`; `/api/health` retornou HTTP 200 com PostgreSQL e duas atualizações consecutivas de `/api/dashboard/professor` foram atendidas sem erro nos logs.
- Atualização do mural publicada em 23/09/2026: fotos de perfil em publicações, comentários e compositor, rotas de foto limitadas aos membros ativos da turma e atualização automática do mural em até três segundos.
- Versão Cloudflare verificada: `1913afa6-7125-4c7e-b45a-fa20f6ea3a27`; raiz, `/login`, bundle de sala da turma e `/api/health` retornaram HTTP 200, com PostgreSQL conectado.
- Mural participativo, permissões por turma, acompanhamento administrativo e notificações de publicações, comentários e curtidas publicados em 23/09/2026.
- Versão Cloudflare verificada: `09c0bd1b-79eb-4201-9882-fa3f89b802c2`; raiz, `/login`, bundle do mural e `/api/health` retornaram HTTP 200, PostgreSQL conectado e `/api/auth/me` retornou HTTP 401 sem sessão, conforme esperado.

## Prompt curto para uma nova tarefa

> Continue o Projeto Aprendiz no mesmo repositório. Leia primeiro `PROJECT_STATUS.md`, preserve alterações e arquivos locais que não pertençam à tarefa, valide a implementação antes de publicar e atualize o registro após mudanças relevantes. Minha solicitação é: ...
