# Projeto Aprendiz Aprimorado

Aplicação web com frontend React e backend Node.js para a gestão do Projeto Aprendiz. Gestores e professores usam o mesmo sistema, com rotas, menus e permissões próprias para cada perfil.

## Recursos

- Login com sessões persistentes em cookie `HttpOnly`, `Secure` em produção e proteção CSRF.
- Senhas protegidas com `scrypt`, limitação de tentativas e auditoria de ações sensíveis.
- Recuperação de senha e convites com tokens temporários, de uso único e armazenados somente como hash.
- E-mails reais via Resend em produção e caixa local em `/dev-mail` durante o desenvolvimento.
- Gestão de alunos, professores, cursos, turmas, matrículas, frequência, informativos, suporte e relatórios.
- SQLite com dados de demonstração no computador e PostgreSQL persistente na hospedagem.
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

## Hospedagem no Render

O arquivo `render.yaml` descreve um serviço web `starter` e um banco PostgreSQL `basic-256mb`, ambos pagos e na região da Virgínia. O painel do Render mostra os valores antes da confirmação:

1. Crie um **Blueprint** e conecte este repositório.
2. Informe `BOOTSTRAP_ADMIN_EMAIL` e uma `BOOTSTRAP_ADMIN_PASSWORD` forte para criar o primeiro Gestor.
3. Informe `RESEND_API_KEY` e `EMAIL_FROM` depois de validar o domínio remetente no Resend.
4. Aplique o Blueprint. O build, as migrações e o endpoint `/api/health` já estão configurados.
5. Depois do primeiro acesso, altere a senha inicial em Configurações e remova `BOOTSTRAP_ADMIN_PASSWORD` do ambiente.

O PostgreSQL do Blueprint não aceita conexões públicas (`ipAllowList: []`). A aplicação acessa o banco pela rede privada do Render. Para manutenção, use as ferramentas do provedor ou altere conscientemente a lista de IPs no painel.

## Variáveis de produção

| Variável | Finalidade |
|---|---|
| `DATABASE_URL` | Conexão PostgreSQL preenchida automaticamente pelo Blueprint. |
| `BOOTSTRAP_ADMIN_EMAIL` | E-mail da primeira conta Gestor em banco vazio. |
| `BOOTSTRAP_ADMIN_PASSWORD` | Senha inicial forte; remova-a após o primeiro acesso. |
| `RESEND_API_KEY` | Credencial para recuperação de senha e convites. |
| `EMAIL_FROM` | Remetente validado, como `Projeto Aprendiz <acesso@dominio.com>`. |
| `APP_URL` | Opcional; URL pública usada nos links. No Render ela é detectada automaticamente. |
| `DATABASE_SSL` | `false` para a conexão privada do Render; ajuste em outro provedor. |

## Validação

```bash
pnpm check
```

O comando valida o backend, executa os testes do banco e compila o frontend. O mesmo processo roda em cada pull request pelo GitHub Actions.
