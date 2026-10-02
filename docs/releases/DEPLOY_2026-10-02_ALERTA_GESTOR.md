# Publicação do alerta de novo acesso — 02/10/2026

O responsável solicitou simplificar o e-mail conforme a referência enviada e autorizou o deploy após a alteração. A [PR #45](https://github.com/AlexCode-Br/projeto-aprendiz-icm/pull/45) implementou o alerta separado; a [PR #46](https://github.com/AlexCode-Br/projeto-aprendiz-icm/pull/46) reduziu o conteúdo a data/hora, sistema/navegador e localização aproximada, com botão “Não fui eu” para revisar sessões e senha em Configurações. O código MFA permanece em outro e-mail.

## Versão e banco

- [Deploy production #2](https://github.com/AlexCode-Br/projeto-aprendiz-icm/actions/runs/36997932593), concluído com sucesso em 02/10/2026, às 07:56 (America/Sao_Paulo).
- Commit publicado: `592e6075668ae957bc365b320b477f1639f77a33`, de `main`.
- Worker: `aprendiz-staging`; versão `86321bf4-4dd7-415e-a4ed-2fb6339be220`.
- Versão saudável anterior: `24fa9a92-bb96-471d-8283-3d3397efdbdf`.
- Domínio: `https://aprendizicm.com.br`.

O workflow executou `pnpm cloudflare:deploy`. O migrador terminou com “Migrações aplicadas com sucesso” antes do build e upload, incluindo a nova tabela privada `manager_login_devices` da migração `028`. Ela tem RLS, privilégios públicos revogados e guarda somente o hash do identificador de reconhecimento, com validade renovável de um ano. O cookie não autentica e não dispensa senha ou MFA. Sessão, registro e alerta são persistidos na mesma transação; envio obrigatório por e-mail usa retentativas duráveis e não envia push.

Credenciais, TLS, Hyperdrive e demais bindings foram preservados. Nenhuma suíte destrutiva foi executada em produção.

## Verificações

A CI final da PR #46 e a etapa `validate` do deploy aprovaram check completo (102 testes aprovados, zero falhas, duas regressões PostgreSQL executadas na etapa própria), auditoria, PostgreSQL isolado e build seco do Worker. O teste de catálogo passou a aguardar a liberação do SQLite pelo escritor de alertas em segundo plano; suas verificações foram preservadas.

O smoke do workflow e uma execução independente aprovaram `/login` 200, `/api/health` 200/ok, `/api/auth/me` sem sessão 401 e `www` 308 para a raiz. Os assets públicos corresponderam ao HTML e ao SHA-256 do build local validado:

| Asset | Bytes | SHA-256 |
|---|---:|---|
| `/assets/index-nefI5ZeE.js` | 354802 | `83ed43aaaba547a8cfdb09b1d5b56b598367cf270ae5426c69cf65b29dfd0258` |
| `/assets/index-B7aY4Tzi.css` | 80879 | `b5e1eb85847b9400223045bf9283a27e16970e64eed33e61f82630056c5e9193` |

A prévia foi conferida com dados fictícios, incluindo texto/HTML seguro, botão único e indicação de localização aproximada. Os testes isolados cobrem o fluxo após MFA, navegador reconhecido, expiração, retentativa e rollback. Não houve login ou envio manual de e-mail real nesta publicação; confirmação de recebimento no próximo acesso fica com o responsável.

Os avisos das actions v4 e da futura migração de `ubuntu-latest` continuam como manutenção separada. Demais pendências permanecem em [PROJECT_STATUS.md](../../PROJECT_STATUS.md).
