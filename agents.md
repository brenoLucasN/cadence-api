# cadence_api — Regras para Agentes

Complementa `../agents.md` (regras globais valem sempre). Ordem de autoridade:
instrução do Breno > agents.md global > este arquivo.

## Regras deste repo

1. **Toda rota autenticada usa o guard** de `src/plugins/auth.ts` — nunca ler o header
   `authorization` na mão.
2. **Toda query filtra por `userId`** derivado do guard. Patch/delete checam posse antes
   e retornam 404 (não 403) para recurso de outro usuário — não vazar existência.
3. **Validação TypeBox em tudo**: `body`, `query` e `params` tipados com `t.Object`.
   Erros sempre `{ error: string }` com status 400/401/404.
4. **Schema muda só via Drizzle**: editar `src/db/schema.ts` → `bun run db:generate`.
   Nunca editar SQL em `drizzle/` ou o banco direto.
5. **Lógica de negócio testável vira função exportada** (ex.: `streak()` em
   `routes/habits.ts`) — o resto pode viver inline na rota enquanto for pequeno.
6. **Teste novo para rota nova**: caminho feliz + caso 401/404 em `tests/api.test.ts`.
7. `bun test` limpo antes de finalizar qualquer mudança.

## Anti-padrões

- Criar camada service/repository aqui — as rotas falam com o Drizzle direto; o app é
  pequeno e o guard + helpers de posse já isolam o que importa.
- Resposta com formato diferente por rota — listas retornam array puro, mutações retornam
  o recurso ou `{ ok: true }`.
