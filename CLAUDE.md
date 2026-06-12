# cadence_api

Backend REST do Cadence — Bun + ElysiaJS + Drizzle (SQLite). Contexto compartilhado do
projeto em `../` (comece por `../CLAUDE.md`).

## Arquivos de IA deste repo

| Doc | Quando |
|---|---|
| `product.md` | escopo e regras de negócio da API |
| `context.md` | arquitetura, modelo de dados, decisões |
| `agents.md` | regras de trabalho neste repo — **sempre** |
| `skills.md` | receitas: endpoint novo, tabela nova, debug |

## Skills invocáveis (`.claude/skills/`)

| Skill | Quando |
|---|---|
| `new-endpoint` | rota nova ou mudança de contrato |
| `db-change` | mudança de schema/migration (e recuperação quando der ruim) |

## Comandos

```bash
bun dev           # :3333, migra no boot (cria cadence.db)
bun test          # endpoints com DB :memory:
bun run db:generate  # após mudar src/db/schema.ts
```

## Estrutura

```
src/index.ts        # composição do app (export `app` p/ testes; listen só em import.meta.main)
src/db/             # schema.ts (fonte da verdade) + client com migrate no boot
src/plugins/auth.ts # guard JWT — deriva `userId`; toda rota autenticada usa ele
src/routes/         # auth, habits, events, workouts, stats — 1 arquivo por recurso
tests/api.test.ts   # roda via app.handle(), sem servidor
```

## Regras locais

- Toda query filtra por `userId` do guard; checagem de posse antes de patch/delete (404 se não for dono).
- Validação TypeBox em todo body/query/params. Erros: `{ error: string }` + status correto.
- `checks.date` e `habits.reminder` são calendário local do usuário (string, sem TZ);
  o resto é ISO 8601 UTC.
