# Publicação do chat de suporte — 03/10/2026

O responsável autorizou explicitamente o deploy do chat com anexos, emojis e voz. A [PR #48](https://github.com/AlexCode-Br/projeto-aprendiz-icm/pull/48) preserva o histórico dos chamados e as URLs existentes, com conversa contínua por professor e atualização automática por consulta compacta a cada dois segundos.

## Versão e migração

- [Deploy production #3](https://github.com/AlexCode-Br/projeto-aprendiz-icm/actions/runs/37140040529), concluído em 03/10/2026 às 14:21 (America/Sao_Paulo).
- Commit publicado: `87cb3b7de263af2f103ea55260979ee24842809b`, de `main`.
- Worker: `aprendiz-staging`; versão `12649394-bea1-44dc-be85-df57af2329b9`, com 100% do tráfego confirmado no dashboard.
- Versão saudável anterior: `86321bf4-4dd7-415e-a4ed-2fb6339be220`.
- Domínio: `https://aprendizicm.com.br`.

O migrador concluiu às 14:21:21, antes do build/upload, incluindo `029_support_chat_attachments.sql`. A tabela privada `support_attachments` usa RLS e privilégios públicos revogados. O histórico foi preservado; fotos, vídeos, documentos e áudios são autorizados pela API por conversa. O bucket privado `support-attachments` é criado pelo backend no primeiro envio com arquivo; não foram necessários novos secrets. TLS, MFA, Hyperdrive e bindings existentes foram preservados.

## Validação

CI final da PR e validação do deploy aprovadas: check com 115 testes (113 aprovados, zero falhas, duas regressões externas executadas na etapa própria), três testes PostgreSQL 16 aprovados sem skips, auditoria sem vulnerabilidades e build seco. Tailwind foi atualizado para 4.3.3 com o plugin PostCSS oficial, retirando `braces` vulnerável do grafo; nenhuma exceção de auditoria foi adicionada. Configuração de tema e compatibilidade visual mantidas, com conferência do chat em desktop/celular, dashboard e modal locais.

Smoke do workflow e execução independente: login 200, health 200/ok, sessão ausente 401, www 308 para a raiz. O HTML publicado referencia o novo JS/CSS; bytes e SHA-256 conferem com o build local da mesma árvore Git:

| Asset | Bytes | SHA-256 |
|---|---:|---|
| `/assets/index-rSGU-7k2.js` | 355283 | `e863c64a7f8745707b4dbf5fb333dc8d2f08c644ca653e78d58004af5318382a` |
| `/assets/index-DNGjry9q.css` | 108826 | `e866a651c33c2a0eb091a9429d7c3c8b3d57890f5cea9b308a290061765089a8` |
| `/assets/SupportChatPage-DNTHCTLf.js` | 39766 | `1db68c5ad188eda07eaf10060a43382bdec71c8252232ea08632f0ba5c503b2f` |

A sessão existente do gestor abriu a nova interface, a conversa histórica de 23/09/2026, separador de data, horários, leitura e compositor com botão vermelho de áudio. Não foram enviados dados fictícios, arquivos ou áudios em produção. Fluxos de envio nos dois perfis e entrega pelo Storage real permanecem para conferência nos dispositivos do responsável; a prévia isolada validou esses fluxos com arquivos fictícios e mídia sintética. A interface de áudio tem pausa/continuação/revisão, onda, progresso e velocidades, sem download ou visualização única. O chat não oferece equivalência integral ao WhatsApp (presença, digitação, chamadas ou criptografia ponta a ponta).

## Recuperação e pendências

Antes do deploy, tamanho e SHA-256 do backup cifrado de 01/10 conferiram com o manifesto: 580233 bytes, `d86f8fcb4f3f8d652718ac51d0168b593bea9537eefe89ec9841bdfe4c33b5f1`. O ensaio de restauração de 01/10 permanece registrado; não foi feita nova exportação ou restauração nesta publicação. Esse backup contém o schema privado antes das migrações 028/029 e exclui Auth/Storage/binários.

O dashboard confirmou que Supabase Free não inclui backups de projeto. A política de cópia contínua e externa, incluindo os binários de `support-attachments`, continua pendente. Rollback do Worker deve usar a versão anterior saudável; alterações de banco exigem migração própria e não são revertidas com o código.

Os avisos das actions v4 e da futura mudança de imagem Ubuntu continuam como manutenção separada. Consulte [PROJECT_STATUS.md](../../PROJECT_STATUS.md) e [Operações](../../cloudflare/OPERATIONS.md).
