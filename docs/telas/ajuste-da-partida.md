# Ajuste da partida

Aberto pelo menu (Jogar). A pessoa escolhe o coringa (só o coringão ou também o coringa de vida), de 3 a 6 jogadores e o modelo das cartas, e entra no treino com robôs.

Código: `apps/mobile/src/app/training.tsx`, `apps/mobile/src/features/lobby/TrainingSetup.tsx` e `CardStylePicker.tsx`; a entrada passa pelo `join` do `MatchProvider`. No jogo, `apps/game/src/rooms/pontinho/PontinhoRoom.ts`; no motor, `packages/rules/src/game.ts`.

## Chamada

Sem chamada à API pela tela. "Jogar" chama `client.joinOrCreate("pontinho", { bots: true, seats, lifeJoker })`, e o servidor do jogo consulta a API na entrada, como descrito em [entrada](../jogo/entrada.md).

- Ao abrir: só o coringão e 4 jogadores.
- Com o coringa de vida, o jogo vira uma carta no começo de cada rodada (`flipped` no estado da sala) e a mesa mostra a virada atrás do monte, o selo com os coringas da rodada e a estrela nas cartas que são coringa de vida.
- Com 5 ou 6 jogadores, os adversários ficam numa linha só, com placas estreitas, na ordem da vez.

## Sucesso

O jogo senta a pessoa, completa a mesa com os robôs ("Robô 1" a "Robô 5") e começa na hora. O app vai para a mesa.

## Erros

Não há resposta da API nesta tela. As recusas do jogo são as da pré-sala:

| Recusa | Efeito na tela | Chave do texto |
|---|---|---|
| `openMatch` | Mostra o aviso de partida em andamento, com "Voltar à partida" quando há cadeira guardada. | `lobby.openMatch` |
| `profileIncomplete` | O guard leva ao cadastro. | `home.joinRefusals.profileIncomplete` |
| `invalidToken`, `accountDisabled` | Volta ao login. | `home.joinRefusals.invalidToken`, `home.joinRefusals.accountDisabled` |
| `apiUnavailable`, `entryFailed`, sem conexão | Erro acima do botão, para tentar de novo. | `home.joinRefusals.apiUnavailable`, `home.joinFailed` |
| `invalidOptions` | Erro acima do botão. Não deve acontecer, porque a tela só oferece valores válidos. | `home.joinRefusals.invalidOptions` |

## Regra

- Com robôs é só treino, sem movimentação de fichas. O jogador escolhe de 3 a 6 jogadores e o coringa: só o coringão ou também o coringa de vida. (Regras.md, «Tipos de partida»)
- Coringa de vida: no começo da rodada vira-se uma carta; valem como coringa as cartas seguintes nos dois naipes da cor. Rei vira ás. Coringão virado volta para o fundo do monte. Vale como o coringão em tudo e é sempre coringa. (Regras.md, «Coringas»)
- A partida online usa só o coringão. (Regras.md, «Tipos de partida»)
- Padrão de só o coringão e 4 jogadores, virada atrás do monte, selo, estrela e placas estreitas numa linha: sugestões do designer, aplicadas como provisórias até o ok do Lucas (design-fatia-2-parte-5.md, nas notas da rodada).

## Testes

- `apps/game/test/training.test.ts`: até 5 robôs numa mesa de 6, recusa de 2 e de 7 lugares, a virada no estado com o coringa de vida, só o coringão por padrão e a partida online sem coringa de vida.
- `packages/rules/test/lifeJoker.test.ts`: as regras do coringa de vida e o treino de 6 jogadores no motor.
- Sem teste automático: a tela e a mesa do app.
