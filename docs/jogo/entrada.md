# Entrada do jogador

O jogador pede uma sala e o servidor do jogo decide, no `onAuth` do Colyseus, se ele senta. Quem decide é o jogo; a API só informa quem é o jogador, o saldo e a partida aberta da conta. Quem dispara é o app, com `client.joinOrCreate("pontinho", { bots, table? })` na partida online e `{ bots: true, seats, table? }` no treino, e o token do Supabase em `client.auth.token`.

Código: `apps/game/src/rooms/pontinho/playerAuth.ts` (`createPlayerAuthenticator`) e `PontinhoRoom.onJoin`.

## Chamada

`POST /internal/players/entry` com `{ accessToken, table? }`.

- `table` só vai na partida online. No treino com robôs o jogo omite a mesa e a API não confere saldo.
- Uma tentativa só, com 5 s de limite. Novas tentativas existem apenas para rodada, eliminação e encerramento. (Arquitetura.md, «Servidor do jogo»)
- Cada chamada leva um `x-request-id` novo, que a API põe no log dela.

Antes da chamada, sem falar com a API:

- sem token: recusa `invalidToken`;
- opções inválidas (`createOptionsSchema`): online com `bots: false` e `table` de 1 a 7; treino com `bots: true`, `seats` de 3 a 4 e `table` opcional. Qualquer outra combinação: recusa `invalidOptions`.

## Sucesso

A API responde 200 com `userId`, `nickname`, `photoUrl`, `profileComplete`, `balance`, `minimumBalance`, `canJoin` e `openMatchId`. Depois o jogo confere, nesta ordem:

1. perfil incompleto (`profileComplete` falso ou `nickname` nulo): recusa `profileIncomplete`;
2. `openMatchId` preenchido: ver "Partida aberta" abaixo;
3. `canJoin` falso: recusa `insufficientBalance`. Sem mesa pedida, `canJoin` vem nulo e o treino passa.

Se passou, o jogador entra com `{ id: userId, name: nickname, photoUrl ("" se não houver), table }`, e `table` é `0` no treino. No `onJoin`, a mesa do jogador precisa ser a da sala (senão `invalidOptions`), e o plugin de sessão única recusa a segunda cadeira da mesma conta (`alreadyInRoom`).

No treino com robôs a queda de conexão conta como saída: a sala não reserva a cadeira e o plugin solta a sessão na hora, então a mesma conta pode entrar em outra sala logo em seguida. Nas partidas com fichas a cadeira continua reservada depois da queda (ver "Partida aberta").

## Erros

### Respostas da API

| Código da API | Status | Quando | Tratamento no jogo | Efeito no jogador |
|---|---|---|---|---|
| `invalidToken` | 401 | Token do jogador ausente, malformado, expirado ou assinado por outra chave. | Recusa `invalidToken`. Sem log. | Não entra na sala. |
| `accountDisabled` | 403 | Conta desativada. | Recusa `accountDisabled`. Sem log. | Não entra na sala. |
| `serviceTokenInvalid` | 401 | O `SERVICE_TOKEN` do jogo não é o da API. Erro de configuração, não do jogador. | Recusa `apiUnavailable`. Log `error`. | Não entra. Recebe a mesma recusa de API fora do ar, porque não pode resolver. |
| `tooManyRequests` | 429 | Limite de requisições da API estourado. | Recusa `apiUnavailable`. Log `warn`. | Não entra; pode tentar de novo. |
| `internalError` | 500 | Falha inesperada na API. | Recusa `apiUnavailable`. Log `error`. | Não entra; pode tentar de novo. |
| `validationFailed` | 400 | A API recusou o corpo: contrato quebrado entre jogo e API. | Recusa `entryFailed`. Log `error`. | Não entra. |
| `badRequest` | 400 | O Fastify recusou a requisição antes da validação, por exemplo JSON inválido. Os outros 4xx do Fastify mantêm o status deles. | Recusa `entryFailed`. Log `error`. | Não entra. |
| `tableNotFound` | 422 | A API não conhece a mesa. O jogo filtra as mesas pela mesma lista (`CHIP_TABLES`), então só acontece com jogo e API em versões diferentes. | Recusa `entryFailed`. Log `error`. | Não entra. |

Qualquer outro código de 4xx, fora do contrato desta chamada, também vira `entryFailed` com log `error`. A regra do jogo é: `invalidToken` e `accountDisabled` repassam o próprio código; `serviceTokenInvalid`, 429 e 5xx viram `apiUnavailable`; todo o resto vira `entryFailed` (`refusalFor`).

### Falhas sem resposta útil da API

| Falha | Quando | Tratamento no jogo | Efeito no jogador |
|---|---|---|---|
| `networkError` | A conexão com a API falhou (status 0). | Recusa `apiUnavailable`. Log `warn`. | Não entra; pode tentar de novo. |
| `timeout` | A API não respondeu em 5 s (status 0). | Recusa `apiUnavailable`. Log `warn`. | Não entra; pode tentar de novo. |
| `invalidResponse` | A API respondeu erro, mas o corpo não é o envelope `{ statusCode, code, message }`, por exemplo um 502 de proxy. O status é mantido. | Status 500 ou mais: recusa `apiUnavailable`. Abaixo de 500: recusa `entryFailed`. Log `error` nos dois. | Não entra. |
| resposta 200 que não é JSON | O corpo de sucesso não pôde ser lido. | Recusa `entryFailed`. Log `error` com a `causa`. | Não entra. |

O log é `console.warn` ou `console.error` com `Falha ao consultar o jogador na API:` e `{ chamada, status, codigo, tentativa }`. Status 0 e 429 saem em `warn`; o resto, em `error`.

### Recusas que o cliente recebe

O jogo recusa com `ServerError(code, message)`. O app lê o `message`, que é a chave. O `code` é só o status HTTP da resposta do matchmaking e três recusas dividem o 403, por isso ele não identifica sozinho. Fonte: `JOIN_REFUSALS` em `packages/protocol/src/index.ts`.

| Recusa | Código | Origem |
|---|---|---|
| `invalidToken` | 401 | Sem token, ou a API respondeu `invalidToken`. |
| `accountDisabled` | 403 | A API respondeu `accountDisabled`. |
| `profileIncomplete` | 403 | Cadastro incompleto: falta nome completo, CPF, data de nascimento ou apelido. |
| `insufficientBalance` | 403 | `canJoin` falso na partida online. |
| `invalidOptions` | 400 | Opções inválidas, ou mesa do jogador diferente da mesa da sala. |
| `apiUnavailable` | 503 | API fora do ar, lenta, com segredo errado ou partida presa que não fechou. |
| `entryFailed` | 500 | Qualquer outra falha na consulta à API. |
| `openMatch` | 409 | Conta com partida aberta. O `message` é `openMatch` ou `openMatch:<chave da cadeira>`. |
| `alreadyInRoom` | 4400 | A conta já está sentada, nesta sala ou em outra. Sai na entrada na sala, pelo plugin de sessão única, não no `onAuth`. |

## Partida aberta

Quando a API devolve `openMatchId`, o jogo decide por conta própria, nesta ordem:

1. A conta tem cadeira guardada nesta partida: recusa `openMatch:<chave da cadeira>`. O app usa a chave para voltar à sala, de qualquer aparelho, e a volta não passa pelo saldo mínimo.
2. A partida ainda tem sala neste servidor, ou está sendo aberta para o jogador: recusa `openMatch`, sem chave.
3. Nenhuma sala segura a partida (ficou presa, por exemplo depois de uma queda do servidor): o jogo chama `POST /internal/matches/:matchId/finish` com `{ winnerId: null, awardWinBonus: false }`, até 3 tentativas, e deixa a conta entrar. Se não conseguir, registra log `error` (`Falha ao encerrar a partida presa`) e recusa `apiUnavailable`.

A recusa por partida aberta vale também para o treino com robôs.

## Conferência do segredo ao subir

Ao subir, o jogo chama `GET /internal/ping` (`verifyApiAtBoot`). Se a API responder `serviceTokenInvalid`, registra log `error` e encerra o processo com código 1, para o deploy falhar. Qualquer outra falha (rede, timeout, 5xx) só gera log `warn` e o jogo continua.

## Regra

- Saldo mínimo é só requisito de entrada, nada é descontado, e só vale na partida online. (Regras.md, «Mesas e saldo mínimo»)
- Treino com robôs não movimenta fichas. (Regras.md, «Tipos de partida»)
- Enquanto a partida do jogador não acabar, ele não entra em outra, nem no treino. Quem foi eliminado fica livre. Quem volta à partida não precisa do saldo mínimo da mesa. (Regras.md, «Quem cai ou sai»)
- Partida que cai por falha nossa acaba sem vencedor. É o que se aplica à partida presa fechada na entrada. (Regras.md, «Fim da partida»)
- Uma cadeira por conta. (Arquitetura.md, «Servidor do jogo»)
- Para sentar, o cadastro precisa estar completo: nome completo, CPF, data de nascimento e apelido. Contas sem CPF vão para o cadastro. (Plano.md, fatia 2, «Decisões do Lucas (04/11/2026)»; Regras.md, «Tipos de partida»)

Regras.md, Plano.md e Arquitetura.md ficam no Obsidian, em `dotwize/`, fora do repositório.

## Testes

- `apps/game/test/login.test.ts`: perfil, saldo, treino, opções inválidas, `apiUnavailable`, `accountDisabled`, a tabela de códigos da API com nível de log (`serviceTokenInvalid`, `networkError`, `timeout`, `internalError`, `tooManyRequests`, `validationFailed`, `tableNotFound`), mesa diferente da sala e `alreadyInRoom`.
- `apps/game/test/absence.test.ts`: "counts a dropped connection in a practice match as leaving: no seat is kept and the same account can enter another room at once" e "still keeps the seat of a dropped player in a match with chips".
- `apps/game/test/openMatch.test.ts`: partida aberta com chave, de outro aparelho, no treino, sem chave, partida presa fechada e partida presa que não fecha.
- `apps/game/test/httpGameApi.test.ts`: segredo de serviço no cabeçalho, `x-request-id`, leitura do código, rede, timeout, `invalidResponse`, e "does not retry opening a match nor asking about a player".
- `apps/game/test/verifyApiAtBoot.test.ts`: segredo recusado derruba o processo; rede, timeout e 5xx só avisam.
- `apps/api/src/modules/internal/internal.routes.spec.ts`, grupos "service secret", "ping" e "player entry": segredo errado, token inválido, mesa inexistente, saldo e partida aberta.
- Sem teste: a resposta 200 que não é JSON e o `badRequest` na entrada.
