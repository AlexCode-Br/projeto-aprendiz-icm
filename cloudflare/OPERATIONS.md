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

`pnpm cloudflare:deploy` executa as migrações antes de publicar e exige `DATABASE_URL` apontando para produção. Se a migração falhar, o Worker não é publicado. Não contorne esta etapa executando `wrangler deploy` diretamente.

`wrangler.jsonc` é a fonte de verdade. O deploy preserva os segredos remotos. Nunca coloque chaves privadas no arquivo ou no frontend.

Segredos obrigatórios:

- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SECRET_KEY`
- `TURNSTILE_SECRET_KEY`
- `RESEND_API_KEY`
- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`

Gestores usam verificação em duas etapas por código enviado ao e-mail depois da senha. Em produção ela é obrigatória por padrão; mantenha `REQUIRE_MANAGER_MFA=true`. O valor `false` é reservado a uma recuperação operacional temporária e deve ser removido logo após a contingência.

Gere o par VAPID uma única vez com `pnpm vapid:generate` e cadastre os dois valores com `wrangler secret put`. Trocar esse par invalida as assinaturas existentes e exige nova ativação nos dispositivos.

## Verificação pós-deploy

1. Confirmar `200` em `/login` e `/api/health`.
2. Confirmar `401` em `/api/auth/me` sem sessão.
3. Confirmar redirecionamento `308` de `www` para a raiz.
4. Entrar como gestor e professor e abrir as páginas principais.
5. Observar erros e CPU com `pnpm cloudflare:tail`; o resumo remove cookies, cabeçalhos e query strings.
6. Confirmar MX, DKIM, DMARC e o return-path do Resend após qualquer alteração DNS.
7. Em Configurações, ativar as notificações em um dispositivo e confirmar o recebimento pelo botão de teste.
8. Em uma janela isolada, confirmar que cinco senhas incorretas para o mesmo e-mail exibem o Turnstile e que o login continua mostrando uma mensagem genérica.

## Recuperação

Use o histórico de versões do Worker ou `wrangler rollback` para voltar à versão saudável anterior. Alterações de banco exigem migrações próprias e não são revertidas por rollback do código.

Consulte [Continuidade e recuperação de dados](../docs/DISASTER_RECOVERY.md) e realize um ensaio de restauração mensal.

Os diretórios `.qa-professor/` e `output/` pertencem ao usuário e não devem ser apagados nem incluídos em commits.
