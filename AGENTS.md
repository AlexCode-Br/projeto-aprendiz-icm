# Orientações para manutenção

Antes de trabalhar neste repositório:

1. Leia `PROJECT_STATUS.md`, `docs/ARCHITECTURE.md` e, para publicações, `cloudflare/OPERATIONS.md`.
2. Confirme o estado com `git status --short` e preserve alterações que não pertençam à tarefa.
3. Trate `wrangler.jsonc` como fonte de verdade da infraestrutura de produção.

## Regras do projeto

- Mantenha frontend, API e regras compartilhadas nos limites descritos em `docs/ARCHITECTURE.md`.
- Reutilize componentes e funções existentes antes de criar variações locais.
- Preserve os contratos públicos de URL e API. Rotas com nomes históricos só devem mudar com migração compatível.
- Nunca versione `.env`, segredos, bancos locais, builds, relatórios gerados ou dados de teste.
- Não adicione cópias, backups ou versões antigas dentro do repositório; o histórico pertence ao Git.
- Modais usam o `X` do cabeçalho para sair. Não duplique essa ação com `Cancelar`, `Fechar` ou `Voltar`.
- Registro de frequência e relatórios acadêmicos permanecem exclusivos do professor. O aluno pode consultar somente a própria frequência nas turmas vinculadas, sem editar matrículas ou chamadas.
- Excluir uma turma nunca exclui o cadastro do aluno ou do professor.

## Qualidade e entrega

- Execute `pnpm lint` nos arquivos alterados e `pnpm check` antes de concluir mudanças de código.
- Execute `git diff --check` antes de criar um commit.
- Faça deploy apenas quando o usuário solicitar explicitamente.
- Depois de um deploy, valide o domínio, o bundle publicado e `/api/health`.
- Atualize `PROJECT_STATUS.md` quando houver mudança de arquitetura, infraestrutura, regra permanente ou versão publicada.

