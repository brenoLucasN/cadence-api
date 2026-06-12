# cadence_api — Workflows

## Rodar e testar

```bash
bun dev                 # :3333, watch, migra no boot
bun test                # endpoints com DB :memory:
rm -f cadence.db        # reset do banco de dev (recria no próximo boot)
```

## Adicionar um endpoint

1. Schema mudou? `src/db/schema.ts` → `bun run db:generate` (migração roda no próximo boot).
2. Rota em `src/routes/<recurso>.ts`: `.use(authPlugin)`, validação TypeBox, filtro por
   `userId`, checagem de posse com helper `own<Recurso>()` em patch/delete.
3. Arquivo novo? Registrar com `.use()` em `src/index.ts`.
4. Teste em `tests/api.test.ts`: caminho feliz + 401 (e 404 de posse se aplicável).

## Adicionar uma tabela

1. Definir em `src/db/schema.ts` usando os helpers `id()` e `createdAt()`; nome plural
   curto, snake_case nas colunas.
2. `bun run db:generate` e conferir o SQL gerado em `drizzle/`.
3. Se tiver dono, incluir `user_id` com FK e aplicar a regra de posse nas rotas.
4. Deletes: apagar filhos explicitamente antes do pai (padrão das rotas existentes).

## Debug rápido

```bash
# usuário + token de teste
curl -s localhost:3333/auth/register -H 'content-type: application/json' \
  -d '{"email":"a@a.com","password":"12345678","name":"Breno"}'

# inspecionar o banco de dev
bunx drizzle-kit studio          # UI web
sqlite3 cadence.db '.tables'     # CLI
```
