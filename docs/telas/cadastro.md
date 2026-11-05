# Cadastro

Quem entra pela primeira vez, ou tem uma conta da Fatia 1 sem CPF, cai nesta tela pelo guard de `apps/mobile/src/app/_layout.tsx` (`profile.complete` falso). A pessoa preenche nome completo, CPF, data de nascimento e apelido no jogo, confere numa folha e salva. Depois de salvo, o cadastro trava.

Código: `apps/mobile/src/features/profile/ProfileSetupScreen.tsx` e `useProfileSetup.ts`; na API, `POST /profile/registration` em `apps/api/src/modules/profile/`.

## Chamada

`POST /profile/registration` com `{ fullName, cpf, birthDate, nickname }`, depois de "Salvar" na folha "Confira seus dados".

Antes de enviar, o app confere e só liga o "Salvar" com tudo válido:

- nome completo e apelido não vazios (de 1 a 100 e de 1 a 20 caracteres, cortados pelo `maxLength`);
- CPF com 11 dígitos e os dígitos verificadores certos (`isValidCpf` do `packages/api-contract`, o mesmo da API). O campo mostra a máscara `000.000.000-00` e envia só os dígitos. Errado: `profile.invalidCpf` no campo;
- data de nascimento real no formato `DD/MM/AAAA`. Errada: `profile.invalidBirthDate` no campo.

Conta antiga: o apelido e a data de nascimento já vêm preenchidos do perfil, e a pessoa completa nome completo e CPF.

## Sucesso

A API responde 200 com o perfil completo. O app grava o perfil no cache (`setQueryData`) e o guard leva ao menu.

## Erros

Os erros que valem para toda rota estão em [erros comuns](erros-comuns.md).

| Código da API | Status | Quando | Tratamento no app | Chave do texto |
|---|---|---|---|---|
| `underage` | 422 | A pessoa tem menos de 18 anos na data de Brasília. | Fecha a folha e mostra o erro no campo de nascimento. | `errors.underage` |
| `cpfAlreadyRegistered` | 409 | O CPF já está em outra conta, inclusive quando duas contas salvam o mesmo CPF ao mesmo tempo. | Fecha a folha e mostra o erro no campo CPF. | `errors.cpfAlreadyRegistered` |
| `registrationLocked` | 409 | A conta já tem cadastro, por exemplo salvo em outra aba. | Fecha a folha e recarrega o perfil; o guard leva ao menu. | sem texto |
| `validationFailed` | 400 | Campo fora do contrato. Não deve acontecer, porque o app confere antes. | Fecha a folha e mostra o aviso genérico no topo. | `errors.generic` |

Editar qualquer campo apaga o erro que veio da API.

### Falhas sem resposta útil da API

| Falha | Quando | Tratamento no app | Chave do texto |
|---|---|---|---|
| sem conexão ou tempo esgotado | O `fetch` falhou ou passou do limite. | Fecha a folha e mostra o aviso no topo. Os campos ficam como estavam. | `errors.unreachable` |

## Regra

- Nome completo, CPF e data de nascimento são pedidos uma vez e travam ao salvar. Um CPF por conta, com os dígitos conferidos. (Plano.md, «Decisões», Cadastro)
- 18 anos ou mais, com a data de nascimento no cadastro; menores bloqueados. (Plano.md, «Decisões», Idade)
- O cadastro não tem foto e tem uma tela de conferência antes de travar os dados. Contas sem CPF vão para o cadastro completar ao entrar. (Plano.md, fatia 2, «Decisões do Lucas (04/11/2026)»)
- Nome completo de 1 a 100 caracteres, sem exigir sobrenome; apelido de 1 a 20, sem precisar ser único. O `name` da Fatia 1 virou o apelido. (Lucas, 04/11/2026, plano da fatia 2 aprovado: "segue as sugestões")
- O cadastro trava no banco: a gravação só acontece onde o CPF ainda é nulo, e o CPF é `UNIQUE`. Duas abas ao mesmo tempo não passam. É comportamento do código.
- O CPF confere só o formato e os dígitos, não a situação na Receita. É comportamento do código.

## Testes

- `apps/api/src/modules/profile/profile.routes.spec.ts`: cadastro completo, trava depois de salvo, duas chamadas da mesma conta ao mesmo tempo, CPF de outra conta, o mesmo CPF em duas contas ao mesmo tempo, conta antiga com apelido e nascimento, menor de 18 pela data de Brasília, campo desconhecido, data, CPF e apelido inválidos.
- `apps/api/src/modules/profile/profile.service.spec.ts`: perfil completo só com os quatro campos, idade pela data de Brasília e `registrationLocked`.
- `packages/api-contract/test/contract.test.ts`: dígitos do CPF, limites de nome completo e apelido, corte de espaços e campos extras.
- Sem teste automático: a tela do app.
