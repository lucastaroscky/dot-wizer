# Jogar online

Aberto pelo menu (Jogar online). A pessoa escolhe o modelo das cartas e vê as 7 mesas, cada uma com quem já está sentado (apelido e foto, ou a inicial) e "N de 4". Tocar numa mesa senta a pessoa nela.

Código: `apps/mobile/src/app/lobby.tsx` e `apps/mobile/src/features/lobby/` (`PreRoom.tsx`, `TableList.tsx` e `useTables.ts`); no jogo, `apps/game/src/rooms/pontinho/tableList.ts` e o `publishSeats` do `PontinhoRoom.ts`.

## Chamadas

| Ação | Chamada | Sucesso |
|---|---|---|
| Abrir e "Atualizar" | `GET /tables` no servidor do jogo, com o token em `Authorization: Bearer` | 200 com `{ tables: [{ table, players: [{ nickname, photoUrl }] }] }`, sempre com as 7 mesas. |
| Tocar numa mesa | `client.joinOrCreate("pontinho", { bots: false, table })`, como em [entrada](../jogo/entrada.md) | A pessoa senta e espera na sala; a partida começa com 4, ou com 3 depois de 10 s. |

- Sem tempo real: a lista só muda ao abrir a tela e ao tocar em "Atualizar". (Plano.md, fatia 2, «Cortes do Lucas (05/11/2026)»)
- O jogo confere o token com a mesma consulta da entrada (`POST /internal/players/entry`, sem mesa) antes de responder.
- Cada sala online grava no metadata do Colyseus quem está sentado, ao entrar e ao sair da espera, mantendo os campos do `filterBy`. O `GET /tables` lê as salas com `matchMaker.query({ name: "pontinho", locked: false, bots: false })` e, para cada mesa, mostra a primeira sala aberta, a mesma que o `joinOrCreate` escolhe. Sala que já começou fica trancada e some da lista; o treino nunca aparece.
- Mesa sem o saldo mínimo aparece com cadeado e não abre.

## Erros

O `GET /tables` não é rota da API: responde com as recusas do jogo, no corpo `{ code }`.

| Recusa | Status | Quando | Tratamento no app | Chave do texto |
|---|---|---|---|---|
| `invalidToken` | 401 | Sem token, ou a API recusou o token. | Encerra a sessão e volta ao login. | `errors.sessionExpired` |
| `accountDisabled` | 403 | Conta desativada. | Encerra a sessão e volta ao login. | `errors.accountDisabled` |
| `apiUnavailable`, `entryFailed` | 503, 500 | A API não respondeu à consulta do jogador. | Erro acima da lista; as mesas ficam com "—". | `errors.generic` |
| sem conexão | — | O servidor do jogo não respondeu. | Erro acima da lista; as mesas ficam com "—". | `errors.unreachable` |

Ao tocar numa mesa, valem as recusas da entrada: `insufficientBalance` e as falhas mostram o erro embaixo da lista; `openMatch` mostra o aviso de partida em andamento; `invalidToken` e `accountDisabled` levam ao login; `profileIncomplete` leva ao cadastro.

## Regra

- Partida online com fichas, numa das 7 mesas, com 4 lugares; começa quando a mesa enche ou com 3 depois de 10 s. (Regras.md, «Tipos de partida»)
- A lista mostra quem espera em cada mesa, com apelido e foto, e quantos lugares faltam. (Plano.md, «Decisões», Partida online)
- Na lista, cada pessoa aparece com apelido e foto, nunca com o nome completo. Até chegarem os bonecos, a foto mostra a inicial. (Plano.md, fatia 2, «Decisões do Lucas (04/11/2026)»)
- A lista exige login. (Lucas, 04/11/2026, plano da fatia 2 aprovado: "segue as sugestões")
- Duas pessoas no último lugar: a segunda abre outra sala na mesma mesa e espera, sem aviso (`joinOrCreate`). (Lucas, 04/11/2026, plano da fatia 2 aprovado)

## Testes

- `apps/game/test/tables.test.ts`: as 7 mesas com apelido de quem espera, quem sai da espera some, mesa que começou e treino fora da lista, e token ausente ou inválido.
- Sem teste automático: a tela do app.
