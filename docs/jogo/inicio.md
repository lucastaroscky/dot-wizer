# Início da partida

Quando a mesa enche, o jogo abre a partida de fichas na API, que guarda o saldo inicial de cada jogador. Quem dispara é a sala: o último jogador a sentar faz `players.size >= seats` no `onJoin`.

Código: `PontinhoRoom.startMatch` e `openChipsMatch`, `ChipsMatch.open` (`apps/game/src/rooms/pontinho/`).

## Chamada

`POST /internal/matches` com `{ table, playerIds }`, e `playerIds` são as contas das cadeiras ocupadas (de 3 a 4, sem repetir; robôs não entram).

- Só na partida online. No treino com robôs (`table === 0`) o jogo não chama a API.
- Uma tentativa só, com 5 s de limite. Repetir não ajudaria: se a primeira chamada chegou à API, a segunda seria recusada com `playerAlreadyInMatch`.
- O jogo não espera a resposta para dar as cartas: `showRound` roda logo depois de `openChipsMatch`. A resposta preenche `state.matchId`, `state.pointValue` e as finanças.
- Antes de chamar, o jogo marca as contas como "em abertura" na presence (`markStarting`) e desmarca no `finally`. Isso impede que a entrada de outro aparelho da mesma conta feche a partida enquanto ela abre.
- Cada chamada leva um `x-request-id` novo.

## Sucesso

A API responde 201 com `matchId`, `table`, `pointValue` e `players[{ userId, startBalance }]`. O jogo:

- registra a partida na presence (`registerMatch`), que é o que faz a entrada de outro aparelho achar a sala;
- guarda `matchId` e `pointValue` no estado da sala;
- espelha as finanças de cada jogador: `chipsResult` 0, `chipsDeficit` 0 e `chipsBalance` igual ao `startBalance`.

Nada é descontado do saldo ao começar.

## Erros

Todos os erros desta chamada têm o mesmo tratamento: abortar a partida (ver "Tratamento comum" abaixo). A tabela diz só quando cada um acontece.

### Respostas da API

| Código da API | Status | Quando | Tratamento no jogo | Efeito no jogador |
|---|---|---|---|---|
| `tableNotFound` | 422 | A API não conhece a mesa. O jogo filtra as mesas pela mesma lista (`CHIP_TABLES`), então só acontece com jogo e API em versões diferentes. | Abortar a partida. | Sala fechada com 4410. Ninguém foi cobrado. |
| `playerNotFound` | 404 | Alguma conta da sala não existe na API. | Abortar a partida. | Sala fechada com 4410. |
| `playerAlreadyInMatch` | 409 | Alguma conta já está em outra partida aberta, por exemplo duas salas que enchem ao mesmo tempo com o mesmo jogador. A API deixa só uma começar. | Abortar a partida. | Sala fechada com 4410. |
| `playerBelowMinimumBalance` | 409 | O saldo de alguma conta caiu abaixo do mínimo da mesa entre a entrada e o início. A entrada só confere o saldo na hora de sentar. | Abortar a partida. | Sala fechada com 4410. |
| `validationFailed` | 400 | A API recusou o corpo: contrato quebrado entre jogo e API. | Abortar a partida. | Sala fechada com 4410. |
| `badRequest` | 400 | O Fastify recusou a requisição antes da validação. Os outros 4xx do Fastify mantêm o status deles. | Abortar a partida. | Sala fechada com 4410. |
| `serviceTokenInvalid` | 401 | O `SERVICE_TOKEN` do jogo não é o da API. Erro de configuração. | Abortar a partida. | Sala fechada com 4410. |
| `tooManyRequests` | 429 | Limite de requisições da API estourado. | Abortar a partida. | Sala fechada com 4410. |
| `internalError` | 500 | Falha inesperada na API. | Abortar a partida. | Sala fechada com 4410. |

Qualquer outro código também aborta a partida.

### Falhas sem resposta útil da API

| Falha | Quando | Tratamento no jogo | Efeito no jogador |
|---|---|---|---|
| `networkError` | A conexão com a API falhou (status 0). | Abortar a partida. | Sala fechada com 4410. |
| `timeout` | A API não respondeu em 5 s (status 0). | Abortar a partida. | Sala fechada com 4410. |
| `invalidResponse` | A API respondeu erro, mas o corpo não é o envelope `{ statusCode, code, message }`. | Abortar a partida. | Sala fechada com 4410. |

Rede, timeout e resposta ilegível deixam o resultado incerto: a API pode ter criado a partida sem o jogo saber. Nesse caso a partida fica aberta na API, sem sala, e é fechada sem vencedor quando um dos jogadores tentar entrar de novo (ver [entrada](entrada.md), "Partida aberta").

### Tratamento comum: abortar a partida

`PontinhoRoom.abortMatch`:

1. Registra log `error` com `Partida de fichas abortada` e `{ sala, chamada, status, codigo, tentativa }`. Se o erro não veio da API, o objeto leva `{ sala, causa }`.
2. Se a partida já terminou no motor (`phase === "ended"`), para aqui.
3. Senão, `stopMatch`: para os timers, abandona a partida no motor e pede à API o encerramento sem vencedor e sem bônus (ver [encerramento](encerramento.md)). Como a partida nunca abriu, não há `matchId` e essa chamada nem sai. Depois esquece a partida e as cadeiras guardadas na presence.
4. Desconecta todos com o código 4410 (`CLOSE_CODES.matchAborted`).

## Regra

- A partida online começa quando a mesa enche. (Plano.md, «Decisões»; Regras.md, «Tipos de partida»)
- O saldo mínimo é só requisito de entrada: nada é descontado. A API guarda o saldo inicial de cada jogador. (Regras.md, «Mesas e saldo mínimo» e «Histórico da partida»)
- O treino com robôs não movimenta fichas. (Regras.md, «Tipos de partida»)
- Partida que cai por falha nossa, como API fora do ar, acaba sem vencedor, sem bônus, e só valem as rodadas já pagas. No início ainda não há rodada paga. (Regras.md, «Fim da partida»)

Regras.md e Plano.md ficam no Obsidian, em `dotwize/`, fora do repositório.

## Testes

- `apps/game/test/chips.test.ts`: "opens the chips match with the table and the people when the table fills", "does not touch the chips API in a practice match" e "ends the match and disconnects everybody when the chips match cannot be opened" (confere o 4410 e que nenhum encerramento foi pedido).
- `apps/game/test/openMatch.test.ts`: "forgets the match that was being opened when the API refuses it" e "does not close a match that is still being opened when another device of a seated player asks to join".
- `apps/game/test/httpGameApi.test.ts`: "starts and finishes a match" e "does not retry opening a match nor asking about a player".
- `apps/api/src/modules/internal/internal.routes.spec.ts`, grupo "start match": saldos guardados sem cobrança, saldo mínimo, conta em partida aberta, duas partidas ao mesmo tempo com o mesmo jogador, conta desconhecida, repetida e número errado de jogadores.
- Sem teste no jogo: o log de cada código da API no início. O log de `abortMatch` é conferido para a rodada, em "logs which call failed, with the room, the status, the code and the attempt, when it ends the match".
