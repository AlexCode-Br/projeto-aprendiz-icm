# Projeto Aprendiz Aprimorado

Nova versão independente do Projeto Aprendiz, com frontend React e backend local.

## Recursos implementados

- Banco SQLite persistente no ambiente local.
- Senhas protegidas com `scrypt` e salt aleatório.
- Sessões armazenadas no banco e cookie `HttpOnly`/`SameSite=Strict`.
- Perfis separados de Gestor e Professor.
- Proteção CSRF, verificação de origem e limitação de tentativas.
- Recuperação de senha com token aleatório, temporário, de uso único e armazenado como hash.
- Invalidação das sessões após redefinir a senha.
- Caixa de e-mail local para testar o fluxo sem enviar mensagens reais.
- Registros de auditoria de login, logout e alteração de senha.
- Modelo acadêmico relacional para alunos, professores, cursos, turmas e matrículas.
- Lançamento de frequência persistente por turma e data.
- Permissões reais: Gestor administra cadastros; Professor acessa somente suas turmas e alunos.
- Perfil, preferências de notificação e alteração autenticada de senha persistentes.
- Convite de novos professores por link temporário, de uso único, com criação da própria senha.
- Dashboards de Gestor e Professor calculados diretamente a partir do banco.

## Contas locais iniciais

| Perfil | E-mail | Senha |
|---|---|---|
| Gestor | `gestor@projetoaprendiz.local` | `Gestor@2026!` |
| Professor | `professor@projetoaprendiz.local` | `Professor@2026!` |

As credenciais são somente para desenvolvimento e devem ser substituídas antes da publicação.

## Executar

1. Instale as dependências do frontend: `npm install`
2. Compile: `npm run build`
3. Inicie frontend e backend: `npm start`
4. Acesse `http://127.0.0.1:4180`

A caixa local de mensagens fica em `http://127.0.0.1:4180/dev-mail`.

## Situação dos módulos

Autenticação, configurações, convites, dashboards, alunos, cursos, professores, matrículas, frequência, informativos, suporte e relatórios já usam o banco real. Em ambiente local, os e-mails de recuperação e convite aparecem na caixa de mensagens de desenvolvimento.
