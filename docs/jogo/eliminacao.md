# Eliminação

Quem passa de 100 e recusa a volta é eliminado. O jogo avisa a API para que a conta fique livre para outra partida enquanto esta continua. Quem dispara é o motor, com o evento `eliminated`, que sai da escolha `chooseReturn { back: false }` do jogador.

Código: `PontinhoRoom.handle` (caso `eliminated`) e `ChipsMatch.eliminate` (`apps/game/src/rooms/pontinho/`).

## Chamada

`POST /internal/matches/:matchId/eliminations` com `{ userId }`.

- Só na partida online.
- Entra na mesma fila das rodadas, então roda depois do registro da rodada que abriu a janela de volta.
- 5 s de limite por tentativa e até 3 tentativas, com 500 ms entre elas. Só repete status 0 (rede e timeout) e 5xx. Todas levam o mesmo `x-request-id`.
- Repetir é seguro: a API responde com a primeira eliminação, com o mesmo `eliminatedAt`.

Não há chamada para quem passa de 100 na rodada que encerra a partida. O motor já o marca como eliminado, sem evento, e o encerramento libera todas as contas.

Quem não escolhe em 15 s, ou está offline, volta sozinho. Esses casos não eliminam e não chamam a API.

## Sucesso

A API responde 200 com `matchId`, `userId` e `eliminatedAt`. O jogo ignora o corpo. Do lado da API, a conta deixa de contar como "em partida aberta" e o saldo dela naquele instante fica gravado como saldo final.

Na sala, o jogador eliminado:

- aparece no anúncio `eliminated`;
- não tem cadeira guardada: se sair, não consegue voltar com a chave antiga;
- continua na lista de jogadores da sala, sem jogar, até a partida acabar.

## Erros

Todos os erros desta chamada têm o mesmo tratamento: registrar log `error` e seguir. A partida não é abortada, porque a eliminação já valeu no motor.

### Respostas da API

| Código da API | Status | Quando | Tratamento no jogo | Efeito no jogador |
|---|---|---|---|---|
| `matchNotFound` | 404 | A API não conhece a partida que a sala guarda. | Log `error`. Sem nova tentativa. A partida segue. | A conta fica presa à partida na API até ela acabar. |
| `matchAlreadyFinished` | 409 | A API já fechou a partida. | Log `error`. Sem nova tentativa. A partida segue. | Nenhum: a conta já foi liberada pelo encerramento. |
| `playerNotInMatch` | 422 | A conta não faz parte da partida na API. | Log `error`. Sem nova tentativa. A partida segue. | Nenhum na partida. |
| `validationFailed` | 400 | A API recusou o corpo: contrato quebrado entre jogo e API. | Log `error`. Sem nova tentativa. A partida segue. | A conta fica presa à partida na API até ela acabar. |
| `badRequest` | 400 | O Fastify recusou a requisição antes da validação. Os outros 4xx do Fastify mantêm o status deles. | Log `error`. Sem nova tentativa. A partida segue. | A conta fica presa à partida na API até ela acabar. |
| `serviceTokenInvalid` | 401 | O `SERVICE_TOKEN` do jogo não é o da API. Erro de configuração. | Log `error`. Sem nova tentativa. A partida segue. | A conta fica presa à partida na API até ela acabar. |
| `tooManyRequests` | 429 | Limite de requisições da API estourado. | Log `error`. Sem nova tentativa. A partida segue. | A conta fica presa à partida na API até ela acabar. |
| `internalError` | 500 | Falha inesperada na API. | Repete até 3 tentativas; se continuar, log `error`. A partida segue. | A conta fica presa à partida na API até ela acabar. |

### Falhas sem resposta útil da API

| Falha | Quando | Tratamento no jogo | Efeito no jogador |
|---|---|---|---|
| `networkError` | A conexão com a API falhou (status 0). | Repete até 3 tentativas; se continuar, log `error`. A partida segue. | A conta fica presa à partida na API até ela acabar. |
| `timeout` | A API não respondeu em 5 s (status 0). | Repete até 3 tentativas; se continuar, log `error`. A partida segue. | A conta fica presa à partida na API até ela acabar. |
| `invalidResponse` | A API respondeu erro, mas o corpo não é o envelope `{ statusCode, code, message }`. | Status 500 ou mais: repete e, se continuar, log `error`. Abaixo de 500: log `error` de uma vez. A partida segue. | A conta fica presa à partida na API até ela acabar. |

O log é `Falha ao registrar a eliminação` com `{ sala, chamada: "eliminatePlayer", status, codigo, tentativa }`.

### Conta presa à partida

Sem o registro, a API ainda vê o jogador na partida. Se ele tentar entrar em outro jogo antes de ela acabar, o jogo acha a sala viva e recusa com `openMatch`, sem chave da cadeira (ver [entrada](entrada.md), "Partida aberta"). O encerramento da partida libera a conta. Se o encerramento também falhar, a conta é liberada na próxima entrada, quando o jogo fecha a partida como presa.

## Regra

- Quem passou de 100 tem 15 s para decidir; sem resposta, volta. Quem está offline volta sozinho. Quem não volta é eliminado: a partida segue, mesmo com 2 jogadores, e ele fica livre para entrar em outra. (Regras.md, «Passou de 100 e volta»)
- Enquanto a partida dele não acabar, o jogador não entra em outra. Quem foi eliminado fica livre. (Regras.md, «Quem cai ou sai»)
- O histórico guarda o saldo final por jogador. (Regras.md, «Histórico da partida»)
- Gravar o saldo final no instante da eliminação é comportamento da API, coberto por teste; Regras.md não diz isso de forma explícita.

Regras.md fica no Obsidian, em `dotwize/`, fora do repositório.

## Testes

- `apps/game/test/openMatch.test.ts`: "registers the elimination of a player who refuses to return, and keeps no seat for him" e "logs at error level, and keeps the match going, when the elimination cannot be registered".
- `apps/game/test/httpGameApi.test.ts`: "registers the elimination of a player on the match path and retries it like a round".
- `apps/game/test/PontinhoRoom.test.ts`: "keeps the match going when an eliminated player leaves".
- `apps/api/src/modules/internal/internal.routes.spec.ts`, grupo "eliminations": registro e repetição, duas ao mesmo tempo, libera só a conta eliminada, mantém o jogador no histórico, congela o saldo final, recusa vencedor eliminado no encerramento, jogador fora da partida, eliminação depois do fim, partida desconhecida e corpo inválido.
- Sem teste no jogo: o log de cada código da API, além de `matchNotFound`.
