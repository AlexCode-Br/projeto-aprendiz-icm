# Migração Render → Cloudflare

## Estado verificado em 07/09/2026

- **Produção ainda no Render.** A validação autenticada foi concluída e a troca de delegação DNS foi solicitada na HostGator em 07/09/2026; a Cloudflare ainda aguarda a propagação.
- Branch: `codex/melhorias-projeto-aprendiz`. Não enviar para `main` antecipadamente: o Render faz deploy automático de `main`.
- Prévia: https://aprendiz-staging.alexandre-magnos-br.workers.dev
- Worker: `aprendiz-staging`, conta `7c5176210f75766e5e0ed62cbf732572`.
- Versão remota: `c902fe31-1972-4d05-b8eb-22d8f2676365`.
- A prévia está funcional (`READ_ONLY_PREVIEW=false`) e usa o **banco real**, não uma cópia. Não criar/apagar registros de teste indiscriminadamente.
- Supabase/Auth/Storage continuam no projeto existente `ggghsddanuuekztxngxj`. Nenhuma migração de dados executada.
- Hyperdrive `aprendiz-supabase`, ID `66babbf9d50c470fa5cd5bd1e6a2523f`, conexão direta TLS ao Supabase, **cache desativado**, limite padrão de 20 conexões.
- Segredos `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` e `RESEND_API_KEY` transferidos via UI e confirmados com `wrangler secret list` como `secret_text`. Nenhuma senha/chave privada foi colocada no repositório.
- Remetente e logos dos e-mails preservados. Nenhum e-mail real foi enviado nestes testes.
- Proteção de tentativas de autenticação usa Durable Object SQLite `AuthRateLimiter`.
- Nenhum plano pago contratado e nenhum recurso Render desligado.
- A zona `aprendizicm.com.br` foi cadastrada no plano Free. A HostGator aceitou a substituição por `meadow.ns.cloudflare.com` e `sean.ns.cloudflare.com`, mas a delegação pública ainda exibia os nameservers antigos na última consulta; a zona permanece **pendente/inativa** até a propagação.
- Consulta pública ao registro DS não retornou chave DNSSEC; o pré-requisito de DNSSEC desligado está atendido no estado atual.
- Os oito registros importados/reconstituídos foram revisados. `ftp`, `mail`, MX, DMARC, DKIM e o return-path do Resend (`send` → `send.forge.rmta.net`) estão como DNS-only; raiz e `www` permanecem preparados como proxy. Nada disso afeta o tráfego enquanto os nameservers não forem trocados.
- O portal HostGator não mostra caixa de e-mail profissional criada. Ainda assim, os registros de e-mail existentes foram preservados para não ampliar o escopo da migração.

## Testes realizados

- Suite existente `pnpm check`: passou antes da publicação (integração PostgreSQL isolada requer `TEST_DATABASE_URL` e foi ignorada).
- 7 testes dos adaptadores Worker/DB e limitador: passaram.
- Build Vite com configuração pública real de autenticação: passou.
- Bundle Wrangler e deploy real: passaram.
- `/login` e rota SPA retornam 200 com headers de segurança.
- `/api/auth/me` sem cookie: 401 esperado.
- `/api/auth/me` com cookie fictício: 401 esperado após consulta real ao Supabase via Hyperdrive; sem escrita no banco.
- `/api/auth/exchange` sem credencial: 403 esperado.
- `/api/auth/reset-password` com token inexistente: 400 esperado; exercita Durable Object e banco, sem alterar senha nem enviar e-mail.
- Medição com `wrangler tail`: página estática consumiu 1 ms de CPU; a primeira consulta autenticada observada chegou a 20 ms durante inicialização; repetição com isolate aquecido consumiu 4 ms de CPU e 5 ms de wall time. O caminho aquecido cabe no limite Free de 10 ms, mas telas autenticadas reais ainda precisam ser medidas.
- Validação autenticada do gestor concluída no staging, sem escritas: dashboard, turmas, alunos, professores, informativos, suporte e configurações carregaram os mesmos dados observados na produção e todas as respostas medidas terminaram com `outcome=ok`.
- CPU observada nas rotas principais do gestor: dashboard 8 ms; turmas/catálogos 7–10 ms; alunos/igrejas/foto 6–10 ms; professores/fotos 7–10 ms; informativos 7–9 ms; suporte 3–4 ms; conta/foto 4–6 ms. Houve um pico frio isolado de 21 ms em `/api/suporte/nao-lidos`; as repetições ficaram em 2–7 ms.
- `cloudflare/tail-summary.mjs` resume eventos de diagnóstico sem imprimir cookies, cabeçalhos, query strings ou corpos de resposta.
- Validação autenticada do professor concluída sem escritas: dashboard, turmas, alunos, frequência, informativos, suporte e configurações carregaram corretamente. A conta validada possui três turmas, mas ainda não possui alunos, horários nem chamadas; portanto, os estados vazios puderam ser conferidos, mas não uma chamada preenchida.
- PDF e CSV do período letivo completo foram gerados e visualizados no staging. Ambos exibiram as duas marcas, professor, período, totais, três turmas e estados vazios coerentes. A planilha mostrou as colunas da folha de chamada e a legenda P/F/J/sem registro.
- A rota detalhada de frequência consumiu 21 ms na primeira observação e 13 ms aquecida. Os clientes do SDK Supabase, desnecessários para leituras com sessão local, passaram a ser inicializados apenas sob demanda. Na versão otimizada, o relatório consumiu 10 ms e depois 9 ms, ambos com `outcome=ok`.
- Revisão estática final das consultas contra o adaptador Worker: sem incompatibilidades críticas encontradas.
- Em Windows, `wrangler dev --local` falhou com access violation do workerd. Não reinstalar componentes do sistema automaticamente; a publicação remota foi usada para testes de runtime.

## Publicar de forma reproduzível

Na raiz deste worktree:

```sh
pnpm cloudflare:build
pnpm cloudflare:deploy
```

`cloudflare/build.mjs` garante build novo com as configurações **públicas** de `frontend.json`; aceita sobrescrita por `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Não usar uma chave secret/service-role no frontend. Os segredos do Worker são preservados pelo deploy.

`READ_ONLY_PREVIEW=true` bloqueia todas as APIs exceto a consulta de sessão `GET /api/auth/me`. É uma trava de validação, não um modo de navegação completa somente leitura.

## Próximas etapas obrigatórias

1. Quando houver uma turma com alunos e chamadas registradas, repetir a conferência visual do cruzamento aluno × data no PDF e CSV. A implementação está coberta pelos testes automatizados, mas a conta disponível no staging não possui esses dados.
2. Validar fluxos autenticados/CSRF e operações reversíveis autorizadas. Para integração CRUD completa, usar banco isolado; não rodar as suites destrutivas no banco de produção.
3. Observar CPU e erros após o corte. As rotas do gestor e o relatório otimizado caberam em 3–10 ms quando aquecidos, mas inicializações frias ainda podem passar brevemente desse valor. Qualquer upgrade exige autorização do usuário.
4. Conferir no painel HostGator se existem registros privados/ocultos além dos oito reconstituídos na Cloudflare. Preservar e-mail/validação (MX, SPF, DKIM, DMARC, CAA etc.).
5. Aguardar a Cloudflare marcar a zona como ativa. O corte está preparado com rotas de Worker para raiz e `www`, `APP_URL=https://aprendizicm.com.br` e redirecionamento permanente de `www` para a raiz. Publicar somente depois da ativação; as rotas mantêm os registros proxied do Render como fallback imediato para rollback.
6. Depois do corte e testes no domínio, configurar CI/deploy e registrar rollback. Manter Render disponível até confirmar estabilidade.

## Referência para rollback / DNS anterior

- Render atual: `srv-da6jo2ou01pc738bu4eg`, `projeto-aprendiz`, Virginia.
- Commit Render observado: `80353d7bab99be0450fef40bd2fc1efd5b86319a`.
- Serviço antigo `projeto-aprendiz-api` não faz parte desta migração; não mexer nele.
- NS observados: `dns3.hostgator.com.br`, `dns4.hostgator.com.br`.
- Raiz A observada: `216.24.57.1` (TTL 14400).
- www CNAME observado: `projeto-aprendiz.onrender.com` (TTL 14400).
- Diretórios `.qa-professor/` e `output/` são do usuário; não apagar nem incluir em commits.

## Autorizações e economia

O usuário autorizou a conexão OAuth do Wrangler e, separadamente, a transferência das credenciais atuais de Supabase/autenticação/Resend para os segredos Cloudflare. Não autorizou plano pago. Para continuar as tarefas operacionais, sugerir um modelo econômico com raciocínio alto; reservar Astra/ultra para incompatibilidades complexas.
