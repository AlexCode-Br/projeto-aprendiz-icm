# 001 — Estrutura e acesso ao banco

Data: 30/09/2026. Status: aceita.

## Contexto

O projeto tem uma aplicação React, uma API compartilhada por Node e Cloudflare e regras puras usadas em ambas as camadas. Duplicações na tradução SQL e no registro de tabelas causaram divergência entre os runtimes, incluindo falha de qualificação da tabela de MFA no Worker.

## Decisão

Manter um único pacote, com `src/`, `backend/`, `shared/` e `cloudflare/`. Extrair a tradução, normalização e o registro de tabelas para `backend/database/sql-compatibility.mjs`, sem dependências de filesystem ou SQLite. Os adaptadores preservam as estratégias de conexão e transação próprias de cada runtime.

Testes unitários permanecem próximos aos módulos. O suporte de integração fica em `backend/test-support/`, que controla servidor, diretório temporário e cliente autenticado; os testes de conta, MFA e modelo acadêmico inauguram a adoção, sem reescrever toda a suíte em um único passo. Documentação vigente fica em `docs/`; entregas anteriores ficam em `docs/releases/`.

## Consequências

Uma nova tabela é registrada em um único lugar e a suíte confere o catálogo contra as migrations. Node continua executando migrations, enquanto o Worker depende do schema previamente aplicado. Diretórios são extraídos quando existe uma responsabilidade clara; tamanho de arquivo isoladamente não justifica uma nova camada. APIs públicas, URLs, schema privado e identidade do Worker são preservados.
