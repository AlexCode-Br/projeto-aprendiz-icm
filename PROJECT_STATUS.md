# Estado do Projeto Aprendiz

Atualizado em 30 de setembro de 2026 (America/Sao_Paulo).

Este arquivo é o ponto de retomada para novas tarefas no Codex. Leia-o antes de alterar o projeto e atualize-o depois de mudanças relevantes ou de um deploy.

## Ponto de retomada

### Remediação integral da auditoria de segurança — publicada

- Autenticação reforçada com verificação em duas etapas por e-mail obrigatória para gestores em produção, desafio de uso único, limite de tentativas e sessão criada somente após a validação. Recuperações de senha passaram a consumir o token atomicamente, e convites/recuperações usam fragmento de URL para reduzir vazamento em histórico, logs e cabeçalho `Referer`.
- Sessões ganharam expiração por inatividade, prazo menor para gestores, inventário de dispositivos e revogação individual. Exclusão de conta exige e-mail completo e senha atual; a exclusão de professor preserva a trilha de auditoria com identidade anonimizada.
- Limites distribuídos agora cobrem publicações, comentários, curtidas, chamados, respostas e testes de notificação, além do login. Turnstile valida hostname e idade do desafio. Conteúdo rico possui limite estrutural, e o acesso indevido a anexos do mural pela rota de informativos foi bloqueado.
- Uploads aceitam somente PNG, JPEG, WebP e PDF, conferem assinatura real e extensão, limitam dimensões, removem metadados de imagem, rejeitam recursos ativos em PDFs e entregam PDFs como download. Notificações push não expõem conteúdo pessoal na tela bloqueada por padrão.
- A migração `027_security_audit_remediation.sql` fecha RLS de fotos e desafios de MFA e adiciona os campos de sessão. O Worker não executa mais DDL durante requisições; o comando de deploy exige migrações antes da publicação. Rotina agendada remove sessões, desafios, resets e itens de outbox expirados.
- Dependências vulneráveis foram atualizadas/forçadas para versões corrigidas. `pnpm audit --prod` e `pnpm audit --dev` não encontraram vulnerabilidades conhecidas. O plano de backup, restauração e resposta a incidentes está em `docs/DISASTER_RECOVERY.md`; ativação e ensaio do backup no painel do Supabase continuam sendo uma ação operacional externa.
- Validação local concluída com `pnpm lint`, `pnpm check`, `git diff --check` e `pnpm cloudflare:build`: 102 testes aprovados, uma regressão PostgreSQL opcional ignorada sem `TEST_DATABASE_URL`, build do frontend e empacotamento seco do Worker concluídos. A migração `027_security_audit_remediation.sql` foi aplicada em produção por uma sessão remota temporária e transacional ligada ao Hyperdrive; o utilitário efêmero foi removido imediatamente após a confirmação. Publicado em 30/09/2026 na versão Cloudflare `dcb178bd-f651-40fd-aab6-2d5f80d5c87b`; `/login` e `/api/health` retornaram HTTP 200, `/api/auth/me` anônimo retornou 401, `www` redirecionou com 308 e o bundle publicado contém o fluxo de MFA.
- Hotfix do MFA publicado na versão `da92a629-b993-41a7-9079-dc7f2e9f33a3`: o adaptador PostgreSQL do Worker passou a qualificar `manager_login_challenges` com o schema privado `projeto_aprendiz`. A ausência desse mapeamento causava HTTP 500 ao confirmar o código, embora a tabela e a migração estivessem corretas. Regressão adicionada para `SELECT` e `UPDATE`; teste integrado do MFA, testes do adaptador e lint aprovados. Após a publicação, `/api/health` retornou 200 e sessão anônima retornou 401.
- Homologação posterior: o responsável confirmou o login real do gestor com o código recebido por e-mail. A decisão atual é manter esse segundo fator, sem migrar para aplicativo autenticador. A suíte completa foi repetida com 102 testes aprovados e uma regressão PostgreSQL opcional ignorada; lint, build e auditoria de dependências passaram. Em produção, login e política retornaram 200, rotas privadas sem sessão retornaram 401, origem externa foi bloqueada com 403, recuperação inexistente permaneceu genérica, tokens inválidos foram rejeitados e CSP/HSTS estavam presentes.

### Seleção de alunos alinhada às ações — publicada

- Na tabela administrativa, o checkbox de cada aluno agora fica depois de editar e excluir, na extremidade direita da coluna de ações. A lista móvel mantém o mesmo agrupamento visual, sem alterar seleção em massa ou acessibilidade.
- Publicado em 30/09/2026 na versão Cloudflare `d47df33d-a430-4a5d-9a15-7b59edb7451e`; `/login` e `/api/health` retornaram HTTP 200, `/api/auth/me` anônimo retornou 401 e `www` redirecionou com 308.

### Configurações reorganizadas — publicada

- Página compartilhada usa a largura disponível e alinhamento à esquerda, com navegação Perfil, Notificações e Segurança. Dados pessoais permanecem no Perfil; dispositivos de push ficam junto às preferências, sem serem apresentados como sessões de login.
- Aluno e professor usam um seletor `Atividades do mural` para publicações, comentários e curtidas. A interface salva os três campos existentes em uma única requisição, preserva preferências legadas mistas até escolha explícita e restaura o estado anterior em falhas. Gestor mantém somente os três tipos administrativos.
- Lint, suíte automatizada e build verificados. Teste de regressão cobre seleção conjunta, preservação das outras preferências e estado misto. O switch unificado foi publicado em 30/09/2026 na versão Cloudflare `a2a587b5-1f20-4142-8f18-60bc0e48de0a`; `/login` e `/api/health` retornaram HTTP 200, `/api/auth/me` anônimo retornou 401 e `www` redirecionou com 308. O chunk publicado `AccountSettings-D4w-hINl.js` contém o switch das atividades do mural.

### Página da turma responsiva — local, não publicada

- No celular, as ações `Editar curso` e `Configurar turma` viraram ícones compactos no canto superior direito do banner, preservando a imagem e as áreas de toque. Os rótulos completos reaparecem no desktop e continuam disponíveis por acessibilidade.
- Próxima aula e local dividem uma linha; participantes ocupa uma faixa curta abaixo. O editor usa barra de formatação em uma única linha com rolagem horizontal de segurança, espaçamento menor e botão de publicação adaptado à largura. Cards, avatares, reações e anexos também receberam medidas próprias para telas estreitas.
- Validação concluída com `pnpm lint`, `pnpm check` e `git diff --check`: 98 testes aprovados, uma regressão PostgreSQL opcional ignorada e build concluído. Ainda não publicado.

### Edição compacta do banner na configuração — publicada

- A prévia do banner em `Configurar turma` concentra as opções de imagem em um único ícone de lápis no canto superior direito. O menu do ícone preserva a escolha de imagem, o ajuste de recorte e o retorno ao fundo vermelho, eliminando os três botões abaixo da prévia.
- Publicado em 30/09/2026 na versão Cloudflare `0e0090c7-a625-4be1-920f-26f352894940`; `/login` e `/api/health` retornaram HTTP 200, `/api/auth/me` anônimo retornou 401 e `www` redirecionou com 308.

### Ações integradas ao banner da turma — publicada

- Professor e aluno abrem a página da turma diretamente pelo banner, que ocupa a largura disponível do conteúdo. Resumo, navegação, mural e demais seções acompanham a mesma largura, sem o limite lateral de 1100 px.
- Para o professor, `Editar curso` e `Configurar turma` ficam dentro do banner, no canto inferior direito. Em telas estreitas, as ações se organizam em coluna. O botão `Visão geral` foi removido da página da turma. O modal de edição usa o mesmo nome e descreve somente os dados que podem ser alterados. Na sidebar do professor, `Dashboard` precede `Frequência`.
- Publicado em 30/09/2026 na versão Cloudflare `83c6a698-5bbb-444f-a3f3-c4191bd31438`; `/login` e `/api/health` retornaram HTTP 200, `/api/auth/me` anônimo retornou 401 e `www` redirecionou com 308.

### Alinhamento das páginas de turma — publicado

- A página compartilhada de turma do professor e do aluno agora começa na margem esquerda do conteúdo, como as demais páginas dos respectivos painéis. O limite de 1100 px foi mantido para preservar a legibilidade do mural em telas largas.
- Validação: `pnpm lint` e `pnpm check` concluídos; 98 testes aprovados, uma regressão PostgreSQL opcional ignorada e build concluído. Publicado em 30/09/2026 na versão Cloudflare `a6410d07-48d2-4f57-800b-56aa96ab8584`; `/login` e `/api/health` retornaram HTTP 200, `/api/auth/me` anônimo retornou 401 e `www` redirecionou com 308.

### Cabeçalho unificado das turmas — publicado

- Professor e aluno usam o mesmo limite de largura de 1100 px para navegação, banner e publicações. Removidos o título externo duplicado e a coluna lateral. Próxima aula, local e participantes (professor) ficam em uma faixa integrada ao cabeçalho; o nome do local abre o Maps quando houver link cadastrado.
- Ações `Editar oferta` e `Configurar turma` ficam juntas, alinhadas ao cabeçalho, com o padrão de botões existente. Banner mantém a proporção panorâmica 6,4:1 com altura mínima para legibilidade no celular. Abas do aluno se distribuem em duas colunas em telas estreitas, sem esconder opções em rolagem horizontal.
- Conferidos no navegador local os modais do professor e as quatro seções do aluno com conta demonstrativa no banco de QA. Verificadas larguras 320, 390, 768 e 1440 px sem overflow horizontal. Lint e build aprovados; suíte com 98 testes aprovados e uma regressão PostgreSQL opcional ignorada. Publicado em 30/09/2026 na versão Cloudflare `ea1f9f56-60eb-4d2e-9fe2-8a51bb189fc8`; `/login` e `/api/health` retornaram HTTP 200, PostgreSQL saudável, sessão anônima 401, `www` redirecionou com 308 e o bundle publicado contém o resumo e as ações reorganizadas.

### Rota intermediária de turmas do professor removida — publicada

- `/professor/turmas` não renderiza mais a antiga página agregadora. Sem uma turma selecionada ou o fluxo explícito de criação, a rota substitui a entrada atual pelo Dashboard; assim, o botão Voltar do navegador não expõe a tela que perdeu sua função.
- `Adicionar turma` continua abrindo exclusivamente o modal de oferta. Ao salvar, a URL é substituída pela turma recém-criada; ao cancelar, o professor retorna ao Dashboard.
- Validação concluída com `pnpm lint`, `pnpm check` e `git diff --check`: 98 testes aprovados, uma regressão PostgreSQL opcional ignorada, zero falhas e build concluído. Uma falha transitória de preparação SQLite apareceu na primeira execução completa; o teste afetado passou isoladamente e a suíte completa passou na repetição. O redirecionamento de `/professor/turmas` para `/professor/dashboard` foi confirmado no navegador local. Publicado em 30/09/2026 na versão Cloudflare `9e5c0dab-f10a-4502-925c-c66fd9ba4026`; `/login` e `/api/health` retornaram HTTP 200, PostgreSQL saudável, sessão anônima 401 e `www` redirecionou com 308. O chunk publicado contém o destino do Dashboard e não contém mais o texto da antiga página agregadora.

### Navegação das turmas simplificada — publicada

- As abas redundantes `Aulas` e `Informações` foram removidas da página da turma. O professor passa a ver somente `Mural` e `Arquivos`; o aluno mantém `Mural`, `Arquivos`, `Informativos` e `Frequência`, que representam conteúdos realmente distintos.
- Próxima aula e local continuam disponíveis como resumos laterais, sem abrir telas duplicadas. Links antigos com `view=calendario` ou `view=informacoes` retornam com segurança ao Mural, e as próximas aulas da visão geral do aluno agora abrem diretamente o curso.
- O card genérico `Sua turma` foi removido do aluno. Para o professor, foi substituído por `Participantes`, com quantidade de matriculados, período quando disponível e a ação compacta de configuração da turma.
- Validação concluída com `pnpm lint`, `pnpm check` e `git diff --check`: 98 testes aprovados, uma regressão PostgreSQL opcional ignorada sem `TEST_DATABASE_URL`, zero falhas e build concluído. A página da turma do professor foi conferida no navegador local. Publicado em 30/09/2026 na versão Cloudflare `17883537-b3fd-439e-a098-ea18da113bfd`; `/login` e `/api/health` retornaram HTTP 200, a API confirmou PostgreSQL saudável, a sessão anônima retornou 401, `www` redirecionou com 308 e o bundle publicado foi confirmado sem as abas `Aulas` e `Informações`.

### Mural reorganizado — publicado

- Editor em largura completa com identificação do autor acima; ferramentas, anexos, fixação e publicação separados e alinhados. Removidos os seletores de tipo/categoria e pedido de confirmação tanto da criação quanto da edição. Novas publicações usam a categoria interna Aviso e não exigem confirmação; edições preservam os valores legados existentes.
- Feed com cabeçalho e contagem, menu de ações reutilizado, imagens em galeria com download sem duplicação nos anexos, comentários multilinha e quebra de textos extensos. A coluna de apoio aparece ao lado somente a partir de 1280 px; conteúdo limitado a 1440 px para leitura em monitores amplos.
- `pnpm lint` e `pnpm check` concluídos (98 aprovados, uma regressão PostgreSQL opcional ignorada, build concluído). Conferidos publicação, comentário, edição, anexo de imagem, nome de arquivo e texto longos; larguras 320, 390, 768 e 1440 px sem overflow horizontal da página e sem erros no console. Publicado em 30/09/2026 na versão Cloudflare `f1dd10ea-0be5-400a-a7bd-d80b8e5811ea`; o chunk `CourseRoom-B5DNiXJG.js` foi confirmado com o novo editor e sem Tipo de publicação ou Pedir confirmação.

### Ação de adicionar turma na sidebar — publicada

- Na área do professor, `Adicionar turma` agora aparece dentro da cascata `Minhas turmas`, imediatamente após a última turma vinculada. O botão abre diretamente o modal `Ofertar um curso` e remove o parâmetro transitório da URL após a abertura.
- Os botões redundantes `Nova turma` e `Ofertar novo curso` foram retirados dos cabeçalhos; o estado vazio mantém sua chamada inicial para o professor que ainda não possui turmas.
- Validação concluída com `pnpm lint`, `pnpm check` e `git diff --check`: 98 testes aprovados, um teste PostgreSQL opcional ignorado sem `TEST_DATABASE_URL`, zero falhas e build concluído. Posição, navegação e abertura do modal foram conferidas no navegador local, sem erros no console. Publicado junto ao mural na versão `f1dd10ea-0be5-400a-a7bd-d80b8e5811ea`; o bundle principal publicado contém a ação `Adicionar turma`.

### Resumo compacto de horários na gestão — publicado

- Em Turmas do gestor, dias que compartilham o mesmo horário agora aparecem em uma única linha curta, como `Ter e Sex às 03:30`. O card e a tabela mostram no máximo dois grupos inicialmente; quando existirem outros, um controle acessível `Ver mais` permite expandir e recolher a lista.
- Validação concluída com `pnpm lint`, `pnpm check` e `git diff --check`: 98 testes aprovados, um teste PostgreSQL opcional ignorado sem `TEST_DATABASE_URL`, zero falhas e build concluído. O cenário de seis aulas distribuídas em três horários foi conferido no navegador em desktop e 390 px, incluindo expansão e recolhimento, sem erros no console. Publicado em 30/09/2026 na versão Cloudflare `abb5618f-2ae4-4ae4-868d-ff82ac2feee9`; `/login`, `/gestor/cursos` e `/api/health` retornaram HTTP 200, o bundle `index-CkAWE-f6.js` foi confirmado, a API reportou PostgreSQL saudável, a rota de sessão sem autenticação retornou 401 e `www` redirecionou com 308 para o domínio principal.

### Catálogos completos e agenda simplificada — publicada

- Node e Worker agora completam o mesmo catálogo permanente de cursos e igrejas/modalidades, incluindo Gaita, todas as igrejas de Salvador e EAD. A carga preserva IDs, nomes e entradas personalizadas, evita duplicação por acentos/caixa e reativa opções permanentes. Corrige a divergência da inicialização em produção que deixava o seletor de oferta incompleto.
- A agenda compartilhada permite selecionar vários dias da semana com um horário comum, adicionar outros grupos de horários e datas avulsas. Horários existentes são agrupados ao editar sem alterar o contrato da API.
- Validação: `pnpm lint`, `pnpm check` e `git diff --check` concluídos; 97 testes aprovados, um teste PostgreSQL opcional ignorado sem `TEST_DATABASE_URL`, zero falhas e build concluído. No navegador, conferidos 11 cursos e 29 locais/modalidades, criada turma local Gaita/EAD com segunda e quarta às 19:30 e reaberta a edição com os dados preservados. Layout verificado em desktop e 390 px, sem erros no console. Publicado em 30/09/2026 na versão Cloudflare `46fdc64d-ee0c-4085-bf9f-90316cdae90e`; `/login`, `/professor/turmas` e `/api/health` retornaram HTTP 200, a API confirmou PostgreSQL saudável, `/api/auth/me` sem sessão retornou 401 e `www` redirecionou com 308 para o domínio principal.

### Oferta de turmas pelo professor — publicada

- O gestor continua responsável por cadastrar e convidar professores, mas a página Turmas agora é somente de acompanhamento e exclusão. Os botões de criar, editar e abrir o Mural foram removidos; as APIs administrativas de criação e edição também respondem com bloqueio, evitando contorno pelo navegador.
- Após ativar a conta, o professor sem turma recebe um fluxo inicial para escolher o curso ofertado, a igreja ou modalidade e ao menos um dia e horário. Ele pode criar outras ofertas em Minhas turmas e alterar posteriormente o local e a agenda das próprias turmas. O curso fica imutável depois da criação para preservar matrículas, frequência e histórico.
- As operações conferem o professor autenticado, o período letivo gravável, os catálogos ativos e conflitos de horário dentro de uma transação. O gestor mantém somente a exclusão definitiva, com confirmação explícita, e recebe avisos administrativos quando uma oferta é criada ou atualizada.
- O Mural passou a aceitar exclusivamente o professor responsável e os alunos com matrícula ativa. Gestores não recebem mais notificações do Mural nem possuem endpoint de leitura.
- Validação concluída com `pnpm lint`, `pnpm check` e `git diff --check`: 96 testes aprovados, uma regressão PostgreSQL opcional ignorada sem `TEST_DATABASE_URL`, zero falhas e build do frontend concluído. Publicado em 30/09/2026 na versão Cloudflare `d7bcd4bf-9ecf-4139-b85e-5f1629c18c4a`; login, rota de Turmas, saúde da API e proteção de sessão foram conferidos em produção.

### Política de Privacidade — publicada

- Criada a rota pública `/politica-de-privacidade`, acessível pela tela de login na mesma aba. A página foi redigida para o funcionamento real do Projeto Aprendiz e cobre dados acadêmicos, dados potencialmente sensíveis ligados à igreja/localidade, menores e responsáveis, Mural, anexos, notificações, sessão, retenção, exclusão e direitos da LGPD.
- O controlador é identificado por nome e canal de privacidade. O CPF completo informado pelo responsável não foi exposto na página pública por minimização e segurança. A política esclarece que a plataforma é uma iniciativa independente, não constitui canal oficial e não representa institucionalmente a Igreja Cristã Maranata.
- A implementação foi conferida localmente em desktop e mobile, sem erros no console. A validação completa aprovou 96 testes, com uma regressão PostgreSQL opcional ignorada por ausência de `TEST_DATABASE_URL`, e o frontend compilou com sucesso.
- Declaração institucional ajustada e publicada em 29/09/2026 na versão Cloudflare `aa99fb1e-5c81-4472-bb90-cec7f64dcb23`: removida a referência ao Portal do Presbitério e incluído que a plataforma não constitui canal oficial nem representa institucionalmente a Igreja Cristã Maranata. `/login`, `/politica-de-privacidade`, o bundle dedicado e `/api/health` retornaram HTTP 200; a API confirmou PostgreSQL, `/api/auth/me` retornou 401 sem sessão e `www` redirecionou com 308 para o domínio principal.

### Mural participativo, apresentação e notificações da turma — publicado

- Página selecionada da turma usa `CourseRoom` compartilhado entre professor e aluno: banner, navegação horizontal Mural/Aulas/Arquivos/Informações, coluna lateral com próxima aula e local, e compositor de publicação direto no mural. No aluno, Informativos da gestão e Frequência permanecem separados. Arquivos são consultados em grupos paginados de publicações. A referência visual não amplia permissões para dados/fotos de colegas nem cria um chat privado ou em tempo real.

- Alunos matriculados podem publicar textos, fotos/anexos, curtir e comentar no mural da turma. Editam somente as próprias publicações; professor pode excluir conteúdo e comentários da própria turma. Informativos administrativos continuam separados.
- O professor escolhe por turma entre participação completa, somente comentários/reações ou mural somente leitura para alunos. A restrição é aplicada na API a publicações, edições, comentários e curtidas. O compositor do professor oferece categoria, destaque e confirmação de leitura sem abrir outro modal.
- Publicações comuns registram visualização após permanecerem visíveis por 900 ms; itens que exigem confirmação continuam dependendo do botão explícito do aluno. Comentários carregam a página mais recente primeiro, as curtidas respondem de forma otimista e o feed verifica uma versão compacta a cada cinco segundos, recarregando apenas quando há mudança.
- Notificações do Mural funcionam por evento: nova publicação e comentário avisam os demais alunos ativos da turma e o professor responsável; curtida avisa somente o autor da publicação, seja aluno ou professor. O autor da ação nunca recebe o próprio aviso. Preferências independentes (`wallPosts`, `wallComments` e `wallLikes`) controlam o push do aplicativo; mensagens do mural não geram e-mail. O clique abre diretamente a turma no perfil correto. Gestores não acessam nem recebem notificações do Mural. Informativos da gestão continuam em fluxo e preferência separados, sem duplicar avisos do Mural.
- Configuração inicial das turmas do professor solicita local e banner opcionais e pode ser reaberta depois. Sem imagem, o cabeçalho usa fundo vermelho. Ao escolher uma imagem, abre editor de recorte com arrasto, zoom, pinça de dois dedos e teclado; só aplica ao confirmar. A fonte otimizada é preservada para reenquadramentos posteriores pelo botão Ajustar recorte da imagem.
- O card de configuração mostra os dias/horários existentes e permite ajustá-los pelo formulário compartilhado, preservando ajustes do banner. O usuário optou por colar o link compartilhado do Google Maps, dispensando Google Cloud: o servidor valida o domínio/protocolo, armazena em `class_presentation.address` e devolve `mapsUrl`; o aluno vê o botão para abrir o local. Nenhum redirecionamento é seguido pelo servidor.
- Migrações `023_course_community.sql` e `024_course_wall_permissions.sql` adicionam apresentação, política de participação, curtidas e comentários em tabelas privadas com RLS. A API confere vínculo ativo para cada acesso, inclusive à imagem do banner; não há novas tabelas públicas.
- Validação local: `pnpm lint` e `pnpm check` aprovados (92 testes: 91 executados com sucesso e uma regressão PostgreSQL opcional não executada), incluindo notificações por perfil, preferências, exclusão do autor da ação e as três políticas do mural. Fluxos desktop e mobile (390 × 844) conferidos visualmente em banco isolado. Publicado em 23/09/2026 na versão Cloudflare `09c0bd1b-79eb-4201-9882-fa3f89b802c2`.

### Área do aluno e mural — publicados

- Implementada a área do aluno com navegação reduzida: Início e Meus cursos; dados pessoais em Configurações. O Mural permanece acessível somente dentro do curso correspondente.
- Os informativos por turma evoluíram para o **Mural da turma**: o professor cria, edita e exclui publicações categorizadas, anexa imagens/PDFs, fixa conteúdo e pode exigir confirmação de leitura. O aluno vê somente o mural das próprias matrículas e confirma explicitamente quando solicitado. A migração `022_course_wall.sql` guarda essa exigência sem abrir acesso direto às tabelas.
- “Meus cursos” funciona como uma cascata na sidebar: cada matrícula abre diretamente o curso com abas separadas para Mural do professor e Informativos da gestão, além de calendário e frequência exclusivamente do aluno. A antiga página agregadora foi removida. Professor publica avisos na ação de sua turma; gestor define as turmas destinatárias em Informativos.
- Aluno pode editar nome, foto e dados pessoais; nunca matrícula, curso ou chamada. E-mail de acesso/contato só muda após senha atual e confirmação enviada ao novo endereço.
- Contas vinculadas explicitamente por convite do gestor, permissões de API e arquivos restritas, migração `020_student_portal.sql` e rotina agendada de notificações incluídas.
- O catálogo local passou a incluir as 27 igrejas de Salvador fornecidas pelo site de inscrição, reutilizadas nos formulários de turmas, alunos, professores e configurações do aluno. Localidades existentes foram preservadas, e EAD continua restrito à modalidade de turma.
- Publicação realizada em 22/09/2026. O Worker inicializa de forma idempotente as tabelas privadas, o contrato do mural e o catálogo necessários à área do aluno. Fluxos reais de convite, troca de e-mail, Storage e push ainda devem ser acompanhados com contas controladas. Ver detalhes em `docs/STUDENT_PORTAL.md`.

- Repositório: `AlexCode-Br/projeto-aprendiz-aprimorado`
- Branch de trabalho: `codex/melhorias-projeto-aprendiz`
- Último commit da aplicação publicado em produção: `81e22cc`
- Produção: `https://aprendizicm.com.br`
- Hospedagem: Cloudflare Workers; o Render não faz mais parte deste projeto.
- Worker: `aprendiz-staging`
- Versão Cloudflare verificada: `d7bcd4bf-9ecf-4139-b85e-5f1629c18c4a`
- Banco, autenticação e armazenamento: Supabase; a API acessa o PostgreSQL por Cloudflare Hyperdrive.
- Estado atual: produção saudável, reorganização do código-fonte publicada e endpoint `/api/health` respondendo com banco PostgreSQL conectado.

## Decisões consolidadas

- “Meus alunos” do professor exibe frequência no lugar dos contatos, cinco alunos por página e filtros de curso, turma, igreja do aluno e classe. Contatos permanecem em “Dados do aluno”. A frequência considera registros das matrículas ativas nas turmas do próprio professor e período letivo, respeita os filtros de curso/turma e inclui justificativas; ausência de registros aparece como “Sem chamadas”. Alteração publicada em 23/09/2026.
- O dashboard do professor não exibe mais “Últimos alunos adicionados”. “Próximas aulas” permite consultar qualquer data, mantendo horários semanais e datas específicas por turma; datas específicas são armazenadas separadamente para não alterar a recorrência semanal.
- “Informativos e avisos” exibe exclusivamente publicações do gestor e não mistura conteúdo do Mural da turma. No mural, a listagem das publicações fica separada do formulário de criação/edição, e o professor responsável vê nome e horário dos alunos da própria turma que visualizaram cada item. Alteração publicada em 22/09/2026.
- A área do aluno não possui uma página independente de Mural: as publicações do professor e os informativos do gestor aparecem em abas distintas dentro de cada curso matriculado. Ao criar ou editar um informativo, o gestor escolhe somente uma ou mais turmas ofertadas; o sistema deriva o professor responsável e o público de alunos sem permitir seleção individual de professores. Alteração publicada em 22/09/2026.
- A sidebar exibe em cascata somente as turmas do professor autenticado sob “Minhas turmas” e somente os cursos matriculados do aluno sob “Meus cursos”. Os atalhos do aluno abrem os detalhes do curso; os do professor posicionam a respectiva turma na tela de gerenciamento. Alteração publicada em 22/09/2026.
- Na visão geral do aluno, “Avisos não lidos” abre a aba correta do curso que contém o aviso mais recente (Mural ou Informativos). A antiga tela agregadora “Meus cursos” não possui mais rota; seu card é somente um indicador. Nas Configurações do gestor são exibidas apenas as preferências Novas inscrições, Novos chamados e Alertas de segurança. Alteração publicada em 23/09/2026.
- A visão geral do aluno foi redesenhada para múltiplas matrículas: cada curso possui seu próprio resumo de frequência, avisos novos e próxima aula, com acesso direto às abas correspondentes. As rotas gerais de calendário e frequência redirecionam ao painel para não misturar dados de cursos distintos; calendário e histórico de frequência permanecem dentro de cada curso. Alteração publicada em 23/09/2026.
- A opção genérica “Ver todas” foi removida das cascatas e cada item abre exclusivamente todas as informações da turma ou curso selecionado. Alteração publicada em 22/09/2026.
- O mural exibe fotos de perfil em publicações, comentários e no campo de criação, com acesso às imagens limitado aos membros ativos da turma. Publicações e interações usam verificação compacta de versão a cada cinco segundos com a aba visível ou ao retornar a ela. Alteração publicada em 23/09/2026.
- O professor controla a participação dos alunos no mural por turma (publicar/comentar/reagir, comentar/reagir ou somente visualizar). Publicações comuns geram leitura por visibilidade; confirmações obrigatórias permanecem explícitas. Regras e preservação da configuração foram cobertas por testes de API. Alteração publicada em 23/09/2026.
- Informativos administrativos não exibem mais contagem ou lista de leitores ao gestor. O estado de leitura permanece privado para cada professor ou aluno controlar itens novos e para o sistema gerenciar notificações; as confirmações visíveis do Mural da turma continuam separadas. Alteração publicada em 23/09/2026.
- Ao criar ou editar um informativo, o gestor escolhe entre envio imediato e agendamento. “Enviar agora” não solicita data ou hora e usa o horário confiável do servidor; “Agendar” revela os dois campos e exige um momento futuro. A edição de um item já publicado preserva o horário original para não alterar artificialmente sua posição. Alteração publicada em 23/09/2026.
- Publicações e comentários do Mural notificam os alunos ativos da turma e o professor responsável, com exclusão do autor da ação; curtidas notificam somente o dono da publicação. Gestores ficam fora do Mural e dessas notificações. As três categorias podem ser desligadas separadamente em Configurações.
- O compositor e a edição de publicações do Mural, para professor e aluno, reutilizam o editor dos Informativos com negrito, itálico, sublinhado, listas e links HTTPS. O servidor mantém somente HTML permitido e remove scripts, atributos executáveis e links inseguros. Alteração publicada em 23/09/2026.
- Teste em massa reproduzível em `pnpm test:mass`: 5 professores, 25 alunos, 5 turmas, 60 chamadas, 71 publicações, 230 comentários, 300 curtidas, 29 anexos, 10 informativos, 2.526 eventos de notificação e 1.084 requisições, sem erro HTTP inesperado. Os dois P1 foram corrigidos: chamadas salvas preservam o elenco histórico e o Mural usa outbox assíncrona em lote, push agrupado por turma e nenhuma notificação por e-mail. Vinte comentários simultâneos na turma de 25 ficaram em p95 de 96,93 ms; a verificação leve do mural em concorrência 30 atingiu 1.366,71 req/s. Paginação de Informativos, consultas de leitores restritas ao professor e índices compostos também foram incluídos. Relatório em `docs/MASS_TEST_2026-09-23.md`. Alterações publicadas em 23/09/2026; o teste de carga permaneceu isolado e não inseriu dados falsos em produção.

- A logo da página de login é estática; a animação experimental foi retirada por solicitação do usuário em 17/09/2026. Alteração publicada em 23/09/2026.

- A antiga página “Cursos e igrejas” tornou-se “Turmas” e, para o gestor, mostra somente as turmas ofertadas pelos professores, com exclusão como única ação.
- Cada turma combina curso, igreja ou modalidade EAD e professor. `EAD` substitui definitivamente `Remoto`.
- O professor escolhe o curso, a igreja ou modalidade e a agenda ao criar a própria turma. O curso não pode ser trocado depois; o professor responsável pode atualizar o local e os horários, enquanto o gestor não edita a oferta.
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

### Publicação — 25/09/2026

- Revertida a atualização visual da área do aluno, restaurando os indicadores gerais e os resumos detalhados por curso. Versão Cloudflare: `d3105c96-cf4d-4e9e-8b96-62bbd61e4be6`; `/login`, `/api/health` e o bundle `StudentPortal-DS6Wrjpz.js` retornaram HTTP 200, banco PostgreSQL confirmado, `/api/auth/me` retornou HTTP 401 sem sessão e `www` redirecionou com HTTP 308 para a raiz.

### Publicação — 24/09/2026

- Revisão da visão do aluno publicada: indicadores gerais preservados, dados redundantes removidos dos cards por curso e acesso a avisos direcionado ao curso/origem mais recente.
- Versão Cloudflare verificada: `9c0194f3-05fc-4272-b8b8-5b957209c54f`; `/login`, `/api/health` e o bundle `StudentPortal-CymSIPCB.js` retornaram HTTP 200, banco PostgreSQL confirmado, `/api/auth/me` retornou HTTP 401 sem sessão e `www` redirecionou com HTTP 308 para a raiz.

- Redução de informações repetidas na área do aluno e atalhos de avisos separados por turma e origem publicados.
- Versão Cloudflare verificada: `69976251-6026-494b-b2da-4e15fd2d9d0d`; `/login`, `/api/health` e o bundle atualizado `StudentPortal-hqg6hosT.js` retornaram HTTP 200, `/api/health` confirmou PostgreSQL, `/api/auth/me` retornou HTTP 401 sem sessão e `www` redirecionou com HTTP 308 para a raiz.

- Refatorações da auditoria de redundância publicadas: painel do aluno com consulta de calendário reutilizada, painel do professor limitado aos três informativos exibidos e polling de suporte consolidado no hook compartilhado.
- Versão Cloudflare verificada: `fcf37c12-f2fc-4a17-85ac-a2fe7f934483`; `/login` e `/api/health` retornaram HTTP 200, `/api/auth/me` retornou HTTP 401 sem sessão e `www` redirecionou com HTTP 308 para a raiz.

- Proteção de login com Cloudflare Turnstile publicada: após cinco credenciais inválidas para o mesmo e-mail, o desafio passa a ser obrigatório; o IP é bloqueado após vinte falhas em quinze minutos e o contador do e-mail é limpo após autenticação bem-sucedida.
- A senha agora é verificada no Supabase exclusivamente pelo Worker; a antiga troca de token do navegador foi encerrada, o frontend deixou de receber a chave pública do Supabase e a sessão da aplicação continua em cookie seguro.
- Widget `Projeto Aprendiz - Login` configurado para `aprendizicm.com.br` e `www.aprendizicm.com.br`, com segredo armazenado no Worker. O backend valida token, IP, hostname e a ação `login`.
- Validação: `pnpm lint`, 96 testes aprovados (1 regressão PostgreSQL opcional ignorada), build React, empacotamento do Worker e `git diff --check` passaram.
- Versão Cloudflare verificada: `be3ab223-4f70-4870-92de-0cb5e913d21e`; `/login`, `/forgot-password` e `/api/health` retornaram HTTP 200, PostgreSQL conectado, `/api/auth/me` retornou HTTP 401 sem sessão e `www` redirecionou com HTTP 308. Em produção, a quinta falha retornou `CAPTCHA_REQUIRED` e a tentativa seguinte sem token foi recusada com HTTP 403.
- Hotfix Turnstile para PWA/WebView publicado na versão `061389c3-8dda-4155-9444-4e7ef7bd6857`: a CSP passou a liberar também `connect-src https://challenges.cloudflare.com`, conforme os requisitos móveis do Cloudflare, e falhas temporárias agora usam repetição automática em vez de bloquear o formulário no primeiro erro. `/login` e `/api/health` retornaram HTTP 200 e o cabeçalho CSP atualizado foi confirmado em produção.
- Integração manual do widget substituída pelo componente React recomendado pelo Cloudflare e publicada na versão `2434512f-f33e-4018-ba7c-1bea98038a2a`. O teste em produção, com e-mail fictício já limitado, confirmou aprovação automática do Turnstile, botão de login habilitado e ausência do alerta após o token ser recebido.

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
- Versão Cloudflare verificada: `86891d12-8447-4e5f-bf54-e705170e9849`; `/login`, bundle principal e `/api/health` retornaram HTTP 200, PostgreSQL conectado, `/api/auth/me` retornou HTTP 401 sem sessão e `www` redirecionou com HTTP 308 para a raiz. Publicação correspondente ao commit `20db61b`.
- Versão Cloudflare verificada: `8005b87d-313c-49c7-b694-7bca99df2f2b`; `/login`, bundle de Informativos e `/api/health` retornaram HTTP 200, PostgreSQL conectado e `/api/auth/me` retornou HTTP 401 sem sessão. Publicação correspondente ao commit `a8fe736`.
- Versão Cloudflare verificada: `fc0fe834-2418-473c-9ca8-5ff72f833bc4`; `/login`, bundles do Portal do Aluno e Configurações e `/api/health` retornaram HTTP 200, PostgreSQL conectado e `/api/auth/me` retornou HTTP 401 sem sessão. Publicação correspondente ao commit `ce1fce7`.
- Auditoria responsiva completa publicada após `pnpm check`, com 500 verificações de rota/viewport sem overflow horizontal, conteúdo de autenticação cortado ou alvos de toque inadequados.
- Versão Cloudflare verificada: `dc996441-2e10-41b3-8d45-03d49123fd6f`; `/login` e `/api/health` retornaram HTTP 200, `/api/auth/me` retornou HTTP 401 sem sessão e `www` redirecionou com HTTP 308 para a raiz.

## Prompt curto para uma nova tarefa

> Continue o Projeto Aprendiz no mesmo repositório. Leia primeiro `PROJECT_STATUS.md`, preserve alterações e arquivos locais que não pertençam à tarefa, valide a implementação antes de publicar e atualize o registro após mudanças relevantes. Minha solicitação é: ...
