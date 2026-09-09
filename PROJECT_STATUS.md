# Estado do Projeto Aprendiz

Atualizado em 09 de setembro de 2026 (America/Sao_Paulo).

Este arquivo é o ponto de retomada para novas tarefas no Codex. Leia-o antes de alterar o projeto e atualize-o depois de mudanças relevantes ou de um deploy.

## Ponto de retomada

- Repositório: `AlexCode-Br/projeto-aprendiz-aprimorado`
- Branch de trabalho: `codex/melhorias-projeto-aprendiz`
- Último commit da aplicação publicado em produção: `ecd2b8e`
- Produção: `https://aprendizicm.com.br`
- Hospedagem: Cloudflare Workers; o Render não faz mais parte deste projeto.
- Worker: `aprendiz-staging`
- Versão Cloudflare verificada: `23fa1eee-1c03-4d68-adb8-8936ebe4e83d`
- Banco, autenticação e armazenamento: Supabase; a API acessa o PostgreSQL por Cloudflare Hyperdrive.
- Estado atual: produção saudável, reorganização do código-fonte publicada e endpoint `/api/health` respondendo com banco PostgreSQL conectado.

## Decisões consolidadas

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
- O Service Worker usa um ícone grande transparente para evitar o fallback de inicial do navegador em notificações Android/One UI, mantendo apenas a identidade do app.
- O shell do aplicativo e os modais acompanham a altura real do viewport visual e a área segura inferior; isso preserva a rolagem completa em todas as páginas quando o PWA abre por notificação, retorna do segundo plano ou muda de orientação.

## Organização do código-fonte

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

O conjunto atual possui 73 testes: 72 executados com sucesso e uma regressão PostgreSQL opcional, ignorada quando `TEST_DATABASE_URL` não está definida.

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

## Prompt curto para uma nova tarefa

> Continue o Projeto Aprendiz no mesmo repositório. Leia primeiro `PROJECT_STATUS.md`, preserve alterações e arquivos locais que não pertençam à tarefa, valide a implementação antes de publicar e atualize o registro após mudanças relevantes. Minha solicitação é: ...
