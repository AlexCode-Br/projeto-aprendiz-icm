# Revisão da área do professor

Data: 17/09/2026. Comparação com a área do gestor no código local.

## Escopo e limites

Foram revisadas as oito páginas de professor, os componentes de modais usados por elas, a listagem mobile compartilhada e os contratos das rotas relacionadas. Os achados abaixo são evidências do código; não representam uma homologação completa em aparelhos reais nem uma auditoria de segurança exaustiva. Nenhum cadastro, chamado, mensagem ou frequência de produção foi alterado.

A retirada da animação do login foi implementada separadamente. Atualização de 17/09: os itens 2 e 3 abaixo foram corrigidos em “Meus alunos”, junto à paginação de cinco registros, filtros equivalentes ao gestor e frequência no lugar dos contatos, conforme solicitação posterior. Os demais achados continuam pendentes. A lista foi conferida em desktop e viewport mobile de 390 px, com banco local fictício; testes cobrem filtros, cálculo e isolamento por professor.

## Problemas funcionais prioritários

### 1. Alterações de chamada durante o salvamento podem ser perdidas

- Evidência: `src/pages/professor/ProfessorFrequencia.jsx:132`, `:166`, `:170` e `:250`.
- O botão Salvar é desabilitado durante a requisição, mas os botões Presente/Ausente/Justificada continuam aceitando mudanças.
- Cenário: salvar uma chamada e, enquanto o envio está em andamento, alterar a situação de um aluno. A alteração ocorre depois da montagem do payload. Quando o salvamento termina, a busca seguinte sobrescreve o estado com a versão enviada anteriormente.
- Prioridade: alta, pois uma alteração visível pode ser descartada sem aviso. Reproduzir com resposta de rede lenta na homologação.
- Ajuste indicado: bloquear alterações da chamada durante o envio ou controlar revisões do formulário para preservar mudanças posteriores ao payload.

### 2. Menu de ações vazio nos alunos do professor no mobile

- Evidência: `src/components/MobileStudentList.jsx:41` e uso em `src/pages/professor/ProfessorAlunos.jsx`.
- O componente sempre renderiza o menu de três pontos. O professor não recebe `onEdit` nem `onDelete`, portanto o menu abre sem opções. O cartão ainda reserva espaço lateral para ações inexistentes.
- Prioridade: média.
- Ajuste indicado: renderizar menu e espaço de ações apenas quando houver ações disponíveis. Não conceder edição ou exclusão ao professor para preencher esse menu.

### 3. Busca de alunos pode apresentar resultados de uma pesquisa anterior

- Evidência: `src/pages/professor/ProfessorAlunos.jsx:31–56`.
- O debounce cancela somente o temporizador. Requisições já iniciadas não são invalidadas, e qualquer resposta pode executar `setAlunos` e encerrar o indicador de carregamento.
- Cenário: pesquisar um nome e depois outro; se a primeira resposta chegar por último, substitui os resultados da busca atual.
- O gestor já protege esse fluxo com `requestSequence` em `src/pages/gestor/Alunos.jsx:73–104`.
- Prioridade: média. Ajuste indicado: aplicar a mesma proteção e corrigir a página corrente quando o total diminuir.

### 4. Data exibida no painel não corresponde à matrícula recente

- Evidência: `src/pages/professor/ProfessorDashboard.jsx:116`; `backend/routes/students.mjs:428`; `backend/application.mjs:341`.
- A consulta ordena por `enrollments.enrolled_at`, mas o cartão exibe `students.created_at`.
- Um aluno cadastrado anteriormente e matriculado hoje aparece entre os recentes com a data antiga do cadastro.
- Prioridade: média. Ajuste indicado: retornar e exibir a data da matrícula considerada na ordenação, com o mesmo fuso utilizado pelo gestor.

## Diferenças de padrão visual e navegação

| Área | Professor atualmente | Padrão do gestor / ajuste proposto |
|---|---|---|
| Meus alunos | 10 por página; paginação não compacta | 5 por página e setas compactas |
| Minhas turmas | Todos os cartões em uma lista | Paginar em grupos de 5 |
| Informativos | Todos os resultados filtrados | Paginar em grupos de 5 após os filtros |
| Suporte | Lista integral com rolagem interna | Paginar em grupos de 5 |
| Indicadores do painel | Uma coluna no mobile | Grade 2×2, inclusive no carregamento |
| Resumo dos alunos | E-mail e telefone na lista | Comparar adoção de Igreja e Classe, deixando contatos no modal |
| Alunos recentes do painel | Somente o nome abre detalhes | Nome e foto acionarem o mesmo modal |

Referências: `ProfessorAlunos.jsx:22`, `ProfessorTurmas.jsx:38`, `ProfessorInformativos.jsx:85`, `ProfessorSuporte.jsx:142`, `ProfessorDashboard.jsx:74,83,116`. Na área do gestor, `Turmas.jsx`, `Informativos.jsx` e `Suporte.jsx` já definem `ITEMS_PER_PAGE = 5`; `Alunos.jsx` usa cinco itens e `Dashboard.jsx:79` utiliza duas colunas.

## Componentes e comportamentos já alinhados

- Dados do aluno: o professor e o gestor usam `StudentDetailsModal`, com foto, contatos por ícone e informações acadêmicas.
- Foto ampliada: o modal utiliza o mesmo `ProfilePhotoViewer` compartilhado.
- Configurações: `ProfessorConfiguracoes` e `Configuracoes` exportam o mesmo `AccountSettings`.
- Modais de horários, novo chamado, informativos e prévias de relatórios usam o componente `Modal`: fechamento pelo X, Escape, contenção e restauração de foco e corpo com rolagem.
- Não foram encontrados botões Cancelar/Fechar duplicando o X nesses modais. O botão Voltar do suporte troca a conversa pela lista no mobile; é navegação, não uma duplicação de fechamento de modal.
- Horários: há validação compartilhada de dias/horas, indicação de conflitos e bloqueio do formulário durante o salvamento.
- Suporte: conversa e lista compartilham componentes com o gestor; as respostas recebem identificadores para controle de repetição, e a abertura de conversas protege contra respostas atrasadas de outro chamado.
- Informativos: o professor dispõe de pesquisa, filtros de leitura e fixados, anexos e registro de leitura; o modal de conteúdo é compartilhado.
- Relatórios: há prévia e download PDF/CSV, filtros por turma/período e liberação das URLs temporárias dos arquivos ao fechar a prévia.

## Diferenças que devem ser preservadas

- Frequência e relatórios acadêmicos permanecem exclusivos do professor.
- Cadastro/exclusão de alunos e administração das turmas permanecem no gestor.
- O professor define horários das turmas atribuídas a ele; não administra o curso ofertado nem o professor responsável.
- As rotas de alunos e frequência examinadas verificam o perfil e os vínculos das turmas. A consulta dos alunos agrega somente as turmas do professor. Isso não deve ser ampliado ao padronizar a interface.

## Ordem recomendada para implementação

1. Proteger a edição da chamada durante o salvamento, retirar o menu vazio e impedir resultados atrasados na busca.
2. Corrigir a data dos alunos recentes.
3. Unificar paginação, indicadores mobile e ações de abertura dos detalhes.
4. Homologar os fluxos de horários, chamados, informativos, frequência e relatórios com uma conta de professor e dados de teste.

## Verificação executada

- `pnpm lint`: aprovado.
- `pnpm check`: 79 testes aprovados, 1 teste opcional PostgreSQL ignorado e build aprovado. A suíte existente não reproduz os problemas de interação acima.
- `git diff --check`: aprovado.
- Login local conferido no navegador com a logo estática. Não houve deploy.
