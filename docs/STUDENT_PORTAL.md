# Área do aluno — implementação local

Atualizado em 22/09/2026. **Não publicada.** Nenhum banco remoto foi alterado e nenhum convite real foi enviado durante os testes.

## Navegação e funcionalidades

- **Início:** resumo pessoal, próximas aulas no mês e avisos não lidos.
- **Meus cursos:** matrículas ativas/concluídas por período letivo, cinco por página. Um clique abre o curso com suas abas Mural, Aulas e Frequência. A página também reúne consultas gerais de calendário e frequência sem criar novas entradas na sidebar.
- **Mural:** somente publicações destinadas ao aluno ou às turmas vinculadas, com categorias, fixação, anexos privados e leitura individual. Quando o professor exigir confirmação, abrir não marca a publicação; o aluno precisa usar “Confirmar leitura”.
- **Configurações:** nome, foto, telefone, igreja cadastrada, classe, instrumento e dados do responsável quando necessários, preferências e dispositivos. O aluno não pode matricular-se, trocar de turma ou editar frequência.

O gestor pode enviar o convite em Dados do aluno. Só é permitido vincular uma conta por cadastro acadêmico e uma pessoa por conta. Convites têm validade de 48 horas, token aleatório armazenado como hash e consumo único. Contas de gestores/professores não são convertidas em contas de aluno. A futura integração com um site de inscrição não faz parte desta entrega.

O professor gerencia o “Mural da turma” em Minhas turmas. Pode criar, editar e excluir somente suas próprias publicações, escolher categoria, anexar imagens/PDFs, fixar conteúdo e solicitar confirmação. A tela mostra confirmações apenas entre alunos ativos da turma que já possuem acesso. A API revalida propriedade da turma e autoria em cada mutação. O gestor pode selecionar alunos como público em Informativos. Comunicados antigos destinados à equipe não se tornam visíveis aos alunos automaticamente.

## Troca de e-mail

1. Aluno informa novo e-mail e senha atual.
2. O sistema envia ao novo endereço um link válido por 30 minutos. Nada muda antes da confirmação.
3. Ao confirmar, atualiza contato acadêmico e endereço de login, encerra sessões do aplicativo e avisa o endereço antigo.

Os testes locais cobrem senha incorreta, manutenção do endereço antigo antes da confirmação, consumo único, atualização dos dois registros e novo login. A atualização real no Supabase Auth precisa de homologação: banco da aplicação e provedor de autenticação não compartilham uma transação distribuída. Há compensação em falhas conhecidas, mas uma interrupção do processo entre as duas gravações exige reconciliação operacional. Não afirmar atomicidade entre os sistemas.

## Segurança e dados

- O identificador acadêmico vem de `student_accounts`, correlacionado à sessão em cada requisição. Contas/cadastros desativados deixam de ter acesso.
- APIs de gestor/professor continuam negadas; consultas por curso, período, frequência, leitura e download revalidam o vínculo.
- O perfil pessoal aceita somente campos explicitamente permitidos. Papéis e matrículas enviados pelo cliente são rejeitados.
- As migrações 020 e 022 criam/evoluem as tabelas privadas com RLS e revogam acesso de PUBLIC, anon e authenticated; apenas a API privilegiada acessa o schema. Não criar políticas públicas de leitura para contornar problemas de autorização.
- Excluir o acesso do aluno remove o vínculo de login e revoga a conta, mas conserva registros acadêmicos. A interface explica essa distinção.

## Notificações

O cron do Worker executa a cada cinco minutos, processando até 50 pares informativo/conta por execução, com lease de cinco minutos, até três tentativas e chave de entrega idempotente. Revalida o público após obter o lease e usa mensagem genérica, sem frequência ou outros dados acadêmicos na tela bloqueada.

A preferência `systemNews`, apresentada ao aluno como **Mural e informativos**, é desativada por padrão. E-mail/push respeitam essa preferência; push também exige autorização do dispositivo. As publicações continuam visíveis dentro do portal independentemente desse opt-in. O clique leva ao Mural. Em desenvolvimento Node, não há disparo periódico automático: os testes chamam o despachante com serviço de notificação simulado.

## Validação e limites

- `pnpm lint`: análise estática do repositório.
- `pnpm check`: regressões existentes, integração HTTP em SQLite isolado, migração local e build React.
- `backend/student-portal.integration.test.mjs`: convites, isolamento entre alunos, bloqueios por papel, matrícula/período de terceiros, calendário, frequência, leitura/anexos, avisos do professor, dados pessoais e confirmação de e-mail.
- `backend/worker-database.test.mjs`: qualificação das novas tabelas para o schema privado do Worker.
- Navegador local com dados fictícios: desktop e larguras móveis, detalhes de curso, aviso do professor e navegação de frequência com cinco registros por página.
- Revalidação em 22/09/2026: 86 testes aprovados, nenhum reprovado e um PostgreSQL ignorado; lint e build React aprovados. O modal do mural foi validado localmente em largura responsiva, incluindo rolagem até as publicações.

Não foi possível executar PostgreSQL real sem um banco de testes configurado. SQLite e a compilação do Worker não substituem a validação da migração, RLS e transações no PostgreSQL. Envio de e-mail, troca de endereço real no Supabase, anexos no Storage e push em Android/iPhone também exigem homologação. Não usar contas reais de produção para preencher essa lacuna sem autorização.

## Ordem segura de publicação (pendente)

1. Revisar resumo e riscos com o responsável; obter autorização para publicar.
2. Aplicar a sequência de migrações, incluindo 020, em PostgreSQL de homologação e verificar contas, vínculos, RLS e regressões. Fazer backup conforme a operação do ambiente.
3. Validar convite e confirmação de e-mail com contas controladas no provedor, anexos privados e notificações nos dispositivos alvo.
4. Só após essas validações, aplicar a migração no ambiente autorizado e publicar o Worker/frontend juntos, incluindo o cron. A API nova depende das novas tabelas; não publicar código antes da migração.
5. Conferir login dos três perfis, isolamento, `/api/health`, assets e entregas. Registrar versão/commit em PROJECT_STATUS.md. Em rollback de código, não apagar cadastros nem tabelas acadêmicas.
