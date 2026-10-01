# Estado do Projeto Aprendiz

Atualizado em 30/09/2026. Este arquivo reúne apenas o estado vigente; o [histórico anterior](docs/releases/HISTORY_THROUGH_2026-09-30.md) registra entregas e versões passadas.

## Produção

- URL: `https://aprendizicm.com.br`.
- Worker existente: `aprendiz-staging`, usado em produção com os bindings de `wrangler.jsonc`.
- Última versão publicada e confirmada: `da92a629-b993-41a7-9079-dc7f2e9f33a3`, hotfix do mapeamento SQL do MFA. Login real do gestor validado pelo responsável.
- PostgreSQL, Auth e Storage privados no Supabase, conectados pelo Hyperdrive.
- Migração `027_security_audit_remediation.sql` aplicada. MFA do gestor continua por e-mail.

## Repositório e preservação

- Repositório renomeado: `AlexCode-Br/projeto-aprendiz-icm`; remote local atualizado.
- Cópia local: `projeto-aprendiz/`, mantida para preservar o vínculo do workspace.
- Branch de trabalho: `codex/melhorias-projeto-aprendiz`.
- Commit de preservação: `02bb47e`, com o estado da aplicação validado antes da reorganização. O snapshot inclui alterações locais existentes; não é uma extração do bundle remoto.
- Reorganização local concluída e validada, sem nova publicação em produção. Os commits de trabalho ainda precisam ser enviados e integrados por revisão.

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
- Migrações completas e reparo legado aprovados em PostgreSQL embarcado (PGlite) com dados fictícios. A validação em PostgreSQL 16 nativo está preparada na CI e ainda depende de sua execução no GitHub; não houve teste contra produção.

## Contratos permanentes

- Gestor cadastra e convida; somente o professor oferece e configura suas turmas. Gestor pode excluir turmas e não acessa o mural ou a frequência.
- Aluno acessa apenas suas matrículas e sua frequência. Excluir turma preserva os cadastros de aluno e professor.
- Mural e informativos têm públicos e fluxos separados. Mural é push-only, agrupado por turma e com outbox durável.
- Autenticação passa pela API. Sessão fica em cookie protegido, gestor exige segundo fator por e-mail e o servidor aplica Turnstile e rate limiting.
- Dados privados e anexos não são acessíveis diretamente pelo navegador no Supabase. Migrações precedem deploy; nenhuma requisição do Worker executa DDL.

## Manutenção

Leia [Arquitetura](docs/ARCHITECTURE.md), [Contribuição](CONTRIBUTING.md) e, antes de publicar, [Operação](cloudflare/OPERATIONS.md). Execute `pnpm check`, `pnpm cloudflare:build` e `git diff --check` antes da entrega. Deploy depende de solicitação explícita do responsável.

## Pendências operacionais

- Configurar o ambiente GitHub `production`, proteção de `main` e credenciais de CI antes de usar o workflow de publicação.
- Staging precisa de Worker, Hyperdrive, banco, Auth e Storage separados; nenhum ambiente de teste deve reutilizar o banco de produção.
- Confirmar a política de backup do Supabase e realizar ensaio de restauração conforme `docs/DISASTER_RECOVERY.md`.
- Integrar a branch de trabalho em `main` após revisão e validação; a branch padrão ainda contém uma versão antiga.
