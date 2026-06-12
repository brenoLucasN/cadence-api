---
name: new-endpoint
description: Receita para criar/alterar endpoint no cadence_api seguindo os padrões do repo (guard JWT, posse com 404, validação TypeBox, teste). Use para qualquer rota nova ou mudança de contrato.
---

# New Endpoint — receita

Modelo de referência: `src/routes/habits.ts` (o mais completo: guard, posse, upsert,
lógica exportada para teste).

## 1. Contrato primeiro

Definir método/path/body/resposta e registrar na seção API de `../context.md` (raiz).
Listas retornam array puro; mutações retornam o recurso ou `{ ok: true }`; erros são
`{ error: string }` com 400/401/404.

## 2. Schema (se mudar)

`src/db/schema.ts` com helpers `id()`/`createdAt()` → `bun run db:generate` → conferir
o SQL em `drizzle/` (nunca editá-lo). Tabela: plural curto; colunas snake_case.

## 3. Rota

- Arquivo do recurso em `src/routes/` (novo? registrar `.use()` em `src/index.ts`).
- `.use(authPlugin)` → handlers recebem `userId`. Nunca ler `authorization` na mão.
- Validação TypeBox em `body`/`query`/`params` — `t.Integer()` em params de id.
- Posse: helper `own<Recurso>(userId, id)` antes de patch/delete; ausente → 404
  (não 403 — não vazar existência).
- Delete: apagar filhos explicitamente antes do pai.
- Cuidado com `db.update().set({})` — Drizzle lança erro com objeto vazio; checar
  `Object.keys(body).length` em PATCH parcial.

## 4. Teste

Em `tests/api.test.ts`, via `app.handle()` (sem servidor): caminho feliz + 401 sem token
+ 404 de posse (registrar segundo usuário). `bun test` limpo antes de finalizar.
