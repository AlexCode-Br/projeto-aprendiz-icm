# Operação no Cloudflare Workers

## Produção

- Domínio principal: `https://aprendizicm.com.br`
- Worker: `aprendiz-staging`
- Conta: `7c5176210f75766e5e0ed62cbf732572`
- Hyperdrive: `aprendiz-supabase` (`66babbf9d50c470fa5cd5bd1e6a2523f`)
- Banco, Auth e Storage: Supabase `ggghsddanuuekztxngxj`
- Raiz: Custom Domain do Worker
- `www`: rota do Worker sobre registro A proxied reservado; redirecionamento `308` para a raiz
- Plano: Free

O nome técnico do Worker foi preservado para não recriar segredos, Durable Object e bindings durante o corte. Ele atende a produção.

## Publicação

```bash
pnpm check
pnpm cloudflare:build
pnpm cloudflare:deploy
```

`wrangler.jsonc` é a fonte de verdade. O deploy preserva os segredos remotos. Nunca coloque chaves privadas no arquivo ou no frontend.

Segredos obrigatórios:

- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `RESEND_API_KEY`

## Verificação pós-deploy

1. Confirmar `200` em `/login` e `/api/health`.
2. Confirmar `401` em `/api/auth/me` sem sessão.
3. Confirmar redirecionamento `308` de `www` para a raiz.
4. Entrar como gestor e professor e abrir as páginas principais.
5. Observar erros e CPU com `wrangler tail`; `cloudflare/tail-summary.mjs` remove cookies, cabeçalhos e query strings do resumo.
6. Confirmar MX, DKIM, DMARC e o return-path do Resend após qualquer alteração DNS.

## Recuperação

Use o histórico de versões do Worker ou `wrangler rollback` para voltar à versão saudável anterior. Alterações de banco exigem migrações próprias e não são revertidas por rollback do código.

Os diretórios `.qa-professor/` e `output/` pertencem ao usuário e não devem ser apagados nem incluídos em commits.
