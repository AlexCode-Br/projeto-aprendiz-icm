# Arquitetura do Projeto Aprendiz

## Visão geral

O sistema é uma aplicação web única, responsiva e orientada a dois perfis: gestor e professor. O frontend React e a API executam no mesmo Cloudflare Worker. Autenticação, PostgreSQL e armazenamento privado permanecem no Supabase.

```text
Navegador
  └─ Cloudflare Worker
       ├─ assets do frontend React
       ├─ API HTTP e regras de autorização
       ├─ Durable Object para limite de autenticação
       └─ Hyperdrive → PostgreSQL do Supabase
                         ├─ Auth
                         └─ Storage privado
```

## Estrutura canônica

| Caminho | Responsabilidade |
|---|---|
| `src/pages/` | Composição das telas por perfil e rota. |
| `src/components/` | Componentes reutilizáveis, modais, formulários e apresentação. |
| `src/contexts/` | Sessão do usuário e notificações da interface. |
| `src/services/` | Clientes HTTP e integração pública com Supabase Auth. |
| `src/utils/` | Exportações e transformações exclusivas do navegador. |
| `backend/routes/` | Endpoints HTTP separados por domínio. |
| `backend/*.mjs` | Inicialização, banco, segurança, e-mail, storage e infraestrutura da API. |
| `backend/migrations/` | Evolução idempotente do schema privado `projeto_aprendiz`. |
| `shared/` | Validações e regras puras usadas pelo frontend e backend. |
| `cloudflare/` | Adaptadores e operação específicos do runtime Cloudflare. |
| `public/` | Assets que precisam manter URL pública estável, inclusive em e-mails. |
| `docs/` | Arquitetura e políticas atuais; o Git guarda o histórico. |

## Limites de responsabilidade

- Páginas coordenam carregamento e estado, mas regras de negócio e validações reutilizáveis ficam em `shared/` ou no backend.
- Componentes não acessam o banco. O navegador usa `src/services/api.js` e a API valida novamente autenticação, autorização e dados recebidos.
- O browser nunca recebe chaves privadas nem acessa o schema do PostgreSQL diretamente.
- Arquivos em `public/` são reservados a URLs estáveis; assets importados pelo código ficam em `src/assets/` e recebem hash do Vite.
- Migrações antigas não são removidas: bancos novos e existentes dependem da sequência completa.
- Testes ficam próximos ao backend porque exercitam os mesmos módulos e contratos sem uma segunda estrutura paralela.

## Compatibilidade de nomes

A interface usa o conceito de **Turmas**. Os arquivos ativos seguem esse nome (`pages/gestor/Turmas.jsx`, `components/TurmaModal.jsx` e `components/TurmaCard.jsx`). A URL `/gestor/cursos` e os endpoints `/cursos` permanecem temporariamente por compatibilidade com favoritos, clientes existentes e contratos do backend.

## Arquivos gerados

Os caminhos abaixo são regeneráveis e não pertencem ao código-fonte:

- `node_modules/`
- `dist/`
- `cloudflare/build/`
- `.wrangler/`
- `backend/data/`
- `.env` e `.dev.vars`
- relatórios, bancos e capturas produzidos em testes locais

## Qualidade

`pnpm check` verifica a sintaxe do backend, executa a suíte automatizada e compila o frontend. `pnpm lint` cobre o repositório com ESLint. Mudanças de banco devem incluir migração e regressão; mudanças responsivas devem ser conferidas no mobile e no desktop.

