# cadence_api — Arquitetura

Stack: Bun 1.3 + ElysiaJS + Drizzle ORM sobre Postgres. Auth com
Better Auth + Drizzle adapter, email/senha e sessão bearer para o app mobile.
Porta 3333.

## Estrutura

```
src/index.ts        # composição do app — exporta `app` p/ testes; listen só em import.meta.main
src/db/schema.ts    # fonte da verdade do banco (snake_case no DB, camelCase no JSON)
src/db/index.ts     # client Postgres + migrate() no boot; testes usam PGlite em memória
src/auth.ts         # instância Better Auth (Drizzle, bearer, email/senha)
src/plugins/auth.ts # guard de sessão Better Auth — deriva `userId`, lança 401
src/plugins/logging.ts # logs dev sem payload; erro público sanitizado
src/plugins/security.ts # headers, CORS allowlist helper, body limit e rate limit
src/routes/         # 1 arquivo por recurso: auth, habits, events, workouts, stats
tests/api.test.ts   # roda via app.handle(), sem subir servidor
drizzle/            # migrations geradas; 0001 ajusta defaults de colunas novas
```

## Modelo de dados

```
users      id, email!, password legado nullable, email_verified, name, image, created_at, updated_at
account    id, account_id, provider_id, user_id, password, tokens OAuth opcionais, created_at, updated_at
session    id, token!, user_id, expires_at, ip_address, user_agent, created_at, updated_at
verification id, identifier, value, expires_at, created_at, updated_at
habits     id, user_id, name, icon, color, days('1111111' dom→sáb), goal, reminder, archived, created_at
checks     id, habit_id, date('YYYY-MM-DD'), count        unique(habit_id, date)
events     id, user_id, title, notes, starts_at, ends_at, color
workouts   id, user_id, name, color, notes, position
exercises  id, workout_id, name, sets, reps, weight, rest_sec, position
sessions   id, workout_id, user_id, started_at, finished_at, notes
```

Contrato completo das rotas: `../context.md` (seção API).

## Decisões

- Postgres é o banco de produção; testes usam PGlite em memória para manter `bun test` local.
- Better Auth é dono de senha e sessão; `users.password` existe só como coluna legada nullable.
- O app continua usando `Authorization: Bearer <token>`; o plugin `bearer()` do Better Auth converte para sessão.
- Deletes em cascata feitos explicitamente nas rotas (checks/exercises/sessions antes do pai).
- Logs de desenvolvimento registram método, path, status e duração, sem body/cookies/tokens.
- Em produção, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL` e `CORS_ORIGINS` são obrigatórios; erros públicos não expõem stack, schema ou payload.
- CORS é allowlist por origem; requests sem `Origin` seguem permitidos para clientes mobile/server-to-server autenticados.
- Rate limit em memória protege uma instância; múltiplas réplicas exigem store compartilhado.
- Env vars: `PORT` (3333), `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `CORS_ORIGINS`, `MAX_BODY_BYTES`, `RATE_LIMIT_WINDOW_SECONDS`, `RATE_LIMIT_MAX`, `AUTH_RATE_LIMIT_MAX`.
