# Estado do Projeto Aprendiz

Atualizado em 01/10/2026. Este arquivo reúne apenas o estado vigente; o [histórico anterior](docs/releases/HISTORY_THROUGH_2026-09-30.md) registra entregas e versões passadas.

## Produção

- URL: `https://aprendizicm.com.br`.
- Worker existente: `aprendiz-staging`, usado em produção com os bindings de `wrangler.jsonc`.
- Última versão publicada e confirmada: `b3265c0c-336c-4519-9d63-2d837586d231`, reorganização integrada em `main`. Smoke público, consulta de sessão sintética pelo Worker/Hyperdrive e hashes dos assets aprovados. MFA do gestor por e-mail preservado; o último login real informado pelo responsável foi no hotfix anterior.
- PostgreSQL, Auth e Storage privados no Supabase, conectados pelo Hyperdrive.
- Migração `027_security_audit_remediation.sql` aplicada. MFA do gestor continua por e-mail.
- Senha PostgreSQL redefinida pelo responsável em 01/10/2026 e atualizada no Hyperdrive existente. Identidade, destino e cache desabilitado foram preservados. Smoke público aprovado após a troca.
- Histórico reconciliado em 01/10/2026 após backup cifrado e restauração verificada. Nove scripts tinham seus efeitos confirmados; `018` precisava apenas do índice `enrollments_recent_active_idx`. Dez entradas foram registradas, mantendo `009_lifecycle_and_history.sql` e os campos legados. Checksums dos dados da aplicação foram preservados na transação. Não há scripts locais pendentes.
- `pnpm cloudflare:deploy` concluído pelo fluxo padrão, com migrações antes da publicação. [Registro da operação](docs/releases/DEPLOY_2026-10-01.md).

## Repositório e preservação

- Repositório renomeado: `AlexCode-Br/projeto-aprendiz-icm`; remote local atualizado.
- Cópia local: `projeto-aprendiz/`, mantida para preservar o vínculo do workspace.
- Branch de trabalho: `codex/melhorias-projeto-aprendiz`.
- Commit de preservação: `02bb47e`, com o estado da aplicação validado antes da reorganização. O snapshot inclui alterações locais existentes; não é uma extração do bundle remoto.
- Reorganização enviada, revisada e integrada em `main` pela [PR #34](https://github.com/AlexCode-Br/projeto-aprendiz-icm/pull/34), merge `0dd45ad`. A árvore do código do commit local `b95d54c` corresponde à integrada e foi publicada em 01/10/2026.

## Reorganização de 30/09/2026

- README reescrito com arquitetura atual, três perfis, instalação local, comandos, configurações e operação. Documentação recebe índice, política de contribuição, canal de segurança e registro de decisões.
- Estado vigente separado do histórico de entregas. Arquivos locais, bases, dumps, builds e capturas permanecem ignorados; convenções UTF-8/LF estão em `.editorconfig` e `.gitattributes`.
- Regras SQL e registro de tabelas unificados entre Node e Worker. Removidos inicializadores PostgreSQL sem uso no Worker e módulos de sessão Supabase legados sem consumidores no frontend.
- Despacho HTTP separado dos domínios conta, fotos e períodos letivos, preservando os contratos. Três testes de integração usam suporte compartilhado com credenciais de produção excluídas.
- Lint ampliado para backend, shared e scripts. A verificação de repositório bloqueia artefatos proibidos, padrões reconhecidos de segredos e links locais inválidos.
- CI configurada para testes, auditoria, PostgreSQL temporário e build seco. Workflow de deploy manual preparado para `main`, condicionado ao environment `production`; não foi executado.
- Regressão nova verifica todas as migrations, RLS, privilégios públicos e campos MFA/sessão. Testes PostgreSQL recusam destino remoto ou banco sem nome de teste. Migração `002` permite instalação sem objetos legados em `public`.

## Validação local

- Instalação com lockfile congelado, ESLint e build React aprovados. Suíte padrão: 99 testes, 97 aprovados, zero falhas e duas regressões PostgreSQL dependentes de banco externo.
- Build do Worker aprovado em `--dry-run`, sem publicação.
- `pnpm audit`: nenhuma vulnerabilidade conhecida reportada.
- Migrações completas e reparo legado aprovados em PostgreSQL embarcado (PGlite), em PostgreSQL 16 nativo na CI da PR #34 e em PostgreSQL 17.11 local isolado. O ensaio da reconciliação e o migrador padrão preservaram os dados restaurados. Nenhuma suíte destrutiva foi executada em produção.
- `pnpm check` com PostgreSQL isolado em 01/10/2026: lint, build e 99 testes aprovados, zero falhas e zero testes pulados. Build seco do Worker aprovado.
- Conexão de manutenção pelo Session Pooler validada com o certificado CA oficial do Supabase e verificação TLS ativa. Segredos permanecem fora do Git.
- Backup local cifrado do schema privado, com restauração e checksums das 46 tabelas verificados. Arquivos binários do Storage e schemas gerenciados não estão nessa cópia. A senha usada na exportação deve ser preservada no gerenciador de senhas para recuperar este arquivo, mesmo após futuras rotações.
- Antes da troca de sistema operacional, SHA-256 e tamanho do arquivo cifrado conferiram com o manifesto; autenticação da cifra e leitura por `pg_restore --list` foram repetidas sem conexão com banco algum. Banco de teste excluído, servidor local parado e ausência de `restore-data` confirmada após remoção manual pelo responsável.

## Contratos permanentes

- Gestor cadastra e convida; somente o professor oferece e configura suas turmas. Gestor pode excluir turmas e não acessa o mural ou a frequência.
- Aluno acessa apenas suas matrículas e sua frequência. Excluir turma preserva os cadastros de aluno e professor.
- Mural e informativos têm públicos e fluxos separados. Mural é push-only, agrupado por turma e com outbox durável.
- Autenticação passa pela API. Sessão fica em cookie protegido, gestor exige segundo fator por e-mail e o servidor aplica Turnstile e rate limiting.
- Dados privados e anexos não são acessíveis diretamente pelo navegador no Supabase. Migrações precedem deploy; nenhuma requisição do Worker executa DDL.

## Manutenção

Leia [Arquitetura](docs/ARCHITECTURE.md), [Contribuição](CONTRIBUTING.md) e, antes de publicar, [Operação](cloudflare/OPERATIONS.md). Execute `pnpm check`, `pnpm cloudflare:build` e `git diff --check` antes da entrega. Deploy depende de solicitação explícita do responsável.

## Retomada no Zorin OS

A documentação de encerramento e retomada está na branch `codex/melhorias-projeto-aprendiz`. O código da aplicação já está integrado em `main`; para recuperar também estes registros, clone explicitamente a branch de trabalho. O repositório é privado e exige autenticação GitHub, sem credenciais embutidas na URL.

```bash
git clone --branch codex/melhorias-projeto-aprendiz https://github.com/AlexCode-Br/projeto-aprendiz-icm.git projeto-aprendiz
cd projeto-aprendiz
pnpm install --frozen-lockfile
pnpm check
```

Use Node.js conforme `.node-version` e pnpm conforme `packageManager` em `package.json`: neste registro, Node.js 24.19.0 e pnpm 11.19.0. Não reutilize `node_modules`, bancos locais, builds ou executáveis PostgreSQL do Windows; instale as dependências próprias do Linux. A validação PostgreSQL completa depende de um banco de teste local isolado; sem ele, as duas regressões correspondentes são puladas, não aprovadas.

Abra a pasta clonada e retome a partir deste documento, `AGENTS.md`, `docs/ARCHITECTURE.md` e `cloudflare/OPERATIONS.md`. Confira o Git e trate a retomada como preparação local, sem novo deploy ou alteração de produção até autorização explícita.

O responsável informou que salvou uma cópia de `projeto-aprendiz` no Drive. Essa cópia não comprova a preservação da pasta separada de backup do banco nem dos arquivos locais ignorados. Antes de apagar o Windows, copie também o conjunto cifrado em `Documents/Codex/backups/projeto-aprendiz` (arquivo `.dump.enc`, manifesto, `LEIA-ME.md` e ferramenta de recuperação) e preserve a senha original da exportação em um gerenciador de senhas. Confira se os arquivos realmente podem ser baixados no novo computador. Segredos locais devem permanecer cifrados e fora do Git.

## Pendências operacionais

- Validar os fluxos autenticados da versão publicada: código por e-mail do gestor, áreas de professor e aluno, mural, frequência, anexos e notificações em dispositivo autorizado.
- Configurar o ambiente GitHub `production`, proteção de `main` e credenciais de CI antes de usar o workflow de publicação.
- Staging precisa de Worker, Hyperdrive, banco, Auth e Storage separados; nenhum ambiente de teste deve reutilizar o banco de produção.
- Confirmar a política de backup contínuo do Supabase, incluir Auth/Storage na recuperação e manter cópia cifrada externa. Ensaio do schema privado realizado em 01/10/2026; repetir mensalmente conforme `docs/DISASTER_RECOVERY.md`.
- Avaliar a atualização PostgreSQL disponível no Supabase, conferindo versão vigente, extensões e as [mudanças de compatibilidade de 17.11](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) antes de definir uma janela de manutenção. Não foi executada atualização do banco gerenciado nesta operação.
- Confirmar a cópia externa da pasta separada de backup e a recuperação da senha original antes de apagar o Windows; a cópia do projeto no Drive foi informada pelo responsável, mas não inspecionada.
