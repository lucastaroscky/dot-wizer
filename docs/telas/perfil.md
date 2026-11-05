# Perfil

Aberto pelo menu (Perfil). Mostra a foto, o apelido e as fichas; os dados pessoais travados, com o CPF mascarado; o e-mail e o celular, que podem mudar; e o Sair e o Excluir conta.

Código: `apps/mobile/src/app/profile.tsx` e `apps/mobile/src/features/profile/` (`ProfileScreen.tsx`, `ProfileSheets.tsx`, `useProfileUpdate.ts`, `useEmailChange.ts` e `useDeleteAccount.ts`); na API, `apps/api/src/modules/profile/` e `apps/api/src/modules/auth/auth.service.ts`.

## Chamadas

| Ação | Chamada | Sucesso |
|---|---|---|
| Abrir | `GET /profile` (do cache do guard) e `GET /wallet` | Mostra o perfil e o saldo. |
| Trocar foto | Galeria, `POST /profile/photo-upload`, `PUT` do arquivo na URL assinada e `PATCH /profile` com `{ photoPath }` | A foto nova aparece. Sem foto, o avatar mostra a inicial do apelido. |
| Editar apelido | `PATCH /profile` com `{ nickname }` | A folha fecha e o apelido novo aparece. |
| Alterar celular | `PATCH /profile` com `{ phone }`, só os 11 dígitos | A folha fecha e o celular aparece com a máscara `(51) 99876-5432`. |
| Alterar e-mail | `supabase.auth.updateUser({ email })`, depois `supabase.auth.verifyOtp({ email, token, type: "email_change" })` | O Supabase manda o código ao e-mail novo. Com o código certo, a folha fecha e o app relê o perfil. |
| Sair | `supabase.auth.signOut()` | Volta ao login, sem confirmação. |
| Excluir conta | `DELETE /profile`, depois `supabase.auth.signOut()` | A API responde 204 e o app volta ao login. |

- A API acompanha a troca de e-mail: a cada chamada, se o e-mail do token for diferente do banco, ela grava o do token (`authenticateToken`).
- Quem entrou com o Google (`app_metadata.providers` com `google`) não vê o "Alterar" do e-mail, e sim o aviso `profile.googleEmail`.
- O app só liga o "Salvar" do celular com 11 dígitos, o DDD e o 9 na frente (`phoneSchema`, o mesmo da API), e o do apelido com o campo não vazio.

## Erros

Os erros que valem para toda rota estão em [erros comuns](erros-comuns.md).

| Código da API | Status | Quando | Tratamento no app | Chave do texto |
|---|---|---|---|---|
| `profileNotFound` | 404 | A conta não existe ao ler o perfil. Não deve acontecer, porque a autenticação cria a conta. | Aviso de perfil não carregado com "Tentar de novo". | `profile.loadFailed` |
| `photoNotOwned` | 422 | O `photoPath` não é da pasta da conta. É bug do app, porque ele manda o caminho que a API deu. | Aviso genérico na tela. | `errors.generic` |
| `validationFailed` | 400 | Apelido, celular ou foto fora do contrato, ou um campo travado no corpo. O app confere antes. | Erro genérico na folha. | `errors.generic` |
| `playerAlreadyInMatch` | 409 | A conta está numa partida em andamento ao excluir. | Erro na folha de excluir; a conta continua ativa. | `lobby.openMatch` |

### Erros do Supabase na troca de e-mail

| Código do Supabase | Quando | Tratamento no app | Chave do texto |
|---|---|---|---|
| `email_exists` | O e-mail novo já está em outra conta. | Erro na folha do e-mail. | `auth.emailInUse` |
| `over_email_send_rate_limit` | Pedidos de código demais. | Erro na folha. | `errors.tooManyRequests` |
| `otp_expired` | Código errado ou vencido. | Erro na folha do código. | `auth.invalidCode` |
| qualquer outro | Falha ao enviar ou ao conferir. | Erro na folha. | `auth.sendFailed`, `auth.invalidCode` |

### Falhas sem resposta útil

| Falha | Quando | Tratamento no app | Chave do texto |
|---|---|---|---|
| sem conexão ao ler o perfil | `GET /profile` falhou ao reler. | Aviso com "Tentar de novo". | `profile.loadFailed` |
| sem conexão ao salvar | `PATCH /profile` ou `DELETE /profile` falhou por rede ou tempo. | Erro na folha, que fica aberta. | `errors.unreachable` |
| tipo de foto | A galeria devolveu um tipo fora de JPEG, PNG ou WebP. | Aviso na tela. | `profile.invalidPhotoType` |
| envio da foto | O `PUT` do arquivo na URL assinada falhou. | Aviso na tela. | `profile.photoUploadFailed` |
| sem conexão no Supabase | `updateUser` ou `verifyOtp` sem rede. | Erro na folha. | `errors.unreachable` |

## Regra

- No perfil: foto da galeria ou boneco padrão; apelido e fichas numa parte separada; nome, CPF e nascimento sem edição; e-mail e celular; Sair e Excluir conta. (Plano.md, fatia 2, Perfil)
- O CPF aparece mascarado e o Sair não pede confirmação. Até chegarem os bonecos da cliente, a foto mostra a inicial do nome. (Plano.md, fatia 2, «Decisões do Lucas (04/11/2026)»)
- Trocar o e-mail pede confirmação por código; quem entra pelo Google não troca o e-mail. Celular sem confirmação por SMS. (Plano.md, «Decisões», Contato)
- Um código só, enviado ao e-mail novo, com o "Secure email change" desligado no Supabase. Apelido de 1 a 20 caracteres e editável; celular opcional, com 11 dígitos. (Lucas, 04/11/2026, plano da fatia 2 aprovado: "segue as sugestões")
- Excluir a conta desativa e mantém o extrato. (Plano.md, «Decisões», Excluir conta) A exclusão não solta o CPF e é recusada com partida aberta. (Lucas, 04/11/2026, plano da fatia 2 aprovado)
- O `DELETE /profile` trava a linha da conta antes de conferir a partida aberta, como o começo de partida faz. É comportamento do código.

## Testes

- `apps/api/src/modules/profile/profile.routes.spec.ts`: apelido e celular sem mexer no cadastro, campos travados e celular sem o 9 recusados, foto enviada e mostrada, foto de outra pasta, e-mail que acompanha o token, exclusão que desativa e guarda o CPF, e exclusão recusada com partida aberta.
- `apps/api/src/modules/profile/profile.service.spec.ts`: `update` com apelido, celular e foto, e os caminhos de foto recusados.
- `apps/api/src/modules/auth/auth.service.spec.ts`: o e-mail do token grava quando mudou e não grava quando é igual.
- `packages/api-contract/test/contract.test.ts`: formato do celular e os campos aceitos no `PATCH`.
- Sem teste automático: a tela do app e a troca de e-mail no Supabase.
