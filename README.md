# Projeto Aprendiz Aprimorado

Aplicação web com frontend React e backend Node.js para a gestão do Projeto Aprendiz. Gestores e professores usam o mesmo sistema, com rotas, menus e permissões próprias para cada perfil.

## Recursos

- Login e recuperação de senha com Supabase Auth, seguido de sessão própria em cookie `HttpOnly`, `Secure` e proteção CSRF.
- Papéis de Gestor e Professor autorizados no backend, sem confiar em metadados editáveis do usuário.
- Convites com tokens temporários, de uso único e armazenados somente como hash.
- E-mails reais via Resend em produção e caixa local em `/dev-mail` durante o desenvolvimento.
- Gestão de alunos, professores, cursos, turmas, matrículas, informativos com imagens/PDFs privados, suporte e relatórios administrativos.
- Período acadêmico ativo mantido internamente para preservar a integridade das turmas, sem seletor na interface.
- Chamada rápida e relatórios de frequência exclusivos para professores.
- Dashboard do gestor sem dados de presença, com totais administrativos e gráfico de alunos por turma.
- Exportações CSV protegidas contra fórmulas de planilha nas áreas operacionais do professor.
- Anonimização irreversível de alunos, consentimento de responsável para menores, auditoria interna e logs JSON sem exposição desses registros na interface.
- PostgreSQL do Supabase em um schema privado e isolado das tabelas antigas do projeto.
- Migrações automáticas, endpoint de saúde e encerramento seguro do servidor.

## Desenvolvimento local

Requisitos: Node.js 22.12–24 e pnpm 11.

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm start
```

Acesse `http://127.0.0.1:4180`. O banco SQLite é criado em `backend/data/` e não é versionado.

Contas de demonstração locais:

| Perfil | E-mail | Senha |
|---|---|---|
| Gestor | `gestor@projetoaprendiz.local` | `Gestor@2026!` |
| Professor | `professor@projetoaprendiz.local` | `Professor@2026!` |

Essas contas não são criadas em produção. Use `.env.example` como referência, sem versionar o arquivo `.env`.

## Hospedagem web: Render + Supabase

O arquivo `render.yaml` descreve o serviço web gratuito no Render. O banco e a autenticação ficam no Supabase. As migrações são aplicadas automaticamente no schema privado `projeto_aprendiz` quando o servidor inicia.

> **Limitação do Render gratuito:** o serviço pode entrar em repouso sem tráfego e demorar no primeiro acesso seguinte. O banco gratuito do Supabase não expira a cada 30 dias, mas projetos inativos podem ser pausados.

1. Crie e confirme o primeiro usuário em **Supabase Auth**.
2. No Supabase, configure a URL pública do Render em **Auth → URL Configuration** e conecte um SMTP próprio para e-mails de produção.
3. Crie um **Blueprint** no Render e conecte este repositório.
4. Informe a conexão **Supavisor Session** (porta 5432) em `DATABASE_URL`, a chave pública em `SUPABASE_PUBLISHABLE_KEY` e `VITE_SUPABASE_PUBLISHABLE_KEY`, a chave secreta somente no backend em `SUPABASE_SECRET_KEY` e o e-mail do primeiro Gestor em `BOOTSTRAP_ADMIN_EMAIL`.
5. Informe `RESEND_API_KEY` e `EMAIL_FROM` para os convites de professores.
6. Aplique o Blueprint. O build, as migrações privadas e `/api/health` já estão configurados.

O backend usa a conexão Supavisor compatível com IPv4. As tabelas da nova aplicação ficam fora do schema público e não são acessadas diretamente pelo navegador. O bucket privado `announcement-attachments` é criado sob demanda pelo backend; os professores acessam os arquivos apenas pela rota autenticada e autorizada da aplicação.

## Variáveis de produção

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | Conexão Supavisor Session do Supabase. |
| `AUTH_PROVIDER` | Deve ser `supabase` na web. |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | URL pública do projeto Supabase. |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública; nunca use `service_role` ou chave secreta no frontend. |
| `SUPABASE_SECRET_KEY` | Chave secreta disponível somente no backend para Auth administrativo e Storage privado. |
| `SUPABASE_ANNOUNCEMENT_BUCKET` | Bucket privado de anexos; padrão `announcement-attachments`. |
| `BOOTSTRAP_ADMIN_EMAIL` | E-mail confirmado no Supabase Auth que receberá o papel Gestor. |
| `RESEND_API_KEY` | Credencial para recuperação de senha e convites. |
| `EMAIL_FROM` | Remetente validado, como `Projeto Aprendiz <acesso@dominio.com>`. |
| `APP_URL` | Opcional; URL pública usada nos links. No Render ela é detectada automaticamente. |
| `APP_TIMEZONE` | Fuso usado no agendamento; padrão `America/Sao_Paulo`. |
| `DATABASE_SSL` | `true` para a conexão segura com o Supabase. |

## Privacidade e observabilidade

A política aplicada de exclusão, anonimização e retenção está em [docs/LGPD.md](docs/LGPD.md). A auditoria permanece interna e não é exibida ao gestor. Erros técnicos são escritos em `stderr` como um objeto JSON por linha, com identificador de requisição e sem cookies, tokens, senhas ou corpo da solicitação, facilitando a busca nos logs do Render.

## Validação

```bash
pnpm check
```

O comando valida o backend, executa os testes do banco e compila o frontend. O mesmo processo roda em cada pull request pelo GitHub Actions.

O conjunto automatizado cobre autenticação e rate limiting, modelo acadêmico, isolamento da frequência por função, dashboard administrativo, suporte, informativos, LGPD, logs estruturados e geração segura de CSV.
