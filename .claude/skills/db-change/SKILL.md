---
name: db-change
description: Fluxo seguro de mudança de schema no cadence_api (Drizzle + SQLite). Use ao adicionar/alterar tabela ou coluna, ou quando uma migration der problema.
---

# DB Change — fluxo

Fonte da verdade: `src/db/schema.ts`. O migrator roda no boot (`src/db/index.ts`),
então dev e testes aplicam as mesmas migrations.

## Mudança normal

1. Editar `src/db/schema.ts` (helpers `id()`/`createdAt()`; snake_case; FK com
   `.references()`; unique composto como em `checks`).
2. `bun run db:generate` — conferir o SQL gerado em `drizzle/` antes de seguir.
3. `bun dev` aplica no `cadence.db` local; `bun test` valida em `:memory:`.
4. Coluna nova exposta na API? Atualizar validação TypeBox da rota, o modelo Dart em
   `cadence_app/lib/core/models.dart` e o contrato em `../context.md` (raiz).

## Regras

- NUNCA editar SQL em `drizzle/` nem mexer no banco direto — sempre via schema + generate.
- Coluna nova em tabela existente: `NOT NULL` exige `.default(...)` (SQLite não aceita
  NOT NULL sem default em ALTER TABLE).
- Convenções de tempo: ISO 8601 UTC em texto, exceto calendário local do usuário
  (`checks.date` 'YYYY-MM-DD', `habits.reminder` 'HH:mm').

## Quando der ruim em dev

```bash
rm -f cadence.db && bun dev    # banco de dev é descartável — recria do zero
```

Migration errada ainda não commitada: apagar o par `.sql` + entrada no journal
(`drizzle/meta/_journal.json`) gerados, corrigir o schema e gerar de novo.
