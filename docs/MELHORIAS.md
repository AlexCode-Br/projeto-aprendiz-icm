# Plano de Melhorias — Projeto Aprendiz

Este documento é o guia de implementação das melhorias identificadas na auditoria do projeto. Serve como especificação para as próximas sessões de desenvolvimento (agente de código ou desenvolvimento manual). As melhorias visuais dos dashboards (ícones coerentes, skeleton loading, cartões alinhados à identidade vermelho/branco/cinza) já foram aplicadas.

## Identidade visual (regra permanente)

- Paleta: **vermelho** (`--color-primary: #b71c1c` e variações), **branco** (superfícies) e **cinza** (textos, bordas, fundos). Verde/amarelo apenas para semântica (sucesso/alerta), nunca como cor decorativa.
- Ícones sempre em estilo outline com `strokeWidth` 1.8 e temática coerente com educação/música (evitar ícones genéricos sem relação com a função).
- Estados de carregamento usam a classe `.skeleton` (definida em `src/index.css`), nunca texto "Carregando..." ou traços "—".
- Toda lista/tabela deve ter estado vazio desenhado com orientação de próximo passo (ex.: "Nenhuma turma ainda — crie a primeira").

## P0 — Urgente

### 1. Rate limiting no login e recuperação de senha
- **Onde:** `backend/server.mjs`, rotas `/api/auth/login`, `/api/auth/forgot-password`, `/api/invitations/accept`, `/api/auth/reset-password`.
- **Como:** limitador em memória (o serviço roda em instância única no Render): `Map` chaveada por IP e por e-mail normalizado, janela deslizante (ex.: 5 tentativas por 15 min por e-mail, 20 por IP), resposta `429` com mensagem genérica. Registrar tentativas bloqueadas no `audit_log`.
- **Cuidado:** não revelar se o e-mail existe (mensagens idênticas para conta existente/inexistente).

## Estrutural

### 2. Ano letivo (período)
- **Contexto de negócio importante:** o Projeto Aprendiz **começa em uma data de um ano e termina em outra data do ano seguinte** (o período letivo cruza a virada do ano civil). O modelo NÃO pode usar uma coluna simples de "ano".
- **Modelo:** nova tabela `school_years` com `id`, `label` (ex.: "2026/2027"), `start_date`, `end_date`, `active`. Adicionar `school_year_id` em `classes` (e, por consequência, matrículas/frequência ficam vinculadas ao período pela turma).
- **Regras:** apenas um período ativo por vez; ao criar turmas, o período ativo é o padrão; relatórios e dashboard sempre filtram pelo período selecionado (padrão: o ativo); períodos encerrados tornam-se histórico imutável e comparável.
- **Migração:** criar `009_school_years.sql`; para dados existentes, criar o período vigente com base nas datas reais informadas pelo gestor e vincular as turmas ativas a ele.

### 3. Modularizar `backend/server.mjs` (~2.300 linhas)
- Extrair para módulos mantendo o mesmo runtime (`node:http`, sem framework): `auth.mjs`, `routes/alunos.mjs`, `routes/turmas.mjs`, `routes/frequencia.mjs`, `routes/informativos.mjs`, `routes/suporte.mjs`, `routes/relatorios.mjs`, `routes/dashboard.mjs`, `email.mjs`, `storage.mjs`, `security.mjs` (headers, CSRF, rate limit, sessões).
- Sem mudança de comportamento; validar com `pnpm check` a cada extração.

### 4. Modelo de dados
- `students.email` → tornar **opcional** (remover NOT NULL/UNIQUE obrigatório; unicidade apenas quando preenchido) e adicionar campos de responsável (`guardian_name`, `guardian_phone`) para alunos menores.
- `students.church` → normalizar em tabela `churches` (id, name, active) com FK `church_id`; migrar valores distintos existentes.
- `classes` → adicionar `capacity` (INTEGER, opcional) e **remover/ajustar** a `UNIQUE(course_id, professor_id, location_id)` que impede o mesmo professor de ter duas turmas do mesmo curso no mesmo local (incluir `label` ou horário na unicidade).
- `dropout_events.reason` → adicionar `reason_category` com CHECK (ex.: 'mudanca', 'desinteresse', 'horario', 'saude', 'familia', 'outro'), mantendo texto livre como complemento.
- `enrollments` → adicionar `completed_at` e `transferred_to_class_id` (transferência entre turmas sem perder continuidade).

## Inteligência e automações (sem IA — regras de negócio)

### 5. Alunos em risco
- Regra: 2+ ausências consecutivas sem justificativa → aluno entra na lista "Em risco".
- Backend: query sobre `attendance_records`/`attendance_sessions` por matrícula ativa; expor em `/api/dashboard/gestor` e nova rota `/api/alunos/risco`.
- UX: card no dashboard do gestor com contagem + tabela com telefone clicável (link `tel:`/WhatsApp) e botão "Registrar contato" (nova tabela `student_contacts`: student_id, user_id, note, contacted_at, outcome).

### 6. Cobrança de chamada não registrada
- `classes.weekday` já existe: job diário (setTimeout/cron interno já que há `APP_TIMEZONE`) que detecta turmas cuja aula ocorreu sem `attendance_session` e notifica o professor (e-mail via Resend + badge no menu).

### 7. Dashboard de decisão (gestor)
- Substituir contadores estáticos por indicadores de movimento: novas matrículas (30 dias vs. anterior), evasões no período, frequência média por turma com tendência (janela de 4 semanas), chamadas pendentes, ocupação por turma (requer `capacity`).
- Manter "últimas inscrições" e a tabela de baixa frequência (ligada à fila de risco).

### 8. Resumo semanal por e-mail
- E-mail ao gestor (Resend já configurado): novas matrículas, alunos em risco, chamadas pendentes, tickets abertos.

## UX do professor (prioridade: chamada rápida)

### 9. Chamada otimizada
- Meta: registrar a chamada de 20 alunos em <60s no celular.
- Todos pré-marcados como "presente"; professor toca apenas nos ausentes/justificados; botão único "Salvar chamada"; feedback claro de sucesso.
- Badge de pendência: "Você não registrou a chamada de sábado" no dashboard e menu.

### 10. Exportação CSV
- Botão "Exportar CSV" em relatórios e tabelas principais (alunos, frequência, evasão).

## Segurança e LGPD

### 11. LGPD
- Rotina de exclusão/anonimização de dados pessoais de aluno (direito de eliminação): manter registros estatísticos anonimizados, apagar nome/e-mail/telefone.
- Registrar consentimento do responsável no cadastro de menores (campo + data).
- Documentar retenção de dados (por quanto tempo dados de ex-alunos são mantidos).

### 12. Observabilidade
- Log estruturado de erros no backend (JSON em stderr) para diagnóstico no Render; manter `audit_log` e criar visualização simples para o gestor (página em Configurações).

## Ordem sugerida de execução

1. Rate limiting (P0, pequeno)
2. Ano letivo (antes do próximo ciclo começar)
3. E-mail opcional + responsável no cadastro de aluno
4. Chamada otimizada + cobrança de chamada
5. Alunos em risco + registro de contato
6. Dashboard de decisão
7. Modularização do backend (pode ser incremental, em paralelo)
8. Normalização de igrejas, capacidade de turma, categorias de evasão
9. LGPD + observabilidade
10. Resumo semanal + exportações CSV
