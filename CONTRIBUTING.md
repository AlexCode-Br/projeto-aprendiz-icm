# Manutenção do projeto

Use a versão de Node de `.node-version` e o pnpm declarado em `package.json`. Instale com `pnpm install --frozen-lockfile` e leia `PROJECT_STATUS.md` e `docs/ARCHITECTURE.md` antes de alterar contratos.

## Fluxo de alterações

1. Crie uma branch a partir de `main` atualizado.
2. Mantenha commits pequenos e descreva o comportamento alterado.
3. Preserve URLs e contratos existentes; mudanças de banco precisam de migration compatível e cobertura de regressão.
4. Execute `pnpm check`, `pnpm cloudflare:build` e `git diff --check`.
5. Abra uma revisão com o problema, a solução e o resultado das verificações. Integre após CI aprovado.

`main` representa o código aprovado para release. Publicação é manual e usa o ambiente `production`; um push não deve disparar deploy. Alterações de infraestrutura precisam de plano de recuperação.

## Organização

Páginas compõem telas; componentes reutilizam apresentação; `shared/` contém regras puras; a API reaplica todas as permissões. Tradução SQL e registro de tabelas ficam em `backend/database/`. Adicione novas tabelas ao registro compartilhado e preserve migrations antigas.

Testes usam dados fictícios e bases isoladas. Segredos, arquivos `.env`, bancos, dumps, logs, capturas e resultados gerados ficam fora do Git. Ferramentas locais podem usar `tmp/`, `.qa-*/` ou `output/`, todos ignorados.

Use UTF-8, LF e as configurações de `.editorconfig`. Evite misturar mudanças de comportamento com reformatação extensa. Atualize documentação vigente quando houver alteração permanente e registre deploys em `docs/releases/`.
