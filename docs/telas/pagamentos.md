# Pagamentos

Aberto pelo menu (Pagamentos). Tem dois caminhos: Comprar fichas, só por Pix, e Conta para receber, que cadastra a chave Pix do CPF para o saque.

Código: `apps/mobile/src/app/payments.tsx`, `apps/mobile/src/app/store.tsx` e `apps/mobile/src/features/store/` (`PaymentsScreen.tsx`, `usePixKey.ts`, `ChipStore.tsx`, `useQuote.ts` e `usePurchase.ts`); na API, `apps/api/src/modules/profile/` (chave Pix) e `apps/api/src/modules/store/` (compra).

## Chamadas

| Ação | Chamada | Sucesso |
|---|---|---|
| Abrir | `GET /wallet` e `GET /profile` (do cache) | Mostra o saldo e se a chave Pix já foi cadastrada. |
| Comprar fichas | Abre `/store`: `GET /store/quote?quantity=` a cada quantidade e `POST /store/purchases` com `Idempotency-Key` ao tocar em Comprar | A compra de teste é aprovada na hora; aparece a confirmação e o saldo é relido. |
| Conta para receber | `PUT /profile/pix-key`, sem corpo, ao tocar em "Cadastrar chave" | Volta para Pagamentos com "Chave Pix (CPF)" e o CPF mascarado. Depois disso, o cartão não abre mais. |

- A chave é sempre do tipo CPF e vem do cadastro, travada: a tela só mostra o CPF e pede o aceite.
- A forma de pagamento mostra só o Pix, já escolhido. Até existir o provedor de Pix, a compra é de teste e não cobra nada, sem QR Code.
- Repetir a mesma compra (mesma quantidade, depois de uma falha) reaproveita a `Idempotency-Key`, para não comprar duas vezes.

## Erros

Os erros que valem para toda rota estão em [erros comuns](erros-comuns.md).

| Código da API | Status | Quando | Tratamento no app | Chave do texto |
|---|---|---|---|---|
| `registrationRequired` | 409 | A conta não tem cadastro ao cadastrar a chave. Não deve acontecer, porque o guard leva ao cadastro antes. | Erro genérico acima do botão. | `errors.generic` |
| `quantityAboveMaximum` | 422 | A quantidade passou do máximo por compra. | Aviso na loja. | `errors.quantityAboveMaximum` |
| `idempotencyKeyReused` | 409 | A mesma `Idempotency-Key` veio com outra quantidade. É bug do app, que troca a chave quando a quantidade muda. | Aviso genérico na loja. | `errors.generic` |
| `validationFailed` | 400 | Quantidade fora do passo ou do mínimo. O app só anda em passos de 1.000. | Aviso genérico na loja. | `errors.generic` |

### Falhas sem resposta útil da API

| Falha | Quando | Tratamento no app | Chave do texto |
|---|---|---|---|
| sem conexão na carteira | `GET /wallet` falhou. | Saldo "—" e aviso com "Tentar de novo". | `errors.unreachable` |
| tempo esgotado na compra | `POST /store/purchases` passou do limite. | Aviso para conferir o saldo antes de tentar de novo. | `errors.purchaseUnconfirmed` |
| sem conexão na compra ou na cotação | O `fetch` falhou. | Aviso na loja; a cotação tem "Tentar de novo". | `errors.unreachable` |
| sem conexão na chave Pix | `PUT /profile/pix-key` falhou. | Erro acima do botão; dá para tocar de novo. | `errors.unreachable` |

## Regra

- Compra de fichas só por Pix, sem cartão por enquanto. Até existir o provedor de pagamento, a loja mostra quantidade e valor e não cobra nada. (Plano.md, «Decisões», Compra de fichas)
- Saque por Pix, só para chave Pix do tipo CPF, preenchida com o CPF do cadastro. (Plano.md, «Decisões», Saque)
- O Pix segue a tela do protótipo, com o provedor de teste, e "Cadastrar chave" vale como aceite. (Plano.md, fatia 2, «Decisões do Lucas (04/11/2026)»)
- A compra continua de teste, aprovada na hora e sem QR Code, até o provedor de verdade (fatia 5). (Lucas, 04/11/2026, plano da fatia 2 aprovado: "segue as sugestões")
- A chave grava a data do aceite uma vez só; repetir a chamada não muda a data. É comportamento do código.
- O pedido de saque não está nesta fatia. (Plano.md, «Próximas fatias», item 5)

## Testes

- `apps/api/src/modules/profile/profile.routes.spec.ts`: chave cadastrada uma vez só e recusada antes do cadastro.
- `apps/api/src/modules/store/`: cotação, compra de teste, máximo por compra e `Idempotency-Key`.
- Sem teste automático: as telas do app.
