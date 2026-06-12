# cadence_api — Produto

Papel deste repo: API REST que sustenta os 3 pilares do Cadence (hábitos, agenda, treinos).
Visão completa de produto: `../product.md`.

## O que esta API entrega

- **Auth**: registro/login com e-mail e senha, JWT stateless, `/auth/me`.
- **Hábitos**: CRUD + check diário (upsert por dia) + streak calculado no servidor
  respeitando os dias agendados (`days`).
- **Agenda**: CRUD de eventos com filtro por período (`from`/`to`).
- **Treinos**: CRUD de treinos com exercícios aninhados (substituição completa no PATCH)
  + registro de sessões executadas.
- **Stats**: resumo do dia/semana (`todayDone/Total`, `weekPercent`, `bestStreak`,
  `sessionsThisWeek`) — alimenta a tela Hoje.

## Regras de negócio que moram aqui (não no app)

- Streak: dias agendados consecutivos com check, andando para trás a partir da data;
  o dia atual sem check não quebra a sequência (o dia não acabou).
- "Feito" = `count >= goal` do hábito.
- `checks.date` e `habits.reminder` são calendário local do usuário (string sem TZ);
  todo o resto é ISO 8601 UTC.

## Fora do escopo v1

Notificações push, recorrência de eventos, login social, biblioteca de exercícios.
