# Encerramento da partida

Quando a partida acaba, o jogo avisa a API quem venceu e se há bônus. A API paga o bônus de vitória uma única vez, fecha o histórico e libera as contas dos jogadores. O jogo faz essa chamada no máximo uma vez por partida: as chamadas seguintes reaproveitam a primeira.

Código: `PontinhoRoom.endMatch`, `stopMatch`, `onDispose` e `ChipsMatch.finish` (`apps/game/src/rooms/pontinho/`).

## Quando o jogo chama

| Gatilho | Resultado enviado |
|---|---|
| O motor termina a partida (`matchEnded`) | Com vencedor: `winnerId` e `awardWinBonus` verdadeiro quando ele venceu jogando (motivo `points`), falso quando venceu porque os outros saíram (motivo `walkover`). Sem vencedor: `winnerId` nulo e `awardWinBonus` falso. |
| Todas as pessoas saíram de vez e a rodada em andamento terminou (`stopMatchWhenNobodyIsLeft`) | Sem vencedor, sem bônus. O pedido entra na fila depois do registro dessa rodada. |
| O jogo aborta a partida por falha nossa (ver [início](inicio.md), "Tratamento comum") | Sem vencedor, sem bônus. Vale também quando a rodada que falha é a que acabou a partida: o pedido com vencedor que já estava na fila sai sem vencedor e sem bônus (ver [rodada](rodada.md), "Última rodada da partida"). |
| O servidor do jogo vai desligar (`onBeforeShutdown`) | Sem vencedor, sem bônus. |
| A sala é descartada sem ter encerrado (`onDispose`) | Sem vencedor, sem bônus. |

O vencedor só aparece no estado da sala (`winner` e o anúncio `won`) depois que a API confirma o registro da última rodada; no treino aparece na hora (ver [rodada](rodada.md), "Última rodada da partida").

Há ainda um caminho fora da sala: a entrada de um jogador que tem uma partida presa a fecha sem vencedor (ver [entrada](entrada.md), "Partida aberta").

Se a partida nunca abriu na API (não há `matchId`) ou é treino, o jogo não chama nada. Depois de encerrar, a sala esquece a partida e as cadeiras guardadas: ninguém volta a ela com a chave antiga.

## Chamada

`POST /internal/matches/:matchId/finish` com `{ winnerId, awardWinBonus }`.

- A chamada entra na mesma fila das rodadas, então roda depois do registro da última rodada.
- 5 s de limite por tentativa e até 3 tentativas, com 500 ms entre elas. Só repete status 0 (rede e timeout) e 5xx. Todas levam o mesmo `x-request-id`.
- Repetir com o mesmo resultado é seguro: o bônus sai uma vez só, mesmo com duas chamadas ao mesmo tempo. Repetir com outro vencedor ou outra decisão sobre o bônus é recusado com `winnerChanged`.

## Sucesso

A API responde 200 com o histórico da partida: `status` `FINISHED`, `winnerId` e, por jogador, `startBalance`, `paid`, `received`, `deficitCleared`, `deficit`, `winBonus`, `result` e `finalBalance`. O jogo ignora o corpo; o app busca o histórico por conta própria em `GET /matches/:matchId`.

Do lado da API:

- o bônus de vitória, quando há, é 10 vezes o valor do ponto da mesa, creditado pela casa e registrado à parte;
- todas as contas ficam livres para outra partida;
- quem não foi eliminado tem o saldo final gravado; quem foi eliminado mantém o que foi gravado na eliminação.

## Erros

Todos os erros desta chamada têm o mesmo tratamento: registrar log `error` e seguir. Não há o que abortar, porque a partida já acabou na sala.

### Respostas da API

| Código da API | Status | Quando | Tratamento no jogo | Efeito no jogador |
|---|---|---|---|---|
| `matchNotFound` | 404 | A API não conhece a partida que a sala guarda. | Log `error`. Sem nova tentativa. | Nenhum na sala. |
| `playerNotInMatch` | 422 | O vencedor não faz parte da partida na API. | Log `error`. Sem nova tentativa. | Partida segue aberta na API; ver "Partida que não fecha". |
| `winnerEliminated` | 422 | O vencedor está eliminado na API, ou seja, API e motor discordam. A API mantém a partida aberta. | Log `error`. Sem nova tentativa. | Partida segue aberta na API; ver "Partida que não fecha". |
| `winnerChanged` | 409 | A partida já foi fechada com outro vencedor ou outra decisão sobre o bônus. | Log `error`. Sem nova tentativa. | Nenhum: vale o resultado que a API já tem. |
| `validationFailed` | 400 | A API recusou o corpo: contrato quebrado entre jogo e API. | Log `error`. Sem nova tentativa. | Partida segue aberta na API; ver "Partida que não fecha". |
| `badRequest` | 400 | O Fastify recusou a requisição antes da validação. Os outros 4xx do Fastify mantêm o status deles. | Log `error`. Sem nova tentativa. | Partida segue aberta na API; ver "Partida que não fecha". |
| `serviceTokenInvalid` | 401 | O `SERVICE_TOKEN` do jogo não é o da API. Erro de configuração. | Log `error`. Sem nova tentativa. | Partida segue aberta na API; ver "Partida que não fecha". |
| `tooManyRequests` | 429 | Limite de requisições da API estourado. | Log `error`. Sem nova tentativa. | Partida segue aberta na API; ver "Partida que não fecha". |
| `internalError` | 500 | Falha inesperada na API. | Repete até 3 tentativas; se continuar, log `error`. | Partida segue aberta na API; ver "Partida que não fecha". |

### Falhas sem resposta útil da API

| Falha | Quando | Tratamento no jogo | Efeito no jogador |
|---|---|---|---|
| `networkError` | A conexão com a API falhou (status 0). | Repete até 3 tentativas; se continuar, log `error`. | Partida segue aberta na API; ver "Partida que não fecha". |
| `timeout` | A API não respondeu em 5 s (status 0). | Repete até 3 tentativas; se continuar, log `error`. | Partida segue aberta na API; ver "Partida que não fecha". |
| `invalidResponse` | A API respondeu erro, mas o corpo não é o envelope `{ statusCode, code, message }`. | Status 500 ou mais: repete e, se continuar, log `error`. Abaixo de 500: log `error` de uma vez. | Partida segue aberta na API; ver "Partida que não fecha". |

O log é `Falha ao encerrar a partida de fichas` com `{ sala, chamada: "finishMatch", status, codigo, tentativa }`.

### Partida que não fecha

Se a chamada falha, a partida continua aberta na API e as contas continuam presas a ela. Na próxima entrada de qualquer jogador da partida, o jogo não encontra sala nem cadeira para ela, a trata como presa e a fecha sem vencedor e sem bônus (ver [entrada](entrada.md), "Partida aberta"). Na prática, o vencedor perde o bônus quando o encerramento com vencedor não chega à API.

Decisão do Lucas: fica assim. Quando o encerramento com vencedor não chega à API, a partida é fechada depois como presa, sem vencedor e sem bônus; o bônus não é pago depois. É coerente com Regras.md, «Fim da partida», que trata falha nossa como partida sem vencedor e sem bônus. A sala não fecha nesse caso, só registra o log (a última rodada já foi registrada).

## Regra

- A partida termina quando só um jogador fica com até 100 pontos; ele vence. Também termina quando sobra uma pessoa só em jogo ou quando todas saem. (Regras.md, «Fim da partida»)
- Se a partida cai por falha nossa, acaba sem vencedor, valem as rodadas já pagas e ninguém leva bônus. (Regras.md, «Fim da partida»)
- O vencedor recebe da casa 10 vezes o valor do ponto da mesa, registrado à parte. Não há bônus quando ele ganha porque os outros saíram, quando o único com até 100 está fora da partida, nem quando a partida cai por falha nossa. (Regras.md, «Bônus de vitória»)
- Se os outros saírem de vez e sobrar uma pessoa só em jogo, a partida acaba no fim da rodada em andamento, depois de pagar essa rodada, e essa pessoa vence sem o bônus. Se todas saírem, o jogo paga a rodada em andamento e a partida acaba sem vencedor. (Regras.md, «Quem cai ou sai»)
- O histórico guarda saldo inicial, pagamentos, recebimentos, déficit, bônus de vitória, resultado final e saldo final. (Regras.md, «Histórico da partida»)

Regras.md fica no Obsidian, em `dotwize/`, fora do repositório.

## Testes

- `apps/game/test/chips.test.ts`: "charges the players who passed 100 in the round that ended the match, and finishes the match after that round is registered" (vencedor com bônus, depois da rodada), "ends the match without a winner and disconnects everybody when a round cannot be registered", "ends without a winner and without the bonus, and closes the room, when the round that ended the match cannot be registered", "keeps the room open and only logs when the finish with a winner cannot reach the API" e "closes an open match without a winner when the room goes away".
- `apps/game/test/absence.test.ts`: "ends the match after the round in progress when the others left, and the one who stayed wins without the bonus" e "plays the round to the end with 3 second turns and ends without a winner when every person left".
- `apps/game/test/openMatch.test.ts`: "closes the open matches of the instance without a winner when the server shuts down", "closes a stuck match that no room of this server holds, and lets the account in" e "no longer holds the seat once the match is over".
- `apps/game/test/httpGameApi.test.ts`: "starts and finishes a match" e "gives up after 3 failed attempts".
- `apps/api/src/modules/internal/internal.routes.spec.ts`, grupo "finish match": bônus de 10 vezes o valor do ponto, bônus uma vez só, duas chamadas ao mesmo tempo, `awardWinBonus` falso, outra decisão recusada, decisão obrigatória, partida sem vencedor, vencedor fora da partida e partida desconhecida. No grupo "eliminations", "does not accept an eliminated player as the winner and keeps the match open". No grupo "start match", "frees the players when the match is finished".
- Sem teste no jogo: o log de cada código da API no encerramento.
