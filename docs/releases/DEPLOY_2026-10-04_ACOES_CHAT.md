# Publicação das ações do chat — 04/10/2026

O responsável autorizou explicitamente o deploy. A [PR #51](https://github.com/AlexCode-Br/projeto-aprendiz-icm/pull/51) acrescenta copiar texto, apagar mensagem para mim/para todos e apagar conversa só para a conta atual. No PC, a seta aparece sobre o balão por hover/foco e abre um menu próximo à mensagem. No celular, tocar e segurar por 500 ms abre as opções; movimento acima de 8 px, soltura antecipada e cancelamento interrompem o gesto.

## Versão e migração

- [Deploy production #4](https://github.com/AlexCode-Br/projeto-aprendiz-icm/actions/runs/37178836512), concluído em 04/10/2026 às 02:07 (America/Sao_Paulo).
- Commit publicado: `52bfd91a6efd5ebd879f0d4074250a53bdfa9bd3`, de `main`; árvore igual à PR validada.
- Worker: `aprendiz-staging`; versão `874ecb8f-3d0b-4be8-a0e1-66eb730375c0`, com 100% do tráfego confirmado no dashboard.
- Versão saudável anterior: `12649394-bea1-44dc-be85-df57af2329b9`.
- Domínio: `https://aprendizicm.com.br`.

O migrador concluiu às 02:07:12, antes do upload, incluindo a migração pendente `030_support_chat_deletion.sql`. Ela acrescenta marcadores em `support_messages` e tabelas privadas `support_message_hides`/`support_conversation_hides`, com RLS e privilégios públicos revogados. Não remove dados existentes nem altera MFA, TLS, Hyperdrive, Storage ou secrets.

Exclusão global exige autoria individual, remove texto/metadados dos anexos da API e solicita limpeza dos binários no Storage. Mantém ID, autoria, horário e auditoria com “Mensagem apagada”. Apagar para mim/conversa persiste somente para a conta atual. O corte da conversa conserva mensagens que chegam durante a confirmação. Downloads reaplicam a visibilidade; o DELETE administrativo legado de chamado mantém seu contrato anterior.

## Validação

CI da PR e validação do deploy aprovadas: check com 117 testes, 115 aprovados, zero falhas e duas regressões externas executadas na etapa própria; três testes PostgreSQL 16 aprovados sem skips; auditoria sem vulnerabilidades e build seco aprovado.

Smoke do workflow e execução independente: login 200, health 200/ok, sessão ausente 401, www 308. HTML e SHA-256 dos assets conferem com o build local da mesma árvore:

| Asset | Bytes | SHA-256 |
|---|---:|---|
| `/assets/index-DChrrDJB.js` | 355349 | `c8b7c6e474787c7e8da3779dcdcdbcdc61e728bfb83c54ece7adf5b603844272` |
| `/assets/index-B_Ahhh1_.css` | 109402 | `89c0960c1770c6b0e342b9be895b5e53f359921b11861c6b360a0ce4e3613c33` |
| `/assets/SupportChatPage-By4cTCoV.js` | 47187 | `93bdd820267c620b4ba0d05de34f5e0162b890aa598fcf13acc610221c7e74a1` |

A sessão existente do gestor abriu o histórico de 23/09/2026, horários e leitura preservados. A seta apareceu ao posicionar o mouse no balão e abriu Copiar/Apagar para mim/Apagar para todos na mensagem própria. Nenhuma mensagem de teste, anexo, captura de microfone ou exclusão foi feita em produção.

Viewport móvel, menus, teclado e confirmações foram conferidos na prévia isolada. A ferramenta não simula pressão física de toque; o gesto prolongado precisa ser conferido em celular real. Exclusões e isolamento foram validados em testes SQLite/PostgreSQL sem utilizar dados de produção. A colagem do clipboard nativo não foi aferida pelo clipboard virtual da ferramenta.

## Recuperação

Tamanho e SHA-256 do backup cifrado de 01/10 conferiram com o manifesto: 580233 bytes, `d86f8fcb4f3f8d652718ac51d0168b593bea9537eefe89ec9841bdfe4c33b5f1`. Restauração ensaiada em 01/10; não houve nova exportação nesta publicação. Esse backup precede as migrações 028–030 e não inclui Auth/Storage/binários; backup contínuo externo permanece pendente.

Rollback do Worker usa a versão anterior saudável e não reverte o banco. A migração 030 é aditiva e compatível com o código anterior; exclusões realizadas pelos usuários exigem recuperação própria de dados, não rollback de código.

Consulte [PROJECT_STATUS.md](../../PROJECT_STATUS.md) e [Operações](../../cloudflare/OPERATIONS.md).
