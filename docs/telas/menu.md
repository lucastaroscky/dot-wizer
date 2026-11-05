# Menu

Primeira tela de quem já tem cadastro. Mostra o saldo, o bônus diário e leva para Jogar online, Jogar (treino com robôs) e Pagamentos. Como jogar e Ranking aparecem como "em breve".

Código: `apps/mobile/src/app/index.tsx`, com `useWallet`, `useDailyBonus`, `BalanceCard` e `DailyBonus` de `apps/mobile/src/features/wallet/`.

## Chamadas

- `GET /wallet` ao abrir e sempre que a tela volta ao foco.
- `POST /wallet/daily-bonus` ao tocar em "Resgatar bônus diário". Depois, sucesso ou erro, o app lê a carteira de novo.

## Sucesso

- `GET /wallet` responde 200 com `balance` e `dailyBonusAvailable`. O saldo aparece no topo; o bônus aparece como botão, ou como "já resgatado" quando `dailyBonusAvailable` é falso.
- `POST /wallet/daily-bonus` responde 200 e o saldo novo aparece com a carteira relida.

## Para onde leva

| Item | Vai para |
|---|---|
| Jogar online | pré-sala (`/lobby`) |
| Jogar | pré-sala (`/lobby`), até a parte 5 trazer o Ajuste da partida |
| Pagamentos | loja (`/store`), até a parte 4 trazer a tela Pagamentos |
| Sair | encerra a sessão, até a parte 3 levar o Sair para o Perfil |

Com uma sala aberta (`room` do `MatchProvider`), o menu manda direto para a mesa.

## Erros

Os erros que valem para toda rota estão em [erros comuns](erros-comuns.md).

| Código da API | Status | Quando | Tratamento no app | Chave do texto |
|---|---|---|---|---|
| `dailyBonusAlreadyClaimed` | 409 | O bônus de hoje já foi resgatado, por exemplo em outro aparelho. | Nada em vermelho: a carteira relida mostra "já resgatado". | `wallet.dailyBonusClaimed` |

### Falhas sem resposta útil da API

| Falha | Quando | Tratamento no app | Chave do texto |
|---|---|---|---|
| sem conexão na carteira | `GET /wallet` falhou por rede ou tempo. | Saldo "—" e aviso com "Tentar de novo", que lê a carteira de novo. | `errors.unreachable` |
| sem conexão no bônus | `POST /wallet/daily-bonus` falhou por rede ou tempo. | Aviso no topo. | `errors.unreachable` |

## Regra

- Bônus diário de 100 fichas, uma vez por dia, com resgate manual, pelo dia do calendário de Brasília. (Plano.md, «Decisões», Bônus diário)
- "Jogar online" em destaque no menu. (Plano.md, fatia 2, «Decisões do Lucas (04/11/2026)»)
- Como jogar e Ranking ficam para depois. (Plano.md, fatia 2)

## Testes

- `apps/api/src/modules/wallet/`: saldo, bônus diário e `dailyBonusAlreadyClaimed`.
- Sem teste automático: a tela do app.
