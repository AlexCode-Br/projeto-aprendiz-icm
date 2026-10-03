# Estado do Projeto Aprendiz

Atualizado em 03/10/2026. Este arquivo reúne apenas o estado vigente; o [histórico anterior](docs/releases/HISTORY_THROUGH_2026-09-30.md) registra entregas e versões passadas.

## Produção

- URL: `https://aprendizicm.com.br`.
- Worker existente: `aprendiz-staging`, usado em produção com os bindings de `wrangler.jsonc`.
- Última versão publicada e confirmada: `86321bf4-4dd7-415e-a4ed-2fb6339be220`, commit `592e607` em `main`, publicada pelo workflow manual em 02/10/2026 às 07:56 (America/Sao_Paulo). Smoke público e hashes do JavaScript/CSS aprovados. MFA do gestor por e-mail preservado; novo alerta de dispositivo enviado em mensagem separada. [Registro](docs/releases/DEPLOY_2026-10-02_ALERTA_GESTOR.md).
- PostgreSQL, Auth e Storage privados no Supabase, conectados pelo Hyperdrive.
- Migrações `027_security_audit_remediation.sql` e `028_manager_login_devices.sql` aplicadas. MFA do gestor continua por e-mail; reconhecimento de navegador não autentica nem dispensa o código.
- Senha PostgreSQL redefinida pelo responsável em 01/10/2026 e atualizada no Hyperdrive existente. Identidade, destino e cache desabilitado foram preservados. Smoke público aprovado após a troca.
- Histórico reconciliado em 01/10/2026 após backup cifrado e restauração verificada. Nove scripts tinham seus efeitos confirmados; `018` precisava apenas do índice `enrollments_recent_active_idx`. Dez entradas foram registradas, mantendo `009_lifecycle_and_history.sql` e os campos legados. Checksums dos dados da aplicação foram preservados na transação. Não há scripts locais pendentes.
- `pnpm cloudflare:deploy` concluído pelo GitHub Actions, com migrador antes da publicação e TLS validado pela CA oficial. [Registro atual](docs/releases/DEPLOY_2026-10-02_ALERTA_GESTOR.md); [primeira publicação de 02/10](docs/releases/DEPLOY_2026-10-02.md); [reconciliação e publicação anterior](docs/releases/DEPLOY_2026-10-01.md).

## Repositório e preservação

- Repositório renomeado: `AlexCode-Br/projeto-aprendiz-icm`; remote local atualizado.
- Cópia local: `projeto-aprendiz/`, mantida para preservar o vínculo do workspace.
- Branch canônica: `main`. A PR #43 integrou a documentação operacional e o suporte à CA oficial do Supabase; merge `676aa89`.
- Commit de preservação: `02bb47e`, com o estado da aplicação validado antes da reorganização. O snapshot inclui alterações locais existentes; não é uma extração do bundle remoto.
- Reorganização enviada, revisada e integrada em `main` pela [PR #34](https://github.com/AlexCode-Br/projeto-aprendiz-icm/pull/34), merge `0dd45ad`. A árvore do código do commit local `b95d54c` corresponde à integrada e foi publicada em 01/10/2026.

## Reorganização de 30/09/2026

- README reescrito com arquitetura atual, três perfis, instalação local, comandos, configurações e operação. Documentação recebe índice, política de contribuição, canal de segurança e registro de decisões.
- Estado vigente separado do histórico de entregas. Arquivos locais, bases, dumps, builds e capturas permanecem ignorados; convenções UTF-8/LF estão em `.editorconfig` e `.gitattributes`.
- Regras SQL e registro de tabelas unificados entre Node e Worker. Removidos inicializadores PostgreSQL sem uso no Worker e módulos de sessão Supabase legados sem consumidores no frontend.
- Despacho HTTP separado dos domínios conta, fotos e períodos letivos, preservando os contratos. Três testes de integração usam suporte compartilhado com credenciais de produção excluídas.
- Lint ampliado para backend, shared e scripts. A verificação de repositório bloqueia artefatos proibidos, padrões reconhecidos de segredos e links locais inválidos.
- CI configurada para testes, auditoria, PostgreSQL temporário e build seco. Workflow manual de produção restrito a `main`, condicionado ao environment `production`; primeira execução autorizada registrada em 02/10/2026.
- Regressão nova verifica todas as migrations, RLS, privilégios públicos e campos MFA/sessão. Testes PostgreSQL recusam destino remoto ou banco sem nome de teste. Migração `002` permite instalação sem objetos legados em `public`.

## Validação local

- Instalação com lockfile congelado, ESLint e build React aprovados. Suíte padrão: 99 testes, 97 aprovados, zero falhas e duas regressões PostgreSQL dependentes de banco externo.
- Build do Worker aprovado em `--dry-run`, sem publicação.
- `pnpm audit`: nenhuma vulnerabilidade conhecida reportada.
- Migrações completas e reparo legado aprovados em PostgreSQL embarcado (PGlite), em PostgreSQL 16 nativo na CI da PR #34 e em PostgreSQL 17.11 local isolado. O ensaio da reconciliação e o migrador padrão preservaram os dados restaurados. Nenhuma suíte destrutiva foi executada em produção.
- `pnpm check` com PostgreSQL isolado em 01/10/2026: lint, build e 99 testes aprovados, zero falhas e zero testes pulados. Build seco do Worker aprovado.
- Conexão de manutenção pelo Session Pooler validada com o certificado CA oficial do Supabase e verificação TLS ativa. Segredos permanecem fora do Git.
- Backup local cifrado do schema privado, com restauração e checksums das 46 tabelas verificados. Arquivos binários do Storage e schemas gerenciados não estão nessa cópia. A senha usada na exportação deve ser preservada no gerenciador de senhas para recuperar este arquivo, mesmo após futuras rotações.
- Em 01/10/2026, SHA-256 e tamanho do arquivo cifrado conferiram com o manifesto; autenticação da cifra e leitura por `pg_restore --list` foram repetidas sem conexão com banco algum. Banco de teste excluído, servidor local parado e ausência de `restore-data` confirmada após remoção manual pelo responsável.

## Contratos permanentes

- Gestor cadastra e convida; somente o professor oferece e configura suas turmas. Gestor pode excluir turmas e não acessa o mural ou a frequência.
- Aluno acessa apenas suas matrículas e sua frequência. Excluir turma preserva os cadastros de aluno e professor.
- Mural e informativos têm públicos e fluxos separados. Mural é push-only, agrupado por turma e com outbox durável.
- Autenticação passa pela API. Sessão fica em cookie protegido, gestor exige segundo fator por e-mail e o servidor aplica Turnstile e rate limiting.
- Dados privados e anexos não são acessíveis diretamente pelo navegador no Supabase. Migrações precedem deploy; nenhuma requisição do Worker executa DDL.

## Manutenção

Leia [Arquitetura](docs/ARCHITECTURE.md), [Contribuição](CONTRIBUTING.md) e, antes de publicar, [Operação](cloudflare/OPERATIONS.md). Execute `pnpm check`, `pnpm cloudflare:build` e `git diff --check` antes da entrega. Deploy depende de solicitação explícita do responsável.

## Desenvolvimento no Windows

O responsável voltou ao Windows. Use Git autenticado, Node.js conforme `.node-version` e pnpm conforme `packageManager` em `package.json`: neste registro, Node.js 24.19.0 e pnpm 11.19.0. A documentação operacional e o suporte à CA no deploy foram integrados em `main` pela PR #43, merge `676aa89`.

Clone em uma pasta nova, separada do conjunto de backup e da cópia recuperada por ZIP:

```powershell
git clone --branch main https://github.com/AlexCode-Br/projeto-aprendiz-icm.git projeto-aprendiz-icm
cd projeto-aprendiz-icm
pnpm install --frozen-lockfile
pnpm check
```

O repositório é privado e exige autenticação GitHub própria do Git, sem credenciais embutidas na URL. A validação PostgreSQL completa depende de um banco de teste local isolado; sem ele, as duas regressões correspondentes são puladas, não aprovadas.

Abra a pasta clonada e retome a partir deste documento, `AGENTS.md`, `docs/ARCHITECTURE.md` e `cloudflare/OPERATIONS.md`. Confira o Git e trate a retomada como preparação local, sem novo deploy ou alteração de produção até autorização explícita.

O conjunto cifrado local inclui o arquivo `.dump.enc`, manifesto, `LEIA-ME.md` e ferramenta de recuperação. Preserve também uma cópia externa cifrada e a senha original da exportação em um gerenciador de senhas. A cópia do projeto no Drive, informada pelo responsável, não comprova a preservação do backup separado nem dos arquivos locais ignorados. Segredos locais devem permanecer cifrados e fora do Git.

## Retomada operacional de 02/10/2026

- Os quatro documentos de manutenção foram lidos e o Git remoto foi conferido pelo navegador. Na conferência inicial, `main` estava em `0dd45ad`; o registro de 01/10 estava em `ebd4680`, na branch de trabalho, um commit à frente e um atrás de `main`. A [PR #43](https://github.com/AlexCode-Br/projeto-aprendiz-icm/pull/43) foi aberta em rascunho para integrar a documentação por revisão, sem novo deploy.
- CI da `main` (#95) e do registro `ebd4680` (#104) aprovadas. A CI da PR deve aprovar seu resultado final antes da integração; nenhum teste local completo foi repetido nesta retomada.
- Ambiente GitHub `production` criado, com regra de publicação limitada à branch `main` e nenhuma tag permitida. Na conferência inicial, não havia secrets no ambiente nem no repositório. A interface não oferece aprovação por revisores neste ambiente; a autorização do responsável continua sendo uma etapa operacional explícita antes de acionar o workflow manual.
- Proteções clássicas de branch não estão configuradas. O GitHub informa que essas regras não serão aplicadas neste repositório privado no plano atual; a restrição do environment não substitui proteção contra push ou merge em `main`.
- Smoke público de leitura aprovado: `/login` 200, `/api/health` 200 e estado `ok`, `/api/auth/me` sem sessão 401 e redirecionamento `www` 308 para a raiz. Não houve login, alteração de dados, migração ou publicação.
- A pasta local aberta neste computador Windows contém o conjunto de backup cifrado, cujo tamanho e SHA-256 conferem com o manifesto. O código foi recuperado por ZIP da branch de trabalho em uma subpasta separada, sem histórico `.git`. O Git fornecido pelo runtime está disponível, mas o acesso HTTPS ao repositório privado pelo terminal exige autenticação; a sessão GitHub do navegador não autentica automaticamente o clone.
- Autenticação da cifra, restauração, cópia externa do backup e retenção da senha original não foram revalidadas nesta sessão. O ensaio de 01/10 permanece registrado separadamente.

## Publicação autorizada em 02/10/2026

- O responsável autorizou copiar as credenciais necessárias para o pipeline e executar o deploy, e confirmou a criação do token Cloudflare `projeto-aprendiz-github-production`. O token tem Workers Editor na conta de produção, Zone Read e Workers Routes Write apenas em `aprendizicm.com.br`, com expiração em 31/12/2026.
- Os quatro secrets de publicação foram cadastrados no ambiente GitHub `production`: `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`, `SUPABASE_CA_CERT` e `DATABASE_URL`. O responsável digitou a senha existente diretamente no GitHub; o endereço do Session Pooler (porta 5432) foi montado com a senha codificada para URI. Não houve redefinição da senha nem alteração do Hyperdrive.
- Um handshake PostgreSQL sem autenticação confirmou `SELF_SIGNED_CERT_IN_CHAIN` com as CAs padrão do Node e TLS 1.3 com hostname e cadeia validados ao carregar a CA oficial do Supabase. O workflow passou a configurar `NODE_EXTRA_CA_CERTS` antes do migrador, mantendo a verificação TLS ativa. A CA foi obtida pelo download de Database Settings; SHA-256 do PEM baixado: `700723581420dd1ac98fd7e9ac529f0ef210eadcaf87fc868a3ad7d114c2f3b7`.
- PR #43 revisada e integrada após CI aprovada; CI da `main` #117 também aprovada. [Deploy production #1](https://github.com/AlexCode-Br/projeto-aprendiz-icm/actions/runs/36971270251) concluiu validação, migrador, publicação e smoke em 02/10/2026, às 03:00 (America/Sao_Paulo). Cloudflare confirmou a versão `24fa9a92-bb96-471d-8283-3d3397efdbdf` com 100% do tráfego; a versão saudável anterior é `b3265c0c-336c-4519-9d63-2d837586d231`.
- Smoke independente pós-deploy aprovado: login 200, health 200/ok, sessão ausente 401 e www 308. JavaScript e CSS publicados conservaram os hashes SHA-256 anteriores, conforme esperado para uma mudança de pipeline e documentação. Os testes autenticados não foram executados.
- A CI emitiu avisos de runtime das actions v4 e da futura migração de `ubuntu-latest`. Avaliar atualização das actions e estabilidade da imagem do runner em manutenção separada, com validação completa.

## Publicação do alerta do gestor em 02/10/2026

- PR #45 integrou o reconhecimento de novo navegador e a entrega obrigatória por e-mail via outbox, com hash privado e cookie protegido renovável por um ano, sem dispensar MFA. PR #46 simplificou o modelo conforme referência do responsável: data/hora em Brasília, sistema/navegador, localização aproximada e botão “Não fui eu” para Configurações. O código de verificação permanece em outro e-mail; IP permanece na auditoria.
- [Deploy production #2](https://github.com/AlexCode-Br/projeto-aprendiz-icm/actions/runs/36997932593), autorizado pelo responsável, publicou `592e607` após check, auditoria, PostgreSQL isolado e build seco aprovados. O migrador concluiu antes do upload. Versão anterior saudável preservada: `24fa9a92-bb96-471d-8283-3d3397efdbdf`.
- Smoke independente e comparação SHA-256 dos assets publicados com o build local aprovados. Prévia conferida com dados fictícios; nenhum login ou envio manual de e-mail real foi feito nesta publicação. [Detalhes](docs/releases/DEPLOY_2026-10-02_ALERTA_GESTOR.md).

## Central de Suporte do gestor — preparada em 03/10/2026

- Tela organizada como caixa de entrada: busca, filtro e lista à esquerda; conversa e resposta à direita. A altura acompanha a área útil da aplicação, com rolagem independente na lista e no histórico. Em telas menores, lista e conversa se alternam com retorno explícito aos chamados, inclusive durante carregamento ou erro.
- Hierarquia e estados visuais simplificados, indicadores de leitura preservados, filtros acessíveis e paginação de 12 chamados. Detalhes ficam recolhidos; status e exclusão com confirmação permanecem disponíveis. Mensagens longas quebram sem alargar a tela e o envio preserva o texto quando falha.
- Componentes de suporte existentes reutilizados por uma variante `inbox` para o gestor. Contratos HTTP, autorização e notificações não foram alterados. Prévia usa servidor e SQLite isolados com dados fictícios, sem credenciais ou integrações de produção.
- `pnpm check` aprovado: 104 testes, 102 aprovados, zero falhas e duas regressões PostgreSQL puladas por ausência de banco de teste. Build seco do Worker aprovado. Navegação, busca, filtros, paginação, resposta, reabertura e modal de exclusão conferidos na prévia; layouts de celular, tablet e desktop sem rolagem horizontal.
- Preparação para revisão; esta mudança de UI ainda não foi publicada. A versão de produção continua sendo a registrada acima e um novo deploy depende de autorização explícita.

## Pendências operacionais

- Validar os fluxos autenticados da versão publicada: código por e-mail do gestor, áreas de professor e aluno, mural, frequência, anexos e notificações em dispositivo autorizado.
- Renovar o token Cloudflare do pipeline antes de 31/12/2026. Os quatro secrets de publicação estão cadastrados em `production` e foram validados pela primeira execução. Resolver a limitação de aplicação das proteções de `main`; a autorização explícita desta publicação não modifica o plano GitHub nem torna o ambiente uma proteção contra push ou merge. Não enviar valores por chat ou commit.
- Autenticar o Git no computador e obter um clone com histórico antes de retomar alterações de código; preservar o conjunto de backup fora da raiz desse clone.
- Staging precisa de Worker, Hyperdrive, banco, Auth e Storage separados; nenhum ambiente de teste deve reutilizar o banco de produção.
- Confirmar a política de backup contínuo do Supabase, incluir Auth/Storage na recuperação e manter cópia cifrada externa. Ensaio do schema privado realizado em 01/10/2026; repetir mensalmente conforme `docs/DISASTER_RECOVERY.md`.
- Avaliar a atualização PostgreSQL disponível no Supabase, conferindo versão vigente, extensões e as [mudanças de compatibilidade de 17.11](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) antes de definir uma janela de manutenção. Não foi executada atualização do banco gerenciado nesta operação.
- Confirmar a cópia externa da pasta separada de backup e a recuperação da senha original; a cópia do projeto no Drive foi informada pelo responsável, mas não inspecionada.
