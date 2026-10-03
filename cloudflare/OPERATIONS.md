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

O repositório canônico é `AlexCode-Br/projeto-aprendiz-icm`. A mudança de nome não altera domínio, Worker, banco, segredos ou assinaturas push.

### GitHub Actions

O workflow `Deploy production` é manual (`workflow_dispatch`), aceita somente `main` e depende de uma etapa de validação. Não há publicação automática em push. A primeira execução autorizada concluiu em 02/10/2026; consulte o [registro](../docs/releases/DEPLOY_2026-10-02.md). Para preparar ou revisar o pipeline:

1. Integrar o código validado em `main` por revisão. Uma alteração só existir localmente não a torna disponível na CI.
2. Criar o environment `production` no GitHub e configurar os secrets `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `DATABASE_URL` e `SUPABASE_CA_CERT`. O último contém apenas o PEM da CA pública oficial obtida em Database Settings no Supabase. Usar token restrito à conta e às permissões necessárias para o Worker; nunca enviar valores por chat ou commit.
3. Usar conexão direta ou session pooler Supabase para migrações, conforme acesso de rede do runner; não usar transaction pooler para esse processo. O deploy configura `DATABASE_SSL=true`.
4. Configurar proteção de `main` com revisão e o check `validate`. Adicionar aprovação no environment se o plano GitHub oferecer essa opção para este repositório privado.
5. Conferir a versão anterior saudável do Worker e o backup do banco antes de autorizar uma publicação.

A segunda publicação de 02/10/2026 ativou o alerta separado de novo dispositivo para gestores, com a migração privada `028_manager_login_devices.sql`; consulte o [registro do alerta](../docs/releases/DEPLOY_2026-10-02_ALERTA_GESTOR.md). O e-mail de código MFA continua separado do aviso de acesso.

Os secrets do GitHub são credenciais do processo de publicação, não substitutos dos secrets de runtime já cadastrados no Worker. O pipeline executa migrações, publica e roda `scripts/smoke-production.mjs`; uma falha no smoke exige investigação, não um rollback automático de banco.

### Publicação local

```bash
pnpm check
pnpm cloudflare:build
pnpm cloudflare:deploy
```

`pnpm cloudflare:deploy` executa as migrações antes de publicar e exige `DATABASE_URL` apontando para produção. Se a migração falhar, o Worker não é publicado. Não contorne esta etapa executando `wrangler deploy` diretamente.

Conexões de manutenção devem validar TLS. Se o Session Pooler exigir a CA oficial do Supabase, configure `NODE_EXTRA_CA_CERTS` com o caminho do certificado antes de iniciar o processo Node. Não use `DATABASE_SSL_REJECT_UNAUTHORIZED=false`. A orientação oficial está em [SSL enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement).

O workflow grava `SUPABASE_CA_CERT` em um arquivo temporário do runner, valida o formato X.509 e exporta `NODE_EXTRA_CA_CERTS` antes de executar o migrador. A confiança na CA é explícita; a validação TLS e do hostname permanece ativa. A CA pública não é a senha PostgreSQL nem uma chave de API.

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

## Chat de suporte publicado em 03/10/2026

O chat da PR #48 foi publicado pelo workflow manual autorizado em 03/10/2026, commit `87cb3b7`, versão `12649394-bea1-44dc-be85-df57af2329b9`, com 100% do tráfego. `029_support_chat_attachments.sql` foi aplicada pelo migrador antes do upload; mantém o histórico e acrescenta os metadados dos anexos, com RLS e privilégios públicos revogados. Não execute DDL em requisições. Consulte o [registro vigente](../docs/releases/DEPLOY_2026-10-03_CHAT.md).

O backend cria o bucket `support-attachments` no primeiro envio com arquivos, usando a credencial Supabase administrativa existente. Ele exige bucket privado, limite de 20 MB e os MIME types definidos em `shared/support-media.mjs`; recusa bucket público e não altera sua visibilidade automaticamente. Não são necessários novos secrets. O limite global do Storage deve comportar 20 MB; cada mensagem aceita até cinco anexos, somando no máximo 20 MB. Imagens têm limite de 5 MB e documentos/áudios de 10 MB. Não reutilize esse bucket de produção em testes locais.

Smoke, hashes dos assets e leitura autenticada do histórico foram aprovados. Ainda confira envio e download como gestor e professor, confirmação de leitura, chegada automática sem recarregar, foto, documento, reprodução/avanço de áudio e vídeo e gravação de voz em dispositivo autorizado. Verifique 401 sem sessão e 404 para arquivo de outro professor. Inclua o novo bucket privado na política de recuperação do Storage; o backup SQL do schema privado contém os metadados, não os binários remotos. A prévia local usa arquivos fictícios e banco isolado; não comprova entrega pelo Storage de produção nem captura de microfone de um dispositivo real.

## Verificação pós-deploy

`node scripts/smoke-production.mjs` executa as verificações públicas de leitura abaixo, sem login, alteração de dados ou publicação. Os testes funcionais autenticados continuam separados.

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

Em 01/10/2026, o histórico de migrações foi reconciliado depois de comparar estruturas e efeitos de dados com as migrations, restaurar um backup cifrado e ensaiar o procedimento em PostgreSQL isolado. A única estrutura ausente era o índice da migração `018`; as demais entradas foram registradas somente após confirmação dos efeitos. O registro legado `009_lifecycle_and_history.sql` foi preservado. Consulte o [registro da operação](../docs/releases/DEPLOY_2026-10-01.md). Não trate esse procedimento pontual como autorização para marcar outras migrações sem validação.

Os diretórios `.qa-professor/` e `output/` pertencem ao usuário e não devem ser apagados nem incluídos em commits.

## Homologação e migrações

Apesar do nome `aprendiz-staging`, esse Worker é produção. Uma homologação real exige outro Worker, outro Durable Object, banco/Auth/Storage separados e chaves Turnstile, e-mail e VAPID próprias. Não aponte testes ou previews para os bindings atuais.

Nomes de migrações são identificadores já registrados em `schema_migrations`: não renomeie as duas migrações com prefixo `016`. A migração `002_security_hardening.sql` agora verifica se objetos legados em `public` existem antes de revogar privilégios, permitindo instalar em banco vazio. Bancos onde `002` já foi registrada não a reexecutam; a proteção do schema privado permanece inalterada. Esse ajuste não requer migração adicional em produção.
