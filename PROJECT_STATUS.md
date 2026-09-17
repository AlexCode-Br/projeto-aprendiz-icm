# Estado do Projeto Aprendiz

Atualizado em 17 de setembro de 2026 (America/Sao_Paulo).

Este arquivo é o ponto de retomada para novas tarefas no Codex. Leia-o antes de alterar o projeto e atualize-o depois de mudanças relevantes ou de um deploy.

## Ponto de retomada

- Repositório: `AlexCode-Br/projeto-aprendiz-aprimorado`
- Branch de trabalho: `codex/melhorias-projeto-aprendiz`
- Último commit da aplicação publicado em produção: `ca2239a`
- Produção: `https://aprendizicm.com.br`
- Hospedagem: Cloudflare Workers; o Render não faz mais parte deste projeto.
- Worker: `aprendiz-staging`
- Versão Cloudflare verificada: `8982f9c3-0b2d-46cc-bc48-5957bb59dabb`
- Banco, autenticação e armazenamento: Supabase; a API acessa o PostgreSQL por Cloudflare Hyperdrive.
- Estado atual: produção saudável, reorganização do código-fonte publicada e endpoint `/api/health` respondendo com banco PostgreSQL conectado.

## Decisões consolidadas

- “Meus alunos” do professor exibe frequência no lugar dos contatos, cinco alunos por página e filtros de curso, turma, igreja do aluno e classe. Contatos permanecem em “Dados do aluno”. A frequência considera registros das matrículas ativas nas turmas do próprio professor e período letivo, respeita os filtros de curso/turma e inclui justificativas; ausência de registros aparece como “Sem chamadas”. Alteração validada localmente, ainda não publicada.

- A logo da página de login é estática; a animação experimental foi retirada por solicitação do usuário em 17/09/2026 (alteração local ainda não publicada).

- A antiga página “Cursos e igrejas” tornou-se “Turmas” e mostra somente as turmas ofertadas.
- Cada turma combina curso, igreja ou modalidade EAD e professor. `EAD` substitui definitivamente `Remoto`.
- O curso ofertado é definido na criação da turma e não pode ser alterado depois; na edição, o gestor modifica somente igreja/localidade e professor.
- Excluir uma turma remove seus vínculos, mas nunca exclui o cadastro do aluno.
- Igrejas de alunos e professores usam sugestões completas e também aceitam valores personalizados; EAD não é igreja principal.
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

O conjunto atual possui 80 testes: 79 executados com sucesso e uma regressão PostgreSQL opcional, ignorada quando `TEST_DATABASE_URL` não está definida.

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

## Prompt curto para uma nova tarefa

> Continue o Projeto Aprendiz no mesmo repositório. Leia primeiro `PROJECT_STATUS.md`, preserve alterações e arquivos locais que não pertençam à tarefa, valide a implementação antes de publicar e atualize o registro após mudanças relevantes. Minha solicitação é: ...
