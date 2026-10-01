# Projeto Aprendiz

Plataforma de integração entre alunos e professores do Projeto Aprendiz do Maanaim de Salvador. Reúne turmas, materiais, comunicação e acompanhamento acadêmico em um web app responsivo e instalável.

Esta é uma iniciativa independente. A plataforma não constitui canal oficial nem representa institucionalmente a Igreja Cristã Maranata. O nome técnico do repositório é `projeto-aprendiz-icm`.

**Aplicação:** [aprendizicm.com.br](https://aprendizicm.com.br) · **Política:** [privacidade](https://aprendizicm.com.br/politica-de-privacidade)

## Perfis e funcionalidades

| Perfil | Responsabilidades |
| --- | --- |
| Gestor | Cadastrar e convidar professores e alunos, gerenciar matrículas, consultar e excluir turmas, publicar informativos imediatos ou agendados e atender chamados. |
| Professor | Ofertar cursos, escolher local ou EAD e agenda, configurar suas turmas, participar e moderar o mural, registrar frequência e emitir relatórios. |
| Aluno | Acessar os cursos de suas matrículas, materiais, mural, informativos e a própria frequência, além de gerenciar seus dados e preferências. |

O gestor não acessa o mural nem edita a oferta do professor. Cada curso do aluno mantém seus próprios avisos e registros. Notificações do mural são agrupadas por turma e entregues por Web Push, sem um e-mail por interação.

## Arquitetura

O frontend React e a API são servidos na mesma origem por um Cloudflare Worker. O backend controla autenticação, autorização e acesso a arquivos. Supabase fornece Auth, PostgreSQL e Storage privado; Hyperdrive conecta o Worker ao banco. Um Durable Object mantém os limites de tentativas de autenticação.

No desenvolvimento, a mesma API pode executar em Node.js com SQLite e autenticação local. O navegador usa a sessão da aplicação em cookie; não recebe tokens de sessão ou segredos do Supabase.

```text
src/                  Interface React, páginas, componentes e cliente HTTP
backend/              API, autorização, serviços e testes
  database/           Regras SQL compartilhadas entre Node e Worker
  migrations/         Evolução do PostgreSQL, em ordem de nome de arquivo
  routes/             Endpoints separados por domínio
  test-support/       Servidor e banco isolados para testes de integração
shared/               Validações e regras puras usadas nas duas camadas
cloudflare/           Runtime, build e operação do Worker
public/               Assets com URL estável e service worker
scripts/              Verificações e ferramentas de manutenção
docs/                 Arquitetura, operação, decisões e histórico de releases
```

Os limites entre camadas estão em [Arquitetura](docs/ARCHITECTURE.md). O estado atual e as pendências ficam em [PROJECT_STATUS.md](PROJECT_STATUS.md).

## Executar localmente

Requisitos: Node.js na versão de [.node-version](.node-version) (intervalo suportado: 22.12 a 24) e pnpm 11.19.0.

```bash
git clone https://github.com/AlexCode-Br/projeto-aprendiz-icm.git
cd projeto-aprendiz-icm
pnpm install --frozen-lockfile
```

Copie `.env.example` para `.env`. O exemplo usa `AUTH_PROVIDER=local` e dados demonstrativos, sem conectar à produção. `pnpm start` e `pnpm dev:backend` carregam esse arquivo automaticamente; variáveis já definidas no ambiente têm precedência.

```bash
pnpm build
pnpm start
```

Acesse `http://127.0.0.1:4180`. O banco local fica em `backend/data/` e os e-mails de desenvolvimento em `/dev-mail`.

| Perfil local | E-mail | Senha de demonstração |
| --- | --- | --- |
| Gestor | `gestor@projetoaprendiz.local` | `Gestor@2026!` |
| Professor | `professor@projetoaprendiz.local` | `Professor@2026!` |

Essas contas são exclusivas do desenvolvimento. Para testar o código por e-mail localmente, defina `REQUIRE_MANAGER_MFA=true` e consulte `/dev-mail`. Contas de aluno podem ser criadas pelo fluxo de convite do gestor.

Para desenvolver a interface com atualização automática, use `pnpm dev:backend` e `pnpm dev` em terminais separados. Abra `http://127.0.0.1:5173`; o Vite encaminha `/api`, `/dev-mail` e os endpoints históricos `/alunos`, `/cursos`, `/professores` e `/frequencia` ao backend em `127.0.0.1:4180`. Nesse modo, ajuste `APP_URL=http://127.0.0.1:5173` no `.env` para os links enviados por e-mail e a validação de origem.

## Comandos de qualidade

| Comando | Verificação |
| --- | --- |
| `pnpm check` | Higiene do repositório, lint, sintaxe, testes e build React. |
| `pnpm test` | Testes unitários e de integração, com bases locais isoladas. |
| `pnpm test:postgres` | Migrações completas e regressão de banco legado; exige `TEST_DATABASE_URL` de teste. |
| `pnpm cloudflare:build` | Build da interface e empacotamento do Worker sem publicação. |
| `pnpm audit` | Vulnerabilidades conhecidas nas dependências instaladas. |
| `pnpm test:mass` | Simulação isolada de múltiplos professores, alunos e interações. |

O CI executa as validações, a auditoria de dependências, as migrações em PostgreSQL temporário e o build seco do Worker. Nunca aponte testes para um banco real de alunos.

## Configuração e banco

Use [.env.example](.env.example) para desenvolvimento. Para produção, as configurações públicas ficam em [wrangler.jsonc](wrangler.jsonc), e os segredos são mantidos no Cloudflare e no ambiente de publicação do GitHub.

| Configuração | Uso |
| --- | --- |
| `APP_URL`, `APP_TIMEZONE` | Origem pública, links de acesso e calendário da aplicação. |
| `AUTH_PROVIDER=supabase`, `REQUIRE_MANAGER_MFA=true` | Autenticação e segunda etapa obrigatória do gestor em produção. |
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Auth e Storage usados exclusivamente pelo backend. |
| `DATABASE_URL`, `DATABASE_SSL` | Conexão PostgreSQL para migrations; o Worker usa o binding Hyperdrive. |
| `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` | Desafio após cinco credenciais inválidas, validado pelo servidor. |
| `RESEND_API_KEY`, `EMAIL_FROM` | Entrega de convites, recuperação e códigos de verificação. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` | Identidade estável e assinatura de Web Push. |

As tabelas vivem no schema privado `projeto_aprendiz`, com RLS e acesso público revogado. O bucket de anexos é privado; sua entrega exige sessão e vínculo autorizado. Preserve toda a sequência de migrations, inclusive os dois arquivos históricos com prefixo `016`, pois o controle usa o nome completo.

```bash
pnpm db:migrate
```

Esse comando exige `DATABASE_URL`. Em produção, aplique migrations antes do código que depende delas. O Worker não executa alterações de schema durante requisições.

## Publicação e recuperação

O workflow manual [Deploy production](.github/workflows/deploy-production.yml) publica a branch `main` após validação, migração e liberação do ambiente `production`. Consulte [Operação no Cloudflare](cloudflare/OPERATIONS.md) para configurar os segredos e as proteções do GitHub antes da primeira execução.

O serviço existente ainda se chama `aprendiz-staging`, embora atenda à produção. Esse nome preserva os segredos, bindings e o Durable Object atuais; renomear o repositório não renomeia o Worker.

Deploy manual, quando autorizado:

```bash
pnpm check
pnpm cloudflare:build
pnpm cloudflare:deploy
```

Após publicar, confirme `/login`, `/api/health`, a proteção de `/api/auth/me` e os fluxos autenticados. Um rollback do Worker não desfaz migrations. Os procedimentos de backup, restauração e incidente ficam em [Recuperação de dados](docs/DISASTER_RECOVERY.md).

## Segurança, manutenção e documentação

Sessões usam cookies protegidos e validação CSRF. Gestores concluem o acesso com código temporário por e-mail. Recuperação e convites usam tokens únicos; uploads são validados no servidor e conteúdo rico é sanitizado. Logs técnicos omitem senhas, cookies, tokens e corpos de requisição.

- [Índice da documentação](docs/README.md)
- [Contribuição e revisão](CONTRIBUTING.md)
- [Relatar vulnerabilidade](SECURITY.md)
- [Privacidade e retenção](docs/LGPD.md)
- [Decisões de arquitetura](docs/decisions/README.md)

Responsável pelo projeto: Alexandre Souza Silva. O código é privado e não possui licença de redistribuição. Dependências de terceiros mantêm suas próprias licenças.
