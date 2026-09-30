# Continuidade e recuperação de dados

## Objetivos

- RPO: no máximo 24 horas de dados em uma falha catastrófica.
- RTO: restabelecer o serviço em até 4 horas após confirmar o incidente.
- Retenção: usar o histórico oferecido pelo plano do Supabase e uma cópia externa cifrada quando o plano não oferecer PITR suficiente.

## Controles obrigatórios

1. Ativar backups do banco no painel do Supabase e confirmar a retenção disponível no plano contratado.
2. Ativar MFA na conta administrativa do Supabase e limitar os membros do projeto ao menor privilégio necessário.
3. Exportações adicionais devem ser cifradas, armazenadas fora do repositório e nunca gravadas em `backend/data`, `tmp` ou outro caminho versionável.
4. Registrar data, responsável, origem e resultado de cada ensaio de restauração.

## Ensaio mensal de restauração

1. Criar um projeto ou banco isolado, sem integração com e-mail, push ou domínio de produção.
2. Restaurar o backup mais recente nesse ambiente.
3. Executar as migrações pendentes com `pnpm db:migrate`, apontando `DATABASE_URL` somente para o banco isolado.
4. Conferir `schema_migrations`, contagens de usuários, turmas, matrículas, frequência e anexos privados.
5. Executar `pnpm check` e os testes de autorização contra o ambiente isolado.
6. Destruir o ambiente de restauração após registrar o resultado, sem copiar dados pessoais para relatórios.

## Resposta a incidente

- Revogar chaves e sessões expostas; depois rotacionar credenciais do Supabase, Resend, VAPID e Cloudflare conforme o escopo.
- Preservar logs de auditoria e registrar uma linha do tempo sem senhas, tokens, cookies ou conteúdo pessoal.
- Restaurar primeiro o banco, aplicar migrações e somente então publicar o Worker compatível.
- Validar autenticação, autorização por perfil, Storage privado, e-mail e Web Push antes de reabrir o domínio.

A existência de um arquivo de backup só é considerada válida depois de um ensaio de restauração bem-sucedido.
