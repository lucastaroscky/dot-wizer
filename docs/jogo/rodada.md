# Rodada

Quando uma rodada termina, o jogo manda à API quem venceu e o que cada perdedor tinha na mão. A API move as fichas e devolve o estado financeiro de todos. Quem dispara é o motor, com o evento `roundEnded`: alguém bateu, ou o monte acabou e o motor apontou o vencedor.

Código: `PontinhoRoom.endRound` e `settleChips`, `ChipsMatch.settleRound` (`apps/game/src/rooms/pontinho/`).

## Chamada

`POST /internal/matches/:matchId/rounds` com `{ roundNumber, winnerId, losers: [{ userId, handPoints }] }`.

- Só na partida online. No treino não há `ChipsMatch` e nada é chamado.
- `winnerId` é a conta de quem bateu ou venceu. `losers` são os jogadores que não venceram e ficaram com pontos na mão (`roundPoints > 0`). Quem estava fora da partida ou já eliminado não recebeu carta na rodada, tem 0 ponto e fica de fora da lista.
- `roundNumber` começa em 1 e sobe a cada rodada. Todas as tentativas de uma rodada levam o mesmo número.
- As chamadas da partida (início, rodadas, eliminações e encerramento) andam numa fila, uma por vez e na ordem em que o jogo as pediu.
- 5 s de limite por tentativa e até 3 tentativas, com 500 ms entre elas. Só repete status 0 (rede e timeout) e 5xx. Os 4xx não repetem. Todas as tentativas levam o mesmo `x-request-id`.
- Repetir é seguro: a API recebe um `roundNumber` já registrado e devolve o estado atual, sem cobrar de novo.

## Sucesso

A API responde 200 com `matchId`, `lastRound` e, por jogador, `startBalance`, `result`, `deficit` e `balance`. O jogo:

- espelha no estado da sala `chipsResult`, `chipsDeficit` e `chipsBalance`, e calcula `roundChips` como a diferença do resultado desta rodada;
- libera a próxima rodada. Ela só começa depois do registro, passados os 8 s de intervalo e fechada a janela de volta após 100.

## Erros

Todos os erros desta chamada têm o mesmo tratamento: abortar a partida, o que aqui inclui pedir à API o encerramento sem vencedor e sem bônus (ver [início](inicio.md), "Tratamento comum"). Vale também quando a rodada que falha é a última da partida (ver "Última rodada da partida" abaixo).

### Respostas da API

| Código da API | Status | Quando | Tratamento no jogo | Efeito no jogador |
|---|---|---|---|---|
| `matchNotFound` | 404 | A API não conhece a partida que a sala guarda. | Abortar a partida. Sem nova tentativa. | Sala fechada com 4410. Valem as rodadas já pagas; esta não conta. |
| `matchAlreadyFinished` | 409 | A API já fechou a partida, por exemplo porque outro servidor do jogo a tratou como presa (Revisao.md, «Antes de vários servidores do jogo»). | Abortar a partida. Sem nova tentativa. | Sala fechada com 4410. |
| `roundOutOfOrder` | 409 | O `roundNumber` não é o seguinte ao último registrado na API. | Abortar a partida. Sem nova tentativa. | Sala fechada com 4410. |
| `playerNotInMatch` | 422 | O vencedor ou algum perdedor não faz parte da partida na API. | Abortar a partida. Sem nova tentativa. | Sala fechada com 4410. |
| `insufficientBalance` | 409 | O lançamento deixaria uma carteira negativa, por exemplo porque fichas saíram da carteira durante a partida. A API desfaz a rodada. | Abortar a partida. Sem nova tentativa. | Sala fechada com 4410. |
| `validationFailed` | 400 | A API recusou o corpo: contrato quebrado entre jogo e API, por exemplo uma lista de perdedores vazia. | Abortar a partida. Sem nova tentativa. | Sala fechada com 4410. |
| `badRequest` | 400 | O Fastify recusou a requisição antes da validação. Os outros 4xx do Fastify mantêm o status deles. | Abortar a partida. Sem nova tentativa. | Sala fechada com 4410. |
| `serviceTokenInvalid` | 401 | O `SERVICE_TOKEN` do jogo não é o da API. Erro de configuração. | Abortar a partida. Sem nova tentativa. | Sala fechada com 4410. |
| `tooManyRequests` | 429 | Limite de requisições da API estourado. | Abortar a partida. Sem nova tentativa. | Sala fechada com 4410. |
| `internalError` | 500 | Falha inesperada na API. | Repete até 3 tentativas; se continuar, abortar a partida. | Sala fechada com 4410 depois da terceira falha. |

### Falhas sem resposta útil da API

| Falha | Quando | Tratamento no jogo | Efeito no jogador |
|---|---|---|---|
| `networkError` | A conexão com a API falhou (status 0). | Repete até 3 tentativas; se continuar, abortar a partida. | Sala fechada com 4410 depois da terceira falha. |
| `timeout` | A API não respondeu em 5 s (status 0). | Repete até 3 tentativas; se continuar, abortar a partida. | Sala fechada com 4410 depois da terceira falha. |
| `invalidResponse` | A API respondeu erro, mas o corpo não é o envelope `{ statusCode, code, message }`. | Status 500 ou mais: repete e, se continuar, aborta. Abaixo de 500: aborta de uma vez. | Sala fechada com 4410. |

Em todos os casos o log é `error`, `Partida de fichas abortada`, com `{ sala, chamada: "registerRound", status, codigo, tentativa }`. Depois de repetir, `tentativa` mostra quantas foram feitas.

### Última rodada da partida

Quando a rodada que falha é a que acabou a partida, o motor já está em `phase === "ended"` e o encerramento com vencedor já está na fila. A falha da rodada tem o mesmo efeito que numa rodada do meio: a partida acaba sem vencedor e sem bônus, mesmo que o motor tivesse apontado um vencedor, e a sala fecha com 4410. Valem as rodadas já pagas; a última não é cobrada. (Regras.md, «Fim da partida»)

Como funciona: depois de uma rodada que falhou, o pedido de encerramento que estava na fila sai como `{ winnerId: null, awardWinBonus: false }` (`ChipsMatch.finish`), e `abortMatch` desconecta todos mesmo com a partida já encerrada no motor.

O outro caso é diferente e fica como está, por decisão do Lucas: se a última rodada foi registrada e é o encerramento com vencedor que não chega à API, a sala não fecha e só registra o log. A partida é fechada depois como presa, sem vencedor e sem bônus (ver [encerramento](encerramento.md), "Partida que não fecha").

## Regra

- Não existe pote. Quem bateu não paga. Cada um dos outros paga os pontos que ficaram na mão vezes o valor do ponto da mesa, e quem bateu recebe a soma do que foi efetivamente pago. Quem está offline paga e recebe normalmente; quem está fora da partida não paga nem recebe. (Regras.md, «Fichas por rodada»)
- Quem deve mais do que tem paga só o que tem, o resto vira déficit, abatido dos ganhos seguintes na mesma partida. Ninguém termina com saldo negativo. (Regras.md, «Saldo zerado e déficit»)
- Quando o monte acaba sem batida, vence quem tem a menor pontuação acumulada, e os outros pagam como numa rodada normal. (Regras.md, «Monte acabou sem batida»)
- Quem passou de 100 na rodada que encerrou a partida paga essa rodada. (Regras.md, «Passou de 100 e volta» e «Fim da partida»; comportamento conferido no teste abaixo)
- Valem as rodadas já pagas; a rodada em andamento não conta. (Regras.md, «Fim da partida»)
- A carteira nunca fica negativa. (Regras.md, «Histórico da partida»)

Regras.md e Revisao.md ficam no Obsidian, em `dotwize/`, fora do repositório.

## Testes

- `apps/game/test/chips.test.ts`: "registers the round with the winner and what each loser held, and mirrors what was paid and received", "charges the players who passed 100 in the round that ended the match, and finishes the match after that round is registered", "deals the next round only after the previous one is registered, and numbers the rounds", "deals the next round 8 seconds after the round is registered when the registration was quick", "mirrors the deficit of a player who could not pay everything", "ends the match without a winner and disconnects everybody when a round cannot be registered", "ends without a winner and without the bonus, and closes the room, when the round that ended the match cannot be registered" e "logs which call failed, with the room, the status, the code and the attempt, when it ends the match".
- `apps/game/test/httpGameApi.test.ts`: "registers a round on the match path without repeating the match id in the body", "retries a round that failed on the server or on the network, up to 3 attempts", "gives up after 3 failed attempts", "raises the status of a refusal and does not retry a client error" e "sends a request id for correlation, a different one per call and the same one across the retries of a call".
- `apps/api/src/modules/internal/internal.routes.spec.ts`, grupo "register round": fichas da rodada, rodada repetida sem cobrar de novo, duas iguais ao mesmo tempo, déficit, muitas rodadas sem saldo negativo, rodada pulada ou depois do fim, jogador fora da partida e corpo inválido, e saldo que não fica negativo quando fichas saem da carteira.
- Sem teste: o log de cada código da API na rodada.
