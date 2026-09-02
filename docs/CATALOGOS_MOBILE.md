# Catálogos e alunos no mobile

## Comportamento

- Abaixo de 640 px, alunos usam uma lista compacta com contatos e ações no cabeçalho do registro. Os botões mantêm alvos de toque de 44 × 44 px. Gestor pode visualizar/editar/excluir; professor apenas consulta os próprios alunos.
- Os catálogos de cursos e igrejas usam linhas responsivas, sem tabela ou rolagem horizontal no mobile. Nome, vínculos, status e ações ficam visíveis; nomes longos quebram em linhas.
- As tabelas de desktop foram preservadas.
- Os ícones são SVG locais por família de instrumento. Violão I e II compartilham o ícone de violão; nomes desconhecidos usam um símbolo musical genérico.

## Sugestões permanentes (inclusive em produção)

`shared/catalog-options.mjs` contém os 10 cursos e as 7 igrejas da prévia. Esses nomes acompanham o build, independentemente do modo de demonstração ou do conteúdo do banco.

- Cursos: Bateria, Canto Coral, Contrabaixo, Flauta Transversal, Saxofone, Teclado, Teoria Musical, Violino, Violão I, Violão II.
- Igrejas/locais: Alto de Coutos, Boca do Rio, Brotas, Guarani, Lauro de Freitas, Pituba, Remoto.

“Adicionar curso/igreja” oferece busca, seleção e cadastro de nome livre. Nomes existentes são identificados e desabilitados nas sugestões. A comparação ignora acentos, maiúsculas e espaços repetidos. Somente ao salvar o nome é enviado à API de catálogos existente, mantendo suas permissões e persistência. Falhas de salvamento aparecem no formulário sem descartar o nome.

**Não há importação automática de contas, turmas, matrículas ou dados pessoais fictícios. Não há nova migração de banco nesta alteração.**

## Verificação

- `pnpm lint` e `pnpm check` (40 testes e build).
- Prévia local: layouts de 320 e 390 px, temas claro/escuro, contatos e ações de alunos, abrir/cancelar confirmações, criação de curso e igreja fora das sugestões, persistência após recarga, prevenção de duplicatas e disponibilidade da igreja nova no cadastro de turma.
- Registros temporários “Percussão (teste local)” e “Igreja de teste local” foram removidos após verificar ausência de turmas e matrículas vinculadas. Nenhum cadastro de produção foi alterado.
- A validação acima foi realizada localmente, antes da publicação autorizada pelo gestor.
