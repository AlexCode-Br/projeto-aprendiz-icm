# Revisão de UI/UX — Projeto Aprendiz

## Escopo

Revisão transversal do login, recuperação de acesso, navegação, telas do gestor e do professor, formulários, listas, tabelas, informativos, suporte e configurações. Mantida a identidade vermelho/cinza/branco e as regras de negócio existentes. Não foram alterados o esquema do banco, as permissões de acesso ou a infraestrutura de produção.

## Principais alterações

- Sistema visual consistente: cores semânticas com transparência correta, superfícies claras/escuras, hierarquia de texto, espaçamento, bordas e estados de foco/erro/desabilitado.
- Ícones Lucide, substituindo os SVGs antigos e os emojis usados como controles. Os quatro componentes de ícones antigos foram removidos; os aliases necessários continuam disponíveis no índice.
- Navegação recolhível no desktop, menu móvel com foco contido, indicação da seção atual e atalho para pular ao conteúdo.
- Tabelas adaptáveis a cartões no celular, pesquisas com botão de limpeza, menus de ações que não são cortados pelo contêiner, listas pesquisáveis com instruções em português para leitores de tela.
- Modais sobrepostos com bloqueio do fundo, foco estável, Escape e rolagem interna. Selecionar opções ou digitar não reinicia o foco.
- Cabeçalho do chat reorganizado, detalhes secundários recolhíveis e rolagem restrita ao histórico. Mantida a exclusão de chamados exclusivamente pelo gestor.
- Botões do editor com indicação acessível de formatação ativa, anexos e estados vazios consistentes.
- Configurações com seções claras, interruptores de notificações, exibição opcional de senha e carregamento/erro com nova tentativa antes de liberar edição.
- Avatares mantêm iniciais durante o carregamento ou quando a imagem falha, sem piscar o ícone de imagem quebrada.
- Recorte de foto de perfil: prévia circular, arraste, setas do teclado, zoom de 1x a 3x, redefinir, cancelar e aplicar. Exportação quadrada em PNG de 512 × 512, preservando transparência. O seletor compartilhado atende perfil do gestor/professor e cadastro de alunos/professores.

## Validação realizada

- `pnpm lint`: sem avisos ou erros.
- `pnpm check`: 31 testes aprovados e compilação de produção concluída.
- Testes novos de recorte cobrem orientação horizontal/vertical, limites da imagem e arraste independente do tamanho da prévia.
- Navegador local com banco isolado: login de gestor e professor, navegação nas áreas de ambos os perfis, temas claro e escuro, desktop (1280 px) e celular (390 px).
- Menus móveis, edição de professor, recorte em modal sobreposto, retorno ao formulário e cancelamento sem salvar o cadastro.
- Foto recortada salva via API local e recuperada após recarregar a página, confirmando dimensões 512 × 512. Foto de teste removida ao final.
- Editor: negrito + itálico + sublinhado simultâneos, com HTML e estados `aria-pressed` corretos; Escape fecha a lista suspensa sem fechar o modal.
- Suporte: digitação contínua mantém foco no campo; seleção do chamado não desloca a página inteira.
- Chamada e relatórios do professor sem transbordamento horizontal no celular. Nenhuma frequência de aluno foi enviada durante os testes visuais.
- Login rejeita campos vazios e e-mail inválido antes da requisição.

## Limites e publicação

Os testes de navegador utilizam dados sintéticos e autenticação local, não contas ou registros de produção. A integração Supabase/Render não foi modificada nem publicada nesta revisão. A prévia local é servida em `http://127.0.0.1:4199`; o banco `uiux-qa.db*` está explicitamente ignorado pelo Git. A publicação deve ocorrer após aprovação visual. Não houve exclusão de dados de usuários.
