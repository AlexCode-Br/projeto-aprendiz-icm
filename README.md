# Projeto Aprendiz Aprimorado

Aplicação web com frontend React e backend Node.js para a gestão do Projeto Aprendiz. Gestores e professores usam o mesmo sistema, com rotas, menus e permissões próprias para cada perfil.

Para retomar o desenvolvimento em uma nova tarefa, consulte [PROJECT_STATUS.md](PROJECT_STATUS.md). A organização técnica e os limites de cada camada estão em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

## Recursos

- Login e recuperação de senha com Supabase Auth, seguido de sessão própria em cookie `HttpOnly`, `Secure` e proteção CSRF.
- Papéis de Gestor e Professor autorizados no backend, sem confiar em metadados editáveis do usuário.
- Convites com tokens temporários, de uso único e armazenados somente como hash.
- E-mails reais via Resend em produção e caixa local em `/dev-mail` durante o desenvolvimento.
- Gestão de alunos, professores, turmas, matrículas, informativos com imagens/PDFs privados, suporte e relatórios de frequência do professor.
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

## Hospedagem web: Cloudflare Workers + Supabase

O frontend, a API e os assets são publicados em um Cloudflare Worker. PostgreSQL, Auth e Storage permanecem no Supabase; o Worker acessa o banco por Hyperdrive e protege tentativas de autenticação com Durable Object.

```bash
pnpm cloudflare:build
pnpm cloudflare:deploy
```

O arquivo `wrangler.jsonc` é a fonte de verdade da infraestrutura pública. Os segredos `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` e `RESEND_API_KEY` devem ser cadastrados com `wrangler secret put`, nunca versionados. Consulte [cloudflare/OPERATIONS.md](cloudflare/OPERATIONS.md) antes de publicar.

As tabelas ficam no schema privado `projeto_aprendiz` e não são acessadas diretamente pelo navegador. O bucket privado `announcement-attachments` é criado sob demanda pelo backend; professores acessam os arquivos somente pela rota autenticada e autorizada da aplicação.

## Variáveis de produção

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | Conexão Supavisor Session para execução Node local/alternativa. No Worker, o Hyperdrive fornece a conexão. |
| `AUTH_PROVIDER` | Deve ser `supabase` na web. |
| `SUPABASE_URL` / `VITE_SUPABASE_URL` | URL pública do projeto Supabase. |
| `SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PUBLISHABLE_KEY` | Chave pública; nunca use `service_role` ou chave secreta no frontend. |
| `SUPABASE_SECRET_KEY` | Chave secreta disponível somente no backend para Auth administrativo e Storage privado. |
| `SUPABASE_ANNOUNCEMENT_BUCKET` | Bucket privado de anexos; padrão `announcement-attachments`. |
| `BOOTSTRAP_ADMIN_EMAIL` | E-mail confirmado no Supabase Auth que receberá o papel Gestor. |
| `RESEND_API_KEY` | Credencial para recuperação de senha e convites. |
| `EMAIL_FROM` | Remetente validado, como `Projeto Aprendiz <acesso@dominio.com>`. |
| `APP_URL` | URL pública usada nos links e na validação de origem; em produção, `https://aprendizicm.com.br`. |
| `APP_TIMEZONE` | Fuso usado no agendamento; padrão `America/Sao_Paulo`. |
| `DATABASE_SSL` | `true` para a conexão segura com o Supabase. |

## Privacidade e observabilidade

A política aplicada de exclusão, anonimização e retenção está em [docs/LGPD.md](docs/LGPD.md). A auditoria permanece interna e não é exibida ao gestor. Erros técnicos são escritos como JSON estruturado, com identificador de requisição e sem cookies, tokens, senhas ou corpo da solicitação, para consulta nos logs do Worker.

## Validação

```bash
pnpm check
```

O comando valida o backend, executa os testes do banco e compila o frontend. O mesmo processo roda em cada pull request pelo GitHub Actions.

O conjunto automatizado cobre autenticação e rate limiting, modelo acadêmico, isolamento da frequência por função, dashboard administrativo, suporte, informativos, LGPD, logs estruturados e geração segura de CSV.
