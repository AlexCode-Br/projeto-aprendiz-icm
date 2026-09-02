# Horários semanais e apresentação mobile das turmas

## Comportamento

- A lista de turmas do gestor usa cartões abaixo de 640 px; a tabela permanece no computador.
- Em “Minhas turmas”, o professor cadastra, altera ou remove dias e horários de início das suas turmas ativas. São permitidos vários horários no mesmo dia, sem duplicações (até 21 por turma).
- O gestor consulta os horários na lista e no modal da turma, sem editá-los.
- A seleção de turmas da chamada indica os horários disponíveis; o painel calcula a próxima aula considerando todos os horários e o fuso APP_TIMEZONE.
- Campos de horário tratam os eventos input e change para sincronizar o seletor nativo, inclusive no mobile.

## Persistência e segurança

- PUT /api/professores/me/turmas/:id/horarios recebe { horarios: [{ weekday, start_time }] }.
- Autenticação, CSRF, perfil proprietário ativo e período aberto são verificados no backend.
- O calendário é substituído em transação; a linha da turma é atualizada com verificação de propriedade antes da alteração dos horários. Os campos antigos weekday/start_time mantêm o primeiro horário ordenado para compatibilidade.
- O projeto usa seu migrador SQL próprio em backend/database.mjs, não o histórico do Supabase CLI. A migração 015_class_schedules.sql cria a tabela privada com chave primária composta, FK com cascade, restrições de dias/minutos, RLS e revogação dos papéis públicos. A migração preserva o horário antigo.
- O desenvolvimento SQLite usa a inicialização equivalente e idempotente. A migração PostgreSQL ainda não foi aplicada em produção nesta revisão.
- Editar dados administrativos não apaga horários. Também foram preservados nome interno e capacidade já cadastrados ao editar a turma.

## Verificações

- Testes automatizados: horários inválidos/duplicados, ordenação, próxima aula/fuso, migração, FK, permissões, período fechado, persistência após reiniciar, limpeza de horários e preservação na edição pelo gestor.
- Prévia local: 320/390 px e desktop, temas claro/escuro, filtros, botões de editar/desativar (sem executar a desativação), cadastro de dois dias, confirmação e recarga.
- Dados de demonstração e banco local isolado; nenhuma alteração de produção ou deploy.
