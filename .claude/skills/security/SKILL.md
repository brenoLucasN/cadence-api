---
name: security
description: Segurança no backend do Cadence — autenticação, autorização por posse, validação, segredos, hashing e superfícies de ataque comuns (IDOR, injection, enumeração). Use ao criar/alterar qualquer rota, auth ou query.
---

# Security — cadence_api

Modelo de ameaça do v1: API pública na internet, multiusuário, dados pessoais de rotina.
O ataque mais provável não é exótico — é IDOR (acessar recurso de outro usuário) e
validação frouxa.

## Autorização (a regra nº 1 do repo)

- Toda rota não-`/auth` passa pelo guard (`plugins/auth.ts`) e usa o `userId` derivado
  do token. O cliente NUNCA envia `userId` — se um payload tiver, ignore.
- Toda query filtra por `userId`; patch/delete checam posse ANTES (`own<Recurso>()`).
- Recurso de outro usuário → **404, não 403** (não confirmar existência).
- Recurso aninhado herda a checagem do pai: exercício via workout do usuário,
  check via habit do usuário. Nunca buscar filho direto por id sem validar a cadeia.

## Autenticação

- Hash de senha: `Bun.password` (argon2id) — NUNCA sha/md5/bcrypt manual ou comparação
  de string. Verify com `Bun.password.verify` (constant-time).
- Login falho: mesma resposta e mesmo status para "e-mail não existe" e "senha errada"
  (`401 Invalid credentials`) — não permitir enumeração de contas.
- JWT: `JWT_SECRET` via env em produção (o default é só dev; deploy sem env deve falhar
  alto, não cair no default — se for fazer deploy, trocar o `??` por throw).
- Payload do token mínimo (`sub` apenas). Nada de email/role/dados pessoais dentro.

## Validação de entrada

- TypeBox em TODO `body`/`query`/`params` — inclusive formatos (`pattern` para datas
  'YYYY-MM-DD' e 'HH:mm', `format: 'email'`, `minLength: 8` em senha, `t.Integer()`
  em ids). Campo sem validação = campo que aceita lixo.
- Limites: strings de usuário com `maxLength` razoável em campos novos (nome, notas) —
  payload de 10MB num campo `notes` é DoS barato.
- Nunca interpolar input em SQL — Drizzle parametriza tudo; raw SQL com template de
  input é proibido.

## Segredos e dados

- `.env`, `*.db` no `.gitignore` (já estão) — conferir antes de commit que nenhum
  segredo/dump entrou no repo.
- Logs: nunca logar senha, hash ou token. Erro 500 retorna `{ error }` genérico —
  stack trace não vaza na resposta.
- Resposta de user SEMPRE via `publicUser()` (id, email, name) — o campo `password`
  jamais sai numa resposta, inclusive em joins futuros.

## Endurecimento quando for a produção (não fazer antes)

Rate limit no `/auth/*` (força bruta), CORS restrito ao domínio do app (hoje aberto
para dev), HTTPS no proxy, backup do SQLite. Registrar a decisão em `context.md` quando
acontecer.

## Checklist por rota nova

- [ ] Guard aplicado e query filtrada por `userId`
- [ ] Posse com 404 em patch/delete (e na cadeia de recursos aninhados)
- [ ] TypeBox completo com formatos e limites
- [ ] Nenhum dado sensível em resposta ou log
- [ ] Teste cobrindo: sem token (401) e recurso de outro usuário (404)
