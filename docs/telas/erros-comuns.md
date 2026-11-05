# Erros comuns das rotas do app

Valem para toda chamada do app à API (`apps/mobile/src/shared/api/client.ts`, função `request`). Cada tela documenta só os erros dela e aponta para cá.

Código: `toApiError`, `sessionEndReason` e `toUnreachableError` em `client.ts`; o texto de cada código fica em `API_ERROR_TEXTS` (`apps/mobile/src/messages/apiErrors.ts`).

## Respostas da API

| Código da API | Status | Quando | Tratamento no app | Chave do texto |
|---|---|---|---|---|
| `invalidToken` | 401 | Token ausente, malformado, expirado ou assinado por outra chave. | Encerra a sessão local (`endSession("expired")`) e volta ao login, que mostra o motivo. | `errors.sessionExpired` |
| `accountDisabled` | 403 | Conta desativada. | Encerra a sessão local (`endSession("accountDisabled")`) e volta ao login, que mostra o motivo. | `errors.accountDisabled` |
| `validationFailed` | 400 | O corpo ou a consulta não passou no contrato. É bug do app, porque ele confere os campos antes de enviar. | Aviso genérico. | `errors.generic` |
| `badRequest` | 400 | O Fastify recusou a requisição antes da validação, por exemplo JSON inválido. | Aviso genérico. | `errors.generic` |
| `routeNotFound` | 404 | A rota não existe: app e API em versões diferentes. | Aviso genérico. | `errors.generic` |
| `tooManyRequests` | 429 | Limite de requisições estourado. | Aviso para esperar e tentar de novo. | `errors.tooManyRequests` |
| `uniqueConflict` | 409 | O banco recusou um registro repetido que nenhuma regra da rota trata. | Aviso genérico. | `errors.generic` |
| `internalError` | 500 | Falha inesperada na API. | Aviso genérico. | `errors.generic` |

## Falhas sem resposta útil da API

| Falha | Quando | Tratamento no app | Chave do texto |
|---|---|---|---|
| sem conexão | O `fetch` falhou ou a sessão do Supabase não pôde ser lida por rede. | Aviso de sem conexão; a tela oferece "Tentar de novo" quando pode repetir a chamada. | `errors.unreachable` |
| tempo esgotado | A API não respondeu no limite do `fetchWithTimeout`. | O mesmo aviso de sem conexão. | `errors.unreachable` |
| sem sessão | Não há sessão do Supabase ao montar a chamada. | Aviso para entrar na conta. | `errors.notSignedIn` |
| corpo fora do envelope | A API respondeu erro sem `{ statusCode, code, message }`, por exemplo um 502 de proxy. | Status 429: aviso de muitas tentativas. Qualquer outro: aviso genérico. | `errors.tooManyRequests`, `errors.generic` |

## Testes

O app ainda não tem testes automáticos. Os códigos e os status vêm de `packages/api-contract/src/errors.ts`, e o `satisfies Record<ApiErrorCode, string>` do `apiErrors.ts` obriga um texto por código.
