# cadence_api — Arquitetura

Stack: Bun 1.3 + ElysiaJS + Drizzle ORM sobre SQLite (`bun:sqlite`). Auth JWT
(`@elysiajs/jwt`) com hash argon2 (`Bun.password`). Porta 3333.

## Estrutura

```
src/index.ts        # composição do app — exporta `app` p/ testes; listen só em import.meta.main
src/db/schema.ts    # fonte da verdade do banco (snake_case no DB, camelCase no JSON)
src/db/index.ts     # client + migrate() no boot (DB_PATH define o arquivo; testes usam :memory:)
src/plugins/auth.ts # guard JWT — deriva `userId`, lança 401 sem token válido
src/routes/         # 1 arquivo por recurso: auth, habits, events, workouts, stats
tests/api.test.ts   # roda via app.handle(), sem subir servidor
drizzle/            # migrations geradas — NUNCA editar na mão
```

## Modelo de dados

```
users      id, email!, password, name, created_at
habits     id, user_id, name, icon, color, days('1111111' dom→sáb), goal, reminder, archived, created_at
checks     id, habit_id, date('YYYY-MM-DD'), count        unique(habit_id, date)
events     id, user_id, title, notes, starts_at, ends_at, color
workouts   id, user_id, name, color, notes, position
exercises  id, workout_id, name, sets, reps, weight, rest_sec, position
sessions   id, workout_id, user_id, started_at, finished_at, notes
```

Contrato completo das rotas: `../context.md` (seção API).

## Decisões

- SQLite por simplicidade (projeto pessoal, zero infra); schema Drizzle portável p/ Postgres.
- Deletes em cascata feitos explicitamente nas rotas (checks/exercises/sessions antes do pai).
- Sem soft delete, sem filas, sem cache — adicionar apenas quando doer.
- Env vars: `PORT` (3333), `DB_PATH` (cadence.db), `JWT_SECRET` (default só de dev).
